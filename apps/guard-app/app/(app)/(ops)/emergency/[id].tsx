import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { AlertTriangle, CheckCircle2, RefreshCw, Siren } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useState } from "react";

import { endpoints } from "@/api/endpoints";
import { ActionButton, Field } from "@/components/Controls";
import { KeyValue } from "@/components/Records";
import { Screen } from "@/components/Screen";
import { ErrorPanel, LoadingPanel, StatePanel } from "@/components/StatePanel";
import { StatusBadge } from "@/components/Status";
import { PageTitle, SectionTitle } from "@/components/Typography";
import { useConnectivity } from "@/connectivity/connectivity-context";
import { useSync } from "@/offline/sync-context";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { formatDateTime } from "@/utils/date";
import { humanizeConstant } from "@/utils/text";

export default function EmergencyDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const connectivity = useConnectivity();
  const sync = useSync();
  const [note, setNote] = useState("");
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queuedId, setQueuedId] = useState<string | null>(null);
  const emergency = useQuery({
    enabled: !!id && connectivity.isOnline,
    queryFn: () => endpoints.emergencyDetail(id!),
    queryKey: ["emergencies", id],
    refetchInterval: 5_000
  });
  const respond = useMutation({
    mutationFn: async () => {
      if (!emergency.data) throw new Error("Emergency alert is not loaded.");
      if (note.trim().length < 3) throw new Error("Add a short response update.");
      return endpoints.markEmergencyResponding(
        emergency.data.id,
        emergency.data.version,
        note.trim(),
        Crypto.randomUUID()
      );
    },
    onSuccess: async () => {
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["emergencies"] });
    }
  });

  async function acknowledge() {
    if (!emergency.data) return;
    setQueueError(null);
    try {
      const mutation = await sync.enqueue({
        aggregateId: emergency.data.id,
        baseVersion: emergency.data.version,
        entityId: emergency.data.id,
        entityType: "EmergencyAlert",
        operation: "EMERGENCY_ACKNOWLEDGE",
        payload: { emergencyId: emergency.data.id, version: emergency.data.version }
      });
      setQueuedId(mutation.clientMutationId);
    } catch (caught) {
      setQueueError(caught instanceof Error ? caught.message : "Acknowledgement could not be queued.");
    }
  }

  if (!id) return <Screen><ErrorPanel message="The emergency identifier is missing." /></Screen>;
  if (emergency.isLoading && !emergency.data) {
    return <Screen><LoadingPanel label="Loading emergency details…" /></Screen>;
  }
  if (!emergency.data) {
    return (
      <Screen>
        {connectivity.isOnline ? (
          <ErrorPanel message={(emergency.error as Error)?.message ?? "Emergency alert could not be loaded."} onRetry={() => void emergency.refetch()} />
        ) : (
          <StatePanel detail="This alert is not open in the device cache. Reconnect to load it." title="Alert unavailable offline" tone="critical" />
        )}
      </Screen>
    );
  }
  const record = emergency.data;
  const canAcknowledge = record.status === "ACTIVE";
  const canRespond = record.status === "ACTIVE" || record.status === "ACKNOWLEDGED";
  return (
    <Screen onRefresh={() => void emergency.refetch()} refreshing={emergency.isRefetching}>
      <View style={styles.heading}>
        <PageTitle subtitle={`${record.flat.displayLabel} • ${record.residentDisplayName}`}>
          {humanizeConstant(record.category)}
        </PageTitle>
        <StatusBadge label={humanizeConstant(record.status)} tone="critical" />
      </View>
      <View style={styles.criticalBand}>
        <Siren color={colors.critical} size={34} />
        <Text style={styles.criticalText}>Emergency created {formatDateTime(record.createdAt)}</Text>
      </View>
      <View>
        <KeyValue label="Flat" value={record.flat.displayLabel} />
        <KeyValue label="Resident" value={record.residentDisplayName} />
        <KeyValue label="Created" value={formatDateTime(record.createdAt)} />
        <KeyValue label="Acknowledged" value={formatDateTime(record.acknowledgedAt)} />
        <KeyValue label="Resolution" value={record.resolutionInformation ?? "Not resolved"} />
      </View>
      {canAcknowledge ? (
        <ActionButton
          icon={CheckCircle2}
          label="Acknowledge emergency"
          onPress={() => Alert.alert("Acknowledge emergency", "Confirm that gate security has received this alert?", [
            { style: "cancel", text: "Cancel" },
            { onPress: () => void acknowledge(), text: "Acknowledge" }
          ])}
          secondaryLabel="आपातकाल स्वीकार करें"
          variant="danger"
        />
      ) : null}
      {queueError ? <Text style={styles.error}>{queueError}</Text> : null}
      {queuedId ? (
        <View style={styles.queued}>
          <Text style={styles.queuedText}>Acknowledgement signed and queued for the server.</Text>
          <ActionButton icon={RefreshCw} label="Open sync record" onPress={() => router.push({ pathname: "/sync/[id]", params: { id: queuedId } })} secondaryLabel="सिंक रिकॉर्ड" variant="secondary" />
        </View>
      ) : null}
      {canRespond ? (
        <View style={styles.response}>
          <SectionTitle>Response update / प्रतिक्रिया अपडेट</SectionTitle>
          <Field
            error={respond.error?.message}
            label="Current action / वर्तमान कार्रवाई"
            multiline
            onChangeText={setNote}
            placeholder="Guard dispatched, ambulance called, or extinguisher sent"
            required
            value={note}
          />
          <ActionButton
            disabled={!connectivity.isOnline}
            icon={AlertTriangle}
            label="Mark responding"
            loading={respond.isPending}
            onPress={() => respond.mutate()}
            secondaryLabel="प्रतिक्रिया जारी"
            variant="warning"
          />
        </View>
      ) : null}
      <SectionTitle>Response timeline / प्रतिक्रिया इतिहास</SectionTitle>
      {record.events?.length ? (
        <View style={styles.timeline}>
          {record.events.map((event) => (
            <View key={event.id} style={styles.event}>
              <Text style={styles.eventTitle}>{humanizeConstant(event.type)}</Text>
              <Text style={styles.eventMeta}>
                {formatDateTime(event.occurredAt)}
                {event.actorDisplayName ? ` • ${event.actorDisplayName}` : ""}
              </Text>
              {event.note ? <Text style={styles.eventNote}>{event.note}</Text> : null}
            </View>
          ))}
        </View>
      ) : (
        <StatePanel detail="No response event has been added yet." title="No response history" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  criticalBand: { alignItems: "center", backgroundColor: colors.criticalSoft, borderRadius: radii.md, flexDirection: "row", gap: spacing.md, padding: spacing.lg },
  criticalText: { color: colors.critical, flex: 1, fontSize: typography.body, fontWeight: "700", lineHeight: 23 },
  error: { color: colors.critical, fontSize: typography.label, lineHeight: 21 },
  event: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  eventMeta: { color: colors.muted, fontSize: typography.caption },
  eventNote: { color: colors.ink, fontSize: typography.label, lineHeight: 20 },
  eventTitle: { color: colors.critical, fontSize: typography.label, fontWeight: "700" },
  heading: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "space-between" },
  queued: { backgroundColor: colors.warningSoft, borderRadius: radii.md, gap: spacing.md, padding: spacing.md },
  queuedText: { color: colors.warning, fontSize: typography.label },
  response: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.md, paddingTop: spacing.lg },
  timeline: { gap: spacing.sm }
});
