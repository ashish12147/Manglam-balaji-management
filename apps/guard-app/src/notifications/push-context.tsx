import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { endpoints } from "@/api/endpoints";
import { useSession } from "@/auth/session-context";
import { env } from "@/config/env";

type PushStatus = "IDLE" | "REGISTERING" | "REGISTERED" | "DENIED" | "UNAVAILABLE" | "FAILED";

interface PushState {
  error: string | null;
  status: PushStatus;
}

const PushContext = createContext<PushState>({ error: null, status: "IDLE" });

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export function PushProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const [state, setState] = useState<PushState>({ error: null, status: "IDLE" });
  const serverDeviceId = session.metadata?.device.id ?? null;

  useEffect(() => {
    if (
      session.phase !== "AUTHENTICATED" ||
      session.metadata?.device.status !== "ACTIVE" ||
      !serverDeviceId
    ) {
      return;
    }
    const registeredDeviceId = serverDeviceId;
    let active = true;
    async function register() {
      if (!Device.isDevice) {
        setState({ error: "Push registration requires a physical device.", status: "UNAVAILABLE" });
        return;
      }
      const projectId = env.easProjectId ?? Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        setState({ error: "EAS project ID is not configured for this build.", status: "UNAVAILABLE" });
        return;
      }
      setState({ error: null, status: "REGISTERING" });
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("security-critical", {
            importance: Notifications.AndroidImportance.MAX,
            name: "Security and emergencies",
            vibrationPattern: [0, 250, 150, 250]
          });
          await Notifications.setNotificationChannelAsync("gate-operations", {
            importance: Notifications.AndroidImportance.DEFAULT,
            name: "Gate operations"
          });
        }
        const current = await Notifications.getPermissionsAsync();
        const permission =
          current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
        if (permission.status !== "granted") {
          if (active) setState({ error: "Notification permission was denied.", status: "DENIED" });
          return;
        }
        const token = await Notifications.getExpoPushTokenAsync({ projectId });
        await endpoints.registerPushEndpoint(
          {
            deviceId: registeredDeviceId,
            platform: Platform.OS,
            provider: "EXPO",
            token: token.data
          },
          Crypto.randomUUID()
        );
        if (active) setState({ error: null, status: "REGISTERED" });
      } catch (caught) {
        if (active) {
          setState({
            error: caught instanceof Error ? caught.message : "Push registration failed.",
            status: "FAILED"
          });
        }
      }
    }
    void register();
    return () => {
      active = false;
    };
  }, [serverDeviceId, session.metadata?.device.status, session.phase]);

  const value = useMemo(() => state, [state]);
  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export function usePushStatus(): PushState {
  return useContext(PushContext);
}
