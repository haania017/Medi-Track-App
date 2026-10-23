import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, HeartPulse, ShieldCheck, UserPlus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, Checkbox } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Feedback';
import { useAuth } from '../../context/AuthProvider';
import { useToast } from '../../context/ToastProvider';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Please enter your name').max(120),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[a-zA-Z]/, 'Include at least one letter')
      .regex(/\d/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    terms: z.literal(true, { errorMap: () => ({ message: 'Please accept the terms to continue' }) }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

function detectTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function SignupPage() {
  const { register: registerUser, isAuthenticated, isRegistering } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [timezone] = useState(detectTimeZone);

  useEffect(() => {
    document.title = 'Create your account · MediTrack';
    return () => {
      document.title = 'MediTrack — Simple medicine management for families';
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate('/app', { replace: true });
  }, [isAuthenticated, navigate]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', terms: false },
  });

  const onSubmit = async (values) => {
    setFormError('');
    try {
      await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        timezone,
        termsAccepted: true,
      });
      toast.success('Your MediTrack workspace is ready.');
      navigate('/app', { replace: true });
    } catch (error) {
      if (error.status === 409) {
        setError('email', { message: 'An account with this email already exists.' });
      } else if (error.isValidationError && Array.isArray(error.details)) {
        for (const detail of error.details) {
          if (['name', 'email', 'password'].includes(detail.path)) {
            setError(detail.path, { message: detail.message });
          }
        }
        setFormError(error.message);
      } else {
        setFormError(error.message || 'Could not create your account.');
      }
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
      <div className="hidden lg:block">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-fg">
          <HeartPulse className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-content">
          Set up your family's medicine records
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
          One account covers everyone you care for. Add managed profiles for children, connect other adults
          when you are ready, and keep each person's medicines separate.
        </p>
        <ul className="mt-8 space-y-3">
          {[
            'No card details, no medical claims',
            'You add and confirm every medicine yourself',
            'Delete your data whenever you want',
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
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-content lg:mt-0">Create an account</h2>
        <p className="mt-1 text-sm text-muted">
          Takes a minute. We'll use your device timezone
          <span className="text-subtle"> ({timezone})</span> for reminders.
        </p>

        {formError ? (
          <Notice tone="danger" className="mt-5" title="We couldn't create your account">
            {formError}
          </Notice>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label="Full name"
            autoComplete="name"
            placeholder="e.g. Sara Ahmed"
            required
            error={errors.name?.message}
            {...register('name')}
          />

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
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
            hint="Must contain at least one letter and one number."
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

          <Input
            label="Confirm password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Repeat your password"
            required
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <div className="rounded-xl border border-border bg-surface-2 p-3.5">
            <Checkbox
              label="I understand MediTrack is a record-keeping tool and does not provide medical advice."
              required
              {...register('terms')}
            />
            {errors.terms?.message ? (
              <p role="alert" className="mt-2 text-xs text-danger">
                {errors.terms.message}
              </p>
            ) : null}
          </div>

          <Button type="submit" fullWidth size="lg" loading={isRegistering}>
            {!isRegistering ? <UserPlus className="h-4 w-4" aria-hidden="true" /> : null}
            Create account
          </Button>
        </form>

        <div className="mt-5 flex items-start gap-2 text-xs text-subtle">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>
            Your password is hashed before it is stored. Your records are only visible to accounts you
            authorise.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default SignupPage;
