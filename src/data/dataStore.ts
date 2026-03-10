import { parseTsv, int, float, splitSemi, str } from "./parseTsv";

// ─── Domain types (single source of truth in types.ts) ───────────────────────

export type {
  PlaceKind, LocationPrecision, PresenceStatus, PersonKind, WorkType, WorkKind,
  EventType, EventKind, GroupKind, TopicKind, DimensionKind, SourceKind,
  EditorNoteKind, Certainty, Polarity, ClaimStatus, EvidenceRole,
  ReviewStatus, ReviewConfidence, ObjectMode, DerivedStance, Stance,
  CanonicalSortRule, MentionSourceType,
  EntityType, MentionTargetType, SelectionKind,
  Place, Person, Work, HistoricalEvent, Group, Topic, Dimension, Proposition,
  PredicateType, SourceRecord, Passage, Claim, ClaimEvidence, ClaimReview, EditorNote,
  EntityPlaceFootprint, PlaceStateByDecade, FirstAttestation, PropositionPlacePresence,
  NoteMention, PlaceAtDecade,
  EntityRef, HighlightEntry, CorrespondenceArc, Selection,
} from "./types";

import type {
  PresenceStatus, LocationPrecision, PlaceKind,
  Place, Person, Work, HistoricalEvent, Group, Topic, Dimension, Proposition,
  PredicateType, SourceRecord, Passage, Claim, ClaimEvidence, ClaimReview, EditorNote,
  EntityPlaceFootprint, PlaceStateByDecade, FirstAttestation, PropositionPlacePresence,
  NoteMention, PlaceAtDecade, DerivedStance,
} from "./types";

// ─── Raw TSV imports (bundled at build time) ──────────────────────────────────

// Canonical source tables
import placesRaw          from "../../data/sheets/places.tsv?raw";
import peopleRaw          from "../../data/sheets/people.tsv?raw";
import worksRaw           from "../../data/sheets/works.tsv?raw";
import eventsRaw          from "../../data/sheets/events.tsv?raw";
import groupsRaw          from "../../data/sheets/groups.tsv?raw";
import topicsRaw          from "../../data/sheets/topics.tsv?raw";
import dimensionsRaw      from "../../data/sheets/dimensions.tsv?raw";
import propositionsRaw    from "../../data/sheets/propositions.tsv?raw";
import predicateTypesRaw  from "../../data/sheets/predicate_types.tsv?raw";
import sourcesRaw         from "../../data/sheets/sources.tsv?raw";
import passagesRaw        from "../../data/sheets/passages.tsv?raw";
import claimsRaw          from "../../data/sheets/claims.tsv?raw";
import claimEvidenceRaw   from "../../data/sheets/claim_evidence.tsv?raw";
import claimReviewsRaw    from "../../data/sheets/claim_reviews.tsv?raw";
import editorNotesRaw     from "../../data/sheets/editor_notes.tsv?raw";

// Derived tables
import footprintsRaw      from "../../data/derived/entity_place_footprints.tsv?raw";
import placeStatesRaw     from "../../data/derived/place_state_by_decade.tsv?raw";
import firstAttestRaw     from "../../data/derived/first_attestations.tsv?raw";
import propPresenceRaw    from "../../data/derived/proposition_place_presence.tsv?raw";
import noteMentionsRaw    from "../../data/derived/note_mentions.tsv?raw";

// ─── Parsing helpers ──────────────────────────────────────────────────────────

function parsePresence(v: string): PresenceStatus {
  const allowed: PresenceStatus[] = ["attested", "probable", "claimed_tradition", "not_attested", "suppressed", "unknown"];
  return allowed.includes(v as PresenceStatus) ? (v as PresenceStatus) : "unknown";
}

function parseLocPrec(v: string): LocationPrecision {
  const allowed: LocationPrecision[] = ["exact", "approx_city", "approx_site", "approx_region", "region_only", "unknown"];
  return allowed.includes(v as LocationPrecision) ? (v as LocationPrecision) : "unknown";
}

function parsePlaceKind(v: string): PlaceKind {
  const allowed: PlaceKind[] = ["city", "region", "province", "site", "monastery", "route", "unknown"];
  return allowed.includes(v as PlaceKind) ? (v as PlaceKind) : "unknown";
}

