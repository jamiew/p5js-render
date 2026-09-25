// Pulsar Ridges
// An homage to Peter Saville's cover for Joy Division's Unknown Pleasures, which
// stacked successive radio pulses from pulsar CP 1919. Each ridge is filled with
// the background so nearer lines hide the ones behind, and the subpulses drift
// sideways from pulse to pulse, the way the real pulsar's do.
// Technique: a gaussian envelope times a periodic subpulse comb, modulated by
// noise sampled on a circle so the six second loop is seamless.

const ROWS = 72;
const LEFT = 160;
const RIGHT = 560;
const TOP = 168;
const GAP = 6;
const STEP = 2;
const HEIGHT = 96;

function setup() {
  createCanvas(720, 720);
  frameRate(30);
  noiseDetail(3, 0.5);
}

function draw() {
  const t = window.p5Render ? p5Render.progress : (frameCount % 180) / 180;
  const cx = cos(TWO_PI * t);
  const cy = sin(TWO_PI * t);

  background(12, 11, 10);
  strokeJoin(ROUND);

  const pts = [];
  for (let i = 0; i < ROWS; i++) {
    const base = TOP + i * GAP;

    // Per pulse loudness and subpulse phase. Two subpulse combs each slide one
    // full period per loop, in opposite directions, so the drift wraps seamlessly.
    const loud =
      0.45 + 1.1 * pow(noise(i * 0.13, 10 + cx * 0.7, 20 + cy * 0.7), 1.5);
    const phase = i * 0.07 + 2.5 * noise(i * 0.04, 50);

    pts.length = 0;
    for (let x = LEFT; x <= RIGHT; x += STEP) {
      const u = map(x, LEFT, RIGHT, -1, 1);
      const env = exp(-(u * u) / (2 * 0.24 * 0.24));
      const combA = pow(0.5 + 0.5 * cos(TWO_PI * (u / 0.26 - phase - t)), 4);
      const combB = pow(
        0.5 + 0.5 * cos(TWO_PI * (u / 0.15 + 1.7 * phase + t)),
        6
      );
      const field = noise(u * 2.2 + 100, i * 0.2 + cx * 0.45, 200 + cy * 0.45);
      const burst = constrain((field - 0.32) * 3, 0, 1.4);
      const comb = combA * 0.8 + combB * 0.45 * field;
      const main = env * loud * (0.08 + 0.1 * env + comb * burst * burst);
      const jitter =
        (noise(u * 18 + 300, i * 2.3 + cx * 0.9, 400 + cy * 0.9) - 0.5) *
        (0.025 + 0.16 * env);
      pts.push(base - HEIGHT * (main + jitter));
    }

    // Occluding fill in the background color.
    noStroke();
    fill(12, 11, 10);
    beginShape();
    vertex(LEFT, base + GAP * 3);
    for (let k = 0; k < pts.length; k++) vertex(LEFT + k * STEP, pts[k]);
    vertex(RIGHT, base + GAP * 3);
    endShape(CLOSE);

    // Soft halo, then the ink line.
    noFill();
    stroke(240, 228, 206, 28);
    strokeWeight(3.4);
    ridge(pts);
    stroke(242, 234, 218);
    strokeWeight(1.25);
    ridge(pts);
  }
}

function ridge(pts) {
  beginShape();
  for (let k = 0; k < pts.length; k++) vertex(LEFT + k * STEP, pts[k]);
  endShape();
}
