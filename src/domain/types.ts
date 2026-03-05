// Re-export domain types from data layer for backward compatibility
export type {
  LocationPrecision,
  PresenceStatus,
  City,
  PlaceState,
  CityAtDecade,
  Person,
  Work,
  Doctrine,
  Quote,
  HistoricalEvent,
  ArchaeologySite,
  Persuasion,
  Polity,
  Place,
  Relation,
  Note,
  Footprint,
  EntityKind,
  EntityRef,
  HighlightEntry,
  CorrespondenceArc,
  Selection,
} from "../data/dataStore";

// Import types for aliases
import type { CityAtDecade, Relation, EntityKind } from "../data/dataStore";

// Export aliases for repositories
export type ChurchRow = CityAtDecade;
export type Edge = Relation;
export type EntityType = EntityKind;

// ─── UI-only types ────────────────────────────────────────────────────────────

export type PlaybackSpeed = 1 | 2 | 5;

export type ActiveView = "map" | "people" | "works" | "doctrines" | "events" | "archaeology" | "graph";

export interface FilterState {
  presenceStatus: string[];
  persuasionIds: string[];
  polityIds: string[];
}
