import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Clock3, PackageCheck, RotateCcw } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";

import { endpoints } from "@/api/endpoints";
import { isPendingFileStatus, parseFileScanStatus } from "@/api/upload-contract";
import { ActionButton } from "@/components/Controls";
import { KeyValue } from "@/components/Records";
import { Screen } from "@/components/Screen";
import { ErrorPanel, LoadingPanel, StatePanel } from "@/components/StatePanel";
import { StatusBadge } from "@/components/Status";
import { PageTitle } from "@/components/Typography";
import { useConnectivity } from "@/connectivity/connectivity-context";
import { colors, spacing, typography } from "@/theme/tokens";
import { formatDateTime } from "@/utils/date";
import { humanizeConstant } from "@/utils/text";

export default function ParcelDetailScreen() {
  const params = useLocalSearchParams<{ id: string; uploadScanStatus?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const scanStatusInput = Array.isArray(params.uploadScanStatus)
    ? params.uploadScanStatus[0]
    : params.uploadScanStatus;
  const connectivity = useConnectivity();
  const queryClient = useQueryClient();
  const parcel = useQuery({
    enabled: !!id && connectivity.isOnline,
    queryFn: () => endpoints.parcelDetail(id!),
    queryKey: ["parcels", id]
  });
  const transition = useMutation({
    mutationFn: (action: "collect" | "return") =>
      endpoints.parcelTransition(id!, action, Crypto.randomUUID()),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["parcels"] })
  });

  if (!id) return <Screen><ErrorPanel message="The parcel identifier is missing." /></Screen>;
  if (!connectivity.isOnline) {
    return (
      <Screen>
        <StatePanel detail="Reconnect to verify the authoritative parcel state and collection code." title="Parcel detail unavailable offline" tone="warning" />
      </Screen>
    );
  }
  if (parcel.isLoading) return <Screen><LoadingPanel /></Screen>;
  if (!parcel.data) {
    return (
      <Screen>
        <ErrorPanel message={(parcel.error as Error)?.message ?? "Parcel record could not be loaded."} onRetry={() => void parcel.refetch()} />
      </Screen>
    );
  }
  const record = parcel.data;
  let photoScanPending = false;
  if (scanStatusInput) {
    try {
      photoScanPending = isPendingFileStatus(parseFileScanStatus(scanStatusInput));
    } catch {
      photoScanPending = false;
    }
  }
  return (
    <Screen onRefresh={() => void parcel.refetch()} refreshing={parcel.isRefetching}>
      <View style={styles.heading}>
        <PageTitle subtitle={record.flat.displayLabel}>{record.description ?? "Parcel"}</PageTitle>
        <StatusBadge label={humanizeConstant(record.status)} tone={record.status === "HELD_AT_GATE" ? "warning" : "success"} />
      </View>
      {photoScanPending ? (
        <StatePanel
          detail="The private parcel photo remains quarantined while the security scan runs. It is not yet clean or available."
          icon={Clock3}
          title="Photo scan pending / फोटो जांच जारी"
          tone="warning"
        />
      ) : null}
      <View>
        <KeyValue label="Flat" value={record.flat.displayLabel} />
        <KeyValue label="Courier" value={record.courierName ?? "Not supplied"} />
        <KeyValue label="Recorded" value={formatDateTime(record.createdAt)} />
        <KeyValue label="Held at" value={formatDateTime(record.heldAt)} />
        <KeyValue label="Collected at" value={formatDateTime(record.collectedAt)} />
      </View>
      {record.status === "HELD_AT_GATE" ? (
        <>
          <ActionButton
            icon={PackageCheck}
            label="Mark collected"
            loading={transition.isPending}
            onPress={() => Alert.alert("Confirm collection", `Release this parcel for ${record.flat.displayLabel}?`, [
              { style: "cancel", text: "Cancel" },
              { onPress: () => transition.mutate("collect"), text: "Collected" }
            ])}
            secondaryLabel="कलेक्ट किया"
          />
          <ActionButton
            icon={RotateCcw}
            label="Return parcel"
            loading={transition.isPending}
            onPress={() => Alert.alert("Return parcel", "Return this parcel to the courier or sender?", [
              { style: "cancel", text: "Cancel" },
              { onPress: () => transition.mutate("return"), style: "destructive", text: "Return" }
            ])}
            secondaryLabel="पार्सल लौटाएं"
            variant="secondary"
          />
        </>
      ) : null}
      {transition.error ? <Text style={styles.error}>{transition.error.message}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.critical, fontSize: typography.label, lineHeight: 21 },
  heading: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "space-between" }
});
