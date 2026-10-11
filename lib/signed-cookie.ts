import { isDev } from "#/lib/env.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const keys = new Map<string, Promise<CryptoKey>>();
const HMAC = { name: "HMAC", hash: "SHA-256" };

export const COOKIE_SIGNING_KEY = getSigningKey();

function getSigningKey(): string {
  if (isDev) return "skub-dev-cookie-signing-key";

  const key = Deno.env.get("COOKIE_SIGNING_KEY");
  if (!key) throw new Error("COOKIE_SIGNING_KEY not set");

  return key;
}

function getKey(secret: string) {
  let key = keys.get(secret);
  if (!key) {
    const raw = encoder.encode(secret);
    key = crypto.subtle.importKey("raw", raw, HMAC, false, ["sign", "verify"]);
    keys.set(secret, key);
  }
  return key;
}

function toBase64Url(bytes: Uint8Array) {
  return bytes.toBase64({ alphabet: "base64url", omitPadding: true });
}

/** Encodes `payload` as `<base64url payload>.<base64url HMAC-SHA256 tag>`. */
export function signValue(payload: string, secret: string) {
  return signBytes(encoder.encode(payload), secret);
}

/** The payload of a value made by {@link signValue}, or `null` if it was tampered with. */
export async function verifyValue(value: string, secret: string) {
  const payload = await verifyBytes(value, secret);
  return payload && decoder.decode(payload);
}

/** {@link signValue} for a binary payload. */
export async function signBytes(payload: Uint8Array, secret: string) {
  const body = toBase64Url(payload);
  const key = await getKey(secret);
  const tag = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const tagText = toBase64Url(new Uint8Array(tag));
  return `${body}.${tagText}`;
}

/** The payload of a value made by {@link signBytes}, or `null` if it was tampered with. */
export async function verifyBytes(value: string, secret: string) {
  const [body, tag, ...rest] = value.split(".");
  if (!body || !tag || rest.length) return null;

  try {
    const key = await getKey(secret);
    const signature = Uint8Array.fromBase64(tag, { alphabet: "base64url" });
    const data = encoder.encode(body);

    const isValid = await crypto.subtle.verify("HMAC", key, signature, data);
    if (!isValid) return null;

    return Uint8Array.fromBase64(body, { alphabet: "base64url" });
  } catch {
    return null;
  }
}
