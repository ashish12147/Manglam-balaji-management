'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Checkbox,
  Field,
  InlineNotice,
  Input,
  PermissionState,
  Select,
  Surface,
  Textarea,
} from '@manglam/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, FileUp, LockKeyhole, Megaphone, Save, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { useAuth } from './auth-provider';
import { PageHeader } from './page-header';
import { apiData, apiList, apiRequest, ApiError } from '@/lib/api-client';
import type { ApiRecord } from '@/lib/api-types';

const noticeSchema = z
  .object({
    title: z.string().trim().min(3, 'Enter a notice title.').max(180),
    body: z.string().trim().min(10, 'Enter the notice content.').max(20_000),
    category: z.enum([
      'GENERAL',
      'URGENT',
      'MAINTENANCE',
      'WATER',
      'ELECTRICITY',
      'MEETING',
      'OTHER',
    ]),
    priority: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']),
    publishAt: z.string(),
    expiresAt: z.string(),
    audienceType: z.enum(['ALL_RESIDENTS', 'ROLE', 'BLOCK', 'FLAT']),
    targetIds: z.array(z.string()),
    acknowledgementRequired: z.boolean(),
  })
  .superRefine((values, context) => {
    if (values.audienceType !== 'ALL_RESIDENTS' && !values.targetIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['targetIds'],
        message: 'Select at least one audience target.',
      });
    }
    if (
      values.publishAt &&
      values.expiresAt &&
      new Date(values.expiresAt) <= new Date(values.publishAt)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'Expiry must be after publication.',
      });
    }
  });

type NoticeValues = z.infer<typeof noticeSchema>;
type SubmitMode = 'draft' | 'publish';

function labelFor(record: ApiRecord, type: NoticeValues['audienceType']) {
  if (type === 'ROLE') return String(record.name ?? record.code ?? record.id);
  if (type === 'BLOCK') return [record.code, record.name].filter(Boolean).join(' - ') || record.id;
  if (type === 'FLAT') {
    const block =
      typeof record.block === 'object' && record.block
        ? (record.block as Record<string, unknown>).code
        : undefined;
    return [block, record.number, record.displayName].filter(Boolean).join(' - ') || record.id;
  }
  return record.id;
}

function AudiencePicker({
  onChange,
  type,
  value,
}: {
  onChange: (ids: string[]) => void;
  type: NoticeValues['audienceType'];
  value: string[];
}) {
  const endpoint =
    type === 'ROLE'
      ? '/roles'
      : type === 'BLOCK'
        ? '/society/blocks'
        : type === 'FLAT'
          ? '/society/flats'
          : null;
  const query = useQuery({
    queryKey: ['notice-audience', endpoint],
    queryFn: ({ signal }) =>
      apiList<ApiRecord>(endpoint!, { status: 'ACTIVE', limit: 250 }, signal),
    enabled: Boolean(endpoint),
  });

  if (!endpoint)
    return (
      <InlineNotice tone="info">
        All residents with an active approved membership will be materialized as recipients when the
        notice is published.
      </InlineNotice>
    );
  if (query.isLoading) return <p className="lookup-status">Loading eligible audience targets...</p>;
  if (query.isError)
    return (
      <InlineNotice tone="danger">
        Audience targets could not be loaded.{' '}
        <button className="lookup-retry" type="button" onClick={() => void query.refetch()}>
          Retry
        </button>
      </InlineNotice>
    );
  if (!query.data?.items.length)
    return (
      <InlineNotice tone="warning">
        No eligible audience targets are available for this selection.
      </InlineNotice>
    );

  return (
    <div className="multi-select-list">
      {query.data.items.map((record) => (
        <label key={record.id}>
          <input
            type="checkbox"
            checked={value.includes(record.id)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...value, record.id]
                  : value.filter((id) => id !== record.id),
              )
            }
          />
          <span>{labelFor(record, type)}</span>
        </label>
      ))}
    </div>
  );
}

async function uploadAttachment(file: File) {
  const intent = await apiData<{ fileId?: string; id?: string; uploadUrl: string }>(
    '/files/upload-intents',
    {
      method: 'POST',
      body: { fileName: file.name, mimeType: file.type, size: file.size, parentType: 'NOTICE' },
      idempotent: true,
    },
  );
  const fileId = intent.fileId ?? intent.id;
  if (!fileId || !intent.uploadUrl)
    throw new ApiError(
      500,
      'UPLOAD_INTENT_INVALID',
      'The upload service returned an incomplete upload intent.',
    );

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(intent.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
  } catch {
    throw new ApiError(
      0,
      'UPLOAD_NETWORK_ERROR',
      'The attachment could not be uploaded to private storage.',
    );
  }
  if (!uploadResponse.ok)
    throw new ApiError(
      uploadResponse.status,
      'UPLOAD_FAILED',
      'Private storage rejected the attachment upload.',
    );

  await apiRequest(`/files/${encodeURIComponent(fileId)}/complete`, {
    method: 'POST',
    body: {},
    idempotent: true,
  });
  return fileId;
}

