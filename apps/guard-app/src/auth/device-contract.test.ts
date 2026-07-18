import { describe, expect, it } from "vitest";

import { createGuardAuthDevice } from "./device-contract";

describe("guard auth device contract", () => {
  it("uses the SecureStore installation secret as the stable fingerprint", () => {
    const installationSecret = "ab".repeat(32);
    const payload = createGuardAuthDevice(
      {
        clientDeviceId: "local-client-uuid",
        installationSecret,
        label: "Gate tablet"
      },
      { appVersion: "1.0.0", operatingSystem: "Android 16", platform: "ANDROID" }
    );
    expect(payload.fingerprint).toBe(installationSecret);
    expect(payload).not.toHaveProperty("clientDeviceId");
    expect(payload.platform).toBe("ANDROID");
  });

  it("rejects malformed fingerprints before a credential request", () => {
    expect(() =>
      createGuardAuthDevice(
        { clientDeviceId: "local", installationSecret: "short", label: "Gate tablet" },
        { operatingSystem: "Android", platform: "ANDROID" }
      )
    ).toThrow("fingerprint is invalid");
  });
});