function parseDerivedStance(v: string): DerivedStance {
  if (v === "affirms" || v === "opposes" || v === "mixed" || v === "neutral") return v;
  return "";
}

function parseBool(v: string): boolean {
  return v === "true" || v === "1" || v === "yes";
}

// ─── Parse all entities ───────────────────────────────────────────────────────

const places: Place[] = parseTsv(placesRaw).map((r) => ({
  place_id: str(r.place_id),
  place_label: str(r.place_label),
  place_label_modern: str(r.place_label_modern),
  place_kind: parsePlaceKind(str(r.place_kind)),
  parent_place_id: str(r.parent_place_id),
  lat: float(r.lat),
  lon: float(r.lon),
  location_precision: parseLocPrec(str(r.location_precision)),
  modern_country_label: str(r.modern_country_label),
  notes: str(r.notes),
}));

const people: Person[] = parseTsv(peopleRaw).map((r) => ({
  person_id: str(r.person_id),
  person_label: str(r.person_label),
  name_alt: splitSemi(r.name_alt),
  name_native: str(r.name_native),
  birth_year_display: str(r.birth_year_display),
  death_year_display: str(r.death_year_display),
  person_kind: str(r.person_kind) as Person["person_kind"],
  notes: str(r.notes),
}));

const works: Work[] = parseTsv(worksRaw).map((r) => ({
  work_id: str(r.work_id),
  title_display: str(r.title_display),
  title_original: str(r.title_original),
  work_type: str(r.work_type) as Work["work_type"],
  language_original: str(r.language_original),
  work_kind: str(r.work_kind) as Work["work_kind"],
  notes: str(r.notes),
}));

const events: HistoricalEvent[] = parseTsv(eventsRaw).map((r) => ({
  event_id: str(r.event_id),
  event_label: str(r.event_label),
  event_type: str(r.event_type) as HistoricalEvent["event_type"],
  event_kind: str(r.event_kind) as HistoricalEvent["event_kind"],
  notes: str(r.notes),
}));

const groups: Group[] = parseTsv(groupsRaw).map((r) => ({
  group_id: str(r.group_id),
  group_label: str(r.group_label),
  group_kind: str(r.group_kind) as Group["group_kind"],
  is_christian: parseBool(str(r.is_christian)),
  notes: str(r.notes),
}));

const topics: Topic[] = parseTsv(topicsRaw).map((r) => ({
  topic_id: str(r.topic_id),
  topic_label: str(r.topic_label),
  topic_kind: str(r.topic_kind) as Topic["topic_kind"],
  notes: str(r.notes),
}));

const dimensions: Dimension[] = parseTsv(dimensionsRaw).map((r) => ({
  dimension_id: str(r.dimension_id),
  topic_id: str(r.topic_id),
  dimension_label: str(r.dimension_label),
  dimension_kind: str(r.dimension_kind) as Dimension["dimension_kind"],
  notes: str(r.notes),
}));

const propositions: Proposition[] = parseTsv(propositionsRaw).map((r) => ({
  proposition_id: str(r.proposition_id),
  topic_id: str(r.topic_id),
  dimension_id: str(r.dimension_id),
  proposition_label: str(r.proposition_label),
  polarity_family: str(r.polarity_family),
  description: str(r.description),
  notes: str(r.notes),
}));

const predicateTypes: PredicateType[] = parseTsv(predicateTypesRaw).map((r) => ({
  predicate_id: str(r.predicate_id),
  predicate_label: str(r.predicate_label),
  subject_type: str(r.subject_type),
  object_mode: str(r.object_mode) as PredicateType["object_mode"],
  object_type: str(r.object_type),
  inverse_label: str(r.inverse_label),
  is_symmetric: parseBool(str(r.is_symmetric)),
  canonical_sort_rule: str(r.canonical_sort_rule),
  allows_date_range: parseBool(str(r.allows_date_range)),
  allows_context_place: parseBool(str(r.allows_context_place)),
  description: str(r.description),
}));

