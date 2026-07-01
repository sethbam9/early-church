---
title: Master Claim Verifier
status: final
created: 2026-07-01
updated: 2026-07-01
---

# PRD: Master Claim Verifier

*Working title — confirm.*

## 0. Document Purpose

This PRD defines the consolidation and completion of the Early Christianity Atlas audit surfaces into a single **Verifier** — the authoritative screen for inspecting, filtering, and triaging every claim in the dataset. It is written for the project owner (single operator) and for downstream AI-assisted workflows (architecture, epics/stories, implementation agents). It builds on, and does not duplicate, three existing documents: [docs/index.md](../../../../docs/index.md) (project documentation index), [docs/deep-dive-audit-claim-verifier.md](../../../../docs/deep-dive-audit-claim-verifier.md) (exhaustive as-built analysis of the audit subsystem, including the consolidation map this PRD assumes), and [docs/architecture.md](../../../../docs/architecture.md) (system invariants all FRs must respect). Vocabulary is Glossary-anchored; FRs are globally numbered; inferences are tagged `[ASSUMPTION]` inline and indexed in §9.

## 1. Vision

The Atlas is an evidence-first research tool: every fact on the map, graph, and wiki is an auditable claim with passages, weights, reviews, and derivation chains behind it. The dataset just came through a 176-batch audit campaign, and the curation loop going forward is human + AI batch work against the TSV pipeline. What that loop lacks is a single authoritative surface to *see the state of the evidence*: today audit capability is split across two partially-duplicated UIs (the `/audit` inspector and the wiki audit table) with divergent filters, divergent search, and no shareable table state.

The Master Claim Verifier makes one surface the source of truth for claim quality: every attribute of a claim filterable, every claim findable in seconds, every view reproducible from a URL, and every triage result exportable back into the data-pipeline loop. The thesis: **curation throughput is bounded by how fast a flagged claim can be found, understood, and handed to the fix loop** — so the Verifier optimizes find → understand → hand-off, and deliberately does nothing else.

## 2. Target User

### 2.1 Jobs To Be Done

- As the dataset curator, find any claim (or set of claims) by any attribute in seconds, without remembering which of two screens has the filter I need.
- Triage validator/audit output: work through flagged claims (weight tension, paraphrase risk, tertiary-only, unscored, no-evidence, disputed, needs-revision) until the queue is empty.
- Hand a precise work set to an AI batch session: a URL that reproduces my exact filtered view, and an export the agent can process against the TSV sheets.
- Trust the numbers: the counts the Verifier shows must be the same counts everywhere in the app.

### 2.2 Non-Users (v1)

Public site visitors. The Verifier ships in the deployed app (it is read-only), but it is designed for the curator; no onboarding, marketing surface, or simplified public mode is in scope.

### 2.3 Key User Journeys

*Internal tool, single operator — journeys kept light by design.*

- **UJ-1. Seth burns down a flag queue after an AI batch lands.** Seth, the dataset curator, merges an AI-assisted data batch and runs the validator. He opens the Verifier, filters status = needs-revision plus flag = WEIGHT_TENSION, sorts by evidence weight ascending, and works the rows top-down — each row opens the full inspector (claim structure, evidence fields, passage excerpts, review history, derivation chains) without leaving the screen. When the filtered count reaches zero, the batch is verified. **Edge case:** a row's derivation chain references a sibling claim; clicking it re-anchors the inspector to that claim without losing his filter state.
- **UJ-2. Seth hands a work set to an AI session.** Filtering claims to certainty = attested with flag = TERTIARY_ONLY, Seth copies the URL into an AI agent prompt ("fix these") and exports the filtered set as TSV so the agent can cross-reference `claim_id`s against `data/sheets/`. The agent's session sees exactly the rows he saw. Realized by FR-5, FR-7.
- **UJ-3. Seth follows a suspicious map dot to its evidence.** From a place's derivation tooltip on the map, Seth clicks the derivation icon and lands in the Verifier with that edge's trail focused and its first supporting claim selected — the existing `/audit?edgeId=` behavior, preserved through consolidation (FR-2, FR-9).

## 3. Glossary

*Terms are used verbatim throughout; the data-layer definitions trace to [docs/data-models.md](../../../../docs/data-models.md).*

