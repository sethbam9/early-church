import type { Denomination } from "../../domain/types";

export class InMemoryDenominationRepository {
  private byId: Map<string, Denomination>;
  private items: Denomination[];

  constructor(items: Denomination[]) {
    this.items = items;
    this.byId = new Map(items.map((d) => [d.id, d]));
  }

  getById(id: string): Denomination | undefined {
    return this.byId.get(id);
  }

  getAll(): Denomination[] {
    return this.items;
  }

  getByTradition(tradition: string): Denomination[] {
    return this.items.filter((d) => d.tradition === tradition);
  }

  search(query: string): Denomination[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter((d) =>
      [d.name_display, ...d.name_alt, d.tradition, d.founder, d.description, d.modern_descendants].join(" ").toLowerCase().includes(q),
    );
  }

  findByName(name: string): Denomination | undefined {
    const n = name.trim().toLowerCase();
    return this.items.find((d) =>
      d.name_display.toLowerCase() === n ||
      d.name_alt.some((a) => a.toLowerCase() === n) ||
      n.includes(d.name_display.toLowerCase()) ||
      d.name_display.toLowerCase().includes(n),
    );
  }
}
