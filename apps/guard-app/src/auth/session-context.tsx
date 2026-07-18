import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { configureApiAuth } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { createGuardAuthDevice } from "@/auth/device-contract";
import {
  clearSessionCredentials,
  getOrCreateDeviceIdentity,
  loadRefreshCredentials,
  loadSessionMetadata,
  renewRefreshIdempotencyKey,
  saveRefreshToken,
  saveSessionMetadata
} from "@/auth/storage";
import { getConfigurationError } from "@/config/env";
import type {
  AuthTokens,
  DeviceIdentity,
  DeviceStatus,
  Gate,
  GuardContextResponse,
  GuardSessionMetadata,
  GuardSignInResponse
} from "@/types/domain";

type SessionPhase =
  | "BOOTING"
  | "CONFIGURATION_ERROR"
  | "RECOVERY_ERROR"
  | "SIGNED_OUT"
  | "AUTHENTICATED";

interface SessionState {
  configurationError: string | null;
  deviceIdentity: DeviceIdentity | null;
  error: string | null;
  metadata: GuardSessionMetadata | null;
  phase: SessionPhase;
}

interface SessionContextValue extends SessionState {
  clearError: () => void;
  enrollDevice: (employeeCode: string, pin: string, enrollmentToken: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  markDeviceStatus: (status: DeviceStatus) => Promise<void>;
  refreshContext: () => Promise<void>;
  retrySessionRecovery: () => Promise<void>;
  selectGate: (gate: Gate) => Promise<void>;
  signIn: (employeeCode: string, pin: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function normalizeGuardContext(
  context: GuardContextResponse,
  session: { accessTokenExpiresAt: string; sessionId: string }
): GuardSessionMetadata {
  if (
    !context.guard?.id ||
    !context.device?.id ||
    !Array.isArray(context.gates) ||
    !Array.isArray(context.permissions)
  ) {
    throw new Error("The guard context returned by the server is incomplete.");
  }
  return {
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    activeGate: context.activeGate,
    device: context.device,
    gates: context.gates,
    guard: { ...context.guard, permissions: context.permissions },
    sessionId: session.sessionId
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({
    configurationError: null,
    deviceIdentity: null,
    error: null,
    metadata: null,
    phase: "BOOTING"
  });
  const accessTokenRef = useRef<string | null>(null);
  const deviceIdentityRef = useRef<DeviceIdentity | null>(null);
  const metadataRef = useRef<GuardSessionMetadata | null>(null);
  const refreshIdempotencyKeyRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);

  const updateMetadata = useCallback(async (metadata: GuardSessionMetadata) => {
    metadataRef.current = metadata;
    await saveSessionMetadata(metadata);
    setState((current) => ({
      ...current,
      error: null,
      metadata,
      phase: "AUTHENTICATED"
    }));
  }, []);

  const expireSession = useCallback(async () => {
    accessTokenRef.current = null;
    refreshIdempotencyKeyRef.current = null;
    refreshTokenRef.current = null;
    metadataRef.current = null;
    await clearSessionCredentials();
    setState((current) => ({
      ...current,
      error: null,
      metadata: null,
      phase: "SIGNED_OUT"
    }));
  }, []);

  const authDevice = useCallback((identity: DeviceIdentity) => {
    const operatingSystem = [
      Device.osName ?? Platform.OS,
      Device.osVersion ?? String(Platform.Version)
    ]
      .filter(Boolean)
      .join(" ");
    return createGuardAuthDevice(identity, {
      appVersion: Constants.expoConfig?.version,
      operatingSystem,
      platform: Platform.OS === "ios" ? "IOS" : "ANDROID"
    });
  }, []);

  useEffect(() => {
    configureApiAuth({
      getContext: () => ({
        accessToken: accessTokenRef.current,
        deviceFingerprint: deviceIdentityRef.current?.installationSecret ?? null,
        gateId: metadataRef.current?.activeGate?.id ?? null,
        refreshIdempotencyKey: refreshIdempotencyKeyRef.current,
        refreshToken: refreshTokenRef.current
      }),
      onRefreshRejected: async (refreshToken: string) => {
        const renewed = await renewRefreshIdempotencyKey(refreshToken);
        if (renewed?.refreshToken === refreshToken) {
          refreshIdempotencyKeyRef.current = renewed.refreshIdempotencyKey;
        }
      },
      onSessionExpired: expireSession,
      onTokensRotated: async (tokens: AuthTokens) => {
        const credentials = await saveRefreshToken(tokens.refreshToken);
        accessTokenRef.current = tokens.accessToken;
        refreshTokenRef.current = credentials.refreshToken;
        refreshIdempotencyKeyRef.current = credentials.refreshIdempotencyKey;
        if (metadataRef.current) {
          await updateMetadata({
            ...metadataRef.current,
            accessTokenExpiresAt: tokens.accessTokenExpiresAt
          });
        }
      }
    });
  }, [expireSession, updateMetadata]);

  const establishSession = useCallback(
    async (tokens: GuardSignInResponse) => {
      const credentials = await saveRefreshToken(tokens.refreshToken);
      accessTokenRef.current = tokens.accessToken;
      refreshTokenRef.current = credentials.refreshToken;
      refreshIdempotencyKeyRef.current = credentials.refreshIdempotencyKey;
      try {
        const context = await endpoints.guardContext();
        await updateMetadata(normalizeGuardContext(context, tokens));
      } catch (error) {
        await expireSession();
        throw error;
      }
    },
    [expireSession, updateMetadata]
  );

  const restoreSession = useCallback(async () => {
    const metadata = metadataRef.current;
    if (!refreshTokenRef.current || !refreshIdempotencyKeyRef.current || !metadata) {
      throw new Error("No recoverable guard session is stored on this device.");
    }
    const tokens = await import("@/api/client").then(({ api }) => api.refresh());
    accessTokenRef.current = tokens.accessToken;
    const currentContext = await endpoints.guardContext();
    await updateMetadata(
      normalizeGuardContext(currentContext, {
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        sessionId: metadata.sessionId
      })
    );
  }, [updateMetadata]);

  const markRecoveryError = useCallback((error: unknown) => {
    const recoverable = !!refreshTokenRef.current && !!refreshIdempotencyKeyRef.current;
    setState((current) => ({
      ...current,
      error: error instanceof Error ? error.message : "The stored guard shift could not be restored.",
      metadata: null,
      phase: recoverable ? "RECOVERY_ERROR" : "SIGNED_OUT"
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const configurationError = getConfigurationError();
      const identity = await getOrCreateDeviceIdentity();
      if (cancelled) return;
      deviceIdentityRef.current = identity;
      setState((current) => ({ ...current, deviceIdentity: identity }));

      if (configurationError) {
        setState((current) => ({
          ...current,
          configurationError,
          deviceIdentity: identity,
          phase: "CONFIGURATION_ERROR"
        }));
        return;
      }

      const [credentials, metadata] = await Promise.all([
        loadRefreshCredentials(),
        loadSessionMetadata()
      ]);
      if (cancelled) return;
      if (!credentials || !metadata) {
        if (credentials || metadata) await clearSessionCredentials();
        setState((current) => ({ ...current, deviceIdentity: identity, phase: "SIGNED_OUT" }));
        return;
      }

      refreshTokenRef.current = credentials.refreshToken;
      refreshIdempotencyKeyRef.current = credentials.refreshIdempotencyKey;
      metadataRef.current = metadata;
      try {
        await restoreSession();
      } catch (error) {
        if (!cancelled) markRecoveryError(error);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [markRecoveryError, restoreSession]);

  const retrySessionRecovery = useCallback(async () => {
    setState((current) => ({ ...current, error: null, phase: "BOOTING" }));
    try {
      await restoreSession();
    } catch (error) {
      markRecoveryError(error);
      throw error;
    }
  }, [markRecoveryError, restoreSession]);

  const signIn = useCallback(
    async (employeeCode: string, pin: string) => {
      const identity = deviceIdentityRef.current ?? (await getOrCreateDeviceIdentity());
      deviceIdentityRef.current = identity;
      const response = await endpoints.login(
        {
          device: authDevice(identity),
          employeeCode: employeeCode.trim(),
          pin
        },
        Crypto.randomUUID()
      );
      await establishSession(response);
    },
    [authDevice, establishSession]
  );

  const enrollDevice = useCallback(
    async (employeeCode: string, pin: string, enrollmentToken: string) => {
      const identity = deviceIdentityRef.current ?? (await getOrCreateDeviceIdentity());
      deviceIdentityRef.current = identity;
      const response = await endpoints.enrollGuardDevice(
        {
          device: authDevice(identity),
          employeeCode: employeeCode.trim(),
          enrollmentToken: enrollmentToken.trim(),
          pin
        },
        Crypto.randomUUID()
      );
      await establishSession(response);
    },
    [authDevice, establishSession]
  );

  const signOut = useCallback(async () => {
    try {
      if (accessTokenRef.current) await endpoints.logout(Crypto.randomUUID());
    } finally {
      await expireSession();
    }
  }, [expireSession]);

  const refreshContext = useCallback(async () => {
    if (!metadataRef.current) throw new Error("There is no active guard shift.");
    const context = await endpoints.guardContext();
    await updateMetadata(
      normalizeGuardContext(context, {
        accessTokenExpiresAt: metadataRef.current.accessTokenExpiresAt,
        sessionId: metadataRef.current.sessionId
      })
    );
  }, [updateMetadata]);

  const selectGate = useCallback(
    async (gate: Gate) => {
      await endpoints.selectGate(gate.id, Crypto.randomUUID());
      await refreshContext();
    },
    [refreshContext]
  );

  const markDeviceStatus = useCallback(
    async (status: DeviceStatus) => {
      if (!metadataRef.current) return;
      await updateMetadata({
        ...metadataRef.current,
        device: { ...metadataRef.current.device, status }
      });
    },
    [updateMetadata]
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      ...state,
      clearError: () => setState((current) => ({ ...current, error: null })),
      enrollDevice,
      hasPermission: (permission) => state.metadata?.guard.permissions.includes(permission) ?? false,
      markDeviceStatus,
      refreshContext,
      retrySessionRecovery,
      selectGate,
      signIn,
      signOut
    }),
    [
      enrollDevice,
      markDeviceStatus,
      refreshContext,
      retrySessionRecovery,
      selectGate,
      signIn,
      signOut,
      state
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
