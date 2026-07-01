# Addendum — Master Claim Verifier

Technical depth and rejected-alternative rationale supporting [prd.md](./prd.md). Downstream owners: architecture / story creation. Primary source: [docs/deep-dive-audit-claim-verifier.md](../../../../docs/deep-dive-audit-claim-verifier.md) (authoritative as-built analysis — read it before implementing).

## Consolidation implementation map (from the deep-dive)

| PRD requirement | Existing asset | Direction |
|---|---|---|
| FR-1 single model | `hooks/useAuditData.ts` (`AuditFilter`, 9 axes) + `utils/claimAudit.ts` (`getAuditRows` cache) | Extend `AuditFilter` (year range, specific-entity, reviewer, multi-flag); `AuditPage`'s local `QueueFilter` retires |
| FR-1 renderer dedupe | `WeightBar` (AuditPage) vs `WeightCell` (AuditView); duplicated status-chip builders | Extract shared components; serve chips from `useAuditData.statusChips` |
| FR-2 inspector | AuditPage center + right panes (richest detail in the app) | Reuse as the detail pane of the consolidated screen; `ClaimDetailPanel` stays for wiki claim contexts |
| FR-3 predicate dropdown | `predicate_types.tsv` registry (25 rows) via `dataStore.predicateTypes` | Enumerate; drop substring input |
| FR-3 precompute | role/assertion filters currently rescan `claimEvidence.getForClaim` per row per filter change (O(rows·evidence)) | Add `rolesPresent: Set`, `assertionModesPresent: Set`, `reviewerIds`, year keys to `ClaimAuditRow` in `getAuditRows` |
| FR-5 URL state | `AuditPage.tsx:130-160` syncs `claimId/filter` via `replaceState`; `edgeId` is read on entry but never written back | Generalize the pattern into the hook; flat params (`?status=…&flag=a,b&sort=weight-desc&q=…`); keep legacy params as aliases |
| FR-6 tri-state sort | `useAuditData.toggleSort` (desc→asc→default) | Keep; null-sink behavior on asc is intentional — preserve |
| FR-7 export | none | Client-side Blob + anchor download; TSV; visible columns + `claim_id` |
| NFR stale-edge tolerance | `AuditPage.tsx:571` non-null assertion (`dataStore.claims.getById(cid)!`) throws on stale derived edges | Render fallback row ("claim not found — regenerate derived tables") |

## Component/CSS cautions

- `Wiki.module.css` (471 LOC) is shared by ClaimsPanel/ClaimRow/AuditView/ClaimDetailPanel — renaming classes there touches non-audit components; prefer a new `Verifier.module.css` for the consolidated screen.
- Audit palettes are hardcoded hex in both CSS modules; migrate to `tokens.css` custom properties during the rebuild (pure DOM — no Leaflet duplication constraint here).
- `_auditCache` never invalidates by design (static data); any new precomputed fields inherit that assumption.

## Rejected alternatives (rationale preserved)

- **In-app review writing (approve/dispute buttons).** Rejected for v1: the deployed site is a static bundle with no backend; writes would either be fake (localStorage divergence from the TSV source of truth) or require infrastructure the project deliberately avoids. The Fix Loop (TSV + validator + commit) stays authoritative. FR-8's clipboard scaffold is the maximal assist inside the invariant. A future local-dev-only write mode (Vite middleware writing to `data/sheets/`) was considered and parked — real complexity, unclear payoff while AI batch sessions handle bulk edits.
- **Server/worker-side search index.** Rejected: dataset is small (2–5k claims); in-memory precompute meets the 100–150 ms bounds without shipping infra.
- **Adopting a table library (TanStack, AG Grid).** Parked for the architect: current hand-rolled table is ~190 LOC and adequate; a library buys virtualization + column management but adds bundle weight (SM-C1). Decide at architecture time against Open Question 4.
- **Query-string compression (lz-string) for View State.** Parked: flat params are debuggable and the filter count is modest; revisit only if URLs exceed practical limits.

## Sizing notes

Dataset today: 2,153 Active Claims · 2,217 Evidence rows · 1,541 derived edges. Filter pipeline target of 5,000 claims leaves ~2.3× headroom. Full-text search corpus (labels + ids + values) ≈ a few hundred KB — precomputable at `getAuditRows` time without measurable startup cost; excerpt search (Open Question 2) would add ~547 passages of prose and is the first thing that might justify a real index.
