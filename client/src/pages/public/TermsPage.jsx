import { Section } from '../../components/public/Section';

const TERMS = [
  {
    title: 'What MediTrack is',
    body: 'MediTrack is a personal record-keeping tool for organising medicines, schedules, stock and expiry dates. It is provided as a demonstration reference implementation.',
  },
  {
    title: 'What MediTrack is not',
    body: 'It is not a medical device, a diagnostic tool, a prescribing system or a substitute for professional medical advice. Nothing shown in the app constitutes medical advice.',
  },
  {
    title: 'Your responsibilities',
    body: 'You are responsible for the accuracy of what you enter, for checking the medicine details against the original prescription or packaging, and for following the instructions of your healthcare professional.',
  },
  {
    title: 'Manual entry',
    body: 'Medicines are added by hand — you type and confirm every value. Name suggestions come from a small reference sample and are never applied automatically; a medicine that is not in the sample can still be entered.',
  },
  {
    title: 'Third-party services',
    body: 'When a medicine information source is configured, the medicine name is sent to that provider to fetch reference details. If no provider is configured, that feature reports an unavailable state rather than inventing data.',
  },
  {
    title: 'No warranty',
    body: 'This demonstration is provided "as is", without warranty of any kind. Do not rely on it as your only record for critical medication.',
  },
];

export function TermsPage() {
  return (
    <Section
      eyebrow="Terms"
      title="Terms of use (demonstration)"
      description="Sample terms for a reference implementation. Have them reviewed before any real deployment."
    >
      <ol className="space-y-4">
        {TERMS.map((item, index) => (
          <li key={item.title} className="card p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-fg">
                {index + 1}
              </span>
              <div>
                <h2 className="text-sm font-semibold text-content">{item.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-8 max-w-3xl rounded-xl border border-warning/30 bg-warning-soft p-4 text-xs leading-relaxed text-content">
        For medical concerns, consult a qualified healthcare professional. In an emergency, contact your
        local emergency service immediately.
      </p>
    </Section>
  );
}

export default TermsPage;
