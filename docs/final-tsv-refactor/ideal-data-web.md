---
description: Ideal data web / table schema for an interactive Early Christianity map UI
---

# Ideal Data Web (Proposed) — Interactive Map + Temporal + Network Cross‑Reference

## Goals (what the UI should make easy)

- **Global search that maps to geography**
  - Search a `work`, `doctrine`, `quote`, `person`, `persuasion`, `event`, or `archaeology` site.
  - Immediately highlight **where** it is represented on the map (and in what decades).

- **Temporal exploration**
  - A decade slider/time scrubber that changes:
    - which places are “active”
    - which persuasions are present
    - which networks (e.g., bishop correspondence) are relevant

- **Graph exploration**
  - Click an entity and traverse to related entities.
  - Show a network overlay (people-to-people, people-to-city, work-to-doctrine, etc.).

- **Evidence-first UX**
  - Any displayed claim should have citations and/or a note with a Mentions footer.

This document proposes an **ideal** set of tables and fields (no coding changes yet).


## What is manual vs derived (authoritative rules)

All TSVs live under:
- `data/final_data/`

**Manual TSVs (edited by hand)**
- `archaeology.tsv`
- `doctrines.tsv`
- `works.tsv`
- `events.tsv`
- `quotes.tsv`
- `relations.tsv`

**Derived TSVs (written by `scripts/build_final_data_from_final.ts`)**
- `cities.tsv`
- `people.tsv`
- `persuasions.tsv`
- `polities.tsv`
- `places.tsv`
- `place_state_by_decade.tsv`
- `entity_place_footprints.tsv`
- `notes.tsv`
- `note_mentions.tsv`
- `mappings/*` (token/canonicalization helpers)

`final.tsv` is currently a temporary upstream source used only by build scripts.


## Design principles

### Stable IDs + typed references

- Every “node” row has a stable string ID (slug) that **never encodes time**.
- Cross references use either:
  - **typed refs** in values: `person:ambrose-of-milan`
  - or explicit columns: `person_id`, `work_id`, etc.

### Time is always separate from identity

- Represent time with:
  - `year_start` / `year_end` (integers, inclusive)
  - `decade_start` / `decade_end` (integers, derived)

### Hybrid model: one universal relations table + a few “fact” tables

- Keep **one canonical relationships table** (`relations.tsv`) for *all* graph edges.
- Add **specialized fact tables** for the “hot-path” queries in an interactive map:
  - place state by decade (presence, persuasions, polity)
  - entity ↔ place footprints (precomputed where an entity shows up on the map)

### Notes remain human-readable, but mentions become queryable

- Keep your existing `notes.tsv` **Mentions footer convention**.
- Add `note_mentions.tsv` so the UI can query “which notes mention X” without parsing markdown at runtime.

**Important**: `notes.tsv` no longer stores temporal “state rows” (e.g. presence/persuasion/polity by decade).
- Temporal state is written directly to `place_state_by_decade.tsv`.
- Notes are for evidence/commentary and are referenced via `evidence_note_id`.


## Current reality (what exists today)

The current `data/final_data/*.tsv` schema already includes:

- Nodes:
  - `cities.tsv`
  - `people.tsv`
  - `persuasions.tsv`
  - `polities.tsv`
  - `works.tsv`
  - `doctrines.tsv`
  - `quotes.tsv`
  - `events.tsv`
  - `archaeology.tsv`


- Evidence:
  - `notes.tsv` (freeform evidence/commentary; temporal state is stored in `place_state_by_decade.tsv`)

This proposal keeps the spirit of that model, but makes IDs/time/join-keys more consistent and adds a few tables that dramatically improve map + search behavior.


## Proposed tables (ideal)

### 1) `places.tsv` (NEW: unify map-visible things)

**Purpose**: The map wants a single list of “things with coordinates.” Cities and archaeology sites both qualify.

- `place_id` (string, PK)
- `place_type` (enum: `city`, `archaeology`, `region_marker`)
- `label` (string)
- `lat` (float)
- `lon` (float)
- `location_precision` (enum: `exact`, `approx_city`, `region_only`, `unknown`)
- `city_id` (string, nullable; FK -> `cities.city_id`)
- `archaeology_id` (string, nullable; FK -> `archaeology.archaeology_id`)
- `notes` (string, optional)

**Notes**
- `cities.tsv` and `archaeology.tsv` remain the “detail tables.” `places.tsv` is the “map table.”


### 2) `cities.tsv` (node)

**Purpose**: Canonical city identity and geography.

Recommended fields:
- `city_id` (string, PK)  
- `city_label` (string)
- `city_ancient_primary` (string)
- `city_modern_primary` (string)
- `country_modern_primary` (string)
- `lat` (float)
- `lon` (float)
- `location_precision` (enum)
- `christianity_start_year` (int, nullable)

(Your current table is already close; main “ideal” change is standardizing the ID name.)


