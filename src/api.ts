import Fastify from 'fastify';
import cors from '@fastify/cors';
import { P5Renderer } from './renderer.js';
import { SketchConfig } from './types.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: true
});

fastify.post<{
  Body: SketchConfig & { 
    format?: 'png' | 'jpeg';
    quality?: number;
  }
}>('/render', async (request, reply) => {
  const { code, width, height, frameRate, durationSeconds, format, quality } = request.body;

  if (!code || !width || !height || !frameRate || !durationSeconds) {
    return reply.code(400).send({ 
      error: 'Missing required fields: code, width, height, frameRate, durationSeconds' 
    });
  }

  const renderer = new P5Renderer();
  
  try {
    await renderer.initialize();
    
    const renderOptions: { format?: 'png' | 'jpeg'; quality?: number } = {};
    if (format) renderOptions.format = format;
    if (quality) renderOptions.quality = quality;
    
    const result = await renderer.renderSketch(
      { code, width, height, frameRate, durationSeconds },
      renderOptions
    );

    const framesData = result.frames.map(frame => ({
      frameNumber: frame.frameNumber,
      timestamp: frame.timestamp,
      data: frame.buffer.toString('base64')
    }));

    reply.send({
      totalFrames: result.totalFrames,
      durationMs: result.durationMs,
      frames: framesData
    });
    
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ 
      error: 'Failed to render sketch',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await renderer.cleanup();
  }
});

fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

export { fastify };