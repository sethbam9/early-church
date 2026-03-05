/**
 * All domain types for the data layer.
 * Single source of truth — imported by dataStore.ts and consumers.
 */

export type LocationPrecision = "exact" | "approx_city" | "region_only" | "unknown";
export type PresenceStatus = "attested" | "probable" | "claimed_tradition" | "not_attested" | "suppressed" | "unknown";

export interface City {
  city_id: string;
  city_label: string;
  city_ancient: string;
  city_modern: string;
  country_modern: string;
  lat: number | null;
  lon: number | null;
  location_precision: LocationPrecision;
  christianity_start_year: number | null;
  church_planted_year_scholarly: number | null;
  church_planted_year_earliest_claim: number | null;
  church_planted_by: string;
  apostolic_origin_thread: string;
}

export interface PlaceState {
  place_id: string;
  decade: number;
  presence_status: PresenceStatus;
  persuasion_ids: string[];
  polity_id: string | null;
  ruling_subdivision: string;
  council_context: string;
  evidence_note_id: string | null;
}

export interface CityAtDecade extends City {
  place_id: string;
  decade: number;
  presence_status: PresenceStatus;
  persuasion_ids: string[];
  polity_id: string | null;
  ruling_subdivision: string;
  council_context: string;
  evidence_note_id: string | null;
}

export interface Person {
  person_id: string;
  person_label: string;
  name_alt: string[];
  birth_year: number | null;
  death_year: number | null;
  death_type: string;
  roles: string[];
  city_of_origin_id: string | null;
  apostolic_connection: string;
  description: string;
  wikipedia_url: string | null;
  citations: string[];
}

export interface Work {
  work_id: string;
  title_display: string;
  author_person_id: string | null;
  author_name_display: string;
  year_written_start: number | null;
  year_written_end: number | null;
  work_type: string;
  language: string;
  place_written_id: string | null;
  place_recipient_ids: string[];
  description: string;
  significance: string;
  modern_edition_url: string | null;
  citations: string[];
}

export interface Doctrine {
  doctrine_id: string;
  name_display: string;
  category: string;
  description: string;
  first_attested_year: number | null;
  first_attested_work_id: string | null;
  controversy_level: string;
  resolution: string;
  citations: string[];
}

export interface Quote {
  quote_id: string;
  doctrine_id: string;
  work_id: string | null;
  text: string;
  work_reference: string;
  year: number | null;
  stance: string;
  notes: string;
  citations: string[];
}

export interface HistoricalEvent {
  event_id: string;
  name_display: string;
  event_type: string;
  year_start: number | null;
  year_end: number | null;
  primary_place_id: string | null;
  region: string;
  key_figure_person_ids: string[];
  description: string;
  significance: string;
  outcome: string;
  citations: string[];
}

export interface ArchaeologySite {
  archaeology_id: string;
  name_display: string;
  site_type: string;
  city_id: string | null;
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

export interface Persuasion {
  persuasion_id: string;
  persuasion_label: string;
  persuasion_stream: string;
  year_start: number | null;
  year_end: number | null;
  description: string;
  wikipedia_url: string | null;
  citations: string[];
}

export interface Polity {
  polity_id: string;
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

export interface Place {
  place_id: string;
  place_type: string;
  place_label: string;
  lat: number | null;
  lon: number | null;
  location_precision: LocationPrecision;
  city_id: string | null;
  archaeology_id: string | null;
}

export interface Relation {
  relation_id: string;
  source_type: string;
  source_id: string;
  relation_type: string;
  target_type: string;
  target_id: string;
  year_start: number | null;
  year_end: number | null;
  weight: number | null;
  polarity: string;
  certainty: string;
  evidence_note_id: string | null;
  citations: string[];
}

export interface Note {
  note_id: string;
  year_bucket: number | null;
  year_exact: number | null;
  primary_entity_type: string;
  primary_entity_id: string;
  note_kind: string;
  body_md: string;
  citation_urls: string[];
}

export type FootprintStance = "affirms" | "condemns" | "neutral" | "";

export interface Footprint {
  entity_type: string;
  entity_id: string;
  place_id: string;
  year_start: number | null;
  year_end: number | null;
  weight: number | null;
  reason: string;
  stance: FootprintStance;
}

export interface NoteMention {
  note_id: string;
  mentioned_type: string;
  mentioned_slug: string;
}

export type EntityKind = "city" | "person" | "work" | "doctrine" | "event" | "archaeology" | "persuasion" | "polity";


export interface EntityRef {
  kind: EntityKind;
  id: string;
  label: string;
}

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

export type Selection =
  | { kind: "city"; id: string }
  | { kind: "person"; id: string }
  | { kind: "work"; id: string }
  | { kind: "doctrine"; id: string }
  | { kind: "event"; id: string }
  | { kind: "archaeology"; id: string }
  | { kind: "persuasion"; id: string }
  | { kind: "polity"; id: string }
  | { kind: "quote"; id: string }
  | { kind: "note"; id: string };
