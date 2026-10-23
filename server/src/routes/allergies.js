import express from 'express';
import UserAllergy from '../models/UserAllergy.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendData } from '../utils/http.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { allergySchema } from '../validators/schemas.js';
import { resolveProfileAccess } from '../services/access.js';

const router = express.Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = { userId: req.user._id };
    if (req.query.profileId) {
      await resolveProfileAccess(req.user, req.query.profileId, 'view');
      filter.$or = [{ profileId: req.query.profileId }, { profileId: null }];
    }
    const allergies = await UserAllergy.find(filter).sort({ createdAt: -1 }).lean();
    return sendData(res, allergies, 200, {
      disclaimer:
        'These are allergies you recorded yourself. MediTrack does not diagnose allergies, infer causes of symptoms, or recommend alternative medicines.',
    });
  }),
);

router.post(
  '/',
  validateBody(allergySchema),
  asyncHandler(async (req, res) => {
    const payload = req.body;
    if (payload.profileId) {
      await resolveProfileAccess(req.user, payload.profileId, 'manageProfile');
    }
    const allergy = await UserAllergy.create({
      userId: req.user._id,
      profileId: payload.profileId ?? null,
      allergen: payload.allergen,
      allergenType: payload.allergenType,
      severity: payload.severity,
      reaction: payload.reaction || '',
      notes: payload.notes || '',
    });
    return sendData(res, allergy, 201);
  }),
);

router.patch(
  '/:id',
  validateBody(allergySchema.partial()),
  asyncHandler(async (req, res) => {
    const allergy = await UserAllergy.findOne({ _id: req.params.id, userId: req.user._id });
    if (!allergy) throw ApiError.notFound('Allergy record not found.');
    const { allergen, allergenType, severity, reaction, notes } = req.body;
    if (allergen !== undefined) allergy.allergen = allergen;
    if (allergenType !== undefined) allergy.allergenType = allergenType;
    if (severity !== undefined) allergy.severity = severity;
    if (reaction !== undefined) allergy.reaction = reaction;
    if (notes !== undefined) allergy.notes = notes;
    await allergy.save();
    return sendData(res, allergy);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await UserAllergy.deleteOne({ _id: req.params.id, userId: req.user._id });
    if (!result.deletedCount) throw ApiError.notFound('Allergy record not found.');
    return sendData(res, { success: true });
  }),
);

export default router;
