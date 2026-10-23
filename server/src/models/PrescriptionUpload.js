import mongoose from 'mongoose';

export const UPLOAD_STATUSES = [
  'uploaded',
  'processing',
  'extracted',
  'failed',
  'confirmed',
  'deleted',
];

const prescriptionUploadSchema = new mongoose.Schema(
  {
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
      index: true,
    },
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FamilyMember',
      required: true,
      index: true,
    },
    uploadedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    kind: { type: String, enum: ['prescription', 'package'], default: 'prescription' },
    originalName: { type: String, required: true, maxlength: 260 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
    checksum: { type: String, default: '' },

    // Private storage reference. Never expose the raw key to unauthorised users.
    storage: {
      driver: { type: String, enum: ['local', 's3'], default: 'local' },
      key: { type: String, required: true },
      // Only used by the local driver; not serialised to clients.
      absolutePath: { type: String, default: '', select: false },
    },

    status: { type: String, enum: UPLOAD_STATUSES, default: 'uploaded', index: true },
    provider: { type: String, default: '' },
    providerConfigured: { type: Boolean, default: false },
    error: { type: String, default: '' },
    extractedAt: Date,
    rawResult: { type: mongoose.Schema.Types.Mixed, default: null },

    retention: {
      // Auto-purge the binary after this date unless the user keeps it.
      expiresAt: Date,
      keepForever: { type: Boolean, default: false },
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform(_d, ret) { delete ret.__v; delete ret.rawResult; return ret; } },
  },
);

prescriptionUploadSchema.index({ profileId: 1, createdAt: -1 });

export const PrescriptionUpload =
  mongoose.models.PrescriptionUpload || mongoose.model('PrescriptionUpload', prescriptionUploadSchema);

export default PrescriptionUpload;
