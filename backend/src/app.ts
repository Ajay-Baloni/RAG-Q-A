import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { allowedOrigins } from './config/env';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  // Basic abuse protection across the whole API.
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 100,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
