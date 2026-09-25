<p align="center"><img src="docs/media/hero.jpg" alt="p5js-render" width="100%"></p>

# p5js-render

Render p5.js sketches to MP4, WebM or GIF in headless Chromium. Every frame is drawn once, in order, on a virtual clock with a seeded random generator, so the same sketch always makes the same video.

**[See the gallery, debug views and film strips on the demo site.](https://jamiew.github.io/p5js-render/)**

## Gallery

Every preview below was rendered by this tool from a sketch in [`examples/`](examples). Click one to read its source.

<table>
  <tr>
    <td align="center"><a href="examples/cube-wave.js"><img src="docs/media/cube-wave.webp" width="260" alt="Cube Wave"></a><br><b>Cube Wave</b><br><sub>after Bees &amp; Bombs</sub></td>
    <td align="center"><a href="examples/pulsar-ridges.js"><img src="docs/media/pulsar-ridges.webp" width="260" alt="Pulsar Ridges"></a><br><b>Pulsar Ridges</b><br><sub>after Unknown Pleasures</sub></td>
    <td align="center"><a href="examples/clifford-bloom.js"><img src="docs/media/clifford-bloom.webp" width="260" alt="Clifford Bloom"></a><br><b>Clifford Bloom</b><br><sub>strange attractor density map</sub></td>
  </tr>
  <tr>
    <td align="center"><a href="examples/flow-fibers.js"><img src="docs/media/flow-fibers.webp" width="260" alt="Flow Fibers"></a><br><b>Flow Fibers</b><br><sub>after Tyler Hobbs</sub></td>
    <td align="center"><a href="examples/truchet-weave.js"><img src="docs/media/truchet-weave.webp" width="260" alt="Truchet Weave"></a><br><b>Truchet Weave</b><br><sub>Truchet tiles, Vera Molnar palette</sub></td>
    <td align="center"><a href="examples/reaction-diffusion.js"><img src="docs/media/reaction-diffusion.webp" width="260" alt="Reaction Diffusion"></a><br><b>Reaction Diffusion</b><br><sub>Gray-Scott Turing patterns</sub></td>
  </tr>
  <tr>
    <td align="center"><a href="examples/dot-lattice.js"><img src="docs/media/dot-lattice.webp" width="260" alt="Dot Lattice"></a><br><b>Dot Lattice</b><br><sub>after Etienne Jacob</sub></td>
    <td align="center"><a href="examples/schotter-drift.js"><img src="docs/media/schotter-drift.webp" width="260" alt="Schotter Drift"></a><br><b>Schotter Drift</b><br><sub>after Georg Nees, 1968</sub></td>
    <td align="center"><a href="examples/moire-orbit.js"><img src="docs/media/moire-orbit.webp" width="260" alt="Moire Orbit"></a><br><b>Moire Orbit</b><br><sub>after Bridget Riley</sub></td>
  </tr>
</table>

Flow Fibers and Reaction Diffusion are stateful: each frame builds on the last. The film strip shows Flow Fibers growing, one frame every 1.3 seconds.

<p align="center"><img src="docs/media/flow-fibers-strip.jpg" alt="Film strip of Flow Fibers growing over eight seconds" width="100%"></p>

`examples/` also keeps the earlier sketches, such as `plasma-field`, `fractal-tree` and `voronoi-shards`. `pnpm render:all` renders all of them.

## Quick start

You need Node.js 22.18 or newer, pnpm and ffmpeg on your `PATH`.

```bash
pnpm install
pnpm exec playwright install chromium

pnpm render cube-wave                 # writes output/cube-wave.mp4
pnpm render cube-wave --debug         # same, with the debug HUD burned in
pnpm render ./my-sketch.js -o loop.gif --duration 3
pnpm render:all --duration 6          # every sketch in examples/
```

Node runs the TypeScript sources directly, so there is no build step for local use.

## CLI

`pnpm render <sketch> [options]` takes an example name, a path to a `.js` file or an `http(s)` URL. Use `--code "<p5 code>"` for inline sketches and `--all` for every example.

| Option                                    | What it does                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `-o, --output <file>`                     | Output path. The extension picks the format: `.mp4` (H.264), `.webm` (VP9) or `.gif`. |
| `--out-dir <dir>`                         | Where default outputs go. Default `output`.                                           |
| `--frames <dir>`                          | Also save every frame as an image.                                                    |
| `-f, --fps <n>`                           | Frames per second. Default 30.                                                        |
| `-d, --duration <sec>`                    | Length in seconds. Default 4.                                                         |
| `-s, --seed <n>`                          | Seed for `random()` and `noise()`. Default 1.                                         |
| `-w, --width`, `--height`                 | Canvas size when the sketch has no literal `createCanvas(w, h)`. Default 800x600.     |
| `--debug`                                 | Burn in a HUD with frame number, time, draw cost and seed.                            |
| `--crf <n>`                               | Video quality, lower is better. Defaults: 18 for MP4, 30 for WebM.                    |
| `--pixel-density <n>`                     | p5 pixel density. Default 1, so output size equals canvas size.                       |
| `--format png\|jpeg`, `--quality <0-100>` | Image format for captured frames.                                                     |
| `--capture canvas\|screenshot`            | `screenshot` captures the whole page, for sketches that draw with DOM elements.       |
| `--timeout <ms>`                          | How long `setup()` may take. Default 30000.                                           |
| `--p5-version`, `--p5-url`, `--p5-path`   | Load a different p5 build, for example `--p5-version 1.11.13` for older sketches.     |

## Writing sketches for rendering

Most sketches work unchanged. A few habits make renders exact and loops seamless.

- **Animate from `p5Render.progress` for loops.** The renderer exposes `window.p5Render` with `progress` (0 up to, not including, 1), `frame`, `totalFrames`, `time`, `frameRate`, `seed` and `debug`. Fall back to `frameCount` so the sketch still runs in the p5 editor:

  ```js
  const t = window.p5Render ? p5Render.progress : (frameCount % 90) / 90;
  const angle = TWO_PI * t; // one full turn per video, whatever the duration
  ```

- **Randomness is seeded for you.** `random()`, `noise()` and `Math.random()` repeat for the same `--seed`. Change the seed to get a new variation.
- **Time is virtual.** `millis()`, `deltaTime`, `performance.now()` and `new Date()` report the frame's time, so a slow frame never causes a jump.
- **State is safe.** Frames are drawn once each, in order, on one page. Trails, particle systems and simulations render exactly as they would live.
- **`async setup()` works**, for example `img = await loadImage('texture.png')`. Local sketches can load files relative to their own folder.
- **Instance mode works**, as in `new p5((p) => { ... })`.
- Avoid live input such as `mouseX`, the webcam or the microphone.

<img src="docs/media/hello-loop.webp" width="180" align="right" alt="Hello Loop">

See [`examples/hello-loop.js`](examples/hello-loop.js) for a minimal loop in about 25 lines.

<br clear="right">

## Debug mode

`--debug` draws a HUD onto each captured frame: the frame number, time, how long `draw()` took, the seed, a timeline and viewfinder marks. The HUD is added while encoding, so it never touches your sketch's canvas or state. The draw time is the quickest way to find a slow sketch.

<p align="center"><img src="docs/media/cube-wave-debug.webp" width="360" alt="Cube Wave rendered with the debug HUD"></p>

## How it works

```mermaid
flowchart LR
  A[sketch.js] --> B[Chromium page<br/>seeded RNG + virtual clock]
  B -->|draw frame N| C[Worker pool<br/>PNG encoding]
  C -->|batches of frames| D[Node]
  D -->|stdin| E[ffmpeg<br/>MP4, WebM or GIF]
```

1. Playwright opens a page on a local origin and serves p5, the sketch and its assets from disk.
2. A harness script runs before p5. It seeds `Math.random`, replaces the clock and wraps `setup()` and `draw()`.
3. For each frame the harness sets `frameCount`, the virtual time and `deltaTime`, then awaits `redraw()`.
4. The canvas is copied to an `ImageBitmap` and handed to a worker pool that encodes PNGs off the main thread, so the next frame draws while earlier ones compress.
5. Frames stream to ffmpeg in order as they arrive, so long renders never hold every frame in memory.

## Library and HTTP API

```ts
import { P5Renderer, encodeVideo } from 'p5js-render';

const renderer = new P5Renderer();
await renderer.initialize();
try {
  const frames = renderer.streamFrames(
    {
      code,
      width: 720,
      height: 720,
      frameRate: 30,
      durationSeconds: 4,
      seed: 7
    },
    { debug: true }
  );
  await encodeVideo(frames, { outputPath: 'loop.mp4', frameRate: 30 });
} finally {
  await renderer.cleanup();
}
```

`renderer.renderSketch(config, options)` returns every frame in memory instead.

`pnpm start` runs a Fastify server. `POST /render` takes the same fields as JSON (`code`, `width`, `height`, `frameRate`, `durationSeconds`, plus optional `seed`, `pixelDensity`, `backgroundColor`, `format`, `quality`, `captureMethod`, `debug`, `p5Version`, `p5ScriptUrl`, `timeoutMs`) and returns base64-encoded frames. Invalid input gets a 400 with a readable message. `GET /health` reports status.

## Development

```bash
pnpm check        # typecheck, lint, format check and tests
RUN_BROWSER_TESTS=1 pnpm test --run   # include the Chromium integration tests
pnpm media        # rebuild the README previews in docs/media (needs img2webp)
pnpm site         # render the demo site into site/dist
```

CI runs `pnpm check` with the browser tests on Node 22 and 24. The `Demo site` workflow renders the showcase examples and publishes `site/dist` to GitHub Pages.

## Remixes

Promo art and remixes made with [Glif](https://glif.app), using real frames and the rendered Cube Wave loop as references.

<p align="center"><img src="docs/media/remix-stopmotion.webp" width="600" alt="Cube Wave remade as a stop-motion animation of wooden blocks"></p>

<p align="center">
  <img src="docs/media/remix-riso.jpg" width="300" alt="Risograph-style print of the cube wave and pulsar ridges">
  <img src="docs/media/remix-swiss.jpg" width="300" alt="Swiss-style FRAME BY FRAME poster with the dot lattice and Truchet ribbons">
</p>

## Alternatives

- [`p5.capture`](https://github.com/tapioca24/p5.capture) records in the browser with a UI. Use this project for CLI or server renders, batch jobs and CI.
- [Remotion](https://www.remotion.dev/) renders React compositions to video. It is a good fit if you want a timeline and components rather than p5 sketches.
- General renderers such as [`html5-animation-video-renderer`](https://github.com/dtinth/html5-animation-video-renderer) step arbitrary canvas pages frame by frame. This project knows p5's lifecycle, so `frameCount`, `millis()`, `random()` and `async setup()` behave.

## License

MIT
