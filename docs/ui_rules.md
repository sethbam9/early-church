# UI Rules & Feature Log — Early Christianity Atlas

Single source of truth for architecture, component standards, workflow rules, and feature status.
Every contributor must follow these rules. When in doubt, check this file first.

> **Architecture**: React + CSS Modules + design tokens + Zustand.
> No global stylesheet except resets, tokens, and small utilities.

---

## 1. Styling System

### CSS Modules
- Every component owns its styles in a co-located `ComponentName.module.css`.
- Import as `import s from './ComponentName.module.css'`, use as `className={s.root}`.
- No global class names in component files.

### Design Tokens (`src/styles/tokens.css`)
- **All** colors, spacing, radius, shadows, font-sizes come from CSS custom properties.
- Two themes: warm (default on `:root`) and dark (on `[data-theme="dark"]`).
- Components reference tokens only — never hardcode hex values.
- **Shorthand aliases** are defined at the end of `:root` for convenience: `--border`, `--surface`, `--surface-2`, `--surface-3`, `--bg`, `--text`, `--text-faint`, `--shadow`, `--radius`, `--attested`, `--probable`, `--suppressed`.

### Global CSS (`src/styles/globals.css`)
Only contains: reset, typography defaults, scrollbar styling. ~25 lines. No utility classes.

### Leaflet overrides (`src/styles/leaflet-overrides.css`)
Leaflet-specific tooltip/popup/container overrides only.

### Forbidden Styling
- Adding classes to a global stylesheet (except tokens/globals/leaflet).
- Inline `style={{}}` except for truly dynamic runtime values (computed positions, colors from data).
- Deep descendant selectors (`.sidebar .entity-card .header span`).
- Component-specific color systems — use tokens.
- Hardcoded hex/rgb values — always use design tokens.

---

## 2. File Structure

```
src/
  styles/
    tokens.css              – Design tokens (warm + dark themes) + shorthand aliases
    globals.css             – Reset, typography
    leaflet-overrides.css   – Leaflet-specific overrides

  components/
    shared/                 # UI primitives — import from here, never redefine
      Badge.tsx             BibleOverlay.tsx      Button.tsx
      Card.tsx              Chip.tsx              CrossPageNav.tsx
      Dropdown.tsx          EntityHeader.tsx       EntityHoverCard.tsx
      EntityLink.tsx        EvidenceCard.tsx       ExternalLink.tsx
      FilterChips.tsx       FootprintCard.tsx      Hl.tsx
      MarkdownRenderer.tsx  NoteCard.tsx           Pagination.tsx
      PanelSection.tsx      PassageReference.tsx   PathPickerInput.tsx
      RelationCard.tsx      SearchInput.tsx        Slider.tsx
      Switch.tsx            Tabs.tsx               Timeline.tsx
      ToggleGroup.tsx       TooltipOverlay.tsx     InfoIcon.tsx
      entityConstants.ts    – KIND_ICONS, KIND_LABELS, kindIcon(), kindLabel(), presence colors

    wiki/                   # Wiki-specific extracted components
      AuditView.tsx         ClaimRow.tsx
      ClaimDetailPanel.tsx  ClaimsPanel.tsx

    panel/
      PanelShell.tsx        – Resizable panel wrapper (drag-to-resize/dismiss, left border)
      EntityDetail.tsx      – Unified entity detail (all kinds, tabs, timeline, relations)

    map/
      LeftPanel.tsx         – Map left panel (filters, search, context banner)
      RightPanel.tsx        – Map right panel (tabs + entity detail)

    layout/
      NavBar.tsx            – Top navigation bar

  pages/
    MapPage.tsx             GraphPage.tsx
    WikiPage.tsx            AuditPage.tsx
    EssaysPage.tsx

  hooks/                    # React hooks — all business logic lives here
    useWikiPageState.ts     useClaimsData.ts      useAuditData.ts
    useGraphPageState.ts    useMapPageData.ts      useFilteredList.ts
    usePaginatedList.ts     useSearchQuery.ts

  data/                     # Pure data layer (no UI)
  domain/                   # Domain logic (no UI)
  stores/                   # Zustand global state
  utils/
    claimAudit.ts           – Claim audit status helpers
    entityListHelpers.ts    – getAllEntities(), REVIEW_META
    forceLayout.ts          – Graph force layout algorithm
```

