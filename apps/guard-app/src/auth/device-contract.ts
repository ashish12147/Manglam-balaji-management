import type { DeviceIdentity } from "@/types/domain";

export interface GuardAuthDevice {
  appVersion?: string;
  fingerprint: string;
  label: string;
  operatingSystem: string;
  platform: "ANDROID" | "IOS";
}

export function createGuardAuthDevice(
  identity: DeviceIdentity,
  runtime: {
    appVersion?: string | null;
    operatingSystem: string;
    platform: "ANDROID" | "IOS";
  }
): GuardAuthDevice {
  if (!/^[a-f0-9]{64}$/i.test(identity.installationSecret)) {
    throw new Error("The SecureStore device fingerprint is invalid.");
  }
  return {
    ...(runtime.appVersion ? { appVersion: runtime.appVersion } : {}),
    fingerprint: identity.installationSecret,
    label: identity.label,
    operatingSystem: runtime.operatingSystem,
    platform: runtime.platform
  };
}
