import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_COLUMNS = [
  "year_bucket",
  "date_range",
  "city_ancient",
  "city_modern",
  "country_modern",
  "lat",
  "lon",
  "location_precision",
  "ruling_empire_polity",
  "ruling_subdivision",
  "church_presence_status",
  "church_planted_year_earliest_claim",
  "church_planted_year_scholarly",
  "church_planted_by",
  "apostolic_origin_thread",
  "key_figures",
  "denomination_label_historic",
  "modern_denom_mapping",
  "council_context",
  "evidence_notes_and_citations",
] as const;

const URL_REGEX = /https?:\/\/[^\s<>"'`\])]+/gi;

type LocationPrecision = "exact" | "approx_city" | "region_only" | "unknown";
type PresenceStatus =
  | "attested"
  | "probable"
  | "claimed_tradition"
  | "not_attested"
  | "suppressed"
  | "unknown";

type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];

type RawRecord = Record<RequiredColumn, string>;

interface CitationToken {
  value: string;
  isValid: boolean;
}

interface EvidenceSections {
  summary: string;
  uncertainty: string;
  evidence: string;
  citations: string;
  raw: string;
}

interface ChurchRow {
  id: string;
  year_bucket: number;
  date_range: string;
  city_ancient: string;
  city_modern: string;
  country_modern: string;
  lat: number | null;
  lon: number | null;
  location_precision: LocationPrecision;
  ruling_empire_polity: string;
  ruling_subdivision: string;
  church_presence_status: PresenceStatus;
  church_planted_year_earliest_claim: number | null;
  church_planted_year_scholarly: number | null;
  church_planted_by: string;
  apostolic_origin_thread: string;
  key_figures: string;
  key_figures_list: string[];
  denomination_label_historic: string;
  denomination_label_historic_values: string[];
  modern_denom_mapping: string;
  modern_denom_mapping_values: string[];
  council_context: string;
  evidence_notes_and_citations: string;
  evidence_sections: EvidenceSections;
  citation_tokens: CitationToken[];
  citations_valid: string[];
  hasValidCoordinates: boolean;
}

interface FilterFacets {
  church_presence_status: string[];
  ruling_empire_polity: string[];
  denomination_label_historic: string[];
  modern_denom_mapping: string[];
}

interface IndexedDataArtifact {
  yearBuckets: number[];
  dateRangeByYear: Record<string, string>;
  rows: ChurchRow[];
  byYearBucket: Record<string, string[]>;
  cumulativeByYearBucket: Record<string, string[]>;
  indexByChurchPresenceStatus: Record<string, string[]>;
  indexByRulingEmpirePolity: Record<string, string[]>;
  indexByDenominationLabelHistoric: Record<string, string[]>;
  indexByModernDenomMapping: Record<string, string[]>;
  searchTextById: Record<string, string>;
  facets: FilterFacets;
}

interface FeaturedPoi {
  id: string;
  name: string;
  lat: number;
  lon: number;
  location_precision: LocationPrecision;
  start_year: number;
  end_year: number | null;
  description: string;
  uncertainty: string;
  citation_tokens: CitationToken[];
  citations_valid: string[];
}

interface EssayDocument {
  id: string;
  title: string;
  content: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const DATASET_PATH = resolve(ROOT, "final.tsv");
const STARRED_POIS_PATH = resolve(ROOT, "data", "starred_pois.json");
const ESSAYS_DIR = resolve(ROOT, "essays");
const GENERATED_DIR = resolve(ROOT, "src", "data", "generated");
const INDEXED_DATA_PATH = resolve(GENERATED_DIR, "indexedData.json");
const STARRED_POIS_OUT_PATH = resolve(GENERATED_DIR, "starredPois.json");
const ESSAYS_OUT_PATH = resolve(GENERATED_DIR, "essays.json");

function buildYearBuckets(): number[] {
  const years: number[] = [33];
  for (let year = 40; year <= 800; year += 10) {
    years.push(year);
  }
  return years;
}

const YEAR_BUCKETS = buildYearBuckets();

function formatYear(year: number): string {
  return String(year).padStart(4, "0");
}

function deriveDateRange(year: number): string {
  if (year === 33) {
    return "0033-0039";
  }
  return `${formatYear(year)}-${formatYear(year + 9)}`;
}

function validateHeaders(headers: string[]): void {
  if (headers.length !== REQUIRED_COLUMNS.length) {
    throw new Error(
      `dataset.tsv must have exactly ${REQUIRED_COLUMNS.length} columns; got ${headers.length}.`,
    );
  }

  for (let index = 0; index < REQUIRED_COLUMNS.length; index += 1) {
    const expected = REQUIRED_COLUMNS[index];
    const actual = headers[index];
    if (expected !== actual) {
      throw new Error(
        `dataset.tsv header mismatch at column ${index + 1}: expected "${expected}" got "${actual}".`,
      );
    }
  }
}

function parseTsv(content: string): RawRecord[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("dataset.tsv must include header + at least one row.");
  }

