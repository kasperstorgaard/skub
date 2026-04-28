import { useSignal } from "@preact/signals";
import clsx from "clsx/lite";
import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Icon, Play } from "#/components/icons.tsx";
import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import { getPuzzleSolution } from "#/db/solutions.ts";
import { Solution } from "#/db/types.ts";
import { Puzzle } from "#/game/types.ts";
import { encodeState } from "#/game/url.ts";
import Board from "#/islands/board.tsx";
import { DifficultyBadge } from "#/islands/difficulty-badge.tsx";
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
  const url = new URL(props.req.url);
  const backHref = `/puzzles/${props.data.puzzle.slug}/solutions`;

  return (
    <>
      <Main>
        <Header
          url={url}
          back={{ href: backHref }}
          share={{ params: true }}
        />

        <div className="flex items-center justify-between place-self-start mt-2 w-full flex-wrap">
          <div className="flex flex-col">
            <h1 className="text-5 text-brand leading-tight">
              {props.data.puzzle.number && `#${props.data.puzzle.number} `}
              {props.data.puzzle.name}
            </h1>
            <p className="text-fl-0 text-text-3 leading-tight italic -mb-[.6lh] -mt-[.4lh]">
              solved by{" "}
              <span className="text-text-2">{props.data.solution.name}</span>
            </p>
          </div>

          <DifficultyBadge puzzle={puzzle} className="lg:mt-1" />
        </div>

        <Board puzzle={puzzle} href={href} mode={mode} />
      </Main>

      <Panel>
        <div
          className={clsx(
            "col-[2/3] flex items-start gap-fl-1 flex-wrap",
            "lg:col-auto lg:row-start-3 lg:flex-col lg:self-end",
          )}
        >
          <a
            href={props.url.href}
            className="btn"
          >
            <Icon icon={Play} />
            Watch again
          </a>
        </div>
      </Panel>
    </>
  );
});
