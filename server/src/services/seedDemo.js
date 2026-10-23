/**
 * Synthetic demo data.
 *
 * Used in two ways:
 *  - `npm run seed`  → writes demo data into whatever MONGODB_URI points at
 *  - server boot     → when SEED_DEMO=true and the database has no users, so the
 *                      zero-config development experience has something to log into
 *
 * Never point this at a database containing real patient records.
 */
import User from '../models/User.js';
import Family from '../models/Family.js';
import FamilyMember from '../models/FamilyMember.js';
import Medicine from '../models/Medicine.js';
import CarePlan from '../models/CarePlan.js';
import UserAllergy from '../models/UserAllergy.js';
import DoseLog from '../models/DoseLog.js';
import StockTransaction from '../models/StockTransaction.js';
import Notification from '../models/Notification.js';
import logger from '../utils/logger.js';
import { generateDoses } from './doses.js';
import { recordInitialStock } from './stock.js';
import { MEMBER_COLORS } from './bootstrap.js';

export const DEMO_EMAIL = 'demo@meditrack.test';
export const DEMO_PASSWORD = 'Password123';

const inDays = (n) => new Date(Date.now() + n * 86400000);

export const DEMO_SUMMARY = {
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
  note: 'Synthetic demo account. Never use these credentials for anything real.',
};

/** Remove any previous demo workspace so re-seeding is deterministic. */
async function clearDemoData(user) {
  const families = await Family.find({ ownerId: user._id }).select('_id');
  const familyIds = families.map((f) => f._id);
  const profiles = await FamilyMember.find({ familyId: { $in: familyIds } }).select('_id');
  const profileIds = profiles.map((p) => p._id);

  await Promise.all([
    DoseLog.deleteMany({ profileId: { $in: profileIds } }),
    StockTransaction.deleteMany({ profileId: { $in: profileIds } }),
    Medicine.deleteMany({ profileId: { $in: profileIds } }),
    CarePlan.deleteMany({ profileId: { $in: profileIds } }),
    Notification.deleteMany({ familyId: { $in: familyIds } }),
    UserAllergy.deleteMany({ userId: user._id }),
    FamilyMember.deleteMany({ familyId: { $in: familyIds } }),
    Family.deleteMany({ _id: { $in: familyIds } }),
    User.deleteOne({ _id: user._id }),
  ]);
}

/**
 * Create the demo workspace. Idempotent: pass `{ replace: true }` to rebuild it.
 * Returns a summary object for logging.
 */
