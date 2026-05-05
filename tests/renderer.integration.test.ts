import { describe, expect, it } from 'vitest';
import { P5Renderer } from '../src/renderer.js';

const runBrowserTests = process.env.RUN_BROWSER_TESTS === '1';

describe.skipIf(!runBrowserTests)('P5Renderer browser integration', () => {
  it('renders a deterministic PNG frame from a simple sketch', async () => {
    const renderer = new P5Renderer();
    await renderer.initialize();

    try {
      const result = await renderer.renderSketch(
        {
          code: 'function setup() { createCanvas(32, 32); } function draw() { background(frameCount * 50); circle(16, 16, 10); }',
          width: 32,
          height: 32,
          frameRate: 1,
          durationSeconds: 1
        },
        { maxConcurrency: 1 }
      );

      expect(result.totalFrames).toBe(1);
      expect(result.frames[0].buffer.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );
    } finally {
      await renderer.cleanup();
    }
  });
});
