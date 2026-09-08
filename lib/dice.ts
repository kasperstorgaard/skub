import type { Position } from "#/game/types.ts";

/** Which of the two dice a set of throws belongs to. */
export type Die = "puck" | "destination";

export type DiceThrows = {
  /** Every throw, misses included; the last is where the die comes to rest. */
  puck: Position[];
  destination: Position[];
  /** Distinguishes one roll from the next, so a re-roll starts over. */
  nonce: number;
};

/** How long a throw that missed holds the board before the next comes down. */
const THROW_MS = 190;
/** The beat the landing keeps, so a roll settles rather than stopping dead. */
const SETTLE_MS = 320;
/** The share of a throw's window the die spends coming down to size. */
const DROP_SHARE = 0.7;
/** How large a die is at the top of its drop. */
const DROP_SCALE = 1.12;
/** How far a throw that missed fades back — only the landing is solid. */
const MISS_OPACITY = 0.4;

export function diceName(die: Die, nonce: number) {
  return `dice-${die}-${nonce}`;
}

export function diceDuration(thrown: Position[]) {
  return Math.max(thrown.length - 1, 0) * THROW_MS + SETTLE_MS;
}

function percent(value: number) {
  return Number(value.toFixed(2));
}

/**
 * Keyframes for a die coming down: it appears on every cell it was thrown at,
 * misses included, and keeps the last one.
 *
 * Position steps rather than glides — a die lands on a cell, it does not travel
 * to it — which also keeps --x whole at every frame, and the destination places
 * itself on grid lines a fraction would invalidate. A miss stays faded, so what
 * a roll leaves behind reads as where it came to rest rather than a strobe.
 */
export function buildDiceKeyframes(
  die: Die,
  thrown: Position[],
  nonce: number,
): string {
  const name = diceName(die, nonce);
  const total = diceDuration(thrown);
  const at = (index: number) => percent((index * THROW_MS / total) * 100);

  const windows = thrown.map((position, index) => ({
    position,
    start: at(index),
    // The last throw holds the settle beat, not another throw's width.
    width: (index === thrown.length - 1 ? 100 : at(index + 1)) - at(index),
  }));

  const landed = thrown[thrown.length - 1];

  return [
    `@keyframes ${name} {`,
    ...windows.map(({ position, start }) =>
      `${start}% { --x: ${position.x}; --y: ${position.y}; animation-timing-function: steps(1, end); }`
    ),
    `100% { --x: ${landed.x}; --y: ${landed.y}; }`,
    "}",
    `@keyframes ${name}-drop {`,
    ...windows.flatMap(({ start, width }, index) => [
      `${start}% { scale: ${DROP_SCALE}; opacity: ${MISS_OPACITY}; animation-timing-function: ease-out; }`,
      `${percent(start + width * DROP_SHARE)}% { scale: 1; opacity: ${
        index === windows.length - 1 ? 1 : MISS_OPACITY
      }; animation-timing-function: steps(1, end); }`,
    ]),
    "100% { scale: 1; opacity: 1; }",
    "}",
  ].join("");
}
