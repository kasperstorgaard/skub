import { extractYaml } from "@std/front-matter";
import { stringify as stringifyYaml } from "@std/yaml";

import {
  flipBoard,
  isPositionSame,
  rotateBoard,
  validatePositions,
  validateWalls,
} from "#/game/board.ts";
import { formatGridBody, formatGridBorder } from "#/game/formatter.ts";
import { extractRows, parseGrid } from "#/game/parser.ts";
import type {
  Board,
  Piece,
  Position,
  Rotation,
  Tile,
  TileCategory,
  TileEntry,
  TilePlacement,
  Wall,
} from "#/game/types.ts";

/** A tile is a quarter of the board, so four of them make one. */
export const TILE_SIZE = 4;

/** Three is what the sketchbook allows; more and a tile stops being readable. */
export const MAX_TILE_BLOCKERS = 3;

/**
 * Where each dealt tile lands, in the order tiles are dealt: NW, NE, SW, SE.
 */
export const QUADRANT_ORIGINS: Position[] = [
  { x: 0, y: 0 },
  { x: TILE_SIZE, y: 0 },
  { x: 0, y: TILE_SIZE },
  { x: TILE_SIZE, y: TILE_SIZE },
];

/**
 * A tile with no hazards is `A` from this much open running out of eight, and
 * `B` below it. Set against the sketchbook: 2.5 still reads as simple, 2 reads
 * as cluttered — so most of a tile can be closed off before it stops being an
 * easy one to cross.
 */
const OPEN_LANES_MIN = 2.5;

/**
 * Generator algorithm version, stamped onto every stored candidate so the
 * curation set records which generator produced a board. Semver: patch =
 * behaviour-preserving fixes, minor = additive knobs/defaults, major =
 * changes that alter the candidate distribution, so feedback buckets aren't
 * comparable across the bump.
 * 1.0.0 is the move from random wall placement to composed tiles.
 */
export const GENERATOR_VERSION = "1.0.0";

export class TileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TileError";
  }
}

/**
 * Validates a tile, returning it sanitized.
 *
 * The edge rule — never a wall along a tile's own boundary — needs no check of
 * its own: a wall sits on the cell it blocks entry into, so an edge wall is
 * either at 0 (rejected as an edge duplicate) or out of bounds at the far side.
 * Running the board's own checks at tile size is the whole rule.
 */
export function validateTile(tile: Board): Tile {
  if (tile.destination) throw new TileError("Tile has a destination");

  const pieces: Piece[] = [];
  for (const piece of tile.pieces ?? []) {
    if (piece.type === "puck") throw new TileError("Tile has a puck");

    if (pieces.some((checked) => isPositionSame(checked, piece))) {
      throw new TileError(`Duplicate blocker at (${piece.x}, ${piece.y})`);
    }

    pieces.push(piece);
  }

  if (pieces.length > MAX_TILE_BLOCKERS) {
    throw new TileError(
      `Tile has ${pieces.length} blockers, at most ${MAX_TILE_BLOCKERS} allowed`,
    );
  }

  const walls = validateWalls(tile.walls ?? [], TILE_SIZE);
  const holes = validatePositions(tile.holes ?? [], "Hole", TILE_SIZE);
  const portals = validatePositions(tile.portals ?? [], "Portal", TILE_SIZE);

  // Portals pair up across the board, so a tile carries at most one of a pair.
  if (portals.length > 1) throw new TileError("Tile has more than one portal");

  for (const hazard of [...holes, ...portals]) {
    const at = `(${hazard.x}, ${hazard.y})`;

    if (
      holes.some((hole) => isPositionSame(hole, hazard)) &&
      portals.some((portal) => isPositionSame(portal, hazard))
    ) {
      throw new TileError(`Hole and portal share ${at}`);
    }

    if (pieces.some((piece) => isPositionSame(piece, hazard))) {
      throw new TileError(`Blocker stands on a hole or portal at ${at}`);
    }
  }

  return { pieces, walls, holes, portals, destination: undefined };
}

