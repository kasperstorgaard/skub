# Submit a puzzle by email

## Problem

Players can build puzzles in the editor, but getting one to me means Download →
fork the repo → PR, or emailing me directly, which only works for people who
already have my address. Most players won't do either.

## Approach

A **Submit** button in the editor panel (non-dev only, next to Download) posts the
draft to the server, which emails it to me and returns the player to the editor
with a confirmation dialog.

- **Ready state** — the button is disabled until the board has a solution. The
  editor's difficulty badge already solves the board as it's built; it writes the
  move count back onto the puzzle signal (as the composer does), and the panel
  enables Submit when `minMoves > 0`.
- **Action** — `POST /puzzles/build/submit`, alongside the existing `reset`
  action. It reads the board from the request (the on-screen board, since
  autosave is debounced), re-validates it server-side and solves it with the
  editor's state budget. Invalid, unsolvable, or already-shipping boards (corpus
  canonical hash, same check as `/api/solve`) are skipped — that is the spam
  filter.
- **Email** — sent through Resend's HTTP API from `submissions@skub.app` to me.
  Body has the name, move count and ASCII board; the formatted `.md` is attached
  so it can be dropped into `static/puzzles/`. Uses its own sending-only key,
  `RESEND_API_KEY`, separate from Auth0's.
- **Reply-To** — logged-in players' account email is used automatically, with a
  note by the button saying so. Anonymous players get an optional email field.
  Without either, the email has no Reply-To.
- **Confirmation** — the action redirects (303) to `/puzzles/build?submitted`,
  and the page opens a dialog stating the puzzle was sent.
- **Analytics** — one server-side `puzzle_submitted` event.
- **Contribute page** — "3b. Send me an email" points at the Submit button.

## Non-goals

- **Rate limiting / dedupe.** Skipping invalid boards is the first line. Note:
  submission emails share Resend's daily quota with Auth0 login codes, so a flood
  of valid submissions could block logins. Revisit if it happens.
- **Homepage "Feeling creative?" entry point and an editor rebrand.** Separate
  branch.
- **Receiving email** (Cloudflare Email Routing / Resend inbound).
