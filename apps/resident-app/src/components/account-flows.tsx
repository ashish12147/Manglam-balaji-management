import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { Button, Field, PageHeader, Pill, QueryState, Row, Screen, Section } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { registerForNotifications } from '@/lib/notifications';
import { useApiQuery } from '@/lib/query';
import { familyApi, notificationApi, profileApi } from '@/lib/resident-api';
import { useAuth } from '@/providers/AuthProvider';
import { useConnectivity } from '@/providers/ConnectivityProvider';
import { colors, spacing, typography } from '@/theme/tokens';

function useQueryPresentation(query: {
  error: unknown;
  isLoading: boolean;
  refetch: () => unknown;
}) {
  const c = useConnectivity();
  return {
    error: query.error,
    isLoading: query.isLoading,
    isOffline: c.isResolved && !c.isOnline,
    onRetry: () => void query.refetch(),
  };
}
function ErrorLine({ error }: { error: unknown }) {
  return error ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {errorMessage(error)}
    </Text>
  ) : null;
}

export function AccountScreen() {
  const { logout, profile, selectMembership, selectedMembership } = useAuth();
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const register = async () => {
    const result = await registerForNotifications();
    setPushMessage(
      result.registered
        ? 'Notifications registered for this device.'
        : (result.error ?? 'Notifications are unavailable on this platform.'),
    );
  };
  return (
    <Screen>
      <PageHeader subtitle={profile?.phoneMasked ?? ''} title="Account" />
      <Section title="Home">
        {profile?.memberships
          .filter((membership) => membership.status === 'APPROVED')
          .map((membership) => (
            <Row
              detail={
                membership.relationship.replaceAll('_', ' ') + ' . ' + membership.flat.block.name
              }
              key={membership.id}
              onPress={() => void selectMembership(membership.id)}
              title={'Flat ' + membership.flat.number}
            >
              <Pill
                label={membership.id === selectedMembership?.id ? 'Selected' : 'Select'}
                tone={membership.id === selectedMembership?.id ? 'success' : 'neutral'}
              />
            </Row>
          ))}
        {!selectedMembership ? (
          <Row
            detail="No approved home association is available."
            title="Home access unavailable"
          />
        ) : null}
      </Section>
      <Section title="Resident services">
        <Row
          detail="Family members connected to your current home."
          onPress={() => router.push('/profile/family')}
          title="Family members"
        />
        <Row
          detail="Sessions signed in to your account."
          onPress={() => router.push('/profile/sessions')}
          title="Sessions and security"
        />
        <Row
          detail="Manage in-app and push notification choices."
          onPress={() => router.push('/profile/preferences')}
          title="Notification preferences"
        />
        <Row
          detail="Name, email and local app PIN."
          onPress={() => router.push('/profile')}
          title="Profile"
        />
      </Section>
      <Section title="Notifications">
        <Button onPress={() => void register()} tone="secondary">
          Enable notifications on this device
        </Button>
        {pushMessage ? <Text style={styles.message}>{pushMessage}</Text> : null}
      </Section>
      <Button onPress={() => void logout()} tone="secondary">
        Sign out
      </Button>
    </Screen>
  );
}

