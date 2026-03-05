import { parseTsv, int, float, splitSemi, str } from "./parseTsv";

// ─── Domain types (single source of truth in types.ts) ───────────────────────

export type {
  LocationPrecision, PresenceStatus, City, PlaceState, CityAtDecade,
  Person, Work, Doctrine, Quote, HistoricalEvent, ArchaeologySite,
  Persuasion, Polity, Place, Relation, Note, Footprint, FootprintStance, NoteMention,
  EntityKind, EntityRef, HighlightEntry, CorrespondenceArc, Selection,
} from "./types";

import type {
  LocationPrecision, PresenceStatus, City, PlaceState, CityAtDecade,
  Person, Work, Doctrine, Quote, HistoricalEvent, ArchaeologySite,
  Persuasion, Polity, Place, Relation, Note, Footprint, FootprintStance, NoteMention,
} from "./types";

// ─── Raw TSV imports (bundled at build time) ──────────────────────────────────

import citiesRaw from "../../data/cities.tsv?raw";
import peopleRaw from "../../data/people.tsv?raw";
import persuasionsRaw from "../../data/persuasions.tsv?raw";
import politiesRaw from "../../data/polities.tsv?raw";
import worksRaw from "../../data/works.tsv?raw";
import eventsRaw from "../../data/events.tsv?raw";
import doctrinesRaw from "../../data/doctrines.tsv?raw";
import quotesRaw from "../../data/quotes.tsv?raw";
import archaeologyRaw from "../../data/archaeology.tsv?raw";
import relationsRaw from "../../data/relations.tsv?raw";
import placesRaw from "../../data/places.tsv?raw";
import placeStatesRaw from "../../data/place_state_by_decade.tsv?raw";
import notesRaw from "../../data/notes.tsv?raw";
import noteMentionsRaw from "../../data/note_mentions.tsv?raw";
import footprintsRaw from "../../data/entity_place_footprints.tsv?raw";

// ─── Parsing helpers ──────────────────────────────────────────────────────────

function parsePresence(v: string): PresenceStatus {
  const allowed: PresenceStatus[] = ["attested", "probable", "claimed_tradition", "not_attested", "suppressed", "unknown"];
  return allowed.includes(v as PresenceStatus) ? (v as PresenceStatus) : "unknown";
}

function parseLocPrec(v: string): LocationPrecision {
  const allowed: LocationPrecision[] = ["exact", "approx_city", "region_only", "unknown"];
  return allowed.includes(v as LocationPrecision) ? (v as LocationPrecision) : "unknown";
}

// ─── Parse all entities ───────────────────────────────────────────────────────

const cities: City[] = parseTsv(citiesRaw).map((r) => ({
  city_id: str(r.city_id),
  city_label: str(r.city_label),
  city_ancient: str(r.city_ancient_primary),
  city_modern: str(r.city_modern_primary),
  country_modern: str(r.country_modern_primary),
  lat: float(r.lat),
  lon: float(r.lon),
  location_precision: parseLocPrec(str(r.location_precision)),
  christianity_start_year: int(r.christianity_start_year),
  church_planted_year_scholarly: int(r.church_planted_year_scholarly),
  church_planted_year_earliest_claim: int(r.church_planted_year_earliest_claim),
  church_planted_by: str(r.church_planted_by),
  apostolic_origin_thread: str(r.apostolic_origin_thread),
}));

const people: Person[] = parseTsv(peopleRaw).map((r) => ({
  person_id: str(r.person_id),
  person_label: str(r.person_label),
  name_alt: splitSemi(r.name_alt),
  birth_year: int(r.birth_year),
  death_year: int(r.death_year),
  death_type: str(r.death_type),
  roles: splitSemi(r.roles),
  city_of_origin_id: str(r.city_of_origin_id) || null,
  apostolic_connection: str(r.apostolic_connection),
  description: str(r.description),
  wikipedia_url: str(r.wikipedia_url) || null,
  citations: splitSemi(r.citations),
}));

