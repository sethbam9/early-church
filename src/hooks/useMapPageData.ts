import { useMemo } from "react";
import { useAppStore } from "../stores/appStore";
import { dataStore } from "../data/dataStore";
import type { PlaceAtDecade } from "../data/dataStore";

// === Place search index ===

function buildPlaceSearchIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const place of dataStore.places.getAll()) {
    const parts: string[] = [
      place.place_label,
      place.place_label_modern,
      place.modern_country_label,
      place.place_kind,
      place.notes,
    ];

    // Footprints at this place
    for (const fp of dataStore.footprints.getForPlace(place.place_id)) {
      const entityLabel = dataStore.places.getById(fp.entity_id)?.place_label
        ?? dataStore.people.getById(fp.entity_id)?.person_label
        ?? dataStore.groups.getById(fp.entity_id)?.group_label
        ?? fp.entity_id;
      parts.push(entityLabel, fp.entity_type, fp.reason_predicate_id);
    }

    // Groups from place states
    for (const ps of dataStore.map.getPlaceStatesForPlace(place.place_id)) {
      for (const gid of ps.group_presence_summary) {
        const g = dataStore.groups.getById(gid);
        if (g) parts.push(g.group_label, g.group_kind);
      }
    }

    index.set(place.place_id, parts.join(" ").toLowerCase());
  }
  return index;
}

export const PLACE_SEARCH_INDEX = buildPlaceSearchIndex();

// === Get place IDs connected to an entity via footprints ===

export function getConnectedPlaceIds(selection: { kind: string; id: string } | null): Set<string> {
  if (!selection) return new Set();
  const fps = dataStore.footprints.getForEntity(selection.kind, selection.id);
  return new Set(fps.map((f) => f.place_id));
}

// === Arc entry type ===

export type ArcEntry = { a: PlaceAtDecade; b: PlaceAtDecade; label: string };

// === Hook ===

export function useMapPageData() {
  const activeDecade      = useAppStore((s) => s.activeDecade);
  const includeCumulative = useAppStore((s) => s.includeCumulative);
  const selection         = useAppStore((s) => s.selection);
  const activeFilters     = useAppStore((s) => s.activePresenceFilters);
  const placeKindFilter   = useAppStore((s) => s.activePlaceKindFilter);
  const christianOnly     = useAppStore((s) => s.christianOnly);
  const showArcs          = useAppStore((s) => s.showArcs);
  const mapFilterType     = useAppStore((s) => s.mapFilterType);
  const mapFilterId       = useAppStore((s) => s.mapFilterId);
  const searchQuery       = useAppStore((s) => s.searchQuery);

  const decades = dataStore.map.getDecades();

  // Visible places
  const visiblePlaces = useMemo<PlaceAtDecade[]>(() => {
    const base = includeCumulative
      ? dataStore.map.getCumulativePlacesAtDecade(activeDecade)
      : dataStore.map.getPlacesAtDecade(activeDecade);

    let result = base;

    // Presence filter
    if (activeFilters.length > 0) {
      result = result.filter((p) => activeFilters.includes(p.presence_status));
    }

    // Place kind filter
    if (placeKindFilter) {
      result = result.filter((p) => p.place_kind === placeKindFilter);
    }

    // Christian only filter
    if (christianOnly) {
      result = result.filter((p) => dataStore.map.placeHasChristianity(p.place_id));
    }

    // Map entity filter (group / person / proposition)
    if (mapFilterType && mapFilterId) {
      if (mapFilterType === "group") {
        result = result.filter((p) => p.group_presence_summary.includes(mapFilterId));
      } else if (mapFilterType === "person" || mapFilterType === "work" || mapFilterType === "event") {
        const placeIds = getConnectedPlaceIds({ kind: mapFilterType, id: mapFilterId });
        result = result.filter((p) => placeIds.has(p.place_id));
      } else if (mapFilterType === "proposition") {
        const ppp = dataStore.propositionPlacePresence.getForProposition(mapFilterId);
        const placeIds = new Set(ppp.map((pp) => pp.place_id));
        result = result.filter((p) => placeIds.has(p.place_id));
      }
    }

    // Global text search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) => PLACE_SEARCH_INDEX.get(p.place_id)?.includes(q) ?? false);
    }

    return result;
  }, [activeDecade, includeCumulative, activeFilters, placeKindFilter, christianOnly, mapFilterType, mapFilterId, searchQuery]);

  // Proposition stance lookup (used for marker coloring)
  // Activates both when map filter is proposition AND when a proposition is selected in the right panel
  const propositionStanceMap = useMemo<Map<string, string>>(() => {
    const propId = (mapFilterType === "proposition" && mapFilterId)
      ? mapFilterId
      : (selection?.kind === "proposition" ? selection.id : null);
    if (!propId) return new Map();
    const ppp = dataStore.propositionPlacePresence.getForProposition(propId);
    const map = new Map<string, string>();
    for (const entry of ppp) {
      map.set(entry.place_id, entry.stance || "unknown");
    }
    return map;
  }, [mapFilterType, mapFilterId, selection]);

  // Arc data
  const arcPairs = useMemo<ArcEntry[]>(() => {
    if (!showArcs || !selection || selection.kind !== "work") return [];

    function makeFakePlace(placeId: string): PlaceAtDecade | null {
      const p = dataStore.places.getById(placeId);
      if (!p || p.lat == null || p.lon == null) return null;
      return {
        ...p,
        decade: activeDecade,
        presence_status: "unknown",
        group_presence_summary: [],
        dominant_polity_group_id: "",
        supporting_claim_count: 0,
        derivation_hash: "",
      };
    }

    const workClaims = dataStore.claims.getForSubject("work", selection.id).filter((claim) => claim.claim_status === "active");
    const originIds = workClaims
      .filter((claim) => claim.object_mode === "entity" && claim.object_type === "place" && claim.predicate_id === "written_at")
      .map((claim) => claim.object_id);
    const destinationIds = workClaims
      .filter((claim) => claim.object_mode === "entity" && claim.object_type === "place" && claim.predicate_id === "addressed_to_place")
      .map((claim) => claim.object_id);

    if (originIds.length === 0 || destinationIds.length === 0) return [];

    const origins = [...new Set(originIds)].map(makeFakePlace).filter(Boolean) as PlaceAtDecade[];
    const destinations = [...new Set(destinationIds)].map(makeFakePlace).filter(Boolean) as PlaceAtDecade[];
    const workLabel = dataStore.works.getById(selection.id)?.title_display ?? selection.id;
    const pairs: ArcEntry[] = [];
    for (const origin of origins) {
      for (const destination of destinations) {
        if (origin.place_id === destination.place_id) continue;
        pairs.push({
          a: origin,
          b: destination,
          label: `${workLabel}: ${origin.place_label} → ${destination.place_label}`,
        });
      }
    }
    return pairs.slice(0, 80);
  }, [showArcs, selection, activeDecade]);

  return {
    decades, visiblePlaces, propositionStanceMap, arcPairs,
    // Re-export store values that the component needs
    activeDecade, selection, searchQuery,
  };
}