- **Claim** — one subject→predicate→object row in `claims.tsv`. Only **Active Claims** (`claim_status = active`) appear in the Verifier.
- **Evidence** — a `claim_evidence.tsv` row linking a Claim to a passage with role (supports/opposes/contextualizes/mentions), support aspect, assertion mode, and **Weight** (0–1 score on a supports row).
- **Review** — the current `claim_reviews.tsv` snapshot for a Claim (exactly one per Claim); **Review Event** — one append-only `claim_review_events.tsv` history row.
- **Audit Status** — the computed rollup per Claim: `no-evidence | unreviewed | disputed | needs-revision | approved | ok` (precedence defined in `claimAudit.ts`). Two **meta-statuses** exist as filter values only, not statuses: `flagged` (any Audit Status other than `approved`/`ok`) and `duplicates` (Active Claims sharing an identical subject|predicate|object triple).
- **Computed Flag** — a client-computed quality warning on a Claim: `NO_SUPPORTS`, `UNSCORED_WEIGHT`, `PARAPHRASE_RISK`, `TERTIARY_ONLY`, `WEIGHT_TENSION`.
- **Source Tier** — T1 (primary text/inscription), T2 (modern book/journal/reference), T3 (everything else).
- **Predicate** — one of the 25 relation types registered in `predicate_types.tsv`.
- **Derivation Chain** — a derived edge plus the numbered supporting Claims that produced it.
- **Verifier** — the consolidated audit surface this PRD specifies.
- **View State** — the complete filter + search + sort + page + selection configuration of the Verifier at a moment in time. Column visibility is table ergonomics, not View State.
- **Fix Loop** — the offline curation cycle: edit `data/sheets/*.tsv` → run the validator → commit. The Verifier reads; the Fix Loop writes.

## 4. Features

### 4.1 One Verifier, one model

**Description:** Collapse the two existing audit surfaces into a single Verifier: the sortable, filterable claim table as the master list, with the existing three-pane inspector (claim structure, evidence/passage field dump, flags + reviews + Derivation Chains) as its detail view. One filter model, one set of counts, one component tree — ending the current split where `/audit` and the wiki audit table each own divergent filters and duplicated renderers. The Verifier lives at `/audit` `[ASSUMPTION: the /audit route is the Verifier's home; the wiki keeps its Browse mode and drops its separate audit table once parity is reached]`. Realizes UJ-1, UJ-3.

#### FR-1: Single audit data model

All Verifier surfaces read one shared filter/sort/stats model over Active Claims (today's `useAuditData` + `getAuditRows`), and no duplicate filter implementation remains.

**Consequences (testable):**
- For any View State, the row count shown in the table, the chip counts, and the stats bar derive from the same computation and are equal.
- The codebase contains exactly one implementation each of: status rollup, flag computation, weight rendering, status-chip source. (Today there are two of several — see deep-dive consolidation map.)

#### FR-2: Table + inspector in one screen

The curator can select any table row and see the full inspector detail (claim identity and all fields, every Evidence row with passage/source fields and Source Tier, Computed Flags with severity, Review and Review Events, Derivation Chains) without navigating away or losing View State.

**Consequences (testable):**
- Selecting a row never resets filters, sort, or page.
- Every field visible in today's `/audit` center + right panes remains reachable from a selected row (no capability regression).
- Existing deep links `/audit?claimId=…` and `/audit?edgeId=…` resolve to the equivalent Verifier state (edge focus auto-selects the first supporting claim, as today).

**Out of Scope:** redesigning the inspector's visual layout (reuse, don't rebuild).

### 4.2 Filter across every attribute

**Description:** The intent that motivated this PRD (`scripts/todo.md`): *"I want the table in data audit to be the master claim verifier. It should be super robust for filters across attributes."* Every attribute of a Claim, its Evidence, and its Review becomes a composable filter. Filters combine with AND semantics; each control shows its match count under the current combination `[ASSUMPTION: AND-only composition is sufficient for v1; OR/negation deferred]`. Realizes UJ-1, UJ-2.

#### FR-3: Attribute filter set

The curator can filter Active Claims by: Audit Status (including `flagged` and `duplicates` meta-statuses), Computed Flag (multi-select), certainty, Predicate (enumerated dropdown of the 25, not substring typing), subject/object entity *type*, specific subject/object *entity* (searchable picker), Evidence role, assertion mode, Weight tier (high ≥0.7 / medium 0.4–0.7 / low <0.4 / unscored), year range (overlap with claim `year_start–year_end` or `value_year`), and reviewer.

**Consequences (testable):**
- Each filter, applied alone against a known fixture dataset, returns exactly the rows matching its definition above.
- Any combination of filters returns the intersection; clearing one filter widens results without touching the others.
- A zero-result state is visibly distinct from a loading or error state.
- Filter recomputation completes in under 100 ms at 5,000 Active Claims on a mid-range laptop `[ASSUMPTION: dataset grows ≤2× over the next few campaigns; 2,153 today]`.

#### FR-4: Full-record search