const persuasions: Persuasion[] = parseTsv(persuasionsRaw).map((r) => ({
  persuasion_id: str(r.persuasion_id),
  persuasion_label: str(r.persuasion_label),
  persuasion_stream: str(r.persuasion_stream),
  year_start: int(r.year_start),
  year_end: int(r.year_end),
  description: str(r.description),
  wikipedia_url: str(r.wikipedia_url) || null,
  citations: splitSemi(r.citations),
}));

const polities: Polity[] = parseTsv(politiesRaw).map((r) => ({
  polity_id: str(r.polity_id),
  polity_label: str(r.polity_label),
  name_alt: splitSemi(r.name_alt),
  year_start: int(r.year_start),
  year_end: int(r.year_end),
  capital: str(r.capital),
  region: str(r.region),
  description: str(r.description),
  wikipedia_url: str(r.wikipedia_url) || null,
  citations: splitSemi(r.citations),
}));

const works: Work[] = parseTsv(worksRaw).map((r) => ({
  work_id: str(r.work_id),
  title_display: str(r.title_display),
  author_person_id: str(r.author_person_id) || null,
  author_name_display: str(r.author_name_display),
  year_written_start: int(r.year_written_start),
  year_written_end: int(r.year_written_end),
  work_type: str(r.work_type),
  language: str(r.language),
  place_written_id: str(r.place_written_id) || null,
  place_recipient_ids: splitSemi(r.place_recipient_ids),
  description: str(r.description),
  significance: str(r.significance),
  modern_edition_url: str(r.modern_edition_url) || null,
  citations: splitSemi(r.citations),
}));

const events: HistoricalEvent[] = parseTsv(eventsRaw).map((r) => ({
  event_id: str(r.event_id),
  name_display: str(r.name_display),
  event_type: str(r.event_type),
  year_start: int(r.year_start),
  year_end: int(r.year_end),
  primary_place_id: str(r.primary_place_id) || null,
  region: str(r.region),
  key_figure_person_ids: splitSemi(r.key_figure_person_ids),
  description: str(r.description),
  significance: str(r.significance),
  outcome: str(r.outcome),
  citations: splitSemi(r.citations),
}));

const doctrines: Doctrine[] = parseTsv(doctrinesRaw).map((r) => ({
  doctrine_id: str(r.doctrine_id),
  name_display: str(r.name_display),
  category: str(r.category),
  description: str(r.description),
  first_attested_year: int(r.first_attested_year),
  first_attested_work_id: str(r.first_attested_work_id) || null,
  controversy_level: str(r.controversy_level),
  resolution: str(r.resolution),
  citations: splitSemi(r.citations),
}));

const quotes: Quote[] = parseTsv(quotesRaw).map((r) => ({
  quote_id: str(r.quote_id),
  doctrine_id: str(r.doctrine_id),
  work_id: str(r.work_id) || null,
  text: str(r.text),
  work_reference: str(r.work_reference),
  year: int(r.year),
  stance: str(r.stance),
  notes: str(r.notes),
  citations: splitSemi(r.citations),
}));

const archaeology: ArchaeologySite[] = parseTsv(archaeologyRaw).map((r) => ({
  archaeology_id: str(r.archaeology_id),
  name_display: str(r.name_display),
  site_type: str(r.site_type),
  city_id: str(r.city_id) || null,
  lat: float(r.lat),
  lon: float(r.lon),
  location_precision: parseLocPrec(str(r.location_precision)),
  year_start: int(r.year_start),
  year_end: int(r.year_end),
  description: str(r.description),
  significance: str(r.significance),
  discovery_notes: str(r.discovery_notes),
  current_status: str(r.current_status),
  uncertainty: str(r.uncertainty),
  citations: splitSemi(r.citations),
}));

