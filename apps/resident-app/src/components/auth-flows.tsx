import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { z } from 'zod';

import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button, Field, Pill, Screen } from '@/components/ui';

function ErrorLine({ error }: { error: unknown }) {
  return error ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {errorMessage(error)}
    </Text>
  ) : null;
}

const phoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[6-9][0-9]{9}$/, 'Enter a valid 10-digit Indian mobile number.'),
});
const otpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, 'Enter the six-digit code.'),
});
const pinSchema = z.object({ pin: z.string().regex(/^[0-9]{4,8}$/, 'Use a 4 to 8 digit PIN.') });

export function SignInScreen() {
  const { requestOtp } = useAuth();
  const form = useForm<{ phone: string }>({ defaultValues: { phone: '' } });
  const mutation = useMutation({
    mutationFn: requestOtp,
    onSuccess: () => router.push('/auth/verify'),
  });
  const submit = form.handleSubmit((values) => {
    const parsed = phoneSchema.safeParse(values);
    if (!parsed.success)
      return form.setError('phone', { message: parsed.error.issues[0]?.message });
    mutation.mutate(parsed.data.phone);
  });
  return (
    <Screen>
      <View style={styles.screen}>
        <ShieldCheck color={colors.primary} size={38} />
        <Text accessibilityRole="header" style={styles.brand}>
          Manglam Balaji
        </Text>
        <Text style={styles.copy}>Use the mobile number registered with your home.</Text>
        <Controller
          control={form.control}
          name="phone"
          render={({ field, fieldState }) => (
            <Field
              error={fieldState.error?.message}
              keyboardType="phone-pad"
              label="Mobile number"
              maxLength={10}
              onChangeText={field.onChange}
              placeholder="10-digit mobile number"
              value={field.value}
            />
          )}
        />
        <ErrorLine error={mutation.error} />
        <Button disabled={mutation.isPending} onPress={submit}>
          {mutation.isPending ? 'Requesting code' : 'Continue'}
        </Button>
        <Pressable accessibilityRole="button" onPress={() => router.push('/auth/pin')}>
          <Text style={styles.link}>Use app PIN</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

export function VerifyOtpScreen() {
  const { clearPendingOtp, pendingOtp, verifyOtp } = useAuth();
  const form = useForm<{ code: string }>({ defaultValues: { code: '' } });
  const mutation = useMutation({ mutationFn: verifyOtp, onSuccess: () => router.replace('/') });
  useEffect(() => {
    if (!pendingOtp) router.replace('/auth');
  }, [pendingOtp]);
  const submit = form.handleSubmit((values) => {
    const parsed = otpSchema.safeParse(values);
    if (!parsed.success) return form.setError('code', { message: parsed.error.issues[0]?.message });
    mutation.mutate(parsed.data.code);
  });
  return (
    <Screen>
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.brand}>
          Confirm your number
        </Text>
        <Text style={styles.copy}>
          Enter the one-time code sent to your registered mobile number. It expires at{' '}
          {formatDateTime(pendingOtp?.expiresAt)}.
        </Text>
        <Controller
          control={form.control}
          name="code"
          render={({ field, fieldState }) => (
            <Field
              error={fieldState.error?.message}
              keyboardType="number-pad"
              label="Verification code"
              maxLength={6}
              onChangeText={field.onChange}
              value={field.value}
            />
          )}
        />
        <ErrorLine error={mutation.error} />
        <Button disabled={mutation.isPending} onPress={submit}>
          {mutation.isPending ? 'Verifying' : 'Verify'}
        </Button>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            clearPendingOtp();
            router.replace('/auth');
          }}
        >
          <Text style={styles.link}>Use a different number</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

export function PinScreen() {
  const { unlockPin } = useAuth();
  const form = useForm<{ phone: string; pin: string }>({ defaultValues: { phone: '', pin: '' } });
  const mutation = useMutation({
    mutationFn: ({ phone, pin }: { phone: string; pin: string }) => unlockPin(phone, pin),
    onSuccess: () => router.replace('/'),
  });
  const submit = form.handleSubmit((values) => {
    const phone = phoneSchema.safeParse({ phone: values.phone });
    const pin = pinSchema.safeParse({ pin: values.pin });
    if (!phone.success) return form.setError('phone', { message: phone.error.issues[0]?.message });
    if (!pin.success) return form.setError('pin', { message: pin.error.issues[0]?.message });
    mutation.mutate({ phone: phone.data.phone, pin: pin.data.pin });
  });
  return (
    <Screen>
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.brand}>
          Unlock with PIN
        </Text>
        <Text style={styles.copy}>
          PIN unlock remains subject to the server's session and device checks.
        </Text>
        <Controller
          control={form.control}
          name="phone"
          render={({ field, fieldState }) => (
            <Field
              error={fieldState.error?.message}
              keyboardType="phone-pad"
              label="Mobile number"
              maxLength={10}
              onChangeText={field.onChange}
              value={field.value}
            />
          )}
        />
        <Controller
          control={form.control}
          name="pin"
          render={({ field, fieldState }) => (
            <Field
              error={fieldState.error?.message}
              keyboardType="number-pad"
              label="App PIN"
              maxLength={8}
              onChangeText={field.onChange}
              secureTextEntry
              value={field.value}
            />
          )}
        />
        <ErrorLine error={mutation.error} />
        <Button disabled={mutation.isPending} onPress={submit}>
          {mutation.isPending ? 'Unlocking' : 'Unlock'}
        </Button>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/auth')}>
          <Text style={styles.link}>Use one-time code</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

export function MembershipStatusScreen() {
  const { profile, logout, refreshProfile, selectedMembership } = useAuth();
  const memberships = profile?.memberships ?? [];
  const state =
    selectedMembership?.status ?? memberships[0]?.status ?? profile?.status ?? 'PENDING';
  const text =
    state === 'REJECTED'
      ? 'Your home association was not approved. Contact the society office for help.'
      : state === 'SUSPENDED'
        ? 'Your access has been suspended. Contact the society office for help.'
        : state === 'ENDED'
          ? 'This home association has ended. Contact the society office if this is unexpected.'
          : 'Your home association is awaiting approval. You will receive access once the society office approves it.';
  return (
    <Screen>
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.brand}>
          Account review
        </Text>
        <Pill
          label={state}
          tone={state === 'SUSPENDED' || state === 'REJECTED' ? 'danger' : 'warning'}
        />
        <Text style={styles.copy}>{text}</Text>
        <Button onPress={() => void refreshProfile()}>Check status</Button>
        <Button onPress={() => void logout()} tone="secondary">
          Sign out
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { color: colors.primary, fontSize: 30, fontWeight: '800' },
  copy: { color: colors.inkMuted, fontSize: typography.body, lineHeight: 23 },
  error: { color: colors.danger, fontSize: typography.body },
  link: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  screen: {
    gap: spacing.lg,
    justifyContent: 'center',
    minHeight: 560,
    paddingHorizontal: spacing.md,
  },
});
