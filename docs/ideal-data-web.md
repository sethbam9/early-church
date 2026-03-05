---
description: Data web / table schema for the interactive Early Christianity map UI
---

# Data Web — Interactive Map + Temporal + Network Cross‑Reference

## Goals (what the UI makes easy)

- **Global search that maps to geography** — search any `work`, `doctrine`, `person`, `persuasion`, `event`, or `archaeology` site and immediately highlight where it is represented on the map (and in what decades).
- **Temporal exploration** — a decade slider that changes which places are active, which persuasions are present, and which networks are relevant.
- **Graph exploration** — click an entity and traverse to related entities; show network overlays.
- **Evidence-first UX** — any displayed claim has citations and/or a note.
- **Doctrine city map** — click a doctrine and see which cities had people/works that affirmed or condemned it, color-coded on the map.


## Manual vs. Derived (authoritative rules)

| Category | File | Edited by |
|---|---|---|
| Source | `cities.tsv` | Human |
| Source | `people.tsv` | Human |
| Source | `persuasions.tsv` | Human |
| Source | `polities.tsv` | Human |
| Source | `works.tsv` | Human |
| Source | `doctrines.tsv` | Human |
| Source | `quotes.tsv` | Human |
| Source | `events.tsv` | Human |
| Source | `archaeology.tsv` | Human |
| Source | `relations.tsv` | Human |
| Source | `notes.tsv` | Human |
| Derived | `places.tsv` | `scripts/derive_places.ts` |
| Derived | `entity_place_footprints.tsv` | `scripts/derive_footprints.ts` |
| Derived | `note_mentions.tsv` | `scripts/derive_mentions.ts` |

Run `npm run data:validate` to regenerate all derived files and validate FKs.


## Design Principles

1. **Stable IDs** — every entity has a slug PK that never encodes time or location.
2. **Relations are the universal graph** — all cross-entity connections live in `relations.tsv`.
3. **Geography is a join** — entities don't own coordinates; they reference a `place_id`.
4. **Static data lives once** — city-planting metadata is in `cities.tsv`, not repeated per decade in `place_state_by_decade.tsv`.
5. **Derived files are always regenerated** — `places.tsv`, `entity_place_footprints.tsv`, and `note_mentions.tsv` are outputs, never edited manually.
6. **Stance is first-class** — `affirms`/`condemns`/`neutral` is a queryable column on footprints, not a freeform string.


## Table Schemas

### 1. `places.tsv` (DERIVED)

Map-visible things. A city, or an archaeology site with its own coordinates.

| Column | Type |
|---|---|
| `place_id` | string PK (`city:CITY_ID` or `archaeology:ARCH_ID`) |
| `place_type` | enum: `city` \| `archaeology` |
| `place_label` | string |
| `lat` | float nullable |
| `lon` | float nullable |
| `location_precision` | enum: `exact` \| `approx_city` \| `region_only` \| `unknown` |
| `city_id` | string nullable FK→cities |
| `archaeology_id` | string nullable FK→archaeology |

Derived from `cities.tsv` + `archaeology.tsv` by `scripts/derive_places.ts`.


### 2. `cities.tsv` (SOURCE)

Canonical city identity, geography, and static church-planting metadata.

| Column | Type |
|---|---|
| `city_id` | string PK |
| `city_label` | string |
| `city_ancient_primary` | string |
| `city_modern_primary` | string |
| `country_modern_primary` | string |
| `lat` | float nullable |
| `lon` | float nullable |
| `location_precision` | enum |
| `christianity_start_year` | int nullable |
| `church_planted_year_scholarly` | int nullable |
| `church_planted_year_earliest_claim` | int nullable |
| `church_planted_by` | string (e.g. `Paul; Silas`) |
| `apostolic_origin_thread` | string (e.g. `Pauline/Petrine`) |


### 3. `place_state_by_decade.tsv` (SOURCE)

Temporal map state per place per decade. Only fields that genuinely change decade-to-decade.

| Column | Type |
|---|---|
| `place_id` | string FK→places |
| `decade` | int (e.g. 110, 120) |
| `presence_status` | enum: `attested` \| `probable` \| `claimed_tradition` \| `not_attested` \| `suppressed` \| `unknown` |
| `persuasion_ids` | string semi-sep FK→persuasions |
| `polity_id` | string nullable FK→polities |
| `ruling_subdivision` | string |
| `council_context` | string |
| `evidence_note_id` | string nullable FK→notes |


### 4. `entity_place_footprints.tsv` (DERIVED)

Precomputed index mapping any entity to places. Powers the doctrine city map and entity→map highlight UX.

| Column | Type |
|---|---|
| `entity_type` | enum |
| `entity_id` | string |
| `place_id` | string FK→places |
| `year_start` | int nullable |
| `year_end` | int nullable |
| `weight` | int nullable (1–5) |
| `reason` | string: `bishop_of`, `written_in`, `sent_to`, `held_in`, `located_at`, `via_work_affirms`, `via_person_affirms`, … |
| `stance` | enum: `affirms` \| `condemns` \| `neutral` \| `` (empty for non-doctrine) |

Derived from all source files by `scripts/derive_footprints.ts`. **Derivation chains:**

