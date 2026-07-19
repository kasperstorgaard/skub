import { useSignal } from "@preact/signals";
import { page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { define } from "#/core.ts";
import type { Puzzle } from "#/game/types.ts";
import Board from "#/islands/board.tsx";
import { DifficultyBadge } from "#/islands/difficulty-badge.tsx";
import { GeneratorPanel } from "#/islands/generator-panel.tsx";

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

export const handler = define.handlers<Puzzle>({
  GET() {
    // The generator always starts from an empty board; a candidate is produced
    // client-side and only becomes a draft once the curator picks "Edit this".
    return page({ ...EMPTY_PUZZLE, createdAt: new Date(Date.now()) });
  },
});

export default define.page<typeof handler>(function GeneratePage(props) {
  const puzzle = useSignal(props.data);
  const href = useSignal(props.url.href);
  const mode = useSignal<"readonly">("readonly");

  const url = new URL(props.req.url);

  return (
    <>
      <Main className="lg:relative">
        <Header url={url} back={{ href: "/" }} />

        <div className="flex justify-between items-center gap-fl-1 mt-2">
          <div className="flex flex-col">
            <h1 className="text-5 text-brand pr-1 leading-flat">New</h1>
            <p className="text-text-3 leading-tight ml-1">generate</p>
          </div>

          <DifficultyBadge puzzle={puzzle} className="lg:mt-1" />
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
      <GeneratorPanel puzzle={puzzle} />
    </>
  );
});
