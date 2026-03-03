import type { IQuoteRepository } from "../../domain/repositories";
import type { Quote } from "../../domain/types";

export class InMemoryQuoteRepository implements IQuoteRepository {
  private byId: Map<string, Quote>;
  private items: Quote[];

  constructor(items: Quote[]) {
    this.items = items;
    this.byId = new Map(items.map((q) => [q.id, q]));
  }

  getById(id: string): Quote | undefined {
    return this.byId.get(id);
  }

  getAll(): Quote[] {
    return this.items;
  }

  getByDoctrineId(doctrineId: string): Quote[] {
    return this.items.filter((q) => q.doctrine_id === doctrineId);
  }

  getByPersonId(personId: string): Quote[] {
    return this.items.filter((q) => q.author_id === personId);
  }

  getByDecade(decade: number): Quote[] {
    return this.items.filter((q) => q.decade_bucket === decade);
  }
}
