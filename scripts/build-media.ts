// Renders the README previews in docs/media: an animated WebP per showcase
// example, one debug-HUD preview and one film strip. Needs ffmpeg and img2webp
// (brew install webp, or apt install webp). Run with `pnpm media`.
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { encodeVideo } from '../src/encode.ts';
import { P5Renderer } from '../src/renderer.ts';
import type { RenderOptions, SketchConfig } from '../src/types.ts';
import { FRAME_RATE, SHOWCASE, type ShowcaseItem } from './showcase.ts';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs', 'media');
const PREVIEW_SIZE = 320;
const PREVIEW_FPS = 20;
const DEBUG_EXAMPLE = 'cube-wave';
const STRIP_EXAMPLE = 'flow-fibers';
const only = process.argv.slice(2);

async function renderVideo(
  renderer: P5Renderer,
  item: ShowcaseItem,
  outputPath: string,
  options: RenderOptions = {}
): Promise<void> {
  const config: SketchConfig = {
    code: await readFile(
      path.join(ROOT, 'examples', `${item.name}.js`),
      'utf8'
    ),
    width: 720,
    height: 720,
    frameRate: FRAME_RATE,
    durationSeconds: item.durationSeconds,
    assetDir: path.join(ROOT, 'examples')
  };
  await encodeVideo(renderer.streamFrames(config, options), {
    outputPath,
    frameRate: FRAME_RATE,
    crf: 12
  });
}

/** Downscales a video into an animated WebP that loops forever. */
async function toWebp(
  video: string,
  output: string,
  scratch: string
): Promise<void> {
  const framesDir = path.join(scratch, path.basename(output, '.webp'));
  await mkdir(framesDir, { recursive: true });
  await run('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-i',
    video,
    '-vf',
    `fps=${PREVIEW_FPS},scale=${PREVIEW_SIZE}:-1:flags=lanczos`,
    path.join(framesDir, 'f_%04d.png')
  ]);
  const frames = (await readdir(framesDir))
    .sort()
    .map((file) => path.join(framesDir, file));
  await run('img2webp', [
    '-loop',
    '0',
    '-lossy',
    '-q',
    '50',
    '-m',
    '6',
    '-d',
    String(Math.round(1000 / PREVIEW_FPS)),
    ...frames,
    '-o',
    output
  ]);
  const { size } = await stat(output);
  console.log(`${path.relative(ROOT, output)} ${(size / 1024).toFixed(0)} KB`);
}

await mkdir(OUT, { recursive: true });
const scratch = await mkdtemp(path.join(tmpdir(), 'p5-media-'));
const renderer = new P5Renderer();
await renderer.initialize();
try {
  const items = SHOWCASE.filter(
    (item) => only.length === 0 || only.includes(item.name)
  );
  await Promise.all(
    items.map(async (item) => {
      const video = path.join(scratch, `${item.name}.mp4`);
      await renderVideo(renderer, item, video);
      await toWebp(video, path.join(OUT, `${item.name}.webp`), scratch);

      if (item.name === DEBUG_EXAMPLE) {
        const debugVideo = path.join(scratch, `${item.name}-debug.mp4`);
        await renderVideo(renderer, item, debugVideo, { debug: true });
        await toWebp(
          debugVideo,
          path.join(OUT, `${item.name}-debug.webp`),
          scratch
        );
      }

      if (item.name === STRIP_EXAMPLE) {
        const step = Math.floor((item.durationSeconds * FRAME_RATE) / 6);
        await run('ffmpeg', [
          '-loglevel',
          'error',
          '-y',
          '-i',
          video,
          '-vf',
          `select='not(mod(n+1\\,${step}))',scale=200:-1:flags=lanczos,tile=6x1:padding=4:color=0x0b0c0f`,
          '-frames:v',
          '1',
          '-q:v',
          '3',
          path.join(OUT, `${item.name}-strip.jpg`)
        ]);
      }
    })
  );
} finally {
  await renderer.cleanup();
  await rm(scratch, { recursive: true, force: true });
}
