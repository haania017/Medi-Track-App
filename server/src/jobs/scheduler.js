import User from '../models/User.js';
import Medicine from '../models/Medicine.js';
import FamilyMember from '../models/FamilyMember.js';
import CarePlan from '../models/CarePlan.js';
import DoseLog from '../models/DoseLog.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import { generateDosesForUser, markMissedDoses } from '../services/doses.js';
import { notifyProfile } from '../services/notifications.js';
import { localDateString } from '../utils/timezone.js';

const REMINDER_HORIZON_MS = 2 * 60 * 1000; // remind within 2 minutes of the dose time
const MISSED_GRACE_MINUTES = 120;
const EXPIRY_THRESHOLDS = [30, 7, 1];
const DOSE_HORIZON_DAYS = 3;

/**
 * One scheduler pass. Safe to run repeatedly:
 *  - every side effect is idempotent (dedupe keys, status guards, upserts)
 *  - nothing is delivered twice for the same dose/window
 */
export async function runSchedulerTick({ now = new Date() } = {}) {
  const stats = {
    users: 0,
    dosesGenerated: 0,
    reminders: 0,
    missed: 0,
    lowStock: 0,
    expiry: 0,
    carePlanReviews: 0,
  };

  const users = await User.find({}).select('_id name timezone notificationPreferences').lean();

  for (const user of users) {
    stats.users += 1;
    try {
      const result = await generateDosesForUser(user, { days: DOSE_HORIZON_DAYS });
      stats.dosesGenerated += result.created || 0;
    } catch (err) {
      logger.warn(`Dose generation failed for user ${user._id}:`, err.message);
    }
  }

  stats.reminders = await dispatchDoseReminders(now);
  stats.missed = await dispatchMissedDoses(now);
  stats.lowStock = await dispatchLowStockAlerts();
  stats.expiry = await dispatchExpiryAlerts(now);
  stats.carePlanReviews = await dispatchCarePlanReviews(now);

  return stats;
}

/** Send "time to take your medicine" alerts for doses that are due now. */
async function dispatchDoseReminders(now) {
  const windowEnd = new Date(now.getTime() + REMINDER_HORIZON_MS);
  const due = await DoseLog.find({
    status: 'pending',
    remindedAt: null,
    scheduledFor: { $lte: windowEnd },
    $or: [{ snoozedUntil: null }, { snoozedUntil: { $lte: now } }],
  })
    .limit(300)
    .populate('medicineId', 'name strength form')
    .populate('profileId', 'name color relationship familyId');

  let count = 0;
  for (const dose of due) {
    const profile = dose.profileId;
    const medicine = dose.medicineId;
    if (!profile || !medicine) continue;

    const created = await notifyProfile({
      profile,
      type: 'dose_reminder',
      title: `Time for ${medicine.name}`,
      body: `${profile.name} · ${medicine.name} ${medicine.strength || ''} at ${dose.scheduleTime || ''}`.trim(),
      urgency: 'high',
      medicineId: medicine._id,
      doseLogId: dose._id,
      keySuffix: `dose:${dose._id}`,
      actions: ['mark_taken', 'remind_later', 'view'],
    });
    if (created.length) count += created.length;

    await DoseLog.updateOne({ _id: dose._id }, { $set: { remindedAt: new Date() } });
  }
  return count;
}

async function dispatchMissedDoses(now) {
  const missed = await markMissedDoses({ graceMinutes: MISSED_GRACE_MINUTES });
  let count = 0;

  for (const dose of missed) {
    const [medicine, profile] = await Promise.all([
      Medicine.findById(dose.medicineId).lean(),
      FamilyMember.findById(dose.profileId).lean(),
    ]);
    if (!medicine || !profile) continue;

    const created = await notifyProfile({
      profile,
      type: 'missed_dose',
      title: `Missed dose: ${medicine.name}`,
      body: `${profile.name} has a missed dose of ${medicine.name} scheduled for ${dose.scheduleTime || 'earlier today'}.`,
      urgency: 'critical',
      medicineId: medicine._id,
      doseLogId: dose._id,
      keySuffix: `missed:${dose._id}`,
      actions: ['mark_taken', 'view'],
    });
    if (created.length) {
      count += created.length;
      await DoseLog.updateOne({ _id: dose._id }, { $set: { missedAlertedAt: new Date() } });
    }
  }
  void now;
  return count;
}

