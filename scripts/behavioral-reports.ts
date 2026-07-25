// Behavioural corpus reports from PostHog `puzzle_solved` data.
//
// Input: `scoring/.cache/behavioral-fe-<date>.psv`, produced by running QUERY
// below in PostHog (execute-sql). Output: `behavioral.json` (slug-keyed cache)
// plus the too-easy and difficulty-mislabel reports. All under `scoring/.cache/`,
// which is gitignored — everything here is regenerable.
//
// The adjustment
// --------------
// `optAdj` answers "is this board solved optimally more often than its own
// players manage elsewhere?". For each solve it takes
//     (nailed it here? 1/0) − (how often that player nails it on OTHER boards)
// and averages. The baseline is leave-board-out, so a board never contributes to
// the yardstick it is measured against.
//
// Only players with >= 2 distinct boards have a baseline at all. Solves by
// single-board players are DROPPED, not counted as zero — counting them as zero
// scales the whole signal by each board's linkable share, which varies 10%-70%
// per board and is mostly an artifact of anonymous sessions fragmenting
// `person_id`. That reintroduces exactly the traffic-mix confound the adjustment
// exists to remove. `feN` records how many solves actually back each number.
//
// Estimates are then shrunk toward the corpus mean in proportion to their
// standard error (empirical Bayes), so a board resting on 9 solves is not ranked
// against one resting on 118.

const QUERY = `
WITH s AS (
  SELECT person_id AS pid, properties.puzzle_slug AS slug,
         toFloat(properties.puzzle_min_moves) AS mm, toFloat(properties.game_moves) AS mv,
         toFloat(properties.game_moves) / toFloat(properties.puzzle_min_moves) AS rt,
         if(toFloat(properties.game_moves) <= toFloat(properties.puzzle_min_moves), 1, 0) AS opt
  FROM events
  WHERE event = 'puzzle_solved' AND timestamp > now() - INTERVAL 365 DAY
    AND properties.puzzle_slug IS NOT NULL
    AND toFloat(properties.puzzle_min_moves) > 0 AND toFloat(properties.game_moves) > 0),
pl AS (SELECT pid, count(DISTINCT slug) AS nb, sum(opt) AS sopt, sum(rt) AS srt, count() AS n
       FROM s GROUP BY pid),
ps AS (SELECT pid, slug, sum(opt) AS bopt, sum(rt) AS brt, count() AS bn FROM s GROUP BY pid, slug),
j AS (SELECT s.slug AS slug,
             s.opt - (pl.sopt - ps.bopt) / nullIf(pl.n - ps.bn, 0) AS dopt,
             s.rt  - (pl.srt - ps.brt) / nullIf(pl.n - ps.bn, 0) AS drt
      FROM s INNER JOIN pl ON pl.pid = s.pid
             INNER JOIN ps ON ps.pid = s.pid AND ps.slug = s.slug
      WHERE pl.nb >= 2),
fe AS (SELECT slug, count() AS fe_n, 100 * avg(dopt) AS oadj,
              sqrt(10000 * varSamp(dopt) / count()) AS ose,
              avg(drt) AS radj, sqrt(varSamp(drt) / count()) AS rse
       FROM j WHERE isNotNull(dopt) GROUP BY slug),
agg AS (SELECT slug, count() AS solves, any(mm) AS mm, round(avg(mv), 2) AS avg_moves,
               median(mv) AS med_moves, round(median(rt), 3) AS med_ratio,
               round(100 * avg(opt), 1) AS pct_opt, round(avg(rt), 3) AS ratio_mean
        FROM s GROUP BY slug)
SELECT agg.*, ifNull(fe.fe_n, 0), ifNull(fe.oadj, 0), ifNull(fe.ose, 0),
       ifNull(fe.radj, 0), ifNull(fe.rse, 0)
FROM agg LEFT JOIN fe ON fe.slug = agg.slug`;

