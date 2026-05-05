import { useSignal } from "@preact/signals";
import clsx from "clsx/lite";
import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { TutorialWatchButton } from "#/components/tutorial-watch-button.tsx";
import { define } from "#/core.ts";
import { Solution } from "#/db/types.ts";
import { setUser } from "#/db/user.ts";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import { getTutorialPuzzle } from "#/game/loader.ts";
import { decodeMoves, encodeMoves } from "#/game/strings.ts";
import { Move, Puzzle } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";
import { AutoPostSolution } from "#/islands/auto-post-solution.tsx";
import Board from "#/islands/board.tsx";
import { ControlsPanel } from "#/islands/controls-panel.tsx";
import { HintDialog } from "#/islands/hint-dialog.tsx";
import { TutorialDialog } from "#/islands/tutorial-dialog.tsx";
import { isDev } from "#/lib/env.ts";
import { trackTutorialCompleted } from "#/lib/tracking.ts";

type Data = {
  puzzle: Puzzle;
  showMeHref: string;
  solution: Solution;
};

export const handler = define.handlers<Data>({
  async GET(ctx) {
    const solutionRaw = Deno.env.get("TUTORIAL_SOLUTION");
    if (!solutionRaw) {
      throw new HttpError(500, "Tutorial puzzle solution not found");
    }

    const puzzle = await getTutorialPuzzle();
    if (!puzzle) throw new HttpError(404, "Tutorial puzzle not found");

    const { moves } = decodeState(ctx.url);
    const mode = ctx.url.searchParams.get("mode");
    const dialog = ctx.url.searchParams.get("dialog");
    const step = ctx.url.searchParams.get("tutorial_step");

    // Show dialog using redirect
    if (!moves?.length && !mode && (!dialog || !step)) {
      const url = new URL(ctx.url);
      url.searchParams.set("dialog", "tutorial");
      url.searchParams.set("tutorial_step", "welcome");
      return Response.redirect(url, 303);
    }

    // Solve mode with valid solution → redirect to completion
    if (!dialog && mode !== "replay" && moves.length > 0) {
      try {
        const board = resolveMoves(puzzle.board, moves);

        if (isValidSolution(board)) {
          const completionUrl = new URL(ctx.url);
          completionUrl.searchParams.delete("mode");
          completionUrl.searchParams.set("dialog", "tutorial");
          completionUrl.searchParams.set("tutorial_step", "solved");

          return Response.redirect(completionUrl, 303);
        }
      } catch {
        // Invalid moves — ignore, not solved
      }
    }

    const solution: Solution = {
      id: "",
      name: "tutorial",
      puzzleSlug: puzzle.slug,
      moves: decodeMoves(solutionRaw),
      userId: "",
    };

    const showMeUrl = new URL(ctx.url);

    showMeUrl.search = "";
    showMeUrl.searchParams.set("mode", "replay");
    showMeUrl.searchParams.set("moves", solutionRaw);
    showMeUrl.searchParams.set("dialog", "tutorial");
    showMeUrl.searchParams.set("tutorial_step", "replay");
    showMeUrl.searchParams.set("replay_speed", "1");

    return page({
      puzzle,
      showMeHref: showMeUrl.pathname + showMeUrl.search,
      solution,
    });
  },
  async POST(ctx) {
    const puzzle = await getTutorialPuzzle();
    if (!puzzle) throw new HttpError(400, "Tutorial not found");

    const isJson = ctx.req.headers.get("content-type")?.includes(
      "application/json",
    );

    // Form POST: "I'm ready" button from the tutorial dialog. Explicit
    // completion signal — sets beginner, tracks, redirects home.
    if (!isJson) {
      // only set skill level if not already set
      if (!ctx.state.user.skillLevel) {
        await setUser(ctx.state.userId, { skillLevel: "beginner" });

        trackTutorialCompleted(ctx.state, puzzle, {
          moves: [],
          url: ctx.req.headers.get("referer") ?? "",
        });
      }
      return new Response(null, {
        status: 303,
        headers: { Location: "/" },
      });
    }

    // JSON POST: AutoPostSolution — user solved the tutorial interactively.
    const { moves } = await ctx.req.json() as { moves: Move[] };

    if (!isValidSolution(resolveMoves(puzzle.board, moves))) {
      throw new HttpError(400, "Solution is not valid");
    }

    await setUser(ctx.state.userId, { skillLevel: "beginner" });
    trackTutorialCompleted(ctx.state, puzzle, {
      moves,
      url: ctx.req.headers.get("referer") ?? "",
    });

    const url = new URL("/puzzles/tutorial", ctx.url);
    url.searchParams.delete("mode");
    url.searchParams.set("dialog", "tutorial");
    url.searchParams.set("tutorial_step", "solved");
    url.searchParams.set("moves", encodeMoves(moves));

    return new Response(null, {
      status: 303,
      headers: { Location: url.href },
    });
  },
});

export default define.page<typeof handler>(function PuzzleTutorial(props) {
  const href = useSignal(props.url.href);
  const puzzle = useSignal(props.data.puzzle);

  const urlMode = props.url.searchParams.get("mode");
  const mode = useSignal(
    (urlMode === "solve" || urlMode === "replay" ? urlMode : "readonly") as
      | "readonly"
      | "replay"
      | "solve",
  );

  const url = new URL(props.req.url);

  return (
    <>
      <Main>
        <Header url={url} back={{ href: "/" }} />

        <h1 className="text-5 text-brand mt-2">{puzzle.value.name}</h1>

        <div className="relative max-lg:pb-fl-7">
          <Board
            href={href}
            puzzle={puzzle}
            mode={mode}
            isNew
          />

          {urlMode === "solve" && (
            <TutorialWatchButton
              showMeHref={props.data.showMeHref}
              className={clsx(
                "absolute",
                "max-lg:bottom-0 max-lg:left-1/2 max-lg:-translate-x-1/2",
                "lg:ml-fl-3 lg:left-full lg:top-1/2 lg:-translate-y-1/2",
              )}
            />
          )}
        </div>
      </Main>

      <ControlsPanel puzzle={puzzle} href={href} isDev={isDev} />

      <AutoPostSolution
        href={href}
        puzzle={puzzle}
        savedName="tutorial"
      />

      <HintDialog puzzle={puzzle} href={href} />

      <TutorialDialog
        href={href}
        solution={props.data.solution}
      />
    </>
  );
});
