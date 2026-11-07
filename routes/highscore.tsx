import clsx from "clsx/lite";
import { page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import { StarCounts } from "#/components/stars.tsx";
import { define } from "#/core.ts";
import { type HighscoreEntry, listHighscore } from "#/db/score.ts";
import { getUserNames } from "#/db/user.ts";
import {
  getProgressScore,
  getTotalScore,
  type UserScore,
} from "#/game/score.ts";

type Row = HighscoreEntry & { name: string };

type PageData = {
  rows: Row[];
  /** The viewer's own row, when they have stars but aren't in the top rows. */
  viewerRow: Row | null;
};

export const handler = define.handlers<PageData>({
  async GET(ctx) {
    const { userId, user, score } = ctx.state;

    const entries = await listHighscore();
    const names = await getUserNames(entries.map((entry) => entry.userId));
    const rows = entries.map((entry) => ({
      ...entry,
      name: names.get(entry.userId) ?? "Anonymous",
    }));

    const userScore = getProgressScore(score);
    const isListed = rows.some((row) => row.userId === userId);
    const viewerRow = !isListed && getTotalScore(userScore) > 0
      ? { userId, userScore, name: user.name ?? "You" }
      : null;

    return page({ rows, viewerRow });
  },
});

export default define.page<typeof handler>(function HighscorePage(props) {
  const { rows, viewerRow } = props.data;
  const { userId } = props.state;

  return (
    <>
      <Main className="max-lg:row-span-full content-start">
        <Header back={{ href: "/", label: "Back to home" }} />

        <h1 className="text-brand text-6 leading-flat">High score</h1>

        {rows.length === 0
          ? <p className="text-3 text-text-2">No stars earned yet.</p>
          : (
            <ol className="m-0 p-0 list-none flex flex-col gap-y-2 w-full">
              {rows.map((row, index) => (
                <HighscoreRow
                  key={row.userId}
                  rank={index + 1}
                  name={row.name}
                  userScore={row.userScore}
                  isViewer={row.userId === userId}
                />
              ))}

              {viewerRow && (
                <>
                  <li className="p-0 px-2 text-0 text-text-3">…</li>
                  <HighscoreRow
                    name={viewerRow.name}
                    userScore={viewerRow.userScore}
                    isViewer
                  />
                </>
              )}
            </ol>
          )}
      </Main>

      <Panel />
    </>
  );
});

type HighscoreRowProps = {
  name: string;
  userScore: UserScore;
  /** Left out past the top rows, where it isn't known. */
  rank?: number;
  isViewer: boolean;
};

function HighscoreRow(
  { name, userScore, rank, isViewer }: HighscoreRowProps,
) {
  return (
    <li
      className={clsx(
        "grid grid-cols-[2rem_1fr_auto] items-center gap-x-fl-1",
        "p-0 px-2 pr-3 py-2 rounded-2",
        "bg-surface-3/20 border-text-3/20 border-1 border-l-3 border-l-text-3",
        "data-viewer:border-l-brand",
      )}
      data-viewer={isViewer ? true : undefined}
    >
      <span className="text-center text-3 text-text-3 tabular-nums">
        {rank}
      </span>

      <span className="min-w-0 text-3 text-text-2 overflow-hidden text-ellipsis whitespace-nowrap">
        {name}
      </span>

      <span className="flex items-center gap-fl-1">
        <StarCounts
          userScore={userScore}
          className="text-1 text-text-3 max-sm:hidden"
        />
        <span className="font-5 text-4 text-text-1 leading-flat tabular-nums">
          {getTotalScore(userScore)}
        </span>
      </span>
    </li>
  );
}
