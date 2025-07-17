let paintStrokes = [];
let numStrokes = 6;
let particles = [];
let canvas;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  canvas = createGraphics(width, height);
  canvas.colorMode(HSB, 360, 100, 100, 100);
  
  for (let i = 0; i < numStrokes; i++) {
    paintStrokes.push(new PaintStroke(i));
  }
}

function draw() {
  background(0, 0, 8);
  
  let time = frameCount * 0.01;
  
  canvas.fill(0, 0, 0, 3);
  canvas.rect(0, 0, width, height);
  
  for (let stroke of paintStrokes) {
    stroke.update(time);
    stroke.paint(canvas);
  }
  
  updateParticles(time);
  
  image(canvas, 0, 0);
  
  drawParticles();
  drawSplatters(time);
}

class PaintStroke {
  constructor(id) {
    this.id = id;
    this.x = random(width);
    this.y = random(height);
    this.vx = 0;
    this.vy = 0;
    this.trail = [];
    this.maxTrail = 200;
    
    this.hue = (id * 60 + 180) % 360;
    this.saturation = 70 + random(30);
    this.brightness = 60 + random(30);
    
    this.phase = id * 1.2;
    this.energy = 1;
    this.brushSize = 15 + id * 5;
    
    this.flowX = random(-1, 1);
    this.flowY = random(-1, 1);
  }
  
  update(time) {
    let t = time + this.phase;
    
    let centerX = width/2 + sin(t * 0.3) * 100;
    let centerY = height/2 + cos(t * 0.25) * 80;
    
    let forceX = sin(t * 1.5 + this.id) * 2 + cos(t * 2.8) * 1.5;
    let forceY = cos(t * 1.3 + this.id) * 2 + sin(t * 2.2) * 1.5;
    
    let attractX = (centerX - this.x) * 0.001;
    let attractY = (centerY - this.y) * 0.001;
    
    this.flowX += random(-0.1, 0.1);
    this.flowY += random(-0.1, 0.1);
    this.flowX = constrain(this.flowX, -2, 2);
    this.flowY = constrain(this.flowY, -2, 2);
    
    this.vx += forceX + attractX + this.flowX * 0.3;
    this.vy += forceY + attractY + this.flowY * 0.3;
    
    this.vx *= 0.95;
    this.vy *= 0.95;
    
    let maxSpeed = 3;
    let speed = sqrt(this.vx*this.vx + this.vy*this.vy);
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }
    
    this.x += this.vx;
    this.y += this.vy;
    
    if (this.x < 0) this.x = width;
    if (this.x > width) this.x = 0;
    if (this.y < 0) this.y = height;
    if (this.y > height) this.y = 0;
    
    this.energy = 0.6 + sin(t * 4) * 0.3 + cos(t * 6 + this.id) * 0.1;
    
    this.trail.push({
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      energy: this.energy,
      time: t
    });
    
    if (this.trail.length > this.maxTrail) {
      this.trail.shift();
    }
    
