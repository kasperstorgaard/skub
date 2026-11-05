// Puzzle route — renders the board and handles solution submission
import { trace } from "@opentelemetry/api";
import { useSignal } from "@preact/signals";
import clsx from "clsx/lite";
import { HttpError, page } from "fresh";

import { DifficultyBadge } from "#/components/difficulty-badge.tsx";
import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { PrintPanel } from "#/components/print-panel.tsx";
import { TutorialNudge } from "#/components/tutorial-nudge.tsx";
import { saveSolution, updateSolutionAggregates } from "#/db/solutions.ts";
import {
  getFlashSolveCount,
  getPuzzleStats,
  incrementFlashSolveCount,
} from "#/db/stats.ts";
import type { User } from "#/db/types.ts";
import { setUser } from "#/db/user.ts";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import {
  getFlashStart,
  getHintCount,
  isFlashExplained,
} from "#/game/cookies.ts";
import { getTodaysPuzzleNumber, isTodaysPuzzle } from "#/game/date.ts";
import { withFlashStart } from "#/game/flash.ts";
import { withSolve } from "#/game/progress.ts";
import { assessSkillLevel } from "#/game/skill.ts";
import { defaultPuzzleStats } from "#/game/stats.ts";
import { Move, Puzzle } from "#/game/types.ts";
import { decodeState, encodeState, getPuzzleArchiveHref } from "#/game/url.ts";
import { AutoPostSolution } from "#/islands/auto-post-solution.tsx";
import Board from "#/islands/board.tsx";
import {
  type CelebrationData,
  CelebrationDialog,
} from "#/islands/celebration-dialog.tsx";
import { ControlsPanel } from "#/islands/controls-panel.tsx";
import { FlashBadge } from "#/islands/flash-badge.tsx";
import { FlashDialog } from "#/islands/flash-dialog.tsx";
import { FlashNudge } from "#/islands/flash-nudge.tsx";
import { HintDialog } from "#/islands/hint-dialog.tsx";
import { SolutionDialog } from "#/islands/solution-dialog.tsx";
import { isDev } from "#/lib/env.ts";
import { withSpan } from "#/lib/tracing.ts";
import { trackPuzzleSolved, trackSkillLevelUp } from "#/lib/tracking.ts";
import { define } from "#/routes/puzzles/[slug]/_middleware.ts";

type PageData = {
  puzzle: Puzzle;
  hintCount: number;
  savedName: string | null;
  hasSolved: boolean;
  showEdit: boolean;
  /** The puzzle is long enough for Flash. */
  hasFlash: boolean;
  /** Flash is on: `puzzle` is the shorter one that starts after the Flash start. */
  isFlashOn: boolean;
  /** The Flash dialog was answered: no more dialog, no more nudge. */
  isFlashExplained: boolean;
};

