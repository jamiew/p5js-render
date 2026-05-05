function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(220);
  fill(255, 0, 0);
  circle(200 + sin(frameCount * 0.1) * 100, 200, 50);
}
