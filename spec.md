# Submit a puzzle by email

## Problem

Players can build puzzles in the editor, but getting one to me means Download →
fork the repo → PR, or emailing me directly, which only works for people who
already have my address. Most players won't do either.

## Approach

A **Submit** button in the editor panel opens a dialog that sets
expectations, takes an optional note, and sends the puzzle to me by email.

- **Ready state** — Submit is disabled until the board has a solution, and the
  dialog won't open without one either. The editor's solve stream moves out
  of the difficulty badge into a no-UI `EditorSolver` island: it writes progress
  and errors to a `solveState` signal and a solution's move count onto the
  puzzle; the badge and the dialog only read them. A solve that gives up on its
  budget (depth or the editor's state cap) lets the board through unconfirmed —
  only boards the solver rules out stay disabled.
- **Dialog** — `?submit=compose` opens "Submit a puzzle": what happens next (I
  play every one and do my best to reply; if it makes it in, it keeps the name
  the submitter gave it) and an optional note. Guests get an optional email
  field; logged-in players get an "Include my email" checkbox (on by default) —
  unticked, the submission is anonymous, with no Reply-To and no username.
- **Action** — `POST /puzzles/build/submit`, alongside the existing `reset`
  action. It takes the on-screen board from the dialog's form (autosave is
  debounced) and only checks that it parses. No server-side solve: it can take
  up to a minute on busy boards, and the disabled button already keeps honest
  players to solvable ones. Lenient on purpose — the goal is to see anything
  from players at all.
- **Email** — sent through Resend's HTTP API from `submissions@skub.app` to me,
  with name, move count, sender, note and the board; the `.md` is attached so it
  can be dropped into `static/puzzles/`. The recipient comes from `SUBMISSIONS_EMAIL`, so the address isn't in the
  repo. Uses its own sending-only key,
  `RESEND_API_KEY`; without either, the Submit button is hidden.
- **Confirmation** — the action redirects (303) to `?submit=sent` or
  `?submit=failed`, which the same dialog island renders.
- **Analytics** — one server-side `puzzle_submitted` event, with `has_reply_to`
  and `has_note`.
- **Entry point** — the "Feeling creative? Build a puzzle" button moves from the
  archives panel to the homepage panel, so players find the editor at all.
- **Contribute page removed** — Submit replaces its email step, and the editor
  is the guide now; the page can come back later for deeper tips.

## Non-goals

- **Abuse handling** — no rate limiting, dedupe or server-side validation beyond
  parsing. Note: submission emails share Resend's daily quota with Auth0 login
  codes, so a flood could block logins. Revisit if it happens.
- **An editor rebrand.** Separate branch.
- **Receiving email** (Cloudflare Email Routing / Resend inbound).
