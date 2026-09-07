import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { TileThumbnail } from "#/components/tile-thumbnail.tsx";
import { define } from "#/core.ts";
import { readTiles } from "#/game/tile-store.ts";
import { countLanes, TILE_SIZE } from "#/game/tiles.ts";
import { TILE_CATEGORIES, type TileEntry } from "#/game/types.ts";
import { isDev } from "#/lib/env.ts";

type TileRow = TileEntry & { lanes: number };

export const handler = define.handlers<TileRow[]>({
  async GET() {
    // Dev-only: tiles are authored, and production's filesystem is read-only.
    if (!isDev) throw new HttpError(404, "Not found");

    const tiles = await readTiles();

    return page(tiles.map((entry) => ({
      ...entry,
      lanes: countLanes(entry.tile),
    })));
  },
});

export default define.page<typeof handler>(function TilesPage(props) {
  const url = new URL(props.req.url);

  return (
    <Main>
      <Header url={url} back={{ href: "/" }} />

      <div className="flex justify-between items-center gap-fl-1 mt-2 mb-fl-2">
        <h1 className="text-5 text-brand leading-flat">Tiles</h1>
        <a href="/tiles/new" className="btn">New tile</a>
      </div>

      {!props.data.length && (
        <p className="text-text-3">
          No tiles yet. Build the first one and the composer has something to
          deal.
        </p>
      )}

      {TILE_CATEGORIES.map((category) => {
        const rows = props.data.filter((row) => row.category === category);
        if (!rows.length) return null;

        return (
          <section key={category} className="mb-fl-3">
            <h2 className="text-3 text-text-2 mb-fl-1">{category}</h2>

            <ul className="flex flex-wrap gap-fl-2">
              {rows.map((row) => (
                <li key={row.id}>
                  <a
                    href={`/tiles/edit?id=${row.id}`}
                    className="flex flex-col items-center gap-1 no-underline"
                  >
                    <TileThumbnail tile={row.tile} />
                    <span className="text-fl-0 text-link">{row.id}</span>
                    <span className="text-fl-0 text-text-3">
                      {row.lanes}/{TILE_SIZE * 2}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </Main>
  );
});
