import mongoose from 'mongoose';

export const MEMBER_TYPES = ['owner', 'adult', 'managed'];
export const MEMBER_STATUSES = ['active', 'invited', 'revoked'];

const permissionsSchema = new mongoose.Schema(
  {
    viewRecords: { type: Boolean, default: true },
    manageMedicines: { type: Boolean, default: false },
    markDoses: { type: Boolean, default: false },
    manageStock: { type: Boolean, default: false },
    manageCarePlans: { type: Boolean, default: false },
    manageProfile: { type: Boolean, default: false },
  },
  { _id: false },
);

const sharePreferencesSchema = new mongoose.Schema(
  {
    doseReminder: { type: Boolean, default: true },
    missedDose: { type: Boolean, default: true },
    lowStock: { type: Boolean, default: true },
    expiry: { type: Boolean, default: true },
    carePlanReview: { type: Boolean, default: true },
  },
  { _id: false },
);

const familyMemberSchema = new mongoose.Schema(
  {
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
      index: true,
    },
    // Set when this profile belongs to (or is a connected account of) a real user.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    // Managed profiles (e.g. a child) have no user account of their own.
    memberType: { type: String, enum: MEMBER_TYPES, required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    relationship: { type: String, trim: true, maxlength: 60, default: 'Self' },
    // Colour used for visual identity on notifications, calendars, charts.
    color: { type: String, default: '#111827', match: /^#[0-9a-fA-F]{3,8}$/ },
    dateOfBirth: Date,
    notes: { type: String, maxlength: 1000 },
    status: { type: String, enum: MEMBER_STATUSES, default: 'active', index: true },
    permissions: { type: permissionsSchema, default: () => ({}) },
    sharePreferences: { type: sharePreferencesSchema, default: () => ({}) },
    consent: {
      grantedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      grantedAt: Date,
      revokedAt: Date,
    },
    invitedEmail: { type: String, lowercase: true, trim: true, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform(_d, ret) { delete ret.__v; return ret; } },
  },
);

familyMemberSchema.index({ familyId: 1, userId: 1 });
familyMemberSchema.index({ userId: 1, status: 1 });

familyMemberSchema.virtual('isManaged').get(function isManaged() {
  return this.memberType === 'managed';
});

export const FamilyMember =
  mongoose.models.FamilyMember || mongoose.model('FamilyMember', familyMemberSchema);

export default FamilyMember;