const sources: SourceRecord[] = parseTsv(sourcesRaw).map((r) => ({
  source_id: str(r.source_id),
  source_kind: str(r.source_kind) as SourceRecord["source_kind"],
  title: str(r.title),
  author: str(r.author),
  editor: str(r.editor),
  year: str(r.year),
  container_title: str(r.container_title),
  publisher: str(r.publisher),
  url: str(r.url),
  accessed_on: str(r.accessed_on),
  isbn_issn: str(r.isbn_issn),
  notes: str(r.notes),
}));

const passages: Passage[] = parseTsv(passagesRaw).map((r) => ({
  passage_id: str(r.passage_id),
  source_id: str(r.source_id),
  locator: str(r.locator),
  excerpt: str(r.excerpt),
  language: str(r.language),
  passage_year: int(r.passage_year),
  url_override: str(r.url_override),
  notes: str(r.notes),
}));

const claims: Claim[] = parseTsv(claimsRaw).map((r) => ({
  claim_id: str(r.claim_id),
  subject_type: str(r.subject_type),
  subject_id: str(r.subject_id),
  predicate_id: str(r.predicate_id),
  object_mode: str(r.object_mode) as Claim["object_mode"],
  object_type: str(r.object_type),
  object_id: str(r.object_id),
  value_text: str(r.value_text),
  value_number: float(r.value_number),
  value_year: int(r.value_year),
  value_boolean: str(r.value_boolean) ? parseBool(str(r.value_boolean)) : null,
  year_start: int(r.year_start),
  year_end: int(r.year_end),
  context_place_id: str(r.context_place_id),
  certainty: str(r.certainty) as Claim["certainty"],
  polarity: str(r.polarity) as Claim["polarity"],
  claim_status: str(r.claim_status) as Claim["claim_status"],
  created_by: str(r.created_by),
  updated_at: str(r.updated_at),
}));

const claimEvidence: ClaimEvidence[] = parseTsv(claimEvidenceRaw).map((r) => ({
  claim_id: str(r.claim_id),
  passage_id: str(r.passage_id),
  evidence_role: str(r.evidence_role) as ClaimEvidence["evidence_role"],
  excerpt_override: str(r.excerpt_override),
  evidence_weight: float(r.evidence_weight),
  notes: str(r.notes),
}));

const claimReviews: ClaimReview[] = parseTsv(claimReviewsRaw).map((r) => ({
  claim_id: str(r.claim_id),
  reviewer_id: str(r.reviewer_id),
  review_status: str(r.review_status) as ClaimReview["review_status"],
  reviewed_at: str(r.reviewed_at),
  confidence: str(r.confidence) as ClaimReview["confidence"],
  note: str(r.note),
}));

const editorNotes: EditorNote[] = parseTsv(editorNotesRaw).map((r) => ({
  editor_note_id: str(r.editor_note_id),
  note_kind: str(r.note_kind) as EditorNote["note_kind"],
  entity_type: str(r.entity_type),
  entity_id: str(r.entity_id),
  claim_id: str(r.claim_id),
  body_md: str(r.body_md),
  created_by: str(r.created_by),
  created_at: str(r.created_at),
}));

// ─── Parse derived tables ────────────────────────────────────────────────────

const footprints: EntityPlaceFootprint[] = parseTsv(footprintsRaw).map((r) => ({
  entity_type: str(r.entity_type),
  entity_id: str(r.entity_id),
  place_id: str(r.place_id),
  year_start: int(r.year_start),
  year_end: int(r.year_end),
  reason_predicate_id: str(r.reason_predicate_id),
  stance: parseDerivedStance(str(r.stance)),
  path_signature: str(r.path_signature),
}));

const placeStates: PlaceStateByDecade[] = parseTsv(placeStatesRaw).map((r) => ({
  place_id: str(r.place_id),
  decade: int(r.decade) ?? 0,
  presence_status: parsePresence(str(r.presence_status)),
  group_presence_summary: splitSemi(r.group_presence_summary),
  dominant_polity_group_id: str(r.dominant_polity_group_id),
  supporting_claim_count: int(r.supporting_claim_count) ?? 0,
  derivation_hash: str(r.derivation_hash),
}));