    if (random() < 0.02 * this.energy) {
      this.spawnParticles();
    }
  }
  
  paint(g) {
    if (this.trail.length < 2) return;
    
    for (let layer = 0; layer < 3; layer++) {
      let layerAlpha = (3 - layer) * 8;
      let layerSize = this.brushSize * (1 + layer * 0.3);
      let layerHue = (this.hue + layer * 5) % 360;
      
      g.fill(layerHue, this.saturation - layer * 10, this.brightness + layer * 5, layerAlpha);
      g.noStroke();
      
      for (let i = layer; i < this.trail.length; i += 2) {
        if (i < 0) continue;
        
        let point = this.trail[i];
        let life = i / this.trail.length;
        let size = layerSize * point.energy * life;
        
        let wobbleX = sin(point.time * 5 + layer) * 3;
        let wobbleY = cos(point.time * 4 + layer) * 3;
        
        g.circle(point.x + wobbleX, point.y + wobbleY, size);
        
        if (i > 0) {
          let prevPoint = this.trail[i - 1];
          let speed = sqrt(point.vx*point.vx + point.vy*point.vy);
          
          if (speed > 0.5) {
            g.stroke(layerHue, this.saturation, this.brightness + 20, layerAlpha * 0.6);
            g.strokeWeight(size * 0.5);
            
            let dx = point.x - prevPoint.x;
            let dy = point.y - prevPoint.y;
            let perpX = -dy;
            let perpY = dx;
            let perpLen = sqrt(perpX*perpX + perpY*perpY);
            
            if (perpLen > 0) {
              perpX /= perpLen;
              perpY /= perpLen;
              
              let spread = size * 0.3;
              
              g.line(
                prevPoint.x + perpX * spread,
                prevPoint.y + perpY * spread,
                point.x + perpX * spread,
                point.y + perpY * spread
              );
              
              g.line(
                prevPoint.x - perpX * spread,
                prevPoint.y - perpY * spread,
                point.x - perpX * spread,
                point.y - perpY * spread
              );
            }
          }
        }
      }
    }
  }
  
  spawnParticles() {
    for (let i = 0; i < 3; i++) {
      particles.push({
        x: this.x + random(-20, 20),
        y: this.y + random(-20, 20),
        vx: this.vx * 0.5 + random(-2, 2),
        vy: this.vy * 0.5 + random(-2, 2),
        life: 1,
        maxLife: 60 + random(40),
        size: random(3, 8),
        hue: this.hue + random(-30, 30),
        saturation: this.saturation,
        brightness: this.brightness
      });
    }
  }
}

function updateParticles(time) {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    
    p.vx += random(-0.1, 0.1);
    p.vy += random(-0.1, 0.1) + 0.05;
    
    p.vx *= 0.98;
    p.vy *= 0.98;
    
    p.x += p.vx;
    p.y += p.vy;
    
    p.life--;
    
    if (p.life <= 0 || p.y > height + 50) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles() {
  for (let p of particles) {
    let life = p.life / p.maxLife;
    let alpha = life * 60;
    
    fill(p.hue, p.saturation, p.brightness, alpha);
    noStroke();
    circle(p.x, p.y, p.size * life);
    
    fill(p.hue, p.saturation * 0.7, p.brightness + 20, alpha * 0.5);
    circle(p.x, p.y, p.size * life * 2);
    
    stroke(p.hue, p.saturation * 0.5, p.brightness + 30, alpha * 0.8);
    strokeWeight(0.5);
    noFill();
    circle(p.x, p.y, p.size * life * 3);
  }
}

function drawSplatters(time) {
  for (let i = 0; i < 30; i++) {
    let x = (noise(i * 0.1, time * 0.5) * 1.2 - 0.1) * width;
    let y = (noise(i * 0.1 + 100, time * 0.3) * 1.2 - 0.1) * height;
    
    if (x < 0 || x > width || y < 0 || y > height) continue;
    
    let size = noise(i * 0.1 + 200, time * 0.4) * 15 + 2;
    let hue = (noise(i * 0.1 + 300, time * 0.2) * 360) % 360;
    let alpha = noise(i * 0.1 + 400, time * 0.6) * 30 + 5;
    
    fill(hue, 80, 90, alpha);
    noStroke();
    circle(x, y, size);
    
    if (random() < 0.1) {
      let numDrops = floor(random(3, 8));
      for (let j = 0; j < numDrops; j++) {
        let dropX = x + random(-size, size);
        let dropY = y + random(size * 0.5, size * 2);
        let dropSize = size * random(0.2, 0.6);
        
        fill(hue, 70, 80, alpha * 0.7);
        circle(dropX, dropY, dropSize);
      }
    }
  }
  
  stroke(200, 60, 90, 8);
  strokeWeight(0.3);
  for (let x = 0; x < width; x += 8) {
    let waveY = sin(x * 0.02 + time * 2) * 5;
    let alpha = abs(sin(x * 0.01 + time)) * 15;
    
    stroke(240, 40, 95, alpha);
    line(x, height/2 + waveY, x, height/2 + waveY + 2);
  }
}