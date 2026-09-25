// Reaction Diffusion
// Two virtual chemicals feed, react and spread across a grid until Turing
// patterns crawl outward like coral. This is the Gray-Scott model as explained
// by Karl Sims, simulated on a 288 x 288 grid and upscaled with bilinear
// sampling so the contours stay smooth at full size. Fresh growth glows
// coral and cools to cream as it settles.

const N = 288;
const SIZE = 720;
const TOTAL_ITERATIONS = 12800;
const FEED = 0.0545;
const KILL = 0.062;
const DA = 1.0;
const DB = 0.5;
const COOLING = 6000; // iterations for fresh growth to fade to cream

const INK = '#0b1320';
const FRESH = '#ec6a43';
const SETTLED = '#f1e4c9';

let A, B, nextA, nextB;
let left, right, up, down;
let arrival, tint;
let iterations = 0;

// Output pixel -> grid sample lookup for the bilinear upscale.
let s0, s1, sw, nearest;

// Two-dimensional color table: 32 ages x 128 concentration levels.
const AGES = 32;
const LEVELS = 128;
let lut;

function setup() {
  createCanvas(720, 720);
  pixelDensity(1);

  A = new Float32Array(N * N).fill(1);
  B = new Float32Array(N * N);
  nextA = new Float32Array(N * N);
  nextB = new Float32Array(N * N);
  arrival = new Int32Array(N * N).fill(-1);
  tint = new Uint16Array(N * N);

  // Wrapping neighbor lookups; the edges meet like a torus, so no border
  // artifacts creep in where the growth reaches the sides.
  left = new Int32Array(N);
  right = new Int32Array(N);
  up = new Int32Array(N);
  down = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    left[i] = (i + N - 1) % N;
    right[i] = (i + 1) % N;
    up[i] = ((i + N - 1) % N) * N;
    down[i] = ((i + 1) % N) * N;
  }

  seedBlob(N * 0.5, N * 0.5, 11);

  s0 = new Int32Array(SIZE);
  s1 = new Int32Array(SIZE);
  sw = new Float32Array(SIZE);
  nearest = new Int32Array(SIZE);
  for (let p = 0; p < SIZE; p++) {
    const g = constrain(((p + 0.5) * N) / SIZE - 0.5, 0, N - 1);
    s0[p] = floor(g);
    s1[p] = min(s0[p] + 1, N - 1);
    sw[p] = g - s0[p];
    nearest[p] = round(g);
  }

  lut = buildLut();
}

function seedBlob(cx, cy, r) {
  for (let y = floor(cy - r * 2); y <= cy + r * 2; y++) {
    for (let x = floor(cx - r * 2); x <= cx + r * 2; x++) {
      const angle = atan2(y - cy, x - cx);
      const edge = r * (0.7 + 0.6 * noise(1.3 + cos(angle), 1.3 + sin(angle)));
      if (dist(x, y, cx, cy) < edge) {
        const i = y * N + x;
        B[i] = 0.9;
        A[i] = 0.2;
      }
    }
  }
}

function buildLut() {
  const table = new Uint32Array(AGES * LEVELS);
  const ink = color(INK);
  const fresh = color(FRESH);
  const settled = color(SETTLED);
  for (let a = 0; a < AGES; a++) {
    const age = a / (AGES - 1);
    const body = lerpColor(fresh, settled, age * age * (3 - 2 * age));
    const glow = lerpColor(body, color(255, 251, 243), 0.35);
    for (let l = 0; l < LEVELS; l++) {
      const v = l / (LEVELS - 1);
      let c;
      if (v < 0.4) c = ink;
      else if (v < 0.6) c = lerpColor(ink, body, ease((v - 0.4) / 0.2));
      else c = lerpColor(body, glow, (v - 0.6) / 0.4);
      table[a * LEVELS + l] =
        (255 << 24) | (blue(c) << 16) | (green(c) << 8) | red(c);
    }
  }
  return table;
}

function ease(x) {
  return x * x * (3 - 2 * x);
}

function react(count) {
  for (let n = 0; n < count; n++) {
    for (let y = 0; y < N; y++) {
      const row = y * N;
      const u = up[y];
      const d = down[y];
      for (let x = 0; x < N; x++) {
        const i = row + x;
        const l = left[x];
        const r = right[x];
        const a = A[i];
        const b = B[i];
        const lapA =
          0.2 * (A[row + l] + A[row + r] + A[u + x] + A[d + x]) +
          0.05 * (A[u + l] + A[u + r] + A[d + l] + A[d + r]) -
          a;
        const lapB =
          0.2 * (B[row + l] + B[row + r] + B[u + x] + B[d + x]) +
          0.05 * (B[u + l] + B[u + r] + B[d + l] + B[d + r]) -
          b;
        const abb = a * b * b;
        nextA[i] = a + DA * lapA - abb + FEED * (1 - a);
        nextB[i] = b + DB * lapB + abb - (KILL + FEED) * b;
      }
    }
    [A, nextA] = [nextA, A];
    [B, nextB] = [nextB, B];
  }
  iterations += count;

  // Stamp when the pattern first reaches each cell, then turn age into a
  // row offset in the color table.
  for (let i = 0; i < N * N; i++) {
    if (arrival[i] < 0) {
      if (A[i] > 0.88) continue;
      arrival[i] = iterations;
    }
    const age = min((iterations - arrival[i]) / COOLING, 1);
    tint[i] = ((age * (AGES - 1)) | 0) * LEVELS;
  }
}

function draw() {
  const frame = window.p5Render ? p5Render.frame : frameCount - 1;
  const frames = window.p5Render ? p5Render.totalFrames : 240;
  const p = min((frame + 1) / frames, 1);

  react(round(TOTAL_ITERATIONS * p) - iterations);

  loadPixels();
  const out = new Uint32Array(pixels.buffer);
  const top = LEVELS - 1;
  let o = 0;
  for (let py = 0; py < SIZE; py++) {
    const r0 = s0[py] * N;
    const r1 = s1[py] * N;
    const rn = nearest[py] * N;
    const wy = sw[py];
    for (let px = 0; px < SIZE; px++) {
      const x0 = s0[px];
      const x1 = s1[px];
      const wx = sw[px];
      const b0 = B[r0 + x0] + (B[r0 + x1] - B[r0 + x0]) * wx;
      const b1 = B[r1 + x0] + (B[r1 + x1] - B[r1 + x0]) * wx;
      let v = (b0 + (b1 - b0) * wy) * 2.8;
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      out[o++] = lut[tint[rn + nearest[px]] + ((v * top) | 0)];
    }
  }
  updatePixels();
}
