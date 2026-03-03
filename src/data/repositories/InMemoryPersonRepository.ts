import type { IPersonRepository } from "../../domain/repositories";
import type { Person } from "../../domain/types";

export class InMemoryPersonRepository implements IPersonRepository {
  private byId: Map<string, Person>;
  private items: Person[];

  constructor(items: Person[]) {
    this.items = items;
    this.byId = new Map(items.map((p) => [p.id, p]));
  }

  getById(id: string): Person | undefined {
    return this.byId.get(id);
  }

  getAll(): Person[] {
    return this.items;
  }

  getByDecade(decade: number): Person[] {
    return this.items.filter((p) => {
      const born = p.birth_year ?? 0;
      const died = p.death_year ?? 9999;
      return born <= decade + 9 && died >= decade;
    });
  }

  search(query: string): Person[] {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return this.items;
    return this.items.filter((p) => {
      const hay = [p.name_display, ...p.name_alt, p.description, ...p.roles].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
}
