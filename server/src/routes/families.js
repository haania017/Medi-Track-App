import express from 'express';
import Family from '../models/Family.js';
import FamilyMember from '../models/FamilyMember.js';
import Medicine from '../models/Medicine.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendData } from '../utils/http.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { publicProfile } from '../utils/serialize.js';
import {
  createFamilySchema,
  createMemberSchema,
  updateMemberSchema,
  updatePermissionsSchema,
} from '../validators/schemas.js';
import { assertFamilyAccess, resolveProfileAccess, listAccessibleProfiles } from '../services/access.js';
import { MEMBER_COLORS } from '../services/bootstrap.js';

/* Mounted at /families */
export const familiesRouter = express.Router();
/* Mounted at /family-members */
export const familyMembersRouter = express.Router();

familiesRouter.use(requireAuth);
familyMembersRouter.use(requireAuth);

/* ------------------------------- families --------------------------------- */

familiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const memberships = await FamilyMember.find({ userId: req.user._id, status: 'active' }).lean();
    const familyIds = [...new Set(memberships.map((m) => String(m.familyId)))];
    const families = await Family.find({ _id: { $in: familyIds } }).lean();
    return sendData(
      res,
      families.map((f) => ({
        id: String(f._id),
        name: f.name,
        ownerId: String(f.ownerId),
        isOwner: String(f.ownerId) === String(req.user._id),
      })),
    );
  }),
);

familiesRouter.post(
  '/',
  validateBody(createFamilySchema),
  asyncHandler(async (req, res) => {
    const family = await Family.create({ name: req.body.name, ownerId: req.user._id });
    await FamilyMember.create({
      familyId: family._id,
      userId: req.user._id,
      memberType: 'owner',
      name: req.user.name,
      relationship: 'Self',
      color: MEMBER_COLORS[0],
      status: 'active',
      consent: { grantedByUserId: req.user._id, grantedAt: new Date() },
    });
    return sendData(
      res,
      { id: String(family._id), name: family.name, ownerId: String(family.ownerId) },
      201,
    );
  }),
);

familiesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const family = await assertFamilyAccess(req.user, req.params.id);
    const members = await FamilyMember.find({ familyId: family._id, status: { $ne: 'revoked' } })
      .sort({ memberType: 1, createdAt: 1 })
      .lean();
    const counts = await Medicine.aggregate([
      { $match: { familyId: family._id, status: { $in: ['active', 'paused'] } } },
      { $group: { _id: '$profileId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    return sendData(res, {
      id: String(family._id),
      name: family.name,
      ownerId: String(family.ownerId),
      isOwner: String(family.ownerId) === String(req.user._id),
      members: members.map((m) => ({
        ...publicProfile(m),
        activeMedicineCount: countMap.get(String(m._id)) || 0,
      })),
    });
  }),
);

familiesRouter.post(
  '/:id/members',
  validateBody(createMemberSchema),
  asyncHandler(async (req, res) => {
    const family = await assertFamilyAccess(req.user, req.params.id, { ownerOnly: true });
    const { name, relationship, memberType = 'managed', color, dateOfBirth, notes, invitedEmail } = req.body;

    if (memberType === 'owner') throw ApiError.badRequest('A family has exactly one owner account.');

    if (memberType === 'adult') {
      if (!invitedEmail) {
        throw ApiError.badRequest('An email address is required to connect an adult account.');
      }
      const existing = await FamilyMember.findOne({
        familyId: family._id,
        invitedEmail,
        status: { $in: ['invited', 'active'] },
      });
      if (existing) throw ApiError.conflict('That person has already been invited to this family.');

      const member = await FamilyMember.create({
        familyId: family._id,
        memberType: 'adult',
        name,
        relationship: relationship || 'Family member',
        color: color || MEMBER_COLORS[1],
        invitedEmail,
        status: 'invited',
        // Adults start with read-only access until the owner grants more.
        permissions: { viewRecords: true },
      });
      return sendData(res, publicProfile(member), 201);
    }

    // Managed profile (e.g. a child) — no separate login required.
    const member = await FamilyMember.create({
      familyId: family._id,
      memberType: 'managed',
      name,
      relationship: relationship || 'Child',
      color: color || MEMBER_COLORS[2],
      dateOfBirth,
      notes,
      status: 'active',
      consent: { grantedByUserId: req.user._id, grantedAt: new Date() },
    });
    return sendData(res, publicProfile(member), 201);
  }),
);

