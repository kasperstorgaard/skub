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
import { formatNumber } from "#/lib/format.ts";

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
      <Main className="max-lg:row-span-full justify-stretch content-start">
        <Header back={{ href: "/", label: "Back to home" }} />

        <h1 className="text-brand text-6 leading-flat">High score</h1>

        {rows.length === 0
          ? <p className="text-3 text-text-2">No stars earned yet.</p>
          : (
            <div className="grid content-start gap-fl-4">
              {/* The top three, bigger and with their stars */}
              <ol className="grid gap-fl-2 m-0 p-0 list-none">
                {rows.slice(0, 3).map((row, index) => (
                  <li
                    key={row.userId}
                    className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-fl-1 p-0"
                  >
                    <span className="text-4 text-text-3 tabular-nums">
                      {index + 1}
                    </span>
                    <span className="grid min-w-0">
                      <Name
                        name={row.name}
                        isViewer={row.userId === userId}
                        className="text-4 font-medium"
                      />
                      <StarCounts
                        userScore={row.userScore}
                        className="text-1 text-text-3"
                      />
                    </span>
                    <Points
                      userScore={row.userScore}
                      className="text-4 font-semibold"
                    />
                  </li>
                ))}
              </ol>

              {(rows.length > 3 || viewerRow) && (
                <ol start={4} className="grid gap-1 m-0 p-0 list-none">
                  {rows.slice(3).map((row, index) => (
                    <li
                      key={row.userId}
                      className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-fl-1 p-0 text-3"
                    >
                      <span className="text-text-3 tabular-nums">
                        {index + 4}
                      </span>
                      <Name
                        name={row.name}
                        isViewer={row.userId === userId}
                      />
                      <Points userScore={row.userScore} />
                    </li>
                  ))}

                  {
                    /* The viewer, past the top rows: no rank, it isn't
                      known */
                  }
                  {viewerRow && (
                    <>
                      <li className="p-0 text-text-3" aria-hidden="true">
                        …
                      </li>
                      <li className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-fl-1 p-0 text-3">
                        <span />
                        <Name name={viewerRow.name} isViewer />
                        <Points userScore={viewerRow.userScore} />
                      </li>
                    </>
                  )}
                </ol>
              )}
            </div>
          )}
      </Main>

      <Panel />
    </>
  );
});

type NameProps = { name: string; isViewer: boolean; className?: string };

/** A player's name, in the brand colour for the viewer's own. */
function Name({ name, isViewer, className }: NameProps) {
  return (
    <span
      className={clsx(
        "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
        isViewer ? "text-brand" : "text-text-1",
        className,
      )}
    >
      {name}
    </span>
  );
}

type PointsProps = { userScore: UserScore; className?: string };

function Points({ userScore, className }: PointsProps) {
  return (
    <span className={clsx("text-text-1 tabular-nums text-right", className)}>
      {formatNumber(getTotalScore(userScore))}
    </span>
  );
}