const firstAttestations: FirstAttestation[] = parseTsv(firstAttestRaw).map((r) => ({
  subject_type: str(r.subject_type),
  subject_id: str(r.subject_id),
  predicate_id: str(r.predicate_id),
  first_year: int(r.first_year),
  first_claim_id: str(r.first_claim_id),
  first_passage_id: str(r.first_passage_id),
}));

const propositionPlacePresence: PropositionPlacePresence[] = parseTsv(propPresenceRaw).map((r) => ({
  proposition_id: str(r.proposition_id),
  place_id: str(r.place_id),
  year_start: int(r.year_start),
  year_end: int(r.year_end),
  stance: str(r.stance) as PropositionPlacePresence["stance"],
  supporting_claim_count: int(r.supporting_claim_count) ?? 0,
  opposing_claim_count: int(r.opposing_claim_count) ?? 0,
  derivation_hash: str(r.derivation_hash),
}));

const noteMentions: NoteMention[] = parseTsv(noteMentionsRaw).map((r) => ({
  mention_source_type: str(r.mention_source_type) as NoteMention["mention_source_type"],
  source_table: str(r.source_table),
  source_row_id: str(r.source_row_id),
  source_field: str(r.source_field),
  source_path: str(r.source_path),
  mentioned_type: str(r.mentioned_type) as NoteMention["mentioned_type"],
  mentioned_id: str(r.mentioned_id),
  mention_label: str(r.mention_label),
}));

// ─── Lookup Maps ──────────────────────────────────────────────────────────────

const placeById = new Map(places.map((p) => [p.place_id, p]));
const personById = new Map(people.map((p) => [p.person_id, p]));
const workById = new Map(works.map((w) => [w.work_id, w]));
const eventById = new Map(events.map((e) => [e.event_id, e]));
const groupById = new Map(groups.map((g) => [g.group_id, g]));
const topicById = new Map(topics.map((t) => [t.topic_id, t]));
const dimensionById = new Map(dimensions.map((d) => [d.dimension_id, d]));
const propositionById = new Map(propositions.map((p) => [p.proposition_id, p]));
const predicateById = new Map(predicateTypes.map((p) => [p.predicate_id, p]));
const sourceById = new Map(sources.map((s) => [s.source_id, s]));
const passageById = new Map(passages.map((p) => [p.passage_id, p]));
const claimById = new Map(claims.map((c) => [c.claim_id, c]));
const editorNoteById = new Map(editorNotes.map((n) => [n.editor_note_id, n]));

// place_states indexed by decade
const placeStatesByDecade = new Map<number, PlaceStateByDecade[]>();
for (const ps of placeStates) {
  const arr = placeStatesByDecade.get(ps.decade) ?? [];
  arr.push(ps);
  placeStatesByDecade.set(ps.decade, arr);
}

// place_states indexed by place_id
const placeStatesByPlaceId = new Map<string, PlaceStateByDecade[]>();
for (const ps of placeStates) {
  const arr = placeStatesByPlaceId.get(ps.place_id) ?? [];
  arr.push(ps);
  placeStatesByPlaceId.set(ps.place_id, arr);
}

// sorted decade list
const dataDecades = Array.from(placeStatesByDecade.keys());
const MIN_DECADE = 0;
const MAX_DECADE = 100;
const fullDecadeSet = new Set<number>(dataDecades);
for (let d = MIN_DECADE; d <= MAX_DECADE; d += 10) fullDecadeSet.add(d);
const decades: number[] = Array.from(fullDecadeSet).sort((a, b) => a - b);

// claims indexed by (subject_type:subject_id)
const claimsBySubject = new Map<string, Claim[]>();
for (const c of claims) {
  const key = `${c.subject_type}:${c.subject_id}`;
  const arr = claimsBySubject.get(key) ?? [];
  arr.push(c);
  claimsBySubject.set(key, arr);
}

// claims indexed by (object_type:object_id) when object_mode=entity
const claimsByObject = new Map<string, Claim[]>();
for (const c of claims) {
  if (c.object_mode === "entity" && c.object_id) {
    const key = `${c.object_type}:${c.object_id}`;
    const arr = claimsByObject.get(key) ?? [];
    arr.push(c);
    claimsByObject.set(key, arr);
  }
}

