import { describe, expect, it } from 'vitest';
import { asAgent, registerUser, createMedicine } from './helpers.js';

describe('API validation, errors and health', () => {
  it('exposes a health check with integration status', async () => {
    const agent = await asAgent();
    const response = await agent.get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('connected');
    expect(response.body.integrations.ocr).toHaveProperty('configured');
    expect(response.body.integrations.push).toHaveProperty('configured');
  });

  it('returns a structured 404 for unknown routes', async () => {
    const agent = await asAgent();
    const response = await agent.get('/api/v1/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toMatch(/does not exist/i);
  });

  it('reports field-level validation details', async () => {
    const agent = await asAgent();
    const { profile } = await registerUser(agent);

    const response = await createMedicine(agent, {
      profileId: profile.id,
      name: '',
      form: 'not-a-form',
      schedule: { type: 'daily', times: ['99:99'] },
    });

    expect(response.status).toBe(422);
    const paths = response.body.error.details.map((d) => d.path);
    expect(paths).toContain('name');
    expect(paths).toContain('form');
    expect(paths.some((p) => p.startsWith('schedule'))).toBe(true);
  });

  it('rejects an invalid ObjectId in a path parameter', async () => {
    const agent = await asAgent();
    await registerUser(agent);

    const response = await agent.get('/api/v1/medicines/not-an-object-id');
    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/invalid/i);
  });

  it('enforces pagination bounds', async () => {
    const agent = await asAgent();
    const { profile } = await registerUser(agent);
    await createMedicine(agent, { profileId: profile.id, name: 'One', stock: { quantity: 1, unit: 'tablets', lowStockThreshold: 0 } });

    const ok = await agent.get('/api/v1/medicines?page=1&limit=50');
    expect(ok.status).toBe(200);
    expect(ok.body.meta.limit).toBe(50);
    expect(ok.body.meta).toHaveProperty('totalPages');
    expect(ok.body.meta).toHaveProperty('hasMore');

    const tooBig = await agent.get('/api/v1/medicines?limit=5000');
    expect(tooBig.status).toBe(422);
  });

  it('never leaks password hashes or storage keys in responses', async () => {
    const agent = await asAgent();
    const { profile } = await registerUser(agent);

    const me = await agent.get('/api/v1/auth/me');
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
    expect(JSON.stringify(me.body)).not.toContain('$2a$');
    expect(JSON.stringify(me.body)).not.toContain('$2b$');

    const workspace = await agent.get('/api/v1/users/me/workspace');
    expect(JSON.stringify(workspace.body)).not.toContain('passwordHash');

    const medicine = await createMedicine(agent, {
      profileId: profile.id,
      name: 'Safe',
      stock: { quantity: 1, unit: 'tablets', lowStockThreshold: 0 },
    });
    expect(JSON.stringify(medicine.body)).not.toContain('createdByUserId');
  });

  it('scopes the stored file directory outside any statically served path', async () => {
    const { default: config } = await import('../src/config/env.js');
    expect(config.uploadDir).toMatch(/storage[\\/]uploads$/);
  });

  it('requires a valid body on preference updates', async () => {
    const agent = await asAgent();
    await registerUser(agent);

    const response = await agent
      .patch('/api/v1/users/me/preferences')
      .send({ appearance: { mode: 'sepia' } });
    expect(response.status).toBe(422);
  });

  it('rejects an unauthenticated write', async () => {
    const agent = await asAgent();
    const response = await agent.post('/api/v1/medicines').send({ name: 'Anonymous' });
    expect(response.status).toBe(401);
  });
});
