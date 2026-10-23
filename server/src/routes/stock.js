import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { sendData } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';
import { listAccessibleProfileIds, resolveProfileAccess } from '../services/access.js';
import { getStockSummary } from '../services/stock.js';

const router = express.Router();
router.use(requireAuth);

/** Stock overview across every accessible profile (or one profile). */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    let profileIds;
    if (req.query.profileId) {
      await resolveProfileAccess(req.user, req.query.profileId, 'view');
      profileIds = [req.query.profileId];
    } else {
      profileIds = await listAccessibleProfileIds(req.user._id);
    }
    const summary = await getStockSummary(profileIds);
    return sendData(res, summary);
  }),
);

export default router;
