import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { Suspense, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SessionProvider, useSession } from "@/auth/session-context";
import { ConnectivityProvider } from "@/connectivity/connectivity-context";
import { initializeGuardDatabase } from "@/offline/database";
import { SyncProvider } from "@/offline/sync-context";
import { PushProvider } from "@/notifications/push-context";
import { RealtimeProvider } from "@/realtime/realtime-context";
import { colors, spacing, typography } from "@/theme/tokens";

function BootScreen() {
  return (
    <View accessibilityRole="progressbar" style={styles.boot}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.bootTitle}>Preparing guard device</Text>
      <Text style={styles.bootSubtitle}>गार्ड डिवाइस तैयार हो रहा है</Text>
    </View>
  );
}

function RootNavigator() {
  const session = useSession();
  const signedIn = session.phase === "AUTHENTICATED";
  return (
    <Stack
      screenOptions={{
        animation: "fade",
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: "700" }
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: { retry: false },
          queries: {
            gcTime: 5 * 60_000,
            refetchOnReconnect: true,
            retry: 1,
            staleTime: 10_000
          }
        }
      })
  );
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <Suspense fallback={<BootScreen />}>
            <SQLiteProvider
              databaseName="manglam-balaji-guard.db"
              onInit={initializeGuardDatabase}
              useSuspense
            >
              <ConnectivityProvider>
                <SyncProvider>
                  <PushProvider>
                    <RealtimeProvider>
                      <RootNavigator />
                    </RealtimeProvider>
                  </PushProvider>
                </SyncProvider>
              </ConnectivityProvider>
            </SQLiteProvider>
          </Suspense>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.sm,
    justifyContent: "center",
    padding: spacing.xl
  },
  bootSubtitle: {
    color: colors.muted,
    fontSize: typography.body
  },
  bootTitle: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: "700",
    marginTop: spacing.md
  }
});