---

## 3. Token Contract

Tokens use semantic names. Components never reference raw hex values.

| Category | Tokens |
|----------|--------|
| **Surfaces** | `--bg-app`, `--bg-surface`, `--bg-surface-2`, `--bg-surface-3` |
| **Text** | `--text-primary`, `--text-secondary`, `--text-muted` |
| **Borders** | `--border-default`, `--border-subtle` |
| **Accent** | `--accent`, `--accent-bright`, `--accent-dim`, `--accent-strong` |
| **Semantic** | `--color-success`, `--color-warning`, `--color-danger` |
| **Domain** | `--color-attested`, `--color-probable`, `--color-claimed`, `--color-suppressed`, `--color-unknown` |
| **Spacing** | `--space-1` (4px) through `--space-6` (24px) |
| **Radius** | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill` |
| **Typography** | `--font-size-xs`, `--font-size-sm`, `--font-size-md`, `--font-size-lg` |
| **Shadows** | `--shadow-sm`, `--shadow-md`, `--shadow-lg` |
| **Layout** | `--nav-h`, `--left-w`, `--right-w` |
| **Aliases** | `--border`, `--surface`, `--bg`, `--text`, `--text-faint`, `--shadow`, `--radius` |

Themes: warm (default parchment/amber) and dark (deep blue). Toggled via `data-theme` on `<html>`.

---

## 4. Shared Component Catalog

Every reusable visual pattern is a component. If a pattern appears more than once, it **must** be a shared primitive.

| Component | Purpose | Key props |
|-----------|---------|-----------|
| **Chip** | Filters, tags, indicators | `variant`, `active`, `dot?`, `onClick?`. Active state inverts; dot turns white when active. |
| **Card** | Entity, evidence, dropdowns | `expandable?`, `expanded?`, `flush?` |
| **Button** | Actions | `variant` (primary/ghost), `size`, `disabled` |
| **ToggleGroup** | Binary mode switches | `options: {value,label}[]`, `value`, `onChange` |
| **SearchInput** | All search fields | `value`, `onChange`, `onClear`, `placeholder` |
| **DropdownSelect** | Single-select menus | `options`, `value`, `onChange`. Smart above/below positioning. |
| **Badge** | Status indicators | `variant`, `label` |
| **Tabs** | Sub-navigation (horizontal + vertical) | `tabs: {id,label,icon?}[]`, `active`, `onChange`, `vertical?`, `compact?`. Vertical tabs have hover effect (bg + accent border-left). Icon+label gap via flexbox. |
| **Slider** | Range inputs | `min`, `max`, `value`, `onChange` |
| **Switch** | Binary toggles | `checked`, `onChange`, `label` |
| **EntityLink** | Internal entity refs | `kind`, `id`. Always wrapped with hover tooltip. Font size `0.82rem`. |
| **ExternalLink** | URL links | `href`. Auto `↗` suffix. |
| **InfoIcon** | Claim-to-audit quick action | `claimId`, `title?`. Navigates to `/audit?claimId=...`; stop-propagates row click. |
| **EntityHoverCard** | Hover tooltip popups | `kind`, `id`. Portal-based smart positioning. `EntityHoverWrap` for wrapper pattern. |
| **EntityHeader** | Entity summary block | `kind`, `id`, `showAllFields?`, `currentPage?`, `hideExternalLink?`, `onSelectEntity?`. Shows CrossPageNav when `currentPage` set. |
| **FootprintCard** | Place presence card | `footprint`, `showEntity`, `showPlace`, `onSelectEntity`. Derivation tooltip shows only when `!hasEvidence`. |
| **EvidenceCard** | Claim evidence display | `ev`, `onSelectEntity`. **Only component** that renders evidence. |
| **NoteCard** | Editor note display | `note`, `onSelectEntity`, `yearLabel` |
| **CrossPageNav** | Cross-page entity navigation | `kind`, `id`, `current`. Excludes current page icon. |
| **Timeline** | Decade-grouped timeline | `rows: TimelineRow[]`, `activeDecade`, `emptyMessage`. Auto-scroll to active decade. |
| **PanelShell** | Resizable right panel | `onDismiss`, `width`, `onResize`. Drag-to-resize, snap-close, left border. |
| **PanelSection** | Collapsible section | `title`, `action?`, `children` |
| **Pagination** | Page controls | `page`, `total`, `pageSize`, `onChange` |
| **Hl** | Search text highlight | `text`, `query`. Yellow background on match. |
| **MarkdownRenderer** | Markdown with entity links | `children`, `onSelectEntity`. Wired with `EntityHoverWrap` for `[[mention]]` links. |
| **FilterChips** | Multi-select filter row | Renders `Chip` set with clear/all logic |
| **PathPickerInput** | Graph path finder input | Autocomplete entity picker |
| **PassageReference** | Source passage display | `passage`, linked formatting |
| **RelationCard** | Relation display | Entity-to-entity relation with claims |
| **BibleOverlay** | Bible reference popup | Verse reference lookup |

---

## 5. Component & Rendering Rules

### Evidence
- **Only** `<EvidenceCard>` renders evidence. No inline evidence HTML anywhere.

### Entity links
- **Only** `<EntityLink>` for internal entity navigation (with hover tooltip).
- **Only** `<ExternalLink>` for URLs (with `↗` icon).
- `hideExternalLink` prop on `EntityHeader` hides "Read online" when entity is already selected.

### Entity hover
- `<EntityHoverCard>` / `<EntityHoverWrap>` provides universal tooltip everywhere entity links appear.
- Wired into `<MarkdownRenderer>` for all `[[mention]]` links.
- `<FootprintCard>` shows derivation trail tooltip only when the footprint has no linked evidence.

### Filter system
- Multi-select → `<Chip>` with inverted active state (dot turns white).
- Single-select → `<DropdownSelect>`.
- Binary toggle → `<ToggleGroup>` or `<Switch>`.
- "Show all" hint when filters are active (not an "All" chip).
- Filter dropdowns and search inputs must share a single row.

### Navigation
- `<CrossPageNav>` renders map/graph/wiki links, excluding current page. Never duplicate.
- `<EntityDetail>` supports `onBack` + `onExit`. Exit always shows; back only when history exists.
- Prevent nested selection: if entity is already selected, `handleSelectEntity` is a no-op.
- Essay scroll position must be preserved when navigating away and back.

### Hover effects
- All list items (entity list, search results, vertical tabs) use: `background: var(--surface-2)`, `color: var(--text)`, `border-left-color: var(--accent-bright)` on hover. No padding-shift hover effects.

---

## 6. Page-Specific Features (must be maintained)

### Map Page
- Default to "fit visible" unless opened via entity link (center on that entity).
- Centering logic adjusts for right panel width. Uses `invalidateSize()` + delayed retry.
- Proposition selection highlights & color-codes locations by stance — activates on both map filter AND right-panel selection.
- Left panel: entity type multi-select filter rows, sorted by linkage count. Close button on context banner.
- Right panel: `PanelShell` (drag-to-resize/dismiss). Tabs + EntityDetail.
- Timeline: shared `<Timeline>` component, auto-scroll to nearest decade.
- Essay entity links use normal `pushSelection` flow (no separate overlay viewport).

### Graph Page
- Circular node seed (golden-angle spiral), centered on load with bounding box fit.
- Centering adjusts for right panel width.
- Right panel wrapped with `PanelShell` (drag-to-resize). No duplicate X button.
- Path Finder: smart dropdown positioning (above/below), BFS shortest path, click-through paths.
- Degrees of Kevin Bacon mode: iterate through linkage by least intermediaries.
- Node type filters as multi-select rows (legend merged into filters).
- Entity/timeline card hover highlights corresponding graph node.
- `resetView` dynamically fits all visible nodes.

### Wiki Page
- **Left panel**: entity kind tabs (vertical, with icons from `KIND_ICONS`), entity list sorted by claim count, global search with `<Hl>` highlighting.
- **Center panel**: detailTopbar with back button + CrossPageNav + Relations/Claims toggle.
- **Relations view**: `<EntityDetail>` without `currentPage` (avoids duplicate CrossPageNav). Consistent 12px padding.
- **Claims view**: `<EntityHeader>` in `claimsHeaderWrap` (8px 12px padding, bottom border). `<ClaimsPanel>` with filters: role, certainty, review status, predicate search — all in one row.
- **Audit mode**: `<AuditView>` with sortable columns, filter dropdowns in single row, color-coded status dots.
- **Essays tab**: `<MarkdownRenderer>` with entity hover. Scroll position preserved on back navigation.
- **Topics**: header shows linked propositions (up to 5 with links) + dimension info.
- `hideExternalLink` on `EntityHeader` when viewing a work or source directly.
- WikiPage.tsx reduced to ~244 lines; extracted `ClaimRow`, `ClaimsPanel`, `ClaimDetailPanel`, `AuditView` to `src/components/wiki/`.

---

## 7. Business Logic Separation

Page components are layout shells. **All** business logic lives in hooks under `src/hooks/`.

| Hook | Owns |
|------|------|
| `useWikiPageState` | Selection history, mode, search, entity kind, view toggle, scroll preservation |
| `useClaimsData(kind, id)` | Claims filtering (role, certainty, review status, predicate), grouping, stats, editor notes |
| `useAuditData` | All audit rows, filtering, sorting, pagination, status chips |
| `useGraphPageState(svgRef)` | Graph build, filters, selection/history, search, path finder, degrees mode, zoom/pan |
| `useMapPageData` | Visible places, arc pairs, proposition stance map, place filtering |
| `useFilteredList` | Generic search-filtered list |
| `usePaginatedList` | Generic paginated list |
| `useSearchQuery` | Debounced search query |

---

## 8. Forbidden Patterns

1. **No global CSS class additions** — use CSS Modules.
2. **No inline `style={{}}`** for static properties — use module classes.
3. **No local color/icon/label maps** — import from `entityConstants.ts`.
4. **No inline evidence/note/pagination rendering** — use shared primitives.
5. **No deep descendant selectors** — use flat module class names.
6. **No hardcoded hex/rgb values** — use design tokens.
7. **No duplicate visual patterns** — extract to shared component.
8. **No component without co-located `.module.css`** — every component owns its styles.
9. **No hand-rolled chip/toggle/search/dropdown CSS** — always use `<Chip>`, `<ToggleGroup>`, `<SearchInput>`, `<DropdownSelect>`.
10. **No dead CSS or dead code** — remove in the same edit session, never defer.
11. **No duplicate CrossPageNav** — only render once per view (in detailTopbar OR EntityHeader, never both).
12. **No padding-shift hover effects** — use bg + text + border color transitions.

---

## 9. Edit Workflow (checklist for every UI change)

### Pre-flight
1. Read this file (`docs/ui_rules.md`) for current rules.
2. Check if a shared component already exists in `src/components/shared/`.
3. Check if a CSS module already defines the class you need.

### Making Changes
4. Use CSS Modules exclusively. Never global class names.
5. No static inline styles. No duplicate CSS.
6. Business logic → hooks. Color/icon/label maps → `entityConstants.ts`.
7. Entity links → `<EntityLink>` or `<EntityHoverWrap>`. External links → `<ExternalLink>`.

### Post-edit Cleanup
8. Remove unused CSS classes, imports, and dead code immediately.
9. Run type check: `npx tsc --noEmit` — must pass with zero errors.
10. Run build: `npx vite build` — must pass with zero errors.

### Documentation
11. If the change resolves a pending item below, mark it `[x]`.
12. If the change introduces a new pattern, add it to the relevant section above.

### Principles
- **Minimal diffs**: prefer editing existing files over creating new ones.
- **Reuse over reinvent**: always check shared components first.
- **CSS budget**: no new CSS class unless the pattern doesn't exist. Justify new classes.
- **Clean as you go**: dead CSS and dead code removed in the same session.
- **Consistent spacing**: use `var(--space-*)`, `var(--radius-*)`, `var(--font-size-*)` over hardcoded pixels.

---

## 10. Feature Log

### Resolved
- [x] Panel borders — shorthand aliases in `tokens.css` (`--border`, `--surface`, etc.)
- [x] Close button (X) — unified `.closeBtn` style across wiki/graph/map
- [x] Entity link text size — `EntityLink` uses `0.82rem`
- [x] Browse role chips → `DropdownSelect` in both browse and audit views
- [x] Entity list hover — bg + text + accent border-left (consistent across pages)
- [x] Audit role chips → dropdown — merged into filter row
- [x] Audit sticky header z-index raised to 2
- [x] Graph duplicate X removed — `detailCloseBar` deleted; EntityDetail exit handles it
- [x] Graph hover overlay opacity reduced (`.12`)
- [x] Graph fit/center — `resetView` fits all nodes dynamically
- [x] Map search hover — bg + text color change (no padding shift)
- [x] Map "Include earlier decades" above "Christian places only"
- [x] Tab ellipsis — compact tabs use `text-overflow: ellipsis`
- [x] Back/exit button — exit always shows; back only with history
- [x] Show controls/panel buttons — bolder text, stronger shadow
- [x] Proposition stance coloring — activates on filter AND selection
- [x] Search text highlight — wiki EntityList uses `<Hl>` component
- [x] Graph search dropdown shadow reduced (`.18`)
- [x] Cross-page nav inline in WikiEntityHeader
- [x] Map auto-center — `invalidateSize()` + delayed retry
- [x] Graph right panel drag-to-resize — `PanelShell` wrapper, dead CSS removed
- [x] Essay entity links — use `pushSelection` flow; `essayOverlay` removed
- [x] Presence chip dot inversion — `.active .dot { background: #fff }`
- [x] CSS token aliases — `--border`, `--surface`, `--bg`, `--text`, `--text-faint`, `--shadow`, `--radius`
- [x] Hover unification — all list items use bg + text + accent border-left
- [x] Wiki refactor — extracted `ClaimRow`, `ClaimsPanel`, `ClaimDetailPanel`, `AuditView` (679→244 lines)
- [x] Graph right panel left border — `border-left` in PanelShell.module.css
- [x] Derivation hint — tooltip only for footprints with no linked evidence
- [x] Wiki vertical Tabs hover — bg + text + border-left effect
- [x] Wiki relations/claims padding alignment — 12px; redundant CrossPageNav removed
- [x] Prevent nested selection — no-op if entity already selected (wiki + map)
- [x] Audit filter row — dropdowns + search in single row
- [x] Map left panel close button — `.closeBtn` in LeftPanel.module.css
- [x] UI edit workflow — `.windsurf/workflows/ui-edit.md`
- [x] Wiki Tabs icon+label gap — flexbox gap on `.tab`
- [x] Essay emoji added to `KIND_ICONS`
- [x] Claims view review status dropdown filter
- [x] Topics view enriched — header shows linked propositions with clickable links
- [x] Claims view entity header padding — `claimsHeaderWrap` with border-bottom
- [x] "Read online" hidden for works/sources on wiki — `hideExternalLink` on `InfoTab` + `EntityHeader`; `currentPage="wiki"` passed to `EntityDetail`
- [x] Essay scroll preservation — `onScroll` handler saves to `scrollMapRef` (wiki) / module-level `essayScrollMap` (map); restore via `useEffect`
- [x] Arcs toggle — only shown when a work is selected; auto-resets to `true` on selection change (`setSelection`/`pushSelection`)
- [x] Shared `MapGraphOverlay` component — zoom +/−, fit visible, center selected; used by map + graph center areas; Leaflet zoom control disabled
- [x] Fit visible / Center selected removed from map left panel → map overlay
- [x] Left panel context banner unlinked from `mapFilter` — uses `selection` only; proposition stance legend shows for both filter and selection
- [x] Place timeline unified — same claim-style rows as entity timeline (decade header, year badge, predicate, entity link); no `FootprintCard`s; dead CSS (`fpStack`, `tlStatus`, `tlMeta`, `tlYear`, `tlPolityBtn`) removed
- [x] Entity label truncation — `truncateLabel(label, 20)` applied to both entity + place timeline `mentionLink` buttons
- [x] Dead `WikiEntityHeader` removed from `WikiPage.tsx`

- [x] "Open work" link hidden in EvidenceCard when viewing a work entity — `hideWorkLink` prop on `EvidenceCard`, passed from `RelationTab` (focusKind=work), `ClaimRow`, and `ClaimDetailPanel`
- [x] MapGraphOverlay z-index raised to 1000 (above Leaflet controls at 400+) so overlay stays visible at all map zooms
- [x] Map invalidation timings improved — [0, 50, 160, 350]ms cascade on panel toggle to eliminate gray space
- [x] Topic header shows ALL propositions — removed `.slice(0, 5)` truncation in `EntityHeader`
- [x] Wiki relations view: duplicate CrossPageNav suppressed — `EntityHeader` gets `currentPage=undefined` when `hideBackBar=true`
- [x] Essay: "Open in map" button in wiki topbar — sets `pendingEssayId` in appStore, navigates to `/`, opens essay in map right panel
- [x] Essay: Content / Entities tabs in both wiki and map right panel `EssayView` — extracts `[[kind:id|label]]` refs, groups by kind
- [x] Graph: center-on-selected — `centerOnSelected` callback in `useGraphPageState` via `selectedKeyRef`+`panToNode`; wired to `MapGraphOverlay` with `showCenter={hasSelection}`
- [x] Jewish War work entity — added `the-jewish-war` to `works.tsv`; linked `src-josephus-war` via `work_id`
- [x] Right panel filters decoupled from left panel — `PlacesList` accepts optional `placeKindFilterOverride`/`christianOnlyOverride` props; `RightPanel` uses local state
- [x] Unified search overlay — shared `GlobalSearchOverlay` component with keyboard nav (arrow keys + Enter); wired into wiki, map left panel, and graph left panel
- [x] Switch component fix — added `onClick` handler that calls `onChange(!checked)` (Christian filter toggle was non-functional)
- [x] Map right panel search highlight — `EntityDetail` accepts optional `searchQuery` prop; `RightPanel` passes `panelSearch` so highlights work with panel-local search
- [x] Map fit-bounds hardening — retry cascade at [100, 300, 600]ms on initial fit; re-fit on page return (500ms debounce) when no selection active
- [x] Map SearchResultsPanel restored — `GlobalSearchOverlay` gains `onQueryChange` callback; map left panel wires it to `setSearchQuery` so overlay appears; removed duplicate `SearchInput`
- [x] CertaintyBadge component — replaces raw "probable"/"possible"/"uncertain" text with colored icon (◐/○/△) + hover tooltip; used in RelationCard, EntityDetail (footprint, timeline, relation tabs), ClaimRow
- [x] Graph path highlighting — `pathEdgePairs` Set tracks edges on current path; edges rendered green (3px, 0.9 opacity); non-path edges dimmed; path nodes stay visible when path active
- [x] Graph path finder UI — action row with swap (⇄) button, "use selected as start/end" helpers; summary shows hop count + intermediary count
- [x] Graph degrees of separation UI — shows source entity name; `DegreesHistogram` component renders compact bar chart of node distribution by hop distance

- [x] Dead code cleanup — deleted orphaned `EssaysPage`, unused `useSearchQuery`/`useFilteredList` hooks, dead `findShortestPath` export, dead wiki global search state in `useWikiPageState`, dead `getClaimOtherKey`/`panToNode` exports in graph hook
- [x] DRY: shared `ENTITY_TABS` + `CERTAINTY_OPTIONS` constants in `entityConstants.ts` (was duplicated in WikiPage + AuditView + ClaimsPanel)
- [x] DRY: shared `formatYearRange()`, `formatDecadeLabel()`, `formatReviewDate()`, `truncateLabel()` in `utils/formatYear.ts` — replaces hand-rolled year/date/label formatting across EntityDetail, ClaimRow, ClaimDetailPanel, GraphPage
- [x] DRY: extracted `getEntityAllClaims` + `EVIDENCE_ROLES` into standalone `utils/claimHelpers.ts` — broke circular hook→util→hook import chain
- [x] DRY: PanelLists 5 list components converted from hand-rolled `[page,setPage]+useEffect+.slice()` to `usePaginatedList` hook
- [x] Wiki CSS module ownership — created `src/components/wiki/Wiki.module.css`; 4 wiki components now import co-located module instead of reaching into `WikiPage.module.css`; WikiPage.module.css trimmed from 717→195 lines
- [x] Map SearchResultsPanel deep search restored — full-text entity search across notes/descriptions/PLACE_SEARCH_INDEX (was broken by globalSearch() migration which only searched labels)
- [x] Map context banner enriched — proposition selections show affirm/condemn/mixed counts; all selections show kind icon; X dismiss button clears selection
- [x] MapPage marker colors extracted to named `ACCENT`/`ACCENT_CONNECTED` constants (Leaflet requires hex, not CSS vars)
- [x] Removed unused imports: `PassageReference`+`useRef` from EntityDetail, `STANCE_LABELS` from MapPage
- [x] Fixed pre-existing `pathFinder.ts` TS strictness lint errors (possibly-undefined array element guards)
- [x] Passages tab cleanup — removed static inline styles from `EntityDetail` Passages tab; moved to `EntityDetail.module.css` classes and standardized linked-claim cards with shared `InfoIcon`
- [x] Passages tab UX polish — linked-claim sentence now emphasizes entities with hoverable entity links, keeps predicate non-bold, and includes per-evidence verse/reference external links
- [x] Map place-kind markers — city markers remain circle markers; non-city place kinds now render distinct symbols (site/monastery/region/province/route) while preserving selection/connection highlighting

- [x] Emoji purge — all remaining emoji in UI replaced with Lucide icons: `FILTER_OPTIONS` in `useGraphPageState` (👤📜📝⚡🏛✦ removed), `filterBanner` (🗺 → `MapIcon`), dominant-polity chip (⚔ → `Sword`), AuditPage source link (📄 → `FileText`)
- [x] Hover delay — `EntityHoverWrap` now waits 500ms (`HOVER_DELAY_MS` constant) before showing tooltip; `useCallback`+`clearTimeout` on mouse-leave prevent flicker
- [x] Chip alignment — `.tag` changed from `display:inline-block` to `display:inline-flex; align-items:center; gap:var(--space-1)` so icon+text chips stay vertically aligned
- [x] Passage card font — `.passageTitle` reduced from `font-size-md / fw600` to `font-size-sm / fw500` to match other relation-card titles
- [x] ClaimsPanel collapsible sections — editor notes and derived places both start collapsed; toggle header uses `Title (count)` format with `StickyNote`/`MapPin` icon; `sectionToggleBtn` CSS class added to `Wiki.module.css`
- [x] EntityDetail sub-tabs with icons — `TAB_ICONS` map added; each sub-tab renders icon + label (counts already in label text); `.detailSubTab` uses `display:inline-flex; align-items:center; gap:var(--space-1)`
- [x] Essay white background — `WikiPage.module.css .detailBodyStyle` gains `background: var(--bg-surface)` so essay markdown reads on white, not parchment
- [x] Essay back header alignment — `RightPanel.module.css .backBtn` now uses same style as `EntityDetail.module.css .backBtn` (accent-bright, underline-hover, no border-radius box)
- [x] Back-bar crumb shows entity name — `EntityDetail` crumb changed from `kindLabel(kind)` to `getEntityLabel(kind, id)`; `.crumb` gains `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`
- [x] Essay entities hover — wiki essay entities tab items wrapped with `EntityHoverWrap` (both `WikiPage.tsx` and `RightPanel.tsx`)
- [x] Global search derivative map highlight — `searchHighlightPlaceIds` in `MapPage` includes footprints of all matched non-place entities, not just direct place matches
- [x] Dark mode toggle — Moon/Sun button in NavBar toggles `data-theme="dark"` on `<html>`; `.themeToggle` CSS class in `NavBar.module.css`; state initializes from current attribute
- [x] Wiki kind-tab count badges — each vertical kind tab label includes total entity count: `People (42)`, `Works (18)`, etc.; uses cached `getAllEntities(kind).length`
- [x] Map place kind legend — collapsible `PlaceLegend` component bottom-left of map; shows SVG icon + label for each place kind (City/Site/Monastery/Region/Province/Route)
- [x] Graph path start/end buttons — replaced `○→Start` / `○→End` text with `→ Start` / `→ End`
- [x] Wiki entity list hover — `EntityList` items in wiki left panel now wrapped with `EntityHoverWrap` for instant hover cards

- [x] Map icon centralization — `PLACE_KIND_SVG_PATHS` + `buildPlaceKindIconSvg()` + `PLACE_KIND_LABELS` added to `icons.tsx`; `MapPage.tsx` `renderIconSvg()` removed and replaced with `buildPlaceKindIconSvg()`; `PlaceLegend` updated to use `PlaceKindIcon` React components; map markers and right panel now share the exact same Lucide SVG paths (Building2/Mountain/Church/Landmark/MapPinned/Route)
- [x] Section header format — all ClaimsPanel section headers now use `{count} Title` format: "3 authored by", "5 Notes", "12 Derived Places". Previous `(N) predicate` → `N predicate`, `Notes (N)` → `N Notes`, `Derived Places (N)` → `N Derived Places`.
- [x] Deprecated emoji APIs removed — `KIND_ICONS` emoji map and `kindIcon()` function removed from `entityConstants.ts`; `DEFAULT_ICON_PROPS` unused import removed
- [x] Graph left panel icons — `nodeBadge` colored dots replaced with `KindIcon` components colored via `KIND_COLORS`; each type row shows `.nodeKindIcon` (icon) + `.typeLabel` (text) + `.typeCount` (visible node count); search suggestion dots also replaced with `KindIcon`; GraphPage.module.css updated: `.nodeBadge` removed, `.nodeKindIcon` / `.typeLabel` / `.typeCount` added
- [x] "/" keyboard shortcut — `GlobalSearchOverlay` gains `enableSlashShortcut` prop; when true adds a global `keydown` listener that focuses its input when "/" is pressed outside any text field; only the NavBar instance has this enabled; placeholder updated to "Search all entities… (press / to focus)"
- [x] Entity kind accent bar — `EntityDetail` panel renders `borderTop: 3px solid KIND_COLORS[kind]` so each entity type has a distinctive color indicator at the top of the panel
- [x] Copy entity ID button — small `Copy`/`Check` icon button in `EntityDetail` back bar copies `id` to clipboard via `navigator.clipboard.writeText`; shows confirmation checkmark for 1.5 s; `.copyIdBtn` CSS class added to `EntityDetail.module.css`
- [x] Place kind icon in wiki entity list — when `kind === "place"`, wiki EntityList items show `PlaceKindIcon` sized at 12px before the label (looks up `dataStore.places.getById(e.id)?.place_kind`)
- [x] Dark mode toggle — Moon/Sun button in NavBar (from previous session, logged here for completeness)
- [x] docs updated — `docs/features.md`, `docs/user-guide.md`, `.windsurf/workflows/ui-edit.md` all rewritten to reflect current app state, remove all emoji descriptions, document new icon system rules and section header format requirements
- [x] Passages tab icon — changed from `BookOpen` to `Quote` icon in EntityDetail sub-tabs
- [x] Sub-tab display — EntityDetail sub-tabs now show only icon + count (no label text); label appears in tooltip on hover
- [x] Wiki row alignment — PlaceKindIcon in wiki entity list rows now vertically centered via `.entityItemIcon { height: 100%; }` CSS
- [x] User guide padding — added extra bottom padding to GuidePage content (`padding-bottom: calc(var(--space-6) * 2)`)
- [x] Global search isolation — NavBar global search now uses URL params for wiki/graph (`/wiki?kind=X&id=Y`) and app store selection only for map; eliminates cross-contamination between pages
- [x] Graph URL params — GraphPage now handles URL params to select and zoom to nodes from global search navigation
- [x] Claim row review badge alignment — `.reviewBadge` now uses `display: inline-flex; align-items: center; justify-content: center;` for proper vertical centering of checkmark icons