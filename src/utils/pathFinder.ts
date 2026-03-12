/**
 * BFS shortest-path finder for the graph.
 * Operates on the same GraphNode/GraphEdge types as forceLayout.
 */

import type { GraphEdge } from "./forceLayout";

export interface PathStep {
  nodeId: string;
  edgeLabel: string;
  predicate?: string;
}

export interface PathResult {
  found: boolean;
  steps: PathStep[];
  intermediaries: number;
}

export function findShortestPath(
  edges: GraphEdge[],
  startId: string,
  endId: string,
): PathResult {
  if (startId === endId) return { found: true, steps: [{ nodeId: startId, edgeLabel: "" }], intermediaries: 0 };

  // Build adjacency list
  const adj = new Map<string, { neighbor: string; label: string; predicate?: string }[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push({ neighbor: e.target, label: e.label, predicate: e.predicate });
    adj.get(e.target)!.push({ neighbor: e.source, label: e.label, predicate: e.predicate });
  }

  // BFS
  const visited = new Set<string>([startId]);
  const parent = new Map<string, { from: string; label: string; predicate?: string }>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adj.get(current) ?? [];
    for (const { neighbor, label, predicate } of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, { from: current, label, predicate });
      if (neighbor === endId) {
        // Reconstruct path
        const steps: PathStep[] = [];
        let node = endId;
        while (parent.has(node)) {
          const p = parent.get(node)!;
          steps.unshift({ nodeId: node, edgeLabel: p.label, predicate: p.predicate });
          node = p.from;
        }
        steps.unshift({ nodeId: startId, edgeLabel: "" });
        return { found: true, steps, intermediaries: steps.length - 2 };
      }
      queue.push(neighbor);
    }
  }

  return { found: false, steps: [], intermediaries: 0 };
}
