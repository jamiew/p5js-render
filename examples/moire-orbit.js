// Moire Orbit
// Two families of fine concentric rings with slightly different pitches whose
// centers circle each other. Where the rings fall into and out of step, broad
// interference fringes bloom out of the center and sweep around the disc, in the
// spirit of Bridget Riley's op art and the exact, reduced graphics of Ryoji
// Ikeda. Nothing but stroked circles, clipped to a disc and framed by a dial.

const PITCH_A = 9; // ring pitch of each family in pixels
const PITCH_B = 10.5;
const WEIGHT = 3.4;
const WINDOW = 270; // radius of the visible disc
const INK = '#111111';
const PAPER = '#f2efe8';
const ACCENT = '#e0442b';

function setup() {
  createCanvas(720, 720);
  noFill();
}

function draw() {
  const t = window.p5Render ? p5Render.progress : (frameCount % 180) / 180;
  const a = TWO_PI * t;

  background(PAPER);
  translate(width / 2, height / 2);

  // The centers orbit opposite each other at a radius that breathes twice per loop
  const orbit = 5 + 15 * (0.5 - 0.5 * Math.cos(2 * a));
  const centers = [
    [orbit * Math.cos(a), orbit * Math.sin(a)],
    [-orbit * Math.cos(a), -orbit * Math.sin(a)]
  ];

  push();
  drawingContext.beginPath();
  drawingContext.arc(0, 0, WINDOW, 0, TWO_PI);
  drawingContext.clip();
  stroke(INK);
  strokeWeight(WEIGHT);
  // Family A drifts outward one pitch per loop, so the beat fringes stream out of the center
  rings(centers[0][0], centers[0][1], PITCH_A, PITCH_A * t);
  rings(centers[1][0], centers[1][1], PITCH_B, 0);
  pop();

  stroke(INK);
  strokeWeight(2);
  circle(0, 0, 2 * WINDOW);
  dial();

  // Accent: the two centers, and their bearing read off the dial
  stroke(ACCENT);
  strokeWeight(2.5);
  for (const s of [1, -1]) {
    const c = s * Math.cos(a);
    const d = s * Math.sin(a);
    line(
      (WINDOW + 8) * c,
      (WINDOW + 8) * d,
      (WINDOW + 30) * c,
      (WINDOW + 30) * d
    );
  }
  noStroke();
  fill(ACCENT);
  for (const [x, y] of centers) circle(x, y, 7);
  noFill();
}

function rings(x, y, pitch, shift) {
  const reach = WINDOW + Math.hypot(x, y) + pitch;
  const offset = ((shift % pitch) + pitch) % pitch;
  for (let r = offset; r < reach; r += pitch) {
    if (r < 1) continue;
    circle(x, y, 2 * r);
  }
}

// A fine instrument dial around the disc
function dial() {
  strokeWeight(1.25);
  for (let i = 0; i < 120; i++) {
    const ang = (i * TWO_PI) / 120;
    const len = i % 10 === 0 ? 14 : i % 5 === 0 ? 9 : 5;
    const r0 = WINDOW + 10;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    line(r0 * c, r0 * s, (r0 + len) * c, (r0 + len) * s);
  }
}
