import { type Signal, useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback, useEffect, useRef } from "preact/hooks";

import { candidate } from "#/client/generator-signals.ts";
import { useGenerateStream } from "#/client/use-generate-stream.ts";
import {
  CaretRight,
  Eye,
  Icon,
  Pencil,
  Play,
  Repeat,
  Shuffle,
  X,
} from "#/components/icons.tsx";
import { NumberRange } from "#/components/number-range.tsx";
import { Panel } from "#/components/panel.tsx";
import { RangeSlider } from "#/components/range-slider.tsx";
import { Select } from "#/components/select.tsx";
import { boardCharacter, type CharacterTrait } from "#/game/character.ts";
import { formatPuzzle } from "#/game/formatter.ts";
import {
  formatGenerated,
  type GenOptions,
  SOLUTION_TAGS,
  type SolutionTag,
  type StoredCandidate,
  type StoredScoring,
  toStoredScoring,
} from "#/game/generated.ts";
import { GENERATOR_VERSION, type WallSpread } from "#/game/generator.ts";
import { meanMetrics, METRIC_CATALOG } from "#/game/metric-catalog.ts";
import {
  difficultyForMoves,
  type Metrics,
  MOVE_TARGETS,
} from "#/game/scoring.ts";
import type { Puzzle } from "#/game/types.ts";
import { useRouter } from "#/islands/router.tsx";

type GeneratorPanelProps = {
  puzzle: Signal<Puzzle>;
  /** Board mode — `replay` while the URL names a solution to watch. */
  mode: Signal<"readonly" | "replay">;
  /** Persisted knob values (from the generator_options cookie), server-read. */
  initialOptions?: Partial<GenOptions>;
  /** The restored stored candidate the page loaded with, if any. */
  initialCandidate?: StoredCandidate;
  /** That candidate's scores and metrics, read back from its store file. */
  initialScoring?: StoredScoring;
  /** Index of the solution the URL is replaying, if any. */
  initialSolution?: number;
};

const SPREAD_OPTIONS: { value: WallSpread; label: string }[] = [
  { value: "mid", label: "Mid" },
  { value: "balanced", label: "Balanced" },
  { value: "spread", label: "Spread" },
];

/** One label/value row in the generated-candidate score readout. */
function ScoreStat(
  { label, value, hint, percent, whole }: {
    label: string;
    value: number;
    hint?: string;
    percent?: boolean;
    whole?: boolean;
  },
) {
  const display = percent
    ? `${Math.round(value * 100)}%`
    : whole
    ? String(value)
    : value.toFixed(2);

  return (
    <div
      className="flex justify-between gap-fl-1 py-1"
      title={hint ? `${label} — ${hint}` : undefined}
    >
      <dt className={clsx("text-text-2", hint && "cursor-help")}>{label}</dt>
      <dd className="text-text-1 font-weight-7 tabular-nums">{display}</dd>
    </div>
  );
}

/** Headline metric, shown above the fold rather than in the details list. */
const HEADLINE_METRIC = "uniqueSolutions";

/**
 * Draws the move count for one run, uniformly across `MOVE_TARGETS`. Uniform
 * over the range rather than over what the generator finds easily — random
 * layouts skew short, so sampling by frequency would bury the 9s and 10s.
 */
const pickTarget = (): number =>
  MOVE_TARGETS[Math.floor(Math.random() * MOVE_TARGETS.length)];

/** The metric rows for one scope, in catalog order. */
function MetricRows(
  { metrics, scope }: { metrics: Metrics; scope: "board" | "route" },
) {
  return (
    <>
      {METRIC_CATALOG
        .filter((spec) =>
          spec.scope === scope &&
          !(scope === "board" && spec.key === HEADLINE_METRIC)
        )
        .map((spec) => (
          <ScoreStat
            key={spec.key}
            label={spec.label}
            value={metrics[spec.key]}
            hint={spec.hint}
            percent={"percent" in spec ? spec.percent : undefined}
            whole={"whole" in spec ? spec.whole : undefined}
          />
        ))}
    </>
  );
}

