/**
 * derive_footprints.ts
 *
 * Generates data/entity_place_footprints.tsv deterministically from:
 *   - data/relations.tsv
 *   - data/works.tsv
 *   - data/events.tsv
 *   - data/archaeology.tsv
 *   - data/quotes.tsv
 *   - data/place_state_by_decade.tsv  (for persuasion presence)
 *
 * Derivation chains:
 *   person   → city  : relations (bishop_of, active_in, visited, martyred_in, born_in, …)
 *   work     → city  : works.place_written_id (written_in) + place_recipient_ids (sent_to)
 *   event    → city  : events.primary_place_id (held_in)
 *   arch     → place : archaeology (located_at)
 *   doctrine → city  : work/person→doctrine relations + person→city relations (with stance)
 *   persuasion→city  : place_state_by_decade persuasion_ids (presence)
 *
 * Run via:  npm run data:derive-footprints
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "data");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTsv(path: string): Record<string, string>[] {
  const text = readFileSync(path, "utf-8");
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const headers = (lines[0] ?? "").split("\t").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split("\t");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cols[i] ?? "").trim()));
    return row;
  });
}

function splitSemi(v: string): string[] {
  return (v ?? "").split(";").map((s) => s.trim()).filter(Boolean);
}

/** Map any stance/polarity token → canonical footprint stance */
function toStance(val: string): string {
  const v = (val ?? "").toLowerCase().trim();
  if (v === "supports" || v === "affirming" || v === "affirms" || v === "for") return "affirms";
  if (v === "opposes" || v === "condemning" || v === "condemns" || v === "against") return "condemns";
  if (v === "develops" || v === "first_mentions") return "affirms"; // developing attestation
  return "neutral";
}

/** Resolve a raw place value to a canonical place_id */
function toPlaceId(v: string): string {
  const t = v.trim();
  if (!t) return "";
  if (t.startsWith("city:") || t.startsWith("archaeology:")) return t;
  return `city:${t}`;
}

// ─── Load source files ────────────────────────────────────────────────────────

const relations   = parseTsv(join(DATA, "relations.tsv"));
const works       = parseTsv(join(DATA, "works.tsv"));
const events      = parseTsv(join(DATA, "events.tsv"));
const archaeology = parseTsv(join(DATA, "archaeology.tsv"));
const quotes      = parseTsv(join(DATA, "quotes.tsv"));
const placeStates = parseTsv(join(DATA, "place_state_by_decade.tsv"));

// ─── Output accumulation ─────────────────────────────────────────────────────

interface FootprintRow {
  entity_type: string;
  entity_id:   string;
  place_id:    string;
  year_start:  string;
  year_end:    string;
  weight:      string;
  reason:      string;
  stance:      string;
}

const seen      = new Set<string>();
const footprints: FootprintRow[] = [];

function add(f: FootprintRow): void {
  if (!f.entity_type || !f.entity_id || !f.place_id) return;
  const key = [f.entity_type, f.entity_id, f.place_id, f.year_start, f.year_end, f.reason, f.stance].join("|");
  if (seen.has(key)) return;
  seen.add(key);
  footprints.push(f);
}

// ─── 1. Person → City (via relations) ─────────────────────────────────────────
// Also build an index for use in doctrine→city derivation

const personCityIndex = new Map<string, Array<{ placeId: string; yearStart: string; yearEnd: string }>>();

for (const r of relations) {
  const srcType = r.source_type?.trim();
  const srcId   = r.source_id?.trim();
  const relType = r.relation_type?.trim();
  const tgtType = r.target_type?.trim();
  const tgtId   = r.target_id?.trim();
  const yStart  = r.year_start?.trim() ?? "";
  const yEnd    = r.year_end?.trim() ?? "";
  const weight  = r.weight?.trim() || "3";

  if (!srcId || !tgtId) continue;

  if (srcType === "person" && (tgtType === "city" || tgtType === "place")) {
    const placeId = tgtType === "city" ? `city:${tgtId}` : toPlaceId(tgtId);
    if (!placeId) continue;
    add({ entity_type: "person", entity_id: srcId, place_id: placeId, year_start: yStart, year_end: yEnd, weight, reason: relType, stance: "" });
    if (!personCityIndex.has(srcId)) personCityIndex.set(srcId, []);
    personCityIndex.get(srcId)!.push({ placeId, yearStart: yStart, yearEnd: yEnd });
  }
}

