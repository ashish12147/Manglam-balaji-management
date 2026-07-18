import { Stack } from "expo-router";

export default function AuthenticatedLayout() {
  return (
    <Stack>
      <Stack.Screen name="device" options={{ headerShown: false }} />
      <Stack.Screen name="blocked" options={{ headerShown: false }} />
      <Stack.Screen name="gate" options={{ headerShown: false }} />
      <Stack.Screen name="(ops)" options={{ headerShown: false }} />
    </Stack>
  );
}
