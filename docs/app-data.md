# App Data Architecture

Single source of truth for the canonical history dataset and the UI-facing derived tables.

This document defines:

- the canonical source tables
- the derived tables generated from those sources
- the markdown link and Bible reference rules
- the validation and sorting requirements
- the change-based workflow for groups and place control

Related file: [`domain-models.md`](./domain-models.md)

---

## Core principles

1. **Canonical entities are minimal.** Identity belongs on entity rows. Historical assertions belong in claims.
2. **Claims are atomic.** One row in `claims.tsv` expresses one assertion.
3. **Groups absorb former polity/persuasion roles.** Ancient communions, sects, schools, factions, and political polities all live in `groups.tsv`, distinguished by `group_kind` and claims.
4. **Derived tables are regenerated only.** No manual edits.
5. **Markdown cross-references are first-class.** `\[\[type:id|label\]\]` links may appear in markdown files and in markdown-capable TSV fields.
6. **Bible passage locators must declare their type.** Use `locator_type=bible_osis` for canonical Bible passages and store the locator in OSIS (example: `1Cor.1.1`). Use `locator_type=source_ref` for non-biblical reference systems such as Josephus, Qumran, or other Second Temple works.
7. **Temporal continuity is claim-based.** Do not restate the same group presence or place control centuries later unless the state actually changes.
8. **Sorting is deterministic.** Validation rewrites every TSV in canonical order.

---

## Table summary

| Table | Kind | Editable | Primary key | Purpose |
|---|---|---:|---|---|
| `places.tsv` | source | yes | `place_id` | Canonical geographic/place identity |
| `people.tsv` | source | yes | `person_id` | Canonical person identity |
| `works.tsv` | source | yes | `work_id` | Canonical work identity |
| `events.tsv` | source | yes | `event_id` | Canonical event identity |
| `groups.tsv` | source | yes | `group_id` | Canonical group identity, including polities |
| `topics.tsv` | source | yes | `topic_id` | High-level doctrinal topic |
| `dimensions.tsv` | source | yes | `dimension_id` | Axis within a topic |
| `propositions.tsv` | source | yes | `proposition_id` | Precise doctrinal proposition |
| `predicate_types.tsv` | source | yes | `predicate_id` | Allowed claim predicates and canonical direction |
| `sources.tsv` | source | yes | `source_id` | Bibliographic / web / primary source identity |
| `passages.tsv` | source | yes | `passage_id` | Quoted or referenced passage in a source |
| `claims.tsv` | source | yes | `claim_id` | Atomic historical assertions |
| `claim_evidence.tsv` | source | yes | composite | Many-to-many claim ↔ passage links |
| `claim_reviews.tsv` | source | yes | composite | Review and sign-off state for claims |
| `editor_notes.tsv` | source | yes | `editor_note_id` | Editorial markdown notes |
| `entity_place_footprints.tsv` | derived | no | composite | Entity ↔ place index for map/UI |
| `place_state_by_decade.tsv` | derived | no | composite | Place rollup for the map |
| `first_attestations.tsv` | derived | no | composite | Computed earliest attestation |
| `proposition_place_presence.tsv` | derived | no | composite | Computed proposition stance by place/time |
| `note_mentions.tsv` | derived | no | composite | Parsed `[[...]]` links from markdown-capable fields and markdown files |

---

## Source-of-truth rules

### Human-edited source tables

Humans and AI may edit only:

- canonical entity tables
- `sources.tsv`
- `passages.tsv`
- `claims.tsv`
- `claim_evidence.tsv`
- `claim_reviews.tsv`
- `editor_notes.tsv`

### Never hand-edit derived tables

These are always regenerated:

- `entity_place_footprints.tsv`
- `place_state_by_decade.tsv`
- `first_attestations.tsv`
- `proposition_place_presence.tsv`
- `note_mentions.tsv`

### One-row rule

Every source row must be one of:

- identity
- assertion
- evidence
- review
- editorial commentary

If a row mixes identity with historical summary or derived state, the schema is wrong.

### Canonical direction only

Store one canonical predicate direction. Inverses are UI/runtime labels only.

Examples:

- store `authored_by`; derive `author_of`
- store `teacher_of`; derive `disciple_of`
- store `controls_place`; derive `ruled_by_group`
- store `split_from_group`; derive `split_into`

### No semicolon-packed relational fields

Do not store semicolon-packed relationship IDs in source tables.
Use one claim per row instead.

### No duplicate attestation fields

Do not store inline historical summary fields such as:

- `first_attested_year`
- `first_attested_work_id`
- `church_planted_by`
- `apostolic_origin_thread`
- `dominant_polity_id`

