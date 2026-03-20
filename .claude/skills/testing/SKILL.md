---
name: testing
description: Testing philosophy — what to test, realistic scenarios, what not to bother with
---

# Testing approach

## What to test

The game logic is the soul of the app, and is relatively easy to reason about
and test. It should be 100% covered, and using realistic scenarios that can end
up catching refactor bugs. vs dummy code that only tests one specific util case.

## What to skip

Client side hooks etc. are not a priority to test, as they are supportive. 3rd
party wrappers are not a priority, as they end up testing very little in
practice.

## Assertion style

Single deep equality, one scenario per test.

## Test file conventions

*_test.ts naming, co-location with the module under test, all taken from
Deno.test() patterns

## E2E testing

### Philosophy

Prefer **golden path** tests over smoke tests. A golden path test follows a
realistic user flow end-to-end (e.g. load the puzzle page, make moves, see the
celebration dialog). A smoke test just checks that a page loads — useful as a
baseline, but not the goal. One smoke test per page is fine; the real value is
in the flows.

### Selectors

Always find elements by **real visible text**, not CSS selectors, test IDs, or
class names. If an element has no visible text (icon buttons, etc.), add an
`aria-label` to the component and select by that. This keeps tests resilient to
styling changes and forces good accessibility hygiene.

### No mocking

Never mock API calls, services, or the database. Instead: **seed real data**
before the test suite runs, and **tear it down** after. For this app that means
writing solutions to KV via a seed script, running tests against that state,
then deleting the seeded records. Tests that rely on mocked state only prove
the mock works.

### Data seeding

Use a dedicated `deno task seed-e2e` script that writes known test data (e.g.
a fixed `tracking_id` cookie + pre-posted solutions for specific puzzle slugs)
to KV before the seeded suite runs. Teardown is a matching `deno task
teardown-e2e`. Both must be idempotent.

### Structure

- `e2e/` directory at the project root
- One `*_test.ts` file per page or flow
- Shared browser/cookie setup in `e2e/_setup.ts`
- `BASE_URL` env var (default: `http://localhost:5173`) for local vs CI/deploy
- Two tasks: `test-e2e` (base, no data deps) and `test-e2e-seeded` (requires seed)
