// Puzzle route — renders the board and handles solution submission
import { useSignal } from "@preact/signals";
import clsx from "clsx/lite";
import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { PrintPanel } from "#/components/print-panel.tsx";
import { define } from "#/core.ts";
import { addSolution, getCanonicalUserSolution } from "#/db/solutions.ts";
import { getPuzzleStats, getUserStats } from "#/db/stats.ts";
import { getUserPuzzleDraft, setUser } from "#/db/user.ts";
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
import { posthog } from "#/lib/posthog.ts";

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

    const hintCount = getHintCount(ctx.req.headers);

    const savedName = ctx.state.user?.name ?? null;

    if (slug === "preview") {
      const puzzle = await getUserPuzzleDraft(ctx.state.userId);

      if (!puzzle) throw new HttpError(500, "No stored puzzle");

      puzzle.slug = "preview";
      puzzle.number = 0;

      return page({
        puzzle,
        hintCount,
        puzzleStats: defaultPuzzleStats,
        savedName,
        userStats: null,
      });
    }

    const { moves } = decodeState(ctx.url);

    const [puzzle, puzzleStats, userStats] = await Promise.all([
      getPuzzle(slug),
      getPuzzleStats(slug),
      savedName ? getUserStats(ctx.state.userId) : Promise.resolve(null),
    ]);

    if (!puzzle) {
      throw new HttpError(404, `Unable to find puzzle with slug: ${slug}`);
    }

    // If the user is navigating here with server side or direct link, see if this is a valid solution
    if (moves.length > 0) {
      let board: Puzzle["board"];
      const dialog = ctx.url.searchParams.get("dialog");

      try {
        board = resolveMoves(puzzle.board, moves);
      } catch {
        // Invalid moves — clear them
        const url = new URL(`/puzzles/${slug}`, ctx.url);
        url.searchParams.set("error", "invalid move");
        return Response.redirect(url, 303);
      }

      /**
       * Named user with a valid solve: post solution and redirect to the
       * celebration dialog. The dialog=celebrate guard prevents re-posting on refresh.
       *
       * This approach is primarily used for server-only solution detection.
       */
      if (isValidSolution(board) && !dialog) {
        const existing = ctx.state.userId
          ? await getCanonicalUserSolution(ctx.state.userId, slug, moves)
          : null;

        // New users without a name get redirected to solution dialog
        if (!existing && !savedName) {
          // Anonymous user: redirect to open the solution dialog (also enables no-JS path)
          const redirectUrl = new URL(ctx.url);
          redirectUrl.searchParams.set("dialog", "solution");
          return Response.redirect(redirectUrl, 303);
        }

        let isNewPath = false;
        if (!existing && savedName) {
          const result = await addSolution({
            puzzleSlug: slug,
            name: savedName,
            moves,
            userId: ctx.state.userId,
          });
          isNewPath = result.isNewPath;

          posthog?.capture({
            distinctId: ctx.state.trackingId,
            event: "puzzle_solved",
            properties: {
              $current_url: ctx.url.href,
              $process_person_profile: ctx.state.cookieChoice === "accepted",
              puzzle_slug: slug,
              puzzle_difficulty: puzzle.difficulty,
              puzzle_min_moves: puzzle.minMoves,
              game_moves: moves.length,
            },
          });
        }

        const redirectUrl = new URL(ctx.url);
        redirectUrl.searchParams.set("dialog", "celebrate");
        if (isNewPath) redirectUrl.searchParams.set("new_path", "true");
        return Response.redirect(redirectUrl, 303);
      }
    }

    // Stats are fetched at page load, so a user who takes a long time to solve
    // will see slightly stale numbers in the dialog. Acceptable — this is cosmetic.
    return page({
      puzzle,
      hintCount,
      puzzleStats: puzzleStats ?? defaultPuzzleStats,
      savedName,
      userStats,
    });
  },
  async POST(ctx) {
    const req = ctx.req;
    const { slug } = ctx.params;
    const referer = ctx.req.headers.get("referer");

    if (slug === "preview") {
      throw new HttpError(500, "Preview puzzle solutions cannot be submitted");
    }

    const form = await req.formData();
    const name = form.get("name")?.toString();
    const fromSolutionDialog = form.get("source") === "solution-dialog";

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

    await setUser(ctx.state.userId, { name });

    // SolutionDialog posts (new players) go to the solves page;
    // auto-posts from named users go to the celebrate dialog.
    let redirectUrl: string;
    if (fromSolutionDialog) {
      redirectUrl = `/puzzles/${slug}/solutions`;
    } else {
      const celebrateUrl = new URL(referer ?? "", req.url);
      celebrateUrl.pathname = `/puzzles/${slug}`;
      celebrateUrl.searchParams.set("dialog", "celebrate");
      redirectUrl = celebrateUrl.href;
    }

    // Check for existing solution, we don't want duplicates
    const existingSolution = ctx.state.userId
      ? await getCanonicalUserSolution(ctx.state.userId, slug, moves)
      : null;

    if (existingSolution) {
      return new Response(null, {
        status: 303,
        headers: { Location: redirectUrl },
      });
    }

    const { isNewPath } = await addSolution({
      puzzleSlug: slug,
      name,
      moves,
      userId: ctx.state.userId,
    });

    if (isNewPath && !fromSolutionDialog) {
      const url = new URL(redirectUrl, req.url);
      url.searchParams.set("new_path", "true");
      redirectUrl = url.href;
    }

    posthog?.capture({
      distinctId: ctx.state.trackingId,
      event: "puzzle_solved",
      properties: {
        $current_url: referer,
        $process_person_profile: ctx.state.cookieChoice === "accepted",

        puzzle_slug: slug,
        puzzle_difficulty: puzzle.difficulty,
        puzzle_min_moves: puzzle.minMoves,
        game_moves: moves?.length,
      },
    });

    const responseHeaders = new Headers({ Location: redirectUrl });

    // Complete onboarding on a good solve
    if (
      moves.length <= puzzle.minMoves * 1.33 &&
      ctx.state.user.onboarding !== "done"
    ) {
      await setUser(ctx.state.userId, { onboarding: "done" });

      posthog?.capture({
        distinctId: ctx.state.trackingId,
        event: "onboarding_completed",
        properties: {
          $current_url: referer,
          $process_person_profile: ctx.state.cookieChoice === "accepted",
          puzzle_slug: slug,
          game_moves: moves.length,
          puzzle_min_moves: puzzle.minMoves,
        },
      });
    }

    return new Response(null, { status: 303, headers: responseHeaders });
  },
});

