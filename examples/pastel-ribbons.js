let ribbons = [];
let numRibbons = 12;
let flowField = [];
let cols, rows;
let resolution = 25;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);

  cols = floor(width / resolution);
  rows = floor(height / resolution);

  flowField = new Array(cols * rows);

  for (let i = 0; i < numRibbons; i++) {
    ribbons.push(new Ribbon(i));
  }
}

function draw() {
  background(230, 25, 95, 8);

  let time = frameCount * 0.006;

  updateFlowField(time);

  for (let ribbon of ribbons) {
    ribbon.update(time);
    ribbon.display();
  }

  drawFlowFieldVisualization();
}

function updateFlowField(time) {
  let yoff = 0;
  for (let y = 0; y < rows; y++) {
    let xoff = 0;
    for (let x = 0; x < cols; x++) {
      let index = x + y * cols;

      let angle = noise(xoff, yoff, time * 0.5) * TWO_PI * 4;
      angle += sin(time + x * 0.1) * 0.3;
      angle += cos(time * 1.3 + y * 0.08) * 0.2;

      flowField[index] = createVector(cos(angle), sin(angle));

      xoff += 0.03;
    }
    yoff += 0.03;
  }
}

function drawFlowFieldVisualization() {
  stroke(200, 40, 80, 8);
  strokeWeight(0.5);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let index = x + y * cols;
      let v = flowField[index];

      let posX = x * resolution + resolution / 2;
      let posY = y * resolution + resolution / 2;

      line(posX, posY, posX + v.x * 8, posY + v.y * 8);
    }
  }
}

class Ribbon {
  constructor(id) {
    this.id = id;
    this.points = [];
    this.maxPoints = 80 + id * 10;
    this.x = random(width);
    this.y = random(height);
    this.vx = 0;
    this.vy = 0;
    this.hue = (id * 35 + 180) % 360;
    this.saturation = 40 + random(30);
    this.brightness = 80 + random(15);
    this.phase = id * 0.5;
    this.thickness = 8 + id * 1.5;
    this.energy = 1;
  }

  update(time) {
    let col = floor(this.x / resolution);
    let row = floor(this.y / resolution);

    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      let index = col + row * cols;
      let force = flowField[index].copy();
      force.mult(0.8);

      this.vx += force.x;
      this.vy += force.y;
    }

    let t = time + this.phase;
    let centerX = width / 2;
    let centerY = height / 2;

    let attractForceX = (centerX - this.x) * 0.0003;
    let attractForceY = (centerY - this.y) * 0.0003;

    this.vx += attractForceX + sin(t * 2.1 + this.id) * 0.1;
    this.vy += attractForceY + cos(t * 1.8 + this.id) * 0.1;

    this.vx *= 0.98;
    this.vy *= 0.98;

    let maxSpeed = 1.5;
    let speed = sqrt(this.vx * this.vx + this.vy * this.vy);
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

    this.energy = 0.7 + sin(t * 3 + this.id) * 0.3;

    this.points.push({
      x: this.x,
      y: this.y,
      time: t,
      energy: this.energy
    });

    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }
  }

  display() {
    if (this.points.length < 3) return;

    let numLayers = 4;

    for (let layer = numLayers - 1; layer >= 0; layer--) {
      let layerAlpha = (numLayers - layer) * 15;
      let layerHue = (this.hue + layer * 10) % 360;
      let layerSat = this.saturation - layer * 8;
      let layerBright = this.brightness + layer * 3;
      let layerThickness = this.thickness * (1 - layer * 0.2);

      stroke(layerHue, layerSat, layerBright, layerAlpha);
      strokeWeight(layerThickness);
      fill(layerHue, layerSat * 0.6, layerBright, layerAlpha * 0.3);

      beginShape();
      noFill();

      for (let i = layer; i < this.points.length - 1; i += 2) {
        if (i < 0) continue;

        let point = this.points[i];
        let life = i / this.points.length;

        let wobbleX = sin(point.time * 4 + layer) * 3 * life;
        let wobbleY = cos(point.time * 3.5 + layer) * 3 * life;

        if (i === layer) {
          splineVertex(point.x + wobbleX, point.y + wobbleY);
        }
        splineVertex(point.x + wobbleX, point.y + wobbleY);
      }

      if (this.points.length > layer + 1) {
        let lastPoint = this.points[this.points.length - 1];
        let wobbleX = sin(lastPoint.time * 4 + layer) * 3;
        let wobbleY = cos(lastPoint.time * 3.5 + layer) * 3;
        splineVertex(lastPoint.x + wobbleX, lastPoint.y + wobbleY);
      }

      endShape();
    }

    for (let i = 0; i < this.points.length; i += 3) {
      let point = this.points[i];
      let life = i / this.points.length;

      let glowSize = 4 + point.energy * 6 + sin(point.time * 6) * 2;
      let glowAlpha = life * 40;

      fill(this.hue, this.saturation * 0.7, 95, glowAlpha);
      noStroke();
      circle(point.x, point.y, glowSize);

      fill(this.hue, this.saturation * 0.4, 100, glowAlpha * 0.6);
      circle(point.x, point.y, glowSize * 2);

      fill(this.hue, this.saturation * 0.2, 100, glowAlpha * 0.3);
      circle(point.x, point.y, glowSize * 4);
    }

    let head = this.points[this.points.length - 1];
    if (head) {
      fill(this.hue, this.saturation, 100, 60);
      noStroke();
      circle(head.x, head.y, this.thickness);

      stroke(this.hue, this.saturation * 0.8, 100, 80);
      strokeWeight(2);
      noFill();
      circle(head.x, head.y, this.thickness * 2);
    }
  }
}
