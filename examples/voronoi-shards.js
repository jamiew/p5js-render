let seeds = [];
let numSeeds = 15;
let shards = [];
let kaleidoscope = [];
let recursionDepth = 3;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  
  generateSeeds();
  generateKaleidoscope();
}

function draw() {
  background(0, 0, 5);
  
  let time = frameCount * 0.01;
  
  updateSeeds(time);
  generateVoronoi();
  
  drawShards(time);
  drawKaleidoscope(time);
  drawStrobeEffect(time);
}

function generateSeeds() {
  seeds = [];
  for (let i = 0; i < numSeeds; i++) {
    seeds.push({
      x: random(width),
      y: random(height),
      baseX: random(width),
      baseY: random(height),
      phase: i * 0.4,
      speed: 0.3 + random(0.4),
      radius: 30 + random(50),
      energy: 1
    });
  }
}

function updateSeeds(time) {
  for (let seed of seeds) {
    let t = time * seed.speed + seed.phase;
    
    seed.x = seed.baseX + sin(t * 1.2) * seed.radius + cos(t * 2.3) * seed.radius * 0.5;
    seed.y = seed.baseY + cos(t * 1.1) * seed.radius + sin(t * 1.8) * seed.radius * 0.6;
    
    seed.x = (seed.x + width) % width;
    seed.y = (seed.y + height) % height;
    
    seed.energy = 0.7 + sin(t * 3) * 0.3;
  }
}

function generateVoronoi() {
  shards = [];
  
  let step = 4;
  for (let x = 0; x < width; x += step) {
    for (let y = 0; y < height; y += step) {
      let closestSeed = findClosestSeed(x, y);
      let secondClosest = findSecondClosestSeed(x, y);
      
      let distToClosest = dist(x, y, closestSeed.x, closestSeed.y);
      let distToSecond = dist(x, y, secondClosest.x, secondClosest.y);
      
      if (abs(distToClosest - distToSecond) < 8) {
        shards.push({
          x: x,
          y: y,
          seedId: closestSeed.id,
          secondId: secondClosest.id,
          edgeStrength: 1 - abs(distToClosest - distToSecond) / 8,
          angle: atan2(secondClosest.y - closestSeed.y, secondClosest.x - closestSeed.x)
        });
      }
    }
  }
}

function findClosestSeed(x, y) {
  let minDist = Infinity;
  let closest = null;
  
  for (let i = 0; i < seeds.length; i++) {
    let seed = seeds[i];
    let d = dist(x, y, seed.x, seed.y);
    if (d < minDist) {
      minDist = d;
      closest = { ...seed, id: i };
    }
  }
  
  return closest;
}

function findSecondClosestSeed(x, y) {
  let distances = [];
  
  for (let i = 0; i < seeds.length; i++) {
    let seed = seeds[i];
    let d = dist(x, y, seed.x, seed.y);
    distances.push({ seed: { ...seed, id: i }, dist: d });
  }
  
  distances.sort((a, b) => a.dist - b.dist);
  return distances[1].seed;
}

function drawShards(time) {
  for (let shard of shards) {
    let intensity = shard.edgeStrength;
    let seed1 = seeds[shard.seedId];
    let seed2 = seeds[shard.secondId];
    
    let strobePhase = sin(time * 8 + shard.x * 0.01 + shard.y * 0.01) * 0.5 + 0.5;
    let alpha = intensity * 80 * strobePhase * seed1.energy;
    
    let hue = 0;
    let saturation = 0;
    let brightness = 95 + strobePhase * 5;
    
    stroke(hue, saturation, brightness, alpha);
    strokeWeight(intensity * 2);
    
    let length = intensity * 12;
    let x1 = shard.x - cos(shard.angle) * length * 0.5;
    let y1 = shard.y - sin(shard.angle) * length * 0.5;
    let x2 = shard.x + cos(shard.angle) * length * 0.5;
    let y2 = shard.y + sin(shard.angle) * length * 0.5;
    
    line(x1, y1, x2, y2);
    
    if (intensity > 0.7 && strobePhase > 0.6) {
      stroke(hue, saturation, 100, alpha * 0.5);
      strokeWeight(intensity * 4);
      line(x1, y1, x2, y2);
      
      fill(hue, saturation, 100, alpha * 0.3);
      noStroke();
      circle(shard.x, shard.y, intensity * 6);
    }
  }
  
  for (let seed of seeds) {
    let pulseSize = 8 + seed.energy * 12;
    let strobePhase = sin(time * 6 + seed.x * 0.005) * 0.5 + 0.5;
    let alpha = 60 + strobePhase * 40;
    
    fill(0, 0, 100, alpha);
    noStroke();
    circle(seed.x, seed.y, pulseSize);
    
    stroke(0, 0, 100, alpha * 0.8);
    strokeWeight(2);
    noFill();
    circle(seed.x, seed.y, pulseSize * 2);
    
    if (strobePhase > 0.8) {
      for (let r = pulseSize; r < pulseSize * 4; r += 8) {
        stroke(0, 0, 100, alpha * 0.3);
        strokeWeight(1);
        circle(seed.x, seed.y, r);
      }
    }
  }
}

