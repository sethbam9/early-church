# Audit Plan — Claim Audit Campaign

**Created:** 2026-03-17
**Based on:** [mid-audit-review.md](mid-audit-review.md)
**Status:** Active

---

## Overview

This plan covers four phases:

1. **Prior batch remediation** — targeted fixes for batches 1–108 already completed
2. **Remaining batch processing** — how to handle batches 109–176
3. **Post-audit cleanup** — final passes after all batches are done
4. **New data safeguards** — rules for future patristic campaign work to prevent recurrence of audit-discovered issues

The mid-audit review found that **~35% of evidence rows** needed correction, concentrated in two systemic problems:
- **Passage–claim mismatch** (34 batches): passages cited from the correct work but wrong section
- **Paraphrase quality** (22+ batches): excerpts that compress, omit, or mislocate source text

Root cause: AI-harvested data was mapped at work-level granularity, not passage-level. The audit is repairing this layer.

---

## Phase 1 — Prior Batch Remediation

### 1.1 needs_revision Claims (267 claims from batches 48–108)

These claims were flagged during Queue 1 audit but not fully resolved. They fall into four categories with different remediation paths.

#### Category A: Needs primary evidence (~100 claims)

Claims supported only by tertiary sources (Wikipedia) or sole `contextualizes` evidence.

**Action:**
1. Export list: all Queue 1 claims with `review_status=needs_revision` AND (no `supports` evidence OR only tertiary `supports` evidence).
2. Group by subject work/person.
3. For each group, harvest 1–2 fresh primary-source passages that directly support the claim.
4. Add passage + evidence rows. Re-review.
5. If no primary evidence exists, downgrade certainty to `possible` or `probable` and approve with note.

**Priority targets:**
- ~55 Roman Empire `controls_place` claims backed only by `psg-wikipedia-roman-empire-provinces`
- ~5 Marcionite/Novatianist geographic spread claims with tertiary-only support

#### Category B: Needs passage correction (~80 claims)

Claims where the evidence passage is from the correct work but wrong section.

**Action:**
1. For each claim, identify the correct passage within the same work.
2. If a suitable passage already exists in passages.tsv, repoint the evidence row.
3. If not, create a new passage with a fresh verbatim quote targeting the specific claim.
4. **Do not reuse the same passage for multiple unrelated doctrine claims** — get a fresh quote per doctrine.
5. Re-review.

#### Category C: Needs field adjustment only (~50 claims)

Claims where mode, weight, or aspect needs minor correction.

**Action:**
1. Apply the field corrections noted in the batch findings.
2. Re-review with updated timestamp.

#### Category D: Needs claim restructuring (~37 claims)

Claims where the predicate is wrong, or the claim should be split or merged.

**Action:**
1. Create the corrected claim(s).
2. Set the original to `superseded`.
3. Transfer evidence rows to the new claim.
4. Review the new claim.

### 1.2 Source URL Verification Sweep

Three wrong source URLs were discovered in batches 98–100 and retroactively fixed. A broader sweep is needed.

**Action:**
1. For every source in `sources.tsv` with `source_kind=primary_text` and a `url` field:
   - Spot-check that the URL actually points to the claimed work.
   - Pay special attention to New Advent URLs where ANF/CSEL/PG numbering can diverge.
2. Log any additional corrections to `findings.ndjson`.
3. Re-run affected evidence rows through audit.

**Priority targets:**
- All Cyprian sources (ANF vs CSEL numbering is a known trap)
- All Origen sources (multiple translation series)
- All sources with newadvent.org URLs using numeric path suffixes

### 1.3 Garbage Field Scan

Six batches found auto-generated boilerplate in evidence weight and notes fields.

**Action:**
1. Run the new P7 validator rule (see Phase 4) to detect remaining garbage notes.
2. Replace all flagged notes with substantive assessments.
3. Score any blank evidence_weight fields on mature `supports` rows.

### 1.4 Passage Fan-Out Audit

The mid-audit review identified a pattern where a single passage was cited as `supports` evidence for many unrelated doctrine claims. This is the single biggest source of WRONG_PASSAGE_FOR_CLAIM findings.

**Action:**
1. Run the new P6 validator rule (see Phase 4) to identify passages supporting 3+ distinct proposition claims.
2. For each flagged passage, evaluate whether it genuinely supports all linked claims.
3. For claims it does NOT support:
   - If possible, find a fresh passage from the same work that directly supports the specific claim.
   - If not, downgrade evidence_role to `contextualizes` or delete the evidence row.