/* ---------------------------- family members ------------------------------ */

familyMembersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const profiles = await listAccessibleProfiles(req.user._id);
    return sendData(res, profiles.map(publicProfile));
  }),
);

familyMembersRouter.get(
  '/invitations',
  asyncHandler(async (req, res) => {
    const invites = await FamilyMember.find({
      invitedEmail: req.user.email,
      status: 'invited',
      userId: null,
    }).lean();
    const families = await Family.find({ _id: { $in: invites.map((i) => i.familyId) } }).lean();
    const nameMap = new Map(families.map((f) => [String(f._id), f.name]));

    return sendData(
      res,
      invites.map((i) => ({
        id: String(i._id),
        familyId: String(i.familyId),
        familyName: nameMap.get(String(i.familyId)) || 'Family',
        invitedAs: i.relationship,
        permissions: i.permissions,
      })),
    );
  }),
);

/** Accept an invitation as a connected adult — requires explicit consent. */
familyMembersRouter.post(
  '/:id/accept',
  asyncHandler(async (req, res) => {
    const member = await FamilyMember.findById(req.params.id);
    if (!member || member.status !== 'invited' || member.invitedEmail !== req.user.email) {
      throw ApiError.notFound('Invitation not found.');
    }
    member.userId = req.user._id;
    member.status = 'active';
    member.consent = { grantedByUserId: req.user._id, grantedAt: new Date() };
    await member.save();
    return sendData(res, publicProfile(member));
  }),
);

familyMembersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { profile } = await resolveProfileAccess(req.user, req.params.id, 'view');
    const medicines = await Medicine.countDocuments({
      profileId: profile._id,
      status: { $in: ['active', 'paused'] },
    });
    return sendData(res, { ...publicProfile(profile), activeMedicineCount: medicines });
  }),
);

familyMembersRouter.patch(
  '/:id',
  validateBody(updateMemberSchema),
  asyncHandler(async (req, res) => {
    const { profile } = await resolveProfileAccess(req.user, req.params.id, 'manageProfile');
    const updates = req.body;

    if (profile.memberType === 'owner' && updates.status && updates.status !== 'active') {
      throw ApiError.badRequest('The owner profile cannot be deactivated.');
    }

    Object.assign(profile, updates);
    if (updates.status === 'revoked') {
      profile.consent = {
        ...(profile.consent?.toObject?.() ?? profile.consent),
        revokedAt: new Date(),
      };
    }
    await profile.save();
    return sendData(res, publicProfile(profile));
  }),
);

familyMembersRouter.patch(
  '/:id/permissions',
  validateBody(updatePermissionsSchema),
  asyncHandler(async (req, res) => {
    const member = await FamilyMember.findById(req.params.id);
    if (!member) throw ApiError.notFound('Profile not found.');

    // Only the family owner may change another member's permissions.
    const family = await Family.findById(member.familyId);
    if (String(family.ownerId) !== String(req.user._id)) {
      throw ApiError.forbidden('Only the family owner can change member permissions.');
    }
    if (member.memberType === 'owner') {
      throw ApiError.badRequest('The owner always has full access.');
    }

    member.permissions = { ...(member.permissions.toObject?.() ?? member.permissions), ...req.body };
    await member.save();
    return sendData(res, publicProfile(member));
  }),
);

/** Revoke connected access (owner) or leave a family (self). */
familyMembersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const member = await FamilyMember.findById(req.params.id);
    if (!member) throw ApiError.notFound('Profile not found.');

    const family = await Family.findById(member.familyId);
    const isOwnerOfFamily = String(family.ownerId) === String(req.user._id);
    const isSelf = member.userId && String(member.userId) === String(req.user._id);

    if (!isOwnerOfFamily && !isSelf) throw ApiError.forbidden('You cannot remove this profile.');
    if (member.memberType === 'owner') throw ApiError.badRequest('The owner profile cannot be removed.');

    if (isOwnerOfFamily) {
      // Removing a profile takes its medicines with it; ledger history remains
      // queryable by medicine id until that medicine row is gone.
      await Medicine.deleteMany({ profileId: member._id });
      await FamilyMember.deleteOne({ _id: member._id });
      return sendData(res, { success: true, deleted: true });
    }

    member.userId = null;
    member.status = 'revoked';
    member.consent = {
      ...(member.consent?.toObject?.() ?? member.consent),
      revokedAt: new Date(),
    };
    await member.save();
    return sendData(res, { success: true, revoked: true });
  }),
);
