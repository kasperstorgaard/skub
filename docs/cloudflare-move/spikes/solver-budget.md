# Spike: solver budget

Sets the hint and editor state budgets for the solver in a browser Web Worker.
Measured on this machine (Ryzen AI 9 HX 370, Deno 2.9.8 / V8 15) with
`game/solver.ts` unchanged. The phone numbers are estimates (3–5× slower). A
real mid-range phone measurement is still to be done by Kasper.

## Method

- `scripts/spike/solver-budget.ts` runs each solve in its own Deno process
  (`solve-one.ts`): the same `solve()` generator the hint worker uses, with the
  7M hint budget and a 60 s kill.
- States are the visited-set size. Memory is peak RSS (`VmHWM`) minus the RSS
  after a forced GC before the solve, so it includes array-growth transients.
- Scenarios:
  - **start**: the start position.
  - **mid**: after the first half of the optimal solution.
  - **drift**: three random legal moves from the start, the first one not the
    optimal move. Three seeds per puzzle.
- `scripts/spike/editor-budget.ts`: open boards with the destination walled in,
  so the search always runs the budget out.

## Picked puzzles

| Why                    | Puzzles                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| Most blockers          | ulf (27), nis (14), ditte (8), pil (8), ene (8), mons (7), vega (7)    |
| Highest minMoves       | loke (15), pelle (13), peder (12), pedro (12). mons (11) is also here. |
| Most states from start | valdemar (5.4M), aegir (4.0M)                                          |
| Typical                | kasper, esben: median states (~47k)                                    |

The picks come from one full-corpus pass (340 puzzles), which ran before the
scope was narrowed. Its coverage table is below.

## Results: hints (picked set)

| Scenario   | Metric        | p50     | p90       | p99        | max        |
| ---------- | ------------- | ------- | --------- | ---------- | ---------- |
| start (15) | states        | 90,299  | 4,823,828 | 5,402,831  | 5,402,831  |
|            | ms            | 80      | 4,031     | 60,000\*   | 60,000\*   |
|            | peak RSS Δ MB | 18      | 300       | 302        | 302        |
| mid (14)   | states        | 2,619   | 55,980    | 64,868     | 64,868     |
|            | ms            | 3       | 37        | 47         | 47         |
|            | peak RSS Δ MB | 8       | 14        | 14         | 14         |
| drift (42) | states        | 116,015 | 2,898,818 | 7,000,000† | 7,000,000† |
|            | ms            | 52      | 2,422     | 5,434      | 5,434      |
|            | peak RSS Δ MB | 18      | 163       | 313        | 313        |

\* ulf: killed at 60 s (see Surprises). † valdemar drift #2 ran out the 7M
budget.

Hardest: valdemar (start 5.4M states, 3.9 s, 304 MB), mons (4.8M, 4.0 s, 293
MB), aegir (4.0M, 2.7 s, 171 MB), lukas (3.1M, 1.8 s). Their drift positions are
as hard, or harder. A mid-game position never passed 65k states.

Coverage over the full corpus: positions needing more than N states.

| Scenario     | >250k | >500k | >1M | >2M | >3M |
| ------------ | ----- | ----- | --- | --- | --- |
| start (340)  | 62    | 23    | 9   | 5   | 4   |
| mid (339)    | 0     | 0     | 0   | 0   | 0   |
| drift (1017) | 163   | 82    | 36  | 12  | 7   |

## Results: editor worst case (budget run out)

| Budget | 8 pieces: ms | MB  | 5 pieces: ms | MB  |
| ------ | ------------ | --- | ------------ | --- |
| 500k   | 176          | 42  | 187          | 39  |
| 1M     | 382          | 68  | 406          | 61  |
| 2M     | 956          | 111 | 1,061        | 88  |
| 3M     | 1,533        | 162 | 1,987        | 185 |
| 5M     | 2,940        | 291 | 4,358        | 347 |
| 7M     | 4,308        | 325 | 7,064        | 321 |

Throughput is ~2M states/s up to 1M states and ~1.5M/s beyond, as the arrays
outgrow cache.

## States vs memory

- At scale (≥ 2M states): **46–73 B/state** measured. About ~10 MB of that is a
  fixed cost (JIT, heap) that shows on small solves.
- Model: the state pool is `pieces` B/state and the metadata 7 B/state, both
  doubling. The visited set (`CompactSet`, Float64, ≤ 50% load) is 16–32
  B/state. Growth briefly holds the old and the new array.
- **The solver is already compact TS:** a flat Uint8 state pool, typed metadata,
  and an open-addressing Float64 set. No strings or objects per state.

## Compact visited set (prototype)

`scripts/spike/solver-compact.ts` keeps an Int32 table of pool indexes (4 B a
slot) instead of Float64 keys, and recomputes the key on each probe. The states
and solutions are identical on every picked position.

|                     | TS today      | Int32 index table |
| ------------------- | ------------- | ----------------- |
| Editor 3M, 8 pieces | 162 MB, 1.5 s | 133 MB, 2.3 s     |
| Editor 7M, 8 pieces | 325 MB, 4.3 s | 270 MB, 6.8 s     |
| Hint start p90      | 300 MB, 4.0 s | 249 MB, 6.3 s     |
| B/state at ≥ 2M     | 46–73         | 35–51             |

It saves 15–25% memory at a cost of 1.3–1.6× the time. On phones time is the
binding constraint, so it is not worth it.

## Recommendation

| Budget                | States                       | Here             | Phone (est. 3–5×)   | Coverage                                   |
| --------------------- | ---------------------------- | ---------------- | ------------------- | ------------------------------------------ |
| Hint, phone / offline | 500k                         | ~0.2 s, 40 MB    | ~0.6–1.0 s, 40 MB   | all mid-game; 93% of starts; 92% of drifts |
| Hint, desktop         | 3M                           | ~1.5–2 s, 165 MB | —                   | 99% of starts and drifts                   |
| Editor                | 3M (unchanged); 1M on phones | 1.5 s, 160 MB    | 1M: ~1.2–2 s, 70 MB | —                                          |

- On phones, time limits first, not memory: 150 MB would allow ~2.5M states, but
  1 s allows only ~400–650k.
- Consider a time cap as well: the page calls `worker.terminate()` after ~1.5 s.
  It adapts to the device, and needs no solver change.
- The 7M hint budget buys only valdemar's start and a few drifts, at ~5 s and
  ~320 MB. Drop it.

**Outcome: TS is fine as is.**

- It is already the compact design.
- A tighter visited set trades memory, which isn't the limit, for time, which
  is.
- WASM wasn't measured. Typed-array integer code like this usually runs within
  ~1.5–2× of WASM in V8. Even 2× doesn't bring the 4–5M-state starts under 1 s
  on a phone, so it doesn't change which positions get a hint.

## Surprises

- **Boards with more than 8 pieces break the state key.** `stateKeyAt` is base
  65 and exact only up to 8 pieces.
  - **ulf (28 pieces):** the keys are so large that `CompactSet.hash` maps
    nearly all of them to one slot, so probing goes quadratic. 40k states took
    3.3 s, and the start position never finished. Today a ulf hint spins a
    server worker until the request aborts.
  - **nis (15 pieces):** solves (minMoves 6, correct), but its keys are lossy,
    so distinct states could merge.
  - The port must key by the pool bytes, or by an exact hash, for more than 8
    pieces.
- A drifted position can cost more than the start: valdemar drift #2 runs out
  the 7M budget, and aegir drift #2 needs 5.0M against 4.0M from the start.
