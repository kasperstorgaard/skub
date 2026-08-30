import { useSignal } from "@preact/signals";
import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { define } from "#/core.ts";
import type { GenOptions } from "#/game/candidates.ts";
import { getGeneratorOptions } from "#/game/cookies.ts";
import type { Puzzle } from "#/game/types.ts";
import Board from "#/islands/board.tsx";
import { GeneratorPanel } from "#/islands/generator-panel.tsx";
import { isDev } from "#/lib/env.ts";

const EMPTY_PUZZLE: Puzzle = {
  number: 0,
  name: "Untitled",
  slug: "untitled",
  createdAt: new Date(0),
  difficulty: "medium",
  minMoves: 0,
  board: {
    destination: { x: 3, y: 3 },
    pieces: [],
    walls: [],
  },
};

type PageData = {
  puzzle: Puzzle;
  /** Persisted knob values from the generator_options cookie. */
  options: Partial<GenOptions>;
};

export const handler = define.handlers<PageData>({
  GET(ctx) {
    // Dev-only: generation needs a writable candidate store, and the run itself
    // is an unbounded compute lever (see /api/generate).
    if (!isDev) throw new HttpError(404, "Not found");

    return page({
      puzzle: { ...EMPTY_PUZZLE, createdAt: new Date(Date.now()) },
      options: getGeneratorOptions(ctx.req.headers),
    });
  },
});

/**
 * The generator: knobs, a gated run, and an empty board that fills in when one
 * lands. Not a destination — an accepted board is stored as a candidate and the
 * page hands off to `/candidate`, so curation happens in one place whatever
 * made the board.
 */
export default define.page<typeof handler>(function GeneratePage(props) {
  const puzzle = useSignal(props.data.puzzle);
  const href = useSignal(props.url.href);
  const mode = useSignal<"readonly">("readonly");

  const url = new URL(props.req.url);

  return (
    <>
      <Main className="lg:relative">
        <Header url={url} back={{ href: "/" }} />

        <div className="flex justify-between items-center gap-fl-1 mt-2">
          <div className="flex flex-col">
            <h1 className="text-5 text-brand pr-1 leading-flat">Generate</h1>
            <p className="text-text-3 leading-tight ml-1">candidates</p>
          </div>
        </div>

        <div className="relative max-lg:pb-fl-5">
          <Board
            puzzle={puzzle}
            href={href}
            mode={mode}
            className="lg:col-[1/2] lg:row-[4/5]"
          />
        </div>
      </Main>

      <GeneratorPanel puzzle={puzzle} initialOptions={props.data.options} />
    </>
  );
});
