import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { dataStore, getEntityLabel } from "../data/dataStore";
import type { Selection } from "../data/dataStore";
import { type GraphNode, type GraphEdge, runForceSync, spreadNeighbors } from "../utils/forceLayout";
import { findKShortestPaths, computeDegrees, type PathResult, type MultiPathResult, type DegreesResult } from "../utils/pathFinder";

// === Graph builder ===

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

// === Filter options ===

export const FILTER_OPTIONS = [
  { value: "person",      label: "👤 People" },
  { value: "work",        label: "📜 Works" },
  { value: "proposition", label: "📝 Propositions" },
  { value: "event",       label: "⚡ Events" },
  { value: "place",       label: "🏛 Places" },
  { value: "group",       label: "✦ Groups" },
];

// === Hook ===

export function useGraphPageState(svgRef: React.RefObject<SVGSVGElement | null>) {
  const [searchParams] = useSearchParams();
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
  const selectedKeyRef = useRef<string | null>(null);
  selectedKeyRef.current = selectedKey;
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
  const [multiPathResult, setMultiPathResult] = useState<MultiPathResult | null>(null);
  const [pathIndex, setPathIndex] = useState(0);
  const [pathNodeIds, setPathNodeIds] = useState<Set<string>>(new Set());
  const [pathEdgePairs, setPathEdgePairs] = useState<Set<string>>(new Set());

  const pathResult: PathResult | null = multiPathResult?.paths[pathIndex] ?? null;
  const pathTotal = multiPathResult?.total ?? 0;

  // Degrees of Kevin Bacon mode
  const [degreesResult, setDegreesResult] = useState<DegreesResult | null>(null);
  const [degreesSourceId, setDegreesSourceId] = useState<string | null>(null);

  // Auto-zoom to show a node and all its connections
  const zoomToNodeConnections = useCallback((nodeId: string) => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const center = nodes.find((n) => n.id === nodeId);
    if (!center) return;

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
  }, [svgRef]);

  // Build graph on filter change
  useEffect(() => {
    const { nodes, edges } = buildGraph(filters);

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

    lastHandledParam.current = "";
    forceRender((n) => n + 1);
  }, [filters, svgRef]);

  // Handle deep-link from URL params
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

    const trySelect = (attempts = 0) => {
      const svg = svgRef.current;
      const nodes = nodesRef.current;

      if (nodes.length === 0) {
        if (attempts < 15) setTimeout(() => trySelect(attempts + 1), 50);
        return;
      }

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
            lastHandledParam.current = paramKey;
          }
          return;
        }
      }
      if (attempts < 15) setTimeout(() => trySelect(attempts + 1), 50);
    };
    requestAnimationFrame(() => trySelect());
  }, [searchParams, zoomToNodeConnections, svgRef]);

  // SVG resize observer
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) svgSizeRef.current = { width: e.contentRect.width, height: e.contentRect.height };
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [svgRef]);

  // Wheel zoom
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
  }, [svgRef]);

  // SVG mouse handlers
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

  function handleSvgClick() {
    if (!panRef.current.didDrag) {
      setSelectedKey(null);
      setHoveredNodeKey(null);
      setHighlightedNodeKey(null);
    }
  }

  function handleSvgMouseLeave() {
    handleSvgMouseUp();
    setHoveredNodeKey(null);
  }

  const zoomIn  = useCallback(() => { const nz = Math.min(6, zoomRef.current * 1.25); zoomRef.current = nz; setZoom(nz); }, []);
  const zoomOut = useCallback(() => { const nz = Math.max(0.15, zoomRef.current * 0.8); zoomRef.current = nz; setZoom(nz); }, []);
  const resetView = useCallback(() => {
    const nodes = nodesRef.current;
    const svg = svgRef.current;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        svgSizeRef.current = { width: rect.width, height: rect.height };
      }
    }
    if (nodes.length === 0) { setZoom(1); zoomRef.current = 1; setPan({ x: 0, y: 0 }); return; }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x - n.r);
      maxX = Math.max(maxX, n.x + n.r);
      minY = Math.min(minY, n.y - n.r);
      maxY = Math.max(maxY, n.y + n.r);
    }
    const { width, height } = svgSizeRef.current;
    const padding = 60;
    const bboxW = maxX - minX + padding * 2;
    const bboxH = maxY - minY + padding * 2;
    const nz = Math.max(0.15, Math.min(2, Math.min(width / bboxW, height / bboxH)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    zoomRef.current = nz;
    setZoom(nz);
    setPan({ x: width / 2 - cx * nz, y: height / 2 - cy * nz });
  }, [svgRef]);

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

  const centerOnSelected = useCallback(() => {
    const key = selectedKeyRef.current;
    if (!key) return;
    const node = nodesRef.current.find((n) => n.id === key);
    if (node) panToNode(node);
  }, [panToNode]);

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

  function clearSelection() {
    setSelectedKey(null);
    setSelectionHistory([]);
    setHoveredNodeKey(null);
    setHighlightedNodeKey(null);
  }

  function buildPathEdgePairs(steps: { nodeId: string }[]): Set<string> {
    const pairs = new Set<string>();
    for (let i = 0; i < steps.length - 1; i++) {
      const a = steps[i]!.nodeId;
      const b = steps[i + 1]!.nodeId;
      pairs.add(`${a}|${b}`);
      pairs.add(`${b}|${a}`);
    }
    return pairs;
  }

  function clearPathFinder() {
    setMultiPathResult(null);
    setPathIndex(0);
    setPathNodeIds(new Set());
    setPathEdgePairs(new Set());
    setPathStartId(null);
    setPathEndId(null);
    setPathStartQuery("");
    setPathEndQuery("");
  }

  function runPathFinder() {
    if (!pathStartId || !pathEndId) return;
    const result = findKShortestPaths(allEdges, pathStartId, pathEndId, 8);
    setMultiPathResult(result);
    setPathIndex(0);
    const first = result.paths[0];
    setPathNodeIds(first ? new Set(first.steps.map((step) => step.nodeId)) : new Set());
    setPathEdgePairs(first ? buildPathEdgePairs(first.steps) : new Set());
  }

  function nextPath() {
    if (!multiPathResult || pathIndex >= multiPathResult.total - 1) return;
    const next = pathIndex + 1;
    setPathIndex(next);
    const p = multiPathResult.paths[next];
    setPathNodeIds(p ? new Set(p.steps.map((step) => step.nodeId)) : new Set());
    setPathEdgePairs(p ? buildPathEdgePairs(p.steps) : new Set());
  }

  function prevPath() {
    if (!multiPathResult || pathIndex <= 0) return;
    const prev = pathIndex - 1;
    setPathIndex(prev);
    const p = multiPathResult.paths[prev];
    setPathNodeIds(p ? new Set(p.steps.map((step) => step.nodeId)) : new Set());
    setPathEdgePairs(p ? buildPathEdgePairs(p.steps) : new Set());
  }

  function swapPathEndpoints() {
    const tmpId = pathStartId;
    const tmpQ = pathStartQuery;
    setPathStartId(pathEndId);
    setPathStartQuery(pathEndQuery);
    setPathEndId(tmpId);
    setPathEndQuery(tmpQ);
  }

  function useSelectedAsPathStart() {
    if (!selectedKey) return;
    const node = nodesRef.current.find((n) => n.id === selectedKey);
    setPathStartId(selectedKey);
    setPathStartQuery(node?.label ?? selectedKey);
  }

  function useSelectedAsPathEnd() {
    if (!selectedKey) return;
    const node = nodesRef.current.find((n) => n.id === selectedKey);
    setPathEndId(selectedKey);
    setPathEndQuery(node?.label ?? selectedKey);
  }

  function runDegrees(sourceId: string) {
    const allIds = allNodes.map((n) => n.id);
    const result = computeDegrees(allEdges, sourceId, allIds);
    setDegreesResult(result);
    setDegreesSourceId(sourceId);
  }

  function clearDegrees() {
    setDegreesResult(null);
    setDegreesSourceId(null);
  }

  return {
    // Filters
    filters, setFilters, minConnections, setMinConnections,
    // Search
    searchQuery, setSearchQuery, showDropdown, setShowDropdown,
    searchSuggestions, handleSearchDropdownSelect, handleSearchEnter,
    // Selection
    selectedKey, selectionHistory, selection, hasSelection,
    pushGraphSelection, popGraphSelection, handleNodeClick, clearSelection,
    setHoveredNodeKey, hoveredNodeKey, highlightedNodeKey, setHighlightedNodeKey,
    // Graph data
    nodes, edges, allNodes, allEdges, maxConn,
    connectedToSelected, hoverEdgeDetails, pathNodeIds, pathEdgePairs,
    // View
    pan, zoom, zoomIn, zoomOut, resetView, centerOnSelected,
    // SVG handlers
    handleSvgMouseMove, handleSvgMouseUp, handleSvgMouseDown,
    handleSvgClick, handleSvgMouseLeave,
    // Path finder
    pathStartQuery, setPathStartQuery, pathEndQuery, setPathEndQuery,
    pathStartId, setPathStartId, pathEndId, setPathEndId,
    pathResult, pathTotal, pathIndex,
    runPathFinder, clearPathFinder, nextPath, prevPath,
    swapPathEndpoints, useSelectedAsPathStart, useSelectedAsPathEnd,
    degreesResult, degreesSourceId, runDegrees, clearDegrees,
  };
}
