import { afterEach, describe, expect, it } from 'vitest';
import { asAgent, registerUser, createMedicine } from './helpers.js';
import config from '../src/config/env.js';

const originalProvider = config.medicineInfo.provider;

afterEach(() => {
  config.medicineInfo.provider = originalProvider;
});

async function withMedicine(name = 'Metformin') {
  const agent = await asAgent();
  const { profile } = await registerUser(agent);
  const created = await createMedicine(agent, {
    profileId: profile.id,
    name,
    strength: '500',
    unit: 'mg',
    stock: { quantity: 30, unit: 'tablets', lowStockThreshold: 5 },
  });
  return { agent, profile, medicine: created.body.data };
}

describe('Medicine information', () => {
  it('reports an unavailable state with no invented data when no source is configured', async () => {
    config.medicineInfo.provider = 'none';
    const { agent, medicine } = await withMedicine();

    const status = await agent.get('/api/v1/medicine-info/status');
    expect(status.status).toBe(200);
    expect(status.body.data.configured).toBe(false);
    expect(status.body.data.mode).toBe('unavailable');

    const response = await agent.get(`/api/v1/medicine-info/${medicine.id}`);
    expect(response.status).toBe(200);
    expect(response.body.data.info.available).toBe(false);
    expect(response.body.data.info.ingredients).toEqual([]);
    expect(response.body.data.info.commonSideEffects).toEqual([]);
    expect(response.body.data.info.unavailableReason).toMatch(/no trusted medicine information source/i);
    expect(response.body.data.disclaimers.notDiagnosis).toMatch(/does not diagnose/i);
  });

  it('returns sourced information and labels its origin when a source is configured', async () => {
    config.medicineInfo.provider = 'mock';
    const { agent, medicine } = await withMedicine();

    const response = await agent.get(`/api/v1/medicine-info/${medicine.id}`);
    expect(response.status).toBe(200);
    expect(response.body.data.info.available).toBe(true);
    expect(response.body.data.info.source).toBeTruthy();
    expect(response.body.data.info.ingredients).toContain('Metformin');
  });

  it('keeps medicine information off the dashboard and out of the medicine detail payload', async () => {
    config.medicineInfo.provider = 'mock';
    const { agent, medicine } = await withMedicine();

    const detail = await agent.get(`/api/v1/medicines/${medicine.id}`);
    expect(detail.status).toBe(200);
    // Details are a separate, intentional request — not bundled into the record.
    expect(detail.body.data).not.toHaveProperty('info');
    expect(detail.body.data.medicine).not.toHaveProperty('ingredients');
    expect(detail.body.data.medicine).not.toHaveProperty('commonSideEffects');

    const dashboardDoses = await agent.get('/api/v1/doses/today');
    expect(dashboardDoses.body.data.doses.every((d) => !('ingredients' in d))).toBe(true);

    const summary = await agent.get('/api/v1/stock/summary');
    expect(summary.body.data).not.toHaveProperty('medicineInfo');
  });

  it('never exposes medicine information for another family', async () => {
    config.medicineInfo.provider = 'mock';
    const { medicine } = await withMedicine();

    const stranger = await asAgent();
    await registerUser(stranger);
    expect((await stranger.get(`/api/v1/medicine-info/${medicine.id}`)).status).toBe(404);
  });
});

describe('Recorded allergies', () => {
  it('stores allergies the user records and matches them as a labelled reminder', async () => {
    config.medicineInfo.provider = 'mock';
    const { agent, profile, medicine } = await withMedicine('Metformin');

    const created = await agent.post('/api/v1/allergies').send({
      allergen: 'Metformin',
      allergenType: 'drug',
      severity: 'moderate',
      reaction: 'Rash',
      profileId: profile.id,
    });
    expect(created.status).toBe(201);

    const list = await agent.get('/api/v1/allergies');
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta.disclaimer).toMatch(/does not diagnose allergies/i);

    const info = await agent.get(`/api/v1/medicine-info/${medicine.id}`);
    expect(info.body.data.allergyMatches).toHaveLength(1);

    const match = info.body.data.allergyMatches[0];
    expect(match.allergen).toBe('Metformin');
    // Explicitly framed as the user's own record, never a diagnosis.
    expect(match.kind).toBe('recorded-allergy-match');
    expect(match.guidance).toMatch(/not a diagnosis|seek urgent/i);
    expect(info.body.data.disclaimers.allergyMatchIsNotDiagnosis).toMatch(/not a diagnosis/i);
  });

  it('gives stronger guidance for a recorded severe allergy', async () => {
    config.medicineInfo.provider = 'mock';
    const { agent, profile, medicine } = await withMedicine('Penicillin');

    await agent.post('/api/v1/allergies').send({
      allergen: 'Penicillin',
      severity: 'severe',
      reaction: 'Anaphylaxis',
      profileId: profile.id,
    });

    const info = await agent.get(`/api/v1/medicine-info/${medicine.id}`);
    expect(info.body.data.allergyMatches[0].guidance).toMatch(/urgent/i);
  });

  it('updates and deletes a recorded allergy, scoped to its owner', async () => {
    const agent = await asAgent();
    await registerUser(agent);
    const created = await agent
      .post('/api/v1/allergies')
      .send({ allergen: 'Ibuprofen', severity: 'mild' });
    const id = created.body.data._id;

    const updated = await agent.patch(`/api/v1/allergies/${id}`).send({ severity: 'moderate' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.severity).toBe('moderate');

    const stranger = await asAgent();
    await registerUser(stranger);
    expect((await stranger.patch(`/api/v1/allergies/${id}`).send({ severity: 'severe' })).status).toBe(404);
    expect((await stranger.delete(`/api/v1/allergies/${id}`)).status).toBe(404);

    expect((await agent.delete(`/api/v1/allergies/${id}`)).status).toBe(200);
    expect((await agent.get('/api/v1/allergies')).body.data).toHaveLength(0);
  });
});
