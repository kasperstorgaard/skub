import { renderToString } from "preact-render-to-string";

import { ArchiveDays } from "#/components/archive-row.tsx";
import { define } from "#/core.ts";
import { getArchiveBounds, listArchiveDays } from "#/game/loader.ts";

/** At most six weeks per request. */
const MAX_DAYS = 42;

/** The archive row's cards for a run of slots, as an HTML fragment. */
export const handler = define.handlers({
  async GET(ctx) {
    const bounds = await getArchiveBounds();
    const from = Math.max(
      bounds.from,
      Number(ctx.url.searchParams.get("from")),
    );
    const to = Math.min(
      bounds.to,
      from + MAX_DAYS - 1,
      Number(ctx.url.searchParams.get("to")),
    );

    const days = await listArchiveDays({ from, to });
    const html = renderToString(
      <ArchiveDays days={days} score={ctx.state.score} />,
    );

    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
});
