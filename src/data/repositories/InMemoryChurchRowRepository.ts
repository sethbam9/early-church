import type { IChurchRowRepository } from "../../domain/repositories";
import type { ChurchRow, IndexedDataArtifact } from "../../domain/types";

export class InMemoryChurchRowRepository implements IChurchRowRepository {
  private byId: Map<string, ChurchRow>;
  private artifact: IndexedDataArtifact;
  private searchIndex: Record<string, string>;

  constructor(artifact: IndexedDataArtifact) {
    this.artifact = artifact;
    this.byId = new Map(artifact.rows.map((r) => [r.id, r]));
    this.searchIndex = artifact.searchTextById;
  }

  getById(id: string): ChurchRow | undefined {
    return this.byId.get(id);
  }

  getAll(): ChurchRow[] {
    return this.artifact.rows;
  }

  getByDecade(decade: number): ChurchRow[] {
    const ids = this.artifact.byYearBucket[String(decade)] ?? [];
    return ids.map((id) => this.byId.get(id)).filter((r): r is ChurchRow => r !== undefined);
  }

  getCumulativeByDecade(decade: number): ChurchRow[] {
    const ids = this.artifact.cumulativeByYearBucket[String(decade)] ?? [];
    return ids.map((id) => this.byId.get(id)).filter((r): r is ChurchRow => r !== undefined);
  }

  getCityAncientNames(): string[] {
    const names = new Set<string>();
    for (const row of this.artifact.rows) {
      names.add(row.city_ancient);
    }
    return Array.from(names).sort();
  }

  getRowsForCity(cityAncient: string): ChurchRow[] {
    return this.artifact.rows.filter((r) => r.city_ancient === cityAncient);
  }

  search(query: string): ChurchRow[] {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) return this.artifact.rows;
    return this.artifact.rows.filter((row) => {
      const text = this.searchIndex[row.id] ?? "";
      return text.includes(normalized);
    });
  }

  get yearBuckets(): number[] {
    return this.artifact.yearBuckets;
  }

  get dateRangeByYear(): Record<string, string> {
    return this.artifact.dateRangeByYear;
  }

  get facets() {
    return this.artifact.facets;
  }
}
