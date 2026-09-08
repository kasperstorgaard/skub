/**
 * Disk access for the `static/tiles/` catalog. Server-side only; the shapes it
 * reads and writes live in `game/tiles.ts`.
 */
import { formatTile, nextTileId, parseTile } from "#/game/tiles.ts";
import type { TileCategory, TileEntry } from "#/game/types.ts";

export const TILES_DIR = "static/tiles";

const tilePath = (id: string): string => `${TILES_DIR}/${id}.md`;

/** Every tile in the catalog, id-sorted. An empty catalog yields none. */
export async function readTiles(): Promise<TileEntry[]> {
  const files = await tileFiles();

  return await Promise.all(files.map(async (file) => {
    return parseTile(await Deno.readTextFile(`${TILES_DIR}/${file}`));
  }));
}

/** Reads one tile, or null when the catalog has no such id. */
export async function readTile(id: string): Promise<TileEntry | null> {
  try {
    return parseTile(await Deno.readTextFile(tilePath(id)));
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return null;
    throw err;
  }
}

/**
 * Writes a tile, creating the catalog if needed. An unchanged tile is left
 * alone rather than rewritten.
 */
export async function writeTile(entry: TileEntry): Promise<void> {
  const path = tilePath(entry.id);
  const markdown = formatTile(entry);
  const current = await Deno.readTextFile(path).catch(() => null);
  if (current === markdown) return;

  await Deno.mkdir(TILES_DIR, { recursive: true });
  await Deno.writeTextFile(path, markdown);
}

/** The id a newly saved tile of this category takes. */
export async function nextId(category: TileCategory): Promise<string> {
  const taken = (await tileFiles()).map((file) => file.replace(/\.md$/, ""));

  return nextTileId(category, taken);
}

// Every `.md` in the catalog, name-sorted. A missing catalog yields none.
async function tileFiles(): Promise<string[]> {
  try {
    const entries = await Array.fromAsync(Deno.readDir(TILES_DIR));
    return entries
      .filter((entry) => entry.name.endsWith(".md"))
      .map((entry) => entry.name)
      .sort();
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return [];
    throw err;
  }
}

/** Drops a tile from the catalog, for one that has moved category. */
export async function removeTile(id: string): Promise<void> {
  await Deno.remove(tilePath(id)).catch((err) => {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  });
}
