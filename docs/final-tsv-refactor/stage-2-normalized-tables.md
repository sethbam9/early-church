# Stage 2 — Normalized core tables (entities + relations)

## Goal
Create the *new authoritative* TSV tables that replace the redundant decade-by-decade structure in `final.tsv`.

This stage depends on Stage 1 mappings (slugs must be stable and complete).

## Key principle
Treat the dataset as a **web of cross-referenced entities**.
- Entities are identified by `type + slug`.
- Relationships are explicit (edges) and/or implicit (mentions inside notes).

## Proposed core tables (new files to create later)
### Cities
`data/entities/cities.tsv`
- `city_slug`
- `city_label` (primary display)
- `city_ancient_primary`
- `city_modern_primary` (optional)
- `country_modern_primary`
- `lat`
- `lon`
- `location_precision`
- `christianity_start_year`
- `christianity_end_year` (blank = ongoing)

**Notes:**
- Contestation/uncertainty belongs in `notes.tsv` (Stage 3), not by duplicating city rows.

### Sects
`data/entities/sects.tsv`
- `sect_slug`
- `sect_label`
- `start_year`
- `end_year` (blank = still extant)
- `notes` (short)

### People
`data/entities/people.tsv`
- `person_slug`
- `person_label`
- `birth_year` (optional)
- `death_year` (optional)
- `notes` (short)

### Works
`data/entities/works.tsv`
- `work_slug`
- `work_label`
- `author_person_slug` (optional)
- `year_start` (optional)
- `year_end` (optional)
- `notes` (short)

### Polities (empires/kingdoms)
`data/entities/polities.tsv`
- `polity_slug`
- `polity_label`
- `start_year` (optional)
- `end_year` (optional)

## Relations: edges
`data/edges.tsv` (or `data/edges_v2.tsv`)
- `from_type`
- `from_slug`
- `relation`
- `to_type`
- `to_slug`
- `year_start` (optional)
- `year_end` (optional)
- `evidence_note_slug` (optional; points to Stage 3 notes)

**Examples (conceptual):**
- `person:paul-the-apostle` — `founds_church_in` — `city:corinth`
- `person:irenaeus-of-lyons` — `writes` — `work:against-heresies`
- `work:against-heresies` — `opposes` — `sect:gnostic`

## Stage 2 exit criteria
- Core entity tables exist with unique slugs.
- Every slug referenced by an edge exists in its entity table.
- Cities and sects have start/end dates filled at least at a coarse level (fine-grained dispute lives in notes).