Those belong in claims or in derived tables.

---

## Markdown link rules

### Supported wiki-link form

Canonical markdown links use this shape:

```text
\[\[type:id|Label\]\]
```

The `|Label` segment is optional.

Examples:

- `[[person:paul|Paul]]`
- `[[work:first-epistle-to-the-corinthians|1 Corinthians]]`
- `[[place:jerusalem|Jerusalem]]`
- `[[group:roman-empire|Roman Empire]]`
- `[[bible:1Cor.11.23|1 Corinthians 11:23]]`

### Where wiki-links are allowed

Wiki-links may appear in:

- any TSV field named `notes`
- any TSV field ending in `_md`
- markdown articles and other `.md` files in the project tree when validation runs with markdown scanning enabled

### Bible references must use OSIS

Where a Bible reference is stored directly or linked through a `bible` wiki-link, it must use OSIS. In `passages.tsv`, this applies specifically to rows with `locator_type=bible_osis`. Rows with `locator_type=source_ref` may use non-OSIS citation systems such as `Antiquities 18.116-119` or `1QS 5.7-13`.

Valid examples:

- `John.3.16`
- `1Cor.11.23`
- `Gal.1.18-Gal.1.19`
- `1Cor.15.3-5`

Invalid examples:

- `1 Corinthians 11:23`
- `1 Cor 11:23`
- `Gal 1:18-19`

The display label may be human-readable. The stored identifier must be OSIS.

---

# Entity tables (SOURCE)

## `places.tsv`

Canonical place identity. Cities, regions, provinces, routes, archaeology sites, monasteries, and composite historical places all live here.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `place_id` | string | yes | Stable slug PK |
| `place_label` | string | yes | Preferred historical/canonical display label |
| `place_label_modern` | string | no | Preferred modern name when different |
| `place_kind` | enum `place_kind` | yes | `city`, `region`, `province`, `site`, `monastery`, `route`, `unknown` |
| `parent_place_id` | string FK→places | no | Optional containment hierarchy |
| `lat` | float | no | Nullable if not mappable |
| `lon` | float | no | Nullable if not mappable |
| `location_precision` | enum `location_precision` | yes | Coordinate precision |
| `modern_country_label` | string | no | Display helper only |
| `notes` | markdown string | no | Identity note; wiki-links allowed |

### Rules

- `place_label` and `place_label_modern` solve the ancient/modern naming split without creating duplicate place identities.
- Historical control, ecclesial presence, doctrine stance, planting traditions, and first attestation do **not** live here.

## `people.tsv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `person_id` | string | yes | Stable slug PK |
| `person_label` | string | yes | Preferred display label |
| `name_alt` | string | no | Alternate names, free text |
| `name_native` | string | no | Native-language form |
| `birth_year_display` | string | no | Display-only |
| `death_year_display` | string | no | Display-only |
| `person_kind` | enum `person_kind` | yes | `individual`, `anonymous_author`, `collective_author`, `composite_figure`, `unknown` |
| `notes` | markdown string | no | Identity note; wiki-links allowed |

## `works.tsv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `work_id` | string | yes | Stable slug PK |
| `title_display` | string | yes | Preferred display title |
| `title_original` | string | no | Original-language title |
| `work_type` | enum `work_type` | yes | See enum schema |
| `language_original` | string | no | Free text |
| `work_kind` | enum `work_kind` | yes | See enum schema |
| `notes` | markdown string | no | Identity note; wiki-links allowed |

## `events.tsv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `event_id` | string | yes | Stable slug PK |
| `event_label` | string | yes | Preferred display label |
| `event_type` | enum `event_type` | yes | See enum schema |
| `event_kind` | enum `event_kind` | yes | `simple`, `composite`, `recurring`, `session` |
| `notes` | markdown string | no | Identity note; wiki-links allowed |

## `groups.tsv`

Canonical identity for communions, sects, schools, factions, orders, modern heirs, and polities.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `group_id` | string | yes | Stable slug PK |
| `group_label` | string | yes | Preferred display label |
| `group_kind` | enum `group_kind` | yes | Includes `polity` |
| `is_christian` | boolean | yes | Editorial flag: `true` if group counts as Christian presence for map filtering. Covers orthodox, gnostic, and schismatic groups. |
| `notes` | markdown string | no | Identity note; wiki-links allowed |

### Rules

- Former `polities.tsv` and `persuasions.tsv` are replaced by `groups.tsv`.
- Political control is modeled by `controls_place` claims whose subject is a group with `group_kind=polity`.
- Schisms, succession, absorption, or derivation between groups are modeled as claims such as `split_from_group`, `succeeds_group`, `absorbs_group`, `member_of_group`, or `group_present_at`.

