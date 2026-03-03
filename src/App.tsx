import { useEffect, useMemo, useRef } from "react";
import L, { type LayerGroup, type Map as LeafletMap } from "leaflet";
import { useAppStore } from "./stores/appStore";
import { dataStore, churchRowRepo } from "./data/runtimeData";
import { computeHighlights } from "./services/HighlightService";
import type { ChurchRow } from "./domain/types";

// Controls
import { TimelineControl } from "./components/controls/TimelineControl";
import { FilterPanel } from "./components/controls/FilterPanel";
import { SearchBar } from "./components/controls/SearchBar";
import { MapToolbar } from "./components/controls/MapToolbar";

// Panels
import { DetailsPanel } from "./components/panels/DetailsPanel";
import { CityChronicle } from "./components/panels/CityChronicle";
import { EventTrack } from "./components/panels/EventTrack";
import { DoctrineExplorer } from "./components/panels/DoctrineExplorer";
import { CorrespondencePanel } from "./components/panels/CorrespondencePanel";
import { WorksPanel } from "./components/panels/WorksPanel";
import { ArchaeologyPanel } from "./components/panels/ArchaeologyPanel";
import { EmpirePanel } from "./components/panels/EmpirePanel";
import { DenominationPanel } from "./components/panels/DenominationPanel";
import { EssayPanel } from "./components/panels/EssayPanel";

// Shared
import { KeyboardShortcutHelp } from "./components/shared/KeyboardShortcutHelp";

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESENCE_STATUS_COLORS: Record<string, string> = {
  attested: "#2a9d8f",
  probable: "#e9c46a",
  claimed_tradition: "#f4a261",
  not_attested: "#8d99ae",
  suppressed: "#e63946",
  unknown: "#6c757d",
};

const PLAYBACK_SPEEDS = [1, 2, 5] as const;

function formatYear(year: number): string {
  return String(year).padStart(4, "0");
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;
}

// ─── App ─────────────────────────────────────────────────────────────────────

