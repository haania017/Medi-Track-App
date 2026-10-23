import mongoose from 'mongoose';

export const MEDICINE_FORMS = [
  'tablet',
  'capsule',
  'syrup',
  'suspension',
  'drops',
  'injection',
  'inhaler',
  'cream',
  'ointment',
  'spray',
  'powder',
  'sachet',
  'other',
];

export const MEDICINE_STATUSES = ['active', 'paused', 'finished', 'archived'];

/**
 * Schedule definition. Times are stored as "HH:mm" local-to-profile strings and
 * expanded to concrete dose instants using the owning user's timezone.
 */
const scheduleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['daily', 'weekdays', 'interval', 'specific-dates', 'as-needed'],
      default: 'daily',
    },
    times: {
      type: [{ type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ }],
      default: [],
    },
    // 0=Sunday .. 6=Saturday, used by `weekdays`
    weekdays: { type: [{ type: Number, min: 0, max: 6 }], default: [] },
    // Whole-day interval used by `interval` (e.g. every 2 days)
    intervalDays: { type: Number, min: 1, default: 1 },
    anchorDate: Date,
    // ISO dates ("YYYY-MM-DD") used by `specific-dates`
    specificDates: { type: [String], default: [] },
    doseQuantity: { type: Number, min: 0, default: 1 },
  },
  { _id: false },
);

const medicineSchema = new mongoose.Schema(
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
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true, maxlength: 200 },
    strength: { type: String, trim: true, maxlength: 60, default: '' },
    unit: { type: String, trim: true, maxlength: 30, default: 'mg' },
    form: { type: String, enum: MEDICINE_FORMS, default: 'tablet' },
    instructions: { type: String, maxlength: 1000, default: '' },
    // Where the medicine details came from — never treated as a prescription.
    source: { type: String, enum: ['manual', 'prescription-scan', 'package-scan'], default: 'manual' },
    prescriptionUploadId: { type: mongoose.Schema.Types.ObjectId, ref: 'PrescriptionUpload', default: null },

    schedule: { type: scheduleSchema, default: () => ({}) },
    startDate: { type: Date, default: () => new Date() },
    endDate: { type: Date, default: null },

    stock: {
      quantity: { type: Number, min: 0, default: 0 },
      unit: { type: String, trim: true, maxlength: 30, default: 'tablets' },
      lowStockThreshold: { type: Number, min: 0, default: 5 },
      lowStockAlerted: { type: Boolean, default: false },
    },

    expiryDate: { type: Date, default: null },
    expiryWarningsSent: { type: [Number], default: [] },
    manufacturer: { type: String, trim: true, maxlength: 160, default: '' },
    batchNumber: { type: String, trim: true, maxlength: 80, default: '' },

    status: { type: String, enum: MEDICINE_STATUSES, default: 'active', index: true },
    archivedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_d, ret) {
        delete ret.__v;
        // Internal provenance; ownership is enforced server-side, not leaked.
        delete ret.createdByUserId;
        return ret;
      },
    },
  },
);

medicineSchema.index({ profileId: 1, status: 1, name: 1 });
medicineSchema.index({ familyId: 1, status: 1 });
medicineSchema.index({ expiryDate: 1 });

medicineSchema.virtual('isLowStock').get(function isLowStock() {
  return (
    typeof this.stock?.quantity === 'number' &&
    this.stock.quantity <= (this.stock.lowStockThreshold ?? 0)
  );
});

medicineSchema.virtual('isExpired').get(function isExpired() {
  return Boolean(this.expiryDate && this.expiryDate.getTime() < Date.now());
});

export const Medicine = mongoose.models.Medicine || mongoose.model('Medicine', medicineSchema);

/** Mongo projection for `lean()` reads, matching the toJSON transform. */
export const MEDICINE_PUBLIC_PROJECTION = { createdByUserId: 0 };

export default Medicine;
