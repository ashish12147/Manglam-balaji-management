import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "@/theme/tokens";

export function PageTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <View style={styles.titleGroup}>
      <Text accessibilityRole="header" style={styles.pageTitle}>
        {children}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {children}
      </Text>
      {action}
    </View>
  );
}

export function HindiHint({ children }: { children: React.ReactNode }) {
  return <Text style={styles.hindi}>{children}</Text>;
}

const styles = StyleSheet.create({
  hindi: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 18
  },
  pageTitle: {
    color: colors.ink,
    fontSize: typography.heading,
    fontWeight: "800",
    lineHeight: 30
  },
  sectionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 32
  },
  sectionTitle: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: typography.title,
    fontWeight: "700",
    lineHeight: 26
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 23
  },
  titleGroup: {
    gap: spacing.xs
  }
});
