import { inflateSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { P5Renderer } from '../src/renderer.ts';
import type { RenderOptions, SketchConfig } from '../src/types.ts';

const runBrowserTests = process.env.RUN_BROWSER_TESTS === '1';

/** Reads the RGB of a 1x1 PNG, enough to check what a tiny sketch drew. */
function pixelOf(png: Buffer): [number, number, number] {
  let offset = 8;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') {
      idat.push(png.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  // Scanline layout: one filter byte, then RGBA.
  const [, r, g, b] = inflateSync(Buffer.concat(idat));
  return [r, g, b];
}

describe.skipIf(!runBrowserTests)('P5Renderer in Chromium', () => {
  const renderer = new P5Renderer();

  beforeAll(() => renderer.initialize());
  afterAll(() => renderer.cleanup());

  async function render(
    code: string,
    config: Partial<SketchConfig> = {},
    options: RenderOptions = {}
  ): Promise<[number, number, number][]> {
    const result = await renderer.renderSketch(
      {
        code,
        width: 1,
        height: 1,
        frameRate: 30,
        durationSeconds: 0.2,
        ...config
      },
      options
    );
    return result.frames.map((frame) => pixelOf(frame.buffer));
  }

  it('draws every frame once, in order, so accumulated state matches frameCount', async () => {
    const pixels = await render(`
      let calls = 0;
      function setup() { createCanvas(1, 1); }
      function draw() { calls++; background(calls * 10, frameCount * 10, 0); }
    `);

    expect(pixels).toEqual([
      [10, 10, 0],
      [20, 20, 0],
      [30, 30, 0],
      [40, 40, 0],
      [50, 50, 0],
      [60, 60, 0]
    ]);
  });

  it('runs millis() on a virtual clock tied to the frame number', async () => {
    const pixels = await render(`
      function setup() { createCanvas(1, 1); }
      function draw() { background(0, round(millis() / 10), 0); }
    `);

    // 30 fps -> 33.3ms per frame -> millis() / 10 rounds to 0, 3, 7, 10, 13, 17.
    expect(pixels.map(([, g]) => g)).toEqual([0, 3, 7, 10, 13, 17]);
  });

  it('repeats random() for the same seed and changes it for another', async () => {
    const code = `
      function setup() { createCanvas(1, 1); }
      function draw() { background(random(255), random(255), random(255)); }
    `;
    const first = await render(code, { seed: 7 });
    const again = await render(code, { seed: 7 });
    const other = await render(code, { seed: 8 });

    expect(again).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it('waits for an async setup before drawing', async () => {
    const pixels = await render(
      `
      let level = 0;
      async function setup() {
        createCanvas(1, 1);
        // A macrotask gap proves the harness awaits setup instead of racing it.
        await new Promise((resolve) => setTimeout(resolve, 0));
        level = 200;
      }
      function draw() { background(level); }
    `,
      { durationSeconds: 1 / 30 }
    );

    expect(pixels).toEqual([[200, 200, 200]]);
  });

  it('supports instance-mode sketches', async () => {
    const pixels = await render(
      `
      new p5((p) => {
        p.setup = () => p.createCanvas(1, 1);
        p.draw = () => p.background(p.frameCount * 50);
      });
    `,
      { durationSeconds: 2 / 30 }
    );

    expect(pixels).toEqual([
      [50, 50, 50],
      [100, 100, 100]
    ]);
  });

  it('reports errors thrown during setup with the sketch message', async () => {
    await expect(
      render(`function setup() { throw new Error('bad palette'); }`)
    ).rejects.toThrow(/bad palette/);
  });
});
