# Core Domain Models

How the app's TypeScript types map to the data, and how to migrate to a DB later.

---

## Principles

1. **Every entity has a stable string ID** — never encode time or location in an ID.
2. **Time is always a separate field** — `year_start` / `year_end`, never embedded in identity.
3. **Geography is a join** — entities don't own coordinates; they reference a `place_id`.
4. **Relations are first-class** — the graph is in `relations.tsv`, not in per-entity columns.
5. **Static data lives once** — city-planting metadata is on `City`, not repeated per decade.
6. **Derived state is pre-computed** — `places.tsv`, `entity_place_footprints.tsv`, and `note_mentions.tsv` are derive-script outputs, never edited manually.

---

## Node entities

### City
Canonical geographic unit. Corresponds to `cities.tsv`.

```ts
interface City {
  city_id: string;              // PK
  city_label: string;
  city_ancient: string;         // col: city_ancient_primary
  city_modern: string;          // col: city_modern_primary
  country_modern: string;       // col: country_modern_primary
  lat: number | null;
  lon: number | null;
  location_precision: "exact" | "approx_city" | "region_only" | "unknown";
  christianity_start_year: number | null;
  // Static church-planting metadata (moved from place_state_by_decade)
  church_planted_year_scholarly: number | null;
  church_planted_year_earliest_claim: number | null;
  church_planted_by: string;
  apostolic_origin_thread: string;
}
```

### Place
Map-visible thing. A city, or an archaeology site with its own coordinates. Corresponds to `places.tsv` (DERIVED).

```ts
interface Place {
  place_id: string;         // PK, formatted "city:CITY_ID" or "archaeology:ARCH_ID"
  place_type: "city" | "archaeology";
  place_label: string;
  lat: number | null;
  lon: number | null;
  location_precision: "exact" | "approx_city" | "region_only" | "unknown";
  city_id: string | null;           // FK → City
  archaeology_id: string | null;    // FK → Archaeology
}
```

### PlaceState
Temporal map state for a place at a specific decade. Corresponds to `place_state_by_decade.tsv`.

```ts
interface PlaceState {
  place_id: string;             // FK → Place
  decade: number;
  presence_status: PresenceStatus;
  persuasion_ids: string[];     // FK → Persuasion (semicolon-separated in TSV)
  polity_id: string | null;     // FK → Polity
  ruling_subdivision: string;
  council_context: string;
  evidence_note_id: string | null;  // FK → Note
}
```

### CityAtDecade
Merged view of City + PlaceState (used by the map). `City` fields are inherited, so church-planting metadata is available.

```ts
interface CityAtDecade extends City {
  place_id: string;
  decade: number;
  presence_status: PresenceStatus;
  persuasion_ids: string[];
  polity_id: string | null;
  ruling_subdivision: string;
  council_context: string;
  evidence_note_id: string | null;
}
```

### Person
Historical figure. Corresponds to `people.tsv`.

```ts
interface Person {
  person_id: string;        // PK
  person_label: string;
  name_alt: string[];
  birth_year: number | null;
  death_year: number | null;
  death_type: string;       // "martyrdom" | "natural" | "unknown"
  roles: string[];          // semicolon-separated in TSV: "bishop;theologian"
  city_of_origin_id: string | null;  // FK → City
  apostolic_connection: string;
  description: string;
  wikipedia_url: string | null;
  citations: string[];
}
```

### Work
Primary source text. Corresponds to `works.tsv`.

```ts
interface Work {
  work_id: string;          // PK
  title_display: string;
  author_person_id: string | null;   // FK → Person
  author_name_display: string;
  year_written_start: number | null;
  year_written_end: number | null;
  work_type: string;        // see enum-schema.md
  language: string;
  place_written_id: string | null;   // FK → Place (formatted "city:…")
  place_recipient_ids: string[];     // semicolon-separated FK → Place
  description: string;
  significance: string;
  modern_edition_url: string | null;
  citations: string[];
}
```

### Doctrine
A theological claim or practice. Corresponds to `doctrines.tsv`.

```ts
interface Doctrine {
  doctrine_id: string;      // PK
  name_display: string;
  category: string;         // see enum-schema.md
  description: string;
  first_attested_year: number | null;
  first_attested_work_id: string | null;  // FK → Work
  controversy_level: string; // "low" | "medium" | "high"
  resolution: string;
  citations: string[];
}
```

### Quote
Verbatim evidence quote. Corresponds to `quotes.tsv`.

```ts
interface Quote {
  quote_id: string;         // PK
  doctrine_id: string;      // FK → Doctrine
  work_id: string | null;   // FK → Work
  text: string;
  work_reference: string;
  year: number | null;
  stance: string;           // "supports" | "opposes" | "neutral" | "developing"
  notes: string;
  citations: string[];
}
```

### HistoricalEvent
Historical event. Corresponds to `events.tsv`.

```ts
interface HistoricalEvent {
  event_id: string;         // PK
  name_display: string;
  event_type: string;       // see enum-schema.md
  year_start: number | null;
  year_end: number | null;
  primary_place_id: string | null;   // FK → Place
  region: string;
  key_figure_person_ids: string[];   // FK → Person
  description: string;
  significance: string;
  outcome: string;
  citations: string[];
}
```

### ArchaeologySite
Physical archaeological site. Corresponds to `archaeology.tsv`.

```ts
interface ArchaeologySite {
  archaeology_id: string;   // PK
  name_display: string;
  site_type: string;        // see enum-schema.md
  city_id: string | null;   // FK → City
  lat: number | null;
  lon: number | null;
  location_precision: LocationPrecision;
  year_start: number | null;
  year_end: number | null;
  description: string;
  significance: string;
  discovery_notes: string;
  current_status: string;
  uncertainty: string;
  citations: string[];
}
```

