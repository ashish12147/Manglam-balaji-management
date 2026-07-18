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
import { formatDateTime, toLocalDateTimeInput } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { visitorApi } from '@/lib/resident-api';
import { useConnectivity } from '@/providers/ConnectivityProvider';
import { colors, spacing, typography } from '@/theme/tokens';

function useQueryPresentation(query: {
  error: unknown;
  isLoading: boolean;
  refetch: () => unknown;
}) {
  const connection = useConnectivity();
  return {
    error: query.error,
    isLoading: query.isLoading,
    isOffline: connection.isResolved && !connection.isOnline,
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

export function VisitorsScreen() {
  const pre = useApiQuery(['preapprovals'], () => visitorApi.preApprovals({ limit: 30 }));
  const history = useApiQuery(['visits'], () => visitorApi.visits({ limit: 30 }));
  return (
    <Screen>
      <PageHeader
        action={
          <RefreshAction
            onPress={() => {
              void pre.refetch();
              void history.refetch();
            }}
          />
        }
        subtitle="Pre-approved access and entry history for your selected home."
        title="Visitors"
      />
      <Button onPress={() => router.push('/visitor/new')}>Pre-approve visitor</Button>
      <QueryState {...useQueryPresentation(pre)}>
        <Section title="Active pre-approvals">
          {(pre.data?.items.length ?? 0) === 0 ? (
            <Row
              detail="Create a pre-approval when you expect someone."
              title="No active pre-approvals"
            />
          ) : (
            pre.data?.items.map((visit) => (
              <Row
                detail={'Valid until ' + formatDateTime(visit.validUntil)}
                key={visit.id}
                onPress={() => router.push('/visitor/' + visit.id)}
                title={visit.visitorName}
              >
                <Pill label={visit.status} />
              </Row>
            ))
          )}
        </Section>
        <Section title="Entry history">
          {(history.data?.items.length ?? 0) === 0 ? (
            <Row
              detail="The gate has not recorded visitor activity for this home."
              title="No visitor history"
            />
          ) : (
            history.data?.items.map((visit) => (
              <Row
                detail={formatDateTime(visit.checkedInAt ?? visit.arrivedAt ?? visit.expectedAt)}
                key={visit.id}
                onPress={() => router.push('/visitor/' + visit.id)}
                title={visit.visitorName}
              >
                <Pill label={visit.status} />
              </Row>
            ))
          )}
        </Section>
      </QueryState>
    </Screen>
  );
}

const schema = z.object({
  expectedAt: z.string().min(16, 'Choose an expected arrival time.'),
  purpose: z.string().trim().max(240).optional(),
  vehicleNumber: z.string().trim().max(20).optional(),
  visitorName: z.string().trim().min(2, 'Enter the visitor name.').max(120),
  visitorPhone: z.string().trim().optional(),
});

export function VisitorPreApprovalScreen() {
  const client = useQueryClient();
  const form = useForm({
    defaultValues: {
      category: 'GUEST',
      expectedAt: toLocalDateTimeInput(new Date()),
      purpose: '',
      vehicleNumber: '',
      visitorName: '',
      visitorPhone: '',
    },
  });
  const mutation = useMutation({
    mutationFn: visitorApi.preApprove,
    onSuccess: (data) => {
      void client.invalidateQueries({ queryKey: ['preapprovals'] });
      router.replace('/visitor/' + data.id);
    },
  });
  const submit = form.handleSubmit((values) => {
    const result = schema.safeParse(values);
    if (!result.success) {
      result.error.issues.forEach((issue) =>
        form.setError(issue.path[0] as 'visitorName', { message: issue.message }),
      );
      return;
    }
    const expectedAt = new Date(values.expectedAt);
    if (Number.isNaN(expectedAt.getTime())) {
      form.setError('expectedAt', { message: 'Use a valid local date and time.' });
      return;
    }
    mutation.mutate({
      category: values.category,
      expectedAt: expectedAt.toISOString(),
      visitorName: result.data.visitorName,
      ...(result.data.purpose ? { purpose: result.data.purpose } : {}),
      ...(result.data.vehicleNumber ? { vehicleNumber: result.data.vehicleNumber } : {}),
      ...(result.data.visitorPhone ? { visitorPhone: result.data.visitorPhone } : {}),
    });
  });
  return (
    <Screen>
      <PageHeader
        subtitle="The gate verifies a code generated by the server."
        title="Pre-approve visitor"
      />
      <Section>
        <View style={styles.form}>
          <Text style={styles.label}>Visitor type</Text>
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <View style={styles.choices}>
                {['GUEST', 'DELIVERY', 'CAB', 'SERVICE_PROVIDER', 'OTHER'].map((type) => (
                  <PillChoice
                    active={field.value === type}
                    key={type}
                    label={type.replaceAll('_', ' ')}
                    onPress={() => field.onChange(type)}
                  />
                ))}
              </View>
            )}
          />
          <Controller
            control={form.control}
            name="visitorName"
            render={({ field, fieldState }) => (
              <Field
                error={fieldState.error?.message}
                label="Visitor name"
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
          <Controller
            control={form.control}
            name="expectedAt"
            render={({ field, fieldState }) => (
              <Field
                error={fieldState.error?.message}
                label="Expected arrival (YYYY-MM-DDTHH:MM)"
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
          <Controller
            control={form.control}
            name="visitorPhone"
            render={({ field }) => (
              <Field
                keyboardType="phone-pad"
                label="Mobile number (optional)"
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
          <Controller
            control={form.control}
            name="vehicleNumber"
            render={({ field }) => (
              <Field
                autoCapitalize="characters"
                label="Vehicle number (optional)"
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
          <Controller
            control={form.control}
            name="purpose"
            render={({ field }) => (
              <Field
                label="Purpose (optional)"
                multiline
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
          <ErrorLine error={mutation.error} />
          <Button disabled={mutation.isPending} onPress={submit}>
            {mutation.isPending ? 'Creating approval' : 'Create pre-approval'}
          </Button>
        </View>
      </Section>
    </Screen>
  );
}

function PillChoice({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button onPress={onPress} tone={active ? 'primary' : 'secondary'}>
      {label}
    </Button>
  );
}

export function VisitorDetailScreen({ id }: { id: string }) {
  const client = useQueryClient();
  const visit = useApiQuery(['visit', id], () => visitorApi.visit(id));
  const cancel = useMutation({
    mutationFn: () => visitorApi.cancelPreApproval(id),
    onSettled: () => void client.invalidateQueries({ queryKey: ['visit', id] }),
  });
  const data = visit.data;
  return (
    <Screen>
      <PageHeader
        action={<RefreshAction onPress={() => void visit.refetch()} />}
        subtitle="The current status is supplied by the gate system."
        title="Visitor details"
      />
      <QueryState {...useQueryPresentation(visit)}>
        {data ? (
          <>
            <Section>
              <Row detail={data.category.replaceAll('_', ' ')} title={data.visitorName}>
                <Pill label={data.status} />
              </Row>
              <Row detail={data.purpose ?? 'No purpose provided'} title="Purpose" />
              <Row detail={data.vehicleNumber ?? 'Not recorded'} title="Vehicle" />
              <Row detail={formatDateTime(data.expectedAt)} title="Expected" />
              <Row detail={formatDateTime(data.arrivedAt)} title="Arrived at gate" />
              <Row detail={formatDateTime(data.checkedInAt)} title="Checked in" />
              <Row detail={formatDateTime(data.checkedOutAt)} title="Checked out" />
            </Section>
            {'code' in data &&
            typeof data.code === 'string' &&
            data.status !== 'CANCELLED' &&
            data.status !== 'CHECKED_IN' ? (
              <Section title="Gate code">
                <Row detail={data.code} title="Show this code to the guard" />
                <Button
                  disabled={cancel.isPending}
                  onPress={() => cancel.mutate()}
                  tone="secondary"
                >
                  Cancel pre-approval
                </Button>
                <ErrorLine error={cancel.error} />
              </Section>
            ) : null}
            <Section title="Event history">
              {(data.events?.length ?? 0) === 0 ? (
                <Row detail="No events have been recorded yet." title="No history" />
              ) : (
                data.events?.map((event) => (
                  <Row
                    detail={
                      formatDateTime(event.occurredAt) + (event.detail ? ' - ' + event.detail : '')
                    }
                    key={event.id}
                    title={event.type.replaceAll('_', ' ')}
                  />
                ))
              )}
            </Section>
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { color: colors.danger, fontSize: typography.caption },
  form: { gap: spacing.lg, paddingVertical: spacing.md },
  label: { color: colors.ink, fontSize: typography.caption, fontWeight: '700' },
});
