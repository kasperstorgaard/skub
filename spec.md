# Candidates: naming and overview page

## Problem

**Naming.** Every candidate takes a random name from the pool when it's
created. That causes two problems:

- **Collisions with the corpus.** A variant ships under its base name
  (`alberto-d` → `alberto`), but the original `alberto` candidate keeps that
  slot. `/candidate?slug=alberto` then shows the original board, not the one
  that shipped, and the shipped board can't get its own corpus entry to rate.
  27 base candidates are in this state today.
- **Using up the name pool.** Hundreds of names belong to boards that will
  never ship, so they can't be used for puzzles that do.

**No overview.** You reach a candidate from the editor's Review or from a
Preview link, but there's nowhere to browse the store, see what's been
promoted, or see how a board's family has been rated.

## Approach: naming

### New candidates are numbered

A new board that isn't a variant gets `candidate-{n}`, where `n` is the next
free number. Variants keep the letter suffix (`candidate-12-b`), so
`stripVariant` and `nextVariant` work as they do now. Editing a shipped puzzle
still forks to `anna-b`: it's a variant of a corpus slug, never the base slot,
so it can't collide.

Where a name is shown, a numbered candidate reads as its number and variant:
`12`, `12 (b)`.

### The name is chosen at promote time

Promote works out where the board ships:

- **Variant of a corpus puzzle** (`anna-b`, whose base `anna` is shipped):
  replaces that puzzle, as now. No dialog.
- **Named, and the name is free in the corpus**: ships under its own name. No
  dialog.
- **Unnamed (`candidate-{n}`), or its name is taken by another corpus puzzle**:
  a name dialog opens before promoting, prefilled with an unused name from the
  pool. Accept it or type your own.

The dialog follows the editor's submit-dialog pattern: a query-param step
(`?promote=name`) and a plain form POST, so it works with JS off. A typed name
that's already taken sends you back to the dialog with an error. Promote
becomes a POST, since it writes files.

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

After the migration, every corpus slug is free for its own corpus copy.

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
  - the newest version's thumbnail (`<Thumbnail>` with its CSS-variable
    colours), and links to that version
  - the family name; a numbered family shows just its number (`12`)
  - how many versions it has, when there's more than one
  - the family's best rating
  - a "Promoted as {slug}" badge when any version has `promotedAs`
- Corpus copies (`source: corpus`) are included, with a small "corpus" label.
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

Floating left/right arrows on either side of the board step to the previous
and next version in the family (base, `b`, `c`, …). Each arrow is hidden at
its end of the family, and both are hidden for a single-version family. Use
the same caret icons as `Pagination`; they're plain links, so they work with JS
off.

Every link to the old URLs gets updated: the actions' redirects, the editor's
and composer's Review, and the Preview panel's candidate link.

## Non-goals

- Changing the name pool itself (that's `feat/danish-name-pool`).
- Filtering or sorting controls. Newest first is enough until the list makes
  it clear what else is needed.
- Pagination: the store is a few hundred entries.
