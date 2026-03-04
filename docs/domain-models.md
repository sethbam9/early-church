# Core Domain Models

How the app's TypeScript types should map to the data web, and how to migrate to a DB later.

---

## Principles

1. **Every entity has a stable string ID** — never encode time or location in an ID.
2. **Time is always a separate field** — `year_start` / `year_end`, never embedded in identity.
3. **Geography is a join** — entities don't own coordinates; they reference a `place_id`.
4. **Relations are first-class** — the graph is in `relations.tsv`, not in per-entity columns.
5. **Derived state is pre-computed** — `place_state_by_decade` and `entity_place_footprints` are caches, not source of truth.

---

## Node entities

### City
Canonical geographic unit. Corresponds to `cities.tsv`.

```ts
interface City {
  city_id: string;          // PK
  city_label: string;
  city_ancient_primary: string;
  city_modern_primary: string;
  country_modern_primary: string;
  lat: number | null;
  lon: number | null;
  location_precision: "exact" | "approx_city" | "region_only" | "unknown";
  christianity_start_year: number | null;
}
```

### Place
Map-visible thing. A city, or an archaeology site with its own coordinates. Corresponds to `places.tsv`.

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

### Person
Historical figure. Corresponds to `people.tsv`.

```ts
interface Person {
  person_id: string;        // PK
  person_label: string;
  name_alt: string;
  birth_year: number | null;
  death_year: number | null;
  death_type: string;       // "martyrdom" | "natural" | "unknown"
  roles: string;            // semicolon-separated: "bishop;theologian"
  city_of_origin_id: string | null;  // FK → City
  apostolic_connection: string;
  description: string;
  wikipedia_url: string;
  citations: string;
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
  year_written_start: number;
  year_written_end: number;
  work_type: "letter" | "treatise" | "canon" | "creed" | "homily" | "chronicle" | "rule" | "other";
  language: string;
  place_written_id: string | null;   // FK → Place (formatted "city:…")
  place_recipient_ids: string;       // semicolon-separated FK → Place
  description: string;
  significance: string;
  modern_edition_url: string;
  citations: string;
}
```

### Doctrine
A theological claim or practice. Corresponds to `doctrines.tsv`.

```ts
interface Doctrine {
  doctrine_id: string;      // PK
  name_display: string;
  category: string;         // "sacraments" | "christology" | "ecclesiology" | …
  description: string;
  first_attested_year: number | null;
  first_attested_work_id: string | null;  // FK → Work
  controversy_level: "low" | "medium" | "high";
  resolution: string;
  citations: string;
}
```

### Quote
Verbatim evidence tying a doctrine to a work. Corresponds to `quotes.tsv`.

```ts
interface Quote {
  quote_id: string;         // PK
  doctrine_id: string;      // FK → Doctrine
  work_id: string | null;   // FK → Work
  text: string;
  work_reference: string;   // e.g. "Smyrnaeans 8"
  year: number | null;
  stance: "affirming" | "condemning" | "neutral" | "questioning" | "developing";
  notes: string;
  citations: string;
}
```

### Event
A datable historical occurrence. Corresponds to `events.tsv`.

```ts
interface Event {
  event_id: string;         // PK
  name_display: string;
  event_type: "council" | "persecution" | "political" | "martyrdom" | "missionary" | "liturgical" | "schism" | "other";
  year_start: number;
  year_end: number | null;
  primary_place_id: string | null;      // FK → Place
  region: string;
  key_figure_person_ids: string;        // semicolon-separated FK → Person
  description: string;
  significance: string;
  outcome: string;
  citations: string;
}
```

### Archaeology
A physical site or artefact with geographic coordinates. Corresponds to `archaeology.tsv`.

```ts
interface Archaeology {
  archaeology_id: string;   // PK
  name_display: string;
  site_type: string;        // "house-church" | "basilica" | "catacomb" | "inscription" | …
  city_id: string | null;   // FK → City
  lat: number | null;
  lon: number | null;
  location_precision: "exact" | "approx_city" | "region_only" | "unknown";
  year_start: number | null;
  year_end: number | null;
  description: string;
  significance: string;
  discovery_notes: string;
  current_status: string;   // "extant" | "destroyed" | "partially_preserved" | "unknown"
  uncertainty: string;
  citations: string;
}
```

### Persuasion
A theological tradition, sect, or practice stream. Corresponds to `persuasions.tsv`.

