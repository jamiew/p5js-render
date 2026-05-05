# P5.js Server-Side Video Renderer

Offline/server-side rendering for p5.js sketches. The renderer runs sketches in headless Chromium through Playwright for browser fidelity, captures deterministic frames, and encodes video with ffmpeg.

## Alternatives

- [`p5.capture`](https://github.com/tapioca24/p5.capture) is a strong choice for in-browser/client-side recording with a UI or small API. Use this project instead when you want CLI/API rendering, batch jobs, server-side output, or CI automation.
- General browser automation renderers like [`html5-animation-video-renderer`](https://github.com/dtinth/html5-animation-video-renderer) solve a similar frame-by-frame problem for HTML/canvas animations; this repo is specialized for p5.js runtime/version options and `frameCount` stepping.
- Pure Node canvas rendering can be faster for narrow 2D cases, but Chromium gives better p5.js compatibility for browser behavior, assets, fonts, and WebGL.

## Features

- Headless Chromium rendering via Playwright, so normal browser p5.js sketches work.
- Local p5.js runtime by default for offline repeatability.
- Optional p5 runtime selection by version, script URL, or local script path.
- Deterministic frame stepping through a generated `__p5RenderFrame(frameNumber)` wrapper.
- Canvas-byte capture by default, with screenshot capture as a fallback option.
- MP4 encoding through ffmpeg from captured frames.
- Fastify API for programmatic frame rendering.
- TypeScript, ESLint, Vitest, and GitHub Actions CI.

## Requirements

- Node.js 22 or newer
- ffmpeg available on `PATH`
- Playwright Chromium browser

```bash
npm install
npx playwright install chromium
```

## CLI Usage

Render an example sketch directly to `output/<sketch-name>.mp4`:

```bash
npm run render simple-circle
```

Render inline code:

```bash
npm run render:code "function setup() { createCanvas(400, 400); } function draw() { background(frameCount * 8); circle(200, 200, 100); }"
```

Render a sketch from a URL:

```bash
npm run render:url "https://example.com/sketch.js"
```

Render every sketch in `examples/`:

```bash
npm run render:all
```

## Render Options

CLI options are provided with environment variables:

```bash
WIDTH=1920 HEIGHT=1080 FRAMERATE=60 DURATION=5 npm run render rotating-cubes
```

Supported options:

- `WIDTH`, `HEIGHT`: output canvas dimensions.
- `FRAMERATE`: output frames per second.
- `DURATION`: duration in seconds.
- `PIXEL_DENSITY`: p5 pixel density, default `1` for predictable output dimensions.
- `BACKGROUND_COLOR`: page background behind the canvas.
- `FORMAT`: captured frame format, `png` or `jpeg`.
- `QUALITY`: JPEG quality from `0` to `100`.
- `CRF`: ffmpeg H.264 quality, default `18`.
- `OUTPUT`: output MP4 path.
- `SAVE_FRAMES=1`: also write frames to `output/<sketch-name>/`.
- `CAPTURE_METHOD`: `canvas` or `screenshot`. Canvas capture is faster; screenshot can be useful for WebGL or DOM-heavy sketches.
- `MAX_CONCURRENCY`: number of parallel browser contexts for frame capture.
- `TIMEOUT_MS`: p5 startup timeout.
- `P5_VERSION`: load a specific p5 version from jsDelivr, for example `1.11.13` or `2.2.3`.
- `P5_SCRIPT_URL`: load p5 from an explicit URL.
- `P5_SCRIPT_PATH`: load p5 from a local file.

The default p5 runtime is the locally installed `p5` package. This repo tracks the current p5 release; use `P5_VERSION=1.11.13` or `P5_SCRIPT_PATH` when rendering older sketches that need the p5 1.x runtime.

## API Usage

Start the server:

```bash
npm run dev
```

`POST /render` returns base64-encoded frames:

```json
{
  "code": "function setup() { createCanvas(800, 600); } function draw() { background(frameCount * 8); }",
  "width": 800,
  "height": 600,
  "frameRate": 30,
  "durationSeconds": 2,
  "pixelDensity": 1,
  "format": "png",
  "captureMethod": "canvas",
  "maxConcurrency": 4,
  "p5Version": "2.2.3"
}
```

Response:

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

`GET /health` returns server status.

## Programmatic Usage

```typescript
import { P5Renderer } from './src/renderer.js';

const renderer = new P5Renderer();
await renderer.initialize();

try {
  const result = await renderer.renderSketch(
    {
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
    },
    {
      captureMethod: 'canvas',
      maxConcurrency: 2
    }
  );

  console.log(`Rendered ${result.totalFrames} frames`);
} finally {
  await renderer.cleanup();
}
```

## Sketch Guidance

- Prefer deterministic animation based on `frameCount`, not wall-clock time.
- Avoid relying on live input such as `mouseX`, `mouseY`, keyboard state, webcam, or microphone input.
- If a sketch declares literal `createCanvas(width, height)` dimensions, the renderer adopts them.
- For WebGL sketches, try `CAPTURE_METHOD=screenshot` if canvas capture produces blank frames.
- If an older sketch behaves differently under p5 2.x, render it with `P5_VERSION=1.11.13`.

## Development

```bash
npm run typecheck
npm run lint
npm run format:check
npm test -- --run
npm run check
```

`npm run check` runs typechecking, linting, formatting checks, and tests. CI runs the same command on Node 22 and 24 after installing Playwright Chromium.

## License

MIT
