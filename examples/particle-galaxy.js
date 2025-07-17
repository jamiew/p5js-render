function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  // Deep space background
  fill(240, 100, 3, 8);
  rect(0, 0, width, height);
  
  let time = frameCount * 0.02;
  let centerX = width/2;
  let centerY = height/2;
  
  // Galaxy spiral arms
  for (let arm = 0; arm < 4; arm++) {
    let armAngle = (arm / 4) * TWO_PI + time * 0.3;
    
    // Each arm has multiple particle streams
    for (let stream = 0; stream < 3; stream++) {
      let streamOffset = stream * 0.3;
      
      for (let i = 0; i < 200; i++) {
        let progress = i / 200;
        let radius = progress * 300 + 50;
        
        // Spiral equation with time animation
        let spiralAngle = armAngle + progress * PI * 3 + time + streamOffset;
        
        // Add turbulence to spiral
        let turbulence = sin(progress * 20 + time * 3) * 0.2 + 
                        cos(progress * 15 + time * 2) * 0.15;
        spiralAngle += turbulence;
        
        let x = centerX + cos(spiralAngle) * radius;
        let y = centerY + sin(spiralAngle) * radius;
        
        // Particle properties based on distance from center
        let distanceFromCenter = dist(x, y, centerX, centerY);
        let size = map(distanceFromCenter, 0, 350, 8, 1) + 
                  sin(time * 4 + i * 0.1) * 2;
        
        // Color shifts based on position and stream
        let hue = (distanceFromCenter * 0.5 + stream * 120 + time * 30) % 360;
        let saturation = 60 + sin(progress * 10 + time) * 30;
        let brightness = map(distanceFromCenter, 0, 350, 90, 30) + 
                        sin(time * 3 + i * 0.05) * 20;
        let alpha = map(distanceFromCenter, 0, 350, 80, 20);
        
        // Core particle
        fill(hue, saturation, brightness, alpha);
        noStroke();
        circle(x, y, size);
        
        // Glowing halo
        fill(hue, saturation * 0.7, brightness, alpha * 0.3);
        circle(x, y, size * 2.5);
        
        // Occasional bright flares
        if (i % 20 === 0 && sin(time * 2 + i) > 0.7) {
          fill(hue, saturation * 0.5, 100, alpha * 0.6);
          circle(x, y, size * 4);
          
          // Particle trails
          let trailLength = 8;
          for (let t = 1; t <= trailLength; t++) {
            let trailProgress = t / trailLength;
            let trailAngle = spiralAngle - trailProgress * 0.3;
            let trailRadius = radius - trailProgress * 20;
            
            let trailX = centerX + cos(trailAngle) * trailRadius;
            let trailY = centerY + sin(trailAngle) * trailRadius;
            
            fill(hue, saturation, brightness, alpha * (1 - trailProgress));
            circle(trailX, trailY, size * (1 - trailProgress * 0.8));
          }
        }
      }
    }
  }
  
  // Central black hole / bright core
  let coreSize = 30 + sin(time * 4) * 10;
  
  // Event horizon
  fill(0, 0, 0, 50);
  noStroke();
  circle(centerX, centerY, coreSize * 3);
  
  // Accretion disk
  stroke(60, 80, 90, 30);
  strokeWeight(2);
  noFill();
  for (let ring = 0; ring < 5; ring++) {
    let ringRadius = coreSize * (2 + ring * 0.8);
    let ringTime = time * (2 + ring * 0.5);
    
    beginShape();
    for (let a = 0; a < TWO_PI; a += 0.2) {
      let diskR = ringRadius + sin(a * 8 + ringTime) * 5;
      let diskX = centerX + cos(a + ringTime) * diskR;
      let diskY = centerY + sin(a + ringTime) * diskR;
      curveVertex(diskX, diskY);
    }
    endShape(CLOSE);
  }
  
  // Bright core
  fill(60, 60, 100, 80);
  noStroke();
  circle(centerX, centerY, coreSize);
  
  fill(60, 30, 100, 60);
  circle(centerX, centerY, coreSize * 1.5);
  
  fill(60, 10, 100, 40);
  circle(centerX, centerY, coreSize * 2);
  
  // Distant stars
  noStroke();
  for (let star = 0; star < 100; star++) {
    let starX = (star * 37) % width;
    let starY = (star * 73) % height;
    let twinkle = sin(time * 3 + star) * 0.5 + 0.5;
    
    fill(200, 20, 90, 30 + twinkle * 20);
    circle(starX, starY, 1 + twinkle);
  }
}