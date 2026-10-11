import express from 'express';
import type { RequestHandler } from 'express';
import { apiRouter } from './routes/index.js';
import { prisma } from './db.js';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errors.js';

export const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === env.WEB_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, X-Employee-Id');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(origin === env.WEB_ORIGIN ? 204 : 403);
  return next();
});
app.use(express.json({ limit: '1mb' }));

app.get('/health', (async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ data: { status: 'ok', database: 'connected', time: new Date().toISOString() } });
  } catch {
    res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'API is running, but MySQL is unavailable.' } });
  }
}) as RequestHandler);

app.use('/api', apiRouter);
app.use(notFound);
app.use(errorHandler);
