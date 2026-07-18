import { Redirect, Stack } from "expo-router";

import { useSession } from "@/auth/session-context";
import { colors } from "@/theme/tokens";

export default function OperationsLayout() {
  const session = useSession();
  if (session.metadata?.device.status === "REVOKED" || session.metadata?.device.status === "LOST") {
    return <Redirect href="/blocked" />;
  }
  if (session.metadata?.device.status !== "ACTIVE") return <Redirect href="/device" />;
  if (!session.metadata.activeGate) return <Redirect href="/gate" />;
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: "700" }
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="visitor/new" options={{ title: "Register visitor" }} />
      <Stack.Screen name="visitor/code" options={{ title: "Verify visitor code" }} />
      <Stack.Screen name="visitor/active" options={{ title: "Active visits" }} />
      <Stack.Screen name="visitor/[id]" options={{ title: "Visitor record" }} />
      <Stack.Screen name="daily-help/[id]" options={{ title: "Daily help" }} />
      <Stack.Screen name="parcel/new" options={{ title: "Hold parcel" }} />
      <Stack.Screen name="parcel/verify" options={{ title: "Verify collection code" }} />
      <Stack.Screen name="parcel/[id]" options={{ title: "Parcel record" }} />
      <Stack.Screen name="emergency/index" options={{ title: "Emergency alerts" }} />
      <Stack.Screen name="emergency/[id]" options={{ title: "Emergency response" }} />
      <Stack.Screen name="activity" options={{ title: "Gate activity" }} />
      <Stack.Screen name="sync/index" options={{ title: "Synchronization" }} />
      <Stack.Screen name="sync/[id]" options={{ title: "Sync record" }} />
      <Stack.Screen name="account" options={{ title: "Guard account" }} />
    </Stack>
  );
}