const profileSchema = z.object({
  displayName: z.string().trim().min(2, 'Enter your name.').max(120),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email.')]),
});
export function ProfileScreen() {
  const { profile, refreshProfile, setupPin } = useAuth();
  const form = useForm({
    defaultValues: {
      displayName: profile?.displayName ?? '',
      email: profile?.email ?? '',
      pin: '',
    },
  });
  const update = useMutation({
    mutationFn: (values: { displayName: string; email: string }) =>
      profileApi.update({ displayName: values.displayName, email: values.email || null }),
    onSuccess: () => void refreshProfile(),
  });
  const pin = useMutation({ mutationFn: (value: string) => setupPin(value) });
  const submit = form.handleSubmit((values) => {
    const result = profileSchema.safeParse(values);
    if (!result.success) {
      result.error.issues.forEach((issue) =>
        form.setError(issue.path[0] as 'displayName', { message: issue.message }),
      );
      return;
    }
    update.mutate(result.data);
  });
  return (
    <Screen>
      <PageHeader title="Profile" />
      <Section>
        <View style={styles.form}>
          <Controller
            control={form.control}
            name="displayName"
            render={({ field, fieldState }) => (
              <Field
                error={fieldState.error?.message}
                label="Display name"
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <Field
                autoCapitalize="none"
                error={fieldState.error?.message}
                keyboardType="email-address"
                label="Email (optional)"
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
          <ErrorLine error={update.error} />
          <Button disabled={update.isPending} onPress={submit}>
            {update.isPending ? 'Saving' : 'Save profile'}
          </Button>
        </View>
      </Section>
      <Section title="App PIN">
        <View style={styles.form}>
          <Controller
            control={form.control}
            name="pin"
            render={({ field }) => (
              <Field
                keyboardType="number-pad"
                label="New PIN (4 to 8 digits)"
                maxLength={8}
                onChangeText={field.onChange}
                secureTextEntry
                value={field.value}
              />
            )}
          />
          <Button
            disabled={pin.isPending}
            onPress={() => {
              const value = form.getValues('pin');
              if (!/^[0-9]{4,8}$/.test(value)) {
                form.setError('pin', { message: 'Use a 4 to 8 digit PIN.' });
                return;
              }
              pin.mutate(value);
            }}
          >
            Set app PIN
          </Button>
          <ErrorLine error={pin.error} />
        </View>
      </Section>
    </Screen>
  );
}

const familySchema = z.object({
  name: z.string().trim().min(2, 'Enter a name.').max(120),
  relationship: z.string().trim().min(2, 'Enter the relationship.').max(60),
});
export function FamilyScreen() {
  const { selectedMembership } = useAuth();
  const client = useQueryClient();
  const family = useApiQuery(
    ['family', selectedMembership?.id],
    () => familyApi.list(selectedMembership?.id ?? ''),
    { enabled: Boolean(selectedMembership?.id) },
  );
  const form = useForm({ defaultValues: { name: '', relationship: '' } });
  const create = useMutation({
    mutationFn: (v: { name: string; relationship: string }) =>
      familyApi.create(selectedMembership?.id ?? '', v),
    onSuccess: () => {
      form.reset();
      void client.invalidateQueries({ queryKey: ['family', selectedMembership?.id] });
    },
  });
  const submit = form.handleSubmit((values) => {
    const result = familySchema.safeParse(values);
    if (!result.success) {
      result.error.issues.forEach((issue) =>
        form.setError(issue.path[0] as 'name', { message: issue.message }),
      );
      return;
    }
    create.mutate(result.data);
  });
  return (
    <Screen>
      <PageHeader title="Family members" />
      <QueryState {...useQueryPresentation(family)}>
        <Section>
          {(family.data?.items.length ?? 0) === 0 ? (
            <Row detail="No family members are recorded for this home." title="No family members" />
          ) : (
            family.data?.items.map((member) => (
              <Row detail={member.relationship} key={member.id} title={member.name}>
                <Pill
                  label={member.status}
                  tone={member.status === 'ACTIVE' ? 'success' : 'neutral'}
                />
              </Row>
            ))
          )}
        </Section>
        <Section title="Add adult family member">
          <View style={styles.form}>
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field
                  error={fieldState.error?.message}
                  label="Name"
                  onChangeText={field.onChange}
                  value={field.value}
                />
              )}
            />
            <Controller
              control={form.control}
              name="relationship"
              render={({ field, fieldState }) => (
                <Field
                  error={fieldState.error?.message}
                  label="Relationship"
                  onChangeText={field.onChange}
                  value={field.value}
                />
              )}
            />
            <ErrorLine error={create.error} />
            <Button disabled={create.isPending} onPress={submit}>
              Add family member
            </Button>
          </View>
        </Section>
      </QueryState>
    </Screen>
  );
}

export function SessionsScreen() {
  const client = useQueryClient();
  const sessions = useApiQuery(['sessions'], profileApi.sessions);
  const revoke = useMutation({
    mutationFn: profileApi.revokeSession,
    onSettled: () => void client.invalidateQueries({ queryKey: ['sessions'] }),
  });
  return (
    <Screen>
      <PageHeader title="Sessions and security" />
      <QueryState {...useQueryPresentation(sessions)}>
        <Section>
          {(sessions.data?.items.length ?? 0) === 0 ? (
            <Row detail="No active sessions were returned." title="No sessions" />
          ) : (
            sessions.data?.items.map((session) => (
              <View key={session.id}>
                <Row
                  detail={session.platform + ' . Last active ' + formatDateTime(session.lastSeenAt)}
                  title={session.deviceName}
                >
                  <Pill
                    label={session.current ? 'Current device' : 'Active'}
                    tone={session.current ? 'success' : 'neutral'}
                  />
                </Row>
                {!session.current ? (
                  <Button
                    disabled={revoke.isPending}
                    onPress={() => revoke.mutate(session.id)}
                    tone="secondary"
                  >
                    Sign out this device
                  </Button>
                ) : null}
              </View>
            ))
          )}
          <ErrorLine error={revoke.error} />
        </Section>
      </QueryState>
    </Screen>
  );
}

export function PreferencesScreen() {
  const client = useQueryClient();
  const preferences = useApiQuery(['notification-preferences'], notificationApi.preferences);
  const update = useMutation({
    mutationFn: notificationApi.updatePreferences,
    onSuccess: () => void client.invalidateQueries({ queryKey: ['notification-preferences'] }),
  });
  const data = preferences.data;
  const editable = ['visitorActivity', 'notices', 'complaints', 'payments', 'general'] as const;
  return (
    <Screen>
      <PageHeader
        subtitle="Security-critical and emergency alerts are always enabled."
        title="Notification preferences"
      />
      <QueryState {...useQueryPresentation(preferences)}>
        {data ? (
          <Section>
            {editable.map((key) => (
              <Row
                detail={data[key] ? 'Enabled' : 'Disabled'}
                key={key}
                title={key.replace(/([A-Z])/g, ' $1')}
              >
                <Button
                  disabled={update.isPending}
                  onPress={() => update.mutate({ [key]: !data[key] })}
                  tone="secondary"
                >
                  {data[key] ? 'Turn off' : 'Turn on'}
                </Button>
              </Row>
            ))}
            <Row detail="Always enabled for safety." title="Security critical" />
            <Row detail="Always enabled for safety." title="Emergency" />
            <ErrorLine error={update.error} />
          </Section>
        ) : null}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: typography.caption },
  form: { gap: spacing.lg, paddingVertical: spacing.md },
  message: { color: colors.inkMuted, fontSize: typography.caption, paddingTop: spacing.sm },
});
