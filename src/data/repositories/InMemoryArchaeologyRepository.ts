import type { IArchaeologyRepository } from "../../domain/repositories";
import type { ArchaeologySite } from "../../domain/types";

export class InMemoryArchaeologyRepository implements IArchaeologyRepository {
  private byId: Map<string, ArchaeologySite>;
  private items: ArchaeologySite[];

  constructor(items: ArchaeologySite[]) {
    this.items = items;
    this.byId = new Map(items.map((s) => [s.id, s]));
  }

  getById(id: string): ArchaeologySite | undefined {
    return this.byId.get(id);
  }

  getAll(): ArchaeologySite[] {
    return this.items;
  }

  getActiveAtDecade(decade: number): ArchaeologySite[] {
    return this.items.filter((s) => {
      const startsBefore = s.year_start <= decade + 9;
      const endsAfter = s.year_end === null || s.year_end >= decade;
      return startsBefore && endsAfter;
    });
  }

  getByType(type: string): ArchaeologySite[] {
    return this.items.filter((s) => s.site_type === type);
  }

  getByCityId(cityId: string): ArchaeologySite[] {
    return this.items.filter((s) => s.city_id === cityId);
  }
}
