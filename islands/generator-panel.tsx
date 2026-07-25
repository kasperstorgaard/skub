import { type Signal, useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback, useEffect, useRef } from "preact/hooks";

import { candidate } from "#/client/generator-signals.ts";
import { useGenerateStream } from "#/client/use-generate-stream.ts";
import { Eye, Icon, Pencil, Repeat, Shuffle, X } from "#/components/icons.tsx";
import { NumberRange } from "#/components/number-range.tsx";
import { Panel } from "#/components/panel.tsx";
import { RangeSlider } from "#/components/range-slider.tsx";
import { Select } from "#/components/select.tsx";
import { formatPuzzle } from "#/game/formatter.ts";
import {
  formatGenerated,
  type GenOptions,
  type StoredCandidate,
} from "#/game/generated.ts";
import { GENERATOR_VERSION, type WallSpread } from "#/game/generator.ts";
import { METRIC_CATALOG } from "#/game/metric-catalog.ts";
import type { Metrics, ScoredBoard } from "#/game/scoring.ts";
import type { Difficulty, Puzzle } from "#/game/types.ts";

type GeneratorPanelProps = {
  puzzle: Signal<Puzzle>;
  /** Persisted knob values (from the generator_options cookie), server-read. */
  initialOptions?: Partial<GenOptions>;
  /** The restored stored candidate the page loaded with, if any. */
  initialCandidate?: StoredCandidate;
};

// Difficulty bands the generator can target (`ultra` has no band).
const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

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
 * The advisory score for a generated candidate: a headline (composite score,
 * weakest route, solution count) over a collapsible breakdown of every metric,
 * the full view kept around for tuning the composite. Detail rows come from
 * `METRIC_CATALOG`, so the panel can never drift out of sync with the metrics
 * the reports and calibration tooling measure.
 */
function CandidateScore(
  { scored, metrics }: { scored: ScoredBoard; metrics: Metrics },
) {
  return (
    <div className="flex flex-col gap-fl-1 text-1">
      <dl className="flex flex-col">
        <ScoreStat
          label="Score"
          value={scored.score}
          hint="Advisory composite quality score — the mean across routes."
        />
        <ScoreStat
          label="Weakest route"
          value={scored.min}
          hint="Score of the worst single solution route — an outlier detector."
        />
        <ScoreStat
          label="Solutions"
          value={metrics[HEADLINE_METRIC]}
          whole
          hint="Number of distinct optimal solutions."
        />
      </dl>

      <details className="p-0 bg-none">
        <summary className="list-none py-2 bg-none cursor-pointer">
          Details
        </summary>
        <dl className="flex flex-col">
          <ScoreStat
            label="Mean"
            value={scored.mean}
            hint="Mean route score across the distinct solutions."
          />
          <ScoreStat
            label="Std dev"
            value={scored.stddev}
            hint="Spread of route scores across solutions."
          />
          {METRIC_CATALOG
            .filter((spec) => spec.key !== HEADLINE_METRIC)
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
        </dl>
      </details>
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
  { puzzle, initialOptions = {}, initialCandidate }: GeneratorPanelProps,
) {
  const difficulty = useSignal<Difficulty>(
    initialOptions.difficulty ?? "medium",
  );
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
  const scored = useSignal<
    { scored: ScoredBoard; metrics: Metrics } | null
  >(null);
  // The in-flight auto-save; the Edit/Preview handoff awaits it so the
  // server-assigned name/slug are on `puzzle` before the draft is stored.
  const savePromise = useRef<Promise<void> | null>(null);
  // Monotonic run counter — a save response is only applied if no newer run has
  // started since, so a slow save can't resurrect a rerolled-away candidate.
  const runId = useRef(0);

  // Resume the restored candidate: the board came in via page data, so seed
  // the shared candidate signal (shows the feedback UI, stored stars included)
  // and land directly in preview. No stored score — the readout stays hidden
  // for restored boards.
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
      difficulty: difficulty.value,
      wallsRange: wallsRange.value,
      blockersRange: blockersRange.value,
      wallSpread: wallSpread.value,
      symmetry: symmetry.value,
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
        difficulty: difficulty.value,
      };
      puzzle.value = generated;
      scored.value = {
        scored: event.scored,
        metrics: event.metrics,
      };
      status.value = "preview";
      savePromise.current = saveGenerated(generated, runId.current);
      return;
    }
    if (event.type === "exhausted") {
      status.value = "exhausted";
      message.value =
        `No board cleared the gates in ${event.attempts} tries — try again.`;
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
    candidate.value = null; // drop the previous candidate's feedback form
    start({
      wallsRange: wallsRange.value,
      blockersRange: blockersRange.value,
      wallSpread: wallSpread.value,
      symmetry: symmetry.value,
      difficulty: difficulty.value,
    });
  }, [start]);

  const onCancel = useCallback(() => {
    cancel();
    // Fall back to the previewed candidate if one exists (a cancelled reroll),
    // otherwise to the empty starting state.
    status.value = scored.value ? "preview" : "idle";
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
          <Select
            label="Difficulty"
            name="gen-difficulty"
            value={difficulty.value}
            options={DIFFICULTY_OPTIONS}
            onChange={(value) => {
              difficulty.value = value as Difficulty;
            }}
          />

          <details className="p-0 bg-none my-fl-1">
            <summary className="list-none py-fl-1 bg-none cursor-pointer text-text-2">
              Options
            </summary>
            <div className="flex flex-col gap-fl-1">
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

          {status.value === "preview" && scored.value && (
            <CandidateScore
              scored={scored.value.scored}
              metrics={scored.value.metrics}
            />
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
