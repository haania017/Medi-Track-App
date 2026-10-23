import express from 'express';
import Medicine from '../models/Medicine.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendData } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveMedicineAccess } from '../services/access.js';
import { medicineInfoStatus, lookupMedicineInfo, matchAllergies } from '../services/medicineInfo.js';
import { CATALOG_META, searchMedicineCatalog } from '../data/medicineCatalog.js';

const router = express.Router();
router.use(requireAuth);

router.get(
  '/status',
  asyncHandler(async (_req, res) => sendData(res, medicineInfoStatus())),
);

/**
 * Autocomplete against the small curated reference sample.
 * Suggestions are candidates only — the user still chooses (or types their own).
 */
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').slice(0, 120);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 8, 1), 20);
    const results = q.trim() ? searchMedicineCatalog(q, limit) : [];
    return sendData(res, results, 200, {
      query: q,
      count: results.length,
      catalog: CATALOG_META,
      note:
        'Suggestions come from a limited reference sample, not a complete list of registered medicines. Check the package or prescription before saving.',
    });
  }),
);

/**
 * Contextual medicine information for a single medicine.
 * Reached only from a medicine detail page — never rendered on the dashboard.
 */
router.get(
  '/:medicineId',
  asyncHandler(async (req, res) => {
    const medicine = await Medicine.findById(req.params.medicineId);
    const { profile } = await resolveMedicineAccess(req.user, medicine, 'view');

    const info = await lookupMedicineInfo({
      name: medicine.name,
      strength: medicine.strength,
      force: req.query.force === 'true',
    });

    const allergyMatches = await matchAllergies({
      userId: req.user._id,
      profileId: profile._id,
      info,
    });

    return sendData(res, {
      medicine: {
        id: String(medicine._id),
        name: medicine.name,
        strength: medicine.strength,
        unit: medicine.unit,
        form: medicine.form,
        manufacturer: medicine.manufacturer,
        batchNumber: medicine.batchNumber,
        expiryDate: medicine.expiryDate,
      },
      info,
      allergyMatches,
      // Explicit product boundaries, surfaced in the UI next to the data.
      disclaimers: {
        notDiagnosis:
          'This information is reference material from the source shown above. MediTrack does not diagnose conditions, prescribe treatment, or recommend alternative medicines.',
        allergyMatchIsNotDiagnosis:
          'An allergy match means the ingredients overlap with something you recorded yourself. It is not a diagnosis.',
        consultProfessional:
          'Always check with a pharmacist or qualified healthcare professional about your medicines.',
        expiredMedicines:
          'Do not assume an expired medicine is safe to use. Ask a pharmacist how to dispose of it properly.',
      },
    });
  }),
);

export default router;
