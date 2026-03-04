import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Severity = "error" | "warn";

interface Issue {
  severity: Severity;
  file: string;
  line: number;
  message: string;
}

type TsvRow = Record<string, string>;

interface ParsedTsv {
  headers: string[];
  rows: TsvRow[];
}

function parseIntOrNull(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function splitSemi(value: string): string[] {
  return value
    .split(";")
    .map((part) => part.trim())
    .map((part) => (part.toLowerCase() === "null" ? "" : part))
    .filter((part) => part.length > 0);
}

function emptyIfNullToken(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.toLowerCase() === "null") return "";
  return v;
}

function stripPlacePrefix(value: string): string {
  const v = emptyIfNullToken(value);
  if (!v) return "";
  if (v.startsWith("city:")) return v.slice(5);
  if (v.startsWith("archaeology:")) return v.slice(12);
  return v;
}

function parseBracketMentions(bodyMd: string): Array<{ type: string; slug: string }> {
  const out: Array<{ type: string; slug: string }> = [];
  const re = /\[\[([a-z_]+):([^\]]+)\]\]/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(bodyMd)) !== null) {
    const type = (match[1] ?? "").trim();
    const slug = (match[2] ?? "").trim();
    if (!type || !slug) continue;
    out.push({ type, slug });
  }
  return out;
}

function validateHeaders(actual: string[], expected: string[], file: string, issues: Issue[]): void {
  if (actual.length !== expected.length) {
    issues.push({
      severity: "error",
      file,
      line: 1,
      message: `Header column count mismatch: expected ${expected.length} got ${actual.length}`,
    });
    return;
  }

  for (let i = 0; i < expected.length; i += 1) {
    if (actual[i] !== expected[i]) {
      issues.push({
        severity: "error",
        file,
        line: 1,
        message: `Header mismatch at col ${i + 1}: expected "${expected[i]}" got "${actual[i]}"`,
      });
    }
  }
}

function parseTsvContent(content: string, file: string, issues: Issue[]): ParsedTsv {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.length > 0);

  if (lines.length < 1) {
    issues.push({ severity: "error", file, line: 1, message: "TSV is empty" });
    return { headers: [], rows: [] };
  }

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

    for (const [key, value] of Object.entries(row)) {
      if (value.trim().toLowerCase() === "null") {
        issues.push({
          severity: "warn",
          file,
          line: i + 1,
          message: `Literal "null" token found in column "${key}"; prefer blank`,
        });
      }
    }
  }

  return { headers, rows };
}

async function readTsv(path: string, issues: Issue[]): Promise<ParsedTsv> {
  try {
    const content = await readFile(path, "utf8");
    return parseTsvContent(content, path, issues);
  } catch {
    issues.push({ severity: "error", file: path, line: 0, message: `File not found or unreadable` });
    return { headers: [], rows: [] };
  }
}

function ensureUnique(values: string[], file: string, idLabel: string, issues: Issue[]): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (!v) continue;
    if (set.has(v)) {
      issues.push({ severity: "error", file, line: i + 2, message: `Duplicate ${idLabel}: ${v}` });
      continue;
    }
    set.add(v);
  }
  return set;
}

function requireFk(params: {
  issues: Issue[];
  file: string;
  line: number;
  field: string;
  rawValue: string;
  fkSet: Set<string>;
  allowEmpty?: boolean;
}): void {
  const raw = params.rawValue ?? "";
  const value = raw.trim();
  const allowEmpty = params.allowEmpty ?? true;

  if (!value) {
    if (!allowEmpty) {
      params.issues.push({
        severity: "error",
        file: params.file,
        line: params.line,
        message: `Missing required FK in ${params.field}`,
      });
    }
    return;
  }

  if (!params.fkSet.has(value)) {
    params.issues.push({
      severity: "error",
      file: params.file,
      line: params.line,
      message: `Broken FK ${params.field} -> ${value}`,
    });
  }
}

