import mongoose from 'mongoose';

export const STOCK_TRANSACTION_TYPES = [
  'initial',
  'refill',
  'adjustment',
  'dose',
  'expired-removal',
  'correction',
];

const stockTransactionSchema = new mongoose.Schema(
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
    type: { type: String, enum: STOCK_TRANSACTION_TYPES, required: true },
    quantityChange: { type: Number, required: true },
    resultingQuantity: { type: Number, required: true, min: 0 },
    reason: { type: String, maxlength: 300, default: '' },
    doseLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'DoseLog', default: null },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Prevents a repeated request from applying the same change twice.
    // Left unset (not null) when absent so the sparse unique index skips it —
    // a null value would still be indexed and collide.
    dedupeKey: { type: String, unique: true, sparse: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform(_d, ret) { delete ret.__v; return ret; } },
  },
);

stockTransactionSchema.index({ medicineId: 1, createdAt: -1 });
stockTransactionSchema.index({ profileId: 1, createdAt: -1 });

export const StockTransaction =
  mongoose.models.StockTransaction || mongoose.model('StockTransaction', stockTransactionSchema);

export default StockTransaction;
