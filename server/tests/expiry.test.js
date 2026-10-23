import { describe, expect, it } from 'vitest';
import { asAgent, registerUser, createMedicine } from './helpers.js';
import Notification from '../src/models/Notification.js';
import { runSchedulerTick } from '../src/jobs/scheduler.js';

const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

async function setup() {
  const agent = await asAgent();
  const { profile } = await registerUser(agent);
  return { agent, profileId: profile.id };
}

describe('Expiry report includes a missing-expiry list', () => {
  it('reports medicines without an expiry date separately from expired ones', async () => {
    const { agent, profileId } = await setup();

    await createMedicine(agent, { profileId, name: 'NoDate', strength: '500' });
    await createMedicine(agent, { profileId, name: 'Soon', expiryDate: inDays(10) });
    await createMedicine(agent, { profileId, name: 'Old', expiryDate: inDays(-10) });

    const report = await agent.get('/api/v1/reports/expiry?days=30');
    expect(report.status).toBe(200);

    const missingNames = report.body.data.missingExpiry.map((m) => m.name);
    const expiringNames = report.body.data.expiring.map((m) => m.name);
    const expiredNames = report.body.data.expired.map((m) => m.name);

    expect(missingNames).toEqual(['NoDate']);
    expect(expiringNames).toContain('Soon');
    expect(expiredNames).toContain('Old');

    // A missing date is never counted as expired.
    expect(expiredNames).not.toContain('NoDate');
    expect(report.body.data.counts.missingExpiry).toBe(1);
    expect(report.body.data.missingExpiryGuidance).toMatch(/neither expired nor confirmed safe/i);
  });

  it('moves a medicine out of the missing list once an expiry date is added', async () => {
    const { agent, profileId } = await setup();
    const created = await createMedicine(agent, { profileId, name: 'Later', strength: '5' });
    const id = created.body.data.id;

    let report = await agent.get('/api/v1/reports/expiry?days=30');
    expect(report.body.data.missingExpiry.map((m) => m.name)).toContain('Later');

    const patched = await agent.patch(`/api/v1/medicines/${id}`).send({ expiryDate: inDays(400) });
    expect(patched.status).toBe(200);

    report = await agent.get('/api/v1/reports/expiry?days=30');
    expect(report.body.data.missingExpiry.map((m) => m.name)).not.toContain('Later');
    expect(report.body.data.counts.missingExpiry).toBe(0);
  });

  it('keeps user records isolated', async () => {
    const { agent, profileId } = await setup();
    await createMedicine(agent, { profileId, name: 'Mine' });

    const stranger = await asAgent();
    await registerUser(stranger);

    const report = await stranger.get('/api/v1/reports/expiry?days=30');
    expect(report.body.data.missingExpiry).toHaveLength(0);
  });
});

describe('Expiry notifications never fire without a recorded date', () => {
  it('skips medicines with no expiry date and still alerts on ones that have one', async () => {
    const { agent, profileId } = await setup();

    await createMedicine(agent, {
      profileId,
      name: 'NoDate',
      schedule: { type: 'daily', times: ['09:00'] },
    });
    await createMedicine(agent, {
      profileId,
      name: 'ExpiringSoon',
      expiryDate: inDays(5),
      schedule: { type: 'daily', times: ['09:00'] },
    });

    await runSchedulerTick({ now: new Date() });

    const expiryNotes = await Notification.find({ type: 'expiry' }).lean();
    const titles = expiryNotes.map((n) => n.title).join(' | ');
    expect(titles).toMatch(/ExpiringSoon/);
    expect(titles).not.toMatch(/NoDate/);
  });
});
