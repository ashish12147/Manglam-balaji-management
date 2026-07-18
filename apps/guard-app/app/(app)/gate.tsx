import { DoorOpen, LogOut, MapPin, RefreshCw } from "lucide-react-native";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useSession } from "@/auth/session-context";
import { ActionButton } from "@/components/Controls";
import { StatePanel } from "@/components/StatePanel";
import { Screen } from "@/components/Screen";
import { PageTitle } from "@/components/Typography";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import type { Gate } from "@/types/domain";

export default function GateScreen() {
  const router = useRouter();
  const session = useSession();
  const [selecting, setSelecting] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const gates = session.metadata?.gates ?? [];
  if (session.metadata?.device.status !== "ACTIVE") return <Redirect href="/device" />;

  async function selectGate(gate: Gate) {
    setSelecting(gate.id);
    setSelectionError(null);
    try {
      await session.selectGate(gate);
      router.replace("/home");
    } catch (caught) {
      setSelectionError(caught instanceof Error ? caught.message : "Gate selection failed.");
    } finally {
      setSelecting(null);
    }
  }

  async function refresh() {
    setRefreshing(true);
    setSelectionError(null);
    try {
      await session.refreshContext();
    } catch (caught) {
      setSelectionError(caught instanceof Error ? caught.message : "Gate assignments could not be refreshed.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <PageTitle subtitle="Choose only the gate assigned to your current shift.">
        Select gate / गेट चुनें
      </PageTitle>
      {gates.length === 0 ? (
        <StatePanel
          detail="The server returned no active gate assignment for this guard shift. Ask the security supervisor."
          icon={MapPin}
          title="No gate assignment / गेट नहीं मिला"
          tone="warning"
        />
      ) : null}
      <View style={styles.gates}>
        {gates.map((gate) => (
          <View key={gate.id} style={styles.gateRow}>
            <View style={styles.gateIcon}><DoorOpen color={colors.primary} size={28} /></View>
            <View style={styles.gateInfo}>
              <Text style={styles.gateName}>{gate.name}</Text>
              <Text style={styles.gateCode}>{gate.code}</Text>
            </View>
            <View style={styles.choose}>
              <ActionButton
                label="Choose"
                loading={selecting === gate.id}
                onPress={() => void selectGate(gate)}
                secondaryLabel="चुनें"
              />
            </View>
          </View>
        ))}
      </View>
      {selectionError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{selectionError}</Text> : null}
      <ActionButton icon={RefreshCw} label="Refresh assignments" loading={refreshing} onPress={() => void refresh()} secondaryLabel="असाइनमेंट अपडेट करें" variant="secondary" />
      <ActionButton icon={LogOut} label="Sign out" onPress={() => void session.signOut()} secondaryLabel="साइन आउट" variant="quiet" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  choose: { minWidth: 128 },
  error: { color: colors.critical, fontSize: typography.label, lineHeight: 21 },
  gateCode: { color: colors.muted, fontSize: typography.label },
  gateIcon: { alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: radii.md, height: 52, justifyContent: "center", width: 52 },
  gateInfo: { flex: 1, minWidth: 0 },
  gateName: { color: colors.ink, fontSize: typography.title, fontWeight: "700" },
  gateRow: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.md, padding: spacing.md },
  gates: { gap: spacing.md }
});
