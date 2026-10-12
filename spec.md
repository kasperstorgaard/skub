# Editor buttons

Tidy the editor panel: a compact Clear on mobile, and no Download or Import.

## Clear as an icon button on mobile

On mobile, Clear is a full-width labelled button under the rotate/flip row.
Make it an icon-only button (trash icon, `sr-only` "Clear") at the right end
of that row (`ml-auto`), hidden from `lg` up. Desktop keeps the labelled Clear
below the row, shown only from `lg` up. Two elements, because `.icon-btn` and
`.btn` are separate component classes and can't swap by breakpoint.

## Remove Download and Import

- Editor panel (`islands/editor-panel.tsx`): the Download link and the Import
  form, shown when not in dev, and the icons only they use.
- Preview controls (`islands/controls-panel.tsx`): the Download link shown on
  the preview page.
- Handlers: `routes/api/export.ts` (draft as a `.md` download) and
  `routes/api/import.ts` (upload a `.md` into the draft). Nothing else
  references them and they have no tests.

## Verify

Editor on a phone width: Clear sits at the right of the rotate/flip row and
clears the board; on desktop the labelled Clear is unchanged. Neither the
editor nor the preview page shows Download or Import.
