import { define } from "#/core.ts";
import { type BoardLike, validateBoard } from "#/game/board.ts";
import { getCorpusHashes } from "#/game/loader.ts";
import { boardCanonicalHash } from "#/game/scoring.ts";
import {
  EDITOR_MAX_STATES,
  solveLock,
  type SolveRequest,
  workerUrl,
} from "#/game/solver-queue.ts";
import type { SolverEvent } from "#/game/solver.ts";

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

    let worker: Worker | undefined;
    let permit: Disposable | undefined;
    let closed = false;

    // Disposing a permit twice would hand out an extra one, so only once.
    const release = () => {
      permit?.[Symbol.dispose]();
      permit = undefined;
    };

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: SolverEvent) => {
          if (!closed) {
            controller.enqueue(encode(`data: ${JSON.stringify(event)}\n\n`));
          }
        };

        const end = () => {
          worker?.terminate();
          release();
          if (closed) return;
          closed = true;
          controller.close();
        };

        const run = async () => {
          permit = solveLock.tryAcquire();
          if (!permit) {
            send({ type: "queued" });
            permit = await solveLock.acquire();
          }

          // Cancelled while waiting: pass the permit straight on.
          if (closed) return release();

          worker = new Worker(workerUrl, { type: "module" });

          worker.onmessage = (e: MessageEvent<SolverEvent>) => {
            send(e.data);
            if (e.data.type === "solution" || e.data.type === "error") end();
          };

          worker.onerror = (e) => {
            send({ type: "error", reason: "failed", message: e.message });
            end();
          };

          worker.postMessage(
            { board, maxStates: EDITOR_MAX_STATES } satisfies SolveRequest,
          );
        };

        run().catch((err) => {
          send({
            type: "error",
            reason: "failed",
            message: err instanceof Error ? err.message : "Solve failed",
          });
          end();
        });
      },
      cancel() {
        closed = true;
        worker?.terminate();
        release();
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
