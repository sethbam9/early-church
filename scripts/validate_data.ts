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

function stripLeadingYearPrefix(value: string): string {
  const v = emptyIfNullToken(value);
  if (!v) return "";
  return v.replace(/^\d{4}-/, "");
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

function resolveLegacyCitySlug(params: {
  raw: string;
  canonicalCitySlugs: Set<string>;
  knownCityLikeSlugs: Set<string>;
}): string {
  const v = stripLeadingYearPrefix(params.raw);
  if (!v) return "";
  if (params.canonicalCitySlugs.has(v)) return v;
  if (params.knownCityLikeSlugs.has(v)) return v;

  if (v.includes("constantinople") && params.canonicalCitySlugs.has("byzantium-istanbul")) {
    return "byzantium-istanbul";
  }

  if (v.includes("bethlehem") && params.canonicalCitySlugs.has("bethlehem-bethlehem")) {
    return "bethlehem-bethlehem";
  }

  const tokens = v
    .split("-")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return v;

  const primary = tokens[0];
  const candidates: string[] = [];
  for (const slug of params.canonicalCitySlugs) {
    if (slug === primary || slug.startsWith(`${primary}-`) || slug.includes(`-${primary}-`) || slug.endsWith(`-${primary}`)) {
      candidates.push(slug);
    }
  }

  if (candidates.length === 0) {
    for (const slug of params.canonicalCitySlugs) {
      if (slug.includes(primary)) candidates.push(slug);
    }
  }

  if (candidates.length === 1) return candidates[0];

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

  if (best && best.score >= 2 && ties === 0) return best.slug;

  if (best && ties > 0) {
    const preferred = candidates.filter((c) => c.split("-")[0] === primary);
    if (preferred.length === 1) return preferred[0];

    const preferredByPrefix = candidates.filter((c) => c.startsWith(`${primary}-`));
    if (preferredByPrefix.length === 1) return preferredByPrefix[0];
  }

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
          message: `Literal "null" token found in column "${key}"; prefer blank` ,
        });
      }
    }
  }

  return { headers, rows };
}

