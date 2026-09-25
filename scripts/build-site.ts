// Renders the showcase examples and builds the static demo site in site/dist.
// Each example gets a clean MP4, a debug MP4, a poster, a small clip for the
// header reel and a sprite sheet of thumbnails for instant scrubbing. The
// gallery, FAQ and structured data are written into the HTML at build time so
// the page reads fully without JavaScript and search or answer engines see it.
// Needs ffmpeg and cwebp (brew install webp, or apt install webp).
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
const SITE_URL = 'https://jamiew.github.io/p5js-render/';
const REPO_URL = 'https://github.com/jamiew/p5js-render';
const SIZE = 720;
const REEL_SIZE = 288;
// Frame sprites hold at most this many thumbnails in a 10-column grid. A small
// sprite fills the film strip as the card scrolls in; a sharp one loads when
// someone reaches for the strip, for the full-size preview while scrubbing.
const SPRITE_MAX_CELLS = 48;
const SPRITE_COLUMNS = 10;
const STRIP_CELL = 96;
const SCRUB_CELL = 360;
const STRIP_CELLS = 10;

const DESCRIPTION =
  'Render p5.js sketches to MP4, WebM or GIF in headless Chromium. Every frame is drawn once, in order, on a virtual clock with a seeded random generator, so the same sketch always makes the same video.';

const FAQ: { question: string; answer: string }[] = [
  {
    question: 'How do I render a p5.js sketch to an MP4 video?',
    answer:
      'Install p5js-render with pnpm, run pnpm exec playwright install chromium once, then run pnpm render ./sketch.js -o sketch.mp4 --duration 4. The sketch runs in headless Chromium and each frame streams into ffmpeg.'
  },
  {
    question: 'How do I make a p5.js animation loop seamlessly?',
    answer:
      'Drive every motion from window.p5Render.progress, which runs from 0 up to (not including) 1 across the video. Use whole periods such as sin(TWO_PI * progress), so the frame after the last one matches the first.'
  },
  {
    question:
      'Why do screen recordings of p5.js sketches drop frames or differ between runs?',
    answer:
      'Live recording depends on the wall clock and on Math.random. p5js-render replaces both: millis(), deltaTime and Date follow the frame number, and random() and noise() are seeded, so every render of the same sketch and seed is identical.'
  },
  {
    question: 'Can I export a p5.js sketch as a GIF or WebM?',
    answer:
      'Yes. The output extension picks the format: .mp4 for H.264, .webm for VP9 and .gif for a looping GIF with an optimized palette.'
  },
  {
    question: 'Does it support WebGL, p5.js 2.x and async setup?',
    answer:
      'Yes. It runs the installed p5.js 2.x by default, awaits async setup(), supports instance mode and WEBGL canvases, and can load any p5 version with --p5-version.'
  },
  {
    question: 'How is p5js-render different from p5.capture or CCapture?',
    answer:
      'p5.capture and CCapture record inside your browser tab. p5js-render runs from the command line, a Node API or an HTTP server, so it suits batch renders, CI and servers, and it keeps stateful sketches exact by drawing every frame in order.'
  }
];

interface Sprite {
  url: string;
  scrubUrl: string;
  step: number;
  cells: number;
  columns: number;
  rows: number;
}

interface SiteItem extends ShowcaseItem {
  frames: number;
  video: string;
  debugVideo: string;
  poster: string;
  reelVideo: string;
  reelPoster: string;
  sprite: Sprite;
  source: string;
  command: string;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** Passes frames through while keeping copies of the ones the images need. */
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
  const config: SketchConfig = {
    code: await readFile(
      path.join(ROOT, 'examples', `${item.name}.js`),
      'utf8'
    ),
    width: SIZE,
    height: SIZE,
    frameRate: FRAME_RATE,
    durationSeconds: item.durationSeconds,
    assetDir: path.join(ROOT, 'examples')
  };
  const frames = Math.ceil(FRAME_RATE * item.durationSeconds);
  const step = Math.ceil(frames / SPRITE_MAX_CELLS);
  const spriteFrames = Array.from(
    { length: Math.ceil(frames / step) },
    (_, index) => index * step
  );
  const posterFrame = item.loops ? Math.floor(frames * 0.25) : frames - 1;
  const kept = new Map<number, Buffer>();
  const media = (suffix: string): string =>
    path.join(MEDIA, `${item.name}${suffix}`);

