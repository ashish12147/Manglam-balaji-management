import { LogOut, RefreshCw, ShieldX } from "lucide-react-native";
import { Redirect } from "expo-router";

import { useSession } from "@/auth/session-context";
import { ActionButton } from "@/components/Controls";
import { Screen } from "@/components/Screen";
import { StatePanel } from "@/components/StatePanel";

export default function BlockedScreen() {
  const session = useSession();
  const status = session.metadata?.device.status;
  if (status === "ACTIVE") return <Redirect href={session.metadata?.activeGate ? "/home" : "/gate"} />;
  return (
    <Screen>
      <StatePanel
        detail={`This device is ${status?.toLowerCase() ?? "not active"}. Local gate records are unavailable. Contact the security supervisor before using another device.`}
        icon={ShieldX}
        title="Device blocked / डिवाइस बंद"
        tone="critical"
      />
      <ActionButton
        icon={RefreshCw}
        label="Check again"
        onPress={() => void session.refreshContext()}
        secondaryLabel="फिर जांचें"
        variant="secondary"
      />
      <ActionButton
        icon={LogOut}
        label="Sign out"
        onPress={() => void session.signOut()}
        secondaryLabel="साइन आउट"
        variant="quiet"
      />
    </Screen>
  );
}
