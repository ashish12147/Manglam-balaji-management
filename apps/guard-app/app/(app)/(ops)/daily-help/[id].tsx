import { useQuery } from "@tanstack/react-query";
import { LogIn, LogOut, RefreshCw, UserRoundCheck } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";

import { endpoints } from "@/api/endpoints";
import { ActionButton } from "@/components/Controls";
import { KeyValue } from "@/components/Records";
import { Screen } from "@/components/Screen";
import { ErrorPanel, LoadingPanel, StatePanel } from "@/components/StatePanel";
import { StatusBadge } from "@/components/Status";
import { PageTitle, SectionTitle } from "@/components/Typography";
import { useConnectivity } from "@/connectivity/connectivity-context";
import { useSync } from "@/offline/sync-context";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import type { DailyHelpDetail, DailyHelpDirectoryItem } from "@/types/domain";
import { formatDateTime } from "@/utils/date";
import { humanizeConstant } from "@/utils/text";

function hasRecentAttendance(
  record: DailyHelpDetail | DailyHelpDirectoryItem
): record is DailyHelpDetail {
  return "recentAttendance" in record && Array.isArray(record.recentAttendance);
}

export default function DailyHelpDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const connectivity = useConnectivity();
  const sync = useSync();
  const [offlineHelper, setOfflineHelper] = useState<DailyHelpDirectoryItem | null>(null);
  const [offlineExpired, setOfflineExpired] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queuedId, setQueuedId] = useState<string | null>(null);
  const helper = useQuery({
    enabled: !!id && connectivity.isOnline,
    queryFn: () => endpoints.dailyHelpDetail(id!),
    queryKey: ["daily-help", id],
    refetchInterval: 15_000
  });

  useEffect(() => {
    if (connectivity.isOnline || !id) return;
    let active = true;
    void sync.searchDailyHelp("")
      .then((result) => {
        if (!active) return;
        setOfflineExpired(result.isExpired);
        setOfflineHelper(result.items.find((item) => item.id === id) ?? null);
      })
      .catch((caught) => {
        if (active) setQueueError(caught instanceof Error ? caught.message : "Offline directory lookup failed.");
      });
    return () => {
      active = false;
    };
  }, [connectivity.isOnline, id, sync]);

  const record: DailyHelpDetail | DailyHelpDirectoryItem | null = helper.data ?? offlineHelper;
  const detail = record && hasRecentAttendance(record) ? record : null;
  async function queue(action: "check-in" | "check-out") {
    if (!record) return;
    setQueueError(null);
    try {
      const mutation = await sync.enqueue({
        aggregateId: record.id,
        baseVersion: record.version,
        entityId: record.id,
        entityType: "DailyHelp",
        operation: action === "check-in" ? "DAILY_HELP_CHECK_IN" : "DAILY_HELP_CHECK_OUT",
        payload: { action, dailyHelpId: record.id, version: record.version }
      });
      setQueuedId(mutation.clientMutationId);
    } catch (caught) {
      setQueueError(caught instanceof Error ? caught.message : "Attendance could not be queued.");
    }
  }

  if (!id) return <Screen><ErrorPanel message="The daily-help identifier is missing." /></Screen>;
  if (helper.isLoading && connectivity.isOnline) return <Screen><LoadingPanel /></Screen>;
  if (!record) {
    return (
      <Screen>
        {offlineExpired ? (
          <StatePanel detail="The helper snapshot expired after 24 hours. Reconnect before recording attendance." title="Snapshot expired" tone="critical" />
        ) : connectivity.isOnline ? (
          <ErrorPanel message={(helper.error as Error)?.message ?? "Helper record could not be loaded."} onRetry={() => void helper.refetch()} />
        ) : (
          <StatePanel detail={queueError ?? "This helper is not present in the current offline snapshot."} title="Helper unavailable offline" tone="warning" />
        )}
      </Screen>
    );
  }

  const openAttendance = detail?.recentAttendance.find(
    (item) => item.status === "CHECKED_IN" && !item.checkedOutAt
  );
  return (
    <Screen onRefresh={() => void helper.refetch()} refreshing={helper.isRefetching}>
      <View style={styles.heading}>
        <PageTitle subtitle={humanizeConstant(record.type)}>{record.name}</PageTitle>
        <StatusBadge label={connectivity.isOnline ? record.status : "OFFLINE SNAPSHOT"} tone={record.status === "ACTIVE" ? "success" : "critical"} />
      </View>
      <View style={styles.profileIcon}><UserRoundCheck color={colors.primary} size={44} /></View>
      <View>
        <KeyValue label="Allowed flats" value={record.allowedFlatLabels.join(", ") || "No active assignment"} />
        <KeyValue label="Access window" value={record.accessWindow ?? "No window supplied"} />
        <KeyValue label="Profile status" value={record.status} />
        <KeyValue label="Attendance" value={openAttendance ? "Currently inside" : connectivity.isOnline ? "Not inside" : "Verify manually"} />
      </View>
      <View style={styles.actions}>
        <View style={styles.actionCell}>
          <ActionButton
            disabled={record.status !== "ACTIVE" || !!openAttendance}
            icon={LogIn}
            label="Check in"
            onPress={() => Alert.alert("Confirm helper entry", `Check ${record.name} in at this gate?`, [
              { style: "cancel", text: "Cancel" },
              { onPress: () => void queue("check-in"), text: "Check in" }
            ])}
            secondaryLabel="सहायक प्रवेश"
          />
        </View>
        <View style={styles.actionCell}>
          <ActionButton
            disabled={connectivity.isOnline && !openAttendance}
            icon={LogOut}
            label="Check out"
            onPress={() => Alert.alert("Confirm helper exit", `Check ${record.name} out from this gate?`, [
              { style: "cancel", text: "Cancel" },
              { onPress: () => void queue("check-out"), text: "Check out" }
            ])}
            secondaryLabel="सहायक निकास"
            variant="secondary"
          />
        </View>
      </View>
      {!connectivity.isOnline ? (
        <Text style={styles.offlineNote}>
          Offline attendance is signed and stored locally. Verify the person carefully; server conflicts remain visible for review.
        </Text>
      ) : null}
      {queueError ? <Text style={styles.error}>{queueError}</Text> : null}
      {queuedId ? (
        <View style={styles.queued}>
          <Text style={styles.queuedText}>Attendance action saved to the durable queue.</Text>
          <ActionButton icon={RefreshCw} label="Open sync record" onPress={() => router.push({ pathname: "/sync/[id]", params: { id: queuedId } })} secondaryLabel="सिंक रिकॉर्ड" variant="secondary" />
        </View>
      ) : null}
      {detail ? (
        <>
          <SectionTitle>Recent attendance / हाल की उपस्थिति</SectionTitle>
          {detail.recentAttendance.length === 0 ? (
            <StatePanel detail="No attendance has been recorded for this helper." title="No attendance history" />
          ) : (
            <View style={styles.history}>
              {detail.recentAttendance.map((attendance) => (
                <View key={attendance.id} style={styles.historyRow}>
                  <Text style={styles.historyTitle}>{humanizeConstant(attendance.status)}</Text>
                  <Text style={styles.historyMeta}>
                    {formatDateTime(attendance.checkedInAt)}
                    {attendance.checkedOutAt ? ` to ${formatDateTime(attendance.checkedOutAt)}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionCell: { flex: 1, minWidth: 150 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  error: { color: colors.critical, fontSize: typography.label, lineHeight: 21 },
  heading: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "space-between" },
  history: { gap: spacing.sm },
  historyMeta: { color: colors.muted, fontSize: typography.caption, lineHeight: 18 },
  historyRow: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  historyTitle: { color: colors.ink, fontSize: typography.label, fontWeight: "700" },
  offlineNote: { backgroundColor: colors.warningSoft, borderRadius: radii.md, color: colors.warning, fontSize: typography.label, lineHeight: 21, padding: spacing.md },
  profileIcon: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: radii.md, height: 76, justifyContent: "center", width: 76 },
  queued: { backgroundColor: colors.infoSoft, borderRadius: radii.md, gap: spacing.md, padding: spacing.md },
  queuedText: { color: colors.info, fontSize: typography.label }
});
