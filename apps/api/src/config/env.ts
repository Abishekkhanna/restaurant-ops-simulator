import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (existsSync(candidate)) dotenv.config({ path: candidate });
}

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().url().default('http://127.0.0.1:5173'),
  APP_AUTH_TOKEN: z.string().min(20).default('local-only-change-this-token-before-sharing'),
  SIMULATION_TICK_MS: z.coerce.number().int().min(250).max(60_000).default(1000),
});

export const env = schema.parse(process.env);
