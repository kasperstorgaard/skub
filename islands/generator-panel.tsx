import { type Signal, useSignal } from "@preact/signals";
import { useCallback, useRef } from "preact/hooks";

import { useGenerateStream } from "#/client/use-generate-stream.ts";
import { CaretRight, Icon, Repeat, Shuffle, X } from "#/components/icons.tsx";
import { NumberRange } from "#/components/number-range.tsx";
import { Panel } from "#/components/panel.tsx";
import { RangeSlider } from "#/components/range-slider.tsx";
import { Select } from "#/components/select.tsx";
import {
  formatCandidate,
  type GenOptions,
  type StoredScoring,
  toStoredScoring,
} from "#/game/candidates.ts";
import { GENERATOR_VERSION, type WallSpread } from "#/game/generator.ts";
import { difficultyForMoves, MOVE_TARGETS } from "#/game/scoring.ts";
import type { Puzzle } from "#/game/types.ts";

type GeneratorPanelProps = {
  puzzle: Signal<Puzzle>;
  /** Persisted knob values (from the generator_options cookie), server-read. */
  initialOptions?: Partial<GenOptions>;
};

const SPREAD_OPTIONS: { value: WallSpread; label: string }[] = [
  { value: "mid", label: "Mid" },
  { value: "balanced", label: "Balanced" },
  { value: "spread", label: "Spread" },
];

/**
 * Draws the move count for one run, uniformly across `MOVE_TARGETS`. Uniform
 * over the range rather than over what the generator finds easily — random
 * layouts skew short, so sampling by frequency would bury the 9s and 10s.
 */
const pickTarget = (): number =>
  MOVE_TARGETS[Math.floor(Math.random() * MOVE_TARGETS.length)];

/**
 * Side panel for the puzzle generator (`/puzzles/generate`). Owns the knobs and
 * the gated run, and nothing after it: a board that clears the gates is a
 * candidate like any other, so it's stored and handed to `/candidate`, where
 * every board is analysed, played and rated.
 */
export function GeneratorPanel(
  { puzzle, initialOptions = {} }: GeneratorPanelProps,
) {
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
    "idle" | "running" | "saving" | "exhausted" | "error"
  >(
    "idle",
  );
  const attempts = useSignal(0);
  const message = useSignal("");
  // Monotonic run counter — a save response is only applied if no newer run has
  // started since, so a slow save can't hand off a rerolled-away candidate.
  const runId = useRef(0);

  /**
   * Stores the accepted board and goes to its candidate page. The analysis
   * travels with it: the run measured every route already, and the store is
   * what carries it across the navigation. Dev-only endpoint — a failure (e.g.
   * production's read-only fs) leaves the board on screen and says so.
   */
  const handOff = useCallback(async (
    generated: Puzzle,
    scoring: StoredScoring,
    run: number,
  ) => {
    const genOptions: GenOptions = {
      wallsRange: wallsRange.value,
      blockersRange: blockersRange.value,
      wallSpread: wallSpread.value,
      symmetry: symmetry.value,
      targetMoves: targetMoves.value,
    };
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          markdown: formatCandidate({
            ...generated,
            genOptions,
            generatorVersion: GENERATOR_VERSION,
            scoring,
          }),
        }),
      });
      // A newer run started while this save was in flight — its result belongs
      // to a board the curator already rerolled away. Drop it.
      if (runId.current !== run) return;
      if (!res.ok) throw new Error(await res.text());

      const saved = await res.json() as { slug: string };
      globalThis.location.href = `/candidate?slug=${saved.slug}`;
    } catch (err) {
      status.value = "error";
      message.value = `Not stored — ${
        err instanceof Error ? err.message : "request failed"
      }`;
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
      status.value = "saving";
      handOff(
        generated,
        toStoredScoring(event.scored, event.metrics),
        runId.current,
      );
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

  const onGenerate = useCallback(() => {
    runId.current++; // invalidate any in-flight save from the previous run
    attempts.value = 0;
    message.value = "";
    status.value = "running";
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
  }, [start]);

  const onCancel = useCallback(() => {
    cancel();
    // Also invalidates an in-flight hand-off, so a cancel during the save
    // doesn't navigate to a board the curator just walked away from.
    runId.current++;
    status.value = "idle";
  }, [cancel]);

  const isRunning = status.value === "running" || status.value === "saving";

  return (
    <Panel>
      <a
        href="/contribute"
        target="_blank"
        className="col-[2/3] text-fl-1 mb-fl-4 leading-tight lg:row-[1/3] lg:text-fl-0 lg:mb-0"
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
                <Icon icon={status.value === "idle" ? Shuffle : Repeat} />
                {status.value === "idle" ? "Run" : "Run again"}
              </button>
            )}

          {(status.value === "exhausted" || status.value === "error") && (
            <p className="text-fl-0 text-text-3 leading-tight">
              {message.value}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
