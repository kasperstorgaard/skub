# Spec: Celebration flow

## Goal

Replace the current solve-and-post flow with a cleaner two-dialog model:
- **SolutionDialog** — name capture for new players, shown to anonymous users on solve
- **CelebrationDialog** — post-solve reward, shown to named users after solution is posted

## User flows

### Named user (has saved name)
1. Solves puzzle
2. Solution is posted automatically (two parallel paths — see below)
3. Page URL gains `?dialog=celebrate`
4. **CelebrationDialog** opens: move count, percentile, "See solves" + Share CTAs, "Start over" link
5. No close button — user navigates away via a CTA or browser back

### Anonymous user (no saved name)
1. Solves puzzle
2. **SolutionDialog** opens: welcoming copy + name input + "Post your solve" submit
3. POST saves name + solution → redirects to `/puzzles/{slug}/solutions`
4. User lands on the solves page directly

## Auto-post for named users (two parallel paths)

### Server path (no JS required)
In the GET handler of `routes/puzzles/[slug]/index.tsx`:
- Decode moves from URL via `decodeState(ctx.url)`
- Resolve board via `resolveMoves(puzzle.board, moves)`
- If `isValidSolution(board)` && `ctx.state.user.name` && `dialog !== "celebrate"`:
  - Post solution to DB
  - `303` redirect to same URL + `&dialog=celebrate`

### Client path (JS enhancement)
`islands/auto-post-solution.tsx` — renders nothing, pure side-effect:
- `isEnabled` memo: `hasSolution && !!savedName && !dialog` (blocks if any dialog open)
- `useEffect`: when `isEnabled`, fetch POST to `/puzzles/{slug}` with moves
- Follows redirect (`redirect: "follow"`), sets `href.value = response.url`
- `celebratedRef` permanently blocks re-triggering after successful post

Duplicate solution posts are handled gracefully by the existing dedup check.

## CelebrationDialog

**Trigger:** `hasSolution && dialog === "celebrate"`

**Content:**
- `h2`: "Solved in N moves"
- Stat line (conditional): "You found the first perfect solve!" / "Perfect — top X%" / "Perfect solve!" / "Top X%"
- Lead-in: "See how you compare, or share your solve."
- Two buttons: **See solves** (primary, autofocused, links to `/puzzles/{slug}/solutions`) + **Share** (hidden without JS)
- **Start over** link (centered below buttons, uses `getResetHref`)
- No close button — eliminates re-open race condition

**Share:** handled via `getShareText` from `game/share.ts`
- `navigator.share({ text, url })` — URL passed separately, not in text
- Clipboard fallback: `${text}\n${url}`
- Share button hidden for no-JS users via `hidden js:inline-flex` (requires `@custom-variant js` in `styles.css`)

**Share text format:**
```
Skub #73 Eik · Hard
First perfect solve · 6 moves
https://…/puzzles/eik
```
- Optimal: `Perfect · 6 moves · top X%`
- First-ever optimal: `First perfect solve · 6 moves`
- < 10 total solves: omit percentile

## SolutionDialog (simplified)

Shown only when `hasSolution && !savedName && !isPreview && dialog !== "celebrate"`.

- Heading: "Nice solve!"
- Copy: "Pick a name to join the leaderboard."
- Name input + hidden `source=solution-dialog` field
- POST redirects to `/puzzles/{slug}/solutions` (not celebrate)
- CTAs: "Try again" link + "Post your solve" submit button

## Terminology

"solutions" → **"solves"** throughout all UI text. URL paths (`/solutions`) unchanged.

## Files affected

| File | Change |
|------|--------|
| `islands/celebration-dialog.tsx` | New island |
| `islands/auto-post-solution.tsx` | New island |
| `islands/solution-dialog.tsx` | Simplified to new-player name capture |
| `islands/controls-panel.tsx` | "Solutions" → "See solves", Trophy → Ranking icon |
| `routes/puzzles/[slug]/index.tsx` | GET side-effect + redirect; POST branches on `source` field |
| `routes/puzzles/[slug]/solutions/index.tsx` | UI text: "solutions" → "solves" |
| `game/share.ts` | New helper: `getShareText({ origin, puzzle, moveCount, stats })` |
| `game/url.ts` | `getResetHref` also clears `dialog` param |
| `styles.css` | `@custom-variant js` for data-js-based Tailwind variant |

## Out of scope

- Streak counter, countdown timer, solves empty state (separate specs)
- CelebrationDialog animation / confetti
- Dynamic OG image for solved state
