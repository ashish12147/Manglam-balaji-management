'use client';

import { Button, Dialog, ErrorState, PermissionState, Skeleton } from '@manglam/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, LockKeyhole } from 'lucide-react';
import { useEffect } from 'react';

import { ConfiguredFormFields, transformFormValues, useConfiguredForm } from './configured-form';
import { apiData, apiDownload, ApiError, isPermissionError } from '@/lib/api-client';
import type { ApiRecord } from '@/lib/api-types';
import type { CreateConfig, ResourceActionConfig, ResourceConfig } from '@/lib/resource-config';

function endpointFor(base: string, id: string, suffix: string) {
  return `${base.replace(/\/$/, '')}/${encodeURIComponent(id)}${suffix}`;
}

export function CreateRecordDialog({
  config,
  onClose,
  onSuccess,
  open,
  resourceEndpoint,
}: {
  config: CreateConfig;
  onClose: () => void;
  onSuccess: (message: string) => void;
  open: boolean;
  resourceEndpoint: string;
}) {
  const form = useConfiguredForm(config.fields);
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiData(config.endpoint ?? resourceEndpoint, {
        method: 'POST',
        body: payload,
        idempotent: true,
      }),
    onSuccess: () => {
      form.reset();
      onSuccess(config.successMessage);
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
      mutation.reset();
    }
  }, [form, mutation, open]);

  const error = mutation.error instanceof ApiError ? mutation.error : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={config.title}
      description={config.description}
      width="lg"
      footer={
        <>
          <Button tone="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="create-record-form" loading={mutation.isPending}>
            {config.label}
          </Button>
        </>
      }
    >
      <form
        id="create-record-form"
        onSubmit={form.handleSubmit((values) =>
          mutation.mutate(transformFormValues(values, config.fields)),
        )}
        noValidate
        className="form-stack"
      >
        {error ? (
          <ErrorState
            icon={<AlertTriangle />}
            title="The record was not created"
            description={error.message}
            correlationId={error.correlationId}
          />
        ) : null}
        <ConfiguredFormFields
          control={form.control}
          fields={config.fields}
          disabled={mutation.isPending}
        />
      </form>
    </Dialog>
  );
}

export function RecordActionDialog({
  action,
  onClose,
  onSuccess,
  open,
  record,
  resourceEndpoint,
}: {
  action: ResourceActionConfig | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
  open: boolean;
  record: ApiRecord | null;
  resourceEndpoint: string;
}) {
  const fields = action?.fields ?? [];
  const form = useConfiguredForm(fields);
  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!action || !record) return;
      const path = endpointFor(resourceEndpoint, record.id, action.suffix);
      if (action.downloadFileName) {
        await apiDownload(path, action.downloadFileName);
        return;
      }
      await apiData(path, {
        method: action.method ?? 'POST',
        body: payload,
        idempotent: true,
      });
    },
    onSuccess: () => {
      if (!action) return;
      form.reset();
      onSuccess(action.successMessage);
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
      mutation.reset();
    }
  }, [form, mutation, open]);

  if (!action) return null;
  const error = mutation.error instanceof ApiError ? mutation.error : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={action.label}
      description={action.description}
      width={fields.length > 2 ? 'lg' : 'sm'}
      footer={
        <>
          <Button tone="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="record-action-form"
            tone={action.tone === 'danger' ? 'danger' : 'primary'}
            loading={mutation.isPending}
          >
            {action.label}
          </Button>
        </>
      }
    >
      <form
        id="record-action-form"
        className="form-stack"
        onSubmit={form.handleSubmit((values) =>
          mutation.mutate(transformFormValues(values, fields)),
        )}
        noValidate
      >
        {error ? (
          isPermissionError(error) ? (
            <PermissionState
              icon={<LockKeyhole />}
              title="Action not permitted"
              description={error.message}
            />
          ) : (
            <ErrorState
              icon={<AlertTriangle />}
              title="The action was not completed"
              description={error.message}
              correlationId={error.correlationId}
            />
          )
        ) : null}
        {fields.length ? (
          <ConfiguredFormFields
            control={form.control}
            fields={fields}
            disabled={mutation.isPending}
          />
        ) : (
          <p className="confirmation-copy">
            This action is sent to the server immediately and recorded with your account.
          </p>
        )}
      </form>
    </Dialog>
  );
}

