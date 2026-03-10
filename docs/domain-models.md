# Domain Models for the App

Reference TypeScript domain model for the React/TypeScript app.

This file aligns with [`app-data.md`](./app-data.md) and assumes:

- source TSVs are normalized
- derived tables are regenerated
- map/UI layers consume view models rather than raw claims
- groups replace separate polity/persuasion entities
- place naming supports both historical/canonical and modern labels
- markdown links and Bible OSIS references are parsed into a shared mention index

---

## Core scalar types

```ts
export type Id = string;
export type Year = number;
export type DateTimeIso = string;
export type Markdown = string;
export type UrlString = string;
export type OsisRef = string;
```

---

## Enum types

```ts
export type EntityType =
  | "place"
  | "person"
  | "work"
  | "event"
  | "group"
  | "topic"
  | "dimension"
  | "proposition"
  | "source"
  | "passage"
  | "claim"
  | "editor_note";

export type MentionTargetType = EntityType | "bible";
export type MentionSourceType = "table_field" | "markdown_file";

export type ObjectMode = "entity" | "text" | "number" | "year" | "boolean";

export type Certainty =
  | "attested"
  | "probable"
  | "possible"
  | "claimed_tradition"
  | "legendary"
  | "unknown";

export type Polarity =
  | "supports"
  | "opposes"
  | "neutral"
  | "mixed"
  | "not_applicable";

export type ClaimStatus =
  | "active"
  | "deprecated"
  | "superseded"
  | "rejected"
  | "draft";

export type EvidenceRole =
  | "supports"
  | "opposes"
  | "contextualizes"
  | "mentions";

export type ReviewStatus =
  | "unreviewed"
  | "reviewed"
  | "approved"
  | "disputed"
  | "needs_revision";

export type ReviewConfidence = "low" | "medium" | "high";

export type DerivedStance = "" | "affirms" | "opposes" | "mixed" | "neutral";
export type Stance = "affirms" | "opposes" | "mixed" | "neutral" | "unknown";

export type PresenceStatus =
  | "attested"
  | "probable"
  | "possible"
  | "claimed_tradition"
  | "not_attested"
  | "suppressed"
  | "unknown";

export type CanonicalSortRule =
  | "none"
  | "lexicographic_entity_ref"
  | "lexicographic_claim_pair";

export type PlaceKind =
  | "city"
  | "region"
  | "province"
  | "site"
  | "monastery"
  | "route"
  | "unknown";

export type LocationPrecision =
  | "exact"
  | "approx_site"
  | "approx_city"
  | "approx_region"
  | "region_only"
  | "unknown";

export type PersonKind =
  | "individual"
  | "anonymous_author"
  | "collective_author"
  | "composite_figure"
  | "unknown";

export type WorkType =
  | "letter"
  | "treatise"
  | "homily"
  | "commentary"
  | "rule"
  | "canon_list"
  | "dialogue"
  | "chronicle"
  | "apology"
  | "acta"
  | "inscription"
  | "other";

export type WorkKind =
  | "single_work"
  | "collection"
  | "fragment"
  | "recension"
  | "inscription_unit";

export type EventType =
  | "council"
  | "martyrdom"
  | "mission"
  | "persecution"
  | "political"
  | "schism"
  | "literary"
  | "liturgical"
  | "other";

export type EventKind = "simple" | "composite" | "recurring" | "session";

export type GroupKind =
  | "communion"
  | "sect"
  | "school"
  | "order"
  | "faction"
  | "practice_stream"
  | "modern_heir"
  | "polity"
  | "unknown";

export type TopicKind =
  | "doctrine"
  | "practice"
  | "office"
  | "canon"
  | "devotion"
  | "discipline"
  | "other";

export type DimensionKind = "binary" | "multivalue" | "continuum" | "descriptive";

export type SourceKind =
  | "primary_text"
  | "inscription"
  | "manuscript_catalog"
  | "modern_book"
  | "journal_article"
  | "reference_work"
  | "web_page"
  | "database"
  | "other";

export type EditorNoteKind =
  | "commentary"
  | "todo"
  | "dispute"
  | "migration"
  | "rationale";
```

---

## Shared reference types

```ts
export interface EntityRef<T extends EntityType = EntityType> {
  entity_type: T;
  entity_id: Id;
}

export interface BibleRef {
  kind: "bible";
  osis: OsisRef;
}

export type MentionTargetRef = EntityRef | BibleRef;
export type EntityLookupKey = `${EntityType}:${Id}`;

export interface AuditFields {
  created_by?: string;
  created_at?: DateTimeIso;
  updated_at?: DateTimeIso;
}
```

---

## Source table models

### Place

```ts
export interface Place extends AuditFields {
  place_id: Id;
  place_label: string;
  place_label_modern: string | null;
  place_kind: PlaceKind;
  parent_place_id: Id | null;
  lat: number | null;
  lon: number | null;
  location_precision: LocationPrecision;
  modern_country_label: string | null;
  notes: Markdown | null;
}
```

### Person