## `topics.tsv`, `dimensions.tsv`, `propositions.tsv`

The proposition model replaces the old flat doctrine model.

### `topics.tsv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `topic_id` | string | yes | Stable slug PK |
| `topic_label` | string | yes | Example: `Baptism`, `Church Order` |
| `topic_kind` | enum `topic_kind` | yes | See enum schema |
| `notes` | markdown string | no | Wiki-links allowed |

### `dimensions.tsv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `dimension_id` | string | yes | Stable slug PK |
| `topic_id` | string FK→topics | yes | Parent topic |
| `dimension_label` | string | yes | Example: `subjects`, `effects`, `polity-form` |
| `dimension_kind` | enum `dimension_kind` | yes | See enum schema |
| `notes` | markdown string | no | Wiki-links allowed |

### `propositions.tsv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `proposition_id` | string | yes | Stable slug PK |
| `topic_id` | string FK→topics | yes | Parent topic |
| `dimension_id` | string FK→dimensions | no | Optional axis |
| `proposition_label` | string | yes | Human-readable proposition |
| `polarity_family` | string | no | Optional UI grouping |
| `description` | string | no | Neutral description |
| `notes` | markdown string | no | Wiki-links allowed |

## `predicate_types.tsv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `predicate_id` | string | yes | Stable slug PK |
| `predicate_label` | string | yes | Human-readable label |
| `subject_type` | enum `entity_type` | yes | Canonical subject type |
| `object_mode` | enum `object_mode` | yes | `entity`, `text`, `number`, `year`, `boolean` |
| `object_type` | enum `entity_type` | no | Required when `object_mode=entity` |
| `inverse_label` | string | no | Display-only inverse label |
| `is_symmetric` | boolean | yes | True only for symmetric predicates |
| `canonical_sort_rule` | enum `canonical_sort_rule` | yes | Canonical row ordering rule |
| `allows_date_range` | boolean | yes | Whether `year_start/year_end` may be populated |
| `allows_context_place` | boolean | yes | Whether `context_place_id` may be populated |
| `description` | string | no | Usage note |

## `sources.tsv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `source_id` | string | yes | Stable slug PK |
| `source_kind` | enum `source_kind` | yes | Bibliographic/source type |
| `title` | string | yes | Display title |
| `author` | string | no | Free text |
| `editor` | string | no | Free text |
| `year` | int | no | Publication/composition year |
| `container_title` | string | no | Journal/book/site title |
| `publisher` | string | no | Free text |
| `url` | string | no | Preferred URL |
| `accessed_on` | date | no | ISO date |
| `isbn_issn` | string | no | Optional identifier |
| `notes` | markdown string | no | Wiki-links allowed |

## `passages.tsv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `passage_id` | string | yes | Stable slug PK |
| `source_id` | string FK→sources | yes | Parent source |
| `locator_type` | enum | yes | `bible_osis` for canonical Bible passages fetched in the UI, `source_ref` for non-biblical citation systems |
| `locator` | string | yes | Section/page/chapter/canon/line/etc. If `locator_type=bible_osis`, the stored locator must use OSIS. |
| `excerpt` | string | no | Short quote/paraphrase |
| `language` | string | no | Passage language |
| `passage_year` | int | no | Optional dated passage year |
| `url_override` | string | no | Deep link if needed |
| `notes` | markdown string | no | Wiki-links allowed |

## `claims.tsv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `claim_id` | string | yes | Stable slug PK |
| `subject_type` | enum `entity_type` | yes | Must match `predicate_types.subject_type` |
| `subject_id` | string | yes | FK implied by `subject_type` |
| `predicate_id` | string FK→predicate_types | yes | Canonical predicate |
| `object_mode` | enum `object_mode` | yes | Exactly one object/value mode active |
| `object_type` | enum `entity_type` | no | Required when `object_mode=entity` |
| `object_id` | string | no | Required when `object_mode=entity` |
| `value_text` | string | no | Required when `object_mode=text` |
| `value_number` | decimal | no | Required when `object_mode=number` |
| `value_year` | int | no | Required when `object_mode=year` |
| `value_boolean` | boolean | no | Required when `object_mode=boolean` |
| `year_start` | int | no | Lower bound |
| `year_end` | int | no | Upper bound |
| `context_place_id` | string FK→places | no | Optional place context |
| `certainty` | enum `certainty` | yes | Historical confidence |
| `polarity` | enum `polarity` | yes | Supports/opposes/neutral/etc. |
| `claim_status` | enum `claim_status` | yes | Active/deprecated/etc. |
| `created_by` | string | no | Importer/editor identifier |
| `updated_at` | datetime | no | Optional metadata |

