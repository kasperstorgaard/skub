# UI style

## Visual language

The core aesthetic is bold, retro-futuristic, and playful — like a classic
gaming console. Dark and light themes both exist; dark has the richer colour
palette, light is more restrained. The primary font is "Chakra Petch": techno,
sharp-angled, used for headlines, interactive elements, and sparingly for body
text.

## Icons

Icons use the Phosphor icon pack (better server-side support than the npm
package). They scale with text size — use the same design tokens as text, no
special size conventions. Always use an icon for a button, never for a plain
link (links styled as buttons are fine).

## Interactive elements

Buttons can have a size variant, but there are no primary secondary buttons.
<a> tags can be styled as buttons using .btn className.

## Layout & spacing

Three main layout components, controlled by a global grid in `routes/_app.tsx`:

- **Main** — the primary page container
  - **Header** — current page and breadcrumb
  - **Panel** — secondary content (e.g. `ControlsPanel` on the puzzle page)
- Everything else — modals, print

On mobile, primary content is on top and the panel sits below, leading to a
sometimes long scrollable page (not sticky). On desktop, primary content has a
max-width with auto margins; the panel sits at a fixed width on the right.

There is no footer, the Panel serves this role.

### Spacing levels

Space says how related two things are: closer means more related. Use three
levels, each about twice the one below, and nothing in between:

| Level | Between | Token |
|---|---|---|
| Inside | parts of one component: icon and label, lead and title, thumb and caption | static `1`–`3` |
| Siblings | related items in a group: card grid items' caption and action, title and its board | `fl-2` |
| Groups | separate groups: header and page title, title block and cards, footer blocks | `fl-4` |

- Static inside components, fluid between them. Never mix the two at the same
  level.
- `Main` rows are `fl-2` apart; `Header` adds `mb-fl-2`, so header to title is
  a group step on every page. Don't add per-page `mt-*` to the title row.
- A grid that can be stretched by its parent (e.g. inside `Main`'s `1fr` row)
  needs `content-start`, or the free space lands in its gaps.
- On `Panel` (a column subgrid) set `gap-y-*` only: a column gap shifts the
  content off `Main`'s edge.
