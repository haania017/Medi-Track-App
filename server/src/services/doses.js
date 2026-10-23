import DoseLog from '../models/DoseLog.js';
import Medicine from '../models/Medicine.js';
import FamilyMember from '../models/FamilyMember.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { applyStockChange } from './stock.js';
import { doseInstantsForDate, scheduleDoseQuantity } from './schedule.js';
import { localDateString, addDaysToDateString } from '../utils/timezone.js';

/** Local "HH:mm" of a dose instant, for display. */
function timeLabel(instant, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(instant));
}

/**
 * Materialise dose rows for the given profiles over a local date range.
 * Upserts are keyed on (medicineId, scheduledFor) so re-running never duplicates.
 */
export async function generateDoses({ profileIds, timeZone = 'UTC', fromDateStr, days = 1 }) {
  if (!profileIds?.length) return { created: 0 };

  const from = fromDateStr || localDateString(new Date(), timeZone);
  const to = addDaysToDateString(from, Math.max(0, days - 1));

  const medicines = await Medicine.find({
    profileId: { $in: profileIds },
    status: 'active',
    'schedule.type': { $ne: 'as-needed' },
  }).lean();

  let created = 0;
  const ops = [];

  for (const medicine of medicines) {
    let cursor = from;
    let guard = 0;
    while (cursor <= to && guard < 400) {
      for (const { instant } of doseInstantsForDate(medicine, cursor, timeZone)) {
        ops.push({
          updateOne: {
            filter: { medicineId: medicine._id, scheduledFor: instant },
            update: {
              $setOnInsert: {
                familyId: medicine.familyId,
                profileId: medicine.profileId,
                medicineId: medicine._id,
                scheduledFor: instant,
                scheduleTime: timeLabel(instant, timeZone),
                status: 'pending',
                quantity: scheduleDoseQuantity(medicine),
              },
            },
            upsert: true,
          },
        });
      }
      cursor = addDaysToDateString(cursor, 1);
      guard += 1;
    }
  }

  if (ops.length) {
    const result = await DoseLog.bulkWrite(ops, { ordered: false });
    created = result.upsertedCount || 0;
  }

  return { created, from, to };
}

/** Generate today's doses for every profile a user can access. */
export async function generateDosesForUser(user, { days = 1 } = {}) {
  const memberships = await FamilyMember.find({ userId: user._id, status: 'active' }).lean();
  if (!memberships.length) return { created: 0 };

  const familyIds = [...new Set(memberships.map((m) => m.familyId))];
  const profiles = await FamilyMember.find({
    familyId: { $in: familyIds },
    status: { $ne: 'revoked' },
  }).lean();

  return generateDoses({
    profileIds: profiles.map((p) => p._id),
    timeZone: user.timezone || 'UTC',
    days,
  });
}

/**
 * Mark a dose as taken. Exactly-once stock deduction:
 *  1. Atomically claim the dose (guard: stockDeducted !== true).
 *  2. Deduct stock with a dedupe key tied to the dose id.
 * A second call — or a duplicate reminder action — is a safe no-op.
 */
export async function markDoseTaken({ user, doseId, note = '' }) {
  const existing = await DoseLog.findById(doseId);
  if (!existing) throw ApiError.notFound('Dose not found.');

  const profile = await FamilyMember.findById(existing.profileId);
  if (!profile) throw ApiError.notFound('Dose not found.');

  const { resolveProfileAccess } = await import('./access.js');
  await resolveProfileAccess(user, existing.profileId, 'markDoses');

  const claimed = await DoseLog.findOneAndUpdate(
    { _id: doseId, stockDeducted: { $ne: true } },
    {
      $set: {
        status: 'taken',
        takenAt: new Date(),
        recordedByUserId: user._id,
        stockDeducted: true,
        ...(note ? { note } : {}),
      },
    },
    { new: true },
  );

  if (!claimed) {
    const current = await DoseLog.findById(doseId);
    return { dose: current, alreadyProcessed: true, stockChanged: false };
  }

  let stockChanged = false;
  let updatedMedicine = null;
  try {
    const result = await applyStockChange({
      medicineId: claimed.medicineId,
      change: -Math.abs(claimed.quantity || 1),
      type: 'dose',
      reason: `Dose marked taken (${claimed.scheduleTime || ''})`.trim(),
      doseLogId: claimed._id,
      userId: user._id,
      dedupeKey: `dose:${claimed._id}`,
    });
    stockChanged = !result.duplicate;
    updatedMedicine = result.medicine;
    if (result.transaction) {
      claimed.stockTransactionId = result.transaction._id;
      await claimed.save();
    }
  } catch (err) {
    // Roll the claim back so the user can correct stock and retry.
    await DoseLog.updateOne(
      { _id: claimed._id },
      { $set: { status: 'pending', takenAt: null, stockDeducted: false, recordedByUserId: null } },
    );
    throw err;
  }

  return { dose: claimed, alreadyProcessed: false, stockChanged, medicine: updatedMedicine };
}

