import express from 'express';
import Medicine, { MEDICINE_PUBLIC_PROJECTION } from '../models/Medicine.js';
import StockTransaction from '../models/StockTransaction.js';
import DoseLog from '../models/DoseLog.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendData, sendPaginated, parsePagination, escapeRegex } from '../utils/http.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  createMedicineSchema,
  updateMedicineSchema,
  listMedicinesQuery,
  stockTransactionSchema,
} from '../validators/schemas.js';
import { resolveProfileAccess, resolveMedicineAccess, listAccessibleProfileIds } from '../services/access.js';
import { applyStockChange, recordInitialStock } from '../services/stock.js';
import { generateDoses } from '../services/doses.js';

const router = express.Router();
router.use(requireAuth);

const DEFAULT_DOSE_HORIZON_DAYS = 14;

async function regenerateDoses(profileId, timeZone) {
  try {
    await generateDoses({ profileIds: [profileId], timeZone, days: DEFAULT_DOSE_HORIZON_DAYS });
  } catch {
    // Dose generation is best-effort here; the scheduler will retry.
  }
}

/* --------------------------------- list ---------------------------------- */

router.get(
  '/',
  validateQuery(listMedicinesQuery),
  asyncHandler(async (req, res) => {
    const { profileId, status, q, expiringInDays, lowStock, sort } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

    let profileIds;
    if (profileId) {
      await resolveProfileAccess(req.user, profileId, 'view');
      profileIds = [profileId];
    } else {
      profileIds = await listAccessibleProfileIds(req.user._id);
    }

    const filter = { profileId: { $in: profileIds } };
    if (status) filter.status = { $in: String(status).split(',') };
    else filter.status = { $ne: 'archived' };

    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: rx }, { strength: rx }, { instructions: rx }];
    }

    if (expiringInDays !== undefined) {
      filter.expiryDate = {
        $ne: null,
        $lte: new Date(Date.now() + expiringInDays * 86400000),
      };
    }

    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$stock.quantity', '$stock.lowStockThreshold'] };
    }

    const sortMap = {
      name: { name: 1 },
      '-name': { name: -1 },
      expiry: { expiryDate: 1 },
      '-createdAt': { createdAt: -1 },
      createdAt: { createdAt: 1 },
      stock: { 'stock.quantity': 1 },
    };

    const [items, total] = await Promise.all([
      Medicine.find(filter)
        .sort(sortMap[sort] || { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('profileId', 'name color relationship memberType')
        .select(MEDICINE_PUBLIC_PROJECTION)
        .lean({ virtuals: true }),
      Medicine.countDocuments(filter),
    ]);

    return sendPaginated(res, items, { page, limit, total });
  }),
);

/* ------------------------------- expiry ---------------------------------- */

router.get(
  '/expiring',
  asyncHandler(async (req, res) => {
    const profileIds = await listAccessibleProfileIds(req.user._id);
    const days = Number.parseInt(req.query.days, 10) || 30;
    const now = new Date();
    const until = new Date(Date.now() + days * 86400000);

    const items = await Medicine.find({
      profileId: { $in: profileIds },
      status: { $in: ['active', 'paused'] },
      expiryDate: { $ne: null, $gte: now, $lte: until },
    })
      .sort({ expiryDate: 1 })
      .populate('profileId', 'name color relationship')
      .select(MEDICINE_PUBLIC_PROJECTION)
      .lean({ virtuals: true });

    return sendData(res, items, 200, { windowDays: days, count: items.length });
  }),
);

router.get(
  '/expired',
  asyncHandler(async (req, res) => {
    const profileIds = await listAccessibleProfileIds(req.user._id);
    const items = await Medicine.find({
      profileId: { $in: profileIds },
      status: { $in: ['active', 'paused', 'finished'] },
      expiryDate: { $ne: null, $lt: new Date() },
    })
      .sort({ expiryDate: -1 })
      .populate('profileId', 'name color relationship')
      .select(MEDICINE_PUBLIC_PROJECTION)
      .lean({ virtuals: true });

    return sendData(res, items, 200, {
      count: items.length,
      guidance:
        'MediTrack does not decide whether an expired medicine is safe. Ask a pharmacist or healthcare professional how to dispose of it.',
    });
  }),
);

/* -------------------------------- create --------------------------------- */

router.post(
  '/',
  validateBody(createMedicineSchema),
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const { profile } = await resolveProfileAccess(req.user, payload.profileId, 'manageMedicines');

    const medicine = await Medicine.create({
      familyId: profile.familyId,
      profileId: profile._id,
      createdByUserId: req.user._id,
      name: payload.name,
      strength: payload.strength || '',
      unit: payload.unit || 'mg',
      form: payload.form || 'tablet',
      instructions: payload.instructions || '',
      schedule: payload.schedule || undefined,
      startDate: payload.startDate || new Date(),
      endDate: payload.endDate ?? null,
      stock: payload.stock || undefined,
      expiryDate: payload.expiryDate ?? null,
      manufacturer: payload.manufacturer || '',
      batchNumber: payload.batchNumber || '',
      status: payload.status || 'active',
      source: payload.source || 'manual',
    });

    await recordInitialStock({ medicine, userId: req.user._id });
    await regenerateDoses(medicine.profileId, req.user.timezone || 'UTC');

    return sendData(res, medicine.toJSON(), 201);
  }),
);