### Persuasion
Theological tradition/stream. Corresponds to `persuasions.tsv`.

```ts
interface Persuasion {
  persuasion_id: string;    // PK
  persuasion_label: string;
  persuasion_stream: string; // see enum-schema.md
  year_start: number | null;
  year_end: number | null;
  description: string;
  wikipedia_url: string | null;
  citations: string[];
}
```

### Polity
Political entity. Corresponds to `polities.tsv`.

```ts
interface Polity {
  polity_id: string;        // PK
  polity_label: string;
  name_alt: string[];
  year_start: number | null;
  year_end: number | null;
  capital: string;
  region: string;
  description: string;
  wikipedia_url: string | null;
  citations: string[];
}
```

---

## Relation model

### Relation
Universal graph edge. Corresponds to `relations.tsv`.

```ts
interface Relation {
  relation_id: string;      // PK
  source_type: string;
  source_id: string;
  relation_type: string;    // see enum-schema.md
  target_type: string;
  target_id: string;
  year_start: number | null;
  year_end: number | null;
  weight: number | null;
  polarity: string;         // "supports" | "opposes" | "neutral"
  certainty: string;        // "attested" | "probable" | "claimed_tradition" | "legendary" | "unknown"
  evidence_note_id: string | null;  // FK → Note
  citations: string[];
}
```

**The `polarity` field on `work→affirms→doctrine` and `person→affirms→doctrine` relations drives footprint stance derivation and the doctrine city map.**

---

## Evidence model

### Note
Evidence or commentary. Corresponds to `notes.tsv`.

```ts
interface Note {
  note_id: string;          // PK — 10-char SHA-1 hash of content
  year_bucket: number | null;
  year_exact: number | null;
  primary_entity_type: string;
  primary_entity_id: string;
  note_kind: string;        // "evidence" | "commentary"
  body_md: string;          // may contain [[type:id|label]] mention tags
  citation_urls: string[];
}
```

### NoteMention
Pre-parsed mention join. Corresponds to `note_mentions.tsv` (DERIVED from `notes.tsv`).

```ts
interface NoteMention {
  note_id: string;          // FK → Note
  mentioned_type: string;
  mentioned_slug: string;
}
```

Derived by `scripts/derive_mentions.ts`. Access via `dataStore.noteMentions.getMentioning(type, id)`.

---

## Footprint model

### Footprint
Precomputed entity↔place index. Corresponds to `entity_place_footprints.tsv` (DERIVED).

```ts
type FootprintStance = "affirms" | "condemns" | "neutral" | "";

interface Footprint {
  entity_type: string;
  entity_id: string;
  place_id: string;         // FK → Place
  year_start: number | null;
  year_end: number | null;
  weight: number | null;
  reason: string;           // e.g. "bishop_of", "written_in", "via_work_affirms"
  stance: FootprintStance;  // non-empty only for doctrine footprints
}
```

Derived by `scripts/derive_footprints.ts`. Access via:
- `dataStore.footprints.getForEntity(type, id)` — all places for an entity
- `dataStore.footprints.getForPlace(placeId)` — all entities at a place
- `dataStore.footprints.getDoctrineFootprintsForCity(cityId)` — doctrine stances for a city

**Doctrine city map flow:**
1. `dataStore.footprints.getForEntity("doctrine", id)` returns footprints with `stance`.
2. Group by `place_id`, pick dominant stance → color city markers on map.

---

## DataStore access patterns

```ts
// Entity lookups
dataStore.cities.getById(id)
dataStore.people.getById(id)
dataStore.works.getByAuthor(personId)
dataStore.quotes.getByDoctrine(doctrineId)
dataStore.relations.getForEntity(type, id)
dataStore.notes.getForEntity(type, id)

// Map data
dataStore.map.getCumulativeCitiesAtDecade(decade)   // CityAtDecade[]
dataStore.map.getPlaceStatesForCity(cityId)          // PlaceState[]

// Footprints
dataStore.footprints.getForEntity(type, id)          // Footprint[]
dataStore.footprints.getForPlace(placeId)            // Footprint[]

// Note mentions (cross-reference: "all notes that mention X")
dataStore.noteMentions.getMentioning(type, id)       // NoteMention[]
```

---

## Implementation status

**All tables implemented and validated.** Run `npm run data:validate` to regenerate and verify.

**Derive pipeline** (`npm run data:derive`):
- `scripts/derive_places.ts` → `data/places.tsv`
- `scripts/derive_footprints.ts` → `data/entity_place_footprints.tsv`
- `scripts/derive_mentions.ts` → `data/note_mentions.tsv`

**Source files** (edited directly in `data/`):
- `cities.tsv`, `people.tsv`, `persuasions.tsv`, `polities.tsv`
- `works.tsv`, `events.tsv`, `doctrines.tsv`, `quotes.tsv`
- `archaeology.tsv`, `relations.tsv`, `notes.tsv`
- `place_state_by_decade.tsv`

**Migration note**: `scripts/migrate_static_to_cities.ts` was a one-time migration that moved `church_planted_year_scholarly`, `church_planted_year_earliest_claim`, `church_planted_by`, `apostolic_origin_thread` from `place_state_by_decade.tsv` to `cities.tsv` (run 2026-03-05).

**Future**: `final.tsv` and `build_final_data_from_final.ts` will be deleted once all historical data is migrated to the manual TSVs above.
