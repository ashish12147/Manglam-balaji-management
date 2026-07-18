import { WifiOff } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useConnectivity } from "@/connectivity/connectivity-context";
import { useSync } from "@/offline/sync-context";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: "critical" | "info" | "neutral" | "success" | "warning" }) {
  const palette = {
    critical: { background: colors.criticalSoft, text: colors.critical },
    info: { background: colors.infoSoft, text: colors.info },
    neutral: { background: colors.background, text: colors.muted },
    success: { background: colors.primarySoft, text: colors.primary },
    warning: { background: colors.warningSoft, text: colors.warning }
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text numberOfLines={1} style={[styles.badgeText, { color: palette.text }]}>
        {label}
      </Text>
    </View>
  );
}

export function NetworkBanner() {
  const router = useRouter();
  const connectivity = useConnectivity();
  const sync = useSync();
  const pending = sync.counts.LOCAL_PENDING + sync.counts.SYNCING + sync.counts.FAILED;
  if (connectivity.isOnline && pending === 0 && sync.counts.CONFLICT === 0) return null;
  const conflict = sync.counts.CONFLICT > 0;
  const backgroundColor = conflict ? colors.criticalSoft : connectivity.isOnline ? colors.warningSoft : colors.offlineSoft;
  const color = conflict ? colors.critical : connectivity.isOnline ? colors.warning : colors.offline;
  const text = conflict
    ? `${sync.counts.CONFLICT} sync conflict(s) need review`
    : connectivity.isOnline
      ? `${pending} action(s) waiting to synchronize`
      : `Offline • ${pending} action(s) stored on this device`;
  return (
    <Pressable
      accessibilityLabel={`${text}. Open synchronization diagnostics.`}
      accessibilityRole="button"
      onPress={() => router.push("/sync")}
      style={[styles.banner, { backgroundColor }]}
    >
      <WifiOff color={color} size={20} />
      <View style={styles.bannerTextGroup}>
        <Text style={[styles.bannerText, { color }]}>{text}</Text>
        <Text style={[styles.bannerHindi, { color }]}>सिंक स्थिति देखें</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    maxWidth: "100%",
    minHeight: 26,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  badgeText: {
    fontSize: typography.caption,
    fontWeight: "700"
  },
  banner: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  bannerHindi: {
    fontSize: 12,
    lineHeight: 16
  },
  bannerText: {
    fontSize: typography.label,
    fontWeight: "700",
    lineHeight: 20
  },
  bannerTextGroup: {
    flex: 1
  }
});
