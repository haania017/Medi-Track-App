import { ZodError } from 'zod';
import mongoose from 'mongoose';
import multer from 'multer';
import config from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist.`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let error = err;

  if (err instanceof ZodError) {
    error = new ApiError(
      422,
      'Validation failed',
      'VALIDATION_ERROR',
      err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  } else if (err instanceof mongoose.Error.ValidationError) {
    error = new ApiError(
      422,
      'Validation failed',
      'VALIDATION_ERROR',
      Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
    );
  } else if (err instanceof mongoose.Error.CastError) {
    error = ApiError.badRequest(`Invalid value for "${err.path}".`);
  } else if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern || {}).filter((f) => f !== 'dedupeKey');
    error = ApiError.conflict(
      fields.length ? `An entry with that ${fields.join(', ')} already exists.` : 'Duplicate entry.',
    );
  } else if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. Maximum size is ${Math.round(config.maxUploadBytes / (1024 * 1024))} MB.`
        : `Upload error: ${err.message}`;
    error = new ApiError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, message, 'UPLOAD_ERROR');
  }

  const statusCode = error.statusCode || 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    logger.error(`${req.method} ${req.originalUrl} →`, error.stack || error.message, {
      requestId: req.id,
    });
  }

  res.status(statusCode).json({
    error: {
      message: isServerError && config.isProd ? 'Something went wrong.' : error.message,
      code: error.code || (isServerError ? 'INTERNAL_ERROR' : 'ERROR'),
      ...(error.details ? { details: error.details } : {}),
      ...(config.isProd ? {} : { stack: isServerError ? error.stack : undefined }),
    },
  });
}

export default errorHandler;
