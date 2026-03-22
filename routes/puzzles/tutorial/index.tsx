import { useSignal } from "@preact/signals";
import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { define } from "#/core.ts";
import { Solution } from "#/db/types.ts";
import { setUser } from "#/db/user.ts";
import { getPuzzle } from "#/game/loader.ts";
import { Puzzle } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";
import Board from "#/islands/board.tsx";
import { ControlsPanel } from "#/islands/controls-panel.tsx";
import { TutorialDialog } from "#/islands/tutorial-dialog.tsx";
import { isDev } from "#/lib/env.ts";

type Data = {
  puzzle: Puzzle;
  solution: Omit<Solution, "id" | "name">;
};

export const handler = define.handlers<Data>({
  async GET(ctx) {
    const solutionRaw = Deno.env.get("TUTORIAL_SOLUTION");
    if (!solutionRaw) {
      throw new HttpError(500, "Tutorial puzzle solution not found");
    }

    const redirectUrl = new URL(ctx.url);
    redirectUrl.searchParams.set("moves", solutionRaw);

    const puzzle = await getPuzzle("tutorial");
    if (!puzzle) throw new HttpError(404, "Tutorial puzzle not found");

    if (!ctx.url.searchParams.has("moves")) {
      if (ctx.state.user.onboarding === "new") {
        await setUser(ctx.state.userId, { onboarding: "started" });
      }
      return new Response(null, {
        status: 303,
        headers: { Location: redirectUrl.href },
      });
    }

    const { moves } = decodeState(redirectUrl);

    return page({
      puzzle,
      solution: {
        puzzleSlug: puzzle.slug,
        moves,
      },
    });
  },
  // dismiss dialog
  POST() {
    return new Response("", {
      status: 303,
      headers: new Headers({ Location: "/" }),
    });
  },
});

export default define.page<typeof handler>(function PuzzleTutorial(props) {
  const href = useSignal(props.url.href);
  const puzzle = useSignal(props.data.puzzle);
  const mode = useSignal<"readonly" | "replay">(
    props.url.searchParams.has("replay_speed") ? "replay" : "readonly",
  );

  const url = new URL(props.req.url);

  return (
    <>
      <Main>
        <Header url={url} back={{ href: "/" }} />

        <h1 className="text-5 text-brand mt-2">{puzzle.value.name}</h1>

        <Board
          href={href}
          puzzle={puzzle}
          mode={mode}
        />
      </Main>

      <ControlsPanel puzzle={puzzle} href={href} isDev={isDev} hintCount={0} />

      <TutorialDialog
        open
        href={href}
        mode={mode}
        solution={props.data.solution}
      />
    </>
  );
});