/**
 * The advisory score for a generated candidate: a headline (composite score,
 * weakest route, solution count) over a collapsible breakdown of every metric.
 *
 * The breakdown is split by what a number is actually about. Board metrics — the
 * layout, the solution set, the search space — are the same whichever route you
 * take, so they're stated once. Route metrics belong to a single solution: with
 * one selected they show that solution's values, and with none they show the
 * mean across routes, which is what "the board's setup ratio" can honestly mean.
 * (The composite reduces them differently again — `max` for signals, `min` for
 * penalties — because it asks what the best or worst route offers, not what a
 * typical one looks like.)
 *
 * Rows come from `METRIC_CATALOG`, so the panel can never drift out of sync with
 * the metrics the reports and calibration tooling measure.
 */
function CandidateScore(
  { scoring, selected }: {
    scoring: StoredScoring;
    selected: number | null;
  },
) {
  const route = selected === null ? null : scoring.solutions[selected];
  const routeMetrics = route?.metrics ??
    meanMetrics(scoring.solutions.map((solution) => solution.metrics));

  return (
    <div className="flex flex-col gap-fl-1 text-1">
      <dl className="flex flex-col">
        <ScoreStat
          label="Score"
          value={scoring.score}
          hint="Advisory composite quality score — the mean across routes."
        />
        <ScoreStat
          label="Weakest route"
          value={scoring.min}
          hint="Score of the worst single solution route — an outlier detector."
        />
        <ScoreStat
          label="Solutions"
          value={scoring.metrics[HEADLINE_METRIC]}
          whole
          hint="Number of distinct optimal solutions."
        />
      </dl>

      {
        /* `group-open:mb-0` drops normalize's `details[open] > summary` margin,
          which would otherwise show a surface-2 seam between bar and content. */
      }
      <details className="group p-0 bg-none">
        <summary className="flex items-center gap-1 list-none bg-surface-3 cursor-pointer -mx-5 px-5 rounded-none group-open:mb-0">
          <Icon
            icon={CaretRight}
            className="transition-transform group-open:rotate-90"
          />
          Details
        </summary>

        <div className="flex flex-col bg-surface-3 -mx-5 px-5 pb-2">
          <p className="text-fl-0 text-text-3 uppercase tracking-wider mt-1">
            Board
          </p>
          <dl className="flex flex-col">
            <ScoreStat
              label="Mean"
              value={scoring.mean}
              hint="Mean route score across the distinct solutions."
            />
            <ScoreStat
              label="Std dev"
              value={scoring.stddev}
              hint="Spread of route scores across solutions."
            />
            <MetricRows metrics={scoring.metrics} scope="board" />
          </dl>

          <p className="text-fl-0 text-text-3 uppercase tracking-wider mt-fl-1">
            {route
              ? `Solution ${selected! + 1} · ${route.score.toFixed(2)}`
              : "Solutions · mean"}
          </p>
          <dl className="flex flex-col">
            <MetricRows metrics={routeMetrics} scope="route" />
          </dl>
        </div>
      </details>
    </div>
  );
}

/**
 * The board's character as tags — what kind of board, not how good. Styled
 * uniformly: colouring by virtue implied a claim the thresholds never earned.
 */
function BoardCharacter({ traits }: { traits: CharacterTrait[] }) {
  if (!traits.length) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {traits.map((trait) => (
        <span
          key={trait.label}
          title={trait.hint}
          className={clsx(
            "text-fl-0 rounded-1 px-fl-1 py-1 cursor-help leading-none",
            "bg-surface-1 text-text-2",
          )}
        >
          {trait.label}
        </span>
      ))}
    </div>
  );
}

/** How many routes to list — enough to compare, few enough to click through. */
const MAX_LISTED_SOLUTIONS = 8;

/**
 * The page URL for one solution: selected, and playing. The moves plus
 * `mode=replay`, the same contract the solution replay page renders under —
 * the stored move encoding is already the URL's, so a route travels from the
 * store to the board as-is.
 */
function watchHref(scoring: StoredScoring, index: number): string {
  const params = new URLSearchParams({
    moves: scoring.solutions[index].moves,
    mode: "replay",
    solution: String(index),
  });
  return `/puzzles/new?${params}`;
}

