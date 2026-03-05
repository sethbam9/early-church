# Schema Improvement Analysis & Proposed Changes

## Executive Summary

After auditing the 6 TSV files, all UI code, and the docs, five concrete issues were found. The common thread is that the schema has **too many manually-maintained files that encode data already derivable from the authoritative source files**. Fixing this means less data-entry friction and unlocks the doctrine city-map feature without extra manual work.

---

## Issue 1: `note_mentions.tsv` is completely unused

**Evidence**: `grep "note_mentions" src/` returns zero results. The file is not imported in `dataStore.ts`. No UI component references it.

The file was intended as a pre-parsed join of `[[type:id]]` mention tags inside `notes.tsv:body_md`. The actual UI (the `NoteCard` component) parses those tags inline at render time. `note_mentions.tsv` is a stale precomputation that was never wired up.

**Value it *could* provide**: fast cross-reference queries like "find all notes that mention Ignatius (even notes primarily about Antioch)." The `notesByEntity` map in `dataStore.ts` only indexes by `primary_entity_id`, so this cross-referencing is not currently possible.

**Proposed change**:
- Make `note_mentions.tsv` **fully derived** (like `places.tsv`) by the validate pipeline — never edit manually.
- Wire it up in `dataStore.ts` to provide a `notes.getMentioning(type, id)` lookup.
- Remove from the ID-rename checklist.

---

## Issue 2: `entity_place_footprints.tsv` — sparse, partially redundant, missing `stance`

### Redundancy audit

| `entity_type` | Actual source of truth | Redundant with footprints? |
|---|---|---|
| `person` | `relations.tsv` (bishop_of, active_in, visited, born_in, martyred_in) | **Yes** |
| `work` | `works.tsv` (place_written_id, place_recipient_ids) | **Yes** |
| `event` | `events.tsv` (primary_place_id) | **Yes** |
| `archaeology` | `archaeology.tsv` (city_id) | **Yes** |
| `doctrine` | No direct column — needs 2-hop derivation via works/persons | **No — this is the value** |
| `persuasion` | `place_state_by_decade.tsv` (persuasion_ids per decade) | **Mostly yes** |

The UI already compensates for the sparse person footprints: `CityDetail.tsx` explicitly falls back to `relations.getForEntity("city", ...)` when footprints don't have person entries. This means the footprints table for persons adds no information the relations table doesn't already have.

The doctrine tab in `CityDetail.tsx` **doesn't use footprints at all** for its computation — it derives doctrine↔city links at runtime from `cityWorks`. Footprints for doctrines only appear in `EntityDetailPanel.tsx`'s "Map presence" section, and are manually entered (and sparse: only 4 entries in the current data).

### Missing `stance` field for the doctrine map

The upcoming doctrine city-map feature needs: *click doctrine D → see affirming cities green, opposing cities red on the map.* This requires knowing **stance** (affirms/condemns) per footprint. The current `Footprint` TypeScript type has no `stance` field, and the `reason` string (e.g., `via_work_affirms`) loosely encodes it but is not queryable.

### Derivation chains for doctrine → city

| Chain | Path | Stance |
|---|---|---|
| A | `doctrine ← affirms ← work → place_written_id → city` | affirms |
| B | `doctrine ← condemns ← work → place_written_id → city` | condemns |
| C | `doctrine ← affirms ← work → place_recipient_ids → city` | affirms (weaker — sent to) |
| D | `doctrine ← condemns ← work → place_recipient_ids → city` | condemns (weaker) |
| E | `doctrine ← affirms ← person → (bishop_of\|active_in\|visited) → city` | affirms |
| F | `doctrine ← condemns ← person → (bishop_of\|active_in\|visited) → city` | condemns |
| G | `quotes(stance=supports) → work → place_written_id → city` | affirms |
| H | `quotes(stance=opposes) → work → place_written_id → city` | condemns |

**Example**: Ignatius wrote letters *from* Antioch (place_written_id) that affirm monarchical-episcopacy (via relations). Chain A/E automatically produces a footprint: `doctrine:monarchical-episcopacy → city:antioch-antakya, stance=affirms, via=ignatius-epistle-to-philadelphians`.

