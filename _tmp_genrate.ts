import { generate } from "#/game/generator.ts";
import { checkGates } from "#/game/scoring.ts";

const N = 100;
let passed = 0;
const fails: Record<string, number> = {};
const noGate = new Set<string>();
const t0 = performance.now();
let solveMs = 0;

for (let i = 0; i < N; i++) {
  const { board } = generate({
    wallsRange: [5, 15],
    blockersRange: [3, 5],
    wallSpread: "balanced",
  });
  const s = performance.now();
  try {
    const g = checkGates(board, {
      difficulty: "medium",
      corpus: noGate,
      batchHashes: noGate,
    });
    if (g.passed) passed++;
    else fails[g.failedGate!] = (fails[g.failedGate!] ?? 0) + 1;
  } catch (e) {
    fails["throw"] = (fails["throw"] ?? 0) + 1;
    void e;
  }
  solveMs += performance.now() - s;
}

console.log(`passed ${passed}/${N}`);
console.log("failedGate counts:", fails);
console.log(
  `total ${Math.round(performance.now() - t0)}ms, avg gate-check ${
    Math.round(solveMs / N)
  }ms`,
);
