import { useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { HttpError, page } from "fresh";

import { CandidatePanel } from "#/components/candidate-panel.tsx";
import { DifficultyBadge } from "#/components/difficulty-badge.tsx";
import { Header } from "#/components/header.tsx";
import {
  CaretLeft,
  CaretRight,
  Icon,
  RocketLaunch,
} from "#/components/icons.tsx";
import { Main } from "#/components/main.tsx";
import { define } from "#/core.ts";
import { currentCandidate, readFamily } from "#/game/candidate-store.ts";
import {
  candidateLabel,
  type CandidateSource,
  candidateSource,
  type PromoteTarget,
  promoteTarget,
  type StoredCandidate,
  type StoredScoring,
} from "#/game/candidates.ts";
import { getCorpusNames, getCorpusSlugs } from "#/game/loader.ts";
import { pickUnusedName } from "#/game/names.ts";
import type { Puzzle } from "#/game/types.ts";
import Board from "#/islands/board.tsx";
import { CandidateFeedback } from "#/islands/candidate-feedback.tsx";
import { Dialog } from "#/islands/dialog.tsx";
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
  /** Open when `?promote=name`: a suggested name, and one just found taken. */
  nameDialog: { suggestion: string; taken: string | null } | null;
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

    const promote = promoteTarget(candidate, {
      corpusSlugs: await getCorpusSlugs(),
    }).type;
    const nameDialog =
      promote === "ask" && url.searchParams.get("promote") === "name"
        ? {
          suggestion: pickUnusedName(await getCorpusNames()),
          taken: url.searchParams.get("taken"),
        }
        : null;

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
      next: position >= 0 ? family[position + 1] ?? null : null,
      promote,
      nameDialog,
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
                className="left-0 lg:left-auto lg:right-full lg:mr-fl-2"
              />
            )}
            {props.data.next && (
              <VersionArrow
                slug={props.data.next}
                direction="next"
                className="right-0 lg:right-auto lg:left-full lg:ml-fl-2"
              />
            )}
          </div>

          <CandidateFeedback
            candidate={props.data.candidate}
            className={clsx(
              "max-lg:mt-fl-2 max-lg:place-self-center",
              // Clears the next-version arrow: its gap, its width, the gap again.
              "lg:absolute lg:ml-[calc(var(--spacing-fl-2)*2+48px)] lg:left-full lg:top-1/2 lg:-translate-y-1/2 lg:w-3xs",
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

      {props.data.nameDialog && (
        <NameDialog slug={props.data.puzzle.slug} {...props.data.nameDialog} />
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
  return (
    <a
      href={`/candidates/${slug}`}
      aria-label={direction === "previous"
        ? "Previous version"
        : "Next version"}
      className={clsx(
        "icon-btn absolute top-1/2 -translate-y-1/2 z-1",
        "rounded-round bg-surface-2 border border-surface-4 shadow-2",
        className,
      )}
    >
      <Icon icon={direction === "previous" ? CaretLeft : CaretRight} />
    </a>
  );
}

/** Picks the name a board ships under, when it has none it can use. */
function NameDialog(
  { slug, suggestion, taken }: {
    slug: string;
    suggestion: string;
    taken: string | null;
  },
) {
  return (
    <Dialog open>
      <div className="flex flex-col gap-fl-2 text-text-2">
        <h2 className="text-fl-2 font-semibold text-text-1">Name the puzzle</h2>
        {taken && <p>{taken} is already a puzzle.</p>}
      </div>

      <form
        id="promote"
        action={`/candidates/${slug}/promote`}
        method="post"
        className="flex flex-col gap-1"
      >
        <label className="flex flex-col gap-1">
          <span className="text-text-2 text-1">Name</span>
          <input
            name="name"
            defaultValue={suggestion}
            required
            className="border border-surface-4 p-2 bg-surface-2 text-2 rounded-1"
          />
        </label>
      </form>

      <div className="flex gap-fl-2 justify-between flex-wrap w-full max-md:flex-col-reverse">
        <a
          href={`/candidates/${slug}`}
          className="flex items-center text-text-2 max-md:justify-center"
        >
          Cancel
        </a>

        <button form="promote" type="submit" className="btn">
          <Icon icon={RocketLaunch} /> Promote
        </button>
      </div>
    </Dialog>
  );
}
