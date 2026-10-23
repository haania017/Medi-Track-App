import Family from '../models/Family.js';
import FamilyMember from '../models/FamilyMember.js';
import logger from '../utils/logger.js';

export const MEMBER_COLORS = [
  '#111827',
  '#2563eb',
  '#059669',
  '#7c3aed',
  '#e11d48',
  '#d97706',
  '#0891b2',
  '#db2777',
];

/**
 * Ensure a user has a family workspace and a self ("owner") profile.
 * Idempotent — safe to call on every login.
 */
export async function ensureUserWorkspace(user) {
  let memberships = await FamilyMember.find({ userId: user._id, status: 'active' });

  if (!memberships.length) {
    const family = await Family.create({
      name: `${user.name.split(' ')[0]}'s Family`,
      ownerId: user._id,
    });
    await FamilyMember.create({
      familyId: family._id,
      userId: user._id,
      memberType: 'owner',
      name: user.name,
      relationship: 'Self',
      color: MEMBER_COLORS[0],
      status: 'active',
      consent: { grantedByUserId: user._id, grantedAt: new Date() },
    });
    logger.info(`Created family workspace for user ${user._id}`);
    memberships = await FamilyMember.find({ userId: user._id, status: 'active' });
  }

  return memberships;
}

export async function getOrCreateWorkspace(user) {
  await ensureUserWorkspace(user);
  const family = await Family.findOne({ ownerId: user._id }).sort({ createdAt: 1 });
  const profile = await FamilyMember.findOne({
    userId: user._id,
    memberType: 'owner',
    status: 'active',
  });
  return { family, profile };
}

export default { ensureUserWorkspace, getOrCreateWorkspace, MEMBER_COLORS };