function generateKaleidoscope() {
  kaleidoscope = [];
  let numSegments = 8;
  
  for (let i = 0; i < numSegments; i++) {
    kaleidoscope.push({
      angle: (i / numSegments) * TWO_PI,
      phase: i * 0.5,
      radius: 100 + i * 20
    });
  }
}

function drawKaleidoscope(time) {
  push();
  translate(width/2, height/2);
  
  for (let segment of kaleidoscope) {
    let t = time + segment.phase;
    let rotation = segment.angle + sin(t) * 0.2;
    let scale = 0.8 + sin(t * 2) * 0.1;
    
    push();
    rotate(rotation);
    scale(scale);
    
    drawKaleidoscopeSegment(t, segment);
    
    pop();
  }
  
  pop();
}

function drawKaleidoscopeSegment(time, segment) {
  let numLines = 12;
  
  for (let i = 0; i < numLines; i++) {
    let lineAngle = (i / numLines) * PI / 4;
    let length = segment.radius + sin(time * 3 + i) * 30;
    let strobePhase = sin(time * 10 + i * 0.5) * 0.5 + 0.5;
    
    let alpha = 40 + strobePhase * 60;
    let thickness = 1 + strobePhase * 2;
    
    stroke(0, 0, 95, alpha);
    strokeWeight(thickness);
    
    let x1 = cos(lineAngle) * 20;
    let y1 = sin(lineAngle) * 20;
    let x2 = cos(lineAngle) * length;
    let y2 = sin(lineAngle) * length;
    
    line(x1, y1, x2, y2);
    
    if (strobePhase > 0.7) {
      let perpAngle = lineAngle + PI/2;
      let spread = 5;
      
      stroke(0, 0, 100, alpha * 0.6);
      strokeWeight(thickness * 0.5);
      
      line(x2 - cos(perpAngle) * spread, y2 - sin(perpAngle) * spread,
           x2 + cos(perpAngle) * spread, y2 + sin(perpAngle) * spread);
    }
  }
  
  let numShards = 6;
  for (let i = 0; i < numShards; i++) {
    let shardAngle = (i / numShards) * PI / 3 + sin(time + i) * 0.3;
    let innerRadius = 40;
    let outerRadius = 80 + sin(time * 2 + i) * 20;
    
    let strobePhase = sin(time * 12 + i) * 0.5 + 0.5;
    let alpha = 30 + strobePhase * 50;
    
    stroke(0, 0, 100, alpha);
    strokeWeight(1 + strobePhase);
    noFill();
    
    beginShape();
    vertex(cos(shardAngle) * innerRadius, sin(shardAngle) * innerRadius);
    vertex(cos(shardAngle + 0.1) * outerRadius, sin(shardAngle + 0.1) * outerRadius);
    vertex(cos(shardAngle - 0.1) * outerRadius, sin(shardAngle - 0.1) * outerRadius);
    endShape(CLOSE);
    
    if (strobePhase > 0.8) {
      fill(0, 0, 100, alpha * 0.2);
      beginShape();
      vertex(cos(shardAngle) * innerRadius, sin(shardAngle) * innerRadius);
      vertex(cos(shardAngle + 0.1) * outerRadius, sin(shardAngle + 0.1) * outerRadius);
      vertex(cos(shardAngle - 0.1) * outerRadius, sin(shardAngle - 0.1) * outerRadius);
      endShape(CLOSE);
      noFill();
    }
  }
}

function drawStrobeEffect(time) {
  let strobeIntensity = sin(time * 15) * sin(time * 23) * sin(time * 37);
  strobeIntensity = abs(strobeIntensity);
  
  if (strobeIntensity > 0.8) {
    fill(0, 0, 100, (strobeIntensity - 0.8) * 200);
    noStroke();
    rect(0, 0, width, height);
    
    for (let i = 0; i < 50; i++) {
      let x = random(width);
      let y = random(height);
      let size = random(2, 8);
      
      fill(0, 0, 100, strobeIntensity * 150);
      circle(x, y, size);
    }
  }
  
  let scanlinePhase = (time * 100) % height;
  stroke(0, 0, 100, 20);
  strokeWeight(2);
  line(0, scanlinePhase, width, scanlinePhase);
  
  stroke(0, 0, 100, 10);
  strokeWeight(1);
  line(0, scanlinePhase + 5, width, scanlinePhase + 5);
}