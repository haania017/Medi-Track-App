import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';

export function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), tv: user.tokenVersion ?? 0 },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function setAuthCookie(res, token) {
  res.cookie(config.cookieName, token, cookieOptions());
}

export function clearAuthCookie(res) {
  res.clearCookie(config.cookieName, { ...cookieOptions(), maxAge: undefined });
}

function extractToken(req) {
  if (req.cookies?.[config.cookieName]) return req.cookies[config.cookieName];
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/**
 * Attaches req.user when a valid token is present. Never throws — use
 * `requireAuth` for endpoints that must reject anonymous callers.
 */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub);
    if (user && (user.tokenVersion ?? 0) === (payload.tv ?? 0)) {
      req.user = user;
    }
  } catch {
    // Invalid/expired token behaves like an anonymous request.
  }
  return next();
});

export const requireAuth = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw ApiError.unauthorized('You must be signed in to do that.');
  return next();
});

export default requireAuth;
