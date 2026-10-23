import { describe, expect, it } from 'vitest';
import { asAgent, registerUser, createMedicine } from './helpers.js';
import User from '../src/models/User.js';
import Medicine from '../src/models/Medicine.js';

describe('Account and data deletion', () => {
  it('requires a password and rejects an incorrect one', async () => {
    const agent = await asAgent();
    const { payload, profile } = await registerUser(agent);
    await createMedicine(agent, { profileId: profile.id, name: 'Metformin' });

    const noPassword = await agent.delete('/api/v1/users/me').send({});
    expect(noPassword.status).toBe(400);

    const wrong = await agent.delete('/api/v1/users/me').send({ password: 'WrongPassword1' });
    expect(wrong.status).toBe(401);

    // Nothing was deleted by a failed attempt.
    expect(await Medicine.countDocuments({ name: 'Metformin' })).toBe(1);
    expect(await User.findOne({ email: payload.email })).toBeTruthy();
  });

  it('permanently deletes the account and the data it owns', async () => {
    const agent = await asAgent();
    const { payload, profile } = await registerUser(agent);
    await createMedicine(agent, { profileId: profile.id, name: 'Metformin' });

    // A different family's records must survive untouched.
    const stranger = await asAgent();
    const strangerReg = await registerUser(stranger);
    await createMedicine(stranger, { profileId: strangerReg.profile.id, name: 'KeepMe' });

    const response = await agent.delete('/api/v1/users/me').send({ password: payload.password });
    expect(response.status).toBe(200);
    expect(response.body.data.success).toBe(true);

    // The account row and its medicines are gone.
    expect(await User.findOne({ email: payload.email })).toBeNull();
    expect(await Medicine.countDocuments({ name: 'Metformin' })).toBe(0);

    // Other families are untouched.
    expect(await Medicine.countDocuments({ name: 'KeepMe' })).toBe(1);

    // The session is invalidated.
    expect((await agent.get('/api/v1/users/me')).status).toBe(401);
  });
});
