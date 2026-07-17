import { useEffect, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import {
  Button,
  Field,
  PageHeader,
  Pill,
  QueryState,
  RefreshAction,
  Row,
  Screen,
  Section,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { complaintApi, noticeApi, uploadComplaintFile } from '@/lib/resident-api';
import { useConnectivity } from '@/providers/ConnectivityProvider';
import { colors, spacing, typography } from '@/theme/tokens';

function present(query: { error: unknown; isLoading: boolean; refetch: () => unknown }) {
  const c = useConnectivity();
  return {
    error: query.error,
    isLoading: query.isLoading,
    isOffline: c.isResolved && !c.isOnline,
    onRetry: () => void query.refetch(),
  };
}
function ErrorLine({ error }: { error: unknown }) {
  return error ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {errorMessage(error)}
    </Text>
  ) : null;
}

export function UpdatesScreen() {
  const notices = useApiQuery(['notices'], () => noticeApi.list({ limit: 30 }));
  const complaints = useApiQuery(['complaints'], () => complaintApi.list({ limit: 30 }));
  return (
    <Screen>
      <PageHeader
        action={
          <RefreshAction
            onPress={() => {
              void notices.refetch();
              void complaints.refetch();
            }}
          />
        }
        subtitle="Notices and your recorded complaints."
        title="Updates"
      />
      <QueryState {...present(notices)}>
        <Section title="Notices">
          {(notices.data?.items.length ?? 0) === 0 ? (
            <Row detail="There are no published notices for this home." title="No notices" />
          ) : (
            notices.data?.items.map((notice) => (
              <Row
                detail={formatDateTime(notice.publishedAt)}
                key={notice.id}
                onPress={() => router.push('/notices/' + notice.id)}
                title={notice.title}
              >
                <Pill
                  label={notice.priority}
                  tone={
                    notice.priority === 'URGENT'
                      ? 'danger'
                      : notice.priority === 'IMPORTANT'
                        ? 'warning'
                        : 'neutral'
                  }
                />
              </Row>
            ))
          )}
        </Section>
        <Section title="Complaints">
          <Button onPress={() => router.push('/complaints/new')}>Create complaint</Button>
          {(complaints.data?.items.length ?? 0) === 0 ? (
            <Row detail="No complaint has been recorded from this home." title="No complaints" />
          ) : (
            complaints.data?.items.map((complaint) => (
              <Row
                detail={complaint.referenceNumber + '. ' + formatDateTime(complaint.updatedAt)}
                key={complaint.id}
                onPress={() => router.push('/complaints/' + complaint.id)}
                title={complaint.subject}
              >
                <Pill label={complaint.status} />
              </Row>
            ))
          )}
        </Section>
      </QueryState>
    </Screen>
  );
}

export function NoticeDetailScreen({ id }: { id: string }) {
  const client = useQueryClient();
  const notice = useApiQuery(['notice', id], () => noticeApi.detail(id));
  const read = useMutation({
    mutationFn: () => noticeApi.markRead(id),
    onSettled: () => void client.invalidateQueries({ queryKey: ['notice', id] }),
  });
  const ack = useMutation({
    mutationFn: () => noticeApi.acknowledge(id),
    onSettled: () => void client.invalidateQueries({ queryKey: ['notice', id] }),
  });
  const data = notice.data;
  useEffect(() => {
    if (data && !data.isRead && !read.isPending) read.mutate();
  }, [data, read]);
  return (
    <Screen>
      <PageHeader title="Notice" />
      <QueryState {...present(notice)}>
        {data ? (
          <>
            <Section>
              <Row
                detail={data.category + ' . Published ' + formatDateTime(data.publishedAt)}
                title={data.title}
              >
                <Pill
                  label={data.priority}
                  tone={
                    data.priority === 'URGENT'
                      ? 'danger'
                      : data.priority === 'IMPORTANT'
                        ? 'warning'
                        : 'neutral'
                  }
                />
              </Row>
              <Text style={styles.body}>{data.body}</Text>
            </Section>
            {data.attachments.length > 0 ? (
              <Section title="Attachments">
                {data.attachments.map((file) => (
                  <Row detail={file.mimeType} key={file.id} title={file.fileName} />
                ))}
              </Section>
            ) : null}
            {data.requiresAcknowledgement ? (
              <Section title="Acknowledgement">
                {data.acknowledgedAt ? (
                  <Row detail={formatDateTime(data.acknowledgedAt)} title="Acknowledged" />
                ) : (
                  <>
                    <Text style={styles.body}>
                      Your acknowledgement is recorded for the society office.
                    </Text>
                    <Button disabled={ack.isPending} onPress={() => ack.mutate()}>
                      Acknowledge notice
                    </Button>
                    <ErrorLine error={ack.error} />
                  </>
                )}
              </Section>
            ) : null}
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}

const complaintSchema = z.object({
  categoryId: z.string().min(1, 'Choose a complaint category.'),
  description: z.string().trim().min(10, 'Describe the issue in at least 10 characters.').max(3000),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  subject: z.string().trim().min(4, 'Enter a clear subject.').max(160),
});
export function ComplaintNewScreen() {
  const client = useQueryClient();
  const categories = useApiQuery(['complaint-categories'], complaintApi.categories);
  const [attachment, setAttachment] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const form = useForm({
    defaultValues: { categoryId: '', description: '', priority: 'NORMAL' as const, subject: '' },
  });
  const create = useMutation({
    mutationFn: async (values: {
      attachment: DocumentPicker.DocumentPickerAsset | null;
      categoryId: string;
      description: string;
      priority: string;
      subject: string;
    }) => {
      const attachmentFileIds = values.attachment
        ? [
            await uploadComplaintFile({
              fileName: values.attachment.name,
              mimeType: values.attachment.mimeType ?? 'application/octet-stream',
              size: values.attachment.size ?? 0,
              uri: values.attachment.uri,
            }),
          ]
        : undefined;
      return complaintApi.create({ ...values, attachmentFileIds });
    },
    onSuccess: (complaint) => {
      void client.invalidateQueries({ queryKey: ['complaints'] });
      router.replace('/complaints/' + complaint.id);
    },
  });
  const choose = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: ['image/*', 'application/pdf'],
    });
    if (!result.canceled) setAttachment(result.assets[0] ?? null);
  };
  const submit = form.handleSubmit((values) => {
    const parsed = complaintSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) =>
        form.setError(issue.path[0] as 'subject', { message: issue.message }),
      );
      return;
    }
    create.mutate({ ...parsed.data, attachment });
  });
  return (
    <Screen>
      <PageHeader
        subtitle="Attachments are uploaded to private storage and scanned by the server."
        title="New complaint"
      />
      <QueryState {...present(categories)}>
        <Section>
          <View style={styles.form}>
            <Text style={styles.label}>Category</Text>
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field, fieldState }) => (
                <View style={styles.choices}>
                  {(categories.data?.items ?? [])
                    .filter((category) => category.isActive)
                    .map((category) => (
                      <Button
                        key={category.id}
                        onPress={() => field.onChange(category.id)}
                        tone={field.value === category.id ? 'primary' : 'secondary'}
                      >
                        {category.name}
                      </Button>
                    ))}
                  {fieldState.error ? (
                    <Text style={styles.error}>{fieldState.error.message}</Text>
                  ) : null}
                </View>
              )}
            />
            <Controller
              control={form.control}
              name="subject"
              render={({ field, fieldState }) => (
                <Field
                  error={fieldState.error?.message}
                  label="Subject"
                  onChangeText={field.onChange}
                  value={field.value}
                />
              )}
            />
            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <Field
                  error={fieldState.error?.message}
                  label="Description"
                  multiline
                  onChangeText={field.onChange}
                  value={field.value}
                />
              )}
            />
            <Text style={styles.label}>Priority</Text>
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <View style={styles.choices}>
                  {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((priority) => (
                    <Button
                      key={priority}
                      onPress={() => field.onChange(priority)}
                      tone={field.value === priority ? 'primary' : 'secondary'}
                    >
                      {priority}
                    </Button>
                  ))}
                </View>
              )}
            />
            <Button onPress={() => void choose()} tone="secondary">
              {attachment ? 'Attachment: ' + attachment.name : 'Attach photo or PDF'}
            </Button>
            <ErrorLine error={create.error} />
            <Button disabled={create.isPending} onPress={submit}>
              {create.isPending ? 'Submitting complaint' : 'Submit complaint'}
            </Button>
          </View>
        </Section>
      </QueryState>
    </Screen>
  );
}

