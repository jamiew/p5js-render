let cubes = [];
let numCubes = 25;
let gridSize = 5;
let lightSources = [];

function setup() {
  createCanvas(800, 600, WEBGL);
  colorMode(HSB, 360, 100, 100, 100);
  
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      cubes.push(new LightCube(i, j));
    }
  }
  
  for (let i = 0; i < 3; i++) {
    lightSources.push({
      x: random(-400, 400),
      y: random(-300, 300),
      z: random(-200, 200),
      phase: i * TWO_PI / 3,
      intensity: 1
    });
  }
}

function draw() {
  background(0, 0, 5);
  
  let time = frameCount * 0.008;
  
  lights();
  
  for (let light of lightSources) {
    light.x = cos(time + light.phase) * 200;
    light.y = sin(time * 1.3 + light.phase) * 150;
    light.z = sin(time * 0.8 + light.phase) * 100;
    light.intensity = 0.8 + sin(time * 2 + light.phase) * 0.2;
    
    pointLight(0, 0, 100, light.x, light.y, light.z);
  }
  
  ambientLight(0, 0, 15);
  
  push();
  rotateX(sin(time * 0.7) * 0.2);
  rotateY(time * 0.5);
  rotateZ(sin(time * 0.3) * 0.1);
  
  for (let cube of cubes) {
    cube.update(time);
    cube.display();
  }
  
  pop();
  
  drawVolumetricEffects(time);
  drawHologramGrid(time);
}

class LightCube {
  constructor(gridX, gridY) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.baseX = (gridX - gridSize/2) * 80;
    this.baseY = (gridY - gridSize/2) * 80;
    this.baseZ = 0;
    
    this.x = this.baseX;
    this.y = this.baseY;
    this.z = this.baseZ;
    
    this.size = 30 + random(20);
    this.phase = (gridX + gridY) * 0.3;
    this.rotX = 0;
    this.rotY = 0;
    this.rotZ = 0;
    
    this.opacity = 0.8;
    this.glowIntensity = 1;
  }
  
  update(time) {
    let t = time + this.phase;
    
    this.z = sin(t * 2 + this.gridX * 0.5) * 40 + cos(t * 1.5 + this.gridY * 0.3) * 20;
    
    this.x = this.baseX + sin(t * 1.2) * 10;
    this.y = this.baseY + cos(t * 0.9) * 8;
    
    this.rotX = t * 0.8 + this.gridX * 0.2;
    this.rotY = t * 0.6 + this.gridY * 0.3;
    this.rotZ = sin(t) * 0.1;
    
    this.opacity = 0.6 + sin(t * 3) * 0.3;
    this.glowIntensity = 0.7 + sin(t * 2.5 + this.gridX + this.gridY) * 0.3;
    
    let wave = sin(t * 1.5 - this.gridX * 0.5 - this.gridY * 0.3) * 0.5 + 0.5;
    this.size = 25 + wave * 15;
  }
  
  display() {
    push();
    translate(this.x, this.y, this.z);
    rotateX(this.rotX);
    rotateY(this.rotY);
    rotateZ(this.rotZ);
    
    let brightness = 85 + this.glowIntensity * 15;
    let alpha = this.opacity * 60;
    
    fill(0, 0, brightness, alpha);
    stroke(180, 80, 100, alpha * 1.5);
    strokeWeight(1.5);
    
    box(this.size);
    
    fill(0, 0, 100, alpha * 0.3);
    noStroke();
    box(this.size * 1.1);
    
    stroke(190, 60, 100, alpha * 0.8);
    strokeWeight(0.8);
    noFill();
    box(this.size * 1.3);
    
    for (let i = 0; i < 8; i++) {
      let cornerX = (i & 1 ? 1 : -1) * this.size/2;
      let cornerY = (i & 2 ? 1 : -1) * this.size/2;
      let cornerZ = (i & 4 ? 1 : -1) * this.size/2;
      
      push();
      translate(cornerX, cornerY, cornerZ);
      
      fill(200, 70, 100, alpha);
      noStroke();
      sphere(2);
      
      fill(200, 40, 100, alpha * 0.5);
      sphere(4);
      
      pop();
    }
    
    pop();
  }
}

function drawVolumetricEffects(time) {
  for (let light of lightSources) {
    push();
    translate(light.x, light.y, light.z);
    
    fill(0, 0, 100, 20 * light.intensity);
    noStroke();
    sphere(30 + sin(time * 3) * 10);
    
    fill(180, 60, 100, 10 * light.intensity);
    sphere(60 + sin(time * 2) * 20);
    
    stroke(190, 50, 100, 30 * light.intensity);
    strokeWeight(0.5);
    noFill();
    
    for (let r = 20; r < 100; r += 15) {
      push();
      rotateY(time + r * 0.1);
      rotateX(time * 0.7 + r * 0.05);
      circle(0, 0, r);
      pop();
    }
    
    pop();
  }
}

function drawHologramGrid(time) {
  push();
  
  stroke(180, 40, 90, 15);
  strokeWeight(0.3);
  
  for (let x = -400; x <= 400; x += 40) {
    let waveY = sin(x * 0.01 + time * 2) * 20;
    line(x, -300 + waveY, 0, x, 300 + waveY, 0);
  }
  
  for (let y = -300; y <= 300; y += 40) {
    let waveX = cos(y * 0.01 + time * 1.5) * 15;
    line(-400 + waveX, y, 0, 400 + waveX, y, 0);
  }
  
  stroke(200, 60, 100, 20);
  strokeWeight(0.8);
  
  for (let i = 0; i < 20; i++) {
    let angle = i * TWO_PI / 20;
    let radius = 250 + sin(time + i) * 50;
    let x1 = cos(angle) * radius;
    let y1 = sin(angle) * radius;
    let x2 = cos(angle + TWO_PI/20) * radius;
    let y2 = sin(angle + TWO_PI/20) * radius;
    
    line(x1, y1, sin(time + i) * 30, x2, y2, sin(time + i + 1) * 30);
  }
  
  push();
  rotateY(time);
  stroke(210, 80, 100, 25);
  strokeWeight(1);
  noFill();
  
  for (let r = 50; r < 300; r += 50) {
    circle(0, 0, r);
  }
  
  pop();
  
  for (let cube of cubes) {
    push();
    translate(cube.x, cube.y, cube.z - 60);
    
    fill(0, 0, 30, 15);
    noStroke();
    
    let shadowSize = cube.size * 1.2;
    ellipse(0, 0, shadowSize, shadowSize * 0.6);
    
    stroke(0, 0, 40, 20);
    strokeWeight(0.5);
    noFill();
    rect(-shadowSize/2, -shadowSize*0.3, shadowSize, shadowSize*0.6);
    
    pop();
  }
  
  pop();
}