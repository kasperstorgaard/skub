import { define } from "#/core.ts";
import { type BoardLike, validateBoard } from "#/game/board.ts";
import { getCorpusHashes } from "#/game/loader.ts";
import { boardCanonicalHash } from "#/game/scoring.ts";
import type { SolverEvent } from "#/game/solver.ts";
import { isDev } from "#/lib/env.ts";

// Resolves to a file:// URL at runtime, bypassing Deno Deploy's
// --cached-only restriction (which only blocks HTTP module fetches).
// The Vite plugin copies solver-worker.js to _fresh/server/assets/
const workerUrl = isDev
  ? new URL("../../game/solver-worker.ts", import.meta.url).href
  : new URL("./solver-worker.js", import.meta.url);

const encoder = new TextEncoder();
const encode = encoder.encode.bind(encoder);

// Serves the editor's difficulty badge, which is the one place a board exists
// that `update-puzzles` hasn't counted yet. The worker caps its own search, so
// a board costs a bounded solve rather than an open compute lever.
export const handler = define.handlers({
  async POST(ctx) {
    let board;
    try {
      board = validateBoard(await ctx.req.json() as BoardLike);
    } catch (err) {
      return new Response(
        err instanceof Error ? err.message : "Invalid board",
        { status: 400 },
      );
    }

    // Gameplay hints solve inside the gated /puzzles/:slug/hint route, one per
    // puzzle. Handing back the solution to a board that already ships would be
    // a way around that, so a board in the corpus is refused here. The hash
    // folds the 8 symmetries — a rotated or mirrored copy is the same board.
    const corpus = await getCorpusHashes();
    if (corpus.has(boardCanonicalHash(board))) {
      return new Response("That board already ships as a puzzle", {
        status: 403,
      });
    }

    const worker = new Worker(workerUrl, { type: "module" });

    const stream = new ReadableStream({
      start(controller) {
        worker.onmessage = (e: MessageEvent<SolverEvent>) => {
          controller.enqueue(encode(`data: ${JSON.stringify(e.data)}\n\n`));
          if (e.data.type === "solution" || e.data.type === "error") {
            worker.terminate();
            controller.close();
          }
        };

        worker.onerror = (e) => {
          const event: SolverEvent = { type: "error", message: e.message };
          controller.enqueue(encode(`data: ${JSON.stringify(event)}\n\n`));
          worker.terminate();
          controller.close();
        };

        worker.postMessage(board);
      },
      cancel() {
        worker.terminate();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  },
});
