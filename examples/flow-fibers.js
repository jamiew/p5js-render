// Flow Fibers
// Hundreds of fibers trace a noise flow field and grow a little each frame
// until they pack the page, in the spirit of Tyler Hobbs' Fidenza. Every path
// is planned in setup against an occupancy grid, so strands of very different
// weights run side by side without piling on top of each other; draw() then
// reveals them outward from their seed points, boldest first.

const SIZE = 720;
const MARGIN = 60;
const STEP = 2;
const CELL = 3;
const GRID = Math.ceil(SIZE / CELL);

const PAPER = '#efe6d5';
const INK = '#1c2230';
const INKS = [
  [INK, 30],
  ['#2b4c7e', 14],
  ['#c8412c', 11],
  ['#e0a13a', 9],
  ['#e9b8a4', 14],
  ['#cdbb9c', 16]
];

// Weight classes, placed boldest first. Each class starts inside its window
// of the timeline and takes `grow` of the timeline to reach full length.
// Classes with `hug` also seed new fibers right beside existing ones, up to
// that many strands deep, which bundles them into flowing ribbons.
const CLASSES = [
  {
    w: [28, 38],
    tries: 6,
    len: [400, 900],
    start: [0, 0.08],
    grow: 0.42,
    hug: 0
  },
  {
    w: [13, 20],
    tries: 30,
    len: [250, 700],
    start: [0.05, 0.28],
    grow: 0.36,
    hug: 0
  },
  {
    w: [6, 9],
    tries: 300,
    len: [150, 600],
    start: [0.16, 0.48],
    grow: 0.3,
    hug: 0
  },
  {
    w: [2.6, 3.8],
    tries: 3000,
    len: [80, 450],
    start: [0.34, 0.68],
    grow: 0.24,
    hug: 2
  },
  {
    w: [1.1, 1.6],
    tries: 6000,
    len: [50, 350],
    start: [0.5, 0.74],
    grow: 0.2,
    hug: 5
  }
];

let owner, stamp;
let flowBase, twists;
let fibers = [];

function setup() {
  createCanvas(720, 720);
  noiseDetail(3, 0.5);
  paper();

  owner = new Int32Array(GRID * GRID).fill(-1);
  stamp = new Int32Array(GRID * GRID);

  flowBase = random(TWO_PI);
  twists = [];
  for (let i = 0; i < 3; i++) {
    twists.push({
      x: random(MARGIN, SIZE - MARGIN),
      y: random(MARGIN, SIZE - MARGIN),
      r2: sq(random(110, 190)),
      amount: random([-1, 1]) * random(0.9, 1.6)
    });
  }

  CLASSES.forEach((cls, c) => {
    const placed = [];
    const plant = (x, y, ink) => {
      const fiber = plantFiber(
        x,
        y,
        random(cls.w[0], cls.w[1]),
        random(cls.len[0], cls.len[1]),
        fibers.length + placed.length
      );
      if (fiber) {
        fiber.color = ink ?? pickInk(c);
        placed.push(fiber);
      }
      return fiber;
    };

    for (let t = 0; t < cls.tries; t++) {
      plant(random(MARGIN, SIZE - MARGIN), random(MARGIN, SIZE - MARGIN));
    }

    if (cls.hug > 0) {
      // Walk every strand so far and try to lay a new one alongside it, often
      // in the same color. New strands join the queue until the bundle is
      // `hug` strands deep.
      const queue = fibers.concat(placed).map((fiber) => [fiber, 0]);
      const reach = reachOf((cls.w[0] + cls.w[1]) / 2);
      for (let q = 0; q < queue.length; q++) {
        const [source, depth] = queue[q];
        if (depth >= cls.hug) continue;
        const gap = (source.reach + reach) * 1.15 + 1;
        for (const head of source.heads) {
          const pts = head.pts;
          for (let i = 2; i + 2 < pts.length; i += 16) {
            const dx = pts[i + 2] - pts[i - 2];
            const dy = pts[i + 3] - pts[i - 1];
            const d = Math.hypot(dx, dy) || 1;
            const side = random() < 0.5 ? gap : -gap;
            const fiber = plant(
              pts[i] - (dy / d) * side,
              pts[i + 1] + (dx / d) * side,
              random() < 0.5 ? source.color : undefined
            );
            if (fiber) queue.push([fiber, depth + 1]);
          }
        }
      }
    }

    placed.forEach((fiber, i) => {
      fiber.start = lerp(
        cls.start[0],
        cls.start[1],
        i / max(placed.length - 1, 1)
      );
      fiber.grow = cls.grow;
      fibers.push(fiber);
    });
  });
}

function paper() {
  background(PAPER);
  loadPixels();
  for (let i = 0; i < pixels.length; i += 4) {
    const grain = (random() - 0.5) * 9;
    pixels[i] += grain;
    pixels[i + 1] += grain;
    pixels[i + 2] += grain;
  }
  updatePixels();
}

function pickInk(weightClass) {
  // Hairlines lean on ink so the fine texture reads as drawing, not confetti.
  if (weightClass === CLASSES.length - 1 && random() < 0.5) return color(INK);
  let total = 0;
  for (const [, weight] of INKS) total += weight;
  let r = random(total);
  for (const [hex, weight] of INKS) {
    r -= weight;
    if (r <= 0) return color(hex);
  }
  return color(INK);
}

function fieldAngle(x, y) {
  let a = flowBase + (noise(x * 0.0022, y * 0.0022) - 0.5) * 3.2 * PI;
  for (const t of twists) {
    const dx = x - t.x;
    const dy = y - t.y;
    a += t.amount * Math.exp(-(dx * dx + dy * dy) / t.r2);
  }
  return a;
}

