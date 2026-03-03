import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const DATA_DIR = resolve(ROOT, "data");
const GENERATED_DIR = resolve(ROOT, "src", "data", "generated");

// ─── Generic TSV parser ──────────────────────────────────────────────────────

function parseTsvGeneric(content: string, fileName: string): Record<string, string>[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 1) {
    console.warn(`[build:entities] ${fileName} is empty.`);
    return [];
  }

  const headers = lines[0].split("\t").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = (cols[j] ?? "").trim();
    }
    rows.push(record);
  }

  console.log(`[build:entities] Parsed ${rows.length} rows from ${fileName}`);
  return rows;
}

function splitSemi(value: string): string[] {
  return value
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseIntOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function nullIfEmpty(value: string): string | null {
  const v = value.trim();
  return v.length > 0 && v !== "null" ? v : null;
}

// ─── People ──────────────────────────────────────────────────────────────────

interface PersonJson {
  id: string;
  name_display: string;
  name_alt: string[];
  birth_year: number | null;
  death_year: number | null;
  death_type: string;
  roles: string[];
  city_of_origin_id: string | null;
  apostolic_connection: string;
  description: string;
  wikipedia_url: string | null;
  citations: string[];
}

function buildPeople(rows: Record<string, string>[]): PersonJson[] {
  return rows.map((r) => ({
    id: r.id,
    name_display: r.name_display,
    name_alt: splitSemi(r.name_alt ?? ""),
    birth_year: parseIntOrNull(r.birth_year ?? ""),
    death_year: parseIntOrNull(r.death_year ?? ""),
    death_type: r.death_type || "unknown",
    roles: splitSemi(r.roles ?? ""),
    city_of_origin_id: nullIfEmpty(r.city_of_origin_id ?? ""),
    apostolic_connection: r.apostolic_connection ?? "",
    description: r.description ?? "",
    wikipedia_url: nullIfEmpty(r.wikipedia_url ?? ""),
    citations: splitSemi(r.citations ?? ""),
  }));
}

// ─── Events ──────────────────────────────────────────────────────────────────

interface EventJson {
  id: string;
  name_display: string;
  event_type: string;
  year_start: number;
  year_end: number | null;
  decade_bucket: number;
  city_id: string | null;
  city_ancient: string;
  region: string;
  key_figure_ids: string[];
  description: string;
  significance: string;
  outcome: string;
  citations: string[];
}

function buildEvents(rows: Record<string, string>[]): EventJson[] {
  return rows.map((r) => ({
    id: r.id,
    name_display: r.name_display,
    event_type: r.event_type || "other",
    year_start: parseIntOrNull(r.year_start ?? "") ?? 0,
    year_end: parseIntOrNull(r.year_end ?? ""),
    decade_bucket: parseIntOrNull(r.decade_bucket ?? "") ?? 0,
    city_id: nullIfEmpty(r.city_id ?? ""),
    city_ancient: r.city_ancient ?? "",
    region: r.region ?? "",
    key_figure_ids: splitSemi(r.key_figure_ids ?? ""),
    description: r.description ?? "",
    significance: r.significance ?? "",
    outcome: r.outcome ?? "",
    citations: splitSemi(r.citations ?? ""),
  }));
}

// ─── Works ───────────────────────────────────────────────────────────────────

interface WorkJson {
  id: string;
  title_display: string;
  author_id: string | null;
  author_name_display: string;
  year_written_earliest: number;
  year_written_latest: number;
  decade_bucket: number;
  work_type: string;
  city_written_id: string | null;
  city_recipient_ids: string[];
  language: string;
  description: string;
  significance: string;
  modern_edition_url: string | null;
  citations: string[];
}

function buildWorks(rows: Record<string, string>[]): WorkJson[] {
  return rows.map((r) => ({
    id: r.id,
    title_display: r.title_display,
    author_id: nullIfEmpty(r.author_id ?? ""),
    author_name_display: r.author_name_display ?? "",
    year_written_earliest: parseIntOrNull(r.year_written_earliest ?? "") ?? 0,
    year_written_latest: parseIntOrNull(r.year_written_latest ?? "") ?? 0,
    decade_bucket: parseIntOrNull(r.decade_bucket ?? "") ?? 0,
    work_type: r.work_type || "other",
    city_written_id: nullIfEmpty(r.city_written_id ?? ""),
    city_recipient_ids: splitSemi(r.city_recipient_ids ?? ""),
    language: r.language ?? "",
    description: r.description ?? "",
    significance: r.significance ?? "",
    modern_edition_url: nullIfEmpty(r.modern_edition_url ?? ""),
    citations: splitSemi(r.citations ?? ""),
  }));
}

// ─── Doctrines ───────────────────────────────────────────────────────────────

interface DoctrineJson {
  id: string;
  name_display: string;
  category: string;
  description: string;
  first_attested_year: number | null;
  first_attested_work_id: string | null;
  controversy_level: string;
  resolution: string;
  citations: string[];
}

function buildDoctrines(rows: Record<string, string>[]): DoctrineJson[] {
  return rows.map((r) => ({
    id: r.id,
    name_display: r.name_display,
    category: r.category || "other",
    description: r.description ?? "",
    first_attested_year: parseIntOrNull(r.first_attested_year ?? ""),
    first_attested_work_id: nullIfEmpty(r.first_attested_work_id ?? ""),
    controversy_level: r.controversy_level || "low",
    resolution: r.resolution ?? "",
    citations: splitSemi(r.citations ?? ""),
  }));
}

// ─── Quotes ──────────────────────────────────────────────────────────────────

interface QuoteJson {
  id: string;
  doctrine_id: string;
  text: string;
  source_type: string;
  author_id: string | null;
  author_name: string;
  work_id: string | null;
  work_reference: string;
  year: number;
  decade_bucket: number;
  stance: string;
  notes: string;
  citations: string[];
}

function buildQuotes(rows: Record<string, string>[]): QuoteJson[] {
  return rows.map((r) => ({
    id: r.id,
    doctrine_id: r.doctrine_id,
    text: r.text ?? "",
    source_type: r.source_type || "primary",
    author_id: nullIfEmpty(r.author_id ?? ""),
    author_name: r.author_name ?? "",
    work_id: nullIfEmpty(r.work_id ?? ""),
    work_reference: r.work_reference ?? "",
    year: parseIntOrNull(r.year ?? "") ?? 0,
    decade_bucket: parseIntOrNull(r.decade_bucket ?? "") ?? 0,
    stance: r.stance || "affirming",
    notes: r.notes ?? "",
    citations: splitSemi(r.citations ?? ""),
  }));
}

// ─── Archaeology ─────────────────────────────────────────────────────────────

interface ArchaeologyJson {
  id: string;
  name_display: string;
  site_type: string;
  city_id: string | null;
  city_ancient: string;
  lat: number | null;
  lon: number | null;
  location_precision: string;
  year_start: number;
  year_end: number | null;
  decade_bucket_start: number;
  description: string;
  significance: string;
  discovery_notes: string;
  current_status: string;
  uncertainty: string;
  citations: string[];
}

function buildArchaeology(rows: Record<string, string>[]): ArchaeologyJson[] {
  return rows.map((r) => ({
    id: r.id,
    name_display: r.name_display,
    site_type: r.site_type || "other",
    city_id: nullIfEmpty(r.city_id ?? ""),
    city_ancient: r.city_ancient ?? "",
    lat: parseFloatOrNull(r.lat ?? ""),
    lon: parseFloatOrNull(r.lon ?? ""),
    location_precision: r.location_precision || "unknown",
    year_start: parseIntOrNull(r.year_start ?? "") ?? 0,
    year_end: parseIntOrNull(r.year_end ?? ""),
    decade_bucket_start: parseIntOrNull(r.decade_bucket_start ?? "") ?? 0,
    description: r.description ?? "",
    significance: r.significance ?? "",
    discovery_notes: r.discovery_notes ?? "",
    current_status: r.current_status || "unknown",
    uncertainty: r.uncertainty ?? "",
    citations: splitSemi(r.citations ?? ""),
  }));
}

// ─── Empires ───────────────────────────────────────────────────────────────────

interface EmpireJson {
  id: string;
  name_display: string;
  name_alt: string[];
  year_start: number;
  year_end: number | null;
  capital: string;
  region: string;
  description: string;
  wikipedia_url: string | null;
  citations: string[];
}

function buildEmpires(rows: Record<string, string>[]): EmpireJson[] {
  return rows.map((r) => ({
    id: r.id,
    name_display: r.name_display,
    name_alt: splitSemi(r.name_alt ?? ""),
    year_start: parseIntOrNull(r.year_start ?? "") ?? 0,
    year_end: parseIntOrNull(r.year_end ?? ""),
    capital: r.capital ?? "",
    region: r.region ?? "",
    description: r.description ?? "",
    wikipedia_url: nullIfEmpty(r.wikipedia_url ?? ""),
    citations: splitSemi(r.citations ?? ""),
  }));
}

// ─── Denominations ───────────────────────────────────────────────────────────

interface DenominationJson {
  id: string;
  name_display: string;
  name_alt: string[];
  tradition: string;
  year_start: number;
  year_end: number | null;
  founder: string;
  parent_tradition: string;
  description: string;
  modern_descendants: string;
  wikipedia_url: string | null;
  citations: string[];
}

function buildDenominations(rows: Record<string, string>[]): DenominationJson[] {
  return rows.map((r) => ({
    id: r.id,
    name_display: r.name_display,
    name_alt: splitSemi(r.name_alt ?? ""),
    tradition: r.tradition ?? "",
    year_start: parseIntOrNull(r.year_start ?? "") ?? 0,
    year_end: parseIntOrNull(r.year_end ?? ""),
    founder: r.founder ?? "",
    parent_tradition: r.parent_tradition ?? "",
    description: r.description ?? "",
    modern_descendants: r.modern_descendants ?? "",
    wikipedia_url: nullIfEmpty(r.wikipedia_url ?? ""),
    citations: splitSemi(r.citations ?? ""),
  }));
}

// ─── Edges ───────────────────────────────────────────────────────────────────

interface EdgeJson {
  id: string;
  source_type: string;
  source_id: string;
  relationship: string;
  target_type: string;
  target_id: string;
  decade_start: number | null;
  decade_end: number | null;
  weight: number;
  notes: string;
  citations: string[];
}

function buildEdges(rows: Record<string, string>[]): EdgeJson[] {
  return rows.map((r) => ({
    id: r.id,
    source_type: r.source_type || "person",
    source_id: r.source_id,
    relationship: r.relationship,
    target_type: r.target_type || "person",
    target_id: r.target_id,
    decade_start: parseIntOrNull(r.decade_start ?? ""),
    decade_end: parseIntOrNull(r.decade_end ?? ""),
    weight: parseIntOrNull(r.weight ?? "") ?? 3,
    notes: r.notes ?? "",
    citations: splitSemi(r.citations ?? ""),
  }));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function readTsv(filename: string): Promise<Record<string, string>[]> {
  try {
    const content = await readFile(resolve(DATA_DIR, filename), "utf8");
    return parseTsvGeneric(content, filename);
  } catch (err) {
    console.warn(`[build:entities] Could not read ${filename}:`, (err as Error).message);
    return [];
  }
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true });

  const [peopleRaw, eventsRaw, worksRaw, doctrinesRaw, quotesRaw, archRaw, edgesRaw, empiresRaw, denomsRaw] =
    await Promise.all([
      readTsv("people.tsv"),
      readTsv("events.tsv"),
      readTsv("works.tsv"),
      readTsv("doctrines.tsv"),
      readTsv("quotes.tsv"),
      readTsv("archaeology.tsv"),
      readTsv("edges.tsv"),
      readTsv("empires.tsv"),
      readTsv("denominations.tsv"),
    ]);

  const people = buildPeople(peopleRaw);
  const events = buildEvents(eventsRaw);
  const works = buildWorks(worksRaw);
  const doctrines = buildDoctrines(doctrinesRaw);
  const quotes = buildQuotes(quotesRaw);
  const archaeology = buildArchaeology(archRaw);
  const edges = buildEdges(edgesRaw);
  const empires = buildEmpires(empiresRaw);
  const denominations = buildDenominations(denomsRaw);

  const writes = [
    { path: resolve(GENERATED_DIR, "people.json"), data: people },
    { path: resolve(GENERATED_DIR, "events.json"), data: events },
    { path: resolve(GENERATED_DIR, "works.json"), data: works },
    { path: resolve(GENERATED_DIR, "doctrines.json"), data: doctrines },
    { path: resolve(GENERATED_DIR, "quotes.json"), data: quotes },
    { path: resolve(GENERATED_DIR, "archaeology.json"), data: archaeology },
    { path: resolve(GENERATED_DIR, "edges.json"), data: edges },
    { path: resolve(GENERATED_DIR, "empires.json"), data: empires },
    { path: resolve(GENERATED_DIR, "denominations.json"), data: denominations },
  ];

  for (const { path, data } of writes) {
    await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    console.log(`[build:entities] Wrote ${path} (${(data as unknown[]).length} items)`);
  }
}

main().catch((error: unknown) => {
  console.error("[build:entities] Failed:", error);
  process.exitCode = 1;
});
