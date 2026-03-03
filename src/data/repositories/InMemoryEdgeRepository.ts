import type { IEdgeRepository } from "../../domain/repositories";
import type { Edge, EntityRef, EntityType } from "../../domain/types";

export class InMemoryEdgeRepository implements IEdgeRepository {
  private items: Edge[];
  private bySourceId: Map<string, Edge[]>;
  private byTargetId: Map<string, Edge[]>;

  constructor(items: Edge[]) {
    this.items = items;
    this.bySourceId = new Map();
    this.byTargetId = new Map();

    for (const edge of items) {
      const sourceKey = `${edge.source_type}:${edge.source_id}`;
      if (!this.bySourceId.has(sourceKey)) this.bySourceId.set(sourceKey, []);
      this.bySourceId.get(sourceKey)!.push(edge);

      const targetKey = `${edge.target_type}:${edge.target_id}`;
      if (!this.byTargetId.has(targetKey)) this.byTargetId.set(targetKey, []);
      this.byTargetId.get(targetKey)!.push(edge);
    }
  }

  getAll(): Edge[] {
    return this.items;
  }

  getEdgesFrom(sourceId: string, sourceType?: EntityType, decade?: number): Edge[] {
    const results: Edge[] = [];
    if (sourceType) {
      const key = `${sourceType}:${sourceId}`;
      const edges = this.bySourceId.get(key) ?? [];
      results.push(...edges);
    } else {
      for (const [key, edges] of this.bySourceId) {
        if (key.endsWith(`:${sourceId}`)) {
          results.push(...edges);
        }
      }
    }
    if (decade !== undefined) {
      return results.filter((e) => this.isActiveAtDecade(e, decade));
    }
    return results;
  }

  getEdgesTo(targetId: string, targetType?: EntityType, decade?: number): Edge[] {
    const results: Edge[] = [];
    if (targetType) {
      const key = `${targetType}:${targetId}`;
      const edges = this.byTargetId.get(key) ?? [];
      results.push(...edges);
    } else {
      for (const [key, edges] of this.byTargetId) {
        if (key.endsWith(`:${targetId}`)) {
          results.push(...edges);
        }
      }
    }
    if (decade !== undefined) {
      return results.filter((e) => this.isActiveAtDecade(e, decade));
    }
    return results;
  }

  getEdgesBetween(idA: string, idB: string): Edge[] {
    return this.items.filter(
      (e) =>
        (e.source_id === idA && e.target_id === idB) ||
        (e.source_id === idB && e.target_id === idA),
    );
  }

  getNetwork(
    entityId: string,
    entityType: EntityType,
    maxDepth: number,
    decade?: number,
  ): { nodes: EntityRef[]; edges: Edge[] } {
    const visitedNodes = new Set<string>();
    const collectedEdges: Edge[] = [];
    const queue: Array<{ id: string; type: EntityType; depth: number }> = [
      { id: entityId, type: entityType, depth: 0 },
    ];

    visitedNodes.add(`${entityType}:${entityId}`);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) continue;

      const outgoing = this.getEdgesFrom(current.id, current.type, decade);
      const incoming = this.getEdgesTo(current.id, current.type, decade);

      for (const edge of [...outgoing, ...incoming]) {
        collectedEdges.push(edge);

        const neighborKey =
          edge.source_id === current.id && edge.source_type === current.type
            ? `${edge.target_type}:${edge.target_id}`
            : `${edge.source_type}:${edge.source_id}`;

        if (!visitedNodes.has(neighborKey)) {
          visitedNodes.add(neighborKey);
          const [nType, nId] = neighborKey.split(":") as [EntityType, string];
          queue.push({ id: nId, type: nType, depth: current.depth + 1 });
        }
      }
    }

    const nodes: EntityRef[] = Array.from(visitedNodes).map((key) => {
      const [type, id] = key.split(":") as [EntityType, string];
      return { type, id };
    });

    const uniqueEdges = Array.from(new Map(collectedEdges.map((e) => [e.id, e])).values());

    return { nodes, edges: uniqueEdges };
  }

  private isActiveAtDecade(edge: Edge, decade: number): boolean {
    const start = edge.decade_start;
    const end = edge.decade_end;
    if (start !== null && start > decade + 9) return false;
    if (end !== null && end < decade) return false;
    return true;
  }
}
