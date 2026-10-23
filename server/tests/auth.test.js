import { describe, expect, it } from 'vitest';
import { asAgent, registerUser, getCookie } from './helpers.js';
import User from '../src/models/User.js';
import Family from '../src/models/Family.js';
import FamilyMember from '../src/models/FamilyMember.js';

describe('Authentication', () => {
  it('registers a user, hashes the password and bootstraps a family workspace', async () => {
    const agent = await asAgent();
    const email = 'new.person@example.test';

    const response = await agent
      .post('/api/v1/auth/register')
      .send({ name: 'New Person', email, password: 'Password123', timezone: 'Europe/London' });

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe(email);
    expect(response.body.data.user).not.toHaveProperty('passwordHash');

    const stored = await User.findOne({ email }).select('+passwordHash');
    expect(stored.passwordHash).toBeTruthy();
    expect(stored.passwordHash).not.toBe('Password123');
    expect(stored.passwordHash.startsWith('$2')).toBe(true);

    const family = await Family.findOne({ ownerId: stored._id });
    expect(family).toBeTruthy();

    const ownerProfile = await FamilyMember.findOne({ userId: stored._id, memberType: 'owner' });
    expect(ownerProfile).toBeTruthy();
    expect(ownerProfile.familyId.toString()).toBe(family._id.toString());
  });

  it('issues an HttpOnly session cookie on login', async () => {
    const agent = await asAgent();
    const { payload } = await registerUser(agent);

    const fresh = await asAgent();
    const login = await fresh
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: payload.password });

    expect(login.status).toBe(200);
    const cookie = getCookie(login);
    expect(cookie).toBeTruthy();

    const rawCookie = (login.headers['set-cookie'] || []).find((c) => c.includes('meditrack_token'));
    expect(rawCookie).toMatch(/HttpOnly/i);
    expect(rawCookie).toMatch(/SameSite/i);
  });

  it('rejects a duplicate email with 409', async () => {
    const agent = await asAgent();
    const { payload } = await registerUser(agent);

    const other = await asAgent();
    const response = await other
      .post('/api/v1/auth/register')
      .send({ name: 'Someone Else', email: payload.email, password: 'Password123' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('validates registration input', async () => {
    const agent = await asAgent();
    const response = await agent
      .post('/api/v1/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    const paths = response.body.error.details.map((d) => d.path);
    expect(paths).toContain('email');
    expect(paths).toContain('password');
    expect(paths).toContain('name');
  });

  it('uses the same message for unknown email and wrong password', async () => {
    const agent = await asAgent();
    const { payload } = await registerUser(agent);

    const unknown = await asAgent();
    const res1 = await unknown
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.test', password: 'Password123' });
    const res2 = await unknown
      .post('/api/v1/auth/login')
      .send({ email: payload.email, password: 'WrongPassword1' });

    expect(res1.status).toBe(401);
    expect(res2.status).toBe(401);
    expect(res1.body.error.message).toBe(res2.body.error.message);
  });

  it('requires authentication for protected endpoints', async () => {
    const anon = await asAgent();
    const me = await anon.get('/api/v1/auth/me');
    expect(me.status).toBe(401);

    const medicines = await anon.get('/api/v1/medicines');
    expect(medicines.status).toBe(401);

    const doses = await anon.get('/api/v1/doses/today');
    expect(doses.status).toBe(401);
  });

  it('returns the current user and clears the cookie on logout', async () => {
    const agent = await asAgent();
    const { payload } = await registerUser(agent);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(payload.email);

    const logout = await agent.post('/api/v1/auth/logout');
    expect(logout.status).toBe(200);

    const after = await agent.get('/api/v1/auth/me');
    expect(after.status).toBe(401);
  });

  it('updates profile preferences and validates timezones', async () => {
    const agent = await asAgent();
    await registerUser(agent);

    const updated = await agent
      .patch('/api/v1/users/me')
      .send({ name: 'Renamed Person', timezone: 'Asia/Karachi' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.user.name).toBe('Renamed Person');
    expect(updated.body.data.user.timezone).toBe('Asia/Karachi');

    const invalid = await agent.patch('/api/v1/users/me').send({ timezone: 'Mars/Olympus' });
    expect(invalid.status).toBe(400);
  });

  it('persists appearance and notification preferences', async () => {
    const agent = await asAgent();
    await registerUser(agent);

    const response = await agent.patch('/api/v1/users/me/preferences').send({
      appearance: { mode: 'dark', lightPalette: 'ocean', darkPalette: 'violet-night' },
      notificationPreferences: { lowStock: false },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.user.appearance.mode).toBe('dark');
    expect(response.body.data.user.appearance.darkPalette).toBe('violet-night');
    expect(response.body.data.user.notificationPreferences.lowStock).toBe(false);

    const bad = await agent
      .patch('/api/v1/users/me/preferences')
      .send({ appearance: { darkPalette: 'not-a-palette' } });
    expect(bad.status).toBe(422);
  });
});
