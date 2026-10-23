import express from 'express';
import mongoose from 'mongoose';
import PrescriptionUpload from '../models/PrescriptionUpload.js';
import PrescriptionDraft from '../models/PrescriptionDraft.js';
import Medicine from '../models/Medicine.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendData, parsePagination } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { publicUpload } from '../utils/serialize.js';
import { resolveProfileAccess } from '../services/access.js';
import { assertAllowedFile, saveFile, deleteFile, readFile } from '../services/storage.js';
import { ocrStatus, extractPrescription, extractPackage } from '../services/ocr.js';
import { generateDoses } from '../services/doses.js';
import { newId } from '../utils/ids.js';
import config from '../config/env.js';

const router = express.Router();
router.use(requireAuth);

const RETENTION_DAYS = 90;

function serializeDraft(draft) {
  if (!draft) return null;
  return {
    id: String(draft._id),
    uploadId: String(draft.uploadId),
    kind: draft.kind,
    status: draft.status,
    items: draft.items,
    packageDetails: draft.packageDetails,
    warnings: draft.warnings,
    providerNote: draft.providerNote,
    confirmedAt: draft.confirmedAt,
    createdMedicineIds: draft.createdMedicineIds?.map(String) ?? [],
    updatedAt: draft.updatedAt,
  };
}

async function loadScan(req, capability = 'manageMedicines') {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw ApiError.badRequest('Invalid scan id.');
  const uploadDoc = await PrescriptionUpload.findById(req.params.id).select('+storage.absolutePath');
  if (!uploadDoc || uploadDoc.status === 'deleted') throw ApiError.notFound('Scan not found.');
  const access = await resolveProfileAccess(req.user, uploadDoc.profileId, capability);
  return { uploadDoc, access };
}

/* -------------------------------- status --------------------------------- */

router.get(
  '/status',
  asyncHandler(async (_req, res) =>
    sendData(res, {
      ...ocrStatus(),
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
      maxUploadMb: Math.round(config.maxUploadBytes / (1024 * 1024)),
    }),
  ),
);

/* -------------------------------- list ----------------------------------- */

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { uploadedByUserId: req.user._id, status: { $ne: 'deleted' } };
    if (req.query.kind) filter.kind = req.query.kind;
    if (req.query.profileId) {
      await resolveProfileAccess(req.user, req.query.profileId, 'view');
      filter.profileId = req.query.profileId;
    }

    const [items, total] = await Promise.all([
      PrescriptionUpload.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PrescriptionUpload.countDocuments(filter),
    ]);

    return sendData(res, items.map(publicUpload), 200, { page, limit, total });
  }),
);

/* ------------------------------- upload ---------------------------------- */

router.post(
  '/upload',
  uploadLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    assertAllowedFile(req.file);
    const { profileId, kind = 'prescription' } = req.body;
    if (!profileId) throw ApiError.badRequest('A profileId is required.');
    if (!['prescription', 'package'].includes(kind)) throw ApiError.badRequest('Invalid scan kind.');

    const { profile } = await resolveProfileAccess(req.user, profileId, 'manageMedicines');

    const stored = await saveFile(req.file.buffer, {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      subdir: kind === 'package' ? 'packages' : 'prescriptions',
    });

    const status = ocrStatus();
    const uploadDoc = await PrescriptionUpload.create({
      familyId: profile.familyId,
      profileId: profile._id,
      uploadedByUserId: req.user._id,
      kind,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      checksum: stored.checksum,
      storage: { driver: stored.driver, key: stored.key, absolutePath: stored.absolutePath },
      status: 'uploaded',
      provider: status.provider,
      providerConfigured: status.configured,
      retention: {
        expiresAt: new Date(Date.now() + RETENTION_DAYS * 86400000),
        keepForever: false,
      },
    });

    return sendData(
      res,
      {
        upload: publicUpload(uploadDoc),
        provider: status,
        next: status.configured
          ? 'Call POST /prescriptions/:id/extract to run extraction.'
          : 'No OCR provider is configured. Create the medicine manually or configure OCR_PROVIDER.',
      },
      201,
    );
  }),
);

/* ------------------------------- extract --------------------------------- */

