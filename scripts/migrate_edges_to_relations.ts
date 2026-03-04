import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type TsvRow = Record<string, string>;

function tsvSafe(value: string): string {
  return value.replace(/\t/g, " ").replace(/\r?\n/g, "\\n").trim();
}

function emptyIfNullToken(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.toLowerCase() === "null") return "";
  return v;
}

function stripLeadingYearPrefix(value: string): string {
  const v = emptyIfNullToken(value);
  if (!v) return "";
  return v.replace(/^\d{4}-/, "");
}

function parseIntOrBlank(value: string): string {
  const v = emptyIfNullToken(value);
  if (!v) return "";
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? String(n) : "";
}

function parseTsvContent(content: string): { headers: string[]; rows: TsvRow[] } {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split("\t").map((h) => h.trim());
  const rows: TsvRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const raw = lines[i];
    let cols = raw.split("\t");

    if (cols.length > headers.length) {
      cols = [...cols.slice(0, headers.length - 1), cols.slice(headers.length - 1).join("\t")];
    }

    if (cols.length < headers.length) {
      cols = cols.concat(Array.from({ length: headers.length - cols.length }, () => ""));
    }

    const row: TsvRow = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = (cols[j] ?? "").trim();
    }

    if (Object.values(row).every((v) => !v)) continue;
    rows.push(row);
  }

  return { headers, rows };
}

async function readTsv(path: string): Promise<{ headers: string[]; rows: TsvRow[] }> {
  const content = await readFile(path, "utf8");
  return parseTsvContent(content);
}

function scoreCitySlugMatch(tokens: string[], candidate: string): number {
  const candidateTokens = candidate.split("-");
  let score = 0;
  for (const t of tokens) {
    if (!t) continue;
    if (candidateTokens.includes(t)) score += 2;
    else if (candidate.includes(t)) score += 1;
  }
  return score;
}

function canonicalizeCitySlug(raw: string, canonicalCitySlugs: Set<string>): string | null {
  const v = stripLeadingYearPrefix(raw);
  if (!v) return null;
  if (canonicalCitySlugs.has(v)) return v;

  if (v.includes("constantinople") && canonicalCitySlugs.has("byzantium-istanbul")) {
    return "byzantium-istanbul";
  }

  const tokens = v
    .split("-")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return null;

  const primary = tokens[0];
  let candidates: string[] = [];

  for (const slug of canonicalCitySlugs) {
    if (slug === primary || slug.startsWith(`${primary}-`) || slug.includes(`-${primary}-`) || slug.endsWith(`-${primary}`)) {
      candidates.push(slug);
    }
  }

  if (candidates.length === 0) {
    candidates = Array.from(canonicalCitySlugs).filter((slug) => slug.includes(primary));
  }

  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) return null;

  let best: { slug: string; score: number } | null = null;
  let ties = 0;
  for (const c of candidates) {
    const s = scoreCitySlugMatch(tokens, c);
    if (best === null || s > best.score) {
      best = { slug: c, score: s };
      ties = 0;
    } else if (best && s === best.score) {
      ties += 1;
    }
  }

  if (!best || best.score < 2) return null;
  if (ties === 0) return best.slug;

  const preferred = candidates.filter((c) => c.split("-")[0] === primary);
  if (preferred.length === 1) return preferred[0];

  const preferredByPrefix = candidates.filter((c) => c.startsWith(`${primary}-`));
  if (preferredByPrefix.length === 1) return preferredByPrefix[0];

  return null;
}

