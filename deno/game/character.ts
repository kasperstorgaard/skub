import type { Metrics } from "#/game/scoring.ts";

/**
 * Board character — the shorthand a curator would reach for when describing a
 * candidate at a glance ("wall-heavy", "minimalist", "one true path").
 *
 * The score readout answers "how good is this?" with eighteen numbers. This
 * answers "what kind of board is this?" with two or three words, so two
 * candidates can be told apart without reading the table. Purely derived from
 * `Metrics` — nothing here is stored, gated, or fed back into the composite;
 * change a threshold and every past candidate re-labels itself.
 */

export type CharacterTrait = {
  /** The word itself, lowercase — these read as tags, not headings. */
  label: string;
  /** Why the board earned it, for the tooltip. */
  hint: string;
};

type TraitRule = CharacterTrait & {
  /** Board-level context the rule needs beyond the metrics themselves. */
  applies: (metrics: Metrics, context: CharacterContext) => boolean;
};

export type CharacterContext = {
  minMoves: number;
  walls: number;
  blockers: number;
};

/**
 * Traits in priority order — the first few that match are what gets shown, so
 * the most distinguishing ones come first. Thresholds are eyeballed against the
 * labeled candidate store rather than derived; they exist to name a board, not
 * to judge it, so being approximately right is the whole requirement.
 */
const TRAITS: TraitRule[] = [
  {
    label: "one true path",
    hint: "A single distinct solution — no alternative route to find.",
    applies: (m) => m.uniqueSolutions === 1,
  },
  {
    label: "false variety",
    hint:
      "Several solutions, but they send the puck along the same path — only the setup order differs.",
    applies: (m) => m.uniqueSolutions > 1 && m.puckPathVariety <= 0.5,
  },
  {
    label: "slow start",
    hint: "The puck sits still while blockers are shuffled into place first.",
    applies: (m) => m.openingSetup >= 2,
  },
  {
    label: "setup-heavy",
    hint: "Most moves reposition blockers rather than the puck.",
    applies: (m) => m.setupRatio >= 0.6,
  },
  {
    label: "wall-heavy",
    hint: "Plenty of walls, and most of them actually stop a piece.",
    applies: (m, ctx) => ctx.walls >= 12 && m.wallUtilization >= 0.5,
  },
  {
    label: "decorative walls",
    hint: "Most of the board's walls never stop anything.",
    applies: (m, ctx) => ctx.walls >= 8 && m.wallUtilization < 0.3,
  },
  {
    label: "minimalist",
    hint: "Few walls and blockers — the difficulty comes from the geometry.",
    applies: (_m, ctx) => ctx.walls <= 6 && ctx.blockers <= 3,
  },
  {
    label: "reversal",
    hint: "A piece has to double back the way it came.",
    applies: (m) => m.reversals >= 2,
  },
  {
    label: "distance",
    hint: "Long slides — the pieces cover a lot of ground per move.",
    applies: (m, ctx) => m.totalDistance >= ctx.minMoves * 4,
  },
  {
    label: "deceptive",
    hint: "The puck has to travel away from the destination to get there.",
    applies: (m) => m.deception >= 4,
  },
  {
    label: "roomy",
    hint: "The action spreads across the board rather than huddling.",
    applies: (m) => m.deadSpace <= 0.5,
  },
  {
    label: "cramped",
    hint: "Most of the board is never touched.",
    applies: (m) => m.deadSpace >= 0.75,
  },
  {
    label: "clumped",
    hint: "Walls and blockers bunch together instead of spreading out.",
    applies: (m) => m.clumping >= 0.18,
  },
  {
    label: "idle blockers",
    hint: "A blocker gets moved and then never matters again.",
    applies: (m) => m.pointlessClearance >= 1,
  },
];

/** How many traits to show — enough to characterise, few enough to read. */
const MAX_TRAITS = 3;

/**
 * The board's character as up to three traits, most distinguishing first.
 * Returns an empty list for a board that's unremarkable on every axis, which is
 * itself worth seeing.
 */
export function boardCharacter(
  metrics: Metrics,
  context: CharacterContext,
): CharacterTrait[] {
  return TRAITS
    .filter((trait) => trait.applies(metrics, context))
    .slice(0, MAX_TRAITS)
    .map(({ label, hint }) => ({ label, hint }));
}