### 3) `persuasions.tsv` (node)

**Purpose**: Denomination/sect layer unified into one.

- `persuasion_id` (string, PK)
- `persuasion_label` (string)
- `persuasion_stream` (enum-ish string; e.g. `apostolic`, `gnostic`, `theological_party`, `jewish_christian`, `schism`, `practice`, `ascetic`, `prophetic`)
- `year_start` (int, nullable)
- `year_end` (int, nullable)
- `description` (string)
- `wikipedia_url` (string)
- `citations` (string; `;`-separated URLs)
- `notes` (string)


### 4) `people.tsv` (node)

- `person_id` (string, PK)
- `person_label` (string)
- `name_alt` (string)
- `birth_year` (int, nullable)
- `death_year` (int, nullable)
- `death_type` (enum-ish string; e.g. `martyrdom`, `natural`, `unknown`)
- `roles` (set of enums in a `;`-separated string; e.g. `bishop;theologian`)
- `city_of_origin_id` (string, nullable; FK -> `cities.city_id`)
- `apostolic_connection` (string)
- `description` (string)
- `wikipedia_url` (string)
- `citations` (string)
- `notes` (string)


### 5) `works.tsv` (node)

**Key principle**: `work_id` is stable; place/time are separate.

- `work_id` (string, PK)
- `title_display` (string)
- `author_person_id` (string, nullable; FK -> `people.person_id`)
- `author_name_display` (string; allow anonymous)
- `year_written_start` (int, nullable)
- `year_written_end` (int, nullable)
- `work_type` (enum-ish: `letter`, `treatise`, `canon`, `creed`, `homily`, `chronicle`, `rule`, `other`)
- `language` (string)
- `place_written_id` (string, nullable; FK -> `places.place_id`)
- `place_recipient_ids` (string, nullable; `;`-separated FK -> `places.place_id`) 
- `description` (string)
- `significance` (string)
- `modern_edition_url` (string)
- `citations` (string)


### 6) `doctrines.tsv` (node)

- `doctrine_id` (string, PK)
- `name_display` (string)
- `category` (enum-ish string)
- `description` (string)
- `first_attested_year` (int, nullable)
- `first_attested_work_id` (string, nullable; FK -> `works.work_id`)
- `controversy_level` (enum: `low`, `medium`, `high`)
- `resolution` (string)
- `citations` (string)


### 6b) `quotes.tsv` (node)

Quotes are a first-class entity used for doctrine exploration.

**Rule**: A quote ties to a doctrine and a work.

- `quote_id` (string, PK)
- `doctrine_id` (string, FK -> `doctrines.doctrine_id`)
- `work_id` (string, FK -> `works.work_id`)
- `text` (string)
- `work_reference` (string)
- `year` (int, nullable)
- `stance` (enum-ish: `affirming`, `condemning`, `neutral`, `questioning`, `developing`)
- `notes` (string)
- `citations` (string; `;`-separated URLs)


### 7) `events.tsv` (node)

Events are important because they provide time anchors.

- `event_id` (string, PK)
- `name_display` (string)
- `event_type` (enum-ish: `council`, `persecution`, `political`, `martyrdom`, `missionary`, `liturgical`, `schism`, `other`)
- `year_start` (int)
- `year_end` (int)
- `primary_place_id` (string, nullable; FK -> `places.place_id`)
- `region` (string)
- `key_figure_person_ids` (string; `;`-separated FK -> `people.person_id`)
- `description` (string)
- `significance` (string)
- `outcome` (string)
- `citations` (string)


### 8) `archaeology.tsv` (node)

- `archaeology_id` (string, PK)
- `name_display` (string)
- `site_type` (enum-ish: `house-church`, `basilica`, `catacomb`, `inscription`, `monastery`, `other`)
- `city_id` (string, nullable; FK -> `cities.city_id`)
- `lat` (float, nullable)
- `lon` (float, nullable)
- `location_precision` (enum: `exact`, `approx_city`, `region_only`, `unknown`)
- `year_start` (int, nullable)
- `year_end` (int, nullable)
- `description` (string)
- `significance` (string)
- `discovery_notes` (string)
- `current_status` (enum-ish: `extant`, `destroyed`, `partially_preserved`, `unknown`)
- `uncertainty` (string)
- `citations` (string)


### 9) `polities.tsv` (node)

- `polity_id` (string, PK)
- `polity_label` (string)
- `name_alt` (string)
- `year_start` (int, nullable)
- `year_end` (int, nullable)
- `capital` (string)
- `region` (string)
- `description` (string)
- `wikipedia_url` (string)
- `citations` (string)


## Relationship model

### 10) `relations.tsv`

This is the universal graph edge table.

