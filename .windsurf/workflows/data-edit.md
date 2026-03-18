---
description: Workflow for AI-assisted editing of canonical TSV data and markdown-linked content
---

# Canonical Data Editing Workflow

Use this workflow whenever adding, revising, splitting, superseding, or rejecting canonical rows.

This workflow assumes the schema documented in `docs/app-data.md` and validated by `scripts/validate_canonical_data.py`.

---

## Operating posture

Work in **small subject-predicate clusters**, not random row order.

Best default batch shapes:

- one subject across one predicate family
- one work and its doctrinal claims
- one place and its presence/control claims
- one source and all passages/evidence rows attached to it

This catches duplication early and keeps edits coherent.

---

## What may be edited directly

Edit only these source tables:

- `data/sheets/places.tsv`
- `data/sheets/people.tsv`
- `data/sheets/works.tsv`
- `data/sheets/events.tsv`
- `data/sheets/groups.tsv`
- `data/sheets/topics.tsv`
- `data/sheets/dimensions.tsv`
- `data/sheets/propositions.tsv`
- `data/sheets/predicate_types.tsv`
- `data/sheets/sources.tsv`
- `data/sheets/passages.tsv`
- `data/sheets/claims.tsv`
- `data/sheets/claim_evidence.tsv`
- `data/sheets/claim_reviews.tsv`
- `data/sheets/claim_review_events.tsv`
- `data/sheets/editor_notes.tsv`

Never hand-edit:

- `data/derived/*.tsv`

---

## Non-negotiable editing rules

1. **Search before insert.** Never add a row until you have searched for an existing semantic equivalent.
2. **Reuse sources and passages aggressively.** Duplicate witness rows are one of the easiest ways to pollute the dataset.
3. **One passage row per source+locator.** If two claims need different quote slices from that locator, use `excerpt_override` on `claim_evidence.tsv`.
4. **One claim row per atomic assertion.** Do not pack multiple assertions into one row.
5. **Prefer status transitions over destructive deletion.** Use `superseded` or `rejected` unless the row is obvious junk created in error.
6. **Do not restate uninterrupted continuity.** For `controls_place` and `group_present_at`, add a new row only when the state changes.
7. **Do not create derivable claims just because they are convenient for the UI.** Let derivations and rollups do their job.
8. **Do not approve what you have not read.** Reviews require actual passage inspection.

### Passage reuse discipline

9. **Minimize passage fan-out for doctrine claims.** A single passage should NOT support many unrelated proposition claims. If a work discusses Topic A in one section and Topic B in another, cite the specific section for each claim — do not reuse a generic passage from Topic A as evidence for Topic B.
10. **One fresh quote per doctrine claim.** When adding `work_affirms_proposition` or `person_affirms_proposition`, find a passage where the work *directly and specifically* discusses that proposition. Read the excerpt — if it doesn't mention the proposition, it does not support the claim.
11. **Fan-out limit.** A passage may support at most 3 distinct proposition claims without triggering review. If a passage supports 4+, each link must be individually justified in evidence notes. Exceptions: creedal passages, name catalogs, geographic lists.
12. **Do not link by work-level association.** The fact that Origen discusses baptism somewhere does not mean every Origen passage supports every baptism claim. Link by passage content, not author topic.

---

## Preflight search checklist

Before creating anything new, search these in order.

### If adding or editing an entity

- `places.tsv` by label and modern label
- `people.tsv` by display label and alternates
- `works.tsv` by title and notes keywords
- `groups.tsv` by label and `group_kind`
- `events.tsv` by label

### If adding a source or passage

Search for:

- same `work_id`
- same title / author / URL
- same `source_id`
- same `source_id + locator`
- nearby or equivalent locators already present

### If adding a claim

Search `claims.tsv` for the same:

- `subject_type`
- `subject_id`
- `predicate_id`
- object/value
- overlapping date range
- same `context_place_id`

Also search for likely **redundant** claims already derivable from stronger rows.

### If adding markdown references

