import { LogOut, RefreshCw, Smartphone } from "lucide-react-native";
import { Redirect } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useSession } from "@/auth/session-context";
import { ActionButton } from "@/components/Controls";
import { KeyValue } from "@/components/Records";
import { Screen } from "@/components/Screen";
import { StatePanel } from "@/components/StatePanel";
import { PageTitle } from "@/components/Typography";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export default function DeviceScreen() {
  const session = useSession();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const status = session.metadata?.device.status;
  if (status === "REVOKED" || status === "LOST") return <Redirect href="/blocked" />;
  if (status === "ACTIVE") return <Redirect href={session.metadata?.activeGate ? "/home" : "/gate"} />;

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      await session.refreshContext();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Device status refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen>
      <PageTitle subtitle="Operational access is issued only to an active server-registered device.">
        Device access / डिवाइस एक्सेस
      </PageTitle>
      <View style={styles.deviceCard}>
        <Smartphone color={colors.primary} size={32} />
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{session.metadata?.device.label ?? session.deviceIdentity?.label ?? "Guard device"}</Text>
          <Text selectable style={styles.deviceId}>
            {session.metadata?.device.id ?? "Server device ID unavailable"}
          </Text>
        </View>
      </View>
      <View>
        <KeyValue label="Guard" value={session.metadata?.guard.displayName ?? "Not available"} />
        <KeyValue label="Device status" value={status ?? "UNREGISTERED"} />
      </View>
      <StatePanel
        detail="This session cannot perform gate operations. Sign out, enter your employee code and PIN, then use the one-time administrator enrollment token on the sign-in screen."
        title="Enrollment required / एनरोलमेंट जरूरी"
        tone="warning"
      />
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      <ActionButton
        icon={RefreshCw}
        label="Check device status"
        loading={refreshing}
        onPress={() => void refresh()}
        secondaryLabel="स्थिति जांचें"
        variant="secondary"
      />
      <ActionButton
        icon={LogOut}
        label="Sign out to enroll"
        onPress={() => void session.signOut()}
        secondaryLabel="एनरोल करने के लिए साइन आउट"
        variant="quiet"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  deviceCard: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: spacing.md, padding: spacing.lg },
  deviceId: { color: colors.muted, fontSize: typography.caption },
  deviceInfo: { flex: 1, gap: spacing.xs },
  deviceName: { color: colors.ink, fontSize: typography.body, fontWeight: "700" },
  error: { color: colors.critical, fontSize: typography.label, lineHeight: 21 }
});