/**
 * How much of the tile a piece can slide straight through, out of eight.
 *
 * A clear row or column scores 1 and a walled one scores 0. One held up only by
 * a blocker scores 0.5: a blocker stops a piece without shaping the path the way
 * a wall does. Hazards score 0 — a hole or portal ends the run outright.
 */
export function countLanes(tile: Tile): number {
  const hazards = [...tile.holes, ...tile.portals];

  let lanes = 0;

  for (let index = 0; index < TILE_SIZE; index++) {
    for (const axis of ["row", "column"] as const) {
      const along = (position: Position) =>
        axis === "row" ? position.y === index : position.x === index;

      // A wall crosses the run when it stands perpendicular to it, anywhere but
      // on the tile's own edge.
      const crossed = tile.walls.some((wall) =>
        wall.orientation === (axis === "row" ? "vertical" : "horizontal") &&
        along(wall) && between(wall, axis)
      );
      if (crossed || hazards.some(along)) continue;

      lanes += tile.pieces.some(along) ? 0.5 : 1;
    }
  }

  return lanes;
}

// Whether a wall stands inside the tile rather than along the edge it parallels.
function between(wall: Wall, axis: "row" | "column") {
  const offset = axis === "row" ? wall.x : wall.y;
  return offset > 0 && offset < TILE_SIZE;
}

/**
 * Reads a tile's category off its contents.
 *
 * Hazards settle it outright. Without them it is the simple-versus-cluttered
 * call, which openness stands in for.
 */
export function categorizeTile(tile: Tile): TileCategory {
  const hasPortal = tile.portals.length > 0;
  const hasHole = tile.holes.length > 0;

  if (hasPortal && hasHole) return "Z";
  if (hasPortal) return "P";
  if (hasHole) return "X";

  return countLanes(tile) >= OPEN_LANES_MIN ? "A" : "B";
}

