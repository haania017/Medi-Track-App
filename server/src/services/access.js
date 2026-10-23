import mongoose from 'mongoose';
import Family from '../models/Family.js';
import FamilyMember from '../models/FamilyMember.js';
import ApiError from '../utils/ApiError.js';

export const CAPABILITIES = {
  view: 'viewRecords',
  manageMedicines: 'manageMedicines',
  markDoses: 'markDoses',
  manageStock: 'manageStock',
  manageCarePlans: 'manageCarePlans',
  manageProfile: 'manageProfile',
};

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);

/** All active (familyId, member) memberships for a user account. */
export async function getUserMemberships(userId) {
  return FamilyMember.find({ userId, status: 'active' }).lean();
}

export async function getUserFamilyIds(userId) {
  const memberships = await getUserMemberships(userId);
  return [...new Set(memberships.map((m) => String(m.familyId)))];
}

/**
 * The user's own default profile (created at registration). Falls back to any
 * owned member if the owner profile is somehow missing.
 */
export async function getDefaultProfile(userId) {
  let profile = await FamilyMember.findOne({ userId, status: 'active', memberType: 'owner' });
  if (profile) return profile;
  profile = await FamilyMember.findOne({ userId, status: 'active' }).sort({ createdAt: 1 });
  if (profile) return profile;
  throw ApiError.internal('No profile is associated with this account.');
}

/** Every profile the user may read, across every family they belong to. */
export async function listAccessibleProfiles(userId) {
  const familyIds = await getUserFamilyIds(userId);
  if (!familyIds.length) return [];
  return FamilyMember.find({ familyId: { $in: familyIds }, status: { $ne: 'revoked' } })
    .sort({ memberType: 1, createdAt: 1 })
    .lean();
}

export async function listAccessibleProfileIds(userId) {
  const profiles = await listAccessibleProfiles(userId);
  return profiles.map((p) => p._id);
}

/**
 * Resolve whether `user` may act on `profileId` with `capability`.
 * Throws a 403/404 ApiError when not permitted.
 * Returns { profile, membership, isFamilyOwner, capabilities }.
 */
export async function resolveProfileAccess(user, profileId, capability = 'view') {
  if (!isObjectId(profileId)) throw ApiError.badRequest('Invalid profile id.');

  const profile = await FamilyMember.findById(profileId);
  if (!profile) throw ApiError.notFound('Profile not found.');

  // Cross-family probing must be indistinguishable from "not found".
  const membership = await FamilyMember.findOne({
    familyId: profile.familyId,
    userId: user._id,
    status: 'active',
  });

  if (!membership) throw ApiError.notFound('Profile not found.');

  const family = await Family.findById(profile.familyId);
  const isFamilyOwner =
    membership.memberType === 'owner' || String(family?.ownerId) === String(user._id);

  const permissionField = CAPABILITIES[capability];
  const granted =
    isFamilyOwner ||
    profile.userId?.equals?.(user._id) ||
    Boolean(permissionField && membership.permissions?.[permissionField]);

  if (!granted) {
    throw ApiError.forbidden(`You do not have permission to ${capabilityLabel(capability)} for this profile.`);
  }

  return {
    profile,
    membership,
    family,
    isFamilyOwner,
    capabilities: isFamilyOwner
      ? Object.fromEntries(Object.values(CAPABILITIES).map((f) => [f, true]))
      : membership.permissions?.toObject?.() ?? membership.permissions ?? {},
  };
}

function capabilityLabel(capability) {
  const labels = {
    view: 'view records',
    manageMedicines: 'manage medicines',
    markDoses: 'update doses',
    manageStock: 'manage stock',
    manageCarePlans: 'manage care plans',
    manageProfile: 'manage this profile',
  };
  return labels[capability] || capability;
}

/** Assert access to a medicine document via its owning profile. */
export async function resolveMedicineAccess(user, medicine, capability = 'view') {
  if (!medicine) throw ApiError.notFound('Medicine not found.');
  const access = await resolveProfileAccess(user, medicine.profileId, capability);
  return { ...access, medicine };
}

export async function assertFamilyAccess(user, familyId, { ownerOnly = false } = {}) {
  if (!isObjectId(familyId)) throw ApiError.badRequest('Invalid family id.');
  const family = await Family.findById(familyId);
  if (!family) throw ApiError.notFound('Family not found.');

  const isOwner = String(family.ownerId) === String(user._id);

  if (!isOwner) {
    // Non-members get "not found" so family existence is never leaked.
    const membership = await FamilyMember.findOne({
      familyId,
      userId: user._id,
      status: 'active',
    });
    if (!membership) throw ApiError.notFound('Family not found.');
    if (ownerOnly) throw ApiError.forbidden('Only the family owner can do that.');
  }

  return family;
}

export default {
  CAPABILITIES,
  getUserMemberships,
  getUserFamilyIds,
  getDefaultProfile,
  listAccessibleProfiles,
  listAccessibleProfileIds,
  resolveProfileAccess,
  resolveMedicineAccess,
  assertFamilyAccess,
};
