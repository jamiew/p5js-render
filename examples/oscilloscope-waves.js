function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  // Dark background with subtle fade
  fill(0, 0, 0, 20);
  rect(0, 0, width, height);

  let time = frameCount * 0.03;

  // Multiple oscilloscope-style waveforms
  for (let waveIndex = 0; waveIndex < 3; waveIndex++) {
    let waveOffset = waveIndex * 0.5;
    let yCenter = height / 2 + sin(time + waveOffset) * 80;

    strokeWeight(2 + sin(time + waveIndex) * 1);

    // Main waveform
    beginShape();
    noFill();

    for (let x = 0; x < width; x += 4) {
      let progress = x / width;

      // Complex waveform with multiple harmonics
      let wave1 = sin(progress * TWO_PI * 4 + time + waveOffset) * 60;
      let wave2 = sin(progress * TWO_PI * 8 + time * 1.5 + waveOffset) * 30;
      let wave3 = sin(progress * TWO_PI * 16 + time * 2 + waveOffset) * 15;
      let wave4 = sin(progress * TWO_PI * 32 + time * 3 + waveOffset) * 8;

      let y = yCenter + wave1 + wave2 + wave3 + wave4;

      // Color based on amplitude and position
      let amplitude = abs(wave1 + wave2 + wave3 + wave4);
      let hue = (time * 50 + waveIndex * 60 + x * 0.5) % 360;
      let saturation = 60 + amplitude * 0.3;
      let brightness = 50 + amplitude * 0.4;
      let alpha = 40 + amplitude * 0.2;

      stroke(hue, saturation, brightness, alpha);

      if (x === 0) {
        curveVertex(x, y);
      }
      curveVertex(x, y);
      if (x >= width - 2) {
        curveVertex(x, y);
      }
    }
    endShape();

    // Simplified glowing effect
    strokeWeight(4);
    stroke((time * 50 + waveIndex * 60) % 360, 80, 80, 20);
    noFill();
    circle(width / 2, yCenter, 60);
  }

  // Vertical scanning lines like CRT monitor
  stroke(120, 30, 80, 25);
  strokeWeight(1);
  for (let x = 0; x < width; x += 8) {
    let scanOffset = sin(time * 5 + x * 0.1) * 2;
    line(x + scanOffset, 0, x + scanOffset, height);
  }

  // Horizontal sync lines
  stroke(180, 40, 90, 15);
  strokeWeight(2);
  for (let y = 0; y < height; y += 40) {
    let syncOffset = sin(time * 2 + y * 0.05) * 5;
    line(0, y + syncOffset, width, y + syncOffset);
  }

  // Center crosshair
  stroke(60, 80, 90, 60);
  strokeWeight(1);
  line(width / 2, 0, width / 2, height);
  line(0, height / 2, width, height / 2);

  // Amplitude markers
  noStroke();
  fill(60, 60, 90, 40);
  for (let i = -3; i <= 3; i++) {
    if (i !== 0) {
      let y = height / 2 + i * 60;
      rect(width / 2 - 10, y - 1, 20, 2);
    }
  }
}
