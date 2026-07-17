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
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { dailyHelpApi, emergencyApi, maintenanceApi, parcelApi } from '@/lib/resident-api';
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

export function ServicesScreen() {
  const helpers = useApiQuery(['daily-help'], () => dailyHelpApi.list({ limit: 30 }));
  const parcels = useApiQuery(['parcels'], () => parcelApi.list({ limit: 30 }));
  return (
    <Screen>
      <PageHeader
        action={
          <RefreshAction
            onPress={() => {
              void helpers.refetch();
              void parcels.refetch();
            }}
          />
        }
        subtitle="Daily-help access and deliveries for your selected home."
        title="Services"
      />
      <QueryState {...present(helpers)}>
        <Section title="Daily help">
          {(helpers.data?.items.length ?? 0) === 0 ? (
            <Row
              detail="No daily-help profiles are assigned to this home."
              title="No assigned daily help"
            />
          ) : (
            helpers.data?.items.map((helper) => (
              <Row
                detail={
                  (helper.accessWindow ?? 'No access window recorded') +
                  '. ' +
                  helper.allowedDays.join(', ')
                }
                key={helper.id}
                title={helper.name}
              >
                <Pill
                  label={helper.status}
                  tone={helper.status === 'ACTIVE' ? 'success' : 'warning'}
                />
              </Row>
            ))
          )}
        </Section>
        <Section title="Parcels">
          {(parcels.data?.items.length ?? 0) === 0 ? (
            <Row detail="There are no recorded parcels for this home." title="No parcels" />
          ) : (
            parcels.data?.items.map((parcel) => (
              <Row
                detail={
                  (parcel.carrierName ?? 'Carrier not recorded') +
                  '. ' +
                  formatDateTime(parcel.arrivedAt)
                }
                key={parcel.id}
                onPress={() => router.push('/parcels/' + parcel.id)}
                title={parcel.description ?? 'Parcel'}
              >
                <Pill label={parcel.status} />
              </Row>
            ))
          )}
        </Section>
      </QueryState>
    </Screen>
  );
}

export function ParcelDetailScreen({ id }: { id: string }) {
  const client = useQueryClient();
  const parcel = useApiQuery(['parcel', id], () => parcelApi.detail(id));
  const decide = useMutation({
    mutationFn: (choice: 'ALLOW_ENTRY' | 'LEAVE_AT_GATE' | 'REJECT') =>
      parcelApi.decide(id, choice),
    onSettled: () => void client.invalidateQueries({ queryKey: ['parcel', id] }),
  });
  const data = parcel.data;
  return (
    <Screen>
      <PageHeader title="Parcel details" />
      <QueryState {...present(parcel)}>
        {data ? (
          <Section>
            <Row
              detail={data.carrierName ?? 'Carrier not recorded'}
              title={data.description ?? 'Parcel'}
            >
              <Pill label={data.status} />
            </Row>
            <Row detail={formatDateTime(data.arrivedAt)} title="Arrived" />
            <Row detail={formatDateTime(data.collectedAt)} title="Collected" />
            {data.status === 'ARRIVED' ? (
              <View style={styles.actions}>
                <Button disabled={decide.isPending} onPress={() => decide.mutate('ALLOW_ENTRY')}>
                  Allow entry
                </Button>
                <Button
                  disabled={decide.isPending}
                  onPress={() => decide.mutate('LEAVE_AT_GATE')}
                  tone="secondary"
                >
                  Leave at gate
                </Button>
                <Button
                  disabled={decide.isPending}
                  onPress={() => decide.mutate('REJECT')}
                  tone="danger"
                >
                  Reject
                </Button>
              </View>
            ) : null}
            {data.status === 'HELD_AT_GATE' ? (
              <Row
                detail={data.collectionCode ?? 'A collection code has not been issued.'}
                title="Collection code"
              />
            ) : null}
            <ErrorLine error={decide.error} />
          </Section>
        ) : null}
      </QueryState>
    </Screen>
  );
}

