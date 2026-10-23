import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import config from './config/env.js';
import { isDatabaseReady } from './config/db.js';
import apiRoutes from './routes/index.js';
import { optionalAuth } from './middleware/auth.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { schedulerStatus } from './jobs/scheduler.js';
import { ocrStatus } from './services/ocr.js';
import { medicineInfoStatus } from './services/medicineInfo.js';
import { ensureUploadDir } from './services/storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      contentSecurityPolicy: false, // API only; the SPA is served separately.
    }),
  );

  const allowedOrigins = [config.clientOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'];
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  if (!config.isTest) {
    app.use(morgan(config.isProd ? 'combined' : 'dev'));
  }

  // Request id for log correlation.
  app.use((req, _res, next) => {
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
    next();
  });

  app.get('/api/v1/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'meditrack-api',
      version: '1.0.0',
      env: config.env,
      database: isDatabaseReady() ? 'connected' : 'disconnected',
      scheduler: schedulerStatus(),
      integrations: {
        ocr: ocrStatus(),
        medicineInfo: medicineInfoStatus(),
        push: {
          configured: Boolean(config.push.publicKey && config.push.privateKey),
        },
        storage: { driver: config.storageDriver },
      },
      time: new Date().toISOString(),
    });
  });

  app.use('/api/v1', apiLimiter, optionalAuth, apiRoutes);

  // Optionally serve the built single-page app from the same origin, so a single
  // service can host both the API and the client (no CORS, cookies stay simple).
  // Only active when `npm run build` has produced client/dist; skipped in tests.
  if (!config.isTest && fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    // Any non-API GET falls through to the SPA so client-side routing works.
    app.get(/^(?!\/api(\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export async function prepareApp() {
  await ensureUploadDir();
  return createApp();
}

export default createApp;
