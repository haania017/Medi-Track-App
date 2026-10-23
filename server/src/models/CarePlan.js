import mongoose from 'mongoose';

export const CARE_PLAN_STATUSES = ['active', 'awaiting_review', 'completed', 'cancelled'];

const carePlanSchema = new mongoose.Schema(
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
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    purpose: { type: String, maxlength: 500, default: '' },
    startDate: { type: Date, required: true },
    reviewDate: { type: Date, required: true, index: true },
    endDate: { type: Date, default: null },
    medicineIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' }],
      default: [],
    },
    notes: { type: String, maxlength: 2000, default: '' },
    status: { type: String, enum: CARE_PLAN_STATUSES, default: 'active', index: true },
    reviewRequestedAt: Date,
    reviewRequestedCount: { type: Number, default: 0 },
    lastReviewedAt: Date,
    outcome: { type: String, maxlength: 1000, default: '' },
    closedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    history: {
      // Immutable trail of status changes / continuations — history is never deleted.
      type: [
        {
          at: { type: Date, default: Date.now },
          action: { type: String, required: true },
          byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          note: String,
          previousReviewDate: Date,
          newReviewDate: Date,
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform(_d, ret) { delete ret.__v; return ret; } },
  },
);

carePlanSchema.index({ profileId: 1, status: 1 });

export const CarePlan = mongoose.models.CarePlan || mongoose.model('CarePlan', carePlanSchema);

export default CarePlan;
