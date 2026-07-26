# Dev cold start: 21s → 6.6s

## Problem

A cold `deno task dev` took ~21s to serve the first page. Vite booted in 1.4s,
so the cost was all on-demand transforms of the first request. Measured with
`DEBUG=vite:transform`:

| source | modules | time |
| ------------------- | ------: | ------: |
| `styles.css` (twice) | 2 | 7.35s |
| `components/icons/` | 1514 | 5.87s |
| jsr/npm deps | 329 | 3.43s |
| app code | 103 | ~1.7s |

Both dominant costs traced back to one thing: `components/icons/` held the full
Phosphor set (1514 files, 6.1MB) behind a barrel of 1514 `export *` lines,
re-exported again by `components/icons.tsx` and imported by 25 files.

Dev has no tree-shaking, so every icon module landed in the graph. Less
obviously, Tailwind's content scanner walked all 6.1MB of svg template literals
on each compile — which is why `styles.css` cost 3.7s per pass rather than
~0.2s. Production was never affected: the client bundle tree-shakes to the same
390KB either way.

## Approach

Generate only the icons the codebase imports. `scripts/update-icons.ts` derives
the used set by scanning `import { … } from "#/components/icons.tsx"` across the
project, so the import site stays the single source of truth — icons that stop
being referenced are pruned on the next run. 1514 files → 38, 6.1MB → 220KB.

The script also formats its own output. The raw generated line exceeds the line
limit, so previously the committed files only passed `deno fmt --check` because
they had been formatted after generation; regenerating broke CI.

Additionally, `server.warmup` transforms the entries in the background at boot
instead of on first request. Same total work, but it overlaps with the time it
takes to open a browser, and it warms every route rather than only the first
one hit.

## Result

Cold first load 20.9s → 6.6s. Warm reload unchanged (~14ms). `styles.css` fell
to 0.45s across both passes, so the dev-only double compile is no longer worth
addressing — production emits a single stylesheet, as it always did.

## Trade-off

Adding a new icon import now requires `deno task update-icons` before it
typechecks, mirroring the existing `update-puzzles` workflow. Autocomplete no
longer spans all 1514 Phosphor names; the script fails with a pointer to
phosphoricons.com when a name doesn't resolve.

## Non-goals

Production page performance — TTFB, render-blocking CSS and the PostHog payload
are real but separate, and none of them are affected by this change.
