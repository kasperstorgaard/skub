# Parity checklist

Every player-facing flow and route of the Deno app, and whether the new app has
it. A flow counts as ported when its e2e tests pass on the new app's preview.
The switch needs every row ported or marked not kept.

- **Keep?** is filled by a separate "kill your darlings" review.
- **Ported** and **Passes on next** are filled during rollout steps 4–5 (step 8
  for the authoring tool).
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

| Flow                        | Routes                                                                        | No-JS behaviour                                                                                               | E2E today                                                                                           | Keep? | Ported | Passes on next | Notes                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----- | ------ | -------------- | -------------------------------------------------------------------------------------------- |
| Open and play a puzzle      | `GET /puzzles/[slug]`                                                         | Each move is a link; moves live in the URL. An invalid move 303s back with `?error=`.                         | `puzzle_test.ts` (no-JS, portals), `returning-user-flow_test.ts`                                    |       |        |                | Unreleased puzzles 404. Islands: board, play-controls, score-badge. One island root on next. |
| Solve and save, named (JS)  | `POST /puzzles/[slug]` (JSON)                                                 | n/a                                                                                                           | `puzzle_test.ts` (celebration, duplicate solve), `returning-user-flow_test.ts`, `highscore_test.ts` |       |        |                | Auto-post on solve, then the celebration. Outbox-allowlisted on next.                        |
| Solve and save without JS   | `GET /puzzles/[slug]` → 303 `?dialog=solution`; `POST /puzzles/[slug]` (form) | Solved board redirects to the name dialog; the form POST 303s to the solutions page (`?tab=flash` for Flash). | `puzzle_test.ts`, `new-user-flow_test.ts`, `returning-user-flow_test.ts`                            |       |        |                |                                                                                              |
| New player names themselves | `POST /puzzles/[slug]`                                                        | Name form in the solution dialog.                                                                             | `puzzle_test.ts` (keyboard solve prompt, name → solutions page)                                     |       |        |                | Name is stored on the user.                                                                  |
| Celebration                 | `GET /puzzles/[slug]`                                                         | Named no-JS players get the solution dialog with the name pre-filled, not the celebration.                    | `puzzle_test.ts`, `returning-user-flow_test.ts`                                                     |       |        |                | Stars and a second call to action.                                                           |
| Play next                   | `GET /puzzles/recommended`                                                    | 303 to `/puzzles/<slug>`, or `/`.                                                                             | none: write first                                                                                   |       |        |                | On next the server renders a concrete link instead. Whether the route stays is open.         |
| Share image                 | `GET /puzzles/[slug]/og-image`                                                | Plain SVG.                                                                                                    | none                                                                                                |       |        |                |                                                                                              |

## Hints

| Flow       | Routes                                          | No-JS behaviour                                  | E2E today         | Keep? | Ported | Passes on next | Notes                                                                                                            |
| ---------- | ----------------------------------------------- | ------------------------------------------------ | ----------------- | ----- | ------ | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Get a hint | `POST /puzzles/[slug]/hint` (`GET` answers 405) | Form POST 303s back to the puzzle with the hint. | none: write first |       |        |                | JSON for the hint dialog. One per puzzle, counted in a cookie. Runs the solver (7M states). Online-only on next. |

## Flash

| Flow                      | Routes                       | No-JS behaviour                          | E2E today       | Keep? | Ported | Passes on next | Notes                                                                 |
| ------------------------- | ---------------------------- | ---------------------------------------- | --------------- | ----- | ------ | -------------- | --------------------------------------------------------------------- |
| Turn Flash on, or not now | `POST /puzzles/[slug]/flash` | Form POST 303s back.                     | `flash_test.ts` |       |        |                | Flash dialog, nudge and toolbar switch. Flash state lives in cookies. |
| Solve with Flash          | `POST /puzzles/[slug]`       | As a regular solve; 303 to `?tab=flash`. | `flash_test.ts` |       |        |                | Kept off the high score; saved as Flash.                              |

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

