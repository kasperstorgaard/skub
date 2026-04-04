---
name: observability
description: OTEL tracing conventions — span naming, attribute keys, when to add spans
---

# Observability (OTEL)

Deno Deploy injects the OTEL provider — no setup needed. Use `withSpan` from
`lib/tracing.ts` to create child spans. Annotate the active span directly for
request-level context.

## Span names

Format: `namespace.operation` — both parts `snake_case`, dot-separated.

- Namespace matches the route or layer: `home`, `puzzle`, `archives`, `db`
- Operation describes what's happening: `fetch`, `save_solution`, `set_user`
- Examples: `home.fetch`, `puzzle.save_solution`, `db.solutions.list_user`

## Attribute keys

Format: `domain.property` — both parts `snake_case`, dot-separated.

- Domain is the entity: `user`, `puzzle`, `solution`, `solutions` (collection)
- Property is the specific field: `moves`, `is_new`, `count`, `onboarding`
- Examples: `solution.is_new`, `solutions.count`, `user.onboarding`

No camelCase, no hyphens, no bare keys without a namespace. Values must be
`string`, `number`, or `boolean` — no objects or arrays.

## When to add spans

- Add at the route layer first; only go deeper into `db/` if a route-level span
  shows a bottleneck
- Child spans for timed sub-operations; active span attributes for request
  context
- Skip attributes that are already visible in the URL or request headers