const relations: Relation[] = parseTsv(relationsRaw).map((r) => ({
  relation_id: str(r.relation_id),
  source_type: str(r.source_type),
  source_id: str(r.source_id),
  relation_type: str(r.relation_type),
  target_type: str(r.target_type),
  target_id: str(r.target_id),
  year_start: int(r.year_start),
  year_end: int(r.year_end),
  weight: int(r.weight),
  polarity: str(r.polarity),
  certainty: str(r.certainty),
  evidence_note_id: str(r.evidence_note_id) || null,
  citations: splitSemi(r.citations),
}));

const places: Place[] = parseTsv(placesRaw).map((r) => ({
  place_id: str(r.place_id),
  place_type: str(r.place_type),
  place_label: str(r.place_label),
  lat: float(r.lat),
  lon: float(r.lon),
  location_precision: parseLocPrec(str(r.location_precision)),
  city_id: str(r.city_id) || null,
  archaeology_id: str(r.archaeology_id) || null,
}));

const placeStates: PlaceState[] = parseTsv(placeStatesRaw).map((r) => ({
  place_id: str(r.place_id),
  decade: int(r.decade) ?? 0,
  presence_status: parsePresence(str(r.presence_status)),
  persuasion_ids: splitSemi(r.persuasion_ids),
  polity_id: str(r.polity_id) || null,
  ruling_subdivision: str(r.ruling_subdivision),
  council_context: str(r.council_context),
  evidence_note_id: str(r.evidence_note_id) || null,
}));

const notes: Note[] = parseTsv(notesRaw).map((r) => ({
  note_id: str(r.note_id),
  year_bucket: int(r.year_bucket),
  year_exact: int(r.year_exact),
  primary_entity_type: str(r.primary_entity_type),
  primary_entity_id: str(r.primary_entity_id),
  note_kind: str(r.note_kind),
  body_md: str(r.body_md),
  citation_urls: splitSemi(r.citation_urls),
}));

function parseFootprintStance(v: string): FootprintStance {
  const allowed: FootprintStance[] = ["affirms", "condemns", "neutral", ""];
  return allowed.includes(v as FootprintStance) ? (v as FootprintStance) : "";
}

const footprints: Footprint[] = parseTsv(footprintsRaw).map((r) => ({
  entity_type: str(r.entity_type),
  entity_id: str(r.entity_id),
  place_id: str(r.place_id),
  year_start: int(r.year_start),
  year_end: int(r.year_end),
  weight: int(r.weight),
  reason: str(r.reason),
  stance: parseFootprintStance(str(r.stance)),
}));

const noteMentions: NoteMention[] = parseTsv(noteMentionsRaw).map((r) => ({
  note_id: str(r.note_id),
  mentioned_type: str(r.mentioned_type),
  mentioned_slug: str(r.mentioned_slug),
}));

// ─── Lookup Maps ──────────────────────────────────────────────────────────────

const cityById = new Map(cities.map((c) => [c.city_id, c]));
// secondary index: short id (first part before first dash) → city, for city_of_origin_id lookups
const cityByShortId = new Map<string, typeof cities[0]>();
for (const c of cities) {
  const short = c.city_id.split("-")[0];
  if (short && !cityByShortId.has(short)) cityByShortId.set(short, c);
}
const personById = new Map(people.map((p) => [p.person_id, p]));
const workById = new Map(works.map((w) => [w.work_id, w]));
const doctrineById = new Map(doctrines.map((d) => [d.doctrine_id, d]));
const quoteById = new Map(quotes.map((q) => [q.quote_id, q]));
const eventById = new Map(events.map((e) => [e.event_id, e]));
const archaeologyById = new Map(archaeology.map((a) => [a.archaeology_id, a]));
const persuasionById = new Map(persuasions.map((p) => [p.persuasion_id, p]));
const polityById = new Map(polities.map((p) => [p.polity_id, p]));
const placeById = new Map(places.map((p) => [p.place_id, p]));

// place_states indexed by decade
const placeStatesByDecade = new Map<number, PlaceState[]>();
for (const ps of placeStates) {
  const arr = placeStatesByDecade.get(ps.decade) ?? [];
  arr.push(ps);
  placeStatesByDecade.set(ps.decade, arr);
}

