import type { LucideIcon } from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps
} from "react-native";

import { colors, control, radii, spacing, typography } from "@/theme/tokens";

type ButtonVariant = "primary" | "secondary" | "danger" | "warning" | "quiet";

const buttonColors: Record<ButtonVariant, { background: string; border: string; text: string }> = {
  danger: { background: colors.critical, border: colors.critical, text: colors.white },
  primary: { background: colors.primary, border: colors.primary, text: colors.white },
  quiet: { background: "transparent", border: "transparent", text: colors.primary },
  secondary: { background: colors.surface, border: colors.border, text: colors.ink },
  warning: { background: colors.warning, border: colors.warning, text: colors.white }
};

export function ActionButton({
  accessibilityLabel,
  disabled = false,
  icon: Icon,
  label,
  loading = false,
  onPress,
  secondaryLabel,
  testID,
  variant = "primary"
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  icon?: LucideIcon;
  label: string;
  loading?: boolean;
  onPress: () => void;
  secondaryLabel?: string;
  testID?: string;
  variant?: ButtonVariant;
}) {
  const palette = buttonColors[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? [label, secondaryLabel].filter(Boolean).join(", ")}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.background, borderColor: palette.border },
        pressed && !inactive ? styles.pressed : null,
        inactive ? styles.disabled : null
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : Icon ? (
        <Icon color={palette.text} size={24} strokeWidth={2.2} />
      ) : null}
      <View style={styles.buttonTextGroup}>
        <Text numberOfLines={2} style={[styles.buttonLabel, { color: palette.text }]}>
          {label}
        </Text>
        {secondaryLabel ? (
          <Text numberOfLines={1} style={[styles.buttonSecondary, { color: palette.text }]}>
            {secondaryLabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function IconButton({
  accessibilityLabel,
  disabled = false,
  icon: Icon,
  onPress
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: LucideIcon;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && !disabled ? styles.pressed : null]}
    >
      <Icon color={disabled ? colors.disabled : colors.primary} size={24} />
    </Pressable>
  );
}

export function Field({
  error,
  hint,
  keyboardType,
  label,
  onChangeText,
  required = false,
  value,
  ...inputProps
}: {
  error?: string;
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  onChangeText: (value: string) => void;
  required?: boolean;
  value: string;
} & Omit<TextInputProps, "keyboardType" | "onChangeText" | "value">) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? " *" : ""}
      </Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholderTextColor={colors.disabled}
        style={[styles.input, inputProps.multiline ? styles.multiline : null, error ? styles.inputError : null]}
        value={value}
        {...inputProps}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function ChoiceGroup<T extends string>({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: T) => void;
  options: readonly { label: string; secondaryLabel?: string; value: T }[];
  value: T;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.choiceGrid}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              accessibilityLabel={[option.label, option.secondaryLabel].filter(Boolean).join(", ")}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.choice,
                selected ? styles.choiceSelected : null,
                pressed ? styles.pressed : null
              ]}
            >
              <Text style={[styles.choiceLabel, selected ? styles.choiceLabelSelected : null]}>
                {option.label}
              </Text>
              {option.secondaryLabel ? (
                <Text style={[styles.choiceSecondary, selected ? styles.choiceLabelSelected : null]}>
                  {option.secondaryLabel}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "center",
    minHeight: control.minHeight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  buttonLabel: {
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center"
  },
  buttonSecondary: {
    fontSize: typography.caption,
    lineHeight: 17,
    opacity: 0.9,
    textAlign: "center"
  },
  buttonTextGroup: {
    flexShrink: 1,
    gap: 1
  },
  choice: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 64,
    padding: spacing.sm
  },
  choiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  choiceLabel: {
    color: colors.ink,
    fontSize: typography.label,
    fontWeight: "700",
    textAlign: "center"
  },
  choiceLabelSelected: {
    color: colors.primary
  },
  choiceSecondary: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 17,
    textAlign: "center"
  },
  choiceSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 2
  },
  disabled: {
    opacity: 0.55
  },
  errorText: {
    color: colors.critical,
    fontSize: typography.caption,
    lineHeight: 18
  },
  fieldGroup: {
    gap: spacing.sm
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: typography.label,
    fontWeight: "700",
    lineHeight: 20
  },
  hintText: {
    color: colors.muted,
    fontSize: typography.caption,
    lineHeight: 18
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: control.iconButton,
    justifyContent: "center",
    width: control.iconButton
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.black,
    fontSize: typography.body,
    minHeight: control.minHeight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  inputError: {
    borderColor: colors.critical
  },
  multiline: {
    minHeight: 104,
    textAlignVertical: "top"
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }]
  }
});
