function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  fill(0, 0, 0, 30);
  rect(0, 0, width, height);
  
  let time = frameCount * 0.05;
  
  // Simple oscilloscope waves
  for (let wave = 0; wave < 3; wave++) {
    let waveOffset = wave * TWO_PI / 3;
    let yCenter = height/2 + sin(time + wave) * 50;
    
    stroke((time * 100 + wave * 120) % 360, 80, 90, 60);
    strokeWeight(3);
    noFill();
    
    beginShape();
    for (let x = 0; x < width; x += 8) {
      let y = yCenter + sin(x * 0.02 + time + waveOffset) * 80;
      vertex(x, y);
    }
    endShape();
    
    // Glow effect
    stroke((time * 100 + wave * 120) % 360, 60, 100, 20);
    strokeWeight(8);
    beginShape();
    for (let x = 0; x < width; x += 16) {
      let y = yCenter + sin(x * 0.02 + time + waveOffset) * 80;
      vertex(x, y);
    }
    endShape();
  }
  
  // Grid lines
  stroke(180, 30, 50, 20);
  strokeWeight(1);
  for (let x = 0; x < width; x += 40) {
    line(x, 0, x, height);
  }
  for (let y = 0; y < height; y += 40) {
    line(0, y, width, y);
  }
}