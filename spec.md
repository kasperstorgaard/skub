# Tracking lib

## Problem

PostHog events are called directly at 4 call sites across 3 route files. Each call
repeats the same boilerplate:

- `distinctId: ctx.state.trackingId`
- `$process_person_profile: ctx.state.cookieChoice === "accepted"`
- `$current_url: ...`

This is ~5 lines of repetition per event. Adding a new event means getting all three
fields right. Skipping one is a silent bug.

## Solution

A thin `lib/tracking.ts` module with one typed helper per event. Each helper:

1. Accepts `ctx.state` (the Fresh `State` type) as its first argument so common
   fields are extracted automatically.
2. Accepts the event-specific payload as the second argument.
3. Calls `posthog?.capture(...)` internally — no return value needed.

The `_error.tsx` route uses `captureException`, not `capture`, so it stays as-is
(different API surface, only one call site).

## API (proposed function signatures)

```ts
// Puzzle solved — 2 call sites in routes/puzzles/[slug]/index.tsx
trackPuzzleSolved(state: State, puzzle: Puzzle, options: {
  moves: Move[];
  url: string;
}): void

// Onboarding completed — 1 call site in routes/puzzles/[slug]/index.tsx
// Kept as a helper because it shares puzzle context with trackPuzzleSolved
// and its payload is identical in shape.
trackOnboardingCompleted(state: State, puzzle: Puzzle, options: {
  moves: Move[];
  url: string;
}): void

// Hint requested — 1 call site in routes/puzzles/[slug]/(actions)/hint.ts
trackHintRequested(state: State, puzzle: Puzzle, options: {
  url: string;
  cursor: number;
}): void

// Cookie consent — 1 call site in routes/api/consent.ts
trackCookieConsent(state: State, options: {
  decision: "accepted" | "declined";
  url: string;
}): void
```

`trackCookieConsent` gets a special note: at the time the event fires, the cookie
choice has just been set but `ctx.state.cookieChoice` still reflects the value from
the incoming request (which is `null` for new visitors). The helper must therefore
derive `$process_person_profile` from `decision`, not from `state.cookieChoice`.

## Files

- **new** `lib/tracking.ts` — typed capture helpers
- **updated** `routes/puzzles/[slug]/index.tsx` — use `trackPuzzleSolved`, `trackOnboardingCompleted`
- **updated** `routes/puzzles/[slug]/(actions)/hint.ts` — use `trackHintRequested`
- **updated** `routes/api/consent.ts` — use `trackCookieConsent`
