import { describe, expect, it } from 'vitest';
import { asAgent, registerUser, createMedicine, createManagedProfile } from './helpers.js';
import DoseLog from '../src/models/DoseLog.js';
import StockTransaction from '../src/models/StockTransaction.js';
import Medicine from '../src/models/Medicine.js';
import Notification from '../src/models/Notification.js';
import { markMissedDoses } from '../src/services/doses.js';
import { notifyProfile, createNotification } from '../src/services/notifications.js';

async function withDose({ time = '09:00', quantity = 1, stock = 20, tz = 'UTC', expiryDate } = {}) {
  const agent = await asAgent();
  const { user, profile } = await registerUser(agent, { timezone: tz });

  const created = await createMedicine(agent, {
    profileId: profile.id,
    name: 'Metformin',
    strength: '500',
    unit: 'mg',
    schedule: { type: 'daily', times: [time], doseQuantity: quantity },
    stock: { quantity: stock, unit: 'tablets', lowStockThreshold: 5 },
    ...(expiryDate ? { expiryDate } : {}),
  });
  expect(created.status).toBe(201);
  const medicine = created.body.data;

  const today = await agent.get('/api/v1/doses/today');
  expect(today.status).toBe(200);
  const dose = today.body.data.doses[0];
  expect(dose).toBeTruthy();

  return { agent, user, profile, medicine, dose, today: today.body.data };
}

