import { type Signal, useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback, useMemo } from "preact/hooks";

import {
  type GenerateStreamOptions,
  useGenerateStream,
} from "#/client/use-generate-stream.ts";
import {
  ArrowClockwise,
  ArrowRight,
  ArrowSquareIn,
  DownloadSimple,
  Eye,
  FlipHorizontal,
  FlipVertical,
  FloppyDisk,
  Icon,
  Shuffle,
  Trash,
} from "#/components/icons.tsx";
import { Panel } from "#/components/panel.tsx";
import { Select } from "#/components/select.tsx";
import { flipBoard, resolveMoves, rotateBoard } from "#/game/board.ts";
import { formatPuzzle } from "#/game/formatter.ts";
import type { Metrics, ScoredBoard } from "#/game/scoring.ts";
import type { Board, Difficulty, Puzzle } from "#/game/types.ts";
import { decodeState, encodeState } from "#/game/url.ts";
import { useRouter } from "#/islands/router.tsx";

type EditorPanelProps = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  isDev: boolean;
};

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
  { label, value, percent, whole }: {
    label: string;
    value: number;
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
    <div className="flex justify-between gap-fl-1">
      <dt className="text-text-3">{label}</dt>
      <dd className="text-text-1 font-weight-7 tabular-nums">{display}</dd>
    </div>
  );
}

/**
 * Side panel for the puzzle editor.
 * Provides board transform actions (rotate, flip), puzzle generation,
 * and a save button (dev only) that writes directly to static puzzles.
 */
