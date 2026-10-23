import { Section } from '../../components/public/Section';

const PRIVACY = [
  {
    title: 'What MediTrack stores',
    body: 'Your account details (name, email, hashed password, timezone and preferences), the family profiles you create, and the medicines, schedules, dose records, stock transactions, care plans, allergies and notification settings you enter.',
  },
  {
    title: 'How access is controlled',
    body: 'Every API request checks that the signed-in account has permission for the specific profile involved. Attempting to read or change a profile you have not been granted access to returns "not found" rather than revealing that it exists. Client-supplied profile or family identifiers are never trusted on their own.',
  },
  {
    title: 'Retention and deletion',
    body: 'You can delete an allergy record, archive a medicine, or remove a profile you manage at any time from the app. You can also permanently delete your whole account and the data you own from Settings → Privacy & security. See "Your rights" for the full list of what you can view, change and delete.',
  },
  {
    title: 'What MediTrack does not do',
    body: 'It does not sell your data, and it does not infer medical information about you. Allergy entries are only what you typed. Medicine information is shown from a configured trusted source, with that source and retrieval time labelled.',
  },
  {
    title: 'Logging',
    body: 'Server logs record request method, path, status and error detail for debugging. Passwords and tokens are not written to logs.',
  },
];

export function PrivacyPage() {
  return (
    <Section
      eyebrow="Privacy"
      title="Privacy policy (demonstration)"
      description="This is a sample policy for a demonstration project. It describes how the reference implementation handles data — it is not legal advice, and you should have any real deployment reviewed."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {PRIVACY.map((item) => (
          <div key={item.title} className="card p-5">
            <h2 className="text-sm font-semibold text-content">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-subtle">
        MediTrack is a record-keeping tool. It does not diagnose conditions, prescribe treatment, or replace
        advice from a qualified healthcare professional. For any medical concern, including a suspected
        allergic reaction, seek appropriate care.
      </p>
    </Section>
  );
}

export default PrivacyPage;
