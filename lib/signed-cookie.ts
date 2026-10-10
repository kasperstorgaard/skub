const encoder = new TextEncoder();
const decoder = new TextDecoder();
const keys = new Map<string, Promise<CryptoKey>>();

function getKey(secret: string) {
  let key = keys.get(secret);
  if (!key) {
    key = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
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
  const tag = await crypto.subtle.sign(
    "HMAC",
    await getKey(secret),
    encoder.encode(body),
  );
  return `${body}.${toBase64Url(new Uint8Array(tag))}`;
}

/** The payload of a value made by {@link signValue}, or `null` if it was tampered with. */
export async function verifyValue(value: string, secret: string) {
  const [body, tag, ...rest] = value.split(".");
  if (!body || !tag || rest.length) return null;

  try {
    const isValid = await crypto.subtle.verify(
      "HMAC",
      await getKey(secret),
      Uint8Array.fromBase64(tag, { alphabet: "base64url" }),
      encoder.encode(body),
    );
    if (!isValid) return null;

    return decoder.decode(
      Uint8Array.fromBase64(body, { alphabet: "base64url" }),
    );
  } catch {
    return null;
  }
}
