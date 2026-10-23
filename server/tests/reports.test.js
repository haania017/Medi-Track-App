import { describe, expect, it } from 'vitest';
import { asAgent, registerUser, createMedicine, createManagedProfile } from './helpers.js';
import DoseLog from '../src/models/DoseLog.js';

async function withRecordedDoses() {
  const agent = await asAgent();
  const { profile } = await registerUser(agent);
  const child = await createManagedProfile(agent, profile.familyId, { name: 'Ayesha' });

  const medicine = await createMedicine(agent, {
    profileId: profile.id,
    name: 'Metformin',
    strength: '500',
    unit: 'mg',
    schedule: { type: 'daily', times: ['09:00', '21:00'], doseQuantity: 1 },
    stock: { quantity: 60, unit: 'tablets', lowStockThreshold: 10 },
  });

  await agent.get('/api/v1/doses/today');
  await agent.post('/api/v1/doses/generate').send({ days: 7 });

  const doses = await DoseLog.find({ medicineId: medicine.body.data.id }).sort({ scheduledFor: 1 });

  // Record a mix of outcomes: taken, skipped, missed.
  for (const [index, dose] of doses.entries()) {
    if (index % 4 === 0) await agent.post(`/api/v1/doses/${dose._id}/mark-taken`).send({});
    else if (index % 4 === 1) await agent.post(`/api/v1/doses/${dose._id}/mark-skipped`).send({});
    else if (index % 4 === 2) {
      await DoseLog.updateOne({ _id: dose._id }, { $set: { status: 'missed' } });
    }
  }

  return { agent, profile, child, medicineId: medicine.body.data.id };
}

describe('Reports and history', () => {
  it('summarises recorded doses without claiming medical proof', async () => {
    const { agent } = await withRecordedDoses();

    const response = await agent.get('/api/v1/reports/adherence?period=daily');
    expect(response.status).toBe(200);

    const { summary, buckets, byMedicine, disclaimer } = response.body.data;
    expect(summary.taken).toBeGreaterThan(0);
    expect(summary.skipped).toBeGreaterThan(0);
    expect(summary.total).toBeGreaterThan(0);
    expect(buckets.length).toBeGreaterThan(0);
    expect(byMedicine.length).toBeGreaterThan(0);
    expect(disclaimer).toMatch(/not medical proof/i);

    const recorded = summary.taken + summary.skipped + summary.missed;
    expect(summary.adherenceRate).toBeCloseTo((summary.taken / recorded) * 100, 1);
  });

  it('supports daily, weekly and monthly groupings', async () => {
    const { agent } = await withRecordedDoses();

    for (const period of ['daily', 'weekly', 'monthly']) {
      const response = await agent.get(`/api/v1/reports/adherence?period=${period}`);
      expect(response.status).toBe(200);
      expect(response.body.data.period).toBe(period);
      expect(response.body.data.buckets.length).toBeGreaterThan(0);
    }

    const weekly = await agent.get('/api/v1/reports/adherence?period=weekly');
    const keys = weekly.body.data.buckets.map((b) => b.bucket);
    for (const key of keys) {
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('exports adherence and stock history as CSV', async () => {
    const { agent } = await withRecordedDoses();

    const adherence = await agent.get('/api/v1/reports/adherence?period=daily&format=csv');
    expect(adherence.status).toBe(200);
    expect(adherence.headers['content-type']).toMatch(/text\/csv/);
    expect(adherence.headers['content-disposition']).toMatch(/attachment/);
    expect(adherence.text.split('\n')[0]).toBe('bucket,taken,skipped,missed,pending,total');

    const stock = await agent.get('/api/v1/reports/stock-history?format=csv');
    expect(stock.status).toBe(200);
    expect(stock.text.split('\n')[0]).toBe('date,medicine,profile,type,change,resulting,reason');
  });

  it('returns the stock ledger with medicine and profile context', async () => {
    const { agent, medicineId } = await withRecordedDoses();

    await agent
      .post(`/api/v1/medicines/${medicineId}/stock-transactions`)
      .send({ type: 'refill', quantityChange: 30, reason: 'Pharmacy' });

    const response = await agent.get('/api/v1/reports/stock-history');
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(1);
    const refill = response.body.data.find((t) => t.type === 'refill');
    expect(refill.medicineId.name).toBe('Metformin');
    expect(refill.profileId.name).toBeTruthy();
  });

  it('separates expired and expiring medicines with pharmacist guidance', async () => {
    const agent = await asAgent();
    const { profile } = await registerUser(agent);

    await createMedicine(agent, {
      profileId: profile.id,
      name: 'Expired Item',
      expiryDate: new Date(Date.now() - 86400000).toISOString(),
      stock: { quantity: 5, unit: 'tablets', lowStockThreshold: 1 },
    });
    await createMedicine(agent, {
      profileId: profile.id,
      name: 'Expiring Item',
      expiryDate: new Date(Date.now() + 10 * 86400000).toISOString(),
      stock: { quantity: 5, unit: 'tablets', lowStockThreshold: 1 },
    });

    const response = await agent.get('/api/v1/reports/expiry?days=30');
    expect(response.status).toBe(200);
    expect(response.body.data.counts.expired).toBe(1);
    expect(response.body.data.counts.expiring).toBe(1);
    expect(response.body.data.guidance).toMatch(/does not decide/i);
  });

  it('filters reports by profile for authorised users only', async () => {
    const { agent, child, profile } = await withRecordedDoses();

    const childReport = await agent.get(`/api/v1/reports/adherence?profileId=${child.id}&period=daily`);
    expect(childReport.status).toBe(200);
    expect(childReport.body.data.summary.total).toBe(0);

    const ownReport = await agent.get(`/api/v1/reports/adherence?profileId=${profile.id}&period=daily`);
    expect(ownReport.body.data.summary.total).toBeGreaterThan(0);

    const stranger = await asAgent();
    await registerUser(stranger);
    expect((await stranger.get(`/api/v1/reports/adherence?profileId=${profile.id}`)).status).toBe(404);
  });

  it('builds a per-profile family summary for the dashboard', async () => {
    const { agent } = await withRecordedDoses();

    const response = await agent.get('/api/v1/reports/family-summary');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    const mine = response.body.data.find((row) => row.memberType === 'owner');
    expect(mine.activeMedicines).toBe(1);
    expect(mine.dosesToday).toHaveProperty('taken');
  });
});