router.post(
  '/:id/extract',
  uploadLimiter,
  asyncHandler(async (req, res) => {
    const { uploadDoc } = await loadScan(req, 'manageMedicines');
    if (uploadDoc.status === 'deleted') throw ApiError.notFound('Scan not found.');

    const status = ocrStatus();
    const binary = await readFile(uploadDoc.storage);

    uploadDoc.status = 'processing';
    uploadDoc.provider = status.provider;
    uploadDoc.providerConfigured = status.configured;
    uploadDoc.error = '';
    await uploadDoc.save();

    let result;
    if (uploadDoc.kind === 'package') {
      result = await extractPackage({ buffer: binary, mimeType: uploadDoc.mimeType });
    } else {
      result = await extractPrescription({ buffer: binary, mimeType: uploadDoc.mimeType });
    }

    const failed = Boolean(result.failed);
    uploadDoc.status = failed ? 'failed' : result.configured ? 'extracted' : 'uploaded';
    uploadDoc.error = failed ? (result.warnings?.[0] || 'Extraction failed.') : '';
    uploadDoc.extractedAt = result.extractedAt;
    uploadDoc.rawResult = result;
    await uploadDoc.save();

    // Replace any previous draft for this scan.
    await PrescriptionDraft.deleteMany({ uploadId: uploadDoc._id, status: 'draft' });

    const draft = await PrescriptionDraft.create({
      uploadId: uploadDoc._id,
      familyId: uploadDoc.familyId,
      profileId: uploadDoc.profileId,
      createdByUserId: req.user._id,
      kind: uploadDoc.kind,
      items: (result.items || []).map((item) => ({ ...item, tempId: item.tempId || newId() })),
      packageDetails: result.package || undefined,
      warnings: result.warnings || [],
      providerNote: result.simulated
        ? 'Simulated provider output — sample data, not a real reading.'
        : result.configured
          ? `Extracted with ${result.provider}${result.model ? ` (${result.model})` : ''}.`
          : 'No provider configured — extracted nothing. Enter details manually.',
      status: 'draft',
    });

    return sendData(res, {
      upload: publicUpload(uploadDoc),
      draft: serializeDraft(draft),
      requiresReview: true,
      message:
        'Extraction results are candidates only. Review, correct or remove items, then confirm explicitly.',
    });
  }),
);

/* -------------------------------- review --------------------------------- */

router.get(
  '/:id/review',
  asyncHandler(async (req, res) => {
    const { uploadDoc } = await loadScan(req, 'view');
    const draft = await PrescriptionDraft.findOne({ uploadId: uploadDoc._id }).sort({ createdAt: -1 });
    return sendData(res, {
      upload: publicUpload(uploadDoc),
      draft: serializeDraft(draft),
    });
  }),
);

/**
 * Save the user's edits to the draft. Accepts the full reviewed item list.
 * Nothing is created until POST /:id/confirm.
 */
router.patch(
  '/:id/review',
  asyncHandler(async (req, res) => {
    const { uploadDoc } = await loadScan(req, 'manageMedicines');
    const draft = await PrescriptionDraft.findOne({ uploadId: uploadDoc._id, status: 'draft' });
    if (!draft) throw ApiError.notFound('There is no draft to review for this scan.');
    if (draft.status === 'confirmed') throw ApiError.conflict('This scan has already been confirmed.');

    const { items, packageDetails } = req.body || {};

    if (Array.isArray(items)) {
      const allowedForms = [
        'tablet', 'capsule', 'syrup', 'suspension', 'drops', 'injection',
        'inhaler', 'cream', 'ointment', 'spray', 'powder', 'sachet', 'other',
      ];
      draft.items = items.map((item) => ({
        tempId: item.tempId || newId(),
        name: String(item.name || '').slice(0, 200),
        strength: String(item.strength || '').slice(0, 60),
        unit: String(item.unit || 'mg').slice(0, 30),
        form: allowedForms.includes(item.form) ? item.form : 'tablet',
        instructions: String(item.instructions || '').slice(0, 1000),
        quantity: Number.isFinite(item.quantity) ? Math.max(0, item.quantity) : 1,
        times: (item.times || []).filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)).slice(0, 12),
        scheduleType: item.scheduleType || 'daily',
        durationDays: Number.isFinite(item.durationDays) ? item.durationDays : null,
        stockQuantity: Number.isFinite(item.stockQuantity) ? Math.max(0, item.stockQuantity) : 0,
        stockUnit: String(item.stockUnit || 'tablets').slice(0, 30),
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        batchNumber: String(item.batchNumber || '').slice(0, 80),
        manufacturer: String(item.manufacturer || '').slice(0, 160),
        confidence: item.confidence,
        uncertain: item.uncertain !== false,
        sourceText: item.sourceText || '',
        accepted: Boolean(item.accepted),
        medicineId: item.medicineId || null,
      }));
    }

    if (packageDetails && typeof packageDetails === 'object') {
      draft.packageDetails = {
        name: String(packageDetails.name || '').slice(0, 200),
        strength: String(packageDetails.strength || '').slice(0, 60),
        composition: String(packageDetails.composition || '').slice(0, 500),
        manufacturingDate: packageDetails.manufacturingDate ? new Date(packageDetails.manufacturingDate) : null,
        expiryDate: packageDetails.expiryDate ? new Date(packageDetails.expiryDate) : null,
        batchNumber: String(packageDetails.batchNumber || '').slice(0, 80),
        manufacturer: String(packageDetails.manufacturer || '').slice(0, 160),
      };
    }

    await draft.save();
    return sendData(res, { draft: serializeDraft(draft) });
  }),
);

/* ------------------------------- confirm --------------------------------- */

/**
 * Explicitly confirm the reviewed scan and create medicines.
 * Requires at least one accepted item with a name (or a package name).
 */
