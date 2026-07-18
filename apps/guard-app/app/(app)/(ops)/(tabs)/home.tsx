import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Clock3,
  Package,
  ScanLine,
  UserPlus,
  UserRoundCheck,
  UsersRound
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { endpoints } from "@/api/endpoints";
import { useSession } from "@/auth/session-context";
import { ActionButton } from "@/components/Controls";
import { RecordItem } from "@/components/Records";
import { Screen } from "@/components/Screen";
import { ErrorPanel, LoadingPanel, StatePanel } from "@/components/StatePanel";
import { StatusBadge } from "@/components/Status";
import { PageTitle, SectionTitle } from "@/components/Typography";
import { useConnectivity } from "@/connectivity/connectivity-context";
import { useSync } from "@/offline/sync-context";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { formatRelativeAge } from "@/utils/date";

export default function HomeScreen() {
  const router = useRouter();
  const session = useSession();
  const connectivity = useConnectivity();
  const sync = useSync();
  const dashboard = useQuery({
    enabled: connectivity.isOnline,
    queryFn: endpoints.dashboard,
    queryKey: ["dashboard", session.metadata?.activeGate?.id],
    refetchInterval: 10_000
  });
  const refresh = async () => {
    await Promise.all([dashboard.refetch(), sync.refreshSnapshot(true), sync.syncNow()]);
  };
  return (
    <Screen onRefresh={() => void refresh()} refreshing={dashboard.isRefetching || sync.isSyncing}>
      <View style={styles.headingRow}>
        <PageTitle subtitle={session.metadata?.activeGate?.name ?? "No gate selected"}>
          Gate operations / गेट कार्य
        </PageTitle>
        <StatusBadge
          label={connectivity.isOnline ? "ONLINE" : "OFFLINE"}
          tone={connectivity.isOnline ? "success" : "warning"}
        />
      </View>

      <View style={styles.actionGrid}>
        <View style={styles.actionCell}>
          <ActionButton
            icon={UserPlus}
            label="Register visitor"
            onPress={() => router.push("/visitor/new")}
            secondaryLabel="विज़िटर दर्ज करें"
          />
        </View>
        <View style={styles.actionCell}>
          <ActionButton
            disabled={!connectivity.isOnline}
            icon={ScanLine}
            label="Verify code"
            onPress={() => router.push("/visitor/code")}
            secondaryLabel="कोड जांचें"
            variant="secondary"
          />
        </View>
        <View style={styles.actionCell}>
          <ActionButton
            icon={UsersRound}
            label="Active visits"
            onPress={() => router.push("/visitor/active")}
            secondaryLabel="सक्रिय विज़िटर"
            variant="secondary"
          />
        </View>
        <View style={styles.actionCell}>
          <ActionButton
            icon={UserRoundCheck}
            label="Daily help"
            onPress={() => router.push("/daily-help")}
            secondaryLabel="दैनिक सहायक"
            variant="secondary"
          />
        </View>
      </View>

      {!connectivity.isOnline ? (
        <StatePanel
          detail="Resident approvals, visitor-code verification, and check-in are unavailable offline. Permitted actions are stored with a visible LOCAL_PENDING status."
          icon={Clock3}
          title="Offline gate mode / ऑफलाइन मोड"
          tone="warning"
        />
      ) : dashboard.isLoading ? (
        <LoadingPanel label="Loading live gate status…" />
      ) : dashboard.isError ? (
        <ErrorPanel message={(dashboard.error as Error).message} onRetry={() => void dashboard.refetch()} />
      ) : dashboard.data ? (
        <>
          <View style={styles.metrics}>
            <Metric icon={Clock3} label="Approvals" value={dashboard.data.pendingApprovals} />
            <Metric icon={AlertTriangle} label="Emergencies" tone="critical" value={dashboard.data.activeEmergencies} />
            <Metric icon={Package} label="Held parcels" value={dashboard.data.heldParcels} />
            <Metric icon={BadgeCheck} label="Inside" value={dashboard.data.activeVisits} />
          </View>
          {dashboard.data.activeEmergencies > 0 ? (
            <ActionButton
              icon={AlertTriangle}
              label={`${dashboard.data.activeEmergencies} active emergency alert(s)`}
              onPress={() => router.push("/emergency")}
              secondaryLabel="तुरंत देखें"
              variant="danger"
            />
          ) : null}
          <SectionTitle>Recent activity / हाल की गतिविधि</SectionTitle>
          {dashboard.data.recentActivity.length === 0 ? (
            <StatePanel detail="No gate activity has been recorded yet." title="No recent activity" />
          ) : (
            <View style={styles.records}>
              {dashboard.data.recentActivity.slice(0, 5).map((activity) => (
                <RecordItem
                  detail={activity.detail}
                  icon={Clock3}
                  key={activity.id}
                  meta={formatRelativeAge(activity.occurredAt)}
                  onPress={() => router.push("/activity")}
                  status={activity.status}
                  title={activity.title}
                />
              ))}
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

function Metric({
  icon: Icon,
  label,
  tone = "normal",
  value
}: {
  icon: typeof Clock3;
  label: string;
  tone?: "critical" | "normal";
  value: number;
}) {
  return (
    <View style={styles.metric}>
      <Icon color={tone === "critical" ? colors.critical : colors.primary} size={24} />
      <Text style={[styles.metricValue, tone === "critical" ? styles.metricCritical : null]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionCell: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 150
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  headingRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  metric: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: "22%",
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 110,
    minWidth: 130,
    padding: spacing.md
  },
  metricCritical: {
    color: colors.critical
  },
  metricLabel: {
    color: colors.muted,
    fontSize: typography.caption,
    textAlign: "center"
  },
  metricValue: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800"
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  records: {
    gap: spacing.sm
  }
});