export function NoticeEditor() {
  const { can } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitMode, setSubmitMode] = useState<SubmitMode>('draft');
  const form = useForm<NoticeValues>({
    resolver: zodResolver(noticeSchema),
    defaultValues: {
      title: '',
      body: '',
      category: 'GENERAL',
      priority: 'NORMAL',
      publishAt: '',
      expiresAt: '',
      audienceType: 'ALL_RESIDENTS',
      targetIds: [],
      acknowledgementRequired: false,
    },
  });
  const audienceType = useWatch({ control: form.control, name: 'audienceType' });
  const targetIds = useWatch({ control: form.control, name: 'targetIds' });

  const mutation = useMutation({
    mutationFn: async (values: NoticeValues) => {
      const attachmentIds = file ? [await uploadAttachment(file)] : [];
      const notice = await apiData<ApiRecord>('/notices', {
        method: 'POST',
        body: {
          ...values,
          publishAt: values.publishAt || undefined,
          expiresAt: values.expiresAt || undefined,
          attachmentIds,
        },
        idempotent: true,
      });
      if (submitMode === 'publish') {
        await apiRequest(`/notices/${encodeURIComponent(notice.id)}/publish`, {
          method: 'POST',
          body: {},
          idempotent: true,
        });
      }
      return notice;
    },
    onSuccess: () => router.push('/communication/notices'),
  });

  if (!can('notice.create')) {
    return (
      <Surface className="page-state-surface">
        <PermissionState
          icon={<LockKeyhole />}
          title="Permission required"
          description="Your account cannot create society notices."
        />
      </Surface>
    );
  }

  const error = mutation.error instanceof ApiError ? mutation.error : null;

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Create notice"
        description="Prepare an audience-scoped notice with optional private attachments and acknowledgement tracking."
      />
      <form
        className="editor-layout"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <Surface className="editor-form form-stack">
          {error ? (
            <InlineNotice tone="danger">
              <AlertTriangle size={18} />
              <span>
                {error.message}
                {error.correlationId ? (
                  <>
                    <br />
                    <small>Support reference: {error.correlationId}</small>
                  </>
                ) : null}
              </span>
            </InlineNotice>
          ) : null}
          <section className="form-section">
            <h2>Notice content</h2>
            <Field label="Title" required error={form.formState.errors.title?.message}>
              <Input {...form.register('title')} maxLength={180} disabled={mutation.isPending} />
            </Field>
            <Field label="Body" required error={form.formState.errors.body?.message}>
              <Textarea
                {...form.register('body')}
                rows={10}
                maxLength={20_000}
                disabled={mutation.isPending}
              />
            </Field>
            <div className="form-grid">
              <Field label="Category" required error={form.formState.errors.category?.message}>
                <Select {...form.register('category')}>
                  <option value="GENERAL">General</option>
                  <option value="URGENT">Urgent</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="WATER">Water</option>
                  <option value="ELECTRICITY">Electricity</option>
                  <option value="MEETING">Meeting</option>
                  <option value="OTHER">Other</option>
                </Select>
              </Field>
              <Field label="Priority" required error={form.formState.errors.priority?.message}>
                <Select {...form.register('priority')}>
                  <option value="NORMAL">Normal</option>
                  <option value="IMPORTANT">Important</option>
                  <option value="URGENT">Urgent</option>
                </Select>
              </Field>
              <Field
                label="Publish at"
                description="Leave empty when saving a draft or publishing now."
              >
                <Input type="datetime-local" {...form.register('publishAt')} />
              </Field>
              <Field label="Expires at" error={form.formState.errors.expiresAt?.message}>
                <Input type="datetime-local" {...form.register('expiresAt')} />
              </Field>
            </div>
          </section>

          <section className="form-section">
            <h2>Audience</h2>
            <Field label="Target audience" required>
              <Select
                {...form.register('audienceType', {
                  onChange: () => form.setValue('targetIds', []),
                })}
              >
                <option value="ALL_RESIDENTS">All active residents</option>
                <option value="ROLE">Selected roles</option>
                <option value="BLOCK">Selected blocks</option>
                <option value="FLAT">Selected flats</option>
              </Select>
            </Field>
            <Field
              label="Recipients"
              required={audienceType !== 'ALL_RESIDENTS'}
              error={form.formState.errors.targetIds?.message}
            >
              <AudiencePicker
                type={audienceType}
                value={targetIds}
                onChange={(ids) => form.setValue('targetIds', ids, { shouldValidate: true })}
              />
            </Field>
            <Checkbox
              label="Require acknowledgement"
              description="Residents receive an explicit acknowledgement action after reading."
              {...form.register('acknowledgementRequired')}
            />
          </section>

          <section className="form-section">
            <h2>Attachment</h2>
            <div className="file-control">
              <Field
                label="Private attachment"
                description="JPEG, PNG, WebP, or PDF. The server scans every upload before it becomes available."
                error={fileError ?? undefined}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={mutation.isPending}
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setFileError(null);
                    if (nextFile && nextFile.size > 10 * 1024 * 1024) {
                      setFile(null);
                      setFileError('Attachment must be 10 MB or smaller.');
                      return;
                    }
                    setFile(nextFile);
                  }}
                />
              </Field>
            </div>
          </section>

          <div className="form-actions">
            <Button
              tone="secondary"
              type="submit"
              leadingIcon={<Save size={17} />}
              loading={mutation.isPending && submitMode === 'draft'}
              onClick={() => setSubmitMode('draft')}
            >
              Save draft
            </Button>
            {can('notice.publish') ? (
              <Button
                type="submit"
                leadingIcon={<Send size={17} />}
                loading={mutation.isPending && submitMode === 'publish'}
                onClick={() => setSubmitMode('publish')}
              >
                Publish now
              </Button>
            ) : null}
          </div>
        </Surface>
        <Surface className="side-note">
          <span className="summary-card__icon">
            <Megaphone size={18} />
          </span>
          <h2>Publication controls</h2>
          <p>
            Publishing freezes notice content and materializes recipients in one server transaction.
            Drafts remain editable through authorised API actions.
          </p>
          <ul>
            <li>Urgent notices use the critical notification path.</li>
            <li>Attachments remain private until scanning is complete.</li>
            <li>Reads and acknowledgements are tracked separately.</li>
          </ul>
          {file ? (
            <InlineNotice tone="info">
              <FileUp size={16} />
              {file.name}
            </InlineNotice>
          ) : null}
        </Surface>
      </form>
    </>
  );
}
