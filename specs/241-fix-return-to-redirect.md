# Fix open redirect in `/auth/login?return_to`

## Problem

`routes/auth/login.ts` accepts any `return_to` that starts with `/`. That lets
`//evil.example` and `/\evil.example` through: both are protocol-relative to a
browser, so after a successful login the callback's `Location` header sends
the user off-site. A phishing link to `skub.app/auth/login?return_to=//…`
would land a freshly logged-in user on a lookalike.

## Approach

Resolve the value against the request origin and keep only the path, query
and hash when the resolved origin matches. Anything else falls back to `/`
rather than a 400: the user asked to log in, so log them in and bring them
home. The resolver is a small pure helper in `lib/` so it can be tested
exhaustively; the route just calls it.

Found during the 2026-10-09 login review. Unrelated to the perf roadmap, so
it ships on its own.

## Tests

`lib/return-to_test.ts` covers the accepted shape, both protocol-relative
forms, a foreign absolute URL, a non-http scheme, and the same-origin absolute
form. No e2e: the login flow needs Auth0.

## Non-goals

- Changing where logout or the profile page send the user.
- Merging a device's anonymous history on login. Specced separately on
  `feat/login-merge-history`.
