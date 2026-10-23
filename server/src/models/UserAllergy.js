import mongoose from 'mongoose';

const userAllergySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Optional when the allergy is recorded for a managed profile.
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null, index: true },
    allergen: { type: String, required: true, trim: true, maxlength: 160 },
    allergenType: {
      type: String,
      enum: ['drug', 'ingredient', 'food', 'other'],
      default: 'drug',
    },
    severity: { type: String, enum: ['mild', 'moderate', 'severe', 'unknown'], default: 'unknown' },
    reaction: { type: String, maxlength: 500, default: '' },
    notes: { type: String, maxlength: 1000, default: '' },
    // User voluntarily records this; MediTrack never diagnoses or infers it.
    recordedAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform(_d, ret) { delete ret.__v; return ret; } },
  },
);

userAllergySchema.index({ userId: 1, allergen: 1, profileId: 1 });

export const UserAllergy =
  mongoose.models.UserAllergy || mongoose.model('UserAllergy', userAllergySchema);

export default UserAllergy;
