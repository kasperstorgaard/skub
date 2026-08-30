import { useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { HttpError, page } from "fresh";

import { CandidatePanel } from "#/components/candidate-panel.tsx";
import { DifficultyBadge } from "#/components/difficulty-badge.tsx";
import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { define } from "#/core.ts";
import { currentCandidate } from "#/game/candidate-store.ts";
import {
  type CandidateSource,
  candidateSource,
  type StoredCandidate,
  type StoredScoring,
} from "#/game/candidates.ts";
import type { Puzzle } from "#/game/types.ts";
import Board from "#/islands/board.tsx";
import { CandidateFeedback } from "#/islands/candidate-feedback.tsx";
import { isDev } from "#/lib/env.ts";

type PageData = {
  puzzle: Puzzle;
  candidate: StoredCandidate;
  scoring: StoredScoring;
  source: CandidateSource;
  /** Index of the solution the URL has selected, if any. */
  selected: number | null;
  /** Stored per-route tags, keyed by the route's encoded moves. */
  solutionTags: Record<string, string[]>;
  /** The corpus slug this board shipped as, or null while it's still a candidate. */
  promotedAs: string | null;
};

export const handler = define.handlers<PageData>({
  async GET(ctx) {
    // Dev-only: rating a candidate writes to the store, and production's
    // filesystem is read-only.
    if (!isDev) throw new HttpError(404, "Not found");

    const url = new URL(ctx.req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) throw new HttpError(404, "No candidate");

    // A stored entry is refreshed in place (its analysis is re-derived only if
    // the calibration moved on); an unknown slug is looked up in the corpus,
    // which is what makes a shipped puzzle ratable.
    // An entry with no analysis yet is solved on this request, and a board too
    // branchy to solve within the budget throws — report that rather than 500.
    let candidate;
    try {
      candidate = await currentCandidate(slug);
    } catch (err) {
      throw new HttpError(
        500,
        `Could not analyse ${slug} — ${
          err instanceof Error ? err.message : "solve failed"
        }`,
      );
    }
    if (!candidate?.scoring) throw new HttpError(404, "Not found");

    const {
      rating,
      reasons,
      note,
      solutionTags,
      source: _source,
      genOptions: _genOptions,
      generatorVersion: _generatorVersion,
      promotedAs,
      scoring,
      ...puzzle
    } = candidate;

    // A link kept from another board can name a route this one doesn't have.
    const index = Number(url.searchParams.get("solution"));
    const selected = url.searchParams.has("solution") &&
        Number.isInteger(index) && scoring.solutions[index]
      ? index
      : null;

    return page({
      puzzle,
      promotedAs: promotedAs ?? null,
      candidate: {
        slug: puzzle.slug,
        name: puzzle.name,
        rating,
        reasons,
        note,
        solutionTags,
      },
      scoring,
      source: candidateSource(candidate),
      selected,
      solutionTags: solutionTags ?? {},
    });
  },
});

/**
 * One candidate, whatever made it: the board, its analysis, every distinct
 * solution scored and replayable, and the controls that record what a human
 * thinks of it.
 *
 * Analysis says whether a board *scores* well; playing it says how it feels,
 * and the whole reason this page exists is that those two have drifted apart —
 * so the board stays playable, and a selected solution replays over it.
 */
export default define.page<typeof handler>(function CandidatePage(props) {
  const puzzle = useSignal(props.data.puzzle);
  const href = useSignal(props.url.href);

  const url = new URL(props.req.url);
  // Replay is URL state, read here so a link is what starts the animation —
  // the board only restarts one when the page mounts fresh.
  const mode = useSignal<"solve" | "replay">(
    url.searchParams.get("mode") === "replay" ? "replay" : "solve",
  );

  return (
    <>
      <Main className="lg:relative">
        <Header url={url} back={{ href: "/" }} />

        <div className="flex items-center justify-between gap-fl-1 mt-2 flex-wrap">
          <div className="flex flex-col">
            <h1 className="text-5 text-brand pr-1 leading-flat font-5">
              {props.data.puzzle.name}
            </h1>
            {/* State, then origin — candidacy is a state the board leaves. */}
            <p className="text-text-3 leading-tight ml-1">
              {props.data.promotedAs ? "promoted" : "candidate"} ·{" "}
              {props.data.source}
            </p>
          </div>

          <DifficultyBadge puzzle={puzzle.value} className="lg:mt-1" />
        </div>

        <div className="relative max-lg:pb-fl-5">
          <Board
            puzzle={puzzle}
            href={href}
            mode={mode}
            className="lg:col-[1/2] lg:row-[4/5]"
          />

          <CandidateFeedback
            candidate={props.data.candidate}
            className={clsx(
              "max-lg:mt-fl-2 max-lg:place-self-center",
              "lg:absolute lg:ml-fl-3 lg:left-full lg:top-1/2 lg:-translate-y-1/2 lg:w-3xs",
            )}
          />
        </div>
      </Main>

      <CandidatePanel
        puzzle={props.data.puzzle}
        scoring={props.data.scoring}
        selected={props.data.selected}
        solutionTags={props.data.solutionTags}
        promotedAs={props.data.promotedAs}
      />
    </>
  );
});
