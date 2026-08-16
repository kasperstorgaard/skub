/**
 * Prints the labeled candidate store (`generated/`) as a table — name, rating,
 * reasons, difficulty, minMoves, generator version — plus summary counts, so
 * you can see the curation set grow, spot unrated candidates, and shortlist the
 * high-rated boards without opening files.
 *
 * Usage: `deno task list-generated`
 */
import { GENERATED_DIR, parseGenerated } from "#/game/generated.ts";

type Row = {
  slug: string;
  name: string;
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
  for await (const entry of Deno.readDir(GENERATED_DIR)) {
    if (!entry.name.endsWith(".md")) continue;
    try {
      const c = parseGenerated(
        await Deno.readTextFile(`${GENERATED_DIR}/${entry.name}`),
      );
      rows.push({
        slug: entry.name.replace(/\.md$/, ""),
        name: c.name,
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
  console.log("No generated/ store yet — generate some candidates first.");
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
const header = `${pad("name", 14)} ${pad("rate", 5)} ${pad("diff", 7)} ${
  pad("mM", 3)
} ${pad("gen", 5)} reasons / note`;
console.log(`\n${header}\n${"-".repeat(header.length)}`);

for (const r of rows) {
  const stars = r.rating === undefined ? "—" : renderStars(r.rating);
  const detail = [
    r.reasons.join(", "),
    r.note ? `“${r.note}”` : "",
  ].filter(Boolean).join(" — ");
  console.log(
    `${pad(r.name, 14)} ${pad(stars, 5)} ${pad(r.difficulty, 7)} ${
      pad(String(r.minMoves), 3)
    } ${pad(r.version, 5)} ${detail}`,
  );

  // Routes the curator has labelled, under the puzzle they belong to — the
  // rating is one verdict on the board, these say which solution earned it.
  for (const [moves, tags] of r.solutionTags) {
    console.log(`${" ".repeat(14)} └ ${pad(tags.join(", "), 22)} ${moves}`);
  }
}

const rated = rows.filter((r) => r.rating !== undefined);
// Half steps make ten buckets, most of them empty in a small store — only the
// ones that actually occur are worth a column.
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
