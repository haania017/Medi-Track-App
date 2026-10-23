import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Section } from '../../components/public/Section';

const RIGHTS = [
  {
    title: 'View your information',
    body: 'Your medicines, family profiles, schedules, dose history, stock ledger and reports are all visible in the app for the profiles you have access to. You can also export adherence and stock history as CSV from the Reports page.',
    links: [
      { label: 'Open your medicines', to: '/app/medicines' },
      { label: 'Open reports & exports', to: '/app/reports' },
    ],
  },
  {
    title: 'Correct inaccurate details',
    body: 'Open any medicine and choose Edit to change its name, strength, form, schedule, stock, batch number, manufacturer or expiry date. Saving recalculates upcoming doses and never rewrites past history.',
    links: [{ label: 'Edit a medicine', to: '/app/medicines' }],
  },
  {
    title: 'Update a missing expiry date',
    body: 'Medicines saved without an expiry date stay in your list and appear in a dedicated "Missing expiry" list. Add the date whenever you have it, and the status updates automatically. A missing date is never treated as expired.',
    links: [{ label: 'See expiry tracking', to: '/app/expiry' }],
  },
  {
    title: 'Delete records',
    body: 'You can archive a medicine, delete an allergy record, or remove a profile you manage (which also removes its medicines). Deleting is immediate and cannot be undone.',
    links: [{ label: 'Privacy & security settings', to: '/app/settings/privacy' }],
  },
  {
    title: 'Delete your account and data',
    body: 'From Settings → Privacy & security you can permanently delete your account. This removes the families you own along with their members, medicines, dose records, stock ledger, care plans and notifications, revokes your access to other families, and deletes your account. It requires your password and cannot be undone.',
    links: [{ label: 'Delete your account', to: '/app/settings/privacy' }],
  },
  {
    title: 'Manage your account',
    body: 'You can change your name and timezone, change your password, and set your appearance and notification preferences at any time. Your email identifies your account and is used only for sign-in.',
    links: [{ label: 'Account settings', to: '/app/settings/profile' }],
  },
];

export function UserRightsPage() {
  return (
    <>
      <Section
        eyebrow="Your rights"
        title="What you can see, change and delete"
        description="This page describes the controls that actually exist in MediTrack today. It is a demonstration project, so it lists the in-app actions rather than a legal process. Where an action is available, the link takes you straight to it."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {RIGHTS.map((item) => (
            <div key={item.title} className="card p-5">
              <h2 className="text-sm font-semibold text-content">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
              {item.links?.length ? (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  {item.links.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="inline-flex items-center gap-1 text-xs font-medium text-accent underline-offset-4 hover:underline"
                    >
                      {link.label}
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div id="contact" className="mt-8 scroll-mt-24 rounded-2xl border border-border bg-surface-2/60 p-6">
          <h2 className="text-base font-semibold text-content">Contact &amp; support</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            MediTrack is a demonstration project and does not operate a live support desk or a public
            contact form. If you are using a hosted copy, contact the person or team who deployed it to
            request help, ask a question about your data, or request deletion on your behalf. For any
            medical concern — including a suspected allergic reaction or an expired medicine — speak to a
            pharmacist or a qualified healthcare professional, or contact your local emergency service.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/privacy" className="text-xs font-medium text-accent underline-offset-4 hover:underline">
              Read the privacy policy
            </Link>
            <Link to="/terms" className="text-xs font-medium text-accent underline-offset-4 hover:underline">
              Read the terms of use
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}

export default UserRightsPage;
