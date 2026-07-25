/**
 * Nordic name pool for auto-naming generated candidates, matching the corpus
 * convention of naming puzzles after people (erik, malene, torstein…). Loaded
 * from `nordic-names.json` and cached. Server-only (read from disk); never
 * imported into an island.
 */

// Resolve from cwd — always the project root locally and on Deno Deploy.
const NAMES_PATH = `${Deno.cwd()}/game/nordic-names.json`;

let namesCache: string[] | null = null;

/** The curated Nordic name pool, read once and cached. */
export function getNordicNames(): string[] {
  if (namesCache) return namesCache;
  namesCache = JSON.parse(Deno.readTextFileSync(NAMES_PATH));
  return namesCache!;
}

/**
 * Picks a random pool name not present in `used` (case-insensitive), so a
 * generated candidate never collides with an existing static or generated
 * puzzle. When the pool is exhausted (every stored candidate retires a name),
 * falls back to suffixing a random base name with the lowest free ordinal
 * (`Hans-2`, `Hans-3`, …) — generation never runs out of names.
 */
export function pickUnusedName(used: Set<string>): string {
  const usedLower = new Set([...used].map((name) => name.toLowerCase()));
  const pool = getNordicNames();

  const available = pool.filter((name) => !usedLower.has(name.toLowerCase()));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }

  const base = pool[Math.floor(Math.random() * pool.length)];
  for (let ordinal = 2;; ordinal++) {
    const suffixed = `${base}-${ordinal}`;
    if (!usedLower.has(suffixed.toLowerCase())) return suffixed;
  }
}
