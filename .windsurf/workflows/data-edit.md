---
description: AI-assisted data editing process for TSV data files
---

# AI Data Edit Workflow

Use this process whenever adding, updating, or removing records across the data TSV files.

## Source files (edit directly)

| File | What it contains |
|------|-----------------|
| `data/people.tsv` | Historical figures |
| `data/polities.tsv` | Political entities |
| `data/persuasions.tsv` | Theological traditions/streams |
| `data/cities.tsv` | Canonical city records |
| `data/places.tsv` | Map-visible places (city: or archaeology: prefixed) |
| `data/works.tsv` | Primary source texts |
| `data/events.tsv` | Historical events |
| `data/doctrines.tsv` | Theological doctrines |
| `data/quotes.tsv` | Verbatim evidence quotes |
| `data/archaeology.tsv` | Physical sites/artefacts |
| `data/relations.tsv` | Graph edges between entities |
| `data/notes.tsv` | Evidence notes (content-hash ID) |
| `data/note_mentions.tsv` | Pre-parsed note→entity joins |
| `data/place_state_by_decade.tsv` | Temporal map state per place/decade |
| `data/entity_place_footprints.tsv` | Entity↔place associations |

## Rules

1. **IDs are stable slugs** — never change a `*_id` once it is referenced by other files.
2. **FK consistency** — if you rename an ID, find-and-replace in ALL files that reference it.
3. **No literal `null`** — use empty string for missing values.
4. **Semicolons** separate multi-value fields (e.g. `roles`, `persuasion_ids`, `name_alt`).
5. **`notes.tsv` note_id** is a 10-char SHA-1 content hash — do not invent these; the validator checks referential integrity but not the hash itself.
6. **`places.tsv`** must be kept in sync with `cities.tsv` and `archaeology.tsv` — every city needs a `city:CITY_ID` place row; every archaeology site needs an `archaeology:ARCH_ID` place row.

## Commit-sized batch process

1. **Identify the change set** — e.g. "add 3 new people", "populate persuasion descriptions", "rename polity ID".
1.1 Before adding a new record, check the records with a similar slug first to make sure you are not duplicating. For example don't add "paul" if there is already "paul-apostle".
2. **Edit the TSV files** using the Edit or multi_edit tools. Keep each batch ≤ 20 rows to stay reviewable.
3. **Validate** — run the validator to catch broken FKs or header mismatches:
   ```
   npm run data:validate
   ```
4. **Fix any errors** reported before moving to the next batch.
5. Repeat steps 2–4 until the full change is done.

## ID renaming checklist

When renaming a primary key (e.g. `polity_id`, `person_id`):
- [ ] Update the ID in its own TSV file
- [ ] `data/place_state_by_decade.tsv` — `polity_id` column
- [ ] `data/note_mentions.tsv` — `mentioned_slug` column
- [ ] `data/notes.tsv` — `[[type:id]]` mention tags in `body_md`
- [ ] `data/entity_place_footprints.tsv` — `entity_id` column
- [ ] `data/relations.tsv` — `source_id` / `target_id` columns
- [ ] `data/events.tsv` — `key_figure_person_ids` column (for persons)
- [ ] `data/works.tsv` — `author_person_id` column (for persons)
- [ ] `data/people.tsv` — `city_of_origin_id` column (for cities)
- [ ] `data/archaeology.tsv` — `city_id` column (for cities)

## Adding a new city

1. Add row to `data/cities.tsv`
2. Add corresponding `city:CITY_ID` row to `data/places.tsv`
3. Optionally add rows to `data/place_state_by_decade.tsv` and `data/entity_place_footprints.tsv`
4. Run validator

## Adding a new person

1. Add row to `data/people.tsv`
2. If they wrote works, add rows to `data/works.tsv` with `author_person_id`
3. If they appear in events, update `key_figure_person_ids` in `data/events.tsv`
4. Add relations to `data/relations.tsv` if needed
5. Run validator
