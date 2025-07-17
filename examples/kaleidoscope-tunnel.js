function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  background(0, 0, 0);
  
  let time = frameCount * 0.025;
  
  translate(width/2, height/2);
  
  // Create kaleidoscope effect with fewer reflections for performance
  let segments = 6;
  let segmentAngle = TWO_PI / segments;
  
  for (let segment = 0; segment < segments; segment++) {
    push();
    rotate(segment * segmentAngle);
    
    // Clip to triangle for kaleidoscope effect
    beginShape();
    vertex(0, 0);
    vertex(400, 0);
    vertex(400 * cos(segmentAngle), 400 * sin(segmentAngle));
    endShape(CLOSE);
    clip();
    
    // Draw the pattern that will be reflected
    drawTunnelPattern(time + segment * 0.1);
    
    pop();
  }
}

function drawTunnelPattern(time) {
  // Tunnel rings receding into distance (reduced for performance)
  for (let ring = 0; ring < 10; ring++) {
    let ringTime = time + ring * 0.2;
    let baseRadius = 20 + ring * 15;
    let tunnelDepth = ring * 10;
    
    // Perspective scaling
    let perspective = 1 / (1 + tunnelDepth * 0.02);
    let radius = baseRadius * perspective;
    
    if (radius < 1) continue;
    
    // Ring rotation
    let rotation = ringTime + ring * 0.3;
    
    // Number of segments in this ring
    let numSegments = 8 + ring % 4;
    
    for (let seg = 0; seg < numSegments; seg++) {
      let segAngle = (seg / numSegments) * TWO_PI + rotation;
      
      // Alternating pattern
      if ((seg + ring) % 2 === 0) {
        // Bright segments
        let hue = (ringTime * 100 + ring * 30 + seg * 15) % 360;
        let saturation = 70 + sin(ringTime + seg) * 20;
        let brightness = 60 + cos(ringTime * 2 + ring) * 30;
        let alpha = 40 + (20 - ring) * 3;
        
        fill(hue, saturation, brightness, alpha);
        stroke(hue, saturation, brightness + 20, alpha * 1.5);
        strokeWeight(1 * perspective);
        
        // Draw segment as triangle slice
        beginShape();
        vertex(0, 0);
        let x1 = cos(segAngle) * radius;
        let y1 = sin(segAngle) * radius;
        let x2 = cos(segAngle + TWO_PI/numSegments) * radius;
        let y2 = sin(segAngle + TWO_PI/numSegments) * radius;
        vertex(x1, y1);
        vertex(x2, y2);
        endShape(CLOSE);
        
        // Inner glow lines
        stroke(hue, saturation * 0.7, 100, alpha * 0.8);
        strokeWeight(2 * perspective);
        line(x1 * 0.7, y1 * 0.7, x1, y1);
        line(x2 * 0.7, y2 * 0.7, x2, y2);
      }
    }
    
    // Ring outline
    noFill();
    let ringHue = (time * 80 + ring * 20) % 360;
    stroke(ringHue, 60, 80, 30 - ring);
    strokeWeight(1 * perspective);
    circle(0, 0, radius * 2);
  }
  
  // Floating geometric shapes (reduced count)
  for (let shape = 0; shape < 8; shape++) {
    let shapeTime = time + shape * 0.4;
    let orbitRadius = 80 + sin(shapeTime) * 40;
    let orbitAngle = shapeTime * 0.8 + shape;
    
    let x = cos(orbitAngle) * orbitRadius;
    let y = sin(orbitAngle) * orbitRadius;
    
    push();
    translate(x, y);
    rotate(shapeTime * 2);
    
    let hue = (shapeTime * 150 + shape * 25) % 360;
    let size = 8 + sin(shapeTime * 3) * 4;
    
    fill(hue, 80, 90, 50);
    stroke(hue, 80, 100, 70);
    strokeWeight(1);
    
    if (shape % 3 === 0) {
      // Triangle
      beginShape();
      for (let i = 0; i < 3; i++) {
        let angle = (i / 3) * TWO_PI;
        vertex(cos(angle) * size, sin(angle) * size);
      }
      endShape(CLOSE);
    } else if (shape % 3 === 1) {
      // Square
      rect(-size/2, -size/2, size, size);
    } else {
      // Circle
      circle(0, 0, size);
    }
    
    pop();
  }
  
  // Energy lines radiating from center
  stroke(180, 70, 90, 20);
  strokeWeight(1);
  for (let line = 0; line < 16; line++) {
    let lineAngle = (line / 16) * TWO_PI + time;
    let lineLength = 200 + sin(time * 2 + line) * 50;
    
    let pulseOffset = sin(time * 4 + line * 0.5) * 20;
    
    line(pulseOffset, 0, 
         cos(lineAngle) * lineLength, 
         sin(lineAngle) * lineLength);
  }
  
  // Central core
  let coreSize = 15 + sin(time * 6) * 8;
  fill(300, 70, 100, 80);
  noStroke();
  circle(0, 0, coreSize);
  
  fill(300, 40, 100, 60);
  circle(0, 0, coreSize * 1.5);
  
  fill(300, 20, 100, 40);
  circle(0, 0, coreSize * 2);
}