router.post(
  '/:id/confirm',
  asyncHandler(async (req, res) => {
    const { uploadDoc, access } = await loadScan(req, 'manageMedicines');
    void access;
    const draft = await PrescriptionDraft.findOne({ uploadId: uploadDoc._id }).sort({ createdAt: -1 });
    if (!draft) throw ApiError.notFound('There is nothing to confirm for this scan.');
    if (draft.status === 'confirmed') throw ApiError.conflict('This scan has already been confirmed.');

    const accepted =
      draft.kind === 'package'
        ? draft.packageDetails?.name
          ? [draft.packageDetails]
          : []
        : (draft.items || []).filter((i) => i.accepted && i.name?.trim());

    if (!accepted.length) {
      throw ApiError.badRequest(
        'Select at least one extracted item with a medicine name before confirming.',
      );
    }

    const created = [];
    const skipped = [];

    for (const raw of accepted) {
      const isPackage = draft.kind === 'package';
      const name = String(raw.name || '').trim();
      if (!name) continue;

      const times = isPackage ? [] : raw.times || [];
      const durationDays = isPackage ? null : raw.durationDays;
      const startDate = new Date();
      const endDate = durationDays ? new Date(Date.now() + durationDays * 86400000) : null;

      const medicine = await Medicine.create({
        familyId: uploadDoc.familyId,
        profileId: uploadDoc.profileId,
        createdByUserId: req.user._id,
        name,
        strength: raw.strength || '',
        unit: raw.unit || 'mg',
        form: raw.form || (isPackage ? 'other' : 'tablet'),
        instructions: raw.instructions || '',
        source: isPackage ? 'package-scan' : 'prescription-scan',
        prescriptionUploadId: uploadDoc._id,
        schedule: {
          type: isPackage ? 'as-needed' : raw.scheduleType || 'daily',
          times,
          doseQuantity: raw.quantity || 1,
        },
        startDate,
        endDate,
        stock: {
          quantity: isPackage ? 0 : raw.stockQuantity || 0,
          unit: raw.stockUnit || 'tablets',
          lowStockThreshold: 5,
        },
        expiryDate: isPackage ? draft.packageDetails.expiryDate : raw.expiryDate || null,
        manufacturer: raw.manufacturer || draft.packageDetails?.manufacturer || '',
        batchNumber: raw.batchNumber || draft.packageDetails?.batchNumber || '',
        status: 'active',
      });

      if (isPackage) {
        draft.items.push({
          tempId: newId(),
          name,
          strength: raw.strength || '',
          unit: raw.unit || 'mg',
          form: 'other',
          accepted: true,
          medicineId: medicine._id,
          confidence: 1,
          uncertain: false,
        });
      } else {
        const item = draft.items.find((i) => i.tempId === raw.tempId);
        if (item) item.medicineId = medicine._id;
        else skipped.push(name);
      }

      created.push({ id: String(medicine._id), name: medicine.name });
    }

    draft.status = 'confirmed';
    draft.confirmedAt = new Date();
    draft.confirmedByUserId = req.user._id;
    draft.createdMedicineIds = created.map((c) => c.id);
    await draft.save();

    uploadDoc.status = 'confirmed';
    await uploadDoc.save();

    try {
      await generateDoses({
        profileIds: [uploadDoc.profileId],
        timeZone: req.user.timezone || 'UTC',
        days: 14,
      });
    } catch {
      // Scheduler will backfill.
    }

    return sendData(
      res,
      {
        upload: publicUpload(uploadDoc),
        draft: serializeDraft(draft),
        createdMedicines: created,
        note: 'Confirmed by the user. Dose schedules are now active and can be edited from the medicine page.',
      },
      201,
    );
  }),
);

/* -------------------------------- delete --------------------------------- */

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { uploadDoc } = await loadScan(req, 'manageMedicines');

    if (req.query.purge === 'true') {
      await deleteFile(uploadDoc.storage);
      await PrescriptionDraft.deleteMany({ uploadId: uploadDoc._id });
      await PrescriptionUpload.deleteOne({ _id: uploadDoc._id });
      return sendData(res, { success: true, purged: true });
    }

    // Soft delete: keep the record for audit but remove the binary.
    await deleteFile(uploadDoc.storage);
    uploadDoc.status = 'deleted';
    uploadDoc.deletedAt = new Date();
    uploadDoc.storage = { ...uploadDoc.storage.toObject?.() ?? uploadDoc.storage, absolutePath: '' };
    await uploadDoc.save();
    return sendData(res, { success: true, purged: false });
  }),
);

/* ------------------------------ view image -------------------------------- */

/** Serve the private image to authorised users only. */
router.get(
  '/:id/file',
  asyncHandler(async (req, res) => {
    const { uploadDoc } = await loadScan(req, 'view');
    if (uploadDoc.status === 'deleted') throw ApiError.notFound('This image has been deleted.');
    const binary = await readFile(uploadDoc.storage);
    res.setHeader('Content-Type', uploadDoc.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('Content-Disposition', 'inline');
    return res.send(binary);
  }),
);

export default router;