  const started = performance.now();
  await encodeVideo(
    keepFrames(
      renderer.streamFrames(config),
      new Set([...spriteFrames, posterFrame]),
      kept
    ),
    { outputPath: media('.mp4'), frameRate: FRAME_RATE, crf: 24 }
  );
  await encodeVideo(renderer.streamFrames(config, { debug: true }), {
    outputPath: media('-debug.mp4'),
    frameRate: FRAME_RATE,
    crf: 24
  });

  const scratch = await mkdtemp(path.join(tmpdir(), `site-${item.name}-`));
  const columns = Math.min(SPRITE_COLUMNS, spriteFrames.length);
  const rows = Math.ceil(spriteFrames.length / columns);
  try {
    await Promise.all(
      spriteFrames.map((frameNumber, index) =>
        writeFile(
          path.join(scratch, `cell_${index}.png`),
          kept.get(frameNumber)!
        )
      )
    );
    await writeFile(path.join(scratch, 'poster.png'), kept.get(posterFrame)!);
    await run('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-i',
      path.join(scratch, 'cell_%d.png'),
      '-filter_complex',
      [
        `tile=${columns}x${rows},split[a][b]`,
        `[a]scale=${columns * SCRUB_CELL}:${rows * SCRUB_CELL}:flags=lanczos[scrub]`,
        `[b]scale=${columns * STRIP_CELL}:${rows * STRIP_CELL}:flags=lanczos[strip]`
      ].join(';'),
      '-map',
      '[scrub]',
      '-frames:v',
      '1',
      path.join(scratch, 'scrub.png'),
      '-map',
      '[strip]',
      '-frames:v',
      '1',
      path.join(scratch, 'strip.png')
    ]);
    await Promise.all([
      run('cwebp', [
        '-quiet',
        '-q',
        '75',
        '-m',
        '6',
        path.join(scratch, 'strip.png'),
        '-o',
        media('-sprite.webp')
      ]),
      run('cwebp', [
        '-quiet',
        '-q',
        '72',
        '-m',
        '6',
        '-sharp_yuv',
        path.join(scratch, 'scrub.png'),
        '-o',
        media('-scrub.webp')
      ]),
      run('cwebp', [
        '-quiet',
        '-q',
        '80',
        '-m',
        '6',
        path.join(scratch, 'poster.png'),
        '-o',
        media('-poster.webp')
      ]),
      run('cwebp', [
        '-quiet',
        '-q',
        '72',
        '-m',
        '6',
        '-resize',
        String(REEL_SIZE),
        String(REEL_SIZE),
        path.join(scratch, 'poster.png'),
        '-o',
        media('-reel.webp')
      ]),
      run('ffmpeg', [
        '-loglevel',
        'error',
        '-y',
        '-i',
        media('.mp4'),
        '-vf',
        `scale=${REEL_SIZE}:${REEL_SIZE}:flags=lanczos`,
        '-c:v',
        'libx264',
        '-crf',
        '30',
        '-preset',
        'slow',
        '-g',
        String(FRAME_RATE),
        '-pix_fmt',
        'yuv420p',
        '-an',
        '-movflags',
        '+faststart',
        media('-reel.mp4')
      ])
    ]);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }

  console.log(
    `${item.name}: ${((performance.now() - started) / 1000).toFixed(1)}s`
  );
  return {
    ...item,
    frames,
    video: `media/${item.name}.mp4`,
    debugVideo: `media/${item.name}-debug.mp4`,
    poster: `media/${item.name}-poster.webp`,
    reelVideo: `media/${item.name}-reel.mp4`,
    reelPoster: `media/${item.name}-reel.webp`,
    sprite: {
      url: `media/${item.name}-sprite.webp`,
      scrubUrl: `media/${item.name}-scrub.webp`,
      step,
      cells: spriteFrames.length,
      columns,
      rows
    },
    source: `${REPO_URL}/blob/main/examples/${item.name}.js`,
    command: `pnpm render ${item.name} --duration ${item.durationSeconds}`
  };
}

/** CSS background placement for one sprite cell, as percentages. */
function cellStyle(sprite: Sprite, cell: number): string {
  const column = cell % sprite.columns;
  const row = Math.floor(cell / sprite.columns);
  const x = sprite.columns > 1 ? (column / (sprite.columns - 1)) * 100 : 0;
  const y = sprite.rows > 1 ? (row / (sprite.rows - 1)) * 100 : 0;
  return `background-position:${x.toFixed(3)}% ${y.toFixed(3)}%`;
}