/**
 * One link per distinct solution, weakest route first — a board is only as good
 * as its weakest interesting route, so that's the one to look at first.
 *
 * Picking a route plays it. Watching is the first thing anyone does with a
 * selected solution, and the numbers only mean something next to the animation
 * that produced them, so the click that selects is the click that replays.
 *
 * Links, not buttons: the selection lives in the URL, so a route can be
 * reloaded, shared or stepped back to, and the page load is what restarts the
 * animation.
 */
function SolutionList(
  { scoring, selected }: { scoring: StoredScoring; selected: number | null },
) {
  // Weakest first, and a stable order across renders (`toSorted` copies, so the
  // stored order — which the URL indexes into — is left alone).
  const ranked = scoring.solutions
    .map((solution, index) => ({ ...solution, index }))
    .toSorted((a, b) => a.score - b.score);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-fl-0 text-text-2">
        Solutions{ranked.length > MAX_LISTED_SOLUTIONS &&
          ` (${MAX_LISTED_SOLUTIONS} of ${ranked.length})`}
      </span>

      <div className="flex flex-wrap gap-1">
        {ranked.slice(0, MAX_LISTED_SOLUTIONS).map((route) => (
          <a
            key={route.index}
            href={watchHref(scoring, route.index)}
            aria-current={selected === route.index ? "true" : undefined}
            title={`Watch solution ${route.index + 1} — score ${
              route.score.toFixed(2)
            }`}
            className={clsx(
              "text-fl-0 rounded-1 px-fl-1 py-1 no-underline tabular-nums",
              selected === route.index
                ? "bg-brand text-surface-1 font-weight-7"
                : "bg-surface-1 text-text-2 hover:bg-surface-3",
            )}
          >
            {route.score.toFixed(2)}
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * Everything about the one solution the URL has selected: what kind of route it
 * is, the tags the curator puts on it, and the link that plays it again (the
 * same URL, so re-clicking restarts the animation — as the solution replay
 * page's own "Watch again" does).
 *
 * The tags are the round's point — the board's star rating is a verdict on the
 * whole puzzle, and these are what say *which* route made it that. Applied to
 * the selected route only: a tag is a judgement, and judging a route you
 * haven't watched isn't one.
 */
function SolutionDetail(
  { scoring, index, traits, tags, onToggleTag }: {
    scoring: StoredScoring;
    index: number;
    traits: CharacterTrait[];
    tags: SolutionTag[];
    onToggleTag: (tag: SolutionTag) => void;
  },
) {
  const route = scoring.solutions[index];

  return (
    <div className="flex flex-col gap-fl-1">
      <p className="flex justify-between gap-fl-1 text-1 leading-tight">
        <span className="text-text-2">Solution {index + 1}</span>
        <span className="text-text-1 font-weight-7 tabular-nums">
          {route.score.toFixed(2)}
        </span>
      </p>

      <BoardCharacter traits={traits} />

      <div className="flex flex-wrap gap-1">
        {SOLUTION_TAGS.map((tag) => {
          const active = tags.includes(tag.value);
          return (
            <button
              key={tag.value}
              type="button"
              aria-pressed={active}
              className={clsx(
                "text-fl-0 rounded-1 px-fl-1 py-1 cursor-pointer border-none",
                active
                  ? "bg-brand text-surface-1 font-weight-7"
                  : "bg-surface-1 text-text-2 hover:bg-surface-3",
              )}
              onClick={() => onToggleTag(tag.value)}
            >
              {tag.label}
            </button>
          );
        })}
      </div>

      <a href={watchHref(scoring, index)} className="btn">
        <Icon icon={Play} />
        Watch again
      </a>
    </div>
  );
}

/**
 * Side panel for the puzzle generator (`/puzzles/new`).
 * Runs the gated generation loop, previews the candidate read-only with its
 * advisory score, and hands a chosen candidate off to the editor
 * (`/puzzles/edit`) for naming, curation and saving.
 */
export function GeneratorPanel(
  {
    puzzle,
    mode,
    initialOptions = {},
    initialCandidate,
    initialScoring,
    initialSolution,
  }: GeneratorPanelProps,
) {
  const { updateLocation } = useRouter();

  // The move count this run is after, drawn fresh per run. Not a knob: picking
  // it by hand is what the difficulty select used to be, and the point of
  // dropping that was to stop the curator committing to a number up front.
  const targetMoves = useSignal(pickTarget());
  const wallsRange = useSignal<[number, number]>(
    initialOptions.wallsRange ?? [5, 15],
  );
  const blockersRange = useSignal<[number, number]>(
    initialOptions.blockersRange ?? [3, 5],
  );
  const wallSpread = useSignal<WallSpread>(
    initialOptions.wallSpread ?? "balanced",
  );
  // Default 0.5: every 4–5★ board in the first labeled set was generated at
  // symmetry ≥ 0.55, four of five 2★ boards at 0. Like all knob defaults it
  // only applies when no generator_options cookie exists — the curator's
  // last-used values (even an explicit 0) take precedence over defaults.
  const symmetry = useSignal(initialOptions.symmetry ?? 0.5); // 0..1
  const status = useSignal<
    "idle" | "running" | "preview" | "exhausted" | "error"
  >("idle");
  const attempts = useSignal(0);
  const message = useSignal("");
  // The candidate's full readout, in the same shape it's stored in — either
  // measured by the run just finished, or read back from the store file on a
  // page load. One shape for both paths, so nothing about the panel depends on
  // whether the board was generated a moment ago or two navigations back.
  const scoring = useSignal<StoredScoring | null>(initialScoring ?? null);
  // Which solution the URL is showing, and so which one the metrics and
  // character describe. Null until a route is picked.
  const selected = useSignal<number | null>(initialSolution ?? null);
  // The in-flight auto-save; the Edit/Preview handoff awaits it so the
  // server-assigned name/slug are on `puzzle` before the draft is stored.
  const savePromise = useRef<Promise<void> | null>(null);
  // Monotonic run counter — a save response is only applied if no newer run has
  // started since, so a slow save can't resurrect a rerolled-away candidate.
  const runId = useRef(0);

  // Resume the restored candidate: the board came in via page data, so seed
  // the shared candidate signal (shows the feedback UI, stored stars included)
  // and land directly in preview. Its scores came with it, so the readout and
  // the solution list are there too.
  useEffect(() => {
    if (!initialCandidate) return;
    candidate.value = initialCandidate;
    status.value = "preview";
  }, []);

  // Auto-persists the just-generated candidate to the `generated/` store and
  // shares its slug with the feedback island. Dev-only endpoint —
  // failures (e.g. production's read-only fs) leave `candidate` null so the
  // feedback UI simply doesn't appear.
  const saveGenerated = useCallback(async (generated: Puzzle, run: number) => {
    const genOptions: GenOptions = {
      wallsRange: wallsRange.value,
      blockersRange: blockersRange.value,
      wallSpread: wallSpread.value,
      symmetry: symmetry.value,
      targetMoves: targetMoves.value,
    };
    try {
      const res = await fetch("/api/generated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          markdown: formatGenerated({
            ...generated,
            genOptions,
            generatorVersion: GENERATOR_VERSION,
            scoring: scoring.value ?? undefined,
          }),
        }),
      });
      // A newer run started while this save was in flight — its result belongs
      // to a board the curator already rerolled away. Drop it.
      if (runId.current !== run) return;
      if (res.ok) {
        const saved = await res.json() as { slug: string; name: string };
        // One slug everywhere: the store file, feedback patches, and the draft
        // all use the name-derived slug (e.g. hans / hans.md).
        candidate.value = saved;
        puzzle.value = { ...puzzle.value, name: saved.name, slug: saved.slug };
      }
    } catch {
      // non-fatal — curation continues without a persisted candidate
    }
  }, []);

  const { start, cancel } = useGenerateStream((event) => {
    if (event.type === "progress") {
      attempts.value = event.attempts;
      return;
    }
    if (event.type === "result") {
      const generated: Puzzle = {
        ...puzzle.value,
        board: event.board,
        minMoves: event.minMoves,
        // A starting point, not a verdict — the curator's own difficulty call
        // comes after they've seen the board.
        difficulty: difficultyForMoves(event.minMoves),
      };
      puzzle.value = generated;
      scoring.value = toStoredScoring(event.scored, event.metrics);
      status.value = "preview";
      savePromise.current = saveGenerated(generated, runId.current);
      return;
    }
    if (event.type === "exhausted") {
      status.value = "exhausted";
      message.value =
        `No ${targetMoves.value}-move board cleared the gates in ${event.attempts} tries — try again for a new target.`;
      return;
    }
    status.value = "error";
    message.value = event.message;
  });

  // Tags for the selected route, as the store has them. Keyed by encoded moves
  // (not index) for the same reason the store is: a label follows its route.
  const tags = useSignal<Record<string, SolutionTag[]>>(
    initialCandidate?.solutionTags ?? {},
  );

  const onToggleTag = useCallback((tag: SolutionTag) => {
    const index = selected.value;
    const slug = candidate.value?.slug;
    const moves = index === null
      ? undefined
      : scoring.value?.solutions[index].moves;
    if (!slug || !moves) return;

    const current = tags.value[moves] ?? [];
    const next = current.includes(tag)
      ? current.filter((value) => value !== tag)
      : [...current, tag];
    tags.value = { ...tags.value, [moves]: next };

    // Its own action, not part of the board-level feedback patch: that one is a
    // full overwrite written by the other island, so folding route tags into it
    // would race the star rating.
    fetch("/api/generated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "solution", slug, moves, tags: next }),
    }).catch(() => {});
  }, []);

  const onGenerate = useCallback(() => {
    runId.current++; // invalidate any in-flight save from the previous run
    attempts.value = 0;
    message.value = "";
    status.value = "running";
    candidate.value = null; // drop the previous candidate's feedback form
    tags.value = {};
    // The URL still names the outgoing board's solution — it doesn't apply to
    // the incoming one. Clearing it through the router keeps the board's href
    // in step without a navigation.
    updateLocation("/puzzles/new", { replace: true });
    mode.value = "readonly";
    selected.value = null;
    // A fresh draw per run, so rerolling walks the range instead of hammering
    // one move count.
    targetMoves.value = pickTarget();
    start({
      wallsRange: wallsRange.value,
      blockersRange: blockersRange.value,
      wallSpread: wallSpread.value,
      symmetry: symmetry.value,
      targetMoves: targetMoves.value,
    });
  }, [start, updateLocation]);

  const onCancel = useCallback(() => {
    cancel();
    // Fall back to the previewed candidate if one exists (a cancelled reroll),
    // otherwise to the empty starting state.
    status.value = scoring.value ? "preview" : "idle";
  }, [cancel]);

  // The candidate only becomes a draft on demand — both handing off to the
  // editor and previewing store it first (overwriting any prior draft is fine).
  // Awaits the auto-save so the assigned name/slug are on `puzzle` first.
  const storeCandidate = useCallback(async () => {
    await savePromise.current;
    return fetch("/api/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: formatPuzzle(puzzle.value) }),
    });
  }, []);

  const onEdit = useCallback(async () => {
    await storeCandidate();
    globalThis.location.href = "/puzzles/edit";
  }, [storeCandidate]);

  const onPreview = useCallback(async () => {
    // Open the tab within the click gesture so it isn't popup-blocked, then
    // point it at the preview once the candidate is stored.
    const tab = globalThis.open("", "_blank");
    await storeCandidate();
    if (tab) tab.location.href = "/puzzles/preview";
  }, [storeCandidate]);

  const isRunning = status.value === "running";

  // A link kept from a previous board — or a reload after a regenerate — can
  // name a route this candidate doesn't have. Fall back to no selection rather
  // than reading past the end of the list.
  const selectedIndex = selected.value !== null &&
      scoring.value?.solutions[selected.value]
    ? selected.value
    : null;

  // What the character rules need beyond the metrics themselves.
  const context = {
    minMoves: puzzle.value.minMoves,
    walls: puzzle.value.board.walls.length,
    blockers: puzzle.value.board.pieces.filter(
      (piece) => piece.type === "blocker",
    ).length,
  };

  return (
    <Panel>
      <a
        href="/contribute"
        target="_blank"
        className={clsx(
          "col-[2/3] text-fl-1 mb-fl-4 leading-tight",
          "lg:row-[1/3] lg:text-fl-0 lg:mb-0",
        )}
      >
        Guide: How to add puzzles
      </a>

      <div className="flex flex-col col-[2/3] lg:row-[3/4] gap-fl-4 lg:gap-fl-1 place-content-between">
        <div className="flex flex-col gap-fl-1">
          <p className="flex justify-between gap-fl-1 text-1 leading-tight">
            <span className="text-text-2">Target</span>
            <span className="text-text-1 font-weight-7 tabular-nums">
              {targetMoves.value} moves
            </span>
          </p>

          <details className="group p-0 bg-none my-fl-1">
            <summary className="flex items-center gap-1 list-none bg-surface-3 cursor-pointer text-text-2 -mx-5 px-5 rounded-none group-open:mb-0">
              <Icon
                icon={CaretRight}
                className="transition-transform group-open:rotate-90"
              />
              Options
            </summary>
            <div className="flex flex-col gap-fl-1 bg-surface-3 -mx-5 px-5 pb-2">
              <NumberRange
                label="Walls"
                name="gen-walls"
                value={wallsRange.value}
                min={0}
                max={25}
                onChange={(value) => {
                  wallsRange.value = value;
                }}
              />
              <NumberRange
                label="Blockers"
                name="gen-blockers"
                value={blockersRange.value}
                min={0}
                max={8}
                onChange={(value) => {
                  blockersRange.value = value;
                }}
              />
              <Select
                label="Wall spread"
                name="gen-spread"
                value={wallSpread.value}
                options={SPREAD_OPTIONS}
                onChange={(value) => {
                  wallSpread.value = value as WallSpread;
                }}
              />
              <RangeSlider
                label="Symmetry"
                name="gen-symmetry"
                value={Math.round(symmetry.value * 100)}
                min={0}
                max={100}
                step={5}
                format={(v) => `${v}%`}
                onChange={(value) => {
                  symmetry.value = value / 100;
                }}
              />
            </div>
          </details>

          {isRunning
            ? (
              <button type="button" className="btn" onClick={onCancel}>
                <Icon icon={X} />
                Cancel · {attempts.value}
              </button>
            )
            : (
              <button type="button" className="btn" onClick={onGenerate}>
                <Icon icon={status.value === "preview" ? Repeat : Shuffle} />
                {status.value === "preview" ? "Regenerate" : "Generate"}
              </button>
            )}

          {status.value === "preview" && scoring.value && (
            <>
              <CandidateScore
                scoring={scoring.value}
                selected={selectedIndex}
              />

              <SolutionList
                scoring={scoring.value}
                selected={selectedIndex}
              />

              {selectedIndex === null
                // With no route picked the character describes the board as a
                // whole, from the aggregate metrics.
                ? (
                  <BoardCharacter
                    traits={boardCharacter(scoring.value.metrics, context)}
                  />
                )
                : (
                  <SolutionDetail
                    scoring={scoring.value}
                    index={selectedIndex}
                    traits={boardCharacter(
                      scoring.value.solutions[selectedIndex].metrics,
                      context,
                    )}
                    tags={tags.value[
                      scoring.value.solutions[selectedIndex].moves
                    ] ?? []}
                    onToggleTag={onToggleTag}
                  />
                )}
            </>
          )}

          {(status.value === "exhausted" || status.value === "error") && (
            <p className="text-fl-0 text-text-3 leading-tight">
              {message.value}
            </p>
          )}
        </div>

        {status.value === "preview" && (
          <div className="flex flex-col flex-wrap gap-fl-1">
            <button type="button" className="btn" onClick={onEdit}>
              <Icon icon={Pencil} />
              Edit
            </button>

            <button type="button" className="btn" onClick={onPreview}>
              <Icon icon={Eye} />
              Preview
            </button>
          </div>
        )}
      </div>
    </Panel>
  );
}