export function ComplaintDetailScreen({ id }: { id: string }) {
  const client = useQueryClient();
  const complaint = useApiQuery(['complaint', id], () => complaintApi.detail(id));
  const form = useForm({ defaultValues: { body: '' } });
  const comment = useMutation({
    mutationFn: (body: string) => complaintApi.comment(id, body),
    onSuccess: () => {
      form.reset();
      void client.invalidateQueries({ queryKey: ['complaint', id] });
    },
  });
  const action = useMutation({
    mutationFn: (choice: 'close' | 'reopen') => complaintApi.transition(id, choice),
    onSettled: () => void client.invalidateQueries({ queryKey: ['complaint', id] }),
  });
  const data = complaint.data;
  return (
    <Screen>
      <PageHeader title="Complaint" />
      <QueryState {...present(complaint)}>
        {data ? (
          <>
            <Section>
              <Row detail={data.referenceNumber + ' . ' + data.category.name} title={data.subject}>
                <Pill label={data.status} />
              </Row>
              <Text style={styles.body}>{data.description}</Text>
              {data.resolutionNote ? (
                <Row detail={data.resolutionNote} title="Resolution note" />
              ) : null}
              {data.status === 'RESOLVED' ? (
                <Button
                  disabled={action.isPending}
                  onPress={() => action.mutate('reopen')}
                  tone="secondary"
                >
                  Reopen complaint
                </Button>
              ) : null}
              {['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(data.status) ? (
                <Button
                  disabled={action.isPending}
                  onPress={() => action.mutate('close')}
                  tone="secondary"
                >
                  Close complaint
                </Button>
              ) : null}
              <ErrorLine error={action.error} />
            </Section>
            <Section title="Comments">
              {data.comments.length === 0 ? (
                <Row detail="No visible comments have been added." title="No comments" />
              ) : (
                data.comments.map((item) => (
                  <Row
                    detail={formatDateTime(item.createdAt)}
                    key={item.id}
                    title={item.authorLabel}
                  >
                    {item.body}
                  </Row>
                ))
              )}
              <Controller
                control={form.control}
                name="body"
                render={({ field }) => (
                  <Field
                    label="Add a comment"
                    multiline
                    onChangeText={field.onChange}
                    value={field.value}
                  />
                )}
              />
              <Button
                disabled={comment.isPending || form.watch('body').trim().length === 0}
                onPress={form.handleSubmit((v) => comment.mutate(v.body.trim()))}
              >
                Add comment
              </Button>
              <ErrorLine error={comment.error} />
            </Section>
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: 23,
    paddingVertical: spacing.md,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { color: colors.danger, fontSize: typography.caption },
  form: { gap: spacing.lg, paddingVertical: spacing.md },
  label: { color: colors.ink, fontSize: typography.caption, fontWeight: '700' },
});
