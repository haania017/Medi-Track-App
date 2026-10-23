import User from '../models/User.js';
import FamilyMember from '../models/FamilyMember.js';

export function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    timezone: user.timezone,
    locale: user.locale,
    appearance: user.appearance,
    notificationPreferences: user.notificationPreferences,
    pushEnabled: Boolean(user.pushSubscriptions?.length),
    createdAt: user.createdAt,
  };
}

export function publicProfile(member) {
  return {
    id: String(member._id),
    familyId: String(member.familyId),
    userId: member.userId ? String(member.userId) : null,
    name: member.name,
    relationship: member.relationship,
    memberType: member.memberType,
    color: member.color,
    status: member.status,
    permissions: member.permissions,
    sharePreferences: member.sharePreferences,
    dateOfBirth: member.dateOfBirth,
    isManaged: member.memberType === 'managed',
  };
}

export function publicUpload(upload) {
  return {
    id: String(upload._id),
    kind: upload.kind,
    originalName: upload.originalName,
    mimeType: upload.mimeType,
    size: upload.size,
    status: upload.status,
    provider: upload.provider,
    providerConfigured: upload.providerConfigured,
    error: upload.error,
    profileId: String(upload.profileId),
    extractedAt: upload.extractedAt,
    createdAt: upload.createdAt,
    retention: upload.retention,
  };
}

export async function loadProfileMap(profileIds) {
  const members = await FamilyMember.find({ _id: { $in: profileIds } }).lean();
  return new Map(members.map((m) => [String(m._id), m]));
}

export default { publicUser, publicProfile, publicUpload, loadProfileMap, User };
