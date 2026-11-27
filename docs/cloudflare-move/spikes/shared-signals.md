# Spike: shared signals

Code audit, 2026-11-25. Question: does one island root per page hold under
Astro, where islands don't share signals the way Fresh does?

## Verdict

One island root per page works everywhere, with no need for the fallback (own
thin layer or module-level signals).

- Every signal today is created in a route and handed to islands on the same
  page. There is no cross-page signal.
- The shared state is the page-local `href` mirror plus a few page signals (4 on
  the puzzle page, 6 on the editor). The alignment invariants remove most of
  them: `derivePlayState(url, puzzle)` and `getDialog(url, player)` are computed
  once in the root, and children get derived props.
- `mode` is a constant or a one-time URL read, so it becomes a prop. `puzzle`
  only needs to be a signal on the editor.

## Don't carry over

- `client/hint-signals.ts` (`hintUsed`) and `client/flash-signals.ts`
  (`flashExplained`) become root-owned `useSignal`s. Under `ClientRouter` a
  module-level signal survives navigation and leaks state into the next puzzle.
- `islands/router.tsx` goes. Module-level code may hold only an event
  dispatcher; anything stateful is created inside the root, and listeners are
  removed on `astro:before-swap`.

## Per page

| Page                           | Root                                                                            | Stays static                                         |
| ------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Puzzle                         | Board, ScoreBadge, PlayControls (+ FlashSwitch), nudges, all dialogs, auto-post | Header, h1, BadgeStars, panels (as slots or outside) |
| Tutorial                       | Board, PlayControls, ScoreBadge, hint and tutorial dialogs                      | h1, ActionsPanel, watch button                       |
| Preview                        | Board, PlayControls, ScoreBadge                                                 | the rest                                             |
| Editor                         | All 10 islands; owns the real client state and the solver worker hook           | label, Header, wrapper                               |
| Solution replay                | Board, ScoreBadge                                                               | h1, stars, panel                                     |
| Solutions, high score, profile | The single FeedbackDialog island is its own root                                | everything else                                      |
| Archive                        | ArchiveHeading on its own                                                       | everything else                                      |
| Home, cookie policy            | none                                                                            | all                                                  |

Global: TrackingScript stays an independent island (`client:idle`); the cookie
banner is a plain server form.

## Puzzle page shape

```
Page.astro (static shell)
  <Header/> <h1/> <BadgeStars/>        static, passed as slots where inside
  <PuzzleRoot client:load puzzle player hintCount …>
    owns: href, hintUsed, flashExplained, celebration, isRated
    computes once: derivePlayState, getDialog
    children: ScoreBadge, Board, PlayControls, nudges, dialogs
  <ActionsPanel/> <PrintPanel/>        static
```

Dialogs render in the top layer, so putting them inside the root doesn't affect
layout. Static markup inside the root is about 1–2 KB.

## JS impact

Neutral to slightly better: props are serialised once instead of eight times,
the router island and two singletons go, and rarely opened dialogs can be split
with dynamic `import()`. Not measured.

## Open

- Confirm Astro slot content stays server-rendered inside a `client:load` Preact
  root (checked in the Astro spike).
- Confirm no `print:` styling depends on being outside the island.