const PULL_DATE = "2026-07-24";
const CACHE = "scoring/.cache";
const PSV = `${CACHE}/behavioral-fe-${PULL_DATE}.psv`;
const MIN_FE = 8; // below this the estimate is too thin to rank on

type Board = {
  slug: string;
  solves: number;
  minMoves: number;
  avgMoves: number;
  medianMoves: number;
  medianRatio: number;
  pctOptimal: number;
  overshootRatioMean: number;
  feN: number;
  optAdj: number;
  optSe: number;
  ratioAdj: number;
  ratioSe: number;
  optAdjShrunk: number;
  ratioAdjShrunk: number;
};

function parse(psv: string) {
  const [, ...lines] = psv.trim().split("\n");
  return lines.map((line) => {
    const c = line.split("|");
    return {
      slug: c[0],
      solves: +c[1],
      minMoves: +c[2],
      avgMoves: +c[3],
      medianMoves: +c[4],
      medianRatio: +c[5],
      pctOptimal: +c[6],
      overshootRatioMean: +c[7],
      feN: +c[8],
      optAdj: +c[9],
      optSe: +c[10],
      ratioAdj: +c[11],
      ratioSe: +c[12],
    };
  });
}

/**
 * Empirical-Bayes shrinkage. Splits the spread of `value` into true
 * between-board variance and sampling noise, then pulls each estimate toward the
 * mean by its own share of noise. Boards with thin `feN` move most.
 */
function shrink<T>(boards: T[], value: (b: T) => number, se: (b: T) => number) {
  const vals = boards.map(value);
  const mu = vals.reduce((a, b) => a + b, 0) / vals.length;
  const observed = vals.reduce((a, v) => a + (v - mu) ** 2, 0) /
    (vals.length - 1);
  const noise = boards.reduce((a, b) => a + se(b) ** 2, 0) / boards.length;
  const tau2 = Math.max(observed - noise, 0.01);
  return (b: T) => mu + (value(b) - mu) * (tau2 / (tau2 + se(b) ** 2));
}

const rows = parse(await Deno.readTextFile(PSV));
const rated = rows.filter((r) => r.feN >= MIN_FE);
const shrinkOpt = shrink(rated, (b) => b.optAdj, (b) => b.optSe);
const shrinkRatio = shrink(rated, (b) => b.ratioAdj, (b) => b.ratioSe);

const boards: Board[] = rows.map((r) => ({
  ...r,
  optAdjShrunk: r.feN >= MIN_FE ? +shrinkOpt(r).toFixed(2) : 0,
  ratioAdjShrunk: r.feN >= MIN_FE ? +shrinkRatio(r).toFixed(4) : 0,
}));
const bySlug = new Map(boards.map((b) => [b.slug, b]));

await Deno.writeTextFile(
  `${CACHE}/behavioral.json`,
  JSON.stringify(
    {
      _meta: {
        source: "PostHog puzzle_solved events, last 365 days",
        pullDate: PULL_DATE,
        key: "puzzle slug",
        reliable: [
          "optAdjShrunk",
          "ratioAdjShrunk",
          "optAdj",
          "ratioAdj",
          "pctOptimal",
        ],
        unreliable_not_included: {
          solveRate:
            "pageviews cookie-gated + person_id fragmentation → solvers>viewers",
          hints:
            "historical bot traffic (fixed via Cloudflare); not solve-linked",
          solveVolume: "confounded by release date / traffic mix",
        },
        notes: [
          "*Adj are player fixed-effects with a leave-board-out baseline, over the linkable (multi-board) solves only — feN counts them.",
          "*AdjShrunk are the empirical-Bayes estimates; rank on these, not the raw *Adj.",
          "optAdj > 0 = solved more optimally than its own players manage elsewhere (too-easy fingerprint).",
          "ratioAdj > 0 = more move-overshoot than its own players manage elsewhere (harder).",
          "Anonymous sessions fragment person_id, so linkable players are not 'regulars' — they are ids that happened to persist. Treat as a review shortlist, not a relabeller.",
        ],
      },
      boards: Object.fromEntries(boards.map((b) => [b.slug, b])),
    },
    null,
    1,
  ),
);