Search for existing IDs and fix all broken references in the same batch.

---

## Canonical insertion order

Use this order unless there is a strong reason not to:

1. entity row
2. source row
3. passage row
4. claim row
5. evidence row
6. current review row
7. review history event row
8. validation run

---

## Workflow by row type

### A. Add or revise an entity row

Use entity tables only for identity and stable editorial metadata.

Do:

- stable slug ID
- display label
- optional alternate/native label
- light identity notes

Do not:

- store first-attestation summaries
- store doctrine rollups
- store place-control summaries
- store historical timelines in notes when those should be claims

### B. Add or revise a source row

A source row is the citable witness you are actually using.

Do:

- reuse a source row when the witness is already present
- fill `work_id` when the source directly represents that canonical work
- keep `source_kind` honest
- keep `url` and `accessed_on` current when applicable

Do not:

- create multiple source rows for the same witness just because you need multiple passages
- confuse canonical work identity with a particular edition or witness

### C. Add or revise a passage row

Before creating a passage row, search for the same `source_id + locator_type + locator`.

If it already exists:

- reuse it
- put claim-specific wording in `claim_evidence.excerpt_override` if needed

If creating a new passage row:

- keep one row per cited locator
- store a short excerpt when possible
- prefix non-verbatim wording with `Paraphrase:` or `Summary:`
- keep `locator` exact
- use `locator_type=bible_osis` only with OSIS locators

### D. Add or revise a claim row

A claim row must be one atomic assertion.

Do:

- use one predicate
- populate exactly one object/value branch
- add dates only when they belong on the claim
- use `context_place_id` only when it materially clarifies the claim
- choose `certainty` conservatively

Do not:

- create near-duplicate claims with slightly different phrasing
- create a weaker duplicate when a stronger claim already covers it
- store continuity restatements
- create claims that should be represented by derived relationships

### E. Add or revise an evidence row

Treat `claim_evidence.tsv` as a judgment table, not a citation dump.

For each evidence row, decide:

1. does this passage **support**, **oppose**, **contextualize**, or merely **mention** the claim?
2. if it supports, which **aspect** does it actually ground?
3. if it supports, is the relation **explicit**, **strong_inference**, or **weak_inference**?
4. if it is indirect, paraphrastic, or fragmentary, does the note explain that?

Rules:

- one row per `claim_id + passage_id`
- `support_aspect` and `assertion_mode` belong only on `supports` rows
- `supports + background_only` is invalid; use `contextualizes`
- `weak_inference` should have a note
- leave `evidence_weight` blank during drafting if necessary, but fill it for mature rows when possible

### F. Add or revise a review

Current review state:

- upsert `claim_reviews.tsv`
- exactly one row per claim

Review history:

- append one row to `claim_review_events.tsv`
- do not overwrite history

---

## Claim review procedure

Never review from claim row alone.

### Step 1. Read the claim

Check:

- subject
- predicate
- object/value
- dates
- context place
- certainty
- status

### Step 2. Read every linked passage

For every linked evidence row, inspect:

- `passages.excerpt`
- `claim_evidence.excerpt_override`
- `passages.locator`
- `sources.tsv` metadata
- linked URL when needed

### Step 3. Evaluate at three levels

For each evidence row, judge three things separately.

#### 1. Excerpt-only

Does the stored excerpt itself support the claim?

#### 2. Locator-context

Does the broader cited section support the claim even if the excerpt is too narrow?

#### 3. Source/link correctness

Does the source and locator actually point to the right work and section?

### Step 4. Decompose the claim

When needed, split the judgment into components:

- subject
- predicate
- object
- date
- place
- whole claim
- attribution

Assign `support_aspect` accordingly.

### Step 5. Set review state honestly

Recommended meanings:

- `approved` — fielding is sound and evidence mapping is materially correct
- `reviewed` — acceptable but not fully sign-off quality
- `needs_revision` — claim may survive, but fields/evidence need repair
- `disputed` — real scholarly dispute or serious contradiction to the present form
- `unreviewed` — draft or untouched