export default define.page<typeof handler>(function PuzzleDetails(props) {
  const { slug } = props.params;

  const href = useSignal(props.url.href);
  const puzzle = useSignal(props.data.puzzle);
  const mode = useSignal<"solve">("solve");
  const printUrl = props.url.hostname + props.url.pathname;
  const isPreview = slug === "preview";

  const url = new URL(props.req.url);

  return (
    <>
      <Main>
        <Header url={url} back={{ href: "/" }} share />

        <div className="flex items-center justify-between gap-fl-1 mt-2 flex-wrap">
          <h1 className="text-6 text-brand leading-tight">
            <span className="font-4 tracking-wide">
              #{props.data.puzzle.number}
              {" "}
            </span>
            <span className="font-5">{props.data.puzzle.name}</span>
          </h1>

          <DifficultyBadge puzzle={puzzle} className="lg:mt-1" />
        </div>

        <Board href={href} puzzle={puzzle} mode={mode} />
      </Main>

      <ControlsPanel
        puzzle={puzzle}
        href={href}
        hintCount={props.data.hintCount}
        isDev={isDev}
        isPreview={isPreview}
        onboarding={props.state.user.onboarding}
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
        isPreview={isPreview}
        savedName={props.data.savedName}
      />

      <CelebrationDialog
        href={href}
        puzzle={puzzle}
        stats={props.data.puzzleStats}
        userStats={props.data.userStats}
      />

      {/* Client-side auto-post for named users */}
      {props.data.savedName && !isPreview && (
        <AutoPostSolution
          href={href}
          puzzle={puzzle}
          savedName={props.data.savedName}
        />
      )}
    </>
  );
});
