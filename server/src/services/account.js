import Family from '../models/Family.js';
import FamilyMember from '../models/FamilyMember.js';
import Medicine from '../models/Medicine.js';
import DoseLog from '../models/DoseLog.js';
import StockTransaction from '../models/StockTransaction.js';
import CarePlan from '../models/CarePlan.js';
import Notification from '../models/Notification.js';
import PrescriptionUpload from '../models/PrescriptionUpload.js';
import PrescriptionDraft from '../models/PrescriptionDraft.js';
import UserAllergy from '../models/UserAllergy.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import { deleteFile } from './storage.js';

/**
 * Permanently delete a user's account and the data they own.
 *
 * Scope:
 *  - Families the user owns are removed entirely, along with their members,
 *    medicines, dose records, stock ledger, care plans, notifications and scans
 *    (including the stored image files for those scans).
 *  - Memberships in someone else's family are revoked, not deleted, so the
 *    family owner keeps an accurate record that the person left.
 *  - The user's own allergy records and account row are deleted.
 *
 * This is intentionally a hard delete. It is only ever reached after the caller
 * re-confirms their password, and it never touches other families' records.
 */
export async function deleteUserAccount(user) {
  const userId = user._id;

  const ownedFamilies = await Family.find({ ownerId: userId }).select('_id').lean();
  const ownedFamilyIds = ownedFamilies.map((f) => f._id);

  let deletedMedicines = 0;
  let deletedScans = 0;

  if (ownedFamilyIds.length) {
    const members = await FamilyMember.find({ familyId: { $in: ownedFamilyIds } })
      .select('_id')
      .lean();
    const memberIds = members.map((m) => m._id);

    // Remove stored scan binaries first (best effort — a missing file is fine).
    const uploads = await PrescriptionUpload.find({ familyId: { $in: ownedFamilyIds } })
      .select('+storage.absolutePath')
      .lean();
    for (const upload of uploads) {
      await deleteFile(upload.storage).catch((err) =>
        logger.warn('Failed to delete stored scan during account deletion:', err.message),
      );
    }
    deletedScans = uploads.length;

    const results = await Promise.all([
      PrescriptionDraft.deleteMany({ familyId: { $in: ownedFamilyIds } }),
      PrescriptionUpload.deleteMany({ familyId: { $in: ownedFamilyIds } }),
      DoseLog.deleteMany({ profileId: { $in: memberIds } }),
      StockTransaction.deleteMany({ profileId: { $in: memberIds } }),
      Medicine.deleteMany({ familyId: { $in: ownedFamilyIds } }),
      CarePlan.deleteMany({ familyId: { $in: ownedFamilyIds } }),
      Notification.deleteMany({ familyId: { $in: ownedFamilyIds } }),
      FamilyMember.deleteMany({ familyId: { $in: ownedFamilyIds } }),
      Family.deleteMany({ _id: { $in: ownedFamilyIds } }),
    ]);
    deletedMedicines = results[4]?.deletedCount || 0;
  }

  // Access to other families is revoked, and the membership is kept as a record.
  await FamilyMember.updateMany(
    { userId, status: { $ne: 'revoked' } },
    { $set: { userId: null, status: 'revoked', 'consent.revokedAt': new Date() } },
  );

  await UserAllergy.deleteMany({ userId });
  await User.deleteOne({ _id: userId });

  return {
    deletedFamilies: ownedFamilyIds.length,
    deletedMedicines,
    deletedScans,
  };
}

export default { deleteUserAccount };
