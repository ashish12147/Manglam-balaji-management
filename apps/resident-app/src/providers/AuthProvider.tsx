import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { apiClient, createIdempotencyKey } from '@/lib/api';
import { authApi, profileApi } from '@/lib/resident-api';
import { credentialStore, getOrCreateDeviceId, membershipPreferenceStore } from '@/lib/storage';
import type { AuthSessionPayload, Membership, OtpChallenge, ResidentProfile } from '@/types/api';

type AuthStatus = 'authenticated' | 'booting' | 'recovery-error' | 'signed-out';

function authDevice(fingerprint: string) {
  return {
    fingerprint,
    platform:
      Platform.OS === 'android'
        ? ('ANDROID' as const)
        : Platform.OS === 'ios'
          ? ('IOS' as const)
          : Platform.OS === 'web'
            ? ('WEB' as const)
            : ('UNKNOWN' as const),
  };
}

function indianPhoneE164(phone: string): string {
  return `+91${phone}`;
}

interface PendingOtp extends OtpChallenge {
  phone: string;
  verificationIdempotencyKey: string;
}

interface AuthValue {
  clearPendingOtp: () => void;
  logout: () => Promise<void>;
  pendingOtp: PendingOtp | null;
  profile: ResidentProfile | null;
  refreshProfile: () => Promise<void>;
  requestOtp: (phone: string) => Promise<void>;
  retrySessionRecovery: () => Promise<void>;
  selectMembership: (membershipId: string) => Promise<void>;
  selectedMembership: Membership | null;
  setupPin: (pin: string) => Promise<void>;
  status: AuthStatus;
  unlockPin: (phone: string, pin: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('booting');
  const [profile, setProfile] = useState<ResidentProfile | null>(null);
  const [pendingOtp, setPendingOtp] = useState<PendingOtp | null>(null);
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null);

  const commitSession = useCallback(async (session: AuthSessionPayload) => {
    await credentialStore.setRefreshToken(session.refreshToken);
    apiClient.setAccessToken(session.accessToken);
    const nextProfile = await profileApi.me();
    setProfile(nextProfile);

    const remembered = await membershipPreferenceStore.get();
    const approved = nextProfile.memberships.filter(
      (membership) => membership.status === 'APPROVED',
    );
    const selection =
      approved.find((membership) => membership.id === remembered) ?? approved[0] ?? null;
    setSelectedMembershipId(selection?.id ?? null);
    apiClient.setMembershipId(selection?.id ?? null);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(async () => {
    apiClient.setAccessToken(null);
    apiClient.setMembershipId(null);
    await Promise.all([credentialStore.clearRefreshToken(), membershipPreferenceStore.clear()]);
    setProfile(null);
    setSelectedMembershipId(null);
    setStatus('signed-out');
  }, []);

  const refreshSession = useCallback(async () => {
    const credentials = await credentialStore.getRefreshCredentials();
    if (!credentials) {
      setStatus('signed-out');
      return;
    }
    const deviceId = await getOrCreateDeviceId();
    try {
      const session = await authApi.refresh(
        { deviceFingerprint: deviceId, refreshToken: credentials.refreshToken },
        credentials.refreshIdempotencyKey,
      );
      await commitSession(session);
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 401) {
        await clearSession();
        return;
      }
      setStatus('recovery-error');
      throw error;
    }
  }, [clearSession, commitSession]);

  useEffect(() => {
    apiClient.setRefreshHandler(refreshSession);
    void refreshSession().catch(() => undefined);
    return () => apiClient.setRefreshHandler(null);
  }, [refreshSession]);

  const requestOtp = useCallback(async (phone: string) => {
    const deviceId = await getOrCreateDeviceId();
    const normalizedPhone = indianPhoneE164(phone);
    const challenge = await authApi.requestOtp({ deviceNonce: deviceId, phone: normalizedPhone });
    setPendingOtp({
      ...challenge,
      phone: normalizedPhone,
      verificationIdempotencyKey: createIdempotencyKey('otp-verify'),
    });
  }, []);

  const verifyOtp = useCallback(
    async (code: string) => {
      if (!pendingOtp) throw new Error('Request a new verification code.');
      const deviceId = await getOrCreateDeviceId();
      const session = await authApi.verifyOtp(
        {
          challengeId: pendingOtp.challengeId,
          code,
          device: authDevice(deviceId),
          deviceNonce: deviceId,
          phone: pendingOtp.phone,
        },
        pendingOtp.verificationIdempotencyKey,
      );
      await commitSession(session);
      setPendingOtp(null);
    },
    [commitSession, pendingOtp],
  );

  const unlockPin = useCallback(
    async (phone: string, pin: string) => {
      const deviceId = await getOrCreateDeviceId();
      await commitSession(
        await authApi.unlockPin({
          device: authDevice(deviceId),
          phone: indianPhoneE164(phone),
          pin,
        }),
      );
    },
    [commitSession],
  );

  const refreshProfile = useCallback(async () => {
    const next = await profileApi.me();
    setProfile(next);
  }, []);

  const selectMembership = useCallback(
    async (membershipId: string) => {
      const membership = profile?.memberships.find(
        (candidate) => candidate.id === membershipId && candidate.status === 'APPROVED',
      );
      if (!membership) throw new Error('This home is not available to your account.');
      await membershipPreferenceStore.set(membershipId);
      setSelectedMembershipId(membershipId);
      apiClient.setMembershipId(membershipId);
    },
    [profile],
  );

  const logout = useCallback(async () => {
    const authenticated = Boolean(apiClient.getAccessToken());
    try {
      if (authenticated) await authApi.logout();
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthValue>(
    () => ({
      clearPendingOtp: () => setPendingOtp(null),
      logout,
      pendingOtp,
      profile,
      refreshProfile,
      requestOtp,
      retrySessionRecovery: refreshSession,
      selectMembership,
      selectedMembership:
        profile?.memberships.find((membership) => membership.id === selectedMembershipId) ?? null,
      setupPin: authApi.setupPin,
      status,
      unlockPin,
      verifyOtp,
    }),
    [
      logout,
      pendingOtp,
      profile,
      refreshProfile,
      refreshSession,
      requestOtp,
      selectMembership,
      selectedMembershipId,
      status,
      unlockPin,
      verifyOtp,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