// editor_notes indexed by (entity_type:entity_id)
const notesByEntity = new Map<string, EditorNote[]>();
for (const n of editorNotes) {
  if (n.entity_type && n.entity_id) {
    const key = `${n.entity_type}:${n.entity_id}`;
    const arr = notesByEntity.get(key) ?? [];
    arr.push(n);
    notesByEntity.set(key, arr);
  }
}

// footprints indexed by (entity_type:entity_id)
const footprintsByEntity = new Map<string, EntityPlaceFootprint[]>();
for (const f of footprints) {
  const key = `${f.entity_type}:${f.entity_id}`;
  const arr = footprintsByEntity.get(key) ?? [];
  arr.push(f);
  footprintsByEntity.set(key, arr);
}

// claim_evidence indexed by claim_id
const evidenceByClaim = new Map<string, ClaimEvidence[]>();
for (const ce of claimEvidence) {
  const arr = evidenceByClaim.get(ce.claim_id) ?? [];
  arr.push(ce);
  evidenceByClaim.set(ce.claim_id, arr);
}

// claim_evidence indexed by passage_id → claim_ids
const claimIdsByPassage = new Map<string, Set<string>>();
for (const ce of claimEvidence) {
  const s = claimIdsByPassage.get(ce.passage_id) ?? new Set();
  s.add(ce.claim_id);
  claimIdsByPassage.set(ce.passage_id, s);
}

// footprints indexed by place_id
const footprintsByPlace = new Map<string, EntityPlaceFootprint[]>();
for (const f of footprints) {
  const arr = footprintsByPlace.get(f.place_id) ?? [];
  arr.push(f);
  footprintsByPlace.set(f.place_id, arr);
}

// note_mentions indexed by (mentioned_type:mentioned_id)
const noteMentionsByEntity = new Map<string, NoteMention[]>();
for (const m of noteMentions) {
  const key = `${m.mentioned_type}:${m.mentioned_id}`;
  const arr = noteMentionsByEntity.get(key) ?? [];
  arr.push(m);
  noteMentionsByEntity.set(key, arr);
}

// first_attestations indexed by (subject_type:subject_id)
const firstAttestBySubject = new Map<string, FirstAttestation[]>();
for (const fa of firstAttestations) {
  const key = `${fa.subject_type}:${fa.subject_id}`;
  const arr = firstAttestBySubject.get(key) ?? [];
  arr.push(fa);
  firstAttestBySubject.set(key, arr);
}

// ─── Infrastructure predicates (hidden from UI, drive derivations only) ───────

const INFRA_PREDICATES = new Set(["place_presence_status", "event_has_year"]);

// ─── Facets ───────────────────────────────────────────────────────────────────

const allPresenceStatuses = Array.from(new Set(placeStates.map((ps) => ps.presence_status))).sort();

// ─── Derived: Christianity presence per place ────────────────────────────────
// A place "has Christianity" if any group with is_christian=true appears in
// its group_presence_summary at some decade. This is an editorial flag on
// groups.tsv so that gnostic/schismatic groups can still count as Christian.

const christianGroupIds = new Set(
  groups.filter((g) => g.is_christian).map((g) => g.group_id),
);

const placeHasChristianity = new Set<string>();
for (const ps of placeStates) {
  if (ps.group_presence_summary.some((gid) => christianGroupIds.has(gid))) {
    placeHasChristianity.add(ps.place_id);
  }
}

// ─── Map helpers ──────────────────────────────────────────────────────────────

function getPlacesAtDecade(decade: number): PlaceAtDecade[] {
  const states = placeStatesByDecade.get(decade) ?? [];
  const result: PlaceAtDecade[] = [];
  for (const ps of states) {
    const place = placeById.get(ps.place_id);
    if (!place) continue;
    result.push({ ...place, ...ps });
  }
  return result;
}

function getCumulativePlacesAtDecade(decade: number): PlaceAtDecade[] {
  const latestByPlace = new Map<string, PlaceAtDecade>();
  for (const d of decades) {
    if (d > decade) break;
    for (const ps of placeStatesByDecade.get(d) ?? []) {
      const place = placeById.get(ps.place_id);
      if (!place) continue;
      latestByPlace.set(ps.place_id, { ...place, ...ps });
    }
  }
  return Array.from(latestByPlace.values());
}

