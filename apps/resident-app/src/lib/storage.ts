import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'resident.refresh-token';
const DEVICE_ID_KEY = 'resident.device-id';
const SELECTED_MEMBERSHIP_KEY = 'resident.selected-membership';

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const credentialStore = {
  clearRefreshToken: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, secureOptions),
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY, secureOptions),
  setRefreshToken: (token: string) =>
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, secureOptions),
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
