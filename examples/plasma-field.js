function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100);
}

function draw() {
  background(0);

  let time = frameCount * 0.01;

  // Create plasma effect using sine waves
  loadPixels();

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      // Multiple sine wave interference patterns
      let wave1 = sin(x * 0.02 + time * 3);
      let wave2 = sin(y * 0.03 + time * 2);
      let wave3 = sin((x + y) * 0.015 + time * 4);
      let wave4 = sin(sqrt(x * x + y * y) * 0.02 + time * 5);

      // Combine waves
      let plasma = (wave1 + wave2 + wave3 + wave4) / 4;

      // Map to hue and brightness
      let hue = (plasma * 180 + 180 + time * 50) % 360;
      let brightness = plasma * 50 + 50;
      let saturation = 80;

      let index = (x + y * width) * 4;
      let c = color(hue, saturation, brightness);

      pixels[index] = red(c);
      pixels[index + 1] = green(c);
      pixels[index + 2] = blue(c);
      pixels[index + 3] = 255;
    }
  }

  updatePixels();

  // Add some floating particles
  fill(255, 255, 255, 50);
  noStroke();

  for (let i = 0; i < 20; i++) {
    let x = width / 2 + sin(time + i) * 300;
    let y = height / 2 + cos(time * 1.3 + i * 0.5) * 200;
    let size = sin(time * 2 + i) * 20 + 25;

    circle(x, y, size);
  }
}