  const headers = lines[0].split("\t").map((header) => header.trim());
  validateHeaders(headers);

  const rows: RawRecord[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const lineNumber = lineIndex + 1;
    const rawLine = lines[lineIndex];
    let columns = rawLine.split("\t");

    if (columns.length > headers.length) {
      columns = [
        ...columns.slice(0, headers.length - 1),
        columns.slice(headers.length - 1).join("\t"),
      ];
      console.warn(
        `[build:data] Line ${lineNumber} had ${columns.length} columns after split; merged trailing extra columns into evidence_notes_and_citations.`,
      );
    }

    if (columns.length < headers.length) {
      columns = columns.concat(
        Array.from({ length: headers.length - columns.length }, () => ""),
      );
      console.warn(
        `[build:data] Line ${lineNumber} had missing columns; padded blanks to ${headers.length}.`,
      );
    }

    const record = {} as RawRecord;
    headers.forEach((header, index) => {
      record[header as RequiredColumn] = (columns[index] ?? "").trim();
    });

    rows.push(record);
  }

  return rows;
}

function parseNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitSemicolonList(value: string): string[] {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function normalizePrecision(value: string): LocationPrecision {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "exact" ||
    normalized === "approx_city" ||
    normalized === "region_only" ||
    normalized === "unknown"
  ) {
    return normalized;
  }
  return "unknown";
}

function normalizePresenceStatus(value: string): PresenceStatus {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "attested" ||
    normalized === "probable" ||
    normalized === "claimed_tradition" ||
    normalized === "not_attested" ||
    normalized === "suppressed" ||
    normalized === "unknown"
  ) {
    return normalized;
  }
  return "unknown";
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-")
    .toLowerCase();
}

function makeStableId(
  year: number,
  cityAncient: string,
  cityModern: string,
  countryModern: string,
  seen: Map<string, number>,
): string {
  const base = `${formatYear(year)}-${slugify(cityAncient)}-${slugify(cityModern || countryModern)}`;
  const count = (seen.get(base) ?? 0) + 1;
  seen.set(base, count);
  return count > 1 ? `${base}-${count}` : base;
}

function cleanUrl(value: string): string {
  return value.replace(/[),.;]+$/g, "");
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function extractCitationTokens(source: string): CitationToken[] {
  const matches = source.match(URL_REGEX) ?? [];
  const seen = new Set<string>();
  const tokens: CitationToken[] = [];

  for (const match of matches) {
    const cleaned = cleanUrl(match);
    if (!cleaned || seen.has(cleaned)) {
      continue;
    }
    seen.add(cleaned);
    tokens.push({ value: cleaned, isValid: isValidUrl(cleaned) });
  }

  return tokens;
}

