import { describe, expect, it } from 'vitest';
import { asAgent, registerUser, createManagedProfile, createMedicine } from './helpers.js';
import Medicine from '../src/models/Medicine.js';

describe('Family permissions and data isolation', () => {
  it('never exposes another family profile or medicine', async () => {
    const owner = await asAgent();
    const { user: ownerUser, profile: ownerProfile } = await registerUser(owner);

    const child = await createManagedProfile(owner, ownerProfile.familyId);
    const created = await createMedicine(owner, {
      profileId: child.id,
      name: 'Amoxicillin',
      strength: '250',
      unit: 'mg',
      stock: { quantity: 20, unit: 'ml', lowStockThreshold: 5 },
    });
    expect(created.status).toBe(201);
    const medicineId = created.body.data.id;

    const stranger = await asAgent();
    await registerUser(stranger);

    // Cross-family reads and writes must be indistinguishable from "not found".
    expect((await stranger.get(`/api/v1/medicines/${medicineId}`)).status).toBe(404);
    expect((await stranger.patch(`/api/v1/medicines/${medicineId}`).send({ name: 'Hacked' })).status).toBe(404);
    expect((await stranger.post(`/api/v1/medicines/${medicineId}/archive`)).status).toBe(404);
    expect((await stranger.get(`/api/v1/family-members/${child.id}`)).status).toBe(404);
    expect((await stranger.get(`/api/v1/families/${ownerProfile.familyId}`)).status).toBe(404);

    // The medicine is untouched.
    const stored = await Medicine.findById(medicineId);
    expect(stored.name).toBe('Amoxicillin');

    // And the stranger's own medicine list is empty.
    const list = await stranger.get('/api/v1/medicines');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(0);
    void ownerUser;
  });

  it('ignores client-supplied familyId when creating medicines', async () => {
    const owner = await asAgent();
    const { profile: ownerProfile } = await registerUser(owner);
    const child = await createManagedProfile(owner, ownerProfile.familyId);

    const stranger = await asAgent();
    const { profile: strangerProfile } = await registerUser(stranger);

    // The stranger tries to plant a medicine into the owner's family by id,
    // but spells the profile as their own: it must land in their own family.
    const response = await createMedicine(stranger, {
      profileId: strangerProfile.id,
      familyId: ownerProfile.familyId,
      name: 'Injected',
      stock: { quantity: 1, unit: 'tablets', lowStockThreshold: 0 },
    });

    expect(response.status).toBe(201);
    const stored = await Medicine.findById(response.body.data.id);
    expect(stored.familyId.toString()).toBe(strangerProfile.familyId.toString());
    void child;
  });

  it('honours granular permissions for a connected adult account', async () => {
    const owner = await asAgent();
    const { profile: ownerProfile } = await registerUser(owner);
    const child = await createManagedProfile(owner, ownerProfile.familyId);

    const created = await createMedicine(owner, {
      profileId: child.id,
      name: 'Salbutamol',
      strength: '100',
      unit: 'mcg',
      schedule: { type: 'daily', times: ['08:00'], doseQuantity: 1 },
      stock: { quantity: 30, unit: 'doses', lowStockThreshold: 5 },
    });
    const medicineId = created.body.data.id;

    const adultEmail = 'grandparent@example.test';
    const invite = await owner.post(`/api/v1/families/${ownerProfile.familyId}/members`).send({
      name: 'Grandparent',
      relationship: 'Father',
      memberType: 'adult',
      invitedEmail: adultEmail,
    });
    expect(invite.status).toBe(201);
    expect(invite.body.data.status).toBe('invited');

    // The invited adult signs up with the matching email and accepts.
    const adult = await asAgent();
    await registerUser(adult, { email: adultEmail, name: 'Grandparent' });

    const invitations = await adult.get('/api/v1/family-members/invitations');
    expect(invitations.status).toBe(200);
    expect(invitations.body.data).toHaveLength(1);

    const accept = await adult.post(`/api/v1/family-members/${invite.body.data.id}/accept`);
    expect(accept.status).toBe(200);
    expect(accept.body.data.status).toBe('active');

    // viewRecords is on by default: reading is allowed.
    expect((await adult.get(`/api/v1/medicines/${medicineId}`)).status).toBe(200);

    // Writing is not granted yet.
    const denied = await adult.post('/api/v1/medicines').send({ profileId: child.id, name: 'Unauthorised' });
    expect(denied.status).toBe(403);

    // Only the family owner can change permissions.
    const selfGrant = await adult
      .patch(`/api/v1/family-members/${invite.body.data.id}/permissions`)
      .send({ manageMedicines: true });
    expect(selfGrant.status).toBe(403);

    const grant = await owner
      .patch(`/api/v1/family-members/${invite.body.data.id}/permissions`)
      .send({ manageMedicines: true, markDoses: true });
    expect(grant.status).toBe(200);
    expect(grant.body.data.permissions.manageMedicines).toBe(true);

    const nowAllowed = await adult
      .post('/api/v1/medicines')
      .send({ profileId: child.id, name: 'Ibuprofen', stock: { quantity: 10, unit: 'tablets', lowStockThreshold: 3 } });
    expect(nowAllowed.status).toBe(201);

    // The owner can revoke the connection entirely.
    const revoke = await owner.delete(`/api/v1/family-members/${invite.body.data.id}`);
    expect(revoke.status).toBe(200);

    const afterRevoke = await adult.get(`/api/v1/medicines/${medicineId}`);
    expect(afterRevoke.status).toBe(404);
  });

  it('keeps managed profiles isolated from each other', async () => {
    const owner = await asAgent();
    const { profile: ownerProfile } = await registerUser(owner);

    const childA = await createManagedProfile(owner, ownerProfile.familyId, { name: 'Ayesha' });
    const childB = await createManagedProfile(owner, ownerProfile.familyId, { name: 'Bilal' });

    await createMedicine(owner, {
      profileId: childA.id,
      name: "Ayesha's medicine",
      stock: { quantity: 10, unit: 'tablets', lowStockThreshold: 2 },
    });
    await createMedicine(owner, {
      profileId: childB.id,
      name: "Bilal's medicine",
      stock: { quantity: 10, unit: 'tablets', lowStockThreshold: 2 },
    });

    const forA = await owner.get(`/api/v1/medicines?profileId=${childA.id}`);
    expect(forA.body.data).toHaveLength(1);
    expect(forA.body.data[0].name).toBe("Ayesha's medicine");

    const forB = await owner.get(`/api/v1/medicines?profileId=${childB.id}`);
    expect(forB.body.data).toHaveLength(1);
    expect(forB.body.data[0].name).toBe("Bilal's medicine");
  });

  it('requires the owner to manage the family itself', async () => {
    const owner = await asAgent();
    const { profile: ownerProfile } = await registerUser(owner);

    const intruder = await asAgent();
    await registerUser(intruder);

    const response = await intruder
      .post(`/api/v1/families/${ownerProfile.familyId}/members`)
      .send({ name: 'Sneaky', memberType: 'managed' });

    expect(response.status).toBe(404);
  });
});
