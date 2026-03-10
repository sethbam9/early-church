/**
 * All domain types for the data layer.
 * Single source of truth — imported by dataStore.ts and consumers.
 */

// ─── Enum types ──────────────────────────────────────────────────────────────

export type PlaceKind = "city" | "region" | "province" | "site" | "monastery" | "route" | "unknown";
export type LocationPrecision = "exact" | "approx_site" | "approx_city" | "approx_region" | "region_only" | "unknown";

export type PresenceStatus =
  | "attested"
  | "probable"
  | "possible"
  | "claimed_tradition"
  | "not_attested"
  | "suppressed"
  | "unknown";

export type PersonKind = "individual" | "anonymous_author" | "collective_author" | "composite_figure" | "unknown";

export type WorkType =
  | "letter" | "treatise" | "homily" | "commentary" | "rule"
  | "canon_list" | "dialogue" | "chronicle" | "apology" | "acta"
  | "inscription" | "other";

export type WorkKind = "single_work" | "collection" | "fragment" | "recension" | "inscription_unit";

export type EventType =
  | "council" | "martyrdom" | "mission" | "persecution"
  | "political" | "schism" | "literary" | "liturgical" | "other";

export type EventKind = "simple" | "composite" | "recurring" | "session";

export type GroupKind =
  | "communion" | "sect" | "school" | "order" | "faction"
  | "practice_stream" | "modern_heir" | "polity" | "unknown";

export type TopicKind = "doctrine" | "practice" | "office" | "canon" | "devotion" | "discipline" | "other";
export type DimensionKind = "binary" | "multivalue" | "continuum" | "descriptive";

export type SourceKind =
  | "primary_text" | "inscription" | "manuscript_catalog" | "modern_book"
  | "journal_article" | "reference_work" | "web_page" | "database" | "other";
export type PassageLocatorType = "bible_osis" | "source_ref";

export type EditorNoteKind = "commentary" | "todo" | "dispute" | "migration" | "rationale";

export type Certainty = "attested" | "probable" | "possible" | "claimed_tradition" | "legendary" | "unknown";
export type Polarity = "supports" | "opposes" | "neutral" | "mixed" | "not_applicable";
export type ClaimStatus = "active" | "deprecated" | "superseded" | "rejected" | "draft";
export type EvidenceRole = "supports" | "opposes" | "contextualizes" | "mentions";
export type ReviewStatus = "unreviewed" | "reviewed" | "approved" | "disputed" | "needs_revision";
export type ReviewConfidence = "low" | "medium" | "high";
export type ObjectMode = "entity" | "text" | "number" | "year" | "boolean";
export type CanonicalSortRule = "none" | "lexicographic_entity_ref" | "lexicographic_claim_pair";
export type MentionSourceType = "table_field" | "markdown_file";
export type DerivedStance = "" | "affirms" | "opposes" | "mixed" | "neutral";
export type Stance = "affirms" | "opposes" | "mixed" | "neutral" | "unknown";

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

// ─── Source table models ─────────────────────────────────────────────────────

export interface Place {
  place_id: string;
  place_label: string;
  place_label_modern: string;
  place_kind: PlaceKind;
  parent_place_id: string;
  lat: number | null;
  lon: number | null;
  location_precision: LocationPrecision;
  modern_country_label: string;
  notes: string;
}

export interface Person {
  person_id: string;
  person_label: string;
  name_alt: string[];
  name_native: string;
  birth_year_display: string;
  death_year_display: string;
  person_kind: PersonKind;
  notes: string;
}

export interface Work {
  work_id: string;
  title_display: string;
  title_original: string;
  work_type: WorkType;
  language_original: string;
  work_kind: WorkKind;
  notes: string;
}

export interface HistoricalEvent {
  event_id: string;
  event_label: string;
  event_type: EventType;
  event_kind: EventKind;
  notes: string;
}

export interface Group {
  group_id: string;
  group_label: string;
  group_kind: GroupKind;
  is_christian: boolean;
  notes: string;
}

export interface Topic {
  topic_id: string;
  topic_label: string;
  topic_kind: TopicKind;
  notes: string;
}

