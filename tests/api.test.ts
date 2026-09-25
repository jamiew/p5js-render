import { describe, expect, it } from 'vitest';
import { fastify } from '../src/api.ts';

describe('render API validation', () => {
  it('rejects invalid render requests before launching the renderer', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/render',
      payload: {
        code: 'function setup() {}',
        width: 100,
        height: 100,
        frameRate: 30,
        durationSeconds: 1,
        quality: 101
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'quality must be between 0 and 100.'
    });
  });

  it('does not accept local p5 script paths through the HTTP API', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/render',
      payload: {
        code: 'function setup() {}',
        width: 100,
        height: 100,
        frameRate: 30,
        durationSeconds: 1,
        p5ScriptPath: '/tmp/p5.min.js'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Unsupported render option: p5ScriptPath'
    });
  });
});