/* -------------------------------- detail --------------------------------- */

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const medicine = await Medicine.findById(req.params.id);
    const { profile } = await resolveMedicineAccess(req.user, medicine, 'view');

    const [upcomingDoses, recentTransactions, historyCounts, doseHistory] = await Promise.all([
      DoseLog.find({ medicineId: medicine._id, status: 'pending', scheduledFor: { $gte: new Date() } })
        .sort({ scheduledFor: 1 })
        .limit(10)
        .lean(),
      StockTransaction.find({ medicineId: medicine._id }).sort({ createdAt: -1 }).limit(20).lean(),
      DoseLog.aggregate([
        { $match: { medicineId: medicine._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      DoseLog.find({ medicineId: medicine._id, status: { $ne: 'pending' } })
        .sort({ scheduledFor: -1 })
        .limit(25)
        .lean(),
    ]);

    const history = { taken: 0, skipped: 0, missed: 0, pending: 0 };
    for (const row of historyCounts) history[row._id] = row.count;

    return sendData(res, {
      medicine: medicine.toJSON(),
      profile: { id: String(profile._id), name: profile.name, color: profile.color },
      upcomingDoses,
      doseHistory,
      stockHistory: recentTransactions,
      history,
    });
  }),
);

/* -------------------------------- update --------------------------------- */

router.patch(
  '/:id',
  validateBody(updateMedicineSchema),
  asyncHandler(async (req, res) => {
    const medicine = await Medicine.findById(req.params.id);
    await resolveMedicineAccess(req.user, medicine, 'manageMedicines');

    const updates = req.body;
    const scheduleChanged =
      updates.schedule && JSON.stringify(updates.schedule) !== JSON.stringify(medicine.schedule);

    Object.assign(medicine, updates);
    if (updates.stock) {
      medicine.stock = { ...medicine.stock.toObject?.() ?? medicine.stock, ...updates.stock };
    }
    if (updates.status && updates.status !== 'active') {
      // Pausing/finishing stops future reminders but preserves history.
      await DoseLog.deleteMany({ medicineId: medicine._id, status: 'pending', scheduledFor: { $gte: new Date() } });
    }
    await medicine.save();

    if (scheduleChanged || updates.status === 'active') {
      await regenerateDoses(medicine.profileId, req.user.timezone || 'UTC');
    }

    return sendData(res, medicine.toJSON());
  }),
);

router.post(
  '/:id/archive',
  asyncHandler(async (req, res) => {
    const medicine = await Medicine.findById(req.params.id);
    await resolveMedicineAccess(req.user, medicine, 'manageMedicines');

    medicine.status = 'archived';
    medicine.archivedAt = new Date();
    await medicine.save();
    // Archive stops reminders; dose history and stock ledger are kept.
    await DoseLog.deleteMany({ medicineId: medicine._id, status: 'pending', scheduledFor: { $gte: new Date() } });

    return sendData(res, medicine.toJSON());
  }),
);

/* -------------------------------- stock ---------------------------------- */

router.get(
  '/:id/stock-transactions',
  asyncHandler(async (req, res) => {
    const medicine = await Medicine.findById(req.params.id);
    await resolveMedicineAccess(req.user, medicine, 'view');
    const { page, limit, skip } = parsePagination(req.query);
    const [items, total] = await Promise.all([
      StockTransaction.find({ medicineId: medicine._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdByUserId', 'name')
        .lean(),
      StockTransaction.countDocuments({ medicineId: medicine._id }),
    ]);
    return sendPaginated(res, items, { page, limit, total });
  }),
);

router.post(
  '/:id/stock-transactions',
  validateBody(stockTransactionSchema),
  asyncHandler(async (req, res) => {
    const medicine = await Medicine.findById(req.params.id);
    await resolveMedicineAccess(req.user, medicine, 'manageStock');

    const { type, quantityChange, reason } = req.body;
    const change = type === 'refill' ? Math.abs(quantityChange) : quantityChange;

    const result = await applyStockChange({
      medicineId: medicine._id,
      change,
      type,
      reason: reason || (type === 'refill' ? 'Refill recorded' : 'Manual adjustment'),
      userId: req.user._id,
    });

    return sendData(
      res,
      {
        medicine: result.medicine.toJSON(),
        transaction: result.transaction,
      },
      201,
    );
  }),
);

export default router;
