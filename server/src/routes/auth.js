import express from 'express';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendData } from '../utils/http.js';
import { validateBody } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/schemas.js';
import { setAuthCookie, clearAuthCookie, signToken, requireAuth } from '../middleware/auth.js';
import { ensureUserWorkspace } from '../services/bootstrap.js';
import { publicUser } from '../utils/serialize.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { isValidTimeZone } from '../utils/timezone.js';

const router = express.Router();

router.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, timezone, termsAccepted } = req.body;

    const existing = await User.findOne({ email });
    if (existing) throw ApiError.conflict('An account with that email already exists.');

    const user = new User({
      name,
      email,
      timezone: timezone && isValidTimeZone(timezone) ? timezone : 'UTC',
      termsAcceptedAt: termsAccepted ? new Date() : undefined,
    });
    await user.setPassword(password);
    await user.save();

    await ensureUserWorkspace(user);

    const token = signToken(user);
    setAuthCookie(res, token);

    return sendData(res, { user: publicUser(user), token }, 201);
  }),
);

router.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    // Same message for unknown email and wrong password (no account enumeration).
    if (!user || !(await user.verifyPassword(password))) {
      throw ApiError.unauthorized('Incorrect email or password.');
    }

    user.lastLoginAt = new Date();
    await user.save();
    await ensureUserWorkspace(user);

    const token = signToken(user);
    setAuthCookie(res, token);

    return sendData(res, { user: publicUser(user), token });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    clearAuthCookie(res);
    return sendData(res, { success: true });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    await ensureUserWorkspace(req.user);
    return sendData(res, { user: publicUser(req.user) });
  }),
);

export default router;
