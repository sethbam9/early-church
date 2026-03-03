import type { IDoctrineRepository } from "../../domain/repositories";
import type { Doctrine } from "../../domain/types";

export class InMemoryDoctrineRepository implements IDoctrineRepository {
  private byId: Map<string, Doctrine>;
  private items: Doctrine[];

  constructor(items: Doctrine[]) {
    this.items = items;
    this.byId = new Map(items.map((d) => [d.id, d]));
  }

  getById(id: string): Doctrine | undefined {
    return this.byId.get(id);
  }

  getAll(): Doctrine[] {
    return this.items;
  }

  getByCategory(category: string): Doctrine[] {
    return this.items.filter((d) => d.category === category);
  }
}
