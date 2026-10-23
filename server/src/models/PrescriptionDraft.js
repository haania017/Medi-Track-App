import mongoose from 'mongoose';

export const DRAFT_STATUSES = ['draft', 'confirmed', 'discarded', 'failed'];

const draftItemSchema = new mongoose.Schema(
  {
    tempId: { type: String, required: true },
    name: { type: String, default: '', maxlength: 200 },
    strength: { type: String, default: '', maxlength: 60 },
    unit: { type: String, default: 'mg', maxlength: 30 },
    form: { type: String, default: 'tablet' },
    instructions: { type: String, default: '', maxlength: 1000 },
    quantity: { type: Number, min: 0, default: 1 },
    times: { type: [String], default: [] },
    scheduleType: { type: String, default: 'daily' },
    durationDays: { type: Number, min: 0, default: null },
    stockQuantity: { type: Number, min: 0, default: 0 },
    stockUnit: { type: String, default: 'tablets' },
    expiryDate: { type: Date, default: null },
    batchNumber: { type: String, default: '' },
    manufacturer: { type: String, default: '' },
    // Confidence/uncertainty surfaced to the user, never auto-accepted.
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    uncertain: { type: Boolean, default: true },
    sourceText: { type: String, default: '' },
    accepted: { type: Boolean, default: false },
    // Set after confirmation links the item to a created Medicine.
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null },
  },
  { _id: false },
);

const prescriptionDraftSchema = new mongoose.Schema(
  {
    uploadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PrescriptionUpload',
      required: true,
      index: true,
    },
    familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true, index: true },
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', required: true, index: true },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    kind: { type: String, enum: ['prescription', 'package'], default: 'prescription' },
    items: { type: [draftItemSchema], default: [] },
    packageDetails: {
      name: { type: String, default: '' },
      strength: { type: String, default: '' },
      composition: { type: String, default: '' },
      manufacturingDate: { type: Date, default: null },
      expiryDate: { type: Date, default: null },
      batchNumber: { type: String, default: '' },
      manufacturer: { type: String, default: '' },
    },
    warnings: { type: [String], default: [] },
    status: { type: String, enum: DRAFT_STATUSES, default: 'draft', index: true },
    confirmedAt: Date,
    confirmedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdMedicineIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' }], default: [] },
    providerNote: { type: String, default: '' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform(_d, ret) { delete ret.__v; return ret; } },
  },
);

export const PrescriptionDraft =
  mongoose.models.PrescriptionDraft || mongoose.model('PrescriptionDraft', prescriptionDraftSchema);

export default PrescriptionDraft;