```ts
export interface Person extends AuditFields {
  person_id: Id;
  person_label: string;
  name_alt: string | null;
  name_native: string | null;
  birth_year_display: string | null;
  death_year_display: string | null;
  person_kind: PersonKind;
  notes: Markdown | null;
}
```

### Work

```ts
export interface Work extends AuditFields {
  work_id: Id;
  title_display: string;
  title_original: string | null;
  work_type: WorkType;
  language_original: string | null;
  work_kind: WorkKind;
  notes: Markdown | null;
}
```

### HistoricalEvent

```ts
export interface HistoricalEvent extends AuditFields {
  event_id: Id;
  event_label: string;
  event_type: EventType;
  event_kind: EventKind;
  notes: Markdown | null;
}
```

### Group

```ts
export interface Group extends AuditFields {
  group_id: Id;
  group_label: string;
  group_kind: GroupKind;
  notes: Markdown | null;
}
```

### Topic / Dimension / Proposition

```ts
export interface Topic extends AuditFields {
  topic_id: Id;
  topic_label: string;
  topic_kind: TopicKind;
  notes: Markdown | null;
}

export interface Dimension extends AuditFields {
  dimension_id: Id;
  topic_id: Id;
  dimension_label: string;
  dimension_kind: DimensionKind;
  notes: Markdown | null;
}

export interface Proposition extends AuditFields {
  proposition_id: Id;
  topic_id: Id;
  dimension_id: Id | null;
  proposition_label: string;
  polarity_family: string | null;
  description: string | null;
  notes: Markdown | null;
}
```

### PredicateType / SourceRecord / Passage

```ts
export interface PredicateType extends AuditFields {
  predicate_id: Id;
  predicate_label: string;
  subject_type: EntityType;
  object_mode: ObjectMode;
  object_type: EntityType | null;
  inverse_label: string | null;
  is_symmetric: boolean;
  canonical_sort_rule: CanonicalSortRule;
  allows_date_range: boolean;
  allows_context_place: boolean;
  description: string | null;
}

export interface SourceRecord extends AuditFields {
  source_id: Id;
  source_kind: SourceKind;
  title: string;
  author: string | null;
  editor: string | null;
  year: number | null;
  container_title: string | null;
  publisher: string | null;
  url: UrlString | null;
  accessed_on: string | null;
  isbn_issn: string | null;
  notes: Markdown | null;
}

export interface Passage extends AuditFields {
  passage_id: Id;
  source_id: Id;
  locator: string;
  excerpt: string | null;
  language: string | null;
  passage_year: Year | null;
  url_override: UrlString | null;
  notes: Markdown | null;
}
```

---

## Claim models

```ts
export interface ClaimBase extends AuditFields {
  claim_id: Id;
  subject_type: EntityType;
  subject_id: Id;
  predicate_id: Id;
  object_mode: ObjectMode;
  year_start: Year | null;
  year_end: Year | null;
  context_place_id: Id | null;
  certainty: Certainty;
  polarity: Polarity;
  claim_status: ClaimStatus;
}

export interface EntityClaim extends ClaimBase {
  object_mode: "entity";
  object_type: EntityType;
  object_id: Id;
  value_text: null;
  value_number: null;
  value_year: null;
  value_boolean: null;
}

export interface TextClaim extends ClaimBase {
  object_mode: "text";
  object_type: null;
  object_id: null;
  value_text: string;
  value_number: null;
  value_year: null;
  value_boolean: null;
}

export interface NumberClaim extends ClaimBase {
  object_mode: "number";
  object_type: null;
  object_id: null;
  value_text: null;
  value_number: number;
  value_year: null;
  value_boolean: null;
}

export interface YearClaim extends ClaimBase {
  object_mode: "year";
  object_type: null;
  object_id: null;
  value_text: null;
  value_number: null;
  value_year: Year;
  value_boolean: null;
}

export interface BooleanClaim extends ClaimBase {
  object_mode: "boolean";
  object_type: null;
  object_id: null;
  value_text: null;
  value_number: null;
  value_year: null;
  value_boolean: boolean;
}

export type Claim =
  | EntityClaim
  | TextClaim
  | NumberClaim
  | YearClaim
  | BooleanClaim;
```

```ts
export interface ClaimEvidence extends AuditFields {
  claim_id: Id;
  passage_id: Id;
  evidence_role: EvidenceRole;
  excerpt_override: string | null;
  evidence_weight: number | null;
  notes: Markdown | null;
}

export interface ClaimReview extends AuditFields {
  claim_id: Id;
  reviewer_id: Id;
  review_status: ReviewStatus;
  reviewed_at: DateTimeIso | null;
  confidence: ReviewConfidence | null;
  note: string | null;
}

export interface EditorNote extends AuditFields {
  editor_note_id: Id;
  note_kind: EditorNoteKind;
  entity_type: EntityType | null;
  entity_id: Id | null;
  claim_id: Id | null;
  body_md: Markdown;
}
```

---

## Derived table models

```ts
export interface EntityPlaceFootprint {
  entity_type: EntityType;
  entity_id: Id;
  place_id: Id;
  year_start: Year | null;
  year_end: Year | null;
  reason_predicate_id: Id;
  stance: DerivedStance;
  path_signature: string;
}
```