// ─── 2. Work → City (via works columns) ──────────────────────────────────────
// Also build an index for use in doctrine→city derivation

const workCityIndex = new Map<string, Array<{ placeId: string; yearStart: string; yearEnd: string; reason: string }>>();

for (const w of works) {
  const workId = w.work_id?.trim();
  if (!workId) continue;
  const yStart = w.year_written_start?.trim() ?? "";
  const yEnd   = w.year_written_end?.trim() ?? "";

  const writtenRaw = w.place_written_id?.trim();
  if (writtenRaw) {
    const placeId = toPlaceId(writtenRaw);
    add({ entity_type: "work", entity_id: workId, place_id: placeId, year_start: yStart, year_end: yEnd, weight: "5", reason: "written_in", stance: "" });
    if (!workCityIndex.has(workId)) workCityIndex.set(workId, []);
    workCityIndex.get(workId)!.push({ placeId, yearStart: yStart, yearEnd: yEnd, reason: "written_in" });
  }

  for (const rec of splitSemi(w.place_recipient_ids ?? "")) {
    const placeId = toPlaceId(rec);
    if (!placeId) continue;
    add({ entity_type: "work", entity_id: workId, place_id: placeId, year_start: yStart, year_end: yEnd, weight: "4", reason: "sent_to", stance: "" });
    if (!workCityIndex.has(workId)) workCityIndex.set(workId, []);
    workCityIndex.get(workId)!.push({ placeId, yearStart: yStart, yearEnd: yEnd, reason: "sent_to" });
  }
}

// ─── 3. Event → City (via events.primary_place_id) ───────────────────────────

for (const e of events) {
  const eventId  = e.event_id?.trim();
  const rawPlace = e.primary_place_id?.trim();
  if (!eventId || !rawPlace) continue;
  const placeId = toPlaceId(rawPlace);
  add({ entity_type: "event", entity_id: eventId, place_id: placeId, year_start: e.year_start?.trim() ?? "", year_end: e.year_end?.trim() ?? "", weight: "4", reason: "held_in", stance: "" });
}

// ─── 4. Archaeology → Place ───────────────────────────────────────────────────

for (const a of archaeology) {
  const archId = a.archaeology_id?.trim();
  if (!archId) continue;
  add({ entity_type: "archaeology", entity_id: archId, place_id: `archaeology:${archId}`, year_start: a.year_start?.trim() ?? "", year_end: a.year_end?.trim() ?? "", weight: "5", reason: "located_at", stance: "" });
}

// ─── 5. Doctrine → City via work/person relation chains ───────────────────────

interface DoctrineEdge {
  doctrineId: string;
  workId?:    string;
  personId?:  string;
  stance:     string;
  yStart:     string;
  yEnd:       string;
  weight:     string;
}

const doctrineEdges: DoctrineEdge[] = [];

const DOCTRINE_REL_TYPES = new Set(["affirms", "condemns", "develops", "first_mentions"]);

for (const r of relations) {
  const srcType = r.source_type?.trim();
  const srcId   = r.source_id?.trim();
  const relType = r.relation_type?.trim();
  const tgtType = r.target_type?.trim();
  const tgtId   = r.target_id?.trim();
  const polarity = r.polarity?.trim();
  const yStart  = r.year_start?.trim() ?? "";
  const yEnd    = r.year_end?.trim() ?? "";
  const weight  = r.weight?.trim() || "3";

  if (!srcId || !tgtId || tgtType !== "doctrine") continue;
  if (!DOCTRINE_REL_TYPES.has(relType)) continue;

  const stance = polarity ? toStance(polarity) : toStance(relType);

  if (srcType === "work") {
    doctrineEdges.push({ doctrineId: tgtId, workId: srcId, stance, yStart, yEnd, weight });
  } else if (srcType === "person") {
    doctrineEdges.push({ doctrineId: tgtId, personId: srcId, stance, yStart, yEnd, weight });
  }
}

// Also collect doctrine edges from quotes.tsv
for (const q of quotes) {
  const workId     = q.work_id?.trim();
  const doctrineId = q.doctrine_id?.trim();
  if (!workId || !doctrineId) continue;
  const stance = toStance(q.stance?.trim() ?? "");
  const year   = q.year?.trim() ?? "";
  doctrineEdges.push({ doctrineId, workId, stance, yStart: year, yEnd: "", weight: "3" });
}

