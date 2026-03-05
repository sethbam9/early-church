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
  weight: number;
  relationId?: string;
}

/** One tick of the force simulation. Mutates nodes in-place. */
export function runForceTick(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): void {
  const gravity = 0.035;
  const damping = 0.82;
  const repulsion = 9000;
  const k = 110;

  // Repulsion between all node pairs
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

  // Spring attraction along edges
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

  // Gravity toward center + damping
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

/** Run force layout synchronously for a fixed number of iterations. */
export function runForceSync(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): void {
  const ticks = nodes.length > 150 ? 100 : nodes.length > 80 ? 160 : 220;
  for (let i = 0; i < ticks; i++) {
    runForceTick(nodes, edges, width, height);
  }
}
