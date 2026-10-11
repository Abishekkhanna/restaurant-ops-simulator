import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const database = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock('./db.js', () => ({ prisma: database }));

import { app } from './app.js';
import { env } from './config/env.js';

describe('API shell', () => {
  beforeEach(() => database.$queryRaw.mockReset());

  it('reports database readiness from its health endpoint', async () => {
    database.$queryRaw.mockResolvedValue([{ 1: 1 }]);
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.data.database).toBe('connected');
  });

  it('returns an explicit degraded health response when MySQL is unavailable', async () => {
    database.$queryRaw.mockRejectedValue(new Error('offline'));
    const response = await request(app).get('/health');
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
  });

  it('requires the local bearer token for application data', async () => {
    const response = await request(app).get('/api/employees');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects an invalid bearer token without querying MySQL', async () => {
    const response = await request(app).get('/api/employees').set('Authorization', 'Bearer invalid');
    expect(response.status).toBe(401);
    expect(database.$queryRaw).not.toHaveBeenCalled();
    expect(env.APP_AUTH_TOKEN.length).toBeGreaterThan(20);
  });
});
