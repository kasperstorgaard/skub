import { useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { define } from "#/core.ts";
import { getGeneratorOptions } from "#/game/cookies.ts";
import {
  GENERATED_DIR,
  type GenOptions,
  parseGenerated,
  type StoredCandidate,
  type StoredScoring,
} from "#/game/generated.ts";
import type { Puzzle } from "#/game/types.ts";
import Board from "#/islands/board.tsx";
import { CandidateFeedback } from "#/islands/candidate-feedback.tsx";
import { GeneratorPanel } from "#/islands/generator-panel.tsx";
import { LiveDifficultyBadge } from "#/islands/live-difficulty-badge.tsx";
import { isDev } from "#/lib/env.ts";

const EMPTY_PUZZLE: Puzzle = {
  number: 0,
  name: "Untitled",
  slug: "untitled",
  createdAt: new Date(0),
  difficulty: "medium",
  minMoves: 0,
  board: {
    destination: { x: 3, y: 3 },
    pieces: [],
    walls: [],
  },
};

type PageData = {
  puzzle: Puzzle;
  /** Persisted knob values from the generator_options cookie. */
  options: Partial<GenOptions>;
  /** The stored candidate `puzzle` was restored from, feedback included. */
  candidate: StoredCandidate | null;
  /**
   * That candidate's scores and metrics as measured when it was generated.
   * Read from the store rather than re-derived: solving a board again costs
   * seconds, and this is what lets the readout survive a navigation.
   */
  scoring: StoredScoring | null;
};

/**
 * The newest stored candidate — the generator page always resumes it (with its
 * feedback, so a rated board shows its stars), falling back to the empty board
 * only when the store is empty. A dev reload wipes the page mid-curation, but
 * the candidate file survives; restoring it means a great board is never lost
 * before it could be rated.
 */
async function getLatestCandidate(): Promise<
  {
    puzzle: Puzzle;
    candidate: StoredCandidate;
    scoring: StoredScoring | null;
  } | null
> {
  if (!isDev) return null;
  try {
    let newest: { path: string; mtime: number } | null = null;
    for await (const entry of Deno.readDir(GENERATED_DIR)) {
      if (!entry.name.endsWith(".md")) continue;
      const path = `${GENERATED_DIR}/${entry.name}`;
      const mtime = (await Deno.stat(path)).mtime?.getTime() ?? 0;
      if (!newest || mtime > newest.mtime) newest = { path, mtime };
    }
    if (!newest) return null;

    const stored = parseGenerated(await Deno.readTextFile(newest.path));
    // Split store-only fields off the plain Puzzle (they'd otherwise leak into
    // the editor draft via formatPuzzle); feedback rides on the candidate ref.
    const {
      rating,
      reasons,
      note,
      solutionTags,
      genOptions: _genOptions,
      generatorVersion: _generatorVersion,
      scoring,
      ...puzzle
    } = stored;
    return {
      puzzle,
      candidate: {
        slug: puzzle.slug,
        name: puzzle.name,
        rating,
        reasons,
        note,
        difficulty: puzzle.difficulty,
        solutionTags,
      },
      scoring: scoring ?? null,
    };
  } catch {
    return null;
  }
}

export const handler = define.handlers<PageData>({
  async GET(ctx) {
    // Dev-only: generation needs a writable candidate store, and the run itself
    // is an unbounded compute lever (see /api/generate).
    if (!isDev) throw new HttpError(404, "Not found");

    // The generator resumes the newest stored candidate (or the empty board on
    // a fresh store); a candidate only becomes a draft once the curator picks
    // "Edit this".
    const latest = await getLatestCandidate();
    return page({
      puzzle: latest?.puzzle ??
        { ...EMPTY_PUZZLE, createdAt: new Date(Date.now()) },
      options: getGeneratorOptions(ctx.req.headers),
      candidate: latest?.candidate ?? null,
      scoring: latest?.scoring ?? null,
    });
  },
});

export default define.page<typeof handler>(function GeneratePage(props) {
  const puzzle = useSignal(props.data.puzzle);
  const href = useSignal(props.url.href);

  // Selection and replay are URL state, read here and handed to the panel: the
  // page is what re-renders on a link, and a replay only restarts when the
  // board mounts fresh (the solution replay page works the same way).
  const url = new URL(props.req.url);
  const mode = useSignal<"readonly" | "replay">(
    url.searchParams.get("mode") === "replay" ? "replay" : "readonly",
  );
  const selected = Number(url.searchParams.get("solution"));
  const initialSolution = Number.isInteger(selected) &&
      url.searchParams.has("solution")
    ? selected
    : undefined;

  return (
    <>
      <Main className="lg:relative">
        <Header url={url} back={{ href: "/" }} />

        <div className="flex justify-between items-center gap-fl-1 mt-2">
          <div className="flex flex-col">
            <h1 className="text-5 text-brand pr-1 leading-flat">Generate</h1>
            <p className="text-text-3 leading-tight ml-1">candidates</p>
          </div>

          <LiveDifficultyBadge puzzle={puzzle} className="lg:mt-1" />
        </div>

        <div className="relative max-lg:pb-fl-5">
          <Board
            puzzle={puzzle}
            href={href}
            mode={mode}
            className="lg:col-[1/2] lg:row-[4/5]"
          />

          <CandidateFeedback
            puzzle={puzzle}
            className={clsx(
              "max-lg:mt-fl-2 max-lg:place-self-center",
              "lg:absolute lg:ml-fl-3 lg:left-full lg:top-1/2 lg:-translate-y-1/2 lg:w-3xs",
            )}
          />
        </div>
      </Main>
      <GeneratorPanel
        puzzle={puzzle}
        mode={mode}
        initialOptions={props.data.options}
        initialCandidate={props.data.candidate ?? undefined}
        initialScoring={props.data.scoring ?? undefined}
        initialSolution={initialSolution}
      />
    </>
  );
});
