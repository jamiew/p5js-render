// Hello Loop
// The smallest seamless loop: twelve dots orbit and breathe on a soft background.
// Every motion is built from whole periods of t, so the last frame flows into the first.

function setup() {
  createCanvas(720, 720);
  noStroke();
}

function draw() {
  // p5Render.progress runs from 0 up to (not including) 1 over the render.
  // In the p5 web editor, fall back to a 90-frame cycle.
  const t = window.p5Render ? p5Render.progress : (frameCount % 90) / 90;

  background('#f3ede4');
  translate(width / 2, height / 2);

  for (let i = 0; i < 12; i++) {
    const a = (TWO_PI * (i + t)) / 12; // each dot travels to its neighbor's spot
    const wave = sin(2 * a - TWO_PI * t); // two swells ride around the ring
    const r = 200 + 60 * wave;
    fill(lerpColor(color('#3d5a80'), color('#ee6c4d'), (wave + 1) / 2));
    circle(r * cos(a), r * sin(a), 46 + 24 * wave);
  }
}
