import Notification from '../models/Notification.js';
import Family from '../models/Family.js';
import FamilyMember from '../models/FamilyMember.js';
import User from '../models/User.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import { dedupeKey as makeKey } from '../utils/ids.js';

export const TYPE_TO_PREF = {
  dose_reminder: 'doseReminder',
  missed_dose: 'missedDose',
  low_stock: 'lowStock',
  expiry: 'expiry',
  care_plan_review: 'carePlanReview',
};

export const TYPE_ACTIONS = {
  dose_reminder: ['mark_taken', 'remind_later', 'view'],
  missed_dose: ['mark_taken', 'view'],
  low_stock: ['view'],
  expiry: ['view'],
  care_plan_review: ['review_plan', 'view'],
  system: ['view'],
};

/**
 * Create a notification once. Repeated calls with the same dedupe key are
 * no-ops, which keeps reminder retries idempotent.
 */
export async function createNotification({
  userId,
  familyId,
  profileId = null,
  medicineId = null,
  doseLogId = null,
  carePlanId = null,
  type,
  title,
  body = '',
  urgency = 'normal',
  memberName = '',
  memberColor = '#111827',
  actions,
  key,
}) {
  const dk = key || makeKey(userId, type, profileId, medicineId, doseLogId, carePlanId, title);
  try {
    return await Notification.create({
      userId,
      familyId,
      profileId,
      medicineId,
      doseLogId,
      carePlanId,
      type,
      title,
      body,
      urgency,
      memberName,
      memberColor,
      actions: actions || TYPE_ACTIONS[type] || ['view'],
      dedupeKey: dk,
    });
  } catch (err) {
    if (err?.code === 11000) return null; // already delivered
    throw err;
  }
}

/**
 * Who should receive an alert about a given profile?
 *  - the profile's own account (for adult/owner profiles)
 *  - the family owner
 *  - connected adults who opted in via per-member share preferences
 * Each recipient's own notification preferences are respected.
 */
export async function resolveRecipients({ familyId, profileId, type }) {
  const prefKey = TYPE_TO_PREF[type];
  const family = await Family.findById(familyId).lean();
  if (!family) return [];

  const members = await FamilyMember.find({ familyId, status: 'active' }).lean();
  const candidateUserIds = new Set();

  for (const member of members) {
    if (!member.userId) continue;

    const isProfileOwner = profileId && String(member._id) === String(profileId);
    const isFamilyOwner = String(family.ownerId) === String(member.userId);
    const sharesAlert = !prefKey || member.sharePreferences?.[prefKey] !== false;

    if (isProfileOwner || isFamilyOwner || sharesAlert) {
      candidateUserIds.add(String(member.userId));
    }
  }

  if (!candidateUserIds.size) return [];

  const users = await User.find({ _id: { $in: [...candidateUserIds] } }).lean();
  return users.filter((u) => {
    const prefs = u.notificationPreferences || {};
    if (prefs.inApp === false) return false;
    if (prefKey && prefs[prefKey] === false) return false;
    return true;
  });
}

/** Fan a notification out to every eligible recipient. */
export async function notifyProfile({ profile, type, title, body, urgency = 'normal', medicineId, doseLogId, carePlanId, keySuffix, actions }) {
  const recipients = await resolveRecipients({
    familyId: profile.familyId,
    profileId: profile._id,
    type,
  });

  const created = [];
  for (const user of recipients) {
    const note = await createNotification({
      userId: user._id,
      familyId: profile.familyId,
      profileId: profile._id,
      medicineId,
      doseLogId,
      carePlanId,
      type,
      title,
      body,
      urgency,
      memberName: profile.name,
      memberColor: profile.color,
      actions,
      key: `${type}:${profile._id}:${user._id}:${keySuffix || ''}`,
    });
    if (note) created.push(note);
  }

  // Best-effort external push; in-app notifications already exist.
  for (const note of created) {
    await deliverPush(note).catch((err) => logger.warn('Push delivery failed:', err.message));
  }

  return created;
}

let webPushClient = null;
function getWebPush() {
  if (!config.push.publicKey || !config.push.privateKey) return null;
  if (webPushClient) return webPushClient;
  try {
    // Lazy import keeps this dependency optional at runtime.
    // eslint-disable-next-line global-require
    return import('web-push').then((mod) => {
      const wp = mod.default || mod;
      wp.setVapidDetails(config.push.subject, config.push.publicKey, config.push.privateKey);
      webPushClient = wp;
      return wp;
    });
  } catch {
    return null;
  }
}

/**
 * Attempt external push delivery. Honest about capability: if VAPID keys are
 * absent, nothing is sent and the flag stays false.
 */
export async function deliverPush(notification) {
  if (!config.push.publicKey || !config.push.privateKey) {
    return { sent: false, reason: 'push-not-configured' };
  }

  const wpPromise = getWebPush();
  if (!wpPromise) return { sent: false, reason: 'push-unavailable' };
  const wp = await wpPromise;

  const user = await User.findById(notification.userId).lean();
  const subscriptions = user?.pushSubscriptions || [];
  if (!subscriptions.length) return { sent: false, reason: 'no-subscriptions' };

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    type: notification.type,
    memberName: notification.memberName,
    memberColor: notification.memberColor,
    urgency: notification.urgency,
    notificationId: String(notification._id),
    actions: notification.actions,
  });

  let sent = false;
  const staleEndpoints = [];

  for (const sub of subscriptions) {
    try {
      await wp.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
      sent = true;
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) staleEndpoints.push(sub.endpoint);
      else logger.warn('Push send failed:', err.message);
    }
  }

  if (staleEndpoints.length) {
    await User.updateOne(
      { _id: notification.userId },
      { $pull: { pushSubscriptions: { endpoint: { $in: staleEndpoints } } } },
    );
  }

  if (sent) {
    await Notification.updateOne(
      { _id: notification._id },
      { $set: { pushSent: true, pushSentAt: new Date() }, $inc: { pushAttempts: 1 } },
    );
  } else {
    await Notification.updateOne({ _id: notification._id }, { $inc: { pushAttempts: 1 } });
  }

  return { sent };
}

export default { createNotification, notifyProfile, resolveRecipients, deliverPush };