// ---- reports ----------------------------------------------------------------

const manifest: { slug: string; difficulty: string; minMoves: number }[] = JSON
  .parse(
    await Deno.readTextFile("static/puzzles/manifest.json"),
  );
const tierOf = new Map(manifest.map((p) => [p.slug, p.difficulty]));
const sign = (n: number, d = 1) => (n >= 0 ? "+" : "") + n.toFixed(d);

const anchors = [
  ["malene", "5★ — good, very varied"],
  ["torstein", "5★ — hard/creative, isolated optimal"],
  ["erik", "low anchor — easy but acceptable"],
  ["kim", "floor — very easy, decorative walls"],
];

const ranked = [...rated].sort((a, b) => shrinkOpt(b) - shrinkOpt(a));
const row = (b: (typeof rated)[number]) =>
  `| ${b.slug} | ${
    tierOf.get(b.slug) ?? "?"
  } | ${b.minMoves} | ${b.solves} | ${b.feN} | ${b.pctOptimal.toFixed(1)}% | ${
    b.medianRatio.toFixed(3)
  } | ${sign(b.optAdj)} | **${sign(shrinkOpt(b))}** |`;

await Deno.writeTextFile(
  `${CACHE}/behavioral-too-easy-${PULL_DATE}.md`,
  `# Can behaviour flag "too-easy"? — optimal-solve rate

_Pull ${PULL_DATE}, PostHog \`puzzle_solved\`, last 365 days. Regenerable, uncommitted._
_Generated by \`deno task behavioral-reports\`._

## The signal

- **\`pct_optimal\`** — share of solves that hit exactly minMoves.
- **\`opt_adj\`** — player fixed-effect: the board's optimal rate minus what its own
  players achieve on *other* boards (leave-board-out).
- **\`shrunk\`** — the same estimate pulled toward the corpus mean by its standard
  error. **Rank on this column.**

## Read the fe_n column

\`opt_adj\` can only be computed from solves by players who played more than one
board — \`fe_n\` counts them, and it runs from ${
    Math.min(...rated.map((b) => b.feN))
  } to ${Math.max(...rated.map((b) => b.feN))} across the corpus. The \`solves\`
column is *not* the sample size behind the adjustment.

Anonymous sessions fragment \`person_id\`, so the excluded solves are a mix of
genuine newcomers and returning players wearing a fresh id. That makes this a
statement about linkable sessions, not about "regulars" — a shortlist for human
review, never an autofail.

## Anchors

| anchor | note | fe_n | pct_optimal | median_ratio | opt_adj | shrunk |
|--------|------|------|-------------|--------------|---------|--------|
${
    anchors.map(([s, note]) => {
      const b = bySlug.get(s)!;
      return `| ${s} | ${note} | ${b.feN} | ${b.pctOptimal.toFixed(1)}% | ${
        b.medianRatio.toFixed(3)
      } | ${sign(b.optAdj)} | ${sign(b.optAdjShrunk)} |`;
    }).join("\n")
  }

## Candidate too-easy / filler boards (ranked by shrunk estimate)

| slug | tier | mM | solves | fe_n | pct_optimal | med_ratio | opt_adj | shrunk |
|------|------|----|--------|------|-------------|-----------|---------|--------|
${ranked.slice(0, 25).map(row).join("\n")}

## Hardest to solve optimally (bottom 15)

| slug | tier | mM | solves | fe_n | pct_optimal | med_ratio | opt_adj | shrunk |
|------|------|----|--------|------|-------------|-----------|---------|--------|
${ranked.slice(-15).reverse().map(row).join("\n")}
`,
);

