import config from '../config/env.js';
import logger from '../utils/logger.js';
import { newId } from '../utils/ids.js';

/**
 * OCR / text-extraction provider adapter.
 *
 * This service only READS text that is printed or written on the page or
 * packaging. It never identifies a medicine from its appearance, shape, colour
 * or branding, and it never infers a value that is not present in the image.
 * Anything it returns is a candidate that the user must review and confirm.
 *
 * Providers:
 *   none   → not configured; caller offers manual entry (never fabricates data)
 *   mock   → deterministic sample output for local demos and automated tests ONLY
 *   openai → real text extraction via an OpenAI-compatible chat completions API
 *
 * Every result carries `configured` and `provider` so the UI can be honest about
 * where data came from. Extracted values are always candidates requiring review.
 */

const CONFIDENCE_FLOOR = 0.45;

export function ocrStatus() {
  const provider = config.ocr.provider;
  if (provider === 'openai') {
    return {
      provider,
      configured: Boolean(config.ocr.apiKey),
      mode: 'live',
      message: config.ocr.apiKey
        ? 'Vision extraction is configured.'
        : 'OCR_PROVIDER=openai but OCR_API_KEY is missing.',
    };
  }
  if (provider === 'mock') {
    return {
      provider,
      configured: true,
      mode: 'simulated',
      message: 'Simulated extraction provider — returns sample data for demos and tests only.',
    };
  }
  return {
    provider: 'none',
    configured: false,
    mode: 'manual',
    message:
      'No text-extraction (OCR) provider is configured. You can still add medicines manually, or set OCR_PROVIDER + OCR_API_KEY to enable scanning.',
  };
}

const PRESCRIPTION_PROMPT = `You are reading a photo of a medical prescription.
Transcribe ONLY the text that is legibly written. You do NOT identify a medicine
from how it looks, from partial words, or from its packaging.
Do not guess, invent, or infer dosages.
Return strict JSON with this shape:
{"items":[{"name":"","strength":"","unit":"mg","form":"tablet","instructions":"","times":["HH:mm"],"durationDays":null,"confidence":0.0,"uncertain":true,"sourceText":""}],
 "warnings":["..."]}
Rules:
- "name" must be a word actually written on the page, not a guess at what it might be.
- If a field is illegible, use an empty string (or null for durationDays) and set "uncertain": true.
- Never propose a dosage or treatment plan that is not written on the page.
- "times" must only be filled when explicit clock times or clear day-parts are written.
- confidence is 0..1 for the overall legibility of that item.`;

const PACKAGE_PROMPT = `You are reading a photo of medicine packaging (box, bottle, blister pack or label).
Extract ONLY legible printed text. Never identify the medicine and never invent values.
Return strict JSON with this shape:
{"package":{"name":"","strength":"","composition":"","manufacturingDate":"YYYY-MM-DD or null","expiryDate":"YYYY-MM-DD or null","batchNumber":"","manufacturer":""},
 "confidence":0.0,
 "warnings":["..."]}
Rules:
- Return a field only when the text is actually printed and readable in the image.
- Do NOT infer the medicine from its shape, colour, logo or branding.
- If the expiry date is unreadable or ambiguous, set expiryDate to null and add a warning asking for a clearer photo or manual entry.
- Distinguish manufacturing date from expiry date carefully.`;

async function callVision({ buffer, mimeType, prompt }) {
  const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
  const response = await fetch(`${config.ocr.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ocr.apiKey}`,
    },
    body: JSON.stringify({
      model: config.ocr.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OCR provider responded ${response.status}: ${text.slice(0, 300)}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OCR provider returned an empty response.');
  return JSON.parse(content);
}

function normaliseItem(raw, kind) {
  const times = Array.isArray(raw.times)
    ? raw.times.filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t)))
    : [];
  return {
    tempId: newId(),
    name: String(raw.name || '').trim(),
    strength: String(raw.strength || '').trim(),
    unit: String(raw.unit || 'mg').trim() || 'mg',
    form: String(raw.form || (kind === 'package' ? 'other' : 'tablet')).toLowerCase(),
    instructions: String(raw.instructions || '').trim(),
    quantity: 1,
    times,
    scheduleType: times.length ? 'daily' : 'as-needed',
    durationDays: Number.isFinite(raw.durationDays) ? raw.durationDays : null,
    confidence: clamp01(raw.confidence ?? 0.5),
    uncertain: raw.uncertain !== false,
    sourceText: String(raw.sourceText || '').trim(),
    accepted: false,
  };
}

const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));