| Flow    | Routes                    | No-JS behaviour            | E2E today                                                              | Keep? | Ported | Passes on next | Notes                                                                                     |
| ------- | ------------------------- | -------------------------- | ---------------------------------------------------------------------- | ----- | ------ | -------------- | ----------------------------------------------------------------------------------------- |
| Home    | `GET /`                   | Server-rendered.           | `home_test.ts`, `new-user-flow_test.ts`, `returning-user-flow_test.ts` |       |        |                | Daily puzzle, recommended card (tutorial, starter, quick), stats and streak from cookies. |
| Archive | `GET /puzzles` (`?date=`) | Month links and day links. | `archives_test.ts`, `returning-user-flow_test.ts`                      |       |        |                | Desktop month calendar, mobile card row.                                                  |

## Login and profile

| Flow                    | Routes                                                  | No-JS behaviour                    | E2E today                                      | Keep?             | Ported | Passes on next | Notes                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------- | ---------------------------------- | ---------------------------------------------- | ----------------- | ------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Log in                  | `GET /auth/login` (`?return_to=`), `GET /auth/callback` | 303s through Auth0 and back.       | none: write first                              |                   |        |                | PKCE plus a one-time `oauth_state` (`expires_at` on next, checked on consume). Sessions are imported, so no re-login at the switch. First login claims sub → userId. Online-only on next. Auth0 needs `next.skub.app` as a callback. |
| Log out                 | `GET /auth/logout`                                      | 303; the device starts over.       | none: write first                              |                   |        |                |                                                                                                                                                                                                                                      |
| Profile: name and theme | `GET /profile`, `POST /profile`                         | Form POST 303s back to `/profile`. | `profile_test.ts` (seeded user; no real login) |                   |        |                | Two of its four tests inspect storage and cookies, as commented exceptions. Name is outbox-allowlisted on next. Its tests seed the retro theme `dookie`; on next they need a ported theme.                                           |
| Retro themes            | `POST /profile` (theme)                                 | Theme picker is a form.            | `profile_test.ts` (seeds `dookie`)             | cut: retro themes |        |                | matrix, discman, geocities, sash, riso, digicam, dookie (and the retired moquette). Kept on the Deno app until the switch. What a player with a cut theme sees on next is open.                                                      |

## Editor

The editor relies on JS by design.

| Flow                  | Routes                                                                           | No-JS behaviour                   | E2E today         | Keep? | Ported | Passes on next | Notes                                                                                       |
| --------------------- | -------------------------------------------------------------------------------- | --------------------------------- | ----------------- | ----- | ------ | -------------- | ------------------------------------------------------------------------------------------- |
| Build a board         | `GET /puzzles/build`, `GET /puzzles/new` (303), `GET /puzzles/build/reset` (303) | Board renders; editing needs JS.  | none: write first |       |        |                | Resumes the draft stored per user (`draft` column on `user` on next).                       |
| Autosave and download | `POST /api/store`, `GET /api/export`                                             | n/a                               | none: write first |       |        |                | Writes the `draft` column on next.                                                          |
| Difficulty badge      | `POST /api/solve`                                                                | n/a                               | none: write first |       |        |                | Streamed solve, 3M-state budget, refuses boards in the corpus. Public. Online-only on next. |
| Play the draft        | `POST /puzzles/build/play` (303), `GET /puzzles/preview`                         | Preview plays with links.         | none: write first |       |        |                | No solution submission.                                                                     |
| Remix a puzzle        | `POST /puzzles/[slug]/clone`                                                     | Form POST 303s to the editor.     | none: write first |       |        |                |                                                                                             |
| Submit a board        | `POST /puzzles/build/submit`                                                     | 303 with a sent or failed dialog. | none: write first |       |        |                | Emailed to `SUBMISSIONS_EMAIL`.                                                             |

## Feedback

| Flow                  | Routes           | No-JS behaviour                                             | E2E today         | Keep? | Ported | Passes on next | Notes                                                                                                                                                                                |
| --------------------- | ---------------- | ----------------------------------------------------------- | ----------------- | ----- | ------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rate or send feedback | `POST /feedback` | 303 back with `?dialog=feedback-sent` or `feedback-failed`. | none: write first |       |        |                | JSON for the dialog. Stored and emailed. A rating marks the puzzle rated in the progress cookie. On the puzzle, solutions, high score and profile pages. Outbox-allowlisted on next. |

