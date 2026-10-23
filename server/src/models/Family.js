import mongoose from 'mongoose';

const familySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

familySchema.index({ ownerId: 1, createdAt: 1 });

export const Family = mongoose.models.Family || mongoose.model('Family', familySchema);

export default Family;
