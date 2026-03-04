# UI Rules — Early Christianity Atlas

Canonical patterns for UI consistency across the codebase.

---

## Layout

- **App shell**: `NavBar` (fixed top) + `page-container` (fills remaining height).
- **Map page**: flex row — `map-left` (left panel) | `map-center` (Leaflet map) | `map-right` (right sidebar).
- **Expanded sidebar**: `.map-layout.sidebar-expanded` sets `map-center` to `width: 0` (NOT `display:none`) so Leaflet doesn't break. `map-right` gets `flex: 1`.
- **Panel visibility**: toggled via `leftPanelVisible` / `rightPanelVisible` in `appStore`. When hidden, the container is conditionally rendered (`{visible && <div>…</div>}`), not CSS-hidden.
- **Show-panel hints**: `.map-overlays` is `position:absolute; pointer-events:none` spanning the full map width. Left hint is left-aligned; right hint uses `margin-left: auto`. Buttons must have `pointer-events: all`.

---

## Navigation / Selection History

- `appStore` holds `selection: Selection | null` and `selectionHistory: Selection[]`.
- **Navigate to entity**: call `pushSelection({ kind, id })` — saves current selection to history.
- **Back**: call `popSelection()` — restores previous selection. If history is empty, call `setSelection(null)`.
- **Hard reset** (e.g. closing a panel): call `setSelection(null)` — clears history too.
- **Essay → entity**: store the essay in `prevEssay` local state before calling `pushSelection`; back restores `prevEssay`.
- Never navigate using `setSidebarTab` as a back mechanism — tabs are independent of entity history.

---

## Sidebar Tabs

- Tabs are defined in `TABS` array in `RightSidebar.tsx` with `id | icon | label`.
- Tab buttons use `.sidebar-tab` class — `flex-direction: column`, icon on top, label below.
- **No border, no background** — only a `border-bottom: 2px solid` underline for the active state.
- Active tab: `border-bottom-color: var(--accent-bright)`, `color: var(--accent-bright)`.
- Tab scroll: `overflow-x: auto` on `.sidebar-tabs`, scrollbar hidden via `::-webkit-scrollbar { display: none }`.

---

## Entity Detail Panels

- All entity detail views use the same shell: back bar → header → filter banner (if applicable) → sub-tabs → body.
- **Back bar**: `.detail-back-bar` with `.back-btn` (← Back) and `.detail-crumb` (entity kind label).
- **Header**: kind badge (`kindIcon kind`), title, subtitle, tags (`.tag` chips).
- **Sub-tabs**: `.detail-sub-tabs` / `.detail-sub-tab` — horizontal pills, not icons.
- **Body**: `.detail-body` — scrollable.
- City detail uses its own `CityDetail` component (different tab set: Info, Timeline, People, Doctrines, Events, Works).

---

## Clickable Mentions (MarkdownRenderer)

- Syntax: `[[kind:id|label]]` or `[[kind:id]]` (bare — label derived from id).
- Supported kinds: `city`, `person`, `work`, `doctrine`, `event`, `persuasion`, `polity`, `archaeology`.
- Rendered by `MarkdownRenderer` component (`src/components/shared/MarkdownRenderer.tsx`).
- Mention buttons use `.mention-link` class: no border/background, dashed underline in `var(--accent-bright)`.
- Use `MarkdownRenderer` everywhere notes/evidence/essay body text is displayed. Do **not** write custom inline renderers.

---

## Markdown Rendering

- `MarkdownRenderer` supports: `#`/`##`/`###` headings, `>` blockquotes, `**bold**`, `*italic*`, blank-line paragraphs, `[[mention]]` links, literal `\n` sequences from TSV data.
- CSS classes: `.md-p`, `.md-h1/2/3`, `.md-blockquote`, `.markdown-renderer`.
- Essays live as `.md` files in `data/essays/` and are fetched at runtime via `essayLoader.ts`. The `Essay` interface is defined in `essayLoader.ts` (not `essays.ts`).

---

## Tags / Chips

- `.tag` — read-only info chip (solid border, neutral bg).
- `.tag.accent` — highlighted variant (accent color).
- `.tag-clickable` — interactive chip (dashed border, hover effect). Use `<button>` element.
- `.tag-persuasion` — persuasion-specific color (amber/accent bg).
- `.mention-link` — inline entity link in text (button, dashed underline only).

---

## CSS Variables (key tokens)

```css
--surface        /* panel backgrounds */
--surface-2      /* hover/active backgrounds */
--surface-3      /* deeper nesting */
--border         /* main borders */
--border-subtle  /* dividers within panels */
--text           /* primary text */
--text-muted     /* secondary text */
--text-faint     /* tertiary / labels */
--accent         /* primary brand color (amber) */
--accent-bright  /* brighter accent for links/active */
--accent-dim     /* very light accent background */
--accent-strong  /* darkest accent for hover */
--shadow         /* card shadow */
--shadow-md      /* modal/popup shadow */
--radius         /* standard border-radius */
--radius-sm      /* small border-radius */
```

---

## Graph Page

- Full-width layout: `graph-sidebar` (260px) | `graph-canvas-area` (flex 1) | optional detail panel (300px, only when node selected).
- **Return to map**: button at top of sidebar calling `navigate("/")`.
- Node labels shown always when `nodes.length < 50`, otherwise only on selected node.
- Edge labels shown on hover or when either endpoint is selected.
- Places (`city` kind) included via person→city connections from `people.city_of_origin_id`.

---

## Data Flow Rules

- All data access goes through `dataStore` singleton (`src/data/dataStore.ts`).
- Map filter (persuasion/polity/person) stored in `appStore.mapFilterType` + `mapFilterId`.
- `showArcs: true` by default (set in store initial state).
- Decade-based data: always use `getAtDecade(decade)` / `getCitiesAtDecade(decade)` — never filter raw arrays by year outside dataStore.
