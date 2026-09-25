// Schotter Drift
// An homage to Georg Nees's Schotter (1968), one of the first computer
// generated plotter drawings: a column of squares that falls from order into
// rubble. Here the disorder breathes, a wave of chaos travels down the grid and
// settles back into order, like pen lines on warm paper.
// Technique: each square keeps a fixed seeded rotation and offset that is only
// scaled by an animated disorder amount, so the motion stays smooth.

const COLS = 12;
const ROWS = 22;
const CELL = 26;
const PAPER = [239, 232, 216];
const INK = [38, 34, 31];
const ACCENT = [196, 72, 44];

let squares = [];
let paper;

function setup() {
  createCanvas(720, 720);
  frameRate(30);

  const x0 = (width - COLS * CELL) / 2;
  const y0 = (height - ROWS * CELL) / 2 - 8;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      squares.push({
        r,
        c,
        x: x0 + (c + 0.5) * CELL,
        y: y0 + (r + 0.5) * CELL,
        rot: random(-1, 1),
        dx: random(-1, 1),
        dy: random(-1, 1),
        lag: random(0, 1),
        accent: r > ROWS * 0.45 && random() < 0.045
      });
    }
  }
  // Accent squares are drawn last so their ink sits on top of shared edges.
  squares.sort((a, b) => a.accent - b.accent);

  paper = makePaper();
}

function draw() {
  const t = window.p5Render ? p5Render.progress : (frameCount % 180) / 180;

  image(paper, 0, 0);
  noFill();
  strokeJoin(MITER);
  rectMode(CENTER);

  for (const s of squares) {
    // Nees's gradient: disorder grows down the column.
    const depth = pow(s.r / (ROWS - 1), 1.15);
    // A breathing wave that travels down the grid, with a slight per square lag.
    const phase = t - (s.r / ROWS) * 0.55 - s.c * 0.018 - s.lag * 0.05;
    const breath = 0.5 - 0.5 * cos(TWO_PI * phase);
    const d = depth * (0.1 + 0.9 * breath);

    push();
    translate(s.x + s.dx * d * CELL * 0.55, s.y + s.dy * d * CELL * 0.55);
    rotate(s.rot * d * QUARTER_PI * 1.25);
    stroke(s.accent ? color(...ACCENT, 230) : color(...INK, 225));
    strokeWeight(1.15);
    rect(0, 0, CELL, CELL);
    pop();
  }
}

// Warm paper with soft fiber blotches and fine grain, built once.
function makePaper() {
  const g = createGraphics(720, 720);
  g.pixelDensity(1);
  g.loadPixels();
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const blotch = (noise(x * 0.012, y * 0.012) - 0.5) * 10;
      const fiber = (noise(x * 0.3, y * 0.05, 7) - 0.5) * 5;
      const grain = random(-3.5, 3.5);
      const dx = x / g.width - 0.5;
      const dy = y / g.height - 0.5;
      const vignette = -(dx * dx + dy * dy) * 26;
      const v = blotch + fiber + grain + vignette;
      const i = 4 * (y * g.width + x);
      g.pixels[i] = PAPER[0] + v;
      g.pixels[i + 1] = PAPER[1] + v;
      g.pixels[i + 2] = PAPER[2] + v * 1.1;
      g.pixels[i + 3] = 255;
    }
  }
  g.updatePixels();
  return g;
}
