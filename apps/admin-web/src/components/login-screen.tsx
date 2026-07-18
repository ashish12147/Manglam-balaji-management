'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Field, InlineNotice, Input, IconButton } from '@manglam/ui';
import { Building2, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAuth } from './auth-provider';
import { ApiError } from '@/lib/api-client';
import type { AdminCredentials } from '@/lib/api-types';

const credentialsSchema = z.object({
  email: z.email('Enter a valid administrator email address.').trim().toLowerCase(),
  password: z.string().min(8, 'Password must contain at least 8 characters.'),
});

const mfaSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit authenticator code.'),
});

type Credentials = z.infer<typeof credentialsSchema>;
type MfaFields = z.infer<typeof mfaSchema>;

function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

function genericAuthError(caught: unknown, fallbackCode: string, fallbackMessage: string) {
  return caught instanceof ApiError ? caught : new ApiError(0, fallbackCode, fallbackMessage);
}

export function LoginScreen() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<AdminCredentials | null>(null);
  const [requestError, setRequestError] = useState<ApiError | null>(null);
  const { login, status } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));

  const credentialsForm = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  });
  const mfaForm = useForm<MfaFields>({
    resolver: zodResolver(mfaSchema),
    defaultValues: { code: '' },
  });

  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [next, router, status]);

  async function submitCredentials(values: Credentials) {
    setRequestError(null);

    try {
      await login(values);
      credentialsForm.reset({ email: values.email, password: '' });
      router.replace(next);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401 && caught.code === 'MFA_REQUIRED') {
        setPendingCredentials(values);
        credentialsForm.reset({ email: values.email, password: '' });
        mfaForm.reset();
        return;
      }

      setRequestError(genericAuthError(caught, 'LOGIN_FAILED', 'Sign-in could not be completed.'));
    }
  }

  async function submitMfa(values: MfaFields) {
    if (!pendingCredentials) return;
    setRequestError(null);

    try {
      await login({ ...pendingCredentials, mfaCode: values.code });
      setPendingCredentials(null);
      mfaForm.reset();
      router.replace(next);
    } catch (caught) {
      setRequestError(
        genericAuthError(caught, 'MFA_FAILED', 'Verification could not be completed.'),
      );
    }
  }

  function useAnotherAccount() {
    const email = pendingCredentials?.email ?? '';
    setPendingCredentials(null);
    setRequestError(null);
    setPasswordVisible(false);
    mfaForm.reset();
    credentialsForm.reset({ email, password: '' });
  }

  return (
    <main className="auth-page" id="main-content">
      <section className="auth-brand" aria-label="Manglam Balaji Society">
        <div className="brand">
          <span className="brand__mark" aria-hidden>
            <Building2 size={24} />
          </span>
          <span className="brand__copy">
            <strong>Manglam Balaji</strong>
            <small>Society operations</small>
          </span>
        </div>
        <div className="auth-brand__message">
          <p>Private administration</p>
          <h1>One clear view of society operations.</h1>
          <p>
            Secure access for authorised administrators managing residents, gates, safety,
            communication, and accounts.
          </p>
        </div>
        <p className="auth-brand__footer">Manglam Balaji Society, India</p>
      </section>

      <section className="auth-main">
        <div className="auth-form">
          <div className="auth-form__heading">
            <h2>{pendingCredentials ? 'Verify your identity' : 'Administrator sign in'}</h2>
            <p>
              {pendingCredentials
                ? 'Enter the 6-digit code from your authenticator app.'
                : 'Use the account issued by an authorised society administrator.'}
            </p>
          </div>

          {requestError ? (
            <InlineNotice tone="danger">
              <ShieldCheck size={18} aria-hidden />
              <span>
                {requestError.message}
                {requestError.correlationId ? (
                  <>
                    <br />
                    <small>Support reference: {requestError.correlationId}</small>
                  </>
                ) : null}
              </span>
            </InlineNotice>
          ) : null}

          {pendingCredentials ? (
            <form onSubmit={mfaForm.handleSubmit(submitMfa)} noValidate>
              <Field
                label="Authenticator code"
                required
                error={mfaForm.formState.errors.code?.message}
              >
                <Input
                  {...mfaForm.register('code')}
                  aria-describedby="mfa-account"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]*"
                  autoFocus
                />
              </Field>
              <p className="auth-form__account" id="mfa-account">
                Verifying {pendingCredentials.email}
              </p>
              <Button
                type="submit"
                size="lg"
                loading={mfaForm.formState.isSubmitting}
                leadingIcon={<KeyRound size={18} />}
              >
                Verify and continue
              </Button>
              <Button type="button" tone="quiet" onClick={useAnotherAccount}>
                Use another account
              </Button>
            </form>
          ) : (
            <form onSubmit={credentialsForm.handleSubmit(submitCredentials)} noValidate>
              <Field
                label="Email address"
                required
                error={credentialsForm.formState.errors.email?.message}
              >
                <Input
                  {...credentialsForm.register('email')}
                  type="email"
                  autoCapitalize="none"
                  autoComplete="username"
                  autoFocus
                />
              </Field>
              <Field
                label="Password"
                required
                error={credentialsForm.formState.errors.password?.message}
              >
                <div className="password-input">
                  <Input
                    {...credentialsForm.register('password')}
                    type={passwordVisible ? 'text' : 'password'}
                    autoComplete="current-password"
                  />
                  <IconButton
                    label={passwordVisible ? 'Hide password' : 'Show password'}
                    size="sm"
                    onClick={() => setPasswordVisible((value) => !value)}
                  >
                    {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </IconButton>
                </div>
              </Field>
              <Button type="submit" size="lg" loading={credentialsForm.formState.isSubmitting}>
                Sign in securely
              </Button>
            </form>
          )}

          <p className="auth-form__support">
            Access is logged and limited by your assigned permissions. Contact the society office if
            your account is locked or unavailable.
          </p>
        </div>
      </section>
    </main>
  );
}
