function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  background(0, 0, 0);

  let time = frameCount * 0.03;

  translate(width / 2, height / 2);

  // Simple tunnel rings
  for (let ring = 0; ring < 8; ring++) {
    let radius = 20 + ring * 30;
    let hue = (time * 100 + ring * 45) % 360;

    // Rotating segments
    let segments = 8;
    for (let seg = 0; seg < segments; seg++) {
      if ((seg + ring) % 2 === 0) {
        let angle = (seg / segments) * TWO_PI + time + ring * 0.3;
        let nextAngle = ((seg + 1) / segments) * TWO_PI + time + ring * 0.3;

        fill(hue, 80, 70, 40);
        stroke(hue, 80, 100, 60);
        strokeWeight(1);

        beginShape();
        vertex(0, 0);
        vertex(cos(angle) * radius, sin(angle) * radius);
        vertex(cos(nextAngle) * radius, sin(nextAngle) * radius);
        endShape(CLOSE);
      }
    }

    // Ring outline
    noFill();
    stroke(hue, 60, 80, 30);
    strokeWeight(2);
    circle(0, 0, radius * 2);
  }

  // Central core
  let coreSize = 15 + sin(time * 4) * 5;
  fill(300, 70, 100, 80);
  noStroke();
  circle(0, 0, coreSize);

  // Floating shapes
  for (let i = 0; i < 6; i++) {
    let angle = time + (i * TWO_PI) / 6;
    let x = cos(angle) * (80 + sin(time * 2 + i) * 30);
    let y = sin(angle) * (80 + sin(time * 2 + i) * 30);

    fill((time * 150 + i * 60) % 360, 80, 90, 50);
    noStroke();
    circle(x, y, 8);
  }
}
