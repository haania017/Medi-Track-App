/**
 * Small, curated medicine reference sample used for autocomplete.
 *
 * This is deliberately NOT a complete registry. It is a short list of commonly
 * dispensed medicines, entered here so manual entry can be faster and more
 * consistent. It is intended as a starting point that could later be replaced
 * by an official source such as the DRAP registered-products list.
 *
 * Rules for maintaining this list:
 *   - Record only fields we are confident about (brand name, generic name,
 *     strength, dosage form). Leave a field out rather than guessing.
 *   - Do NOT record a manufacturer unless it is unambiguous.
 *   - The app must never claim this sample represents every medicine available
 *     in Pakistan, and it must never imply two similar names are interchangeable.
 *
 * Each entry is one concrete brand + strength + form, so different strengths and
 * forms of the same brand appear as separate, clearly distinguishable rows.
 */

export const CATALOG_META = {
  source: 'MediTrack curated reference sample',
  description:
    'A short curated sample of commonly dispensed medicines. It is provided to speed up manual entry and make names and strengths consistent.',
  limitations:
    'This is a limited sample, not a complete or official list. It does not represent every medicine registered or available in Pakistan, and it is not medical advice. Always check the actual package or prescription.',
  lastUpdated: '2025-01',
};

const entry = (brandName, genericName, strength, form) => ({
  brandName,
  genericName,
  strength,
  form,
});

export const MEDICINE_CATALOG = [
  entry('Panadol', 'Paracetamol', '500', 'tablet'),
  entry('Panadol Extra', 'Paracetamol + Caffeine', '500/65', 'tablet'),
  entry('Panadol Suspension', 'Paracetamol', '120/5', 'suspension'),
  entry('Calpol', 'Paracetamol', '120/5', 'suspension'),
  entry('Disprin', 'Aspirin', '300', 'tablet'),
  entry('Brufen', 'Ibuprofen', '200', 'tablet'),
  entry('Brufen', 'Ibuprofen', '400', 'tablet'),
  entry('Brufen', 'Ibuprofen', '600', 'tablet'),
  entry('Ponstan', 'Mefenamic acid', '250', 'capsule'),
  entry('Ponstan', 'Mefenamic acid', '500', 'tablet'),
  entry('Ponstan Suspension', 'Mefenamic acid', '50/5', 'suspension'),
  entry('Augmentin', 'Amoxicillin + Clavulanic acid', '625', 'tablet'),
  entry('Augmentin', 'Amoxicillin + Clavulanic acid', '1 g', 'tablet'),
  entry('Augmentin Suspension', 'Amoxicillin + Clavulanic acid', '228/5', 'suspension'),
  entry('Amoxil', 'Amoxicillin', '250', 'capsule'),
  entry('Amoxil', 'Amoxicillin', '500', 'capsule'),
  entry('Velosef', 'Cephradine', '500', 'capsule'),
  entry('Ceclor', 'Cefaclor', '250', 'capsule'),
  entry('Klacid', 'Clarithromycin', '250', 'tablet'),
  entry('Klacid', 'Clarithromycin', '500', 'tablet'),
  entry('Ciproxin', 'Ciprofloxacin', '250', 'tablet'),
  entry('Ciproxin', 'Ciprofloxacin', '500', 'tablet'),
  entry('Flagyl', 'Metronidazole', '200', 'tablet'),
  entry('Flagyl', 'Metronidazole', '400', 'tablet'),
  entry('Glucophage', 'Metformin', '500', 'tablet'),
  entry('Glucophage', 'Metformin', '850', 'tablet'),
  entry('Glucophage', 'Metformin', '1000', 'tablet'),
  entry('Lipitor', 'Atorvastatin', '10', 'tablet'),
  entry('Lipitor', 'Atorvastatin', '20', 'tablet'),
  entry('Lipitor', 'Atorvastatin', '40', 'tablet'),
  entry('Norvasc', 'Amlodipine', '5', 'tablet'),
  entry('Norvasc', 'Amlodipine', '10', 'tablet'),
  entry('Tenormin', 'Atenolol', '50', 'tablet'),
  entry('Tenormin', 'Atenolol', '100', 'tablet'),
  entry('Concor', 'Bisoprolol', '5', 'tablet'),
  entry('Concor', 'Bisoprolol', '10', 'tablet'),
  entry('Lasix', 'Furosemide', '40', 'tablet'),
  entry('Aldactone', 'Spironolactone', '25', 'tablet'),
  entry('Risek', 'Omeprazole', '20', 'capsule'),
  entry('Risek', 'Omeprazole', '40', 'capsule'),
  entry('Losec', 'Omeprazole', '20', 'capsule'),
  entry('Nexium', 'Esomeprazole', '20', 'tablet'),
  entry('Nexium', 'Esomeprazole', '40', 'tablet'),
  entry('Zantac', 'Ranitidine', '150', 'tablet'),
  entry('Motilium', 'Domperidone', '10', 'tablet'),
  entry('Zyrtec', 'Cetirizine', '10', 'tablet'),
  entry('Claritin', 'Loratadine', '10', 'tablet'),
  entry('Deltacortril', 'Prednisolone', '5', 'tablet'),
  entry('Ventolin Inhaler', 'Salbutamol', '100 mcg', 'inhaler'),
  entry('Ventolin Nebules', 'Salbutamol', '2.5 mg/2.5 ml', 'other'),
  entry('Insulin (regular)', 'Insulin human', '', 'injection'),
];

const normalise = (value) => String(value || '').trim().toLowerCase();

/**
 * Search the catalog by brand or generic name.
 * Brand-name prefix matches rank above generic-name matches; includes rank last.
 * Returns at most `limit` entries and never picks one for the user.
 */
export function searchMedicineCatalog(query, limit = 8) {
  const needle = normalise(query);
  if (!needle || needle.length < 1) return [];

  const scored = [];
  for (const item of MEDICINE_CATALOG) {
    const brand = normalise(item.brandName);
    const generic = normalise(item.genericName);

    let score = -1;
    if (brand.startsWith(needle)) score = 0;
    else if (brand.includes(needle)) score = 1;
    else if (generic.startsWith(needle)) score = 2;
    else if (generic.includes(needle)) score = 3;

    if (score >= 0) scored.push({ score, item });
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.item.brandName.localeCompare(b.item.brandName);
  });

  const seen = new Set();
  const results = [];
  for (const { item } of scored) {
    const key = `${normalise(item.brandName)}::${normalise(item.strength)}::${normalise(item.form)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ ...item, id: key });
    if (results.length >= limit) break;
  }
  return results;
}

export default { MEDICINE_CATALOG, CATALOG_META, searchMedicineCatalog };