### Proposed changes
1. Make `entity_place_footprints.tsv` **fully derived** — add to the derive pipeline, remove from manual editing workflow and ID-rename checklist.
2. Add a `stance` column: enum `affirms | condemns | neutral` (empty for non-doctrine entities).
3. The derive script implements all chains above. The `reason` field retains human-readable provenance (e.g., `bishop_of`, `written_in`, `via_work_affirms`).
4. Add `stance` field to the `Footprint` TypeScript type.

---

## Issue 3: `place_state_by_decade.tsv` — static metadata repeated per decade

Four columns have the **same value on every single decade row** for a given city:

| Column | Example (Jerusalem, repeated ×32) |
|---|---|
| `church_planted_year_scholarly` | `0030` |
| `church_planted_year_earliest_claim` | `0030` |
| `church_planted_by` | `Jesus; Apostles` |
| `apostolic_origin_thread` | `Jerusalem/James` |

This is static city metadata, not temporal state. Storing it here means ~4 fields × ~32 decades × 80+ cities ≈ **10,000+ redundant cells**, and every new city requires populating them on every decade row it gets.

`PlaceState` and `CityAtDecade` in `src/data/types.ts` both carry these 4 fields today — they were simply defined on the wrong type.

**Proposed changes**:
- Move these 4 columns to `cities.tsv`.
- Remove them from `place_state_by_decade.tsv`.
- Update `City` type to include them; remove from `PlaceState` / `CityAtDecade`.
- Update `dataStore.ts` parsing accordingly.

---

## Issue 4: `quotes.tsv` stance enum is inconsistent with `relations.polarity`

| File | Field | Values |
|---|---|---|
| `quotes.tsv` | `stance` | `for`, `against` |
| `relations.tsv` | `polarity` | `supports`, `opposes`, `neutral` |

These represent the same semantic concept. The derivation chains (Issue 2) use quotes stance to determine footprint stance — a mismatch here creates a translation layer and risks silent bugs.

**Proposed changes**:
- Rename `for` → `supports`, `against` → `opposes` in `quotes.tsv` and `enum-schema.md`.
- Optionally add `neutral` and `developing` stances to `quotes.tsv` for nuance.

---

## Issue 5: `relations.tsv` — affirms/condemns coverage is the upstream dependency

The entire doctrine city-map derivation depends on having `person → affirms → doctrine` and `work → affirms → doctrine` (and their condemns counterparts) well-populated in `relations.tsv`. The current data has a good start (rel-pd-*, rel-wd-* relations) but coverage is uneven — many significant person-doctrine links are missing.

No schema change needed here. But the data-edit workflow should emphasize: **whenever you add a person or work, add their doctrine stance relations**. The footprint and all downstream features are then automatic.

The existing `polarity` field on relations already carries the affirms/condemns semantics cleanly.

---

## Summary of All Changes

| # | File | Change | Type |
|---|---|---|---|
| 1 | `note_mentions.tsv` | Make fully derived; wire into dataStore | Schema + Workflow |
| 2 | `entity_place_footprints.tsv` | Make fully derived; add `stance` column | Schema + Workflow |
| 3 | `cities.tsv` | Add 4 columns from `place_state_by_decade` | Schema |
| 4 | `place_state_by_decade.tsv` | Remove 4 static columns | Schema |
| 5 | `quotes.tsv` | Change `for`→`supports`, `against`→`opposes` | Enum |
| 6 | `enum-schema.md` | Update quotes stance values; add footprint stance enum | Enum doc |
| 7 | `src/data/types.ts` | Add 4 fields to `City`; remove from `PlaceState`/`CityAtDecade`; add `stance` to `Footprint` | TypeScript |
| 8 | Derive scripts | Add footprint derivation + note_mentions derivation | Script |
| 9 | `data-edit.md` | Update workflow: emphasize doctrine stance relations; remove derived files from checklist | Workflow doc |

## What Does NOT Need to Change

- `places.tsv` — already correctly derived, schema is solid.
- `relations.tsv` — schema is fine; just needs richer data population.
- `notes.tsv` — schema is good.
- Core entity tables (`people`, `works`, `doctrines`, `events`, `archaeology`, `polities`, `persuasions`) — schemas are solid.
- `place_state_by_decade.tsv` structure (after removing 4 static columns) — the temporal decade-by-decade approach is correct and essential for the map slider.