### Natural uniqueness target

Validation rejects duplicate logical active claims on:

`(subject_type, subject_id, predicate_id, normalized_object, normalized_time, normalized_context_place, polarity, claim_status='active')`

### Change-based temporal rule for groups

For predicates such as `controls_place` and `group_present_at`, the source claim set must be change-based.

Correct:

- one claim for Rome controlling Antioch across one uninterrupted interval
- a new claim only when control changes, ends, or resumes after interruption

Incorrect:

- one `controls_place` claim in AD 100 and another identical claim in AD 350 with no intervening change
- periodic restatement of the same uninterrupted state

Validation flags overlapping or directly adjacent duplicate intervals for the same logical group/place state and requires them to be merged.

## `claim_evidence.tsv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `claim_id` | string FK→claims | yes | Part of composite PK |
| `passage_id` | string FK→passages | yes | Part of composite PK |
| `evidence_role` | enum `evidence_role` | yes | Supports/opposes/contextualizes/mentions |
| `excerpt_override` | string | no | Optional UI excerpt |
| `evidence_weight` | int | no | 1–5 |
| `notes` | markdown string | no | Wiki-links allowed |

## `claim_reviews.tsv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `claim_id` | string FK→claims | yes | Part of composite PK |
| `reviewer_id` | string | yes | Part of composite PK |
| `review_status` | enum `review_status` | yes | Review state |
| `reviewed_at` | datetime | no | Timestamp |
| `confidence` | enum `review_confidence` | no | Reviewer confidence |
| `note` | string | no | Short rationale |

## `editor_notes.tsv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `editor_note_id` | string | yes | Stable slug PK |
| `note_kind` | enum `editor_note_kind` | yes | Commentary/todo/dispute/migration/rationale |
| `entity_type` | enum `entity_type` | no | Optional primary entity type |
| `entity_id` | string | no | Optional primary entity id |
| `claim_id` | string FK→claims | no | Optional linked claim |
| `body_md` | markdown string | yes | Markdown body; wiki-links allowed |
| `created_by` | string | no | Author/editor identifier |
| `created_at` | datetime | no | Timestamp |

---

# Derived tables (GENERATED)

## `entity_place_footprints.tsv`

Precomputed entity ↔ place index for the map and detail pages.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `entity_type` | enum `entity_type` | yes | |
| `entity_id` | string | yes | |
| `place_id` | string FK→places | yes | |
| `year_start` | int | no | |
| `year_end` | int | no | |
| `reason_predicate_id` | string | yes | Claim path root |
| `stance` | enum `derived_stance` | yes | Usually blank except proposition rows |
| `path_signature` | string | yes | Deterministic derivation signature |

## `place_state_by_decade.tsv`

Map rollup for place-by-time visualization.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `place_id` | string FK→places | yes | |
| `decade` | int | yes | Decade bucket start |
| `presence_status` | enum `presence_status` | yes | Derived place presence state |
| `group_presence_summary` | string | no | Serialized group IDs for UI rollups; not canonical |
| `dominant_polity_group_id` | string FK→groups | no | Derived controlling group where subject group is a polity |
| `supporting_claim_count` | int | yes | Number of source claims contributing to row |
| `derivation_hash` | string | yes | Deterministic hash |

### Rules

- `dominant_polity_group_id` replaces the old `dominant_polity_id` concept.
- Its source is `controls_place` claims whose subject group functions as a polity.
- The source claims are change-based; the derived table is allowed to repeat the state per decade because the map needs time slices.

## `first_attestations.tsv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `subject_type` | enum `entity_type` | yes | |
| `subject_id` | string | yes | |
| `predicate_id` | string | yes | |
| `first_year` | int | no | Earliest dated support |
| `first_claim_id` | string | no | Claim that wins tie-break |
| `first_passage_id` | string | no | Passage that wins tie-break |

## `proposition_place_presence.tsv`

| Column | Type | Required | Rules |
|---|---|---:|---|
| `proposition_id` | string FK→propositions | yes | |
| `place_id` | string FK→places | yes | |
| `year_start` | int | no | |
| `year_end` | int | no | |
| `stance` | enum `stance` | yes | `affirms`, `opposes`, `mixed`, `neutral`, `unknown` |
| `supporting_claim_count` | int | yes | |
| `opposing_claim_count` | int | yes | |
| `derivation_hash` | string | yes | |

## `note_mentions.tsv`

Parsed wiki-links from every markdown-capable TSV field and, when markdown scanning is enabled, from markdown files across the configured scan root.

