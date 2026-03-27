// Puzzle route — renders the board and handles solution submission
import { useSignal } from "@preact/signals";
import clsx from "clsx/lite";
import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { PrintPanel } from "#/components/print-panel.tsx";
import { define } from "#/core.ts";
import { saveSolution } from "#/db/solutions.ts";
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
import { trackOnboardingCompleted, trackPuzzleSolved } from "#/lib/tracking.ts";

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

    // Case 0: preview for editor
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

    const puzzle = await getPuzzle(slug);

    if (!puzzle) {
      throw new HttpError(404, `Unable to find puzzle with slug: ${slug}`);
    }

    // Case 1: celebrate dialog — fetch fresh stats and render
    if (ctx.url.searchParams.get("dialog") === "celebrate") {
      const [puzzleStats, userStats] = await Promise.all([
        getPuzzleStats(slug),
        savedName ? getUserStats(ctx.state.userId) : Promise.resolve(null),
      ]);

      return page({
        puzzle,
        hintCount,
        puzzleStats: puzzleStats ?? defaultPuzzleStats,
        savedName,
        userStats,
      });
    }

    // Case 2: moves in URL — no-JS solve detection, redirect to celebrate
    // Guard: skip if a dialog is already set (prevents re-processing on reload)
    const { moves } = decodeState(ctx.url);
    const existingDialog = ctx.url.searchParams.get("dialog");

    if (moves.length > 0 && !existingDialog) {
      let board: Puzzle["board"];

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
      if (isValidSolution(board)) {
        // Anonymous user: redirect to solution dialog (name capture + no-JS path)
        if (!savedName) {
          const redirectUrl = new URL(ctx.url);
          redirectUrl.searchParams.set("dialog", "solution");
          return Response.redirect(redirectUrl, 303);
        }

        const { isNew, isNewPath } = await saveSolution({
          puzzleSlug: slug,
          name: savedName,
          moves,
          userId: ctx.state.userId,
        });

        if (isNew) {
          trackPuzzleSolved(ctx.state, puzzle, {
            moves,
            url: ctx.url.href,
          });
        }

        const redirectUrl = new URL(ctx.url);
        redirectUrl.searchParams.set("dialog", "celebrate");

        if (isNew && isNewPath) {
          redirectUrl.searchParams.set("new_path", "true");
        }

        return Response.redirect(redirectUrl, 303);
      }
    }

    // Case 3: regular puzzle load
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

    const { isNew, isNewPath } = await saveSolution({
      puzzleSlug: slug,
      name,
      moves,
      userId: ctx.state.userId,
    });

    if (!isNew) {
      return new Response(null, {
        status: 303,
        headers: { Location: redirectUrl },
      });
    }

    if (isNewPath && !fromSolutionDialog) {
      const url = new URL(redirectUrl, req.url);
      url.searchParams.set("new_path", "true");
      redirectUrl = url.href;
    }

    trackPuzzleSolved(ctx.state, puzzle, {
      moves,
      url: referer ?? "",
    });

    const responseHeaders = new Headers({ Location: redirectUrl });

    // Complete onboarding on a good solve
    if (
      moves.length <= puzzle.minMoves * 1.33 &&
      ctx.state.user.onboarding !== "done"
    ) {
      await setUser(ctx.state.userId, { onboarding: "done" });

      trackOnboardingCompleted(ctx.state, puzzle, {
        moves,
        url: referer ?? "",
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