```ts
export interface PlaceStateByDecade {
  place_id: Id;
  decade: number;
  presence_status: PresenceStatus;
  group_presence_summary: string | null;
  dominant_polity_group_id: Id | null;
  supporting_claim_count: number;
  derivation_hash: string;
}
```

```ts
export interface FirstAttestation {
  subject_type: EntityType;
  subject_id: Id;
  predicate_id: Id;
  first_year: Year | null;
  first_claim_id: Id | null;
  first_passage_id: Id | null;
}
```

```ts
export interface PropositionPlacePresence {
  proposition_id: Id;
  place_id: Id;
  year_start: Year | null;
  year_end: Year | null;
  stance: Stance;
  supporting_claim_count: number;
  opposing_claim_count: number;
  derivation_hash: string;
}
```

```ts
export interface NoteMention {
  mention_source_type: MentionSourceType;
  source_table: string | null;
  source_row_id: Id | null;
  source_field: string | null;
  source_path: string | null;
  mentioned_type: MentionTargetType;
  mentioned_id: Id | OsisRef;
  mention_label: string | null;
}
```

---

## View models used in the app

The UI should not force raw claims directly into React components. It should consume resolved view models.

```ts
export interface ResolvedClaim {
  claim: Claim;
  predicate: PredicateType;
  subject: EntityRef;
  object:
    | EntityRef
    | { kind: "text"; value: string }
    | { kind: "number"; value: number }
    | { kind: "year"; value: Year }
    | { kind: "boolean"; value: boolean };
  evidence: ClaimEvidence[];
  reviews: ClaimReview[];
}
```

```ts
export interface EntityDossier {
  ref: EntityRef;
  entity:
    | Place
    | Person
    | Work
    | HistoricalEvent
    | Group
    | Topic
    | Dimension
    | Proposition
    | SourceRecord
    | Passage
    | EditorNote;
  resolved_claims: ResolvedClaim[];
  editorial_notes: EditorNote[];
  footprints: EntityPlaceFootprint[];
  outgoing_mentions: NoteMention[];
  incoming_mentions: NoteMention[];
}
```

```ts
export interface PlaceMarker {
  place: Place;
  state: PlaceStateByDecade | null;
  footprints: EntityPlaceFootprint[];
  dominant_polity_group: Group | null;
}

export interface PropositionPlaceMarker {
  place: Place;
  presence: PropositionPlacePresence;
}
```

```ts
export interface SearchDocument {
  ref: EntityRef | BibleRef;
  label: string;
  secondary_label?: string | null;
  body_text: string;
  outgoing_mentions: NoteMention[];
}
```

---

## Selection model

The UI should no longer special-case separate polity or persuasion entities. It should select `group` and filter/group by `group_kind` when needed.

```ts
export type SelectionKind = EntityType | "bible";

export interface Selection {
  kind: SelectionKind;
  id: Id | OsisRef;
}
```

Examples:

- a polity filter selects a `group` whose `group_kind === "polity"`
- a doctrinal map selection targets a `proposition`
- Bible cross-reference clicks select `kind: "bible"`

---

## Repository interfaces

```ts
export interface Repository<T> {
  getAll(): T[];
  getById(id: Id): T | null;
}

export interface MentionRepository {
  getAll(): NoteMention[];
  getForEntity(ref: EntityRef): NoteMention[];
  getForBible(osis: OsisRef): NoteMention[];
  getOutgoingForSource(opts: {
    source_table?: string | null;
    source_row_id?: Id | null;
    source_field?: string | null;
    source_path?: string | null;
  }): NoteMention[];
}

export interface PlaceStateRepository {
  getByPlace(placeId: Id): PlaceStateByDecade[];
  getAtDecade(decade: number): PlaceStateByDecade[];
}
```

```ts
export interface AppRepositories {
  places: Repository<Place>;
  people: Repository<Person>;
  works: Repository<Work>;
  events: Repository<HistoricalEvent>;
  groups: Repository<Group>;
  topics: Repository<Topic>;
  dimensions: Repository<Dimension>;
  propositions: Repository<Proposition>;
  predicateTypes: Repository<PredicateType>;
  sources: Repository<SourceRecord>;
  passages: Repository<Passage>;
  claims: Repository<Claim>;
  editorNotes: Repository<EditorNote>;
  mentions: MentionRepository;
  footprints: {
    getForEntity(ref: EntityRef): EntityPlaceFootprint[];
    getForPlace(placeId: Id): EntityPlaceFootprint[];
  };
  placeState: PlaceStateRepository;
  propositionPresence: {
    getForProposition(propositionId: Id): PropositionPlacePresence[];
    getForPlace(placeId: Id): PropositionPlacePresence[];
  };
}
```

---

## App-facing implications

1. `Group` replaces separate polity/persuasion models.
2. `Place` now exposes both `place_label` and `place_label_modern`.
3. `PlaceStateByDecade` uses `dominant_polity_group_id`.
4. `NoteMention` is project-wide and can target both entities and Bible OSIS references.
5. Sorting and derivation stability belong to the validation/build layer, not to React selectors.
