// Puzzle route — renders the board and handles solution submission
import { trace } from "@opentelemetry/api";
import { useSignal } from "@preact/signals";
import clsx from "clsx/lite";
import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { PrintPanel } from "#/components/print-panel.tsx";
import { define } from "#/core.ts";
import { saveSolution } from "#/db/solutions.ts";
import { setUser } from "#/db/user.ts";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import { getHintCount } from "#/game/cookies.ts";
import { getPuzzle } from "#/game/loader.ts";
import { defaultPuzzleStats } from "#/game/stats.ts";
import type { UserStats } from "#/game/streak.ts";
import { Move, Puzzle, PuzzleStats } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";
import { AutoPostSolution } from "#/islands/auto-post-solution.tsx";
import Board from "#/islands/board.tsx";
import { CelebrationDialog } from "#/islands/celebration-dialog.tsx";
import { ControlsPanel } from "#/islands/controls-panel.tsx";
import { DifficultyBadge } from "#/islands/difficulty-badge.tsx";
import { HintDialog } from "#/islands/hint-dialog.tsx";
import { SolutionDialog } from "#/islands/solution-dialog.tsx";
import { SolveDialog } from "#/islands/solve-dialog.tsx";
import { isDev } from "#/lib/env.ts";
import { withSpan } from "#/lib/tracing.ts";
import { trackPuzzleSolved, trackSkillLevelUp } from "#/lib/tracking.ts";
import { TutorialNudge } from "#/components/tutorial-nudge.tsx";

type PageData = {
  puzzle: Puzzle;
  hintCount: number;
  puzzleStats: PuzzleStats;
  savedName: string | null;
  userStats: UserStats | null;
};

export const handler = define.handlers<PageData>({
  async GET(ctx) {
    const { slug } = ctx.params;
    const savedName = ctx.state.user?.name ?? null;

    const puzzle = await getPuzzle(slug);

    if (!puzzle) {
      throw new HttpError(404, `Unable to find puzzle with slug: ${slug}`);
    }

    const hintCount = getHintCount(ctx.req.headers);

    // No-JS solve detection: moves are encoded in the URL on each navigation.
    // JS users go via AutoPostSolution → POST instead. The dialog guard prevents
    // re-processing when the page reloads after a redirect.
    const { moves } = decodeState(ctx.url);
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

    return page({
      puzzle,
      hintCount,
      puzzleStats: defaultPuzzleStats,
      savedName,
      userStats: null,
    });
  },
  async POST(ctx) {
    const req = ctx.req;
    const { slug } = ctx.params;
    const referer = ctx.req.headers.get("referer") ?? "";

    const form = await req.formData();
    const name = form.get("name")?.toString();
    const source = form.get("source")?.toString();

    const puzzle = await getPuzzle(slug);
    if (!puzzle) {
      throw new HttpError(404, `Unable to find puzzle with slug: ${slug}`);
    }

    if (!name) throw new HttpError(400, "Must provide a username");

    const rawMoves = form.get("moves")?.toString() ?? "";
    const moves = JSON.parse(rawMoves) as Move[];

    if (!isValidSolution(resolveMoves(puzzle.board, moves))) {
      throw new HttpError(400, "Solution is not valid");
    }

    const activeSpan = trace.getActiveSpan();
    activeSpan?.setAttribute("solution.source", source ?? "unknown");
    activeSpan?.setAttribute("solution.moves", moves.length);

    const [{ isNew, isNewPath }] = await Promise.all([
      withSpan("puzzle.save_solution", async (span) => {
        const result = await saveSolution({
          puzzleSlug: slug,
          name,
          moves,
          userId: ctx.state.userId,
        });
        span.setAttribute("solution.is_new", result.isNew);
        span.setAttribute("solution.is_new_path", result.isNewPath);
        return result;
      }),
      setUser(ctx.state.userId, { name }),
    ]);

    const redirectUrl = getSolveRedirectUrl(ctx, source, { isNewPath });

    if (!isNew) return Response.redirect(redirectUrl, 303);

    trackPuzzleSolved(ctx.state, puzzle, { moves, url: referer });

    const { skillLevel } = ctx.state.user;

    // Promote to expert: medium or hard puzzle solved perfectly
    if (
      (puzzle.difficulty === "medium" || puzzle.difficulty === "hard") &&
      moves.length === puzzle.minMoves &&
      skillLevel !== "expert"
    ) {
      await setUser(ctx.state.userId, { skillLevel: "expert" });
      trackSkillLevelUp(ctx.state, puzzle, {
        moves,
        url: referer,
        skillLevel: "expert",
      });
    } else if (
      // Promote to intermediate: medium puzzle solved within 1.33x optimal
      puzzle.difficulty === "medium" &&
      moves.length <= puzzle.minMoves * 1.33 &&
      skillLevel !== "intermediate" && skillLevel !== "expert"
    ) {
      await setUser(ctx.state.userId, { skillLevel: "intermediate" });
      trackSkillLevelUp(ctx.state, puzzle, {
        moves,
        url: referer,
        skillLevel: "intermediate",
      });
    } else if (skillLevel === null) {
      // Promote to beginner on first solve (skipped tutorial path)
      await setUser(ctx.state.userId, { skillLevel: "beginner" });
    }

    return Response.redirect(redirectUrl, 303);
  },
});

export default define.page<typeof handler>(function PuzzleDetails(props) {
  const href = useSignal(props.url.href);
  const puzzle = useSignal(props.data.puzzle);
  const mode = useSignal<"solve">("solve");
  const printUrl = props.url.hostname + props.url.pathname;

  const url = new URL(props.req.url);

  return (
    <>
      <Main>
        <Header url={url} back={{ href: "/" }} share />

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

          <DifficultyBadge puzzle={puzzle} className="lg:mt-1" />
        </div>

        <div className="relative max-lg:pb-fl-7">
          <Board href={href} puzzle={puzzle} mode={mode} />

          {props.state.user.skillLevel === null && (
            <TutorialNudge
              className={clsx(
                "max-lg:max-w-2xs max-lg:justify-self-center max-lg:mt-fl-2",
                "lg:absolute lg:ml-fl-3 lg:left-full lg:top-1/2 lg:-translate-y-1/2",
              )}
            />
          )}
        </div>
      </Main>

      <ControlsPanel
        puzzle={puzzle}
        href={href}
        hintCount={props.data.hintCount}
        isDev={isDev}
        skillLevel={props.state.user.skillLevel}
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

      <HintDialog puzzle={puzzle} href={href} />
      <SolveDialog puzzle={puzzle} href={href} />

      <SolutionDialog
        href={href}
        puzzle={puzzle}
        savedName={props.data.savedName}
      />

      <CelebrationDialog
        href={href}
        puzzle={puzzle}
        stats={props.data.puzzleStats}
        userStats={props.data.userStats}
      />

      {/* Client-side auto-post for named users */}
      {props.data.savedName && (
        <AutoPostSolution
          href={href}
          puzzle={puzzle}
          savedName={props.data.savedName}
        />
      )}
    </>
  );
});

function getSolveRedirectUrl(
  ctx: { req: Request; params: Record<string, string> },
  source: string | undefined,
  options?: { isNewPath?: boolean },
): URL {
  const { slug } = ctx.params;
  const url = new URL(ctx.req.headers.get("referer") ?? "", ctx.req.url);

  if (source === "solution-dialog") {
    url.pathname = `/puzzles/${slug}/solutions`;
    return url;
  }

  url.pathname = `/puzzles/${slug}`;
  url.searchParams.set("dialog", "celebrate");
  if (options?.isNewPath) url.searchParams.set("new_path", "true");

  return url;
}
