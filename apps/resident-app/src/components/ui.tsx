import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { TextInputProps, ViewStyle } from 'react-native';
import { AlertCircle, ChevronRight, RefreshCw, WifiOff } from 'lucide-react-native';

import { errorReference } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function Screen({
  children,
  scroll = true,
  style,
}: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle }>) {
  const content = <View style={[styles.screen, style]}>{children}</View>;
  return scroll ? (
    <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView>
  ) : (
    content
  );
}

export function PageHeader({
  action,
  subtitle,
  title,
}: {
  action?: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text accessibilityRole="header" style={styles.pageTitle}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Section({ children, title }: PropsWithChildren<{ title?: string }>) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function Row({
  children,
  detail,
  onPress,
  title,
}: PropsWithChildren<{ detail?: string; onPress?: () => void; title: string }>) {
  const inner = (
    <>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
        {children}
      </View>
      {onPress ? <ChevronRight color={colors.inkMuted} size={20} /> : null}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {inner}
    </Pressable>
  ) : (
    <View style={styles.row}>{inner}</View>
  );
}

export function Button({
  children,
  disabled,
  onPress,
  tone = 'primary',
}: PropsWithChildren<{
  disabled?: boolean;
  onPress: () => void;
  tone?: 'danger' | 'primary' | 'secondary';
}>) {
  const toneStyle =
    tone === 'primary'
      ? styles.buttonPrimary
      : tone === 'danger'
        ? styles.buttonDanger
        : styles.buttonSecondary;
  const textStyle = tone === 'secondary' ? styles.buttonTextSecondary : styles.buttonTextPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        toneStyle,
        (disabled || pressed) && styles.buttonPressed,
      ]}
    >
      <Text style={textStyle}>{children}</Text>
    </Pressable>
  );
}

export function IconButton({
  accessibilityLabel,
  children,
  onPress,
}: PropsWithChildren<{ accessibilityLabel: string; onPress: () => void }>) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

export function Field({
  error,
  label,
  ...props
}: TextInputProps & { error?: string | undefined; label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.inkMuted}
        style={[styles.input, Boolean(error) && styles.inputError]}
        {...props}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Pill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'danger' | 'neutral' | 'success' | 'warning';
}) {
  const style =
    tone === 'danger'
      ? styles.pillDanger
      : tone === 'success'
        ? styles.pillSuccess
        : tone === 'warning'
          ? styles.pillWarning
          : styles.pillNeutral;
  return <Text style={[styles.pill, style]}>{label.replaceAll('_', ' ')}</Text>;
}

export function State({
  action,
  description,
  kind = 'empty',
  title,
}: {
  action?: { label: string; onPress: () => void };
  description: string;
  kind?: 'empty' | 'error' | 'offline';
  title: string;
}) {
  const Icon = kind === 'offline' ? WifiOff : AlertCircle;
  return (
    <View style={styles.state}>
      <Icon color={kind === 'error' ? colors.danger : colors.inkMuted} size={26} />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{description}</Text>
      {action ? (
        <Button onPress={action.onPress} tone="secondary">
          {action.label}
        </Button>
      ) : null}
    </View>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <View accessibilityLabel={label} style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.rowDetail}>{label}</Text>
    </View>
  );
}

export function QueryState({
  children,
  error,
  isLoading,
  isOffline,
  onRetry,
}: PropsWithChildren<{
  error: unknown;
  isLoading: boolean;
  isOffline: boolean;
  onRetry: () => void;
}>) {
  if (isLoading) return <Loading />;
  if (isOffline)
    return (
      <State
        description="This information needs a connection. Reconnect, then refresh."
        kind="offline"
        title="Offline"
      />
    );
  if (error) {
    const reference = errorReference(error);
    const detail = error instanceof Error ? error.message : 'The request could not be completed.';
    return (
      <State
        action={{ label: 'Try again', onPress: onRetry }}
        description={detail + (reference ? ' Reference: ' + reference : '')}
        kind="error"
        title="Could not load this"
      />
    );
  }
  return <>{children}</>;
}

export function RefreshAction({ onPress }: { onPress: () => void }) {
  return (
    <IconButton accessibilityLabel="Refresh" onPress={onPress}>
      <RefreshCw color={colors.primary} size={21} />
    </IconButton>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.lg,
  },
  buttonDanger: { backgroundColor: colors.danger },
  buttonPressed: { opacity: 0.7 },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  buttonTextPrimary: { color: colors.white, fontSize: typography.body, fontWeight: '700' },
  buttonTextSecondary: { color: colors.primary, fontSize: typography.body, fontWeight: '700' },
  field: { gap: spacing.xs },
  fieldError: { color: colors.danger, fontSize: typography.caption },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
  },
  headerText: { flex: 1, gap: spacing.xs },
  iconButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  inputError: { borderColor: colors.danger },
  label: { color: colors.ink, fontSize: typography.caption, fontWeight: '700' },
  loading: { alignItems: 'center', gap: spacing.sm, justifyContent: 'center', minHeight: 180 },
  pageTitle: { color: colors.ink, fontSize: typography.pageTitle, fontWeight: '800' },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.round,
    fontSize: typography.caption,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    textTransform: 'capitalize',
  },
  pillDanger: { backgroundColor: colors.dangerSoft, color: colors.danger },
  pillNeutral: { backgroundColor: colors.surfaceMuted, color: colors.inkMuted },
  pillSuccess: { backgroundColor: colors.successSoft, color: colors.success },
  pillWarning: { backgroundColor: colors.warningSoft, color: colors.warning },
  pressed: { opacity: 0.7 },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.surfaceMuted,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.sm,
  },
  rowDetail: { color: colors.inkMuted, fontSize: typography.caption, lineHeight: 18 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '600' },
  screen: { flex: 1, maxWidth: 680, width: '100%' },
  scroll: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flexGrow: 1,
    padding: spacing.lg,
  },
  section: { gap: spacing.sm, marginBottom: spacing.xl },
  sectionBody: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    color: colors.inkMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  state: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 220,
    padding: spacing.xl,
  },
  stateBody: {
    color: colors.inkMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  stateTitle: { color: colors.ink, fontSize: typography.bodyLarge, fontWeight: '800' },
  subtitle: { color: colors.inkMuted, fontSize: typography.body, lineHeight: 21 },
});
