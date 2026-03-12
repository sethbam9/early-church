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
      EntityHeader.tsx     – Unified entity header (title/subtitle/tags/facts)
                             getEntityHeaderData() for data extraction
      EvidenceCard.tsx     – Unified evidence card (role, passage, excerpt, links)
      EntityHoverCard.tsx  – Universal hover tooltip for entity links
                             <EntityHoverWrap kind id> wraps any element
      FootprintCard.tsx    – Derived footprint card with derivation-trail hover
      FilterChips.tsx      – Reusable filter chip bar for sidebar lists
      CrossPageNav.tsx     – Map/Graph/Wiki nav icons (respects currentPage prop)
      entityConstants.ts   – KIND_ICONS, KIND_LABELS, KIND_COLORS,
                             PRESENCE_COLORS/LABELS, CERTAINTY_COLORS,
                             STANCE_COLORS/LABELS,
                             kindIcon(), kindLabel(), presenceColor()
    sidebar/        # Sidebar sub-modules
      SidebarShell.tsx     – Drag-to-resize / snap-dismiss wrapper
      SidebarLists.tsx     – All sidebar list components
      EntityDetail.tsx     – Unified entity detail for ALL kinds
                             Props: kind, id, onBack, onExit?, onSelectEntity,
                             onHoverEntity?, onLeaveEntity?, currentPage?
                             Tabs: Info, Timeline, People, Places, Groups, Works,
                             Events, Propositions, Topics, Notes, Mentions
    map/
      RightSidebar.tsx     – Uses EntityDetail for all selection kinds
      LeftPanel.tsx        – Timeline controls, search, filters, stance legend
    layout/
      NavBar.tsx
  data/
    types.ts        # ALL domain type definitions (single source of truth)
    dataStore.ts    # Parsing, indexing, query API; exports globalSearch()
    essays.ts       # Essay metadata + body loading
    parseTsv.ts     # TSV parser utilities
  domain/
    relationLabels.ts  # Relation type → human label registry
  hooks/
    useSearchQuery.ts, usePaginatedList.ts, useFilteredList.ts
  stores/
    appStore.ts     # Zustand store (decade, selection, filters, UI state)
  utils/
    claimAudit.ts   # getClaimAuditStatus(), getClaimBorderClass(), getAuditRows()
    forceLayout.ts  # Force-directed graph physics (pure computation)
    pathFinder.ts   # BFS shortest-path for graph (findShortestPath)
    formatYear.ts   # Year range formatting
    sourceLinks.ts  # getSourceExternalUrl(), getSourceAccessTitle()
  pages/
    MapPage.tsx     # Map + left panel + right sidebar
    GraphPage.tsx   # Force-directed network graph + path finder
    WikiPage.tsx    # Data wiki: browse + audit modes, essays tab
```

---

## 2. DRY Rules (CRITICAL)

### Never redefine — always import from shared

| Need | Import from |
|------|-------------|
| Entity icons/labels/colors | `entityConstants.ts` |
| Entity header | `<EntityHeader kind id showAllFields? />` |
| Evidence display | `<EvidenceCard ev onSelectEntity />` |
| Entity hover tooltip | `<EntityHoverWrap kind id>{children}</EntityHoverWrap>` |
| Footprint card | `<FootprintCard footprint onSelectEntity />` |
| Search highlight | `<Hl text query />` |
| Note rendering | `<NoteCard note />` |
| Pagination | `<Pagination page total onChange />` |
| Markdown/mentions | `<MarkdownRenderer>` |
| Cross-page nav | `<CrossPageNav kind id current="map|graph|wiki" />` |
| Relation labels | `getPredicateLabel()` from `relationLabels.ts` |
| Entity label | `getEntityLabel()` from `dataStore.ts` |
| Global search | `globalSearch()` from `dataStore.ts` |
| Claim audit | `getClaimAuditStatus()`, `getAuditRows()` from `claimAudit.ts` |
| Shortest path | `findShortestPath()` from `pathFinder.ts` |

### Never:
- Define local color/icon/label maps — import from `entityConstants.ts`.
- Write inline evidence rendering — use `<EvidenceCard>`.
- Write inline entity tooltip — use `<EntityHoverWrap>`.
- Write inline pagination — use `<Pagination>`.
- Write inline note rendering — use `<NoteCard>`.

---

## 3. Unified Chip System (CSS)

Four chip types, all in `styles.css`:

| Class | Purpose | Active state |
|-------|---------|-------------|
| `.chip-filter` / `.pchip` | Interactive multi-select | **Inverted**: `background: var(--accent); color: #fff; font-weight: 600` |
| `.chip-info` | Read-only tag | N/A (no interaction) |
| `.chip-legend` | Color-dot + label | N/A (`pointer-events: none`) |
| `.chip-link` | Entity nav chip | Dashed border, hover: `background: var(--accent-dim)` |

