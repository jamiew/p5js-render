// Cube Wave
// A homage to Dave Whyte (Bees & Bombs) and his classic cube wave: a square
// field of columns rising and falling in a wave that radiates from the center.
// Orthographic isometric camera, faces colored by hand in a three-tone palette
// instead of scene lighting, so every face reads as a flat graphic shape.

const N = 14;
const CELL = 27;
const MIN_H = 30;
const MAX_H = 230;

const BG = '#15161c';
const TOP = [243, 234, 216];
const SIDE_X = [222, 96, 62];
const SIDE_Z = [134, 46, 44];

function setup() {
  createCanvas(720, 720, WEBGL);
  noStroke();
}

function draw() {
  const t = window.p5Render ? p5Render.progress : (frameCount % 120) / 120;
  background(BG);
  ortho(-width / 2, width / 2, -height / 2, height / 2, -2000, 2000);
  translate(0, 92, 0);
  rotateX(-atan(1 / sqrt(2)));
  rotateY(QUARTER_PI);

  const half = (N * CELL) / 2;
  const maxD = dist(0, 0, half, half);
  const w = CELL * 0.5;

  beginShape(TRIANGLES);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = -half + (i + 0.5) * CELL;
      const z = -half + (j + 0.5) * CELL;
      const d = dist(x, z, 0, 0) / maxD;
      const s = 0.5 + 0.5 * sin(TWO_PI * t - d * 1.6 * PI);
      const h = lerp(MIN_H, MAX_H, s * s * (3 - 2 * s));
      boxFaces(x, z, w, h);
    }
  }
  endShape();
}

function quad3(c, a, b, cc, d) {
  fill(c[0], c[1], c[2]);
  vertex(a[0], a[1], a[2]);
  vertex(b[0], b[1], b[2]);
  vertex(cc[0], cc[1], cc[2]);
  vertex(a[0], a[1], a[2]);
  vertex(cc[0], cc[1], cc[2]);
  vertex(d[0], d[1], d[2]);
}

// Top and four sides of a column standing on the floor at y = 0 (y points down).
function boxFaces(x, z, w, h) {
  const x0 = x - w,
    x1 = x + w,
    z0 = z - w,
    z1 = z + w;
  const y0 = -h,
    y1 = 0;
  quad3(TOP, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  quad3(SIDE_X, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
  quad3(SIDE_X, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]);
  quad3(SIDE_Z, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  quad3(SIDE_Z, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]);
}
