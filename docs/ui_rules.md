# UI Rules — Early Christianity Atlas

Canonical patterns for UI consistency across the codebase.
Every contributor must follow these rules. When in doubt, check this file first.

---

## 1. Project Structure

```
src/
  components/
    shared/         # Reusable primitives (import from here, never redefine)
      Hl.tsx              – Search highlight for plain text
      MarkdownRenderer.tsx – Markdown + [[mention]] renderer
      NoteCard.tsx         – Canonical evidence note (body_md + citation_urls)
      Pagination.tsx       – Page controls (uses .pagination CSS)
      entityConstants.ts   – KIND_ICONS, KIND_LABELS, PRESENCE_COLORS/LABELS,
                             kindIcon(), kindLabel(), presenceColor()
    sidebar/        # Sidebar sub-modules (extracted from RightSidebar)
      SidebarShell.tsx     – Drag-to-resize / snap-dismiss wrapper
      SidebarLists.tsx     – All sidebar list components (PlacesList, GroupsList, etc.)
      EntityDetail.tsx     – Generic entity detail + 7 sub-tab components
    map/            # Map-specific components
      RightSidebar.tsx     – Routing layer (delegates to sidebar/ modules)
      CityDetail.tsx       – Place detail panel with sub-tabs (PlaceDetail + CityDetail compat wrapper)
      LeftPanel.tsx        – Timeline controls, search, filters
    entity/
      EntityDetailPanel.tsx – Entity detail for graph page (uses NoteCard)
    layout/
      NavBar.tsx
  data/
    types.ts        # ALL domain type definitions (single source of truth)
    dataStore.ts    # Parsing, indexing, query API (re-exports types)
    essays.ts       # Essay metadata + body loading
    parseTsv.ts     # TSV parser utilities
  domain/
    relationLabels.ts  # Relation type → human label registry
  hooks/
    useSearchQuery.ts    – Trimmed global search query from appStore
    usePaginatedList.ts  – Generic pagination with auto-reset
    useFilteredList.ts   – Generic search + filter
  stores/
    appStore.ts     # Zustand store (decade, selection, filters, UI state)
  utils/
    forceLayout.ts  # Force-directed graph physics (pure computation)
    formatYear.ts   # Year range formatting
  pages/
    MapPage.tsx     # Map + left panel + right sidebar
    GraphPage.tsx   # Force-directed network graph
```

---

## 2. DRY Rules (CRITICAL)

### Never redefine — always import from shared

