// Preview puzzle route — renders a user's draft board so it can be played, no
// solution submission. Analysis lives on /candidate; this is the play-it check
// anyone gets, dev or not.
import { useSignal } from "@preact/signals";
import clsx from "clsx/lite";
import { HttpError, page } from "fresh";

import { DifficultyBadge } from "#/components/difficulty-badge.tsx";
import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { PrintPanel } from "#/components/print-panel.tsx";
import { define } from "#/core.ts";
import { getUserPuzzleDraft } from "#/db/user.ts";
import type { Puzzle } from "#/game/types.ts";
import Board from "#/islands/board.tsx";
import { ControlsPanel } from "#/islands/controls-panel.tsx";
import { isDev } from "#/lib/env.ts";

type PageData = {
  puzzle: Puzzle;
};

export const handler = define.handlers<PageData>({
  async GET(ctx) {
    const draft = await getUserPuzzleDraft(ctx.state.userId);
    if (!draft) throw new HttpError(500, "No stored puzzle");

    const puzzle: Puzzle = { ...draft, slug: "preview", number: 0 };

    return page({ puzzle });
  },
});

export default define.page<typeof handler>(function PreviewPuzzle(props) {
  const href = useSignal(props.url.href);
  const puzzle = useSignal(props.data.puzzle);
  const mode = useSignal<"solve">("solve");
  const printUrl = props.url.hostname + props.url.pathname;

  const url = new URL(props.req.url);

  return (
    <>
      <Main>
        <Header url={url} back={{ href: "/" }} />

        <div className="flex items-center justify-between gap-fl-1 mt-2 flex-wrap">
          <h1 className="text-6 text-brand leading-tight">
            {props.data.puzzle.number
              ? (
                <span className="font-4 tracking-wide">
                  #{props.data.puzzle.number}
                  {" "}
                </span>
              )
              : null}
            <span className="font-5">{props.data.puzzle.name}</span>
          </h1>

          <DifficultyBadge puzzle={puzzle.value} className="lg:mt-1" />
        </div>

        <Board href={href} puzzle={puzzle} mode={mode} />
      </Main>

      <ControlsPanel
        puzzle={puzzle}
        href={href}
        isDev={isDev}
        isPreview
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
    </>
  );
});
