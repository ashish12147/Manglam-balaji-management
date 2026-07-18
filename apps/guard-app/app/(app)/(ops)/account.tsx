import { LogOut, MapPin, RefreshCw, ShieldCheck, Smartphone } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/auth/session-context";
import { ActionButton } from "@/components/Controls";
import { KeyValue } from "@/components/Records";
import { Screen } from "@/components/Screen";
import { StatusBadge } from "@/components/Status";
import { PageTitle, SectionTitle } from "@/components/Typography";
import { useConnectivity } from "@/connectivity/connectivity-context";
import { usePushStatus } from "@/notifications/push-context";
import { useRealtime } from "@/realtime/realtime-context";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { formatDateTime } from "@/utils/date";

export default function AccountScreen() {
  const router = useRouter();
  const session = useSession();
  const connectivity = useConnectivity();
  const realtime = useRealtime();
  const push = usePushStatus();
  const metadata = session.metadata!;
  return (
    <Screen>
      <View style={styles.heading}>
        <PageTitle subtitle={metadata.guard.employeeCode ?? "Active guard account"}>
          {metadata.guard.displayName}
        </PageTitle>
        <StatusBadge label={metadata.device.status} tone={metadata.device.status === "ACTIVE" ? "success" : "critical"} />
      </View>
      <SectionTitle>Current shift / वर्तमान शिफ्ट</SectionTitle>
      <View>
        <KeyValue label="Gate" value={metadata.activeGate?.name ?? "No gate selected"} />
        <KeyValue label="Gate code" value={metadata.activeGate?.code ?? "Not available"} />
        <KeyValue label="Session ID" value={metadata.sessionId} />
        <KeyValue label="Access token expires" value={formatDateTime(metadata.accessTokenExpiresAt)} />
      </View>
      <ActionButton icon={MapPin} label="Change gate" onPress={() => router.push("/gate")} secondaryLabel="गेट बदलें" variant="secondary" />
      <SectionTitle>Device trust / डिवाइस ट्रस्ट</SectionTitle>
      <View style={styles.deviceCard}>
        <Smartphone color={colors.primary} size={30} />
        <View style={styles.deviceText}>
          <Text style={styles.deviceName}>{metadata.device.label}</Text>
          <Text selectable style={styles.deviceId}>{session.deviceIdentity?.clientDeviceId}</Text>
        </View>
        <ShieldCheck color={colors.primary} size={28} />
      </View>
      <View>
        <KeyValue label="Internet" value={connectivity.isOnline ? "Reachable" : "Offline"} />
        <KeyValue label="Realtime" value={realtime.connected ? "Connected" : "Polling fallback"} />
        <KeyValue label="Push registration" value={push.status} />
        <KeyValue label="Last device seen" value={formatDateTime(metadata.device.lastSeenAt)} />
      </View>
      {push.error ? <Text style={styles.warning}>{push.error}</Text> : null}
      <ActionButton icon={RefreshCw} label="Refresh account status" onPress={() => void session.refreshContext()} secondaryLabel="खाता स्थिति अपडेट" variant="secondary" />
      <ActionButton
        icon={LogOut}
        label="End shift and sign out"
        onPress={() => Alert.alert("End guard shift", "Sign out from this device now? Unsynchronized queue records remain encrypted on this registered device.", [
          { style: "cancel", text: "Cancel" },
          { onPress: () => void session.signOut(), style: "destructive", text: "Sign out" }
        ])}
        secondaryLabel="शिफ्ट समाप्त करें"
        variant="danger"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  deviceCard: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: spacing.md, padding: spacing.md },
  deviceId: { color: colors.muted, fontSize: typography.caption },
  deviceName: { color: colors.ink, fontSize: typography.body, fontWeight: "700" },
  deviceText: { flex: 1, gap: spacing.xs },
  heading: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "space-between" },
  warning: { backgroundColor: colors.warningSoft, borderRadius: radii.md, color: colors.warning, fontSize: typography.label, lineHeight: 21, padding: spacing.md }
});