One search input matches against: the claim sentence (subject label + predicate label + object label/value), `claim_id`, and literal values (`value_text`, `value_year`). Matching is case-insensitive substring over those fields. Search composes with active filters.

**Consequences (testable):**
- Any Active Claim is reachable by typing any word of its subject label, object label, predicate label, or its exact `claim_id`.
- Search over the full dataset returns in under 150 ms per keystroke at 5,000 Active Claims.

**Notes:** `[NOTE FOR PM]` Passage-excerpt full-text search (finding claims by quoted source text) is deferred — it roughly doubles the searchable text volume for a use case not yet demonstrated. Open Question 2.

### 4.3 Shareable, resumable View State

**Description:** A View State is a work assignment. The Verifier serializes it to the URL so a view can be bookmarked, shared into an AI agent session, or resumed after a browser restart. Realizes UJ-2.

#### FR-5: URL-encoded View State

Every filter in FR-3, the search text, the sort column/direction, the page, and the selected claim serialize to URL query parameters; opening that URL reproduces the identical view. Column visibility is deliberately excluded (see FR-6).

**Consequences (testable):**
- Copy URL → open in a new tab → identical row set, order, page, and selected claim.
- URL updates use `replaceState` (no history spam); the existing `?claimId=`, `?edgeId=`, `?filter=` parameters continue to resolve (backward compatibility).
- A cleared Verifier (no filters) produces a parameter-free URL.

### 4.4 Table ergonomics

**Description:** The table itself earns the "master" adjective: every column sortable, columns toggleable, and the filtered set exportable for the Fix Loop. Realizes UJ-1, UJ-2.

#### FR-6: Column sort and visibility

Every displayed column (subject, predicate, object, year, certainty, evidence count, review count, Weight, Audit Status, flags, updated, reviewed) is sortable (desc → asc → default tri-state) and can be shown/hidden; null values sort to the end regardless of direction.

**Consequences (testable):**
- Sorting any column twice reverses the order; a third activation restores default order.
- Hidden columns persist until the tab is closed and are reflected in the exported file (FR-7); column visibility is not part of the URL View State (a shared URL always opens with default columns).

#### FR-7: Export the filtered set

The curator can export the current filtered, sorted row set as a TSV whose columns match the visible table columns plus `claim_id`.

**Consequences (testable):**
- Exported row count equals the on-screen filtered total (not the current page).
- The file round-trips: `claim_id`s in the export resolve 1:1 against `data/sheets/claims.tsv`.

### 4.5 Fix Loop assists (read-only boundary)

**Description:** The Verifier reads; the Fix Loop writes — that boundary is architectural (static SPA, no backend; see §5). Within it, the Verifier can still shave minutes off every fix by producing pipeline-ready artifacts. Realizes UJ-2.

#### FR-8: Copy review scaffold

From any selected Claim, the curator can copy a pre-filled, tab-separated `claim_reviews.tsv` row (and optionally a `claim_review_events.tsv` row) with `claim_id`, today's date, and reviewer stub filled in, ready to paste into the sheets. `[ASSUMPTION: clipboard scaffold is the right v1 assist; generating a patch file is v2+]`

**Consequences (testable):**
- Pasting the copied scaffold into the target sheet and running `npm run data:validate` produces no *structural* errors attributable to the scaffold (column count, date format, enum values).

#### FR-9: Cross-navigation preserved

Entity references in the Verifier link onward (wiki entity view, map, graph via the existing cross-page mechanisms), and Derivation Chain members re-anchor the inspector in place. This restates existing behavior as a requirement so consolidation cannot silently drop it.

**Consequences (testable):**
- Every subject/object entity in the table and inspector is clickable and lands on that entity's wiki view.
- Clicking a sibling claim inside a Derivation Chain changes the inspector selection without altering filters (UJ-1 edge case).

## 5. Non-Goals (Explicit)

- **No in-app data mutation.** The Verifier never writes claims, evidence, or reviews. All writes go through the Fix Loop (TSV edit → validator → commit). This preserves the architecture invariant "no runtime data mutation / no backend" and keeps the deployed site trustworthy as a pure view of the committed dataset.
- **No backend, no auth, no server-side anything.** The Verifier ships inside the existing static bundle.
- **Not a replacement for the Python validator.** Computed Flags are triage hints; the validator remains the enforcement gate. Flag/status definitions must not fork from validator semantics.
- **Not a general analytics/BI surface.** No charts beyond the existing status progress bar; no aggregation pivots.
- **No mobile optimization.** Desktop-first, matching the app.

## 6. MVP Scope

### 6.1 In Scope

- FR-1 through FR-7, FR-9 (consolidated Verifier at `/audit`, full attribute filters, unified search, URL View State, sort/column control, TSV export, preserved cross-navigation).
- Dark-theme parity and keyboard operability for the new controls (§Cross-Cutting NFRs).

