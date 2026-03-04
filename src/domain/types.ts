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

// ─── UI-only types ────────────────────────────────────────────────────────────

export type PlaybackSpeed = 1 | 2 | 5;

export type ActiveView = "map" | "people" | "works" | "doctrines" | "events" | "archaeology" | "graph";

export interface FilterState {
  presenceStatus: string[];
  persuasionIds: string[];
  polityIds: string[];
}
