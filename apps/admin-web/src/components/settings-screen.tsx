'use client';

import { Button, ErrorState, InlineNotice, PermissionState, Skeleton, Surface } from '@manglam/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Building2, LockKeyhole, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from './auth-provider';
import { ConfiguredFormFields, transformFormValues, useConfiguredForm } from './configured-form';
import { PageHeader } from './page-header';
import { apiData, ApiError, isPermissionError } from '@/lib/api-client';
import type { FormFieldConfig } from '@/lib/resource-config';

const settingsFields: FormFieldConfig[] = [
  { key: 'name', label: 'Society name', type: 'text', required: true, maxLength: 150 },
  {
    key: 'timezone',
    label: 'Timezone',
    type: 'select',
    required: true,
    options: [{ value: 'Asia/Kolkata', label: 'Asia/Kolkata' }],
  },
  { key: 'supportPhone', label: 'Society support phone', type: 'tel' },
  { key: 'supportEmail', label: 'Society support email', type: 'email' },
  {
    key: 'visitorApprovalTimeoutSeconds',
    label: 'Visitor approval timeout (seconds)',
    type: 'number',
    required: true,
    min: 30,
    max: 600,
  },
  {
    key: 'longVisitThresholdMinutes',
    label: 'Long-visit threshold (minutes)',
    type: 'number',
    required: true,
    min: 60,
    max: 2880,
  },
  { key: 'emergencyContact', label: 'Emergency contact', type: 'tel', required: true },
  {
    key: 'noticeDefaultExpiryDays',
    label: 'Default notice expiry (days)',
    type: 'number',
    required: true,
    min: 1,
    max: 365,
  },
  {
    key: 'visitorPhotoRetentionDays',
    label: 'Visitor photo retention (days)',
    type: 'number',
    required: true,
    min: 1,
    max: 365,
  },
  {
    key: 'visitRecordRetentionDays',
    label: 'Visit record retention (days)',
    type: 'number',
    required: true,
    min: 30,
    max: 3650,
  },
];

function toFormValues(record: Record<string, unknown>) {
  return Object.fromEntries(
    settingsFields.map((field) => {
      const value = record[field.key];
      return [
        field.key,
        typeof value === 'boolean'
          ? value
          : value === null || value === undefined
            ? ''
            : String(value),
      ];
    }),
  );
}

export function SettingsScreen() {
  const { can } = useAuth();
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();
  const form = useConfiguredForm(settingsFields);
  const query = useQuery({
    queryKey: ['society-settings'],
    queryFn: () => apiData<Record<string, unknown> | null>('/society/settings'),
    enabled: can('society.settings.read'),
  });
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiData('/society/settings', {
        method: query.data ? 'PATCH' : 'POST',
        body: payload,
        idempotent: true,
      }),
    onSuccess: async () => {
      setSuccess(true);
      await queryClient.invalidateQueries({ queryKey: ['society-settings'] });
    },
  });

  useEffect(() => {
    if (query.data) form.reset(toFormValues(query.data));
  }, [form, query.data]);

  const error = query.error instanceof ApiError ? query.error : null;
  const mutationError = mutation.error instanceof ApiError ? mutation.error : null;

  return (
    <>
      <PageHeader
        eyebrow="Society structure"
        title="Society settings"
        description="Manage operational defaults and retention values for Manglam Balaji Society."
      />
      {!can('society.settings.read') ? (
        <Surface className="page-state-surface">
          <PermissionState
            icon={<LockKeyhole />}
            title="Permission required"
            description="Your account cannot view society settings."
          />
        </Surface>
      ) : query.isLoading ? (
        <div className="settings-layout">
          <Skeleton className="skeleton-panel" />
          <Skeleton className="skeleton-panel" />
        </div>
      ) : error ? (
        <Surface className="page-state-surface">
          {isPermissionError(error) ? (
            <PermissionState
              icon={<LockKeyhole />}
              title="Settings access denied"
              description={error.message}
            />
          ) : (
            <ErrorState
              icon={<AlertTriangle />}
              title="Settings could not be loaded"
              description={error.message}
              correlationId={error.correlationId}
              action={<Button onClick={() => void query.refetch()}>Try again</Button>}
            />
          )}
        </Surface>
      ) : (
        <div className="settings-layout">
          <Surface className="settings-form">
            <form
              className="form-stack"
              onSubmit={form.handleSubmit((values) =>
                mutation.mutate(transformFormValues(values, settingsFields)),
              )}
              noValidate
            >
              {success ? (
                <InlineNotice tone="success">Society settings saved successfully.</InlineNotice>
              ) : null}
              {mutationError ? (
                <ErrorState
                  icon={<AlertTriangle />}
                  title="Settings were not saved"
                  description={mutationError.message}
                  correlationId={mutationError.correlationId}
                />
              ) : null}
              {!query.data ? (
                <InlineNotice tone="warning">
                  No settings record exists yet. Saving will create the single society settings
                  record.
                </InlineNotice>
              ) : null}
              <ConfiguredFormFields
                control={form.control}
                fields={settingsFields}
                disabled={mutation.isPending || !can('society.settings.manage')}
              />
              <div className="form-actions">
                {can('society.settings.manage') ? (
                  <Button
                    type="submit"
                    leadingIcon={<Save size={17} />}
                    loading={mutation.isPending}
                  >
                    Save settings
                  </Button>
                ) : (
                  <span className="lookup-status">Your account has read-only access.</span>
                )}
              </div>
            </form>
          </Surface>
          <Surface className="side-note">
            <span className="summary-card__icon">
              <Building2 size={18} />
            </span>
            <h2>Single-society boundary</h2>
            <p>
              These values apply only to Manglam Balaji Society. Operational modules load the same
              server-controlled settings.
            </p>
            <ul>
              <li>Times are stored in UTC and displayed in the configured timezone.</li>
              <li>
                Retention changes affect lifecycle jobs; they do not silently erase audit or finance
                records.
              </li>
              <li>Visitor timeouts are enforced by the API, not by this browser.</li>
            </ul>
          </Surface>
        </div>
      )}
    </>
  );
}
