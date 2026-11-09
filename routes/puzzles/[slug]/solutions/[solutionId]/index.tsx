import { useSignal } from "@preact/signals";
import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Icon, Play, Trophy } from "#/components/icons.tsx";
import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import { PuzzleName } from "#/components/puzzle-name.tsx";
import { BadgeStars } from "#/components/stars.tsx";
import { getPuzzleSolution } from "#/db/solutions.ts";
import { Solution } from "#/db/types.ts";
import { withFlashStart } from "#/game/flash.ts";
import { getSolveScore } from "#/game/score.ts";
import { encodeMoves } from "#/game/strings.ts";
import { Move, Puzzle } from "#/game/types.ts";
import Board from "#/islands/board.tsx";
import { ScoreBadge } from "#/islands/score-badge.tsx";
import { define } from "#/routes/puzzles/[slug]/_middleware.ts";

type Data = {
  puzzle: Puzzle;
  solution: Solution;
  /** The moves replayed: a Flash solve's come after its Flash start. */
  moves: Move[];
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

    // A Flash solve replays from its Flash start, as it was played.
    const skip = solution.flash ? puzzle.flashStart?.length ?? 0 : 0;
    const moves = solution.moves.slice(skip);

    // Also fixes old links that carry the Flash start in their moves.
    const url = new URL(req.url);
    const encoded = encodeMoves(moves);
    if (url.searchParams.get("moves") !== encoded) {
      url.searchParams.set("moves", encoded);
      return Response.redirect(url, 303);
    }

    return page({
      puzzle: skip
        ? withFlashStart(puzzle, solution.moves.slice(0, skip))
        : puzzle,
      solution,
      moves,
      userId: ctx.state.userId,
    });
  },
});

export default define.page<typeof handler>(function SolutionReplayPage(props) {
  const puzzle = useSignal(props.data.puzzle);
  const href = useSignal(props.url.href);
  const mode = useSignal<"replay">("replay");
  // Back to the tab the solution is listed on.
  const backHref = `/puzzles/${props.data.puzzle.slug}/solutions${
    props.data.solution.flash ? "?tab=flash" : ""
  }`;

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
              lead={`Solution by ${props.data.solution.name}`}
            />
          </h1>

          {/* This solution's moves against the shortest, and its stars */}
          <BadgeStars
            kinds={getSolveScore(props.data.puzzle, {
              moves: props.data.moves.length,
              isNewPath: !!props.data.solution.first,
              flash: !!props.data.solution.flash,
            })}
          >
            <ScoreBadge
              puzzle={puzzle}
              href={href}
              moves={props.data.moves.length}
            />
          </BadgeStars>
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

      <Panel>
        <div className="col-[2/3] flex items-start lg:col-auto lg:row-start-3">
          <a href="/highscore" className="btn">
            <Icon icon={Trophy} /> High score
          </a>
        </div>
      </Panel>
    </>
  );
});
