import { Redirect } from "expo-router";

import { LoadingPanel } from "@/components/StatePanel";
import { Screen } from "@/components/Screen";
import { useSession } from "@/auth/session-context";

export default function IndexScreen() {
  const session = useSession();
  if (session.phase === "BOOTING") {
    return (
      <Screen>
        <LoadingPanel label="Validating this guard device…" />
      </Screen>
    );
  }
  if (session.phase !== "AUTHENTICATED") return <Redirect href="/login" />;
  if (session.metadata?.device.status === "REVOKED" || session.metadata?.device.status === "LOST") {
    return <Redirect href="/blocked" />;
  }
  if (session.metadata?.device.status !== "ACTIVE") return <Redirect href="/device" />;
  if (!session.metadata.activeGate) return <Redirect href="/gate" />;
  return <Redirect href="/home" />;
}
