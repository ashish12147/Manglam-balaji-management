import * as Crypto from "expo-crypto";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type Sha256Digest = (data: Uint8Array) => Promise<Uint8Array>;

function canonicalize(value: unknown, seen: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Offline payload numbers must be finite.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError("Offline payloads cannot be cyclic.");
    seen.add(value);
    const result = `[${value.map((entry) => canonicalize(entry, seen)).join(",")}]`;
    seen.delete(value);
    return result;
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Offline payloads must contain only JSON objects.");
    }
    if (seen.has(object)) throw new TypeError("Offline payloads cannot be cyclic.");
    seen.add(object);
    const entries = Object.keys(object)
      .sort()
      .map((key) => {
        if (object[key] === undefined) {
          throw new TypeError("Offline payloads cannot contain undefined values.");
        }
        return `${JSON.stringify(key)}:${canonicalize(object[key], seen)}`;
      });
    seen.delete(object);
    return `{${entries.join(",")}}`;
  }
  throw new TypeError("Offline payloads must contain JSON-compatible values.");
}

export function canonicalJson(value: JsonValue): string {
  return canonicalize(value, new Set());
}

export function utf8Bytes(value: string): Uint8Array {
  const bytes: number[] = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }
  return Uint8Array.from(bytes);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

const expoSha256: Sha256Digest = async (data) => {
  const ownedBytes = Uint8Array.from(data);
  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    ownedBytes.buffer
  );
  return new Uint8Array(digest);
};

export async function hmacSha256(
  key: Uint8Array,
  data: Uint8Array,
  digest: Sha256Digest = expoSha256
): Promise<Uint8Array> {
  const blockSize = 64;
  let normalizedKey = key;
  if (normalizedKey.length > blockSize) normalizedKey = await digest(normalizedKey);

  const keyBlock = new Uint8Array(blockSize);
  keyBlock.set(normalizedKey);
  const innerPad = new Uint8Array(blockSize);
  const outerPad = new Uint8Array(blockSize);
  for (let index = 0; index < blockSize; index += 1) {
    innerPad[index] = keyBlock[index]! ^ 0x36;
    outerPad[index] = keyBlock[index]! ^ 0x5c;
  }

  const innerInput = new Uint8Array(blockSize + data.length);
  innerInput.set(innerPad);
  innerInput.set(data, blockSize);
  const innerDigest = await digest(innerInput);
  const outerInput = new Uint8Array(blockSize + innerDigest.length);
  outerInput.set(outerPad);
  outerInput.set(innerDigest, blockSize);
  return digest(outerInput);
}

export async function hashCanonicalPayload(
  payload: Record<string, unknown>,
  digest: Sha256Digest = expoSha256
): Promise<string> {
  return bytesToHex(await digest(utf8Bytes(canonicalJson(payload as JsonValue))));
}

export async function signOfflineMutation(
  input: {
    aggregateId: string;
    baseVersion: number | null;
    clientMutationId: string;
    clientOccurredAt: string;
    deviceId: string;
    gateId: string;
    localSequence: number;
    operation: string;
    payloadHash: string;
  },
  deviceSecret: string,
  digest: Sha256Digest = expoSha256
): Promise<string> {
  if (deviceSecret.length < 32) {
    throw new Error("The registered device signing secret is invalid.");
  }
  const signaturePayload = canonicalJson(input as unknown as JsonValue);
  return bytesToHex(
    await hmacSha256(utf8Bytes(deviceSecret), utf8Bytes(signaturePayload), digest)
  );
}