// place_states indexed by place_id (for cumulative lookup: all decades for a place)
const placeStatesByPlaceId = new Map<string, PlaceState[]>();
for (const ps of placeStates) {
  const arr = placeStatesByPlaceId.get(ps.place_id) ?? [];
  arr.push(ps);
  placeStatesByPlaceId.set(ps.place_id, arr);
}

// sorted decade list — always spans 0–800 AD in steps of 10, regardless of data coverage
const dataDecades = Array.from(placeStatesByDecade.keys());
const MIN_DECADE = 0;
const MAX_DECADE = 800;
const fullDecadeSet = new Set<number>(dataDecades);
for (let d = MIN_DECADE; d <= MAX_DECADE; d += 10) fullDecadeSet.add(d);
const decades: number[] = Array.from(fullDecadeSet).sort((a, b) => a - b);

// relations indexed by (source_type:source_id) and (target_type:target_id)
const relationsBySource = new Map<string, Relation[]>();
const relationsByTarget = new Map<string, Relation[]>();
for (const r of relations) {
  const srcKey = `${r.source_type}:${r.source_id}`;
  const tgtKey = `${r.target_type}:${r.target_id}`;
  const srcArr = relationsBySource.get(srcKey) ?? [];
  srcArr.push(r);
  relationsBySource.set(srcKey, srcArr);
  const tgtArr = relationsByTarget.get(tgtKey) ?? [];
  tgtArr.push(r);
  relationsByTarget.set(tgtKey, tgtArr);
}

// notes indexed by (primary_entity_type:primary_entity_id)
const notesByEntity = new Map<string, Note[]>();
for (const n of notes) {
  const key = `${n.primary_entity_type}:${n.primary_entity_id}`;
  const arr = notesByEntity.get(key) ?? [];
  arr.push(n);
  notesByEntity.set(key, arr);
}

// footprints indexed by (entity_type:entity_id)
const footprintsByEntity = new Map<string, Footprint[]>();
for (const f of footprints) {
  const key = `${f.entity_type}:${f.entity_id}`;
  const arr = footprintsByEntity.get(key) ?? [];
  arr.push(f);
  footprintsByEntity.set(key, arr);
}

// quotes indexed by doctrine_id and work_id
const quotesByDoctrine = new Map<string, Quote[]>();
const quotesByWork = new Map<string, Quote[]>();
for (const q of quotes) {
  const dArr = quotesByDoctrine.get(q.doctrine_id) ?? [];
  dArr.push(q);
  quotesByDoctrine.set(q.doctrine_id, dArr);
  if (q.work_id) {
    const wArr = quotesByWork.get(q.work_id) ?? [];
    wArr.push(q);
    quotesByWork.set(q.work_id, wArr);
  }
}

// note_mentions indexed by mentioned entity (mentioned_type:mentioned_slug)
const noteMentionsByEntity = new Map<string, NoteMention[]>();
for (const m of noteMentions) {
  const key = `${m.mentioned_type}:${m.mentioned_slug}`;
  const arr = noteMentionsByEntity.get(key) ?? [];
  arr.push(m);
  noteMentionsByEntity.set(key, arr);
}

// works indexed by author_person_id
const worksByAuthor = new Map<string, Work[]>();
for (const w of works) {
  if (w.author_person_id) {
    const arr = worksByAuthor.get(w.author_person_id) ?? [];
    arr.push(w);
    worksByAuthor.set(w.author_person_id, arr);
  }
}

// ─── Facets ───────────────────────────────────────────────────────────────────

const allPresenceStatuses = Array.from(new Set(placeStates.map((ps) => ps.presence_status))).sort();
const allPolityIds = Array.from(polityById.keys()).sort();
const allPersuasionIds = Array.from(persuasionById.keys()).sort();

// ─── Map helpers ──────────────────────────────────────────────────────────────