function validateIntField(params: {
  issues: Issue[];
  file: string;
  line: number;
  field: string;
  rawValue: string;
  allowEmpty?: boolean;
}): number | null {
  const allowEmpty = params.allowEmpty ?? true;
  const raw = emptyIfNullToken(params.rawValue ?? "");
  if (!raw) {
    if (!allowEmpty) {
      params.issues.push({
        severity: "error",
        file: params.file,
        line: params.line,
        message: `Missing required int in ${params.field}`,
      });
    }
    return null;
  }
  const n = parseIntOrNull(raw);
  if (n === null) {
    params.issues.push({
      severity: "error",
      file: params.file,
      line: params.line,
      message: `Invalid int in ${params.field}: ${raw}`,
    });
  }
  return n;
}

function validateEnum(params: {
  issues: Issue[];
  file: string;
  line: number;
  field: string;
  value: string;
  allowed: string[];
  allowEmpty?: boolean;
}): void {
  const allowEmpty = params.allowEmpty ?? true;
  const v = emptyIfNullToken(params.value ?? "");
  if (!v) {
    if (!allowEmpty) {
      params.issues.push({
        severity: "error",
        file: params.file,
        line: params.line,
        message: `Missing required enum in ${params.field}`,
      });
    }
    return;
  }
  if (!params.allowed.includes(v)) {
    params.issues.push({
      severity: "error",
      file: params.file,
      line: params.line,
      message: `Invalid ${params.field}: ${v}`,
    });
  }
}

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const ROOT = resolve(__dirname, "..");
  const FINAL_DATA_DIR = resolve(ROOT, "data", "final_data");

  const issues: Issue[] = [];

  const expectedHeaders: Record<string, string[]> = {
    "data/final_data/cities.tsv": [
      "city_id",
      "city_label",
      "city_ancient_primary",
      "city_modern_primary",
      "country_modern_primary",
      "lat",
      "lon",
      "location_precision",
      "christianity_start_year",
    ],
    "data/final_data/persuasions.tsv": [
      "persuasion_id",
      "persuasion_label",
      "persuasion_stream",
      "year_start",
      "year_end",
      "description",
      "wikipedia_url",
      "citations",
      "notes",
    ],
    "data/final_data/people.tsv": [
      "person_id",
      "person_label",
      "name_alt",
      "birth_year",
      "death_year",
      "death_type",
      "roles",
      "city_of_origin_id",
      "apostolic_connection",
      "description",
      "wikipedia_url",
      "citations",
      "notes",
    ],
    "data/final_data/polities.tsv": [
      "polity_id",
      "polity_label",
      "name_alt",
      "year_start",
      "year_end",
      "capital",
      "region",
      "description",
      "wikipedia_url",
      "citations",
    ],
    "data/final_data/notes.tsv": [
      "year_bucket",
      "year_exact",
      "primary_entity_type",
      "primary_entity_id",
      "note_kind",
      "body_md",
      "citation_urls",
      "note_id",
    ],
    "data/final_data/note_mentions.tsv": ["note_id", "mentioned_type", "mentioned_slug"],
    "data/final_data/places.tsv": [
      "place_id",
      "place_type",
      "place_label",
      "lat",
      "lon",
      "location_precision",
      "city_id",
      "archaeology_id",
    ],
    "data/final_data/relations.tsv": [
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
    ],
    "data/final_data/place_state_by_decade.tsv": [
      "place_id",
      "decade",
      "presence_status",
      "persuasion_ids",
      "polity_id",
      "ruling_subdivision",
      "church_planted_year_scholarly",
      "church_planted_year_earliest_claim",
      "church_planted_by",
      "apostolic_origin_thread",
      "council_context",
      "evidence_note_id",
    ],
    "data/final_data/entity_place_footprints.tsv": [
      "entity_type",
      "entity_id",
      "place_id",
      "year_start",
      "year_end",
      "weight",
      "reason",
    ],
    "data/final_data/mappings/city_keys.tsv": [
      "raw_city_ancient",
      "raw_country_modern",
      "raw_city_modern",
      "canonical_city_slug",
      "canonical_city_label",
      "notes",
    ],
    "data/final_data/mappings/city_aliases.tsv": ["alias", "canonical_city_slug", "alias_kind"],
    "data/final_data/mappings/persuasion_tokens.tsv": [
      "raw_persuasion_token",
      "canonical_persuasion_slugs",
      "canonical_persuasion_label",
      "notes",
    ],
    "data/final_data/mappings/person_tokens.tsv": [
      "raw_person_token",
      "canonical_person_slug",
      "canonical_person_label",
      "disambiguation_note",
    ],
    "data/final_data/mappings/polity_tokens.tsv": [
      "raw_polity_token",
      "canonical_polity_slug",
      "canonical_polity_label",
    ],
    "data/final_data/works.tsv": [
      "work_id",
      "title_display",
      "author_person_id",
      "author_name_display",
      "year_written_start",
      "year_written_end",
      "work_type",
      "language",
      "place_written_id",
      "place_recipient_ids",
      "description",
      "significance",
      "modern_edition_url",
      "citations",
    ],
    "data/final_data/events.tsv": [
      "event_id",
      "name_display",
      "event_type",
      "year_start",
      "year_end",
      "primary_place_id",
      "region",
      "key_figure_person_ids",
      "description",
      "significance",
      "outcome",
      "citations",
    ],
    "data/final_data/doctrines.tsv": [
      "doctrine_id",
      "name_display",
      "category",
      "description",
      "first_attested_year",
      "first_attested_work_id",
      "controversy_level",
      "resolution",
      "citations",
    ],
    "data/final_data/quotes.tsv": [
      "quote_id",
      "doctrine_id",
      "work_id",
      "text",
      "work_reference",
      "year",
      "stance",
      "notes",
      "citations",
    ],
    "data/final_data/archaeology.tsv": [
      "archaeology_id",
      "name_display",
      "site_type",
      "city_id",
      "lat",
      "lon",
      "location_precision",
      "year_start",
      "year_end",
      "description",
      "significance",
      "discovery_notes",
      "current_status",
      "uncertainty",
      "citations",
    ],
    "data/final_data/mappings/mapping_coverage_issues.tsv": ["issue_kind", "raw_value", "row_mentions"],
  };

  const paths = Object.keys(expectedHeaders).map((p) => resolve(ROOT, p));
  const parsedByPath = new Map<string, ParsedTsv>();

  for (const absPath of paths) {
    const relKey = absPath.replace(`${ROOT}/`, "");
    const parsed = await readTsv(absPath, issues);
    parsedByPath.set(relKey, parsed);

    const expected = expectedHeaders[relKey];
    if (expected) validateHeaders(parsed.headers, expected, relKey, issues);
  }

  const cities = parsedByPath.get("data/final_data/cities.tsv")?.rows ?? [];
  const persuasions = parsedByPath.get("data/final_data/persuasions.tsv")?.rows ?? [];
  const people = parsedByPath.get("data/final_data/people.tsv")?.rows ?? [];
  const polities = parsedByPath.get("data/final_data/polities.tsv")?.rows ?? [];
  const works = parsedByPath.get("data/final_data/works.tsv")?.rows ?? [];
  const events = parsedByPath.get("data/final_data/events.tsv")?.rows ?? [];
  const doctrines = parsedByPath.get("data/final_data/doctrines.tsv")?.rows ?? [];
  const quotes = parsedByPath.get("data/final_data/quotes.tsv")?.rows ?? [];
  const archaeology = parsedByPath.get("data/final_data/archaeology.tsv")?.rows ?? [];
  const notes = parsedByPath.get("data/final_data/notes.tsv")?.rows ?? [];
  const noteMentions = parsedByPath.get("data/final_data/note_mentions.tsv")?.rows ?? [];
  const places = parsedByPath.get("data/final_data/places.tsv")?.rows ?? [];
  const relations = parsedByPath.get("data/final_data/relations.tsv")?.rows ?? [];
  const placeState = parsedByPath.get("data/final_data/place_state_by_decade.tsv")?.rows ?? [];
  const footprints = parsedByPath.get("data/final_data/entity_place_footprints.tsv")?.rows ?? [];
  const mappingCityKeys = parsedByPath.get("data/final_data/mappings/city_keys.tsv")?.rows ?? [];
  const mappingCityAliases = parsedByPath.get("data/final_data/mappings/city_aliases.tsv")?.rows ?? [];
  const mappingPersuasionTokens = parsedByPath.get("data/final_data/mappings/persuasion_tokens.tsv")?.rows ?? [];
  const mappingPersonTokens = parsedByPath.get("data/final_data/mappings/person_tokens.tsv")?.rows ?? [];
  const mappingPolityTokens = parsedByPath.get("data/final_data/mappings/polity_tokens.tsv")?.rows ?? [];
  const mappingCoverageIssues = parsedByPath.get("data/final_data/mappings/mapping_coverage_issues.tsv")?.rows ?? [];

  if (mappingCoverageIssues.length > 0) {
    issues.push({
      severity: "warn",
      file: "data/final_data/mappings/mapping_coverage_issues.tsv",
      line: 2,
      message: `${mappingCoverageIssues.length} unmapped token(s) found`,
    });
  }

  const cityIds = ensureUnique(
    cities.map((r) => r.city_id ?? ""),
    "data/final_data/cities.tsv",
    "city_id",
    issues,
  );

  const cityPlaceIds = new Set<string>();
  for (const r of places) {
    if ((r.place_type ?? "").trim() !== "city") continue;
    const id = emptyIfNullToken(r.city_id ?? "");
    if (id) cityPlaceIds.add(id);
  }
  for (const id of cityIds) cityPlaceIds.add(id);

  const persuasionIds = ensureUnique(
    persuasions.map((r) => r.persuasion_id ?? ""),
    "data/final_data/persuasions.tsv",
    "persuasion_id",
    issues,
  );

  const personIds = ensureUnique(
    people.map((r) => r.person_id ?? ""),
    "data/final_data/people.tsv",
    "person_id",
    issues,
  );

  const polityIds = ensureUnique(
    polities.map((r) => r.polity_id ?? ""),
    "data/final_data/polities.tsv",
    "polity_id",
    issues,
  );

  const workIds = ensureUnique(works.map((r) => r.work_id ?? ""), "data/final_data/works.tsv", "work_id", issues);
  const eventIds = ensureUnique(events.map((r) => r.event_id ?? ""), "data/final_data/events.tsv", "event_id", issues);
  const doctrineIds = ensureUnique(doctrines.map((r) => r.doctrine_id ?? ""), "data/final_data/doctrines.tsv", "doctrine_id", issues);
  const quoteIds = ensureUnique(quotes.map((r) => r.quote_id ?? ""), "data/final_data/quotes.tsv", "quote_id", issues);
  const archaeologyIds = ensureUnique(
    archaeology.map((r) => r.archaeology_id ?? ""),
    "data/final_data/archaeology.tsv",
    "archaeology_id",
    issues,
  );

  const placeIds = ensureUnique(
    places.map((r) => r.place_id ?? ""),
    "data/final_data/places.tsv",
    "place_id",
    issues,
  );

  const noteIds = ensureUnique(
    notes.map((r) => r.note_id ?? ""),
    "data/final_data/notes.tsv",
    "note_id",
    issues,
  );

  const relationIds = ensureUnique(
    relations.map((r) => r.relation_id ?? ""),
    "data/final_data/relations.tsv",
    "relation_id",
    issues,
  );

  const presenceAllowed = ["attested", "probable", "claimed_tradition", "not_attested", "suppressed", "unknown"];
  const placeTypeAllowed = ["city", "archaeology"];
  const relationNodeTypeAllowed = ["place", "city", "person", "work", "doctrine", "event", "archaeology", "persuasion", "polity", "note"];
  const relationPolarityAllowed = ["supports", "opposes", "neutral"];
  const relationCertaintyAllowed = ["attested", "probable", "claimed_tradition", "legendary", "unknown"];
  const entityTypeAllowed = ["person", "event", "work", "doctrine", "city", "archaeology", "persuasion", "polity"];
  const mentionTypeAllowed = ["person", "event", "work", "doctrine", "city", "archaeology", "persuasion", "polity"];

  function fkSetForType(t: string): Set<string> {
    if (t === "place") return placeIds;
    if (t === "city") return cityIds;
    if (t === "person") return personIds;
    if (t === "work") return workIds;
    if (t === "doctrine") return doctrineIds;
    if (t === "event") return eventIds;
    if (t === "archaeology") return archaeologyIds;
    if (t === "persuasion") return persuasionIds;
    if (t === "polity") return polityIds;
    if (t === "note") return noteIds;
    return new Set<string>();
  }

  function requirePlaceFk(params: { file: string; line: number; field: string; rawValue: string; allowEmpty?: boolean }): void {
    const allowEmpty = params.allowEmpty ?? true;
    const v = emptyIfNullToken(params.rawValue ?? "");
    if (!v) {
      if (!allowEmpty) {
        issues.push({ severity: "error", file: params.file, line: params.line, message: `Missing required FK in ${params.field}` });
      }
      return;
    }
    if (!placeIds.has(v)) {
      const cityId = stripPlacePrefix(v);
      if (cityId && cityPlaceIds.has(cityId)) return;
      issues.push({ severity: "error", file: params.file, line: params.line, message: `Broken FK ${params.field} -> ${v}` });
    }
  }

  // --- works.tsv ---
  for (let i = 0; i < works.length; i += 1) {
    const r = works[i];
    const line = i + 2;
    const file = "data/final_data/works.tsv";

    const author = emptyIfNullToken(r.author_person_id ?? "");
    if (author) {
      requireFk({ issues, file, line, field: "author_person_id", rawValue: author, fkSet: personIds });
    }

    const rawWritten = emptyIfNullToken(r.place_written_id ?? "");
    if (rawWritten) requirePlaceFk({ file, line, field: "place_written_id", rawValue: rawWritten });

    for (const rec of splitSemi(r.place_recipient_ids ?? "")) {
      requirePlaceFk({ file, line, field: "place_recipient_ids", rawValue: rec });
    }

    const start = validateIntField({ issues, file, line, field: "year_written_start", rawValue: r.year_written_start ?? "", allowEmpty: false });
    const end = validateIntField({ issues, file, line, field: "year_written_end", rawValue: r.year_written_end ?? "", allowEmpty: false });
    if (start !== null && end !== null && end < start) {
      issues.push({ severity: "error", file, line, message: `year_written_end < year_written_start (${end} < ${start})` });
    }
  }

  // --- events.tsv ---
  for (let i = 0; i < events.length; i += 1) {
    const r = events[i];
    const line = i + 2;
    const file = "data/final_data/events.tsv";

    const rawPlace = emptyIfNullToken(r.primary_place_id ?? "");
    if (rawPlace) requirePlaceFk({ file, line, field: "primary_place_id", rawValue: rawPlace });

    for (const kf of splitSemi(r.key_figure_person_ids ?? "")) {
      requireFk({ issues, file, line, field: "key_figure_person_ids", rawValue: kf, fkSet: personIds });
    }

    const start = validateIntField({ issues, file, line, field: "year_start", rawValue: r.year_start ?? "", allowEmpty: false });
    const end = validateIntField({ issues, file, line, field: "year_end", rawValue: r.year_end ?? "" });
    if (start !== null && end !== null && end < start) {
      issues.push({ severity: "error", file, line, message: `year_end < year_start (${end} < ${start})` });
    }
  }

  // --- doctrines.tsv ---
  for (let i = 0; i < doctrines.length; i += 1) {
    const r = doctrines[i];
    const line = i + 2;
    const file = "data/final_data/doctrines.tsv";

    const workId = emptyIfNullToken(r.first_attested_work_id ?? "");
    if (workId) {
      requireFk({ issues, file, line, field: "first_attested_work_id", rawValue: workId, fkSet: workIds });
    }

    validateIntField({ issues, file, line, field: "first_attested_year", rawValue: r.first_attested_year ?? "" });
  }

  // --- quotes.tsv ---
  for (let i = 0; i < quotes.length; i += 1) {
    const r = quotes[i];
    const line = i + 2;
    const file = "data/final_data/quotes.tsv";

    requireFk({ issues, file, line, field: "doctrine_id", rawValue: r.doctrine_id ?? "", fkSet: doctrineIds, allowEmpty: false });

    const workId = emptyIfNullToken(r.work_id ?? "");
    if (workId) {
      requireFk({ issues, file, line, field: "work_id", rawValue: workId, fkSet: workIds });
    }

    validateIntField({ issues, file, line, field: "year", rawValue: r.year ?? "" });
  }

  // --- archaeology.tsv ---
  for (let i = 0; i < archaeology.length; i += 1) {
    const r = archaeology[i];
    const line = i + 2;
    const file = "data/final_data/archaeology.tsv";

    const cityId = emptyIfNullToken(r.city_id ?? "");
    if (cityId) {
      requireFk({ issues, file, line, field: "city_id", rawValue: cityId, fkSet: cityIds });
    }

    const start = validateIntField({ issues, file, line, field: "year_start", rawValue: r.year_start ?? "" });
    const end = validateIntField({ issues, file, line, field: "year_end", rawValue: r.year_end ?? "" });
    if (start !== null && end !== null && end < start) {
      issues.push({ severity: "error", file, line, message: `year_end < year_start (${end} < ${start})` });
    }
  }

  // --- notes.tsv ---
  for (let i = 0; i < notes.length; i += 1) {
    const r = notes[i];
    const line = i + 2;
    const file = "data/final_data/notes.tsv";

    const primaryType = emptyIfNullToken(r.primary_entity_type ?? "");
    const primaryId = emptyIfNullToken(r.primary_entity_id ?? "");

    if (!primaryType) {
      issues.push({ severity: "error", file, line, message: "Missing primary_entity_type" });
    }
    if (!primaryId) {
      issues.push({ severity: "error", file, line, message: "Missing primary_entity_id" });
    }

    if (primaryType && primaryId) {
      if (!mentionTypeAllowed.includes(primaryType)) {
        issues.push({ severity: "error", file, line, message: `Unknown primary_entity_type: ${primaryType}` });
      } else {
        requireFk({ issues, file, line, field: "primary_entity_id", rawValue: primaryId, fkSet: fkSetForType(primaryType), allowEmpty: false });
      }
    }

    const body = r.body_md ?? "";
    for (const mention of parseBracketMentions(body)) {
      if (!mentionTypeAllowed.includes(mention.type)) {
        issues.push({ severity: "error", file, line, message: `Unknown mention type: ${mention.type}` });
        continue;
      }
      requireFk({ issues, file, line, field: `mention[[${mention.type}]]`, rawValue: mention.slug, fkSet: fkSetForType(mention.type) });
    }
  }

  // --- note_mentions.tsv ---
  for (let i = 0; i < noteMentions.length; i += 1) {
    const r = noteMentions[i];
    const line = i + 2;
    const file = "data/final_data/note_mentions.tsv";

    requireFk({ issues, file, line, field: "note_id", rawValue: r.note_id ?? "", fkSet: noteIds, allowEmpty: false });

    const mType = emptyIfNullToken(r.mentioned_type ?? "");
    const mSlug = emptyIfNullToken(r.mentioned_slug ?? "");

    validateEnum({ issues, file, line, field: "mentioned_type", value: mType, allowed: mentionTypeAllowed, allowEmpty: false });

    if (mType && mSlug) {
      requireFk({ issues, file, line, field: "mentioned_slug", rawValue: mSlug, fkSet: fkSetForType(mType) });
    }
  }

  // --- places.tsv ---
  for (let i = 0; i < places.length; i += 1) {
    const r = places[i];
    const line = i + 2;
    const file = "data/final_data/places.tsv";

    const placeType = emptyIfNullToken(r.place_type ?? "");
    validateEnum({ issues, file, line, field: "place_type", value: placeType, allowed: placeTypeAllowed, allowEmpty: false });

    const placeId = emptyIfNullToken(r.place_id ?? "");
    if (!placeId) {
      issues.push({ severity: "error", file, line, message: "Missing place_id" });
    }

    const cityId = emptyIfNullToken(r.city_id ?? "");
    const archId = emptyIfNullToken(r.archaeology_id ?? "");

    if (placeType === "city") {
      if (!cityId) {
        issues.push({ severity: "error", file, line, message: "City place missing city_id" });
      } else if (!cityIds.has(cityId)) {
        issues.push({ severity: "warn", file, line, message: `City place uses stub id not in cities.tsv: ${cityId}` });
      }
      if (archId) {
        issues.push({ severity: "error", file, line, message: "City place should not set archaeology_id" });
      }
    }

    if (placeType === "archaeology") {
      requireFk({ issues, file, line, field: "archaeology_id", rawValue: archId, fkSet: archaeologyIds, allowEmpty: false });
      if (cityId) {
        requireFk({ issues, file, line, field: "city_id", rawValue: cityId, fkSet: cityIds });
      }
    }
  }

  // --- relations.tsv ---
  for (let i = 0; i < relations.length; i += 1) {
    const r = relations[i];
    const line = i + 2;
    const file = "data/final_data/relations.tsv";

    const relId = emptyIfNullToken(r.relation_id ?? "");
    if (!relId) {
      issues.push({ severity: "error", file, line, message: "Missing relation_id" });
    }

    const srcType = emptyIfNullToken(r.source_type ?? "");
    const srcId = emptyIfNullToken(r.source_id ?? "");
    const relType = emptyIfNullToken(r.relation_type ?? "");
    const tgtType = emptyIfNullToken(r.target_type ?? "");
    const tgtId = emptyIfNullToken(r.target_id ?? "");

    validateEnum({ issues, file, line, field: "source_type", value: srcType, allowed: relationNodeTypeAllowed, allowEmpty: false });
    validateEnum({ issues, file, line, field: "target_type", value: tgtType, allowed: relationNodeTypeAllowed, allowEmpty: false });

    if (!srcId) issues.push({ severity: "error", file, line, message: "Missing source_id" });
    if (!relType) issues.push({ severity: "error", file, line, message: "Missing relation_type" });
    if (!tgtId) issues.push({ severity: "error", file, line, message: "Missing target_id" });

    const yearStart = validateIntField({ issues, file, line, field: "year_start", rawValue: r.year_start ?? "" });
    const yearEnd = validateIntField({ issues, file, line, field: "year_end", rawValue: r.year_end ?? "" });
    if (yearStart !== null && yearEnd !== null && yearEnd < yearStart) {
      issues.push({ severity: "error", file, line, message: `year_end < year_start (${yearEnd} < ${yearStart})` });
    }

    validateIntField({ issues, file, line, field: "weight", rawValue: r.weight ?? "" });
    validateEnum({ issues, file, line, field: "polarity", value: emptyIfNullToken(r.polarity ?? ""), allowed: relationPolarityAllowed, allowEmpty: true });
    validateEnum({ issues, file, line, field: "certainty", value: emptyIfNullToken(r.certainty ?? ""), allowed: relationCertaintyAllowed, allowEmpty: true });

    const evidenceNote = emptyIfNullToken(r.evidence_note_id ?? "");
    if (evidenceNote) {
      requireFk({ issues, file, line, field: "evidence_note_id", rawValue: evidenceNote, fkSet: noteIds });
    }

    if (srcType && srcId) {
      requireFk({ issues, file, line, field: "source_id", rawValue: srcId, fkSet: fkSetForType(srcType), allowEmpty: false });
    }

    if (tgtType && tgtId) {
      requireFk({ issues, file, line, field: "target_id", rawValue: tgtId, fkSet: fkSetForType(tgtType), allowEmpty: false });
    }
  }

  // --- mapping checks ---
  for (let i = 0; i < mappingCityKeys.length; i += 1) {
    const r = mappingCityKeys[i];
    const line = i + 2;
    const slug = emptyIfNullToken(r.canonical_city_slug ?? "");
    if (slug && !cityIds.has(slug)) {
      issues.push({ severity: "error", file: "data/final_data/mappings/city_keys.tsv", line, message: `canonical_city_slug not in cities.tsv: ${slug}` });
    }
  }

  for (let i = 0; i < mappingCityAliases.length; i += 1) {
    const r = mappingCityAliases[i];
    const line = i + 2;
    const slug = emptyIfNullToken(r.canonical_city_slug ?? "");
    if (slug && !cityIds.has(slug)) {
      issues.push({ severity: "error", file: "data/final_data/mappings/city_aliases.tsv", line, message: `canonical_city_slug not in cities.tsv: ${slug}` });
    }
  }

  for (let i = 0; i < mappingPersuasionTokens.length; i += 1) {
    const r = mappingPersuasionTokens[i];
    const line = i + 2;
    for (const slug of splitSemi(r.canonical_persuasion_slugs ?? "")) {
      if (!persuasionIds.has(slug)) {
        issues.push({ severity: "error", file: "data/final_data/mappings/persuasion_tokens.tsv", line, message: `canonical_persuasion_slug not in persuasions.tsv: ${slug}` });
      }
    }
  }

  for (let i = 0; i < mappingPersonTokens.length; i += 1) {
    const r = mappingPersonTokens[i];
    const line = i + 2;
    const slug = emptyIfNullToken(r.canonical_person_slug ?? "");
    if (slug && !personIds.has(slug)) {
      issues.push({ severity: "error", file: "data/final_data/mappings/person_tokens.tsv", line, message: `canonical_person_slug not in people.tsv: ${slug}` });
    }
  }

  for (let i = 0; i < mappingPolityTokens.length; i += 1) {
    const r = mappingPolityTokens[i];
    const line = i + 2;
    const slug = emptyIfNullToken(r.canonical_polity_slug ?? "");
    if (slug && !polityIds.has(slug)) {
      issues.push({ severity: "error", file: "data/final_data/mappings/polity_tokens.tsv", line, message: `canonical_polity_slug not in polities.tsv: ${slug}` });
    }
  }

  // --- place_state_by_decade.tsv ---
  for (let i = 0; i < placeState.length; i += 1) {
    const r = placeState[i];
    const line = i + 2;
    const file = "data/final_data/place_state_by_decade.tsv";

    requireFk({ issues, file, line, field: "place_id", rawValue: r.place_id ?? "", fkSet: placeIds, allowEmpty: false });
    validateIntField({ issues, file, line, field: "decade", rawValue: r.decade ?? "", allowEmpty: false });
    validateEnum({ issues, file, line, field: "presence_status", value: r.presence_status ?? "", allowed: presenceAllowed, allowEmpty: false });

    for (const id of splitSemi(r.persuasion_ids ?? "")) {
      requireFk({ issues, file, line, field: "persuasion_ids", rawValue: id, fkSet: persuasionIds });
    }

    const polityId = emptyIfNullToken(r.polity_id ?? "");
    if (polityId) {
      requireFk({ issues, file, line, field: "polity_id", rawValue: polityId, fkSet: polityIds });
    }

    const ev = emptyIfNullToken(r.evidence_note_id ?? "");
    if (ev) {
      requireFk({ issues, file, line, field: "evidence_note_id", rawValue: ev, fkSet: noteIds });
    }
  }

  // --- entity_place_footprints.tsv ---
  for (let i = 0; i < footprints.length; i += 1) {
    const r = footprints[i];
    const line = i + 2;
    const file = "data/final_data/entity_place_footprints.tsv";

    const entityType = emptyIfNullToken(r.entity_type ?? "");
    validateEnum({ issues, file, line, field: "entity_type", value: entityType, allowed: entityTypeAllowed, allowEmpty: false });

    requireFk({ issues, file, line, field: "place_id", rawValue: r.place_id ?? "", fkSet: placeIds, allowEmpty: false });

    const entityId = emptyIfNullToken(r.entity_id ?? "");
    if (!entityId) {
      issues.push({ severity: "error", file, line, message: "Missing entity_id" });
    }

    const start = validateIntField({ issues, file, line, field: "year_start", rawValue: r.year_start ?? "" });
    const end = validateIntField({ issues, file, line, field: "year_end", rawValue: r.year_end ?? "" });
    if (start !== null && end !== null && end < start) {
      issues.push({ severity: "error", file, line, message: `year_end < year_start (${end} < ${start})` });
    }

    validateIntField({ issues, file, line, field: "weight", rawValue: r.weight ?? "" });

    if (entityType && entityId && fkSetForType(entityType).size > 0 && !fkSetForType(entityType).has(entityId)) {
      issues.push({ severity: "error", file, line, message: `Broken FK entity_id for type ${entityType}: ${entityId}` });
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warns = issues.filter((i) => i.severity === "warn");

  for (const issue of [...errors, ...warns]) {
    const prefix = issue.severity === "error" ? "ERROR" : "WARN";
    const lineStr = issue.line ? `:${issue.line}` : "";
    const stream = issue.severity === "error" ? console.error : console.warn;
    stream(`[${prefix}] ${issue.file}${lineStr} ${issue.message}`);
  }

  if (errors.length > 0) {
    console.error(`\nValidation failed: ${errors.length} error(s), ${warns.length} warning(s)`);
    process.exitCode = 1;
    return;
  }

  console.log(`Validation OK: ${warns.length} warning(s)`);
}

main().catch((error: unknown) => {
  console.error("[validate_data] Failed:", error);
  process.exitCode = 1;
});