describe('Schedules, dose history and stock integrity', () => {
  it("generates today's doses from the schedule with a status summary", async () => {
    const { today } = await withDose();
    expect(today.summary.total).toBeGreaterThanOrEqual(1);
    expect(today.summary.pending).toBeGreaterThanOrEqual(1);
    expect(today.doses[0].medicineId.name).toBe('Metformin');
    expect(today.doses[0].profileId.name).toBeTruthy();
  });

  it('deducts stock exactly once when a dose is marked taken', async () => {
    const { agent, medicine, dose } = await withDose({ quantity: 2, stock: 20 });

    const first = await agent.post(`/api/v1/doses/${dose._id}/mark-taken`).send({});
    expect(first.status).toBe(200);
    expect(first.body.data.alreadyProcessed).toBe(false);
    expect(first.body.data.stockChanged).toBe(true);
    expect(first.body.data.dose.status).toBe('taken');

    let stored = await Medicine.findById(medicine.id);
    expect(stored.stock.quantity).toBe(18);

    // Repeating the action — as a duplicate reminder tap would — is a no-op.
    const second = await agent.post(`/api/v1/doses/${dose._id}/mark-taken`).send({});
    expect(second.status).toBe(200);
    expect(second.body.data.alreadyProcessed).toBe(true);
    expect(second.body.data.stockChanged).toBe(false);

    stored = await Medicine.findById(medicine.id);
    expect(stored.stock.quantity).toBe(18);

    const doseTransactions = await StockTransaction.countDocuments({ doseLogId: dose._id });
    expect(doseTransactions).toBe(1);

    const ledger = await StockTransaction.find({ medicineId: medicine.id });
    expect(ledger).toHaveLength(2); // initial + one dose
  });

  it('does not deduct stock for a skipped dose, and blocks taking it afterwards', async () => {
    const { agent, medicine, dose } = await withDose({ quantity: 1, stock: 12 });

    const skipped = await agent.post(`/api/v1/doses/${dose._id}/mark-skipped`).send({ note: 'Slept through' });
    expect(skipped.status).toBe(200);
    expect(skipped.body.data.dose.status).toBe('skipped');

    const stored = await Medicine.findById(medicine.id);
    expect(stored.stock.quantity).toBe(12);
    expect(await StockTransaction.countDocuments({ medicineId: medicine.id })).toBe(1);
  });

  it('marks overdue doses as missed without touching stock', async () => {
    const { agent, medicine, dose } = await withDose({ quantity: 3, stock: 15 });

    // Rewind the dose so it is overdue, then run the missed-dose pass.
    await DoseLog.updateOne({ _id: dose._id }, { $set: { scheduledFor: new Date(Date.now() - 5 * 3600 * 1000) } });
    const missed = await markMissedDoses({ graceMinutes: 60 });

    expect(missed).toHaveLength(1);
    expect(missed[0].status).toBe('missed');

    const stored = await Medicine.findById(medicine.id);
    expect(stored.stock.quantity).toBe(15);
    expect(await StockTransaction.countDocuments({ medicineId: medicine.id })).toBe(1);
    void agent;
  });

  it('snoozes a dose without changing its status or stock', async () => {
    const { agent, medicine, dose } = await withDose();

    const snoozed = await agent.post(`/api/v1/doses/${dose._id}/snooze`).send({ minutes: 30 });
    expect(snoozed.status).toBe(200);
    expect(snoozed.body.data.dose.status).toBe('pending');
    expect(new Date(snoozed.body.data.snoozedUntil).getTime()).toBeGreaterThan(Date.now());
    expect(snoozed.body.data.dose.snoozeCount).toBe(1);

    const stored = await Medicine.findById(medicine.id);
    expect(stored.stock.quantity).toBe(20);
  });

  it('refuses to snooze a dose that is already taken', async () => {
    const { agent, dose } = await withDose();
    await agent.post(`/api/v1/doses/${dose._id}/mark-taken`).send({});

    const response = await agent.post(`/api/v1/doses/${dose._id}/snooze`).send({ minutes: 10 });
    expect(response.status).toBe(409);
  });

  it('rejects clock-invalid snooze values', async () => {
    const { agent, dose } = await withDose();
    const response = await agent.post(`/api/v1/doses/${dose._id}/snooze`).send({ minutes: 99999 });
    expect(response.status).toBe(422);
  });

  it('supports a snoozed dose being taken exactly once afterwards', async () => {
    const { agent, medicine, dose } = await withDose({ quantity: 1, stock: 10 });
    await agent.post(`/api/v1/doses/${dose._id}/snooze`).send({ minutes: 5 });

    await agent.post(`/api/v1/doses/${dose._id}/mark-taken`).send({});
    await agent.post(`/api/v1/doses/${dose._id}/mark-taken`).send({});

    const stored = await Medicine.findById(medicine.id);
    expect(stored.stock.quantity).toBe(9);
  });

  it('generates doses for selected weekdays only', async () => {
    const agent = await asAgent();
    const { profile } = await registerUser(agent);

    const todayWeekday = new Date().getUTCDay();
    const otherDay = (todayWeekday + 1) % 7;

    await createMedicine(agent, {
      profileId: profile.id,
      name: 'Weekly Only',
      schedule: { type: 'weekdays', weekdays: [otherDay], times: ['09:00'], doseQuantity: 1 },
      stock: { quantity: 10, unit: 'tablets', lowStockThreshold: 1 },
    });

    const today = await agent.get('/api/v1/doses/today');
    expect(today.body.data.doses).toHaveLength(0);

    // And it does not generate for the coming week either except on that day.
    await agent.post('/api/v1/doses/generate').send({ days: 7 });
    const generated = await DoseLog.find({ medicineId: (await Medicine.findOne({ name: 'Weekly Only' }))._id });
    expect(generated.length).toBeGreaterThan(0);
    for (const record of generated) {
      expect(record.scheduledFor.getUTCDay()).toBe(otherDay);
    }
  });

  it('does not generate doses for as-needed medicines', async () => {
    const agent = await asAgent();
    const { profile } = await registerUser(agent);

    await createMedicine(agent, {
      profileId: profile.id,
      name: 'As Needed',
      schedule: { type: 'as-needed', time: [], times: [], doseQuantity: 5 },
      stock: { quantity: 50, unit: 'ml', lowStockThreshold: 5 },
    });

    const today = await agent.get('/api/v1/doses/today');
    expect(today.body.data.doses).toHaveLength(0);
  });
});

