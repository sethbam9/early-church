import { useRef, useMemo } from "react";
import s from "./GraphPage.module.css";
import type { GraphNode } from "../utils/forceLayout";
import { KIND_COLORS, kindIcon } from "../components/shared/entityConstants";
import { truncateLabel } from "../utils/formatYear";
import { EntityDetail } from "../components/panel/EntityDetail";
import { SearchInput } from "../components/shared/SearchInput";
import { Slider } from "../components/shared/Slider";
import { PathPickerInput } from "../components/shared/PathPickerInput";
import { PanelShell } from "../components/panel/PanelShell";
import { MapGraphOverlay } from "../components/shared/MapGraphOverlay";
import { GlobalSearchOverlay } from "../components/shared/GlobalSearchOverlay";
import { useGraphPageState, FILTER_OPTIONS } from "../hooks/useGraphPageState";

// ─── GraphPage ────────────────────────────────────────────────────────────────

export function GraphPage() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const g = useGraphPageState(svgRef);
  const {
    filters, setFilters, minConnections, setMinConnections,
    searchQuery, setSearchQuery, showDropdown, setShowDropdown,
    searchSuggestions, handleSearchDropdownSelect, handleSearchEnter,
    selectedKey, selectionHistory, selection, hasSelection,
    pushGraphSelection, popGraphSelection, handleNodeClick, clearSelection,
    setHoveredNodeKey, hoveredNodeKey, highlightedNodeKey, setHighlightedNodeKey,
    nodes, edges, allNodes, allEdges, maxConn,
    connectedToSelected, hoverEdgeDetails, pathNodeIds, pathEdgePairs,
    pan, zoom, zoomIn, zoomOut, resetView, centerOnSelected,
    handleSvgMouseMove, handleSvgMouseUp, handleSvgMouseDown,
    handleSvgClick, handleSvgMouseLeave,
    pathStartQuery, setPathStartQuery, pathEndQuery, setPathEndQuery,
    pathStartId, setPathStartId, pathEndId, setPathEndId,
    pathResult, pathTotal, pathIndex,
    runPathFinder, clearPathFinder, nextPath, prevPath,
    swapPathEndpoints, useSelectedAsPathStart, useSelectedAsPathEnd,
    degreesResult, degreesSourceId, runDegrees, clearDegrees,
  } = g;

  return (
    <div className={s.page}>
      {/* ── Left panel ── */}
      <div className={s.leftPanel}>
        <div className={s.panelHeader}>
          <div className={s.panelEyebrow}>Network</div>
          <div className={s.panelTitle}>Claim Graph</div>
          <div className={s.panelSubtitle}>{nodes.length} nodes · {edges.length} edges</div>
        </div>

        {/* Global entity search */}
        <div className={s.searchWrap}>
          <GlobalSearchOverlay onSelect={(kind, id) => pushGraphSelection(`${kind}:${id}`)} placeholder="Search entities…" />
        </div>

        {/* Node types (multi-select filter + legend combined) */}
        <div className={s.section}>
          <div className={s.filterLabelRow}>
            Node types (multi-select)
            {!filters.includes("all") && (
              <button type="button" className={s.showAll} onClick={() => setFilters(["all"])}>show all</button>
            )}
          </div>
          <div className={s.typeList}>
            {FILTER_OPTIONS.map(({ value, label }) => {
              const isActive = filters.includes("all") || filters.includes(value);
              return (
                <button key={value} type="button"
                  className={`${s.typeRow}${isActive ? ` ${s.typeRowActive}` : ""}`}
                  onClick={() => {
                    setFilters((prev) => {
                      const without = prev.filter((v) => v !== "all" && v !== value);
                      if (prev.includes("all")) return [value];
                      if (prev.includes(value)) return without.length === 0 ? ["all"] : without;
                      return [...without, value];
                    });
                  }}>
                  <span className={s.nodeBadge} style={{ background: KIND_COLORS[value] ?? "#666" }} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <div className={`${s.faint} ${s.filterHint}`}>Node size ∝ connections</div>
        </div>

        {/* Search */}
        <div className={`${s.section} ${s.sectionRelative}`}>
          <div className={s.filterLabelRow}>Search nodes</div>
          <SearchInput
            value={searchQuery}
            onChange={(v) => { setSearchQuery(v); setShowDropdown(true); }}
            onClear={() => { setSearchQuery(""); clearSelection(); setShowDropdown(false); }}
            placeholder="Name or kind…"
          />
          {showDropdown && searchSuggestions.length > 0 && (
            <div className={s.searchDropdown}>
              {searchSuggestions.map((n) => (
                <button key={n.id} type="button" className={s.suggestion} onMouseDown={() => handleSearchDropdownSelect(n.id)}>
                  <span className={s.nodeBadge} style={{ background: KIND_COLORS[n.kind] ?? "#666" }} />
                  <span className={s.suggestionLabel}>{n.label}</span>
                  <span className={`${s.faint} ${s.suggestionConn}`}>{n.connections} conn</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Connection count slider */}
        <div className={s.section}>
          <div className={s.filterLabelRow}>Min connections: <strong>{minConnections}</strong></div>
          <Slider
            min={1}
            max={Math.max(2, maxConn)}
            value={minConnections}
            onChange={setMinConnections}
            minLabel="1"
            maxLabel={String(maxConn)}
          />
        </div>

        {/* Path Finder */}
        <div className={s.section}>
          <div className={s.filterLabelRow}>Path Finder</div>
          <div className={s.pathFinderCol}>
            <PathPickerInput
              placeholder="Start entity…"
              query={pathStartQuery}
              setQuery={setPathStartQuery}
              selectedId={pathStartId}
              onSelect={(id, label) => { setPathStartId(id); setPathStartQuery(label); }}
              onClear={() => { setPathStartId(null); clearPathFinder(); }}
              nodes={allNodes}
            />
            <PathPickerInput
              placeholder="End entity…"
              query={pathEndQuery}
              setQuery={setPathEndQuery}
              selectedId={pathEndId}
              onSelect={(id, label) => { setPathEndId(id); setPathEndQuery(label); }}
              onClear={() => { setPathEndId(null); clearPathFinder(); }}
              nodes={allNodes}
            />
            <div className={s.pathActions}>
              <button type="button" className={`${s.actionBtn} ${s.pathFinderBtn}`}
                disabled={!pathStartId || !pathEndId}
                onClick={runPathFinder}
              >Find Path</button>
              <button type="button" className={s.pathMiniBtn}
                disabled={!pathStartId && !pathEndId}
                onClick={swapPathEndpoints} title="Swap start ↔ end"
              >⇄</button>
              {selectedKey && !pathStartId && (
                <button type="button" className={s.pathMiniBtn}
                  onClick={useSelectedAsPathStart} title="Use selected as start"
                >○→Start</button>
              )}
              {selectedKey && pathStartId && !pathEndId && (
                <button type="button" className={s.pathMiniBtn}
                  onClick={useSelectedAsPathEnd} title="Use selected as end"
                >○→End</button>
              )}
            </div>
            {pathResult && (
              <div className={s.pathResult}>
                {pathResult.found ? (
                  <>
                    <div className={s.pathSummary}>
                      <strong>{pathResult.steps.length - 1}</strong> hop{pathResult.steps.length - 1 !== 1 ? "s" : ""}
                      <span className={s.faint}> · {pathResult.intermediaries} intermediar{pathResult.intermediaries === 1 ? "y" : "ies"}</span>
                      {pathTotal > 1 && (
                        <span className={s.pathNav}>
                          <button type="button" className={s.pathNavBtn} disabled={pathIndex <= 0} onClick={prevPath}>◀</button>
                          <span className={s.pathNavLabel}>Path {pathIndex + 1}/{pathTotal}</span>
                          <button type="button" className={s.pathNavBtn} disabled={pathIndex >= pathTotal - 1} onClick={nextPath}>▶</button>
                        </span>
                      )}
                    </div>
                    <div className={s.pathChain}>
                      {pathResult.steps.map((step, i) => {
                        const node = allNodes.find((n) => n.id === step.nodeId);
                        return (
                          <div key={i} className={s.pathStep}>
                            {i > 0 && <span className={s.pathEdgeLabel}>{step.edgeLabel}</span>}
                            <button type="button" className={s.pathNodeBtn} onClick={() => pushGraphSelection(step.nodeId)}
                              style={{ borderLeft: `3px solid ${KIND_COLORS[node?.kind ?? ""] ?? "#666"}` }}>
                              {kindIcon(node?.kind ?? "")} {node?.label ?? step.nodeId}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className={`${s.faint} ${s.pathNotFound}`}>No path found between these entities.</div>
                )}
                <button type="button" className={`${s.showAll} ${s.clearBtn}`}
                  onClick={clearPathFinder}>
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Degrees of Separation */}
        <div className={s.section}>
          <div className={s.filterLabelRow}>Degrees of Separation</div>
          <div className={s.pathFinderCol}>
            <button type="button" className={`${s.actionBtn} ${s.pathFinderBtn}`}
              disabled={!selectedKey}
              onClick={() => selectedKey && runDegrees(selectedKey)}
            >{selectedKey ? "Compute from selected" : "Select a node first"}</button>
            {degreesResult && (
              <div className={s.pathResult}>
                {degreesSourceId && (
                  <div className={s.degreeSource}>
                    Source: <strong>{allNodes.find((n) => n.id === degreesSourceId)?.label ?? degreesSourceId}</strong>
                  </div>
                )}
                <div className={s.pathSummary}>
                  Max distance: <strong>{degreesResult.maxDistance}</strong> hops
                </div>
                <div className={s.degreeStats}>
                  <span>Reachable: {degreesResult.reachable}</span>
                  {degreesResult.unreachable > 0 && (
                    <span className={s.faint}> · Unreachable: {degreesResult.unreachable}</span>
                  )}
                </div>
                <DegreesHistogram distances={degreesResult.distances} maxDistance={degreesResult.maxDistance} />
                <button type="button" className={`${s.showAll} ${s.clearBtn}`}
                  onClick={clearDegrees}>
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Graph canvas ── */}
      <div className={s.canvasArea}>
        <MapGraphOverlay onZoomIn={zoomIn} onZoomOut={zoomOut} onFitVisible={resetView} fitLabel="fit"
          onCenterSelected={centerOnSelected} showCenter={hasSelection} centerLabel="center" />
        <div className={s.hint}>Scroll to zoom · Drag to pan · Click node to explore</div>

        <svg
          ref={svgRef}
          className={s.svg}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onMouseLeave={handleSvgMouseLeave}
          onMouseDown={handleSvgMouseDown}
          onClick={handleSvgClick}
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Edges — visual only, no interaction */}
            {(() => {
              const nodeMap = new Map<string, GraphNode>();
              for (const n of nodes) nodeMap.set(n.id, n);
              const inPathMode = pathEdgePairs.size > 0;
              return edges.map((e, i) => {
                const src = nodeMap.get(e.source);
                const tgt = nodeMap.get(e.target);
                if (!src || !tgt) return null;
                const isPathEdge = inPathMode && pathEdgePairs.has(`${e.source}|${e.target}`);
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
                const pathStroke = "#2ecc71";
                const strokeColor = isPathEdge ? pathStroke : isHoverEdge ? activeStroke : isNodeSelected ? activeStroke : baseStroke;
                const strokeW = isPathEdge ? 3 : isHoverEdge ? 2.5 : isNodeSelected ? (isOpposes ? 2 : 1.5) : (isOpposes ? 1.2 : 0.8);
                const strokeOp = isPathEdge ? 0.9 : isHoverEdge ? 0.95 : isNodeSelected ? 0.75 : (inPathMode && !isPathEdge) ? 0.04 : isDimmed ? 0.06 : (isOpposes ? 0.45 : 0.28);
                return (
                  <line key={i} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={strokeColor} strokeWidth={strokeW} strokeOpacity={strokeOp}
                    className={s.svgNoPointer} />
                );
              });
            })()}
            {/* Nodes */}
            {nodes.map((n) => {
              const baseColor = KIND_COLORS[n.kind] ?? "#6c757d";
              const isSelected = n.id === selectedKey;
              const isConnected = connectedToSelected?.has(n.id) ?? false;
              const isHighlighted = n.id === highlightedNodeKey;
              const isHovered = n.id === hoveredNodeKey && hasSelection && isConnected;
              const inPathMode = pathNodeIds.size > 0;
              const isOnPath = inPathMode && pathNodeIds.has(n.id);
              const isDimmed = inPathMode ? !isOnPath : (hasSelection && !isSelected && !isConnected);
              const showLabel = isSelected || isOnPath || n.connections >= 3 || nodes.length < 60;

              // Degrees mode coloring
              const degDist = degreesResult?.distances.get(n.id);
              const inDegreesMode = !!degreesResult;
              const isSource = n.id === degreesSourceId;
              let color = baseColor;
              let degOpacity = 0.72;
              if (inDegreesMode) {
                if (isSource) {
                  color = "#2ecc71";
                  degOpacity = 1;
                } else if (degDist != null) {
                  const t = degreesResult.maxDistance > 0 ? degDist / degreesResult.maxDistance : 0;
                  // green -> yellow -> orange -> red
                  const r = Math.round(46 + t * 185);
                  const g = Math.round(204 - t * 164);
                  const b = Math.round(113 - t * 70);
                  color = `rgb(${r},${g},${b})`;
                  degOpacity = 0.9;
                } else {
                  color = "#555";
                  degOpacity = 0.2;
                }
              }

              return (
                <g key={n.id} transform={`translate(${n.x},${n.y})`}
                  style={{ cursor: isDimmed && !inDegreesMode ? "default" : "pointer", pointerEvents: isDimmed && !inDegreesMode ? "none" : "auto" }}
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
                    fillOpacity={inDegreesMode ? degOpacity : (isSelected ? 0.95 : isDimmed ? 0.15 : isConnected ? 0.9 : 0.72)}
                    stroke={isSelected ? "#fff" : isHovered ? "var(--accent-bright)" : isDimmed && !inDegreesMode ? "transparent" : color}
                    strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 0.8}
                  />
                  {inDegreesMode && degDist != null && (
                    <text y={3} textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700">{degDist}</text>
                  )}
                  {!inDegreesMode && n.connections >= 5 && !isSelected && !isDimmed && (
                    <text y={3} textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700">{n.connections}</text>
                  )}
                  {showLabel && !(isDimmed && !inDegreesMode) && (
                    <text y={n.r + 11} textAnchor="middle" fill="var(--text)" fontSize={isSelected ? "10" : "8"} fontWeight={isSelected ? "700" : "400"}>
                      {truncateLabel(n.label)}
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
            <div className={s.hoverOverlay} style={{ left: screenX, top: screenY, transform: "translate(-50%, -100%)" }}>
              <div className={s.hoverTitle}>{hNode.label}</div>
              {hoverEdgeDetails.map((d, i) => (
                <div key={i} className={s.hoverClaim}>
                  <span style={{ color: d.isOpposes ? "#e74c3c" : "var(--accent)" }}>{d.label}</span>
                  {d.isOpposes && <span className={s.hoverClaimOpposes}> ✗</span>}
                  {d.certainty && <span className={s.faint}> · {d.certainty}</span>}
                  {d.yearStart != null && (
                    <span className={s.faint}> · AD {d.yearStart}{d.yearEnd != null && d.yearEnd !== d.yearStart ? `–${d.yearEnd}` : ""}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {nodes.length === 0 && (
          <div className={`${s.emptyState} ${s.emptyOverlay}`}>
            No claims found for this filter.
          </div>
        )}
      </div>

      {/* ── Right detail panel ── */}
      {selection && (
        <PanelShell onDismiss={clearSelection}>
          <EntityDetail
            key={`${selection.kind}:${selection.id}`}
            kind={selection.kind}
            id={selection.id}
            currentPage="graph"
            hasHistory={selectionHistory.length > 0}
            onBack={() => {
              if (selectionHistory.length > 0) popGraphSelection();
              else clearSelection();
            }}
            onExit={clearSelection}
            onSelectEntity={(kind, id) => {
              pushGraphSelection(`${kind}:${id}`);
            }}
            onHoverEntity={(kind, id) => setHighlightedNodeKey(`${kind}:${id}`)}
            onLeaveEntity={() => setHighlightedNodeKey(null)}
          />
        </PanelShell>
      )}
    </div>
  );
}

// ─── Degrees Histogram ───────────────────────────────────────────────────────

function DegreesHistogram({ distances, maxDistance }: { distances: Map<string, number>; maxDistance: number }) {
  const bins = useMemo(() => {
    const counts: number[] = Array(maxDistance + 1).fill(0);
    for (const d of distances.values()) {
      if (d >= 0 && d <= maxDistance) counts[d]!++;
    }
    return counts;
  }, [distances, maxDistance]);

  const maxCount = Math.max(1, ...bins);

  return (
    <div className={s.degreesHisto}>
      <div className={s.degreesHistoLabel}>Distribution by hop distance</div>
      <div className={s.degreesHistoBars}>
        {bins.map((count, dist) => (
          <div key={dist} className={s.degreesHistoCol} title={`${dist} hop${dist !== 1 ? "s" : ""}: ${count} node${count !== 1 ? "s" : ""}`}>
            <div className={s.degreesHistoBar} style={{ height: `${Math.max(2, (count / maxCount) * 48)}px` }} />
            <div className={s.degreesHistoD}>{dist}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