4. **New rule going forward:** Each doctrine claim should ideally have its own dedicated passage quote, not share a generic passage with unrelated claims.

---

## Phase 2 — Remaining Batch Processing (batches 109–176)

### 2.1 Pre-Audit Checks (NEW — run before each batch)

Before starting any Queue 1 batch, perform these checks:

#### Check A: Source URL verification
For every source referenced by the batch's evidence rows:
1. Open the source URL.
2. Confirm it points to the correct work.
3. If wrong, fix it in `sources.tsv` before proceeding. Log to `findings.ndjson`.

#### Check B: Garbage field scan
For every evidence row in the batch:
1. Check `evidence_weight` is a valid decimal or blank (not prose).
2. Check `notes` for boilerplate patterns (e.g., "is a primary text directly relevant to").
3. Fix any garbage before proceeding.

#### Check C: Passage fan-out scan
For every passage referenced by the batch:
1. Count how many distinct proposition claims it supports across the dataset.
2. If a passage supports 3+ different propositions, flag it for closer inspection.
3. For each flagged passage, verify that the passage text actually supports every linked claim.

### 2.2 Batch Processing Order

Continue with Queue 1 batches in order (batch-109 through batch-176).

**Expected difficulty by subject type:**

| Batch Range | Subjects | Expected Issues | Notes |
|------------|---------|----------------|-------|
| 109–116 | Single works (Tertullian, Stromateis, etc.) | PARAPHRASE_CAP, WRONG_PASSAGE | Tertullian's many works are a cross-citation risk |
| 117–140 | Multi-person batches | WRONG_PASSAGE, cross-contamination | Passages may be cited for the wrong person |
| 141–155 | Group/place/event batches | TERTIARY_ONLY, geographic errors | Need primary evidence for geographic claims |
| 156–176 | Large 20-claim batches | Mixed | These are catch-all batches, expect heterogeneous issues |

### 2.3 Per-Batch Workflow Enhancement

In addition to the existing claim-audit.md workflow, add these steps:

1. **Step 0 (NEW):** Run pre-audit checks A, B, C above.
2. **Step 4f (NEW — Passage discipline check):** For each evidence row where `evidence_role=supports`:
   - If the passage is already supporting 2+ other proposition claims, **stop and verify** it genuinely supports this claim too.
   - If it doesn't, find a fresh passage from the same work instead.
   - Prefer one dedicated passage per doctrine claim.
3. **Step 4g (NEW — Fresh quote preference):** For doctrine claims (`work_affirms_proposition`, `person_affirms_proposition`):
   - If the only evidence is a shared passage that was not written specifically about the claimed doctrine, flag and seek a better passage.
   - A passage that mentions the doctrine incidentally is `contextualizes`, not `supports`.

### 2.4 Paraphrase Handling Enhancement

All paraphrase excerpts must follow these rules during audit:

1. **Verify against source:** Fetch the source URL and compare the paraphrase to the actual text.
2. **Cap assertion_mode:** Paraphrases cannot have `assertion_mode=explicit`. Maximum is `strong_inference`.
3. **Check locator accuracy:** Ensure the paraphrase content actually comes from the cited chapter/section, not a different part of the work.
4. **Prefer verbatim:** When a short verbatim quote would suffice, replace the paraphrase.

---

## Phase 3 — Post-Audit Cleanup

After all 176 batches are processed:

### 3.1 Evidence Weight Audit Pass

**Goal:** Every mature `supports` evidence row should have a scored `evidence_weight`.

1. Query all `claim_evidence` rows where `evidence_role=supports` AND `evidence_weight` is blank.
2. Score each using the rubric: `tier × form × aspect × mode`.
3. Validate.

### 3.2 Wikipedia Replacement Campaign

**Goal:** Replace all tertiary-only evidence with primary sources.

1. Export all claims where the only `supports` evidence comes from a `tier_3_tertiary` source.
2. Group by subject/region.
3. For each group, harvest primary-source passages.
4. Add passage + evidence rows.
5. Downgrade or delete the Wikipedia evidence rows.

**Priority targets:**
- ~55 Roman Empire `controls_place` claims
- ~5 Marcionite geographic spread claims
- ~3 Novatianist geographic claims

### 3.3 Paraphrase-to-Verbatim Upgrade Campaign

**Goal:** Replace paraphrase excerpts with verbatim quotes for the most-cited passages.

