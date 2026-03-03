import indexedDataJson from "./generated/indexedData.json";
import starredPoisJson from "./generated/starredPois.json";
import essaysJson from "./generated/essays.json";
import peopleJson from "./generated/people.json";
import eventsJson from "./generated/events.json";
import worksJson from "./generated/works.json";
import doctrinesJson from "./generated/doctrines.json";
import quotesJson from "./generated/quotes.json";
import archaeologyJson from "./generated/archaeology.json";
import edgesJson from "./generated/edges.json";
import empiresJson from "./generated/empires.json";
import denominationsJson from "./generated/denominations.json";

import type {
  ArchaeologySite,
  Denomination,
  Doctrine,
  Edge,
  Empire,
  EssayDocument,
  FeaturedPoi,
  HistoricalEvent,
  IndexedDataArtifact,
  Person,
  Quote,
  Work,
} from "../domain/types";
import type { IDataStore } from "../domain/repositories";

import { InMemoryChurchRowRepository } from "./repositories/InMemoryChurchRowRepository";
import { InMemoryPersonRepository } from "./repositories/InMemoryPersonRepository";
import { InMemoryEventRepository } from "./repositories/InMemoryEventRepository";
import { InMemoryWorkRepository } from "./repositories/InMemoryWorkRepository";
import { InMemoryDoctrineRepository } from "./repositories/InMemoryDoctrineRepository";
import { InMemoryQuoteRepository } from "./repositories/InMemoryQuoteRepository";
import { InMemoryArchaeologyRepository } from "./repositories/InMemoryArchaeologyRepository";
import { InMemoryEdgeRepository } from "./repositories/InMemoryEdgeRepository";
import { InMemoryEmpireRepository } from "./repositories/InMemoryEmpireRepository";
import { InMemoryDenominationRepository } from "./repositories/InMemoryDenominationRepository";

// ─── Legacy exports (used by existing components during migration) ───────────

export const indexedData = indexedDataJson as IndexedDataArtifact;
export const starredPois = starredPoisJson as FeaturedPoi[];
export const essays = essaysJson as EssayDocument[];

// ─── Typed entity data ───────────────────────────────────────────────────────

export const people = peopleJson as Person[];
export const events = eventsJson as HistoricalEvent[];
export const works = worksJson as Work[];
export const doctrines = doctrinesJson as Doctrine[];
export const quotes = quotesJson as Quote[];
export const archaeology = archaeologyJson as ArchaeologySite[];
export const edges = edgesJson as Edge[];
export const empires = empiresJson as Empire[];
export const denominations = denominationsJson as Denomination[];

// ─── Repository instances (singleton) ────────────────────────────────────────

const churchRowRepo = new InMemoryChurchRowRepository(indexedData);
const personRepo = new InMemoryPersonRepository(people);
const eventRepo = new InMemoryEventRepository(events);
const workRepo = new InMemoryWorkRepository(works);
const doctrineRepo = new InMemoryDoctrineRepository(doctrines);
const quoteRepo = new InMemoryQuoteRepository(quotes);
const archaeologyRepo = new InMemoryArchaeologyRepository(archaeology);
const edgeRepo = new InMemoryEdgeRepository(edges);
const empireRepo = new InMemoryEmpireRepository(empires);
const denominationRepo = new InMemoryDenominationRepository(denominations);

export const dataStore: IDataStore = {
  churchRows: churchRowRepo,
  people: personRepo,
  events: eventRepo,
  works: workRepo,
  doctrines: doctrineRepo,
  quotes: quoteRepo,
  archaeology: archaeologyRepo,
  edges: edgeRepo,
};

export { empireRepo, denominationRepo };

// ─── Convenience: expose the church row repo with its extra accessors ────────

export { churchRowRepo };
