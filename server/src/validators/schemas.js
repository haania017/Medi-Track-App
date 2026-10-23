import { z } from 'zod';
import { LIGHT_PALETTES, DARK_PALETTES } from '../models/User.js';
import { MEDICINE_FORMS, MEDICINE_STATUSES } from '../models/Medicine.js';
import { MEMBER_TYPES } from '../models/FamilyMember.js';

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

/* ------------------------------- auth ---------------------------------- */

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200)
    .regex(/[a-zA-Z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a number'),
  timezone: z.string().max(64).optional(),
  termsAccepted: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(200),
});

/* ------------------------------- users --------------------------------- */

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  timezone: z.string().max(64).optional(),
  locale: z.string().max(10).optional(),
});

export const updatePreferencesSchema = z.object({
  appearance: z
    .object({
      mode: z.enum(['system', 'light', 'dark']).optional(),
      lightPalette: z.enum(LIGHT_PALETTES).optional(),
      darkPalette: z.enum(DARK_PALETTES).optional(),
    })
    .optional(),
  notificationPreferences: z
    .object({
      inApp: z.boolean().optional(),
      doseReminder: z.boolean().optional(),
      missedDose: z.boolean().optional(),
      lowStock: z.boolean().optional(),
      expiry: z.boolean().optional(),
      carePlanReview: z.boolean().optional(),
      push: z.boolean().optional(),
    })
    .optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200)
    .regex(/[a-zA-Z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a number'),
});

/* ------------------------------ families -------------------------------- */

export const createFamilySchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export const createMemberSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relationship: z.string().trim().max(60).optional(),
  memberType: z.enum(MEMBER_TYPES).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  dateOfBirth: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
  invitedEmail: z.string().trim().toLowerCase().email().optional(),
});

export const updateMemberSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  relationship: z.string().trim().max(60).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(['active', 'invited', 'revoked']).optional(),
  sharePreferences: z
    .object({
      doseReminder: z.boolean().optional(),
      missedDose: z.boolean().optional(),
      lowStock: z.boolean().optional(),
      expiry: z.boolean().optional(),
      carePlanReview: z.boolean().optional(),
    })
    .optional(),
});

export const updatePermissionsSchema = z.object({
  viewRecords: z.boolean().optional(),
  manageMedicines: z.boolean().optional(),
  markDoses: z.boolean().optional(),
  manageStock: z.boolean().optional(),
  manageCarePlans: z.boolean().optional(),
  manageProfile: z.boolean().optional(),
});

/* ------------------------------ medicines ------------------------------- */

const scheduleSchema = z.object({
  type: z.enum(['daily', 'weekdays', 'interval', 'specific-dates', 'as-needed']).default('daily'),
  times: z.array(timeString).max(12).default([]),
  weekdays: z.array(z.number().int().min(0).max(6)).default([]),
  intervalDays: z.number().int().min(1).max(365).optional(),
  anchorDate: z.coerce.date().optional(),
  specificDates: z.array(isoDate).max(200).default([]),
  doseQuantity: z.number().min(0).max(1000).default(1),
});

export const createMedicineSchema = z.object({
  profileId: objectId,
  name: z.string().trim().min(1, 'Medicine name is required').max(200),
  strength: z.string().trim().max(60).default(''),
  unit: z.string().trim().max(30).default('mg'),
  form: z.enum(MEDICINE_FORMS).default('tablet'),
  instructions: z.string().max(1000).default(''),
  schedule: scheduleSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
  stock: z
    .object({
      quantity: z.number().min(0).max(1_000_000).default(0),
      unit: z.string().trim().max(30).default('tablets'),
      lowStockThreshold: z.number().min(0).max(1_000_000).default(5),
    })
    .optional(),
  expiryDate: z.coerce.date().nullable().optional(),
  manufacturer: z.string().trim().max(160).default(''),
  batchNumber: z.string().trim().max(80).default(''),
  status: z.enum(MEDICINE_STATUSES).optional(),
  source: z.enum(['manual', 'prescription-scan', 'package-scan']).optional(),
});

export const updateMedicineSchema = createMedicineSchema.partial().omit({ profileId: true });

export const listMedicinesQuery = z.object({
  profileId: objectId.optional(),
  status: z.string().optional(),
  q: z.string().max(200).optional(),
  expiringInDays: z.coerce.number().int().min(0).max(3650).optional(),
  lowStock: z.coerce.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().max(60).optional(),
});

/* -------------------------------- doses --------------------------------- */

export const doseActionSchema = z.object({
  note: z.string().max(500).optional(),
});

export const snoozeSchema = z.object({
  minutes: z.coerce.number().int().min(1).max(1440).default(15),
});

export const listDosesQuery = z.object({
  profileId: objectId.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  date: z.string().optional(),
  status: z.string().optional(),
  medicineId: objectId.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

/* -------------------------------- stock --------------------------------- */

export const stockTransactionSchema = z.object({
  type: z.enum(['refill', 'adjustment', 'correction', 'expired-removal']).default('adjustment'),
  quantityChange: z.number().refine((v) => v !== 0, 'Quantity change must be non-zero'),
  reason: z.string().max(300).default(''),
});

/* ----------------------------- care plans -------------------------------- */

export const createCarePlanSchema = z.object({
  profileId: objectId,
  title: z.string().trim().min(1).max(200),
  purpose: z.string().max(500).optional(),
  startDate: z.coerce.date(),
  reviewDate: z.coerce.date(),
  medicineIds: z.array(objectId).max(50).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateCarePlanSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  purpose: z.string().max(500).optional(),
  reviewDate: z.coerce.date().optional(),
  medicineIds: z.array(objectId).max(50).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['active', 'awaiting_review', 'completed', 'cancelled']).optional(),
  outcome: z.string().max(1000).optional(),
});

export const carePlanReviewSchema = z.object({
  decision: z.enum(['complete', 'continue']),
  outcome: z.string().max(1000).optional(),
  extendedReviewDate: z.coerce.date().optional(),
});

/* ------------------------------ allergies -------------------------------- */

export const allergySchema = z.object({
  allergen: z.string().trim().min(1).max(160),
  allergenType: z.enum(['drug', 'ingredient', 'food', 'other']).default('drug'),
  severity: z.enum(['mild', 'moderate', 'severe', 'unknown']).default('unknown'),
  reaction: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  profileId: objectId.nullable().optional(),
});

/* ---------------------------- notifications ------------------------------ */

export const notificationsQuery = z.object({
  unreadOnly: z.coerce.string().optional(),
  type: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/* ------------------------------- reports --------------------------------- */

export const adherenceQuery = z.object({
  profileId: objectId.optional(),
  period: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});
