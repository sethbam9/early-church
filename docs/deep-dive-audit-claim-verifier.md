# Audit / Claim-Verifier Subsystem — Deep Dive

**Generated:** 2026-07-01 · **Workflow:** `document-project` deep-dive (exhaustive) · **Scope:** the claim-audit UI and its data layer
**Files analyzed:** 7 (5 TS/TSX fully line-read + 2 CSS modules) · **LOC:** 2,193
**Why this area:** `scripts/todo.md` names it — *"make the table in data audit the master claim verifier: robust, filterable across attributes, highly searchable."* This document is the implementation-ready map for that work.

## Overview

The audit subsystem grades every **active** claim by evidence and review state and exposes it in **two parallel, partially-duplicated UIs**:

1. **`/audit` — `AuditPage`** (3 panes): filter-chip claim queue → exhaustive claim/evidence field dump → review history + derivation trails. Deep-linkable (`?claimId=`, `?edgeId=`, `?filter=`).
2. **Wiki audit mode — `AuditView`** (inside `/wiki`): the sortable/filterable **table** the todo targets, backed by the `useAuditData` hook; clicking a row opens `ClaimDetailPanel` on the right.

Both sit on one shared computation layer: `utils/claimAudit.ts` (`getAuditRows()` module cache). **The two UIs have divergent filter models and duplicated renderers** — the central finding for the master-verifier effort (see [Consolidation Map](#consolidation-map-for-the-master-claim-verifier)).

## Complete File Inventory

### `src/utils/claimAudit.ts` — 140 LOC · pure logic + module cache

The single source of audit truth. No React.

**Exports:**
- `ClaimAuditStatus` = `"no-evidence" | "unreviewed" | "disputed" | "needs-revision" | "approved" | "ok"`
- `getSourceTier(sourceKind): "tier_1"|"tier_2"|"tier_3"` (`:6-10`) — primary_text/inscription → T1; modern_book/journal_article/reference_work → T2; else T3.
- `computeAvgWeight(evidence): number|null` (`:12-16`) — mean over **scored `supports`** rows only; null if none.
- `COMPUTED_FLAG_INFO` (`:18-24`) — label + severity (red/orange/yellow) for the 5 computed flags.
- `getComputedFlags(claim, evidence): string[]` (`:26-53`) — order-sensitive: returns `[]` when there is **no evidence at all** (status covers that case); `NO_SUPPORTS` short-circuits; then `UNSCORED_WEIGHT` (any supports row without weight), `PARAPHRASE_RISK` (excerpt starts `"Paraphrase:"` ∧ aspect `whole_claim` ∧ mode `explicit`), `TERTIARY_ONLY` (every supports passage resolves to a T3-or-missing source), `WEIGHT_TENSION` (avg < 0.5 with certainty `attested`, or avg ≥ 0.9 with certainty `possible`).
- `getClaimAuditStatus(claim): ClaimAuditStatus` (`:55-64`) — precedence: no-evidence → unreviewed → disputed → needs-revision → approved (all rows approved) → ok.
- `getClaimBorderClass(status)` (`:66-75`) — maps status → `borderRed|borderOrange|borderGreen|""` CSS keys.
- `ClaimAuditRow` (`:77-91`) — `{claim, status, evidenceCount, reviewCount, subjectLabel, objectLabel, isDuplicate, yearLabel, yearSort, latestReviewAt, avgWeight, hasUnscoredSupports, computedFlags}`.
- `getAuditRows(): ClaimAuditRow[]` (`:95-140`) — filters `claims.getAll()` to `claim_status === "active"`, builds a duplicate map keyed `subject|predicate|object`, precomputes labels/year sort keys (`value_year` wins over `year_start–year_end`)/latest review date/avg weight/flags. **Cached forever in module-level `_auditCache`** (`:93`) — correct because data is immutable per build.

**Contributor note:** every flag/status/tier definition the UIs display lives here; extend *here first*, then render. `dataStore` lookups (`passages.getById`, `sources.getById`, `claimEvidence/claimReviews.getForClaim`) are Map-backed O(1).
**Used by:** `AuditPage`, `useAuditData` (→ `AuditView`), and outside scope: `hooks/useClaimsData.ts` (wiki claims-panel stats), `components/wiki/ClaimRow.tsx` (border class).

### `src/hooks/useAuditData.ts` — 191 LOC · the table's state machine

**Exports:** `AuditFilter` type (9 axes: status incl. `flagged`/`duplicates` meta-statuses, entityType, predicate substring, certainty, free search, evidence role, assertion mode, weight tier, computed flag), `AuditSortCol` (11 columns), `AuditSortDir`, option constants (`AUDIT_EVIDENCE_ROLES`, `ASSERTION_MODE_OPTIONS`, `WEIGHT_FILTER_OPTIONS`, `FLAG_FILTER_OPTIONS`), `useAuditData()`.

**Behavior:**
- `toggleSort` cycles desc → asc → default per column (`:62-67`); `setSortColDir` for the dropdown.
- `stats` single pass over all rows (`:75-86`): total/noEv/unrev/disp/appr/needsRev/dupes.
- `filtered` (`:88-134`) applies the 9 axes in sequence. Text search matches **subjectLabel/objectLabel/claim_id only** (not predicate, not value text beyond objectLabel). `roleFilter`/`assertionModeFilter` re-fetch evidence per row inside the filter (`:104-115`) — O(rows·evidence) per keystroke-change; acceptable at 2,153 rows, first thing to precompute if the dataset grows.
- `sorted` (`:136-170`): stable copy-sort; null years/weights always sink to the bottom regardless of direction (`cmp = 1` for null on `asc` too — intentional-looking; preserve or fix knowingly).
- Pagination via `usePaginatedList(sorted, 50)`; `statusChips` array pre-labeled with counts (`:174-183`).

**State:** all `useState` local to the hook instance — **none of it syncs to the URL** (see gaps).
**Used by:** `AuditView` only.

### `src/components/wiki/AuditView.tsx` — 190 LOC · the table renderer

Props: `{onSelectEntity, onSelectClaim, selectedClaimId}` (WikiPage wires these to selection + `ClaimDetailPanel`).
Renders: stats bar → status-chip row → 6 `DropdownSelect`s (entity type from `ENTITY_TABS`, certainty from `CERTAINTY_OPTIONS`, role, assertion, weight, flag) → 2 `SearchInput`s (entities, predicate) + sort dropdown (11 options, `col-dir` string encoding split on **last** dash to survive `needs-revision`-style keys `:129-137`) → clickable header row (per-column `toggleSort` with arrow icons) → rows.
Row anatomy (`:155-184`): border class by status; dupe styling + `Flag` icon; subject/object as `EntityLink` (with `stopPropagation` so entity clicks don't select the row); `InfoIcon` deep-links to `/audit?claimId=`; year/certainty/ev/rev/weight/status columns with per-value CSS classes (`CERT_CLS`, `STATUS_CLS`, `COL_CLS` lookup maps with `?? ''` fallbacks).
`WeightCell` (`:37-41`) duplicates AuditPage's `WeightBar` thresholds (≥0.7 high, ≥0.4 mid) as text-only rendering.

### `src/pages/AuditPage.tsx` — 595 LOC · the standalone inspector

Local sub-components (not exported): `WeightBar` (`:47-57`, 32px bar + number), `SourceTierBadge` (`:59-65`), `AssertionBadge` (`:67-77`), `StatusProgressBar` (`:79-101`, stacked % segments over all rows), `EntityRef` (`:104-113`, hover-wrapped kind-icon button), helpers `claimSentence` (`:23-31`), `statusChipCls`, `reviewBadgeCls`.

**State & URL contract:** `selectedId`, `derivationEdgeId`, `filter` (own `QueueFilter` union of 10 chips — 7 status-ish + 3 flag filters), `search`, `page`. Writes `?claimId=&filter=` via `replaceState` (`:130-136`); reads `?edgeId=` → focuses a derivation trail and auto-selects its first supporting claim, `?claimId=` → selects + jumps to the right page (`:138-160`). `PAGE_SIZE = 50` (local const, independent of shared `Pagination`'s default).

**Panes:** queue (search matches `claimSentence` or claim_id; chips with precomputed counts `:204-215`) → center (claim identity card; full field grid incl. polymorphic object rendering `:307-317`; per-evidence **Evidence Fields** + **Passage Fields** sections dumping every column incl. excerpt/override/urls with tier badge) → right (computed flags with severity colors, review snapshot, review history events, focused derivation trail with sibling-claim buttons, all derived edges supported by this claim `:188-193` — a **full scan** of `derivedEdges.getAll()` per selection, fine at 1.5k edges).

**Gotcha (`:571`):** the sibling-claim button renders `claimSentence(allRows.find(...) ?? { claim: dataStore.claims.getById(cid)! } as ClaimAuditRow)`. If a derived edge ever references a claim that is **not active and not present** (stale `derived_edges.tsv`), `getById` returns `undefined` and this throws. Safe today only because derivation runs on active claims; regenerate derived tables with the validator to keep the invariant.

### `src/components/wiki/ClaimDetailPanel.tsx` — 100 LOC · wiki right-pane inspector

Pure lookup-and-render for one `claimId`: entities row (subject → predicate → object/value), all-fields grid (conditional per `object_mode` `:27-30`), `EvidenceCard` list (`hideWorkLink` when `focusKind==="work"`), reviews with `REVIEW_META` icons + `formatReviewDate`. Returns `null` for unknown ids. No local state — parent owns selection.

### CSS modules

- `src/pages/AuditPage.module.css` — 505 LOC: 3-pane grid, chip/flag/severity palettes, weight bars, tier badges, progress segments. All colors hardcoded hex (theming caveat applies).
- `src/components/wiki/Wiki.module.css` — 471 LOC: **shared by all four wiki components**; audit table column widths (`auditCol*`), status/certainty value classes, detail-panel styles. Renaming classes here touches ClaimsPanel/ClaimRow too.

## Dependency Graph

```
App.tsx ──▶ AuditPage.tsx ─────────┬──▶ utils/claimAudit.ts ──▶ data/dataStore.ts
WikiPage.tsx ─▶ AuditView.tsx ──▶ hooks/useAuditData.ts ──┤         (types.ts)
WikiPage.tsx ─▶ ClaimDetailPanel.tsx ──▶ dataStore only    │
outside scope: useClaimsData.ts, ClaimRow.tsx ─────────────┘
shared UI consumed: SearchInput, Pagination, Chip, DropdownSelect, EntityLink,
  EntityHoverCard, CertaintyBadge, DerivationChain, PassageReference, InfoIcon,
  EvidenceCard, entityConstants, icons
```

- **Entry points (in scope):** `AuditPage` (from App), `AuditView` + `ClaimDetailPanel` (from WikiPage).
- **Leaf:** `claimAudit.ts`. **No circular dependencies.**
- **Tables read:** claims, claim_evidence, claim_reviews, claim_review_events, passages, sources, derived_edges (all via dataStore indexes; zero network I/O).

## Consolidation Map (for the "master claim verifier")

The duplication you'd unify, side by side:

| Concern | AuditPage (`/audit`) | AuditView (wiki) | Master-verifier direction |
|---|---|---|---|
| Filter model | local `QueueFilter` (10 flat chips) | `AuditFilter` (9 orthogonal axes) | Adopt `AuditFilter`; add the missing `no-evidence`-style chips as status values (already present) |
| Search | claim sentence + id | subject/object labels + id; separate predicate box | Merge: index sentence + labels + predicate + value text |
| Sort | none (cache order) | 11 columns, tri-state + dropdown | Keep AuditView's |
| Weight render | `WeightBar` (bar+number) | `WeightCell` (number only) | Extract one shared component |
| Status chips | hand-built `queueFilters` | `statusChips` from hook | Serve both from `useAuditData` |
| URL state | `?claimId&edgeId&filter` synced | **none** | Move URL sync into `useAuditData` so table state is shareable |
| Detail view | center+right panes (richest) | `ClaimDetailPanel` (compact) | Keep both; table row → panel, "open in /audit" via existing `InfoIcon` |
| Pagination | local slice, `PAGE_SIZE=50` | `usePaginatedList(sorted, 50)` | Use the hook |

**Missing capabilities vs. the todo's "filterable across attributes, highly searchable":** year-range filter, specific-subject/object entity picker (only *type* exists), multi-flag selection, predicate dropdown (registry has just 25 — no need for substring typing), column visibility, CSV/TSV export of the filtered set, and URL-shareable table state.

## Contributor Checklist

- **Risks & gotchas:** `_auditCache` assumes immutable data (never invalidated); `AuditPage.tsx:571` non-null assertion can throw on stale derived edges; `Wiki.module.css` is shared across wiki components; sort's null-handling always sinks nulls; role/assertion filters re-scan evidence per row; all audit colors are hardcoded hex (dark-theme tokens don't reach them).
- **Pre-change verification:** `npm run data:validate` (fresh derived tables) → `npm run build` (tsc) → manually exercise `/audit?claimId=…`, `/audit?edgeId=…`, `/audit?filter=flagged`, and wiki Browse↔Audit toggle with filters + sort + row-select.
- **Suggested tests before PR (none exist today):** unit-test `claimAudit.ts` pure functions against fixture claims/evidence (status precedence, each flag trigger, avg-weight edge cases, duplicate detection); unit-test `useAuditData` filter/sort combinations; smoke E2E for the two deep-link params.

## Modification Guidance

- **Add a new computed flag:** implement in `getComputedFlags` + `COMPUTED_FLAG_INFO` (`claimAudit.ts`), extend `AuditFilter["flagFilter"]` + `FLAG_FILTER_OPTIONS` (`useAuditData.ts`), and (if the queue should chip it) `QueueFilter` in `AuditPage.tsx`. Colors: severity classes exist in both CSS modules.
- **Add a filter axis to the table:** extend `AuditFilter` + default state + one block in `filtered` + a control in `AuditView`'s filter rows. Precompute the needed per-row value in `getAuditRows` rather than scanning evidence in the filter.
- **Make table state shareable:** mirror `AuditPage`'s `replaceState` pattern (`AuditPage.tsx:130-136`) inside `useAuditData`; parse on mount like `AuditPage.tsx:138-160`. Keep params flat (`?status=…&flag=…&sort=weight-desc`).
- **Deprecate the duplication:** `AuditPage`'s queue could become `AuditView` with a `variant="queue"` prop once filters converge — the center/right inspector panes are the only genuinely unique parts of `/audit`.

---

_Generated by `document-project` (deep-dive mode) · Base documentation: [index.md](./index.md) · Scan date: 2026-07-01 · Analysis: exhaustive (every line of every in-scope TS file read)_
