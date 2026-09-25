// Dot Lattice
// A hexagonal lattice of dots swinging in and out along their radii and
// twisting slightly around the center, so bright folds of overlapping dots
// ripple outward as rings, in the spirit of Etienne Jacob and Bees & Bombs.
// Each frame sums several sub-frame time samples with additive blending
// (Etienne Jacob's motion blur technique), so moving dots smear into streaks.

const SPACING = 12;
const RADIUS = 300;
const SAMPLES = 10;
const SHUTTER = 2.0;
const CYCLES = 2;
const WAVES = 2.5;
const AMP = 20;
const TWIST = 0.1;
const DOT = 1.9;

let dots = [];

function setup() {
  createCanvas(720, 720);
  noStroke();
  const reach = RADIUS + AMP + SPACING;
  const rowH = (SPACING * sqrt(3)) / 2;
  const rows = ceil(reach / rowH);
  const cols = ceil(reach / SPACING);
  for (let j = -rows; j <= rows; j++) {
    for (let i = -cols; i <= cols; i++) {
      const x = (i + (j % 2 ? 0.5 : 0)) * SPACING;
      const y = j * rowH;
      const r = sqrt(x * x + y * y);
      if (r < reach) dots.push({ r, a: atan2(y, x) });
    }
  }
}

function draw() {
  const t = window.p5Render ? p5Render.progress : (frameCount % 120) / 120;
  const total = window.p5Render ? p5Render.totalFrames : 120;
  background(0);

  const ctx = drawingContext;
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255, 246, 232, ${1.25 / SAMPLES})`;

  for (let s = 0; s < SAMPLES; s++) {
    const ts = t + ((s / SAMPLES) * SHUTTER) / total;
    for (const d of dots) {
      const u = d.r / RADIUS;
      const phase = TWO_PI * (CYCLES * ts - WAVES * u);
      // Calm at the center, full swing everywhere else.
      const env = sstep(0, 0.22, u);
      const disp = AMP * env * sin(phase);
      const twist = TWIST * env * cos(phase);
      const rr = d.r + disp;
      const aa = d.a + twist;
      const x = rr * cos(aa);
      const y = rr * sin(aa);
      // Fade on the displaced radius so the silhouette stays a clean circle.
      const size = DOT * (1 - sstep(RADIUS - 14, RADIUS, rr));
      if (size <= 0.05) continue;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, TWO_PI);
      ctx.fill();
    }
  }
  ctx.restore();
}

function sstep(e0, e1, x) {
  const k = constrain((x - e0) / (e1 - e0), 0, 1);
  return k * k * (3 - 2 * k);
}
