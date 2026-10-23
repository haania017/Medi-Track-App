import express from 'express';
import DoseLog from '../models/DoseLog.js';
import StockTransaction from '../models/StockTransaction.js';
import Medicine, { MEDICINE_PUBLIC_PROJECTION } from '../models/Medicine.js';
import FamilyMember from '../models/FamilyMember.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendData } from '../utils/http.js';
import { validateQuery } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { adherenceQuery } from '../validators/schemas.js';
import { listAccessibleProfileIds, resolveProfileAccess } from '../services/access.js';
import { localDateString, addDaysToDateString } from '../utils/timezone.js';

const router = express.Router();
router.use(requireAuth);

async function resolveScope(req) {
  const profileId = req.query.profileId;
  if (profileId) {
    await resolveProfileAccess(req.user, profileId, 'view');
    return [profileId];
  }
  return listAccessibleProfileIds(req.user._id);
}

function bucketKey(date, period, timeZone) {
  const day = localDateString(date, timeZone);
  if (period === 'daily') return day;
  if (period === 'monthly') return day.slice(0, 7);
  return day; // weekly handled below
}

function weekStart(date, timeZone) {
  const day = localDateString(date, timeZone);
  const [y, m, d] = day.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDaysToDateString(day, -dow);
}

/**
 * Recorded-dose adherence. These figures reflect what users recorded in the
 * app — they are not proof that a medicine was actually ingested.
 */