/** The next free number in a category, matching the sketchbook's own runs. */
export function nextTileId(category: TileCategory, taken: string[]): string {
  const prefix = category.toLowerCase();
  const matcher = new RegExp(`^${prefix}-(\\d+)$`);

  const highest = taken.reduce((max, id) => {
    const number = Number(id.match(matcher)?.[1]);
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);

  return `${prefix}-${String(highest + 1).padStart(2, "0")}`;
}

/** Turns a tile a quarter-turn clockwise, `rotation` times. */
export function rotateTile(tile: Tile, rotation: Rotation): Tile {
  let turned = tile;

  for (let turn = 0; turn < rotation; turn++) {
    turned = rotateBoard(turned, "right", { size: TILE_SIZE });
  }

  return turned;
}

/** Mirrors a tile. One axis is enough — the other is a flip plus a half-turn. */
export function flipTile(
  tile: Tile,
  axis: "horizontal" | "vertical" = "horizontal",
): Tile {
  return flipBoard(tile, axis, { size: TILE_SIZE });
}

/** Shifts a tile's contents into board space at the given quadrant origin. */
export function placeTile(tile: Tile, origin: Position): Board {
  const shift = <TItem extends Position>(item: TItem): TItem => ({
    ...item,
    x: item.x + origin.x,
    y: item.y + origin.y,
  });

  return {
    destination: undefined,
    pieces: tile.pieces.map(shift),
    walls: tile.walls.map(shift),
    holes: tile.holes.map(shift),
    portals: tile.portals.map(shift),
  };
}

/**
 * Lifts one quadrant back out of a board, in tile coordinates.
 *
 * The inverse of `placeTile`, so a quadrant can be rotated or swapped in place.
 * Puck and destination are left behind: they belong to the composed board, not
 * to any tile.
 */
export function extractQuadrant(board: Board, origin: Position): Tile {
  const within = (position: Position) =>
    position.x >= origin.x && position.x < origin.x + TILE_SIZE &&
    position.y >= origin.y && position.y < origin.y + TILE_SIZE;

  const unshift = <TItem extends Position>(item: TItem): TItem => ({
    ...item,
    x: item.x - origin.x,
    y: item.y - origin.y,
  });

  return {
    destination: undefined,
    pieces: board.pieces.filter((piece) =>
      piece.type === "blocker" && within(piece)
    ).map(unshift),
    walls: board.walls.filter((wall) => isWallWithin(wall, origin)).map(
      unshift,
    ),
    holes: board.holes.filter(within).map(unshift),
    portals: board.portals.filter(within).map(unshift),
  };
}

/**
 * Whether a wall lies inside a quadrant rather than on the seam beside it.
 *
 * A wall stands between two cells, so it belongs to the quadrant only when both
 * of those cells do.
 */
function isWallWithin(wall: Wall, origin: Position) {
  const low = wall.orientation === "vertical"
    ? { x: wall.x - 1, y: wall.y }
    : { x: wall.x, y: wall.y - 1 };

  return [low, wall].every((cell) =>
    cell.x >= origin.x && cell.x < origin.x + TILE_SIZE &&
    cell.y >= origin.y && cell.y < origin.y + TILE_SIZE
  );
}

/**
 * Puts a tile into one quadrant of a board, replacing what stood there.
 *
 * Puck and destination survive: rotating the scenery underneath them is a
 * layout decision, and where they sit was a separate roll.
 */
export function replaceQuadrant(
  board: Board,
  tile: Tile,
  origin: Position,
): Board {
  const placed = placeTile(tile, origin);

  const within = (position: Position) =>
    position.x >= origin.x && position.x < origin.x + TILE_SIZE &&
    position.y >= origin.y && position.y < origin.y + TILE_SIZE;

  return {
    destination: board.destination,
    pieces: [
      ...board.pieces.filter((piece) =>
        piece.type === "puck" || !within(piece)
      ),
      ...placed.pieces,
    ],
    walls: [
      ...board.walls.filter((wall) => !isWallWithin(wall, origin)),
      ...placed.walls,
    ],
    holes: [...board.holes.filter((hole) => !within(hole)), ...placed.holes],
    portals: [
      ...board.portals.filter((portal) => !within(portal)),
      ...placed.portals,
    ],
  };
}

/**
 * Composes four tiles into a board, in quadrant order NW, NE, SW, SE.
 *
 * No seam handling: a tile may never carry a wall on its own edge, so the walls
 * of two neighbours can never meet, and composing is a pure coordinate shift.
 */
export function composeBoard(tiles: Tile[]): Board {
  if (tiles.length !== QUADRANT_ORIGINS.length) {
    throw new TileError(`A board takes ${QUADRANT_ORIGINS.length} tiles`);
  }

  const placed = tiles.map((tile, index) =>
    placeTile(tile, QUADRANT_ORIGINS[index])
  );

  return {
    destination: undefined,
    pieces: placed.flatMap((board) => board.pieces),
    walls: placed.flatMap((board) => board.walls),
    holes: placed.flatMap((board) => board.holes),
    portals: placed.flatMap((board) => board.portals),
  };
}

/** Parses a tile file. The category is derived, so frontmatter must agree. */
export function parseTile(content: string): TileEntry {
  const { attrs, body } = extractYaml<Partial<Omit<TileEntry, "tile">>>(
    content,
  );

  if (!attrs.id) throw new TileError("Tile must include an 'id'");

  const rows = extractRows(body);
  if (rows.length !== TILE_SIZE) {
    throw new TileError(
      `Tile ${attrs.id} has ${rows.length} rows, expected ${TILE_SIZE}`,
    );
  }

  const tile = validateTile(parseGrid(rows, TILE_SIZE));
  const category = categorizeTile(tile);

  if (attrs.category && attrs.category !== category) {
    throw new TileError(
      `Tile ${attrs.id} is filed as ${attrs.category} but reads as ${category}`,
    );
  }

  return { id: attrs.id, name: attrs.name, category, tile };
}

/** Renders a tile file, grid and all. */
export function formatTile({ id, name, category, tile }: TileEntry): string {
  const metadata = name ? { id, name, category } : { id, category };
  const { header, footer } = formatGridBorder(TILE_SIZE);

  return [
    "---",
    stringifyYaml(metadata).trim(),
    "---",
    "",
    "```",
    header,
    formatGridBody(tile, TILE_SIZE).trimEnd(),
    footer,
    "```",
    "",
  ].join("\n");
}

/** What the picker was asked for. */
export type DealConfig = {
  mode: "pattern" | "random";
  /** Four category codes, one per quadrant. Used when mode is "pattern". */
  pattern?: TileCategory[];
  /** Whether a random deal should include a portal pair, or holes. */
  portals?: boolean;
  holes?: boolean;
  /**
   * How many different tiles the four quadrants draw on, 1 to 4. Four is all
   * unique; one is the same tile in every quadrant. A repeated tile still gets
   * its own rotation per quadrant, so fewer distinct tiles reads as symmetry
   * rather than as copy-paste.
   *
   * Raised to the number of categories the pattern asks for when it has to be —
   * an `ABPZ` pattern can't be dealt from fewer than four tiles.
   */
  distinct?: number;
};

/** A dealt tile: which entry, turned and mirrored how. */
export type DealtTile = {
  entry: TileEntry;
  rotation: Rotation;
  flipped: boolean;
};

/** Tiles carrying one half of a portal pair. */
const PORTAL_CATEGORIES: TileCategory[] = ["P", "Z"];

/**
 * Checks a pattern can make a legal board.
 *
 * A `P` or `Z` tile carries exactly one portal and a board takes none or a pair,
 * so the count of them has to be 0 or 2.
 */
export function validatePattern(pattern: TileCategory[]): TileCategory[] {
  if (pattern.length !== QUADRANT_ORIGINS.length) {
    throw new TileError(
      `A pattern takes ${QUADRANT_ORIGINS.length} categories`,
    );
  }

  const portals =
    pattern.filter((code) => PORTAL_CATEGORIES.includes(code)).length;

  if (portals !== 0 && portals !== 2) {
    throw new TileError(
      `A board needs no portals or a pair, this pattern has ${portals}`,
    );
  }

  return pattern;
}

/**
 * Deals four tiles from the catalog.
 *
 * Random mode builds a pattern first and then deals it, so both modes go through
 * the same portal-parity guarantee.
 */
export function pickTiles(
  catalog: TileEntry[],
  config: DealConfig,
  { random = Math.random }: { random?: () => number } = {},
): DealtTile[] {
  const pattern = validatePattern(
    config.mode === "pattern" && config.pattern
      ? config.pattern
      : randomPattern(config, random),
  );

  const drawn = drawTiles(
    catalog,
    pattern,
    config.distinct ?? pattern.length,
    random,
  );

  const dealt = new Map<TileCategory, number>();

  return pattern.map((category) => {
    const options = drawn.get(category) ?? [];
    const index = dealt.get(category) ?? 0;
    dealt.set(category, index + 1);

    return {
      entry: options[index % options.length],
      rotation: Math.floor(random() * 4) as Rotation,
      flipped: random() < 0.5,
    };
  });
}

/**
 * Draws the tiles a pattern needs, honouring how many distinct ones were asked
 * for.
 *
 * Every category needs at least one tile of its own, so that floor decides the
 * real minimum; any remaining distinct tiles go to the categories with room for
 * them, in pattern order.
 */
function drawTiles(
  catalog: TileEntry[],
  pattern: TileCategory[],
  distinct: number,
  random: () => number,
) {
  const slots = new Map<TileCategory, number>();
  for (const category of pattern) {
    slots.set(category, (slots.get(category) ?? 0) + 1);
  }

  const wanted = new Map([...slots.keys()].map((category) => [category, 1]));
  let total = wanted.size;

  while (total < Math.min(distinct, pattern.length)) {
    const room = [...slots].find(([category, count]) =>
      (wanted.get(category) ?? 0) < count
    );
    if (!room) break;

    wanted.set(room[0], (wanted.get(room[0]) ?? 0) + 1);
    total++;
  }

  const drawn = new Map<TileCategory, TileEntry[]>();

  for (const [category, count] of wanted) {
    const available = catalog.filter((entry) => entry.category === category);
    if (!available.length) {
      throw new TileError(`No ${category} tiles in the catalog yet`);
    }

    const picked: TileEntry[] = [];
    for (let draw = 0; draw < count; draw++) {
      // Repeat a tile only when the category can't cover the slots asked of it.
      const fresh = available.filter((entry) => !picked.includes(entry));
      picked.push(pick(fresh.length ? fresh : available, random));
    }

    drawn.set(category, picked);
  }

  return drawn;
}

// Builds a pattern from loose constraints rather than exact categories.
function randomPattern(config: DealConfig, random: () => number) {
  const pattern: TileCategory[] = Array.from(
    { length: QUADRANT_ORIGINS.length },
    () => random() < 0.5 ? "A" : "B",
  );

  const slots = shuffled([0, 1, 2, 3], random);

  if (config.portals) {
    // A Z tile is a portal that also carries holes, so it covers both asks.
    const code: TileCategory = config.holes ? "Z" : "P";
    pattern[slots.pop() as number] = code;
    pattern[slots.pop() as number] = code;
  }

  if (config.holes && !pattern.includes("Z")) {
    pattern[slots.pop() as number] = "X";
  }

  return pattern;
}

function pick<TItem>(items: TItem[], random: () => number): TItem {
  return items[Math.floor(random() * items.length)];
}

function shuffled<TItem>(items: TItem[], random: () => number): TItem[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }

  return copy;
}

