import rateLimit from 'express-rate-limit';
import config from '../config/env.js';

const skipInTest = () => config.isTest;

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: { message: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' } },
});

export const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: {
    error: { message: 'Too many authentication attempts. Try again later.', code: 'RATE_LIMITED' },
  },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: { message: 'Too many uploads. Please slow down.', code: 'RATE_LIMITED' } },
});