| Need | Import from |
|------|-------------|
| Entity icons (🏛👤📜…) | `entityConstants.ts` → `KIND_ICONS`, `kindIcon()` |
| Entity labels (Person, Work…) | `entityConstants.ts` → `KIND_LABELS`, `kindLabel()` |
| Presence colors (#1a7a5c…) | `entityConstants.ts` → `PRESENCE_COLORS`, `presenceColor()` |
| Presence labels (Attested…) | `entityConstants.ts` → `PRESENCE_LABELS` |
| Search highlight | `Hl.tsx` → `<Hl text={…} query={…} />` |
| Note rendering | `NoteCard.tsx` → `<NoteCard note={…} />` |
| Pagination | `Pagination.tsx` → `<Pagination page={…} total={…} onChange={…} />` |
| Markdown/mentions | `MarkdownRenderer.tsx` → `<MarkdownRenderer>` |
| Relation labels | `relationLabels.ts` → `getRelationLabel()` |
| Entity label lookup | `dataStore.ts` → `getEntityLabel()` |
| Year formatting | `formatYear.ts` → `formatYearRange()` |
| Domain types | `data/types.ts` (or re-exported from `dataStore.ts`) |

### Never:
- Define a local `KIND_ICONS`, `PRESENCE_COLORS`, `Hl`, or `presenceColor` function in a component file.
- Write inline note rendering (body + citations). Use `<NoteCard>`.
- Write inline pagination UI. Use `<Pagination>`.
- Define types that already exist in `data/types.ts`.

---

## 3. Styling Rules

### Use CSS classes, not inline styles

All visual styling belongs in `src/styles.css`. Inline `style={{…}}` is only acceptable for:
- **Dynamic values** that depend on runtime data (e.g., `style={{ background: someComputedColor }}`).
- **One-off layout tweaks** that are truly unique (e.g., `style={{ flex: 1 }}`).

For everything else, use or create a CSS class. Common utility classes available:

```css
.flex-col          /* display:flex; flex-direction:column */
.flex-col-8        /* + gap:8px */
.flex-col-12       /* + gap:12px */
.flex-col-14       /* + gap:14px */
.flex-wrap-4       /* display:flex; flex-wrap:wrap; gap:4px */
.flex-center       /* display:flex; align-items:center */
.entity-desc       /* Standard entity description paragraph */
.entity-desc--italic  /* Italic variant (significance, resolution) */
.search-input-icon /* 🔍 icon in search inputs */
.close-btn         /* ✕ dismiss button */
.faint             /* color: var(--text-faint) */
.muted             /* color: var(--text-muted) */
```

### Component-specific CSS class families:
- `.note-card` / `.note-year` — evidence notes
- `.conn-list` / `.conn-card` / `.conn-icon` / `.conn-name` / `.conn-rel` — connection lists
- `.fact-grid` / `.fact-label` / `.fact-value` — key-value fact display
- `.tag` / `.tag.accent` / `.tag-clickable` / `.tag-persuasion` — chips
- `.mention-link` — inline entity link in text
- `.citation-link` — source URL link
- `.mini-card-*` — essay popup entity mini card
- `.pagination` / `.pagination-btn` — page controls
- `.timeline-*` — timeline row components
- `.sidebar-*` — sidebar tabs, search, list items
- `.detail-*` — detail panel shell (back bar, header, sub-tabs, body)
- `.graph-*` — graph page specific elements

---

## 4. CSS Variables (design tokens)

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

/* Presence status (also in entityConstants.ts) */
--attested       /* #1a7a5c */
--probable       /* #b07e10 */
--claimed        /* #c47d2a */
--suppressed     /* #c0392b */
--unknown        /* #8e8070 */

--shadow / --shadow-md / --shadow-lg
--radius / --radius-sm / --radius-lg
--nav-h / --left-w / --right-w
```

---

## 5. Layout

- **App shell**: `NavBar` (fixed top, 44px) + `.page-container` (fills remaining height).
- **Always-mounted pages**: All three pages (Map, Graph, Wiki) are mounted simultaneously in `App.tsx` using `display: "contents" / "none"`. This **preserves internal state** when switching tabs via `NavBar`. Never use `<Routes>` for page switching.
- **Map page**: flex row — `.map-left` | `.map-center` (Leaflet) | `.map-right` (sidebar).
- **Expanded sidebar**: `.sidebar-expanded` sets `.map-center` to `width:0` (NOT `display:none` — Leaflet breaks). `.map-right` gets `flex:1`.
- **Panel visibility**: toggled via `leftPanelVisible` / `rightPanelVisible` in `appStore`. When hidden, the container is conditionally rendered, not CSS-hidden.
- **Show-panel hints**: `.map-overlays` is `position:absolute; pointer-events:none`. Buttons must have `pointer-events:all`.

---

## 6. Navigation / Selection History

- `appStore` holds `selection: Selection | null` and `selectionHistory: Selection[]`.
- **Navigate to entity**: call `pushSelection({ kind, id })`.
- **Back**: call `popSelection()`. If history empty, call `setSelection(null)`.
- **Hard reset**: call `setSelection(null)` — clears history.
- **Essay → entity**: store essay in `prevEssay` local state before `pushSelection`; back restores it.
- Never navigate using `setSidebarTab` as a back mechanism.

### Cross-page navigation

- **`CrossPageNav`** (`src/components/shared/CrossPageNav.tsx`): renders icon buttons (🗺️ Map, 🕸️ Graph, 📖 Wiki) to open the current entity on another page. Excludes the current page's icon.
- **Map navigation**: sets `appStore.setSelection()` then `navigate("/")` — the map reads selection from appStore.
- **Graph/Wiki navigation**: uses URL search params `?kind=X&id=Y` — these pages read params via `useSearchParams`.
- Place `<CrossPageNav kind={kind} id={id} current="map|graph|wiki" />` in every entity detail header.
- CSS classes: `.cross-page-nav`, `.page-nav-icon`.

---

## 7. Sidebar

- **Tab bar**: defined in `TABS` array in `RightSidebar.tsx`. Icon on top, label below.
- **Active tab**: `border-bottom-color: var(--accent-bright)`, no background change.
- **Routing**: RightSidebar checks `selection.kind` and renders CityDetail, EntityDetail, QuoteDetail, or EssayView accordingly. List views are the default.
- **Lists**: all 9 list components live in `SidebarLists.tsx`. All have pagination via `<Pagination>`.
- **Search**: each list filters locally from `sidebarSearch` in appStore. Page resets on search change via `useEffect`.
- **"Show All" for archaeology**: REMOVED. Use the left panel "Include earlier decades" checkbox instead.

---

## 8. Entity Detail Panels

- Shell: back bar → header → filter banner (optional) → sub-tabs → body.
- **Back bar**: `.detail-back-bar` with `.back-btn` and `.detail-crumb`.
- **Header**: kind badge (`kindIcon() + kindLabel()`), title, subtitle, tags.
- **Sub-tabs**: `.detail-sub-tabs` / `.detail-sub-tab`.
- **Body**: `.detail-body` — scrollable, `flex-col` with gap.
- **All entity sub-tabs must have pagination** via `<Pagination>`.
- **City detail**: own component (`CityDetail.tsx`) with tabs: Info, Timeline, People, Doctrines, Events, Works, Archaeology, Relations.

---

## 9. Evidence Notes

- **Always use `<NoteCard>`** wherever evidence is displayed — InfoTab, TimelineTab, EntityEvidenceTab, EntityDetailPanel.
- NoteCard renders: `body_md` via `<MarkdownRenderer>` + `citation_urls` as clickable links.
- Optional `yearLabel` prop for the `.note-year` header.
- **Citations must always be visible.** Never render `body_md` without also rendering `citation_urls`.

---

## 10. Clickable Mentions (MarkdownRenderer)

- Syntax: `\[\[kind:id|label\]\]` or `\[\[kind:id\]\]`.
- Supported kinds in the current schema: `place`, `person`, `work`, `event`, `group`, `topic`, `dimension`, `proposition`, `source`, `passage`, `claim`, `editor_note`, `bible`.
- Mention buttons use `.mention-link` class: dashed underline, no background.
- Use `<MarkdownRenderer>` everywhere note/essay body text is displayed.

---

## 11. Markdown Rendering

- Supports: `#`/`##`/`###`, `>` blockquotes, `**bold**`, `*italic*`, blank-line paragraphs, `[[mention]]` links, literal `\n` from TSV.
- CSS: `.md-p`, `.md-h1/2/3`, `.md-blockquote`, `.markdown-renderer`.
- Essays: `.md` files in `data/essays/`, loaded eagerly via Vite glob in `essays.ts`. `Essay` type is defined in `essays.ts`.

---

## 12. Tags / Chips

- `.tag` — read-only info chip.
- `.tag.accent` — highlighted variant.
- `.tag-clickable` — interactive chip (dashed border, use `<button>`).
- `.tag-persuasion` — persuasion-specific color.

---

## 13. Graph Page

- Layout: `.graph-sidebar` (260px) | `.graph-canvas-area` (flex 1) | right detail panel (300px, shown when node or edge selected).
- **Left sidebar**: filters, search, legend, connection slider only. **No** selected node/edge info.
- **Right panel**: `GraphDetailPanel` (for nodes) or `GraphEdgePanel` (for edges). Includes `CrossPageNav`, paginated connections, and entity description.
- Force layout: pure computation in `src/utils/forceLayout.ts` — `runForceSync()`.
  - Gravity and repulsion scale with node count to keep large graphs compact.
  - Position clamping prevents nodes from flying off-screen.
  - Velocity clamping (`maxV=15`) prevents force explosions.
- **Edge interaction**: Only edges connected to the currently selected node are interactive (hover/click). Non-network edges have `pointerEvents: "none"`.
- **Auto-zoom**: clicking a node auto-zooms to show the node and all its connections via `zoomToNodeConnections()`.
- Node labels: shown always when `nodes.length < 60`, otherwise only on selected/high-connection nodes.
- Edge labels: shown on hover or click, only for interactive (connected) edges.

---

## 14. Data Flow Rules

- **All data access** goes through `dataStore` singleton.
- **All domain types** defined in `src/data/types.ts`.
- Map filter: `appStore.mapFilterType` + `mapFilterId`.
- `showArcs: true` by default.
- Decade data: always use `getPlacesAtDecade()` / `getCumulativePlacesAtDecade()`.
- Default decade: `0` AD (set in appStore).
- `includeCumulative: true` by default.
- **Map auto-zoom**: when `selection` changes, the map auto-zooms: for places, centers at zoom 8; for other entities, fits bounds of all footprint-connected places.

### Wiki page

- **Editor notes** are displayed **in the claims feed** (inside `ClaimsPanel`), not in the entity header. They appear as a predicate group at the top of the claims list.
- Deep-linking via `?kind=X&id=Y` URL params is supported.

---

## 15. Custom Hooks

| Hook | Purpose |
|------|---------|
| `useSearchQuery()` | Returns trimmed global search query from appStore |
| `usePaginatedList(items, pageSize?)` | Returns `{ page, setPage, pageItems, total, pageSize }` with auto-reset |
| `useFilteredList(items, searchFn)` | Returns `{ search, setSearch, filtered }` |

Use these hooks to avoid duplicating pagination/search state management across components.

---

## 16. Forbidden Patterns

1. **No local `KIND_ICONS` / `PRESENCE_COLORS` maps** — import from `entityConstants.ts`.
2. **No inline note rendering** — use `<NoteCard>`.
3. **No inline pagination UI** — use `<Pagination>`.
4. **No `async` wrappers around sync data** — essays are loaded eagerly.
5. **No unused re-export shim files** (the old `types.ts`, `constants.ts`, `repositories.ts` pattern).
6. **No `style={{…}}` for static visual properties** — use CSS classes.
7. **No `@deprecated` compat objects** — delete dead code immediately.
8. **No unrouted page components** — if a page has no route, delete it.
9. **No entity list tabs without pagination** — all lists must paginate.
10. **No evidence display without citations** — always render `citation_urls`.
