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
import logger from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

/**
 * Origins that are always allowed, in addition to anything in CLIENT_ORIGIN.
 *  - The localhost entries keep the Vite dev server usable.
 *  - The deployed frontend is listed explicitly so a missing, mistyped or
 *    trailing-slashed CLIENT_ORIGIN cannot lock the production UI out.
 */
const STATIC_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://medi-track-indol-seven.vercel.app',
];

/**
 * Normalise an origin so a trailing slash, different case or stray whitespace
 * never causes a legitimate origin to be rejected. Browsers send origins
 * without a trailing slash, so "https://x.vercel.app/" must still match.
 */
export function normaliseOrigin(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase();
}

/**
 * Build the CORS allow-list from CLIENT_ORIGIN (a single origin or a
 * comma-separated list) plus the always-allowed origins above.
 */
export function buildAllowedOrigins() {
  const fromEnv = String(config.clientOrigin || '')
    .split(',')
    .map(normaliseOrigin)
    .filter(Boolean);
  return new Set([...STATIC_ALLOWED_ORIGINS.map(normaliseOrigin), ...fromEnv]);
}

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

  // -------------------------------------------------------------------------
  // CORS — scoped to /api only.
  //
  // The client build tags every asset with `crossorigin`, so even same-origin
  // /assets/*.js|css requests carry an Origin header. Mounting CORS globally
  // meant those non-API asset requests were CORS-checked and rejected with a
  // 500 ("Not allowed by CORS"). Scoping the middleware to /api limits CORS to
  // the endpoints that actually need it.
  //
  // allowedHeaders is intentionally omitted: the `cors` package then reflects
  // the browser's Access-Control-Request-Headers, so preflight requests for any
  // header the client uses succeed.
  // -------------------------------------------------------------------------
  const allowedOrigins = buildAllowedOrigins();
  app.use(
    '/api',
    cors({
      origin(origin, callback) {
        // Same-origin requests, curl and server-to-server calls carry no Origin.
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(normaliseOrigin(origin))) return callback(null, true);
        // Do NOT throw: omitting the CORS headers lets the browser block the
        // response cleanly, instead of turning every unexpected origin into a
        // 500 that looks like a server fault.
        logger.warn(`CORS: blocked request from disallowed origin ${origin}`);
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      optionsSuccessStatus: 204,
      maxAge: 86400,
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
