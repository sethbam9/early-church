import type { IEventRepository } from "../../domain/repositories";
import type { HistoricalEvent } from "../../domain/types";

export class InMemoryEventRepository implements IEventRepository {
  private byId: Map<string, HistoricalEvent>;
  private items: HistoricalEvent[];

  constructor(items: HistoricalEvent[]) {
    this.items = items;
    this.byId = new Map(items.map((e) => [e.id, e]));
  }

  getById(id: string): HistoricalEvent | undefined {
    return this.byId.get(id);
  }

  getAll(): HistoricalEvent[] {
    return this.items;
  }

  getByDecade(decade: number): HistoricalEvent[] {
    return this.items.filter((e) => {
      const end = e.year_end ?? e.year_start;
      return e.year_start <= decade + 9 && end >= decade;
    });
  }

  getByType(type: string): HistoricalEvent[] {
    return this.items.filter((e) => e.event_type === type);
  }

  getByCityId(cityId: string): HistoricalEvent[] {
    return this.items.filter((e) => e.city_id === cityId);
  }
}
