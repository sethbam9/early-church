import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import L, { type LayerGroup, type Map as LeafletMap } from "leaflet";
import { useAppStore } from "../stores/appStore";
import { dataStore } from "../data/dataStore";
import type { CityAtDecade } from "../data/dataStore";
import { LeftPanel } from "../components/map/LeftPanel";
import { RightSidebar } from "../components/map/RightSidebar";
import { PRESENCE_COLORS, KIND_ICONS } from "../components/shared/entityConstants";
import { Hl } from "../components/shared/Hl";

// ─── City-search index: maps city_id → searchable text blob ─────────────────
// Indexes city names, associated people (all routes), works, doctrines,
// persuasions, polities, events, notes, and quote text.

function buildCitySearchIndex(): Map<string, string> {
  const index = new Map<string, string>();

  // Pre-build: city_id → person_ids via every available data path
  const cityPersonMap = new Map<string, Set<string>>();
  const addCityPerson = (cityId: string, personId: string) => {
    if (!cityPersonMap.has(cityId)) cityPersonMap.set(cityId, new Set());
    cityPersonMap.get(cityId)!.add(personId);
  };

  // 1. People with city_of_origin_id
  for (const p of dataStore.people.getAll()) {
    if (p.city_of_origin_id) addCityPerson(p.city_of_origin_id, p.person_id);
  }

  // 2. Via footprints (person → city)
  for (const fp of dataStore.footprints.getAll()) {
    if (fp.entity_type === "person" && fp.place_id.startsWith("city:")) {
      addCityPerson(fp.place_id.slice(5), fp.entity_id);
    }
  }

  // 3. Via person ↔ city relations
  for (const r of dataStore.relations.getAll()) {
    if (r.source_type === "person" && r.target_type === "city") addCityPerson(r.target_id, r.source_id);
    if (r.target_type === "person" && r.source_type === "city") addCityPerson(r.source_id, r.target_id);
  }

  // 4. Via works authored at / addressed to city
  for (const w of dataStore.works.getAll()) {
    const writtenAt = w.place_written_id?.startsWith("city:") ? w.place_written_id.slice(5) : null;
    if (writtenAt && w.author_person_id) addCityPerson(writtenAt, w.author_person_id);
    for (const rid of w.place_recipient_ids ?? []) {
      if (rid.startsWith("city:") && w.author_person_id) addCityPerson(rid.slice(5), w.author_person_id);
    }
  }

  // 5. Via place_state church_planted_by text (iterate all cities)
  const cityPlantedBy = new Map<string, string>();
  for (const city of dataStore.cities.getAll()) {
    for (const ps of dataStore.map.getPlaceStatesForCity(city.city_id)) {
      if (ps.church_planted_by) {
        const existing = cityPlantedBy.get(city.city_id) ?? "";
        cityPlantedBy.set(city.city_id, existing + " " + ps.church_planted_by.toLowerCase());
      }
    }
  }

  for (const city of dataStore.cities.getAll()) {
    const parts: string[] = [
      city.city_label,
      city.city_ancient,
      city.city_modern,
      city.country_modern,
    ];

    // Planted-by text (already contains person names like "Paul" "Barnabas")
    const planted = cityPlantedBy.get(city.city_id);
    if (planted) parts.push(planted);

    // All associated people
    const personIds = cityPersonMap.get(city.city_id) ?? new Set();
    for (const pid of personIds) {
      const p = dataStore.people.getById(pid);
      if (p) parts.push(p.person_label, ...p.name_alt, ...p.roles, p.description);
    }

    // Relations touching this city
    for (const r of dataStore.relations.getForEntity("city", city.city_id)) {
      const othId  = r.source_id === city.city_id ? r.target_id : r.source_id;
      const othType= r.source_id === city.city_id ? r.target_type : r.source_type;
      if (othType === "work") {
        const w = dataStore.works.getById(othId);
        if (w) parts.push(w.title_display, w.author_name_display, w.description ?? "");
      } else if (othType === "doctrine") {
        const d = dataStore.doctrines.getById(othId);
        if (d) parts.push(d.name_display, d.category, d.description ?? "");
      } else if (othType === "event") {
        const e = dataStore.events.getById(othId);
        if (e) parts.push(e.name_display, e.event_type ?? "");
      }
    }

    // Notes (body text mentioning this city)
    for (const n of dataStore.notes.getForEntity("city", city.city_id)) {
      parts.push(n.body_md);
    }

    // Persuasions and polities from place states
    for (const ps of dataStore.map.getPlaceStatesForCity(city.city_id)) {
      if (ps.polity_id) {
        const pol = dataStore.polities.getById(ps.polity_id);
        if (pol) parts.push(pol.polity_label, pol.region ?? "");
      }
      for (const persId of ps.persuasion_ids) {
        const pers = dataStore.persuasions.getById(persId);
        if (pers) parts.push(pers.persuasion_label, pers.persuasion_stream ?? "");
      }
    }

    index.set(city.city_id, parts.join(" ").toLowerCase());
  }

  return index;
}

