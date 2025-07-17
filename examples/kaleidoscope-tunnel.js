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
    
    // Note: clip() is not supported in p5.js, using drawing bounds instead
    
    // Draw the pattern that will be reflected
    drawTunnelPattern(time + segment * 0.1);
    
    pop();
  }
}

function drawTunnelPattern(time) {
  // Very simple tunnel pattern
  for (let ring = 0; ring < 3; ring++) {
    let radius = 30 + ring * 30;
    let hue = (time * 100 + ring * 60) % 360;
    
    // Ring outline
    noFill();
    stroke(hue, 80, 90, 60);
    strokeWeight(2);
    circle(0, 0, radius * 2);
    
    // Ring fill
    fill(hue, 60, 70, 30);
    noStroke();
    circle(0, 0, radius * 2);
  }
  
  // Central core
  let coreSize = 20 + sin(time * 6) * 10;
  fill(300, 70, 100, 80);
  noStroke();
  circle(0, 0, coreSize);
}