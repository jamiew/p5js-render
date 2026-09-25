let worms = [];
let numWorms = 8;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  background(0);

  for (let i = 0; i < numWorms; i++) {
    worms.push(new EchoWorm(i));
  }
}

function draw() {
  background(0, 0, 0, 4);

  let globalTime = frameCount * 0.008;

  for (let worm of worms) {
    worm.update(globalTime);
    worm.display();
  }
}

class EchoWorm {
  constructor(id) {
    this.id = id;
    this.points = [];
    this.maxPoints = 150;
    this.hue = (id * 45) % 360;
    this.phase = id * 0.8;
    this.speed = 0.5 + id * 0.1;
    this.thickness = 8 + id * 2;
  }

  update(time) {
    let adjustedTime = time * this.speed + this.phase;

    let x =
      width / 2 +
      cos(adjustedTime * 1.2) * 200 +
      sin(adjustedTime * 2.5) * 120 +
      cos(adjustedTime * 4.1) * 60;

    let y =
      height / 2 +
      sin(adjustedTime * 1.1) * 180 +
      cos(adjustedTime * 2.2) * 100 +
      sin(adjustedTime * 3.8) * 50;

    this.points.push({ x: x, y: y, time: adjustedTime });

    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }
  }

  display() {
    if (this.points.length < 2) return;

    let numEchoes = 5;

    for (let echo = numEchoes - 1; echo >= 0; echo--) {
      let echoDelay = echo * 8;
      let echoAlpha = (numEchoes - echo) * 12;
      let echoHue = (this.hue + echo * 15) % 360;
      let echoThickness = this.thickness * (1 - echo * 0.15);

      stroke(echoHue, 70 + echo * 5, 90 - echo * 10, echoAlpha);
      strokeWeight(echoThickness);
      fill(echoHue, 40, 80, echoAlpha * 0.3);

      beginShape();
      noFill();

      for (let i = echoDelay; i < this.points.length - 1; i++) {
        if (i < 0) continue;

        let p1 = this.points[i];
        let p2 = this.points[i + 1];

        let phaseShift = sin(p1.time * 3 + echo * 0.5) * 0.3;
        let offsetX = cos(p1.time + echo) * 15 * phaseShift;
        let offsetY = sin(p1.time + echo) * 15 * phaseShift;

        if (i === echoDelay) {
          splineVertex(p1.x + offsetX, p1.y + offsetY);
        }
        splineVertex(p1.x + offsetX, p1.y + offsetY);
      }

      if (this.points.length > echoDelay + 1) {
        let lastPoint = this.points[this.points.length - 1];
        let phaseShift = sin(lastPoint.time * 3 + echo * 0.5) * 0.3;
        let offsetX = cos(lastPoint.time + echo) * 15 * phaseShift;
        let offsetY = sin(lastPoint.time + echo) * 15 * phaseShift;
        splineVertex(lastPoint.x + offsetX, lastPoint.y + offsetY);
      }

      endShape();
    }

    for (let i = 0; i < this.points.length; i++) {
      let point = this.points[i];
      let life = i / this.points.length;
      let glowAlpha = life * 30;

      let pulseSize = 3 + sin(point.time * 5) * 2;

      fill(this.hue, 60, 95, glowAlpha);
      noStroke();
      circle(point.x, point.y, pulseSize);

      fill(this.hue, 30, 100, glowAlpha * 0.5);
      circle(point.x, point.y, pulseSize * 2);
    }
  }
}