function stableRelationId(parts: string[]): string {
  return createHash("sha1").update(parts.join("\t"), "utf8").digest("hex").slice(0, 12);
}

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const root = resolve(__dirname, "..");

  const finalDataDir = resolve(root, "data", "final_data");

  const citiesPath = resolve(finalDataDir, "cities.tsv");
  const placesPath = resolve(finalDataDir, "places.tsv");
  const edgesPath = resolve(finalDataDir, "edges.tsv");
  const relationsPath = resolve(finalDataDir, "relations.tsv");
  const worksPath = resolve(finalDataDir, "works.tsv");
  const eventsPath = resolve(finalDataDir, "events.tsv");
  const archaeologyPath = resolve(finalDataDir, "archaeology.tsv");

  const [cities, places, edges, works, events, archaeology] = await Promise.all([
    readTsv(citiesPath),
    readTsv(placesPath),
    readTsv(edgesPath),
    readTsv(worksPath),
    readTsv(eventsPath),
    readTsv(archaeologyPath),
  ]);

  const canonicalCitySlugs = new Set<string>();
  for (const r of cities.rows) {
    const slug = emptyIfNullToken(r.city_slug ?? "");
    if (slug) canonicalCitySlugs.add(slug);
  }

  const citySlugToPlaceId = new Map<string, string>();
  for (const r of places.rows) {
    const placeType = emptyIfNullToken(r.place_type ?? "");
    if (placeType !== "city") continue;
    const slug = emptyIfNullToken(r.city_slug ?? "");
    const placeId = emptyIfNullToken(r.place_id ?? "");
    if (slug && placeId) citySlugToPlaceId.set(slug, placeId);
  }

  function cityTokenToPlaceId(rawCity: string): string | null {
    const citySlug = canonicalizeCitySlug(rawCity, canonicalCitySlugs);
    if (!citySlug) return null;
    return citySlugToPlaceId.get(citySlug) ?? null;
  }

  const relations: Array<Record<string, string>> = [];
  const seen = new Set<string>();
  const dropped: string[] = [];

  function addRelation(params: {
    source_type: string;
    source_id: string;
    relation_type: string;
    target_type: string;
    target_id: string;
    year_start: string;
    year_end: string;
    weight: string;
    polarity: string;
    certainty: string;
    evidence_note_id: string;
    citations: string;
  }): void {
    const parts = [
      params.source_type,
      params.source_id,
      params.relation_type,
      params.target_type,
      params.target_id,
      params.year_start,
      params.year_end,
      params.weight,
      params.polarity,
      params.certainty,
      params.evidence_note_id,
      params.citations,
    ];

    const relation_id = stableRelationId(parts);
    if (seen.has(relation_id)) return;
    seen.add(relation_id);

    relations.push({
      relation_id,
      source_type: params.source_type,
      source_id: params.source_id,
      relation_type: params.relation_type,
      target_type: params.target_type,
      target_id: params.target_id,
      year_start: params.year_start,
      year_end: params.year_end,
      weight: params.weight,
      polarity: params.polarity,
      certainty: params.certainty,
      evidence_note_id: params.evidence_note_id,
      citations: params.citations,
    });
  }

  for (const r of edges.rows) {
    let sourceType = emptyIfNullToken(r.source_type ?? "");
    let sourceId = emptyIfNullToken(r.source_id ?? "");
    const relationType = emptyIfNullToken(r.relationship ?? "");
    let targetType = emptyIfNullToken(r.target_type ?? "");
    let targetId = emptyIfNullToken(r.target_id ?? "");

    if (!sourceType || !sourceId || !relationType || !targetType || !targetId) continue;

    if (sourceType === "city") {
      const placeId = cityTokenToPlaceId(sourceId);
      if (!placeId) {
        dropped.push(`${sourceType}:${sourceId} -> ${targetType}:${targetId}`);
        continue;
      }
      sourceType = "place";
      sourceId = placeId;
    }

    if (targetType === "city") {
      const placeId = cityTokenToPlaceId(targetId);
      if (!placeId) {
        dropped.push(`${sourceType}:${sourceId} -> ${targetType}:${targetId}`);
        continue;
      }
      targetType = "place";
      targetId = placeId;
    }

    addRelation({
      source_type: sourceType,
      source_id: sourceId,
      relation_type: relationType,
      target_type: targetType,
      target_id: targetId,
      year_start: parseIntOrBlank(r.decade_start ?? ""),
      year_end: parseIntOrBlank(r.decade_end ?? ""),
      weight: parseIntOrBlank(r.weight ?? ""),
      polarity: "",
      certainty: "",
      evidence_note_id: "",
      citations: tsvSafe(r.citations ?? ""),
    });
  }

  for (const r of works.rows) {
    const workId = emptyIfNullToken(r.id ?? "");
    if (!workId) continue;
    const yearStart = parseIntOrBlank(r.year_written_earliest ?? "");
    const yearEnd = parseIntOrBlank(r.year_written_latest ?? "");
    const citations = tsvSafe(r.citations ?? "");

    const writtenPlace = cityTokenToPlaceId(r.city_written_id ?? "");
    if (writtenPlace) {
      addRelation({
        source_type: "work",
        source_id: workId,
        relation_type: "written_in",
        target_type: "place",
        target_id: writtenPlace,
        year_start: yearStart,
        year_end: yearEnd,
        weight: "3",
        polarity: "",
        certainty: "",
        evidence_note_id: "",
        citations,
      });
    }

    const recipients = emptyIfNullToken(r.city_recipient_ids ?? "");
    if (recipients) {
      for (const raw of recipients.split(";").map((p) => p.trim()).filter(Boolean)) {
        const place = cityTokenToPlaceId(raw);
        if (!place) continue;
        addRelation({
          source_type: "work",
          source_id: workId,
          relation_type: "sent_to",
          target_type: "place",
          target_id: place,
          year_start: yearStart,
          year_end: yearEnd,
          weight: "2",
          polarity: "",
          certainty: "",
          evidence_note_id: "",
          citations,
        });
      }
    }
  }

  for (const r of events.rows) {
    const eventId = emptyIfNullToken(r.id ?? "");
    if (!eventId) continue;
    const place = cityTokenToPlaceId(r.city_id ?? "");
    if (!place) continue;

    addRelation({
      source_type: "event",
      source_id: eventId,
      relation_type: "held_in",
      target_type: "place",
      target_id: place,
      year_start: parseIntOrBlank(r.year_start ?? ""),
      year_end: parseIntOrBlank(r.year_end ?? ""),
      weight: "3",
      polarity: "",
      certainty: "",
      evidence_note_id: "",
      citations: tsvSafe(r.citations ?? ""),
    });
  }

  for (const r of archaeology.rows) {
    const archId = emptyIfNullToken(r.id ?? "");
    if (!archId) continue;
    const place = cityTokenToPlaceId(r.city_id ?? "");
    if (!place) continue;

    addRelation({
      source_type: "archaeology",
      source_id: archId,
      relation_type: "located_in",
      target_type: "place",
      target_id: place,
      year_start: parseIntOrBlank(r.year_start ?? ""),
      year_end: parseIntOrBlank(r.year_end ?? ""),
      weight: "3",
      polarity: "",
      certainty: "",
      evidence_note_id: "",
      citations: tsvSafe(r.citations ?? ""),
    });
  }

  relations.sort(
    (a, b) =>
      (a.relation_id ?? "").localeCompare(b.relation_id ?? "") ||
      (a.source_type ?? "").localeCompare(b.source_type ?? "") ||
      (a.source_id ?? "").localeCompare(b.source_id ?? ""),
  );

  const headers = [
    "relation_id",
    "source_type",
    "source_id",
    "relation_type",
    "target_type",
    "target_id",
    "year_start",
    "year_end",
    "weight",
    "polarity",
    "certainty",
    "evidence_note_id",
    "citations",
  ];

  const content = [
    headers.join("\t"),
    ...relations.map((rel) => headers.map((h) => tsvSafe(rel[h] ?? "")).join("\t")),
  ].join("\n");

  await writeFile(relationsPath, `${content}\n`, "utf8");
  await writeFile(edgesPath, `${edges.headers.join("\t")}\n`, "utf8");

  const droppedCount = dropped.length;
  const msg = [`Wrote ${relations.length} relations to ${relationsPath}.`, `Cleared legacy edges.tsv rows (${edgesPath}).`, `Dropped ${droppedCount} legacy edges with unresolvable city targets.`];
  await writeFile(resolve(finalDataDir, "relations_migration_report.txt"), `${msg.join("\n")}\n\n${dropped.join("\n")}\n`, "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