1. Query passages where `excerpt` starts with `Paraphrase:` AND the passage is cited by 3+ evidence rows.
2. For each, fetch the source and extract a verbatim quote.
3. Replace the paraphrase excerpt.
4. Remove paraphrase caps from affected evidence rows (mode can become `explicit` where warranted).

### 3.4 Cross-Batch Consistency Check

**Goal:** Claims about the same passage from different batches should be consistent.

1. For each high-reuse passage (from `high_reuse_watchlist.tsv`):
   - Collect all evidence rows citing it.
   - Verify that evidence_role, support_aspect, and assertion_mode are consistent across claims.
   - Resolve any contradictions.

### 3.5 Orphan Cleanup

1. Identify passages not referenced by any evidence row. Delete or archive.
2. Identify sources not referenced by any passage. Delete or archive.
3. Identify entities (people, places, groups) not referenced by any active claim. Review for deletion.

### 3.6 Final Validation and Statistics

1. Run full validator: `python3 scripts/validate_canonical_data.py --data-dir data --scan-root data/sheets --check-evidence`
2. Generate final audit statistics.
3. Update `mid-audit-review.md` → `final-audit-review.md`.

---

## Phase 4 — New Data Safeguards for Future Campaigns

### 4.1 Passage Discipline Rules (NEW)

These rules apply to all future data ingestion, including continued patristic campaign work.

#### Rule P-REUSE: Minimize passage fan-out

> A passage should NOT be pointed to many claims unless it is genuinely a multi-subject passage (e.g., a catalog of names, a geographic list, or a creed).

**Concrete limits:**
- A passage may support **at most 3 distinct proposition claims** without triggering a review.
- If a passage supports 4+ proposition claims, each link must be individually justified.
- For doctrine claims (`work_affirms_proposition`), **prefer a fresh, dedicated passage quote** per claim over reusing a shared passage.

**Rationale:** The #1 audit finding (WRONG_PASSAGE_FOR_CLAIM, 34 batches) was caused by reusing a single passage from a work as evidence for many unrelated doctrines. The passage often discussed one topic but was cited for others simply because it came from the same work.

**Exceptions:**
- A creedal or rule-of-faith passage (e.g., AH 1.10.1) that explicitly lists multiple doctrines may legitimately support multiple claims.
- A narrative passage that names multiple people/places (e.g., Acts 15) may legitimately support multiple geographic/relational claims.
- In these cases, add a note explaining why the fan-out is justified.

#### Rule P-FRESH: One quote per doctrine claim

> When adding a `work_affirms_proposition` claim, find a passage where the work **directly and specifically** discusses that doctrine. Do not cite a passage about Topic A as evidence for Topic B just because they're in the same work.

**Test:** Read the passage excerpt in isolation. Does it mention the claimed proposition? If not, the passage does not support the claim.

#### Rule P-VERIFY: Verify before linking

> Before linking a passage to a claim as `supports` evidence, verify that the passage text actually contains content relevant to the claim's specific proposition.

**Do not:**
- Link a passage based on work-level association ("Origen discusses baptism, so this Origen passage supports the baptism claim")
- Link a passage based on the chapter title alone
- Link a passage based on AI-generated summary of what the chapter "is about"

**Do:**
- Read the actual excerpt
- Confirm it contains language relevant to the specific proposition
- If the passage only loosely relates, use `contextualizes` instead of `supports`

### 4.2 Source Verification Rules (NEW)

#### Rule S-URL: Verify source URLs at ingestion time

> Before adding any evidence rows for a source, open the source URL and confirm it points to the correct work.

**Known traps:**
- New Advent ANF numbering vs CSEL numbering for Cyprian's letters
- New Advent numbering for Origen's works
- Multiple translations of the same work at different URLs

#### Rule S-LOCATOR: Verify passage locators at ingestion time

> After creating a passage, verify that the locator (chapter.section) matches the content of the excerpt. Composite paraphrases from multiple chapters are not allowed — split into separate passages.

### 4.3 Excerpt Quality Rules (NEW)

#### Rule E-VERBATIM: Prefer verbatim quotes

> When a short verbatim quote (1–3 sentences) would suffice to support the claim, use it instead of a paraphrase. Reserve paraphrases for cases where the relevant content spans many paragraphs.

#### Rule E-PARAPHRASE: Paraphrase labeling and caps

> All non-verbatim excerpts must be prefixed with `Paraphrase:` or `Summary:`. Paraphrase-based evidence is automatically capped at `assertion_mode=strong_inference` and cannot have `mode=explicit`.