export const handler = define.handlers<PageData>({
  GET(ctx) {
    const { slug } = ctx.params;
    const savedName = ctx.state.user?.name ?? null;

    const hintCount = getHintCount(ctx.req.headers);
    const flashStart = getFlashStart(ctx.req.headers);
    const hasFlash = !!ctx.state.puzzle.flashStart;
    const puzzle = flashStart
      ? withFlashStart(ctx.state.puzzle, flashStart)
      : ctx.state.puzzle;

    const hasSolved = slug in ctx.state.progress;

    const { moves } = decodeState(ctx.url);

    // No-JS solve detection: moves are encoded in the URL on each navigation.
    // JS users go via AutoPostSolution → POST instead. The dialog guard prevents
    // re-processing when the page reloads after a redirect.
    if (moves.length > 0 && !ctx.url.searchParams.get("dialog")) {
      let board: Puzzle["board"];
      try {
        board = resolveMoves(puzzle.board, moves);
      } catch {
        const url = new URL(`/puzzles/${slug}`, ctx.url);
        url.searchParams.set("error", "invalid move");
        return Response.redirect(url, 303);
      }

      if (isValidSolution(board)) {
        const redirectUrl = new URL(ctx.url);
        redirectUrl.searchParams.set("dialog", "solution");
        return Response.redirect(redirectUrl, 303);
      }
    }

    const showEdit = isDev && (puzzle.number ?? 0) > getTodaysPuzzleNumber();
    return page({
      puzzle,
      hintCount,
      savedName,
      hasSolved,
      showEdit,
      hasFlash,
      isFlashOn: !!flashStart,
      isFlashExplained: isFlashExplained(ctx.req.headers),
    });
  },
  async POST(ctx) {
    const { slug } = ctx.params;
    const { puzzle } = ctx.state;
    const flashStart = getFlashStart(ctx.req.headers);
    const isFlash = flashStart !== null;
    const referer = ctx.req.headers.get("referer") ?? "";
    const isJson = ctx.req.headers.get("content-type")?.includes(
      "application/json",
    );

    const solve = isJson
      ? await ctx.req.json() as { name: string; moves: Move[] }
      : await parseSolveForm(ctx.req);
    const name = solve.name?.slice(0, 30) ?? "";
    // Flash plays a shorter puzzle; the solve kept is the whole one.
    const moves = [...(flashStart ?? []), ...solve.moves];

    if (!name) throw new HttpError(400, "Must provide a username");

    if (!isValidSolution(resolveMoves(puzzle.board, moves))) {
      throw new HttpError(400, "Solution is not valid");
    }

    const activeSpan = trace.getActiveSpan();
    activeSpan?.setAttribute("solution.moves", moves.length);

    // The Flash count is read alongside the save, so it never includes this
    // solve and costs no round trip of its own.
    const [{ isNew, isNewPath, solution }, flashSolvesBefore] = await Promise
      .all([
        withSpan("puzzle.save_solution", async (span) => {
          const result = await saveSolution({
            puzzleSlug: slug,
            name,
            moves,
            userId: ctx.state.userId,
            ...(isFlash && { flash: true }),
          });
          span.setAttribute("solution.is_new", result.isNew);
          span.setAttribute("solution.is_new_path", result.isNewPath);
          return result;
        }),
        isFlash ? getFlashSolveCount(slug) : undefined,
      ]);
    ctx.state.progress = withSolve(ctx.state.progress, slug, moves.length);

    const patch: Partial<Omit<User, "id">> = {};
    if (name !== ctx.state.user.name) patch.name = name;

    if (isNew) {
      trackPuzzleSolved(ctx.state, puzzle, {
        moves,
        url: referer,
        flash: isFlash,
      });
    }

    if (isNew) {
      const { skillLevel } = ctx.state.user;
      const newLevel = assessSkillLevel(puzzle, moves, {
        current: skillLevel,
        flash: isFlash,
      });

      if (newLevel && newLevel !== skillLevel) {
        patch.skillLevel = newLevel;
        trackSkillLevelUp(ctx.state, puzzle, {
          moves,
          url: referer,
          skillLevel: newLevel,
        });
      }
    }

    // One user write, alongside the aggregates. A Flash solve only counts
    // towards the Flash solves, apart from the leaderboard.
    const [user, puzzleStats] = await Promise.all([
      Object.keys(patch).length > 0
        ? setUser(ctx.state.userId, patch)
        : ctx.state.user,
      isFlash
        ? null
        : isNew
        ? updateSolutionAggregates(solution)
        : getPuzzleStats(slug),
      isFlash && isNew ? incrementFlashSolveCount(slug) : undefined,
    ]);
    ctx.state.user = user;

    // This solve included, like the leaderboard's own count.
    const flashSolves = flashSolvesBefore === undefined
      ? undefined
      : flashSolvesBefore + (isNew ? 1 : 0);

    if (isJson) {
      const data: CelebrationData = {
        isNewPath,
        puzzleStats: puzzleStats ?? defaultPuzzleStats,
        flashSolves,
      };
      return Response.json(data);
    }

    // Flash solves are off the leaderboard, so the solves page would only
    // show longer, unrelated solves: back to the solved board instead. The
    // dialog param stops the GET from detecting the solve again.
    if (isFlash) {
      const solvedUrl = new URL(`/puzzles/${slug}`, ctx.url);
      solvedUrl.search = encodeState({ moves: solve.moves });
      solvedUrl.searchParams.set("dialog", "solved");
      return Response.redirect(solvedUrl, 303);
    }

    const solutionsUrl = new URL(`/puzzles/${slug}/solutions`, ctx.url);
    return Response.redirect(solutionsUrl, 303);
  },
});

