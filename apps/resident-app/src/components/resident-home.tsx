import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ClipboardList, DoorOpen, HeartPulse, Package } from 'lucide-react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Button,
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
import { useResidentRealtime } from '@/lib/realtime';
import {
  emergencyApi,
  maintenanceApi,
  noticeApi,
  notificationApi,
  visitorApi,
} from '@/lib/resident-api';
import { useAuth } from '@/providers/AuthProvider';
import { useConnectivity } from '@/providers/ConnectivityProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { Visit } from '@/types/api';

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

export function HomeScreen() {
  const { profile, selectedMembership } = useAuth();
  useResidentRealtime();
  const approvals = useApiQuery(['visitor-approvals'], visitorApi.pendingApprovals, {
    refetchInterval: 15_000,
  });
  const notices = useApiQuery(['notices', 'home'], () => noticeApi.list({ limit: 3 }));
  const dues = useApiQuery(['charges', 'home'], () => maintenanceApi.charges({ limit: 1 }));
  const emergencies = useApiQuery(['emergencies', 'active'], emergencyApi.active);
  const unread = useApiQuery(['notification-count'], notificationApi.unreadCount);
  const reload = () => {
    void approvals.refetch();
    void notices.refetch();
    void dues.refetch();
    void emergencies.refetch();
    void unread.refetch();
  };
  return (
    <Screen>
      <PageHeader
        action={<RefreshAction onPress={reload} />}
        subtitle={
          selectedMembership
            ? selectedMembership.flat.block.name + ', Flat ' + selectedMembership.flat.number
            : 'Home association required'
        }
        title={'Hello, ' + (profile?.displayName ?? 'Resident')}
      />
      <QueryState {...useQueryPresentation(approvals)}>
        <Section title="At a glance">
          <View style={styles.summaryGrid}>
            <Summary label="Awaiting approval" value={String(approvals.data?.items.length ?? 0)} />
            <Summary label="Unread notices" value={String(unread.data?.count ?? 0)} />
            <Summary label="Active alerts" value={String(emergencies.data?.items.length ?? 0)} />
          </View>
        </Section>
        <Section title="Quick actions">
          <View style={styles.quickGrid}>
            <Quick
              icon={<DoorOpen color={colors.primary} size={22} />}
              label="Pre-approve visitor"
              onPress={() => router.push('/visitor/new')}
            />
            <Quick
              icon={<HeartPulse color={colors.danger} size={22} />}
              label="Emergency"
              onPress={() => router.push('/emergency')}
            />
            <Quick
              icon={<ClipboardList color={colors.primary} size={22} />}
              label="Complaint"
              onPress={() => router.push('/complaints/new')}
            />
            <Quick
              icon={<Package color={colors.primary} size={22} />}
              label="Parcels"
              onPress={() => router.push('/parcels')}
            />
          </View>
        </Section>
        <Section title="Visitor approvals">
          {(approvals.data?.items.length ?? 0) === 0 ? (
            <Row detail="No visitor is waiting for your decision." title="All clear" />
          ) : (
            approvals.data?.items.map((visit) => <Approval key={visit.id} visit={visit} />)
          )}
        </Section>
        <Section title="Latest notices">
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
        <Section title="Maintenance">
          {(dues.data?.items.length ?? 0) === 0 ? (
            <Row
              detail="The society has not published a maintenance charge for this home."
              title="No dues published"
            />
          ) : (
            dues.data?.items.map((charge) => (
              <Row
                detail={
                  'Due ' +
                  formatDate(charge.dueDate) +
                  '. Balance ' +
                  formatCurrency(charge.balance, charge.currency)
                }
                key={charge.id}
                onPress={() => router.push('/maintenance')}
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
      </QueryState>
    </Screen>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}
function Quick({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quick, pressed && styles.pressed]}
    >
      {icon}
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

function Approval({ visit }: { visit: Visit }) {
  const client = useQueryClient();
  const decide = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REJECT') => visitorApi.decide(visit.id, decision),
    onSettled: () => void client.invalidateQueries({ queryKey: ['visitor-approvals'] }),
  });
  return (
    <View style={styles.approval}>
      <Text style={styles.rowTitle}>{visit.visitorName}</Text>
      <Text style={styles.detail}>
        {visit.category.replaceAll('_', ' ') + '. ' + (visit.purpose ?? 'Visitor at gate')}
      </Text>
      <View style={styles.inline}>
        <Button disabled={decide.isPending} onPress={() => decide.mutate('APPROVE')}>
          Approve
        </Button>
        <Button
          disabled={decide.isPending}
          onPress={() => decide.mutate('REJECT')}
          tone="secondary"
        >
          Reject
        </Button>
      </View>
      {decide.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {errorMessage(decide.error)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  approval: {
    borderBottomColor: colors.surfaceMuted,
    borderBottomWidth: 1,
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  detail: { color: colors.inkMuted, fontSize: typography.caption },
  error: { color: colors.danger, fontSize: typography.caption },
  inline: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pressed: { opacity: 0.7 },
  quick: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: spacing.sm,
    minHeight: 110,
    justifyContent: 'center',
    padding: spacing.md,
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickText: { color: colors.ink, fontSize: typography.body, fontWeight: '700' },
  rowTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '700' },
  summary: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flex: 1,
    minWidth: 90,
    padding: spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  summaryLabel: { color: colors.inkMuted, fontSize: typography.caption },
  summaryValue: { color: colors.primary, fontSize: typography.title, fontWeight: '800' },
});