export function App() {
  const activeDecade = useAppStore((s) => s.activeDecade);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const playbackSpeed = useAppStore((s) => s.playbackSpeed);
  const includeCumulative = useAppStore((s) => s.includeCumulative);
  const selection = useAppStore((s) => s.selection);
  const filters = useAppStore((s) => s.filters);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const leftSidebarVisible = useAppStore((s) => s.leftSidebarVisible);
  const rightSidebarVisible = useAppStore((s) => s.rightSidebarVisible);
  const activeRightPanel = useAppStore((s) => s.activeRightPanel);
  const showShortcutHelp = useAppStore((s) => s.showShortcutHelp);
  const archaeologyLayerVisible = useAppStore((s) => s.archaeologyLayerVisible);
  const highlights = useAppStore((s) => s.highlights);
  const rightPanelWide = useAppStore((s) => s.rightPanelWide);
  const toggleRightPanelWide = useAppStore((s) => s.toggleRightPanelWide);

  const setDecade = useAppStore((s) => s.setDecade);
  const stepDecade = useAppStore((s) => s.stepDecade);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const setSelection = useAppStore((s) => s.setSelection);
  const setHighlights = useAppStore((s) => s.setHighlights);
  const setCorrespondenceArcs = useAppStore((s) => s.setCorrespondenceArcs);
  const toggleLeftSidebar = useAppStore((s) => s.toggleLeftSidebar);
  const toggleRightSidebar = useAppStore((s) => s.toggleRightSidebar);
  const setActiveRightPanel = useAppStore((s) => s.setActiveRightPanel);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const rowLayerRef = useRef<LayerGroup | null>(null);
  const archLayerRef = useRef<LayerGroup | null>(null);
  const arcLayerRef = useRef<LayerGroup | null>(null);
  const didInitialFitRef = useRef<boolean>(false);

  // ─── Derived data ────────────────────────────────────────────────────────

  const activeYearKey = String(activeDecade);

  const decadeRows = useMemo(() => {
    return includeCumulative
      ? churchRowRepo.getCumulativeByDecade(activeDecade)
      : churchRowRepo.getByDecade(activeDecade);
  }, [activeDecade, includeCumulative]);

  const selectedStatusSet = useMemo(() => new Set(filters.church_presence_status), [filters.church_presence_status]);
  const selectedPolitySet = useMemo(() => new Set(filters.ruling_empire_polity), [filters.ruling_empire_polity]);
  const selectedHistoricDenomSet = useMemo(() => new Set(filters.denomination_label_historic), [filters.denomination_label_historic]);
  const selectedModernDenomSet = useMemo(() => new Set(filters.modern_denom_mapping), [filters.modern_denom_mapping]);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (normalizedSearch.length === 0) return null;
    const results = churchRowRepo.search(normalizedSearch);
    return new Set(results.map((r) => r.id));
  }, [normalizedSearch]);

  const visibleRows = useMemo(() => {
    return decadeRows.filter((row) => {
      if (!selectedStatusSet.has(row.church_presence_status)) return false;
      if (!selectedPolitySet.has(row.ruling_empire_polity)) return false;
      if (row.denomination_label_historic_values.length === 0) return false;
      if (!row.denomination_label_historic_values.some((v) => selectedHistoricDenomSet.has(v))) return false;
      if (row.modern_denom_mapping_values.length === 0) return false;
      if (!row.modern_denom_mapping_values.some((v) => selectedModernDenomSet.has(v))) return false;
      if (searchResults !== null) return searchResults.has(row.id);
      return true;
    });
  }, [decadeRows, selectedStatusSet, selectedPolitySet, selectedHistoricDenomSet, selectedModernDenomSet, searchResults]);

  const visibleArchSites = useMemo(() => {
    if (!archaeologyLayerVisible) return [];
    return dataStore.archaeology.getActiveAtDecade(activeDecade);
  }, [activeDecade, archaeologyLayerVisible]);

  // ─── Highlight computation ───────────────────────────────────────────────

  useEffect(() => {
    const result = computeHighlights(selection, activeDecade, dataStore);
    setHighlights(result.cityHighlights);
    setCorrespondenceArcs(result.arcs);
  }, [selection, activeDecade, setHighlights, setCorrespondenceArcs]);

  // ─── Map initialization ──────────────────────────────────────────────────

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      worldCopyJump: true,
      zoomControl: true,
      preferCanvas: true,
    }).setView([34, 20], 3);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> &copy; <a href='https://carto.com/'>CARTO</a>",
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);

    rowLayerRef.current = L.layerGroup().addTo(map);
    archLayerRef.current = L.layerGroup().addTo(map);
    arcLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      rowLayerRef.current = null;
      archLayerRef.current = null;
      arcLayerRef.current = null;
    };
  }, []);

  // ─── Playback ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isPlaying) return;
    const intervalMs = Math.max(200, Math.round(1400 / playbackSpeed));
    const timer = window.setInterval(() => {
      const state = useAppStore.getState();
      const buckets = churchRowRepo.yearBuckets;
      const idx = buckets.indexOf(state.activeDecade);
      if (idx >= buckets.length - 1) {
        setIsPlaying(false);
        return;
      }
      setDecade(buckets[idx + 1] ?? state.activeDecade);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, setDecade, setIsPlaying]);

  // ─── Map rendering ──────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    const rowLayer = rowLayerRef.current;
    const archLayer = archLayerRef.current;
    if (!map || !rowLayer || !archLayer) return;

    rowLayer.clearLayers();
    archLayer.clearLayers();

    const boundsPoints: L.LatLngExpression[] = [];
    const selectedCityId = selection?.kind === "city" ? selection.id : null;

    for (const row of visibleRows) {
      if (!row.hasValidCoordinates || row.lat === null || row.lon === null) continue;

      const isSelected = row.id === selectedCityId;
      const highlight = highlights[row.id];
      const color = highlight?.color ?? PRESENCE_STATUS_COLORS[row.church_presence_status] ?? "#577590";
      const radius = isSelected ? 9 : highlight ? 7 : 6;

      if (isSelected) {
        const ring = L.circleMarker([row.lat, row.lon], {
          radius: 16,
          color: "#9f4e1f",
          weight: 2,
          fillColor: "transparent",
          fillOpacity: 0,
          dashArray: "4 3",
          className: "leaflet-marker-selected",
        });
        ring.addTo(rowLayer);
      }

      const marker = L.circleMarker([row.lat, row.lon], {
        radius,
        color: isSelected ? "#9f4e1f" : color,
        weight: isSelected ? 3 : highlight ? 2.5 : 2,
        fillColor: color,
        fillOpacity: isSelected ? 0.95 : highlight ? 0.85 : 0.75,
      });

      const tooltipText = `${row.city_ancient} · ${row.city_modern}, ${row.country_modern} (${row.date_range})`;
      marker.bindTooltip(tooltipText, { direction: "top", offset: [0, -2] });
      marker.on("click", () => {
        setSelection({ kind: "city", id: row.id });
        setActiveRightPanel("details");
      });
      marker.addTo(rowLayer);
      boundsPoints.push([row.lat, row.lon]);
    }

    // Archaeology markers
    for (const site of visibleArchSites) {
      if (site.lat === null || site.lon === null) continue;
      const isSelected = selection?.kind === "archaeology" && selection.id === site.id;
      const marker = L.marker([site.lat, site.lon], {
        icon: L.divIcon({
          className: isSelected ? "poi-marker selected" : "poi-marker",
          html: "★",
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      });
      marker.bindTooltip(`${site.name_display} (AD ${site.year_start})`, { direction: "top" });
      marker.on("click", () => {
        setSelection({ kind: "archaeology", id: site.id });
        setActiveRightPanel("archaeology");
      });
      marker.addTo(archLayer);
      boundsPoints.push([site.lat, site.lon]);
    }

    if (!didInitialFitRef.current && boundsPoints.length > 0) {
      map.fitBounds(L.latLngBounds(boundsPoints).pad(0.18));
      didInitialFitRef.current = true;
    }
  }, [visibleRows, visibleArchSites, selection, highlights, setSelection, setActiveRightPanel]);

  // ─── Correspondence arcs ─────────────────────────────────────────────────

  const correspondenceArcs = useAppStore((s) => s.correspondenceArcs);
  const correspondenceLayerVisible = useAppStore((s) => s.correspondenceLayerVisible);

  useEffect(() => {
    const arcLayer = arcLayerRef.current;
    if (!arcLayer) return;
    arcLayer.clearLayers();

    if (!correspondenceLayerVisible || correspondenceArcs.length === 0) return;

    for (const arc of correspondenceArcs) {
      const line = L.polyline(
        [[arc.fromLat, arc.fromLon], [arc.toLat, arc.toLon]],
        {
          color: "#8e44ad",
          weight: Math.max(1, arc.weight),
          opacity: 0.6,
          dashArray: "6 4",
        },
      );
      line.bindTooltip(arc.label);
      line.addTo(arcLayer);
    }
  }, [correspondenceArcs, correspondenceLayerVisible]);

  // ─── Map resize on sidebar toggle ────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = window.setTimeout(() => map.invalidateSize(), 100);
    return () => window.clearTimeout(timer);
  }, [leftSidebarVisible, rightSidebarVisible, rightPanelWide]);

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === " ") { event.preventDefault(); useAppStore.getState().togglePlayback(); return; }
      if (event.key === "ArrowLeft") { event.preventDefault(); stepDecade(-1); return; }
      if (event.key === "ArrowRight") { event.preventDefault(); stepDecade(1); return; }
      if (event.key.toLowerCase() === "l") { toggleLeftSidebar(); return; }
      if (event.key.toLowerCase() === "d") { toggleRightSidebar(); return; }
      if (event.key === "/") { event.preventDefault(); document.getElementById("search")?.focus(); return; }
      if (event.key === "?") { event.preventDefault(); useAppStore.getState().toggleShortcutHelp(); return; }
      if (event.key === "Escape") { setSelection(null); return; }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepDecade, toggleLeftSidebar, toggleRightSidebar, setSelection]);

  // ─── URL state sync ──────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("year", String(activeDecade));
    params.set("cum", includeCumulative ? "1" : "0");
    params.set("left", leftSidebarVisible ? "1" : "0");
    params.set("right", rightSidebarVisible ? "1" : "0");
    if (searchQuery.trim().length > 0) params.set("q", searchQuery.trim());
    else params.delete("q");
    if (selection) params.set("sel", `${selection.kind}:${selection.id}`);
    else params.delete("sel");
    if (activeRightPanel !== "details") params.set("panel", activeRightPanel);
    else params.delete("panel");
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [activeDecade, includeCumulative, leftSidebarVisible, rightSidebarVisible, searchQuery, selection, activeRightPanel]);

  // ─── Map actions ─────────────────────────────────────────────────────────

  function fitMapToVisible() {
    const map = mapRef.current;
    if (!map) return;
    const points: L.LatLngExpression[] = [];
    for (const row of visibleRows) {
      if (row.hasValidCoordinates && row.lat !== null && row.lon !== null) points.push([row.lat, row.lon]);
    }
    for (const site of visibleArchSites) {
      if (site.lat !== null && site.lon !== null) points.push([site.lat, site.lon]);
    }
    if (points.length > 0) map.fitBounds(L.latLngBounds(points).pad(0.16));
  }

  function centerOnSelection() {
    const map = mapRef.current;
    if (!map || !selection) return;
    if (selection.kind === "city") {
      const row = dataStore.churchRows.getById(selection.id);
      if (row?.lat && row?.lon) map.setView([row.lat, row.lon], Math.max(map.getZoom(), 7), { animate: true });
    } else if (selection.kind === "archaeology") {
      const site = dataStore.archaeology.getById(selection.id);
      if (site?.lat && site?.lon) map.setView([site.lat, site.lon], Math.max(map.getZoom(), 7), { animate: true });
    }
  }

  function jumpToRandomVisible() {
    const candidates = [
      ...visibleRows.filter((r) => r.hasValidCoordinates && r.lat !== null).map((r) => ({ kind: "city" as const, id: r.id })),
      ...visibleArchSites.filter((s) => s.lat !== null).map((s) => ({ kind: "archaeology" as const, id: s.id })),
    ];
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
    setSelection(pick);
    setActiveRightPanel(pick.kind === "archaeology" ? "archaeology" : "details");
    // Center on pick
    const map = mapRef.current;
    if (!map) return;
    if (pick.kind === "city") {
      const row = dataStore.churchRows.getById(pick.id);
      if (row?.lat && row?.lon) map.setView([row.lat, row.lon], Math.max(map.getZoom(), 6), { animate: true });
    } else {
      const site = dataStore.archaeology.getById(pick.id);
      if (site?.lat && site?.lon) map.setView([site.lat, site.lon], Math.max(map.getZoom(), 6), { animate: true });
    }
  }

  // ─── Get city ancient name for chronicle ─────────────────────────────────

  const chronicleCityAncient = useMemo(() => {
    if (selection?.kind !== "city") return null;
    const row = dataStore.churchRows.getById(selection.id);
    return row?.city_ancient ?? null;
  }, [selection]);

  // ─── Render ──────────────────────────────────────────────────────────────

  const dateRangeLabel = churchRowRepo.dateRangeByYear[activeYearKey] ?? "";

  return (
    <div className={`app-shell ${leftSidebarVisible ? "left-open" : "left-closed"} ${rightSidebarVisible ? "right-open" : "right-closed"} ${rightPanelWide && rightSidebarVisible ? "right-wide" : ""}`}>
      {leftSidebarVisible && (
        <aside className="left-panel">
          <header className="panel-header">
            <p className="eyebrow">Early Christianity atlas</p>
            <h1>AD 33–800 timeline map</h1>
            <p className="muted">{dateRangeLabel}</p>
          </header>

          <TimelineControl />
          <SearchBar visibleRowCount={visibleRows.length} visiblePoiCount={visibleArchSites.length} />
          <MapToolbar
            onFitVisible={fitMapToVisible}
            onCenterSelected={centerOnSelection}
            onRandomSite={jumpToRandomVisible}
            hasSelection={selection !== null}
            hasVisible={visibleRows.length + visibleArchSites.length > 0}
          />
          <FilterPanel />
        </aside>
      )}

      <main className="map-panel">
        <div className="map-toolbar">
          <button type="button" onClick={toggleLeftSidebar}>
            {leftSidebarVisible ? "Hide controls (L)" : "Show controls (L)"}
          </button>
          <button type="button" onClick={toggleRightSidebar}>
            {rightSidebarVisible ? "Hide details (D)" : "Show details (D)"}
          </button>
          <button type="button" onClick={fitMapToVisible}>Fit visible</button>
          <button type="button" onClick={jumpToRandomVisible} disabled={visibleRows.length + visibleArchSites.length === 0}>
            Random site
          </button>
        </div>
        {showShortcutHelp && <KeyboardShortcutHelp />}
        <div ref={mapContainerRef} className="map" />
      </main>

      {rightSidebarVisible && (
        <aside className="right-panel">
          <div className="right-panel-tabs">
            <button
              type="button"
              className="panel-width-toggle"
              onClick={toggleRightPanelWide}
              title={rightPanelWide ? "Collapse panel" : "Expand panel"}
            >
              {rightPanelWide ? "▷" : "◁"}
            </button>
            {(
              [
                { key: "details", label: "Details" },
                { key: "chronicle", label: "City" },
                { key: "events", label: "Events" },
                { key: "doctrines", label: "Doctrines" },
                { key: "correspondence", label: "People" },
                { key: "works", label: "Works" },
                { key: "archaeology", label: "Archaeology" },
                { key: "empires", label: "Empires" },
                { key: "denominations", label: "Denoms" },
                { key: "essays", label: "Essays" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={activeRightPanel === tab.key ? "active" : ""}
                onClick={() => setActiveRightPanel(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="right-panel-content">
            {activeRightPanel === "details" && <DetailsPanel visibleRows={visibleRows} />}
            {activeRightPanel === "chronicle" && chronicleCityAncient && (
              <CityChronicle cityAncient={chronicleCityAncient} />
            )}
            {activeRightPanel === "chronicle" && !chronicleCityAncient && (
              <div className="drawer-content">
                <p className="muted">Select a city marker on the map, then switch to the City tab to see its full timeline.</p>
              </div>
            )}
            {activeRightPanel === "events" && <EventTrack />}
            {activeRightPanel === "doctrines" && <DoctrineExplorer />}
            {activeRightPanel === "correspondence" && <CorrespondencePanel />}
            {activeRightPanel === "works" && <WorksPanel />}
            {activeRightPanel === "archaeology" && <ArchaeologyPanel />}
            {activeRightPanel === "empires" && <EmpirePanel />}
            {activeRightPanel === "denominations" && <DenominationPanel />}
            {activeRightPanel === "essays" && <EssayPanel />}
          </div>
        </aside>
      )}
    </div>
  );
}
