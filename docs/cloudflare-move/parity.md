# Parity checklist

Every player-facing flow and route of the Deno app, and whether the new app has
it. A flow counts as ported when its e2e tests pass on the new app's preview.
The switch needs every row ported or marked not kept.

- **Keep?** is otherwise filled by a separate "kill your darlings" review.
- **Ported** and **Passes on next** are filled during rollout steps 4–5.
- **Keep?** already holds the owner's calls where made: retro themes cut;
  editor, authoring, streak and skill kept.
- **E2E today** names the test files. "write first" marks rows whose lean e2e is
  written against the Deno app before the flow is ported (rollout step 4). Where
  the files live:
  - `new-user-flow_test.ts`, `returning-user-flow_test.ts`: `e2e/`
  - `home_test.ts`, `highscore_test.ts`: `routes/_e2e/`
  - `archives_test.ts`: `routes/puzzles/_e2e/`
  - `puzzle_test.ts`, `flash_test.ts`: `routes/puzzles/[slug]/_e2e/`
  - `solutions_test.ts`: `routes/puzzles/[slug]/solutions/_e2e/`
  - `tutorial_test.ts`: `routes/puzzles/tutorial/_e2e/`
  - `profile_test.ts`: `routes/profile/_e2e/`

## Play and solve

| Flow                        | Routes                                                                        | No-JS behaviour                                                                                               | E2E today                                                                                           | Keep? | Ported | Passes on next | Notes                                                                                                                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----- | ------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Open and play a puzzle      | `GET /puzzles/[slug]`                                                         | Each move is a link; moves live in the URL. An invalid move 303s back with `?error=`.                         | `puzzle_test.ts` (no-JS, portals), `returning-user-flow_test.ts`                                    |       |        |                | Unreleased puzzles 404. Islands: board, play-controls, score-badge. One island root on next.                                                                                                                                                           |
| Solve and save, named (JS)  | `POST /puzzles/[slug]` (JSON)                                                 | n/a                                                                                                           | `puzzle_test.ts` (celebration, duplicate solve), `returning-user-flow_test.ts`, `highscore_test.ts` |       |        |                | Auto-post on solve, then the celebration. Outbox-allowlisted on next. Port follows the [alignment invariants](architecture.md#clientserver-alignment), so the mechanism changes by design: one 303 path via `submitForm()`, no JSON branch.            |
| Solve and save without JS   | `GET /puzzles/[slug]` → 303 `?dialog=solution`; `POST /puzzles/[slug]` (form) | Solved board redirects to the name dialog; the form POST 303s to the solutions page (`?tab=flash` for Flash). | `puzzle_test.ts`, `new-user-flow_test.ts`, `returning-user-flow_test.ts`                            |       |        |                | Port follows the [alignment invariants](architecture.md#clientserver-alignment), so the mechanism changes by design: the dialog is derived by `getDialog`, not encoded in the redirect.                                                                |
| New player names themselves | `POST /puzzles/[slug]`                                                        | Name form in the solution dialog.                                                                             | `puzzle_test.ts` (keyboard solve prompt, name → solutions page)                                     |       |        |                | Name is stored on the user. Port follows the [alignment invariants](architecture.md#clientserver-alignment), so the mechanism changes by design: the name form is an outcome dialog from `getDialog`.                                                  |
| Skill level                 | `POST /puzzles/[slug]`, `POST /puzzles/tutorial`                              | Assessed server-side on each new solve; the tutorial's "I'm ready" sets beginner.                             | `home_test.ts` (cards per skill, seeded)                                                            | yes   |        |                | Drives the recommended card and "Play next". Kept as the engine for onboarding.                                                                                                                                                                        |
| Celebration                 | `GET /puzzles/[slug]`                                                         | Named no-JS players get the solution dialog with the name pre-filled, not the celebration.                    | `puzzle_test.ts`, `returning-user-flow_test.ts`                                                     |       |        |                | Stars and a second call to action. Port follows the [alignment invariants](architecture.md#clientserver-alignment), so the mechanism changes by design: derived by `getDialog` on every render; stars from the progress cookie. Fixes the reload TODO. |
| Play next                   | `GET /puzzles/recommended`                                                    | 303 to `/puzzles/<slug>`, or `/`.                                                                             | none: write first                                                                                   | yes   |        |                | On next the server renders a concrete link instead. Whether the route stays is open. Picked by skill level, like the home card.                                                                                                                        |
| Share image                 | `GET /puzzles/[slug]/og-image`                                                | Plain SVG.                                                                                                    | none: write first                                                                                   |       |        |                |                                                                                                                                                                                                                                                        |

## Hints

| Flow       | Routes                                          | No-JS behaviour                                                                                                                                      | E2E today         | Keep? | Ported | Passes on next | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----- | ------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Get a hint | `POST /puzzles/[slug]/hint` (`GET` answers 405) | Today: form POST 303s back to the puzzle with the hint. On next: no hints without JS (control hidden under `noscript:`, or "Hints need JavaScript"). | none: write first |       |        |                | Changes mechanism by design, and is JS-only on next. The hint is computed in a Web Worker in the browser, online and offline; the hint POST only records the spend (303, offline-capable, queued). Allowance still one per puzzle, checked from the server-rendered count in props, trust-based; an over-allowance spend is dropped on replay. Lower budget offline and on low-end devices ("No hint available from here"). Follows the [alignment invariants](architecture.md#clientserver-alignment): no JSON branch. |

## Flash

| Flow                      | Routes                       | No-JS behaviour                          | E2E today       | Keep? | Ported | Passes on next | Notes                                                                                                                                                                                                                                                                       |
| ------------------------- | ---------------------------- | ---------------------------------------- | --------------- | ----- | ------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turn Flash on, or not now | `POST /puzzles/[slug]/flash` | Form POST 303s back.                     | `flash_test.ts` |       |        |                | Flash dialog, nudge and toolbar switch. Flash state lives in cookies. Port follows the [alignment invariants](architecture.md#clientserver-alignment), so the mechanism changes by design: 303 only, no JSON branch; the variant is `?flash=1` in the URL.                  |
| Solve with Flash          | `POST /puzzles/[slug]`       | As a regular solve; 303 to `?tab=flash`. | `flash_test.ts` |       |        |                | Kept off the high score; saved as Flash. Port follows the [alignment invariants](architecture.md#clientserver-alignment), so the mechanism changes by design: the variant is `?flash=1` in the URL and sent with the solve, not read from a cookie. Fixes the variant TODO. |

## Solutions

| Flow              | Routes                                         | No-JS behaviour                                        | E2E today                                                                                                      | Keep? | Ported | Passes on next | Notes                                                                                                                               |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----- | ------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Solutions list    | `GET /puzzles/[slug]/solutions` (`?tab=flash`) | Server-rendered, tabs are links.                       | `solutions_test.ts`, `flash_test.ts`, `puzzle_test.ts`, `new-user-flow_test.ts`, `returning-user-flow_test.ts` |       |        |                | Personalised. Path groups edge-cached on next and deleted in the colo on a solve; own solutions are a direct DO read, never cached. |
| Replay a solution | `GET /puzzles/[slug]/solutions/[solutionId]`   | 303 adds the moves to the URL; replay steps are links. | `solutions_test.ts` (URL only); write first                                                                    |       |        |                | Flash solves replay from the Flash start. No assertion on what the page shows.                                                      |

## High score

| Flow      | Routes                      | No-JS behaviour  | E2E today           | Keep? | Ported | Passes on next | Notes                                                                                            |
| --------- | --------------------------- | ---------------- | ------------------- | ----- | ------ | -------------- | ------------------------------------------------------------------------------------------------ |
| This week | `GET /highscore`            | Server-rendered. | none: write first   |       |        |                | The heaviest read today. Viewer's own row when outside the top. Top entries edge-cached on next. |
| All time  | `GET /highscore?period=all` | Server-rendered. | `highscore_test.ts` |       |        |                | Viewer's own row from the cookie, unranked.                                                      |

## Archive and home

| Flow             | Routes                    | No-JS behaviour               | E2E today                                                              | Keep? | Ported | Passes on next | Notes                                                                                    |
| ---------------- | ------------------------- | ----------------------------- | ---------------------------------------------------------------------- | ----- | ------ | -------------- | ---------------------------------------------------------------------------------------- |
| Home             | `GET /`                   | Server-rendered.              | `home_test.ts`, `new-user-flow_test.ts`, `returning-user-flow_test.ts` | yes   |        |                | Daily puzzle and the recommended card (tutorial, starter, quick), picked by skill level. |
| Stats and streak | `GET /`, `GET /profile`   | Server-rendered from cookies. | `home_test.ts` (streak after several dailies)                          | yes   |        |                | Kasper: "Streak 100% stays."                                                             |
| Archive          | `GET /puzzles` (`?date=`) | Month links and day links.    | `archives_test.ts`, `returning-user-flow_test.ts`                      |       |        |                | Desktop month calendar, mobile card row.                                                 |

## Login and profile

| Flow                    | Routes                                                  | No-JS behaviour                    | E2E today                                      | Keep?             | Ported | Passes on next | Notes                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------- | ---------------------------------- | ---------------------------------------------- | ----------------- | ------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Log in                  | `GET /auth/login` (`?return_to=`), `GET /auth/callback` | 303s through Auth0 and back.       | none: write first                              |                   |        |                | PKCE plus a one-time `oauth_state` (`expires_at` on next, checked on consume). Sessions are imported, so no re-login at the switch. First login claims sub → userId. Online-only on next. Auth0 needs `next.skub.app` as a callback. |
| Log out                 | `GET /auth/logout`                                      | 303; the device starts over.       | none: write first                              |                   |        |                |                                                                                                                                                                                                                                      |
| Profile: name and theme | `GET /profile`, `POST /profile`                         | Form POST 303s back to `/profile`. | `profile_test.ts` (seeded user; no real login) |                   |        |                | Two of its four tests inspect storage and cookies, as commented exceptions. Name is outbox-allowlisted on next. Its tests seed the retro theme `dookie`; on next they need a ported theme.                                           |
| Retro themes            | `POST /profile` (theme)                                 | Theme picker is a form.            | `profile_test.ts` (seeds `dookie`)             | cut: retro themes |        |                | matrix, discman, geocities, sash, riso, digicam, dookie (and the retired moquette). Kept on the Deno app until the switch. Players with a retro theme fall back to skub.                                                             |

## Editor

The editor relies on JS by design.

| Flow                  | Routes                                                                           | No-JS behaviour                   | E2E today         | Keep? | Ported | Passes on next | Notes                                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------- | --------------------------------- | ----------------- | ----- | ------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build a board         | `GET /puzzles/build`, `GET /puzzles/new` (303), `GET /puzzles/build/reset` (303) | Board renders; editing needs JS.  | none: write first | yes   |        |                | Resumes the draft stored per user (`draft` column on `user` on next).                                                                                                                             |
| Autosave and download | `POST /api/store`, `GET /api/export`                                             | n/a                               | none: write first | yes   |        |                | Writes the `draft` column on next.                                                                                                                                                                |
| Difficulty badge      | `POST /api/solve`                                                                | n/a                               | none: write first | yes   |        |                | `POST /api/solve` and the streamed solve are removed by design. On next the editor solves in the page's Web Worker. Today: streamed solve, 3M-state budget, refuses boards in the corpus, public. |
| Play the draft        | `POST /puzzles/build/play` (303), `GET /puzzles/preview`                         | Preview plays with links.         | none: write first | yes   |        |                | No solution submission.                                                                                                                                                                           |
| Remix a puzzle        | `POST /puzzles/[slug]/clone`                                                     | Form POST 303s to the editor.     | none: write first | yes   |        |                |                                                                                                                                                                                                   |
| Submit a board        | `POST /puzzles/build/submit`                                                     | 303 with a sent or failed dialog. | none: write first | yes   |        |                | Emailed to `SUBMISSIONS_EMAIL`.                                                                                                                                                                   |

## Feedback

| Flow                  | Routes           | No-JS behaviour                                             | E2E today         | Keep? | Ported | Passes on next | Notes                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ---------------- | ----------------------------------------------------------- | ----------------- | ----- | ------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rate or send feedback | `POST /feedback` | 303 back with `?dialog=feedback-sent` or `feedback-failed`. | none: write first |       |        |                | JSON for the dialog. Stored and emailed. A rating marks the puzzle rated in the progress cookie. On the puzzle, solutions, high score and profile pages. Outbox-allowlisted on next. Port follows the [alignment invariants](architecture.md#clientserver-alignment), so the mechanism changes by design: 303 only, no JSON branch. |

## Tutorial

| Flow               | Routes                                                | No-JS behaviour                              | E2E today                                     | Keep? | Ported | Passes on next | Notes                                                                                                                                                                                                               |
| ------------------ | ----------------------------------------------------- | -------------------------------------------- | --------------------------------------------- | ----- | ------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solve the tutorial | `GET /puzzles/tutorial` (`?mode=`, `?tutorial_step=`) | Steps and dialogs via 303s; moves are links. | `tutorial_test.ts`, `new-user-flow_test.ts`   |       |        |                | JSON POST from auto-post on solve. Port follows the [alignment invariants](architecture.md#clientserver-alignment), so the mechanism changes by design: the auto-post becomes a `submitForm()` 303, no JSON branch. |
| Watch the replay   | `GET /puzzles/tutorial?mode=replay`                   | Replay steps are links.                      | `tutorial_test.ts`, `new-user-flow_test.ts`   |       |        |                |                                                                                                                                                                                                                     |
| "I'm ready"        | `POST /puzzles/tutorial` (form)                       | Sets the beginner skill level, 303 home.     | `home_test.ts` (indirectly, via seeded state) | yes   |        |                |                                                                                                                                                                                                                     |
| Tutorial nudge     | `GET /puzzles/[slug]`, `GET /`                        | Server-rendered link.                        | `puzzle_test.ts`, `home_test.ts`              |       |        |                |                                                                                                                                                                                                                     |

## Policy pages and consent

| Flow          | Routes               | No-JS behaviour                                     | E2E today         | Keep? | Ported | Passes on next | Notes                                            |
| ------------- | -------------------- | --------------------------------------------------- | ----------------- | ----- | ------ | -------------- | ------------------------------------------------ |
| Cookie policy | `GET /cookie-policy` | Static.                                             | none: write first |       |        |                | Prerendered at build on next.                    |
| Cookie banner | `POST /api/consent`  | Accept, decline or reset; 303 back to the referrer. | none: write first |       |        |                | The e2e helpers set a cookie to hide the banner. |

## Cross-cutting

| Flow                      | Routes                               | No-JS behaviour  | E2E today                                  | Keep? | Ported | Passes on next | Notes                                                                                       |
| ------------------------- | ------------------------------------ | ---------------- | ------------------------------------------ | ----- | ------ | -------------- | ------------------------------------------------------------------------------------------- |
| Cookie-first player state | middleware (user, auth, tracking)    | n/a              | `profile_test.ts`                          |       |        |                | Signed profile and progress cookies, rebuilt from the store when missing. Same signing key. |
| Error and 404 pages       | `_error`                             | Server-rendered. | none: write first                          |       |        |                |                                                                                             |
| PostHog proxy             | `/ph/*`                              | n/a              | none                                       |       |        |                | Kept on next.                                                                               |
| Client navigation         | Fresh Partials, `islands/router.tsx` | Full page loads. | `returning-user-flow_test.ts` (back links) |       |        |                | `ClientRouter` on next. `?dialog=` router stays.                                            |
| Hourly backup             | `Deno.cron`                          | n/a              | none                                       |       |        |                | Cron Trigger on next.                                                                       |
| `robots.txt`, favicons    | static                               | n/a              | none                                       |       |        |                |                                                                                             |

## Offline (new in the new app)

No Deno equivalent. E2E is written first, with Playwright offline emulation, in
the new app only (see [harness.md](harness.md#offline-e2e)).

| Flow                    | Routes                                         | No-JS behaviour                    | E2E today         | Keep? | Ported | Passes on next | Notes                                                                                                                                                               |
| ----------------------- | ---------------------------------------------- | ---------------------------------- | ----------------- | ----- | ------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline overlay         | any `ClientRouter` navigation                  | n/a (needs the service worker)     | none: write first |       |        |                | Opens when an uncached navigation fails or is pending after ~3 s: "Waiting for connection…" plus "Play offline". Closes if the request completes.                   |
| Offline Home            | `/?offline&return=<url>`                       | n/a (served by the service worker) | none: write first |       |        |                | Cached Home. Dims uncached links, "N solves will sync when you're back", return dialog once online. Full page loads offline land here.                              |
| Offline solution dialog | `/puzzles/[slug]` (202 Queued, stays in place) | n/a                                | none: write first |       |        |                | Placeholder stars, "saved on this device" → "saved" after sync, "Next puzzle" and "More puzzles". Name form for unnamed players; the name is queued with the solve. |

## API endpoints

Endpoints not already listed under a flow.

| Endpoint                                | Purpose                     | E2E today                   | Keep? | Ported | Passes on next | Notes                                                                         |
| --------------------------------------- | --------------------------- | --------------------------- | ----- | ------ | -------------- | ----------------------------------------------------------------------------- |
| `POST /api/e2e/reset`                   | Wipes the branch database   | Used by CI before every run |       |        |                | `deleteAll()` on next. Needs `x-e2e-secret`; refuses outside a branch deploy. |
| `POST /api/e2e/users`                   | Seeds a test user           | Used by every seeded test   |       |        |                | Needed on next for the shared suite.                                          |
| `GET`, `DELETE /api/e2e/users/[userId]` | Reads or clears a test user | `profile_test.ts`           |       |        |                | Needed on next for the shared suite.                                          |
| `POST /api/e2e/solutions`               | Seeds a solution            | `solutions_test.ts`         |       |        |                | Needed on next for the shared suite.                                          |

`/api/solve` (removed on next), `/api/store`, `/api/export` and `/api/consent`
are listed under their flows above.

## Authoring tool (ported before the switch, dev-only)

Ported before the switch as the "Authoring (dev-only)" flow in rollout step 4:
dev-only pages plus the dev-only filesystem integration. Excluded from
production builds, so it has no preview e2e. See
[architecture.md](architecture.md#authoring-tool).

| Flow                    | Routes                                                             | E2E today | Keep?                                    | Ported | Notes                                         |
| ----------------------- | ------------------------------------------------------------------ | --------- | ---------------------------------------- | ------ | --------------------------------------------- |
| Browse candidates       | `GET /candidates` (`?show=promoted`)                               | none      | yes, ported before the switch (dev-only) |        | 404 outside dev.                              |
| Review a candidate      | `GET /candidates/[slug]`, `GET /candidates/review`                 | none      | yes, ported before the switch (dev-only) |        | Ratings and route tags via `/api/candidates`. |
| Edit a candidate        | `GET /candidates/[slug]/edit`                                      | none      | yes, ported before the switch (dev-only) |        | Opens it in the editor.                       |
| Promote                 | `POST /candidates/[slug]/promote`                                  | none      | yes, ported before the switch (dev-only) |        | Writes `static/puzzles`.                      |
| Candidate API           | `POST /api/candidates`                                             | none      | yes, ported before the switch (dev-only) |        | Writes `candidates/*.md`.                     |
| Scoring and calibration | `scripts/` (score-corpus, check-calibration, list-candidates, ...) | none      | yes, ported before the switch (dev-only) |        | Includes the metric catalog.                  |

## Dev-only behaviour in player routes

These depend on `isDev` today. On next they follow the app-environment flag or
go.

| Behaviour                            | Route                                | Keep? |
| ------------------------------------ | ------------------------------------ | ----- |
| Unreleased puzzles open in dev       | `/puzzles/[slug]/*`                  |       |
| No hint limit in dev                 | `/puzzles/[slug]/hint`               |       |
| Edit link on unreleased puzzles      | `/puzzles/[slug]`                    |       |
| Dev panel in the editor and preview  | `/puzzles/build`, `/puzzles/preview` |       |
| Clone keeps the puzzle's name in dev | `/puzzles/[slug]/clone`              |       |
| Error details in dev                 | `_error`                             |       |
