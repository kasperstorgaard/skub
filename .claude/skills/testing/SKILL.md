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

`*_test.ts` naming, co-location with the module under test, all taken from
`Deno.test()` patterns.

## E2E testing

### Philosophy

Prefer **golden path** tests over smoke tests. A golden path test follows a
realistic user flow end-to-end (e.g. load the puzzle page, make moves, see the
celebration dialog). A smoke test just checks that a page loads — useful as a
baseline, but not the goal.

Name golden path test files `*-flow_test.ts` (e.g. `new-user-flow_test.ts`).
Smoke and integration tests for the same feature area can share a single
`*_test.ts` file (e.g. `profile_test.ts`).

Each test should have **at most one `goto`**. A golden path starts from the home
page and navigates naturally. An integration test targets a specific page
directly. A smoke test is even shorter. More than one explicit navigation is a
sign the test is doing too much or skipping natural entry points.

### Selectors

Always find elements by **real visible text**, not CSS selectors, test IDs, or
class names. If an element has no visible text (icon buttons, etc.), add an
`aria-label` to the component. This forces good accessibility hygiene in the app
code itself.

### No mocking

Never mock API calls, services, or the database. Tests run against a real local
server with a real KV store.

### Shared state & aggregates

Tests share a KV store, so aggregates (solution groups, stats) accumulate across
runs. Never assert on **absolute** aggregate values — use **delta assertions**:
snapshot the value before the action, assert it changed by exactly the expected
amount. This is robust regardless of what prior test runs or dev activity left
behind.

User-owned data (solutions, profile) is isolated per-test via automatic
cookie-based teardown — no manual cleanup needed.

### Page objects

Page objects are thin query wrappers only. No assertions inside them. When
adding locators that could match multiple elements (e.g. a link that appears
both inside and outside a dialog), scope the locator to the nearest unique
parent to avoid strict mode violations.

### Accessibility as a test constraint

When a test can't find an element because it has no text or label, the fix
belongs in the **app** (add `aria-label`), not in the test (don't fall back to
CSS or test IDs). The test suite is a forcing function for accessibility.

### Integration test contract

**Starting state**: only what another page could realistically produce — a link,
cookie, or KV write. Server-side seeding (`addSolution`, `seedUser`) is fine; it
mirrors what the app's own handlers write. URL params no other page would link
to are not valid starting states, even if the app generates them internally.

**End state**: a UI assertion, optionally plus a URL / cookie / KV assertion the
next page will pick up.

**Flow tests** (`e2e/`) cover critical multi-page journeys. Only write one when
the value is in the chain, not a single page. Page object methods must not
encapsulate game-solving logic — moves come from the caller.