export async function markDoseSkipped({ user, doseId, note = '' }) {
  const existing = await DoseLog.findById(doseId);
  if (!existing) throw ApiError.notFound('Dose not found.');

  const { resolveProfileAccess } = await import('./access.js');
  await resolveProfileAccess(user, existing.profileId, 'markDoses');

  if (existing.stockDeducted) {
    throw ApiError.conflict('This dose was already recorded as taken and its stock deducted.');
  }

  const updated = await DoseLog.findOneAndUpdate(
    { _id: doseId, stockDeducted: { $ne: true } },
    { $set: { status: 'skipped', skippedAt: new Date(), recordedByUserId: user._id, ...(note ? { note } : {}) } },
    { new: true },
  );

  return { dose: updated || existing, alreadyProcessed: !updated };
}

/** Push a dose reminder forward without touching stock or status. */
export async function snoozeDose({ user, doseId, minutes = 15 }) {
  const existing = await DoseLog.findById(doseId);
  if (!existing) throw ApiError.notFound('Dose not found.');

  const { resolveProfileAccess } = await import('./access.js');
  await resolveProfileAccess(user, existing.profileId, 'markDoses');

  if (existing.status === 'taken') throw ApiError.conflict('This dose is already marked as taken.');

  const snoozedUntil = new Date(Date.now() + Math.max(1, minutes) * 60 * 1000);
  const dose = await DoseLog.findByIdAndUpdate(
    doseId,
    { $set: { snoozedUntil, remindedAt: null }, $inc: { snoozeCount: 1 } },
    { new: true },
  );
  return { dose, snoozedUntil };
}

/**
 * Flag overdue pending doses as missed. Never deducts stock.
 * Returns the doses that transitioned to missed.
 */
export async function markMissedDoses({ profileIds, graceMinutes = 120 }) {
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);
  const filter = {
    status: 'pending',
    scheduledFor: { $lt: cutoff },
  };
  if (profileIds?.length) filter.profileId = { $in: profileIds };

  const overdue = await DoseLog.find(filter);
  const updated = [];
  for (const dose of overdue) {
    const res = await DoseLog.findOneAndUpdate(
      { _id: dose._id, status: 'pending' },
      { $set: { status: 'missed' } },
      { new: true },
    );
    if (res) updated.push(res);
  }
  return updated;
}

export async function getDoses({ profileIds, from, to, statuses, medicineId, limit = 500 }) {
  const filter = { profileId: { $in: profileIds } };
  if (from || to) {
    filter.scheduledFor = {};
    if (from) filter.scheduledFor.$gte = new Date(from);
    if (to) filter.scheduledFor.$lte = new Date(to);
  }
  if (statuses?.length) filter.status = { $in: statuses };
  if (medicineId) filter.medicineId = medicineId;

  return DoseLog.find(filter)
    .sort({ scheduledFor: 1 })
    .limit(Math.min(limit, 1000))
    .populate('medicineId', 'name strength unit form status')
    .populate('profileId', 'name color relationship memberType')
    .lean();
}

/** Group doses into today's view with a status summary. */
export async function getTodayView({ user, profileIds, timeZone, dateStr }) {
  const date = dateStr || localDateString(new Date(), timeZone);
  const from = `${date}T00:00:00.000Z`;
  const to = `${date}T23:59:59.999Z`;
  void from;
  void to;

  const doses = await DoseLog.find({
    profileId: { $in: profileIds },
    scheduledFor: {
      $gte: new Date(`${date}T00:00:00.000Z`),
      $lte: new Date(`${date}T23:59:59.999Z`),
    },
  })
    .sort({ scheduledFor: 1 })
    .populate('medicineId', 'name strength unit form status')
    .populate('profileId', 'name color relationship memberType')
    .lean();

  const summary = { total: doses.length, taken: 0, pending: 0, skipped: 0, missed: 0 };
  for (const d of doses) summary[d.status] = (summary[d.status] || 0) + 1;

  const now = Date.now();
  const next = doses.find(
    (d) => d.status === 'pending' && new Date(d.snoozedUntil || d.scheduledFor).getTime() >= now,
  );
  const overdue = doses.filter(
    (d) => d.status === 'pending' && new Date(d.snoozedUntil || d.scheduledFor).getTime() < now,
  );

  void user;
  return { date, doses, summary, next: next || null, overdueCount: overdue.length };
}

export async function resolveUserTimeZone(userId) {
  const user = await User.findById(userId).lean();
  return user?.timezone || 'UTC';
}

export default {
  generateDoses,
  generateDosesForUser,
  markDoseTaken,
  markDoseSkipped,
  snoozeDose,
  markMissedDoses,
  getDoses,
  getTodayView,
};
