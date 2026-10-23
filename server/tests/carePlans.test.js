import { describe, expect, it } from 'vitest';
import { asAgent, registerUser, createManagedProfile, createMedicine } from './helpers.js';
import CarePlan from '../src/models/CarePlan.js';
import DoseLog from '../src/models/DoseLog.js';
import Medicine from '../src/models/Medicine.js';

async function setupPlan() {
  const agent = await asAgent();
  const { profile } = await registerUser(agent);
  const child = await createManagedProfile(agent, profile.familyId, { name: 'Ayesha' });

  const created = await createMedicine(agent, {
    profileId: child.id,
    name: 'Amoxicillin',
    strength: '250',
    unit: 'mg',
    schedule: { type: 'daily', times: ['09:00'], doseQuantity: 1 },
    stock: { quantity: 30, unit: 'ml', lowStockThreshold: 5 },
  });

  const planResponse = await agent.post('/api/v1/care-plans').send({
    profileId: child.id,
    title: 'Chest infection course',
    purpose: 'Short antibiotic course',
    startDate: new Date().toISOString(),
    reviewDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    medicineIds: [created.body.data.id],
    notes: 'Review if fever returns',
  });

  expect(planResponse.status).toBe(201);
  return { agent, profile, child, medicineId: created.body.data.id, plan: planResponse.body.data };
}

describe('Temporary care plans', () => {
  it('creates a plan and lists it for the right profile', async () => {
    const { agent, child, plan } = await setupPlan();
    expect(plan.status).toBe('active');
    expect(plan.history[0].action).toBe('created');

    const list = await agent.get('/api/v1/care-plans');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].title).toBe('Chest infection course');
    expect(list.body.data[0].profileId.name).toBe(child.name);

    const detail = await agent.get(`/api/v1/care-plans/${plan.id}`);
    expect(detail.body.data.medicines).toHaveLength(1);
  });

  it('rejects a review date before the start date', async () => {
    const agent = await asAgent();
    const { profile } = await registerUser(agent);
    const child = await createManagedProfile(agent, profile.familyId);

    const response = await agent.post('/api/v1/care-plans').send({
      profileId: child.id,
      title: 'Impossible',
      startDate: new Date().toISOString(),
      reviewDate: new Date(Date.now() - 86400000).toISOString(),
    });
    expect(response.status).toBe(400);
  });

  it('continues a plan by extending the review date, keeping history', async () => {
    const { agent, plan } = await setupPlan();

    const response = await agent.post(`/api/v1/care-plans/${plan.id}/review`).send({
      decision: 'continue',
      outcome: 'Symptoms improved, continue for one more week.',
      extendedReviewDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('active');

    const stored = await CarePlan.findById(plan.id);
    expect(stored.history).toHaveLength(2);
    expect(stored.history[1].action).toBe('continued');
    expect(stored.history[1].previousReviewDate).toBeTruthy();
    expect(stored.lastReviewedAt).toBeTruthy();
  });

  it('closes a plan, stops future reminders and preserves all history', async () => {
    const { agent, plan, medicineId, child } = await setupPlan();

    // Generate doses, then record one as taken so there is history to preserve.
    await agent.get('/api/v1/doses/today');
    const doses = await DoseLog.find({ medicineId }).sort({ scheduledFor: 1 });
    expect(doses.length).toBeGreaterThan(0);
    await agent.post(`/api/v1/doses/${doses[0]._id}/mark-taken`).send({});

    const doseCountBefore = await DoseLog.countDocuments({ medicineId });

    const response = await agent.post(`/api/v1/care-plans/${plan.id}/review`).send({
      decision: 'complete',
      outcome: 'Course finished',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.plan.status).toBe('completed');
    expect(response.body.data.pausedMedicines).toHaveLength(1);
    expect(response.body.data.note).toMatch(/preserved/i);

    // The medicine is paused (future reminders stop) but still exists.
    const medicine = await Medicine.findById(medicineId);
    expect(medicine).toBeTruthy();
    expect(medicine.status).toBe('paused');

    // Pending future doses are cleared; history is untouched.
    const pendingFuture = await DoseLog.countDocuments({
      medicineId,
      status: 'pending',
      scheduledFor: { $gte: new Date() },
    });
    expect(pendingFuture).toBe(0);
    expect(await DoseLog.countDocuments({ medicineId })).toBeLessThanOrEqual(doseCountBefore);
    expect(await DoseLog.countDocuments({ medicineId, status: 'taken' })).toBe(1);

    // The profile itself is never deleted.
    expect(child.id).toBeTruthy();
    const profileStillThere = await agent.get(`/api/v1/family-members/${child.id}`);
    expect(profileStillThere.status).toBe(200);
  });

  it('refuses to review a plan that is already closed', async () => {
    const { agent, plan } = await setupPlan();
    await agent.post(`/api/v1/care-plans/${plan.id}/review`).send({ decision: 'complete' });

    const again = await agent.post(`/api/v1/care-plans/${plan.id}/review`).send({ decision: 'continue' });
    expect(again.status).toBe(409);

    const reopen = await agent.patch(`/api/v1/care-plans/${plan.id}`).send({ status: 'active' });
    expect(reopen.status).toBe(409);
  });

  it('does not expose a care plan to another family', async () => {
    const { plan } = await setupPlan();

    const stranger = await asAgent();
    await registerUser(stranger);
    expect((await stranger.get(`/api/v1/care-plans/${plan.id}`)).status).toBe(404);

    const list = await stranger.get('/api/v1/care-plans');
    expect(list.body.data).toHaveLength(0);
  });
});
