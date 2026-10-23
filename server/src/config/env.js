import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(serverRoot, '.env') });
dotenv.config();

const toBool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProd,
  isTest,
  port: toInt(process.env.PORT, 5000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  mongoUri: process.env.MONGODB_URI || '',
  mongoDbName: process.env.MONGODB_DB_NAME || 'meditrack',
  devPersistDb: toBool(process.env.DEV_PERSIST_DB, false),

  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: process.env.COOKIE_NAME || 'meditrack_token',
  cookieSecure: toBool(process.env.COOKIE_SECURE, isProd),
  cookieSameSite: process.env.COOKIE_SAME_SITE || 'lax',

  uploadDir: path.resolve(serverRoot, process.env.UPLOAD_DIR || './storage/uploads'),
  maxUploadBytes: toInt(process.env.MAX_UPLOAD_MB, 10) * 1024 * 1024,
  storageDriver: process.env.STORAGE_DRIVER || 'local',
  s3: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    endpoint: process.env.S3_ENDPOINT || '',
  },

  ocr: {
    provider: process.env.OCR_PROVIDER || 'none',
    apiKey: process.env.OCR_API_KEY || '',
    baseUrl: process.env.OCR_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OCR_MODEL || 'gpt-4o-mini',
  },

  medicineInfo: {
    provider: process.env.MEDICINE_INFO_PROVIDER || 'none',
    apiKey: process.env.MEDICINE_INFO_API_KEY || '',
    baseUrl: process.env.MEDICINE_INFO_BASE_URL || 'https://rxnav.nlm.nih.gov/REST',
    cacheTtlHours: toInt(process.env.MEDICINE_INFO_CACHE_TTL_HOURS, 168),
  },

  push: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:support@example.invalid',
  },

  scheduler: {
    enabled: toBool(process.env.ENABLE_SCHEDULER, !isTest),
    intervalMs: toInt(process.env.SCHEDULER_INTERVAL_MS, 60000),
  },

  // Seed a synthetic demo account on first boot when the database is empty.
  // On by default in development so there is always something to log into;
  // never in production.
  seedDemo: toBool(process.env.SEED_DEMO, !isProd && !isTest),

  rateLimit: {
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: toInt(process.env.RATE_LIMIT_MAX, 300),
    authMax: toInt(process.env.AUTH_RATE_LIMIT_MAX, 30),
  },

  serverRoot,
};

export default config;
