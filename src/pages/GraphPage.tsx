import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { dataStore, getEntityLabel } from "../data/dataStore";
import type { Selection } from "../data/dataStore";
import { type GraphNode, type GraphEdge, runForceSync, spreadNeighbors } from "../utils/forceLayout";
import { findShortestPath, type PathResult } from "../utils/pathFinder";
import { KIND_ICONS, KIND_COLORS, kindIcon, kindLabel } from "../components/shared/entityConstants";
import { CrossPageNav } from "../components/shared/CrossPageNav";
import { EntityDetail } from "../components/sidebar/EntityDetail";

// ─── Graph builder ────────────────────────────────────────────────────────────

function buildGraph(filters: string[]) {
  const claims = dataStore.claims.getAll().filter((c) => c.claim_status === "active");
  const nodeMap = new Map<string, GraphNode>();
  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];
  const connCounts = new Map<string, number>();

  let nodeIndex = 0;
  function addNode(kind: string, id: string) {
    const key = `${kind}:${id}`;
    if (!nodeMap.has(key)) {
      const angle = (nodeIndex * 2.399963) + Math.random() * 0.3;
      const radius = 30 + Math.sqrt(nodeIndex) * 22;
      nodeMap.set(key, {
        id: key, kind, label: getEntityLabel(kind, id),
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        vx: 0, vy: 0, r: 12, connections: 0,
      });
      nodeIndex++;
    }
  }

  function addEdge(source: string, target: string, label: string, weight: number, predicate?: string, relationId?: string) {
    const key = `${source}→${target}→${label}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ source, target, label, predicate, weight, relationId });
    connCounts.set(source, (connCounts.get(source) ?? 0) + 1);
    connCounts.set(target, (connCounts.get(target) ?? 0) + 1);
  }

  for (const c of claims) {
    if (c.object_mode !== "entity" || !c.object_id) continue;
    const srcKind = c.subject_type;
    const tgtKind = c.object_type;
    
    // When filtering, show connections where both entities match one of the selected types
    if (filters.length > 0 && !filters.includes("all")) {
      if (!filters.includes(srcKind) || !filters.includes(tgtKind)) continue;
    }
    
    addNode(srcKind, c.subject_id);
    addNode(tgtKind, c.object_id);
    addEdge(
      `${srcKind}:${c.subject_id}`,
      `${tgtKind}:${c.object_id}`,
      c.predicate_id.replace(/_/g, " "),
      2,
      c.predicate_id,
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

// ─── Filter options ───────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: "person",      label: "👤 People" },
  { value: "work",        label: "📜 Works" },
  { value: "proposition", label: "📝 Propositions" },
  { value: "event",       label: "⚡ Events" },
  { value: "place",       label: "🏛 Places" },
  { value: "group",       label: "✦ Groups" },
];

// ─── Path Picker Input (autocomplete for path finder) ─────────────────────────

function PathPickerInput({ placeholder, query, setQuery, selectedId, onSelect, onClear, nodes }: {
  placeholder: string;
  query: string;
  setQuery: (q: string) => void;
  selectedId: string | null;
  onSelect: (id: string, label: string) => void;
  onClear: () => void;
  nodes: GraphNode[];
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showAbove, setShowAbove] = useState(false);

  const suggestions = useMemo(() => {
    if (selectedId) return [];
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return nodes
      .filter((n) => n.label.toLowerCase().includes(q) || n.kind.toLowerCase().includes(q))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 8);
  }, [query, nodes, selectedId]);

  const handleOpen = () => {
    setOpen(true);
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setShowAbove(rect.top > window.innerHeight / 2);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="text"
        className="wiki-audit-input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (selectedId) onClear();
          handleOpen();
        }}
        onFocus={handleOpen}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        style={{ width: "100%", fontSize: "0.76rem" }}
      />
      {open && suggestions.length > 0 && (
        <div className="graph-search-dropdown" style={showAbove ? { bottom: "100%", top: "auto", marginBottom: 4 } : undefined}>
          {suggestions.map((n) => (
            <button key={n.id} type="button" className="graph-search-suggestion"
              onMouseDown={() => { onSelect(n.id, n.label); setOpen(false); }}>
              <span className="graph-node-badge" style={{ background: KIND_COLORS[n.kind] ?? "#666" }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── GraphPage ────────────────────────────────────────────────────────────────

export function GraphPage() {
  const [searchParams] = useSearchParams();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const svgSizeRef = useRef({ width: 800, height: 600 });
  const panRef = useRef({ lastX: 0, lastY: 0, active: false, didDrag: false });
  const zoomRef = useRef(1.0);

  const [filters, setFilters] = useState<string[]>(["all"]);
  const [minConnections, setMinConnections] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectionHistory, setSelectionHistory] = useState<string[]>([]);
  const [hoveredNodeKey, setHoveredNodeKey] = useState<string | null>(null);
  const [highlightedNodeKey, setHighlightedNodeKey] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [, forceRender] = useState(0);

  // Path finder state
  const [pathStartQuery, setPathStartQuery] = useState("");
  const [pathEndQuery, setPathEndQuery] = useState("");
  const [pathStartId, setPathStartId] = useState<string | null>(null);
  const [pathEndId, setPathEndId] = useState<string | null>(null);
  const [pathResult, setPathResult] = useState<PathResult | null>(null);
  const [pathNodeIds, setPathNodeIds] = useState<Set<string>>(new Set());

  // Auto-zoom to show a node and all its connections
  const zoomToNodeConnections = useCallback((nodeId: string) => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const center = nodes.find((n) => n.id === nodeId);
    if (!center) return;

    // Get fresh SVG dimensions (critical when page just became visible)
    const svg = svgRef.current;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        svgSizeRef.current = { width: rect.width, height: rect.height };
      }
    }

    const connectedIds = new Set<string>([nodeId]);
    for (const e of edges) {
      if (e.source === nodeId) connectedIds.add(e.target);
      if (e.target === nodeId) connectedIds.add(e.source);
    }
    const connectedNodes = nodes.filter((n) => connectedIds.has(n.id));
    if (connectedNodes.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of connectedNodes) {
      minX = Math.min(minX, n.x - n.r);
      maxX = Math.max(maxX, n.x + n.r);
      minY = Math.min(minY, n.y - n.r);
      maxY = Math.max(maxY, n.y + n.r);
    }

    const { width, height } = svgSizeRef.current;
    const padding = 80;
    const bboxW = maxX - minX + padding * 2;
    const bboxH = maxY - minY + padding * 2;
    const newZoom = Math.max(0.15, Math.min(4, Math.min(width / bboxW, height / bboxH)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    zoomRef.current = newZoom;
    setZoom(newZoom);
    setPan({ x: width / 2 - cx * newZoom, y: height / 2 - cy * newZoom });
  }, []);

  useEffect(() => {
    const { nodes, edges } = buildGraph(filters);
    
    // Measure SVG before running simulation
    const svg = svgRef.current;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        svgSizeRef.current = { width: rect.width, height: rect.height };
      }
    }
    
    const { width, height } = svgSizeRef.current;
    runForceSync(nodes, edges, width, height);
    nodesRef.current = nodes;
    edgesRef.current = edges;
    setSelectedKey(null);
    setHoveredNodeKey(null);
    setHighlightedNodeKey(null);

    // Auto-center: compute bounding box and fit all nodes
    if (nodes.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const n of nodes) {
        minX = Math.min(minX, n.x - n.r);
        maxX = Math.max(maxX, n.x + n.r);
        minY = Math.min(minY, n.y - n.r);
        maxY = Math.max(maxY, n.y + n.r);
      }
      const padding = 60;
      const bboxW = maxX - minX + padding * 2;
      const bboxH = maxY - minY + padding * 2;
      const newZoom = Math.max(0.15, Math.min(2, Math.min(width / bboxW, height / bboxH)));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      zoomRef.current = newZoom;
      setZoom(newZoom);
      setPan({ x: width / 2 - cx * newZoom, y: height / 2 - cy * newZoom });
    } else {
      setPan({ x: 0, y: 0 });
      setZoom(1.0);
      zoomRef.current = 1.0;
    }

    lastHandledParam.current = ""; // Reset so deep-link can re-process
    forceRender((n) => n + 1);
  }, [filters]);

  // Handle deep-link from URL params (e.g. /graph?kind=person&id=paul-of-tarsus)
  const lastHandledParam = useRef("");
  useEffect(() => {
    const kind = searchParams.get("kind");
    const id = searchParams.get("id");
    if (!kind || !id) {
      lastHandledParam.current = "";
      return;
    }
    const paramKey = `${kind}:${id}`;
    if (paramKey === lastHandledParam.current) return;
    
    // Wait for graph to be built AND SVG to be measured
    const trySelect = (attempts = 0) => {
      const svg = svgRef.current;
      const nodes = nodesRef.current;
      
      // Check if graph is built
      if (nodes.length === 0) {
        if (attempts < 15) {
          setTimeout(() => trySelect(attempts + 1), 50);
        }
        return;
      }
      
      // Check if SVG is measured
      if (svg) {
        const rect = svg.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          svgSizeRef.current = { width: rect.width, height: rect.height };
          const node = nodes.find((n) => n.id === paramKey);
          if (node) {
            lastHandledParam.current = paramKey;
            spreadNeighbors(nodes, edgesRef.current, paramKey);
            setSelectedKey(paramKey);
            zoomToNodeConnections(paramKey);
            forceRender((n) => n + 1);
          } else {
            lastHandledParam.current = paramKey; // Still mark as handled even if not found
          }
          return;
        }
      }
      if (attempts < 15) setTimeout(() => trySelect(attempts + 1), 50);
    };
    requestAnimationFrame(() => trySelect());
  }, [searchParams, zoomToNodeConnections]);

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
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) panRef.current.didDrag = true;
      panRef.current.lastX = e.clientX;
      panRef.current.lastY = e.clientY;
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  }

  function handleSvgMouseUp() { panRef.current.active = false; }

  function handleSvgMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    const tag = (e.target as Element).tagName.toLowerCase();
    if (tag !== "circle") {
      panRef.current.active = true;
      panRef.current.didDrag = false;
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
  }, [searchQuery, filters]);

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

  const hasSelection = selectedKey != null;
  const connectedToSelected = useMemo(() => {
    if (!hasSelection) return null;
    const ids = new Set<string>();
    ids.add(selectedKey!);
    for (const e of edges) {
      if (e.source === selectedKey) ids.add(e.target);
      if (e.target === selectedKey) ids.add(e.source);
    }
    return ids;
  }, [hasSelection, selectedKey, edges]);

  // Edges between selected node and the hovered connected neighbor
  const hoverEdgeDetails = useMemo(() => {
    if (!selectedKey || !hoveredNodeKey) return null;
    if (!connectedToSelected?.has(hoveredNodeKey)) return null;
    const between = edges.filter(
      (e) =>
        (e.source === selectedKey && e.target === hoveredNodeKey) ||
        (e.source === hoveredNodeKey && e.target === selectedKey),
    );
    if (between.length === 0) return null;
    return between.map((e) => {
      const claim = e.relationId ? dataStore.claims.getById(e.relationId) : null;
      const isOpposes = e.predicate?.includes("opposes_proposition") ?? false;
      return { label: e.label, isOpposes, certainty: claim?.certainty ?? "", yearStart: claim?.year_start, yearEnd: claim?.year_end };
    });
  }, [selectedKey, hoveredNodeKey, edges, connectedToSelected]);

  // Helper to get claim's "other" entity key for right-panel hover highlighting
  function getClaimOtherKey(claim: { subject_type: string; subject_id: string; object_type?: string; object_id?: string; object_mode: string }, focusKind: string, focusId: string): string | null {
    if (claim.object_mode !== "entity" || !claim.object_id || !claim.object_type) return null;
    const focusKey = `${focusKind}:${focusId}`;
    const subKey = `${claim.subject_type}:${claim.subject_id}`;
    const objKey = `${claim.object_type}:${claim.object_id}`;
    return subKey === focusKey ? objKey : subKey;
  }

  function pushGraphSelection(newKey: string | null) {
    if (newKey && newKey !== selectedKey) {
      if (selectedKey) setSelectionHistory((h) => [...h, selectedKey]);
      spreadNeighbors(nodesRef.current, edgesRef.current, newKey);
    }
    setSelectedKey(newKey);
    setHoveredNodeKey(null);
    setHighlightedNodeKey(null);
    if (newKey) zoomToNodeConnections(newKey);
    forceRender((n) => n + 1);
  }

  function popGraphSelection() {
    setSelectionHistory((h) => {
      const newH = [...h];
      const prev = newH.pop() ?? null;
      setSelectedKey(prev);
      setHoveredNodeKey(null);
      setHighlightedNodeKey(null);
      if (prev) {
        spreadNeighbors(nodesRef.current, edgesRef.current, prev);
        zoomToNodeConnections(prev);
      }
      forceRender((n) => n + 1);
      return newH;
    });
  }

  function handleNodeClick(nodeId: string) {
    if (nodeId === selectedKey) {
      setSelectedKey(null);
      setSelectionHistory([]);
      setHoveredNodeKey(null);
      setHighlightedNodeKey(null);
      forceRender((n) => n + 1);
    } else {
      pushGraphSelection(nodeId);
    }
  }

  return (
    <div className="graph-page">
      {/* ── Left sidebar ── */}
      <div className="graph-sidebar">
        <div className="panel-header">
          <div className="panel-eyebrow">Network</div>
          <div className="panel-title">Claim Graph</div>
          <div className="panel-subtitle">{nodes.length} nodes · {edges.length} edges</div>
        </div>

        {/* Node types (multi-select filter + legend combined) */}
        <div className="graph-sidebar-section">
          <div className="filter-label" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            Node types (multi-select)
            {!filters.includes("all") && (
              <button type="button" className="chip-show-all" onClick={() => setFilters(["all"])}>show all</button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {FILTER_OPTIONS.map(({ value, label }) => {
              const isActive = filters.includes("all") || filters.includes(value);
              return (
                <button key={value} type="button"
                  className={`graph-type-row${isActive ? " active" : ""}`}
                  onClick={() => {
                    setFilters((prev) => {
                      const without = prev.filter((v) => v !== "all" && v !== value);
                      if (prev.includes("all")) return [value];
                      if (prev.includes(value)) return without.length === 0 ? ["all"] : without;
                      return [...without, value];
                    });
                  }}>
                  <span className="graph-node-badge" style={{ background: KIND_COLORS[value] ?? "#666" }} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <div className="faint" style={{ marginTop: 6, fontSize: "0.72rem" }}>Node size ∝ connections</div>
        </div>

        {/* Search */}
        <div className="graph-sidebar-section" style={{ position: "relative" }}>
          <div className="filter-label" style={{ marginBottom: 6 }}>Search nodes</div>
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
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
              <button type="button" className="close-btn" onClick={() => { setSearchQuery(""); setSelectedKey(null); setShowDropdown(false); }}>✕</button>
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

        {/* Connection count slider */}
        <div className="graph-sidebar-section">
          <div className="filter-label" style={{ marginBottom: 6 }}>Min connections: <strong>{minConnections}</strong></div>
          <div className="timeline-range-row">
            <span>1</span>
            <span>{maxConn}</span>
          </div>
          <input
            type="range"
            className="timeline-slider"
            min={1}
            max={Math.max(2, maxConn)}
            value={minConnections}
            onChange={(e) => setMinConnections(Number(e.target.value))}
          />
        </div>

        {/* Path Finder */}
        <div className="graph-sidebar-section">
          <div className="filter-label" style={{ marginBottom: 6 }}>Path Finder</div>
          <div className="flex-col" style={{ gap: 4 }}>
            <PathPickerInput
              placeholder="Start entity…"
              query={pathStartQuery}
              setQuery={setPathStartQuery}
              selectedId={pathStartId}
              onSelect={(id, label) => { setPathStartId(id); setPathStartQuery(label); }}
              onClear={() => { setPathStartId(null); setPathResult(null); setPathNodeIds(new Set()); }}
              nodes={allNodes}
            />
            <PathPickerInput
              placeholder="End entity…"
              query={pathEndQuery}
              setQuery={setPathEndQuery}
              selectedId={pathEndId}
              onSelect={(id, label) => { setPathEndId(id); setPathEndQuery(label); }}
              onClear={() => { setPathEndId(null); setPathResult(null); setPathNodeIds(new Set()); }}
              nodes={allNodes}
            />
            <button type="button" className="action-btn" style={{ marginTop: 4 }}
              disabled={!pathStartId || !pathEndId}
              onClick={() => {
                if (!pathStartId || !pathEndId) return;
                const result = findShortestPath(allEdges, pathStartId, pathEndId);
                setPathResult(result);
                setPathNodeIds(new Set(result.steps.map((s) => s.nodeId)));
              }}
            >Find Path</button>
            {pathResult && (
              <div className="graph-path-result">
                {pathResult.found ? (
                  <>
                    <div className="graph-path-summary">
                      {pathResult.intermediaries} intermediar{pathResult.intermediaries === 1 ? "y" : "ies"}
                    </div>
                    <div className="graph-path-chain">
                      {pathResult.steps.map((step, i) => {
                        const node = allNodes.find((n) => n.id === step.nodeId);
                        return (
                          <div key={i} className="graph-path-step">
                            {i > 0 && <span className="graph-path-edge-label">{step.edgeLabel}</span>}
                            <button type="button" className="graph-path-node-btn" onClick={() => pushGraphSelection(step.nodeId)}
                              style={{ borderLeft: `3px solid ${KIND_COLORS[node?.kind ?? ""] ?? "#666"}` }}>
                              {kindIcon(node?.kind ?? "")} {node?.label ?? step.nodeId}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="faint" style={{ fontSize: "0.78rem" }}>No path found between these entities.</div>
                )}
                <button type="button" className="chip-show-all" style={{ marginTop: 4 }}
                  onClick={() => { setPathResult(null); setPathNodeIds(new Set()); setPathStartId(null); setPathEndId(null); setPathStartQuery(""); setPathEndQuery(""); }}>
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Graph canvas ── */}
      <div className="graph-canvas-area">
        <div className="graph-zoom-controls">
          <button type="button" className="map-overlay-btn graph-zoom-btn" onClick={zoomIn} title="Zoom in" style={{ fontSize: "1.2rem" }}>+</button>
          <button type="button" className="map-overlay-btn graph-zoom-btn" onClick={zoomOut} title="Zoom out" style={{ fontSize: "1.4rem" }}>−</button>
          <button type="button" className="map-overlay-btn graph-zoom-btn--fit" onClick={resetView} title="Reset view">fit</button>
        </div>
        <div className="graph-hint">Scroll to zoom · Drag to pan · Click node to explore</div>

        <svg
          ref={svgRef}
          className="graph-svg"
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onMouseLeave={() => { handleSvgMouseUp(); setHoveredNodeKey(null); }}
          onMouseDown={handleSvgMouseDown}
          onClick={() => { if (!panRef.current.didDrag) { setSelectedKey(null); setHoveredNodeKey(null); setHighlightedNodeKey(null); } }}
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Edges — visual only, no interaction */}
            {(() => {
              const nodeMap = new Map<string, GraphNode>();
              for (const n of nodes) nodeMap.set(n.id, n);
              return edges.map((e, i) => {
                const src = nodeMap.get(e.source);
                const tgt = nodeMap.get(e.target);
                if (!src || !tgt) return null;
                const isNodeSelected = selectedKey === e.source || selectedKey === e.target;
                const isHoverEdge = (hoveredNodeKey || highlightedNodeKey) && selectedKey && (() => {
                  const hk = hoveredNodeKey || highlightedNodeKey;
                  return (e.source === selectedKey && e.target === hk) ||
                         (e.source === hk && e.target === selectedKey);
                })();
                const isDimmed = hasSelection && !isNodeSelected;
                const isOpposes = e.predicate?.includes("opposes_proposition") ?? false;
                const baseStroke = isOpposes ? "#c0392b" : "var(--border)";
                const activeStroke = isOpposes ? "#e74c3c" : "var(--accent-bright)";
                const strokeColor = isHoverEdge ? activeStroke : isNodeSelected ? activeStroke : baseStroke;
                const strokeW = isHoverEdge ? 2.5 : isNodeSelected ? (isOpposes ? 2 : 1.5) : (isOpposes ? 1.2 : 0.8);
                const strokeOp = isHoverEdge ? 0.95 : isNodeSelected ? 0.75 : isDimmed ? 0.06 : (isOpposes ? 0.45 : 0.28);
                return (
                  <line key={i} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={strokeColor} strokeWidth={strokeW} strokeOpacity={strokeOp}
                    style={{ pointerEvents: "none" }} />
                );
              });
            })()}
            {/* Nodes */}
            {nodes.map((n) => {
              const color = KIND_COLORS[n.kind] ?? "#6c757d";
              const isSelected = n.id === selectedKey;
              const isConnected = connectedToSelected?.has(n.id) ?? false;
              const isHighlighted = n.id === highlightedNodeKey;
              const isHovered = n.id === hoveredNodeKey && hasSelection && isConnected;
              const isDimmed = hasSelection && !isSelected && !isConnected;
              const showLabel = isSelected || n.connections >= 3 || nodes.length < 60;
              return (
                <g key={n.id} transform={`translate(${n.x},${n.y})`}
                  style={{ cursor: isDimmed ? "default" : "pointer", pointerEvents: isDimmed ? "none" : "auto" }}
                  onClick={(ev) => { ev.stopPropagation(); handleNodeClick(n.id); }}
                  onMouseEnter={() => { if (hasSelection && isConnected && !isSelected) setHoveredNodeKey(n.id); }}
                  onMouseLeave={() => { if (hoveredNodeKey === n.id) setHoveredNodeKey(null); }}
                >
                  {/* Highlight ring from right-panel hover */}
                  {isHighlighted && !isSelected && (
                    <circle r={n.r + 9} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeOpacity={0.7} strokeDasharray="4 3" />
                  )}
                  {/* Selected ring */}
                  {isSelected && <circle r={n.r + 7} fill="none" stroke="#fff" strokeWidth={2} strokeOpacity={0.4} />}
                  {/* Hover ring */}
                  {isHovered && !isSelected && <circle r={n.r + 5} fill="none" stroke="var(--accent-bright)" strokeWidth={2} strokeOpacity={0.6} />}
                  <circle
                    r={isSelected ? n.r + 3 : n.r}
                    fill={color}
                    fillOpacity={isSelected ? 0.95 : isDimmed ? 0.15 : isConnected ? 0.9 : 0.72}
                    stroke={isSelected ? "#fff" : isHovered ? "var(--accent-bright)" : isDimmed ? "transparent" : color}
                    strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 0.8}
                  />
                  {n.connections >= 5 && !isSelected && !isDimmed && (
                    <text y={3} textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700">{n.connections}</text>
                  )}
                  {showLabel && !isDimmed && (
                    <text y={n.r + 11} textAnchor="middle" fill="var(--text)" fontSize={isSelected ? "10" : "8"} fontWeight={isSelected ? "700" : "400"}>
                      {n.label.length > 20 ? n.label.slice(0, 19) + "…" : n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover overlay — shows relationship details between selected and hovered node */}
        {hoveredNodeKey && hoverEdgeDetails && (() => {
          const hNode = nodes.find((nd) => nd.id === hoveredNodeKey);
          if (!hNode) return null;
          const screenX = hNode.x * zoom + pan.x;
          const screenY = hNode.y * zoom + pan.y - hNode.r * zoom - 12;
          return (
            <div className="graph-hover-overlay" style={{ left: screenX, top: screenY, transform: "translate(-50%, -100%)" }}>
              <div className="graph-hover-overlay-title">{hNode.label}</div>
              {hoverEdgeDetails.map((d, i) => (
                <div key={i} className="graph-hover-overlay-claim">
                  <span style={{ color: d.isOpposes ? "#e74c3c" : "var(--accent)" }}>{d.label}</span>
                  {d.isOpposes && <span style={{ color: "#e74c3c", fontWeight: 700 }}> ✗</span>}
                  {d.certainty && <span className="faint"> · {d.certainty}</span>}
                  {d.yearStart != null && (
                    <span className="faint"> · AD {d.yearStart}{d.yearEnd != null && d.yearEnd !== d.yearStart ? `–${d.yearEnd}` : ""}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {nodes.length === 0 && (
          <div className="empty-state" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
            No claims found for this filter.
          </div>
        )}
      </div>

      {/* ── Right detail panel ── */}
      {selection && (
        <div className="graph-right">
          <div className="graph-detail-close-bar">
            <button type="button" className="close-btn"
              onClick={() => { setSelectedKey(null); setHoveredNodeKey(null); setHighlightedNodeKey(null); }}
            >✕</button>
          </div>
          <EntityDetail
            key={`${selection.kind}:${selection.id}`}
            kind={selection.kind}
            id={selection.id}
            currentPage="graph"
            onBack={() => {
              if (selectionHistory.length > 0) popGraphSelection();
              else { setSelectedKey(null); setSelectionHistory([]); setHoveredNodeKey(null); setHighlightedNodeKey(null); }
            }}
            onExit={() => { setSelectedKey(null); setSelectionHistory([]); setHoveredNodeKey(null); setHighlightedNodeKey(null); }}
            onSelectEntity={(kind, id) => {
              pushGraphSelection(`${kind}:${id}`);
            }}
            onHoverEntity={(kind, id) => setHighlightedNodeKey(`${kind}:${id}`)}
            onLeaveEntity={() => setHighlightedNodeKey(null)}
          />
        </div>
      )}
    </div>
  );
}
