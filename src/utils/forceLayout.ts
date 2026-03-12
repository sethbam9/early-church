/**
 * Force-directed graph layout — pure computation, no React dependency.
 * Extracted from GraphPage to keep components focused on rendering.
 */

export interface GraphNode {
  id: string;
  kind: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  connections: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  predicate?: string;
  weight: number;
  relationId?: string;
}

/** One tick of the force simulation. Mutates nodes in-place. */
export function runForceTick(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): void {
  const n = nodes.length;
  // Scale repulsion down and gravity up for larger graphs to keep things tight
  const gravity = n > 150 ? 0.08 : n > 80 ? 0.06 : 0.045;
  const damping = 0.78;
  const repulsion = n > 150 ? 4000 : n > 80 ? 6000 : 8000;
  const k = n > 150 ? 60 : n > 80 ? 80 : 100;

  // Build index for O(1) edge lookups
  const idx = new Map<string, GraphNode>();
  for (const node of nodes) idx.set(node.id, node);

  // Repulsion between all node pairs
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
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

  // Spring attraction along edges
  for (const edge of edges) {
    const src = idx.get(edge.source);
    const tgt = idx.get(edge.target);
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

  // Gravity toward center + damping + position clamping
  const cx = width / 2;
  const cy = height / 2;
  const margin = 200;
  const xMin = -margin, xMax = width + margin;
  const yMin = -margin, yMax = height + margin;
  for (const node of nodes) {
    node.vx += (cx - node.x) * gravity;
    node.vy += (cy - node.y) * gravity;
    node.vx *= damping;
    node.vy *= damping;
    // Clamp velocity to prevent explosions
    const maxV = 15;
    node.vx = Math.max(-maxV, Math.min(maxV, node.vx));
    node.vy = Math.max(-maxV, Math.min(maxV, node.vy));
    node.x += node.vx;
    node.y += node.vy;
    // Clamp position
    node.x = Math.max(xMin, Math.min(xMax, node.x));
    node.y = Math.max(yMin, Math.min(yMax, node.y));
  }
}

/** Run force layout synchronously for a fixed number of iterations. */
export function runForceSync(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): void {
  const ticks = nodes.length > 150 ? 100 : nodes.length > 80 ? 160 : 220;
  for (let i = 0; i < ticks; i++) {
    runForceTick(nodes, edges, width, height);
  }
}

/**
 * Gently push connected neighbors of `centerId` apart to reduce overlap.
 * Only moves the neighbors; the center node stays fixed.
 * Mutates nodes in-place.
 */
export function spreadNeighbors(nodes: GraphNode[], edges: GraphEdge[], centerId: string, iterations = 25): void {
  const idx = new Map<string, GraphNode>();
  for (const n of nodes) idx.set(n.id, n);
  const center = idx.get(centerId);
  if (!center) return;

  const connectedIds = new Set<string>();
  for (const e of edges) {
    if (e.source === centerId) connectedIds.add(e.target);
    if (e.target === centerId) connectedIds.add(e.source);
  }

  const connected = nodes.filter((n) => connectedIds.has(n.id));
  if (connected.length <= 1) return;

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between neighbor pairs
    for (let i = 0; i < connected.length; i++) {
      for (let j = i + 1; j < connected.length; j++) {
        const a = connected[i]!;
        const b = connected[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const minSep = a.r + b.r + 26;
        if (dist < minSep) {
          const push = (minSep - dist) * 0.12;
          const fx = (dx / dist) * push;
          const fy = (dy / dist) * push;
          a.x -= fx; a.y -= fy;
          b.x += fx; b.y += fy;
        }
      }
    }
    // Gentle pull back toward center to keep cluster coherent
    for (const n of connected) {
      n.x += (center.x - n.x) * 0.015;
      n.y += (center.y - n.y) * 0.015;
    }
  }
}
