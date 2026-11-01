import { define } from "#/core.ts";

/** The stable entry point for building a puzzle. */
export const handler = define.handlers({
  GET() {
    return new Response("", {
      headers: { Location: "/puzzles/build" },
      status: 303,
    });
  },
});
