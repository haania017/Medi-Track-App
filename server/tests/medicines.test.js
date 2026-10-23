import { describe, expect, it } from 'vitest';
import { asAgent, registerUser, createManagedProfile, createMedicine } from './helpers.js';
import Medicine from '../src/models/Medicine.js';
import StockTransaction from '../src/models/StockTransaction.js';
import DoseLog from '../src/models/DoseLog.js';

async function setupMedicine(overrides = {}) {
  const agent = await asAgent();
  const { profile } = await registerUser(agent);
  const response = await createMedicine(agent, {
    profileId: profile.id,
    name: 'Metformin',
    strength: '500',
    unit: 'mg',
    form: 'tablet',
    schedule: { type: 'daily', times: ['08:00', '20:00'], doseQuantity: 1 },
    stock: { quantity: 30, unit: 'tablets', lowStockThreshold: 10 },
    ...overrides,
  });
  expect(response.status).toBe(201);
  return { agent, profile, medicine: response.body.data };
}

describe('Medicine management', () => {
  it('creates a medicine and records the initial stock ledger entry', async () => {
    const { agent, medicine } = await setupMedicine();

    expect(medicine.name).toBe('Metformin');
    expect(medicine.status).toBe('active');
    expect(medicine.stock.quantity).toBe(30);

    const transactions = await StockTransaction.find({ medicineId: medicine.id });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].type).toBe('initial');
    expect(transactions[0].resultingQuantity).toBe(30);
    void agent;
  });

  it('validates the create payload', async () => {
    const agent = await asAgent();
    const { profile } = await registerUser(agent);

    const missingName = await createMedicine(agent, { profileId: profile.id });
    expect(missingName.status).toBe(422);
    expect(missingName.body.error.code).toBe('VALIDATION_ERROR');

    const badTime = await createMedicine(agent, {
      profileId: profile.id,
      name: 'Bad Time',
      schedule: { type: 'daily', times: ['25:99'] },
    });
    expect(badTime.status).toBe(422);

    const badProfile = await createMedicine(agent, {
      profileId: '000000000000000000000000',
      name: 'No Profile',
    });
    expect(badProfile.status).toBe(404);
  });

  it('lists, filters and searches medicines', async () => {
    const agent = await asAgent();
    const { profile } = await registerUser(agent);

    await createMedicine(agent, { profileId: profile.id, name: 'Metformin', stock: { quantity: 2, unit: 'tablets', lowStockThreshold: 10 } });
    await createMedicine(agent, { profileId: profile.id, name: 'Atorvastatin', stock: { quantity: 40, unit: 'tablets', lowStockThreshold: 10 } });
    await createMedicine(agent, {
      profileId: profile.id,
      name: 'Expiring Soon',
      expiryDate: new Date(Date.now() + 5 * 86400000).toISOString(),
      stock: { quantity: 10, unit: 'tablets', lowStockThreshold: 2 },
    });

    const all = await agent.get('/api/v1/medicines');
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(3);

    const search = await agent.get('/api/v1/medicines?q=metf');
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].name).toBe('Metformin');

    const low = await agent.get('/api/v1/medicines?lowStock=true');
    expect(low.body.data).toHaveLength(1);
    expect(low.body.data[0].name).toBe('Metformin');

    const expiring = await agent.get('/api/v1/medicines?expiringInDays=7');
    expect(expiring.body.data).toHaveLength(1);
    expect(expiring.body.data[0].name).toBe('Expiring Soon');

    // Regex metacharacters must not break the search.
    const weird = await agent.get('/api/v1/medicines?q=%5B%5D%28');
    expect(weird.status).toBe(200);
    expect(weird.body.data).toHaveLength(0);
  });

  it('returns detail with upcoming doses and history counts', async () => {
    const { agent, medicine } = await setupMedicine();
    await agent.get('/api/v1/doses/today');

    const detail = await agent.get(`/api/v1/medicines/${medicine.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.medicine.name).toBe('Metformin');
    expect(detail.body.data.upcomingDoses.length).toBeGreaterThan(0);
    expect(detail.body.data.history).toHaveProperty('taken');
    expect(detail.body.data.profile.name).toBeTruthy();
  });

  it('updates a medicine and archives it without deleting history', async () => {
    const { agent, medicine } = await setupMedicine();
    await agent.get('/api/v1/doses/today');

    const updated = await agent
      .patch(`/api/v1/medicines/${medicine.id}`)
      .send({ strength: '850', instructions: 'Take with food' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.strength).toBe('850');

    const archived = await agent.post(`/api/v1/medicines/${medicine.id}/archive`);
    expect(archived.status).toBe(200);
    expect(archived.body.data.status).toBe('archived');

    // Pending future doses are removed, but the medicine and ledger remain.
    const pending = await DoseLog.countDocuments({
      medicineId: medicine.id,
      status: 'pending',
      scheduledFor: { $gte: new Date() },
    });
    expect(pending).toBe(0);
    expect(await StockTransaction.countDocuments({ medicineId: medicine.id })).toBe(1);

    const list = await agent.get('/api/v1/medicines');
    expect(list.body.data).toHaveLength(0);

    const archivedList = await agent.get('/api/v1/medicines?status=archived');
    expect(archivedList.body.data).toHaveLength(1);
  });

  it('records refills and adjustments in the ledger and refuses negative stock', async () => {
    const { agent, medicine } = await setupMedicine({ stock: { quantity: 5, unit: 'tablets', lowStockThreshold: 2 } });

    const refill = await agent
      .post(`/api/v1/medicines/${medicine.id}/stock-transactions`)
      .send({ type: 'refill', quantityChange: 20, reason: 'Pharmacy pickup' });

    expect(refill.status).toBe(201);
    expect(refill.body.data.medicine.stock.quantity).toBe(25);
    expect(refill.body.data.transaction.quantityChange).toBe(20);
    expect(refill.body.data.transaction.resultingQuantity).toBe(25);

    const adjustment = await agent
      .post(`/api/v1/medicines/${medicine.id}/stock-transactions`)
      .send({ type: 'adjustment', quantityChange: -3, reason: 'Dropped two tablets' });
    expect(adjustment.body.data.medicine.stock.quantity).toBe(22);

    const negative = await agent
      .post(`/api/v1/medicines/${medicine.id}/stock-transactions`)
      .send({ type: 'adjustment', quantityChange: -999 });
    expect(negative.status).toBe(400);

    const zero = await agent
      .post(`/api/v1/medicines/${medicine.id}/stock-transactions`)
      .send({ type: 'adjustment', quantityChange: 0 });
    expect(zero.status).toBe(422);

    const stored = await Medicine.findById(medicine.id);
    expect(stored.stock.quantity).toBe(22);
  });

  it('separates low-stock and expiry reporting', async () => {
    const agent = await asAgent();
    const { profile } = await registerUser(agent);

    await createMedicine(agent, {
      profileId: profile.id,
      name: 'Low Only',
      stock: { quantity: 1, unit: 'tablets', lowStockThreshold: 10 },
    });
    await createMedicine(agent, {
      profileId: profile.id,
      name: 'Expired Only',
      expiryDate: new Date(Date.now() - 2 * 86400000).toISOString(),
      stock: { quantity: 100, unit: 'tablets', lowStockThreshold: 5 },
    });

    const summary = await agent.get('/api/v1/stock/summary');
    expect(summary.status).toBe(200);
    expect(summary.body.data.lowStockCount).toBe(1);
    expect(summary.body.data.lowStock[0].name).toBe('Low Only');

    const expired = await agent.get('/api/v1/medicines/expired');
    expect(expired.body.data).toHaveLength(1);
    expect(expired.body.data[0].name).toBe('Expired Only');
    expect(expired.body.meta.guidance).toMatch(/pharmacist/i);

    const expiring = await agent.get('/api/v1/medicines/expiring?days=30');
    expect(expiring.body.data).toHaveLength(0);
  });

  it('scopes a managed profile correctly for the family owner', async () => {
    const agent = await asAgent();
    const { profile } = await registerUser(agent);
    const child = await createManagedProfile(agent, profile.familyId);

    await createMedicine(agent, { profileId: child.id, name: 'Child Medicine', stock: { quantity: 5, unit: 'tablets', lowStockThreshold: 1 } });

    const list = await agent.get('/api/v1/medicines');
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].profileId.name).toBe(child.name);
  });
});
