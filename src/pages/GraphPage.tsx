import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { dataStore, getEntityLabel } from "../data/dataStore";
import type { Selection } from "../data/dataStore";
import { useAppStore } from "../stores/appStore";
import { type GraphNode, type GraphEdge, runForceSync } from "../utils/forceLayout";
import { KIND_ICONS } from "../components/shared/entityConstants";
import { ClaimCard } from "../components/shared/RelationCard";
import { formatPassageLocator } from "../utils/passageReferences";

// ─── Constants ────────────────────────────────────────────────────────────────

const KIND_COLORS: Record<string, string> = {
  person:      "#c47c3a",
  work:        "#4a9eca",
  proposition: "#9b72cf",
  event:       "#e67e22",
  place:       "#e9a84a",
  group:       "#e63946",
  topic:       "#6c757d",
  source:      "#2a9d8f",
};

// ─── Graph builder ────────────────────────────────────────────────────────────

function buildGraph(filter: string) {
  const claims = dataStore.claims.getAll().filter((c) => c.claim_status === "active");
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

  function addEdge(source: string, target: string, label: string, weight: number, relationId?: string) {
    const key = `${source}→${target}→${label}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ source, target, label, weight, relationId });
    connCounts.set(source, (connCounts.get(source) ?? 0) + 1);
    connCounts.set(target, (connCounts.get(target) ?? 0) + 1);
  }

  for (const c of claims) {
    if (c.object_mode !== "entity" || !c.object_id) continue;
    const srcKind = c.subject_type;
    const tgtKind = c.object_type;
    if (filter !== "all" && srcKind !== filter && tgtKind !== filter) continue;
    addNode(srcKind, c.subject_id);
    addNode(tgtKind, c.object_id);
    addEdge(
      `${srcKind}:${c.subject_id}`,
      `${tgtKind}:${c.object_id}`,
      c.predicate_id.replace(/_/g, " "),
      2,
      c.claim_id,
    );
  }

  const nodes = Array.from(nodeMap.values());
  for (const node of nodes) {
    const count = connCounts.get(node.id) ?? 0;
    node.connections = count;
    node.r = Math.max(8, Math.min(28, 8 + count * 1.6));
  }

  return { nodes, edges };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNodeLabel(nodeId: string, nodes: GraphNode[]): string {
  return nodes.find((n) => n.id === nodeId)?.label ?? nodeId;
}

// ─── Filter options ───────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: "all",         label: "All" },
  { value: "person",      label: "👤 People" },
  { value: "work",        label: "📜 Works" },
  { value: "proposition", label: "📝 Propositions" },
  { value: "event",       label: "⚡ Events" },
  { value: "place",       label: "🏛 Places" },
  { value: "group",       label: "✦ Groups" },
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
  const [minConnections, setMinConnections] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [, forceRender] = useState(0);

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
    if (tag === "svg" || tag === "g" || tag === "line") {
      panRef.current.active = true;
      panRef.current.lastX = e.clientX;
      panRef.current.lastY = e.clientY;
    }
  }

  const zoomIn  = useCallback(() => { const nz = Math.min(6, zoomRef.current * 1.25); zoomRef.current = nz; setZoom(nz); }, []);
  const zoomOut = useCallback(() => { const nz = Math.max(0.15, zoomRef.current * 0.8); zoomRef.current = nz; setZoom(nz); }, []);
  const resetView = useCallback(() => { setZoom(1); zoomRef.current = 1; setPan({ x: 0, y: 0 }); }, []);

  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    return nodesRef.current
      .filter((n) => n.label.toLowerCase().includes(q) || n.kind.toLowerCase().includes(q))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10);
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

  const selection: Selection | null = useMemo(() => {
    if (!selectedKey) return null;
    const colon = selectedKey.indexOf(":");
    if (colon < 0) return null;
    const kind = selectedKey.slice(0, colon);
    const id   = selectedKey.slice(colon + 1);
    return { kind: kind as Selection["kind"], id };
  }, [selectedKey]);

  function handleGoToMap() {
    if (selection) {
      useAppStore.getState().setSelection(selection);
    }
    navigate("/");
  }

  const allNodes = nodesRef.current;
  const allEdges = edgesRef.current;

  const visibleNodeIds = useMemo(() => {
    if (minConnections <= 1) return null;
    return new Set(allNodes.filter((n) => n.connections >= minConnections).map((n) => n.id));
  }, [allNodes, minConnections]);

  const nodes = visibleNodeIds ? allNodes.filter((n) => visibleNodeIds.has(n.id)) : allNodes;
  const edges = visibleNodeIds
    ? allEdges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
    : allEdges;

  const maxConn = useMemo(() => Math.max(1, ...allNodes.map((n) => n.connections)), [allNodes]);

  const hasSelection = selectedKey != null || selectedEdge != null;
  const connectedToSelected = useMemo(() => {
    if (!hasSelection) return null;
    const ids = new Set<string>();
    if (selectedKey) {
      ids.add(selectedKey);
      for (const e of edges) {
        if (e.source === selectedKey) ids.add(e.target);
        if (e.target === selectedKey) ids.add(e.source);
      }
    }
    if (selectedEdge != null) {
      const e = edges[selectedEdge];
      if (e) { ids.add(e.source); ids.add(e.target); }
    }
    return ids;
  }, [hasSelection, selectedKey, selectedEdge, edges]);

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
          <div className="panel-title">Claim Graph</div>
          <div className="panel-subtitle">{nodes.length} nodes · {edges.length} edges</div>
        </div>

        {/* Filter */}
        <div className="graph-sidebar-section">
          <div className="filter-label" style={{ marginBottom: 6 }}>Filter by type</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {FILTER_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`pchip${filter === value ? " active" : ""}`}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
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
              <button type="button" className="graph-clear-btn" onClick={() => { setSearchQuery(""); setSelectedKey(null); setShowDropdown(false); }}>✕</button>
            )}
          </div>
          {showDropdown && searchSuggestions.length > 0 && (
            <div className="graph-search-dropdown">
              {searchSuggestions.map((n) => (
                <button key={n.id} type="button" className="graph-search-suggestion" onMouseDown={() => handleSearchDropdownSelect(n.id)}>
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
              <span className="muted">{KIND_ICONS[kind] ?? "•"} {kind}</span>
            </div>
          ))}
          <div className="faint" style={{ marginTop: 8, fontSize: "0.74rem", lineHeight: 1.4 }}>Node size ∝ connections</div>
        </div>

        {/* Connection count slider */}
        <div className="graph-sidebar-section">
          <div className="filter-label" style={{ marginBottom: 6 }}>Min connections: {minConnections}</div>
          <input
            type="range"
            min={1}
            max={Math.max(2, maxConn)}
            value={minConnections}
            onChange={(e) => setMinConnections(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div className="faint" style={{ fontSize: "0.7rem", display: "flex", justifyContent: "space-between" }}>
            <span>1</span>
            <span>{maxConn}</span>
          </div>
        </div>

        {/* Selected node info */}
        {selectedKey && (
          <div className="graph-sidebar-section">
            <div className="filter-label" style={{ marginBottom: 5 }}>Selected Node</div>
            <div className="bold" style={{ fontSize: "0.88rem", marginBottom: 8 }}>
              {nodes.find((n) => n.id === selectedKey)?.label ?? selectedKey}
            </div>
            <button type="button" className="view-on-map-btn" style={{ width: "100%" }} onClick={handleGoToMap}>🗺 View on map</button>
          </div>
        )}

        {/* Selected edge info */}
        {selectedEdgeInfo && (
          <div className="graph-sidebar-section">
            <div className="filter-label" style={{ marginBottom: 5 }}>Selected Edge</div>
            <div style={{ fontSize: "0.8rem", lineHeight: 1.6 }}>
              <div className="bold">{getNodeLabel(selectedEdgeInfo.source, nodes)}</div>
              <div className="accent-text italic" style={{ margin: "2px 0" }}>— {selectedEdgeInfo.label} →</div>
              <div className="bold">{getNodeLabel(selectedEdgeInfo.target, nodes)}</div>
            </div>
            {selectedEdgeInfo.relationId && (() => {
              const claim = dataStore.claims.getById(selectedEdgeInfo.relationId);
              if (!claim) return null;
              const evidence = dataStore.claimEvidence.getForClaim(claim.claim_id);
              return (
                <div style={{ marginTop: 6, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  <div>{claim.predicate_id.replace(/_/g, " ")} · {claim.certainty}</div>
                  {claim.year_start && <div className="faint">AD {claim.year_start}{claim.year_end && claim.year_end !== claim.year_start ? `–${claim.year_end}` : ""}</div>}
                  {evidence.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {evidence.map((ev) => {
                        const passage = dataStore.passages.getById(ev.passage_id);
                        return <div key={ev.passage_id} className="faint">{ev.evidence_role}{passage ? ` — ${formatPassageLocator(passage)}` : ""}</div>;
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="flex-center" style={{ gap: 6, marginTop: 8 }}>
              <button type="button" className="filter-tab" onClick={() => { setSelectedKey(selectedEdgeInfo.source); setSelectedEdge(null); }}>Source</button>
              <button type="button" className="filter-tab" onClick={() => { setSelectedKey(selectedEdgeInfo.target); setSelectedEdge(null); }}>Target</button>
              <button type="button" className="close-btn" style={{ fontSize: "0.75rem" }} onClick={() => setSelectedEdge(null)}>✕</button>
            </div>
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
        <div className="graph-hint">Scroll to zoom · Drag canvas to pan · Click node or edge</div>

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
              const isDimmed = hasSelection && !isNodeSelected && !isEdgeSel;
              const mx = (src.x + tgt.x) / 2;
              const my = (src.y + tgt.y) / 2;
              const strokeColor = isEdgeSel ? "var(--accent)" : isNodeSelected ? "var(--accent-bright)" : "var(--border)";
              const strokeW = isEdgeSel ? 2.5 : isNodeSelected ? 1.5 : 0.8;
              const strokeOp = isEdgeSel ? 0.95 : isNodeSelected ? 0.75 : isDimmed ? 0.08 : 0.28;
              return (
                <g key={i}>
                  <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke="transparent" strokeWidth={10}
                    style={{ cursor: "pointer", pointerEvents: "stroke" }}
                    onMouseEnter={() => setHoveredEdge(i)} onMouseLeave={() => setHoveredEdge(null)}
                    onClick={(ev) => { ev.stopPropagation(); setSelectedEdge(selectedEdge === i ? null : i); setSelectedKey(null); }} />
                  <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke={strokeColor} strokeWidth={strokeW} strokeOpacity={strokeOp} style={{ pointerEvents: "none" }} />
                  {(isHovered || isEdgeSel) && (
                    <g style={{ pointerEvents: "none" }}>
                      <rect x={mx - 42} y={my - 17} width={84} height={17} rx={4} fill="var(--surface)" stroke="var(--border)" strokeWidth={0.5} fillOpacity={0.93} />
                      <text x={mx} y={my - 5} textAnchor="middle" fill="var(--text-muted)" fontSize="9">{e.label}</text>
                    </g>
                  )}
                </g>
              );
            })}
            {/* Nodes */}
            {nodes.map((n) => {
              const color = KIND_COLORS[n.kind] ?? "#6c757d";
              const isSelected = n.id === selectedKey;
              const isConnected = connectedToSelected?.has(n.id) ?? false;
              const isDimmed = hasSelection && !isSelected && !isConnected;
              const showLabel = isSelected || n.connections >= 3 || nodes.length < 60;
              return (
                <g key={n.id} transform={`translate(${n.x},${n.y})`} style={{ cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); setSelectedKey(n.id === selectedKey ? null : n.id); setSelectedEdge(null); }}>
                  {isSelected && <circle r={n.r + 7} fill="none" stroke="#fff" strokeWidth={2} strokeOpacity={0.4} />}
                  <circle
                    r={isSelected ? n.r + 3 : n.r}
                    fill={color}
                    fillOpacity={isSelected ? 0.95 : isDimmed ? 0.15 : isConnected ? 0.9 : 0.72}
                    stroke={isSelected ? "#fff" : isDimmed ? "transparent" : color}
                    strokeWidth={isSelected ? 2.5 : 0.8}
                  />
                  {n.connections >= 5 && !isSelected && !isDimmed && (
                    <text y={3} textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" style={{ pointerEvents: "none" }}>{n.connections}</text>
                  )}
                  {showLabel && !isDimmed && (
                    <text y={n.r + 11} textAnchor="middle" fill="var(--text)" fontSize={isSelected ? "10" : "8"} fontWeight={isSelected ? "700" : "400"} style={{ pointerEvents: "none" }}>
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
            No claims found for this filter.
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
    if (kind === "person")      return dataStore.people.getById(id)?.notes ?? "";
    if (kind === "work")        return dataStore.works.getById(id)?.notes ?? "";
    if (kind === "proposition") return dataStore.propositions.getById(id)?.description ?? "";
    if (kind === "event")       return dataStore.events.getById(id)?.notes ?? "";
    if (kind === "group")       return dataStore.groups.getById(id)?.notes ?? "";
    if (kind === "place")       return dataStore.places.getById(id)?.notes ?? "";
    return "";
  }, [kind, id]);

  const claims = useMemo(() => dataStore.claims.getForEntity(kind, id), [kind, id]);

  return (
    <div className="mini-card">
      <div className="graph-detail-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mini-card-kind">{KIND_ICONS[kind]} {kind}</div>
          <div className="mini-card-title" style={{ fontSize: "1rem" }}>{label}</div>
        </div>
        <button type="button" className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="graph-detail-body">
        {description && <p className="entity-desc">{description}</p>}

        {claims.length > 0 && (
          <div>
            <div className="mini-card-section-title">Claims ({claims.length})</div>
            {claims.slice(0, 8).map((c) => (
              <ClaimCard
                key={c.claim_id}
                claim={c}
                entityId={id}
                entityType={kind}
                onSelectEntity={onSelectNode}
              />
            ))}
          </div>
        )}

        <button type="button" className="view-on-map-btn" style={{ marginTop: "auto" }} onClick={onGoToMap}>🗺 View on map</button>
      </div>
    </div>
  );
}
