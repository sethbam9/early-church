// ─── Enums & Literal Types ───────────────────────────────────────────────────

export type LocationPrecision = "exact" | "approx_city" | "region_only" | "unknown";

export type PresenceStatus =
  | "attested"
  | "probable"
  | "claimed_tradition"
  | "not_attested"
  | "suppressed"
  | "unknown";

export type DeathType = "natural" | "martyr" | "unknown";

export type EventType =
  | "council"
  | "persecution"
  | "synod"
  | "martyrdom"
  | "schism"
  | "political"
  | "liturgical"
  | "missionary"
  | "other";

export type WorkType =
  | "letter"
  | "apology"
  | "treatise"
  | "homily"
  | "canon"
  | "creed"
  | "chronicle"
  | "inscription"
  | "rule"
  | "gospel"
  | "other";

export type DoctrineCategory =
  | "christology"
  | "ecclesiology"
  | "soteriology"
  | "sacraments"
  | "mariology"
  | "eschatology"
  | "liturgy"
  | "praxis"
  | "canon"
  | "other";

export type SiteType =
  | "house-church"
  | "basilica"
  | "catacomb"
  | "baptistery"
  | "monastery"
  | "inscription"
  | "martyrium"
  | "mosaic"
  | "other";

export type Stance =
  | "affirming"
  | "condemning"
  | "neutral"
  | "questioning"
  | "developing";

export type EntityType = "person" | "event" | "work" | "doctrine" | "city" | "archaeology";

export type CurrentStatus = "extant" | "destroyed" | "partially_preserved" | "unknown";

export type ControversyLevel = "low" | "medium" | "high";

// ─── Citation / Evidence ─────────────────────────────────────────────────────

export interface CitationToken {
  value: string;
  isValid: boolean;
}

export interface EvidenceSections {
  summary: string;
  uncertainty: string;
  evidence: string;
  citations: string;
  raw: string;
}

// ─── City (from final.tsv) ───────────────────────────────────────────────────

export interface ChurchRow {
  id: string;
  year_bucket: number;
  date_range: string;
  city_ancient: string;
  city_modern: string;
  country_modern: string;
  lat: number | null;
  lon: number | null;
  location_precision: LocationPrecision;
  ruling_empire_polity: string;
  ruling_subdivision: string;
  church_presence_status: PresenceStatus;
  church_planted_year_earliest_claim: number | null;
  church_planted_year_scholarly: number | null;
  church_planted_by: string;
  apostolic_origin_thread: string;
  key_figures: string;
  key_figures_list: string[];
  denomination_label_historic: string;
  denomination_label_historic_values: string[];
  modern_denom_mapping: string;
  modern_denom_mapping_values: string[];
  council_context: string;
  evidence_notes_and_citations: string;
  evidence_sections: EvidenceSections;
  citation_tokens: CitationToken[];
  citations_valid: string[];
  hasValidCoordinates: boolean;
}

// ─── Person ──────────────────────────────────────────────────────────────────

export interface Person {
  id: string;
  name_display: string;
  name_alt: string[];
  birth_year: number | null;
  death_year: number | null;
  death_type: DeathType;
  roles: string[];
  city_of_origin_id: string | null;
  apostolic_connection: string;
  description: string;
  wikipedia_url: string | null;
  citations: string[];
}

// ─── Historical Event ────────────────────────────────────────────────────────

export interface HistoricalEvent {
  id: string;
  name_display: string;
  event_type: EventType;
  year_start: number;
  year_end: number | null;
  decade_bucket: number;
  city_id: string | null;
  city_ancient: string;
  region: string;
  key_figure_ids: string[];
  description: string;
  significance: string;
  outcome: string;
  citations: string[];
}

// ─── Work ────────────────────────────────────────────────────────────────────

export interface Work {
  id: string;
  title_display: string;
  author_id: string | null;
  author_name_display: string;
  year_written_earliest: number;
  year_written_latest: number;
  decade_bucket: number;
  work_type: WorkType;
  city_written_id: string | null;
  city_recipient_ids: string[];
  language: string;
  description: string;
  significance: string;
  modern_edition_url: string | null;
  citations: string[];
}

// ─── Doctrine ────────────────────────────────────────────────────────────────

export interface Doctrine {
  id: string;
  name_display: string;
  category: DoctrineCategory;
  description: string;
  first_attested_year: number | null;
  first_attested_work_id: string | null;
  controversy_level: ControversyLevel;
  resolution: string;
  citations: string[];
}

// ─── Quote ───────────────────────────────────────────────────────────────────

