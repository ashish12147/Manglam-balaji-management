import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, LogIn, RefreshCw, ShieldCheck } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { z } from "zod";

import { isApiError } from "@/api/errors";
import { useSession } from "@/auth/session-context";
import { ActionButton, Field } from "@/components/Controls";
import { Screen } from "@/components/Screen";
import { StatePanel } from "@/components/StatePanel";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const schema = z.object({
  employeeCode: z.string().trim().min(2, "Enter your guard employee code.").max(40),
  enrollmentToken: z.string().trim().max(256),
  pin: z.string().regex(/^\d{4,12}$/, "PIN must contain 4 to 12 digits.")
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const session = useSession();
  const [recovering, setRecovering] = useState(false);
  const [requiresEnrollment, setRequiresEnrollment] = useState(false);
  const {
    control,
    handleSubmit,
    clearErrors,
    setError,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    defaultValues: { employeeCode: "", enrollmentToken: "", pin: "" },
    resolver: zodResolver(schema)
  });

  if (session.configurationError) {
    return (
      <Screen>
        <View style={styles.brand}>
          <ShieldCheck color={colors.primary} size={44} />
          <Text style={styles.brandTitle}>Manglam Balaji Guard</Text>
        </View>
        <StatePanel
          detail={`${session.configurationError} Ask the deployment administrator for a correctly configured build.`}
          title="Build not configured"
          tone="critical"
        />
      </Screen>
    );
  }

  function showError(caught: unknown, fallback: string) {
    setError("root", {
      message: isApiError(caught)
        ? `${caught.message}${caught.correlationId ? ` Reference: ${caught.correlationId}` : ""}`
        : caught instanceof Error
          ? caught.message
          : fallback
    });
  }

  async function recoverSession() {
    setRecovering(true);
    clearErrors("root");
    try {
      await session.retrySessionRecovery();
      router.replace("/");
    } catch (caught) {
      showError(caught, "The stored shift could not be restored.");
    } finally {
      setRecovering(false);
    }
  }

  const signIn = handleSubmit(async (values) => {
    session.clearError();
    try {
      await session.signIn(values.employeeCode, values.pin);
      router.replace("/");
    } catch (caught) {
      if (isApiError(caught) && caught.code === "DEVICE_ENROLLMENT_REQUIRED") {
        setRequiresEnrollment(true);
        setError("root", {
          message: "This installation is pending registration. Enter the one-time token issued by an administrator."
        });
        return;
      }
      showError(caught, "Sign-in failed.");
    }
  });

  const enroll = handleSubmit(async (values) => {
    if (!values.enrollmentToken.trim()) {
      setError("enrollmentToken", { message: "Enter the administrator-issued enrollment token." });
      return;
    }
    try {
      await session.enrollDevice(values.employeeCode, values.pin, values.enrollmentToken);
      setValue("enrollmentToken", "");
      router.replace("/");
    } catch (caught) {
      showError(caught, "Device enrollment failed.");
    }
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboard}
    >
      <Screen keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.mark}>
            <ShieldCheck color={colors.primary} size={38} />
          </View>
          <Text style={styles.brandTitle}>Manglam Balaji Guard</Text>
          <Text style={styles.brandHindi}>मंगलम बालाजी सुरक्षा</Text>
        </View>
        {session.phase === "RECOVERY_ERROR" ? (
          <>
            <StatePanel
              detail={session.error ?? "The stored shift could not reach the server. Its refresh credential and pending idempotency key remain secure on this device."}
              icon={RefreshCw}
              title="Shift recovery pending / शिफ्ट रिकवरी बाकी"
              tone="warning"
            />
            <ActionButton
              icon={RefreshCw}
              label="Retry stored shift"
              loading={recovering}
              onPress={() => void recoverSession()}
              secondaryLabel="सुरक्षित शिफ्ट फिर खोलें"
              variant="secondary"
            />
          </>
        ) : null}
        {requiresEnrollment ? (
          <StatePanel
            detail="Registration binds this SecureStore installation fingerprint to the pending server device. The token is used once and is never saved on this device."
            icon={KeyRound}
            title="Device enrollment / डिवाइस पंजीकरण"
            tone="warning"
          />
        ) : null}
        <View style={styles.form}>
          <Controller
            control={control}
            name="employeeCode"
            render={({ field }) => (
              <Field
                autoCapitalize="characters"
                autoCorrect={false}
                error={errors.employeeCode?.message}
                label="Employee code / कर्मचारी कोड"
                maxLength={40}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="Guard employee code"
                required
                value={field.value}
              />
            )}
          />
          <Controller
            control={control}
            name="pin"
            render={({ field }) => (
              <Field
                autoComplete="off"
                error={errors.pin?.message}
                keyboardType="number-pad"
                label="Guard PIN / गार्ड पिन"
                maxLength={12}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="4 to 12 digits"
                required
                secureTextEntry
                value={field.value}
              />
            )}
          />
          {requiresEnrollment ? (
            <Controller
              control={control}
              name="enrollmentToken"
              render={({ field }) => (
                <Field
                  autoCapitalize="characters"
                  autoCorrect={false}
                  error={errors.enrollmentToken?.message}
                  label="One-time enrollment token / पंजीकरण टोकन"
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="Token issued by administrator"
                  required
                  secureTextEntry
                  value={field.value}
                />
              )}
            />
          ) : null}
          {errors.root?.message ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {errors.root.message}
            </Text>
          ) : null}
          <ActionButton
            icon={requiresEnrollment ? KeyRound : LogIn}
            label={requiresEnrollment ? "Enroll device and start shift" : "Start guard shift"}
            loading={isSubmitting}
            onPress={() => void (requiresEnrollment ? enroll() : signIn())}
            secondaryLabel={requiresEnrollment ? "डिवाइस पंजीकृत करें" : "गार्ड शिफ्ट शुरू करें"}
            variant={requiresEnrollment ? "warning" : "primary"}
          />
          {requiresEnrollment ? (
            <ActionButton
              icon={LogIn}
              label="Back to sign in"
              onPress={() => {
                setRequiresEnrollment(false);
                setValue("enrollmentToken", "");
                clearErrors();
              }}
              secondaryLabel="साइन इन पर वापस"
              variant="quiet"
            />
          ) : null}
        </View>
        <Text style={styles.securityNote}>
          Only an active guard and an administrator-enrolled device can open gate operations. There is no shared login.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", gap: spacing.xs, marginTop: spacing.xxl },
  brandHindi: { color: colors.muted, fontSize: typography.body },
  brandTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: "800", textAlign: "center" },
  error: { backgroundColor: colors.criticalSoft, borderRadius: radii.md, color: colors.critical, fontSize: typography.label, lineHeight: 21, padding: spacing.md },
  form: { alignSelf: "center", gap: spacing.lg, maxWidth: 520, width: "100%" },
  keyboard: { backgroundColor: colors.background, flex: 1 },
  mark: { alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: radii.md, height: 68, justifyContent: "center", marginBottom: spacing.sm, width: 68 },
  securityNote: { color: colors.muted, fontSize: typography.caption, lineHeight: 19, textAlign: "center" }
});
