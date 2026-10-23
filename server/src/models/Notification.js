import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'dose_reminder',
  'missed_dose',
  'low_stock',
  'expiry',
  'care_plan_review',
  'system',
];

// Ordered low → high; used for accessible urgency indicators (never colour alone).
export const URGENCY_LEVELS = { low: 1, normal: 2, high: 3, critical: 4 };

const notificationSchema = new mongoose.Schema(
  {
    // Recipient — a specific user account.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true, index: true },
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null },
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null },
    doseLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'DoseLog', default: null },
    carePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'CarePlan', default: null },

    type: { type: String, enum: NOTIFICATION_TYPES, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, maxlength: 600, default: '' },
    urgency: { type: String, enum: ['low', 'normal', 'high', 'critical'], default: 'normal' },

    // Visual family identity.
    memberName: { type: String, maxlength: 120, default: '' },
    memberColor: { type: String, default: '#111827' },

    // Supported in-app actions.
    actions: {
      type: [{ type: String, enum: ['mark_taken', 'remind_later', 'view', 'review_plan'] }],
      default: ['view'],
    },

    read: { type: Boolean, default: false, index: true },
    readAt: Date,
    pushSent: { type: Boolean, default: false },
    pushSentAt: Date,
    pushAttempts: { type: Number, default: 0 },
    // Deduplication: one notification per (recipient, type, subject, window).
    dedupeKey: { type: String, required: true, unique: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform(_d, ret) { delete ret.__v; return ret; } },
  },
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;
