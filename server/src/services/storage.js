import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']);

export function assertAllowedFile(file) {
  if (!file) throw ApiError.badRequest('No file was uploaded.');
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw ApiError.badRequest(
      `Unsupported file type "${file.mimetype}". Allowed: JPEG, PNG, WEBP, HEIC, PDF.`,
    );
  }
  if (file.size > config.maxUploadBytes) {
    throw ApiError.tooLarge(
      `File is too large. Maximum size is ${Math.round(config.maxUploadBytes / (1024 * 1024))} MB.`,
    );
  }
}

export async function ensureUploadDir() {
  await fs.mkdir(config.uploadDir, { recursive: true });
}

/**
 * Persist an uploaded file to private storage.
 * The local driver writes outside any static-served directory; files are only
 * ever returned through an authenticated controller.
 */
export async function saveFile(buffer, { originalName, mimeType, subdir = 'prescriptions' }) {
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const ext = path.extname(originalName || '').slice(0, 10) || '.bin';
  const key = `${subdir}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;

  if (config.storageDriver === 's3') {
    // S3 driver is only used when explicitly configured; otherwise fall through.
    const configured = config.s3.bucket && config.s3.accessKeyId;
    if (!configured) {
      throw ApiError.notConfigured(
        'S3 storage is selected but S3 credentials are not configured. Set STORAGE_DRIVER=local or provide S3 settings.',
      );
    }
    // Real S3 upload would go here (aws-sdk). Kept honest: we do not pretend.
    throw ApiError.notConfigured(
      'S3 storage driver is not enabled in this build. Use STORAGE_DRIVER=local.',
    );
  }

  const absolutePath = path.join(config.uploadDir, key);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
  logger.info(`Stored upload ${key} (${buffer.length} bytes)`);

  return { driver: 'local', key, absolutePath, checksum };
}

export async function deleteFile(storage) {
  if (!storage) return;
  if (storage.driver === 'local' && storage.absolutePath) {
    try {
      await fs.unlink(storage.absolutePath);
    } catch (err) {
      if (err.code !== 'ENOENT') logger.warn('Failed to delete stored file:', err.message);
    }
  }
}

export async function readFile(storage) {
  if (storage?.driver === 'local' && storage.absolutePath) {
    return fs.readFile(storage.absolutePath);
  }
  throw ApiError.notFound('Stored file is unavailable.');
}

export const allowedMimeTypes = ALLOWED_MIME;
