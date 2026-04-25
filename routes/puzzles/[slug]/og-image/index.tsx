import { renderToString } from "preact-render-to-string";

import { Thumbnail, ThumbnailColors } from "#/components/thumbnail.tsx";
import { define } from "#/routes/puzzles/[slug]/_middleware.ts";

// Matches the actual rendered thumbnail: light-mode piece colors on dark background.
// ui1: teal-4, ui2: yellow-3, ui3: violet-6, ui4: orange-6
const OG_COLORS: ThumbnailColors = {
  ui1: "#38d9a9",
  ui2: "#ffe066",
  ui3: "#7950f2",
  ui4: "#fd7e14",
};

// gray-9 (surface-1 dark)
const BACKGROUND = "#212529";

export const handler = define.handlers({
  GET(ctx) {
    const { puzzle } = ctx.state;

    const svg = renderToString(
      <Thumbnail
        board={puzzle.board}
        width={400}
        height={400}
        colors={OG_COLORS}
        background={BACKGROUND}
      />,
    );

    return new Response(svg, {
      headers: { "content-type": "image/svg+xml" },
    });
  },
});
