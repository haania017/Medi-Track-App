import config from '../config/env.js';
import logger from '../utils/logger.js';
import MedicineInfoCache from '../models/MedicineInfoCache.js';
import UserAllergy from '../models/UserAllergy.js';

/**
 * Trusted medicine information adapter.
 *
 * Providers:
 *   none   → no reliable source configured; returns an explicit unavailable state
 *   rxnorm → NIH RxNorm (generic/brand names, active ingredients)
 *   mock   → deterministic fixture data for tests only
 *
 * IMPORTANT: this module never invents ingredients, side effects or citations.
 * If a source cannot supply a field, the field is returned empty and listed in
 * `unavailableFields`.
 */

const normalise = (value) => String(value || '').trim().toLowerCase();

export function medicineInfoStatus() {
  const provider = config.medicineInfo.provider;
  if (provider === 'rxnorm') {
    return {
      provider,
      configured: true,
      mode: 'live',
      message: 'Medicine information is retrieved from NIH RxNorm.',
      sourceName: 'NIH RxNorm',
      sourceUrl: 'https://rxnav.nlm.nih.gov/',
    };
  }
  if (provider === 'mock') {
    return {
      provider,
      configured: true,
      mode: 'simulated',
      message: 'Simulated medicine information provider — fixture data for tests only.',
      sourceName: 'MediTrack test fixture',
      sourceUrl: '',
    };
  }
  return {
    provider: 'none',
    configured: false,
    mode: 'unavailable',
    message:
      'No trusted medicine information source is configured. Detailed medicine information is unavailable.',
    sourceName: '',
    sourceUrl: '',
  };
}

function cacheKey(name, strength) {
  return `${normalise(name)}::${normalise(strength)}`;
}

async function getCached(key) {
  const entry = await MedicineInfoCache.findOne({ key });
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt.getTime() < Date.now()) return null;
  return entry;
}

export async function lookupMedicineInfo({ name, strength = '', force = false }) {
  const status = medicineInfoStatus();
  const key = cacheKey(name, strength);

  if (!force) {
    const cached = await getCached(key);
    if (cached) return shapeFromCache(cached, status);
  }

  if (!status.configured) {
    return {
      ...status,
      available: false,
      medicineName: name,
      strength,
      ingredients: [],
      brandNames: [],
      genericName: '',
      commonSideEffects: [],
      unavailableFields: ['ingredients', 'commonSideEffects', 'brandNames'],
      unavailableReason: status.message,
      retrievedAt: new Date(),
    };
  }

  let payload;
  try {
    payload = status.provider === 'mock' ? mockLookup(name, strength) : await rxnormLookup(name);
  } catch (err) {
    logger.warn('Medicine information lookup failed:', err.message);
    return {
      ...status,
      available: false,
      medicineName: name,
      strength,
      ingredients: [],
      brandNames: [],
      genericName: '',
      commonSideEffects: [],
      unavailableFields: ['ingredients', 'commonSideEffects', 'brandNames'],
      unavailableReason: `Lookup failed: ${err.message}`,
      retrievedAt: new Date(),
    };
  }

  const expiresAt = new Date(Date.now() + config.medicineInfo.cacheTtlHours * 3600 * 1000);
  await MedicineInfoCache.findOneAndUpdate(
    { key },
    {
      $set: {
        key,
        medicineName: name,
        strength,
        matchedName: payload.matchedName || '',
        matchConfidence: payload.matchConfidence ?? 0,
        available: payload.available !== false,
        source: payload.source || status.sourceName,
        sourceUrl: payload.sourceUrl || status.sourceUrl,
        payload,
        retrievedAt: new Date(),
        expiresAt,
      },
    },
    { upsert: true, new: true },
  );

  return {
    ...status,
    available: payload.available !== false,
    medicineName: name,
    strength,
    genericName: payload.genericName || '',
    brandNames: payload.brandNames || [],
    ingredients: payload.ingredients || [],
    commonSideEffects: payload.commonSideEffects || [],
    matchedName: payload.matchedName || '',
    matchConfidence: payload.matchConfidence ?? 0,
    source: payload.source || status.sourceName,
    sourceUrl: payload.sourceUrl || status.sourceUrl,
    unavailableFields: payload.unavailableFields || [],
    unavailableReason: payload.unavailableReason || '',
    retrievedAt: new Date(),
  };
}

function shapeFromCache(entry, status) {
  const p = entry.payload || {};
  return {
    ...status,
    cached: true,
    available: entry.available,
    medicineName: entry.medicineName,
    strength: entry.strength,
    genericName: p.genericName || '',
    brandNames: p.brandNames || [],
    ingredients: p.ingredients || [],
    commonSideEffects: p.commonSideEffects || [],
    matchedName: entry.matchedName,
    matchConfidence: entry.matchConfidence,
    source: entry.source,
    sourceUrl: entry.sourceUrl,
    unavailableFields: p.unavailableFields || [],
    unavailableReason: p.unavailableReason || '',
    retrievedAt: entry.retrievedAt,
  };
}