const SENSITIVE_KEY = /(password|secret|token|hash|digest|privatekey|otp|pin)/i;

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatDetailValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf()))
      return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(
        date,
      );
  }
  if (Array.isArray(value)) return `${value.length} record${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return String(
      record.displayName ??
        record.name ??
        record.code ??
        record.reference ??
        record.id ??
        'Recorded',
    );
  }
  return String(value).replaceAll('_', ' ');
}

function simpleEntries(record: ApiRecord) {
  return Object.entries(record).filter(
    ([key, value]) => !SENSITIVE_KEY.test(key) && !Array.isArray(value),
  );
}

export function RecordDetailDialog({
  config,
  onClose,
  open,
  record,
}: {
  config: ResourceConfig;
  onClose: () => void;
  open: boolean;
  record: ApiRecord | null;
}) {
  const detailQuery = useQuery({
    queryKey: ['resource-detail', config.endpoint, record?.id],
    queryFn: () =>
      apiData<ApiRecord>(`${config.endpoint.replace(/\/$/, '')}/${encodeURIComponent(record!.id)}`),
    enabled: open && Boolean(record),
    retry: false,
  });

  const error = detailQuery.error instanceof ApiError ? detailQuery.error : null;
  const detail = detailQuery.data;
  const collections = detail
    ? (Object.entries(detail).filter(
        ([key, value]) => !SENSITIVE_KEY.test(key) && Array.isArray(value),
      ) as Array<[string, unknown[]]>)
    : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${config.title} details`}
      description="Live data returned by the authorised API."
      width="lg"
    >
      {detailQuery.isLoading ? (
        <div className="form-stack">
          <Skeleton style={{ height: 120 }} />
          <Skeleton style={{ height: 220 }} />
        </div>
      ) : error ? (
        isPermissionError(error) ? (
          <PermissionState
            icon={<LockKeyhole />}
            title="Details not permitted"
            description={error.message}
          />
        ) : (
          <ErrorState
            icon={<AlertTriangle />}
            title="Details could not be loaded"
            description={error.message}
            correlationId={error.correlationId}
            action={<Button onClick={() => void detailQuery.refetch()}>Try again</Button>}
          />
        )
      ) : detail ? (
        <div className="form-stack">
          <dl className="detail-grid">
            {simpleEntries(detail).map(([key, value]) => (
              <div className="detail-item" key={key}>
                <dt>{humanize(key)}</dt>
                <dd>{formatDetailValue(value)}</dd>
              </div>
            ))}
          </dl>
          {collections.map(([key, values]) => (
            <section className="detail-collection" key={key}>
              <h3>{humanize(key)}</h3>
              {values.length ? (
                <div className="detail-collection__list">
                  {values.slice(0, 50).map((value, index) => (
                    <dl
                      key={
                        typeof value === 'object' && value && 'id' in value
                          ? String((value as { id: unknown }).id)
                          : index
                      }
                    >
                      {typeof value === 'object' && value ? (
                        Object.entries(value as Record<string, unknown>)
                          .filter(([entryKey]) => !SENSITIVE_KEY.test(entryKey))
                          .slice(0, 8)
                          .map(([entryKey, entryValue]) => (
                            <div key={entryKey}>
                              <dt>{humanize(entryKey)}</dt>
                              <dd>{formatDetailValue(entryValue)}</dd>
                            </div>
                          ))
                      ) : (
                        <div>
                          <dt>Value</dt>
                          <dd>{formatDetailValue(value)}</dd>
                        </div>
                      )}
                    </dl>
                  ))}
                </div>
              ) : (
                <p className="lookup-status">No related records.</p>
              )}
            </section>
          ))}
        </div>
      ) : null}
    </Dialog>
  );
}