/** Extract candidate medicines from a prescription image. */
export async function extractPrescription({ buffer, mimeType }) {
  const status = ocrStatus();

  if (status.provider === 'none' || (status.provider === 'openai' && !status.configured)) {
    return {
      configured: false,
      provider: status.provider,
      items: [],
      warnings: [status.message, 'Extraction was not performed. Please enter the details manually.'],
      extractedAt: new Date(),
    };
  }

  if (status.provider === 'mock') {
    return {
      configured: true,
      simulated: true,
      provider: 'mock',
      items: [
        {
          tempId: newId(),
          name: 'Amoxicillin',
          strength: '500',
          unit: 'mg',
          form: 'capsule',
          instructions: 'Take one capsule after food',
          quantity: 1,
          times: ['09:00', '21:00'],
          scheduleType: 'daily',
          durationDays: 5,
          confidence: 0.62,
          uncertain: true,
          sourceText: 'Amoxicillin 500mg cap — 1 cap BD x 5 days',
          accepted: false,
        },
        {
          tempId: newId(),
          name: 'Paracetamol',
          strength: '500',
          unit: 'mg',
          form: 'tablet',
          instructions: '',
          quantity: 1,
          times: [],
          scheduleType: 'as-needed',
          durationDays: null,
          confidence: 0.38,
          uncertain: true,
          sourceText: 'paracetamol (illegible)',
          accepted: false,
        },
      ],
      warnings: [
        'SIMULATED DATA — this is sample output from the mock provider, not a real reading of your image.',
        'Review every field before confirming.',
      ],
      extractedAt: new Date(),
    };
  }

  try {
    const json = await callVision({ buffer, mimeType, prompt: PRESCRIPTION_PROMPT });
    const items = Array.isArray(json.items) ? json.items.map((i) => normaliseItem(i, 'prescription')) : [];
    const warnings = Array.isArray(json.warnings) ? json.warnings.map(String) : [];
    if (items.some((i) => i.confidence < CONFIDENCE_FLOOR)) {
      warnings.push('One or more items were hard to read — please verify them carefully.');
    }
    if (!items.length) warnings.push('No medicine names could be read. Try a clearer photo or enter manually.');
    return {
      configured: true,
      provider: 'openai',
      model: config.ocr.model,
      items,
      warnings,
      extractedAt: new Date(),
    };
  } catch (err) {
    logger.error('Prescription extraction failed:', err.message);
    return {
      configured: true,
      provider: 'openai',
      items: [],
      warnings: [`Extraction failed: ${err.message}`, 'Please enter the details manually.'],
      failed: true,
      extractedAt: new Date(),
    };
  }
}

/** Extract candidate details from a medicine package photo. */
export async function extractPackage({ buffer, mimeType }) {
  const status = ocrStatus();

  if (status.provider === 'none' || (status.provider === 'openai' && !status.configured)) {
    return {
      configured: false,
      provider: status.provider,
      package: emptyPackage(),
      warnings: [status.message, 'Extraction was not performed. Please enter the details manually.'],
      extractedAt: new Date(),
    };
  }

  if (status.provider === 'mock') {
    return {
      configured: true,
      simulated: true,
      provider: 'mock',
      confidence: 0.55,
      package: {
        name: 'Metformin',
        strength: '500',
        composition: 'Metformin hydrochloride 500 mg',
        manufacturingDate: null,
        expiryDate: null,
        batchNumber: 'BATCH-DEMO-001',
        manufacturer: '',
      },
      warnings: [
        'SIMULATED DATA — sample output from the mock provider, not a real reading of your image.',
        'Expiry date could not be determined. Please photograph the expiry panel clearly or enter it manually.',
      ],
      extractedAt: new Date(),
    };
  }

  try {
    const json = await callVision({ buffer, mimeType, prompt: PACKAGE_PROMPT });
    const pkg = json.package || {};
    const warnings = Array.isArray(json.warnings) ? json.warnings.map(String) : [];
    const expiryDate = parseDate(pkg.expiryDate);
    if (!expiryDate) {
      warnings.push(
        'Expiry date is unreadable or missing. Please take another photo of the expiry panel or enter it manually.',
      );
    }
    return {
      configured: true,
      provider: 'openai',
      model: config.ocr.model,
      confidence: clamp01(json.confidence),
      package: {
        name: String(pkg.name || '').trim(),
        strength: String(pkg.strength || '').trim(),
        composition: String(pkg.composition || '').trim(),
        manufacturingDate: parseDate(pkg.manufacturingDate),
        expiryDate,
        batchNumber: String(pkg.batchNumber || '').trim(),
        manufacturer: String(pkg.manufacturer || '').trim(),
      },
      warnings,
      extractedAt: new Date(),
    };
  } catch (err) {
    logger.error('Package extraction failed:', err.message);
    return {
      configured: true,
      provider: 'openai',
      package: emptyPackage(),
      warnings: [`Extraction failed: ${err.message}`, 'Please enter the details manually.'],
      failed: true,
      extractedAt: new Date(),
    };
  }
}

function emptyPackage() {
  return {
    name: '',
    strength: '',
    composition: '',
    manufacturingDate: null,
    expiryDate: null,
    batchNumber: '',
    manufacturer: '',
  };
}

/** Parse a date only when it is unambiguous; otherwise return null (never guess). */
function parseDate(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) return null;
  const [, y, m, d] = match;
  const month = Number(m);
  const day = Number(d || 1);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(Number(y), month - 1, day));
}

export default { ocrStatus, extractPrescription, extractPackage };
