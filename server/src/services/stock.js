import Medicine from '../models/Medicine.js';
import StockTransaction from '../models/StockTransaction.js';
import ApiError from '../utils/ApiError.js';
import { round } from '../utils/ids.js';

/**
 * Apply a stock change atomically and record a ledger entry.
 *
 * Guarantees:
 *  - `stock.quantity` can never go negative (guarded in the atomic update).
 *  - a repeated call with the same `dedupeKey` never applies the change twice.
 *
 * Returns { medicine, transaction, duplicate }.
 */
export async function applyStockChange({
  medicineId,
  change,
  type,
  reason = '',
  doseLogId = null,
  userId,
  dedupeKey = null,
}) {
  const delta = round(change, 3);
  if (delta === 0) throw ApiError.badRequest('Stock change must be non-zero.');

  const medicine = await Medicine.findById(medicineId);
  if (!medicine) throw ApiError.notFound('Medicine not found.');

  if (dedupeKey) {
    const existing = await StockTransaction.findOne({ dedupeKey });
    if (existing) return { medicine, transaction: existing, duplicate: true };
  }

  // Atomic, non-negative guarded increment.
  const updated = await Medicine.findOneAndUpdate(
    { _id: medicineId, 'stock.quantity': { $gte: Math.max(0, -delta) } },
    { $inc: { 'stock.quantity': delta } },
    { new: true },
  );

  if (!updated) {
    throw ApiError.badRequest(
      `Not enough stock for ${medicine.name}. Current: ${medicine.stock.quantity} ${medicine.stock.unit}.`,
    );
  }

  updated.stock.quantity = round(updated.stock.quantity, 3);
  // Restock above the threshold clears the alert so it can fire again later.
  // Falling to/below the threshold leaves the flag for the scheduler to alert on.
  if (updated.stock.quantity > (updated.stock.lowStockThreshold ?? 0)) {
    updated.stock.lowStockAlerted = false;
  }
  await updated.save();

  let transaction;
  try {
    transaction = await StockTransaction.create({
      familyId: updated.familyId,
      profileId: updated.profileId,
      medicineId: updated._id,
      type,
      quantityChange: delta,
      resultingQuantity: updated.stock.quantity,
      reason,
      doseLogId,
      createdByUserId: userId,
      // Only set when provided: a null value would be indexed by the sparse
      // unique index and collide with every other null.
      ...(dedupeKey ? { dedupeKey } : {}),
    });
  } catch (err) {
    // Duplicate dedupeKey: another request won the race. Undo our increment.
    if (err?.code === 11000 && dedupeKey) {
      await Medicine.updateOne({ _id: medicineId }, { $inc: { 'stock.quantity': -delta } });
      const existing = await StockTransaction.findOne({ dedupeKey });
      return { medicine: await Medicine.findById(medicineId), transaction: existing, duplicate: true };
    }
    throw err;
  }

  return { medicine: updated, transaction, duplicate: false };
}

/** Record the initial stock when a medicine is created (no delta maths needed). */
export async function recordInitialStock({ medicine, userId }) {
  if (!medicine?.stock?.quantity) return null;
  return StockTransaction.create({
    familyId: medicine.familyId,
    profileId: medicine.profileId,
    medicineId: medicine._id,
    type: 'initial',
    quantityChange: round(medicine.stock.quantity, 3),
    resultingQuantity: round(medicine.stock.quantity, 3),
    reason: 'Initial stock recorded',
    createdByUserId: userId,
    dedupeKey: `initial:${medicine._id}`,
  });
}

export async function getStockSummary(profileIds) {
  const medicines = await Medicine.find({
    profileId: { $in: profileIds },
    status: { $in: ['active', 'paused'] },
  }).lean();

  const low = [];
  const ok = [];
  for (const m of medicines) {
    const entry = {
      medicineId: m._id,
      name: m.name,
      strength: m.strength,
      profileId: m.profileId,
      quantity: m.stock.quantity,
      unit: m.stock.unit,
      lowStockThreshold: m.stock.lowStockThreshold,
      status: m.status,
    };
    if (m.stock.quantity <= (m.stock.lowStockThreshold ?? 0)) low.push(entry);
    else ok.push(entry);
  }

  return {
    totalMedicines: medicines.length,
    lowStockCount: low.length,
    lowStock: low.sort((a, b) => a.quantity - b.quantity),
    adequate: ok.sort((a, b) => a.quantity - b.quantity),
  };
}

export default { applyStockChange, recordInitialStock, getStockSummary };
