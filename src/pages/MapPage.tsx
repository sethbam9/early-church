import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import L, { type LayerGroup, type Map as LeafletMap } from "leaflet";
import { useAppStore } from "../stores/appStore";
import { dataStore } from "../data/dataStore";
import type { PlaceAtDecade } from "../data/dataStore";
import { LeftPanel } from "../components/map/LeftPanel";
import { RightSidebar } from "../components/map/RightSidebar";
import { PRESENCE_COLORS, KIND_ICONS } from "../components/shared/entityConstants";
import { Hl } from "../components/shared/Hl";

// ─── Place search index ──────────────────────────────────────────────────────

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

const PLACE_SEARCH_INDEX = buildPlaceSearchIndex();

// ─── Get place IDs connected to an entity via footprints ─────────────────────

function getConnectedPlaceIds(selection: { kind: string; id: string } | null): Set<string> {
  if (!selection) return new Set();
  const fps = dataStore.footprints.getForEntity(selection.kind, selection.id);
  return new Set(fps.map((f) => f.place_id));
}

// ─── MapPage ──────────────────────────────────────────────────────────────────

export function MapPage() {
  // ── Store state ───────────────────────────────────────────────────────────
  const activeDecade      = useAppStore((s) => s.activeDecade);
  const includeCumulative = useAppStore((s) => s.includeCumulative);
  const isPlaying         = useAppStore((s) => s.isPlaying);
  const playbackSpeed     = useAppStore((s) => s.playbackSpeed);
  const selection         = useAppStore((s) => s.selection);
  const activeFilters     = useAppStore((s) => s.activePresenceFilters);
  const placeKindFilter   = useAppStore((s) => s.activePlaceKindFilter);
  const christianOnly     = useAppStore((s) => s.christianOnly);
  const showArcs          = useAppStore((s) => s.showArcs);
  const mapFilterType     = useAppStore((s) => s.mapFilterType);
  const mapFilterId       = useAppStore((s) => s.mapFilterId);
  const searchQuery       = useAppStore((s) => s.searchQuery);
  const leftPanelVisible  = useAppStore((s) => s.leftPanelVisible);
  const rightPanelVisible = useAppStore((s) => s.rightPanelVisible);

  const setDecade         = useAppStore((s) => s.setDecade);
  const setIsPlaying      = useAppStore((s) => s.setIsPlaying);
  const setSelection      = useAppStore((s) => s.setSelection);
  const setSidebarTab     = useAppStore((s) => s.setSidebarTab);
  const toggleLeftPanel   = useAppStore((s) => s.toggleLeftPanel);
  const toggleRightPanel  = useAppStore((s) => s.toggleRightPanel);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef          = useRef<LeafletMap | null>(null);
  const rowLayerRef     = useRef<LayerGroup | null>(null);
  const arcLayerRef     = useRef<LayerGroup | null>(null);
  const didFitRef       = useRef(false);

  const decades   = dataStore.map.getDecades();

  // ── Visible data ──────────────────────────────────────────────────────────

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

  // ── Arc data ──────────────────────────────────────────────────────────────

  type ArcEntry = { a: PlaceAtDecade; b: PlaceAtDecade; label: string };

  const arcPairs = useMemo<ArcEntry[]>(() => {
    if (!showArcs || !selection) return [];

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

    const fps = dataStore.footprints.getForEntity(selection.kind, selection.id);
    const placeIds = [...new Set(fps.map((f) => f.place_id))];
    const places = placeIds.map(makeFakePlace).filter(Boolean) as PlaceAtDecade[];

    if (places.length < 2) return [];

    const label = `${dataStore.places.getById(selection.id)?.place_label ?? selection.id}`;
    const pairs: ArcEntry[] = [];
    for (let i = 0; i < places.length - 1; i++) {
      for (let j = i + 1; j < places.length; j++) {
        const pa = places[i], pb = places[j];
        if (pa && pb) pairs.push({ a: pa, b: pb, label });
      }
    }
    return pairs.slice(0, 80);
  }, [showArcs, selection, activeDecade]);

  // ── Map initialization ────────────────────────────────────────────────────

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      worldCopyJump: true,
      zoomControl: true,
      maxZoom: 18,
    }).setView([37, 26], 4);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      },
    ).addTo(map);

    rowLayerRef.current = L.layerGroup().addTo(map);
    arcLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current      = null;
      rowLayerRef.current = null;
      arcLayerRef.current = null;
      didFitRef.current   = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Playback timer ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isPlaying) return;
    const ms = Math.max(200, Math.round(1400 / playbackSpeed));
    const timer = window.setInterval(() => {
      const cur = useAppStore.getState();
      const idx = decades.indexOf(cur.activeDecade);
      if (idx >= decades.length - 1) { setIsPlaying(false); return; }
      setDecade(decades[idx + 1] ?? cur.activeDecade);
    }, ms);
    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, decades, setDecade, setIsPlaying]);

  // ── Render place markers ──────────────────────────────────────────────────

  useEffect(() => {
    const map    = mapRef.current;
    const rowLyr = rowLayerRef.current;
    if (!map || !rowLyr) return;

    rowLyr.clearLayers();

    const bounds: L.LatLngExpression[] = [];
    const selPlaceId = selection?.kind === "place" ? selection.id : null;

    // Connected place IDs for non-place selections
    const connectedPlaceIds = selection?.kind !== "place" ? getConnectedPlaceIds(selection) : new Set<string>();
    const hasEntityHighlight = connectedPlaceIds.size > 0;

    for (const place of visiblePlaces) {
      if (place.lat == null || place.lon == null) continue;
      const isSelected  = place.place_id === selPlaceId;
      const isConnected = connectedPlaceIds.has(place.place_id);
      const isDimmed    = hasEntityHighlight && !isConnected && !isSelected;
      const color       = PRESENCE_COLORS[place.presence_status] ?? "#8e8070";
      const r           = isSelected ? 9 : isConnected ? 8 : 6;

      // Selected ring
      if (isSelected) {
        L.circleMarker([place.lat, place.lon], {
          radius: 17, color: "#c47c3a", weight: 2.5,
          fillColor: "transparent", fillOpacity: 0,
          dashArray: "5 4",
        }).addTo(rowLyr);
      }

      if (isConnected && !isSelected) {
        L.circleMarker([place.lat, place.lon], {
          radius: 14, color: "#c47c3a", weight: 2,
          fillColor: "transparent", fillOpacity: 0,
        }).addTo(rowLyr);
      }

      const m = L.circleMarker([place.lat, place.lon], {
        radius: r,
        color: isSelected ? "#c47c3a" : isConnected ? "#e8943a" : color,
        weight: isSelected ? 2.5 : isConnected ? 2 : 1.2,
        fillColor: isConnected ? "#e8943a" : color,
        fillOpacity: isSelected ? 1 : isDimmed ? 0.22 : isConnected ? 0.92 : 0.78,
      });

      const modernPart = place.place_label_modern && place.place_label_modern !== place.place_label
        ? ` (${place.place_label_modern})`
        : "";
      m.bindTooltip(
        `${place.place_label}${modernPart}, ${place.modern_country_label} [${place.place_kind}]`,
        { direction: "top", offset: [0, -4], className: "city-tooltip" },
      );
      m.on("click", () => {
        setSelection({ kind: "place", id: place.place_id });
        setSidebarTab("places");
        if (!rightPanelVisible) toggleRightPanel();
      });
      m.addTo(rowLyr);
      bounds.push([place.lat, place.lon]);
    }

    // Ghost marker for selected place not in visible set
    if (selPlaceId && !visiblePlaces.some((p) => p.place_id === selPlaceId)) {
      const ghost = dataStore.places.getById(selPlaceId);
      if (ghost && ghost.lat != null && ghost.lon != null) {
        L.circleMarker([ghost.lat, ghost.lon], {
          radius: 17, color: "#c47c3a", weight: 2.5,
          fillColor: "transparent", fillOpacity: 0, dashArray: "5 4",
        }).addTo(rowLyr);
        const gm = L.circleMarker([ghost.lat, ghost.lon], {
          radius: 9, color: "#c47c3a", weight: 2.5,
          fillColor: "#c47c3a", fillOpacity: 0.45,
        });
        gm.bindTooltip(`${ghost.place_label} (not in this decade)`,
          { direction: "top", offset: [0, -4], className: "city-tooltip" });
        gm.on("click", () => {
          setSelection({ kind: "place", id: selPlaceId });
          setSidebarTab("places");
          if (!rightPanelVisible) toggleRightPanel();
        });
        gm.addTo(rowLyr);
      }
    }

    if (!didFitRef.current && bounds.length > 0) {
      try { map.fitBounds(L.latLngBounds(bounds).pad(0.1)); } catch (_) {}
      didFitRef.current = true;
    }
  }, [visiblePlaces, selection, setSelection, setSidebarTab, rightPanelVisible, toggleRightPanel]);

  // ── Render arcs ───────────────────────────────────────────────────────────

  useEffect(() => {
    const arcLyr = arcLayerRef.current;
    if (!arcLyr) return;
    arcLyr.clearLayers();

    for (const { a, b, label } of arcPairs) {
      if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) continue;
      const line = L.polyline([[a.lat, a.lon], [b.lat, b.lon]], {
        color: "#c47c3a",
        weight: 1.4,
        opacity: 0.45,
        dashArray: "4 4",
      });
      if (label) {
        line.bindTooltip(label, { sticky: true, className: "arc-tooltip", direction: "auto" });
      }
      line.addTo(arcLyr);
    }
  }, [arcPairs]);

  // ── Invalidate map size on layout changes ─────────────────────────────────

  useEffect(() => {
    const t = window.setTimeout(() => mapRef.current?.invalidateSize(), 160);
    return () => window.clearTimeout(t);
  }, [leftPanelVisible, rightPanelVisible]);

  // ── Map action callbacks ──────────────────────────────────────────────────

  const handleFitVisible = useCallback(() => {
    const map = mapRef.current;
    const pts = visiblePlaces.filter((p) => p.lat != null && p.lon != null);
    if (!map || pts.length === 0) return;
    map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat!, p.lon!])).pad(0.1));
  }, [visiblePlaces]);

  const handleCenterSelected = useCallback(() => {
    const map = mapRef.current;
    if (!map || !selection) return;
    if (selection.kind === "place") {
      const place = dataStore.places.getById(selection.id);
      if (place?.lat != null && place?.lon != null) map.setView([place.lat, place.lon], 10, { animate: true });
    }
  }, [selection]);

  const handleRandomPlace = useCallback(() => {
    const pts = visiblePlaces.filter((p) => p.lat != null && p.lon != null);
    if (!pts.length) return;
    const place = pts[Math.floor(Math.random() * pts.length)];
    if (!place) return;
    setSelection({ kind: "place", id: place.place_id });
    setSidebarTab("places");
    const map = mapRef.current;
    if (map && place.lat != null && place.lon != null) map.setView([place.lat, place.lon], 7, { animate: true });
  }, [visiblePlaces, setSelection, setSidebarTab]);

  const handleFlyToPlace = useCallback((placeId: string) => {
    const map = mapRef.current;
    const place = dataStore.places.getById(placeId);
    if (map && place?.lat != null && place?.lon != null) {
      map.setView([place.lat, place.lon], 7, { animate: true });
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="map-layout">
      {/* Left panel */}
      {leftPanelVisible && (
        <div className="map-left">
          <LeftPanel
            visiblePlaceCount={visiblePlaces.length}
            onFitVisible={handleFitVisible}
            onCenterSelected={handleCenterSelected}
            onRandomPlace={handleRandomPlace}
          />
        </div>
      )}

      {/* Map center */}
      <div className="map-center">
        <div ref={mapContainerRef} id="map-root" />

        {/* Map overlay buttons */}
        <div className="map-overlays">
          {!leftPanelVisible && (
            <button type="button" className="map-overlay-btn" onClick={toggleLeftPanel} title="Show controls">
              ◀ Controls
            </button>
          )}
          {!rightPanelVisible && (
            <button type="button" className="map-overlay-btn map-overlay-btn--right" onClick={toggleRightPanel} title="Show sidebar">
              Sidebar ▶
            </button>
          )}
        </div>

        {/* Search results overlay */}
        {searchQuery.trim() && (
          <SearchResultsPanel
            query={searchQuery.trim()}
            activeDecade={activeDecade}
            matchedPlaceIds={new Set(visiblePlaces.map((p) => p.place_id))}
            onClear={() => useAppStore.getState().setSearchQuery("")}
          />
        )}
      </div>

      {/* Right sidebar */}
      {rightPanelVisible && (
        <div className="map-right">
          <RightSidebar
            onFlyToPlace={handleFlyToPlace}
            currentDecade={activeDecade}
          />
        </div>
      )}
    </div>
  );
}

// ─── Search Results Panel ─────────────────────────────────────────────────────

const SEARCH_PAGE_SIZE = 20;

interface SearchMatch {
  kind: string;
  id: string;
  label: string;
  sub: string;
}

function SearchResultsPanel({
  query,
  activeDecade,
  matchedPlaceIds,
  onClear,
}: {
  query: string;
  activeDecade: number;
  matchedPlaceIds: Set<string>;
  onClear: () => void;
}) {
  const setSelection  = useAppStore((s) => s.setSelection);
  const setSidebarTab = useAppStore((s) => s.setSidebarTab);
  const toggleRight   = useAppStore((s) => s.toggleRightPanel);
  const rightVisible  = useAppStore((s) => s.rightPanelVisible);
  const [page, setPage] = useState(0);

  const q = query.toLowerCase();

  const matches = useMemo((): SearchMatch[] => {
    const results: SearchMatch[] = [];

    for (const place of dataStore.places.getAll()) {
      const blob = PLACE_SEARCH_INDEX.get(place.place_id) ?? "";
      if (!blob.includes(q)) continue;
      results.push({
        kind: "place", id: place.place_id,
        label: place.place_label, sub: `${place.modern_country_label} · ${place.place_kind}`,
      });
    }

    for (const p of dataStore.people.getAll()) {
      const blob = [p.person_label, ...p.name_alt, p.notes].join(" ").toLowerCase();
      if (!blob.includes(q)) continue;
      results.push({ kind: "person", id: p.person_id, label: p.person_label, sub: p.person_kind });
    }

    for (const w of dataStore.works.getAll()) {
      const blob = [w.title_display, w.work_type, w.notes].join(" ").toLowerCase();
      if (!blob.includes(q)) continue;
      results.push({ kind: "work", id: w.work_id, label: w.title_display, sub: w.work_type });
    }

    for (const g of dataStore.groups.getAll()) {
      const blob = [g.group_label, g.group_kind, g.notes].join(" ").toLowerCase();
      if (!blob.includes(q)) continue;
      results.push({ kind: "group", id: g.group_id, label: g.group_label, sub: g.group_kind });
    }

    for (const e of dataStore.events.getAll()) {
      const blob = [e.event_label, e.event_type, e.notes].join(" ").toLowerCase();
      if (!blob.includes(q)) continue;
      results.push({ kind: "event", id: e.event_id, label: e.event_label, sub: e.event_type });
    }

    for (const p of dataStore.propositions.getAll()) {
      const blob = [p.proposition_label, p.description, p.polarity_family].join(" ").toLowerCase();
      if (!blob.includes(q)) continue;
      results.push({ kind: "proposition", id: p.proposition_id, label: p.proposition_label, sub: "proposition" });
    }

    results.sort((a, b) => a.label.localeCompare(b.label));
    return results;
  }, [q]);

  useEffect(() => { setPage(0); }, [q]);

  const totalPages = Math.ceil(matches.length / SEARCH_PAGE_SIZE);
  const pageItems  = matches.slice(page * SEARCH_PAGE_SIZE, (page + 1) * SEARCH_PAGE_SIZE);

  const handleSelect = (kind: string, id: string) => {
    setSelection({ kind: kind as import("../data/dataStore").Selection["kind"], id });
    if (kind === "place") setSidebarTab("places");
    if (!rightVisible) toggleRight();
  };

  if (matches.length === 0) return null;

  return (
    <div className="search-results-panel">
      <div className="search-results-header">
        <span className="search-results-title">
          {matches.length} match{matches.length !== 1 ? "es" : ""} for &ldquo;{query}&rdquo;
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {totalPages > 1 && (
            <span style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>
              {page + 1} / {totalPages}
            </span>
          )}
          <button type="button" className="close-btn" onClick={onClear} title="Clear search">✕</button>
        </div>
      </div>

      <div className="search-results-list">
        {pageItems.map((m) => (
          <button
            key={`${m.kind}:${m.id}`}
            type="button"
            className="search-result-item"
            onClick={() => handleSelect(m.kind, m.id)}
          >
            <span className="search-result-icon">{KIND_ICONS[m.kind] ?? "•"}</span>
            <div className="search-result-body">
              <div className="search-result-label"><Hl text={m.label} query={q} /></div>
              {m.sub && <div className="search-result-sub"><Hl text={m.sub} query={q} /></div>}
            </div>
          </button>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="search-results-pagination">
          <button type="button" className="action-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <button type="button" className="action-btn" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
