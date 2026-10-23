import express from 'express';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendData } from '../utils/http.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { publicUser, publicProfile } from '../utils/serialize.js';
import {
  updateUserSchema,
  updatePreferencesSchema,
  changePasswordSchema,
} from '../validators/schemas.js';
import { isValidTimeZone } from '../utils/timezone.js';
import { ensureUserWorkspace, getOrCreateWorkspace } from '../services/bootstrap.js';
import { listAccessibleProfiles } from '../services/access.js';
import { deleteUserAccount } from '../services/account.js';
import { clearAuthCookie } from '../middleware/auth.js';
import config from '../config/env.js';

const router = express.Router();

router.use(requireAuth);

router.get(
  '/me',
  asyncHandler(async (req, res) => sendData(res, { user: publicUser(req.user) })),
);

router.patch(
  '/me',
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const { name, timezone, locale } = req.body;
    if (name !== undefined) req.user.name = name;
    if (locale !== undefined) req.user.locale = locale;
    if (timezone !== undefined) {
      if (!isValidTimeZone(timezone)) throw ApiError.badRequest(`"${timezone}" is not a valid IANA timezone.`);
      req.user.timezone = timezone;
    }
    await req.user.save();
    return sendData(res, { user: publicUser(req.user) });
  }),
);

router.patch(
  '/me/preferences',
  validateBody(updatePreferencesSchema),
  asyncHandler(async (req, res) => {
    const { appearance, notificationPreferences } = req.body;

    if (appearance) {
      req.user.appearance = { ...req.user.appearance.toObject?.() ?? req.user.appearance, ...appearance };
    }
    if (notificationPreferences) {
      req.user.notificationPreferences = {
        ...(req.user.notificationPreferences.toObject?.() ?? req.user.notificationPreferences),
        ...notificationPreferences,
      };
    }
    await req.user.save();
    return sendData(res, { user: publicUser(req.user) });
  }),
);

router.post(
  '/me/password',
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!(await user.verifyPassword(currentPassword))) {
      throw ApiError.unauthorized('Your current password is incorrect.');
    }
    await user.setPassword(newPassword);
    // Invalidate existing tokens issued to other sessions.
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    return sendData(res, { success: true });
  }),
);

/**
 * Permanently delete the signed-in user's account and the data they own.
 * Requires the password again so a hijacked session cannot wipe an account.
 */
router.delete(
  '/me',
  asyncHandler(async (req, res) => {
    const { password } = req.body || {};
    if (!password) {
      throw ApiError.badRequest('Enter your password to confirm account deletion.');
    }
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!(await user.verifyPassword(password))) {
      throw ApiError.unauthorized('That password is incorrect.');
    }
    const summary = await deleteUserAccount(user);
    clearAuthCookie(res);
    return sendData(res, { success: true, ...summary });
  }),
);

/* --------------------------- push subscriptions --------------------------- */

router.get(
  '/me/push-subscription',
  asyncHandler(async (req, res) =>
    sendData(res, {
      configured: Boolean(config.push.publicKey && config.push.privateKey),
      publicKey: config.push.publicKey || null,
      subscriptions: req.user.pushSubscriptions?.length || 0,
    }),
  ),
);

router.post(
  '/me/push-subscription',
  asyncHandler(async (req, res) => {
    if (!config.push.publicKey) {
      throw ApiError.notConfigured(
        'Web Push is not configured on this server (VAPID keys missing). In-app notifications remain available.',
      );
    }
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw ApiError.badRequest('A valid push subscription (endpoint + keys) is required.');
    }
    await User.updateOne({ _id: req.user._id }, { $pull: { pushSubscriptions: { endpoint } } });
    await User.updateOne(
      { _id: req.user._id },
      { $push: { pushSubscriptions: { endpoint, keys } } },
    );
    return sendData(res, { success: true });
  }),
);

router.delete(
  '/me/push-subscription',
  asyncHandler(async (req, res) => {
    const { endpoint } = req.body || {};
    await User.updateOne(
      { _id: req.user._id },
      endpoint
        ? { $pull: { pushSubscriptions: { endpoint } } }
        : { $set: { pushSubscriptions: [] } },
    );
    return sendData(res, { success: true });
  }),
);

/* ------------------------------- workspace -------------------------------- */

/** Everything the app shell needs in one round-trip. */
router.get(
  '/me/workspace',
  asyncHandler(async (req, res) => {
    const { family } = await getOrCreateWorkspace(req.user);
    const profiles = await listAccessibleProfiles(req.user._id);
    const ownProfile = profiles.find((p) => p.userId && String(p.userId) === String(req.user._id));

    return sendData(res, {
      user: publicUser(req.user),
      family: family ? { id: String(family._id), name: family.name, ownerId: String(family.ownerId) } : null,
      activeProfile: ownProfile ? publicProfile(ownProfile) : null,
      profiles: profiles.map(publicProfile),
    });
  }),
);

export default router;
