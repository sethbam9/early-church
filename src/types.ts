// Re-export all types from the domain layer for backward compatibility
export type {
  LocationPrecision,
  PresenceStatus,
  FilterState,
  Person,
  HistoricalEvent,
  Work,
  Doctrine,
  Quote,
  ArchaeologySite,
  Selection,
  HighlightEntry,
  CorrespondenceArc,
  EntityRef,
  PlaybackSpeed,
} from "./domain/types";

// Legacy alias
export type DrawerSelection =
  | { kind: "row"; id: string }
  | { kind: "poi"; id: string };
