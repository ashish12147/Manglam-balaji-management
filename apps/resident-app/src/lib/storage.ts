import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const LEGACY_REFRESH_TOKEN_KEY = 'resident.refresh-token';
const SESSION_CREDENTIALS_KEY = 'resident.session-credentials.v2';
const DEVICE_ID_KEY = 'resident.device-id';
const SELECTED_MEMBERSHIP_KEY = 'resident.selected-membership';

export interface RefreshCredentials {
  refreshIdempotencyKey: string;
  refreshToken: string;
}

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function newRefreshCredentials(refreshToken: string): RefreshCredentials {
  return {
    refreshIdempotencyKey: `session-refresh:${Crypto.randomUUID()}`,
    refreshToken,
  };
}

async function writeRefreshCredentials(credentials: RefreshCredentials): Promise<void> {
  await SecureStore.setItemAsync(
    SESSION_CREDENTIALS_KEY,
    JSON.stringify(credentials),
    secureOptions,
  );
}

async function readRefreshCredentials(): Promise<RefreshCredentials | null> {
  const stored = await SecureStore.getItemAsync(SESSION_CREDENTIALS_KEY, secureOptions);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<RefreshCredentials>;
      if (
        typeof parsed.refreshToken === 'string' &&
        parsed.refreshToken.length >= 64 &&
        typeof parsed.refreshIdempotencyKey === 'string' &&
        parsed.refreshIdempotencyKey.length >= 16
      ) {
        return {
          refreshIdempotencyKey: parsed.refreshIdempotencyKey,
          refreshToken: parsed.refreshToken,
        };
      }
    } catch {
      // Invalid secure state is cleared below rather than used for authentication.
    }
    await SecureStore.deleteItemAsync(SESSION_CREDENTIALS_KEY, secureOptions);
  }

  const legacyToken = await SecureStore.getItemAsync(LEGACY_REFRESH_TOKEN_KEY, secureOptions);
  if (!legacyToken) return null;
  const migrated = newRefreshCredentials(legacyToken);
  await writeRefreshCredentials(migrated);
  await SecureStore.deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY, secureOptions);
  return migrated;
}

export const credentialStore = {
  clearRefreshToken: () =>
    Promise.all([
      SecureStore.deleteItemAsync(SESSION_CREDENTIALS_KEY, secureOptions),
      SecureStore.deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY, secureOptions),
    ]).then(() => undefined),
  getRefreshCredentials: readRefreshCredentials,
  setRefreshToken: (token: string) => writeRefreshCredentials(newRefreshCredentials(token)),
};

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY, secureOptions);
  if (existing) return existing;
  const deviceId = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId, secureOptions);
  return deviceId;
}

export const membershipPreferenceStore = {
  clear: () => SecureStore.deleteItemAsync(SELECTED_MEMBERSHIP_KEY, secureOptions),
  get: () => SecureStore.getItemAsync(SELECTED_MEMBERSHIP_KEY, secureOptions),
  set: (membershipId: string) =>
    SecureStore.setItemAsync(SELECTED_MEMBERSHIP_KEY, membershipId, secureOptions),
};