### Step 6. Record why

Every non-`unreviewed` review should have a concrete note.

Bad note:

- `Reviewed.`

Good note:

- `Support is indirect via Eusebius; certainty kept probable.`
- `Whole-claim support removed; passage only supports attribution.`
- `Merged duplicate continuity row into earlier control interval.`

---

## Duplicate and redundancy discipline

### Exact duplicate

Same subject, predicate, object/value, time, context.

Action:

- keep one
- mark the other `superseded` or remove if it was obvious junk

### Near duplicate

Same semantic assertion with only cosmetic differences.

Action:

- normalize into one stronger row
- preserve audit history through status changes rather than silent loss

### Derivable redundancy

Check these before adding an `active_in` row or a second doctrinal row.

- `bishop_of` already covers the same person/place
- `controls_place` already covers the same group/place
- `authored_by + written_at` already imply presence
- `participant_in + event_occurs_at` already imply presence
- the person claim is already covered by work-level proposition claims from the person's own authored works

If yes, do not add the redundant row.

---

## Special cases

### Lost or fragmentary works

If a work survives only through later witnesses:

- the **claim subject** may still be the lost work
- the **source/passage** will often belong to a later witness
- the evidence note should explicitly say this is indirect testimonium

Recommended note marker:

```text
indirect_testimonium — later witness preserving/reporting the target work
```

Do not treat every cross-work evidence row as an error. Treat unexplained cross-work evidence as suspicious.

### Paraphrased excerpts

If the excerpt is a paraphrase:

- label it `Paraphrase:`
- do not overstate the source
- lower weight when needed
- prefer narrower `support_aspect` if the paraphrase compresses multiple ideas

### Sole contextual evidence

If a claim has only `contextualizes` evidence:

- do not mark it `attested`
- consider `probable`, `possible`, or `needs_revision`
- add direct support before approval

### Authorship claims

Authorship claims often use `support_aspect=attribution`, not `predicate`.

Do not force everything into `whole_claim`.

### Place-control and presence claims

Before inserting `controls_place` or `group_present_at`, inspect earlier and later rows for the same subject/place pair.

If the state is uninterrupted:

- extend/merge
- do not append a new restatement row

---

## Status transitions and deletion policy

Use these defaults:

- claim no longer canonical because merged into stronger row → `superseded`
- claim unsupported after audit → `rejected`
- claim retained only for migration compatibility → `deprecated`
- incomplete new insertion → `draft`

Hard-delete only when the row is plainly accidental and preserving it adds no audit value.

For evidence rows and duplicate passage rows, hard deletion is usually fine once the surviving canonical row is clear.

---

## Markdown reference discipline

Canonical markdown references use this escaped shape in documentation examples:

```text
\[\[type:id|Label\]\]
```

When editing real markdown-capable content, use live canonical IDs.

Rules:

- repair references when renaming IDs
- do not leave stale references behind
- Bible references must use OSIS inside the stored identifier

---

## Validation loop

Run the validator after every coherent batch.

Standard command:

```bash
python3 scripts/validate_canonical_data.py --data-dir data
```

When you want markdown scanning outside TSV fields as well:

```bash
python3 scripts/validate_canonical_data.py --data-dir data --check-markdown --scan-root .
```

What validation is expected to do:

- check headers and enums
- check foreign keys
- enforce claim structure
- catch duplicate logical active claims
- catch duplicate passage locator rows
- warn on redundancy and weak evidence patterns
- validate wiki-links and OSIS Bible references
- rewrite canonical sort order
- regenerate derived tables

Always inspect the diff after validation.

---

## Done checklist for every batch

Before closing a batch, verify all of these:

- no new duplicate entity/source/passage/claim rows were introduced
- no continuity restatement rows were introduced
- every new claim has appropriate evidence mapping
- every reviewed claim has one current review row
- every review action has a history event row
- markdown references resolve
- derived tables were left untouched by hand
- validator output is understood and accepted

If one of those is false, the batch is not done.
