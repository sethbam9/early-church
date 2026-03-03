import type { IWorkRepository } from "../../domain/repositories";
import type { Work } from "../../domain/types";

export class InMemoryWorkRepository implements IWorkRepository {
  private byId: Map<string, Work>;
  private items: Work[];

  constructor(items: Work[]) {
    this.items = items;
    this.byId = new Map(items.map((w) => [w.id, w]));
  }

  getById(id: string): Work | undefined {
    return this.byId.get(id);
  }

  getAll(): Work[] {
    return this.items;
  }

  getByDecade(decade: number): Work[] {
    return this.items.filter((w) => {
      return w.year_written_earliest <= decade + 9 && w.year_written_latest >= decade;
    });
  }

  getByAuthorId(personId: string): Work[] {
    return this.items.filter((w) => w.author_id === personId);
  }
}
