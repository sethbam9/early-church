# PRD Quality Review — Master Claim Verifier

*Reviewed 2026-07-01 against `.claude/skills/bmad-prd/assets/prd-validation-checklist.md`. Calibration: brownfield, internal single-operator tool, chain-top (feeds architecture and epics/stories), produced in an autonomous run with assumptions tagged. Brownfield code references were spot-checked against the repo.*

## Overall verdict

This PRD holds up under adversarial reading: it has a real thesis ("curation throughput is bounded by how fast a flagged claim can be found, understood, and handed to the fix loop"), every FR carries testable consequences with numeric bounds, and its brownfield claims verify against the repo with near-exact precision (dataset counts, line numbers, type shapes, and duplicated-renderer claims all check out). What's at risk is small and specific: FR-5's View State serialization list contradicts its own consequence about page reproduction, and SM-3's "the two legacy surfaces are one" depends on a cleanup §6.2 explicitly defers past MVP — both one-sentence fixes, but both sit on the PRD's load-bearing features. Ready to feed architecture once the §8/§9 confirmations happen, which the PRD itself says plainly.

## Decision-readiness — strong

Decisions are stated as decisions, with the losing side preserved. FR-8's deferral out of MVP (§6.2) names both the reason ("touches format conventions worth a confirmation") and the cost (`[NOTE FOR PM]` "Emotionally load-bearing for the AI-batch workflow; revisit first after MVP"). Passage-excerpt search is deferred with an actual cost argument ("roughly doubles the searchable text volume for a use case not yet demonstrated", §4.2 FR-4 note). The addendum's Rejected Alternatives section is the strongest decision content in the package: in-app review writing is rejected with the real trade-off spelled out ("writes would either be fake (localStorage divergence from the TSV source of truth) or require infrastructure the project deliberately avoids"), and the table-library question is honestly parked "for the architect" with the exact trade (virtualization + column management vs. bundle weight, tied to SM-C1 and Open Question 4) rather than smoothed to neutral.

Open Questions are genuinely open — OQ1 (Verifier home) contradicts the §4.1 assumption on purpose and says which FR it decides; OQ4 proposes a threshold without pretending it's settled. The §9 global disclosure ("The single operator (Seth) has not yet confirmed scope choices; §8 lists everything that should be confirmed before epics") is exactly the honesty an autonomous-run PRD owes its reader. Counter-metrics SM-C1/SM-C2 name the tensions (search speed vs. public bundle; consolidation vs. smearing complexity into wiki Browse) instead of claiming everything balances.

No findings.

## Substance over theater — strong

The inverse of furniture. There are no personas — just the one operator, named, in three journeys that each earn their place (UJ-1 even carries a specific edge case that becomes an FR-9 consequence). The NFRs are the opposite of boilerplate: "filter/search/sort interactions < 100–150 ms at 5,000 Active Claims," "no interaction may trigger a full re-parse of the dataset," and a data-integrity NFR that names the exact as-built landmine it neutralizes ("the deep-dive's `AuditPage.tsx:571` gotcha becomes a handled state" — verified: that line contains the non-null assertion `dataStore.claims.getById(cid)!` exactly as described). The Vision could not be swapped into another PRD; its thesis sentence is falsifiable and drives §4's structure. No differentiation/innovation section exists, correctly, for an internal tool.

No findings.

## Strategic coherence — strong

The thesis is stated, bolded, and then actually used: §4.1 = understand (one surface, inspector in place), §4.2 = find (filters + search), §4.3–4.4 = hand-off (URL View State, export), §4.5 = hand-off within the read-only boundary. "so the Verifier optimizes find → understand → hand-off, and deliberately does nothing else" (§1) is honored by the Non-Goals (no analytics, no mutation, no mobile). Prioritization follows the thesis, not ease: FR-8 — probably the easiest FR in the document — is deferred because it's the one that touches format conventions needing confirmation.

Success Metrics validate the thesis rather than measuring activity: SM-1 (time-to-claim) tests "find," SM-2 (100% URL reproducibility) tests "hand-off," SM-4 (one real AI batch session completes without missing data) is an end-to-end thesis test, and SM-3 makes the consolidation itself verifiable "against the deep-dive's consolidation map." Counter-metrics are present and product-specific. MVP scope kind is coherent (problem-solving/consolidation).

No findings.

## Done-ness clarity — strong

