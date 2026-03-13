import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import s from "./MapPage.module.css";
import { useLocation } from "react-router-dom";
import L, { type LayerGroup, type Map as LeafletMap } from "leaflet";
import { useAppStore } from "../stores/appStore";
import { dataStore } from "../data/dataStore";
import { LeftPanel } from "../components/map/LeftPanel";
import { RightPanel } from "../components/map/RightPanel";
import { PRESENCE_COLORS, STANCE_COLORS, KIND_ICONS } from "../components/shared/entityConstants";
import { Hl } from "../components/shared/Hl";
import { MapGraphOverlay } from "../components/shared/MapGraphOverlay";
import { useMapPageData, getConnectedPlaceIds, PLACE_SEARCH_INDEX } from "../hooks/useMapPageData";

// Leaflet markers require raw hex values (not CSS variables)
const ACCENT = "#c47c3a";
const ACCENT_CONNECTED = "#e8943a";

// ─── MapPage ──────────────────────────────────────────────────────────────────

export function MapPage() {
  // ── Data from hook ──────────────────────────────────────────────────────
  const { decades, visiblePlaces, propositionStanceMap, arcPairs, activeDecade, selection, searchQuery } = useMapPageData();

  // ── Store actions & UI state ────────────────────────────────────────────
  const isPlaying         = useAppStore((s) => s.isPlaying);
  const playbackSpeed     = useAppStore((s) => s.playbackSpeed);
  const leftPanelVisible  = useAppStore((s) => s.leftPanelVisible);
  const rightPanelVisible = useAppStore((s) => s.rightPanelVisible);

  const setDecade         = useAppStore((s) => s.setDecade);
  const setIsPlaying      = useAppStore((s) => s.setIsPlaying);
  const setSelection      = useAppStore((s) => s.setSelection);
  const setPanelTab     = useAppStore((s) => s.setPanelTab);
  const toggleLeftPanel   = useAppStore((s) => s.toggleLeftPanel);
  const toggleRightPanel  = useAppStore((s) => s.toggleRightPanel);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef          = useRef<LeafletMap | null>(null);
  const rowLayerRef     = useRef<LayerGroup | null>(null);
  const arcLayerRef     = useRef<LayerGroup | null>(null);
  const didFitRef       = useRef(false);

  // ── Map initialization ────────────────────────────────────────────────────

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      worldCopyJump: true,
      zoomControl: false,
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
      const stanceColor = propositionStanceMap.size > 0 ? propositionStanceMap.get(place.place_id) : undefined;
      const fallback    = "#8e8070";
      const color       = stanceColor ? (STANCE_COLORS[stanceColor] ?? fallback) : (PRESENCE_COLORS[place.presence_status] ?? fallback);
      const r           = isSelected ? 9 : isConnected ? 8 : 6;

      // Selected ring
      if (isSelected) {
        L.circleMarker([place.lat, place.lon], {
          radius: 17, color: ACCENT, weight: 2.5,
          fillColor: "transparent", fillOpacity: 0,
          dashArray: "5 4",
        }).addTo(rowLyr);
      }

      if (isConnected && !isSelected) {
        L.circleMarker([place.lat, place.lon], {
          radius: 14, color: ACCENT, weight: 2,
          fillColor: "transparent", fillOpacity: 0,
        }).addTo(rowLyr);
      }

      const useStanceColor = stanceColor != null;
      const m = L.circleMarker([place.lat, place.lon], {
        radius: r,
        color: isSelected ? ACCENT : isConnected && !useStanceColor ? ACCENT_CONNECTED : color,
        weight: isSelected ? 2.5 : isConnected ? 2 : 1.2,
        fillColor: useStanceColor ? color : isConnected ? ACCENT_CONNECTED : color,
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
        setPanelTab("places");
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
          radius: 17, color: ACCENT, weight: 2.5,
          fillColor: "transparent", fillOpacity: 0, dashArray: "5 4",
        }).addTo(rowLyr);
        const gm = L.circleMarker([ghost.lat, ghost.lon], {
          radius: 9, color: ACCENT, weight: 2.5,
          fillColor: ACCENT, fillOpacity: 0.45,
        });
        gm.bindTooltip(`${ghost.place_label} (not in this decade)`,
          { direction: "top", offset: [0, -4], className: "city-tooltip" });
        gm.on("click", () => {
          setSelection({ kind: "place", id: selPlaceId });
          setPanelTab("places");
          if (!rightPanelVisible) toggleRightPanel();
        });
        gm.addTo(rowLyr);
      }
    }

    if (!didFitRef.current && bounds.length > 0) {
      didFitRef.current = true;
      const lb = L.latLngBounds(bounds).pad(0.1);
      map.invalidateSize();
      try { map.fitBounds(lb); } catch (_) {}
      // Retry cascade after container fully renders (race condition with flexbox layout)
      for (const ms of [100, 300, 600]) {
        setTimeout(() => {
          map.invalidateSize();
          try { map.fitBounds(lb); } catch (_) {}
        }, ms);
      }
    }
  }, [visiblePlaces, selection, propositionStanceMap, setSelection, setPanelTab, rightPanelVisible, toggleRightPanel]);

  // ── Render arcs ───────────────────────────────────────────────────────────

  useEffect(() => {
    const arcLyr = arcLayerRef.current;
    if (!arcLyr) return;
    arcLyr.clearLayers();

    for (const { a, b, label } of arcPairs) {
      if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) continue;
      const line = L.polyline([[a.lat, a.lon], [b.lat, b.lon]], {
        color: ACCENT,
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

  // ── Auto-zoom when selection changes ─────────────────────────────────────

  const prevSelRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selection) return;
    const selKey = `${selection.kind}:${selection.id}`;
    if (selKey === prevSelRef.current) return;
    prevSelRef.current = selKey;

    // Ensure map container is visible and sized before zooming
    const tryZoom = (attempts = 0) => {
      const container = map.getContainer();
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        if (attempts < 10) {
          setTimeout(() => tryZoom(attempts + 1), 60);
        }
        return;
      }
      
      map.invalidateSize();

      // Account for right panel width to center content in the visible area
      const rightPanel = container.parentElement?.querySelector('[class*="right"]') as HTMLElement | null;
      const panelW = rightPanelVisible && rightPanel ? rightPanel.offsetWidth : 0;
      
      if (selection.kind === "place") {
        const place = dataStore.places.getById(selection.id);
        if (place?.lat != null && place?.lon != null) {
          const zoomLevel = 8;
          const targetPoint = map.project(L.latLng(place.lat, place.lon), zoomLevel);
          const offsetPoint = targetPoint.subtract([-(panelW / 2), 0]);
          const offsetLatLng = map.unproject(offsetPoint, zoomLevel);
          map.setView(offsetLatLng, zoomLevel, { animate: true });
        }
      } else {
        const fps = dataStore.footprints.getForEntity(selection.kind, selection.id);
        const pts: L.LatLngExpression[] = [];
        for (const fp of fps) {
          const p = dataStore.places.getById(fp.place_id);
          if (p?.lat != null && p?.lon != null) pts.push([p.lat, p.lon]);
        }
        if (pts.length > 0) {
          try { map.fitBounds(L.latLngBounds(pts).pad(0.3), { animate: true, maxZoom: 8, paddingBottomRight: [panelW, 0] }); } catch (_) {}
        }
      }
    };
    
    requestAnimationFrame(() => tryZoom());
  }, [selection, rightPanelVisible]);

  // ── Invalidate map size on layout changes ─────────────────────────────────

  useEffect(() => {
    const timers = [0, 50, 160, 350].map((ms) =>
      window.setTimeout(() => mapRef.current?.invalidateSize(), ms),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [leftPanelVisible, rightPanelVisible]);

  // ── Invalidate map size when page becomes visible ─────────────────────────

  const { pathname } = useLocation();
  const isMapPage = pathname === "/" || pathname === "";
  useEffect(() => {
    if (!isMapPage) return;
    // Leaflet may have stale dimensions when returning from another page
    const timers = [0, 50, 160, 350].map((ms) =>
      window.setTimeout(() => {
        const map = mapRef.current;
        if (!map) return;
        map.invalidateSize();
      }, ms),
    );
    // Re-fit bounds after container stabilizes (fixes intermittent zoom-out)
    const fitTimer = window.setTimeout(() => {
      const map = mapRef.current;
      if (!map) return;
      map.invalidateSize();
      const pts = visiblePlaces.filter((p) => p.lat != null && p.lon != null);
      if (pts.length > 0 && !selection) {
        try { map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat!, p.lon!])).pad(0.1)); } catch (_) {}
      }
    }, 500);
    return () => { timers.forEach((t) => window.clearTimeout(t)); window.clearTimeout(fitTimer); };
  }, [isMapPage, visiblePlaces, selection]);

  // ── Map action callbacks ──────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => { mapRef.current?.zoomIn(); }, []);
  const handleZoomOut = useCallback(() => { mapRef.current?.zoomOut(); }, []);

  const handleFitVisible = useCallback(() => {
    const map = mapRef.current;
    const pts = visiblePlaces.filter((p) => p.lat != null && p.lon != null);
    if (!map || pts.length === 0) return;
    map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat!, p.lon!])).pad(0.1));
  }, [visiblePlaces]);

  const handleCenterSelected = useCallback(() => {
    const map = mapRef.current;
    if (!map || !selection) return;

    // Account for right panel width: offset the center point leftward
    const container = map.getContainer();
    const rightPanel = container.parentElement?.querySelector(`.${s.right}`) as HTMLElement | null;
    const panelW = rightPanel?.offsetWidth ?? 0;

    function centerOnLatLng(lat: number, lon: number, zoom: number) {
      const targetPoint = map!.project(L.latLng(lat, lon), zoom);
      const offsetPoint = targetPoint.subtract([-(panelW / 2), 0]);
      const offsetLatLng = map!.unproject(offsetPoint, zoom);
      map!.setView(offsetLatLng, zoom, { animate: true });
    }

    if (selection.kind === "place") {
      const place = dataStore.places.getById(selection.id);
      if (place?.lat != null && place?.lon != null) centerOnLatLng(place.lat, place.lon, 10);
    } else {
      const fps = dataStore.footprints.getForEntity(selection.kind, selection.id);
      const pts: L.LatLngExpression[] = [];
      for (const fp of fps) {
        const p = dataStore.places.getById(fp.place_id);
        if (p?.lat != null && p?.lon != null) pts.push([p.lat, p.lon]);
      }
      if (pts.length > 0) {
        try {
          const bounds = L.latLngBounds(pts).pad(0.3);
          map.fitBounds(bounds, { animate: true, maxZoom: 8, paddingTopLeft: [0, 0], paddingBottomRight: [panelW, 0] });
        } catch (_) {}
      }
    }
  }, [selection]);

  const handleRandomPlace = useCallback(() => {
    const pts = visiblePlaces.filter((p) => p.lat != null && p.lon != null);
    if (!pts.length) return;
    const place = pts[Math.floor(Math.random() * pts.length)];
    if (!place) return;
    setSelection({ kind: "place", id: place.place_id });
    setPanelTab("places");
    const map = mapRef.current;
    if (map && place.lat != null && place.lon != null) map.setView([place.lat, place.lon], 7, { animate: true });
  }, [visiblePlaces, setSelection, setPanelTab]);

  const handleFlyToPlace = useCallback((placeId: string) => {
    const map = mapRef.current;
    const place = dataStore.places.getById(placeId);
    if (map && place?.lat != null && place?.lon != null) {
      map.setView([place.lat, place.lon], 7, { animate: true });
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={s.layout}>
      {/* Left panel */}
      {leftPanelVisible && (
        <div className={s.left}>
          <LeftPanel
            visiblePlaceCount={visiblePlaces.length}
            onRandomPlace={handleRandomPlace}
          />
        </div>
      )}

      {/* Map center */}
      <div className={s.center}>
        <div ref={mapContainerRef} id="map-root" />

        {/* Map overlay buttons */}
        <div className={s.overlays}>
          {!leftPanelVisible && (
            <button type="button" className={s.overlayBtn} onClick={toggleLeftPanel} title="Show controls">
              ◀ Controls
            </button>
          )}
          {!rightPanelVisible && (
            <button type="button" className={`${s.overlayBtn} ${s.overlayBtnRight}`} onClick={toggleRightPanel} title="Show panel">
              Panel ▶
            </button>
          )}
        </div>

        {/* Shared zoom / center / fit overlay */}
        <MapGraphOverlay
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitVisible={handleFitVisible}
          onCenterSelected={handleCenterSelected}
          showCenter={!!selection}
          fitLabel="fit"
          centerLabel="center"
        />

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

      {/* Right panel */}
      {rightPanelVisible && (
        <div className={s.right}>
          <RightPanel
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
  const setPanelTab = useAppStore((s) => s.setPanelTab);
  const toggleRight   = useAppStore((s) => s.toggleRightPanel);
  const rightVisible  = useAppStore((s) => s.rightPanelVisible);
  const [page, setPage] = useState(0);

  const q = query.toLowerCase();

  const matches = useMemo(() => {
    if (!q) return [];
    const results: { kind: string; id: string; label: string; sub: string }[] = [];

    for (const place of dataStore.places.getAll()) {
      const blob = PLACE_SEARCH_INDEX.get(place.place_id) ?? "";
      if (!blob.includes(q)) continue;
      results.push({ kind: "place", id: place.place_id, label: place.place_label, sub: `${place.modern_country_label} · ${place.place_kind}` });
    }
    for (const p of dataStore.people.getAll()) {
      if (!`${p.person_label} ${p.name_alt.join(" ")} ${p.notes}`.toLowerCase().includes(q)) continue;
      results.push({ kind: "person", id: p.person_id, label: p.person_label, sub: p.person_kind });
    }
    for (const w of dataStore.works.getAll()) {
      if (!`${w.title_display} ${w.work_type} ${w.notes}`.toLowerCase().includes(q)) continue;
      results.push({ kind: "work", id: w.work_id, label: w.title_display, sub: w.work_type });
    }
    for (const g of dataStore.groups.getAll()) {
      if (!`${g.group_label} ${g.group_kind} ${g.notes}`.toLowerCase().includes(q)) continue;
      results.push({ kind: "group", id: g.group_id, label: g.group_label, sub: g.group_kind });
    }
    for (const e of dataStore.events.getAll()) {
      if (!`${e.event_label} ${e.event_type} ${e.notes}`.toLowerCase().includes(q)) continue;
      results.push({ kind: "event", id: e.event_id, label: e.event_label, sub: e.event_type });
    }
    for (const p of dataStore.propositions.getAll()) {
      if (!`${p.proposition_label} ${p.description} ${p.polarity_family}`.toLowerCase().includes(q)) continue;
      results.push({ kind: "proposition", id: p.proposition_id, label: p.proposition_label, sub: "proposition" });
    }
    for (const src of dataStore.sources.getAll()) {
      if (!`${src.title} ${src.source_kind}`.toLowerCase().includes(q)) continue;
      results.push({ kind: "source", id: src.source_id, label: src.title, sub: src.source_kind });
    }

    results.sort((a, b) => a.label.localeCompare(b.label));
    return results;
  }, [q]);

  useEffect(() => { setPage(0); }, [q]);

  const totalPages = Math.ceil(matches.length / SEARCH_PAGE_SIZE);
  const pageItems  = matches.slice(page * SEARCH_PAGE_SIZE, (page + 1) * SEARCH_PAGE_SIZE);

  const handleSelect = (kind: string, id: string) => {
    setSelection({ kind: kind as import("../data/dataStore").Selection["kind"], id });
    if (kind === "place") setPanelTab("places");
    if (!rightVisible) toggleRight();
  };

  if (matches.length === 0) return null;

  return (
    <div className={s.searchPanel}>
      <div className={s.searchHeader}>
        <span className={s.searchTitle}>
          {matches.length} match{matches.length !== 1 ? "es" : ""} for &ldquo;{query}&rdquo;
        </span>
        <div className={s.searchHeaderActions}>
          {totalPages > 1 && (
            <span className={s.searchPageInfo}>
              {page + 1} / {totalPages}
            </span>
          )}
          <button type="button" className={s.closeBtn} onClick={onClear} title="Clear search">✕</button>
        </div>
      </div>

      <div className={s.searchList}>
        {pageItems.map((m) => (
          <button
            key={`${m.kind}:${m.id}`}
            type="button"
            className={s.searchItem}
            onClick={() => handleSelect(m.kind, m.id)}
          >
            <span className={s.searchIcon}>{KIND_ICONS[m.kind] ?? "•"}</span>
            <div className={s.searchBody}>
              <div className={s.searchLabel}><Hl text={m.label} query={q} /></div>
              {m.sub && <div className={s.searchSub}><Hl text={m.sub} query={q} /></div>}
            </div>
          </button>
        ))}
      </div>

      {totalPages > 1 && (
        <div className={s.searchPagination}>
          <button type="button" className={s.actionBtn} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <button type="button" className={s.actionBtn} disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