export interface Quote {
  id: string;
  doctrine_id: string;
  text: string;
  source_type: "primary" | "secondary" | "modern_scholar";
  author_id: string | null;
  author_name: string;
  work_id: string | null;
  work_reference: string;
  year: number;
  decade_bucket: number;
  stance: Stance;
  notes: string;
  citations: string[];
}

// ─── Archaeology Site ────────────────────────────────────────────────────────

export interface ArchaeologySite {
  id: string;
  name_display: string;
  site_type: SiteType;
  city_id: string | null;
  city_ancient: string;
  lat: number | null;
  lon: number | null;
  location_precision: LocationPrecision;
  year_start: number;
  year_end: number | null;
  decade_bucket_start: number;
  description: string;
  significance: string;
  discovery_notes: string;
  current_status: CurrentStatus;
  uncertainty: string;
  citations: string[];
}

// ─── Edge (Relationship Graph) ───────────────────────────────────────────────

export interface Edge {
  id: string;
  source_type: EntityType;
  source_id: string;
  relationship: string;
  target_type: EntityType;
  target_id: string;
  decade_start: number | null;
  decade_end: number | null;
  weight: number;
  notes: string;
  citations: string[];
}

// ─── Empire ──────────────────────────────────────────────────────────────────

export interface Empire {
  id: string;
  name_display: string;
  name_alt: string[];
  year_start: number;
  year_end: number | null;
  capital: string;
  region: string;
  description: string;
  wikipedia_url: string | null;
  citations: string[];
}

// ─── Denomination ────────────────────────────────────────────────────────────

export interface Denomination {
  id: string;
  name_display: string;
  name_alt: string[];
  tradition: string;
  year_start: number;
  year_end: number | null;
  founder: string;
  parent_tradition: string;
  description: string;
  modern_descendants: string;
  wikipedia_url: string | null;
  citations: string[];
}

// ─── Selection / Highlight ───────────────────────────────────────────────────

export type Selection =
  | { kind: "city"; id: string }
  | { kind: "person"; id: string }
  | { kind: "event"; id: string }
  | { kind: "work"; id: string }
  | { kind: "doctrine"; id: string }
  | { kind: "archaeology"; id: string }
  | { kind: "empire"; id: string }
  | { kind: "denomination"; id: string };

export interface HighlightEntry {
  color: string;
  label: string;
  intensity: 1 | 2 | 3;
}

export interface CorrespondenceArc {
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  relationship: string;
  weight: number;
  label: string;
}

export interface EntityRef {
  type: EntityType;
  id: string;
}

// ─── Indexed Data Artifact (build output for cities) ─────────────────────────

export interface FilterFacets {
  church_presence_status: string[];
  ruling_empire_polity: string[];
  denomination_label_historic: string[];
  modern_denom_mapping: string[];
}

export interface IndexedDataArtifact {
  yearBuckets: number[];
  dateRangeByYear: Record<string, string>;
  rows: ChurchRow[];
  byYearBucket: Record<string, string[]>;
  cumulativeByYearBucket: Record<string, string[]>;
  indexByChurchPresenceStatus: Record<string, string[]>;
  indexByRulingEmpirePolity: Record<string, string[]>;
  indexByDenominationLabelHistoric: Record<string, string[]>;
  indexByModernDenomMapping: Record<string, string[]>;
  searchTextById: Record<string, string>;
  facets: FilterFacets;
}

// ─── Featured POI (legacy, keep for backward compat) ─────────────────────────

export interface FeaturedPoi {
  id: string;
  name: string;
  lat: number;
  lon: number;
  location_precision: LocationPrecision;
  start_year: number;
  end_year: number | null;
  description: string;
  uncertainty: string;
  citation_tokens: CitationToken[];
  citations_valid: string[];
}

// ─── Essay ───────────────────────────────────────────────────────────────────

export interface EssayDocument {
  id: string;
  title: string;
  content: string;
}

// ─── Filter State ────────────────────────────────────────────────────────────

export interface FilterState {
  church_presence_status: string[];
  ruling_empire_polity: string[];
  denomination_label_historic: string[];
  modern_denom_mapping: string[];
}

// ─── Right Panel ─────────────────────────────────────────────────────────────

export type RightPanel = "chronicle" | "events" | "doctrines" | "correspondence" | "works" | "archaeology" | "empires" | "denominations" | "essays" | "details";

// ─── Playback ────────────────────────────────────────────────────────────────

export type PlaybackSpeed = 1 | 2 | 5;