async function readTsv(path: string, issues: Issue[]): Promise<ParsedTsv> {
  const content = await readFile(path, "utf8");
  return parseTsvContent(content, path, issues);
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
  transform?: (value: string) => string;
}): void {
  const raw = params.rawValue ?? "";
  const value = params.transform ? params.transform(raw) : raw.trim();
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
      "city_slug",
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
      "persuasion_slug",
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
      "person_slug",
      "person_label",
      "name_alt",
      "birth_year",
      "death_year",
      "death_type",
      "roles",
      "city_of_origin_slug",
      "apostolic_connection",
      "description",
      "wikipedia_url",
      "citations",
      "notes",
    ],
    "data/final_data/polities.tsv": [
      "polity_slug",
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
      "primary_entity_slug",
      "note_kind",
      "state_key",
      "state_value",
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
      "city_slug",
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
      "persuasion_slugs",
      "polity_slug",
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
      "id",
      "title_display",
      "author_id",
      "author_name_display",
      "year_written_earliest",
      "year_written_latest",
      "decade_bucket",
      "work_type",
      "city_written_id",
      "city_recipient_ids",
      "language",
      "description",
      "significance",
      "modern_edition_url",
      "citations",
    ],
    "data/final_data/events.tsv": [
      "id",
      "name_display",
      "event_type",
      "year_start",
      "year_end",
      "decade_bucket",
      "city_id",
      "city_ancient",
      "region",
      "key_figure_ids",
      "description",
      "significance",
      "outcome",
      "citations",
    ],
    "data/final_data/doctrines.tsv": [
      "id",
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
      "id",
      "doctrine_id",
      "text",
      "source_type",
      "author_id",
      "author_name",
      "work_id",
      "work_reference",
      "year",
      "decade_bucket",
      "stance",
      "notes",
      "citations",
    ],
    "data/final_data/archaeology.tsv": [
      "id",
      "name_display",
      "site_type",
      "city_id",
      "city_ancient",
      "lat",
      "lon",
      "location_precision",
      "year_start",
      "year_end",
      "decade_bucket_start",
      "description",
      "significance",
      "discovery_notes",
      "current_status",
      "uncertainty",
      "citations",
    ],
    "data/final_data/edges.tsv": [
      "id",
      "source_type",
      "source_id",
      "relationship",
      "target_type",
      "target_id",
      "decade_start",
      "decade_end",
      "weight",
      "notes",
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
  const edges = parsedByPath.get("data/final_data/edges.tsv")?.rows ?? [];
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
      severity: "error",
      file: "data/final_data/mappings/mapping_coverage_issues.tsv",
      line: 2,
      message: `mapping_coverage_issues.tsv must be empty; found ${mappingCoverageIssues.length} row(s)`,
    });
  }

  const citySlugs = ensureUnique(
    cities.map((r) => r.city_slug ?? ""),
    "data/final_data/cities.tsv",
    "city_slug",
    issues,
  );

  const cityPlaceSlugs = new Set<string>();
  for (const r of places) {
    if ((r.place_type ?? "").trim() !== "city") continue;
    const slug = emptyIfNullToken(r.city_slug ?? "");
    if (slug) cityPlaceSlugs.add(slug);
  }

  for (const slug of citySlugs) {
    cityPlaceSlugs.add(slug);
  }

  const persuasionSlugs = ensureUnique(
    persuasions.map((r) => r.persuasion_slug ?? ""),
    "data/final_data/persuasions.tsv",
    "persuasion_slug",
    issues,
  );

  const personSlugs = ensureUnique(
    people.map((r) => r.person_slug ?? ""),
    "data/final_data/people.tsv",
    "person_slug",
    issues,
  );

  const politySlugs = ensureUnique(
    polities.map((r) => r.polity_slug ?? ""),
    "data/final_data/polities.tsv",
    "polity_slug",
    issues,
  );

  const workIds = ensureUnique(works.map((r) => r.id ?? ""), "data/final_data/works.tsv", "work.id", issues);
  const eventIds = ensureUnique(events.map((r) => r.id ?? ""), "data/final_data/events.tsv", "event.id", issues);
  const doctrineIds = ensureUnique(doctrines.map((r) => r.id ?? ""), "data/final_data/doctrines.tsv", "doctrine.id", issues);
  const quoteIds = ensureUnique(quotes.map((r) => r.id ?? ""), "data/final_data/quotes.tsv", "quote.id", issues);
  const archaeologyIds = ensureUnique(
    archaeology.map((r) => r.id ?? ""),
    "data/final_data/archaeology.tsv",
    "archaeology.id",
    issues,
  );

  const placeIds = ensureUnique(
    places.map((r) => r.place_id ?? ""),
    "data/final_data/places.tsv",
    "place.place_id",
    issues,
  );

  const noteIds = ensureUnique(
    notes.map((r) => r.note_id ?? ""),
    "data/final_data/notes.tsv",
    "note.note_id",
    issues,
  );

  const relationIds = ensureUnique(
    relations.map((r) => r.relation_id ?? ""),
    "data/final_data/relations.tsv",
    "relation_id",
    issues,
  );

  const presenceAllowed = [
    "attested",
    "probable",
    "claimed_tradition",
    "not_attested",
    "suppressed",
    "unknown",
  ];

  const placeTypeAllowed = ["city", "archaeology"];

  const relationNodeTypeAllowed = [
    "place",
    "city",
    "person",
    "work",
    "doctrine",
    "event",
    "archaeology",
    "persuasion",
    "polity",
    "note",
  ];

  const relationPolarityAllowed = ["supports", "opposes", "neutral"];
  const relationCertaintyAllowed = ["attested", "probable", "claimed_tradition", "legendary", "unknown"];

  const entityTypeAllowed = [
    "person",
    "event",
    "work",
    "doctrine",
    "city",
    "archaeology",
    "persuasion",
    "polity",
  ];

  function resolveCitySlug(raw: string): string {
    return resolveLegacyCitySlug({ raw, canonicalCitySlugs: citySlugs, knownCityLikeSlugs: cityPlaceSlugs });
  }

  function requireCityFk(params: { file: string; line: number; field: string; rawValue: string; allowEmpty?: boolean }): void {
    const allowEmpty = params.allowEmpty ?? true;
    const v = emptyIfNullToken(params.rawValue ?? "");
    if (!v) {
      if (!allowEmpty) {
        issues.push({ severity: "error", file: params.file, line: params.line, message: `Missing required FK in ${params.field}` });
      }
      return;
    }

    const resolved = resolveCitySlug(v);
    if (!resolved) return;

    if (!cityPlaceSlugs.has(resolved)) {
      issues.push({ severity: "error", file: params.file, line: params.line, message: `Broken FK ${params.field} -> ${resolved}` });
      return;
    }

    if (!citySlugs.has(resolved)) {
      issues.push({
        severity: "warn",
        file: params.file,
        line: params.line,
        message: `City reference resolves to stub (present in places.tsv but missing from cities.tsv): ${resolved}`,
      });
    }
  }

  const mentionTypeAllowed = [
    "person",
    "event",
    "work",
    "doctrine",
    "city",
    "archaeology",
    "persuasion",
    "polity",
  ];

  for (let i = 0; i < works.length; i += 1) {
    const r = works[i];
    const line = i + 2;

    const author = emptyIfNullToken(r.author_id ?? "");
    if (author) {
      requireFk({
        issues,
        file: "data/final_data/works.tsv",
        line,
        field: "author_id",
        rawValue: author,
        fkSet: personSlugs,
      });
    }

    requireCityFk({ file: "data/final_data/works.tsv", line, field: "city_written_id", rawValue: r.city_written_id ?? "" });

    for (const rec of splitSemi(r.city_recipient_ids ?? "")) {
      requireCityFk({ file: "data/final_data/works.tsv", line, field: "city_recipient_ids", rawValue: rec });
    }

    const earliest = validateIntField({ issues, file: "data/final_data/works.tsv", line, field: "year_written_earliest", rawValue: r.year_written_earliest ?? "", allowEmpty: false });
    const latest = validateIntField({ issues, file: "data/final_data/works.tsv", line, field: "year_written_latest", rawValue: r.year_written_latest ?? "", allowEmpty: false });
    if (earliest !== null && latest !== null && latest < earliest) {
      issues.push({ severity: "error", file: "data/final_data/works.tsv", line, message: `year_written_latest < year_written_earliest (${latest} < ${earliest})` });
    }

    validateIntField({ issues, file: "data/final_data/works.tsv", line, field: "decade_bucket", rawValue: r.decade_bucket ?? "", allowEmpty: false });
  }

  for (let i = 0; i < events.length; i += 1) {
    const r = events[i];
    const line = i + 2;

    requireCityFk({ file: "data/final_data/events.tsv", line, field: "city_id", rawValue: r.city_id ?? "" });

    for (const kf of splitSemi(r.key_figure_ids ?? "")) {
      requireFk({ issues, file: "data/final_data/events.tsv", line, field: "key_figure_ids", rawValue: kf, fkSet: personSlugs });
    }

    const start = validateIntField({ issues, file: "data/final_data/events.tsv", line, field: "year_start", rawValue: r.year_start ?? "", allowEmpty: false });
    const end = validateIntField({ issues, file: "data/final_data/events.tsv", line, field: "year_end", rawValue: r.year_end ?? "" });
    if (start !== null && end !== null && end < start) {
      issues.push({ severity: "error", file: "data/final_data/events.tsv", line, message: `year_end < year_start (${end} < ${start})` });
    }

    validateIntField({ issues, file: "data/final_data/events.tsv", line, field: "decade_bucket", rawValue: r.decade_bucket ?? "", allowEmpty: false });
  }

  for (let i = 0; i < doctrines.length; i += 1) {
    const r = doctrines[i];
    const line = i + 2;

    const workId = emptyIfNullToken(r.first_attested_work_id ?? "");
    if (workId) {
      requireFk({ issues, file: "data/final_data/doctrines.tsv", line, field: "first_attested_work_id", rawValue: workId, fkSet: workIds });
    }

    validateIntField({ issues, file: "data/final_data/doctrines.tsv", line, field: "first_attested_year", rawValue: r.first_attested_year ?? "" });
  }

  for (let i = 0; i < quotes.length; i += 1) {
    const r = quotes[i];
    const line = i + 2;

    requireFk({ issues, file: "data/final_data/quotes.tsv", line, field: "doctrine_id", rawValue: r.doctrine_id ?? "", fkSet: doctrineIds, allowEmpty: false });

    const author = emptyIfNullToken(r.author_id ?? "");
    if (author) {
      requireFk({ issues, file: "data/final_data/quotes.tsv", line, field: "author_id", rawValue: author, fkSet: personSlugs });
    }

    const workId = emptyIfNullToken(r.work_id ?? "");
    if (workId) {
      requireFk({ issues, file: "data/final_data/quotes.tsv", line, field: "work_id", rawValue: workId, fkSet: workIds });
    }

    validateIntField({ issues, file: "data/final_data/quotes.tsv", line, field: "year", rawValue: r.year ?? "", allowEmpty: false });
    validateIntField({ issues, file: "data/final_data/quotes.tsv", line, field: "decade_bucket", rawValue: r.decade_bucket ?? "", allowEmpty: false });
  }

  for (let i = 0; i < archaeology.length; i += 1) {
    const r = archaeology[i];
    const line = i + 2;

    requireCityFk({ file: "data/final_data/archaeology.tsv", line, field: "city_id", rawValue: r.city_id ?? "" });

    const start = validateIntField({ issues, file: "data/final_data/archaeology.tsv", line, field: "year_start", rawValue: r.year_start ?? "", allowEmpty: false });
    const end = validateIntField({ issues, file: "data/final_data/archaeology.tsv", line, field: "year_end", rawValue: r.year_end ?? "" });
    if (start !== null && end !== null && end < start) {
      issues.push({ severity: "error", file: "data/final_data/archaeology.tsv", line, message: `year_end < year_start (${end} < ${start})` });
    }

    validateIntField({ issues, file: "data/final_data/archaeology.tsv", line, field: "decade_bucket_start", rawValue: r.decade_bucket_start ?? "", allowEmpty: false });
  }

  const edgeTypeAllowed = ["person", "event", "work", "doctrine", "city", "archaeology", "persuasion", "polity"];

  for (let i = 0; i < edges.length; i += 1) {
    const r = edges[i];
    const line = i + 2;

    validateEnum({ issues, file: "data/final_data/edges.tsv", line, field: "source_type", value: r.source_type ?? "", allowed: edgeTypeAllowed, allowEmpty: false });
    validateEnum({ issues, file: "data/final_data/edges.tsv", line, field: "target_type", value: r.target_type ?? "", allowed: edgeTypeAllowed, allowEmpty: false });

    const srcType = (r.source_type ?? "").trim();
    const tgtType = (r.target_type ?? "").trim();

    const srcId = emptyIfNullToken(r.source_id ?? "");
    const tgtId = emptyIfNullToken(r.target_id ?? "");

    if (!srcId) {
      issues.push({ severity: "error", file: "data/final_data/edges.tsv", line, message: "Missing source_id" });
    }
    if (!tgtId) {
      issues.push({ severity: "error", file: "data/final_data/edges.tsv", line, message: "Missing target_id" });
    }

    const fkForType = (type: string): Set<string> => {
      if (type === "person") return personSlugs;
      if (type === "event") return eventIds;
      if (type === "work") return workIds;
      if (type === "doctrine") return doctrineIds;
      if (type === "archaeology") return archaeologyIds;
      if (type === "city") return citySlugs;
      if (type === "persuasion") return persuasionSlugs;
      if (type === "polity") return politySlugs;
      return new Set<string>();
    };

    if (srcType && srcId) {
      if (srcType === "city") {
        requireCityFk({ file: "data/final_data/edges.tsv", line, field: "source_id", rawValue: srcId, allowEmpty: false });
      } else {
        requireFk({ issues, file: "data/final_data/edges.tsv", line, field: "source_id", rawValue: srcId, fkSet: fkForType(srcType), allowEmpty: false });
      }
    }

    if (tgtType && tgtId) {
      if (tgtType === "city") {
        requireCityFk({ file: "data/final_data/edges.tsv", line, field: "target_id", rawValue: tgtId, allowEmpty: false });
      } else {
        requireFk({ issues, file: "data/final_data/edges.tsv", line, field: "target_id", rawValue: tgtId, fkSet: fkForType(tgtType), allowEmpty: false });
      }
    }

    const dStart = validateIntField({ issues, file: "data/final_data/edges.tsv", line, field: "decade_start", rawValue: r.decade_start ?? "" });
    const dEnd = validateIntField({ issues, file: "data/final_data/edges.tsv", line, field: "decade_end", rawValue: r.decade_end ?? "" });
    if (dStart !== null && dEnd !== null && dEnd < dStart) {
      issues.push({ severity: "error", file: "data/final_data/edges.tsv", line, message: `decade_end < decade_start (${dEnd} < ${dStart})` });
    }

    validateIntField({ issues, file: "data/final_data/edges.tsv", line, field: "weight", rawValue: r.weight ?? "", allowEmpty: false });
  }

  for (let i = 0; i < notes.length; i += 1) {
    const r = notes[i];
    const line = i + 2;

    const primaryType = emptyIfNullToken(r.primary_entity_type ?? "");
    const primarySlug = emptyIfNullToken(r.primary_entity_slug ?? "");

    if (!primaryType) {
      issues.push({ severity: "error", file: "data/final_data/notes.tsv", line, message: "Missing primary_entity_type" });
    }
    if (!primarySlug) {
      issues.push({ severity: "error", file: "data/final_data/notes.tsv", line, message: "Missing primary_entity_slug" });
    }

    if (primaryType && primarySlug) {
      if (!mentionTypeAllowed.includes(primaryType)) {
        issues.push({ severity: "error", file: "data/final_data/notes.tsv", line, message: `Unknown primary_entity_type: ${primaryType}` });
      } else if (primaryType === "city") {
        requireCityFk({ file: "data/final_data/notes.tsv", line, field: "primary_entity_slug", rawValue: primarySlug, allowEmpty: false });
      } else if (primaryType === "person") {
        requireFk({ issues, file: "data/final_data/notes.tsv", line, field: "primary_entity_slug", rawValue: primarySlug, fkSet: personSlugs, allowEmpty: false });
      } else if (primaryType === "work") {
        requireFk({ issues, file: "data/final_data/notes.tsv", line, field: "primary_entity_slug", rawValue: primarySlug, fkSet: workIds, allowEmpty: false });
      } else if (primaryType === "event") {
        requireFk({ issues, file: "data/final_data/notes.tsv", line, field: "primary_entity_slug", rawValue: primarySlug, fkSet: eventIds, allowEmpty: false });
      } else if (primaryType === "doctrine") {
        requireFk({ issues, file: "data/final_data/notes.tsv", line, field: "primary_entity_slug", rawValue: primarySlug, fkSet: doctrineIds, allowEmpty: false });
      } else if (primaryType === "archaeology") {
        requireFk({ issues, file: "data/final_data/notes.tsv", line, field: "primary_entity_slug", rawValue: primarySlug, fkSet: archaeologyIds, allowEmpty: false });
      } else if (primaryType === "persuasion") {
        requireFk({ issues, file: "data/final_data/notes.tsv", line, field: "primary_entity_slug", rawValue: primarySlug, fkSet: persuasionSlugs, allowEmpty: false });
      } else if (primaryType === "polity") {
        requireFk({ issues, file: "data/final_data/notes.tsv", line, field: "primary_entity_slug", rawValue: primarySlug, fkSet: politySlugs, allowEmpty: false });
      }
    }

    const body = r.body_md ?? "";
    for (const mention of parseBracketMentions(body)) {
      if (!mentionTypeAllowed.includes(mention.type)) {
        issues.push({ severity: "error", file: "data/final_data/notes.tsv", line, message: `Unknown mention type: ${mention.type}` });
        continue;
      }

      const fkSet =
        mention.type === "city"
          ? cityPlaceSlugs
          : mention.type === "person"
            ? personSlugs
            : mention.type === "work"
              ? workIds
              : mention.type === "event"
                ? eventIds
                : mention.type === "doctrine"
                  ? doctrineIds
                  : mention.type === "archaeology"
                    ? archaeologyIds
                    : mention.type === "persuasion"
                      ? persuasionSlugs
                      : mention.type === "polity"
                        ? politySlugs
                        : new Set<string>();

      if (mention.type === "city") {
        const resolved = resolveCitySlug(mention.slug);
        if (!resolved || !cityPlaceSlugs.has(resolved)) {
          issues.push({ severity: "error", file: "data/final_data/notes.tsv", line, message: `Broken mention [[${mention.type}:${mention.slug}]]` });
        } else if (!citySlugs.has(resolved)) {
          issues.push({ severity: "warn", file: "data/final_data/notes.tsv", line, message: `Mention resolves to stub city (missing in cities.tsv): ${resolved}` });
        }
      } else if (!fkSet.has(mention.slug)) {
        issues.push({ severity: "error", file: "data/final_data/notes.tsv", line, message: `Broken mention [[${mention.type}:${mention.slug}]]` });
      }
    }
  }

  for (let i = 0; i < noteMentions.length; i += 1) {
    const r = noteMentions[i];
    const line = i + 2;

    requireFk({ issues, file: "data/final_data/note_mentions.tsv", line, field: "note_id", rawValue: r.note_id ?? "", fkSet: noteIds, allowEmpty: false });

    const mType = emptyIfNullToken(r.mentioned_type ?? "");
    const mSlug = emptyIfNullToken(r.mentioned_slug ?? "");

    validateEnum({ issues, file: "data/final_data/note_mentions.tsv", line, field: "mentioned_type", value: mType, allowed: mentionTypeAllowed, allowEmpty: false });

    if (!mSlug) {
      issues.push({ severity: "error", file: "data/final_data/note_mentions.tsv", line, message: "Missing mentioned_slug" });
      continue;
    }

    const fkSet =
      mType === "city"
        ? cityPlaceSlugs
        : mType === "person"
          ? personSlugs
          : mType === "work"
            ? workIds
            : mType === "event"
              ? eventIds
              : mType === "doctrine"
                ? doctrineIds
                : mType === "archaeology"
                  ? archaeologyIds
                  : mType === "persuasion"
                    ? persuasionSlugs
                    : mType === "polity"
                      ? politySlugs
                      : new Set<string>();

    if (mType === "city") {
      const resolved = resolveCitySlug(mSlug);
      if (!resolved || !cityPlaceSlugs.has(resolved)) {
        issues.push({ severity: "error", file: "data/final_data/note_mentions.tsv", line, message: `Broken mention: ${mType}:${mSlug}` });
      } else if (!citySlugs.has(resolved)) {
        issues.push({ severity: "warn", file: "data/final_data/note_mentions.tsv", line, message: `Mention resolves to stub city (missing in cities.tsv): ${resolved}` });
      }
    } else if (mType && !fkSet.has(mSlug)) {
      issues.push({ severity: "error", file: "data/final_data/note_mentions.tsv", line, message: `Broken mention: ${mType}:${mSlug}` });
    }
  }

  for (let i = 0; i < places.length; i += 1) {
    const r = places[i];
    const line = i + 2;

    const placeType = emptyIfNullToken(r.place_type ?? "");
    validateEnum({ issues, file: "data/final_data/places.tsv", line, field: "place_type", value: placeType, allowed: placeTypeAllowed, allowEmpty: false });

    const placeId = emptyIfNullToken(r.place_id ?? "");
    if (!placeId) {
      issues.push({ severity: "error", file: "data/final_data/places.tsv", line, message: "Missing place_id" });
    }

    const citySlug = emptyIfNullToken(r.city_slug ?? "");
    const archId = emptyIfNullToken(r.archaeology_id ?? "");

    if (placeType === "city") {
      if (!citySlug) {
        issues.push({ severity: "error", file: "data/final_data/places.tsv", line, message: "City place missing city_slug" });
      } else if (!citySlugs.has(citySlug)) {
        issues.push({ severity: "warn", file: "data/final_data/places.tsv", line, message: `City place uses stub slug not in cities.tsv: ${citySlug}` });
      }
      if (archId) {
        issues.push({ severity: "error", file: "data/final_data/places.tsv", line, message: "City place should not set archaeology_id" });
      }
    }

    if (placeType === "archaeology") {
      requireFk({ issues, file: "data/final_data/places.tsv", line, field: "archaeology_id", rawValue: archId, fkSet: archaeologyIds, allowEmpty: false });
      if (citySlug) {
        requireFk({ issues, file: "data/final_data/places.tsv", line, field: "city_slug", rawValue: citySlug, fkSet: citySlugs });
      }
    }
  }

  const fkForRelType = (t: string): Set<string> => {
    if (t === "place") return placeIds;
    if (t === "city") return citySlugs;
    if (t === "person") return personSlugs;
    if (t === "work") return workIds;
    if (t === "doctrine") return doctrineIds;
    if (t === "event") return eventIds;
    if (t === "archaeology") return archaeologyIds;
    if (t === "persuasion") return persuasionSlugs;
    if (t === "polity") return politySlugs;
    if (t === "note") return noteIds;
    return new Set<string>();
  };

  for (let i = 0; i < relations.length; i += 1) {
    const r = relations[i];
    const line = i + 2;

    const relId = emptyIfNullToken(r.relation_id ?? "");
    if (!relId) {
      issues.push({ severity: "error", file: "data/final_data/relations.tsv", line, message: "Missing relation_id" });
    }

    const srcType = emptyIfNullToken(r.source_type ?? "");
    const srcId = emptyIfNullToken(r.source_id ?? "");
    const relType = emptyIfNullToken(r.relation_type ?? "");
    const tgtType = emptyIfNullToken(r.target_type ?? "");
    const tgtId = emptyIfNullToken(r.target_id ?? "");

    validateEnum({ issues, file: "data/final_data/relations.tsv", line, field: "source_type", value: srcType, allowed: relationNodeTypeAllowed, allowEmpty: false });
    validateEnum({ issues, file: "data/final_data/relations.tsv", line, field: "target_type", value: tgtType, allowed: relationNodeTypeAllowed, allowEmpty: false });

    if (!srcId) issues.push({ severity: "error", file: "data/final_data/relations.tsv", line, message: "Missing source_id" });
    if (!relType) issues.push({ severity: "error", file: "data/final_data/relations.tsv", line, message: "Missing relation_type" });
    if (!tgtId) issues.push({ severity: "error", file: "data/final_data/relations.tsv", line, message: "Missing target_id" });

    const yearStart = validateIntField({ issues, file: "data/final_data/relations.tsv", line, field: "year_start", rawValue: r.year_start ?? "" });
    const yearEnd = validateIntField({ issues, file: "data/final_data/relations.tsv", line, field: "year_end", rawValue: r.year_end ?? "" });
    if (yearStart !== null && yearEnd !== null && yearEnd < yearStart) {
      issues.push({ severity: "error", file: "data/final_data/relations.tsv", line, message: `year_end < year_start (${yearEnd} < ${yearStart})` });
    }

    validateIntField({ issues, file: "data/final_data/relations.tsv", line, field: "weight", rawValue: r.weight ?? "" });
    validateEnum({ issues, file: "data/final_data/relations.tsv", line, field: "polarity", value: emptyIfNullToken(r.polarity ?? ""), allowed: relationPolarityAllowed, allowEmpty: true });
    validateEnum({ issues, file: "data/final_data/relations.tsv", line, field: "certainty", value: emptyIfNullToken(r.certainty ?? ""), allowed: relationCertaintyAllowed, allowEmpty: true });

    const evidenceNote = emptyIfNullToken(r.evidence_note_id ?? "");
    if (evidenceNote) {
      requireFk({ issues, file: "data/final_data/relations.tsv", line, field: "evidence_note_id", rawValue: evidenceNote, fkSet: noteIds });
    }

    if (srcType && srcId) {
      requireFk({
        issues,
        file: "data/final_data/relations.tsv",
        line,
        field: "source_id",
        rawValue: srcId,
        fkSet: fkForRelType(srcType),
        allowEmpty: false,
      });
    }

    if (tgtType && tgtId) {
      requireFk({
        issues,
        file: "data/final_data/relations.tsv",
        line,
        field: "target_id",
        rawValue: tgtId,
        fkSet: fkForRelType(tgtType),
        allowEmpty: false,
      });
    }
  }

  for (let i = 0; i < mappingCityKeys.length; i += 1) {
    const r = mappingCityKeys[i];
    const line = i + 2;
    const slug = emptyIfNullToken(r.canonical_city_slug ?? "");
    if (slug && !citySlugs.has(slug)) {
      issues.push({
        severity: "error",
        file: "data/final_data/mappings/city_keys.tsv",
        line,
        message: `canonical_city_slug not in cities.tsv: ${slug}`,
      });
    }
  }

  for (let i = 0; i < mappingCityAliases.length; i += 1) {
    const r = mappingCityAliases[i];
    const line = i + 2;
    const slug = emptyIfNullToken(r.canonical_city_slug ?? "");
    if (slug && !citySlugs.has(slug)) {
      issues.push({
        severity: "error",
        file: "data/final_data/mappings/city_aliases.tsv",
        line,
        message: `canonical_city_slug not in cities.tsv: ${slug}`,
      });
    }
  }

  for (let i = 0; i < mappingPersuasionTokens.length; i += 1) {
    const r = mappingPersuasionTokens[i];
    const line = i + 2;
    const slugs = splitSemi(r.canonical_persuasion_slugs ?? "");
    for (const slug of slugs) {
      if (!persuasionSlugs.has(slug)) {
        issues.push({
          severity: "error",
          file: "data/final_data/mappings/persuasion_tokens.tsv",
          line,
          message: `canonical_persuasion_slug not in persuasions.tsv: ${slug}`,
        });
      }
    }
  }

  for (let i = 0; i < mappingPersonTokens.length; i += 1) {
    const r = mappingPersonTokens[i];
    const line = i + 2;
    const slug = emptyIfNullToken(r.canonical_person_slug ?? "");
    if (slug && !personSlugs.has(slug)) {
      issues.push({
        severity: "error",
        file: "data/final_data/mappings/person_tokens.tsv",
        line,
        message: `canonical_person_slug not in people.tsv: ${slug}`,
      });
    }
  }

  for (let i = 0; i < mappingPolityTokens.length; i += 1) {
    const r = mappingPolityTokens[i];
    const line = i + 2;
    const slug = emptyIfNullToken(r.canonical_polity_slug ?? "");
    if (slug && !politySlugs.has(slug)) {
      issues.push({
        severity: "error",
        file: "data/final_data/mappings/polity_tokens.tsv",
        line,
        message: `canonical_polity_slug not in polities.tsv: ${slug}`,
      });
    }
  }

  for (let i = 0; i < placeState.length; i += 1) {
    const r = placeState[i];
    const line = i + 2;

    requireFk({ issues, file: "data/final_data/place_state_by_decade.tsv", line, field: "place_id", rawValue: r.place_id ?? "", fkSet: placeIds, allowEmpty: false });
    validateIntField({ issues, file: "data/final_data/place_state_by_decade.tsv", line, field: "decade", rawValue: r.decade ?? "", allowEmpty: false });

    validateEnum({ issues, file: "data/final_data/place_state_by_decade.tsv", line, field: "presence_status", value: r.presence_status ?? "", allowed: presenceAllowed, allowEmpty: false });

    for (const slug of splitSemi(r.persuasion_slugs ?? "")) {
      requireFk({ issues, file: "data/final_data/place_state_by_decade.tsv", line, field: "persuasion_slugs", rawValue: slug, fkSet: persuasionSlugs });
    }

    const polity = emptyIfNullToken(r.polity_slug ?? "");
    if (polity) {
      requireFk({ issues, file: "data/final_data/place_state_by_decade.tsv", line, field: "polity_slug", rawValue: polity, fkSet: politySlugs });
    }

    const ev = emptyIfNullToken(r.evidence_note_id ?? "");
    if (ev) {
      requireFk({ issues, file: "data/final_data/place_state_by_decade.tsv", line, field: "evidence_note_id", rawValue: ev, fkSet: noteIds });
    }
  }

  for (let i = 0; i < footprints.length; i += 1) {
    const r = footprints[i];
    const line = i + 2;

    const entityType = emptyIfNullToken(r.entity_type ?? "");
    validateEnum({ issues, file: "data/final_data/entity_place_footprints.tsv", line, field: "entity_type", value: entityType, allowed: entityTypeAllowed, allowEmpty: false });

    requireFk({ issues, file: "data/final_data/entity_place_footprints.tsv", line, field: "place_id", rawValue: r.place_id ?? "", fkSet: placeIds, allowEmpty: false });

    const entityId = emptyIfNullToken(r.entity_id ?? "");
    if (!entityId) {
      issues.push({ severity: "error", file: "data/final_data/entity_place_footprints.tsv", line, message: "Missing entity_id" });
    }

    const start = validateIntField({ issues, file: "data/final_data/entity_place_footprints.tsv", line, field: "year_start", rawValue: r.year_start ?? "" });
    const end = validateIntField({ issues, file: "data/final_data/entity_place_footprints.tsv", line, field: "year_end", rawValue: r.year_end ?? "" });
    if (start !== null && end !== null && end < start) {
      issues.push({ severity: "error", file: "data/final_data/entity_place_footprints.tsv", line, message: `year_end < year_start (${end} < ${start})` });
    }

    validateIntField({ issues, file: "data/final_data/entity_place_footprints.tsv", line, field: "weight", rawValue: r.weight ?? "" });

    const fkSet =
      entityType === "person"
        ? personSlugs
        : entityType === "event"
          ? eventIds
          : entityType === "work"
            ? workIds
            : entityType === "doctrine"
              ? doctrineIds
              : entityType === "archaeology"
                ? archaeologyIds
                : entityType === "city"
                  ? citySlugs
                  : entityType === "persuasion"
                    ? persuasionSlugs
                    : entityType === "polity"
                      ? politySlugs
                      : new Set<string>();

    if (entityType && entityId && fkSet.size > 0 && !fkSet.has(entityId)) {
      issues.push({
        severity: "error",
        file: "data/final_data/entity_place_footprints.tsv",
        line,
        message: `Broken FK entity_id for type ${entityType}: ${entityId}`,
      });
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warns = issues.filter((i) => i.severity === "warn");

  for (const issue of [...errors, ...warns]) {
    const prefix = issue.severity === "error" ? "ERROR" : "WARN";
    const line = issue.line ? `:${issue.line}` : "";
    const stream = issue.severity === "error" ? console.error : console.warn;
    stream(`[${prefix}] ${issue.file}${line} ${issue.message}`);
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
