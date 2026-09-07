import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { define } from "#/core.ts";
import { readTiles } from "#/game/tile-store.ts";
import { countLanes } from "#/game/tiles.ts";
import { TILE_CATEGORIES, type TileCategory } from "#/game/types.ts";
import { isDev } from "#/lib/env.ts";

type TileRow = {
  id: string;
  name?: string;
  category: TileCategory;
  walls: number;
  blockers: number;
  hazards: number;
  lanes: number;
};

export const handler = define.handlers<TileRow[]>({
  async GET() {
    // Dev-only: tiles are authored, and production's filesystem is read-only.
    if (!isDev) throw new HttpError(404, "Not found");

    const tiles = await readTiles();

    return page(tiles.map(({ id, name, category, tile }) => ({
      id,
      name,
      category,
      walls: tile.walls.length,
      blockers: tile.pieces.length,
      hazards: tile.holes.length + tile.portals.length,
      lanes: countLanes(tile),
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

            <ul className="flex flex-col gap-fl-0">
              {rows.map((row) => (
                <li key={row.id} className="flex gap-fl-1 items-baseline">
                  <a href={`/tiles/edit?id=${row.id}`} className="text-link">
                    {row.id}
                  </a>
                  {row.name && <span className="text-text-2">{row.name}</span>}
                  <span className="text-fl-0 text-text-3">
                    {row.walls} walls · {row.blockers} blockers · {row.hazards}
                    {" "}
                    hazards · {row.lanes}/8 lanes
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </Main>
  );
});