function cardHtml(item: SiteItem): string {
  const title = escapeHtml(item.title);
  const kind = item.loops ? 'looping animation' : 'animation that builds up';
  const cells = Array.from({ length: STRIP_CELLS }, (_, index) => {
    const cell = Math.floor((index * item.sprite.cells) / STRIP_CELLS);
    return `<span class="cell" style="${cellStyle(item.sprite, cell)}"></span>`;
  }).join('');

  return `
<article class="card" id="${item.name}" aria-labelledby="${item.name}-title"
  data-frames="${item.frames}" data-fps="${FRAME_RATE}" data-duration="${item.durationSeconds}"
  data-video="${item.video}" data-debug-video="${item.debugVideo}"
  data-sprite="${item.sprite.url}" data-scrub-sprite="${item.sprite.scrubUrl}" data-sprite-step="${item.sprite.step}"
  data-sprite-columns="${item.sprite.columns}" data-sprite-rows="${item.sprite.rows}">
  <div class="stage">
    <video class="clip" muted loop playsinline controls preload="none" width="${SIZE}" height="${SIZE}"
      poster="${item.poster}" aria-label="${title}, a ${item.durationSeconds} second ${kind}" aria-describedby="${item.name}-blurb">
      <source src="${item.video}" type="video/mp4">
    </video>
    <div class="scrub-preview" style="--sprite-columns:${item.sprite.columns};--sprite-rows:${item.sprite.rows}" hidden></div>
    <div class="spinner" aria-hidden="true"></div>
  </div>
  <div class="card-body">
    <div class="card-head">
      <h3 id="${item.name}-title">${title}</h3>
      <span class="meta">${item.frames} frames · ${item.durationSeconds}s · ${item.loops ? 'loop' : 'build'}</span>
    </div>
    <p class="blurb" id="${item.name}-blurb">${escapeHtml(item.blurb)}</p>
    <p class="credit">After ${escapeHtml(item.credit)}</p>
    <div class="film" role="slider" tabindex="0" aria-label="Scrub through ${title}"
      aria-valuemin="1" aria-valuemax="${item.frames}" aria-valuenow="1" aria-valuetext="Frame 1 of ${item.frames}"
      style="--sprite-columns:${item.sprite.columns};--sprite-rows:${item.sprite.rows}">
      <div class="cells">${cells}</div>
      <div class="playhead"></div>
    </div>
    <p class="film-label"><span class="frame" aria-hidden="true">frame 1 / ${item.frames}</span><span>Drag or use arrow keys</span></p>
    <div class="actions">
      <a class="source" href="${item.source}">Source<span class="visually-hidden"> code for ${title}</span></a>
      <button type="button" class="copy" data-command="${escapeHtml(item.command)}" aria-label="Copy command: ${escapeHtml(item.command)}"><code>${escapeHtml(item.command)}</code></button>
    </div>
  </div>
</article>`;
}

function reelHtml(items: SiteItem[]): string {
  // The track holds the frames twice so the CSS scroll can wrap seamlessly.
  const frames = [...items, ...items]
    .map(
      (item, index) => `
<div class="reel-frame" data-number="${String((index % items.length) + 1).padStart(3, '0')}">
  <video muted loop playsinline preload="none" width="${REEL_SIZE}" height="${REEL_SIZE}" poster="${item.reelPoster}" tabindex="-1">
    <source src="${item.reelVideo}" type="video/mp4">
  </video>
</div>`
    )
    .join('');
  return frames;
}

function faqHtml(): string {
  return FAQ.map(
    ({ question, answer }) => `
<details name="faq">
  <summary><h3>${escapeHtml(question)}</h3><span class="faq-icon" aria-hidden="true"></span></summary>
  <p>${escapeHtml(answer)}</p>
</details>`
  ).join('');
}

function jsonLd(items: SiteItem[], builtAt: string): string {
  const graph = [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      url: SITE_URL,
      name: 'p5js-render',
      description: DESCRIPTION,
      inLanguage: 'en'
    },
    {
      '@type': 'SoftwareSourceCode',
      '@id': `${SITE_URL}#software`,
      name: 'p5js-render',
      description: DESCRIPTION,
      url: SITE_URL,
      codeRepository: REPO_URL,
      programmingLanguage: ['TypeScript', 'JavaScript'],
      runtimePlatform: 'Node.js 22.18 or newer',
      license: 'https://opensource.org/licenses/MIT',
      keywords:
        'p5.js, generative art, creative coding, video rendering, headless Chromium, Playwright, ffmpeg, GIF, MP4',
      author: {
        '@type': 'Person',
        name: 'Jamie Wilkinson',
        url: 'https://jamiedubs.com',
        sameAs: ['https://github.com/jamiew']
      },
      image: `${SITE_URL}assets/og.jpg`
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}#faq`,
      mainEntity: FAQ.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer }
      }))
    },
    ...items.map((item) => ({
      '@type': 'VideoObject',
      '@id': `${SITE_URL}#${item.name}`,
      name: `${item.title}, a p5.js sketch rendered with p5js-render`,
      description: `${item.blurb} After ${item.credit}.`,
      thumbnailUrl: `${SITE_URL}${item.poster}`,
      contentUrl: `${SITE_URL}${item.video}`,
      uploadDate: builtAt,
      duration: `PT${item.durationSeconds}S`,
      width: SIZE,
      height: SIZE,
      isPartOf: { '@id': `${SITE_URL}#website` }
    }))
  ];
  // Escape "<" so no string in the data can close the script element.
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': graph
  }).replaceAll('<', '\\u003c');
}

