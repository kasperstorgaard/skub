const encoder = new TextEncoder();
const decoder = new TextDecoder();
const keys = new Map<string, Promise<CryptoKey>>();
const HMAC = { name: "HMAC", hash: "SHA-256" };

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
export async function signValue(payload: string, secret: string) {
  const body = toBase64Url(encoder.encode(payload));
  const key = await getKey(secret);
  const tag = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const tagText = toBase64Url(new Uint8Array(tag));
  return `${body}.${tagText}`;
}

/** The payload of a value made by {@link signValue}, or `null` if it was tampered with. */
export async function verifyValue(value: string, secret: string) {
  const [body, tag, ...rest] = value.split(".");
  if (!body || !tag || rest.length) return null;

  try {
    const key = await getKey(secret);
    const signature = Uint8Array.fromBase64(tag, { alphabet: "base64url" });
    const data = encoder.encode(body);

    const isValid = await crypto.subtle.verify("HMAC", key, signature, data);
    if (!isValid) return null;

    const payloadBytes = Uint8Array.fromBase64(body, { alphabet: "base64url" });
    return decoder.decode(payloadBytes);
  } catch {
    return null;
  }
}
