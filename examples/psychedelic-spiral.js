function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  // Translucent background for trails
  fill(0, 0, 0, 3);
  rect(0, 0, width, height);
  
  let time = frameCount * 0.02;
  
  translate(width/2, height/2);
  
  // Multiple spiral layers with different speeds and colors
  for (let layer = 0; layer < 5; layer++) {
    let layerOffset = layer * 0.3;
    let numPoints = 180 + layer * 20;
    
    strokeWeight(2 - layer * 0.2);
    
    for (let i = 0; i < numPoints; i++) {
      let angle = (i / numPoints) * TWO_PI * 6; // 6 full rotations
      let spiralRadius = i * 1.5 + sin(time + layerOffset) * 50;
      
      // Animate the spiral
      let animatedAngle = angle + time * (1 + layer * 0.5);
      
      let x = cos(animatedAngle) * spiralRadius;
      let y = sin(animatedAngle) * spiralRadius;
      
      // Color cycling based on position and time
      let hue = (i * 2 + time * 50 + layer * 60) % 360;
      let saturation = 70 + sin(time + i * 0.1) * 30;
      let brightness = 60 + cos(time * 2 + i * 0.05) * 40;
      let alpha = 40 + sin(time + i * 0.02) * 30;
      
      stroke(hue, saturation, brightness, alpha);
      
      // Draw connecting lines between points
      if (i > 0) {
        let prevAngle = ((i-1) / numPoints) * TWO_PI * 6 + time * (1 + layer * 0.5);
        let prevRadius = (i-1) * 1.5 + sin(time + layerOffset) * 50;
        let prevX = cos(prevAngle) * prevRadius;
        let prevY = sin(prevAngle) * prevRadius;
        
        line(prevX, prevY, x, y);
      }
      
      // Draw glowing points at key positions
      if (i % 10 === 0) {
        fill(hue, saturation, brightness, alpha * 1.5);
        noStroke();
        circle(x, y, 8 + sin(time * 3 + i) * 4);
      }
    }
  }
  
  // Central pulsing core
  let coreSize = 20 + sin(time * 4) * 15;
  let coreHue = (time * 100) % 360;
  
  fill(coreHue, 80, 90, 70);
  noStroke();
  circle(0, 0, coreSize);
  
  fill(coreHue, 60, 100, 40);
  circle(0, 0, coreSize * 1.5);
}