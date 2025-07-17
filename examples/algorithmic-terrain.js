let terrain = [];
let contourLines = [];
let microStrokes = [];
let cols, rows;
let resolution = 8;
let numContours = 20;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  
  cols = floor(width / resolution) + 1;
  rows = floor(height / resolution) + 1;
  
  generateTerrain();
  generateContours();
  generateMicroStrokes();
}

function draw() {
  background(25, 30, 95);
  
  let time = frameCount * 0.003;
  
  updateTerrain(time);
  
  drawMicroStrokes(time);
  drawContours(time);
  drawRidges(time);
  drawGrain();
}

function generateTerrain() {
  terrain = [];
  for (let x = 0; x < cols; x++) {
    terrain[x] = [];
    for (let y = 0; y < rows; y++) {
      terrain[x][y] = 0;
    }
  }
}

function updateTerrain(time) {
  let yoff = time * 0.5;
  for (let y = 0; y < rows; y++) {
    let xoff = time * 0.3;
    for (let x = 0; x < cols; x++) {
      let elevation = 0;
      
      elevation += noise(xoff * 0.8, yoff * 0.8) * 100;
      elevation += noise(xoff * 2, yoff * 2) * 30;
      elevation += noise(xoff * 6, yoff * 6) * 8;
      elevation += noise(xoff * 15, yoff * 15) * 3;
      
      elevation += sin(xoff * 0.5 + time) * 20;
      elevation += cos(yoff * 0.3 + time * 1.2) * 15;
      
      terrain[x][y] = elevation;
      
      xoff += 0.02;
    }
    yoff += 0.02;
  }
}

function generateContours() {
  contourLines = [];
  for (let i = 0; i < numContours; i++) {
    contourLines.push({
      elevation: i * 8 + 20,
      paths: [],
      hue: 35 + i * 2,
      saturation: 40 + i * 1.5,
      brightness: 60 + i * 2
    });
  }
}

function generateMicroStrokes() {
  microStrokes = [];
  for (let i = 0; i < 2000; i++) {
    microStrokes.push({
      x: random(width),
      y: random(height),
      length: random(3, 12),
      angle: random(TWO_PI),
      phase: random(TWO_PI),
      speed: random(0.001, 0.003)
    });
  }
}

function drawMicroStrokes(time) {
  stroke(30, 20, 70, 15);
  strokeWeight(0.3);
  
  for (let microStroke of microStrokes) {
    let elevation = getElevationAt(microStroke.x, microStroke.y);
    let windDirection = atan2(
      getElevationAt(microStroke.x, microStroke.y + 5) - getElevationAt(microStroke.x, microStroke.y - 5),
      getElevationAt(microStroke.x + 5, microStroke.y) - getElevationAt(microStroke.x - 5, microStroke.y)
    );
    
    let angle = windDirection + sin(time * 2 + microStroke.phase) * 0.3;
    
    let alpha = map(elevation, 0, 150, 5, 25);
    let hue = map(elevation, 0, 150, 35, 25);
    
    stroke(hue, 30, 65, alpha);
    
    let x1 = microStroke.x;
    let y1 = microStroke.y;
    let x2 = x1 + cos(angle) * microStroke.length;
    let y2 = y1 + sin(angle) * microStroke.length;
    
    line(x1, y1, x2, y2);
    
    microStroke.x += cos(windDirection) * microStroke.speed * 10;
    microStroke.y += sin(windDirection) * microStroke.speed * 10;
    
    if (microStroke.x < 0) microStroke.x = width;
    if (microStroke.x > width) microStroke.x = 0;
    if (microStroke.y < 0) microStroke.y = height;
    if (microStroke.y > height) microStroke.y = 0;
  }
}

