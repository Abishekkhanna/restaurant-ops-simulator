import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './db.js';
import { startSimulationWorker, stopSimulationWorker } from './simulation/worker.js';
import { setSocketServer } from './sockets/hub.js';

const server = createServer(app);
const io = new Server(server, { cors: { origin: env.WEB_ORIGIN, methods: ['GET', 'POST'] } });
io.use((socket, next) => {
  if (socket.handshake.auth.token !== env.APP_AUTH_TOKEN) return next(new Error('Unauthorized socket connection'));
  return next();
});
io.on('connection', (socket) => { socket.join('restaurant:operations'); });
setSocketServer(io);

server.listen(env.PORT, '127.0.0.1', () => {
  console.info(`Restaurant API listening at http://127.0.0.1:${env.PORT}`);
  startSimulationWorker();
});

async function shutdown(signal: string) {
  console.info(`Received ${signal}; shutting down cleanly.`);
  await stopSimulationWorker();
  io.close();
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