const CITY_SEARCH_INDEX = buildCitySearchIndex();

// ─── Person → city IDs via relations ─────────────────────────────────────────

function getCityIdsForPerson(personId: string): Set<string> {
  const cityIds = new Set<string>();

  // Via footprints (may have entries)
  const fps = dataStore.footprints.getForEntity("person", personId);
  for (const fp of fps) {
    if (fp.place_id.startsWith("city:")) cityIds.add(fp.place_id.slice(5));
  }

  // Via relations (person ↔ city, or person ↔ work ↔ city)
  const rels = dataStore.relations.getForEntity("person", personId);
  for (const r of rels) {
    const otherId = r.source_id === personId ? r.target_id : r.source_id;
    const otherType = r.source_id === personId ? r.target_type : r.source_type;
    if (otherType === "city") {
      cityIds.add(otherId);
    } else if (otherType === "work") {
      // Work's place_written_id
      const work = dataStore.works.getById(otherId);
      if (work?.place_written_id?.startsWith("city:")) {
        cityIds.add(work.place_written_id.slice(5));
      }
      for (const rid of work?.place_recipient_ids ?? []) {
        if (rid.startsWith("city:")) cityIds.add(rid.slice(5));
      }
    }
  }

  // Via city_of_origin
  const person = dataStore.people.getById(personId);
  if (person?.city_of_origin_id) cityIds.add(person.city_of_origin_id);

  return cityIds;
}

// ─── Get city IDs connected to any entity type ───────────────────────────────