```ts
interface Persuasion {
  persuasion_id: string;    // PK
  persuasion_label: string;
  persuasion_stream: string;  // "apostolic" | "gnostic" | "theological_party" | "jewish_christian" | "schism" | "practice" | "ascetic" | "prophetic"
  year_start: number | null;
  year_end: number | null;
  description: string;
  wikipedia_url: string;
  citations: string;
}
```

### Polity
A political entity that controlled territory. Corresponds to `polities.tsv`.

```ts
interface Polity {
  polity_id: string;        // PK
  polity_label: string;
  name_alt: string;
  year_start: number | null;
  year_end: number | null;
  capital: string;
  region: string;
  description: string;
  wikipedia_url: string;
  citations: string;
}
```

---

## Edge / relation entities

### Relation
Universal graph edge. Corresponds to `relations.tsv`.

```ts
type RelationNodeType = "place" | "city" | "person" | "work" | "doctrine" | "event" | "archaeology" | "persuasion" | "polity" | "note";

interface Relation {
  relation_id: string;      // PK
  source_type: RelationNodeType;
  source_id: string;
  relation_type: string;    // e.g. "bishop_of" | "affirms" | "martyred_in" | "disciple_of"
  target_type: RelationNodeType;
  target_id: string;
  year_start: number | null;
  year_end: number | null;
  weight: number | null;
  polarity: "supports" | "opposes" | "neutral" | null;
  certainty: "attested" | "probable" | "claimed_tradition" | "legendary" | "unknown" | null;
  evidence_note_id: string | null;  // FK → Note
  citations: string;
}
```

---

## Evidence entities

### Note
Human-readable evidence or commentary. Corresponds to `notes.tsv`.

```ts
interface Note {
  note_id: string;          // PK (stable content hash)
  year_bucket: number;
  year_exact: number | null;
  primary_entity_type: string;
  primary_entity_id: string;
  note_kind: "evidence" | "commentary";
  body_md: string;          // may contain [[type:id]] mention tags
  citation_urls: string;    // semicolon-separated
}
```

### NoteMention
Pre-parsed join of note → mentioned entity. Corresponds to `note_mentions.tsv`.

```ts
interface NoteMention {
  note_id: string;          // FK → Note
  mentioned_type: string;
  mentioned_slug: string;
}
```

---

## Pre-computed fact tables

### PlaceStateByDecade
Denormalized temporal state of a place per decade. Derived from `final.tsv`. Corresponds to `place_state_by_decade.tsv`.

```ts
type PresenceStatus = "attested" | "probable" | "claimed_tradition" | "not_attested" | "suppressed" | "unknown";

interface PlaceStateByDecade {
  place_id: string;         // FK → Place
  decade: number;           // e.g. 100 = "100s CE"
  presence_status: PresenceStatus;
  persuasion_ids: string;   // semicolon-separated FK → Persuasion
  polity_id: string | null; // FK → Polity
  ruling_subdivision: string;
  church_planted_year_scholarly: number | null;
  church_planted_year_earliest_claim: number | null;
  church_planted_by: string;
  apostolic_origin_thread: string;
  council_context: string;
  evidence_note_id: string | null;  // FK → Note
}
```

### EntityPlaceFootprint
Pre-computed mapping of any entity to the places it is associated with, over time. Corresponds to `entity_place_footprints.tsv`.

```ts
type EntityType = "person" | "event" | "work" | "doctrine" | "city" | "archaeology" | "persuasion" | "polity";

interface EntityPlaceFootprint {
  entity_type: EntityType;
  entity_id: string;        // FK into the entity's own table
  place_id: string;         // FK → Place
  year_start: number | null;
  year_end: number | null;
  weight: number | null;    // 1–5; higher = more significant association
  reason: string;           // e.g. "written_in" | "sent_to" | "presence" | "via_work_affirms"
}
```

---

## DB migration notes

When moving from TSV files to a relational DB (e.g. SQLite, Postgres):

- Each interface above maps to a table 1:1.
- All `_id` fields are `TEXT PRIMARY KEY` or `TEXT REFERENCES`.
- Semicolon-separated multi-value columns (`persuasion_ids`, `place_recipient_ids`, etc.) become join tables.
- `EntityPlaceFootprint` and `PlaceStateByDecade` stay as denormalized caches — populate them via a migration script, not application logic.
- `Note.note_id` is a content-hash — recalculate if body changes, do not auto-increment.
- `Relation` is the single authoritative edge table; never re-introduce `edges`.