export interface Dimension {
  dimension_id: string;
  topic_id: string;
  dimension_label: string;
  dimension_kind: DimensionKind;
  notes: string;
}

export interface Proposition {
  proposition_id: string;
  topic_id: string;
  dimension_id: string;
  proposition_label: string;
  polarity_family: string;
  description: string;
  notes: string;
}

export interface PredicateType {
  predicate_id: string;
  predicate_label: string;
  subject_type: string;
  object_mode: ObjectMode;
  object_type: string;
  inverse_label: string;
  is_symmetric: boolean;
  canonical_sort_rule: string;
  allows_date_range: boolean;
  allows_context_place: boolean;
  description: string;
}

export interface SourceRecord {
  source_id: string;
  work_id: string;
  source_kind: SourceKind;
  title: string;
  author: string;
  editor: string;
  year: string;
  container_title: string;
  publisher: string;
  url: string;
  accessed_on: string;
  isbn_issn: string;
  notes: string;
}

export interface Passage {
  passage_id: string;
  source_id: string;
  locator_type: PassageLocatorType;
  locator: string;
  excerpt: string;
  language: string;
  passage_year: number | null;
  url_override: string;
  notes: string;
}

export interface Claim {
  claim_id: string;
  subject_type: string;
  subject_id: string;
  predicate_id: string;
  object_mode: ObjectMode;
  object_type: string;
  object_id: string;
  value_text: string;
  value_number: number | null;
  value_year: number | null;
  value_boolean: boolean | null;
  year_start: number | null;
  year_end: number | null;
  context_place_id: string;
  certainty: Certainty;
  polarity: Polarity;
  claim_status: ClaimStatus;
  created_by: string;
  updated_at: string;
}

export interface ClaimEvidence {
  claim_id: string;
  passage_id: string;
  evidence_role: EvidenceRole;
  excerpt_override: string;
  evidence_weight: number | null;
  notes: string;
}

export interface ClaimReview {
  claim_id: string;
  reviewer_id: string;
  review_status: ReviewStatus;
  reviewed_at: string;
  confidence: ReviewConfidence;
  note: string;
}

export interface EditorNote {
  editor_note_id: string;
  note_kind: EditorNoteKind;
  entity_type: string;
  entity_id: string;
  claim_id: string;
  body_md: string;
  created_by: string;
  created_at: string;
}

// ─── Derived table models ────────────────────────────────────────────────────

export interface EntityPlaceFootprint {
  entity_type: string;
  entity_id: string;
  place_id: string;
  year_start: number | null;
  year_end: number | null;
  reason_predicate_id: string;
  stance: DerivedStance;
  path_signature: string;
}

export interface PlaceStateByDecade {
  place_id: string;
  decade: number;
  presence_status: PresenceStatus;
  group_presence_summary: string[];
  dominant_polity_group_id: string;
  supporting_claim_count: number;
  derivation_hash: string;
}

export interface FirstAttestation {
  subject_type: string;
  subject_id: string;
  predicate_id: string;
  first_year: number | null;
  first_claim_id: string;
  first_passage_id: string;
}

export interface PropositionPlacePresence {
  proposition_id: string;
  place_id: string;
  year_start: number | null;
  year_end: number | null;
  stance: Stance;
  supporting_claim_count: number;
  opposing_claim_count: number;
  derivation_hash: string;
}

export interface NoteMention {
  mention_source_type: MentionSourceType;
  source_table: string;
  source_row_id: string;
  source_field: string;
  source_path: string;
  mentioned_type: MentionTargetType;
  mentioned_id: string;
  mention_label: string;
}

// ─── View helpers ────────────────────────────────────────────────────────────

/** A place enriched with its decade state for map rendering. */
export type PlaceAtDecade = Place & PlaceStateByDecade;

// ─── Selection / entity ref types ────────────────────────────────────────────

export type SelectionKind = EntityType | "bible";

export interface EntityRef {
  kind: SelectionKind;
  id: string;
}

export type HighlightEntry = EntityRef & { label: string };

export interface CorrespondenceArc {
  from: EntityRef;
  to: EntityRef;
  label: string;
}

export type Selection = {
  kind: SelectionKind;
  id: string;
};