#### Rule E-LOCATOR: Excerpt must match locator

> The content of the excerpt must actually come from the cited locator (chapter.section). Do not create composite excerpts from multiple chapters under a single locator.

### 4.4 Validator Enhancements (NEW)

Two new validator rules to be added to `validate_canonical_data.py`:

#### P6 — Passage doctrine fan-out warning

> Warn when a single passage is used as `supports` evidence for 3+ distinct proposition claims (`work_affirms_proposition`, `person_affirms_proposition`, `work_opposes_proposition`, `person_opposes_proposition`). This is the automated enforcement of Rule P-REUSE.

#### P7 — Garbage notes detection

> Warn when an evidence row's `notes` field contains known AI-boilerplate patterns:
> - "is a primary text directly relevant to"
> - "Upgraded from contextualizes"
> - "passage explicitly mentions"
> - "directly supports the claim"
>
> These indicate auto-generated notes that were never human-reviewed.

### 4.5 Campaign Workflow Updates (NEW)

The following changes apply to the patristic data harvest workflow and batch collection plan:

#### Step 5.5 (NEW) — Evidence quality gate

After harvesting passages and before creating claim_evidence rows:

1. **For each proposed evidence link**, read the passage excerpt and confirm it contains content directly relevant to the specific claim.
2. **For each passage**, check how many claims it is being linked to. If 3+, justify each link or find dedicated passages.
3. **For each source URL**, verify it points to the correct work.
4. **For each paraphrase**, verify the content matches the cited locator by checking the source.

#### Campaign sign-off addition

Add to the campaign sign-off checklist:
- [ ] No passage supports 4+ unrelated proposition claims without justification
- [ ] All source URLs verified against actual content
- [ ] All paraphrase excerpts verified against source text
- [ ] Validator passes with no P6 or P7 warnings

---

## Execution Timeline

| Phase | Scope | Estimated Effort |
|-------|-------|-----------------|
| Phase 1.1 | 267 needs_revision claims | 15–20 batches of remediation |
| Phase 1.2 | Source URL sweep | 1 session |
| Phase 1.3 | Garbage field scan | 1 session (after P7 rule deployed) |
| Phase 1.4 | Passage fan-out audit | 2–3 sessions (after P6 rule deployed) |
| Phase 2 | 68 remaining audit batches | 68 batch sessions |
| Phase 3.1 | Evidence weight pass | 2–3 sessions |
| Phase 3.2 | Wikipedia replacement | 3–5 sessions |
| Phase 3.3 | Paraphrase upgrade | 5–10 sessions |
| Phase 3.4 | Cross-batch consistency | 2–3 sessions |
| Phase 3.5 | Orphan cleanup | 1 session |
| Phase 3.6 | Final review | 1 session |

**Recommended order:** Deploy Phase 4 validator rules first → Phase 1.2–1.4 → Phase 2 (with new pre-audit checks) → Phase 1.1 (interleaved as needed) → Phase 3.

---

## Appendix: Issue Code Reference

| Code | Severity | Phase | Remediation |
|------|----------|-------|-------------|
| WRONG_PASSAGE_FOR_CLAIM | blocking | 1.4, 2 | Find correct passage; downgrade or delete evidence |
| PARAPHRASE_CAP_APPLIED | advisory | 2 | Cap mode to strong_inference for paraphrases |
| PARAPHRASE_OMISSION | advisory | 2 | Note omission; downgrade support_aspect |
| GARBAGE_WEIGHT_FIELD | blocking | 1.3 | Replace with proper scored weight |
| WRONG_SOURCE_URL | blocking | 1.2 | Fix URL in sources.tsv |
| TERTIARY_ONLY_SUPPORT | blocking | 3.2 | Harvest primary evidence |
| UNSCORED_WEIGHT | advisory | 3.1 | Score weight per rubric |
| MODE_DOWNGRADED | advisory | 2 | Verify downgrade is appropriate |
| CLAIM_NOT_IN_PASSAGE | blocking | 1.4, 2 | Find correct passage or delete evidence |
| QUOTED_SPEAKER_NOT_SUBJECT | blocking | 2 | Reattribute or delete evidence |
| ANACHRONISTIC_EVIDENCE | blocking | 2 | Flag and downgrade drastically |
| AUTO_GENERATED_NOTES | advisory | 1.3 | Replace with substantive assessment |
| MISLOCATED_PARAPHRASE | blocking | 2 | Fix locator or split passage |
