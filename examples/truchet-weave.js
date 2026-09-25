// Truchet Weave
// Smith's quarter-circle Truchet tiles, after Cyril Stanley Smith and the flat,
// graphic tile studies of Vera Molnar and Kjetil Golid. A diagonal wave sweeps
// across the grid and back; each tile makes an eased quarter-turn as it passes,
// neighbors turning in opposite directions like gears, so the paths reroute.
// Every tile turns twice per loop, a half-turn that maps the tile onto itself.

const N = 10;
const CELL = 60;
const PAPER = '#efe8da';
const INK = '#1c2340';
const CORE = '#e4512f';

let flips = [];

function setup() {
  createCanvas(720, 720);
  randomSeed(7);
  for (let i = 0; i < N * N; i++) flips.push(random() < 0.5);
  strokeCap(ROUND);
  noFill();
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2;
}

// Quarter-turns completed by time t: one sweep from the top-left corner in the
// first half of the loop, one back from the bottom-right in the second half.
function turns(t, d) {
  const a = constrain((t - 0.03 - 0.24 * d) / 0.18, 0, 1);
  const b = constrain((t - 0.53 - 0.24 * (1 - d)) / 0.18, 0, 1);
  return easeInOutCubic(a) + easeInOutCubic(b);
}

function tileArcs(i, j, t) {
  const cx = (width - N * CELL) / 2 + (i + 0.5) * CELL;
  const cy = (height - N * CELL) / 2 + (j + 0.5) * CELL;
  const dir = (i + j) % 2 ? 1 : -1;
  const h = CELL / 2;
  push();
  translate(cx, cy);
  rotate(
    dir *
      HALF_PI *
      (turns(t, (i + j) / (2 * N - 2)) + (flips[i + j * N] ? 1 : 0))
  );
  arc(-h, -h, CELL, CELL, 0, HALF_PI);
  arc(h, h, CELL, CELL, PI, PI + HALF_PI);
  pop();
}

function draw() {
  const t = window.p5Render ? p5Render.progress : (frameCount % 120) / 120;
  background(PAPER);
  const m = (width - N * CELL) / 2;
  push();
  clip(() => rect(m, m, N * CELL, N * CELL));
  const passes = [
    [INK, 20],
    [CORE, 7]
  ];
  for (const [col, w] of passes) {
    stroke(col);
    strokeWeight(w);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) tileArcs(i, j, t);
  }
  pop();
}