function getConnectedCityIds(selection: { kind: string; id: string } | null): Set<string> {
  if (!selection) return new Set();

  if (selection.kind === "person") return getCityIdsForPerson(selection.id);

  if (selection.kind === "event") {
    const e = dataStore.events.getById(selection.id);
    const ids = new Set<string>();
    if (e?.primary_place_id?.startsWith("city:")) ids.add(e.primary_place_id.slice(5));
    for (const r of dataStore.relations.getForEntity("event", selection.id)) {
      if (r.source_type === "city") ids.add(r.source_id);
      if (r.target_type === "city") ids.add(r.target_id);
    }
    return ids;
  }

  if (selection.kind === "work") {
    const w = dataStore.works.getById(selection.id);
    const ids = new Set<string>();
    if (w?.place_written_id?.startsWith("city:")) ids.add(w.place_written_id.slice(5));
    for (const rid of w?.place_recipient_ids ?? []) {
      if (rid.startsWith("city:")) ids.add(rid.slice(5));
    }
    for (const r of dataStore.relations.getForEntity("work", selection.id)) {
      if (r.source_type === "city") ids.add(r.source_id);
      if (r.target_type === "city") ids.add(r.target_id);
    }
    return ids;
  }

  if (selection.kind === "doctrine") {
    const fps = dataStore.footprints.getForEntity("doctrine", selection.id);
    const ids = new Set(fps.filter((f) => f.place_id.startsWith("city:")).map((f) => f.place_id.slice(5)));
    for (const r of dataStore.relations.getForEntity("doctrine", selection.id)) {
      if (r.source_type === "city") ids.add(r.source_id);
      if (r.target_type === "city") ids.add(r.target_id);
    }
    return ids;
  }

  if (selection.kind === "persuasion") {
    return new Set(
      dataStore.map.getAllPlaceStates()
        .filter((ps) => ps.place_id.startsWith("city:") && (ps.persuasion_ids ?? []).includes(selection.id))
        .map((ps) => ps.place_id.slice(5)),
    );
  }

  if (selection.kind === "polity") {
    return new Set(
      dataStore.map.getAllPlaceStates()
        .filter((ps) => ps.place_id.startsWith("city:") && ps.polity_id === selection.id)
        .map((ps) => ps.place_id.slice(5)),
    );
  }

  return new Set();
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
  const archaeologyVisible= useAppStore((s) => s.archaeologyLayerVisible);
  const showArcs          = useAppStore((s) => s.showArcs);
  const mapFilterType     = useAppStore((s) => s.mapFilterType);
  const mapFilterId       = useAppStore((s) => s.mapFilterId);
  const searchQuery       = useAppStore((s) => s.searchQuery);
  const leftPanelVisible  = useAppStore((s) => s.leftPanelVisible);
  const rightPanelVisible = useAppStore((s) => s.rightPanelVisible);
  const sidebarExpanded   = useAppStore((s) => s.sidebarExpanded);

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
  const archLayerRef    = useRef<LayerGroup | null>(null);
  const arcLayerRef     = useRef<LayerGroup | null>(null);
  const didFitRef       = useRef(false);

  const decades   = dataStore.map.getDecades();
  const decadeIdx = decades.indexOf(activeDecade);

  // ── Visible data ──────────────────────────────────────────────────────────

  const visibleCities = useMemo<CityAtDecade[]>(() => {
    const base = includeCumulative
      ? dataStore.map.getCumulativeCitiesAtDecade(activeDecade)
      : dataStore.map.getCitiesAtDecade(activeDecade);

    let result = base;

    // Presence filter (empty = all)
    if (activeFilters.length > 0) {
      result = result.filter((c) => activeFilters.includes(c.presence_status));
    }

    // Map entity filter
    if (mapFilterType && mapFilterId) {
      if (mapFilterType === "persuasion") {
        result = result.filter((c) => (c.persuasion_ids ?? []).includes(mapFilterId));
      } else if (mapFilterType === "polity") {
        result = result.filter((c) => c.polity_id === mapFilterId);
      } else if (mapFilterType === "person") {
        const cityIds = getCityIdsForPerson(mapFilterId);
        result = result.filter((c) => cityIds.has(c.city_id));
      } else if (mapFilterType === "doctrine") {
        // Cities that have a footprint for this doctrine
        const fps = dataStore.footprints.getForEntity("doctrine", mapFilterId);
        const cityIds = new Set(fps.filter(f => f.place_id.startsWith("city:")).map(f => f.place_id.slice(5)));
        // Also cities linked via relations
        for (const r of dataStore.relations.getForEntity("doctrine", mapFilterId)) {
          if (r.source_type === "city") cityIds.add(r.source_id);
          if (r.target_type === "city") cityIds.add(r.target_id);
        }
        result = result.filter((c) => cityIds.has(c.city_id));
      } else if (mapFilterType === "event") {
        const e = dataStore.events.getById(mapFilterId);
        const cityIds = new Set<string>();
        if (e?.primary_place_id?.startsWith("city:")) cityIds.add(e.primary_place_id.slice(5));
        for (const r of dataStore.relations.getForEntity("event", mapFilterId)) {
          if (r.source_type === "city") cityIds.add(r.source_id);
          if (r.target_type === "city") cityIds.add(r.target_id);
        }
        result = result.filter((c) => cityIds.has(c.city_id));
      } else if (mapFilterType === "work") {
        const w = dataStore.works.getById(mapFilterId);
        const cityIds = new Set<string>();
        if (w?.place_written_id?.startsWith("city:")) cityIds.add(w.place_written_id.slice(5));
        for (const rid of w?.place_recipient_ids ?? []) {
          if (rid.startsWith("city:")) cityIds.add(rid.slice(5));
        }
        for (const r of dataStore.relations.getForEntity("work", mapFilterId)) {
          if (r.source_type === "city") cityIds.add(r.source_id);
          if (r.target_type === "city") cityIds.add(r.target_id);
        }
        result = result.filter((c) => cityIds.has(c.city_id));
      }
    }

    // Robust global text search: uses pre-built index
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) => CITY_SEARCH_INDEX.get(c.city_id)?.includes(q) ?? false);
    }

    return result;
  }, [activeDecade, includeCumulative, activeFilters, mapFilterType, mapFilterId, searchQuery]);

  const visibleArchSites = useMemo(() => {
    if (!archaeologyVisible) return [];
    if (includeCumulative) return dataStore.archaeology.getCumulativeAtDecade(activeDecade);
    return dataStore.archaeology.getActiveAtDecade(activeDecade);
  }, [activeDecade, archaeologyVisible, includeCumulative]);

  // ── Arc data ──────────────────────────────────────────────────────────────

  const arcPairs = useMemo<[CityAtDecade, CityAtDecade][]>(() => {
    if (!showArcs) return [];

    function makeFakeCity(cityId: string): CityAtDecade | null {
      const c = dataStore.cities.getById(cityId);
      if (!c || c.lat == null || c.lon == null) return null;
      return {
        ...c,
        place_id: `city:${cityId}`,
        decade: activeDecade,
        presence_status: "unknown",
        persuasion_ids: [],
        polity_id: null,
        ruling_subdivision: "",
        church_planted_year_scholarly: null,
        church_planted_year_earliest_claim: null,
        church_planted_by: "",
        apostolic_origin_thread: "",
        council_context: "",
        evidence_note_id: null,
      };
    }

    if (selection?.kind === "city") {
      const selectedCity = visibleCities.find((c) => c.city_id === selection.id)
        ?? makeFakeCity(selection.id);
      if (!selectedCity) return [];

      // Gather connected cities via footprints of associated people
      const footprints = dataStore.footprints.getForPlace(`city:${selection.id}`);
      const personIds = new Set(
        footprints.filter((f) => f.entity_type === "person").map((f) => f.entity_id),
      );
      // Also gather from relations
      const rels = dataStore.relations.getForEntity("city", selection.id);
      for (const r of rels) {
        const otherType = r.source_id === selection.id ? r.target_type : r.source_type;
        const otherId   = r.source_id === selection.id ? r.target_id   : r.source_id;
        if (otherType === "person") personIds.add(otherId);
      }

      const otherCityIds = new Set<string>();
      for (const pid of personIds) {
        for (const cid of getCityIdsForPerson(pid)) {
          if (cid !== selection.id) otherCityIds.add(cid);
        }
      }

      return Array.from(otherCityIds)
        .map((cid) => {
          const other = makeFakeCity(cid);
          return other ? [selectedCity, other] as [CityAtDecade, CityAtDecade] : null;
        })
        .filter(Boolean) as [CityAtDecade, CityAtDecade][];
    }

    if (selection?.kind === "person") {
      const cityIds = Array.from(getCityIdsForPerson(selection.id));
      const cities = cityIds.map(makeFakeCity).filter(Boolean) as CityAtDecade[];
      const pairs: [CityAtDecade, CityAtDecade][] = [];
      for (let i = 0; i < cities.length - 1; i++) {
        for (let j = i + 1; j < cities.length; j++) {
          const a = cities[i]; const b = cities[j];
          if (a && b) pairs.push([a, b]);
        }
      }
      return pairs;
    }

    return [];
  }, [showArcs, selection, visibleCities, activeDecade]);

  // ── Map initialization ────────────────────────────────────────────────────

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      worldCopyJump: true,
      zoomControl: true,
      preferCanvas: true,
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

    rowLayerRef.current  = L.layerGroup().addTo(map);
    archLayerRef.current = L.layerGroup().addTo(map);
    arcLayerRef.current  = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current       = null;
      rowLayerRef.current  = null;
      archLayerRef.current = null;
      arcLayerRef.current  = null;
      didFitRef.current    = false;
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

  // ── Render city/arch markers ──────────────────────────────────────────────

  useEffect(() => {
    const map     = mapRef.current;
    const rowLyr  = rowLayerRef.current;
    const archLyr = archLayerRef.current;
    if (!map || !rowLyr || !archLyr) return;

    rowLyr.clearLayers();
    archLyr.clearLayers();

    const bounds: L.LatLngExpression[] = [];
    const selCityId = selection?.kind === "city" ? selection.id : null;

    // Compute connected city IDs for non-city selections
    const connectedCityIds = selection?.kind !== "city" ? getConnectedCityIds(selection) : new Set<string>();
    const hasEntityHighlight = connectedCityIds.size > 0;

    for (const city of visibleCities) {
      if (city.lat == null || city.lon == null) continue;
      const isSelected  = city.city_id === selCityId;
      const isConnected = connectedCityIds.has(city.city_id);
      const isDimmed    = hasEntityHighlight && !isConnected;
      const color       = PRESENCE_COLORS[city.presence_status] ?? "#8e8070";
      const r           = isSelected ? 9 : isConnected ? 8 : 6;

      if (isSelected) {
        L.circleMarker([city.lat, city.lon], {
          radius: 17, color: "#c47c3a", weight: 2.5,
          fillColor: "transparent", fillOpacity: 0,
          dashArray: "5 4",
        }).addTo(rowLyr);
      }

      // Highlight ring for connected cities
      if (isConnected) {
        L.circleMarker([city.lat, city.lon], {
          radius: 14, color: "#c47c3a", weight: 2,
          fillColor: "transparent", fillOpacity: 0,
        }).addTo(rowLyr);
      }

      const m = L.circleMarker([city.lat, city.lon], {
        radius: r,
        color: isSelected ? "#c47c3a" : isConnected ? "#e8943a" : color,
        weight: isSelected ? 2.5 : isConnected ? 2 : 1.2,
        fillColor: isConnected ? "#e8943a" : color,
        fillOpacity: isSelected ? 1 : isDimmed ? 0.22 : isConnected ? 0.92 : 0.78,
      });

      const ancientName = city.city_ancient || city.city_label;
      const modernPart  = city.city_modern && city.city_modern !== ancientName
        ? ` (${city.city_modern})`
        : "";
      m.bindTooltip(
        `${ancientName}${modernPart}, ${city.country_modern}`,
        { direction: "top", offset: [0, -4], className: "city-tooltip" },
      );
      m.on("click", () => {
        setSelection({ kind: "city", id: city.city_id });
        setSidebarTab("places");
        if (!rightPanelVisible) toggleRightPanel();
      });
      m.addTo(rowLyr);
      bounds.push([city.lat, city.lon]);
    }

    for (const site of visibleArchSites) {
      if (site.lat == null || site.lon == null) continue;
      const isSelected = selection?.kind === "archaeology" && selection.id === site.archaeology_id;
      const icon = L.divIcon({
        className: "",
        html: `<div style="font-size:14px;color:${isSelected ? "#c47c3a" : "#b07e10"};text-shadow:0 1px 3px rgba(0,0,0,.3);line-height:1;">★</div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const m = L.marker([site.lat, site.lon], { icon });
      m.bindTooltip(site.name_display, { direction: "top" });
      m.on("click", () => {
        setSelection({ kind: "archaeology", id: site.archaeology_id });
        if (!rightPanelVisible) toggleRightPanel();
      });
      m.addTo(archLyr);
      bounds.push([site.lat, site.lon]);
    }

    if (!didFitRef.current && bounds.length > 0) {
      try { map.fitBounds(L.latLngBounds(bounds).pad(0.1)); } catch (_) {}
      didFitRef.current = true;
    }
  }, [visibleCities, visibleArchSites, selection, setSelection, setSidebarTab, rightPanelVisible, toggleRightPanel]);

  // ── Render arcs ───────────────────────────────────────────────────────────

  useEffect(() => {
    const arcLyr = arcLayerRef.current;
    if (!arcLyr) return;
    arcLyr.clearLayers();

    for (const [a, b] of arcPairs) {
      if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) continue;
      L.polyline([[a.lat, a.lon], [b.lat, b.lon]], {
        color: "#c47c3a",
        weight: 1.2,
        opacity: 0.45,
        dashArray: "4 4",
      }).addTo(arcLyr);
    }
  }, [arcPairs]);

  // ── Invalidate map size on layout changes ─────────────────────────────────

  useEffect(() => {
    const t = window.setTimeout(() => mapRef.current?.invalidateSize(), 160);
    return () => window.clearTimeout(t);
  }, [leftPanelVisible, rightPanelVisible, sidebarExpanded]);

  // ── Map action callbacks ──────────────────────────────────────────────────

  const handleFitVisible = useCallback(() => {
    const map = mapRef.current;
    const cities = visibleCities.filter((c) => c.lat != null && c.lon != null);
    if (!map || cities.length === 0) return;
    map.fitBounds(L.latLngBounds(cities.map((c) => [c.lat!, c.lon!])).pad(0.1));
  }, [visibleCities]);

  const handleCenterSelected = useCallback(() => {
    const map = mapRef.current;
    if (!map || !selection) return;
    if (selection.kind === "city") {
      const city = dataStore.cities.getById(selection.id);
      if (city?.lat != null && city?.lon != null) map.setView([city.lat, city.lon], 7, { animate: true });
    }
  }, [selection]);

  const handleRandomSite = useCallback(() => {
    const cities = visibleCities.filter((c) => c.lat != null && c.lon != null);
    if (!cities.length) return;
    const city = cities[Math.floor(Math.random() * cities.length)];
    if (!city) return;
    setSelection({ kind: "city", id: city.city_id });
    setSidebarTab("places");
    const map = mapRef.current;
    if (map && city.lat != null && city.lon != null) map.setView([city.lat, city.lon], 7, { animate: true });
  }, [visibleCities, setSelection, setSidebarTab]);


  const handleFlyToCity = useCallback((cityId: string) => {
    const map = mapRef.current;
    const city = dataStore.cities.getById(cityId);
    if (map && city?.lat != null && city?.lon != null) {
      map.setView([city.lat, city.lon], 7, { animate: true });
    }
  }, []);

  const handleFlyToArch = useCallback((archId: string) => {
    const map = mapRef.current;
    const site = dataStore.archaeology.getById(archId);
    if (map && site?.lat != null && site?.lon != null) {
      map.setView([site.lat, site.lon], 9, { animate: true });
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`map-layout${sidebarExpanded ? " sidebar-expanded" : ""}`}>
      {/* Left panel */}
      {leftPanelVisible && (
        <div className="map-left">
          <LeftPanel
            visibleCityCount={visibleCities.length}
            visibleArchCount={visibleArchSites.length}
            onFitVisible={handleFitVisible}
            onCenterSelected={handleCenterSelected}
            onRandomSite={handleRandomSite}
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
            matchedCityIds={new Set(visibleCities.map((c) => c.city_id))}
          />
        )}
      </div>

      {/* Right sidebar */}
      {rightPanelVisible && (
        <div className={`map-right${sidebarExpanded ? " expanded" : ""}`}>
          <RightSidebar
            onFlyToCity={handleFlyToCity}
            onFlyToArch={handleFlyToArch}
            currentDecade={activeDecade}
          />
        </div>
      )}
    </div>
  );
}

// ─── Search Results Panel ─────────────────────────────────────────────────────

const PAGE_SIZE = 20;

interface SearchMatch {
  kind: string;
  id: string;
  label: string;
  sub: string;
  decade?: number | null;
  isCurrentDecade: boolean;
}

function SearchResultsPanel({
  query,
  activeDecade,
  matchedCityIds,
}: {
  query: string;
  activeDecade: number;
  matchedCityIds: Set<string>;
}) {
  const setSelection  = useAppStore((s) => s.setSelection);
  const setSidebarTab = useAppStore((s) => s.setSidebarTab);
  const toggleRight   = useAppStore((s) => s.toggleRightPanel);
  const rightVisible  = useAppStore((s) => s.rightPanelVisible);
  const [page, setPage] = useState(0);

  const q = query.toLowerCase();

  const matches = useMemo((): SearchMatch[] => {
    const results: SearchMatch[] = [];

    // Cities (use pre-built index)
    for (const city of dataStore.cities.getAll()) {
      const blob = CITY_SEARCH_INDEX.get(city.city_id) ?? "";
      if (!blob.includes(q)) continue;
      results.push({
        kind: "city",
        id: city.city_id,
        label: city.city_ancient || city.city_label,
        sub: city.country_modern,
        decade: null,
        isCurrentDecade: matchedCityIds.has(city.city_id),
      });
    }

    // People
    for (const p of dataStore.people.getAll()) {
      const blob = [p.person_label, ...p.name_alt, ...p.roles, p.description, p.apostolic_connection].join(" ").toLowerCase();
      if (!blob.includes(q)) continue;
      const decade = p.birth_year ?? p.death_year ?? null;
      results.push({
        kind: "person", id: p.person_id, label: p.person_label,
        sub: p.roles.slice(0, 2).join(", "),
        decade,
        isCurrentDecade: Math.abs((decade ?? activeDecade) - activeDecade) < 60,
      });
    }

    // Works
    for (const w of dataStore.works.getAll()) {
      const blob = [w.title_display, w.author_name_display, w.description ?? "", w.significance ?? ""].join(" ").toLowerCase();
      if (!blob.includes(q)) continue;
      results.push({
        kind: "work", id: w.work_id, label: w.title_display,
        sub: w.author_name_display,
        decade: w.year_written_start,
        isCurrentDecade: !w.year_written_start || Math.abs(w.year_written_start - activeDecade) < 60,
      });
    }

    // Doctrines
    for (const d of dataStore.doctrines.getAll()) {
      const blob = [d.name_display, d.category, d.description ?? ""].join(" ").toLowerCase();
      if (!blob.includes(q)) continue;
      results.push({
        kind: "doctrine", id: d.doctrine_id, label: d.name_display,
        sub: d.category,
        decade: null,
        isCurrentDecade: true,
      });
    }

    // Events
    for (const e of dataStore.events.getAll()) {
      const blob = [e.name_display, e.event_type ?? "", e.description ?? ""].join(" ").toLowerCase();
      if (!blob.includes(q)) continue;
      results.push({
        kind: "event", id: e.event_id, label: e.name_display,
        sub: e.event_type ?? "",
        decade: e.year_start,
        isCurrentDecade: !e.year_start || Math.abs(e.year_start - activeDecade) < 60,
      });
    }

    // Persuasions
    for (const p of dataStore.persuasions.getAll()) {
      const blob = [p.persuasion_label, p.persuasion_stream ?? "", p.description ?? ""].join(" ").toLowerCase();
      if (!blob.includes(q)) continue;
      results.push({
        kind: "persuasion", id: p.persuasion_id, label: p.persuasion_label,
        sub: p.persuasion_stream ?? "",
        decade: null,
        isCurrentDecade: true,
      });
    }

    // Sort: current-decade matches first, then alphabetical
    results.sort((a, b) => {
      if (a.isCurrentDecade && !b.isCurrentDecade) return -1;
      if (!a.isCurrentDecade && b.isCurrentDecade) return 1;
      return a.label.localeCompare(b.label);
    });

    return results;
  }, [q, activeDecade, matchedCityIds]);

  // Reset page when query changes
  useEffect(() => { setPage(0); }, [q]);

  const totalPages = Math.ceil(matches.length / PAGE_SIZE);
  const pageItems  = matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSelect = (kind: string, id: string) => {
    setSelection({ kind: kind as import("../data/dataStore").Selection["kind"], id });
    if (kind === "city") setSidebarTab("places");
    if (!rightVisible) toggleRight();
  };

  if (matches.length === 0) return null;

  return (
    <div className="search-results-panel">
      <div className="search-results-header">
        <span className="search-results-title">
          {matches.length} match{matches.length !== 1 ? "es" : ""} for &ldquo;{query}&rdquo;
        </span>
        {totalPages > 1 && (
          <span style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>
            {page + 1} / {totalPages}
          </span>
        )}
      </div>

      <div className="search-results-list">
        {pageItems.map((m) => (
          <button
            key={`${m.kind}:${m.id}`}
            type="button"
            className={`search-result-item${m.isCurrentDecade ? " current" : ""}`}
            onClick={() => handleSelect(m.kind, m.id)}
          >
            <span className="search-result-icon">{KIND_ICONS[m.kind] ?? "•"}</span>
            <div className="search-result-body">
              <div className="search-result-label"><Hl text={m.label} query={q} /></div>
              {m.sub && <div className="search-result-sub"><Hl text={m.sub} query={q} /></div>}
            </div>
            {m.decade && (
              <span className="search-result-decade">AD {m.decade}</span>
            )}
          </button>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="search-results-pagination">
          <button type="button" className="action-btn" disabled={page === 0} onClick={() => setPage((p: number) => p - 1)}>
            ← Prev
          </button>
          <button type="button" className="action-btn" disabled={page >= totalPages - 1} onClick={() => setPage((p: number) => p + 1)}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
