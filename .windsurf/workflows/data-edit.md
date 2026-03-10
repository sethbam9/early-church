---
description: Windsurf workflow for AI-assisted editing of canonical TSV data and markdown-linked content
---

# Windsurf Canonical Data Workflow

Use this workflow whenever adding, updating, or removing canonical records or markdown cross-references.

This workflow assumes the canonical schema documented in `docs/app-data.md` and `docs/domain-models.md`.

---

## The current source tables

Edit only these source tables directly:

| File | What it contains |
|---|---|
| `data/sheets/places.tsv` | Canonical places with historical/canonical label and optional modern label |
| `data/sheets/people.tsv` | Canonical people |
| `data/sheets/works.tsv` | Canonical works |
| `data/sheets/events.tsv` | Canonical events |
| `data/sheets/groups.tsv` | Canonical groups, including polities |
| `data/sheets/topics.tsv` | High-level doctrinal topics |
| `data/sheets/dimensions.tsv` | Topic axes |
| `data/sheets/propositions.tsv` | Precise proposition rows |
| `data/sheets/predicate_types.tsv` | Predicate catalog and canonical direction |
| `data/sheets/sources.tsv` | Source bibliography/web identities |
| `data/sheets/passages.tsv` | Citable source passages |
| `data/sheets/claims.tsv` | Atomic historical assertions |
| `data/sheets/claim_evidence.tsv` | Claim ↔ passage links |
| `data/sheets/claim_reviews.tsv` | Claim review status |
| `data/sheets/editor_notes.tsv` | Editorial markdown notes |

## Derived files

Never edit these manually. They are rewritten by validation.

| File | Produced by |
|---|---|
| `data/derived/entity_place_footprints.tsv` | `python generate_derived_tables.py` |
| `data/derived/place_state_by_decade.tsv` | `python generate_derived_tables.py` |
| `data/derived/first_attestations.tsv` | `python generate_derived_tables.py` |
| `data/derived/proposition_place_presence.tsv` | `python generate_derived_tables.py` |
| `data/derived/note_mentions.tsv` | `python generate_derived_tables.py` |

---

## Windsurf working rules

1. **Edit only canonical source rows.** Never patch derived tables by hand.
2. **Use groups instead of separate polity or persuasion files.**
   - political control = `group_kind=polity` + `controls_place`
   - ecclesial or theological belonging = `group_present_at`, `member_of_group`, `split_from_group`, etc.
3. **Use change-based time ranges.**
   - if Rome controls a place continuously for 300 years, keep one uninterrupted claim interval
   - only add another claim when control or presence actually changes
4. **Place rows must preserve both names when relevant.**
   - `place_label` = historical/canonical display name
   - `place_label_modern` = modern name when different
5. **Bible references must be OSIS.**
   - use `[[bible:1Cor.11.23|1 Corinthians 11:23]]`
   - do not store `1 Cor 11:23` as the identifier
6. **Markdown links are part of referential integrity.**
   - `[[type:id|label]]` links in `notes`, `body_md`, and markdown articles are validated
7. **Validation rewrites sorting automatically.**
   - if a table has `year_start`, rows are sorted by `year_start` first
   - otherwise rows are sorted by ID/composite key

---

## Canonical wiki-link rules

Use this exact link shape in markdown-capable fields and markdown files:

```text
[[type:id|Label]]
```

Examples:

- `[[person:paul|Paul]]`
- `[[work:nt-1cor|1 Corinthians]]`
- `[[place:jerusalem-jerusalem|Jerusalem]]`
- `[[group:roman-empire|Roman Empire]]`
- `[[bible:Gal.1.18-Gal.1.19|Galatians 1:18–19]]`

The label is optional. The ID is not.

---

## Standard Windsurf edit loop

### 1. Identify the exact change

Frame the batch narrowly.

Examples:

- add 6 new claims about Antioch
- rename one place ID and repair all references
- add one polity group and one `controls_place` claim
- convert a doctrine note to proposition-linked editor notes

### 2. Search before editing

Before creating any new row, search for semantic duplicates.

Recommended searches inside Windsurf:

- `places.tsv` by label and modern label
- `groups.tsv` by label and kind
- `claims.tsv` by predicate + subject + object
- markdown files for `[[type:id]]` or title keywords

### 3. Edit source rows only

