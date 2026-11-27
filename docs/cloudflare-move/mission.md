# Mission

Skub is a small, free puzzle game that plays anywhere: on any device, with or
without JS, online or off.

## Product north star

Every feature is weighed against it; the
[architecture north star](architecture.md) is how it's built.

- **Server side.** Pages render on the server. The client only enhances.
- **Accessible.** Including without JS: every core flow works with JS off.
- **Fast.** Quick first byte, small pages, little JS.
- **CSS and the web platform first.** Lean into what browsers do natively before
  reaching for JS.
- **Offline as a first-class citizen.**
- **Free to play.**
- **Anonymous as a first-class citizen.** Everything works without an account;
  logging in only adds.
- **Honest.** No dark UX patterns.

### Tone of voice

- Friendly.
- Funny, joking.
- Personal.

## Goals

### Performance budgets

| Measure                        | Budget                                              |
| ------------------------------ | --------------------------------------------------- |
| GET TTFB, warm, from EU        | ≤ 150 ms                                            |
| Solve POST                     | ≤ 400 ms                                            |
| JS, puzzle page                | ≤ 40 KB gz (the lazy-loaded solver doesn't count)   |
| JS, home                       | ≤ 25 KB gz                                          |
| CSS, entry                     | ≤ 16 KB gz                                          |
| CSS, per theme                 | ≤ 6 KB gz                                           |
| Service worker cost            | ≤ 5 KB gz added to the puzzle page; nothing on home |
| Puzzle page render, in workerd | Above ~20 ms, revisit edge-caching the page shell   |

### Offline

- A small set of puzzle pages is cached in the background on each day's first
  visit (~10 pages, ~60 KB), up to 50. Once cached, they open and play offline;
  the rest of the archive needs a connection.
- A solve made offline is kept on the device and synced when back online. The
  player stays in place; offline Home is the way around.
- Hints and the editor solve run in the browser, so they work offline. Login
  needs a connection.

### Works fully without JS

Every flow works without JS: play, solve, name, Flash, feedback, profile,
consent. The exceptions are the editor, as today, and hints, which are computed
in the browser.

### Anonymous-first

- No account is needed to play, solve or appear on the high score.
- An anonymous GET makes no store call. It renders from signed cookies and
  bundled puzzles.
- Login stays optional and only carries a player's history across devices.
