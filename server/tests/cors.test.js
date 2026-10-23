import { afterEach, describe, expect, it } from 'vitest';
import { api } from './helpers.js';
import config from '../src/config/env.js';
import { buildAllowedOrigins, normaliseOrigin } from '../src/app.js';

const DEPLOYED = 'https://medi-track-indol-seven.vercel.app';
const originalClientOrigin = config.clientOrigin;

afterEach(() => {
  config.clientOrigin = originalClientOrigin;
});

describe('CORS configuration', () => {
  it('answers the preflight for the deployed frontend, with credentials', async () => {
    const request = await api();
    const res = await request
      .options('/api/v1/auth/login')
      .set('Origin', DEPLOYED)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(DEPLOYED);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
  });

  it('allows normal API requests from the deployed frontend', async () => {
    const request = await api();
    const res = await request.get('/api/v1/health').set('Origin', DEPLOYED);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(DEPLOYED);
  });

  it('does not 500 for an unknown origin, and sends no CORS headers', async () => {
    const request = await api();
    const res = await request.get('/api/v1/health').set('Origin', 'https://not-allowed.example');

    // The old code threw "Not allowed by CORS" here, producing a 500.
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not apply the API CORS check to asset requests', async () => {
    const request = await api();
    const res = await request
      .get('/assets/index-abc123.js')
      .set('Origin', 'https://not-allowed.example');

    // Assets are not API paths: this must never be a CORS 500.
    expect(res.status).not.toBe(500);
  });

  it('normalises trailing slashes, case and whitespace', () => {
    expect(normaliseOrigin(' https://App.Example/ ')).toBe('https://app.example');
  });

  it('accepts a CLIENT_ORIGIN that has a trailing slash', () => {
    config.clientOrigin = 'https://example-app.vercel.app/';
    expect(buildAllowedOrigins().has('https://example-app.vercel.app')).toBe(true);
  });

  it('accepts a comma-separated CLIENT_ORIGIN list', () => {
    config.clientOrigin = 'https://one.example, https://two.example/';
    const allowed = buildAllowedOrigins();
    expect(allowed.has('https://one.example')).toBe(true);
    expect(allowed.has('https://two.example')).toBe(true);
  });

  it('always allows the localhost dev origins', () => {
    config.clientOrigin = 'https://only-this.example';
    const allowed = buildAllowedOrigins();
    expect(allowed.has('http://localhost:5173')).toBe(true);
    expect(allowed.has('http://127.0.0.1:5173')).toBe(true);
  });
});