function getCitiesAtDecade(decade: number): CityAtDecade[] {
  const states = placeStatesByDecade.get(decade) ?? [];
  const result: CityAtDecade[] = [];
  for (const ps of states) {
    if (!ps.place_id.startsWith("city:")) continue;
    const cityId = ps.place_id.slice(5);
    const city = cityById.get(cityId);
    if (!city) continue;
    result.push({ ...city, ...ps });
  }
  return result;
}

function getCumulativeCitiesAtDecade(decade: number): CityAtDecade[] {
  // Keep the LATEST known state for each city (overwrite on each newer decade)
  const latestByPlace = new Map<string, CityAtDecade>();
  for (const d of decades) {
    if (d > decade) break;
    for (const ps of placeStatesByDecade.get(d) ?? []) {
      if (!ps.place_id.startsWith("city:")) continue;
      const cityId = ps.place_id.slice(5);
      const city = cityById.get(cityId);
      if (!city) continue;
      latestByPlace.set(ps.place_id, { ...city, ...ps });
    }
  }
  return Array.from(latestByPlace.values());
}

function getCumulativeArchAtDecade(decade: number) {
  return archaeology.filter((a) => {
    const start = a.year_start ?? -9999;
    return start <= decade + 10;
  });
}

// ─── Search helpers ───────────────────────────────────────────────────────────

function searchText<T>(items: T[], getText: (item: T) => string, query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => getText(item).toLowerCase().includes(q));
}

// ─── Entity label helpers ─────────────────────────────────────────────────────

export function getEntityLabel(kind: string, id: string): string {
  switch (kind) {
    case "city": return cityById.get(id)?.city_label ?? id;
    case "person": return personById.get(id)?.person_label ?? id;
    case "work": return workById.get(id)?.title_display ?? id;
    case "doctrine": return doctrineById.get(id)?.name_display ?? id;
    case "event": return eventById.get(id)?.name_display ?? id;
    case "archaeology": return archaeologyById.get(id)?.name_display ?? id;
    case "persuasion": return persuasionById.get(id)?.persuasion_label ?? id;
    case "polity": return polityById.get(id)?.polity_label ?? id;
    default: return id;
  }
}


// ─── DataStore singleton ─────────────────────────────────────────────────────

