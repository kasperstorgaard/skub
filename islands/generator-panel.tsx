import { type Signal, useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback } from "preact/hooks";

import {
  type GenerateStreamOptions,
  useGenerateStream,
} from "#/client/use-generate-stream.ts";
import { Eye, Icon, Pencil, Repeat, Shuffle, X } from "#/components/icons.tsx";
import { Panel } from "#/components/panel.tsx";
import { Select } from "#/components/select.tsx";
import { formatPuzzle } from "#/game/formatter.ts";
import type { Metrics, ScoredBoard } from "#/game/scoring.ts";
import type { Difficulty, Puzzle } from "#/game/types.ts";

type GeneratorPanelProps = {
  puzzle: Signal<Puzzle>;
};

// Wall/blocker/spread knobs are hardcoded for now; surfacing them as controls
// is a future idea (see spec). Difficulty is the one live control.
const GENERATE_OPTIONS: Omit<GenerateStreamOptions, "difficulty"> = {
  wallsRange: [5, 15],
  blockersRange: [3, 5],
  wallSpread: "balanced",
};

// Difficulty bands the generator can target (`ultra` has no band).
const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
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

/**
 * The advisory score for a generated candidate: a headline of the curated
 * signals (composite, weakest route, and the economy-gate metrics) plus a
 * collapsible breakdown of every remaining metric — the full view kept around
 * for tuning the composite (spec Phase 2). Detail metrics mirror the corpus
 * report's flattening (`scripts/score-corpus.ts`): totalDistance summed, stop
 * types weighted.
 */
function CandidateScore(
  { scored, metrics }: { scored: ScoredBoard; metrics: Metrics },
) {
  const details: {
    label: string;
    value: number;
    hint: string;
    percent?: boolean;
  }[] = [
    {
      label: "Mean",
      value: scored.mean,
      hint: "Mean route score across the distinct solutions.",
    },
    {
      label: "Std dev",
      value: scored.stddev,
      hint: "Spread of route scores across solutions.",
    },
    {
      label: "Wall use",
      value: metrics.wallUtilization,
      percent: true,
      hint:
        "Share of interior walls that ever stop a piece across solutions (gate G7).",
    },
    {
      label: "Dead space",
      value: metrics.deadSpace,
      percent: true,
      hint:
        "Largest region never entered by any trail and holding no piece or goal (gate G8).",
    },
    {
      label: "Coverage",
      value: metrics.coverage,
      hint: "Distinct cells the puck sweeps, as a fraction of the 64 cells.",
    },
    {
      label: "Setup ratio",
      value: metrics.setupRatio,
      hint:
        "Fraction of moves that reposition a blocker rather than the puck (more setup ⇒ harder).",
    },
    {
      label: "Piece usage",
      value: metrics.pieceUsage,
      hint:
        "Log-weighted blocker involvement — sums each blocker's moves and stops; grows with reuse, so it can exceed the piece count (not a count).",
    },
    {
      label: "Deception",
      value: metrics.deception,
      hint:
        "How far the puck slides away from the goal — what misleads a solver.",
    },
    {
      label: "Reversals",
      value: metrics.reversals,
      hint: "Moves of the same piece in opposite directions (back-and-forth).",
    },
    {
      label: "Cross-trail",
      value: metrics.crossTrailOverlap,
      hint: "How much one piece's path crosses another's.",
    },
    {
      label: "Distance",
      value: metrics.totalDistance,
      hint: "Total slide distance travelled (puck + blocker).",
    },
    {
      label: "First move",
      value: metrics.firstMovePrecision,
      hint: "1 / distinct optimal openings — 1 when the first move is forced.",
    },
    {
      label: "Search",
      value: metrics.searchProfile,
      hint:
        "Share of search states reached near the solution depth (back-loaded difficulty).",
    },
    {
      label: "Stops (wtd)",
      value: metrics.stopWeighted,
      hint: "Weighted count of how slides stop: piece×3 + wall×2 + edge.",
    },
    {
      label: "Pointless",
      value: metrics.pointlessClearance,
      hint:
        "Blocker moves after which that blocker never matters again (negative signal).",
    },
    {
      label: "Same dir",
      value: metrics.sameDirectionRepeat,
      hint:
        "Cells a piece re-traverses in the same direction (negative signal).",
    },
  ];

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
          value={metrics.uniqueSolutions}
          whole
          hint="Number of distinct optimal solutions."
        />
      </dl>

      <details className="p-0 bg-none">
        <summary className="list-none py-2 bg-none cursor-pointer">
          Details
        </summary>
        <dl className="flex flex-col">
          {details.map((stat) => (
            <ScoreStat
              key={stat.label}
              label={stat.label}
              value={stat.value}
              hint={stat.hint}
              percent={stat.percent}
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
export function GeneratorPanel({ puzzle }: GeneratorPanelProps) {
  const difficulty = useSignal<Difficulty>("medium");
  const status = useSignal<
    "idle" | "running" | "preview" | "exhausted" | "error"
  >("idle");
  const attempts = useSignal(0);
  const message = useSignal("");
  const scored = useSignal<
    { scored: ScoredBoard; metrics: Metrics } | null
  >(null);

  const { start, cancel } = useGenerateStream((event) => {
    if (event.type === "progress") {
      attempts.value = event.attempts;
      return;
    }
    if (event.type === "result") {
      puzzle.value = {
        ...puzzle.value,
        board: event.board,
        minMoves: event.minMoves,
        difficulty: difficulty.value,
      };
      scored.value = {
        scored: event.scored,
        metrics: event.metrics,
      };
      status.value = "preview";
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
    attempts.value = 0;
    message.value = "";
    status.value = "running";
    start({ ...GENERATE_OPTIONS, difficulty: difficulty.value });
  }, [start]);

  const onCancel = useCallback(() => {
    cancel();
    // Fall back to the previewed candidate if one exists (a cancelled reroll),
    // otherwise to the empty starting state.
    status.value = scored.value ? "preview" : "idle";
  }, [cancel]);

  // The candidate only becomes a draft on demand — both handing off to the
  // editor and previewing store it first (overwriting any prior draft is fine).
  const storeCandidate = useCallback(() =>
    fetch("/api/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: formatPuzzle(puzzle.value) }),
    }), []);

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