### Rules:
- **All filter/toggle chips** must use high-contrast inverted active states.
- Presence-status chips get semantic color overrides (`.active.attested`, etc.).
- Use `.chip-show-all` for the "show all" reset hint (replaces "All" chip in multi-select).
- `.chip-dot` for inline colored circles in legend/presence chips.
- Wiki evidence role chips (`.wiki-ev-role-chip`), audit chips (`.wiki-audit-chip-btn`), view toggle (`.wiki-view-btn`), mode toggle (`.wiki-mode-btn`) all use the same high-contrast active pattern.

---

## 4. Link Differentiation

| Type | CSS class | Behavior |
|------|-----------|----------|
| **Internal entity link** | `.link-internal` or `.mention-link` | Dashed underline, hover: accent background. Must have working hover effect. |
| **External URL** | `.link-external` | Appends `↗` via `::after`. Underline on hover. |

### Rules:
- An internal entity link **cannot** exist without a working hover effect.
- All `<a>` tags pointing to external URLs should use `.link-external` or `.ev-card-ext-link`.
- All `<button>` entity navigation links should use `.mention-link` or `.link-internal`.

---

## 5. Evidence Card

`<EvidenceCard ev onSelectEntity />` — **the only way** to render evidence across the app:

- Full width of parent, flush left (padding: `6px 8px`)
- Background: `var(--surface-2)`, rounded corners
- Shows: role badge (colored by role), evidence weight, passage reference, excerpt (italic, left-bordered), notes, links
- Single internal link: "Open work" (if source has `work_id`)
- Single external link: source title + `↗` (if source has URL)
- CSS: `.ev-card`, `.ev-card-meta`, `.ev-card-role`, `.ev-card-excerpt`, `.ev-card-links`
- **Consumers**: EntityDetail RelationTab, FootprintCard, RelationCard, WikiPage ClaimRow, WikiPage ClaimDetailPanel
- Old patterns deleted: `evidence-item`, `evidence-excerpt`, `evidence-source`, `wiki-ev-detail`, `wiki-ev-row-meta`, `wiki-evidence-row`

---

## 6. Entity Hover Card

`<EntityHoverWrap kind id>{children}</EntityHoverWrap>` — universal tooltip:

- Fixed-position portal tooltip on hover
- Shows: kind badge, entity label, key-value facts
- CSS: `.entity-hover-card`, `.entity-hover-card-title`, `.entity-hover-card-facts`
- Use everywhere entity links appear across all pages.

---

## 7. Derivation Trail Hover

`FootprintCard` shows a derivation trail tooltip on hover:

- Displays the chain of backing claims that produced the derived footprint
- Format: `{icon} Subject → predicate → {icon} Object` for each claim
- Uses `.entity-hover-card` CSS (same as EntityHoverCard)

---

## 8. Navigation: Back + Exit

Every entity detail panel supports two navigation actions:

| Action | Button | Behavior |
|--------|--------|----------|
| **Back** | `← Back` | Pops one step in selection history; if empty, clears selection |
| **Exit** | `✕` (right side of back bar) | Clears entire history stack, returns to list/unselected state |

- `EntityDetail` accepts `onBack` (required) and `onExit` (optional) props.
- Graph page maintains its own `selectionHistory` stack for back navigation.
- Wiki page uses `history` state array for back navigation.

---

## 9. Graph Page