- `relation_id` (string, PK)
- `source_type` (enum: `place`, `city`, `person`, `work`, `doctrine`, `event`, `archaeology`, `persuasion`, `polity`, `note`)
- `source_id` (string)
- `relation_type` (string enum; examples below)
- `target_type` (same enum)
- `target_id` (string)
- `year_start` (int, nullable)
- `year_end` (int, nullable)
- `weight` (int, nullable; UI intensity)
- `polarity` (enum: `supports`, `opposes`, `neutral`, nullable)
- `certainty` (enum: `attested`, `probable`, `claimed_tradition`, `legendary`, `unknown`, nullable)
- `evidence_note_id` (string, nullable; FK -> `notes.note_id`)
- `citations` (string; `;`-separated URLs)

**Examples of `relation_type`**

- People ↔ places
  - `bishop_of`, `active_in`, `visited`, `martyred_in`, `born_in`
- People ↔ people
  - `disciple_of`, `corresponded_with`, `opposed`, `taught`, `consecrated_by`
- Works ↔ doctrines
  - `affirms`, `denies`, `develops`, `first_mentions`
- Works ↔ places
  - `written_in`, `sent_to`
- Events ↔ doctrines
  - `defined`, `condemned`, `affirmed`
- Archaeology ↔ doctrines/persuasions
  - `attests`, `associated_with`


## Evidence model

### 11) `notes.tsv` (keep; but add IDs)

Current notes are already close to the ideal; the main ideal upgrade is adding stable IDs.

- `note_id` (string, PK)
- `year_bucket` (int)
- `primary_entity_type` (enum)
- `primary_entity_id` (string)
- `note_kind` (enum: `evidence`, `commentary`, etc.)
- `body_md` (markdown string)
- `citation_urls` (`;`-separated URLs)


### 12) `note_mentions.tsv` (NEW)

Pre-parsed mention join table.

- `note_id` (string, FK -> `notes.note_id`)
- `mentioned_type` (enum)
- `mentioned_id` (string)


## Map-specific “fact” tables (hot-path for interactivity)

### 13) `place_state_by_decade.tsv` (NEW)

- `place_id` (string, FK -> `places.place_id`)
- `decade` (int)
- `presence_status` (enum: `attested`, `probable`, `claimed_tradition`, `unknown`, etc.)
- `persuasion_ids` (string; `;`-separated FK -> `persuasions.persuasion_id`)
- `polity_id` (string, nullable; FK -> `polities.polity_id`)
- `ruling_subdivision` (string, nullable)
- `church_planted_year_scholarly` (int, nullable)
- `church_planted_year_earliest_claim` (int, nullable)
- `church_planted_by` (string, nullable)
- `apostolic_origin_thread` (string, nullable)
- `council_context` (string, nullable)
- `evidence_note_id` (string, nullable; FK -> `notes.note_id`)


### 14) `entity_place_footprints.tsv` (NEW)

This table powers the UX requirement:
> “I search for a work/doctrine/person and see on the map where it is represented.”

It is a **precomputed index** mapping any entity to places.

- `entity_type` (enum)
- `entity_id` (string)
- `place_id` (string)
- `year_start` (int, nullable)
- `year_end` (int, nullable)
- `reason_relation_ids` (string; `;`-separated relation IDs that justify the footprint)
- `weight` (int, nullable)

**Examples**
- For a `work`: footprint includes `place_written_id` and `place_recipient_ids`.
- For a `doctrine`: footprint includes places of works that affirm/deny it.
- For a `person`: footprint includes cities they were bishop of / active in / visited.


## How cross-references answer your “ideal UI” questions

### “Show me where gnosticism is present in 180–220”

- Primary: `place_state_by_decade` filtered by `persuasion_ids contains gnostic`
- Evidence: join `evidence_note_id` to `notes.tsv`

### “Show the correspondence network between bishops (overlay on map) in decade 110”

- Network: `relations` where `relation_type=corresponded_with` and time overlaps decade
- Place anchoring:
  - join each person to their `bishop_of` relation(s) active in that decade
  - render lines between their bishop-cities

### “Doctrine ↔ archaeology”

- Direct: `relations` with `archaeology -> attests -> doctrine`
- Indirect (via works): `archaeology -> located_in -> place` plus `work -> sent_to/written_in -> place` plus `work -> affirms -> doctrine`


## Recommended normalization changes (for later implementation)

- **Remove decade prefixes embedded in IDs** (e.g., `0090-rome-rome`).
  - Replace with stable IDs (`rome-rome`) + separate time ranges.
- Prefer a `places` layer so all map markers share one schema.
- Add `note_id` and `note_mentions` to make evidence discoverable and linkable.
- Add `entity_place_footprints` to power search-to-map instantly.


## Migration strategy (high-level)

- Phase 1: Keep existing tables; add `note_mentions.tsv` and `places.tsv`.
- Phase 2: Introduce `place_state_by_decade.tsv` as a denormalized cache derived from notes/state.
- Phase 3: Standardize IDs (remove decade prefixes) and update relationships to use stable IDs.
- Phase 4: Add `entity_place_footprints.tsv` (or build it at runtime, then cache).
