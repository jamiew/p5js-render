# P5.js Video Renderer

A headless p5.js sketch to video frame renderer built with TypeScript. Send a p5.js sketch to the API and get back rendered frames that can be assembled into a video.

## Features

- 🎬 Headless rendering of p5.js sketches using Playwright
- 🖼️ Frame-by-frame capture with precise timing control
- 🚀 Fast API endpoint for programmatic rendering
- 📝 TypeScript for type safety and better developer experience
- 🎨 Example sketches with demoscene-style visualizations
- ☁️ Designed for deployment on Cloudflare Workers and Valtown (Deno)

## Quick Start

### Installation

```bash
npm install
```

### Install Playwright browsers

```bash
npx playwright install chromium
```

### Development

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Production

```bash
npm run build
npm start
```

## API Usage

### Render Sketch to Frames

**POST** `/render`

```json
{
  "code": "function setup() { createCanvas(800, 600); } function draw() { background(255, 0, 0); }",
  "width": 800,
  "height": 600,
  "frameRate": 30,
  "durationSeconds": 2,
  "format": "png",
  "quality": 90
}
```

**Response:**
```json
{
  "totalFrames": 60,
  "durationMs": 1234,
  "frames": [
    {
      "frameNumber": 0,
      "timestamp": 0,
      "data": "base64-encoded-image-data"
    }
  ]
}
```

### Health Check

**GET** `/health`

Returns server status and timestamp.

## Example Sketches

The `examples/` directory contains three distinct visualization styles:

### 1. Rotating Cubes (`rotating-cubes.js`)
A 3D scene with a grid of cubes featuring:
- Dynamic lighting effects
- Synchronized rotations
- Color gradients based on position and time

### 2. Plasma Field (`plasma-field.js`)
A classic demoscene plasma effect featuring:
- Real-time pixel manipulation
- Multiple sine wave interference patterns
- HSB color space for smooth transitions
- Floating particle overlay

### 3. Fractal Tree (`fractal-tree.js`)
An animated recursive tree structure with:
- Organic branch movement using sine waves
- Depth-based color variation
- Multiple branching patterns

## Usage Examples

### Basic Usage

```typescript
import { P5Renderer } from './src/renderer.js';

const renderer = new P5Renderer();
await renderer.initialize();

const result = await renderer.renderSketch({
  code: `
    function setup() {
      createCanvas(400, 400);
    }
    
    function draw() {
      background(frameCount % 255);
      circle(200, 200, 100);
    }
  `,
  width: 400,
  height: 400,
  frameRate: 30,
  durationSeconds: 1
});

console.log(\`Rendered \${result.totalFrames} frames\`);
await renderer.cleanup();
```

### Using the API

```bash
curl -X POST http://localhost:3000/render \\
  -H "Content-Type: application/json" \\
  -d '{
    "code": "function setup() { createCanvas(800, 600); } function draw() { background(sin(frameCount * 0.1) * 255); }",
    "width": 800,
    "height": 600,
    "frameRate": 24,
    "durationSeconds": 3
  }'
```

## Frame Assembly

The API returns individual frames as base64-encoded images. To create a video:

1. Save frames to disk:
```typescript
result.frames.forEach((frame, index) => {
  const buffer = Buffer.from(frame.data, 'base64');
  fs.writeFileSync(\`frame_\${index.toString().padStart(4, '0')}.png\`, buffer);
});
```

2. Use FFmpeg to create video:
```bash
ffmpeg -r 30 -i frame_%04d.png -c:v libx264 -pix_fmt yuv420p output.mp4
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: localhost)

### Sketch Requirements

Your p5.js sketch should include:
- `setup()` function for initialization
- `draw()` function for frame rendering
- Use `frameCount` for time-based animations

### Performance Tips

- Keep sketch complexity reasonable for headless rendering
- Use `frameRate()` in setup to match your desired output framerate
- Avoid real-time user input functions (mouseX, mouseY, etc.)

## Deployment

### Cloudflare Workers

The renderer can be adapted for Cloudflare Workers with some modifications:
- Replace Playwright with a headless browser API
- Use the Fetch API for HTTP handling
- Store frames in R2 or return as streaming response

### Valtown (Deno)

For Valtown deployment:
- Use Deno's built-in HTTP server
- Replace Node.js specific APIs with Deno equivalents
- Use Deno's file system APIs for temporary storage

## Development

### Scripts

- `npm run build` - Compile TypeScript
- `npm run dev` - Run in development mode with tsx
- `npm run typecheck` - Check types without building
- `npm run lint` - Run ESLint

### Testing

```bash
npm test
```

## License

MIT