// Half the stroke plus breathing room, so heavier fibers keep a wider berth.
function reachOf(w) {
  return w / 2 + 1 + w * 0.1;
}

// Occupancy grid: each cell remembers which fiber claimed it and at which
// step, so a fiber can pass near its own recent points but not its old ones.
function isFree(x, y, reach, id, k) {
  const gx = x / CELL;
  const gy = y / CELL;
  const r = reach / CELL;
  const r2 = r * r;
  const skip = Math.ceil((2.5 * reach) / STEP) + 2;
  const x0 = Math.max(0, Math.floor(gx - r));
  const x1 = Math.min(GRID - 1, Math.ceil(gx + r));
  const y0 = Math.max(0, Math.floor(gy - r));
  const y1 = Math.min(GRID - 1, Math.ceil(gy + r));
  for (let cy = y0; cy <= y1; cy++) {
    const dy = cy + 0.5 - gy;
    for (let cx = x0; cx <= x1; cx++) {
      const dx = cx + 0.5 - gx;
      if (dx * dx + dy * dy > r2) continue;
      const c = cy * GRID + cx;
      const o = owner[c];
      if (o === -1) continue;
      if (o !== id || Math.abs(stamp[c] - k) > skip) return false;
    }
  }
  return true;
}

function claim(x, y, reach, id, k, release) {
  const gx = x / CELL;
  const gy = y / CELL;
  const r = reach / CELL;
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(gx - r));
  const x1 = Math.min(GRID - 1, Math.ceil(gx + r));
  const y0 = Math.max(0, Math.floor(gy - r));
  const y1 = Math.min(GRID - 1, Math.ceil(gy + r));
  for (let cy = y0; cy <= y1; cy++) {
    const dy = cy + 0.5 - gy;
    for (let cx = x0; cx <= x1; cx++) {
      const dx = cx + 0.5 - gx;
      if (dx * dx + dy * dy > r2) continue;
      const c = cy * GRID + cx;
      if (release) {
        if (owner[c] === id) owner[c] = -1;
      } else {
        owner[c] = id;
        stamp[c] = k;
      }
    }
  }
}

// Traces a fiber both ways from its seed. Fibers too short to read as
// strokes give their space back.
function plantFiber(x, y, w, len, id) {
  const reach = reachOf(w);
  if (!isFree(x, y, reach, id, 0)) return null;
  claim(x, y, reach, id, 0, false);
  const ahead = trace(x, y, reach, id, 1, Math.floor(len / 2 / STEP));
  const behind = trace(
    x,
    y,
    reach,
    id,
    -1,
    Math.floor(len / STEP) - ahead.length / 2
  );
  const steps = ahead.length / 2 + behind.length / 2 - 2;
  if (steps * STEP < Math.max(w * 5, 56)) {
    for (const pts of [ahead, behind]) {
      for (let i = 0; i < pts.length; i += 2) {
        claim(pts[i], pts[i + 1], reach, id, 0, true);
      }
    }
    return null;
  }
  return {
    w,
    reach,
    heads: [
      { pts: ahead, shown: 0 },
      { pts: behind, shown: 0 }
    ],
    longest: Math.max(ahead.length, behind.length) / 2 - 1
  };
}

function trace(x, y, reach, id, dir, maxSteps) {
  const pts = [x, y];
  const lo = MARGIN - reach - 2;
  const hi = SIZE - MARGIN + reach + 2;
  const turn = dir < 0 ? Math.PI : 0;
  for (let k = 1; k <= maxSteps; k++) {
    // Midpoint integration keeps tight curves smooth at a 2px step.
    const a1 = fieldAngle(x, y) + turn;
    const a2 =
      fieldAngle(x + Math.cos(a1) * STEP * 0.5, y + Math.sin(a1) * STEP * 0.5) +
      turn;
    const nx = x + Math.cos(a2) * STEP;
    const ny = y + Math.sin(a2) * STEP;
    if (nx < lo || nx > hi || ny < lo || ny > hi) break;
    if (!isFree(nx, ny, reach, id, dir * k)) break;
    claim(nx, ny, reach, id, dir * k, false);
    pts.push(nx, ny);
    x = nx;
    y = ny;
  }
  return pts;
}

function draw() {
  const frame = window.p5Render ? p5Render.frame : frameCount - 1;
  const frames = window.p5Render ? p5Render.totalFrames : 240;
  const p = min((frame + 1) / frames, 1);

  push();
  beginClip();
  rect(MARGIN, MARGIN, SIZE - 2 * MARGIN, SIZE - 2 * MARGIN);
  endClip();

  noFill();
  strokeCap(ROUND);
  strokeJoin(ROUND);
  for (const fiber of fibers) {
    if (p < fiber.start || fiber.done) continue;
    // Each fiber eases out as it reaches its full length.
    const u = min((p - fiber.start) / fiber.grow, 1);
    const reached = Math.floor(fiber.longest * (1 - (1 - u) * (1 - u))) + 1;
    stroke(fiber.color);
    strokeWeight(fiber.w);
    // Only the newly revealed stretch of each head is drawn this frame.
    for (const head of fiber.heads) {
      const n = Math.min(reached, head.pts.length / 2);
      if (n < 2 || n <= head.shown) continue;
      beginShape();
      for (let i = Math.max(head.shown - 1, 0); i < n; i++) {
        vertex(head.pts[2 * i], head.pts[2 * i + 1]);
      }
      endShape();
      head.shown = n;
    }
    if (u >= 1) fiber.done = true;
  }
  pop();
}
