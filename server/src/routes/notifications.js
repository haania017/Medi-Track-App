import express from 'express';
import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendData, parsePagination } from '../utils/http.js';
import { validateQuery } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { notificationsQuery } from '../validators/schemas.js';
import { markDoseTaken, snoozeDose } from '../services/doses.js';
import config from '../config/env.js';

const router = express.Router();
router.use(requireAuth);

router.get(
  '/',
  validateQuery(notificationsQuery),
  asyncHandler(async (req, res) => {
    const { unreadOnly, type } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { userId: req.user._id };
    if (unreadOnly === 'true') filter.read = false;
    if (type) filter.type = { $in: String(type).split(',') };

    const [items, total, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: req.user._id, read: false }),
    ]);

    return sendData(res, items, 200, {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      unread,
      pushConfigured: Boolean(config.push.publicKey && config.push.privateKey),
    });
  }),
);

router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const unread = await Notification.countDocuments({ userId: req.user._id, read: false });
    return sendData(res, { unread });
  }),
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const note = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { read: true, readAt: new Date() } },
      { new: true },
    );
    if (!note) throw ApiError.notFound('Notification not found.');
    return sendData(res, note);
  }),
);

router.post(
  '/mark-all-read',
  asyncHandler(async (req, res) => {
    const result = await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } },
    );
    return sendData(res, { updated: result.modifiedCount });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await Notification.deleteOne({ _id: req.params.id, userId: req.user._id });
    if (!result.deletedCount) throw ApiError.notFound('Notification not found.');
    return sendData(res, { success: true });
  }),
);

/**
 * In-app notification actions. These work whether or not external push is
 * configured, and they reuse the same idempotent dose services as the app.
 */
router.post(
  '/:id/action',
  asyncHandler(async (req, res) => {
    const { action } = req.body || {};
    const note = await Notification.findOne({ _id: req.params.id, userId: req.user._id });
    if (!note) throw ApiError.notFound('Notification not found.');

    if (!note.actions?.includes(action)) {
      throw ApiError.badRequest(`This notification does not support the "${action}" action.`);
    }

    if (action === 'mark_taken' || action === 'remind_later') {
      if (!note.doseLogId) throw ApiError.badRequest('This notification is not linked to a dose.');
      if (action === 'mark_taken') {
        const result = await markDoseTaken({ user: req.user, doseId: String(note.doseLogId) });
        await Notification.updateOne({ _id: note._id }, { $set: { read: true, readAt: new Date() } });
        return sendData(res, {
          action,
          dose: result.dose,
          alreadyProcessed: result.alreadyProcessed,
          stockChanged: result.stockChanged,
        });
      }
      const result = await snoozeDose({ user: req.user, doseId: String(note.doseLogId), minutes: 15 });
      return sendData(res, { action, ...result });
    }

    if (action === 'view' || action === 'review_plan') {
      await Notification.updateOne({ _id: note._id }, { $set: { read: true, readAt: new Date() } });
      return sendData(res, { action, success: true });
    }

    throw ApiError.badRequest(`Unsupported action "${action}".`);
  }),
);

export default router;
