import { afterEach, describe, expect, it } from 'vitest';
import { asAgent, registerUser, createManagedProfile } from './helpers.js';
import config from '../src/config/env.js';
import Medicine from '../src/models/Medicine.js';
import PrescriptionUpload from '../src/models/PrescriptionUpload.js';

// 1x1 PNG — the mock provider never decodes it, it only proves the upload path.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

const originalProvider = config.ocr.provider;

afterEach(() => {
  config.ocr.provider = originalProvider;
});

async function uploadScan(agent, profileId, { kind = 'prescription', buffer = PNG, filename = 'rx.png', mime = 'image/png' } = {}) {
  const request = agent.post('/api/v1/prescriptions/upload').field('profileId', profileId).field('kind', kind);
  if (buffer) request.attach('file', buffer, { filename, contentType: mime });
  return request;
}

describe('Prescription and package scanning', () => {
  it('accepts an upload but reports an honest "not configured" state', async () => {
    config.ocr.provider = 'none';
    const agent = await asAgent();
    const { profile } = await registerUser(agent);

    const upload = await uploadScan(agent, profile.id);
    expect(upload.status).toBe(201);
    expect(upload.body.data.upload.status).toBe('uploaded');
    expect(upload.body.data.provider.configured).toBe(false);
    expect(upload.body.data.provider.mode).toBe('manual');

    const extract = await agent.post(`/api/v1/prescriptions/${upload.body.data.upload.id}/extract`);
    expect(extract.status).toBe(200);
    expect(extract.body.data.draft.items).toHaveLength(0);
    expect(extract.body.data.draft.warnings.join(' ')).toMatch(/not performed|not configured/i);

    // Nothing was fabricated and no medicine exists.
    expect(await Medicine.countDocuments({})).toBe(0);

    // Confirming an empty draft must fail rather than create something.
    const confirm = await agent.post(`/api/v1/prescriptions/${upload.body.data.upload.id}/confirm`);
    expect(confirm.status).toBe(400);
  });

  it('rejects a missing or unsupported file', async () => {
    const agent = await asAgent();
    const { profile } = await registerUser(agent);

    const noFile = await uploadScan(agent, profile.id, { buffer: null });
    expect(noFile.status).toBe(400);

    const badType = await uploadScan(agent, profile.id, {
      filename: 'notes.txt',
      mime: 'text/plain',
    });
    expect(badType.status).toBe(400);
    expect(badType.body.error.message).toMatch(/unsupported file type/i);
  });

  it('requires review and explicit confirmation before creating medicines', async () => {
    config.ocr.provider = 'mock';
    const agent = await asAgent();
    const { profile } = await registerUser(agent);

    const upload = await uploadScan(agent, profile.id);
    const uploadId = upload.body.data.upload.id;

    const extract = await agent.post(`/api/v1/prescriptions/${uploadId}/extract`);
    expect(extract.status).toBe(200);

    const draft = extract.body.data.draft;
    expect(draft.items.length).toBeGreaterThan(0);
    expect(draft.warnings.join(' ')).toMatch(/simulated/i);
    expect(draft.items.every((item) => item.accepted === false)).toBe(true);

    // Extraction alone must never create medicines.
    expect(await Medicine.countDocuments({})).toBe(0);

    // Confirming with nothing selected is refused.
    const premature = await agent.post(`/api/v1/prescriptions/${uploadId}/confirm`);
    expect(premature.status).toBe(400);

    // The user reviews, corrects a value and accepts one item.
    const items = draft.items.map((item, index) =>
      index === 0
        ? { ...item, name: 'Amoxicillin', strength: '500', times: ['09:00', '21:00'], accepted: true }
        : { ...item, accepted: false },
    );
    const review = await agent.patch(`/api/v1/prescriptions/${uploadId}/review`).send({ items });
    expect(review.status).toBe(200);
    expect(review.body.data.draft.items[0].strength).toBe('500');

    const confirm = await agent.post(`/api/v1/prescriptions/${uploadId}/confirm`);
    expect(confirm.status).toBe(201);
    expect(confirm.body.data.createdMedicines).toHaveLength(1);
    expect(confirm.body.data.createdMedicines[0].name).toBe('Amoxicillin');

    const created = await Medicine.findOne({ name: 'Amoxicillin' });
    expect(created).toBeTruthy();
    expect(created.source).toBe('prescription-scan');
    expect(created.profileId.toString()).toBe(profile.id);
    expect(created.schedule.times).toEqual(['09:00', '21:00']);

    // The scan is now confirmed and cannot be confirmed twice.
    const again = await agent.post(`/api/v1/prescriptions/${uploadId}/confirm`);
    expect(again.status).toBe(409);

    const persisted = await PrescriptionUpload.findById(uploadId);
    expect(persisted.status).toBe('confirmed');
  });

  it('handles unreadable package details without inventing an expiry date', async () => {
    config.ocr.provider = 'mock';
    const agent = await asAgent();
    const { profile } = await registerUser(agent);

    const upload = await uploadScan(agent, profile.id, { kind: 'package' });
    const uploadId = upload.body.data.upload.id;

    const extract = await agent.post(`/api/v1/prescriptions/${uploadId}/extract`);
    const draft = extract.body.data.draft;

    expect(draft.kind).toBe('package');
    expect(draft.packageDetails.expiryDate).toBeNull();
    expect(draft.warnings.join(' ')).toMatch(/expiry date/i);
    expect(draft.warnings.join(' ')).toMatch(/manually/i);

    // Confirming a package with no name is refused: the user clears the
    // suggested name because it was wrong, and MediTrack will not save a blank.
    const cleared = await agent
      .patch(`/api/v1/prescriptions/${uploadId}/review`)
      .send({ packageDetails: { name: '' } });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.draft.packageDetails.expiryDate).toBeNull();

    const noName = await agent.post(`/api/v1/prescriptions/${uploadId}/confirm`);
    expect(noName.status).toBe(400);
    expect(noName.body.error.message).toMatch(/medicine name/i);

    // The user supplies the missing details themselves.
    const review = await agent.patch(`/api/v1/prescriptions/${uploadId}/review`).send({
      packageDetails: {
        name: 'Metformin',
        strength: '500',
        composition: 'Metformin hydrochloride 500 mg',
        expiryDate: new Date(Date.now() + 400 * 86400000).toISOString(),
        batchNumber: 'B-99',
        manufacturer: 'Demo Pharma',
      },
    });
    expect(review.status).toBe(200);

    const confirm = await agent.post(`/api/v1/prescriptions/${uploadId}/confirm`);
    expect(confirm.status).toBe(201);

    const medicine = await Medicine.findOne({ name: 'Metformin' });
    expect(medicine.source).toBe('package-scan');
    // Package scanning sets details only — it never determines a schedule.
    expect(medicine.schedule.type).toBe('as-needed');
    expect(medicine.batchNumber).toBe('B-99');
    expect(medicine.expiryDate).toBeTruthy();
  });

  it('keeps scan images private and lets the uploader delete them', async () => {
    config.ocr.provider = 'none';
    const agent = await asAgent();
    const { profile } = await registerUser(agent);

    const upload = await uploadScan(agent, profile.id);
    const uploadId = upload.body.data.upload.id;

    const file = await agent.get(`/api/v1/prescriptions/${uploadId}/file`);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toMatch(/image\/png/);

    const stranger = await asAgent();
    await registerUser(stranger);
    expect((await stranger.get(`/api/v1/prescriptions/${uploadId}/file`)).status).toBe(404);
    expect((await stranger.get(`/api/v1/prescriptions/${uploadId}/review`)).status).toBe(404);

    const deleted = await agent.delete(`/api/v1/prescriptions/${uploadId}`);
    expect(deleted.status).toBe(200);

    // Soft delete removes the binary and blocks further access.
    const afterDelete = await agent.get(`/api/v1/prescriptions/${uploadId}/file`);
    expect(afterDelete.status).toBe(404);
  });

  it('refuses uploads for a profile the user cannot manage', async () => {
    config.ocr.provider = 'none';
    const owner = await asAgent();
    const { profile } = await registerUser(owner);
    const child = await createManagedProfile(owner, profile.familyId);

    const stranger = await asAgent();
    await registerUser(stranger);

    const response = await uploadScan(stranger, child.id);
    expect(response.status).toBe(404);
  });
});
