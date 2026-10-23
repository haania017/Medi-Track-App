import express from 'express';
import CarePlan from '../models/CarePlan.js';
import Medicine from '../models/Medicine.js';
import DoseLog from '../models/DoseLog.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendData } from '../utils/http.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  createCarePlanSchema,
  updateCarePlanSchema,
  carePlanReviewSchema,
} from '../validators/schemas.js';
import { listAccessibleProfileIds, resolveProfileAccess } from '../services/access.js';

const router = express.Router();
router.use(requireAuth);

async function loadPlanForUser(req, capability) {
  const plan = await CarePlan.findById(req.params.id);
  if (!plan) throw ApiError.notFound('Care plan not found.');
  const access = await resolveProfileAccess(req.user, plan.profileId, capability);
  return { plan, access };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const profileIds = await listAccessibleProfileIds(req.user._id);
    const filter = { profileId: profileIds };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.profileId) filter.profileId = req.query.profileId;

    const plans = await CarePlan.find(filter)
      .sort({ reviewDate: 1 })
      .populate('profileId', 'name color relationship')
      .populate('medicineIds', 'name strength status')
      .lean();
    return sendData(res, plans);
  }),
);

router.post(
  '/',
  validateBody(createCarePlanSchema),
  asyncHandler(async (req, res) => {
    const payload = req.body;
    if (payload.reviewDate < payload.startDate) {
      throw ApiError.badRequest('The review date must be on or after the start date.');
    }
    const { profile } = await resolveProfileAccess(req.user, payload.profileId, 'manageCarePlans');

    // Only medicines belonging to the same profile may be linked.
    let medicineIds = [];
    if (payload.medicineIds?.length) {
      const owned = await Medicine.find({
        _id: { $in: payload.medicineIds },
        profileId: profile._id,
      }).select('_id');
      if (owned.length !== payload.medicineIds.length) {
        throw ApiError.badRequest('One or more medicines do not belong to this profile.');
      }
      medicineIds = owned.map((m) => m._id);
    }

    const plan = await CarePlan.create({
      familyId: profile.familyId,
      profileId: profile._id,
      createdByUserId: req.user._id,
      title: payload.title,
      purpose: payload.purpose || '',
      startDate: payload.startDate,
      reviewDate: payload.reviewDate,
      medicineIds,
      notes: payload.notes || '',
      history: [{ action: 'created', byUserId: req.user._id }],
    });

    return sendData(res, plan.toJSON(), 201);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { plan } = await loadPlanForUser(req, 'view');
    const medicines = await Medicine.find({ _id: { $in: plan.medicineIds } })
      .populate('profileId', 'name color')
      .lean();
    return sendData(res, { plan: plan.toJSON(), medicines });
  }),
);

router.patch(
  '/:id',
  validateBody(updateCarePlanSchema),
  asyncHandler(async (req, res) => {
    const { plan } = await loadPlanForUser(req, 'manageCarePlans');
    if (['completed', 'cancelled'].includes(plan.status) && req.body.status && req.body.status !== plan.status) {
      throw ApiError.conflict('A closed care plan cannot be reopened. Create a new care plan instead.');
    }
    Object.assign(plan, req.body);
    plan.history.push({ action: 'updated', byUserId: req.user._id });
    await plan.save();
    return sendData(res, plan.toJSON());
  }),
);

/**
 * Answer the review prompt. "continue" extends the plan; "complete" closes it.
 * Closing pauses the linked medicines' future reminders but keeps every record.
 */
router.post(
  '/:id/review',
  validateBody(carePlanReviewSchema),
  asyncHandler(async (req, res) => {
    const { plan } = await loadPlanForUser(req, 'manageCarePlans');
    const { decision, outcome, extendedReviewDate } = req.body;

    if (['completed', 'cancelled'].includes(plan.status)) {
      throw ApiError.conflict('This care plan is already closed.');
    }

    if (decision === 'continue') {
      const previous = plan.reviewDate;
      const nextReview =
        extendedReviewDate || new Date(Date.now() + 7 * 86400000);
      if (nextReview <= new Date()) {
        throw ApiError.badRequest('The new review date must be in the future.');
      }
      plan.reviewDate = nextReview;
      plan.status = 'active';
      plan.lastReviewedAt = new Date();
      plan.reviewRequestedCount = 0;
      plan.history.push({
        action: 'continued',
        byUserId: req.user._id,
        note: outcome || '',
        previousReviewDate: previous,
        newReviewDate: nextReview,
      });
      await plan.save();
      return sendData(res, plan.toJSON());
    }

    plan.status = 'completed';
    plan.endDate = new Date();
    plan.lastReviewedAt = new Date();
    plan.outcome = outcome || '';
    plan.closedByUserId = req.user._id;
    plan.history.push({ action: 'completed', byUserId: req.user._id, note: outcome || '' });
    await plan.save();

    // Stop future reminders for linked medicines, preserving all history.
    const medicines = await Medicine.find({ _id: { $in: plan.medicineIds }, status: 'active' });
    for (const medicine of medicines) {
      medicine.status = 'paused';
      await medicine.save();
      await DoseLog.deleteMany({
        medicineId: medicine._id,
        status: 'pending',
        scheduledFor: { $gte: new Date() },
      });
    }

    return sendData(res, {
      plan: plan.toJSON(),
      pausedMedicines: medicines.map((m) => ({ id: String(m._id), name: m.name })),
      note: 'Dose history and medicine records were preserved. The profile itself was not deleted.',
    });
  }),
);

router.post(
  '/:id/close',
  asyncHandler(async (req, res) => {
    const { plan } = await loadPlanForUser(req, 'manageCarePlans');
    if (['completed', 'cancelled'].includes(plan.status)) {
      throw ApiError.conflict('This care plan is already closed.');
    }
    plan.status = 'cancelled';
    plan.endDate = new Date();
    plan.closedByUserId = req.user._id;
    plan.history.push({ action: 'cancelled', byUserId: req.user._id, note: req.body?.reason || '' });
    await plan.save();

    const medicines = await Medicine.find({ _id: { $in: plan.medicineIds }, status: 'active' });
    for (const medicine of medicines) {
      medicine.status = 'paused';
      await medicine.save();
      await DoseLog.deleteMany({
        medicineId: medicine._id,
        status: 'pending',
        scheduledFor: { $gte: new Date() },
      });
    }

    return sendData(res, plan.toJSON());
  }),
);

export default router;
