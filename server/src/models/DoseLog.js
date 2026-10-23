import mongoose from 'mongoose';

export const DOSE_STATUSES = ['pending', 'taken', 'skipped', 'missed'];

const doseLogSchema = new mongoose.Schema(
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
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true,
    },
    // Concrete instant the dose was generated for (UTC).
    scheduledFor: { type: Date, required: true, index: true },
    // Local "HH:mm" the dose belongs to, kept for display.
    scheduleTime: { type: String, default: '' },
    status: { type: String, enum: DOSE_STATUSES, default: 'pending', index: true },
    takenAt: Date,
    skippedAt: Date,
    snoozedUntil: Date,
    snoozeCount: { type: Number, default: 0, min: 0 },
    recordedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Set once the dose has deducted stock so it can never deduct twice.
    stockDeducted: { type: Boolean, default: false },
    stockTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransaction', default: null },
    quantity: { type: Number, min: 0, default: 1 },
    note: { type: String, maxlength: 500, default: '' },
    remindedAt: Date,
    missedAlertedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform(_d, ret) { delete ret.__v; return ret; } },
  },
);

// One dose row per medicine per scheduled instant — the core idempotency guard.
doseLogSchema.index({ medicineId: 1, scheduledFor: 1 }, { unique: true });
doseLogSchema.index({ profileId: 1, scheduledFor: 1, status: 1 });
doseLogSchema.index({ familyId: 1, scheduledFor: 1 });

export const DoseLog = mongoose.models.DoseLog || mongoose.model('DoseLog', doseLogSchema);

export default DoseLog;