// ─── Entity label helper ─────────────────────────────────────────────────────

export function getEntityLabel(kind: string, id: string): string {
  switch (kind) {
    case "place": return placeById.get(id)?.place_label ?? id;
    case "person": return personById.get(id)?.person_label ?? id;
    case "work": return workById.get(id)?.title_display ?? id;
    case "event": return eventById.get(id)?.event_label ?? id;
    case "group": return groupById.get(id)?.group_label ?? id;
    case "topic": return topicById.get(id)?.topic_label ?? id;
    case "dimension": return dimensionById.get(id)?.dimension_label ?? id;
    case "proposition": return propositionById.get(id)?.proposition_label ?? id;
    case "source": return sourceById.get(id)?.title ?? id;
    case "editor_note": return editorNoteById.get(id)?.note_kind ?? id;
    default: return id;
  }
}

// ─── Business logic helpers (keep UI components thin) ───────────────────────

export type PersonWithClaims = { personId: string; claims: Claim[] };

/** Extract people linked to an entity via claims (where one side is a person). */
function getPeopleFromClaims(entityClaims: Claim[]): PersonWithClaims[] {
  const personMap = new Map<string, Claim[]>();
  for (const c of entityClaims) {
    const pid = c.subject_type === "person" ? c.subject_id
              : c.object_type === "person" ? c.object_id
              : null;
    if (!pid) continue;
    const arr = personMap.get(pid) ?? [];
    arr.push(c);
    personMap.set(pid, arr);
  }
  return Array.from(personMap.entries()).map(([personId, pClaims]) => ({
    personId,
    claims: pClaims,
  }));
}

/** People referenced in a work via source→passage→evidence→claim chain. */
function getPeopleForWork(workId: string): PersonWithClaims[] {
  const work = workById.get(workId);
  if (!work) return [];

  const source = sources.find((s) => s.title === work.title_display);
  if (!source) return [];

  const srcPassages = passages.filter((p) => p.source_id === source.source_id);
  const reachedClaimIds = new Set<string>();
  for (const p of srcPassages) {
    const ids = claimIdsByPassage.get(p.passage_id);
    if (ids) for (const cid of ids) reachedClaimIds.add(cid);
  }

  const personMap = new Map<string, Claim[]>();

  // People from evidence chain
  for (const cid of reachedClaimIds) {
    const c = claimById.get(cid);
    if (!c) continue;
    const pid = c.subject_type === "person" ? c.subject_id
              : c.object_type === "person" ? c.object_id
              : null;
    if (!pid) continue;
    const arr = personMap.get(pid) ?? [];
    arr.push(c);
    personMap.set(pid, arr);
  }

  // Also include direct claims (work as subject/object)
  const directClaims = [
    ...(claimsBySubject.get(`work:${workId}`) ?? []),
    ...(claimsByObject.get(`work:${workId}`) ?? []),
  ];
  for (const c of directClaims) {
    const pid = c.subject_type === "person" ? c.subject_id
              : c.object_type === "person" ? c.object_id
              : null;
    if (!pid) continue;
    const arr = personMap.get(pid) ?? [];
    if (!arr.some((x) => x.claim_id === c.claim_id)) arr.push(c);
    personMap.set(pid, arr);
  }

  return Array.from(personMap.entries()).map(([personId, pClaims]) => ({
    personId,
    claims: pClaims,
  }));
}

/** Get backing claims for a footprint (replaces full-table-scan in FootprintCard). */
function getBackingClaimsForFootprint(fp: EntityPlaceFootprint): Claim[] {
  const subjectClaims = claimsBySubject.get(`${fp.entity_type}:${fp.entity_id}`) ?? [];
  return subjectClaims.filter((c) =>
    c.predicate_id === fp.reason_predicate_id &&
    ((c.object_mode === "entity" && c.object_id === fp.place_id) ||
     (c.context_place_id === fp.place_id)),
  );
}