export function EditorPanel(
  { puzzle, href, isDev }: EditorPanelProps,
) {
  const onLocationUpdated = useCallback((url: URL) => {
    href.value = url.href;
  }, []);

  const { updateLocation } = useRouter({ onLocationUpdated });

  const board = useMemo(() => {
    const url = new URL(href.value);
    url.search = encodeState({
      ...puzzle.value.board,
      moves: [],
    });

    const state = decodeState(url.href);
    const moves = state.moves.slice(0, state.cursor ?? state.moves.length);

    return resolveMoves(puzzle.value.board, moves);
  }, [href.value, puzzle.value.board]);

  const formatted = useMemo(() =>
    formatPuzzle({
      number: puzzle.value.number,
      name: puzzle.value.name,
      slug: puzzle.value.slug,
      createdAt: puzzle.value.createdAt ?? new Date(Date.now()),
      difficulty: puzzle.value.difficulty,
      minMoves: puzzle.value.minMoves ?? 0,
      board,
    }), [puzzle.value, board]);

  const onSave = useCallback(async () => {
    await fetch("/api/puzzles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: puzzle.value.slug, markdown: formatted }),
    });

    const url = new URL(href.value);

    if (!url.pathname.startsWith(`/puzzles/${puzzle.value.slug}`)) {
      url.pathname = `/puzzles/${puzzle.value.slug}`;
      updateLocation(url.href);
    }
  }, [href.value, puzzle.value.slug, formatted]);

  // Target difficulty for generation; the loop gates the result against it.
  const genDifficulty = useSignal<Difficulty>(
    puzzle.value.difficulty === "ultra" ? "medium" : puzzle.value.difficulty,
  );
  const genState = useSignal<"idle" | "running" | "exhausted" | "error">(
    "idle",
  );
  const attempts = useSignal(0);
  const genMessage = useSignal("");
  // The advisory score for the last generated board. Held together with the
  // board object it was computed for, so any manual edit (which replaces the
  // board) makes `scored.value.board !== puzzle.value.board` and hides it.
  const scored = useSignal<
    | { board: Board; scored: ScoredBoard; metrics: Metrics; minMoves: number }
    | null
  >(null);

  const { start: startGenerate } = useGenerateStream((event) => {
    if (event.type === "progress") {
      attempts.value = event.attempts;
      return;
    }
    if (event.type === "result") {
      const { board } = event;
      puzzle.value = {
        ...puzzle.value,
        board,
        minMoves: event.minMoves,
        difficulty: genDifficulty.value,
      };
      scored.value = {
        board,
        scored: event.scored,
        metrics: event.metrics,
        minMoves: event.minMoves,
      };
      genState.value = "idle";
      return;
    }
    if (event.type === "exhausted") {
      genState.value = "exhausted";
      genMessage.value =
        `No board cleared the gates in ${event.attempts} tries — try again.`;
      return;
    }
    genState.value = "error";
    genMessage.value = event.message;
  });

  const onGenerate = useCallback(() => {
    attempts.value = 0;
    genState.value = "running";
    genMessage.value = "";
    startGenerate({ ...GENERATE_OPTIONS, difficulty: genDifficulty.value });
  }, [startGenerate]);

  const onClear = useCallback(() => {
    puzzle.value = {
      ...puzzle.value,
      board: { destination: { x: 3, y: 3 }, pieces: [], walls: [] },
      minMoves: 0,
    };
  }, [puzzle]);

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
        <div className="flex flex-col gap-fl-1 flex-wrap">
          <div className="flex gap-fl-1 flex-wrap lg:justify-center">
            <button
              type="button"
              className="icon-btn"
              data-size="sm"
              onClick={() => {
                puzzle.value = {
                  ...puzzle.value,
                  board: rotateBoard(puzzle.value.board, "right"),
                };
              }}
            >
              <Icon icon={ArrowClockwise} />
              <span className="sr-only">Rotate 90°</span>
            </button>

            <button
              type="button"
              className="icon-btn"
              data-size="sm"
              onClick={() => {
                puzzle.value = {
                  ...puzzle.value,
                  board: flipBoard(puzzle.value.board, "horizontal"),
                };
              }}
            >
              <Icon icon={FlipHorizontal} />
              <span className="sr-only">Mirror Horizontally</span>
            </button>

            <button
              type="button"
              className="icon-btn"
              data-size="sm"
              onClick={() => {
                puzzle.value = {
                  ...puzzle.value,
                  board: flipBoard(puzzle.value.board, "vertical"),
                };
              }}
            >
              <Icon icon={FlipVertical} />
              <span className="sr-only">Mirror Vertically</span>
            </button>
          </div>

          <Select
            label="Difficulty"
            name="gen-difficulty"
            value={genDifficulty.value}
            options={DIFFICULTY_OPTIONS}
            onChange={(value) => {
              genDifficulty.value = value as Difficulty;
            }}
          />

          <button
            type="button"
            className="btn"
            onClick={onGenerate}
            disabled={genState.value === "running"}
          >
            <Icon icon={Shuffle} />
            {genState.value === "running"
              ? `Generating… ${attempts.value}`
              : "Generate"}
          </button>

          <button
            type="button"
            className="btn"
            onClick={onClear}
          >
            <Icon icon={Trash} />
            Clear
          </button>

          {scored.value && scored.value.board === puzzle.value.board && (
            <dl className="grid grid-cols-2 gap-x-fl-1 gap-y-1 bg-surface-2 rounded-1 p-fl-1 text-fl-0">
              <ScoreStat label="Score" value={scored.value.scored.score} />
              <ScoreStat label="Worst" value={scored.value.scored.min} />
              <ScoreStat
                label="Moves"
                value={scored.value.minMoves}
                whole
              />
              <ScoreStat
                label="Routes"
                value={scored.value.metrics.uniqueSolutions}
                whole
              />
              <ScoreStat
                label="Wall use"
                value={scored.value.metrics.wallUtilization}
                percent
              />
              <ScoreStat
                label="Dead"
                value={scored.value.metrics.deadSpace}
                percent
              />
            </dl>
          )}

          {(genState.value === "exhausted" || genState.value === "error") && (
            <p className="text-fl-0 text-text-3 leading-tight">
              {genMessage.value}
            </p>
          )}
        </div>

        <div className="flex flex-col flex-wrap gap-fl-1">
          {isDev && (
            <button
              type="button"
              className="btn"
              onClick={onSave}
            >
              <Icon icon={FloppyDisk} />Save
            </button>
          )}

          <a
            href="/api/export"
            download
            className="btn"
          >
            <Icon icon={DownloadSimple} />Download
          </a>

          <form
            action="/api/import"
            method="post"
            enctype="multipart/form-data"
            className="flex flex-row gap-1"
          >
            <label className="btn cursor-pointer flex-1">
              <Icon icon={ArrowSquareIn} />Import
              <input
                type="file"
                name="file"
                accept=".md"
                className="sr-only"
                onChange={(e) => e.currentTarget.form?.submit()}
              />
            </label>
            <noscript>
              <button className="icon-btn" type="submit" data-size="sm">
                <Icon icon={ArrowRight} />
              </button>
            </noscript>
          </form>

          <a
            href="/puzzles/preview"
            className="btn"
            target="_blank"
          >
            <Icon icon={Eye} /> Preview
          </a>
        </div>
      </div>
    </Panel>
  );
}