| entity_type | Source | reason | stance |
|---|---|---|---|
| person | relations (bishop_of, active_in, visited, …) → city | relation_type | `` |
| work | works.place_written_id | written_in | `` |
| work | works.place_recipient_ids | sent_to | `` |
| event | events.primary_place_id | held_in | `` |
| archaeology | archaeology (self) | located_at | `` |
| doctrine | work→affirms + work.place_written_id | via_work_affirms | affirms |
| doctrine | work→condemns + work.place_written_id | via_work_condemns | condemns |
| doctrine | person→affirms + person→city | via_person_affirms | affirms |
| doctrine | person→condemns + person→city | via_person_condemns | condemns |
| doctrine | quotes(supports) + work.place_written_id | via_quote_affirms | affirms |
| doctrine | quotes(opposes) + work.place_written_id | via_quote_condemns | condemns |
| persuasion | place_state_by_decade.persuasion_ids | presence | `` |


### 5. `note_mentions.tsv` (DERIVED)

Pre-parsed `[[type:id]]` mention joins from `notes.tsv:body_md`.

| Column | Type |
|---|---|
| `note_id` | string FK→notes |
| `mentioned_type` | enum |
| `mentioned_slug` | string |

Derived by `scripts/derive_mentions.ts`. Enables `dataStore.noteMentions.getMentioning(type, id)`.


### 6. `relations.tsv` (SOURCE)

Universal graph edge table. All cross-entity connections.

| Column | Type |
|---|---|
| `relation_id` | string PK |
| `source_type` | enum |
| `source_id` | string |
| `relation_type` | string (see `enum-schema.md`) |
| `target_type` | enum |
| `target_id` | string |
| `year_start` | int nullable |
| `year_end` | int nullable |
| `weight` | int nullable (1–5) |
| `polarity` | enum: `supports` \| `opposes` \| `neutral` |
| `certainty` | enum: `attested` \| `probable` \| `claimed_tradition` \| `legendary` \| `unknown` |
| `evidence_note_id` | string nullable FK→notes |
| `citations` | string semi-sep URLs |

The `polarity` field on `person→affirms→doctrine` and `work→affirms→doctrine` relations drives footprint `stance` derivation. **This is the critical upstream data for the doctrine city map.**


### 7. `notes.tsv` (SOURCE)

Human-readable evidence and commentary. **Not for temporal state** — that lives in `place_state_by_decade.tsv`.

| Column | Type |
|---|---|
| `note_id` | string PK (10-char SHA-1 hash) |
| `year_bucket` | int |
| `year_exact` | int nullable |
| `primary_entity_type` | enum |
| `primary_entity_id` | string |
| `note_kind` | enum: `evidence` \| `commentary` |
| `body_md` | string (may contain `[[type:id\|label]]` mention tags) |
| `citation_urls` | string semi-sep URLs |


### 8. `quotes.tsv` (SOURCE)

Verbatim evidence quotes tied to a doctrine and a work.

| Column | Type |
|---|---|
| `quote_id` | string PK |
| `doctrine_id` | string FK→doctrines |
| `work_id` | string nullable FK→works |
| `text` | string |
| `work_reference` | string |
| `year` | int nullable |
| `stance` | enum: `supports` \| `opposes` \| `neutral` \| `developing` |
| `notes` | string |
| `citations` | string semi-sep URLs |


### 9–11. Core entity tables (SOURCE)

`people.tsv`, `works.tsv`, `doctrines.tsv`, `events.tsv`, `archaeology.tsv`, `polities.tsv`, `persuasions.tsv` — see `docs/domain-models.md` for full column specs.


## How Queries Work

### "Show doctrine X on the map (affirming/opposing cities)"

```
entity_place_footprints
  WHERE entity_type='doctrine' AND entity_id='infant-baptism'
  GROUP BY place_id
  → stance per city → color on map
```

Green = affirms, Red = condemns, Yellow = contested, Grey = unknown.

### "Show me where gnosticism is present in 180–220"

```
place_state_by_decade
  WHERE decade IN [180..220] AND persuasion_ids CONTAINS 'gnostic'
  JOIN evidence_note_id → notes.tsv
```

### "Correspondence network of bishops in decade 110"

```
relations
  WHERE relation_type='corresponded_with' AND year overlaps 110s
  JOIN each person → their bishop_of city (active in that decade)
  → render arcs between cities
```

### "City detail: people, works, doctrines"

```
CityDetail queries:
  people  → footprints(entity_type=person, place_id=city:X) + relations(→city)
  works   → works by city's people (via author_person_id)
  docs    → doctrines WHERE first_attested_year ≤ decade,
            attested = city's works have quotes for that doctrine
```


## Data-entry Mental Model

> **"If it's a connection between entities, put it in `relations.tsv`. Everything else derives automatically."**

| I want to record… | I edit… | What auto-derives… |
|---|---|---|
| Ignatius was bishop of Antioch | `relations.tsv`: person→bishop_of→city | footprint: person Ignatius → city:antioch |
| Ignatius's letters affirm episcopacy | `relations.tsv`: work→affirms→doctrine | footprint: doctrine→city:antioch, stance=affirms |
| Origen condemned adoptionism | `relations.tsv`: person→condemns→doctrine | footprint: doctrine→all Origen's cities, stance=condemns |
| Note mentions Tertullian | `notes.tsv`: body contains `[[person:tertullian]]` | `note_mentions.tsv`: note → person:tertullian |
