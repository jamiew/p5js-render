function setup() {
  createCanvas(800, 600, WEBGL);
}

function draw() {
  background(0);
  
  // Dynamic lighting based on time
  let time = frameCount * 0.02;
  
  ambientLight(30);
  directionalLight(255, 150, 100, cos(time), sin(time), -1);
  pointLight(100, 200, 255, sin(time * 2) * 200, cos(time * 2) * 200, 100);
  
  // Create a field of rotating cubes
  for (let x = -3; x <= 3; x++) {
    for (let y = -2; y <= 2; y++) {
      push();
      
      translate(x * 80, y * 80, sin(time + x + y) * 50);
      
      rotateX(time + x * 0.5);
      rotateY(time * 1.2 + y * 0.3);
      rotateZ(time * 0.8 + x * y * 0.1);
      
      // Color based on position and time
      let r = 255 * (sin(time + x) * 0.5 + 0.5);
      let g = 255 * (cos(time + y) * 0.5 + 0.5);
      let b = 255 * (sin(time + x + y) * 0.5 + 0.5);
      
      fill(r, g, b);
      noStroke();
      
      box(30);
      pop();
    }
  }
}