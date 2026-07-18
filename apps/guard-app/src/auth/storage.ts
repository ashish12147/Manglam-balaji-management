import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";

import {
  createRefreshCredentials,
  parseRefreshCredentials,
  type RefreshCredentials
} from "@/auth/refresh-credentials";
import type { DeviceIdentity, GuardSessionMetadata } from "@/types/domain";

const DEVICE_KEY = "mb.guard.device.v1";
const LEGACY_REFRESH_TOKEN_KEY = "mb.guard.refresh-token.v1";
const REFRESH_CREDENTIALS_KEY = "mb.guard.refresh-credentials.v2";
const SESSION_KEY = "mb.guard.session.v1";
const DATABASE_KEY = "mb.guard.database-key.v1";

const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function randomSecret(byteLength: number): Promise<string> {
  return bytesToHex(await Crypto.getRandomBytesAsync(byteLength));
}

function newRefreshCredentials(refreshToken: string): RefreshCredentials {
  return createRefreshCredentials(refreshToken, Crypto.randomUUID());
}

async function writeRefreshCredentials(credentials: RefreshCredentials): Promise<void> {
  await SecureStore.setItemAsync(
    REFRESH_CREDENTIALS_KEY,
    JSON.stringify(credentials),
    secureOptions
  );
}

export async function getOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  const stored = await SecureStore.getItemAsync(DEVICE_KEY, secureOptions);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as DeviceIdentity;
      if (
        UUID_PATTERN.test(parsed.clientDeviceId) &&
        FINGERPRINT_PATTERN.test(parsed.installationSecret) &&
        typeof parsed.label === "string" &&
        parsed.label.trim().length > 0
      ) {
        return parsed;
      }
    } catch {
      // Invalid secure state is deleted and regenerated below.
    }
    await SecureStore.deleteItemAsync(DEVICE_KEY, secureOptions);
  }

  const identity: DeviceIdentity = {
    clientDeviceId: Crypto.randomUUID(),
    installationSecret: await randomSecret(32),
    label: Device.deviceName ?? Device.modelName ?? "Guard device"
  };
  await SecureStore.setItemAsync(DEVICE_KEY, JSON.stringify(identity), secureOptions);
  return identity;
}

export async function loadRefreshCredentials(): Promise<RefreshCredentials | null> {
  const stored = await SecureStore.getItemAsync(REFRESH_CREDENTIALS_KEY, secureOptions);
  if (stored) {
    const parsed = parseRefreshCredentials(stored);
    if (parsed) return parsed;
    await SecureStore.deleteItemAsync(REFRESH_CREDENTIALS_KEY, secureOptions);
  }

  const legacyToken = await SecureStore.getItemAsync(LEGACY_REFRESH_TOKEN_KEY, secureOptions);
  if (!legacyToken) return null;
  try {
    const credentials = newRefreshCredentials(legacyToken);
    await writeRefreshCredentials(credentials);
    await SecureStore.deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY, secureOptions);
    return credentials;
  } catch {
    await SecureStore.deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY, secureOptions);
    return null;
  }
}

export async function saveRefreshToken(token: string): Promise<RefreshCredentials> {
  const credentials = newRefreshCredentials(token);
  await writeRefreshCredentials(credentials);
  await SecureStore.deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY, secureOptions);
  return credentials;
}

export async function renewRefreshIdempotencyKey(
  expectedRefreshToken: string
): Promise<RefreshCredentials | null> {
  const current = await loadRefreshCredentials();
  if (!current || current.refreshToken !== expectedRefreshToken) return current;
  const renewed = newRefreshCredentials(current.refreshToken);
  await writeRefreshCredentials(renewed);
  return renewed;
}

export async function loadSessionMetadata(): Promise<GuardSessionMetadata | null> {
  const stored = await SecureStore.getItemAsync(SESSION_KEY, secureOptions);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as GuardSessionMetadata;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY, secureOptions);
    return null;
  }
}

export async function saveSessionMetadata(session: GuardSessionMetadata): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), secureOptions);
}

export async function clearSessionCredentials(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(REFRESH_CREDENTIALS_KEY, secureOptions),
    SecureStore.deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY, secureOptions),
    SecureStore.deleteItemAsync(SESSION_KEY, secureOptions)
  ]);
}

export async function getOrCreateDatabaseKey(): Promise<string> {
  const stored = await SecureStore.getItemAsync(DATABASE_KEY, secureOptions);
  if (stored) return stored;
  const key = await randomSecret(32);
  await SecureStore.setItemAsync(DATABASE_KEY, key, secureOptions);
  return key;
}

export async function clearDeviceSecrets(): Promise<void> {
  await Promise.all([
    clearSessionCredentials(),
    SecureStore.deleteItemAsync(DEVICE_KEY, secureOptions),
    SecureStore.deleteItemAsync(DATABASE_KEY, secureOptions)
  ]);
}
