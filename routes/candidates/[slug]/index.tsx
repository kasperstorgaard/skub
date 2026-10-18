import { useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { HttpError, page } from "fresh";

import { CandidatePanel } from "#/components/candidate-panel.tsx";
import { DifficultyBadge } from "#/components/difficulty-badge.tsx";
import { Header } from "#/components/header.tsx";
import { CaretLeft, CaretRight, Icon } from "#/components/icons.tsx";
import { Main } from "#/components/main.tsx";
import { define } from "#/core.ts";
import {
  currentCandidate,
  readFamily,
  suggestName,
  takenSlugs,
} from "#/game/candidate-store.ts";
import {
  candidateLabel,
  type CandidateSource,
  candidateSource,
  type PromoteTarget,
  promoteTarget,
  type StoredCandidate,
  type StoredScoring,
} from "#/game/candidates.ts";
import type { Puzzle } from "#/game/types.ts";
import Board from "#/islands/board.tsx";
import { CandidateFeedback } from "#/islands/candidate-feedback.tsx";
import { PromoteDialog } from "#/islands/promote-dialog.tsx";
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
  /** How the candidate reads: its name, or `12 (b)` for a numbered one. */
  label: string;
  /** The neighbouring versions in the family, base first. */
  previous: string | null;
  next: string | null;
  promote: PromoteTarget["type"];
  /** A free name for the promote dialog, when the board needs one. */
  suggestion: string | null;
};

export const handler = define.handlers<PageData>({
  async GET(ctx) {
    // Dev-only: production's filesystem is read-only.
    if (!isDev) throw new HttpError(404, "Not found");

    const url = new URL(ctx.req.url);
    const { slug } = ctx.params;

    // An entry with no current analysis is solved on this request, and a board
    // too branchy for the budget throws — report that rather than 500.
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

    const family = (await readFamily(slug)).map((member) => member.slug);
    const position = family.indexOf(slug);

    const taken = await takenSlugs(slug);
    const promote = promoteTarget(candidate, { takenSlugs: taken }).type;

    const suggestion = promote === "ask" ? suggestName(taken) : null;

    return page({
      puzzle,
      promotedAs: promotedAs ?? null,
      candidate: {
        slug: puzzle.slug,
        name: candidateLabel(puzzle),
        rating,
        reasons,
        note,
        solutionTags,
      },
      scoring,
      source: candidateSource(candidate),
      selected,
      solutionTags: solutionTags ?? {},
      label: candidateLabel(puzzle),
      previous: family[position - 1] ?? null,
      next: family[position + 1] ?? null,
      promote,
      suggestion,
    });
  },
});

/**
 * One candidate, whatever made it: the board, its analysis, every distinct
 * solution scored and replayable, and the feedback controls. The board stays
 * playable — score and feel are what this page exists to compare.
 */
export default define.page<typeof handler>(function CandidatePage(props) {
  const puzzle = useSignal(props.data.puzzle);
  const href = useSignal(props.url.href);

  const url = new URL(props.req.url);
  // Replay is URL state: the board only restarts an animation on a fresh mount.
  const mode = useSignal<"solve" | "replay">(
    url.searchParams.get("mode") === "replay" ? "replay" : "solve",
  );

  return (
    <>
      <Main className="lg:relative">
        <Header url={url} back={{ href: "/candidates" }} />

        <div className="flex items-center justify-between gap-fl-1 mt-2 flex-wrap">
          <div className="flex flex-col">
            <h1 className="text-5 text-brand pr-1 leading-flat font-5">
              {props.data.label}
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
          <div className="relative">
            <Board
              puzzle={puzzle}
              href={href}
              mode={mode}
              className="lg:col-[1/2] lg:row-[4/5]"
            />

            {props.data.previous && (
              <VersionArrow
                slug={props.data.previous}
                direction="previous"
                className="left-0 md:-ml-fl-2"
              />
            )}
            {props.data.next && (
              <VersionArrow
                slug={props.data.next}
                direction="next"
                className="right-0 md:-mr-fl-2"
              />
            )}
          </div>

          <CandidateFeedback
            candidate={props.data.candidate}
            className={clsx(
              "max-lg:mt-fl-2 max-lg:place-self-center",
              "lg:absolute lg:ml-fl-5 lg:left-full lg:top-1/2 lg:-translate-y-1/2 lg:w-3xs",
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
        promote={props.data.promote}
      />

      {props.data.suggestion && (
        <PromoteDialog
          href={href}
          slug={props.data.puzzle.slug}
          suggestion={props.data.suggestion}
        />
      )}
    </>
  );
});

/** Steps to the neighbouring version of the board, floating at its edge. */
function VersionArrow(
  { slug, direction, className }: {
    slug: string;
    direction: "previous" | "next";
    className?: string;
  },
) {
  // The wrapper positions; themes restyle `.icon-btn` unlayered, position too.
  return (
    <span
      className={clsx("absolute top-1/2 -translate-y-1/2 z-1 flex", className)}
    >
      <a
        href={`/candidates/${slug}`}
        aria-label={direction === "previous"
          ? "Previous version"
          : "Next version"}
        className="icon-btn rounded-round bg-surface-2 border border-surface-4 shadow-2"
      >
        <Icon icon={direction === "previous" ? CaretLeft : CaretRight} />
      </a>
    </span>
  );
}