router.get(
  '/adherence',
  validateQuery(adherenceQuery),
  asyncHandler(async (req, res) => {
    const profileIds = await resolveScope(req);
    const timeZone = req.user.timezone || 'UTC';
    const { period, from, to } = req.query;

    const days = period === 'daily' ? 30 : period === 'monthly' ? 365 : 84;
    const toDate = to || localDateString(new Date(), timeZone);
    const fromDate = from || addDaysToDateString(toDate, -days);
    const totalRecorded = {
      taken: 0, skipped: 0, missed: 0, pending: 0, total: 0,
    };

    const doses = await DoseLog.find({
      profileId: { $in: profileIds },
      scheduledFor: {
        $gte: new Date(`${fromDate}T00:00:00.000Z`),
        $lte: new Date(`${toDate}T23:59:59.999Z`),
      },
    })
      .populate('medicineId', 'name strength')
      .populate('profileId', 'name color')
      .lean();

    const buckets = new Map();
    const byMedicine = new Map();

    for (const dose of doses) {
      const key =
        period === 'weekly'
          ? weekStart(new Date(dose.scheduledFor), timeZone)
          : bucketKey(new Date(dose.scheduledFor), period, timeZone);

      if (!buckets.has(key)) buckets.set(key, { bucket: key, taken: 0, skipped: 0, missed: 0, pending: 0, total: 0 });
      const bucket = buckets.get(key);
      bucket[dose.status] = (bucket[dose.status] || 0) + 1;
      bucket.total += 1;
      totalRecorded[dose.status] = (totalRecorded[dose.status] || 0) + 1;
      totalRecorded.total += 1;

      const medKey = String(dose.medicineId?._id || 'unknown');
      if (!byMedicine.has(medKey)) {
        byMedicine.set(medKey, {
          medicineId: medKey,
          name: dose.medicineId?.name || 'Unknown',
          strength: dose.medicineId?.strength || '',
          taken: 0, skipped: 0, missed: 0, pending: 0, total: 0,
        });
      }
      const med = byMedicine.get(medKey);
      med[dose.status] = (med[dose.status] || 0) + 1;
      med.total += 1;
    }

    const recorded = totalRecorded.taken + totalRecorded.skipped + totalRecorded.missed;
    const adherenceRate = recorded ? Number(((totalRecorded.taken / recorded) * 100).toFixed(1)) : null;

    const payload = {
      period,
      from: fromDate,
      to: toDate,
      timezone: timeZone,
      summary: { ...totalRecorded, adherenceRate },
      buckets: [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)),
      byMedicine: [...byMedicine.values()].sort((a, b) => b.total - a.total),
      disclaimer:
        'Based on what you recorded in MediTrack. It is not medical proof that a dose was taken.',
    };

    if (req.query.format === 'csv') {
      const header = 'bucket,taken,skipped,missed,pending,total\n';
      const rows = payload.buckets
        .map((b) => [b.bucket, b.taken, b.skipped, b.missed, b.pending, b.total].join(','))
        .join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="meditrack-adherence-${period}.csv"`);
      return res.send(header + rows);
    }

    return sendData(res, payload);
  }),
);

/** Stock ledger across accessible profiles. */
router.get(
  '/stock-history',
  asyncHandler(async (req, res) => {
    const profileIds = await resolveScope(req);
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 200, 1000);

    const transactions = await StockTransaction.find({ profileId: { $in: profileIds } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('medicineId', 'name strength stock.unit')
      .populate('profileId', 'name color')
      .populate('createdByUserId', 'name')
      .lean();

    if (req.query.format === 'csv') {
      const header = 'date,medicine,profile,type,change,resulting,reason\n';
      const rows = transactions
        .map((t) =>
          [
            new Date(t.createdAt).toISOString(),
            JSON.stringify(t.medicineId?.name || ''),
            JSON.stringify(t.profileId?.name || ''),
            t.type,
            t.quantityChange,
            t.resultingQuantity,
            JSON.stringify(t.reason || ''),
          ].join(','),
        )
        .join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="meditrack-stock-history.csv"');
      return res.send(header + rows);
    }

    return sendData(res, transactions, 200, { count: transactions.length });
  }),
);

/** Expiry report: expiring soon, already expired, and missing an expiry date. */
router.get(
  '/expiry',
  asyncHandler(async (req, res) => {
    const profileIds = await resolveScope(req);
    const windowDays = Number.parseInt(req.query.days, 10) || 30;
    const now = new Date();

    const baseFilter = {
      profileId: { $in: profileIds },
      status: { $in: ['active', 'paused', 'finished'] },
    };

    const [withExpiry, missingExpiry] = await Promise.all([
      Medicine.find({ ...baseFilter, expiryDate: { $ne: null } })
        .populate('profileId', 'name color')
        .select(MEDICINE_PUBLIC_PROJECTION)
        .sort({ expiryDate: 1 })
        .lean(),
      Medicine.find({ ...baseFilter, expiryDate: null })
        .populate('profileId', 'name color')
        .select(MEDICINE_PUBLIC_PROJECTION)
        .sort({ name: 1 })
        .lean(),
    ]);

    const expired = withExpiry.filter((m) => m.expiryDate < now);
    const expiring = withExpiry.filter(
      (m) => m.expiryDate >= now && m.expiryDate <= new Date(Date.now() + windowDays * 86400000),
    );

    return sendData(res, {
      windowDays,
      expired,
      expiring,
      // Kept deliberately separate from expiry alerts: a missing date is
      // "unknown", never "expired" and never "safe".
      missingExpiry,
      counts: {
        expired: expired.length,
        expiring: expiring.length,
        missingExpiry: missingExpiry.length,
      },
      guidance:
        'MediTrack does not decide whether an expired medicine is still safe. Ask a pharmacist or healthcare professional how to handle it.',
      missingExpiryGuidance:
        'A medicine with no expiry date is neither expired nor confirmed safe. Record the date when you can, and check the packaging in the meantime.',
    });
  }),
);

/** Per-profile summary used by the family overview. */
router.get(
  '/family-summary',
  asyncHandler(async (req, res) => {
    const profileIds = await listAccessibleProfileIds(req.user._id);
    const profiles = await FamilyMember.find({ _id: { $in: profileIds } }).lean();
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    const [doseCounts, stockCounts] = await Promise.all([
      DoseLog.aggregate([
        { $match: { profileId: { $in: profileIds }, scheduledFor: { $gte: start } } },
        { $group: { _id: { profileId: '$profileId', status: '$status' }, count: { $sum: 1 } } },
      ]),
      Medicine.aggregate([
        { $match: { profileId: { $in: profileIds }, status: 'active' } },
        { $group: { _id: '$profileId', count: { $sum: 1 } } },
      ]),
    ]);

    const doseMap = new Map();
    for (const row of doseCounts) {
      const key = String(row._id.profileId);
      if (!doseMap.has(key)) doseMap.set(key, { taken: 0, pending: 0, missed: 0, skipped: 0 });
      doseMap.get(key)[row._id.status] = row.count;
    }
    const stockMap = new Map(stockCounts.map((s) => [String(s._id), s.count]));

    return sendData(
      res,
      profiles.map((p) => ({
        profileId: String(p._id),
        name: p.name,
        relationship: p.relationship,
        color: p.color,
        memberType: p.memberType,
        activeMedicines: stockMap.get(String(p._id)) || 0,
        dosesToday: doseMap.get(String(p._id)) || { taken: 0, pending: 0, missed: 0, skipped: 0 },
      })),
    );
  }),
);

export default router;
