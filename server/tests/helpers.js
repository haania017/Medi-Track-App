import request from 'supertest';
import { prepareApp } from '../src/app.js';
import User from '../src/models/User.js';
import FamilyMember from '../src/models/FamilyMember.js';
import Medicine from '../src/models/Medicine.js';

let appPromise;

export function getApp() {
  if (!appPromise) appPromise = prepareApp();
  return appPromise;
}

export async function api() {
  return request(await getApp());
}

/** A supertest agent keeps the auth cookie between requests, like a browser. */
export async function asAgent() {
  const app = await getApp();
  return request.agent(app);
}

let userCounter = 0;

export async function registerUser(agent, overrides = {}) {
  userCounter += 1;
  const payload = {
    name: overrides.name || `Test User ${userCounter}`,
    email: overrides.email || `user${userCounter}@example.test`,
    password: overrides.password || 'Password123',
    timezone: overrides.timezone || 'UTC',
    termsAccepted: true,
  };

  const response = await agent.post('/api/v1/auth/register').send(payload);
  if (response.status !== 201) {
    throw new Error(`Registration failed (${response.status}): ${JSON.stringify(response.body)}`);
  }

  const user = await User.findOne({ email: payload.email });
  const profile = await FamilyMember.findOne({ userId: user._id, memberType: 'owner' });

  return { user, profile, payload, response: response.body.data };
}

/** Create a managed child profile owned by the given user's family. */
export async function createManagedProfile(agent, familyId, overrides = {}) {
  const response = await agent
    .post(`/api/v1/families/${familyId}/members`)
    .send({
      name: overrides.name || 'Child Profile',
      relationship: overrides.relationship || 'Child',
      memberType: 'managed',
      ...overrides,
    });
  if (response.status !== 201) {
    throw new Error(`Managed profile creation failed (${response.status}): ${JSON.stringify(response.body)}`);
  }
  return response.body.data;
}

export async function createMedicine(agent, payload) {
  const response = await agent.post('/api/v1/medicines').send(payload);
  return response;
}

export async function fetchMedicineDoc(id) {
  return Medicine.findById(id);
}

export function getCookie(response, name = 'meditrack_token') {
  const cookies = response.headers['set-cookie'] || [];
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  return match ? match.split(';')[0] : null;
}