### Layout
- `.graph-sidebar` (260px) | `.graph-canvas-area` (flex 1) | right detail panel (300px)

### Initial load
- Nodes seeded in **circular/radial** pattern (golden-angle spiral), not rectangular.
- After `runForceSync`, auto-centers by computing bounding box and fitting zoom.
- `spreadNeighbors` uses `minSep = r1 + r2 + 26` for adequate spacing.

### Path Finder (Degrees of Kevin Bacon)
- Two `PathPickerInput` autocomplete fields in the left sidebar
- `findShortestPath()` via BFS on the edge adjacency list
- Results: intermediary count + clickable chain display
- CSS: `.graph-path-result`, `.graph-path-chain`, `.graph-path-step`, `.graph-path-node-btn`

### Selection history
- Graph maintains `selectionHistory` stack — back reverts to previous node.
- `pushGraphSelection` / `popGraphSelection` manage the stack.

### Right panel
- Uses `<EntityDetail currentPage="graph">` — no duplicate `CrossPageNav`.
- Timeline card hover triggers `onHoverEntity` → highlights graph node.

---

## 10. Map Page

### Leaflet resize handling
- `invalidateSize()` called at 50ms, 150ms, 400ms when navigating back to map page.
- Also called on `leftPanelVisible` / `rightPanelVisible` changes.

### Center-selected offset
- `handleCenterSelected` accounts for right panel width when computing map center.
- Uses `L.project/unproject` offset for place centering, `paddingBottomRight` for entity bounds.

### Proposition stance coloring
- When `mapFilterType === "proposition"`, markers use `STANCE_COLORS` instead of `PRESENCE_COLORS`.
- Stance color takes priority over connected-entity highlight color.
- `LeftPanel` shows stance legend when proposition filter is active.

---

## 11. Wiki Page

### Layout
- Left: entity kind tabs + search + entity list (sorted by linkage count, descending)
- Center: compact top bar (Back + CrossPageNav left, Relations/Claims toggle right) + content
- Right: claim detail panel (when a claim is selected)

### Entity tabs
All data types browsable: People, Places, Groups, Works, Events, Propositions, Topics, Sources, Notes, Essays.

### Claim filtration
- Evidence role filter chips filter which **claims are visible** (not just evidence rows).
- Claims shown only if they have at least one evidence row matching the selected role.

### Audit table
- Sortable columns: click header to cycle asc → desc → default.
- Sort state: `sortCol` + `sortDir` applied after filter.
- Color key in left panel uses actual colored dots (not plain text).

### Essays
- Essays browsable as a tab in the wiki left panel.
- Essay body rendered with `<MarkdownRenderer>` — `[[mention]]` links work.

---

## 12. Styling Rules

### Use CSS classes, not inline styles
Inline `style={{…}}` only for dynamic runtime values or one-off layout tweaks.

### CSS Variables (design tokens)
```css
--surface / --surface-2 / --surface-3
--border / --border-subtle
--text / --text-muted / --text-faint
--accent / --accent-bright / --accent-dim / --accent-strong
--attested / --probable / --claimed / --suppressed / --unknown
--shadow / --shadow-md / --shadow-lg
--radius / --radius-sm / --radius-lg
--nav-h / --left-w / --right-w
```

---

## 13. Forbidden Patterns

1. **No local color/icon/label maps** — import from `entityConstants.ts`.
2. **No inline evidence rendering** — use `<EvidenceCard>`.
3. **No inline note rendering** — use `<NoteCard>`.
4. **No inline pagination** — use `<Pagination>`.
5. **No inline entity tooltip** — use `<EntityHoverWrap>`.
6. **No `style={{…}}` for static visual properties** — use CSS classes.
7. **No duplicate `CrossPageNav`** — only one per entity detail header.
8. **No "All" chip in multi-select** — use `.chip-show-all` hint.
9. **No low-contrast active states** — all filter chips must use inverted high-contrast.
10. **No internal links without hover effects** — every entity link must respond to hover.
11. **No entity list tabs without pagination** — all lists must paginate.
12. **No evidence display without citations** — always render passage references.
