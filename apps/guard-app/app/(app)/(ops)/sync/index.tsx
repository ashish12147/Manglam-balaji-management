import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, RotateCcw, Wifi, WifiOff } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton, ChoiceGroup } from "@/components/Controls";
import { RecordItem } from "@/components/Records";
import { Screen } from "@/components/Screen";
import { ErrorPanel, LoadingPanel, StatePanel } from "@/components/StatePanel";
import { PageTitle, SectionTitle } from "@/components/Typography";
import { useConnectivity } from "@/connectivity/connectivity-context";
import { operationLabel } from "@/offline/operations";
import { useSync } from "@/offline/sync-context";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import type { SyncStatus } from "@/types/domain";
import { formatDateTime } from "@/utils/date";

const filters = [
  { label: "Needs action", secondaryLabel: "कार्रवाई चाहिए", value: "NEEDS_ACTION" },
  { label: "Pending", secondaryLabel: "लंबित", value: "LOCAL_PENDING" },
  { label: "Conflict", secondaryLabel: "टकराव", value: "CONFLICT" },
  { label: "Failed", secondaryLabel: "विफल", value: "FAILED" },
  { label: "Synced", secondaryLabel: "सिंक हुआ", value: "SYNCED" }
] as const;
type Filter = (typeof filters)[number]["value"];

export default function SyncListScreen() {
  const router = useRouter();
  const connectivity = useConnectivity();
  const sync = useSync();
  const [filter, setFilter] = useState<Filter>("NEEDS_ACTION");
  const records = useQuery({
    queryFn: async () => {
      const status = filter === "NEEDS_ACTION" ? undefined : (filter as SyncStatus);
      const items = await sync.listMutations(status);
      return filter === "NEEDS_ACTION" ? items.filter((item) => item.status !== "SYNCED") : items;
    },
    queryKey: ["offline-mutations", filter, sync.counts]
  });
  const needsAttention = sync.counts.CONFLICT + sync.counts.FAILED;

  return (
    <Screen>
      <View style={styles.heading}>
        <PageTitle subtitle="Signed local actions and authoritative server outcomes.">Synchronization / सिंक्रोनाइज़ेशन</PageTitle>
        {connectivity.isOnline ? <Wifi color={colors.primary} size={28} /> : <WifiOff color={colors.warning} size={28} />}
      </View>
      <View style={styles.metrics}>
        <Metric label="Pending" tone="warning" value={sync.counts.LOCAL_PENDING + sync.counts.SYNCING} />
        <Metric label="Conflicts" tone="critical" value={sync.counts.CONFLICT} />
        <Metric label="Failed" tone="critical" value={sync.counts.FAILED} />
        <Metric label="Synced" tone="success" value={sync.counts.SYNCED} />
      </View>
      <View style={styles.actions}>
        <View style={styles.actionCell}>
          <ActionButton disabled={!connectivity.isOnline} icon={RefreshCw} label="Sync now" loading={sync.isSyncing} onPress={() => void sync.syncNow()} secondaryLabel="अभी सिंक करें" />
        </View>
        <View style={styles.actionCell}>
          <ActionButton disabled={!connectivity.isOnline} icon={RotateCcw} label="Refresh directory" loading={sync.isRefreshingSnapshot} onPress={() => void sync.refreshSnapshot(true)} secondaryLabel="डायरेक्टरी अपडेट" variant="secondary" />
        </View>
      </View>
      <View>
        <Text style={styles.diagnostic}>Connection: {connectivity.isOnline ? "Internet reachable" : "Offline"}</Text>
        <Text style={styles.diagnostic}>Last completed sync: {formatDateTime(sync.lastCompletedAt)}</Text>
        <Text style={styles.diagnostic}>Offline lease: {sync.lease.isExpired ? "Missing or expired" : "Active"}</Text>
        <Text style={styles.diagnostic}>Lease expires: {formatDateTime(sync.lease.expiresAt)}</Text>
        <Text selectable style={styles.diagnostic}>Server device: {sync.lease.deviceId ?? "No lease issued"}</Text>
        <Text style={styles.diagnostic}>Last accepted sequence: {sync.lease.lastAcceptedSequence ?? "Not available"}</Text>
        {sync.error ? <Text style={styles.error}>{sync.error}</Text> : null}
      </View>
      {needsAttention > 0 ? (
        <View style={styles.attention}>
          <AlertCircle color={colors.critical} size={24} />
          <Text style={styles.attentionText}>{needsAttention} action(s) require review. Server conflicts are never overwritten automatically.</Text>
        </View>
      ) : null}
      <SectionTitle>Queue records / कतार रिकॉर्ड</SectionTitle>
      <ChoiceGroup label="Show / दिखाएं" onChange={setFilter} options={filters} value={filter} />
      {records.isLoading ? <LoadingPanel label="Loading local queue…" /> : records.isError ? (
        <ErrorPanel message={(records.error as Error).message} onRetry={() => void records.refetch()} />
      ) : records.data?.length === 0 ? (
        <StatePanel detail={filter === "NEEDS_ACTION" ? "No offline action currently needs synchronization or review." : "No queue record matches this filter."} icon={CheckCircle2} title="Queue clear / कतार साफ" />
      ) : (
        <View style={styles.records}>
          {records.data?.map((record) => (
            <RecordItem
              detail={record.entityId ? `${record.entityType} • ${record.entityId}` : record.entityType}
              icon={record.status === "CONFLICT" || record.status === "FAILED" ? AlertCircle : Clock3}
              key={record.clientMutationId}
              meta={formatDateTime(record.localCreatedAt)}
              onPress={() => router.push({ pathname: "/sync/[id]", params: { id: record.clientMutationId } })}
              status={record.status}
              statusTone={record.status === "SYNCED" ? "success" : record.status === "FAILED" || record.status === "CONFLICT" ? "critical" : "warning"}
              title={operationLabel(record.operation)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function Metric({ label, tone, value }: { label: string; tone: "critical" | "success" | "warning"; value: number }) {
  const color = tone === "critical" ? colors.critical : tone === "success" ? colors.primary : colors.warning;
  return <View style={styles.metric}><Text style={[styles.metricValue, { color }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  actionCell: { flex: 1, minWidth: 170 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  attention: { alignItems: "flex-start", backgroundColor: colors.criticalSoft, borderRadius: radii.md, flexDirection: "row", gap: spacing.md, padding: spacing.md },
  attentionText: { color: colors.critical, flex: 1, fontSize: typography.label, lineHeight: 21 },
  diagnostic: { color: colors.muted, fontSize: typography.label, lineHeight: 22 },
  error: { color: colors.critical, fontSize: typography.label, lineHeight: 21, marginTop: spacing.sm },
  heading: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" },
  metric: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flex: 1, minHeight: 78, minWidth: 110, padding: spacing.sm },
  metricLabel: { color: colors.muted, fontSize: typography.caption }, metricValue: { fontSize: 26, fontWeight: "800" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, records: { gap: spacing.sm }
});
