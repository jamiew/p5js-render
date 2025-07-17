function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  // Dark background with slight transparency for trails
  fill(240, 80, 5, 15);
  rect(0, 0, width, height);
  
  let time = frameCount * 0.015;
  
  // Multiple morphing blob layers
  for (let layer = 0; layer < 3; layer++) {
    let layerTime = time + layer * 0.7;
    let numVertices = 32;
    let centerX = width/2 + sin(layerTime * 0.8) * 100;
    let centerY = height/2 + cos(layerTime * 0.6) * 80;
    
    // Create organic morphing shape with bezier curves
    let hue = (layerTime * 30 + layer * 120) % 360;
    let saturation = 60 + sin(layerTime) * 20;
    let brightness = 40 + layer * 15;
    let alpha = 25 + sin(layerTime * 2) * 15;
    
    fill(hue, saturation, brightness, alpha);
    stroke(hue, saturation + 20, brightness + 30, alpha * 2);
    strokeWeight(1.5);
    
    beginShape();
    for (let i = 0; i <= numVertices; i++) {
      let angle = (i / numVertices) * TWO_PI;
      
      // Multiple frequency modulation for organic shape
      let radius = 80 + 
        sin(angle * 3 + layerTime * 2) * 40 +
        cos(angle * 7 + layerTime * 1.5) * 20 +
        sin(angle * 13 + layerTime * 3) * 10;
      
      let x = centerX + cos(angle) * radius;
      let y = centerY + sin(angle) * radius;
      
      if (i === 0) {
        curveVertex(x, y);
      }
      curveVertex(x, y);
      if (i === numVertices) {
        curveVertex(x, y);
      }
    }
    endShape();
    
    // Inner pulsing core
    let coreRadius = 30 + sin(layerTime * 4) * 15;
    fill(hue, saturation, brightness + 40, alpha * 1.5);
    noStroke();
    circle(centerX, centerY, coreRadius);
  }
  
  // Floating particles that follow the morphing shapes
  noStroke();
  for (let i = 0; i < 50; i++) {
    let particleTime = time + i * 0.1;
    let x = width/2 + sin(particleTime + i) * (150 + sin(particleTime * 2) * 100);
    let y = height/2 + cos(particleTime * 1.3 + i * 0.7) * (120 + cos(particleTime) * 80);
    
    let size = 3 + sin(particleTime * 3 + i) * 2;
    let hue = (particleTime * 50 + i * 7) % 360;
    let alpha = 30 + sin(particleTime * 2 + i * 0.5) * 20;
    
    fill(hue, 70, 90, alpha);
    circle(x, y, size);
    
    // Particle trails
    fill(hue, 70, 90, alpha * 0.3);
    circle(x - cos(particleTime + i) * 5, y - sin(particleTime + i) * 5, size * 0.7);
  }
  
  // Screen-wide interference pattern overlay
  stroke(180, 30, 80, 8);
  strokeWeight(0.5);
  for (let x = 0; x < width; x += 4) {
    let waveY = height/2 + sin(x * 0.02 + time * 3) * 100 + cos(x * 0.01 + time * 2) * 50;
    point(x, waveY);
  }
}