// Resolve each doctrine edge → place footprints
for (const edge of doctrineEdges) {
  if (edge.workId) {
    // Chains A–D: doctrine ← work → place
    const workPlaces = workCityIndex.get(edge.workId) ?? [];
    for (const wp of workPlaces) {
      const reason = `via_work_${edge.stance === "condemns" ? "condemns" : "affirms"}`;
      add({
        entity_type: "doctrine",
        entity_id:   edge.doctrineId,
        place_id:    wp.placeId,
        year_start:  wp.yearStart || edge.yStart,
        year_end:    wp.yearEnd   || edge.yEnd,
        weight:      edge.weight,
        reason,
        stance:      edge.stance,
      });
    }
  }

  if (edge.personId) {
    // Chains E–F: doctrine ← person → city
    const personPlaces = personCityIndex.get(edge.personId) ?? [];
    for (const pp of personPlaces) {
      const reason = `via_person_${edge.stance === "condemns" ? "condemns" : "affirms"}`;
      add({
        entity_type: "doctrine",
        entity_id:   edge.doctrineId,
        place_id:    pp.placeId,
        year_start:  pp.yearStart || edge.yStart,
        year_end:    pp.yearEnd   || edge.yEnd,
        weight:      edge.weight,
        reason,
        stance:      edge.stance,
      });
    }
  }
}

// ─── 6. Persuasion → City (via place_state_by_decade.persuasion_ids) ──────────

// Group decade numbers by persuasion+place key, then emit contiguous runs
const persuasionDecades = new Map<string, number[]>();

for (const row of placeStates) {
  const placeId   = row.place_id?.trim();
  const decadeStr = row.decade?.trim();
  if (!placeId || !decadeStr) continue;
  const decade = Number.parseInt(decadeStr, 10);
  if (Number.isNaN(decade)) continue;

  for (const slug of splitSemi(row.persuasion_ids ?? "")) {
    const key = `${slug}||${placeId}`;
    if (!persuasionDecades.has(key)) persuasionDecades.set(key, []);
    persuasionDecades.get(key)!.push(decade);
  }
}

for (const [key, decades] of persuasionDecades.entries()) {
  const [slug, placeId] = key.split("||");
  if (!slug || !placeId) continue;
  const sorted = [...new Set(decades)].sort((a, b) => a - b);
  if (sorted.length === 0) continue;

  // Merge contiguous 10-year runs into single footprint spans
  let runStart = sorted[0]!;
  let prev     = sorted[0]!;

  for (let i = 1; i <= sorted.length; i++) {
    const d = sorted[i];
    if (d === prev + 10) { prev = d; continue; }
    add({ entity_type: "persuasion", entity_id: slug, place_id: placeId, year_start: String(runStart), year_end: String(prev + 9), weight: "3", reason: "presence", stance: "" });
    if (d !== undefined) { runStart = d; prev = d; }
  }
}

// ─── Sort and write ───────────────────────────────────────────────────────────

footprints.sort((a, b) =>
  a.entity_type.localeCompare(b.entity_type) ||
  a.entity_id.localeCompare(b.entity_id) ||
  a.place_id.localeCompare(b.place_id) ||
  a.year_start.localeCompare(b.year_start),
);

const HEADERS = ["entity_type", "entity_id", "place_id", "year_start", "year_end", "weight", "reason", "stance"];
const lines   = [
  HEADERS.join("\t"),
  ...footprints.map((f) => HEADERS.map((h) => f[h as keyof FootprintRow]).join("\t")),
];

writeFileSync(join(DATA, "entity_place_footprints.tsv"), lines.join("\n") + "\n", "utf-8");
console.log(`entity_place_footprints.tsv derived: ${footprints.length} footprints`);

const doctrineCount = footprints.filter((f) => f.entity_type === "doctrine").length;
console.log(`  doctrine footprints: ${doctrineCount} (${footprints.filter((f) => f.entity_type === "doctrine" && f.stance === "affirms").length} affirms, ${footprints.filter((f) => f.entity_type === "doctrine" && f.stance === "condemns").length} condemns)`);