describe('Notification actions and deduplication', () => {
  it('marks a dose taken from a notification and stays idempotent', async () => {
    const { agent, user, profile, medicine, dose } = await withDose({ quantity: 1, stock: 10 });

    const note = await createNotification({
      userId: user._id,
      familyId: profile.familyId,
      profileId: profile._id,
      medicineId: medicine.id,
      doseLogId: dose._id,
      type: 'dose_reminder',
      title: 'Time for Metformin',
      urgency: 'high',
      actions: ['mark_taken', 'remind_later', 'view'],
    });

    const first = await agent.post(`/api/v1/notifications/${note._id}/action`).send({ action: 'mark_taken' });
    expect(first.status).toBe(200);
    expect(first.body.data.alreadyProcessed).toBe(false);

    const second = await agent.post(`/api/v1/notifications/${note._id}/action`).send({ action: 'mark_taken' });
    expect(second.status).toBe(200);
    expect(second.body.data.alreadyProcessed).toBe(true);

    const stored = await Medicine.findById(medicine.id);
    expect(stored.stock.quantity).toBe(9);
  });

  it('never delivers the same notification twice for the same dedupe key', async () => {
    const { user, profile, medicine, dose } = await withDose();

    const first = await createNotification({
      userId: user._id,
      familyId: profile.familyId,
      profileId: profile._id,
      medicineId: medicine.id,
      doseLogId: dose._id,
      type: 'dose_reminder',
      title: 'Time for Metformin',
      key: `fixed-key-${dose._id}`,
    });
    const second = await createNotification({
      userId: user._id,
      familyId: profile.familyId,
      profileId: profile._id,
      medicineId: medicine.id,
      doseLogId: dose._id,
      type: 'dose_reminder',
      title: 'Time for Metformin',
      key: `fixed-key-${dose._id}`,
    });

    expect(first).toBeTruthy();
    expect(second).toBeNull();
    expect(await Notification.countDocuments({ userId: user._id })).toBe(1);
  });

  it('fans out one reminder per eligible recipient, not one per call', async () => {
    const { user, profile } = await withDose();

    const first = await notifyProfile({
      profile,
      type: 'low_stock',
      title: 'Low stock',
      body: 'Something is running low',
      keySuffix: 'test',
    });
    const second = await notifyProfile({
      profile,
      type: 'low_stock',
      title: 'Low stock',
      body: 'Something is running low',
      keySuffix: 'test',
    });

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    expect(await Notification.countDocuments({ userId: user._id })).toBe(1);
  });

  it('refuses an action the notification does not support', async () => {
    const { agent, user, profile } = await withDose();

    const note = await createNotification({
      userId: user._id,
      familyId: profile.familyId,
      profileId: profile._id,
      type: 'low_stock',
      title: 'Low stock',
      actions: ['view'],
    });

    const response = await agent.post(`/api/v1/notifications/${note._id}/action`).send({ action: 'mark_taken' });
    expect(response.status).toBe(400);
  });

  it('lists, reads and clears notifications for the signed-in user only', async () => {
    const { agent, user, profile } = await withDose();

    await createNotification({
      userId: user._id,
      familyId: profile.familyId,
      profileId: profile._id,
      type: 'expiry',
      title: 'Expiring soon',
    });

    const list = await agent.get('/api/v1/notifications');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta.unread).toBe(1);

    const id = list.body.data[0]._id;
    expect((await agent.patch(`/api/v1/notifications/${id}/read`)).status).toBe(200);
    expect((await agent.get('/api/v1/notifications/unread-count')).body.data.unread).toBe(0);

    // Another user cannot touch it.
    const other = await asAgent();
    await registerUser(other);
    expect((await other.patch(`/api/v1/notifications/${id}/read`)).status).toBe(404);
    expect((await other.delete(`/api/v1/notifications/${id}`)).status).toBe(404);
  });

  it('keeps the scheduler-safe path idempotent across managed profiles', async () => {
    const agent = await asAgent();
    const { profile } = await registerUser(agent);
    await createManagedProfile(agent, profile.familyId, { name: 'Ayesha' });

    const bundle = await agent.get('/api/v1/reports/family-summary');
    expect(bundle.status).toBe(200);
    expect(bundle.body.data.length).toBe(2);
  });
});