When changing an entity ID, update every direct reference:

- all source TSV foreign keys
- all `[[type:id]]` references in markdown-capable TSV fields
- all `[[type:id]]` references in markdown files

Do not touch derived files.

### 4. Run validation

Use the canonical validator after every batch:

```bash
python3 scripts/validate_canonical_data.py --data-dir data
```

If you want to validate only canonical source tables and temporarily ignore unresolved markdown links in `data/essays/`, use:

```bash
python3 scripts/validate_canonical_data.py --data-dir data --scan-root data/sheets
```

This does all of the following:

- validates headers and enums
- validates foreign keys
- validates wiki-links in TSV markdown fields and markdown files
- validates OSIS Bible references
- rewrites tables into canonical sorted order
- regenerates stale derived files

### 5. Inspect rewritten files

Because validation rewrites sort order and derived tables, always review the diff after running it.

### 6. Commit small, coherent batches

Keep each commit reviewable.
Avoid mixing schema migration, row additions, and unrelated copy edits in one commit.

---

## Common edit recipes

### Add a new place

1. Add a row to `data/sheets/places.tsv`
2. Set `place_label`
3. Set `place_label_modern` when the modern name differs
4. Add any relevant claims in `data/sheets/claims.tsv`
5. Run validation

### Add a polity

1. Add a row to `data/sheets/groups.tsv` with `group_kind=polity`
2. Add `controls_place` claims in `data/sheets/claims.tsv`
3. Use one uninterrupted date range per continuous control span
4. Run validation

### Record a schism or split

1. Keep both bodies in `data/sheets/groups.tsv`
2. Add the relationship claim such as `split_from_group`
3. Add `group_present_at` claims only where presence actually needs to be asserted
4. Do not create repetitive continuity rows just because time passes
5. Run validation

### Add doctrinal evidence

1. Create or reuse a proposition in `data/sheets/propositions.tsv`
2. Add a claim such as `work_affirms_proposition`, `person_opposes_proposition`, etc.
3. Add supporting passage rows in `data/sheets/passages.tsv` if needed
4. Link them in `data/sheets/claim_evidence.tsv`
5. Run validation

### Add an editorial note or article mention

1. Put markdown in `data/sheets/editor_notes.tsv` or in a project `.md` file
2. Use canonical links such as `[[person:paul|Paul]]`
3. Use `[[bible:...]]` with OSIS
4. Run validation so `data/derived/note_mentions.tsv` is regenerated

---

## ID renaming checklist

When renaming any primary key:

- update the row in its own TSV file
- update all source TSV foreign keys
- update all `[[type:id]]` references in TSV markdown fields
- update all `[[type:id]]` references in markdown files
- run validation
- review the regenerated `data/derived/note_mentions.tsv` and other derived tables

---

## Contribution standards for Windsurf agents

Every Windsurf agent or scripted assistant should follow these constraints:

1. Never invent unsupported enums.
2. Never store historical summary fields on identity rows.
3. Never create duplicate uninterrupted group/place continuity claims.
4. Never use non-OSIS Bible identifiers.
5. Never leave unresolved `[[type:id]]` references behind.
6. Never manually reorder tables; let validation rewrite canonical order.
7. Never edit derived tables directly.

---

## Recommended command sequence

```bash
python3 scripts/validate_canonical_data.py --data-dir data
```

For source-table-only validation while ignoring unresolved essay links:

```bash
python3 scripts/validate_canonical_data.py --data-dir data --scan-root data/sheets
```

Optional explicit derivation run:

```bash
python3 scripts/generate_derived_tables.py --data-dir data
```

To scan a different directory for markdown mentions:

```bash
python3 scripts/validate_canonical_data.py --data-dir data --scan-root data/essays
```

Normal practice:

- edit source rows
- run validator
- inspect diff
- commit

---

## What changed from the old workflow

Old workflow assumptions removed:

- separate `polities.tsv`
- separate `persuasions.tsv`
- inline city planting metadata
- flat doctrine rows as the canonical doctrinal unit
- editor-note-only mention derivation
- permissive Bible reference formats

Current workflow assumptions:

- one canonical `groups.tsv`
- proposition-based doctrine model
- project-wide markdown link derivation
- OSIS Bible references
- change-based continuity claims
- validator-driven canonical sorting and derived regeneration