import { describe, expect, it } from 'vitest';
import {
  createSketchHTML,
  getTotalFrames,
  parseCanvasDimensions,
  resolveRenderConfig,
  validateRenderConfig,
  validateRenderOptions
} from '../src/renderer.js';

describe('renderer helpers', () => {
  it('parses literal createCanvas dimensions from sketch code', () => {
    expect(
      parseCanvasDimensions('function setup() { createCanvas(1920, 1080); }')
    ).toEqual({
      width: 1920,
      height: 1080
    });
  });

  it('uses parsed canvas dimensions when present', () => {
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

  it('computes total frames using ceil so partial-frame durations are preserved', () => {
    expect(
      getTotalFrames({
        code: 'function setup() { createCanvas(10, 10); }',
        width: 10,
        height: 10,
        frameRate: 24,
        durationSeconds: 0.5
      })
    ).toBe(12);
  });

  it('rejects invalid render dimensions and frame rates', () => {
    expect(() =>
      validateRenderConfig({
        code: 'function setup() {}',
        width: 0,
        height: 100,
        frameRate: 30,
        durationSeconds: 1
      })
    ).toThrow(/dimensions/);

    expect(() =>
      validateRenderConfig({
        code: 'function setup() {}',
        width: 100,
        height: 100,
        frameRate: 0,
        durationSeconds: 1
      })
    ).toThrow(/frameRate/);
  });

  it('generates deterministic p5 wrapper HTML with configurable runtime and pixel density', () => {
    const html = createSketchHTML(
      {
        code: 'function draw() { background(20); }',
        width: 320,
        height: 180,
        frameRate: 60,
        durationSeconds: 1,
        pixelDensity: 2
      },
      { p5Version: '1.11.11' }
    );

    expect(html).toContain(
      'https://cdn.jsdelivr.net/npm/p5@1.11.11/lib/p5.min.js'
    );
    expect(html).toContain('pixelDensity(2)');
    expect(html).toContain('window.__p5RenderFrame');
  });

  it('validates render options used by the API and CLI', () => {
    expect(() => validateRenderOptions({ quality: 101 })).toThrow(/quality/);
    expect(() => validateRenderOptions({ maxConcurrency: 0 })).toThrow(
      /maxConcurrency/
    );
    expect(() => validateRenderOptions({ timeoutMs: 0 })).toThrow(/timeoutMs/);
    expect(() =>
      validateRenderOptions({ p5ScriptUrl: 'file:///tmp/p5.js' })
    ).toThrow(/http/);
  });
});
