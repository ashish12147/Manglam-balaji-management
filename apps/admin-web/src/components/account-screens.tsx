'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  InlineNotice,
  Input,
  Skeleton,
  Surface,
} from '@manglam/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, MonitorSmartphone, Save, ShieldCheck, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAuth } from './auth-provider';
import { PageHeader } from './page-header';
import { apiCurrentUser, apiData, apiList, apiRequest, ApiError } from '@/lib/api-client';
import type { SessionRecord } from '@/lib/api-types';

function AccountTabs() {
  return (
    <nav className="account-tabs" aria-label="Account pages">
      <Link href="/account/profile">
        <UserRound size={16} />
        Profile
      </Link>
      <Link href="/account/sessions">
        <MonitorSmartphone size={16} />
        Sessions
      </Link>
    </nav>
  );
}

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(120),
  email: z
    .string()
    .trim()
    .refine(
      (value) => !value || z.email().safeParse(value).success,
      'Enter a valid email address.',
    ),
});

type ProfileFields = z.infer<typeof profileSchema>;

export function ProfileScreen() {
  const { refreshSession } = useAuth();
  const [success, setSuccess] = useState(false);
  const form = useForm<ProfileFields>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', email: '' },
  });
  const query = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiCurrentUser(),
  });
  const mutation = useMutation({
    mutationFn: async (values: ProfileFields) => {
      await apiData('/users/me', {
        method: 'PATCH',
        body: values,
        idempotent: true,
      });
      return apiCurrentUser({ retryAuth: false });
    },
    onSuccess: async () => {
      setSuccess(true);
      await refreshSession();
      await query.refetch();
    },
  });

  useEffect(() => {
    if (query.data)
      form.reset({
        name: query.data.displayName,
        email: query.data.email ?? '',
      });
  }, [form, query.data]);

  const error = query.error instanceof ApiError ? query.error : null;
  const mutationError = mutation.error instanceof ApiError ? mutation.error : null;

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Manage your administrator identity and review backend-assigned access."
      />
      <AccountTabs />
      {query.isLoading ? (
        <Skeleton className="skeleton-panel" />
      ) : error ? (
        <Surface className="page-state-surface">
          <ErrorState
            icon={<AlertTriangle />}
            title="Profile could not be loaded"
            description={error.message}
            correlationId={error.correlationId}
            action={<Button onClick={() => void query.refetch()}>Try again</Button>}
          />
        </Surface>
      ) : query.data ? (
        <div className="account-grid">
          <Surface className="settings-form">
            <form
              className="form-stack"
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              noValidate
            >
              {success ? (
                <InlineNotice tone="success">Profile updated successfully.</InlineNotice>
              ) : null}
              {mutationError ? (
                <InlineNotice tone="danger">
                  {mutationError.message}
                  {mutationError.correlationId
                    ? ` Support reference: ${mutationError.correlationId}`
                    : ''}
                </InlineNotice>
              ) : null}
              <Field label="Full name" required error={form.formState.errors.name?.message}>
                <Input {...form.register('name')} autoComplete="name" />
              </Field>
              <Field label="Email address" error={form.formState.errors.email?.message}>
                <Input {...form.register('email')} type="email" autoComplete="email" />
              </Field>
              <Field
                label="Registered phone"
                description="Phone changes require a separate verified identity workflow."
              >
                <Input value={query.data.normalizedPhone || 'Not recorded'} disabled readOnly />
              </Field>
              <div className="form-actions">
                <Button type="submit" leadingIcon={<Save size={17} />} loading={mutation.isPending}>
                  Save profile
                </Button>
              </div>
            </form>
          </Surface>
          <Surface className="side-note">
            <span className="summary-card__icon">
              <ShieldCheck size={18} />
            </span>
            <h2>Effective access</h2>
            <p>
              Your roles and action permissions are loaded from the server for every protected
              operation.
            </p>
            <div className="badge-list">
              {query.data.roles.map((role) => (
                <Badge key={role} tone="info">
                  {role.replaceAll('_', ' ')}
                </Badge>
              ))}
            </div>
          </Surface>
        </div>
      ) : null}
    </>
  );
}

function sessionTone(status: string | undefined) {
  return status === 'ACTIVE' ? 'success' : status === 'COMPROMISED' ? 'danger' : 'neutral';
}

export function SessionsScreen() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['sessions'],
    queryFn: ({ signal }) => apiList<SessionRecord>('/me/sessions', {}, signal),
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/me/sessions/${encodeURIComponent(id)}/revoke`, {
        method: 'POST',
        idempotent: true,
      }),
    onSuccess: async () => {
      setSuccess('Session revoked successfully.');
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
  const error = query.error instanceof ApiError ? query.error : null;
  const mutationError = revoke.error instanceof ApiError ? revoke.error : null;

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Sessions and devices"
        description="Review active administrator sessions and revoke access you no longer recognise."
      />
      <AccountTabs />
      {success ? <InlineNotice tone="success">{success}</InlineNotice> : null}
      {mutationError ? (
        <InlineNotice tone="danger">
          {mutationError.message}
          {mutationError.correlationId ? ` Support reference: ${mutationError.correlationId}` : ''}
        </InlineNotice>
      ) : null}
      {query.isLoading ? (
        <Skeleton className="skeleton-panel" />
      ) : error ? (
        <Surface className="page-state-surface">
          <ErrorState
            icon={<AlertTriangle />}
            title="Sessions could not be loaded"
            description={error.message}
            correlationId={error.correlationId}
            action={<Button onClick={() => void query.refetch()}>Try again</Button>}
          />
        </Surface>
      ) : query.data?.items.length ? (
        <div className="session-list">
          {query.data.items.map((session) => (
            <Surface className="session-row" key={session.id}>
              <span className="session-row__icon">
                <MonitorSmartphone size={19} />
              </span>
              <div className="session-row__copy">
                <div>
                  <strong>
                    {session.device?.label ?? session.device?.platform ?? 'Unknown device'}
                  </strong>
                  {session.current ? <Badge tone="info">Current session</Badge> : null}
                </div>
                <p>
                  Last seen{' '}
                  {session.lastSeenAt
                    ? new Intl.DateTimeFormat('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(session.lastSeenAt))
                    : 'not recorded'}
                </p>
              </div>
              <Badge tone={sessionTone(session.status)}>
                {(session.status ?? 'UNKNOWN').replaceAll('_', ' ')}
              </Badge>
              {session.current ? (
                <Button tone="quiet" size="sm" onClick={() => void logout()}>
                  Sign out
                </Button>
              ) : (
                <Button
                  tone="danger"
                  size="sm"
                  loading={revoke.isPending && revoke.variables === session.id}
                  onClick={() => revoke.mutate(session.id)}
                >
                  Revoke
                </Button>
              )}
            </Surface>
          ))}
        </div>
      ) : (
        <Surface className="page-state-surface">
          <EmptyState
            icon={<MonitorSmartphone />}
            title="No sessions returned"
            description="The authentication service returned no active sessions for this account."
            action={<Button onClick={() => void query.refetch()}>Refresh</Button>}
          />
        </Surface>
      )}
    </>
  );
}