export const dataStore = {
  // ── Cities ──
  cities: {
    getAll: () => cities,
    getById: (id: string) => cityById.get(id) ?? cityByShortId.get(id),
    getByShortId: (id: string) => cityByShortId.get(id),
    search: (q: string) =>
      searchText(cities, (c) => `${c.city_label} ${c.city_ancient} ${c.city_modern} ${c.country_modern}`, q),
  },

  // ── People ──
  people: {
    getAll: () => people,
    getById: (id: string) => personById.get(id),
    search: (q: string) =>
      searchText(people, (p) => `${p.person_label} ${p.name_alt.join(" ")} ${p.roles.join(" ")} ${p.description}`, q),
    getByRole: (role: string) => people.filter((p) => p.roles.some((r) => r.toLowerCase().includes(role.toLowerCase()))),
    getAllRoles: () => Array.from(new Set(people.flatMap((p) => p.roles))).sort(),
  },

  // ── Works ──
  works: {
    getAll: () => works,
    getById: (id: string) => workById.get(id),
    search: (q: string) =>
      searchText(works, (w) => `${w.title_display} ${w.author_name_display} ${w.description} ${w.work_type}`, q),
    getByAuthor: (personId: string) => worksByAuthor.get(personId) ?? [],
    getByType: (type: string) => works.filter((w) => w.work_type === type),
    getAllTypes: () => Array.from(new Set(works.map((w) => w.work_type))).sort(),
  },

  // ── Doctrines ──
  doctrines: {
    getAll: () => doctrines,
    getById: (id: string) => doctrineById.get(id),
    search: (q: string) =>
      searchText(doctrines, (d) => `${d.name_display} ${d.category} ${d.description}`, q),
    getByCategory: (cat: string) => doctrines.filter((d) => d.category === cat),
    getAllCategories: () => Array.from(new Set(doctrines.map((d) => d.category))).sort(),
  },

  // ── Quotes ──
  quotes: {
    getAll: () => quotes,
    getById: (id: string) => quoteById.get(id),
    getByDoctrine: (doctrineId: string) => quotesByDoctrine.get(doctrineId) ?? [],
    getByWork: (workId: string) => quotesByWork.get(workId) ?? [],
  },

  // ── Events ──
  events: {
    getAll: () => events,
    getById: (id: string) => eventById.get(id),
    search: (q: string) =>
      searchText(events, (e) => `${e.name_display} ${e.event_type} ${e.region} ${e.description}`, q),
    getByType: (type: string) => events.filter((e) => e.event_type === type),
    getByDecade: (decade: number) =>
      events.filter((e) => {
        const start = e.year_start ?? 0;
        return start >= decade && start < decade + 10;
      }),
    getAllTypes: () => Array.from(new Set(events.map((e) => e.event_type))).sort(),
  },

  // ── Archaeology ──
  archaeology: {
    getAll: () => archaeology,
    getById: (id: string) => archaeologyById.get(id),
    search: (q: string) =>
      searchText(archaeology, (a) => `${a.name_display} ${a.site_type} ${a.description}`, q),
    getByType: (type: string) => archaeology.filter((a) => a.site_type === type),
    getActiveAtDecade: (decade: number) =>
      archaeology.filter((a) => {
        const start = a.year_start ?? -9999;
        const end = a.year_end ?? 9999;
        return start <= decade + 10 && end >= decade;
      }),
    getCumulativeAtDecade: (decade: number) => getCumulativeArchAtDecade(decade),
    getAllTypes: () => Array.from(new Set(archaeology.map((a) => a.site_type))).sort(),
  },

  // ── Persuasions ──
  persuasions: {
    getAll: () => persuasions,
    getById: (id: string) => persuasionById.get(id),
  },

  // ── Polities ──
  polities: {
    getAll: () => polities,
    getById: (id: string) => polityById.get(id),
  },

  // ── Places ──
  places: {
    getAll: () => places,
    getById: (id: string) => placeById.get(id),
  },

  // ── Map data ──
  map: {
    getDecades: () => decades,
    getCitiesAtDecade,
    getCumulativeCitiesAtDecade,
    getAllPresenceStatuses: () => allPresenceStatuses as PresenceStatus[],
    getAllPolityIds: () => allPolityIds,
    getAllPersuasionIds: () => allPersuasionIds,
    getPlaceStatesForCity: (cityId: string) => placeStatesByPlaceId.get(`city:${cityId}`) ?? [],
    getAllPlaceStates: () => placeStates,
  },

  // ── Relations ──
  relations: {
    getAll: () => relations,
    getById: (id: string) => relations.find((r) => r.relation_id === id) ?? null,
    getFromEntity: (type: string, id: string) => relationsBySource.get(`${type}:${id}`) ?? [],
    getToEntity: (type: string, id: string) => relationsByTarget.get(`${type}:${id}`) ?? [],
    getForEntity: (type: string, id: string) => [
      ...(relationsBySource.get(`${type}:${id}`) ?? []),
      ...(relationsByTarget.get(`${type}:${id}`) ?? []),
    ],
  },

  // ── Notes ──
  notes: {
    getAll: () => notes,
    getForEntity: (type: string, id: string) => notesByEntity.get(`${type}:${id}`) ?? [],
  },

  // ── Footprints ──
  footprints: {
    getAll: () => footprints,
    getForEntity: (type: string, id: string) => footprintsByEntity.get(`${type}:${id}`) ?? [],
    getForPlace: (placeId: string) => footprints.filter((f) => f.place_id === placeId),
    getDoctrineFootprintsForCity: (cityId: string) =>
      footprints.filter((f) => f.entity_type === "doctrine" && f.place_id === `city:${cityId}`),
  },

  // ── Note Mentions ──
  noteMentions: {
    getAll: () => noteMentions,
    getMentioning: (type: string, id: string) => noteMentionsByEntity.get(`${type}:${id}`) ?? [],
  },
};
