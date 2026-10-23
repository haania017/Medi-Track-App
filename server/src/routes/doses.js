import express from 'express';
import DoseLog from '../models/DoseLog.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendData, parsePagination } from '../utils/http.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { doseActionSchema, snoozeSchema, listDosesQuery } from '../validators/schemas.js';
import { listAccessibleProfileIds, resolveProfileAccess } from '../services/access.js';
import {
  generateDosesForUser,
  getDoses,
  getTodayView,
  markDoseTaken,
  markDoseSkipped,
  snoozeDose,
} from '../services/doses.js';
import { localDateString } from '../utils/timezone.js';

const router = express.Router();
router.use(requireAuth);

async function resolveProfileScope(req) {
  if (req.query.profileId || req.body?.profileId) {
    const id = req.query.profileId || req.body.profileId;
    await resolveProfileAccess(req.user, id, 'view');
    return [id];
  }
  return listAccessibleProfileIds(req.user._id);
}

/**
 * Today's doses across every accessible profile, with a status summary.
 * Doses are materialised on demand so the view is always current.
 */
router.get(
  '/today',
  asyncHandler(async (req, res) => {
    const timeZone = req.user.timezone || 'UTC';
    await generateDosesForUser(req.user, { days: 2 });

    const profileIds = await resolveProfileScope(req);
    const view = await getTodayView({
      user: req.user,
      profileIds,
      timeZone,
      dateStr: req.query.date,
    });

    return sendData(res, view);
  }),
);

router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const result = await generateDosesForUser(req.user, { days: Number.parseInt(req.body?.days, 10) || 7 });
    return sendData(res, result);
  }),
);

router.get(
  '/',
  validateQuery(listDosesQuery),
  asyncHandler(async (req, res) => {
    const { from, to, date, status, medicineId } = req.query;
    const { page, limit } = parsePagination(req.query, { defaultLimit: 100, maxLimit: 500 });
    const profileIds = await resolveProfileScope(req);
    const timeZone = req.user.timezone || 'UTC';

    let fromInstant;
    let toInstant;
    if (date) {
      fromInstant = new Date(`${date}T00:00:00.000Z`);
      toInstant = new Date(`${date}T23:59:59.999Z`);
    } else {
      if (from) fromInstant = new Date(from);
      if (to) toInstant = new Date(to);
    }
    void timeZone;

    const items = await getDoses({
      profileIds,
      from: fromInstant,
      to: toInstant,
      statuses: status ? String(status).split(',') : undefined,
      medicineId,
      limit: page * limit,
    });

    const paged = items.slice((page - 1) * limit, page * limit);
    return sendData(res, paged, 200, { page, limit, returned: paged.length, total: items.length });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const dose = await DoseLog.findById(req.params.id)
      .populate('medicineId', 'name strength unit form status instructions')
      .populate('profileId', 'name color relationship memberType')
      .lean();
    if (!dose) throw ApiError.notFound('Dose not found.');
    await resolveProfileAccess(req.user, dose.profileId, 'view');
    return sendData(res, dose);
  }),
);

router.post(
  '/:id/mark-taken',
  validateBody(doseActionSchema),
  asyncHandler(async (req, res) => {
    const result = await markDoseTaken({
      user: req.user,
      doseId: req.params.id,
      note: req.body.note || '',
    });
    return sendData(res, {
      dose: result.dose,
      alreadyProcessed: result.alreadyProcessed,
      stockChanged: result.stockChanged,
      medicine: result.medicine?.toJSON?.() ?? null,
    });
  }),
);

router.post(
  '/:id/mark-skipped',
  validateBody(doseActionSchema),
  asyncHandler(async (req, res) => {
    const result = await markDoseSkipped({
      user: req.user,
      doseId: req.params.id,
      note: req.body.note || '',
    });
    return sendData(res, result);
  }),
);

router.post(
  '/:id/snooze',
  validateBody(snoozeSchema),
  asyncHandler(async (req, res) => {
    const result = await snoozeDose({
      user: req.user,
      doseId: req.params.id,
      minutes: req.body.minutes,
    });
    return sendData(res, result);
  }),
);

/** Server-side "now" so clients never rely on a skewed device clock. */
router.get(
  '/meta/clock',
  asyncHandler(async (req, res) =>
    sendData(res, {
      now: new Date().toISOString(),
      timezone: req.user.timezone || 'UTC',
      localDate: localDateString(new Date(), req.user.timezone || 'UTC'),
    }),
  ),
);

export default router;