/** Bucket footprints by decade for a place. */
function getFootprintsByDecadeForPlace(
  placeId: string,
  states: PlaceStateByDecade[],
): Map<number, EntityPlaceFootprint[]> {
  const fps = footprintsByPlace.get(placeId) ?? [];
  const map = new Map<number, EntityPlaceFootprint[]>();
  for (const fp of fps) {
    const start = fp.year_start ?? 0;
    const end = fp.year_end ?? start;
    const dStart = Math.floor(start / 10) * 10;
    const dEnd = Math.floor(end / 10) * 10;
    for (const ps of states) {
      if (ps.decade >= dStart && ps.decade <= dEnd) {
        const arr = map.get(ps.decade) ?? [];
        if (!arr.some((a) =>
          a.entity_type === fp.entity_type &&
          a.entity_id === fp.entity_id &&
          a.reason_predicate_id === fp.reason_predicate_id,
        )) {
          arr.push(fp);
        }
        map.set(ps.decade, arr);
      }
    }
  }
  return map;
}

/** Find the nearest place state for a given decade. */
function getCurrentPlaceState(
  placeId: string,
  decade: number,
): PlaceStateByDecade | undefined {
  const states = placeStates.filter((ps) => ps.place_id === placeId);
  const exact = states.find((ps) => ps.decade === decade);
  if (exact) return exact;
  const past = states.filter((ps) => ps.decade <= decade);
  return past.length > 0 ? past[past.length - 1] : states[0];
}

/** Dedup footprints by place_id (first occurrence wins). */
function dedupFootprintsByPlace(fps: EntityPlaceFootprint[]): EntityPlaceFootprint[] {
  const seen = new Set<string>();
  return fps.filter((f) => {
    if (seen.has(f.place_id)) return false;
    seen.add(f.place_id);
    return true;
  });
}

/** Dedup mention notes — returns unique EditorNote[] for mentions of an entity. */
function getMentioningNotes(type: string, id: string): EditorNote[] {
  const mentions = noteMentionsByEntity.get(`${type}:${id}`) ?? [];
  const seen = new Set<string>();
  const out: EditorNote[] = [];
  for (const m of mentions) {
    if (seen.has(m.source_row_id)) continue;
    seen.add(m.source_row_id);
    const note = editorNoteById.get(m.source_row_id);
    if (note) out.push(note);
  }
  return out;
}

// ─── DataStore singleton ─────────────────────────────────────────────────────