async function dispatchLowStockAlerts() {
  const lowStock = await Medicine.find({
    status: 'active',
    lowStockAlerted: false,
    $expr: { $lte: ['$stock.quantity', '$stock.lowStockThreshold'] },
  })
    .limit(200)
    .populate('profileId', 'name color relationship familyId');

  let count = 0;
  for (const medicine of lowStock) {
    const profile = medicine.profileId;
    if (!profile) continue;

    const created = await notifyProfile({
      profile,
      type: 'low_stock',
      title: `Low stock: ${medicine.name}`,
      body: `${profile.name} has ${medicine.stock.quantity} ${medicine.stock.unit} of ${medicine.name} left (threshold ${medicine.stock.lowStockThreshold}).`,
      urgency: 'high',
      medicineId: medicine._id,
      keySuffix: `lowstock:${medicine._id}:${medicine.stock.quantity}`,
    });
    if (created.length) count += created.length;
    // Mark alerted regardless so we do not repeat on every tick.
    medicine.stock.lowStockAlerted = true;
    await medicine.save();
  }
  return count;
}

async function dispatchExpiryAlerts(now) {
  const candidates = await Medicine.find({
    status: { $in: ['active', 'paused'] },
    expiryDate: { $ne: null },
  })
    .limit(500)
    .populate('profileId', 'name color relationship familyId');

  let count = 0;
  for (const medicine of candidates) {
    const profile = medicine.profileId;
    if (!profile) continue;

    const daysUntil = Math.ceil((new Date(medicine.expiryDate).getTime() - now.getTime()) / 86400000);
    if (daysUntil < 0) continue; // already expired — shown in the Expired list instead

    for (const threshold of EXPIRY_THRESHOLDS) {
      if (daysUntil > threshold) continue;
      if (medicine.expiryWarningsSent.includes(threshold)) continue;

      const created = await notifyProfile({
        profile,
        type: 'expiry',
        title: `Expiring soon: ${medicine.name}`,
        body: `${medicine.name} for ${profile.name} expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}.`,
        urgency: daysUntil <= 1 ? 'critical' : daysUntil <= 7 ? 'high' : 'normal',
        medicineId: medicine._id,
        keySuffix: `expiry:${medicine._id}:${threshold}`,
      });
      if (created.length) count += created.length;
      medicine.expiryWarningsSent.push(threshold);
    }
    await medicine.save();
  }
  return count;
}

/** Ask the authorised user to review temporary care plans whose date has arrived. */
async function dispatchCarePlanReviews(now) {
  const due = await CarePlan.find({
    status: 'active',
    reviewDate: { $lte: now },
  })
    .limit(200)
    .populate('profileId', 'name color relationship familyId');

  let count = 0;
  for (const plan of due) {
    const profile = plan.profileId;
    if (!profile) continue;

    const created = await notifyProfile({
      profile,
      type: 'care_plan_review',
      title: `Care plan review: ${plan.title}`,
      body: `Is the care plan for ${profile.name} complete, or should it continue?`,
      urgency: 'normal',
      carePlanId: plan._id,
      keySuffix: `review:${plan._id}:${new Date(plan.reviewDate).toISOString()}`,
      actions: ['review_plan', 'view'],
    });
    if (created.length) count += created.length;

    plan.status = 'awaiting_review';
    plan.reviewRequestedAt = new Date();
    plan.reviewRequestedCount += 1;
    // The plan is never auto-completed and the profile is never deleted.
    await plan.save();
  }
  return count;
}

/* ------------------------------- lifecycle -------------------------------- */

let timer = null;

export function startScheduler() {
  if (!config.scheduler.enabled || timer) return null;

  const interval = Math.max(15000, config.scheduler.intervalMs);
  timer = setInterval(async () => {
    try {
      const stats = await runSchedulerTick();
      if (stats.reminders || stats.missed || stats.lowStock || stats.expiry || stats.carePlanReviews) {
        logger.info('Scheduler tick:', stats);
      }
    } catch (err) {
      logger.error('Scheduler tick failed:', err.message);
    }
  }, interval);
  timer.unref?.();

  logger.info(`Background scheduler started (every ${Math.round(interval / 1000)}s)`);

  // Run one pass shortly after boot so the app is ready to use immediately.
  setTimeout(() => {
    runSchedulerTick().catch((err) => logger.warn('Initial scheduler run failed:', err.message));
  }, 3000).unref?.();

  return timer;
}

export function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function schedulerStatus() {
  return {
    enabled: config.scheduler.enabled,
    running: Boolean(timer),
    intervalMs: config.scheduler.intervalMs,
    timezoneAware: true,
    todayUtc: localDateString(new Date(), 'UTC'),
  };
}

export default { runSchedulerTick, startScheduler, stopScheduler, schedulerStatus };
