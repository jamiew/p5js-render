// Clifford Bloom
// A Clifford strange attractor, the four-parameter map popularized by Clifford
// Pickover, drawn as a glowing density map in the tradition of fractal flame
// renders. Each frame iterates a million points into a histogram, tone-maps it
// with a log curve, and walks the four parameters around a closed loop.

const RES = 720; // histogram resolution, one bin per canvas pixel
const POINTS = 1000000;

// Parameter loop: base + amp * sin(freq * TWO_PI * (t + START) + phase).
// Sampled densely offline to confirm every point on it stays chaotic.
const BASE = [-1.659, 1.847, 1.165, -1.493];
const AMP = [0.236, 0.3, 0.068, 0.215];
const FREQ = [1, 2, 2, 1];
const PHASE = [2.038, 1.104, 3.62, 0.732];
const START = 0.45; // where on the loop the first frame sits
const BG = '#04060d';

let hist, tmp, img, lut;

function setup() {
  createCanvas(720, 720);
  pixelDensity(1);
  hist = new Float32Array(RES * RES);
  tmp = new Float32Array(RES * RES);
  img = createImage(RES, RES);
  lut = buildPalette([
    [0.0, BG],
    [0.22, '#0a1830'],
    [0.46, '#124e6a'],
    [0.66, '#3fa3b8'],
    [0.84, '#bfe8e4'],
    [1.0, '#fff3e0']
  ]);
}

function draw() {
  const t = window.p5Render ? p5Render.progress : (frameCount % 240) / 240;
  const phase = TWO_PI * (t + START);
  const [a, b, c, d] = BASE.map(
    (v, i) => v + AMP[i] * Math.sin(FREQ[i] * phase + PHASE[i])
  );

  hist.fill(0);
  const scale = (RES * 0.5) / 3.2;
  const half = RES * 0.5;
  let x = 0.1;
  let y = 0.1;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < POINTS; i++) {
    const nx = Math.sin(a * y) + c * Math.cos(a * x);
    const ny = Math.sin(b * x) + d * Math.cos(b * y);
    x = nx;
    y = ny;
    if (i < 20) continue;
    cx += x;
    cy += y;
    const px = (half + x * scale) | 0;
    const py = (half + y * scale) | 0;
    hist[py * RES + px] += 1;
  }
  smooth121(hist, tmp);

  // Normalize against the mean density of lit bins so brightness stays steady as the shape changes
  let sum = 0;
  let lit = 0;
  for (let i = 0; i < hist.length; i++) {
    if (hist[i] > 0) {
      sum += hist[i];
      lit++;
    }
  }
  const gain = 1 / (sum / lit);
  const norm = 1 / Math.log(1 + 7);

  img.loadPixels();
  const px = img.pixels;
  for (let i = 0; i < hist.length; i++) {
    let v = Math.log(1 + hist[i] * gain) * norm;
    v = v > 1 ? 1 : v;
    const k = (v * 1023) | 0;
    px[i * 4] = lut[k * 3];
    px[i * 4 + 1] = lut[k * 3 + 1];
    px[i * 4 + 2] = lut[k * 3 + 2];
    px[i * 4 + 3] = 255;
  }
  img.updatePixels();

  // Center on the attractor's centroid so the drifting shape stays composed.
  // Both layers add light over the background, so the image edges never show.
  const ox = (-cx / (POINTS - 20)) * scale;
  const oy = (-cy / (POINTS - 20)) * scale;
  background(BG);
  drawingContext.save();
  drawingContext.globalCompositeOperation = 'lighter';
  image(img, ox, oy, width, height);
  drawingContext.globalAlpha = 0.3;
  drawingContext.filter = 'blur(10px)';
  image(img, ox, oy, width, height);
  drawingContext.restore();
}

// Separable [1 2 1] blur, softens sampling grain without losing the filaments
function smooth121(h, scratch) {
  const n = RES;
  for (let y = 0; y < n; y++) {
    const row = y * n;
    for (let x = 1; x < n - 1; x++) {
      scratch[row + x] =
        (h[row + x - 1] + 2 * h[row + x] + h[row + x + 1]) * 0.25;
    }
  }
  for (let y = 1; y < n - 1; y++) {
    const row = y * n;
    for (let x = 0; x < n; x++) {
      h[row + x] =
        (scratch[row - n + x] + 2 * scratch[row + x] + scratch[row + n + x]) *
        0.25;
    }
  }
}

// Palette as light added over the background color
function buildPalette(stops) {
  const out = new Uint8Array(1024 * 3);
  const cols = stops.map(([p, hex]) => [p, color(hex)]);
  const bg = color(BG);
  for (let i = 0; i < 1024; i++) {
    const p = i / 1023;
    let j = 0;
    while (j < cols.length - 2 && p > cols[j + 1][0]) j++;
    const [p0, c0] = cols[j];
    const [p1, c1] = cols[j + 1];
    const f = constrain((p - p0) / (p1 - p0), 0, 1);
    const s = f * f * (3 - 2 * f);
    const cc = lerpColor(c0, c1, s);
    out[i * 3] = red(cc) - red(bg);
    out[i * 3 + 1] = green(cc) - green(bg);
    out[i * 3 + 2] = blue(cc) - blue(bg);
  }
  return out;
}