### 6.2 Out of Scope for MVP

- FR-8 copy review scaffold — small, but touches format conventions worth a confirmation. `[NOTE FOR PM]` Emotionally load-bearing for the AI-batch workflow; revisit first after MVP.
- Passage-excerpt full-text search (Open Question 2).
- Saved named views / view presets (URL sharing covers the core need; revisit if URLs prove unwieldy).
- OR/negation filter composition.
- Row virtualization (revisit at >5,000 Active Claims; Open Question 4).
- Removing the wiki audit table — happens only after Verifier parity is verified, as a cleanup story, not a launch blocker.

## 7. Success Metrics

*Single-operator internal tool — operational metrics, self-assessed.*

**Primary**
- **SM-1: Time-to-claim.** Any specific claim the curator can describe (by subject, object, or id) is on screen in under 10 seconds from opening the Verifier. Validates FR-3, FR-4.
- **SM-2: View reproducibility.** 100% of shared Verifier URLs reproduce the exact row set, order, and selection in a fresh session. Validates FR-5.
- **SM-3: Consolidation complete.** Zero duplicated audit-filter/status/weight implementations remain (verified against the deep-dive's consolidation map), and the Verifier covers every capability of both legacy surfaces. (Physically removing the wiki audit table is the deferred cleanup story in §6.2, not part of this metric.) Validates FR-1, FR-2.

**Secondary**
- **SM-4: Batch hand-off works end-to-end.** One real AI batch session driven from a Verifier URL + export completes without the agent needing data the export lacked. Validates FR-5, FR-7.

**Counter-metrics (do not optimize)**
- **SM-C1: Initial app load.** Bundle size and time-to-interactive for the *map* (the primary public surface) must not grow more than ~10% on account of the Verifier. Counterbalances SM-1 (no heavyweight search index shipped to every visitor).
- **SM-C2: Wiki Browse simplicity.** The wiki's browse experience gains no new chrome from this work. Counterbalances SM-3 (consolidation must simplify, not smear complexity around).

## Cross-Cutting NFRs

- **Performance:** filter/search/sort interactions < 100–150 ms at 5,000 Active Claims (per FR-3/FR-4 consequences); no interaction may trigger a full re-parse of the dataset (module-singleton dataStore is already parse-once — keep it that way).
- **Precompute over rescan:** per-row filterable values (roles present, assertion modes present, reviewer, year sort key) are precomputed once in the audit row model, not re-derived inside filter loops (today's role/assertion filters rescan evidence per row — fix during FR-1).
- **Theming:** all new UI uses `tokens.css` design tokens; the existing hardcoded-hex audit palettes get token equivalents where feasible (Leaflet-style JS duplication does not apply here — this is pure DOM). Dark theme fully supported.
- **Keyboard:** every filter control, the search input, table header sort, and row selection are operable by keyboard; `/` focuses search (matching the global pattern).
- **Data integrity:** the Verifier tolerates a stale `derived_edges.tsv` gracefully (a Derivation Chain referencing a missing claim renders a placeholder rather than crashing — the deep-dive's `AuditPage.tsx:571` gotcha becomes a handled state).

## 8. Open Questions

1. **Verifier home:** is `/audit` the right home (assumed here), or should the Verifier replace the wiki's audit tab wholesale with `/audit` redirecting? Decides FR-2's routing details.
2. **Excerpt search:** does the curator actually need to find claims by quoted passage text? If yes, it changes the search-index size calculus (SM-C1).
3. **Reviewer filter values:** `reviewer_id` currently holds a single value across the dataset (`cascade-audit-v2`; `cascade-curator` appears only as a claim `created_by`) — enumerate from data at load, or free-text?
4. **Virtualization threshold:** at what dataset size do we adopt row virtualization? (Proposed: revisit at 5,000 Active Claims.)
5. **FR-8 scaffold format:** single review row, or review + event pair by default?

## 9. Assumptions Index

- §4.1 — `/audit` is the Verifier's home; wiki drops its separate audit table after parity (Open Question 1 tracks the alternative).
- §4.2 — AND-only filter composition suffices for v1.
- §4.2 FR-3 — dataset grows ≤2× near-term; 5,000-claim performance bound is the design target.
- §4.5 FR-8 — clipboard scaffold (not patch files) is the right first Fix Loop assist.
- Global — this PRD was produced in an autonomous run: feature intent from `scripts/todo.md`, capability gaps and consolidation direction from the audit deep-dive, constraints from architecture.md. The single operator (Seth) has not yet confirmed scope choices; §8 lists everything that should be confirmed before epics.