async function rxnormLookup(name) {
  const base = config.medicineInfo.baseUrl.replace(/\/$/, '');
  const url = `${base}/drugs.json?name=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`RxNorm responded ${res.status}`);
  const json = await res.json();

  const groups = json?.drugGroup?.conceptGroup || [];
  const concepts = groups.flatMap((g) => g.conceptProperties || []);
  if (!concepts.length) {
    return {
      available: false,
      matchedName: '',
      matchConfidence: 0,
      source: 'NIH RxNorm',
      sourceUrl: 'https://rxnav.nlm.nih.gov/',
      unavailableFields: ['ingredients', 'brandNames', 'commonSideEffects'],
      unavailableReason: `No reliable RxNorm match was found for "${name}".`,
    };
  }

  const guest = decodeURIComponent(json?.drugGroup?.name || '');
  const target = normalise(guest || name);
  const exact = concepts.find((c) => normalise(c.name) === target) || concepts[0];
  const matchedName = exact.name;

  // Active ingredients
  let ingredients = [];
  try {
    const relRes = await fetch(`${base}/rxcui/${exact.rxcui}/allrelated.json`, {
      headers: { Accept: 'application/json' },
    });
    if (relRes.ok) {
      const rel = await relRes.json();
      const groupsRel = rel?.allRelatedGroup?.conceptGroup || [];
      ingredients = groupsRel
        .filter((g) => g.tty === 'IN' || g.tty === 'PIN')
        .flatMap((g) => (g.conceptProperties || []).map((c) => c.name));
    }
  } catch (err) {
    logger.warn('RxNorm ingredient lookup failed:', err.message);
  }

  const brandNames = concepts
    .filter((c) => normalise(c.name) !== normalise(matchedName))
    .map((c) => c.name)
    .slice(0, 8);

  return {
    available: true,
    matchedName,
    matchConfidence: normalise(matchedName) === target ? 0.95 : 0.7,
    source: 'NIH RxNorm',
    sourceUrl: `https://rxnav.nlm.nih.gov/REST/rxcui/${exact.rxcui}/properties.json`,
    genericName: ingredients[0] || matchedName,
    ingredients: [...new Set(ingredients)],
    brandNames: [...new Set(brandNames)],
    // RxNorm does not publish side-effect data; we say so rather than invent it.
    commonSideEffects: [],
    unavailableFields: ['commonSideEffects'],
    unavailableReason: '',
  };
}

function mockLookup(name, strength) {
  return {
    available: true,
    matchedName: name,
    matchConfidence: 0.9,
    source: 'MediTrack test fixture',
    sourceUrl: '',
    genericName: name,
    ingredients: [name],
    brandNames: [],
    commonSideEffects: [],
    unavailableFields: ['commonSideEffects'],
    unavailableReason: '',
    strength,
  };
}

/**
 * Match a user's voluntarily recorded allergies against known ingredients.
 * This is an informational match, NOT a diagnosis, and never changes therapy.
 */
export async function matchAllergies({ userId, profileId, info }) {
  const filter = { userId, active: true };
  if (profileId) filter.$or = [{ profileId }, { profileId: null }];
  const allergies = await UserAllergy.find(filter).lean();
  if (!allergies.length) return [];

  const haystacks = [
    info?.matchedName,
    info?.genericName,
    ...(info?.ingredients || []),
    ...(info?.brandNames || []),
  ]
    .filter(Boolean)
    .map(normalise);

  if (!haystacks.length) return [];

  const matches = [];
  for (const allergy of allergies) {
    const needle = normalise(allergy.allergen);
    if (!needle) continue;
    const hit = haystacks.some((h) => h === needle || h.includes(needle) || needle.includes(h));
    if (hit) {
      matches.push({
        allergyId: allergy._id,
        allergen: allergy.allergen,
        severity: allergy.severity,
        reaction: allergy.reaction,
        recordedAt: allergy.recordedAt,
        // Explicit framing so the UI can distinguish this from a diagnosis.
        kind: 'recorded-allergy-match',
        guidance:
          allergy.severity === 'severe'
            ? 'You recorded a severe allergy to this ingredient. Seek urgent medical care for any reaction and speak to a pharmacist or doctor before use.'
            : 'You recorded this allergy yourself. This is not a diagnosis — check with a pharmacist or doctor before use.',
      });
    }
  }
  return matches;
}

export default { medicineInfoStatus, lookupMedicineInfo, matchAllergies };
