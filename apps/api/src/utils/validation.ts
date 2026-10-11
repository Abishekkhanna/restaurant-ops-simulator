import { z } from 'zod';

export const idParam = z.object({ id: z.string().min(1) });
export const tableParam = z.object({ tableNo: z.string().regex(/^T\d{2}$/) });
export const positiveQuantity = z.number().int().min(1).max(50);
export const jsonObject = z.record(z.string(), z.unknown()).optional();
