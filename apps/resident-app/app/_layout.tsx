import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Redirect, Slot, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Loading, Screen, State } from '@/components/ui';
import { notificationRoute } from '@/lib/notifications';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { ConnectivityProvider } from '@/providers/ConnectivityProvider';
import { QueryProvider } from '@/providers/QueryProvider';

function RouteGate() {
  const { profile, retrySessionRecovery, status } = useAuth();
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = notificationRoute(response.notification.request.content.data);
      if (route) router.push(route as never);
    });
    return () => subscription.remove();
  }, []);
  if (status === 'booting')
    return (
      <Screen>
        <Loading label="Restoring secure session" />
      </Screen>
    );
  if (status === 'recovery-error')
    return (
      <Screen>
        <State
          action={{ label: 'Retry', onPress: () => void retrySessionRecovery() }}
          description="Your saved session could not be verified. Nothing was changed on this device."
          kind="error"
          title="Session recovery failed"
        />
      </Screen>
    );
  if (status === 'signed-out') return <Redirect href="/auth" />;
  const approved = profile?.memberships.some((membership) => membership.status === 'APPROVED');
  if (profile?.status !== 'ACTIVE' || !approved) return <Redirect href="/account-status" />;
  return <Slot />;
}

export default function RootLayout() {
  return (
    <ConnectivityProvider>
      <QueryProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RouteGate />
        </AuthProvider>
      </QueryProvider>
    </ConnectivityProvider>
  );
}
