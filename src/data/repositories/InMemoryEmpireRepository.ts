import type { Empire } from "../../domain/types";

export class InMemoryEmpireRepository {
  private byId: Map<string, Empire>;
  private items: Empire[];

  constructor(items: Empire[]) {
    this.items = items;
    this.byId = new Map(items.map((e) => [e.id, e]));
  }

  getById(id: string): Empire | undefined {
    return this.byId.get(id);
  }

  getAll(): Empire[] {
    return this.items;
  }

  getActiveAtYear(year: number): Empire[] {
    return this.items.filter((e) => {
      return e.year_start <= year && (e.year_end === null || e.year_end >= year);
    });
  }

  search(query: string): Empire[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter((e) =>
      [e.name_display, ...e.name_alt, e.region, e.capital, e.description].join(" ").toLowerCase().includes(q),
    );
  }

  findByName(name: string): Empire | undefined {
    const n = name.trim().toLowerCase();
    return this.items.find((e) =>
      e.name_display.toLowerCase() === n ||
      e.name_alt.some((a) => a.toLowerCase() === n) ||
      n.includes(e.name_display.toLowerCase()),
    );
  }
}
