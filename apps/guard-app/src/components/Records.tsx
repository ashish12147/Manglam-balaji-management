import type { LucideIcon } from "lucide-react-native";
import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StatusBadge } from "@/components/Status";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export function RecordItem({
  detail,
  icon: Icon,
  meta,
  onPress,
  status,
  statusTone,
  title
}: {
  detail: string;
  icon: LucideIcon;
  meta?: string;
  onPress?: () => void;
  status?: string;
  statusTone?: "critical" | "info" | "neutral" | "success" | "warning";
  title: string;
}) {
  const content = (
    <>
      <View style={styles.iconBox}><Icon color={colors.primary} size={24} /></View>
      <View style={styles.content}>
        <Text numberOfLines={2} style={styles.title}>{title}</Text>
        <Text numberOfLines={2} style={styles.detail}>{detail}</Text>
        <View style={styles.metaRow}>
          {status ? <StatusBadge label={status} tone={statusTone} /> : null}
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
      </View>
      {onPress ? <ChevronRight color={colors.disabled} size={22} /> : null}
    </>
  );
  const accessibilityLabel = [title, detail, status, meta].filter(Boolean).join(", ");
  if (!onPress) {
    return <View accessibilityLabel={accessibilityLabel} style={styles.record}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.record, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

export function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.keyValue}>
      <Text style={styles.key}>{label}</Text>
      {typeof value === "string" ? <Text style={styles.value}>{value}</Text> : value}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, gap: spacing.xs, minWidth: 0 },
  detail: { color: colors.muted, fontSize: typography.label, lineHeight: 20 },
  iconBox: { alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: radii.md, height: 48, justifyContent: "center", width: 48 },
  key: { color: colors.muted, flex: 1, fontSize: typography.label, lineHeight: 20 },
  keyValue: { alignItems: "flex-start", borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing.lg, justifyContent: "space-between", minHeight: 44, paddingVertical: spacing.md },
  meta: { color: colors.muted, fontSize: typography.caption },
  metaRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  pressed: { opacity: 0.75 },
  record: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: spacing.md, minHeight: 92, padding: spacing.md },
  title: { color: colors.ink, fontSize: typography.body, fontWeight: "700", lineHeight: 22 },
  value: { color: colors.ink, flex: 1, fontSize: typography.label, fontWeight: "700", lineHeight: 20, textAlign: "right" }
});
