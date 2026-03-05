import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { dataStore, getEntityLabel } from "../data/dataStore";
import type { Selection } from "../data/dataStore";
import { useAppStore } from "../stores/appStore";
import { getRelationLabel } from "../domain/relationLabels";
import { type GraphNode, type GraphEdge, runForceSync } from "../utils/forceLayout";
import { KIND_ICONS } from "../components/shared/entityConstants";

// ─── Constants ────────────────────────────────────────────────────────────────

const KIND_COLORS: Record<string, string> = {
  person:      "#c47c3a",
  work:        "#4a9eca",
  doctrine:    "#9b72cf",
  event:       "#e67e22",
  archaeology: "#2a9d8f",
  city:        "#e9a84a",
  persuasion:  "#e63946",
  polity:      "#6c757d",
};

// ─── Graph builder ────────────────────────────────────────────────────────────

function buildGraph(filter: string) {
  const relations = dataStore.relations.getAll();
  const nodeMap = new Map<string, GraphNode>();
  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];
  const connCounts = new Map<string, number>();

  function addNode(kind: string, id: string) {
    const key = `${kind}:${id}`;
    if (!nodeMap.has(key)) {
      nodeMap.set(key, {
        id: key, kind, label: getEntityLabel(kind, id),
        x: (Math.random() - 0.5) * 600,
        y: (Math.random() - 0.5) * 400,
        vx: 0, vy: 0, r: 12, connections: 0,
      });
    }
  }

  function addEdge(source: string, target: string, label: string, weight: number) {
    const key = `${source}→${target}→${label}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ source, target, label, weight });
    connCounts.set(source, (connCounts.get(source) ?? 0) + 1);
    connCounts.set(target, (connCounts.get(target) ?? 0) + 1);
  }

  for (const r of relations) {
    const srcKind = r.source_type;
    const tgtKind = r.target_type;
    if (filter !== "all" && srcKind !== filter && tgtKind !== filter) continue;
    addNode(srcKind, r.source_id);
    addNode(tgtKind, r.target_id);
    addEdge(
      `${srcKind}:${r.source_id}`,
      `${tgtKind}:${r.target_id}`,
      r.relation_type.replace(/_/g, " "),
      r.weight ?? 2,
    );
  }

  for (const w of dataStore.works.getAll()) {
    if (!w.author_person_id) continue;
    if (filter !== "all" && filter !== "person" && filter !== "work") continue;
    addNode("person", w.author_person_id);
    addNode("work", w.work_id);
    addEdge(`person:${w.author_person_id}`, `work:${w.work_id}`, "authored", 3);
  }

  for (const q of dataStore.quotes.getAll()) {
    if (!q.work_id) continue;
    if (filter !== "all" && filter !== "work" && filter !== "doctrine") continue;
    addNode("work", q.work_id);
    addNode("doctrine", q.doctrine_id);
    addEdge(`work:${q.work_id}`, `doctrine:${q.doctrine_id}`, "addresses", 2);
  }

  if (filter === "all" || filter === "city" || filter === "person") {
    for (const p of dataStore.people.getAll()) {
      if (p.city_of_origin_id) {
        addNode("person", p.person_id);
        addNode("city", p.city_of_origin_id);
        addEdge(`person:${p.person_id}`, `city:${p.city_of_origin_id}`, "from", 2);
      }
    }
  }

  // Apply connection counts → node radius (larger = more connected)
  const nodes = Array.from(nodeMap.values());
  for (const node of nodes) {
    const count = connCounts.get(node.id) ?? 0;
    node.connections = count;
    node.r = Math.max(8, Math.min(28, 8 + count * 1.6));
  }

  return { nodes, edges };
}

// Force layout imported from utils/forceLayout.ts

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEntityYear(kind: string, id: string): number | null {
  if (kind === "person") {
    const p = dataStore.people.getById(id);
    return p?.birth_year ?? p?.death_year ?? null;
  }
  if (kind === "work") {
    const w = dataStore.works.getById(id);
    return w?.year_written_start ?? null;
  }
  if (kind === "event") {
    const e = dataStore.events.getById(id);
    return e?.year_start ?? null;
  }
  return null;
}

function snapToDecade(year: number, decades: number[]): number {
  if (!decades.length) return year;
  return decades.reduce((best, d) =>
    Math.abs(d - year) < Math.abs(best - year) ? d : best, decades[0]!);
}

function getNodeLabel(nodeId: string, nodes: GraphNode[]): string {
  return nodes.find((n) => n.id === nodeId)?.label ?? nodeId;
}

// ─── Filter options ───────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: "all",       label: "All" },
  { value: "person",    label: "👤 People" },
  { value: "work",      label: "📜 Works" },
  { value: "doctrine",  label: "📖 Doctrines" },
  { value: "event",     label: "⚡ Events" },
  { value: "city",      label: "🏛 Places" },
];

// ─── GraphPage ────────────────────────────────────────────────────────────────

export function GraphPage() {
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const svgSizeRef = useRef({ width: 800, height: 600 });
  const panRef = useRef({ lastX: 0, lastY: 0, active: false });
  const zoomRef = useRef(1.0);

  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [, forceRender] = useState(0);

  // Build and layout graph synchronously when filter changes
  useEffect(() => {
    const { nodes, edges } = buildGraph(filter);
    const { width, height } = svgSizeRef.current;
    runForceSync(nodes, edges, width, height);
    nodesRef.current = nodes;
    edgesRef.current = edges;
    setSelectedKey(null);
    setSelectedEdge(null);
    setPan({ x: 0, y: 0 });
    setZoom(1.0);
    zoomRef.current = 1.0;
    forceRender((n) => n + 1);
  }, [filter]);

  // Observe SVG size
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) svgSizeRef.current = { width: e.contentRect.width, height: e.contentRect.height };
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Non-passive wheel zoom (must use addEventListener to call preventDefault)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scaleFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setZoom((prevZoom) => {
        const newZoom = Math.max(0.15, Math.min(6, prevZoom * scaleFactor));
        zoomRef.current = newZoom;
        setPan((prevPan) => {
          const gx = (mouseX - prevPan.x) / prevZoom;
          const gy = (mouseY - prevPan.y) / prevZoom;
          return { x: mouseX - gx * newZoom, y: mouseY - gy * newZoom };
        });
        return newZoom;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Pan handlers (no node dragging)
  function handleSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (panRef.current.active) {
      const dx = e.clientX - panRef.current.lastX;
      const dy = e.clientY - panRef.current.lastY;
      panRef.current.lastX = e.clientX;
      panRef.current.lastY = e.clientY;
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  }

  function handleSvgMouseUp() { panRef.current.active = false; }

  function handleSvgMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    const tag = (e.target as Element).tagName;
    if (tag === "svg" || tag === "g") {
      panRef.current.active = true;
      panRef.current.lastX = e.clientX;
      panRef.current.lastY = e.clientY;
    }
  }

  // Zoom button handlers
  const zoomIn  = useCallback(() => {
    const nz = Math.min(6, zoomRef.current * 1.25);
    zoomRef.current = nz;
    setZoom(nz);
  }, []);
  const zoomOut = useCallback(() => {
    const nz = Math.max(0.15, zoomRef.current * 0.8);
    zoomRef.current = nz;
    setZoom(nz);
  }, []);
  const resetView = useCallback(() => {
    setZoom(1); setZoom(1); zoomRef.current = 1; setPan({ x: 0, y: 0 });
  }, []);

  // Search: live dropdown, pan to selected node on pick
  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    return nodesRef.current
      .filter((n) => n.label.toLowerCase().includes(q) || n.kind.toLowerCase().includes(q))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filter]);

  const panToNode = useCallback((node: GraphNode) => {
    const { width, height } = svgSizeRef.current;
    const z = zoomRef.current;
    setPan({ x: width / 2 - node.x * z, y: height / 2 - node.y * z });
  }, []);

  function handleSearchDropdownSelect(nodeId: string) {
    setSelectedKey(nodeId);
    setShowDropdown(false);
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node) panToNode(node);
  }

  function handleSearchEnter() {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const match = nodesRef.current
      .filter((n) => n.label.toLowerCase().includes(q) || n.kind.toLowerCase().includes(q))
      .sort((a, b) => b.connections - a.connections)[0];
    if (match) { setSelectedKey(match.id); panToNode(match); }
    setShowDropdown(false);
  }

  // Selection → entity object
  const selection: Selection | null = useMemo(() => {
    if (!selectedKey) return null;
    const colon = selectedKey.indexOf(":");
    if (colon < 0) return null;
    const kind = selectedKey.slice(0, colon);
    const id   = selectedKey.slice(colon + 1);
    return { kind: kind as Selection["kind"], id };
  }, [selectedKey]);

  // "View on map" — navigate and set decade
  function handleGoToMap() {
    if (selection) {
      useAppStore.getState().setSelection(selection);
      const year = getEntityYear(selection.kind, selection.id);
      if (year) {
        const decades = dataStore.map.getDecades();
        useAppStore.getState().setDecade(snapToDecade(year, decades));
      }
    }
    navigate("/");
  }

  const nodes = nodesRef.current;
  const edges = edgesRef.current;
  const selectedEdgeInfo = selectedEdge != null ? edges[selectedEdge] ?? null : null;

  return (
    <div className="graph-page">
      {/* ── Left sidebar ── */}
      <div className="graph-sidebar">
        <div className="graph-sidebar-section">
          <button type="button" className="map-overlay-btn" style={{ width: "100%", textAlign: "left", boxShadow: "none" }} onClick={() => navigate("/")}>
            ← Map
          </button>
        </div>

        <div className="panel-header">
          <div className="panel-eyebrow">Network</div>
          <div className="panel-title">Connection Graph</div>
          <div className="panel-subtitle">{nodes.length} nodes · {edges.length} edges</div>
        </div>

        {/* Filter */}
        <div className="graph-sidebar-section">
          <div className="filter-label" style={{ marginBottom: 6 }}>Filter by type</div>
          <div className="flex-col" style={{ gap: 3 }}>
            {FILTER_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`filter-tab${filter === value ? " active" : ""}`}
                style={{ textAlign: "left" }}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Search with live dropdown */}
        <div className="graph-sidebar-section" style={{ position: "relative" }}>
          <div className="filter-label" style={{ marginBottom: 6 }}>Search nodes</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              className="graph-search-input"
              placeholder="Name or kind…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearchEnter();
                if (e.key === "Escape") setShowDropdown(false);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
            />
            {searchQuery && (
              <button
                type="button"
                className="graph-clear-btn"
                onClick={() => { setSearchQuery(""); setSelectedKey(null); setShowDropdown(false); }}
              >
                ✕
              </button>
            )}
          </div>
          {showDropdown && searchSuggestions.length > 0 && (
            <div className="graph-search-dropdown">
              {searchSuggestions.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="graph-search-suggestion"
                  onMouseDown={() => handleSearchDropdownSelect(n.id)}
                >
                  <span className="graph-node-badge" style={{ background: KIND_COLORS[n.kind] ?? "#666" }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.label}</span>
                  <span className="faint" style={{ fontSize: "0.7rem" }}>{n.connections} conn</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="graph-sidebar-section">
          <div className="filter-label" style={{ marginBottom: 6 }}>Node types</div>
          {Object.entries(KIND_COLORS).map(([kind, color]) => (
            <div key={kind} className="graph-legend-item">
              <span className="graph-node-badge" style={{ width: 10, height: 10, background: color }} />
              <span className="muted">{KIND_ICONS[kind]} {kind}</span>
            </div>
          ))}
          <div className="faint" style={{ marginTop: 8, fontSize: "0.74rem", lineHeight: 1.4 }}>
            Node size ∝ connections
          </div>
        </div>

        {/* Selected node info */}
        {selectedKey && (
          <div className="graph-sidebar-section">
            <div className="filter-label" style={{ marginBottom: 5 }}>Selected</div>
            <div className="bold" style={{ fontSize: "0.88rem", marginBottom: 8 }}>
              {nodes.find((n) => n.id === selectedKey)?.label ?? selectedKey}
            </div>
            <button type="button" className="view-on-map-btn" style={{ width: "100%" }} onClick={handleGoToMap}>
              🗺 View on map
            </button>
          </div>
        )}

        {/* Selected edge info */}
        {selectedEdgeInfo && (
          <div className="graph-sidebar-section">
            <div className="filter-label" style={{ marginBottom: 5 }}>Connection</div>
            <div style={{ fontSize: "0.8rem", lineHeight: 1.6 }}>
              <div className="bold">{getNodeLabel(selectedEdgeInfo.source, nodes)}</div>
              <div className="accent-text italic" style={{ margin: "2px 0" }}>— {selectedEdgeInfo.label} →</div>
              <div className="bold">{getNodeLabel(selectedEdgeInfo.target, nodes)}</div>
            </div>
            <div className="flex-center" style={{ gap: 6, marginTop: 6 }}>
              <button type="button" className="filter-tab" onClick={() => setSelectedKey(selectedEdgeInfo.source)}>Go to source</button>
              <button type="button" className="filter-tab" onClick={() => setSelectedKey(selectedEdgeInfo.target)}>Go to target</button>
            </div>
            <button type="button" className="close-btn" style={{ marginTop: 4, fontSize: "0.75rem" }} onClick={() => setSelectedEdge(null)}>
              ✕ dismiss
            </button>
          </div>
        )}
      </div>

      {/* ── Graph canvas ── */}
      <div className="graph-canvas-area">
        <div className="graph-zoom-controls">
          <button type="button" className="map-overlay-btn graph-zoom-btn" onClick={zoomIn} title="Zoom in" style={{ fontSize: "1.2rem" }}>+</button>
          <button type="button" className="map-overlay-btn graph-zoom-btn" onClick={zoomOut} title="Zoom out" style={{ fontSize: "1.4rem" }}>−</button>
          <button type="button" className="map-overlay-btn graph-zoom-btn--fit" onClick={resetView} title="Reset view">fit</button>
        </div>
        <div className="graph-hint">
          Scroll to zoom · Drag canvas to pan · Click node or edge
        </div>

        <svg
          ref={svgRef}
          className="graph-svg"
          style={{ cursor: "grab" }}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onMouseLeave={handleSvgMouseUp}
          onMouseDown={handleSvgMouseDown}
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {edges.map((e, i) => {
              const src = nodes.find((n) => n.id === e.source);
              const tgt = nodes.find((n) => n.id === e.target);
              if (!src || !tgt) return null;
              const isNodeSelected = selectedKey === e.source || selectedKey === e.target;
              const isEdgeSel = selectedEdge === i;
              const isHovered = hoveredEdge === i;
              const mx = (src.x + tgt.x) / 2;
              const my = (src.y + tgt.y) / 2;
              const strokeColor = isEdgeSel
                ? "var(--accent)"
                : isNodeSelected
                  ? "var(--accent-bright)"
                  : "var(--border)";
              const strokeW = isEdgeSel ? 2.5 : isNodeSelected ? Math.max(1.5, e.weight * 0.4) : 0.8;
              const strokeOp = isEdgeSel ? 0.95 : isNodeSelected ? 0.75 : 0.28;
              return (
                <g key={i}>
                  {/* Wide invisible hit area */}
                  <line
                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke="transparent" strokeWidth={10}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredEdge(i)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelectedEdge(selectedEdge === i ? null : i);
                      setSelectedKey(null);
                    }}
                  />
                  <line
                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={strokeColor}
                    strokeWidth={strokeW}
                    strokeOpacity={strokeOp}
                    style={{ pointerEvents: "none" }}
                  />
                  {/* Label on hover or selected */}
                  {(isHovered || isEdgeSel) && (
                    <g style={{ pointerEvents: "none" }}>
                      <rect
                        x={mx - 42} y={my - 17} width={84} height={17}
                        rx={4} fill="var(--surface)" stroke="var(--border)" strokeWidth={0.5} fillOpacity={0.93}
                      />
                      <text x={mx} y={my - 5} textAnchor="middle" fill="var(--text-muted)" fontSize="9">
                        {e.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((n) => {
              const color      = KIND_COLORS[n.kind] ?? "#6c757d";
              const isSelected = n.id === selectedKey;
              // Show label if: selected, high-connection, or small graph
              const showLabel  = isSelected || n.connections >= 3 || nodes.length < 60;
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedKey(n.id === selectedKey ? null : n.id);
                    setSelectedEdge(null);
                  }}
                >
                  {isSelected && (
                    <circle r={n.r + 7} fill="none" stroke="#fff" strokeWidth={2} strokeOpacity={0.4} />
                  )}
                  <circle
                    r={isSelected ? n.r + 3 : n.r}
                    fill={color}
                    fillOpacity={isSelected ? 0.95 : 0.72}
                    stroke={isSelected ? "#fff" : color}
                    strokeWidth={isSelected ? 2.5 : 0.8}
                  />
                  {/* Connection count badge for highly-connected nodes */}
                  {n.connections >= 5 && !isSelected && (
                    <text y={3} textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" style={{ pointerEvents: "none" }}>
                      {n.connections}
                    </text>
                  )}
                  {showLabel && (
                    <text
                      y={n.r + 11}
                      textAnchor="middle"
                      fill="var(--text)"
                      fontSize={isSelected ? "10" : "8"}
                      fontWeight={isSelected ? "700" : "400"}
                      style={{ pointerEvents: "none" }}
                    >
                      {n.label.length > 20 ? n.label.slice(0, 19) + "…" : n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {nodes.length === 0 && (
          <div className="empty-state" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
            No relations found for this filter.
          </div>
        )}
      </div>

      {/* ── Right detail panel ── */}
      {selection && (
        <div className="graph-right">
          <GraphDetailPanel
            selection={selection}
            onClose={() => setSelectedKey(null)}
            onGoToMap={handleGoToMap}
            onSelectNode={(kind, id) => {
              setSelectedKey(`${kind}:${id}`);
              const node = nodesRef.current.find((n) => n.id === `${kind}:${id}`);
              if (node) panToNode(node);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── GraphDetailPanel ─────────────────────────────────────────────────────────

function GraphDetailPanel({ selection, onClose, onGoToMap, onSelectNode }: {
  selection: Selection;
  onClose: () => void;
  onGoToMap: () => void;
  onSelectNode: (kind: string, id: string) => void;
}) {
  const { kind, id } = selection;
  const label = getEntityLabel(kind, id);

  const description = useMemo(() => {
    if (kind === "person")    return dataStore.people.getById(id)?.description ?? "";
    if (kind === "work")      return dataStore.works.getById(id)?.description ?? "";
    if (kind === "doctrine")  return dataStore.doctrines.getById(id)?.description ?? "";
    if (kind === "event")     return dataStore.events.getById(id)?.description ?? "";
    if (kind === "persuasion")return dataStore.persuasions.getById(id)?.description ?? "";
    if (kind === "polity")    return dataStore.polities.getById(id)?.description ?? "";
    return "";
  }, [kind, id]);

  const subtitle = useMemo(() => {
    if (kind === "person") {
      const p = dataStore.people.getById(id);
      return p ? [p.birth_year && `b. AD ${p.birth_year}`, p.death_year && `d. AD ${p.death_year}`].filter(Boolean).join(" · ") : "";
    }
    if (kind === "work") {
      const w = dataStore.works.getById(id);
      return w ? `${w.author_name_display}${w.year_written_start ? ` · AD ${w.year_written_start}` : ""}` : "";
    }
    if (kind === "doctrine") return dataStore.doctrines.getById(id)?.category ?? "";
    if (kind === "event") {
      const e = dataStore.events.getById(id);
      return e ? [e.year_start && `AD ${e.year_start}`, e.event_type].filter(Boolean).join(" · ") : "";
    }
    if (kind === "city") return dataStore.cities.getById(id)?.country_modern ?? "";
    return "";
  }, [kind, id]);

  // Build connections list
  const connections = useMemo(() => {
    type Conn = { othKind: string; othId: string; label: string; isOut: boolean };
    const seen = new Set<string>();
    const list: Conn[] = [];
    const add = (othKind: string, othId: string, label: string, isOut: boolean) => {
      const key = `${othKind}:${othId}:${label}`;
      if (!seen.has(key)) { seen.add(key); list.push({ othKind, othId, label, isOut }); }
    };

    for (const r of dataStore.relations.getForEntity(kind, id)) {
      const isOut   = r.source_id === id && r.source_type === kind;
      const othId   = isOut ? r.target_id   : r.source_id;
      const othKind = isOut ? r.target_type : r.source_type;
      add(othKind, othId, getRelationLabel(r.relation_type, isOut), isOut);
    }

    if (kind === "work") {
      const w = dataStore.works.getById(id);
      if (w?.author_person_id) add("person", w.author_person_id, "authored by", false);
      for (const q of dataStore.quotes.getByWork(id)) add("doctrine", q.doctrine_id, "addresses", true);
    }
    if (kind === "person") {
      for (const w of dataStore.works.getAll()) {
        if (w.author_person_id === id) add("work", w.work_id, "authored", true);
      }
    }

    return list;
  }, [kind, id]);

  return (
    <div className="mini-card">
      <div className="graph-detail-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mini-card-kind">{KIND_ICONS[kind]} {kind}</div>
          <div className="mini-card-title" style={{ fontSize: "1rem" }}>{label}</div>
          {subtitle && <div className="mini-card-subtitle">{subtitle}</div>}
        </div>
        <button type="button" className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="graph-detail-body">
        {description && <p className="entity-desc">{description}</p>}

        {connections.length > 0 && (
          <div>
            <div className="mini-card-section-title">Connections ({connections.length})</div>
            {connections.map(({ othKind, othId, label: relLabel, isOut }, i) => (
              <button
                key={i}
                type="button"
                className="mini-card-conn"
                onClick={() => onSelectNode(othKind, othId)}
                title={`Select ${othKind}: ${getEntityLabel(othKind, othId)}`}
              >
                <span className="faint">{KIND_ICONS[othKind]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mini-card-conn-label">{getEntityLabel(othKind, othId)}</div>
                  <div className="mini-card-conn-rel">{isOut ? "→" : "←"} {relLabel}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        <button type="button" className="view-on-map-btn" style={{ marginTop: "auto" }} onClick={onGoToMap}>
          🗺 View on map
        </button>
      </div>
    </div>
  );
}