export default define.page<typeof handler>(function PuzzleDetails(props) {
  const href = useSignal(props.url.href);
  const puzzle = useSignal(props.data.puzzle);
  const mode = useSignal<"solve">("solve");
  const celebrationData = useSignal<CelebrationData | null>(null);
  const celebrationError = useSignal(false);
  const printUrl = props.url.hostname + props.url.pathname;
  const { hasFlash, isFlashOn } = props.data;

  const back = isTodaysPuzzle(props.data.puzzle)
    ? { href: "/", label: "Back to Home" }
    : {
      href: getPuzzleArchiveHref(props.data.puzzle) ?? "/",
      label: "Back to archive",
    };

  return (
    <>
      <Main>
        <Header back={{ href: back.href }} />

        <div className="flex items-center justify-between gap-fl-1 mt-2 flex-wrap">
          <h1 className="text-6 text-brand leading-tight">
            {props.data.puzzle.number && (
              <span className="font-4 tracking-wide">
                #{props.data.puzzle.number}
                {" "}
              </span>
            )}
            <span className="font-5">{props.data.puzzle.name}</span>
          </h1>

          {hasFlash
            ? (
              <FlashBadge
                puzzle={puzzle}
                href={href}
                isOn={isFlashOn}
                isExplained={props.data.isFlashExplained}
                hideMinMoves={!props.data.hasSolved}
                className="lg:mt-1"
              />
            )
            : (
              <DifficultyBadge
                puzzle={puzzle.value}
                hideMinMoves={!props.data.hasSolved}
                className="lg:mt-1"
              />
            )}
        </div>

        <div className="relative">
          <Board
            href={href}
            puzzle={puzzle}
            mode={mode}
            isNew={props.state.user.skillLevel === null}
          />

          {/* New players get the basics; the rest get Flash once stuck. */}
          <div
            className={clsx(
              "max-lg:max-w-2xs max-lg:place-self-center max-lg:mt-fl-2",
              "lg:absolute lg:ml-fl-3 lg:left-full lg:top-1/2 lg:-translate-y-1/2",
              "empty:hidden print:hidden",
            )}
          >
            {props.state.user.skillLevel === null
              ? <TutorialNudge />
              : hasFlash && !isFlashOn && !props.data.isFlashExplained && (
                <FlashNudge puzzle={puzzle} href={href} />
              )}
          </div>
        </div>
      </Main>

      <ControlsPanel
        puzzle={puzzle}
        href={href}
        hintCount={props.data.hintCount}
        isDev={isDev}
        showEdit={props.data.showEdit}
        isFlash={isFlashOn}
        className="print:hidden"
      />

      <PrintPanel />

      <a
        href={`/puzzles/${props.data.puzzle.slug}`}
        className={clsx(
          "not-print:hidden",
          "fixed left-0 top-fl-3 py-fl-2",
          "[writing-mode:vertical-rl] text-fl-0 rotate-180 font-mono",
        )}
      >
        {printUrl}
      </a>

      <HintDialog
        puzzle={puzzle}
        href={href}
        hideMinMoves={!props.data.hasSolved}
      />
      <SolutionDialog
        href={href}
        puzzle={puzzle}
        savedName={props.data.savedName}
        isFlash={isFlashOn}
      />

      {hasFlash && <FlashDialog puzzle={puzzle} href={href} isOn={isFlashOn} />}

      {/* Celebration + auto-post are paired: only named users get them */}
      {props.data.savedName && (
        <>
          <CelebrationDialog
            href={href}
            puzzle={puzzle}
            back={back}
            celebrationData={celebrationData}
            celebrationError={celebrationError}
            isFlash={isFlashOn}
          />
          <AutoPostSolution
            href={href}
            puzzle={puzzle}
            savedName={props.data.savedName}
            celebrationData={celebrationData}
            celebrationError={celebrationError}
          />
        </>
      )}
    </>
  );
});

async function parseSolveForm(
  req: Request,
): Promise<{ name: string; moves: Move[] }> {
  const form = await req.formData();
  const name = form.get("name")?.toString() ?? "";
  const rawMoves = form.get("moves")?.toString() ?? "";

  let moves: Move[] = [];
  try {
    moves = JSON.parse(rawMoves) as Move[];
  } catch {
    throw new HttpError(400, "Invalid moves format");
  }

  return { name, moves };
}