function extractSection(raw: string, label: string, nextLabels: string[]): string {
  const lookahead = nextLabels.length > 0 ? `(?=${nextLabels.map((next) => `${next}:`).join("|")}|$)` : "$";
  const pattern = new RegExp(`${label}:\\s*([\\s\\S]*?)${lookahead}`, "i");
  const match = raw.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function parseEvidenceSections(raw: string): EvidenceSections {
  const normalized = raw.replace(/\s+/g, " ").trim();

  return {
    summary: extractSection(normalized, "Summary", ["Uncertainty", "Evidence", "Citations"]),
    uncertainty: extractSection(normalized, "Uncertainty", ["Evidence", "Citations"]),
    evidence: extractSection(normalized, "Evidence", ["Citations"]),
    citations: extractSection(normalized, "Citations", []),
    raw: normalized,
  };
}

function addToIndex(index: Record<string, string[]>, key: string, id: string): void {
  const normalized = key.trim();
  if (!normalized) {
    return;
  }
  if (!index[normalized]) {
    index[normalized] = [];
  }
  index[normalized].push(id);
}

function sortAndDedupeIndex(index: Record<string, string[]>): Record<string, string[]> {
  const entries = Object.entries(index).map(([key, ids]) => {
    const deduped = Array.from(new Set(ids));
    deduped.sort();
    return [key, deduped] as const;
  });

  entries.sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

function toSearchText(row: ChurchRow): string {
  return [
    row.city_ancient,
    row.city_modern,
    row.country_modern,
    row.key_figures,
    row.evidence_notes_and_citations,
    row.modern_denom_mapping,
    row.denomination_label_historic,
    row.ruling_empire_polity,
  ]
    .join(" ")
    .toLowerCase();
}

function rowSorter(a: ChurchRow, b: ChurchRow): number {
  if (a.year_bucket !== b.year_bucket) {
    return a.year_bucket - b.year_bucket;
  }
  const cityCompare = a.city_ancient.localeCompare(b.city_ancient);
  if (cityCompare !== 0) {
    return cityCompare;
  }
  const countryCompare = a.country_modern.localeCompare(b.country_modern);
  if (countryCompare !== 0) {
    return countryCompare;
  }
  return a.id.localeCompare(b.id);
}

function buildIndexedData(records: RawRecord[]): IndexedDataArtifact {
  const seenIds = new Map<string, number>();
  const rows: ChurchRow[] = [];

  for (const record of records) {
    const yearBucket = parseInteger(record.year_bucket);
    if (yearBucket === null) {
      console.warn(
        `[build:data] Skipping row with invalid year_bucket: ${JSON.stringify(record)}`,
      );
      continue;
    }

    if (!YEAR_BUCKETS.includes(yearBucket)) {
      console.warn(
        `[build:data] Row year_bucket=${yearBucket} is outside slider range 33..800 by decade; row remains searchable but timeline will not target it directly.`,
      );
    }

    const lat = parseNumber(record.lat);
    const lon = parseNumber(record.lon);
    const hasValidCoordinates = lat !== null && lon !== null;

    if (!hasValidCoordinates) {
      console.warn(
        `[build:data] Missing/invalid coordinates for ${record.city_ancient} (${yearBucket}). Marker plotting will skip; row remains searchable.`,
      );
    }

    const citationTokens = extractCitationTokens(record.evidence_notes_and_citations);
    const id = makeStableId(
      yearBucket,
      record.city_ancient,
      record.city_modern,
      record.country_modern,
      seenIds,
    );

    const row: ChurchRow = {
      id,
      year_bucket: yearBucket,
      date_range: record.date_range || deriveDateRange(yearBucket),
      city_ancient: record.city_ancient,
      city_modern: record.city_modern,
      country_modern: record.country_modern,
      lat,
      lon,
      location_precision: normalizePrecision(record.location_precision),
      ruling_empire_polity: record.ruling_empire_polity,
      ruling_subdivision: record.ruling_subdivision,
      church_presence_status: normalizePresenceStatus(record.church_presence_status),
      church_planted_year_earliest_claim: parseInteger(record.church_planted_year_earliest_claim),
      church_planted_year_scholarly: parseInteger(record.church_planted_year_scholarly),
      church_planted_by: record.church_planted_by,
      apostolic_origin_thread: record.apostolic_origin_thread,
      key_figures: record.key_figures,
      key_figures_list: splitSemicolonList(record.key_figures),
      denomination_label_historic: record.denomination_label_historic,
      denomination_label_historic_values: splitSemicolonList(record.denomination_label_historic),
      modern_denom_mapping: record.modern_denom_mapping,
      modern_denom_mapping_values: splitSemicolonList(record.modern_denom_mapping),
      council_context: record.council_context,
      evidence_notes_and_citations: record.evidence_notes_and_citations,
      evidence_sections: parseEvidenceSections(record.evidence_notes_and_citations),
      citation_tokens: citationTokens,
      citations_valid: citationTokens.filter((token) => token.isValid).map((token) => token.value),
      hasValidCoordinates,
    };

    rows.push(row);
  }

  rows.sort(rowSorter);

  const byYearBucket: Record<string, string[]> = {};
  const cumulativeByYearBucket: Record<string, string[]> = {};
  const dateRangeByYear: Record<string, string> = {};
  const searchTextById: Record<string, string> = {};

  for (const year of YEAR_BUCKETS) {
    byYearBucket[String(year)] = [];
    dateRangeByYear[String(year)] = deriveDateRange(year);
  }

  for (const row of rows) {
    const yearKey = String(row.year_bucket);
    if (!byYearBucket[yearKey]) {
      byYearBucket[yearKey] = [];
    }
    byYearBucket[yearKey].push(row.id);
    dateRangeByYear[yearKey] = row.date_range || dateRangeByYear[yearKey] || deriveDateRange(row.year_bucket);
    searchTextById[row.id] = toSearchText(row);
  }

  const running: string[] = [];
  for (const year of YEAR_BUCKETS) {
    const yearKey = String(year);
    running.push(...(byYearBucket[yearKey] ?? []));
    cumulativeByYearBucket[yearKey] = [...running];
  }

  const indexByChurchPresenceStatus: Record<string, string[]> = {};
  const indexByRulingEmpirePolity: Record<string, string[]> = {};
  const indexByDenominationLabelHistoric: Record<string, string[]> = {};
  const indexByModernDenomMapping: Record<string, string[]> = {};

  for (const row of rows) {
    addToIndex(indexByChurchPresenceStatus, row.church_presence_status, row.id);
    addToIndex(indexByRulingEmpirePolity, row.ruling_empire_polity, row.id);

    for (const value of row.denomination_label_historic_values) {
      addToIndex(indexByDenominationLabelHistoric, value, row.id);
    }

    for (const value of row.modern_denom_mapping_values) {
      addToIndex(indexByModernDenomMapping, value, row.id);
    }
  }

  const normalizedStatusIndex = sortAndDedupeIndex(indexByChurchPresenceStatus);
  const normalizedPolityIndex = sortAndDedupeIndex(indexByRulingEmpirePolity);
  const normalizedDenomIndex = sortAndDedupeIndex(indexByDenominationLabelHistoric);
  const normalizedModernDenomIndex = sortAndDedupeIndex(indexByModernDenomMapping);

  return {
    yearBuckets: YEAR_BUCKETS,
    dateRangeByYear,
    rows,
    byYearBucket,
    cumulativeByYearBucket,
    indexByChurchPresenceStatus: normalizedStatusIndex,
    indexByRulingEmpirePolity: normalizedPolityIndex,
    indexByDenominationLabelHistoric: normalizedDenomIndex,
    indexByModernDenomMapping: normalizedModernDenomIndex,
    searchTextById,
    facets: {
      church_presence_status: Object.keys(normalizedStatusIndex),
      ruling_empire_polity: Object.keys(normalizedPolityIndex),
      denomination_label_historic: Object.keys(normalizedDenomIndex),
      modern_denom_mapping: Object.keys(normalizedModernDenomIndex),
    },
  };
}

function parsePoi(value: unknown): FeaturedPoi {
  const record = value as Record<string, unknown>;

  const name = String(record.name ?? "Unnamed POI").trim();
  const id = String(record.id ?? slugify(name));
  const lat = Number(record.lat);
  const lon = Number(record.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(`POI "${name}" is missing valid lat/lon.`);
  }

  const startYear = Number(record.start_year);
  if (!Number.isFinite(startYear)) {
    throw new Error(`POI "${name}" is missing start_year.`);
  }

  const endYearRaw = record.end_year;
  const endYear =
    endYearRaw === null || endYearRaw === undefined || endYearRaw === ""
      ? null
      : Number(endYearRaw);

  const locationPrecision = normalizePrecision(String(record.location_precision ?? "unknown"));
  const description = String(record.description ?? "").trim();
  const uncertainty = String(record.uncertainty ?? "").trim();
  const citations = Array.isArray(record.citations)
    ? record.citations.map((citation) => String(citation))
    : [];

  const citationTokens = citations
    .map((citation) => citation.trim())
    .filter((citation) => citation.length > 0)
    .map((citation) => ({ value: citation, isValid: isValidUrl(citation) }));

  const dedupedTokens: CitationToken[] = [];
  const seen = new Set<string>();
  for (const token of citationTokens) {
    if (seen.has(token.value)) {
      continue;
    }
    seen.add(token.value);
    dedupedTokens.push(token);
  }

  return {
    id,
    name,
    lat,
    lon,
    location_precision: locationPrecision,
    start_year: Math.trunc(startYear),
    end_year: endYear === null || Number.isNaN(endYear) ? null : Math.trunc(endYear),
    description,
    uncertainty,
    citation_tokens: dedupedTokens,
    citations_valid: dedupedTokens.filter((token) => token.isValid).map((token) => token.value),
  };
}

async function buildFeaturedPois(): Promise<FeaturedPoi[]> {
  const raw = await readFile(STARRED_POIS_PATH, "utf8");
  const parsed = JSON.parse(raw) as unknown[];
  const pois = parsed.map(parsePoi);
  pois.sort((a, b) => a.name.localeCompare(b.name));
  return pois;
}

function extractEssayTitle(content: string, fallback: string): string {
  const heading = content.match(/^#\s+(.+)$/m);
  if (heading?.[1]) {
    return heading[1].trim();
  }
  return fallback;
}

async function buildEssays(): Promise<EssayDocument[]> {
  const documents: EssayDocument[] = [];

  try {
    const entries = await readdir(ESSAYS_DIR, { withFileTypes: true, encoding: "utf8" });

    for (const entry of entries) {
      const entryName = String(entry.name);
      if (!entry.isFile() || extname(entryName).toLowerCase() !== ".md") {
        continue;
      }

      const absolutePath = resolve(ESSAYS_DIR, entryName);
      const content = await readFile(absolutePath, "utf8");
      const fileBase = parse(entryName).name;
      documents.push({
        id: slugify(fileBase),
        title: extractEssayTitle(content, fileBase),
        content,
      });
    }
  } catch {
    return documents;
  }

  documents.sort((a, b) => a.id.localeCompare(b.id));
  return documents;
}

async function main(): Promise<void> {
  const rawTsv = await readFile(DATASET_PATH, "utf8");
  const records = parseTsv(rawTsv);
  const indexedData = buildIndexedData(records);
  const featuredPois = await buildFeaturedPois();
  const essays = await buildEssays();

  await mkdir(GENERATED_DIR, { recursive: true });

  await writeFile(INDEXED_DATA_PATH, `${JSON.stringify(indexedData, null, 2)}\n`, "utf8");
  await writeFile(STARRED_POIS_OUT_PATH, `${JSON.stringify(featuredPois, null, 2)}\n`, "utf8");
  await writeFile(ESSAYS_OUT_PATH, `${JSON.stringify(essays, null, 2)}\n`, "utf8");

  console.log(`[build:data] Wrote ${INDEXED_DATA_PATH}`);
  console.log(`[build:data] Wrote ${STARRED_POIS_OUT_PATH}`);
  console.log(`[build:data] Wrote ${ESSAYS_OUT_PATH}`);
  console.log(
    `[build:data] Rows=${indexedData.rows.length}, mapped=${indexedData.rows.filter((row) => row.hasValidCoordinates).length}, POIs=${featuredPois.length}, essays=${essays.length}`,
  );
}

main().catch((error: unknown) => {
  console.error("[build:data] Failed:", error);
  process.exitCode = 1;
});
