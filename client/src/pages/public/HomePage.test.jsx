import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';
import { PublicLayout } from '../../components/public/PublicLayout';
import { ThemeProvider } from '../../theme/ThemeProvider';

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider>
        <PublicLayout />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

function renderHomePage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <HomePage />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('Public homepage', () => {
  it('presents the hero, primary and secondary calls to action', () => {
    renderHomePage();

    expect(
      screen.getByRole('heading', { level: 1, name: /every medicine, dose and refill/i }),
    ).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /get started/i })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: /explore features/i })).toHaveAttribute('href', '#features');
  });

  it('renders every required marketing section with an accessible heading', () => {
    renderHomePage();

    const expected = [
      /every medicine, dose and refill/i,
      /built for the person who keeps track/i,
      /everything you need to stay on top of it/i,
      /from a name to a verified schedule/i,
      /care for your family/i,
      /honest about what this is/i,
      /make medicine organisation feel effortless/i,
      /questions people actually ask/i,
    ];

    for (const pattern of expected) {
      expect(screen.getByRole('heading', { name: pattern })).toBeInTheDocument();
    }
  });

  it('states plainly that MediTrack does not give medical advice', () => {
    renderHomePage();

    const matches = screen.getAllByText(/does not diagnose/i);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getByText(/no invented ingredients/i)).toBeInTheDocument();
  });

  it('lists the eight headline features', () => {
    renderHomePage();

    const features = [
      'Smart medicine reminders',
      'Guided manual entry',
      'Searchable medicine list',
      'Stock & refill tracking',
      'Family medicine management',
      'Temporary care plans',
      'Dose history & reports',
      'Customisable notification identity',
    ];

    for (const feature of features) {
      expect(screen.getByRole('heading', { name: feature })).toBeInTheDocument();
    }
  });

  it('answers the frequently asked questions', () => {
    renderHomePage();

    expect(screen.getByText(/how do reminders actually work\?/i)).toBeInTheDocument();
    expect(screen.getByText(/how do i add a medicine\?/i)).toBeInTheDocument();
    expect(screen.getByText(/does meditrack tell me if my medicine is safe/i)).toBeInTheDocument();
  });

  it('invites people to create an account at the end of the page', () => {
    renderHomePage();

    const finalCta = screen.getByRole('heading', { name: /start organising your family's medicines today/i });
    expect(finalCta).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/signup');
  });
});

describe('Public navigation', () => {
  it('exposes the brand, section links and auth actions', () => {
    renderLayout();

    const nav = screen.getByRole('navigation', { name: 'Public' });
    for (const label of ['Features', 'About', 'How it works', 'Family care', 'Support']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }

    // The header also carries the auth actions; the footer repeats "Log in".
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: /^log in$/i })).toHaveAttribute('href', '/login');
    expect(within(header).getByRole('link', { name: /^sign up$/i })).toHaveAttribute('href', '/signup');
  });

  it('offers an appearance control and a working mobile menu button', () => {
    renderLayout();

    expect(screen.getAllByRole('button', { name: /change appearance/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('renders a footer with clear legal and support placeholders', () => {
    renderLayout();

    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
    expect(within(footer).getByRole('link', { name: /terms of use/i })).toHaveAttribute('href', '/terms');
    expect(within(footer).getByText(/contact form \(placeholder\)/i)).toBeInTheDocument();
    // No invented business claims.
    expect(within(footer).queryByText(/certified|award|testimonial/i)).toBeNull();
  });
});