Every FR has an explicit "Consequences (testable)" block, and most consequences are genuinely verifiable: FR-1's "the row count shown in the table, the chip counts, and the stats bar derive from the same computation and are equal"; FR-3's weight tiers ("high ≥0.7 / medium 0.4–0.7 / low <0.4 / unscored") match the code's `WEIGHT_FILTER_OPTIONS` constants exactly; FR-7's "Exported row count equals the on-screen filtered total (not the current page)" preempts the classic export bug. FR-2's "no capability regression" would normally be a red-flag phrase, but it's anchored to an enumerable field inventory in the deep-dive, which makes it checkable. The residual gaps are narrow, story-level ambiguities — but one of them is an internal contradiction on the PRD's most load-bearing feature.

### Findings
- **medium** FR-5 serialization list contradicts its own consequence (§4.3 FR-5) — The serialized set is "Every filter in FR-3, the search text, the sort column/direction, and the selected claim" — page is not listed — yet the first consequence promises "identical row set, order, page, and selected claim." A story writer must guess whether page is a URL param, derived from selection (as today's `?claimId=` behavior does), or simply not reproduced when nothing is selected. *Fix:* either add page/offset to the serialized set, or state that page is derived from selection and drop "page" from the consequence for selection-free views.
- **low** FR-4 match semantics underspecified (§4.2 FR-4) — "Any Active Claim is reachable by typing any word of its subject label" gives a floor, but case sensitivity, prefix vs. whole-word matching, and multi-term behavior (AND across terms?) are unstated; the 150 ms bound is testable but the correctness oracle isn't fully pinned. *Fix:* one sentence, e.g. "case-insensitive substring match per whitespace-separated term, all terms must match."
- **low** FR-6 "persist within the session" is ambiguous (§4.4 FR-6) — In-memory component state, `sessionStorage`, or URL? This interacts with FR-5: column visibility is excluded from View State, so a shared URL reproduces rows but not columns, while FR-7's export columns *do* follow visibility — if that exclusion is intentional (likely fine for UJ-2, since the export carries the columns), say so. *Fix:* name the persistence mechanism and add a line confirming column visibility is deliberately outside the shareable View State.

## Scope honesty — strong

The Non-Goals section does real work — each entry states the reason, and the first ("No in-app data mutation") ties to a verified architecture invariant (docs/architecture.md: "no backend, no database, and no runtime data fetching"). All four inline `[ASSUMPTION]` tags are real inferences, not decoration, and each names its escape hatch (OQ1 tracks the §4.1 routing alternative). De-scoping is done in the open: §6.2 lists six deferred items with reasons, including the honest sequencing note that wiki-table removal is "a cleanup story, not a launch blocker." Open-items density (5 OQs + 4 tagged assumptions + 2 PM notes) is appropriate for a pre-confirmation autonomous draft at solo stakes — and §9 explicitly routes them to be resolved "before epics."

One place where the honest de-scoping creates an unstated inconsistency:

### Findings
- **medium** SM-3 requires work that §6.2 defers past MVP (§7 vs §6.2) — SM-3 demands "Zero duplicated audit-filter/status/weight implementations remain … and the two legacy surfaces are one," but "Removing the wiki audit table" is out of MVP scope, gated on "after Verifier parity is verified." As written, the MVP cannot meet its own primary metric SM-3, and no evaluation horizon says when SM-3 is assessed. *Fix:* split SM-3 (MVP: zero duplicate implementations + parity; post-cleanup: surfaces are one) or state that SM-3 is evaluated after the parity cleanup story lands.

## Downstream usability — strong

This is a chain-top PRD and it behaves like one. FR-1–FR-9 are contiguous and globally numbered (FR-8 keeps its number while descoped — correct, so epic references won't shift). Every UJ names its realizing FRs, every SM names what it validates, and all cross-references resolve. Glossary terms are used verbatim and capitalized consistently (Claim, Evidence, Review, Audit Status, Computed Flag, View State, Fix Loop, Active Claims) across FRs, UJs, and SMs. The addendum is the standout downstream asset: a per-FR consolidation map naming the existing asset and the direction (e.g. FR-1 → "Extend `AuditFilter` … `AuditPage`'s local `QueueFilter` retires"), plus CSS cautions and sizing notes — an architect can source-extract from it directly.

### Findings
- **low** `flagged` and `duplicates` meta-statuses are used but not defined (§4.2 FR-3, Glossary) — FR-3 filters by "Audit Status (including `flagged` and `duplicates` meta-statuses)," but the Glossary's Audit Status entry lists only the six computed values. `duplicates` semantics live only in code (`claimAudit.ts` — `isDuplicate: (dupeMap.get(key) ?? 0) > 1`, i.e. shared subject/predicate/object key); a story writer must chase the source to write acceptance criteria. *Fix:* two Glossary lines: `flagged` = any status except approved/ok; `duplicate` = more than one Active Claim sharing the same subject/predicate/object key.

## Shape fit — strong

The shape matches the product on every axis the rubric names. Internal tool, single operator → capability-spec shape, journeys explicitly "kept light by design" (§2.3) with one named protagonist, SMs declared "operational metrics, self-assessed" (§7). Chain-top → the traceability apparatus (global FR numbers, Glossary anchoring, PRD/addendum split) is present and earns its weight. Brownfield → existing behavior is explicitly distinguished from new requirements: FR-9 says outright it "restates existing behavior as a requirement so consolidation cannot silently drop it," FR-2 marks the inspector as "reuse, don't rebuild," and the addendum maps every FR to its existing asset.

Brownfield accuracy spot-check (the calibration-critical dimension) is near-exact. Verified against the repo: all four referenced docs exist; dataset counts are exact (2,153 Active Claims — all 2,153 rows in `claims.tsv` are `claim_status = active`; 2,217 evidence rows; 1,541 derived edges; 547 passages; 25 predicate types); `Wiki.module.css` is exactly 471 LOC; `AuditFilter` has exactly the claimed 9 axes; `AuditPage.tsx:571` contains the claimed non-null assertion at that exact line; `WeightBar` (AuditPage.tsx:47) vs `WeightCell` (AuditView.tsx:37) duplication is real; the divergent-filter claim is real (`useAuditData`'s `AuditFilter` is consumed only by the wiki's `AuditView`, while `AuditPage` runs its own narrower `QueueFilter`, which lacks `WEIGHT_TENSION` and `duplicates`); `_auditCache` never invalidates; the `/` search shortcut exists (`GlobalSearchOverlay.tsx:34`); `npm run data:validate` exists; the motivating todo is `scripts/todo.md` item 2. Two small drifts:

### Findings
- **low** OQ3 misstates current reviewer ids (§8 OQ3) — "reviewer ids are currently a small fixed set (`cascade-audit-v2`, `cascade-curator`, …)": in the review sheets the set is exactly one — `cascade-audit-v2` is the only value in `claim_reviews.tsv` `reviewer_id` and `claim_review_events.tsv` `actor_id`. `cascade-curator` appears only as `created_by` in `claims.tsv` (34 rows) and in `editor_notes.tsv`. The "…" overstates the set, and it leaves FR-3's "reviewer" filter semantics ambiguous (reviewer_id only, or also created_by?). *Fix:* correct the example set and pin which field(s) the reviewer filter reads.
- **low** Addendum overstates today's URL sync (Consolidation map, FR-5 row) — "`AuditPage.tsx:130-160` already syncs `claimId/edgeId/filter` via `replaceState`": the write-back effect (lines ~129–136) serializes only `claimId` and `filter`; `edgeId` is read from the URL but never written back, so an edge-focused view's URL degrades to `?claimId=` today. Relevant because FR-5 says to "generalize the pattern into the hook" — the pattern as-built has a hole the generalization must fill, not copy. *Fix:* adjust the row to "reads claimId/edgeId/filter; writes back claimId/filter — edge focus does not currently round-trip."

## Mechanical notes

- **Assumptions Index roundtrip:** clean. All four inline `[ASSUMPTION]` tags (§4.1 route, §4.2 AND-only, §4.2 FR-3 growth bound, §4.5 FR-8 scaffold) appear in §9 with matching locations. §9's fifth entry ("Global — this PRD was produced in an autonomous run…") has no inline counterpart by design — it's a meta-disclosure, and a good one.
- **ID continuity:** FR-1–FR-9 contiguous, UJ-1–UJ-3, SM-1–SM-4 + SM-C1/C2 — no gaps or duplicates. All `Realizes`/`Realized by`/`Validates`/`Decides` cross-references resolve, including FR-9's pointer to the "UJ-1 edge case."
- **Cross-doc links:** the `../../../../docs/*.md` relative links in §0 and §3 resolve correctly from the PRD's directory to the repo's `docs/`.
- **Glossary drift:** minimal. Defined terms hold their capitalization throughout; UJ-1's informal "his filter state" (lowercase) is journey prose, not drift. `flagged`/`duplicates` gap covered as a finding above.
- **Quotation drift:** §4.2 presents the motivating todo as a quote — *"robust, filterable across attributes"* — but `scripts/todo.md` line 4 reads "super robust for filters across attributes etc … Very searchable ideally." Faithful paraphrase, misleading quote marks. Cosmetic.
- **UJ protagonists:** all three UJs name the operator (Seth) and carry context inline. No floating UJs.
- **Required sections:** all present for the agreed stakes/type (vision, target user, glossary, FRs with consequences, non-goals, MVP scope, SMs with counter-metrics, cross-cutting NFRs, open questions, assumptions index) plus a separated technical addendum.