export async function seedDemoData({ replace = true } = {}) {
  const existing = await User.findOne({ email: DEMO_EMAIL });
  if (existing) {
    if (!replace) return { skipped: true };
    await clearDemoData(existing);
  }

  const user = new User({
    name: 'Demo Caregiver',
    email: DEMO_EMAIL,
    timezone: 'Asia/Karachi',
    locale: 'en',
    termsAcceptedAt: new Date(),
  });
  await user.setPassword(DEMO_PASSWORD);
  await user.save();

  const family = await Family.create({ name: 'Demo Family', ownerId: user._id });

  const self = await FamilyMember.create({
    familyId: family._id,
    userId: user._id,
    memberType: 'owner',
    name: 'Demo Caregiver',
    relationship: 'Self',
    color: MEMBER_COLORS[0],
    status: 'active',
    consent: { grantedByUserId: user._id, grantedAt: new Date() },
  });

  const child = await FamilyMember.create({
    familyId: family._id,
    memberType: 'managed',
    name: 'Ayesha',
    relationship: 'Daughter',
    color: MEMBER_COLORS[2],
    dateOfBirth: new Date('2016-04-12'),
    status: 'active',
    consent: { grantedByUserId: user._id, grantedAt: new Date() },
  });

  const invitedAdult = await FamilyMember.create({
    familyId: family._id,
    memberType: 'adult',
    name: 'Imran',
    relationship: 'Father',
    color: MEMBER_COLORS[1],
    invitedEmail: 'imran@example.invalid',
    status: 'invited',
    permissions: { viewRecords: true },
  });

  const medicineSpecs = [
    {
      profile: self,
      name: 'Metformin',
      strength: '500',
      unit: 'mg',
      form: 'tablet',
      instructions: 'Take with food',
      schedule: { type: 'daily', times: ['08:00', '20:00'], doseQuantity: 1 },
      stock: { quantity: 26, unit: 'tablets', lowStockThreshold: 10 },
      expiryDate: inDays(21),
      manufacturer: 'Demo Pharma Ltd',
      batchNumber: 'MF-2291',
    },
    {
      profile: self,
      name: 'Atorvastatin',
      strength: '10',
      unit: 'mg',
      form: 'tablet',
      instructions: 'Take at night',
      schedule: { type: 'daily', times: ['22:00'], doseQuantity: 1 },
      stock: { quantity: 8, unit: 'tablets', lowStockThreshold: 10 },
      expiryDate: inDays(180),
      manufacturer: 'Demo Pharma Ltd',
      batchNumber: 'AT-1023',
    },
    {
      profile: self,
      name: 'Vitamin D3',
      strength: '2000',
      unit: 'IU',
      form: 'capsule',
      instructions: 'Once a week',
      schedule: { type: 'weekdays', weekdays: [1], times: ['09:00'], doseQuantity: 1 },
      stock: { quantity: 30, unit: 'capsules', lowStockThreshold: 5 },
      expiryDate: inDays(-4),
      manufacturer: 'Wellness Co',
      batchNumber: 'VD-771',
    },
    {
      profile: child,
      name: 'Amoxicillin',
      strength: '250',
      unit: 'mg',
      form: 'suspension',
      instructions: 'Shake well before use',
      schedule: { type: 'daily', times: ['09:00', '15:00', '21:00'], doseQuantity: 5 },
      stock: { quantity: 120, unit: 'ml', lowStockThreshold: 30 },
      expiryDate: inDays(11),
      manufacturer: 'KidsMed',
      batchNumber: 'AM-5521',
    },
    {
      profile: child,
      name: 'Paracetamol',
      strength: '120',
      unit: 'mg',
      form: 'syrup',
      instructions: 'Only if there is a fever',
      schedule: { type: 'as-needed', times: [], doseQuantity: 5 },
      stock: { quantity: 80, unit: 'ml', lowStockThreshold: 20 },
      expiryDate: inDays(300),
    },
  ];

  const createdMedicines = [];
  for (const spec of medicineSpecs) {
    const medicine = await Medicine.create({
      familyId: family._id,
      profileId: spec.profile._id,
      createdByUserId: user._id,
      name: spec.name,
      strength: spec.strength,
      unit: spec.unit,
      form: spec.form,
      instructions: spec.instructions,
      schedule: spec.schedule,
      startDate: inDays(-14),
      stock: spec.stock,
      expiryDate: spec.expiryDate,
      manufacturer: spec.manufacturer || '',
      batchNumber: spec.batchNumber || '',
      source: 'manual',
      status: 'active',
    });
    await recordInitialStock({ medicine, userId: user._id });
    createdMedicines.push(medicine);
  }

  await generateDoses({
    profileIds: [self._id, child._id],
    timeZone: user.timezone,
    days: 7,
  });

  // Backfill some past recorded doses so the reports screen has real data.
  const pastDoses = await DoseLog.find({
    profileId: { $in: [self._id, child._id] },
    scheduledFor: { $lt: new Date() },
  })
    .sort({ scheduledFor: 1 })
    .limit(24);

  let index = 0;
  for (const dose of pastDoses) {
    index += 1;
    const status = index % 7 === 0 ? 'missed' : index % 5 === 0 ? 'skipped' : 'taken';
    dose.status = status;
    if (status === 'taken') {
      dose.takenAt = dose.scheduledFor;
      dose.recordedByUserId = user._id;
      dose.stockDeducted = true;
    }
    if (status === 'skipped') dose.skippedAt = dose.scheduledFor;
    await dose.save();
  }

  const plan = await CarePlan.create({
    familyId: family._id,
    profileId: child._id,
    createdByUserId: user._id,
    title: 'Chest infection — antibiotic course',
    purpose: 'Short antibiotic course for a chest infection.',
    startDate: inDays(-6),
    reviewDate: inDays(2),
    medicineIds: createdMedicines.filter((m) => m.profileId.equals(child._id)).map((m) => m._id),
    notes: 'Review with the paediatrician if the fever returns.',
    history: [{ action: 'created', byUserId: user._id }],
  });

  await UserAllergy.create({
    userId: user._id,
    profileId: child._id,
    allergen: 'Penicillin',
    allergenType: 'drug',
    severity: 'moderate',
    reaction: 'Rash',
    notes: 'Reported by the family doctor in 2023.',
  });

  return {
    skipped: false,
    familyId: String(family._id),
    familyName: family.name,
    profiles: [self, child, invitedAdult].length,
    medicines: createdMedicines.length,
    carePlan: plan.title,
  };
}

/**
 * Seed only when the database looks brand new, so restarting the server never
 * overwrites a developer's own data.
 */
export async function ensureDemoData() {
  const userCount = await User.estimatedDocumentCount();
  if (userCount > 0) return { skipped: true, reason: 'database-not-empty' };

  const summary = await seedDemoData({ replace: false });
  logger.info(`Demo data seeded — sign in as ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  return summary;
}

export default seedDemoData;