export const dataStore = {
  // ── Places (unified — replaces cities + archaeology) ──
  places: {
    getAll: () => places,
    getById: (id: string) => placeById.get(id),
    getByKind: (kind: PlaceKind) => places.filter((p) => p.place_kind === kind),
    getChildren: (parentId: string) => places.filter((p) => p.parent_place_id === parentId),
  },

  // ── People ──
  people: {
    getAll: () => people,
    getById: (id: string) => personById.get(id),
  },

  // ── Works ──
  works: {
    getAll: () => works,
    getById: (id: string) => workById.get(id),
  },

  // ── Events ──
  events: {
    getAll: () => events,
    getById: (id: string) => eventById.get(id),
  },

  // ── Groups (replaces persuasions + polities) ──
  groups: {
    getAll: () => groups,
    getById: (id: string) => groupById.get(id),
    getByKind: (kind: string) => groups.filter((g) => g.group_kind === kind),
  },

  // ── Topics ──
  topics: {
    getAll: () => topics,
    getById: (id: string) => topicById.get(id),
  },

  // ── Dimensions ──
  dimensions: {
    getAll: () => dimensions,
    getById: (id: string) => dimensionById.get(id),
    getByTopic: (topicId: string) => dimensions.filter((d) => d.topic_id === topicId),
  },

  // ── Propositions (replaces doctrines) ──
  propositions: {
    getAll: () => propositions,
    getById: (id: string) => propositionById.get(id),
    getByTopic: (topicId: string) => propositions.filter((p) => p.topic_id === topicId),
  },

  // ── Predicate types ──
  predicateTypes: {
    getAll: () => predicateTypes,
    getById: (id: string) => predicateById.get(id),
  },

  // ── Sources ──
  sources: {
    getAll: () => sources,
    getById: (id: string) => sourceById.get(id),
  },

  // ── Passages ──
  passages: {
    getAll: () => passages,
    getById: (id: string) => passageById.get(id),
    getBySource: (sourceId: string) => passages.filter((p) => p.source_id === sourceId),
  },

  // ── Claims (replaces relations) ──
  claims: {
    getAll: () => claims,
    getById: (id: string) => claimById.get(id),
    getForSubject: (type: string, id: string) => claimsBySubject.get(`${type}:${id}`) ?? [],
    getForObject: (type: string, id: string) => claimsByObject.get(`${type}:${id}`) ?? [],
    getForEntity: (type: string, id: string) => [
      ...(claimsBySubject.get(`${type}:${id}`) ?? []),
      ...(claimsByObject.get(`${type}:${id}`) ?? []),
    ],
    getVisibleForEntity: (type: string, id: string) => [
      ...(claimsBySubject.get(`${type}:${id}`) ?? []),
      ...(claimsByObject.get(`${type}:${id}`) ?? []),
    ].filter((c) => !INFRA_PREDICATES.has(c.predicate_id)),
    isInfraPredicate: (predicateId: string) => INFRA_PREDICATES.has(predicateId),
    getBackingForFootprint: (fp: EntityPlaceFootprint) => getBackingClaimsForFootprint(fp),
    getPeopleForWork: (workId: string) => getPeopleForWork(workId),
    getPeopleForEntity: (type: string, id: string) => getPeopleFromClaims([
      ...(claimsBySubject.get(`${type}:${id}`) ?? []),
      ...(claimsByObject.get(`${type}:${id}`) ?? []),
    ]),
  },

  // ── Claim evidence ──
  claimEvidence: {
    getAll: () => claimEvidence,
    getForClaim: (claimId: string) => evidenceByClaim.get(claimId) ?? [],
  },

  // ── Claim reviews ──
  claimReviews: {
    getAll: () => claimReviews,
    getForClaim: (claimId: string) => claimReviews.filter((r) => r.claim_id === claimId),
  },

  // ── Editor notes (replaces notes) ──
  editorNotes: {
    getAll: () => editorNotes,
    getById: (id: string) => editorNoteById.get(id),
    getForEntity: (type: string, id: string) => notesByEntity.get(`${type}:${id}`) ?? [],
    getMentioningNotes: (type: string, id: string) => getMentioningNotes(type, id),
  },

  // ── Footprints (derived) ──
  footprints: {
    getAll: () => footprints,
    getForEntity: (type: string, id: string) => footprintsByEntity.get(`${type}:${id}`) ?? [],
    getForPlace: (placeId: string) => footprintsByPlace.get(placeId) ?? [],
    getForEntityDeduped: (type: string, id: string) => dedupFootprintsByPlace(footprintsByEntity.get(`${type}:${id}`) ?? []),
    getByDecadeForPlace: (placeId: string, states: PlaceStateByDecade[]) => getFootprintsByDecadeForPlace(placeId, states),
  },

  // ── First attestations (derived) ──
  firstAttestations: {
    getAll: () => firstAttestations,
    getForSubject: (type: string, id: string) => firstAttestBySubject.get(`${type}:${id}`) ?? [],
  },

  // ── Proposition place presence (derived) ──
  propositionPlacePresence: {
    getAll: () => propositionPlacePresence,
    getForProposition: (propId: string) => propositionPlacePresence.filter((p) => p.proposition_id === propId),
    getForPlace: (placeId: string) => propositionPlacePresence.filter((p) => p.place_id === placeId),
  },

  // ── Note mentions (derived) ──
  noteMentions: {
    getAll: () => noteMentions,
    getMentioning: (type: string, id: string) => noteMentionsByEntity.get(`${type}:${id}`) ?? [],
  },

  // ── Map data ──
  map: {
    getDecades: () => decades,
    getPlacesAtDecade,
    getCumulativePlacesAtDecade,
    getAllPresenceStatuses: () => allPresenceStatuses as PresenceStatus[],
    getPlaceStatesForPlace: (placeId: string) => placeStatesByPlaceId.get(placeId) ?? [],
    getAllPlaceStates: () => placeStates,
    placeHasChristianity: (placeId: string) => placeHasChristianity.has(placeId),
    getCurrentPlaceState: (placeId: string, decade: number) => getCurrentPlaceState(placeId, decade),
  },
};