/** The board four dealt tiles make, with each tile turned as dealt. */
export function composeDealt(dealt: DealtTile[]): Board {
  return composeBoard(dealt.map(toTile));
}

/** How a dealt tile sits, once turned and mirrored. */
export function toTile({ entry, rotation, flipped }: DealtTile): Tile {
  return rotateTile(flipped ? flipTile(entry.tile) : entry.tile, rotation);
}

/** The provenance record for a dealt board. */
export function toPlacements(dealt: DealtTile[]): TilePlacement[] {
  return dealt.map(({ entry, rotation, flipped }) => ({
    id: entry.id,
    rotation,
    ...(flipped ? { flipped } : {}),
  }));
}

/** Where the composer's settings persist, and for how long. */
export const TILE_OPTIONS_COOKIE = "tile_options";
export const TILE_OPTIONS_MAX_AGE = 60 * 60 * 24 * 365;

/** What the composer's sidebar holds: how to deal, and what a roll may return. */
export type ComposerConfig = DealConfig & {
  /** Accepted move count for a roll. Absent takes whatever the dice give. */
  moves?: [number, number];
};

/**
 * Placements as one URL parameter — `a-01:1,b-02:3f` — so a composed board can
 * carry what it was dealt from through to the candidate it becomes. The `f`
 * suffix marks a mirrored tile.
 */
export function encodePlacements(placements: TilePlacement[]): string {
  return placements
    .map(({ id, rotation, flipped }) =>
      `${id}:${rotation}${flipped ? "f" : ""}`
    )
    .join(",");
}

/** Reads back `encodePlacements`. Anything malformed is dropped. */
export function decodePlacements(value: string): TilePlacement[] {
  return value.split(",").flatMap((part) => {
    const [id, turn] = part.split(":");
    const rotation = Number(turn?.replace("f", ""));

    if (!id || !Number.isInteger(rotation) || rotation < 0 || rotation > 3) {
      return [];
    }

    return [{
      id,
      rotation: rotation as Rotation,
      ...(turn.endsWith("f") ? { flipped: true } : {}),
    }];
  });
}
