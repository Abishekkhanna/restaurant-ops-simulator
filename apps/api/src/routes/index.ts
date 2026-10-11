import { Router } from 'express';
import operations from './api.js';

export const apiRouter = Router();
apiRouter.use(operations);
