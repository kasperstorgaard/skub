/**
 * Runs the quality gates over the hand-built corpus and reports what they
 * reject. Those boards shipped, so every rejection indicts the gate, not the
 * puzzle. Generation-loop gates (G1–G3) are excluded: they ask whether a run
 * produced what it was asked for, which an existing board can't answer.
 *
 * Solves are cached and shared with the other reports.
 *
 * Usage: `deno task audit-gates [--dir=static/puzzles] [--timeout=60000]`
 */
import { flag, solveDir } from "#/scripts/lib/boards.ts";
import type { SolvedBoard } from "#/scripts/lib/score-worker.ts";

/** What each gate is for, so a rejection list reads without the source open. */
const GATE_INTENT: Record<string, string> = {
  G4: "every optimal solution moves a blocker",
  G5: "few enough unused blockers",
  G6: "routes travel far enough",
  G7: "enough walls actually stop a piece",
  G8: "not too much dead space",
  G9: "no blocker walled in on four sides",
  G10: "not egregiously clumped",
};

const dir = flag("--dir=") ?? "static/puzzles";
const timeoutMs = Number(flag("--timeout=") ?? "60000");

const { boards, skipped } = await solveDir(dir, {
  timeoutMs,
  withGates: true,
  onProgress: (slug) => console.log(`solving ${slug}…`),
});

const rejected = new Map<string, SolvedBoard[]>();
for (const board of boards.values()) {
  if (!board.quality || board.quality.passed) continue;
  const gate = board.quality.failedGate ?? "?";
  rejected.set(gate, [...(rejected.get(gate) ?? []), board]);
}

const total = boards.size;
const failed = [...rejected.values()].reduce(
  (sum, list) => sum + list.length,
  0,
);

console.log(`\nQuality gates vs ${dir}\n`);
console.log(
  `${total - failed} of ${total} pass` +
    (skipped.length ? `; skipped: ${skipped.join(", ")}` : ""),
);

if (failed === 0) {
  console.log("\nNo rejections — the gates admit every shipped board.");
} else {
  for (const gate of Object.keys(GATE_INTENT)) {
    const list = rejected.get(gate);
    if (!list?.length) continue;

    const share = ((list.length / total) * 100).toFixed(1);
    console.log(
      `\n${gate} — ${GATE_INTENT[gate]} — rejects ${list.length} (${share}%)`,
    );
    for (const board of list.toSorted((a, b) => a.slug.localeCompare(b.slug))) {
      console.log(`  ${board.slug} (${board.minMoves} moves)`);
    }
  }
  console.log(
    "\nEvery board above shipped, so each rejection is a gate to re-examine.",
  );
}
