import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, HeartPulse, LogIn } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, Checkbox } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Feedback';
import { useAuth } from '../../context/AuthProvider';
import { useToast } from '../../context/ToastProvider';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export function LoginPage() {
  const { login, isAuthenticated, isLoggingIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  const redirectTo = location.state?.from?.pathname || '/app';

  useEffect(() => {
    document.title = 'Log in · MediTrack';
    return () => {
      document.title = 'MediTrack — Simple medicine management for families';
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate(redirectTo, { replace: true });
  }, [isAuthenticated, navigate, redirectTo]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (values) => {
    setFormError('');
    try {
      await login(values);
      toast.success('Welcome back.');
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(error.message || 'Could not sign you in.');
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
      <div className="hidden lg:block">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-fg">
          <HeartPulse className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-content">
          Welcome back to MediTrack
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
          Sign in to see today's doses, what is running low, and which medicines need your attention.
        </p>
        <ul className="mt-8 space-y-3">
          {[
            'Reminders that match your timezone',
            'Stock deducted once per recorded dose',
            'Family profiles with consent-based access',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-muted">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="card mx-auto w-full max-w-md card-pad">
        <div className="lg:hidden">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-fg">
            <HeartPulse className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-content lg:mt-0">Log in</h2>
        <p className="mt-1 text-sm text-muted">Enter the email and password you signed up with.</p>

        {formError ? (
          <Notice tone="danger" className="mt-5" title="We couldn't sign you in">
            {formError}
          </Notice>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Your password"
            required
            error={errors.password?.message}
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="rounded-lg p-2 text-subtle transition-colors hover:bg-surface-2 hover:text-content"
              >
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            }
            {...register('password')}
          />

          <Checkbox label="Keep me signed in on this device" defaultChecked />

          <Button type="submit" fullWidth size="lg" loading={isLoggingIn}>
            {!isLoggingIn ? <LogIn className="h-4 w-4" aria-hidden="true" /> : null}
            Log in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          New to MediTrack?{' '}
          <Link to="/signup" className="font-medium text-accent underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
