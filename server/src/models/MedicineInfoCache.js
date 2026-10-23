import mongoose from 'mongoose';

/**
 * Cache of trusted medicine reference data. Only ever populated from a
 * configured provider; an `available: false` record represents an honest
 * "no reliable match" state (never invented data).
 */
const medicineInfoCacheSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    medicineName: { type: String, required: true },
    strength: { type: String, default: '' },
    matchedName: { type: String, default: '' },
    matchConfidence: { type: Number, min: 0, max: 1, default: 0 },
    available: { type: Boolean, default: false },
    source: { type: String, default: '' },
    sourceUrl: { type: String, default: '' },
    payload: { type: mongoose.Schema.Types.Mixed, default: null },
    retrievedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, index: true },
  },
  { timestamps: true },
);

export const MedicineInfoCache =
  mongoose.models.MedicineInfoCache || mongoose.model('MedicineInfoCache', medicineInfoCacheSchema);

export default MedicineInfoCache;
