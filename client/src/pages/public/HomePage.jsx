import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  ClipboardList,
  HeartHandshake,
  Info,
  LineChart,
  Package,
  PencilLine,
  Search,
  Shield,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ProductPreview } from '../../components/public/ProductPreview';
import { Section } from '../../components/public/Section';

const FEATURES = [
  {
    icon: BellRing,
    title: 'Smart medicine reminders',
    body: 'Timezone-aware schedules for daily, selected-weekday or specific-date doses, with snooze and a clear taken / skipped / missed record.',
    href: '#how-it-works',
  },
  {
    icon: PencilLine,
    title: 'Guided manual entry',
    body: 'Add a medicine in a few clear fields. You type the details yourself and confirm them — MediTrack never adds anything on its own.',
    href: '#manual-entry',
  },
  {
    icon: Search,
    title: 'Searchable medicine list',
    body: 'Start typing a name to see matches from a reference list, by brand or generic name, with the strength and form shown so you pick the right one.',
    href: '#manual-entry',
  },
  {
    icon: CalendarClock,
    title: 'Stock & refill tracking',
    body: 'Know what is left, set a low-stock threshold, and record refills or adjustments with a full transaction history.',
    href: '#features',
  },
  {
    icon: Users,
    title: 'Family medicine management',
    body: 'Separate records for each person you care for — managed profiles for children, and consent-based connections for other adults.',
    href: '#family',
  },
  {
    icon: ClipboardList,
    title: 'Temporary care plans',
    body: 'Short courses with a planned review date. When the date arrives, MediTrack asks whether the plan is complete or should continue.',
    href: '#family',
  },
  {
    icon: LineChart,
    title: 'Dose history & reports',
    body: 'Daily, weekly and monthly summaries of recorded doses and stock changes, filterable by profile and exportable to CSV.',
    href: '#features',
  },
  {
    icon: UserRound,
    title: 'Customisable notification identity',
    body: 'Each family member gets a name, colour and avatar so a reminder clearly says who it is for at a glance.',
    href: '#family',
  },
];

const STEPS = [
  { title: 'Create an account', body: 'Sign up with your email and set your timezone so reminders land at the right local time.' },
  { title: 'Add a medicine', body: 'Enter the details yourself — name, strength, form and stock. Start typing the name to pick a match from the reference list if you like.' },
  { title: 'Check and save', body: 'Review what you entered, then save. You are always the one who confirms what goes into your records.' },
  { title: 'Set verified schedules', body: 'Choose the times and the pattern. MediTrack generates the upcoming doses and reminders.' },
  { title: 'Track doses and stock', body: 'Mark doses as taken, skipped or snoozed. Stock is deducted once per recorded dose, never twice.' },
  { title: 'Bring in the family', body: 'Add managed profiles, connect other adults with consent, and choose who gets which alerts.' },
];

const FAQS = [
  {
    q: 'How do reminders actually work?',
    a: 'MediTrack generates a scheduled dose for each medicine based on the pattern and times you set, using your timezone. A background job creates an in-app notification when a dose is due, and marks it missed if it is not recorded within the grace period. If your deployment has Web Push configured, the same alert is also sent to your devices.',
  },
  {
    q: 'How do I add a medicine?',
    a: 'You enter it yourself on a short form — name, strength, form, schedule and stock. As you type the name, MediTrack can suggest matches from a small reference list, but you always type and confirm the values, and you can add a medicine that is not on the list.',
  },
  {
    q: 'Can my whole family use one account?',
    a: 'Yes. You can create managed profiles for children or anyone you care for — they do not need their own phone or login. Other adults can connect their own accounts, and they only see and do what you explicitly permit, which you can change or revoke at any time.',
  },
  {
    q: 'Does MediTrack tell me if my medicine is safe or what it treats?',
    a: 'No. MediTrack is a record-keeping tool. It does not diagnose conditions, prescribe treatment, recommend alternatives, or decide whether a medicine is safe for you. When a trusted reference source is configured you can open a medicine\u2019s information section to read verified composition details, but the decision always belongs to you and your healthcare professional.',
  },
  {
    q: 'How accurate is the expiry tracking?',
    a: 'MediTrack warns you 30, 7 and 1 day before an expiry date that you recorded, and lists already-expired medicines separately. It never invents a missing expiry date, and it does not claim that an expired medicine is safe to use — it tells you to ask a pharmacist how to handle it.',
  },
  {
    q: 'Where is my data kept, and who can see it?',
    a: 'Your records are scoped to your family workspace and enforced on the server for every request. A profile you have not been granted access to returns "not found" rather than partial data, so nobody can reach another family\u2019s records by guessing a URL. You can delete any medicine record, remove a profile you manage, or delete your whole account and its data from Settings.',
  },
];

