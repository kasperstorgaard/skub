import { define } from "#/core.ts";
import { setGeneratorOptions } from "#/game/cookies.ts";
import type { GenerateEvent, GenerateRequest } from "#/game/generate-worker.ts";
import type { GenerateOptions } from "#/game/generator.ts";
import { getCorpusHashes } from "#/game/loader.ts";
import { MOVE_TARGETS } from "#/game/scoring.ts";
import { isDev } from "#/lib/env.ts";

// Resolves to a file:// URL at runtime, bypassing Deno Deploy's --cached-only
// restriction (which only blocks HTTP module fetches). The Vite plugin copies
// generate-worker.js to _fresh/server/assets/ (see plugins/worker-bundle.ts).
const workerUrl = isDev
  ? new URL("../../game/generate-worker.ts", import.meta.url).href
  : new URL("./generate-worker.js", import.meta.url);

const encoder = new TextEncoder();
const encode = encoder.encode.bind(encoder);

type MoveTarget = typeof MOVE_TARGETS[number];

const isMoveTarget = (value: unknown): value is MoveTarget =>
  MOVE_TARGETS.includes(value as MoveTarget);

// Streams a gated generation run as SSE: `progress` events (a rising attempt
// count) until a board passes every gate, then a terminal `result` /
// `exhausted` / `error`. The loop runs in a worker so its many exhaustive
// solves don't block the request thread.
//
// Dev-only, like the /puzzles/new page it serves: each run spawns a worker that
// exhaustively solves up to MAX_ATTEMPTS boards, so leaving it open in
// production hands anyone an unbounded compute lever.
export const handler = define.handlers({
  async POST(ctx) {
    if (!isDev) {
      return new Response("Forbidden", { status: 403 });
    }

    let body: GenerateOptions & { targetMoves?: number };

    try {
      body = await ctx.req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const { wallsRange, blockersRange, wallSpread, symmetry, targetMoves } =
      body;

    if (
      !wallsRange || !blockersRange || !wallSpread ||
      !isMoveTarget(targetMoves) ||
      wallsRange[0] > wallsRange[1] ||
      blockersRange[0] > blockersRange[1] ||
      wallsRange[0] < 0 || blockersRange[0] < 0 ||
      (symmetry !== undefined &&
        (typeof symmetry !== "number" || symmetry < 0 || symmetry > 1))
    ) {
      return new Response("Invalid options", { status: 400 });
    }

    const corpus = [...await getCorpusHashes()];
    const worker = new Worker(workerUrl, { type: "module" });

    const stream = new ReadableStream({
      start(controller) {
        worker.onmessage = (e: MessageEvent<GenerateEvent>) => {
          controller.enqueue(encode(`data: ${JSON.stringify(e.data)}\n\n`));
          if (e.data.type !== "progress") {
            worker.terminate();
            controller.close();
          }
        };

        worker.onerror = (e) => {
          const event: GenerateEvent = { type: "error", message: e.message };
          controller.enqueue(encode(`data: ${JSON.stringify(event)}\n\n`));
          worker.terminate();
          controller.close();
        };

        const request: GenerateRequest = {
          wallsRange,
          blockersRange,
          wallSpread,
          symmetry,
          targetMoves,
          corpus,
        };
        worker.postMessage(request);
      },
      cancel() {
        worker.terminate();
      },
    });

    // Persist the run's knob values so /puzzles/new reopens with them
    // ("persist on Generate" — idle slider twiddling never sticks).
    const headers = setGeneratorOptions(
      new Headers({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      }),
      {
        wallsRange,
        blockersRange,
        wallSpread,
        symmetry: symmetry ?? 0,
      },
    );

    return new Response(stream, { headers });
  },
});
