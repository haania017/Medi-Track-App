import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { SignupPage } from './SignupPage';

const login = vi.fn();
const register = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('../../context/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoggingIn: false,
    isRegistering: false,
    login,
    register,
  }),
}));

vi.mock('../../context/ToastProvider', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError, info: vi.fn(), warning: vi.fn() }),
}));

function renderPage(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// The required marker makes a field's accessible label e.g. "Email*", and the
// password field has a "Show password" toggle beside it — anchor the queries.
const emailField = () => screen.getByLabelText(/^email/i);
const passwordField = () => screen.getByLabelText(/^password/i);
const confirmField = () => screen.getByLabelText(/^confirm password/i);

beforeEach(() => {
  login.mockReset();
  register.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe('Login page', () => {
  it('renders accessible, labelled fields and links to sign up', () => {
    renderPage(<LoginPage />);

    expect(screen.getByRole('heading', { name: /^log in$/i })).toBeInTheDocument();
    expect(emailField()).toHaveAttribute('type', 'email');
    expect(passwordField()).toHaveAttribute('type', 'password');
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/signup');
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderPage(<LoginPage />);

    const password = passwordField();
    expect(password).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(password).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('blocks submission and explains what is missing', async () => {
    const user = userEvent.setup();
    renderPage(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects a malformed email address', async () => {
    const user = userEvent.setup();
    renderPage(<LoginPage />);

    await user.type(emailField(), 'not-an-email');
    await user.type(passwordField(), 'Password123');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
    });
    expect(login).not.toHaveBeenCalled();
  });

  it('submits valid credentials to the real login action', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({});
    renderPage(<LoginPage />);

    await user.type(emailField(), 'demo@meditrack.test');
    await user.type(passwordField(), 'Password123');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({ email: 'demo@meditrack.test', password: 'Password123' });
    });
  });

  it('surfaces a server error without navigating away', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new Error('Incorrect email or password.'));
    renderPage(<LoginPage />);

    await user.type(emailField(), 'demo@meditrack.test');
    await user.type(passwordField(), 'WrongPassword1');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByText(/incorrect email or password/i)).toBeInTheDocument();
  });
});

describe('Signup page', () => {
  it('renders every required field with accessible labels', () => {
    renderPage(<SignupPage />);

    expect(screen.getByRole('heading', { name: /create an account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(emailField()).toBeInTheDocument();
    expect(passwordField()).toBeInTheDocument();
    expect(confirmField()).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^log in$/i })).toHaveAttribute('href', '/login');
  });

  it('requires accepting that MediTrack is not medical advice', async () => {
    const user = userEvent.setup();
    renderPage(<SignupPage />);

    await user.type(screen.getByLabelText(/full name/i), 'Sara Ahmed');
    await user.type(emailField(), 'sara@example.test');
    await user.type(passwordField(), 'Password123');
    await user.type(confirmField(), 'Password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/please accept the terms to continue/i)).toBeInTheDocument();
    });
    expect(register).not.toHaveBeenCalled();
  });

  it('enforces a strong password', async () => {
    const user = userEvent.setup();
    renderPage(<SignupPage />);

    await user.type(passwordField(), 'short');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/use at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('flags mismatched passwords', async () => {
    const user = userEvent.setup();
    renderPage(<SignupPage />);

    // The rest of the form is valid, so the mismatch is the only thing left.
    await user.type(screen.getByLabelText(/full name/i), 'Sara Ahmed');
    await user.type(emailField(), 'sara@example.test');
    await user.type(passwordField(), 'Password123');
    await user.type(confirmField(), 'Password124');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(register).not.toHaveBeenCalled();
  });

  it('submits a complete, valid form', async () => {
    const user = userEvent.setup();
    register.mockResolvedValue({});
    renderPage(<SignupPage />);

    await user.type(screen.getByLabelText(/full name/i), 'Sara Ahmed');
    await user.type(emailField(), 'sara@example.test');
    await user.type(passwordField(), 'Password123');
    await user.type(confirmField(), 'Password123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledTimes(1);
    });
    const payload = register.mock.calls[0][0];
    expect(payload.email).toBe('sara@example.test');
    expect(payload.name).toBe('Sara Ahmed');
    expect(payload.termsAccepted).toBe(true);
    expect(typeof payload.timezone).toBe('string');
  });

  it('reports a duplicate email against the email field', async () => {
    const user = userEvent.setup();
    const duplicate = new Error('An account with that email already exists.');
    duplicate.status = 409;
    register.mockRejectedValue(duplicate);
    renderPage(<SignupPage />);

    await user.type(screen.getByLabelText(/full name/i), 'Sara Ahmed');
    await user.type(emailField(), 'taken@example.test');
    await user.type(passwordField(), 'Password123');
    await user.type(confirmField(), 'Password123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/an account with this email already exists/i)).toBeInTheDocument();
  });
});
