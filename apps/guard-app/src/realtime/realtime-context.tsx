import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { io, type Socket } from "socket.io-client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { api } from "@/api/client";
import { useSession } from "@/auth/session-context";
import { env } from "@/config/env";

interface RealtimeState {
  connected: boolean;
  lastEventAt: string | null;
}

const disconnectedState: RealtimeState = { connected: false, lastEventAt: null };
const RealtimeContext = createContext<RealtimeState>(disconnectedState);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const queryClient = useQueryClient();
  const [state, setState] = useState<RealtimeState>(disconnectedState);
  const gateId = session.metadata?.activeGate?.id ?? null;
  const eligible =
    !!env.wsUrl &&
    session.phase === "AUTHENTICATED" &&
    session.metadata?.device.status === "ACTIVE" &&
    !!gateId;

  useEffect(() => {
    if (!eligible) return;
    let socket: Socket | null = null;
    let cancelled = false;
    void api
      .post<{ ticket: string }>("/auth/realtime-ticket", {}, { idempotencyKey: Crypto.randomUUID() })
      .then(({ ticket }) => {
        if (cancelled) return;
        socket = io(env.wsUrl!, {
          auth: { ticket },
          path: "/socket.io",
          reconnection: true,
          reconnectionDelay: 1_000,
          reconnectionDelayMax: 10_000,
          transports: ["websocket"]
        });
        socket.on("connect", () => setState((current) => ({ ...current, connected: true })));
        socket.on("disconnect", () => setState((current) => ({ ...current, connected: false })));
        const refresh = () => {
          setState((current) => ({ ...current, lastEventAt: new Date().toISOString() }));
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
            queryClient.invalidateQueries({ queryKey: ["visitors"] }),
            queryClient.invalidateQueries({ queryKey: ["emergencies"] }),
            queryClient.invalidateQueries({ queryKey: ["parcels"] }),
            queryClient.invalidateQueries({ queryKey: ["activity"] })
          ]);
        };
        socket.on("visitor.updated", refresh);
        socket.on("visitor.approval.updated", refresh);
        socket.on("emergency.updated", refresh);
        socket.on("parcel.updated", refresh);
      })
      .catch(() => {
        if (!cancelled) setState(disconnectedState);
      });

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [eligible, gateId, queryClient]);

  const value = useMemo(() => (eligible ? state : disconnectedState), [eligible, state]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeState {
  return useContext(RealtimeContext);
}
