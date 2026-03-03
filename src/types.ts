// Re-export all types from the domain layer for backward compatibility
export type {
  LocationPrecision,
  PresenceStatus,
  CitationToken,
  EvidenceSections,
  ChurchRow,
  FilterFacets,
  IndexedDataArtifact,
  FeaturedPoi,
  EssayDocument,
  FilterState,
  Person,
  HistoricalEvent,
  Work,
  Doctrine,
  Quote,
  ArchaeologySite,
  Edge,
  Selection,
  HighlightEntry,
  CorrespondenceArc,
  EntityRef,
  EntityType,
  RightPanel,
  PlaybackSpeed,
} from "./domain/types";

// Legacy alias
export type DrawerSelection =
  | { kind: "row"; id: string }
  | { kind: "poi"; id: string };