## Tutorial

| Flow               | Routes                                                | No-JS behaviour                              | E2E today                                     | Keep? | Ported | Passes on next | Notes                              |
| ------------------ | ----------------------------------------------------- | -------------------------------------------- | --------------------------------------------- | ----- | ------ | -------------- | ---------------------------------- |
| Solve the tutorial | `GET /puzzles/tutorial` (`?mode=`, `?tutorial_step=`) | Steps and dialogs via 303s; moves are links. | `tutorial_test.ts`, `new-user-flow_test.ts`   |       |        |                | JSON POST from auto-post on solve. |
| Watch the replay   | `GET /puzzles/tutorial?mode=replay`                   | Replay steps are links.                      | `tutorial_test.ts`, `new-user-flow_test.ts`   |       |        |                |                                    |
| "I'm ready"        | `POST /puzzles/tutorial` (form)                       | Sets the beginner skill level, 303 home.     | `home_test.ts` (indirectly, via seeded state) |       |        |                |                                    |
| Tutorial nudge     | `GET /puzzles/[slug]`, `GET /`                        | Server-rendered link.                        | `puzzle_test.ts`, `home_test.ts`              |       |        |                |                                    |

## Policy pages and consent

| Flow          | Routes               | No-JS behaviour                                     | E2E today         | Keep? | Ported | Passes on next | Notes                                            |
| ------------- | -------------------- | --------------------------------------------------- | ----------------- | ----- | ------ | -------------- | ------------------------------------------------ |
| Cookie policy | `GET /cookie-policy` | Static.                                             | none              |       |        |                | Prerendered at build on next.                    |
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

## API endpoints

Endpoints not already listed under a flow.

| Endpoint                                | Purpose                     | E2E today                   | Keep? | Ported | Passes on next | Notes                                                                         |
| --------------------------------------- | --------------------------- | --------------------------- | ----- | ------ | -------------- | ----------------------------------------------------------------------------- |
| `POST /api/e2e/reset`                   | Wipes the branch database   | Used by CI before every run |       |        |                | `deleteAll()` on next. Needs `x-e2e-secret`; refuses outside a branch deploy. |
| `POST /api/e2e/users`                   | Seeds a test user           | Used by every seeded test   |       |        |                | Needed on next for the shared suite.                                          |
| `GET`, `DELETE /api/e2e/users/[userId]` | Reads or clears a test user | `profile_test.ts`           |       |        |                | Needed on next for the shared suite.                                          |
| `POST /api/e2e/solutions`               | Seeds a solution            | `solutions_test.ts`         |       |        |                | Needed on next for the shared suite.                                          |

`/api/solve`, `/api/store`, `/api/export` and `/api/consent` are listed under
their flows above.

## Authoring tool (ported after the switch)

Not part of the switch. It runs locally on the Deno/Fresh app until rollout step
8 moves it into the new app as dev-only pages. See
[architecture.md](architecture.md#authoring-tool).

| Flow                    | Routes                                                             | E2E today | Keep?                                    | Ported | Notes                                         |
| ----------------------- | ------------------------------------------------------------------ | --------- | ---------------------------------------- | ------ | --------------------------------------------- |
| Browse candidates       | `GET /candidates` (`?show=promoted`)                               | none      | yes, ported after the switch as dev-only |        | 404 outside dev.                              |
| Review a candidate      | `GET /candidates/[slug]`, `GET /candidates/review`                 | none      | yes, ported after the switch as dev-only |        | Ratings and route tags via `/api/candidates`. |
| Edit a candidate        | `GET /candidates/[slug]/edit`                                      | none      | yes, ported after the switch as dev-only |        | Opens it in the editor.                       |
| Promote                 | `POST /candidates/[slug]/promote`                                  | none      | yes, ported after the switch as dev-only |        | Writes `static/puzzles`.                      |
| Candidate API           | `POST /api/candidates`                                             | none      | yes, ported after the switch as dev-only |        | Writes `candidates/*.md`.                     |
| Scoring and calibration | `scripts/` (score-corpus, check-calibration, list-candidates, ...) | none      | yes, ported after the switch as dev-only |        | Includes the metric catalog.                  |

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
