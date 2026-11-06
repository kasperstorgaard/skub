// Preview puzzle route — renders a user's draft board so it can be played, no
// solution submission. Analysis lives on /candidates; this is the play-it check
// anyone gets, dev or not.
import { useSignal } from "@preact/signals";
import clsx from "clsx/lite";
import { HttpError, page } from "fresh";

import { ActionsPanel } from "#/components/actions-panel.tsx";
import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { PrintPanel } from "#/components/print-panel.tsx";
import { PuzzleName } from "#/components/puzzle-name.tsx";
import { define } from "#/core.ts";
import { getUserPuzzleDraft } from "#/db/user.ts";
import type { Puzzle } from "#/game/types.ts";
import Board from "#/islands/board.tsx";
import { PlayControls } from "#/islands/play-controls.tsx";
import { ScoreBadge } from "#/islands/score-badge.tsx";
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

  return (
    <>
      <Main>
        <Header back={{ href: "/" }} />

        <div className="flex items-center justify-between gap-fl-1 flex-wrap">
          <h1 className="text-text-1">
            <PuzzleName puzzle={props.data.puzzle} />
          </h1>

          <ScoreBadge
            puzzle={puzzle}
            href={href}
            className="lg:mt-1"
          />
        </div>

        <div className="relative">
          <Board href={href} puzzle={puzzle} mode={mode} />
          <PlayControls
            puzzle={puzzle}
            href={href}
            isDev={isDev}
            isPreview
            className={clsx(
              // Mobile: as far under the board as the old footer's controls sat
              "max-lg:mt-fl-4",
              "lg:absolute lg:ml-fl-1 lg:left-full lg:top-1/2 lg:-translate-y-1/2",
            )}
          />
        </div>
      </Main>

      <ActionsPanel
        slug={props.data.puzzle.slug}
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
