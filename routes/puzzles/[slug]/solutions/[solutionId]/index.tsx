import { useSignal } from "@preact/signals";
import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Icon, Play } from "#/components/icons.tsx";
import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import { PuzzleName } from "#/components/puzzle-name.tsx";
import { getPuzzleSolution } from "#/db/solutions.ts";
import { Solution } from "#/db/types.ts";
import { Puzzle } from "#/game/types.ts";
import { encodeState } from "#/game/url.ts";
import Board from "#/islands/board.tsx";
import { ScoreBadge } from "#/islands/score-badge.tsx";
import { define } from "#/routes/puzzles/[slug]/_middleware.ts";

type Data = {
  puzzle: Puzzle;
  solution: Solution;
  userId: string;
};

export const handler = define.handlers<Data>({
  async GET(ctx) {
    const req = ctx.req;
    const { slug, solutionId } = ctx.params;
    const { puzzle } = ctx.state;

    const solution = await getPuzzleSolution(slug, solutionId);
    if (!solution) {
      throw new HttpError(
        404,
        `Unable to find solution with id: ${solutionId}`,
      );
    }

    const url = new URL(req.url);
    if (!url.searchParams.has("moves")) {
      url.search = encodeState(solution);
      return Response.redirect(url, 303);
    }

    return page({ puzzle, solution, userId: ctx.state.userId });
  },
});

export default define.page<typeof handler>(function SolutionReplayPage(props) {
  const puzzle = useSignal(props.data.puzzle);
  const href = useSignal(props.url.href);
  const mode = useSignal<"replay">("replay");
  const backHref = `/puzzles/${props.data.puzzle.slug}/solutions`;

  return (
    <>
      <Main>
        <Header
          back={{ href: backHref }}
        />

        <div className="flex items-end justify-between gap-fl-1 place-self-start w-full flex-wrap">
          <h1 className="text-text-1">
            <PuzzleName
              puzzle={props.data.puzzle}
              lead={`Solved by ${props.data.solution.name}`}
            />
          </h1>

          {/* This solve's moves against the shortest; no stars */}
          <ScoreBadge
            puzzle={puzzle}
            href={href}
            moves={props.data.solution.moves.length}
          />
        </div>

        <div className="grid gap-fl-2">
          <Board puzzle={puzzle} href={href} mode={mode} />

          {/* The page's main action, under the board, not in the footer */}
          <div className="flex flex-col items-center gap-2 place-self-center">
            <p className="m-0 text-2 text-text-2">Didn't catch it?</p>
            <a href={props.url.href} className="btn">
              <Icon icon={Play} />
              Watch again
            </a>
          </div>
        </div>
      </Main>

      <Panel />
    </>
  );
});
