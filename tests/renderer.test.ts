import { describe, expect, it } from 'vitest';
import { videoFormatFor } from '../src/encode.ts';
import {
  createSketchHTML,
  getTotalFrames,
  parseCanvasDimensions,
  RenderConfigError,
  resolveRenderConfig,
  validateRenderConfig,
  validateRenderOptions
} from '../src/renderer.ts';

describe('renderer helpers', () => {
  it('parses literal createCanvas dimensions from sketch code', () => {
    expect(
      parseCanvasDimensions('function setup() { createCanvas(1920, 1080); }')
    ).toEqual({ width: 1920, height: 1080 });
    expect(parseCanvasDimensions('createCanvas(windowWidth, 400)')).toBeNull();
  });

  it('prefers the sketch canvas size over the requested size', () => {
    const config = resolveRenderConfig({
      code: 'function setup() { createCanvas(640, 360); }',
      width: 800,
      height: 600,
      frameRate: 30,
      durationSeconds: 1
    });

    expect(config.width).toBe(640);
    expect(config.height).toBe(360);
  });

  it('rounds partial frames up so short durations are not truncated', () => {
    expect(
      getTotalFrames({
        code: 'function setup() {}',
        width: 10,
        height: 10,
        frameRate: 24,
        durationSeconds: 0.5
      })
    ).toBe(12);
  });

  it('rejects invalid render configs with a RenderConfigError', () => {
    const base = {
      code: 'function setup() {}',
      width: 100,
      height: 100,
      frameRate: 30,
      durationSeconds: 1
    };

    expect(() => validateRenderConfig({ ...base, width: 0 })).toThrow(
      RenderConfigError
    );
    expect(() => validateRenderConfig({ ...base, frameRate: 0 })).toThrow(
      /frameRate/
    );
    expect(() => validateRenderConfig({ ...base, seed: 1.5 })).toThrow(/seed/);
  });

  it('loads a pinned p5 version from jsDelivr', () => {
    const html = createSketchHTML(
      {
        code: 'function draw() {}',
        width: 320,
        height: 180,
        frameRate: 60,
        durationSeconds: 1
      },
      { p5Version: '1.11.13' }
    );

    expect(html).toContain(
      'https://cdn.jsdelivr.net/npm/p5@1.11.13/lib/p5.min.js'
    );
  });

  it('validates render options used by the API and CLI', () => {
    expect(() => validateRenderOptions({ quality: 101 })).toThrow(/quality/);
    expect(() => validateRenderOptions({ timeoutMs: 0 })).toThrow(/timeoutMs/);
    expect(() =>
      validateRenderOptions({ p5ScriptUrl: 'file:///tmp/p5.js' })
    ).toThrow(/http/);
    expect(() =>
      validateRenderOptions({ debug: true, captureMethod: 'screenshot' })
    ).toThrow(/debug/);
  });

  it('picks the video container from the output extension', () => {
    expect(videoFormatFor('out/loop.GIF')).toBe('gif');
    expect(() => videoFormatFor('out/loop.avi')).toThrow(/Unsupported/);
  });
});
