import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRightsPage } from './UserRightsPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <UserRightsPage />
    </MemoryRouter>,
  );
}

describe('User rights page', () => {
  it('explains what users can view, change and delete', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { name: /what you can see, change and delete/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/delete your account and data/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /delete your account/i })).toHaveAttribute(
      'href',
      '/app/settings/privacy',
    );
  });

  it('provides a contact section and links to the legal pages', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /contact & support/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /read the privacy policy/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /read the terms of use/i })).toHaveAttribute('href', '/terms');
  });
});
