function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(10, 10, 30);

  let time = frameCount * 0.008;

  // Animated fractal tree
  stroke(255, 200, 100);
  strokeWeight(2);

  translate(width / 2, height);

  // Start the recursive tree
  drawBranch(120, time, 8);
}

function drawBranch(length, time, depth) {
  if (depth === 0) return;

  // Draw current branch
  line(0, 0, 0, -length);

  // Move to end of branch
  translate(0, -length);

  // Left branch
  push();
  rotate(-PI / 6 + sin(time + depth * 0.5) * 0.3);

  // Color variation based on depth
  let r = 255 - depth * 20;
  let g = 200 - depth * 15;
  let b = 100 + depth * 30;
  stroke(r, g, b, 150);

  strokeWeight(depth * 0.3);
  drawBranch(length * 0.7, time, depth - 1);
  pop();

  // Right branch
  push();
  rotate(PI / 6 + cos(time * 1.2 + depth * 0.7) * 0.3);

  stroke(r, g, b, 150);
  strokeWeight(depth * 0.3);
  drawBranch(length * 0.7, time, depth - 1);
  pop();

  // Optional middle branch for more complexity
  if (depth > 4) {
    push();
    rotate(sin(time * 2 + depth) * 0.2);

    stroke(r + 50, g + 30, b - 20, 100);
    strokeWeight(depth * 0.2);
    drawBranch(length * 0.5, time, depth - 2);
    pop();
  }
}
