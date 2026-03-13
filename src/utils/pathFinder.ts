/**
 * K-shortest-paths finder for the graph.
 * Uses Yen's algorithm (BFS-based, unweighted) to find up to K distinct paths.
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

export interface MultiPathResult {
  paths: PathResult[];
  total: number;
}

type AdjEntry = { neighbor: string; label: string; predicate?: string };

function buildAdj(edges: GraphEdge[]): Map<string, AdjEntry[]> {
  const adj = new Map<string, AdjEntry[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push({ neighbor: e.target, label: e.label, predicate: e.predicate });
    adj.get(e.target)!.push({ neighbor: e.source, label: e.label, predicate: e.predicate });
  }
  return adj;
}

function bfsPath(
  adj: Map<string, AdjEntry[]>,
  startId: string,
  endId: string,
  excludedNodes: Set<string>,
  excludedEdges: Set<string>,
): PathStep[] | null {
  if (excludedNodes.has(startId) || excludedNodes.has(endId)) return null;
  const visited = new Set<string>([startId]);
  const parent = new Map<string, { from: string; label: string; predicate?: string }>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { neighbor, label, predicate } of adj.get(current) ?? []) {
      if (visited.has(neighbor) || excludedNodes.has(neighbor)) continue;
      const edgeKey = `${current}|${neighbor}|${label}`;
      const edgeKeyRev = `${neighbor}|${current}|${label}`;
      if (excludedEdges.has(edgeKey) || excludedEdges.has(edgeKeyRev)) continue;
      visited.add(neighbor);
      parent.set(neighbor, { from: current, label, predicate });
      if (neighbor === endId) {
        const steps: PathStep[] = [];
        let node = endId;
        while (parent.has(node)) {
          const p = parent.get(node)!;
          steps.unshift({ nodeId: node, edgeLabel: p.label, predicate: p.predicate });
          node = p.from;
        }
        steps.unshift({ nodeId: startId, edgeLabel: "" });
        return steps;
      }
      queue.push(neighbor);
    }
  }
  return null;
}

function stepsToKey(steps: PathStep[]): string {
  return steps.map((s) => s.nodeId).join("|");
}

/**
 * Find up to `maxPaths` shortest paths between two nodes using Yen's algorithm.
 */
export function findKShortestPaths(
  edges: GraphEdge[],
  startId: string,
  endId: string,
  maxPaths = 8,
): MultiPathResult {
  if (startId === endId) {
    return { paths: [{ found: true, steps: [{ nodeId: startId, edgeLabel: "" }], intermediaries: 0 }], total: 1 };
  }

  const adj = buildAdj(edges);
  const firstPath = bfsPath(adj, startId, endId, new Set(), new Set());
  if (!firstPath) return { paths: [{ found: false, steps: [], intermediaries: 0 }], total: 0 };

  const A: PathStep[][] = [firstPath];
  const B: PathStep[][] = [];
  const seen = new Set<string>([stepsToKey(firstPath)]);

  for (let k = 1; k < maxPaths; k++) {
    const prevPath = A[k - 1];
    if (!prevPath) break;

    for (let i = 0; i < prevPath.length - 1; i++) {
      const spurNode = prevPath[i]!.nodeId;
      const rootPath = prevPath.slice(0, i + 1);
      const rootNodeIds = rootPath.map((s) => s.nodeId);

      const excludedEdges = new Set<string>();
      for (const path of A) {
        if (path.length > i) {
          const sameRoot = rootPath.every((s, j) => path[j]?.nodeId === s.nodeId);
          if (sameRoot && path[i] && path[i + 1]) {
            excludedEdges.add(`${path[i]!.nodeId}|${path[i + 1]!.nodeId}|${path[i + 1]!.edgeLabel}`);
          }
        }
      }

      const excludedNodes = new Set<string>();
      for (let j = 0; j < i; j++) {
        if (rootNodeIds[j]) excludedNodes.add(rootNodeIds[j]!);
      }

      const spurPath = bfsPath(adj, spurNode, endId, excludedNodes, excludedEdges);
      if (spurPath) {
        const totalPath = [...rootPath.slice(0, -1), ...spurPath];
        const key = stepsToKey(totalPath);
        if (!seen.has(key)) {
          seen.add(key);
          B.push(totalPath);
        }
      }
    }

    if (B.length === 0) break;

    B.sort((a, b) => a.length - b.length);
    const next = B.shift()!;
    A.push(next);
  }

  return {
    paths: A.map((steps) => ({ found: true, steps, intermediaries: steps.length - 2 })),
    total: A.length,
  };
}

/**
 * Compute shortest-hop distance from `sourceId` to every reachable node (Degrees of Kevin Bacon).
 */
export interface DegreesResult {
  distances: Map<string, number>;
  maxDistance: number;
  reachable: number;
  unreachable: number;
}

export function computeDegrees(
  edges: GraphEdge[],
  sourceId: string,
  allNodeIds: string[],
): DegreesResult {
  const adj = buildAdj(edges);
  const distances = new Map<string, number>();
  distances.set(sourceId, 0);
  const queue: string[] = [sourceId];
  let maxDistance = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dist = distances.get(current)!;
    for (const { neighbor } of adj.get(current) ?? []) {
      if (distances.has(neighbor)) continue;
      const nd = dist + 1;
      distances.set(neighbor, nd);
      if (nd > maxDistance) maxDistance = nd;
      queue.push(neighbor);
    }
  }

  const reachable = distances.size - 1;
  const unreachable = allNodeIds.length - distances.size;
  return { distances, maxDistance, reachable, unreachable };
}
