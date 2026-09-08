import { page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { Thumbnail } from "#/components/thumbnail.tsx";
import { define } from "#/core.ts";
import { readTiles } from "#/game/tile-store.ts";
import { TILE_CATEGORIES, type TileEntry } from "#/game/types.ts";
import { isDev } from "#/lib/env.ts";

type TilesData = {
  tiles: TileEntry[];
  /** Authoring is dev-only: production's filesystem is read-only. */
  canAuthor: boolean;
};

export const handler = define.handlers<TilesData>({
  async GET() {
    return page({ tiles: await readTiles(), canAuthor: isDev });
  },
});

export default define.page<typeof handler>(function TilesPage(props) {
  const url = new URL(props.req.url);

  return (
    <Main>
      <Header url={url} back={{ href: "/" }} />

      <div className="flex justify-between items-center gap-fl-1 mt-2 mb-fl-2">
        <h1 className="text-5 text-brand leading-flat">Tiles</h1>

        {props.data.canAuthor && (
          <a href="/tiles/new" className="btn">New tile</a>
        )}
      </div>

      {!props.data.tiles.length && (
        <p className="text-text-3">
          No tiles yet. Build the first one and the composer has something to
          deal.
        </p>
      )}

      <div className="flex flex-col gap-fl-3">
        {TILE_CATEGORIES.map((category) => {
          const rows = props.data.tiles.filter((row) =>
            row.category === category
          );
          if (!rows.length) return null;

          return (
            <section key={category}>
              <h2 className="text-3 text-text-2 mb-fl-1 ms-0 pb-1 border-b border-text-3">
                {category}
              </h2>

              {/* Nothing resets a list here, so the marker and indent are ours. */}
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-fl-2 list-none ps-0 my-0">
                {rows.map((row) => (
                  <li key={row.id}>
                    <TileCard
                      entry={row}
                      href={props.data.canAuthor
                        ? `/tiles/edit?id=${row.id}`
                        : undefined}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Main>
  );
});

type TileCardProps = {
  entry: TileEntry;
  /** Where the tile opens for editing, when there is somewhere to open it. */
  href?: string;
};

// Half the board's width for half its cells, so a tile's walls read at the same
// weight as the home page's.
function TileCard({ entry, href }: TileCardProps) {
  const body = (
    <>
      <Thumbnail
        board={entry.tile}
        size={4}
        width={200}
        height={200}
        className="w-full aspect-square border-2 border-link rounded-1"
      />
      <span className="text-fl-0 text-link">{entry.id.toUpperCase()}</span>
    </>
  );

  return href
    ? (
      <a href={href} className="flex flex-col items-center gap-1 no-underline">
        {body}
      </a>
    )
    : (
      <div className="flex flex-col items-center gap-1 no-underline">
        {body}
      </div>
    );
}
