/**
 * KV keys and values as JSON and back, keeping what JSON can't hold: dates,
 * big integers, bytes and KV's own 64-bit counters, each tagged.
 */
function encodeValue(value: unknown): unknown {
  if (value instanceof Date) return { $date: value.toISOString() };
  if (typeof value === "bigint") return { $bigint: value.toString() };
  if (value instanceof Uint8Array) {
    return { $bytes: btoa(String.fromCharCode(...value)) };
  }
  if (value instanceof Deno.KvU64) return { $u64: value.value.toString() };
  if (Array.isArray(value)) return value.map(encodeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, encodeValue(item)]),
    );
  }
  return value;
}

function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value && typeof value === "object") {
    const tagged = value as Record<string, string>;
    if ("$date" in tagged) return new Date(tagged.$date);
    if ("$bigint" in tagged) return BigInt(tagged.$bigint);
    if ("$bytes" in tagged) {
      return Uint8Array.from(atob(tagged.$bytes), (char) => char.charCodeAt(0));
    }
    if ("$u64" in tagged) return new Deno.KvU64(BigInt(tagged.$u64));
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, decodeValue(item)]),
    );
  }
  return value;
}

export type KvJsonEntry = { key: unknown[]; value: unknown };

/** One KV entry as a JSON-safe object. */
export function encodeEntry(entry: Deno.KvEntry<unknown>): KvJsonEntry {
  return {
    key: entry.key.map(encodeValue),
    value: encodeValue(entry.value),
  };
}

/** A KV entry back from {@link encodeEntry}. */
export function decodeEntry(
  entry: KvJsonEntry,
): { key: Deno.KvKey; value: unknown } {
  return {
    key: entry.key.map(decodeValue) as Deno.KvKey,
    value: decodeValue(entry.value),
  };
}