function sitemap(items: SiteItem[], builtAt: string): string {
  const videos = items
    .map(
      (item) => `
    <video:video>
      <video:thumbnail_loc>${SITE_URL}${item.poster}</video:thumbnail_loc>
      <video:title>${escapeHtml(item.title)}</video:title>
      <video:description>${escapeHtml(item.blurb)}</video:description>
      <video:content_loc>${SITE_URL}${item.video}</video:content_loc>
      <video:duration>${Math.round(item.durationSeconds)}</video:duration>
    </video:video>`
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url>
    <loc>${SITE_URL}</loc>
    <lastmod>${builtAt.slice(0, 10)}</lastmod>${videos}
  </url>
</urlset>
`;
}

/** A plain-text brief for language models, per the llms.txt convention. */
function llmsTxt(items: SiteItem[]): string {
  return `# p5js-render

> ${DESCRIPTION}

p5js-render is an open-source TypeScript tool (MIT license) with a CLI, a Node API and an HTTP API. It loads a p5.js sketch in headless Chromium through Playwright, seeds Math.random, replaces the clock so millis(), deltaTime and Date follow the frame number, draws every frame in order, encodes frames in a worker pool and streams them into ffmpeg.

## Usage

- Install: \`pnpm install && pnpm exec playwright install chromium\` (needs Node.js 22.18+ and ffmpeg)
- Render: \`pnpm render ./sketch.js -o sketch.mp4 --duration 4 --fps 30 --seed 1\`
- Formats: the output extension picks .mp4 (H.264), .webm (VP9) or .gif
- Debug HUD: \`--debug\` burns in frame number, time, draw cost and seed
- Seamless loops: animate from \`window.p5Render.progress\` (0 up to 1)

## Docs

- [README](${REPO_URL}#readme): full CLI options, sketch guidance, library and HTTP API
- [Examples](${REPO_URL}/tree/main/examples): the sketches shown on the demo site
- [Demo site](${SITE_URL}): videos, debug views and scrubbable film strips

## Example renders

${items.map((item) => `- [${item.title}](${SITE_URL}${item.video}): ${item.blurb} After ${item.credit}. Source: ${item.source}`).join('\n')}

## FAQ

${FAQ.map(({ question, answer }) => `### ${question}\n\n${answer}`).join('\n\n')}
`;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(MEDIA, { recursive: true });
await cp(path.join(ROOT, 'site', 'public'), OUT, { recursive: true });

const renderer = new P5Renderer();
await renderer.initialize();
const items: SiteItem[] = [];
try {
  // Two at a time keeps CI runners busy without starving the encoders.
  const queue = [...SHOWCASE.entries()];
  await Promise.all(
    [0, 1].map(async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const [index, item] = next;
        items[index] = await buildItem(renderer, item);
      }
    })
  );
} finally {
  await renderer.cleanup();
}

const builtAt = new Date().toISOString();
const template = await readFile(path.join(ROOT, 'site', 'index.html'), 'utf8');
const html = template
  .replace(
    '<!-- @jsonld -->',
    `<script type="application/ld+json">${jsonLd(items, builtAt)}</script>`
  )
  .replace('<!-- @reel -->', reelHtml(items))
  .replace('<!-- @gallery -->', items.map(cardHtml).join(''))
  .replace('<!-- @faq -->', faqHtml());
await writeFile(path.join(OUT, 'index.html'), html);
await writeFile(path.join(OUT, 'sitemap.xml'), sitemap(items, builtAt));
await writeFile(path.join(OUT, 'llms.txt'), llmsTxt(items));
console.log(`Site written to ${path.relative(ROOT, OUT)}/`);
