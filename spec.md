# Candidates: naming and overview page

## Problem

**Naming.** Every candidate takes a random name from the pool when it's
created. That causes two problems:

- **Collisions with the corpus.** A variant shipped under its base name
  (`alberto-d` → `alberto`), but the original `alberto` candidate kept that
  slot. `/candidate?slug=alberto` then showed the original board, not the one
  that shipped, and the shipped board couldn't get its own corpus entry to
  rate. 28 families were in this state.
- **Using up the name pool.** Hundreds of names belong to boards that will
  never ship, so they can't be used for puzzles that do.

**No overview.** You reach a candidate from the editor's Review or from a
Preview link, but there's nowhere to browse the store, see what's been
promoted, or see how a board's family has been rated.

## Approach: naming

### New candidates are numbered

A new board that isn't a variant gets `candidate-{n}`, where `n` is the next
free number. Variants keep the letter suffix (`candidate-12-b`), so
`stripVariant` and `nextVariant` work as they do now. Variants are for
iterating on a board that isn't quite there; editing a shipped puzzle still
forks to `anna-b`, which never takes the base slot, so it can't collide.

Where a name is shown, a numbered candidate reads as `C-12`, or `C-12 (b)` for
a variant, so it can't be mistaken for a puzzle number.

### The name is chosen at promote time

Live puzzles are immutable, so promote always adds a new puzzle with the next
number; it never overwrites one. The write uses `createNew`, so even a logic
slip fails instead of replacing a file. (Previously a variant replaced its
shipped base, `erik-b` → `erik`; that's gone.)

- **Its family's name is free**: ships under it, whichever version is
  promoted (usually the latest). No dialog. "Free" means no corpus puzzle and
  no other stored family holds the slug.
- **Anything else** (a numbered board, or a taken name, including a variant of
  a shipped puzzle): a name dialog opens before promoting, prefilled with a pool
  name that's free by the same rule. A rejected name comes back as typed, with
  the reason.
- **Corpus copy**: already shipped; the panel shows Play instead of Promote.

The dialog follows the site's dialog convention, `?dialog=promote`, with a
plain form POST, so it works with JS off. A typed name that's already taken
sends you back to the dialog with an error. Promote becomes a POST, since it
writes files.

`pickCandidateName` goes away. Names are checked only against the corpus.

### Migrating the existing store

A one-off script, committed with this branch and then deleted:

- **Keep the name** when no corpus puzzle has that slug, or the candidate is
  the board that slug shipped (`promotedAs` equals its own slug), or it's a
  corpus copy (`source: corpus`).
- **Rename to `candidate-{n}`** when its slug is a corpus slug for a different
  board. Its variants go with it (`dirk` → `candidate-n`, `dirk-b` →
  `candidate-n-b`), numbered in `createdAt` order. `promotedAs` stays as it
  is, so what shipped is still recorded.
- Use `git mv` so every file keeps its history. Nothing is deleted.

Ran with this branch: 28 families, 174 files, numbered `candidate-5` to
`candidate-32`. Two broken records were fixed first: `frode` had `promotedAs`
twice (its board shipped as Magne), and `karina-c` shipped as Karina without
`promotedAs`. After the migration, every corpus slug is free for its own corpus
copy.

## Approach: candidates page

Dev-only, like the rest of the candidate routes. Do the naming work first:
the page's URLs and card labels depend on it.

### `/candidates`: the list

One card per family, not per candidate. A family is the base plus its variants
(`stripVariant`): `candidate-12`, `candidate-12-b`, `candidate-12-c` are one
card. While you iterate on a board, the list stays one card long for it.

- Families are sorted by their newest member's `createdAt`, so the board you're
  working on is at the top.
- Each card shows:
  - the thumbnail of the version that shipped, or the newest if none did
    (`<Thumbnail>` with its CSS-variable colours), and links to that version
  - the candidate's own name (`C-12` for a numbered family)
  - how many versions it has, when there's more than one
  - the family's best rating
  - where a puzzle card shows difficulty, a rocket and the `promotedAs` slug,
    when a version shipped
- Corpus copies (`source: corpus`) are included, with a small "corpus" label.
- Cards follow the front page's `PuzzleCard`: same frame, tagline and name
  styles.
- A "Hide promoted" switch filters out families with a shipped version. It's
  the switch from web.dev's "Building a switch component" (a real checkbox in
  a GET form, `?hide=promoted`), submitted on change, with a noscript button.
- Reads the store's files directly, without analysing anything (unlike
  `currentCandidate`), so the page stays fast across the whole store.

### `/candidates/{slug}`: the single candidate, moved

Today's `/candidate?slug=` page becomes `/candidates/[slug]`, keeping
`?solution=` and `?mode=`. The actions that are about one candidate nest under
it (`/candidates/{slug}/promote`, `/candidates/{slug}/edit`), and their
`?slug=` parameter goes away. Review, which creates or finds the candidate,
moves to `/candidates/review`. That's safe because no candidate will be called
"review".

### Version navigation on the candidate page

Floating left/right arrows at the board's edges step to the previous
and next version in the family (base, `b`, `c`, …). Each arrow is hidden at
its end of the family, and both are hidden for a single-version family. Use
the same caret icons as `Pagination`; they're plain links, so they work with JS
off.

A shipped puzzle's Rate button goes through `/puzzles/{slug}/rate`, which
finds the candidate it shipped from (`promotedAs` plus the live board). The
family's base can still sit at that slug with a different board, so linking to
`/candidates/{slug}` directly would show the wrong one.

Every link to the old URLs gets updated: the actions' redirects, the editor's
and composer's Review, and the Preview panel's candidate link.

## Non-goals

- Changing the name pool itself (that's `feat/danish-name-pool`).
- Sorting controls, or filters beyond hiding promoted boards. Newest first is
  enough until the list makes it clear what else is needed.
- Pagination: the store is a few hundred entries.
