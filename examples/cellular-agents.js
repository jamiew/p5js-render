let agents = [];
let numAgents = 120;
let grid = [];
let gridSize = 20;
let cols, rows;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);

  cols = floor(width / gridSize);
  rows = floor(height / gridSize);

  for (let x = 0; x < cols; x++) {
    grid[x] = [];
    for (let y = 0; y < rows; y++) {
      grid[x][y] = {
        energy: 0,
        connections: [],
        life: 0
      };
    }
  }

  for (let i = 0; i < numAgents; i++) {
    agents.push(new Agent(i));
  }
}

function draw() {
  background(0, 0, 8);

  let time = frameCount * 0.006;

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      grid[x][y].energy *= 0.95;
      grid[x][y].life *= 0.98;
      grid[x][y].connections = [];
    }
  }

  for (let agent of agents) {
    agent.update(time);
    agent.influenceGrid();
  }

  drawGrid();

  for (let agent of agents) {
    agent.display();
  }

  drawConnections();
}

class Agent {
  constructor(id) {
    this.id = id;
    this.x = random(width);
    this.y = random(height);
    this.vx = 0;
    this.vy = 0;
    this.phase = id * 0.1;
    this.size = 4 + random(3);
    this.energy = 1;
    this.mode = 0; // 0: wander, 1: seek, 2: avoid
    this.target = null;
  }

  update(time) {
    let t = time + this.phase;

    let forceX = 0;
    let forceY = 0;

    if (this.mode === 0) {
      forceX = cos(t * 2 + this.id) * 0.3 + cos(t * 5.2) * 0.1;
      forceY = sin(t * 1.8 + this.id) * 0.3 + sin(t * 4.8) * 0.1;
    }

    let neighbors = this.findNearbyAgents();

    if (neighbors.length > 0) {
      let avgX = 0,
        avgY = 0;
      let repelX = 0,
        repelY = 0;

      for (let neighbor of neighbors) {
        let dx = neighbor.x - this.x;
        let dy = neighbor.y - this.y;
        let dist = sqrt(dx * dx + dy * dy);

        if (dist > 0) {
          avgX += dx;
          avgY += dy;

          if (dist < 40) {
            repelX -= (dx / (dist * dist)) * 200;
            repelY -= (dy / (dist * dist)) * 200;
          }
        }
      }

      avgX /= neighbors.length;
      avgY /= neighbors.length;

      forceX += avgX * 0.001 + repelX * 0.01;
      forceY += avgY * 0.001 + repelY * 0.01;
    }

    let edgeForce = 50;
    if (this.x < edgeForce) forceX += (edgeForce - this.x) * 0.02;
    if (this.x > width - edgeForce)
      forceX -= (this.x - (width - edgeForce)) * 0.02;
    if (this.y < edgeForce) forceY += (edgeForce - this.y) * 0.02;
    if (this.y > height - edgeForce)
      forceY -= (this.y - (height - edgeForce)) * 0.02;

    this.vx += forceX;
    this.vy += forceY;

    this.vx *= 0.95;
    this.vy *= 0.95;

    let maxSpeed = 2;
    let speed = sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    this.x += this.vx;
    this.y += this.vy;

    this.energy = 0.5 + sin(t * 3 + this.id) * 0.3 + cos(t * 7) * 0.2;
  }

  findNearbyAgents() {
    let nearby = [];
    for (let other of agents) {
      if (other !== this) {
        let dx = other.x - this.x;
        let dy = other.y - this.y;
        let dist = sqrt(dx * dx + dy * dy);
        if (dist < 80) {
          nearby.push(other);
        }
      }
    }
    return nearby;
  }

  influenceGrid() {
    let gx = floor(this.x / gridSize);
    let gy = floor(this.y / gridSize);

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        let ngx = gx + ox;
        let ngy = gy + oy;

        if (ngx >= 0 && ngx < cols && ngy >= 0 && ngy < rows) {
          let distance = sqrt(ox * ox + oy * oy);
          let influence = this.energy / (1 + distance);

          grid[ngx][ngy].energy += influence * 0.3;
          grid[ngx][ngy].life += influence * 0.1;

          if (distance === 0) {
            grid[ngx][ngy].energy = max(grid[ngx][ngy].energy, this.energy);
          }
        }
      }
    }
  }

  display() {
    let alpha = this.energy * 60 + 20;
    let hue = (frameCount * 0.5 + this.id * 8) % 60;

    fill(hue, 70, 90, alpha);
    noStroke();
    circle(this.x, this.y, this.size);

    stroke(hue, 50, 95, alpha * 0.5);
    strokeWeight(1);
    noFill();
    circle(this.x, this.y, this.size * 3);
  }
}

function drawGrid() {
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      let cell = grid[x][y];
      if (cell.energy > 0.1) {
        let centerX = x * gridSize + gridSize / 2;
        let centerY = y * gridSize + gridSize / 2;

        let alpha = cell.energy * 40;
        let hue = (frameCount * 0.3) % 60;

        stroke(hue, 30, 70, alpha);
        strokeWeight(0.5);
        noFill();
        rect(x * gridSize, y * gridSize, gridSize, gridSize);

        if (cell.life > 0.2) {
          fill(hue, 50, 85, alpha * 0.3);
          noStroke();
          circle(centerX, centerY, cell.life * gridSize * 0.8);
        }
      }
    }
  }
}

function drawConnections() {
  stroke(40, 40, 80, 15);
  strokeWeight(0.5);

  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      let a1 = agents[i];
      let a2 = agents[j];

      let dx = a2.x - a1.x;
      let dy = a2.y - a1.y;
      let dist = sqrt(dx * dx + dy * dy);

      if (dist < 60 && dist > 20) {
        let alpha = map(dist, 20, 60, 30, 0);
        stroke(30, 40, 70, alpha);
        line(a1.x, a1.y, a2.x, a2.y);

        let midX = (a1.x + a2.x) / 2;
        let midY = (a1.y + a2.y) / 2;

        fill(30, 60, 80, alpha * 0.5);
        noStroke();
        circle(midX, midY, 2);
      }
    }
  }
}
