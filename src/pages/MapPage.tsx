import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import s from "./MapPage.module.css";
import { useLocation } from "react-router-dom";
import L, { type LayerGroup, type Map as LeafletMap } from "leaflet";
import { PanelLeft, PanelRight, ChevronDown, ChevronUp } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { dataStore, globalSearch } from "../data/dataStore";
import { LeftPanel } from "../components/map/LeftPanel";
import { RightPanel } from "../components/map/RightPanel";
import { PRESENCE_COLORS, STANCE_COLORS, PlaceKindIcon } from "../components/shared/entityConstants";
import { buildPlaceKindIconSvg, PLACE_KIND_LABELS } from "../components/shared/icons";
import { MapGraphOverlay } from "../components/shared/MapGraphOverlay";
import { useMapPageData, getConnectedPlaceIds } from "../hooks/useMapPageData";

// Leaflet markers require raw hex values (not CSS variables)
const ACCENT = "#c47c3a";
const ACCENT_CONNECTED = "#e8943a";

// ─── Place kind legend overlay ───────────────────────────────────────────────
// Uses PlaceKindIcon React components — same icons as the right panel.

const LEGEND_KINDS = Object.keys(PLACE_KIND_LABELS).filter((k) => k !== "unknown");

function PlaceLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className={s.legend}>
      <button type="button" className={s.legendToggle} onClick={() => setOpen((v) => !v)}>
        Legend {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div className={s.legendItems}>
          {LEGEND_KINDS.map((kind) => (
            <div key={kind} className={s.legendItem}>
              <PlaceKindIcon kind={kind} size={14} />
              <span>{PLACE_KIND_LABELS[kind]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MapPage ──────────────────────────────────────────────────────────────────

export function MapPage() {
  // ── Data from hook ──────────────────────────────────────────────────────
  const { decades, visiblePlaces, propositionStanceMap, arcPairs, activeDecade, selection, searchQuery } = useMapPageData();

  // ── Store actions & UI state ────────────────────────────────────────────
  const isPlaying         = useAppStore((s) => s.isPlaying);
  const playbackSpeed     = useAppStore((s) => s.playbackSpeed);
  const leftPanelVisible  = useAppStore((s) => s.leftPanelVisible);
  const rightPanelVisible = useAppStore((s) => s.rightPanelVisible);

  const panelTab          = useAppStore((s) => s.panelTab);
  const setDecade         = useAppStore((s) => s.setDecade);
  const setIsPlaying      = useAppStore((s) => s.setIsPlaying);
  const setSelection      = useAppStore((s) => s.setSelection);
  const setPanelTab       = useAppStore((s) => s.setPanelTab);
  const toggleLeftPanel   = useAppStore((s) => s.toggleLeftPanel);
  const toggleRightPanel  = useAppStore((s) => s.toggleRightPanel);

  // ── URL hydration (on mount) + URL sync (on state change) ────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const d = p.get("d");
    if (d) { const n = parseInt(d, 10); if (!isNaN(n)) setDecade(n); }
    const kind = p.get("kind");
    const id   = p.get("id");
    if (kind && id) {
      setSelection({ kind: kind as import("../data/types").SelectionKind, id });
      if (!rightPanelVisible) toggleRightPanel();
    }
    const tab = p.get("tab");
    if (tab) setPanelTab(tab as import("../stores/appStore").PanelTab);
  }, []); // mount-only

  useEffect(() => {
    const p = new URLSearchParams();
    p.set("d", String(activeDecade));
    if (selection) { p.set("kind", selection.kind); p.set("id", selection.id); }
    if (panelTab !== "places") p.set("tab", panelTab);
    window.history.replaceState(null, "", `?${p.toString()}`);
  }, [activeDecade, selection, panelTab]);

  // ── Search-based place highlight set (from NavBar global query) ──────────
  const searchHighlightPlaceIds = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return null;
    const results = globalSearch(q);
    const placeIds = new Set<string>();
    for (const r of results) {
      if (r.kind === "place") {
        placeIds.add(r.id);
      } else {
        const fps = dataStore.footprints.getForEntityDeduped(r.kind, r.id);
        for (const fp of fps) placeIds.add(fp.place_id);
      }
    }
    return placeIds;
  }, [searchQuery]);

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
      const isDimmed    = hasEntityHighlight
        ? (!isConnected && !isSelected)
        : searchHighlightPlaceIds !== null && !searchHighlightPlaceIds.has(place.place_id);
      const stanceColor = propositionStanceMap.size > 0 ? propositionStanceMap.get(place.place_id) : undefined;
      const fallback    = "#8e8070";
      const color       = stanceColor ? (STANCE_COLORS[stanceColor] ?? fallback) : (PRESENCE_COLORS[place.presence_status] ?? fallback);
      const useStanceColor = stanceColor != null;
      const strokeColor = isSelected ? ACCENT : isConnected && !useStanceColor ? ACCENT_CONNECTED : color;
      const fillColor = useStanceColor ? color : isConnected ? ACCENT_CONNECTED : color;
      const fillOpacity = isSelected ? 1 : isDimmed ? 0.22 : isConnected ? 0.92 : 0.78;

      // Selection / connection rings — radius matches half of iconSz + 4px gap
      if (isSelected) {
        L.circleMarker([place.lat, place.lon], {
          radius: 14, color: ACCENT, weight: 2.5,
          fillColor: "transparent", fillOpacity: 0,
          dashArray: "5 4",
        }).addTo(rowLyr);
      }

      if (isConnected && !isSelected) {
        L.circleMarker([place.lat, place.lon], {
          radius: 13, color: ACCENT, weight: 2,
          fillColor: "transparent", fillOpacity: 0,
        }).addTo(rowLyr);
      }

      // All places use divIcon for consistent centering.
      // iconAnchor centres the icon at lat/lon — no CSS transform needed.
      const iconSz = isSelected ? 20 : isConnected ? 18 : 16;
      const m = L.marker([place.lat, place.lon], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:${iconSz}px;height:${iconSz}px;display:flex;align-items:center;justify-content:center;opacity:${fillOpacity};filter:drop-shadow(0 0 2px rgba(255,255,255,0.85));">${buildPlaceKindIconSvg(place.place_kind, strokeColor, iconSz)}</div>`,
          iconSize: [iconSz, iconSz],
          iconAnchor: [iconSz / 2, iconSz / 2],
        }),
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
  }, [visiblePlaces, selection, propositionStanceMap, searchHighlightPlaceIds, setSelection, setPanelTab, rightPanelVisible, toggleRightPanel]);

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
              <PanelLeft size={14} /> Controls
            </button>
          )}
          {!rightPanelVisible && (
            <button type="button" className={`${s.overlayBtn} ${s.overlayBtnRight}`} onClick={toggleRightPanel} title="Show panel">
              Panel <PanelRight size={14} />
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
        />

        {/* Place kind legend */}
        <PlaceLegend />

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