function drawContours(time) {
  for (let contour of contourLines) {
    let paths = [];
    
    for (let y = 1; y < rows - 1; y++) {
      let currentPath = [];
      
      for (let x = 1; x < cols - 1; x++) {
        let elevation = terrain[x][y];
        
        if (abs(elevation - contour.elevation) < 3) {
          let worldX = x * resolution;
          let worldY = y * resolution;
          
          let wobbleX = sin(time * 3 + x * 0.1 + y * 0.1) * 1.5;
          let wobbleY = cos(time * 2.5 + x * 0.15 + y * 0.08) * 1.5;
          
          currentPath.push({
            x: worldX + wobbleX,
            y: worldY + wobbleY,
            elevation: elevation
          });
        } else if (currentPath.length > 0) {
          if (currentPath.length > 3) {
            paths.push(currentPath);
          }
          currentPath = [];
        }
      }
      
      if (currentPath.length > 3) {
        paths.push(currentPath);
      }
    }
    
    let alpha = map(contour.elevation, 20, 20 + numContours * 8, 40, 15);
    let strokeWt = map(contour.elevation, 20, 20 + numContours * 8, 1.2, 0.4);
    
    stroke(contour.hue, contour.saturation, contour.brightness, alpha);
    strokeWeight(strokeWt);
    noFill();
    
    for (let path of paths) {
      if (path.length < 2) continue;
      
      beginShape();
      for (let i = 0; i < path.length; i++) {
        let point = path[i];
        
        if (i === 0) {
          curveVertex(point.x, point.y);
        }
        curveVertex(point.x, point.y);
        if (i === path.length - 1) {
          curveVertex(point.x, point.y);
        }
      }
      endShape();
    }
  }
}

function drawRidges(time) {
  stroke(20, 50, 85, 20);
  strokeWeight(0.8);
  
  for (let y = 10; y < rows - 10; y += 3) {
    beginShape();
    noFill();
    
    for (let x = 5; x < cols - 5; x++) {
      let elevation = terrain[x][y];
      let worldX = x * resolution;
      let worldY = y * resolution - elevation * 0.3;
      
      let ridgeOffset = sin(time + x * 0.1) * 2;
      
      if (x === 5) {
        curveVertex(worldX, worldY + ridgeOffset);
      }
      curveVertex(worldX, worldY + ridgeOffset);
      if (x === cols - 6) {
        curveVertex(worldX, worldY + ridgeOffset);
      }
    }
    endShape();
  }
  
  for (let x = 10; x < cols - 10; x += 4) {
    let maxElevation = 0;
    let maxY = 0;
    
    for (let y = 0; y < rows; y++) {
      if (terrain[x][y] > maxElevation) {
        maxElevation = terrain[x][y];
        maxY = y;
      }
    }
    
    if (maxElevation > 80) {
      let worldX = x * resolution;
      let worldY = maxY * resolution;
      
      stroke(15, 60, 90, 30);
      strokeWeight(1.5);
      
      for (let i = 0; i < 5; i++) {
        let offsetX = sin(time * 2 + i) * 3;
        let offsetY = cos(time * 1.5 + i) * 2;
        
        line(worldX + offsetX, worldY + offsetY - 10, 
             worldX + offsetX, worldY + offsetY + 10);
      }
    }
  }
}

function drawGrain() {
  for (let i = 0; i < 400; i++) {
    let x = random(width);
    let y = random(height);
    let elevation = getElevationAt(x, y);
    
    let size = random(0.5, 2);
    let alpha = map(elevation, 0, 150, 3, 12);
    let hue = map(elevation, 0, 150, 40, 20);
    
    fill(hue, 25, 80, alpha);
    noStroke();
    circle(x, y, size);
  }
  
  for (let i = 0; i < 100; i++) {
    let x = random(width);
    let y = random(height);
    
    stroke(45, 15, 75, 8);
    strokeWeight(0.2);
    
    let angle = random(TWO_PI);
    let length = random(1, 4);
    
    line(x, y, x + cos(angle) * length, y + sin(angle) * length);
  }
}

function getElevationAt(x, y) {
  let gridX = floor(x / resolution);
  let gridY = floor(y / resolution);
  
  if (gridX < 0 || gridX >= cols - 1 || gridY < 0 || gridY >= rows - 1) {
    return 0;
  }
  
  let xFrac = (x / resolution) - gridX;
  let yFrac = (y / resolution) - gridY;
  
  let tl = terrain[gridX][gridY];
  let tr = terrain[gridX + 1][gridY];
  let bl = terrain[gridX][gridY + 1];
  let br = terrain[gridX + 1][gridY + 1];
  
  let top = lerp(tl, tr, xFrac);
  let bottom = lerp(bl, br, xFrac);
  
  return lerp(top, bottom, yFrac);
}