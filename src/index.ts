import { app, env } from './app.js';
import { connectDatabase, disconnectDatabase } from './services/db.js';
import { createServer } from 'node:http';
import { attachSocket } from './realtime/socket.js';

async function start(): Promise<void> {
  await connectDatabase();

  const httpServer = createServer(app);
  attachSocket(httpServer);
  const server = httpServer.listen(env.PORT, () => {
    console.log(`BloodLink API listening on ${env.API_URL}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`Received ${signal}; shutting down.`);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDatabase();
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch((error: unknown) => {
  console.error('Failed to start BloodLink API.', error);
  process.exitCode = 1;
});