export function MaintenanceScreen() {
  const charges = useApiQuery(['charges'], () => maintenanceApi.charges({ limit: 50 }));
  const payments = useApiQuery(['payments'], () => maintenanceApi.payments({ limit: 50 }));
  const capability = useApiQuery(['payment-capability'], maintenanceApi.paymentCapabilities);
  return (
    <Screen>
      <PageHeader
        action={
          <RefreshAction
            onPress={() => {
              void charges.refetch();
              void payments.refetch();
              void capability.refetch();
            }}
          />
        }
        subtitle="Payments are only recorded after verified backend processing."
        title="Maintenance"
      />
      <QueryState {...present(charges)}>
        <Section title="Dues">
          {(charges.data?.items.length ?? 0) === 0 ? (
            <Row
              detail="No charges have been published for this home."
              title="No maintenance dues"
            />
          ) : (
            charges.data?.items.map((charge) => (
              <Row
                detail={
                  'Due ' +
                  formatDate(charge.dueDate) +
                  '. Balance ' +
                  formatCurrency(charge.balance, charge.currency)
                }
                key={charge.id}
                title={charge.periodLabel}
              >
                <Pill
                  label={charge.status}
                  tone={charge.status === 'PAID' ? 'success' : 'warning'}
                />
              </Row>
            ))
          )}
        </Section>
        <Section title="Online payments">
          {capability.data?.onlinePaymentsEnabled ? (
            <Row
              detail={capability.data.providerLabel ?? 'A verified provider is available.'}
              title="Continue to payment"
              onPress={() => router.push('/maintenance/pay')}
            />
          ) : (
            <Row
              detail="Online payment is unavailable until the society configures and verifies a payment provider."
              title="Online payment disabled"
            />
          )}
        </Section>
        <Section title="Payment history">
          {(payments.data?.items.length ?? 0) === 0 ? (
            <Row
              detail="No payments have been recorded for this home."
              title="No payment history"
            />
          ) : (
            payments.data?.items.map((payment) => (
              <Row
                detail={
                  payment.method.replaceAll('_', ' ') + ' - ' + formatDateTime(payment.receivedAt)
                }
                key={payment.id}
                title={formatCurrency(payment.amount, payment.currency)}
              >
                <Pill
                  label={payment.status}
                  tone={payment.status === 'CONFIRMED' ? 'success' : 'warning'}
                />
              </Row>
            ))
          )}
        </Section>
      </QueryState>
    </Screen>
  );
}

const emergencySchema = z.object({
  category: z.enum(['MEDICAL', 'FIRE', 'SECURITY_THREAT', 'LIFT', 'OTHER']),
  details: z.string().trim().max(500).optional(),
});
export function EmergencyScreen() {
  const client = useQueryClient();
  const active = useApiQuery(['emergencies', 'active'], emergencyApi.active);
  const form = useForm({ defaultValues: { category: 'MEDICAL' as const, details: '' } });
  const create = useMutation({
    mutationFn: emergencyApi.create,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['emergencies'] });
      form.reset();
    },
  });
  const submit = form.handleSubmit((values) => {
    const result = emergencySchema.safeParse(values);
    if (!result.success) {
      form.setError('details', { message: result.error.issues[0]?.message });
      return;
    }
    create.mutate(result.data);
  });
  return (
    <Screen>
      <PageHeader
        subtitle="Use emergency alerts only for immediate assistance. They cannot be muted by notification preferences."
        title="Emergency"
      />
      <Section title="Active alerts">
        <QueryState {...present(active)}>
          {(active.data?.items.length ?? 0) === 0 ? (
            <Row
              detail="There is no active emergency alert from this home."
              title="No active alerts"
            />
          ) : (
            active.data?.items.map((alert) => (
              <Row
                detail={formatDateTime(alert.createdAt)}
                key={alert.id}
                title={alert.category.replaceAll('_', ' ')}
              >
                <Pill label={alert.status} tone="danger" />
              </Row>
            ))
          )}
        </QueryState>
      </Section>
      <Section title="Create alert">
        <View style={styles.form}>
          <Text style={styles.label}>Emergency type</Text>
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <View style={styles.actions}>
                {['MEDICAL', 'FIRE', 'SECURITY_THREAT', 'LIFT', 'OTHER'].map((value) => (
                  <Button
                    key={value}
                    onPress={() => field.onChange(value)}
                    tone={field.value === value ? 'danger' : 'secondary'}
                  >
                    {value.replaceAll('_', ' ')}
                  </Button>
                ))}
              </View>
            )}
          />
          <Controller
            control={form.control}
            name="details"
            render={({ field, fieldState }) => (
              <Field
                error={fieldState.error?.message}
                label="Details (optional)"
                multiline
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
          <ErrorLine error={create.error} />
          <Button disabled={create.isPending} onPress={submit} tone="danger">
            {create.isPending ? 'Sending alert' : 'Send emergency alert'}
          </Button>
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm },
  error: { color: colors.danger, fontSize: typography.caption },
  form: { gap: spacing.lg, paddingVertical: spacing.md },
  label: { color: colors.ink, fontSize: typography.caption, fontWeight: '700' },
});
