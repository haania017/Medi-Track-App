import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export const LIGHT_PALETTES = ['monochrome', 'ocean', 'emerald', 'lavender', 'rose', 'amber'];
export const DARK_PALETTES = [
  'midnight',
  'midnight-blue',
  'emerald-night',
  'violet-night',
  'rose-night',
  'amber-night',
];

const appearanceSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ['system', 'light', 'dark'], default: 'system' },
    lightPalette: { type: String, enum: LIGHT_PALETTES, default: 'monochrome' },
    darkPalette: { type: String, enum: DARK_PALETTES, default: 'midnight' },
  },
  { _id: false },
);

const notificationPreferencesSchema = new mongoose.Schema(
  {
    inApp: { type: Boolean, default: true },
    doseReminder: { type: Boolean, default: true },
    missedDose: { type: Boolean, default: true },
    lowStock: { type: Boolean, default: true },
    expiry: { type: Boolean, default: true },
    carePlanReview: { type: Boolean, default: true },
    push: { type: Boolean, default: false },
  },
  { _id: false },
);

const pushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: String,
      auth: String,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    timezone: { type: String, default: 'UTC' },
    locale: { type: String, default: 'en' },
    appearance: { type: appearanceSchema, default: () => ({}) },
    notificationPreferences: { type: notificationPreferencesSchema, default: () => ({}) },
    pushSubscriptions: { type: [pushSubscriptionSchema], default: [] },
    lastLoginAt: Date,
    termsAcceptedAt: Date,
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        delete ret.tokenVersion;
        return ret;
      },
    },
  },
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, SALT_ROUNDS);
};

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, this.passwordHash);
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