// difficulty mislabel review — combine both fixed effects into one percentile
const scored = rated.map((b) => ({
  board: b,
  hard: -shrinkOpt(b) / 10 + shrinkRatio(b) * 100,
}))
  .sort((a, b) => a.hard - b.hard);
const pct = new Map(
  scored.map((
    s,
    i,
  ) => [s.board.slug, Math.round(100 * i / (scored.length - 1))]),
);
const agree = (b: (typeof rated)[number]) =>
  Math.sign(shrinkOpt(b)) !== Math.sign(shrinkRatio(b)) ? "✓" : "~";
const mrow = (b: (typeof rated)[number]) =>
  `| ${b.slug} | ${
    tierOf.get(b.slug)
  } | ${b.minMoves} | ${b.solves} | ${b.feN} | **${pct.get(b.slug)}** | ${
    sign(shrinkOpt(b))
  } | ${sign(shrinkRatio(b), 3)} | ${agree(b)} |`;
const sect = (title: string, pick: (b: (typeof rated)[number]) => boolean) =>
  `## ${title}\n\n| slug | label | mM | solves | fe_n | behav pct | opt_adj | ratio_adj | conf |\n|---|---|---|---|---|---|---|---|---|\n${
    rated.filter(pick).sort((a, b) => pct.get(a.slug)! - pct.get(b.slug)!).map(
      mrow,
    ).join("\n")
  }\n`;

await Deno.writeTextFile(
  `${CACHE}/behavioral-mislabel-${PULL_DATE}.md`,
  `# Difficulty mislabel review — behavioural second opinion

_Pull ${PULL_DATE}, PostHog \`puzzle_solved\`, 365d. Boards with fe_n >= ${MIN_FE} (n=${rated.length}).
Regenerable via \`deno task behavioral-reports\`._

A de-confounded behavioural difficulty percentile (0 = easiest, 100 = hardest)
built from two shrunk player fixed-effects: \`opt_adj\` (high ⇒ easy) and
\`ratio_adj\` (high ⇒ hard, length-independent). **\`conf\`**: ✓ = both agree;
~ = they disagree (polarising board — many nail it, the rest flail).

**This is a review shortlist, not an autorelabel.** Three limits:
- Section membership is a *percentile cut*, so each list is populated by
  construction — its length is not evidence of that many mislabels.
- It measures "hard to solve on average". Boards whose value is an isolated
  brilliant optimal that players skip for an easier near-miss read as easier than
  they are (torstein).
- Difficulty ≠ quality. malene is easy to solve and still 5★.

---

${
    sect("⬇️ Labelled MEDIUM, behaves EASY", (b) =>
      tierOf.get(b.slug) === "medium" && pct.get(b.slug)! <= 15)
  }
${
    sect("⬆️ Labelled MEDIUM, behaves HARD", (b) =>
      tierOf.get(b.slug) === "medium" && pct.get(b.slug)! >= 85)
  }
${
    sect("⬇️ Labelled HARD, behaves easy", (b) =>
      tierOf.get(b.slug) === "hard" && pct.get(b.slug)! <= 35)
  }
${
    sect("⬆️ Labelled EASY, behaves harder", (b) =>
      tierOf.get(b.slug) === "easy" && pct.get(b.slug)! >= 55)
  }`,
);

console.log(`Boards: ${rows.length} (${rated.length} with fe_n >= ${MIN_FE})`);
console.log(`Wrote ${CACHE}/behavioral.json + 2 reports`);
console.log(`\nTop 10 too-easy (shrunk):`);
for (const b of ranked.slice(0, 10)) {
  console.log(
    `  ${b.slug.padEnd(13)} shrunk ${sign(shrinkOpt(b)).padStart(6)}  raw ${
      sign(b.optAdj).padStart(6)
    }  fe_n ${String(b.feN).padStart(3)}  (${b.solves} solves)`,
  );
}
if (import.meta.main && Deno.args.includes("--sql")) console.log(QUERY);
