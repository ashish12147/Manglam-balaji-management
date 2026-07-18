import type { LucideIcon } from "lucide-react-native";
import { AlertCircle, Inbox, LockKeyhole, RefreshCw } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "@/components/Controls";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export function StatePanel({
  actionLabel,
  detail,
  icon: Icon = Inbox,
  onAction,
  title,
  tone = "neutral"
}: {
  actionLabel?: string;
  detail: string;
  icon?: LucideIcon;
  onAction?: () => void;
  title: string;
  tone?: "critical" | "neutral" | "warning";
}) {
  const color = tone === "critical" ? colors.critical : tone === "warning" ? colors.warning : colors.muted;
  return (
    <View accessibilityLiveRegion="polite" style={styles.panel}>
      <Icon color={color} size={32} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>{detail}</Text>
      {onAction && actionLabel ? (
        <View style={styles.action}>
          <ActionButton icon={RefreshCw} label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

export function LoadingPanel({ label = "Loading current records…" }: { label?: string }) {
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.panel}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.detail}>{label}</Text>
    </View>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <StatePanel
      actionLabel={onRetry ? "Retry / फिर प्रयास करें" : undefined}
      detail={message}
      icon={AlertCircle}
      onAction={onRetry}
      title="Could not load / लोड नहीं हुआ"
      tone="critical"
    />
  );
}

export function PermissionPanel({ permission }: { permission: string }) {
  return (
    <StatePanel
      detail={`Your guard account does not have ${permission}. Ask a security supervisor.`}
      icon={LockKeyhole}
      title="Permission required / अनुमति चाहिए"
      tone="warning"
    />
  );
}

const styles = StyleSheet.create({
  action: {
    alignSelf: "stretch",
    marginTop: spacing.sm
  },
  detail: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: "center"
  },
  panel: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 180,
    padding: spacing.xl
  },
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: "700",
    lineHeight: 26,
    textAlign: "center"
  }
});