export function HomePage() {
  return (
    <>
      {/* ------------------------------- Hero ------------------------------- */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-gradient-to-b from-accent-soft/70 to-transparent"
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
              <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              Medicine management, without the guesswork
            </span>

            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-content sm:text-5xl lg:text-[3.4rem]">
              Every medicine, dose and refill — in one calm place.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              MediTrack keeps your family's medicines organised: reminders that respect your timezone,
              quick manual entry with searchable medicine names, stock and expiry tracking, and
              clear records of what was taken and when.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button as={Link} to="/signup" size="lg">
                Get started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button as="a" href="#features" variant="secondary" size="lg">
                Explore features
              </Button>
            </div>

            <p className="mt-5 max-w-lg text-xs leading-relaxed text-subtle">
              MediTrack is a record-keeping tool. It helps you organise medicines and reminders — it does
              not diagnose conditions, prescribe treatment, or replace advice from a healthcare professional.
            </p>
          </div>

          <div className="animate-fade-up lg:animate-none">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* ------------------------------- About ------------------------------ */}
      <Section id="about" eyebrow="About MediTrack" title="Built for the person who keeps track of everyone else">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4 text-sm leading-relaxed text-muted sm:text-base">
            <p>
              Managing medicines gets complicated quietly: a course of antibiotics for one child, a daily
              tablet for yourself, something your father takes at night, and a blister pack in the cupboard
              that might be about to expire.
            </p>
            <p>
              MediTrack brings all of that into one place. Each person you care for has their own profile
              with their own medicines, schedules, dose history, stock and expiry dates — so nothing gets
              mixed up and nothing gets forgotten.
            </p>
            <p>
              It stays deliberately simple. The dashboard shows today's doses, what is running low, and what
              is about to expire. Deeper detail, like the composition of a medicine, is there when you go
              looking for it — not pushed at you.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Users, title: 'One profile each', body: 'Separate records per person, with their own schedule and history.' },
              { icon: Package, title: 'Stock that stays honest', body: 'Doses deduct stock exactly once and keep a full ledger.' },
              { icon: CalendarClock, title: 'Nothing expires unnoticed', body: 'Warnings at 30, 7 and 1 day, plus a clear expired list.' },
              { icon: Shield, title: 'Private by default', body: 'Access is checked on the server for every single request.' },
            ].map((item) => (
              <div key={item.title} className="card p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-content">{item.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ------------------------------ Features ---------------------------- */}
      <Section
        id="features"
        eyebrow="Features"
        title="Everything you need to stay on top of it"
        description="Each feature is designed to reduce a specific kind of daily friction — and to be honest about what it can and cannot tell you."
        muted
        reveal
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <a
              key={feature.title}
              href={feature.href}
              className="card group flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:border-border-strong"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <feature.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-content">{feature.title}</h3>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted">{feature.body}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent">
                Learn more
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>
      </Section>

      {/* --------------------------- How it works --------------------------- */}
      <Section
        id="how-it-works"
        eyebrow="How it works"
        title="From a name to a verified schedule"
        description="Six steps, and you stay in control of every one of them."
        reveal
      >
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="card relative p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg">
                {index + 1}
              </span>
              <h3 className="mt-3.5 text-sm font-semibold text-content">{step.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        <div id="manual-entry" className="mt-10 grid gap-4 lg:grid-cols-3">
          {[
            {
              icon: PencilLine,
              title: 'You add the medicine',
              body: 'Enter the name, strength, form, schedule and stock yourself. Nothing is created until you save it.',
            },
            {
              icon: Search,
              title: 'Suggestions, not decisions',
              body: 'Typing a name offers matches from a small reference list so spelling and strengths stay consistent. You pick — nothing is filled in automatically behind your back.',
            },
            {
              icon: Info,
              title: 'No guesswork',
              body: 'It never invents a medicine, a dose or an expiry date, never changes a schedule on its own, and never decides treatment. A blank expiry date stays blank until you record it.',
            },
          ].map((item) => (
            <div key={item.title} className="card p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-accent">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-content">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ----------------------------- Family care -------------------------- */}
      <Section
        id="family"
        eyebrow="Family care"
        title="Care for your family, without taking over their accounts"
        muted
        reveal
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-content">Managed profiles</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Create a profile for a child or anyone you care for. They do not need a phone or a login.
              Their medicines, schedules, dose history, stock, expiry dates, care plans and notification
              settings stay entirely separate from yours.
            </p>
          </div>

          <div className="card p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <HeartHandshake className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-content">Connected adult accounts</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Another adult keeps their own MediTrack account and connects to your family by consent. You
              grant granular permissions — view records, manage medicines, record doses, manage stock or
              care plans — and you can revoke any of it at any moment.
            </p>
          </div>

          <div className="card p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <BellRing className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-content">Notifications with identity</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Choose who receives which alert: dose reminders, missed doses, low stock, expiring medicines
              or care-plan reviews. Notifications carry the member's name, colour and avatar so it is
              obvious who they are about.
            </p>
          </div>
        </div>
      </Section>

      {/* ---------------------------- Privacy ------------------------------- */}
      <Section
        id="privacy"
        eyebrow="Privacy & responsible design"
        title="Honest about what this is"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {[
              {
                title: 'Private records, enforced on the server',
                body: 'Every endpoint checks that you have access to the specific profile before returning anything. A profile you cannot access reports "not found" rather than leaking its existence.',
              },
              {
                title: 'Nothing is added without your confirmation',
                body: 'Medicines are only created when you enter and save them yourself. You can edit or archive any record, and remove a profile you manage along with its medicines.',
              },
              {
                title: 'No diagnosis, no prescribing',
                body: 'MediTrack does not diagnose illness, prescribe or change treatment, recommend alternative medicines, or decide that a medicine is safe for you.',
              },
              {
                title: 'Allergies are recorded by you, never inferred',
                body: 'You can note a known allergy yourself. If a trusted source shows a matching ingredient you will see a clearly-labelled reminder that this is the allergy you recorded — not a diagnosis.',
              },
            ].map((item) => (
              <div key={item.title} className="card p-5">
                <h3 className="text-sm font-semibold text-content">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="card bg-surface-2 p-6">
            <h3 className="text-sm font-semibold text-content">The lines we do not cross</h3>
            <ul className="mt-4 space-y-3">
              {[
                'No invented ingredients, side effects or source citations.',
                'No guessing an unreadable expiry date — we ask you instead.',
                'No claiming an expired medicine is safe to use.',
                'No automatic dose changes, ever.',
                'No medical claims or fabricated endorsements.',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-subtle">
              For any medical concern, speak to a qualified healthcare professional. If you think you are
              having a severe allergic reaction, seek urgent medical care immediately.
            </p>
          </div>
        </div>
      </Section>

      {/* ----------------------------- Mission ------------------------------ */}
      <Section id="mission" eyebrow="Our mission" title="Make medicine organisation feel effortless" muted>
        <blockquote className="mx-auto max-w-3xl text-center">
          <p className="text-lg font-medium leading-relaxed text-content sm:text-xl">
            Looking after someone's medicines should not require a spreadsheet, a notes app and a very good
            memory. MediTrack exists to make that everyday responsibility simple, legible and shared — so the
            people who help out can help out confidently.
          </p>
          <footer className="mt-5 text-sm text-subtle">The MediTrack project</footer>
        </blockquote>
      </Section>

      {/* ------------------------------- FAQ -------------------------------- */}
      <Section id="faq" eyebrow="FAQ" title="Questions people actually ask" reveal>
        <div className="mx-auto max-w-3xl space-y-3">
          {FAQS.map((faq) => (
            <details key={faq.q} className="card group p-0 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 text-sm font-medium text-content">
                {faq.q}
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-subtle transition-transform group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* ---------------------------- Final CTA ----------------------------- */}
      <section id="support" className="px-4 pb-20 pt-4 sm:px-6">
        <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="relative px-6 py-12 text-center sm:px-12 sm:py-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-accent-soft/70 to-transparent"
            />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-content sm:text-3xl">
                Start organising your family's medicines today
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                Create a free account, add your first medicine, and let MediTrack handle the reminders.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Button as={Link} to="/signup" size="lg">
                  Create an account
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button as={Link} to="/login" variant="secondary" size="lg">
                  I already have an account
                </Button>
              </div>
              <p className="mt-6 text-xs text-subtle">
                Looking for support? This demonstration project has no live support channel — see the
                placeholder contact link in the footer.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default HomePage;
