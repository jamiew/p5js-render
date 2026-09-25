// Renders the showcase examples and assembles the static demo site in site/dist.
// Each example gets a clean MP4, a debug MP4 with the HUD, a poster and a film strip.
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { encodeVideo } from '../src/encode.ts';
import { P5Renderer } from '../src/renderer.ts';
import type { FrameData, SketchConfig } from '../src/types.ts';
import { FRAME_RATE, SHOWCASE, type ShowcaseItem } from './showcase.ts';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'site', 'dist');
const MEDIA = path.join(OUT, 'media');
const STRIP_FRAMES = 10;
const REPO_URL = 'https://github.com/jamiew/p5js-render';

/** One entry of site/dist/showcase.json, read by site/public/index.html. */
interface SiteItem extends ShowcaseItem {
  frames: number;
  frameRate: number;
  stripFrames: number[];
  video: string;
  debugVideo: string;
  strip: string;
  poster: string;
  source: string;
  command: string;
}

/** Passes frames through while keeping copies of the few the film strip needs. */
async function* keepFrames(
  frames: AsyncIterable<FrameData>,
  wanted: Set<number>,
  kept: Map<number, Buffer>
): AsyncGenerator<FrameData> {
  for await (const frame of frames) {
    if (wanted.has(frame.frameNumber)) {
      kept.set(frame.frameNumber, frame.buffer);
    }
    yield frame;
  }
}

async function buildItem(
  renderer: P5Renderer,
  item: ShowcaseItem
): Promise<SiteItem> {
  const code = await readFile(
    path.join(ROOT, 'examples', `${item.name}.js`),
    'utf8'
  );
  const config: SketchConfig = {
    code,
    width: 720,
    height: 720,
    frameRate: FRAME_RATE,
    durationSeconds: item.durationSeconds,
    assetDir: path.join(ROOT, 'examples')
  };
  const totalFrames = Math.ceil(FRAME_RATE * item.durationSeconds);
  const stripIndexes = Array.from({ length: STRIP_FRAMES }, (_, index) =>
    Math.floor((index * totalFrames) / STRIP_FRAMES)
  );
  const posterIndex = Math.floor(totalFrames * (item.loops ? 0.25 : 0.99));
  const kept = new Map<number, Buffer>();

  const started = performance.now();
  await encodeVideo(
    keepFrames(
      renderer.streamFrames(config),
      new Set([...stripIndexes, posterIndex]),
      kept
    ),
    {
      outputPath: path.join(MEDIA, `${item.name}.mp4`),
      frameRate: FRAME_RATE,
      crf: 20
    }
  );
  await encodeVideo(renderer.streamFrames(config, { debug: true }), {
    outputPath: path.join(MEDIA, `${item.name}-debug.mp4`),
    frameRate: FRAME_RATE,
    crf: 20
  });

  const scratch = await mkdtemp(path.join(tmpdir(), `strip-${item.name}-`));
  try {
    await Promise.all(
      stripIndexes.map((frameNumber, index) =>
        writeFile(
          path.join(scratch, `strip_${index}.png`),
          kept.get(frameNumber)!
        )
      )
    );
    await writeFile(path.join(scratch, 'poster.png'), kept.get(posterIndex)!);
    await run('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-i',
      path.join(scratch, 'strip_%d.png'),
      '-vf',
      `scale=240:-1:flags=lanczos,tile=${STRIP_FRAMES}x1`,
      '-q:v',
      '3',
      path.join(MEDIA, `${item.name}-strip.jpg`)
    ]);
    await run('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-i',
      path.join(scratch, 'poster.png'),
      '-q:v',
      '3',
      path.join(MEDIA, `${item.name}-poster.jpg`)
    ]);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }

  console.log(
    `${item.name}: ${((performance.now() - started) / 1000).toFixed(1)}s`
  );
  return {
    ...item,
    frames: totalFrames,
    frameRate: FRAME_RATE,
    stripFrames: stripIndexes,
    video: `media/${item.name}.mp4`,
    debugVideo: `media/${item.name}-debug.mp4`,
    strip: `media/${item.name}-strip.jpg`,
    poster: `media/${item.name}-poster.jpg`,
    source: `${REPO_URL}/blob/main/examples/${item.name}.js`,
    command: `pnpm render ${item.name} --duration ${item.durationSeconds}`
  };
}

await rm(OUT, { recursive: true, force: true });
await mkdir(MEDIA, { recursive: true });
await cp(path.join(ROOT, 'site', 'public'), OUT, { recursive: true });

const renderer = new P5Renderer();
await renderer.initialize();
try {
  const results: SiteItem[] = [];
  // Two at a time keeps CI runners busy without starving the encoders.
  const queue = [...SHOWCASE.entries()];
  await Promise.all(
    [0, 1].map(async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const [index, item] = next;
        results[index] = await buildItem(renderer, item);
      }
    })
  );
  await writeFile(
    path.join(OUT, 'showcase.json'),
    JSON.stringify(results, null, 2)
  );
  console.log(`Site written to ${path.relative(ROOT, OUT)}/`);
} finally {
  await renderer.cleanup();
}
