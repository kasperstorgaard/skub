# Make the generator nicer

## Problem

`fd139e5` landed the gated generator (`/puzzles/new`) with a single live knob
(difficulty) and an advisory score readout. The scoring spec
(`specs/210-feat-puzzle-scoring.md`) parked four follow-ups under "Future ideas":
surface the hardcoded generation controls, capture qualitative feedback on
candidates, persist candidates to disk, and use that labeled data to re-calibrate
the composite (Phase 2). This change delivers all four.

## Approach

Turn `/puzzles/new` from a one-knob reroll box into a **curation surface that
builds a labeled dataset** comparable against the hand-built corpus.

- **Generation controls (sidebar).** Surface the previously-hardcoded
  `wallsRange` / `blockersRange` / `wallSpread`, plus a **new symmetry knob** — a
  0–100% slider that mirrors a share of placed **walls** across both centre axes
  (0 = free-form, 100 = fully mirrored). Symmetry shapes wall *structure* only;
  blockers/puck/destination stay free. Because mirroring multiplies walls up to
  4×, the base wall count is scaled down by the expected expansion so the final
  symmetric layout stays within the requested range (otherwise high symmetry
  overcrowds the board into unsolvable, slow-to-solve messes). The four secondary
  knobs live behind a collapsed **Options** disclosure so the tight Panel stays
  usable.

- **Auto-naming.** Each generated candidate gets a random Nordic name
  (`game/nordic-names.json`) unused by any static or generated puzzle — matching
  the corpus convention of naming puzzles after people. Picked server-side on
  save (`game/names.ts` + `getCorpusNames`) and shown next to the board. When
  the pool runs dry, names get an ordinal suffix (`Hans-2`) instead of failing.
  Name and store filename are one thing: `Hans` lives in `generated/hans.md`
  (no synthetic ids), and the same slug flows through Edit/Save/Download.

- **Knob persistence ("persist on Generate").** `/api/generate` sets an
  httpOnly `generator_options` cookie with the knob values each run actually
  used; `/puzzles/new` reads it server-side (`getGeneratorOptions`,
  `game/cookies.ts`) so reloads reopen with the last-used settings — no client
  cookie/storage code, matching the app's server-set cookie convention.

- **Resume the newest candidate.** `/puzzles/new` always loads the newest
  stored candidate (board + name + any stored feedback) instead of an empty
  board — a dev reload mid-curation loses nothing; the empty board only appears
  when the store is empty.

- **Curation set tooling.** `deno task list-generated` prints the labeled store
  as a table (name, stars, reasons, difficulty, generator version) with a
  rated/unrated summary. `compare-generated` caches corpus scores per
  calibration version (`scoring/.cache/`, content-hashed per file), so reruns
  only pay for the candidates.

- **Feedback capture.** Each generated candidate can be rated **1–5 stars**;
  choosing a rating reveals **reason tags** (clumped, empty-areas, too-easy,
  too-hard, meh, boring, nice) and an optional free-text note. Rating gates the
  qualitative detail.

- **Generation performance.** The gate solve takes a tight `maxStates` budget
  (`game/solver.ts` gains a per-call cap; the worker passes ~2M) so a single
  branchy candidate rejects fast (G1) instead of grinding for seconds and
  freezing the progress count. The full 10M limit still applies to real solves.

- **Local storage (dev-only).** Every generated candidate is auto-saved to a
  gitignored `generated/` dir as markdown, with the feedback in frontmatter.
  Feedback edits patch the same file. Guarded by `isDev` like
  `routes/api/puzzles.ts` (Deno Deploy's filesystem is read-only). `generated/`
  is excluded from Vite's dev watcher (`vite.config.ts server.watch.ignored`) —
  otherwise each written candidate file triggers a full page reload that wipes
  the just-shown board back to the empty server state.

- **Cross-island state.** The board-adjacent feedback island and the sidebar
  panel share the current candidate via a module-singleton signal
  (`client/generator-signals.ts`), not a route-level prop signal.

- **Corpus comparison.** `deno task compare-generated` re-solves and scores the
  labeled candidates and the corpus, writing
  `scoring/reports/generated-vs-corpus.md`: per-metric distributions for corpus
  vs high-rated vs low-rated candidates, plus per-reason-tag means — the signal
  Phase 2 needs to re-calibrate the composite toward human judgement.

Scores are **not** embedded in the stored files; the compare script re-scores so
the report always reflects the current `CALIBRATION`.

## Calibration v2 (first pass on the labeled data)

The first 11 rated candidates independently replicated the anchor inversion:
under v1 a 2★ "too-easy" board scored highest of all boards, a 5★ lowest.
Calibration **v2** is a deliberately conservative, structural correction — only
changes both datasets support, no fitted constants, **gates untouched** (the
labeled set is too small to justify threshold moves):

- dropped `firstMovePrecision` from the composite (rewarded forced openings);
- promoted `wallUtilization` (positive) and `deadSpace` (negative) into the
  composite — the two strongest human-aligned signals;
- added a shaped `variety` term over distinct solutions (sweet band 2–8,
  neutral at 1, fading past 8 — a 49-route board rated "too-easy");
- generator symmetry default 0 → 0.5 (every 4–5★ board was generated at
  ≥ 0.55; four of five 2★ at 0).

`deno task check-anchors` measures each calibration against the ground truth
(anchor partial order + rated candidates): v2 flipped the pooled rank
correlation from negative to +0.30, deflating the too-easy profile (erik
0.42→0.19, the 2★ Thor 0.44→0.11). Residual known gap: single-route-brilliant
boards (torstein, Lauge) are underscored — needs the solution-isolation signal
(solving past optimal depth), deferred until the labeled set reaches ~50.

## Non-goals

Further weight tuning or gate-threshold changes until the labeled set is
larger; any in-app corpus-comparison panel (offline report only).
