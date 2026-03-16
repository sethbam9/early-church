# Early Christianity Atlas — Feature Reference

Complete listing of every feature and expected behavior across all pages and shared components.

---

## Table of Contents

1. [Global Navigation](#global-navigation)
2. [Map Page](#map-page)
3. [Graph Page](#graph-page)
4. [Wiki Page](#wiki-page)
5. [Entity Detail Panel](#entity-detail-panel)
6. [Right Panel (Map & Graph)](#right-panel-map--graph)
7. [Essays](#essays)
8. [Global Search Overlay](#global-search-overlay)
9. [Data Model Entities](#data-model-entities)

---

## Global Navigation

- **Top navigation bar** shows the app title ("Early Christianity Atlas · AD 33 – 800") and four page links: 🗺 Map, 🕸️ Graph, 📖 Wiki, 🔍 Audit.
- Active page link is highlighted.
- All three pages mount simultaneously; switching pages uses CSS `display` toggling (no remounts, state is preserved).
- **CrossPageNav** buttons appear in entity detail headers, providing one-click navigation to view the same entity on any other page.

---

## Map Page

### Timeline & Playback

- **Decade slider** — scrubs through available decades from AD 33 to AD 800. Displays the active decade as "AD ####".
- **Step buttons** (◀ / ▶) — move one decade backward or forward.
- **Play / Pause** — animates through all decades automatically.
- **Playback speed** dropdown — 1×, 2×, or 4× speed.
- **Include earlier decades** toggle — when on, cumulatively includes all places with presence up to and including the active decade. When off, shows only the exact decade.
- **Place count** — shows the number of visible places for the current filter state.

### Filters (Left Panel)

- **Presence filter chips** — multi-select chips for each presence status (attested, probable, claimed, suppressed, unknown). When all are deselected, all statuses are shown. Active chips invert color; the chip dot turns white.
- **Place kind chips** — single-select filter: city, region, site, province, monastery, route.
- **Christian places only** toggle — hides places with no historical Christian presence.
- **Show arcs** toggle — renders correspondence arcs (written_at → addressed_to_place) for the selected work. Auto-resets to "on" whenever selection changes. Only shown when a work is selected.

### Global Search

- **Search bar** opens the **Global Search Overlay** (see below).
- When a query is active, a **Search Results Panel** floats over the map showing all matching entities (places, people, works, groups, events, propositions, sources) with kind icons, labels, subtypes, and highlighted match text.
- Results are paginated (20 per page) with Prev/Next controls.
- Clicking a result selects that entity and opens the right panel.
- An ✕ button clears the search.

### Map Markers

- **Colored circle markers** — color indicates presence status (attested, probable, claimed, suppressed) or, when a proposition is selected/filtered, the doctrinal stance (affirms=green, opposes=red, mixed=yellow).
- **Selected place** — dashed amber ring + larger filled marker.
- **Connected places** — solid amber ring when a non-place entity is selected, showing all places associated with that entity. Non-connected places are dimmed to 22% opacity.
- **Ghost marker** — when a selected place falls outside the current decade's visible set, a semi-transparent ghost ring appears at that location with a "(not in this decade)" tooltip.
- **Tooltip** — hovering a marker shows `Place Name (Modern Name), Country [kind]`.
- **Click** — selects the place and opens the right panel on the Places tab.

### Arcs Overlay

- When a **work** entity is selected and "Show arcs" is on, curved arcs connect the work's written-at location to its addressed-to places.
- Arcs are rendered as SVG polylines with an amber stroke.

### Entity Context Banner

- Appears in the left panel when any entity is selected.
- Shows the entity kind icon, name, and number of associated places.
- For **proposition** selections, also shows affirm / condemn / mixed counts with color-coded labels.
- ✕ button dismisses the selection.

### Stance Legend

- When a proposition is selected or the map filter is set to a proposition, a colored legend appears in the left panel showing affirms / opposes / mixed/neutral colors.

### Map Overlay Controls (center, bottom-right)

- **Zoom In (+)** / **Zoom Out (−)** — increment map zoom level.
- **Fit ⊞** — fits all visible markers into view.
- **Center ◎** — centers the map on the selected entity (accounting for right panel width). Shown only when an entity is selected.

### Panel Visibility

- **◀ Controls** button — shown in the map center when the left panel is hidden; click to restore it.
- **Panel ▶** button — shown in the map center when the right panel is hidden; click to restore it.
- Left panel has an ✕ close button.
- Right panel has an ✕ close button (via PanelShell).

### Random Place

- **Rand** button in the left panel header selects and flies to a random visible place.

### Map Initialization

- On first load, the map fits all visible markers with `fitBounds` and a retry cascade at 100 ms, 300 ms, 600 ms to handle flexbox layout race conditions.
- On page return (when no entity is selected), the map re-fits after a 500 ms debounce.

---

## Graph Page

### Canvas

- **Force-directed graph** — nodes repel each other and edges pull connected nodes together.
- **Pan** — drag the background to pan.
- **Zoom** — scroll wheel zooms; clamps at min/max.
- **Node click** — selects the entity and opens the right panel.
- **Background click** — deselects the current entity.
- **Hint** — "Scroll to zoom · Drag to pan · Click node to explore" shown at bottom of canvas.

### Nodes

- **Color by entity kind** — each entity type has a distinct color (from `KIND_COLORS`).
- **Size by connection count** — nodes with more connections are larger.
- **Connection count label** — nodes with ≥5 connections display their count inside the circle.
- **Selected ring** — white outer ring on the selected node.
- **Connected ring** — accent-colored hover ring on connected nodes.
- **Dimmed** — non-connected, non-selected nodes are dimmed to 15% opacity when an entity is selected.
- **Labels** — shown for selected nodes, nodes on the active path, nodes with ≥3 connections, or when total nodes < 60. Labels truncated to 20 characters.

### Edges

- **Default** — thin, low-opacity lines.
- **Selected** — edges connected to the selected node are highlighted in accent color.
- **Hover** — when hovering a connected node, that edge brightens further.
- **Opposes-proposition** edges — rendered in red (dark/bright variants).
- **Path edges** — rendered green at 3 px / 0.9 opacity when a path is active.
- **Non-path edges** — dimmed to 4% opacity when path mode is active.

### Hover Overlay

- Hovering a **connected** node (while another node is selected) shows a floating tooltip listing: the hovered node's label, all relationship predicates to the selected node (colored red for opposes), certainty, and year range.

### Filters (Left Panel)

- **Entity type filter** — multi-select chips for each entity kind. Deselecting all shows all types.
- **Min connections slider** — hides nodes with fewer connections than the threshold.
- **Filter hint** — shows how many nodes are currently visible.

### Path Finder

- **Start / End pickers** — type-ahead autocomplete inputs (`PathPickerInput`) for selecting source and target entities.
- **Swap (⇄) button** — swaps start and end.
- **"Use selected" helpers** — one-click buttons to set the currently selected node as start or end.
- **Find Path** button — runs Dijkstra / BFS shortest path.
- When a path is found: path edges turn green, non-path edges are dimmed, path nodes remain fully visible, and a summary shows hop count and intermediary count.
- **Clear** button — resets path mode.
- **Not found** message — shown when no path exists.

### Degrees of Separation

- **Source picker** — select any entity as the origin.
- Computes BFS distances from that source to every other connected node.
- **Node coloring** — gradient from green (0 hops) → yellow → orange → red (max hops); unreachable nodes shown in dark grey.
- **Hop count label** — rendered inside each reachable node circle.
- **Source node** — rendered solid green.
- **Degrees Histogram** — compact bar chart showing the count of nodes at each hop distance, with "Distribution by hop distance" label.

### Selection History

- Clicking a node pushes the previous selection onto a history stack.
- The right panel's **← Back** button navigates through that history.
- Clearing selection resets the history.

### Map/Graph Overlay

- Zoom In/Out, Fit Visible, Center Selected buttons — same as Map Page.
- Center Selected only shown when a node is selected.

---

## Audit Page

Three-column claim quality workbench for reviewing evidence, derivation chains, and review status.

### Left Column: Claim Queue

- **Filter chips**: All, Flagged, No Evidence, No Supports, Unreviewed, Approved, Disputed.
- **Search**: filters claims by sentence text or claim_id.
- **Claim list**: severity-sorted (disputed → no_evidence → no_supports → unreviewed → approved). Each row shows the normalized claim sentence, colored flag badges, evidence count, and certainty.
- **Pagination**: 50 claims per page with Prev/Next controls.
- Clicking a claim selects it and populates the center and right panels.

### Center Column: Assertion Panel

- **Claim identity card**: rendered sentence, certainty badge, claim_status chip, date span, context place, and monospace claim_id.
- **Claim structure grid**: full field-by-field display of all claim columns — subject (clickable entity), predicate (with ID), object (clickable entity or scalar), certainty, date range, context place, status, created_by, updated_at.
- **Evidence section**: lists all `claim_evidence` rows with `EvidenceCard` plus per-row detail grid showing role (color-coded badge: green=supports, red=opposes, gray=other), support_aspect, assertion_mode, evidence_weight, passage excerpt, and notes.
- **Entity navigation**: clicking any entity reference in the claim structure navigates to the Wiki page and opens that entity.
- Empty state: "No evidence linked to this claim."

### Right Column: Review & Derivation

- **Review status**: current `claim_reviews` snapshot with color-coded status badge (green=approved, amber=reviewed, red=disputed).
- **Review history**: `claim_review_events` timeline with event_type, actor, timestamp, and note.
- **Derivation chains**: all `derived_edges` that reference the selected claim, rendered via `DerivationChain` component showing from→to entity steps with clickable labels.

---

## Wiki Page

### Proposition Derived Places

- When viewing a proposition in Claims mode, a **Derived Places** section appears above the claim list.
- Each row shows: place (clickable EntityLink), stance, supporting/opposing counts, year range, and derivation count.
- Expanding a row reveals the `DerivationChain` components showing how the proposition’s presence at that place was derived.
- Uses the same `claimRow` CSS styling as regular claim rows for visual consistency.

### Browse Mode

- **Mode toggle** (Browse / Audit) in the left panel header.
- **Vertical tab strip** — entity kinds listed with icon + label (People, Places, Groups, Works, Events, Propositions, Topics, Sources, Editor Notes, Essays). Active kind is highlighted with accent border-left.
- **Filter search** — a `SearchInput` below the tabs filters the entity list by label or ID.
- **Entity list** — sorted by linkage count descending (most-connected entities first), paginated at 40 per page. Matching text is highlighted.
- **Clicking an entity** pushes it into the selection history and opens it in the center pane.
- **← Back** button — navigates through the selection history.
- **✕ Exit** button — always visible in the entity detail top bar; returns to the list view.

### Center Pane — Topbar

- Shows **← Back** (when history exists), **CrossPageNav** links (map/graph), and the **Relations / Claims toggle**.
- For essay selections: shows **🗺️ Open in map** button instead of CrossPageNav.

### Center Pane — Relations View

- Renders **EntityDetail** (see Entity Detail Panel section) with `hideBackBar=true` so the wiki's own topbar handles navigation.

### Center Pane — Claims View (`ClaimsPanel`)

- Lists all claims for the selected entity grouped or sorted.
- **Evidence role filter** — dropdown: all / supports / opposes / contextualizes / mentions.
- **Certainty filter** — dropdown: all / attested / probable / possible / uncertain.
- **Review status filter** — dropdown: all / approved / pending / disputed.
- Expanding a claim row shows full **EvidenceCard** details (passage ref, excerpt, role, weight, notes, source link).
- Clicking a claim opens the **ClaimDetailPanel** (full evidence + review info).

### Audit Mode

- **Claim Audit** view — shows all claims across all entities.
- **Color key**: red dot = no evidence or disputed, orange = unreviewed, green = approved.
- **Filters**: status chip (all/no-evidence/unreviewed/approved/disputed), entity type dropdown, certainty dropdown, predicate search input — all in a single filter row.
- **Sortable columns** — click column headers to sort asc/desc/default.
- Clicking a row opens the **ClaimDetailPanel**.

### Essay View (Wiki)

- Essays shown in a two-tab view: **Content** and **Entities**.
- Content tab renders the essay Markdown with `[[kind:id|label]]` wiki links as interactive entity buttons with hover tooltips.
- Entities tab lists all referenced entities grouped by kind.
- Scroll position is saved per essay and restored on re-open.
- **"Open in map"** button navigates to the Map page and opens the essay in the right panel.

### Global Search

- **GlobalSearchOverlay** — above the entity list. Keyboard-navigable (arrow keys + Enter to select). Opens a dropdown of matching entities from all kinds.

---

## Entity Detail Panel

Used in the Map right panel, Graph right panel, and Wiki center pane.

### Back Bar

- **← Back** — shown only when selection history exists.
- **Entity kind** breadcrumb label.
- **✕ Exit** — always shown; closes the panel or returns to the list.

### Header (EntityHeader)

- Entity title, subtitle, kind badge, tags, and key facts (dates, place kind, group kind, etc.).
- **CrossPageNav** links (map/graph/wiki) — shown when `currentPage` prop is set; excludes the current page.
- **"Read online"** external link — links to the source/work URL. Hidden when viewing a work or source on the wiki page.

### Map Filter Banner

- For entities of kind person, group, proposition, event, or work: a banner with a **"Filter map to this [kind]"** toggle button.
- When active ("On"), the map dims all unconnected places and highlights connected ones.

### Sub-Tabs

- Only tabs with at least one item are shown.
- Available tabs: **Info**, **Timeline**, **People**, **Groups**, **Works**, **Events**, **Beliefs** (propositions), **Topics**, **Places**, **Notes**, **Mentions**.

### Info Tab

- **Scalar claims** — value claims (text, number, year, boolean) for the entity.
- **Notes** — editor notes attached directly to the entity.
- For works: shows translation notes, work type, language.
- For places: shows place kind, modern name, country, coordinates.

### Timeline Tab

- **Places** (kind=place): decade-grouped rows showing all entities present at the place, their predicate, certainty badge, and year range. Grouped by the `PlaceStateByDecade` data.
- **All other entities**: decade-grouped rows of dated claims. Shows year badge, predicate label, linked entity (with hover tooltip), and certainty badge.
- **Timeline component** auto-scrolls to the active decade.

### Relation Tabs (People / Groups / Works / Events / Beliefs / Topics)

- Lists each connected entity with: kind icon, name, predicate label(s), certainty badge.
- Hovering a row highlights the corresponding node on the Graph page (via `onHoverEntity` callback).
- Expanding a row reveals **EvidenceCard** entries for all supporting passages.
- EvidenceCard shows: role badge, passage reference (book/chapter/verse), excerpt, evidence weight, notes, "open in source" external link.
- "Open work" link in EvidenceCard is hidden when the focus entity is already a work.
- Paginated at PAGE_SIZE per page.

### Places Tab (Footprints)

- **FootprintCard** for each place where the entity has a presence footprint.
- Shows place name, predicate (reason for presence), year range, certainty.
- When no direct evidence exists, a derivation tooltip explains the inference chain (e.g., "bishop_of → place").

### Notes Tab

- Editor notes (`NoteCard`) attached directly to the entity, with Markdown rendered content and year label.

### Mentions Tab

- Editor notes that contain a `[[mention]]` link referencing this entity — deduplicated by note ID.

### Place-Specific Extras

- **Presence status chips** — colored chips for dominant polity and presence status at the current decade.
- **Timeline** shows per-decade footprint data (entities present at the place, their predicate, year range).

### Certainty Badges

- **CertaintyBadge** component — shows a colored icon (◐ probable, ○ possible, △ uncertain) with a hover tooltip. Attested claims show no badge.

---

## Right Panel (Map & Graph)

### PanelShell

- **Drag-to-resize** — drag the left border to adjust the panel width.
- **Snap-close** — dragging below a minimum width dismisses the panel.
- **Left border** — visual separator from the map/graph canvas.

### Map Right Panel Tabs

When no entity is selected, the right panel shows a tabbed list view:
- **Places** — filterable list of all places at the current decade. Includes local place kind and Christian-only filters (independent of the left panel filters).
- **Groups** — filterable list of all groups. Shows active map filter highlight.
- **People** — searchable list of all people.
- **Propositions** — searchable list of all doctrinal propositions.
- **Events** — searchable list of historical events.
- **Works** — searchable list of canonical works.
- **Essays** — list of editorial essays with title and summary.

Each list is searchable, filterable with **FilterChips**, and paginated.

### Map Right Panel — Entity Selected

When an entity is selected, the panel replaces the list with **EntityDetail** for that entity.

### Map Right Panel — Essay Selected

Shows the **EssayView** with Content and Entities tabs, scroll-position preservation, and entity links wired to `pushSelection`.

---

## Essays

Five curated editorial essays are bundled with the app:

1. **Infant Baptism in the Early Church** — Evidence from the apostolic era through the fourth century.
2. **Did the Church Go Astray?** — Analysis of the apostasy claim through Paul, the Apostolic Fathers, and the Seven Churches.
3. **The Religion of the Apostles** — How Second Temple Jewish worship shaped early Christian practice.
4. **The Eucharist Is the Center** — From Paul's earliest account to third-century altar mosaics.
5. **Apostolic Succession and Oral Tradition** — The chain of transmission from the apostles and its role against Gnostic innovation.

- Essay body uses `[[kind:id|label]]` wiki-link syntax for inline entity references.
- All entity links open a hover tooltip and, on click, navigate to that entity's detail.
- Essays are accessible from the Wiki (Browse > Essays), the Map right panel (Essays tab), and cross-linked from the wiki.

---

## Global Search Overlay

- **Accessible from**: Wiki left panel, Map left panel, Graph left panel.
- Keyboard navigation: **↑/↓ arrow keys** cycle through results; **Enter** selects.
- Searches across: people, places, groups, works, events, propositions, sources.
- Results capped at 40, returned from `globalSearch()` utility.
- Selecting a result pushes it into the page's selection state and opens entity detail.

---

## Data Model Entities

The app works with the following entity types, all stored as canonical TSV tables in `data/sheets/`:

| Entity | Description |
|--------|-------------|
| **Place** | Geographic location (city, region, site, province, monastery, route). Has lat/lon, modern name, country. |
| **Person** | Historical individual with name, alt names, kind (apostle, bishop, theologian, etc.). |
| **Work** | Canonical literary work (epistle, gospel, treatise, etc.) with title and type. |
| **Historical Event** | Named event (martyrdom, council, baptism, etc.) with type and date range. |
| **Group** | Sect, polity, or church community (e.g., Pharisees, Roman Empire, Donatists). `is_christian` flag controls map filtering. |
| **Topic** | Doctrinal or thematic category (e.g., Sacraments, Christology). |
| **Dimension** | Sub-category within a topic. |
| **Proposition** | A specific doctrinal claim within a topic/dimension (e.g., "Baptism is necessary for salvation"). |
| **Source** | Citable edition, manuscript, or web resource — the physical instantiation of a work. |
| **Passage** | A specific locus within a source (by chapter:verse, page number, section, etc.) with an optional excerpt. |
| **Claim** | A structured assertion linking a subject entity to an object (entity, text, year, number, or boolean) via a predicate. |
| **Claim Evidence** | Links a claim to a passage, with a role (supports/opposes/contextualizes/mentions), support_aspect, assertion_mode, weight, and optional notes. |
| **Claim Review Event** | Append-only review history entry (event_type, actor, timestamp, note). |
| **Claim Review** | One review record per claim with status (approved/pending/disputed), reviewer, confidence, and notes. |
| **Editor Note** | Free-form Markdown note attached to an entity or claim. |

### Derived Tables

These are computed by `validate_canonical_data.py` and bundled with the app:

| Derived Table | Description |
|---------------|-------------|
| **DerivedEdge** | All derived relationship paths (direct and multi-hop chains) with edge_id, path_text, supporting_claim_ids, and certainty. |
| **EntityPlaceFootprint** | Where each entity was active, derived from claims; references derived_edge_id. |
| **PlaceStateByDecade** | Presence status, dominant polity, and group summary for each place at each decade. |
| **PropositionPlacePresence** | Stance (affirms/opposes/mixed) of each place with respect to each proposition; references derived_edge_ids. |
| **NoteMention** | Cross-reference table of all `[[entity]]` links found in editor notes and markdown files. |

### Certainty Levels

- **attested** — directly evidenced by primary sources.
- **probable** — strongly inferred; most scholars agree.
- **possible** — plausible but disputed.
- **claimed_tradition** — later tradition attributes this, but no contemporary evidence.
- **legendary** — legendary or hagiographic account.
- **unknown** — cannot assess certainty.

### Presence Statuses

- **attested** — confirmed historical presence.
- **probable** — likely presence based on inference.
- **claimed** — asserted but not confirmed.
- **suppressed** — presence suppressed or eliminated.
- **unknown** — no information.
