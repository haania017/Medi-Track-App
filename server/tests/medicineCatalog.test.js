import { describe, expect, it } from 'vitest';
import { asAgent, registerUser } from './helpers.js';

describe('Medicine reference catalogue (autocomplete)', () => {
  it('requires authentication', async () => {
    const agent = await asAgent();
    const response = await agent.get('/api/v1/medicine-info/search?q=Pan');
    expect(response.status).toBe(401);
  });

  it('suggests brand-name matches while typing (e.g. "Pan" → Panadol)', async () => {
    const agent = await asAgent();
    await registerUser(agent);

    const response = await agent.get('/api/v1/medicine-info/search?q=Pan');
    expect(response.status).toBe(200);

    const names = response.body.data.map((item) => item.brandName);
    expect(names).toContain('Panadol');
    // Brand-prefix matches should rank first.
    expect(names[0]).toMatch(/^Panadol/);

    // Every suggestion carries the fields needed to populate the form.
    for (const item of response.body.data) {
      expect(item).toHaveProperty('brandName');
      expect(item).toHaveProperty('genericName');
      expect(item).toHaveProperty('form');
    }
  });

  it('supports searching by generic name', async () => {
    const agent = await asAgent();
    await registerUser(agent);

    const response = await agent.get('/api/v1/medicine-info/search?q=paracetamol');
    const brandNames = response.body.data.map((item) => item.brandName);
    const genericNames = response.body.data.map((item) => item.genericName);
    expect(brandNames).toContain('Panadol');
    expect(genericNames).toContain('Paracetamol');
  });

  it('distinguishes different strengths/forms and never auto-selects', async () => {
    const agent = await asAgent();
    await registerUser(agent);

    const response = await agent.get('/api/v1/medicine-info/search?q=brufen');
    // The response is a list of candidates, not a single chosen medicine.
    expect(Array.isArray(response.body.data)).toBe(true);
    const strengths = response.body.data.map((item) => item.strength);
    expect(new Set(strengths).size).toBe(strengths.length);
    expect(strengths).toContain('200');
    expect(strengths).toContain('400');
  });

  it('returns an empty list and a limitation note for an unknown query', async () => {
    const agent = await asAgent();
    await registerUser(agent);

    const response = await agent.get('/api/v1/medicine-info/search?q=zzzznotamedicine');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    // The catalogue is honest about not being a complete registry.
    expect(response.body.meta.catalog.limitations).toMatch(/not a complete|limited sample/i);
  });

  it('honours the limit parameter', async () => {
    const agent = await asAgent();
    await registerUser(agent);

    const response = await agent.get('/api/v1/medicine-info/search?q=a&limit=3');
    expect(response.body.data.length).toBeLessThanOrEqual(3);
  });
});
