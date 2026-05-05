import { fastify } from './api.js';

const start = async (): Promise<void> => {
  try {
    const port = Number(process.env.PORT) || 3000;
    const host = process.env.HOST || 'localhost';

    await fastify.listen({ port, host });
    console.log(`Server running at http://${host}:${port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

void start();
