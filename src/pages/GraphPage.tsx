import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { dataStore, getEntityLabel } from "../data/dataStore";
import type { Selection } from "../data/dataStore";
import { useAppStore } from "../stores/appStore";

// ─── Force simulation (no D3 dependency) ─────────────────────────────────────

interface GraphNode {
  id: string;
  kind: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
  weight: number;
}

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

const KIND_ICONS: Record<string, string> = {
  person: "👤", work: "📜", doctrine: "📖", event: "⚡",
  archaeology: "★", city: "🏛", persuasion: "✦", polity: "⚔",
};

function buildGraph(filter: string) {
  const relations = dataStore.relations.getAll();
  const nodeMap = new Map<string, GraphNode>();
  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];

  function addNode(kind: string, id: string) {
    const key = `${kind}:${id}`;
    if (!nodeMap.has(key)) {
      nodeMap.set(key, {
        id: key, kind, label: getEntityLabel(kind, id),
        x: (Math.random() - 0.5) * 600,
        y: (Math.random() - 0.5) * 400,
        vx: 0, vy: 0, r: 18,
      });
    }
  }

  function addEdge(source: string, target: string, label: string, weight: number) {
    const key = `${source}→${target}→${label}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ source, target, label, weight });
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

  // person → work (authored)
  for (const w of dataStore.works.getAll()) {
    if (!w.author_person_id) continue;
    if (filter !== "all" && filter !== "person" && filter !== "work") continue;
    addNode("person", w.author_person_id);
    addNode("work", w.work_id);
    addEdge(`person:${w.author_person_id}`, `work:${w.work_id}`, "authored", 3);
  }

  // work → doctrine (via quotes)
  for (const q of dataStore.quotes.getAll()) {
    if (!q.work_id) continue;
    if (filter !== "all" && filter !== "work" && filter !== "doctrine") continue;
    addNode("work", q.work_id);
    addNode("doctrine", q.doctrine_id);
    addEdge(`work:${q.work_id}`, `doctrine:${q.doctrine_id}`, "addresses", 2);
  }

  // city connections via footprints
  if (filter === "all" || filter === "city" || filter === "person") {
    for (const p of dataStore.people.getAll()) {
      if (p.city_of_origin_id) {
        addNode("person", p.person_id);
        addNode("city", p.city_of_origin_id);
        addEdge(`person:${p.person_id}`, `city:${p.city_of_origin_id}`, "from", 2);
      }
    }
  }

  return { nodes: Array.from(nodeMap.values()), edges };
}

function runForce(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number) {
  const k = 110;
  const gravity = 0.035;
  const damping = 0.82;
  const repulsion = 9000;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = repulsion / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx; a.vy -= fy;
      b.vx += fx; b.vy += fy;
    }
  }

  for (const edge of edges) {
    const src = nodes.find((n) => n.id === edge.source);
    const tgt = nodes.find((n) => n.id === edge.target);
    if (!src || !tgt) continue;
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const idealDist = k * (6 - Math.min(edge.weight, 5));
    const force = (dist - idealDist) * 0.04;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    src.vx += fx; src.vy += fy;
    tgt.vx -= fx; tgt.vy -= fy;
  }

  const cx = width / 2;
  const cy = height / 2;
  for (const n of nodes) {
    n.vx += (cx - n.x) * gravity;
    n.vy += (cy - n.y) * gravity;
    n.vx *= damping;
    n.vy *= damping;
    n.x += n.vx;
    n.y += n.vy;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: "all",       label: "All" },
  { value: "person",    label: "👤 People" },
  { value: "work",      label: "📜 Works" },
  { value: "doctrine",  label: "📖 Doctrines" },
  { value: "event",     label: "⚡ Events" },
  { value: "city",      label: "🏛 Places" },
];

export function GraphPage() {
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const animRef = useRef<number | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const svgSizeRef = useRef({ width: 800, height: 600 });

  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragNodeRef = useRef<string | null>(null);
  const panRef = useRef({ lastX: 0, lastY: 0, active: false });
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const { nodes, edges } = buildGraph(filter);
    nodesRef.current = nodes;
    edgesRef.current = edges;
    setSelectedKey(null);
  }, [filter]);

  // Search handler: select first matching node
  const handleSearchSelect = () => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const match = nodesRef.current.find(
      (n) => n.label.toLowerCase().includes(q) || n.kind.toLowerCase().includes(q)
    );
    if (match) setSelectedKey(match.id);
  };

  useEffect(() => {
    let frameCount = 0;
    function animate() {
      const { width, height } = svgSizeRef.current;
      runForce(nodesRef.current, edgesRef.current, width, height);
      frameCount++;
      if (frameCount % 2 === 0) setTick((t) => t + 1);
      // Stop early for large graphs to prevent bounce
      if (frameCount > 120 && nodesRef.current.length > 100) {
        if (animRef.current) cancelAnimationFrame(animRef.current);
      } else {
        animRef.current = requestAnimationFrame(animate);
      }
    }
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

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

  // Tick used only to trigger re-render
  void tick;

  function handleNodeMouseDown(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation();
    dragNodeRef.current = nodeId;
    setIsDragging(true);
  }

  function handleSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const x = e.clientX - rect.left - pan.x;
    const y = e.clientY - rect.top - pan.y;
    if (dragNodeRef.current) {
      const node = nodesRef.current.find((n) => n.id === dragNodeRef.current);
      if (node) { node.x = x; node.y = y; node.vx = 0; node.vy = 0; }
    } else if (panRef.current.active) {
      const dx = e.clientX - panRef.current.lastX;
      const dy = e.clientY - panRef.current.lastY;
      panRef.current.lastX = e.clientX;
      panRef.current.lastY = e.clientY;
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  }

  function handleSvgMouseUp() {
    dragNodeRef.current = null;
    setIsDragging(false);
    panRef.current.active = false;
  }

  function handleSvgMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    const tag = (e.target as Element).tagName;
    if (tag === "svg" || tag === "line") {
      panRef.current.active = true;
      panRef.current.lastX = e.clientX;
      panRef.current.lastY = e.clientY;
    }
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
    if (selection) useAppStore.getState().setSelection(selection);
    navigate("/");
  }

  const nodes = nodesRef.current;
  const edges = edgesRef.current;

  return (
    <div className="graph-page">
      {/* Left sidebar */}
      <div className="graph-sidebar">
        {/* Return to map */}
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
          <button
            type="button"
            className="map-overlay-btn"
            style={{ width: "100%", textAlign: "left", boxShadow: "none" }}
            onClick={handleGoToMap}
          >
            ← Map
          </button>
        </div>

        <div className="panel-header">
          <div className="panel-eyebrow">Network</div>
          <div className="panel-title">Connection Graph</div>
          <div className="panel-subtitle">{nodes.length} nodes · {edges.length} edges</div>
        </div>

        {/* Filter */}
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="filter-label" style={{ marginBottom: 6 }}>Filter by type</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
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

        {/* Search */}
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="filter-label" style={{ marginBottom: 6 }}>Search nodes</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              placeholder="Name or kind…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearchSelect(); }}
              style={{
                flex: 1,
                padding: "6px 9px",
                fontSize: "0.82rem",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-2)",
                color: "var(--text)",
              }}
            />
            <button
              type="button"
              onClick={handleSearchSelect}
              disabled={!searchQuery.trim()}
              style={{
                padding: "6px 12px",
                fontSize: "0.82rem",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                background: searchQuery.trim() ? "var(--accent)" : "var(--surface-3)",
                color: searchQuery.trim() ? "var(--surface)" : "var(--text-faint)",
                cursor: searchQuery.trim() ? "pointer" : "not-allowed",
              }}
            >
              🔍
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setSelectedKey(null); }}
                style={{
                  padding: "6px 9px",
                  fontSize: "0.82rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-3)",
                  color: "var(--text-faint)",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div style={{ padding: "10px 12px" }}>
          <div className="filter-label" style={{ marginBottom: 6 }}>Node types</div>
          {Object.entries(KIND_COLORS).map(([kind, color]) => (
            <div key={kind} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, fontSize: "0.8rem" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
              <span style={{ color: "var(--text-muted)" }}>{KIND_ICONS[kind]} {kind}</span>
            </div>
          ))}
        </div>

        {/* Selected node info */}
        {selectedKey && (
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border-subtle)", marginTop: "auto" }}>
            <div className="filter-label" style={{ marginBottom: 5 }}>Selected</div>
            <div style={{ fontSize: "0.88rem", color: "var(--text)", fontWeight: 600, marginBottom: 8 }}>
              {nodes.find((n) => n.id === selectedKey)?.label ?? selectedKey}
            </div>
            <button type="button" className="view-on-map-btn" style={{ width: "100%" }} onClick={handleGoToMap}>
              🗺 View on map
            </button>
          </div>
        )}
      </div>

      {/* Graph canvas */}
      <div className="graph-canvas-area">
        <svg
          ref={svgRef}
          className="graph-svg"
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onMouseLeave={handleSvgMouseUp}
          onMouseDown={handleSvgMouseDown}
        >
          <g transform={`translate(${pan.x},${pan.y})`}>
            {/* Edges */}
            {edges.map((e, i) => {
              const src = nodes.find((n) => n.id === e.source);
              const tgt = nodes.find((n) => n.id === e.target);
              if (!src || !tgt) return null;
              const isSelected  = selectedKey === e.source || selectedKey === e.target;
              const isHoveredE  = hoveredEdge === i;
              return (
                <g key={i}>
                  <line
                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={isSelected ? "var(--accent-bright)" : "var(--border)"}
                    strokeWidth={isSelected ? Math.max(1.5, e.weight * 0.5) : 1}
                    strokeOpacity={isSelected ? 0.75 : 0.3}
                    onMouseEnter={() => setHoveredEdge(i)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    style={{ cursor: "default" }}
                  />
                  {(isHoveredE || isSelected) && (
                    <text
                      x={(src.x + tgt.x) / 2}
                      y={(src.y + tgt.y) / 2 - 4}
                      textAnchor="middle"
                      fill="var(--text-faint)"
                      fontSize="9"
                      style={{ pointerEvents: "none" }}
                    >
                      {e.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((n) => {
              const color      = KIND_COLORS[n.kind] ?? "#6c757d";
              const isSelected = n.id === selectedKey;
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  style={{ cursor: isDragging && dragNodeRef.current === n.id ? "grabbing" : "pointer" }}
                  onMouseDown={(e) => handleNodeMouseDown(e, n.id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedKey(n.id === selectedKey ? null : n.id); }}
                >
                  <circle
                    r={isSelected ? n.r + 4 : n.r}
                    fill={color}
                    fillOpacity={isSelected ? 0.9 : 0.65}
                    stroke={isSelected ? "#fff" : color}
                    strokeWidth={isSelected ? 2.5 : 1}
                  />
                  {(isSelected || nodes.length < 50) && (
                    <text
                      y={n.r + 12}
                      textAnchor="middle"
                      fill="var(--text)"
                      fontSize={isSelected ? "11" : "9"}
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

      {/* Detail panel */}
      {selection && (
        <div style={{ width: 300, flexShrink: 0, borderLeft: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <GraphDetailPanel
            selection={selection}
            onClose={() => setSelectedKey(null)}
            onGoToMap={handleGoToMap}
          />
        </div>
      )}
    </div>
  );
}

// ─── Simple inline detail panel for graph page ────────────────────────────────

function GraphDetailPanel({ selection, onClose, onGoToMap }: {
  selection: Selection;
  onClose: () => void;
  onGoToMap: () => void;
}) {
  const { kind, id } = selection;
  const label = getEntityLabel(kind, id);

  const description = useMemo(() => {
    if (kind === "person")    return dataStore.people.getById(id)?.description ?? "";
    if (kind === "work")      return dataStore.works.getById(id)?.description ?? "";
    if (kind === "doctrine")  return dataStore.doctrines.getById(id)?.description ?? "";
    if (kind === "event")     return dataStore.events.getById(id)?.description ?? "";
    if (kind === "city")      return "";
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
    if (kind === "doctrine") {
      const d = dataStore.doctrines.getById(id);
      return d?.category ?? "";
    }
    if (kind === "event") {
      const e = dataStore.events.getById(id);
      return e ? [e.year_start && `AD ${e.year_start}`, e.event_type].filter(Boolean).join(" · ") : "";
    }
    if (kind === "city") {
      const c = dataStore.cities.getById(id);
      return c?.country_modern ?? "";
    }
    return "";
  }, [kind, id]);

  // Build connections: relations + synthetic edges (authored, addresses)
  const connections = useMemo(() => {
    type Conn = { othKind: string; othId: string; label: string };
    const seen = new Set<string>();
    const list: Conn[] = [];
    const add = (othKind: string, othId: string, label: string) => {
      const key = `${othKind}:${othId}`;
      if (!seen.has(key)) { seen.add(key); list.push({ othKind, othId, label }); }
    };

    for (const r of dataStore.relations.getForEntity(kind, id)) {
      const isOut   = r.source_id === id && r.source_type === kind;
      const othId   = isOut ? r.target_id   : r.source_id;
      const othKind = isOut ? r.target_type : r.source_type;
      add(othKind, othId, r.relation_type.replace(/_/g, " "));
    }

    if (kind === "work") {
      const w = dataStore.works.getById(id);
      if (w?.author_person_id) add("person", w.author_person_id, "authored by");
      for (const q of dataStore.quotes.getByWork(id)) {
        add("doctrine", q.doctrine_id, "addresses");
      }
    }
    if (kind === "person") {
      for (const w of dataStore.works.getAll()) {
        if (w.author_person_id === id) add("work", w.work_id, "authored");
      }
    }

    return list.slice(0, 16);
  }, [kind, id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 2 }}>
            {KIND_ICONS[kind]} {kind}
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>{label}</div>
          {subtitle && <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</div>}
        </div>
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: "1rem", padding: "2px 4px", flexShrink: 0 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
        {description && (
          <p style={{ fontSize: "0.83rem", color: "var(--text-muted)", lineHeight: 1.55, margin: 0 }}>{description}</p>
        )}

        {connections.length > 0 && (
          <div>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 6 }}>
              Connections
            </div>
            {connections.map(({ othKind, othId, label: relLabel }, i) => (
              <div key={i} style={{ display: "flex", gap: 7, padding: "4px 6px", borderRadius: 4, fontSize: "0.81rem", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ color: "var(--text-faint)", flexShrink: 0 }}>{KIND_ICONS[othKind]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getEntityLabel(othKind, othId)}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>{relLabel}</div>
                </div>
              </div>
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
