import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { CheckCircle2, Clock3, LogIn, LogOut, RefreshCw, ShieldAlert, XCircle } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useState } from "react";

import { endpoints } from "@/api/endpoints";
import { isPendingFileStatus, parseFileScanStatus } from "@/api/upload-contract";
import { useSession } from "@/auth/session-context";
import { ActionButton, Field } from "@/components/Controls";
import { KeyValue } from "@/components/Records";
import { Screen } from "@/components/Screen";
import { ErrorPanel, LoadingPanel, StatePanel } from "@/components/StatePanel";
import { StatusBadge } from "@/components/Status";
import { PageTitle, SectionTitle } from "@/components/Typography";
import { useConnectivity } from "@/connectivity/connectivity-context";
import { formatCountdown, useCountdown } from "@/hooks/use-countdown";
import { useSync } from "@/offline/sync-context";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { formatDateTime } from "@/utils/date";
import { humanizeConstant } from "@/utils/text";

export default function VisitorDetailScreen() {
  const params = useLocalSearchParams<{ id: string; uploadScanStatus?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const scanStatusInput = Array.isArray(params.uploadScanStatus)
    ? params.uploadScanStatus[0]
    : params.uploadScanStatus;
  const router = useRouter();
  const queryClient = useQueryClient();
  const connectivity = useConnectivity();
  const session = useSession();
  const sync = useSync();
  const [overrideReason, setOverrideReason] = useState("");
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queuedId, setQueuedId] = useState<string | null>(null);
  const visit = useQuery({
    enabled: !!id && connectivity.isOnline,
    queryFn: () => endpoints.visitDetail(id!),
    queryKey: ["visitors", id],
    refetchInterval: 5_000
  });
  const countdown = useCountdown(visit.data?.approvalExpiresAt);

  const transition = useMutation({
    mutationFn: async () => {
      if (!visit.data) throw new Error("Visitor record is not loaded.");
      return endpoints.visitorTransition(
        visit.data.id,
        "check-in",
        visit.data.version,
        Crypto.randomUUID()
      );
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["visitors"] })
  });

  const override = useMutation({
    mutationFn: async () => {
      if (!visit.data) throw new Error("Visitor record is not loaded.");
      if (overrideReason.trim().length < 10) {
        throw new Error("Give a clear override reason (at least 10 characters).");
      }
      return endpoints.visitorOverride(
        visit.data.id,
        overrideReason.trim(),
        visit.data.version,
        Crypto.randomUUID()
      );
    },
    onSuccess: async () => {
      setOverrideReason("");
      await queryClient.invalidateQueries({ queryKey: ["visitors"] });
    }
  });

  async function queueCheckout() {
    if (!visit.data) return;
    setQueueError(null);
    try {
      const mutation = await sync.enqueue({
        aggregateId: visit.data.id,
        baseVersion: visit.data.version,
        entityId: visit.data.id,
        entityType: "Visit",
        operation: "VISIT_CHECK_OUT",
        payload: { version: visit.data.version, visitId: visit.data.id }
      });
      setQueuedId(mutation.clientMutationId);
    } catch (caught) {
      setQueueError(caught instanceof Error ? caught.message : "Check-out could not be queued.");
    }
  }

  if (!id) {
    return <Screen><ErrorPanel message="The visitor record identifier is missing." /></Screen>;
  }
  if (visit.isLoading && !visit.data) {
    return <Screen><LoadingPanel /></Screen>;
  }
  if (!visit.data) {
    return (
      <Screen>
        {connectivity.isOnline ? (
          <ErrorPanel message={(visit.error as Error)?.message ?? "Visitor record could not be loaded."} onRetry={() => void visit.refetch()} />
        ) : (
          <StatePanel detail="This visitor detail is not cached on the device. Reconnect to load it." title="Record unavailable offline" tone="warning" />
        )}
      </Screen>
    );
  }

  const record = visit.data;
  const pending = record.status === "AWAITING_APPROVAL";
  const denied = record.status === "REJECTED" || record.status === "APPROVAL_TIMED_OUT";
  const canCheckIn = record.status === "APPROVED";
  const canOverride = denied && session.hasPermission("visitor.override");
  const statusTone = denied ? "critical" : record.status === "CHECKED_IN" ? "success" : "warning";
  let photoScanPending = false;
  if (scanStatusInput) {
    try {
      photoScanPending = isPendingFileStatus(parseFileScanStatus(scanStatusInput));
    } catch {
      photoScanPending = false;
    }
  }

  return (
    <Screen onRefresh={() => void visit.refetch()} refreshing={visit.isRefetching}>
      <View style={styles.heading}>
        <PageTitle subtitle={`${record.flat.displayLabel} • ${humanizeConstant(record.category)}`}>
          {record.visitorName}
        </PageTitle>
        <StatusBadge label={humanizeConstant(record.status)} tone={statusTone} />
      </View>

      {photoScanPending ? (
        <StatePanel
          detail="The private photo upload is quarantined while the security scan runs. It is not yet clean or available for viewing."
          icon={Clock3}
          title="Photo scan pending / फोटो जांच जारी"
          tone="warning"
        />
      ) : null}
      {pending ? (
        <View style={styles.countdown}>
          <Clock3 color={colors.warning} size={30} />
          <View style={styles.countdownText}>
            <Text style={styles.countdownValue}>{formatCountdown(countdown)}</Text>
            <Text style={styles.countdownLabel}>
              Waiting for the first valid adult resident decision / निवासी की अनुमति प्रतीक्षा
            </Text>
          </View>
        </View>
      ) : null}
      {record.status === "APPROVED" ? (
        <StatePanel
          detail="The resident approval is confirmed by the server. Verify the person before check-in."
          icon={CheckCircle2}
          title="Approved / अनुमति मिली"
        />
      ) : null}
      {record.status === "REJECTED" ? (
        <StatePanel
          detail={record.rejectionReason ?? "A resident rejected this visitor. Do not admit without an authorised override."}
          icon={XCircle}
          title="Entry rejected / प्रवेश अस्वीकृत"
          tone="critical"
        />
      ) : null}
      {record.status === "APPROVAL_TIMED_OUT" ? (
        <StatePanel
          detail="No authorised resident responded before the deadline. Entry remains blocked."
          icon={Clock3}
          title="Approval timed out / समय समाप्त"
          tone="critical"
        />
      ) : null}

      <View>
        <KeyValue label="Flat" value={record.flat.displayLabel} />
        <KeyValue label="Purpose" value={record.purpose ?? "Not supplied"} />
        <KeyValue label="Phone" value={record.phoneMasked ?? "Not supplied"} />
        <KeyValue label="Vehicle" value={record.vehicleNumber ?? "Not supplied"} />
        <KeyValue label="Arrived" value={formatDateTime(record.arrivedAt ?? record.createdAt)} />
        <KeyValue label="Approval source" value={record.approvalSource ?? "Pending"} />
      </View>

      {canCheckIn ? (
        <ActionButton
          disabled={!connectivity.isOnline}
          icon={LogIn}
          label="Check visitor in"
          loading={transition.isPending}
          onPress={() =>
            Alert.alert("Confirm check-in", `Admit ${record.visitorName} to ${record.flat.displayLabel}?`, [
              { style: "cancel", text: "Cancel" },
              { onPress: () => transition.mutate(), text: "Check in" }
            ])
          }
          secondaryLabel="विज़िटर प्रवेश"
        />
      ) : null}
      {record.status === "CHECKED_IN" ? (
        <ActionButton
          icon={LogOut}
          label="Record check-out"
          loading={sync.isSyncing}
          onPress={() =>
            Alert.alert("Confirm check-out", `Record ${record.visitorName} leaving the society?`, [
              { style: "cancel", text: "Cancel" },
              { onPress: () => void queueCheckout(), text: "Check out" }
            ])
          }
          secondaryLabel="विज़िटर निकास"
          variant="secondary"
        />
      ) : null}
      {queuedId ? (
        <View style={styles.queued}>
          <Text style={styles.queuedText}>Check-out stored with a stable client UUID.</Text>
          <ActionButton
            icon={RefreshCw}
            label="Open sync record"
            onPress={() => router.push({ pathname: "/sync/[id]", params: { id: queuedId } })}
            secondaryLabel="सिंक रिकॉर्ड"
            variant="secondary"
          />
        </View>
      ) : null}
      {queueError ? <Text style={styles.error}>{queueError}</Text> : null}
      {transition.error ? <Text style={styles.error}>{transition.error.message}</Text> : null}

      {canOverride ? (
        <View style={styles.override}>
          <SectionTitle>Supervisor override / पर्यवेक्षक ओवरराइड</SectionTitle>
          <Field
            error={override.error?.message}
            label="Required reason / कारण"
            multiline
            onChangeText={setOverrideReason}
            placeholder="Why entry is being authorised despite rejection or timeout"
            required
            value={overrideReason}
          />
          <ActionButton
            disabled={!connectivity.isOnline}
            icon={ShieldAlert}
            label="Authorise override"
            loading={override.isPending}
            onPress={() => override.mutate()}
            secondaryLabel="ओवरराइड की अनुमति"
            variant="warning"
          />
        </View>
      ) : null}

      <SectionTitle>Immutable visit history / विज़िट इतिहास</SectionTitle>
      {record.events.length === 0 ? (
        <StatePanel detail="No additional visit events have been recorded." title="No event history" />
      ) : (
        <View style={styles.timeline}>
          {record.events.map((event) => (
            <View key={event.id} style={styles.event}>
              <View style={styles.eventDot} />
              <View style={styles.eventContent}>
                <Text style={styles.eventTitle}>{humanizeConstant(event.type)}</Text>
                <Text style={styles.eventMeta}>
                  {formatDateTime(event.occurredAt)}
                  {event.actorDisplayName ? ` • ${event.actorDisplayName}` : ""}
                </Text>
                {event.note ? <Text style={styles.eventNote}>{event.note}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  countdown: { alignItems: "center", backgroundColor: colors.warningSoft, borderRadius: radii.md, flexDirection: "row", gap: spacing.md, padding: spacing.lg },
  countdownLabel: { color: colors.warning, fontSize: typography.label, lineHeight: 21 },
  countdownText: { flex: 1 },
  countdownValue: { color: colors.warning, fontSize: 30, fontVariant: ["tabular-nums"], fontWeight: "800" },
  error: { color: colors.critical, fontSize: typography.label, lineHeight: 21 },
  event: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md },
  eventContent: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flex: 1, gap: spacing.xs, paddingBottom: spacing.md },
  eventDot: { backgroundColor: colors.primary, borderRadius: radii.pill, height: 10, marginTop: 5, width: 10 },
  eventMeta: { color: colors.muted, fontSize: typography.caption },
  eventNote: { color: colors.ink, fontSize: typography.label, lineHeight: 20 },
  eventTitle: { color: colors.ink, fontSize: typography.label, fontWeight: "700" },
  heading: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "space-between" },
  override: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.md, paddingTop: spacing.lg },
  queued: { backgroundColor: colors.infoSoft, borderRadius: radii.md, gap: spacing.md, padding: spacing.md },
  queuedText: { color: colors.info, fontSize: typography.label },
  timeline: { gap: spacing.md }
});
