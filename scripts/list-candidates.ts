/**
 * Prints the candidate store as a table — name, source, rating, reasons,
 * difficulty, minMoves, generator version — plus summary counts.
 *
 * Usage: `deno task list-candidates`
 */
import {
  CANDIDATES_DIR,
  type CandidateSource,
  candidateSource,
  parseCandidate,
} from "#/game/candidates.ts";

type Row = {
  slug: string;
  name: string;
  source: CandidateSource;
  rating?: number;
  reasons: string[];
  note?: string;
  difficulty: string;
  minMoves: number;
  version: string;
  /** Per-route tags, keyed by the route's encoded moves. */
  solutionTags: [string, string[]][];
};

const rows: Row[] = [];
let unparseable = 0;

try {
  for await (const entry of Deno.readDir(CANDIDATES_DIR)) {
    if (!entry.name.endsWith(".md")) continue;
    try {
      const c = parseCandidate(
        await Deno.readTextFile(`${CANDIDATES_DIR}/${entry.name}`),
      );
      rows.push({
        slug: entry.name.replace(/\.md$/, ""),
        name: c.name,
        source: candidateSource(c),
        rating: c.rating,
        reasons: c.reasons ?? [],
        note: c.note,
        difficulty: c.difficulty,
        minMoves: c.minMoves,
        version: c.generatorVersion ?? "?",
        solutionTags: Object.entries(c.solutionTags ?? {}),
      });
    } catch {
      unparseable++;
    }
  }
} catch {
  console.log("No candidates/ store yet — propose or generate a board first.");
  Deno.exit(0);
}

// Rated first (best on top), then unrated; alphabetical within a group.
rows.sort((a, b) =>
  (b.rating ?? -1) - (a.rating ?? -1) || a.slug.localeCompare(b.slug)
);

const pad = (s: string, n: number) =>
  s.padEnd(n).slice(0, Math.max(n, s.length));

/** Ratings move in half steps, so a rating renders as stars plus a half. */
const renderStars = (rating: number) =>
  "★".repeat(Math.floor(rating)) + (rating % 1 ? "½" : "");
const header = `${pad("name", 14)} ${pad("src", 4)} ${pad("rate", 5)} ${
  pad("diff", 7)
} ${pad("mM", 3)} ${pad("gen", 5)} reasons / note`;
console.log(`\n${header}\n${"-".repeat(header.length)}`);

for (const r of rows) {
  const stars = r.rating === undefined ? "—" : renderStars(r.rating);
  const detail = [
    r.reasons.join(", "),
    r.note ? `“${r.note}”` : "",
  ].filter(Boolean).join(" — ");
  console.log(
    `${pad(r.name, 14)} ${pad(r.source.slice(0, 3), 4)} ${pad(stars, 5)} ${
      pad(r.difficulty, 7)
    } ${pad(String(r.minMoves), 3)} ${pad(r.version, 5)} ${detail}`,
  );

  // Routes the curator has labelled, under the puzzle they belong to.
  for (const [moves, tags] of r.solutionTags) {
    console.log(`${" ".repeat(14)} └ ${pad(tags.join(", "), 22)} ${moves}`);
  }
}

const rated = rows.filter((r) => r.rating !== undefined);
// Half steps make ten buckets; only the ones that occur get a column.
const histogram = Array.from({ length: 10 }, (_, i) => (i + 1) / 2)
  .map((step) => ({
    step,
    count: rated.filter((r) => r.rating === step).length,
  }))
  .filter(({ count }) => count > 0)
  .map(({ step, count }) => `${step}★ ${count}`)
  .join("  ");

console.log(
  `\n${rows.length} candidates — ${rated.length} rated (${histogram}), ` +
    `${rows.length - rated.length} unrated` +
    (unparseable ? `, ${unparseable} unparseable` : ""),
);
