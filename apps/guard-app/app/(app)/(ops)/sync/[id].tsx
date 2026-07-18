import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton } from "@/components/Controls";
import { KeyValue } from "@/components/Records";
import { Screen } from "@/components/Screen";
import { ErrorPanel, LoadingPanel, StatePanel } from "@/components/StatePanel";
import { StatusBadge } from "@/components/Status";
import { PageTitle, SectionTitle } from "@/components/Typography";
import { operationLabel } from "@/offline/operations";
import { useSync } from "@/offline/sync-context";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { formatDateTime } from "@/utils/date";

export default function SyncDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const sync = useSync();
  const [error, setError] = useState<string | null>(null);
  const record = useQuery({
    enabled: !!id,
    queryFn: () => sync.getMutation(id!),
    queryKey: ["offline-mutation", id, sync.counts],
    refetchInterval: sync.isSyncing ? 1_000 : false
  });

  async function retry() {
    if (!record.data) return;
    try {
      setError(null);
      await sync.retry(record.data.clientMutationId);
      await record.refetch();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Retry failed.");
    }
  }

  if (!id) return <Screen><ErrorPanel message="The local sync record identifier is missing." /></Screen>;
  if (record.isLoading) return <Screen><LoadingPanel label="Loading local sync record…" /></Screen>;
  if (record.isError) {
    return <Screen><ErrorPanel message={(record.error as Error).message} onRetry={() => void record.refetch()} /></Screen>;
  }
  if (!record.data) return <Screen><ErrorPanel message="The local sync record was not found." /></Screen>;

  const item = record.data;
  const problem = item.status === "CONFLICT" || item.status === "FAILED";
  return (
    <Screen>
      <View style={styles.heading}>
        <PageTitle subtitle={item.clientMutationId}>{operationLabel(item.operation)}</PageTitle>
        <StatusBadge label={item.status} tone={item.status === "SYNCED" ? "success" : problem ? "critical" : "warning"} />
      </View>
      {item.status === "CONFLICT" ? (
        <StatePanel
          detail="The server state differs from this local action. Review both outcomes below. Retrying never overwrites the server silently."
          icon={AlertCircle}
          title="Explicit conflict / स्पष्ट टकराव"
          tone="critical"
        />
      ) : item.status === "SYNCED" ? (
        <StatePanel
          detail="The server accepted this exact client UUID. A replay returns the same authoritative result."
          icon={CheckCircle2}
          title="Synchronized / सिंक हुआ"
        />
      ) : null}
      <View>
        <KeyValue label="Client UUID" value={item.clientMutationId} />
        <KeyValue label="Aggregate ID" value={item.aggregateId ?? "Not assigned"} />
        <KeyValue label="Entity" value={`${item.entityType}${item.entityId ? ` • ${item.entityId}` : ""}`} />
        <KeyValue label="Server device" value={item.deviceId} />
        <KeyValue label="Gate" value={item.gateId} />
        <KeyValue label="Base version" value={item.baseVersion === null ? "None" : String(item.baseVersion)} />
        <KeyValue label="Local sequence" value={item.localSequence === null ? "Not assigned" : String(item.localSequence)} />
        <KeyValue label="Local time" value={formatDateTime(item.localCreatedAt)} />
        <KeyValue label="Attempts" value={String(item.attemptCount)} />
        <KeyValue label="Last attempt" value={formatDateTime(item.lastAttemptAt)} />
        <KeyValue label="Next retry" value={formatDateTime(item.nextAttemptAt)} />
        <KeyValue label="Server record" value={item.serverRecordId ?? "Not assigned"} />
        <KeyValue label="Server time" value={formatDateTime(item.serverOccurredAt)} />
        <KeyValue label="Correlation ID" value={item.correlationId ?? "Not available"} />
      </View>
      {item.errorMessage ? <Text style={styles.error}>{item.errorCode}: {item.errorMessage}</Text> : null}
      <SectionTitle>Local action / स्थानीय कार्रवाई</SectionTitle>
      <Text selectable style={styles.code}>{JSON.stringify(item.payload, null, 2)}</Text>
      {item.conflict !== null ? (
        <>
          <SectionTitle>Server outcome / सर्वर परिणाम</SectionTitle>
          <Text selectable style={styles.code}>{JSON.stringify(item.conflict, null, 2)}</Text>
        </>
      ) : null}
      {problem ? (
        <ActionButton
          icon={RefreshCw}
          label="Retry this exact action"
          loading={sync.isSyncing}
          onPress={() => void retry()}
          secondaryLabel="यही कार्रवाई फिर भेजें"
          variant="warning"
        />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { backgroundColor: colors.ink, borderRadius: radii.md, color: colors.white, fontFamily: "monospace", fontSize: typography.caption, lineHeight: 19, padding: spacing.md },
  error: { backgroundColor: colors.criticalSoft, borderRadius: radii.md, color: colors.critical, fontSize: typography.label, lineHeight: 21, padding: spacing.md },
  heading: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "space-between" }
});
