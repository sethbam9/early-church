# Claim Audit Pipeline

Full row-by-row audit of all 2,280 claims and 2,494 evidence rows via a multi-phase pipeline with preflight normalization, deterministic structural purge, subject-batched semantic review (~10–20 claims per batch), and a findings ledger tracking every decision.

---

## Current State

- **Claims**: 2,226 active rows in `data/sheets/claims.tsv` (2,280 total)
- **Evidence**: 2,494 rows — 2,371 `supports`, 123 `contextualizes`, 0 `mentions`/`opposes`
- **Passages**: 531 rows; **Sources**: 135 rows
- **Reviews**: Empty (old reviews backed up to `data/old/`)
- **Validator**: Enforces R1–R8 redundancy rules, P1–P5 evidence quality rules, FK integrity, enum validation
- **407** supports rows have **blank `evidence_weight`** (unscored)
- **350 of 531** passage excerpts begin with `Paraphrase:` — high paraphrase-risk
- **14 sources** classified as `web_page` (Wikipedia, New Advent); at least `src-quis-dives-salvetur` is misclassified (should be `primary_text`)
- **High-reuse passages**: `psg-wikipedia-roman-empire-provinces` (56 uses), `psg-eusebius-he-6-19` (46), `psg-eusebius-he-6-20-43` (34), `psg-rufinus-he-1-9` (28)
- **High-reuse sources** (by evidence row count): `src-acts` (381), `src-eusebius-ecclesiastical-history` (298), `src-irenaeus-against-heresies` (150)
- **Lost/fragmentary works** with cross-work evidence: `papias-fragments`, `marcion-antitheses`, `marcion-gospel`, `diatessaron`, `philostorgius-ecclesiastical-history`
- **Known issues**: Old reviews were bulk-approved without careful excerpt-to-claim verification (e.g., psg-irenaeus-ah-3-3-1 used as `supports whole_claim explicit` for Peter's Roman bishopric, but the excerpt is about general apostolic succession, not Peter+Rome)

## Goals

- Audit every claim+evidence row for correctness
- **Status-based retention**: `claim_status=rejected` for unsupported claims, `claim_status=superseded` for duplicates/merged claims; hard-delete only accidental junk rows; orphan cleanup of evidence/passages/sources in the final pass only
- Write fresh `claim_reviews.tsv` and `claim_review_events.tsv` entries
- Target: **200+ claims** moved to rejected/superseded, **200+ evidence rows** deleted, field corrections on hundreds more
- End state: every surviving active claim has a review, all evidence is verified, audit trail is preserved

---

## Deliverables

### 1. `scripts/audit_conjoin.py` — Preflight + batch generator script

Loads all TSVs, runs preflight normalization, deterministic structural purge, and produces structured audit batches.

**Phase 0 — Preflight normalization** (runs before batching):

- **0A. Source-kind normalization**: Fix misclassified sources (e.g., `src-quis-dives-salvetur` → `primary_text`). Derive `source_tier` per source:
  - `tier_1_primary`: `source_kind` in {`primary_text`, `inscription`}
  - `tier_2_secondary`: `source_kind` in {`modern_book`, `journal_article`, `reference_work`}
  - `tier_3_tertiary`: `source_kind` in {`web_page`, `database`, `other`}
- **0B. Excerpt-form tagging**: For each passage, classify:
  - `verbatim`: excerpt does not begin with "Paraphrase:" and appears to be a direct quotation
  - `paraphrase`: excerpt begins with "Paraphrase:" (350 of 531 passages)
  - `summary`: excerpt begins with "Summary:" or similar
  - `mixed`: mixed content
  These tags are stored in `data/audit/passage_metadata.tsv` (non-canonical, audit-only artifact).
- **0C. High-reuse watchlist**: Generate `data/audit/high_reuse_watchlist.tsv` listing passages used ≥10 times and sources used in ≥50 evidence rows. These get audited first in Queue 0A.
- **0D. Lost/fragmentary work index**: Tag works that survive only via later witnesses (papias-fragments, marcion-antitheses, marcion-gospel, diatessaron, philostorgius-ecclesiastical-history + any others with notes containing "fragment", "lost", "reconstructed", "known through"). Used to exempt P1 cross-work support flags.

**Phase 1 — Deterministic structural flags** (per claim):

All flags from the original plan, plus:
- **PARAPHRASE_RISK**: excerpt_form=paraphrase AND (support_aspect=whole_claim OR assertion_mode=explicit) — automatic manual-check flag
- **PARAPHRASE_OMISSION**: paraphrase excerpt omits one of subject/predicate/object when support_aspect=whole_claim
- **TERTIARY_ONLY_SUPPORT**: all supports evidence traces to tier_3_tertiary sources
- **TERTIARY_DOCTRINAL**: claim is doctrinal/person-level AND only tertiary support — requires corroboration
- **INDIRECT_TESTIMONIUM**: P1 cross-work flag suppressed for lost/fragmentary works where the later source explicitly attributes content to the lost work
- **UNSCORED_WEIGHT**: supports row has blank evidence_weight (407 rows currently)
- **REDUNDANT_ACTIVE_IN**: bishop_of implies active_in (R7)
- **REDUNDANT_PERSON_PROP**: person_*_proposition covered by work_*_proposition (R2/rule 8)
- **REDUNDANT_GROUP_PRESENT**: controls_place implies group_present_at (R5)
- **REDUNDANT_DERIVED_PRESENCE**: authored_by+written_at or participant_in+event_occurs_at covers active_in (R8)
- **CONTINUITY_MERGE**: adjacent/overlapping time ranges for merge-required predicates (R1)
- **EXACT_DUPLICATE**: identical semantic key + year range
- **NEAR_DUPLICATE**: same semantic key, overlapping year ranges
- **SOURCE_MISMATCH**: work_* claim evidence from different work (P1) — except INDIRECT_TESTIMONIUM
- **NO_EVIDENCE**: claim has zero evidence rows
- **NO_SUPPORTS**: claim has only contextualizes evidence
- **ATTESTED_NO_QUALITY**: certainty=attested but no supports with quality aspect (P3)
- **MISSING_EXCERPT**: supports evidence with no excerpt (P5)
- **SUPPORTS_BACKGROUND**: supports + background_only (P4)
- **MISSING_SUPPORT_FIELDS**: supports evidence missing support_aspect or assertion_mode
- **WEIGHT_CERTAINTY_TENSION**: evidence_weight < 0.5 but certainty=attested, or weight >= 0.9 but certainty=possible
- **EMPTY_NOTES_ON_INFERENCE**: assertion_mode=weak_inference but no notes explaining the inference

**Phase 2 — Batch generation**:

- **Queue 0A**: High-reuse passage/source audit. Top ~15 passages (≥10 uses) and top ~10 sources (≥50 evidence rows). If one of these is wrong, dozens of downstream claims are affected. Audit the anchor before the dependents.
- **Queue 0B**: Deterministic structural purge. Claims with high-confidence auto-resolvable flags:
  - REDUNDANT_ACTIVE_IN, REDUNDANT_PERSON_PROP, REDUNDANT_GROUP_PRESENT, REDUNDANT_DERIVED_PRESENCE → `superseded`
  - EXACT_DUPLICATE → keep one, `superseded` the rest
  - CONTINUITY_MERGE → merge into one claim, `superseded` the rest
  - NO_EVIDENCE with no reasonable fix → `rejected`
  This reduces noise before expensive semantic review.
- **Queue 1+**: Subject-batched semantic review. Survivors grouped by subject_id:
  - Primary sort: subjects ordered by claim count descending (heavy subjects first)
  - Within each subject: claims ordered by predicate family, then year_start
  - Batch size: 10–20 claims; never split a subject with ≤25 claims; split large subjects by predicate family

**Outputs:**
- `data/audit/batches/batch-NNN.json` — one file per batch with full conjoined data + deterministic flags
- `data/audit/progress.tsv` — initialized with all batches as `pending`
- `data/audit/batch-summary.md` — human-readable index of all batches
- `data/audit/passage_metadata.tsv` — excerpt_form + source_tier per passage
- `data/audit/high_reuse_watchlist.tsv` — high-reuse passages/sources
- `data/audit/findings.ndjson` — findings ledger (see below)

### 2. Findings ledger: `data/audit/findings.ndjson`

Separate from canonical edits. Each line is a JSON object:

```json
{
  "claim_id": "clm-peter-bishop-rome",
  "passage_id": "psg-irenaeus-ah-3-3-1",
  "issue_codes": ["PARAPHRASE_RISK", "S1_SUBJECT_MISSING", "S3_OBJECT_MISSING"],
  "recommended_action": "downgrade_support_aspect",
  "confidence": "high",
  "applied": true,
  "batch_id": "batch-042",
  "note": "Excerpt is generic succession language; does not mention Peter or Rome specifically."
}
```

This preserves the full audit trail even when claims are rejected/superseded. The findings ledger is append-only and never edited after creation.

### 3. Progress file: `data/audit/progress.tsv`

Columns:
```
batch_id  subject_ids  claim_count  status  claims_approved  claims_needs_revision  claims_rejected  claims_superseded  claims_reopened  claims_fixed  evidence_fixed  evidence_deleted  passages_fixed  sources_fixed  blocking_issue_count  advisory_issue_count  top_issue_codes  started_at  completed_at
```

- `status`: `pending` | `in_progress` | `done`
- Updated after **every single batch** completes

### 4. `.windsurf/workflows/claim-audit.md` — Per-batch workflow

The step-by-step procedure Cascade follows for each batch.

---

## Deletion vs Status-Change Policy

| Situation | Action |
|-----------|--------|
| Claim is unsupported / evidence doesn't match | `claim_status=rejected` |
| Claim is a duplicate or merged into another | `claim_status=superseded` |
| Accidental junk row (test data, broken FK, etc.) | Hard delete |
| Evidence row is wrong but claim is valid | Delete the evidence row |
| Evidence row is redundant (same passage, same role) | Delete the evidence row |
| Orphaned passage (no evidence rows reference it) | **Defer to final cleanup pass** |
| Orphaned source (no passages reference it) | **Defer to final cleanup pass** |

Rationale: The append-only review history (`claim_review_events.tsv`) preserves what changed and why. Hard deletion destroys audit trail. Status-based retention lets later investigators reconstruct decisions.

---

## Per-Batch Procedure

### Step A: Read & Conjoin

1. Read the batch JSON file (already generated by the script)
2. For each claim, display: claim row, all evidence rows, all passage excerpts, source URLs, deterministic flags, excerpt_form, source_tier

### Step B: Evaluate Meta Relationships

For the batch as a whole, check:
- **Duplicates**: Are any claims semantically identical or near-identical to each other or to already-reviewed claims?
- **Redundancy**: Do any claims violate R5–R8?
- **Continuity**: Should adjacent time-range claims be merged?
- **Supersession**: Does a stronger claim make a weaker one unnecessary?

**Action**: Mark claims as `superseded` or `rejected`. Track which claim_ids are affected.

### Step C: Evaluate Per-Evidence-Row Data

For each evidence row on each surviving claim, evaluate at three levels:

#### C1. Excerpt-only entailment
Does the stored `passages.excerpt` (or `excerpt_override`) actually support the claim?

Decompose the claim into component hypotheses:
- **H-subject**: Does the excerpt mention the claim's subject?
- **H-predicate**: Does the excerpt contain content matching the predicate?
- **H-object**: Does the excerpt mention the claim's object?
- **H-date/place**: Does the excerpt support the claimed time/place?
- **H-whole**: Does the excerpt support the full atomic claim?

**Paraphrase-risk escalation** (350 paraphrased excerpts):
- If excerpt_form=`paraphrase` AND support_aspect=`whole_claim` AND assertion_mode=`explicit`: **mandatory manual check** — verify the paraphrase against the actual source text via web lookup
- If the paraphrase omits subject/predicate/object: downgrade support_aspect
- If the paraphrase overstretches: fix excerpt, add notes, or downgrade

Based on this, verify:
- Is `evidence_role` correct? (supports vs contextualizes vs mentions)
- Is `support_aspect` correct? (whole_claim only if H-whole passes)
- Is `assertion_mode` correct? (explicit only if directly stated)
- Is `evidence_weight` proportionate? (see weight rubric below)

#### C2. Locator-context verification
If the excerpt seems partial or questionable, check: does the broader section at the cited locator support the claim?
- If yes but excerpt doesn't → fix excerpt or add excerpt_override
- If no → the evidence row is wrong, fix or delete

#### C3. Source/link verification
For passages where the source URL is accessible:
- Does the URL point to the right work?
- Does the locator match a real section in that work?
- Flag: `LOCATOR_WRONG_SECTION`, `SOURCE_URL_WRONG_WORK`, `EXCERPT_NOT_IN_LOCATOR`

**Lost/fragmentary work exception**: For works tagged as lost/fragmentary (papias-fragments, marcion-antitheses, marcion-gospel, diatessaron, philostorgius-ecclesiastical-history), cross-work support is valid **if** the later source explicitly attributes the content to that work. Do not flag P1 source mismatch in these cases.

### Step D: Make Needed Updates

For each claim in the batch, apply one of:

1. **REJECT claim**: `claim_status=rejected` — claim is unsupported or wrong
   - Delete all evidence rows for that claim from `claim_evidence.tsv`
   - Write finding to `findings.ndjson`
2. **SUPERSEDE claim**: `claim_status=superseded` — claim is redundant/duplicate/merged
   - Delete evidence rows for the superseded claim
   - Write finding to `findings.ndjson`
3. **DELETE evidence row**: Specific evidence link is wrong, but claim is valid with remaining evidence
4. **FIX fields**: Update certainty, evidence_role, support_aspect, assertion_mode, evidence_weight, excerpt_override, notes, locator, etc.
5. **SPLIT claim**: One claim should be two (rare — note for manual follow-up)
6. **KEEP as-is**: Claim and evidence are correct

**Do NOT delete orphaned passages/sources during batch processing.** Defer to final cleanup pass.

### Step E: Write Reviews & Review Events

For every surviving active claim in the batch:

1. **Upsert `claim_reviews.tsv`**:
   - `claim_id`: the claim
   - `reviewer_id`: `cascade-audit-v2`
   - `review_status`: `approved` | `reviewed` | `needs_revision` | `disputed`
   - `reviewed_at`: current ISO 8601 timestamp
   - `confidence`: `low` | `medium` | `high`
   - `note`: specific finding (not a generic placeholder)

2. **Append `claim_review_events.tsv`**:
   - `claim_id`, `event_type`: `reviewed` | `approved` | `needs_revision`, `actor_id`: `cascade-audit-v2`, `event_at`, `note`

**Review criteria:**
- `approved` + `high`: all evidence rows directly support the claim with correct fields
- `approved` + `medium`: evidence is correct but could be stronger; or claim has unscored weights
- `reviewed` + `medium`: claim is acceptable but has minor concerns
- `needs_revision` + `low/medium`: evidence is weak, fields need fixing, or claim needs splitting
- `disputed`: scholarly consensus contradicts the claim

**Confidence caps:**
- Paraphrase-only support: cap at `medium` unless paraphrase verified against source
- Tertiary-only support: cap at `low` for doctrinal/person claims, `medium` for infrastructure claims (controls_place, group_present_at)
- Unscored weight: cap at `medium` until weight assigned

### Step F: Validate & Update Progress

1. Run: `python3 scripts/validate_canonical_data.py --data-dir data`
2. Fix any errors before proceeding
3. Update `data/audit/progress.tsv`: set batch status to `done`, fill in all columns
4. Append findings to `data/audit/findings.ndjson`

---

## Evidence Weight Rubric

| evidence_role | support_aspect | assertion_mode | source_tier | excerpt_form | Recommended weight |
|--------------|---------------|---------------|-------------|-------------|-------------------|
| supports | whole_claim | explicit | tier_1 | verbatim | 0.95–1.0 |
| supports | whole_claim | explicit | tier_1 | paraphrase | 0.7–0.85 |
| supports | whole_claim | strong_inference | tier_1 | verbatim | 0.8–0.9 |
| supports | predicate | explicit | tier_1 | verbatim | 0.8–0.95 |
| supports | predicate | explicit | tier_1 | paraphrase | 0.6–0.8 |
| supports | predicate | strong_inference | tier_1 | * | 0.6–0.8 |
| supports | predicate | weak_inference | * | * | 0.3–0.5 |
| supports | subject/object/date/place | * | * | * | 0.3–0.6 |
| supports | context/attribution | * | * | * | 0.2–0.5 |
| supports | * | * | tier_2 | * | multiply by 0.85 |
| supports | * | * | tier_3 | * | multiply by 0.6 |
| contextualizes | — | — | * | * | 0.1–0.3 |

- **Blank weight = unscored**, not weak. Do not treat as 0 or penalize.
- Assign weights during audit per the rubric above.
- Claims approved with any unscored supports evidence: confidence capped at `medium`.

---

## Revisiting Already-Reviewed Claims

A reviewed claim should only be revisited if a later batch reveals:
- A **duplicate** or **near-duplicate** in a later subject
- A **shared passage** that was downgraded/deleted in the later batch
- A **contradiction** between the already-reviewed claim and a later claim
- A **redundancy** that only becomes visible cross-subject

When this happens: reopen the earlier claim's review with event_type=`reopened`, re-evaluate, update progress, and log to findings ledger.

---

## Rules Reference

### Redundancy Rules (R1–R8)
| Rule | Check | Action |
|------|-------|--------|
| R1 | Continuity merge needed for controls_place/group_present_at | Merge adjacent claims; `superseded` the extras |
| R2 | person_*_proposition redundant with work_*_proposition | `superseded` the person claim |
| R5 | group_present_at redundant with controls_place | `superseded` the group_present_at |
| R7 | active_in redundant with bishop_of | `superseded` the active_in |
| R8 | active_in derivable from authored_by+written_at or participant_in+event_occurs_at | `superseded` the active_in |

### Evidence Quality Rules (P1–P5)
| Rule | Check | Action |
|------|-------|--------|
| P1 | work_* claim evidence from wrong work | Fix or delete evidence row (**except** lost/fragmentary works with explicit attribution) |
| P3 | attested claim lacks quality support_aspect | Downgrade certainty or upgrade aspect |
| P4 | supports + background_only | Change to contextualizes |
| P5 | supports with no excerpt | Add excerpt or excerpt_override |

### Source Tier Rules (NEW)
| Code | Check | Action |
|------|-------|--------|
| T1 | All supports evidence is tier_3_tertiary | Flag TERTIARY_ONLY_SUPPORT; cap confidence |
| T2 | Doctrinal/person claim backed only by tertiary | Flag TERTIARY_DOCTRINAL; requires corroboration or downgrade |
| T3 | Source misclassified (e.g., primary text hosted on web_page) | Fix source_kind |

### Paraphrase-Risk Rules (NEW)
| Code | Check | Action |
|------|-------|--------|
| X1 | paraphrase + whole_claim + explicit | Mandatory manual check against source text |
| X2 | Paraphrase omits subject/predicate/object | Downgrade support_aspect |
| X3 | Paraphrase overstretches source text | Fix excerpt, add notes, or downgrade |

### Lost/Fragmentary Work Exception (NEW)
| Code | Check | Action |
|------|-------|--------|
| F1 | P1 cross-work flag on lost/fragmentary work | Suppress P1 if later source explicitly attributes content to the lost work |

### Semantic Evaluation Rules (applied by Cascade)
| Code | Check | Action |
|------|-------|--------|
| S1 | Excerpt doesn't mention claim subject | Downgrade support_aspect from whole_claim |
| S2 | Excerpt doesn't contain predicate content | Downgrade evidence_role to contextualizes or delete |
| S3 | Excerpt doesn't mention claim object | Downgrade support_aspect |
| S4 | assertion_mode=explicit but claim is only inferred | Fix to strong/weak_inference |
| S5 | evidence_weight too high for the actual support | Lower weight per rubric |
| S6 | Passage paraphrase overstretches the source text | Fix excerpt or add notes |
| S7 | Locator points to wrong section | Fix locator |
| S8 | Source URL points to wrong work | Fix source URL |
| S9 | Claim certainty exceeds evidence strength | Downgrade certainty |
| S10 | Multiple evidence rows say the same thing | Delete redundant evidence rows |

---

## Estimated Scale

- **Queue 0A**: ~5 batches (high-reuse passage/source audit)
- **Queue 0B**: ~10–15 batches (deterministic structural purge)
- **Queue 1+**: ~130–180 batches (subject-batched semantic review)
- **Total**: ~150–200 batches
- **Expected status changes**: 200+ claims → rejected/superseded
- **Expected evidence deletions**: 200+ rows
- **Expected field fixes**: hundreds of evidence rows (weight, aspect, mode, excerpt)
- **Expected reviews written**: ~2,000+ (one per surviving active claim)
- Full audit is a multi-session effort

---

## File Structure

```
scripts/
  audit_conjoin.py              # Preflight + batch generator + deterministic checker

data/audit/
  batches/
    batch-001.json              # Conjoined packets for batch 1
    batch-002.json
    ...
  progress.tsv                  # Batch progress tracker (expanded columns)
  batch-summary.md              # Human-readable batch index
  findings.ndjson               # Append-only findings ledger
  passage_metadata.tsv          # excerpt_form + source_tier per passage
  high_reuse_watchlist.tsv      # High-reuse passages/sources

.windsurf/workflows/
  claim-audit.md                # Per-batch workflow
```

---

## Implementation Order

1. Write `scripts/audit_conjoin.py` (preflight + batch generator + deterministic checks)
2. Run it to generate all preflight artifacts + batches + progress file + summary
3. Write `.windsurf/workflows/claim-audit.md`
NOTE: write controversial or important stuff to editor_notes.tsv as we go.
Validate as we go.
4. Process Queue 0A: high-reuse passage/source audit
5. Process Queue 0B: deterministic structural purge (reject/supersede obvious issues)
6. Process Queue 1+: subject-batched semantic review (invoke workflow per batch)
7. After all batches: final global pass
   - Orphan sweep: delete passages/sources with zero remaining evidence references
   - Hard-delete all `rejected` and `superseded` claim rows + their evidence (optional, user decision)
   - Final validator run
   - Summary report from progress.tsv + findings.ndjson