| Column | Type | Required | Rules |
|---|---|---:|---|
| `mention_source_type` | enum `mention_source_type` | yes | `table_field` or `markdown_file` |
| `source_table` | string | no | Populated for TSV-field mentions |
| `source_row_id` | string | no | PK of the row that contains the markdown |
| `source_field` | string | no | Field name that contains the markdown |
| `source_path` | string | no | Relative path for markdown-file mentions |
| `mentioned_type` | enum `mention_target_type` | yes | `entity_type` value or `bible` |
| `mentioned_id` | string | yes | Entity ID or OSIS reference |
| `mention_label` | string | no | Optional label from `\[\[type:id|label\]\]` |

### Rules

- `note_mentions.tsv` is a project-wide mention index rooted in markdown-capable TSV fields and optionally expanded with project markdown files.
- Entity mentions must resolve to existing rows.
- `mentioned_type=bible` must contain OSIS in `mentioned_id`.

---

# Enum schema

## `entity_type`

- `place`
- `person`
- `work`
- `event`
- `group`
- `topic`
- `dimension`
- `proposition`
- `source`
- `passage`
- `claim`
- `editor_note`

## `mention_target_type`

- every `entity_type`
- `bible`

## `mention_source_type`

- `table_field`
- `markdown_file`

## `group_kind`

- `communion`
- `sect`
- `school`
- `order`
- `faction`
- `practice_stream`
- `modern_heir`
- `polity`
- `unknown`

## Other enums

The validator/script layer is authoritative for the remaining enum sets used by the canonical tables and derived tables:

- `object_mode`
- `certainty`
- `polarity`
- `claim_status`
- `evidence_role`
- `review_status`
- `review_confidence`
- `editor_note_kind`
- `place_kind`
- `location_precision`
- `person_kind`
- `work_type`
- `work_kind`
- `event_type`
- `event_kind`
- `topic_kind`
- `dimension_kind`
- `source_kind`
- `stance`
- `presence_status`
- `canonical_sort_rule`

---

# Predicate catalog and canonical order

The actual `predicate_types.tsv` is authoritative. The following predicates are especially important to the current UI and derivation chain:

- `authored_by`
- `written_at`
- `addressed_to_place`
- `event_occurs_at`
- `active_in`
- `originated_in`
- `bishop_of`
- `member_of_group`
- `split_from_group`
- `group_present_at`
- `controls_place`
- `work_affirms_proposition`
- `work_opposes_proposition`
- `person_affirms_proposition`
- `person_opposes_proposition`
- `place_presence_status`

Canonical-order reminders:

- Symmetric predicates are stored once only, in canonical order.
- Inverse labels are runtime-only.
- Groups, not separate polity rows, are the subjects of `controls_place`.

---

# Validation rules

Validation must enforce all of the following:

1. **Headers are exact.** Every table must match its documented header order.
2. **Foreign keys resolve.** Including mentions parsed from markdown.
3. **Markdown links resolve everywhere.**
   - all `notes` fields
   - all `*_md` fields
   - markdown files in the project tree
4. **Bible references use OSIS where declared.**
   - `bible` wiki-links must validate as OSIS
   - any field whose name contains `osis` must validate as OSIS
   - any `passages.tsv` row with `locator_type=bible_osis` must use OSIS
5. **Derived tables are regenerated, never hand-edited.**
6. **Group continuity is merged.** Overlapping or directly adjacent identical active `controls_place` / `group_present_at` claim intervals are invalid and must be merged into one claim.
7. **No duplicate active logical claims.**
8. **Tables are always sorted.**
   - if `year_start` exists, sort by `year_start`, then stable tie-breakers
   - else if `first_year` exists, sort by `first_year`, then stable tie-breakers
   - else sort by ID/composite-key columns
   - validation rewrites tables into canonical sorted order

---

# Deprecated tables and migration

| Old table / pattern | Action | New model |
|---|---|---|
| `polities.tsv` | replace | `groups.tsv` with `group_kind=polity` |
| `persuasions.tsv` | replace | `groups.tsv` |
| `doctrines.tsv` | replace | `topics.tsv` + `dimensions.tsv` + `propositions.tsv` |
| inline city planting metadata | remove from source | represent as claims + evidence |
| inline work author/place fields | remove from source | represent as claims |
| editor-note-only mention derivation | replace | project-wide `note_mentions.tsv` |
| `dominant_polity_id` in derived/UI language | rename | `dominant_polity_group_id` |

The canonical direction is now:

- groups model both ecclesial streams and political polities
- places store both a preferred historical label and an optional modern name
- OSIS is the mandatory Bible-reference format
- wiki-link derivation scans markdown everywhere, not only editorial notes
