import type {
  ArchaeologySite,
  ChurchRow,
  Doctrine,
  Edge,
  EntityRef,
  EntityType,
  HistoricalEvent,
  Person,
  Quote,
  Work,
} from "./types";

// ─── Base Repository ─────────────────────────────────────────────────────────

export interface IRepository<T> {
  getById(id: string): T | undefined;
  getAll(): T[];
}

// ─── Church Row (City × Decade) ─────────────────────────────────────────────

export interface IChurchRowRepository extends IRepository<ChurchRow> {
  getByDecade(decade: number): ChurchRow[];
  getCumulativeByDecade(decade: number): ChurchRow[];
  getCityAncientNames(): string[];
  getRowsForCity(cityAncient: string): ChurchRow[];
  search(query: string): ChurchRow[];
}

// ─── Person ──────────────────────────────────────────────────────────────────

export interface IPersonRepository extends IRepository<Person> {
  getByDecade(decade: number): Person[];
  search(query: string): Person[];
}

// ─── Event ───────────────────────────────────────────────────────────────────

export interface IEventRepository extends IRepository<HistoricalEvent> {
  getByDecade(decade: number): HistoricalEvent[];
  getByType(type: string): HistoricalEvent[];
  getByCityId(cityId: string): HistoricalEvent[];
}

// ─── Work ────────────────────────────────────────────────────────────────────

export interface IWorkRepository extends IRepository<Work> {
  getByDecade(decade: number): Work[];
  getByAuthorId(personId: string): Work[];
}

// ─── Doctrine ────────────────────────────────────────────────────────────────

export interface IDoctrineRepository extends IRepository<Doctrine> {
  getByCategory(category: string): Doctrine[];
}

// ─── Quote ───────────────────────────────────────────────────────────────────

export interface IQuoteRepository extends IRepository<Quote> {
  getByDoctrineId(doctrineId: string): Quote[];
  getByPersonId(personId: string): Quote[];
  getByDecade(decade: number): Quote[];
}

// ─── Archaeology ─────────────────────────────────────────────────────────────

export interface IArchaeologyRepository extends IRepository<ArchaeologySite> {
  getActiveAtDecade(decade: number): ArchaeologySite[];
  getByType(type: string): ArchaeologySite[];
  getByCityId(cityId: string): ArchaeologySite[];
}

// ─── Edge (Graph) ────────────────────────────────────────────────────────────

export interface IEdgeRepository {
  getAll(): Edge[];
  getEdgesFrom(sourceId: string, sourceType?: EntityType, decade?: number): Edge[];
  getEdgesTo(targetId: string, targetType?: EntityType, decade?: number): Edge[];
  getEdgesBetween(idA: string, idB: string): Edge[];
  getNetwork(entityId: string, entityType: EntityType, maxDepth: number, decade?: number): { nodes: EntityRef[]; edges: Edge[] };
}

// ─── Aggregate DataStore ─────────────────────────────────────────────────────

export interface IDataStore {
  churchRows: IChurchRowRepository;
  people: IPersonRepository;
  events: IEventRepository;
  works: IWorkRepository;
  doctrines: IDoctrineRepository;
  quotes: IQuoteRepository;
  archaeology: IArchaeologyRepository;
  edges: IEdgeRepository;
}
