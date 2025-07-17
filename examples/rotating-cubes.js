function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(0);
  
  let time = frameCount * 0.02;
  
  translate(width/2, height/2);
  
  // Create a field of rotating squares (2D version of cubes)
  for (let x = -3; x <= 3; x++) {
    for (let y = -2; y <= 2; y++) {
      push();
      
      translate(x * 80, y * 80);
      rotate(time + x * 0.5 + y * 0.3);
      
      // Color based on position and time
      let r = 255 * (sin(time + x) * 0.5 + 0.5);
      let g = 255 * (cos(time + y) * 0.5 + 0.5);
      let b = 255 * (sin(time + x + y) * 0.5 + 0.5);
      
      fill(r, g, b);
      noStroke();
      
      // Draw square with some perspective effects
      let size = 30 + sin(time + x + y) * 10;
      rect(-size/2, -size/2, size, size);
      
      // Add some depth effect with smaller squares
      fill(r * 0.7, g * 0.7, b * 0.7);
      let innerSize = size * 0.6;
      rect(-innerSize/2, -innerSize/2, innerSize, innerSize);
      
      pop();
    }
  }
}