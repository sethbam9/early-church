import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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

type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];
type RawRecord = Record<RequiredColumn, string>;

type TsvRow = Record<string, string>;

type LocationPrecision = "exact" | "approx_city" | "region_only" | "unknown";

const URL_REGEX = /https?:\/\/[^\s<>"'`\])]+/gi;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const FINAL_PATH = resolve(ROOT, "final.tsv");
const AUDIT_DIR = resolve(ROOT, "docs", "final-tsv-audit");

const LEGACY_MAPPINGS_DIR = resolve(ROOT, "data", "mappings");

const OUT_ROOT_DIR = resolve(ROOT, "data", "final_data");
const OUT_MAPPINGS_DIR = resolve(OUT_ROOT_DIR, "mappings");

const OUT_CITIES_PATH = resolve(OUT_ROOT_DIR, "cities.tsv");
const OUT_PERSUASIONS_PATH = resolve(OUT_ROOT_DIR, "persuasions.tsv");
const OUT_PEOPLE_PATH = resolve(OUT_ROOT_DIR, "people.tsv");
const OUT_POLITIES_PATH = resolve(OUT_ROOT_DIR, "polities.tsv");
const OUT_NOTES_PATH = resolve(OUT_ROOT_DIR, "notes.tsv");

const OUT_PLACES_PATH = resolve(OUT_ROOT_DIR, "places.tsv");
const OUT_NOTE_MENTIONS_PATH = resolve(OUT_ROOT_DIR, "note_mentions.tsv");
const OUT_PLACE_STATE_BY_DECADE_PATH = resolve(OUT_ROOT_DIR, "place_state_by_decade.tsv");
const OUT_ENTITY_PLACE_FOOTPRINTS_PATH = resolve(OUT_ROOT_DIR, "entity_place_footprints.tsv");

const IN_DENOMINATIONS_PATH = resolve(OUT_ROOT_DIR, "denominations.tsv");
const IN_PEOPLE_EXTRA_PATH = resolve(OUT_ROOT_DIR, "people-extra.tsv");
const IN_EMPIRES_PATH = resolve(OUT_ROOT_DIR, "empires.tsv");

const IN_WORKS_PATH = resolve(OUT_ROOT_DIR, "works.tsv");
const IN_EVENTS_PATH = resolve(OUT_ROOT_DIR, "events.tsv");
const IN_ARCHAEOLOGY_PATH = resolve(OUT_ROOT_DIR, "archaeology.tsv");
const IN_EDGES_PATH = resolve(OUT_ROOT_DIR, "edges.tsv");
const IN_RELATIONS_PATH = resolve(OUT_ROOT_DIR, "relations.tsv");

const OUT_CITY_KEYS_PATH = resolve(OUT_MAPPINGS_DIR, "city_keys.tsv");
const OUT_CITY_ALIASES_PATH = resolve(OUT_MAPPINGS_DIR, "city_aliases.tsv");
const OUT_PERSUASION_TOKENS_PATH = resolve(OUT_MAPPINGS_DIR, "persuasion_tokens.tsv");
const OUT_PERSON_TOKENS_PATH = resolve(OUT_MAPPINGS_DIR, "person_tokens.tsv");
const OUT_POLITY_TOKENS_PATH = resolve(OUT_MAPPINGS_DIR, "polity_tokens.tsv");
const OUT_COVERAGE_ISSUES_PATH = resolve(OUT_MAPPINGS_DIR, "mapping_coverage_issues.tsv");

function tsvSafe(value: string): string {
  return value.replace(/\t/g, " ").replace(/\r?\n/g, "\\n").trim();
}

function asciiSlug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’'`]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase();

  return normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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
    .filter((part) => part.length > 0);
}

function splitTopLevel(value: string, sep = ";"): string[] {
  const out: string[] = [];
  let buf = "";
  let depth = 0;

  for (const ch of value) {
    if (ch === "(") depth += 1;
    if (ch === ")" && depth > 0) depth -= 1;

    if (ch === sep && depth === 0) {
      const part = buf.trim();
      if (part) out.push(part);
      buf = "";
      continue;
    }

    buf += ch;
  }

  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

function splitParenAwareSemi(value: string): string[] {
  return splitTopLevel(value, ";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function stripParentheticals(value: string): string {
  return value.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

function cleanUrl(value: string): string {
  return value.replace(/[),.;]+$/g, "");
}

function normalizeLocationPrecision(value: string): LocationPrecision {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "exact" ||
    normalized === "approx_city" ||
    normalized === "region_only" ||
    normalized === "unknown"
  ) {
    return normalized;
  }
  if (normalized === "approx_region") {
    return "region_only";
  }
  return "unknown";
}

function isPresenceStatusToken(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "attested" ||
    normalized === "probable" ||
    normalized === "claimed_tradition" ||
    normalized === "claimed tradition" ||
    normalized === "not_attested" ||
    normalized === "suppressed" ||
    normalized === "unknown"
  );
}

function extractCitationUrls(source: string): string[] {
  const matches = source.match(URL_REGEX) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const cleaned = cleanUrl(match);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }

  return out;
}

function validateHeaders(headers: string[]): void {
  if (headers.length !== REQUIRED_COLUMNS.length) {
    throw new Error(
      `final.tsv must have exactly ${REQUIRED_COLUMNS.length} columns; got ${headers.length}.`,
    );
  }

  for (let index = 0; index < REQUIRED_COLUMNS.length; index += 1) {
    const expected = REQUIRED_COLUMNS[index];
    const actual = headers[index];
    if (expected !== actual) {
      throw new Error(
        `final.tsv header mismatch at column ${index + 1}: expected "${expected}" got "${actual}".`,
      );
    }
  }
}

function parseFinalTsv(content: string): RawRecord[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("final.tsv must include header + at least one row.");
  }

  const headers = lines[0].split("\t").map((header) => header.trim());
  validateHeaders(headers);

  const records: RawRecord[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    let columns = rawLine.split("\t");

    if (columns.length > headers.length) {
      columns = [...columns.slice(0, headers.length - 1), columns.slice(headers.length - 1).join("\t")];
    }

    if (columns.length < headers.length) {
      columns = columns.concat(Array.from({ length: headers.length - columns.length }, () => ""));
    }

    const record = {} as RawRecord;
    headers.forEach((header, index) => {
      record[header as RequiredColumn] = (columns[index] ?? "").trim();
    });

    records.push(record);
  }

  return records;
}

function parseGenericTsv(content: string): TsvRow[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 1) return [];

  const headers = lines[0].split("\t").map((h) => h.trim());
  const rows: TsvRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split("\t");
    const row: TsvRow = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = (cols[j] ?? "").trim();
    }

    if (Object.values(row).every((v) => !v.trim())) continue;
    rows.push(row);
  }

  return rows;
}

async function readTsvFile(path: string): Promise<TsvRow[]> {
  const content = await readFile(path, "utf8");
  return parseGenericTsv(content);
}

async function tryReadTsvFile(path: string): Promise<TsvRow[] | null> {
  try {
    return await readTsvFile(path);
  } catch {
    return null;
  }
}

async function writeTsv(path: string, headers: string[], rows: string[][]): Promise<void> {
  const content = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n") + "\n";
  await writeFile(path, content, "utf8");
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function normalizeSetValue(values: string[]): string {
  return sortedUnique(values.map((v) => v.trim()).filter(Boolean)).join(";");
}

function flatten<T>(values: T[][]): T[] {
  const out: T[] = [];
  for (const inner of values) {
    out.push(...inner);
  }
  return out;
}

function stableHash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 10);
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

function extractBracketMentions(bodyMd: string): Array<{ type: string; slug: string }> {
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

function titleCaseFromSlug(slug: string): string {
  if (slug === "church-of-the-east") return "Church of the East";
  if (slug === "jewish-christian") return "Jewish Christian";
  if (slug === "miaphysite") return "Miaphysite";

  return slug
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

const CANON_PERSUASION_LABELS: Record<string, string> = {
  anglican: "Anglican",
  anomoian: "Anomoian",
  arian: "Arian",
  adoptionist: "Adoptionist",
  basilidean: "Basilidean",
  bardaisanite: "Bardaisanite",
  catholic: "Catholic",
  "church-of-the-east": "Church of the East",
  donatist: "Donatist",
  ebionite: "Ebionite",
  encratite: "Encratite",
  gnostic: "Gnostic",
  homoian: "Homoian",
  homoiousian: "Homoiousian (Semi-Arian)",
  "jewish-christian": "Jewish Christian",
  manichaean: "Manichaean",
  marcionite: "Marcionite",
  miaphysite: "Miaphysite",
  modalist: "Modalist (Sabellian)",
  montanist: "Montanist",
  nazarene: "Nazarene",
  nicene: "Nicene",
  novatianist: "Novatianist",
  orthodox: "Orthodox",
  ophite: "Ophite/Naassene",
  paulianist: "Paulianist",
  pelagian: "Pelagian",
  "proto-orthodox": "Proto-Orthodox",
  protestant: "Protestant",
  quartodeciman: "Quartodeciman",
  sethian: "Sethian",
  tatianist: "Tatianist",
  valentinian: "Valentinian",
};

function canonicalPersuasionLabel(slug: string): string {
  return CANON_PERSUASION_LABELS[slug] ?? titleCaseFromSlug(slug);
}

const CANON_PERSUASION_STREAMS: Record<string, string> = {
  anglican: "apostolic",
  catholic: "apostolic",
  orthodox: "apostolic",
  "proto-orthodox": "apostolic",
  nicene: "theological_party",
  miaphysite: "apostolic",
  "church-of-the-east": "apostolic",
  donatist: "schism",
  "meletian-schism": "schism",
  novatianist: "schism",
  quartodeciman: "practice",
  arian: "theological_party",
  homoian: "theological_party",
  homoiousian: "theological_party",
  anomoian: "theological_party",
  pelagian: "theological_party",
  modalist: "theological_party",
  adoptionist: "theological_party",
  paulianist: "theological_party",
  monarchian: "theological_party",
  "jewish-christian": "jewish_christian",
  ebionite: "jewish_christian",
  nazarene: "jewish_christian",
  gnostic: "gnostic",
  valentinian: "gnostic",
  basilidean: "gnostic",
  sethian: "gnostic",
  ophite: "gnostic",
  marcionite: "gnostic",
  manichaean: "gnostic",
  encratite: "ascetic",
  tatianist: "ascetic",
  montanist: "prophetic",
  bardaisanite: "gnostic",
  maronite: "apostolic",
  "eustathian-ascetic": "ascetic",
};

function canonicalPersuasionStream(slug: string): string {
  return CANON_PERSUASION_STREAMS[slug] ?? "";
}

function denomIdToPersuasionSlug(denomId: string): string | null {
  const id = denomId.trim().toLowerCase();
  if (!id) return null;
  if (id === "jewish-christianity") return "jewish-christian";
  if (id === "gnosticism") return "gnostic";
  if (id === "marcionism") return "marcionite";
  if (id === "arianism") return "arian";
  if (id === "donatism") return "donatist";
  if (id === "montanism") return "montanist";
  if (id === "pelagianism") return "pelagian";
  if (id === "novatianist") return "novatianist";
  if (id === "proto-orthodox") return "proto-orthodox";
  if (id === "nicene-orthodox") return "orthodox";
  if (id === "miaphysite") return "miaphysite";
  if (id === "church-of-the-east") return "church-of-the-east";

  if (id.endsWith("ism")) {
    const maybe = id.slice(0, -3);
    return maybe || null;
  }

  return null;
}

function parseCityOfOriginId(value: string): string {
  const v = value.trim();
  if (!v) return "";
  return v.replace(/^\d{4}-/, "");
}

function suggestPolitySlug(rawToken: string, empireIds: Set<string>): string {
  const token = rawToken.trim();
  if (!token) return "";

  const baseNormalized = stripParentheticals(token).trim().toLowerCase();
  if (
    empireIds.has("sassanid-empire") &&
    (baseNormalized.includes("sasanian") || baseNormalized.includes("sasanid") || baseNormalized.includes("sassanid"))
  ) {
    return "sassanid-empire";
  }

  const baseSlug = asciiSlug(baseNormalized);
  if (baseSlug && empireIds.has(baseSlug)) {
    return baseSlug;
  }

  const fullSlug = asciiSlug(token);
  if (fullSlug && empireIds.has(fullSlug)) {
    return fullSlug;
  }

  return fullSlug;
}

function normalizeEvidenceText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isMetaPersuasionToken(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  const base = stripParentheticals(value).trim().toLowerCase();
  return (
    normalized === "multiple heirs" ||
    normalized === "multiple heirs (latin west)" ||
    normalized === "multiple heirs (extinct community)" ||
    normalized === "multiple heirs (extinct)" ||
    normalized === "catholic heirs" ||
    normalized === "orthodox heirs" ||
    normalized === "protestant heirs" ||
    normalized === "church of the east heirs" ||
    normalized === "church-of-the-east heirs" ||
    base === "multiple" ||
    base === "unknown" ||
    base === "unknown/composite" ||
    base === "unknown / composite"
  );
}

function suggestPersuasionSlugs(rawToken: string): string[] {
  const token = rawToken.trim();
  if (!token) return [];

  const tokenLower = token.toLowerCase();
  if (tokenLower.includes("quartodeciman")) {
    const out: string[] = [];
    if (tokenLower.includes("proto-orthodox")) out.push("proto-orthodox");
    out.push("quartodeciman");
    return out;
  }
  if (tokenLower.startsWith("anti-")) {
    return ["proto-orthodox"];
  }
  if (tokenLower.includes("opposition")) {
    if (tokenLower.includes("arian")) {
      return ["nicene"];
    }
    return ["proto-orthodox"];
  }

  const base = stripParentheticals(token)
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+vs\.?\s+/gi, " / ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = base.includes("/") ? base.split("/").map((p) => p.trim()).filter(Boolean) : [base];

  const out = new Set<string>();

  for (const part of parts) {
    const n = part.toLowerCase();

    if (n.includes("bardaisan") || n.includes("bardesan")) {
      out.add("bardaisanite");
      continue;
    }
    if (n.includes("basilidean")) {
      out.add("basilidean");
      continue;
    }
    if (n.includes("valentin")) {
      out.add("valentinian");
      continue;
    }
    if (n.includes("sethian")) {
      out.add("sethian");
      continue;
    }
    if (n.includes("ophite") || n.includes("naassene")) {
      out.add("ophite");
      continue;
    }
    if (n.includes("manicha")) {
      out.add("manichaean");
      continue;
    }
    if (n.includes("encratit")) {
      out.add("encratite");
      continue;
    }
    if (n.includes("tatian")) {
      out.add("tatianist");
      continue;
    }
    if (n.includes("ebion")) {
      out.add("ebionite");
      continue;
    }
    if (n.includes("nazarene")) {
      out.add("nazarene");
      continue;
    }
    if (n.includes("quartodeciman")) {
      out.add("quartodeciman");
      if (n.includes("proto-orthodox")) out.add("proto-orthodox");
      continue;
    }
    if (n.includes("nicene")) {
      out.add("nicene");
      continue;
    }
    if (n.includes("proto-orthodox")) {
      out.add("proto-orthodox");
      continue;
    }
    if (n.includes("donat")) {
      out.add("donatist");
      continue;
    }
    if (n.includes("anomoian") || n.includes("eunom")) {
      out.add("anomoian");
      continue;
    }
    if (n.includes("homoian")) {
      out.add("homoian");
      continue;
    }
    if (n.includes("homoiousian") || n.includes("semi-arian") || n.includes("semi arian")) {
      out.add("homoiousian");
      continue;
    }
    if (n.includes("arian")) {
      out.add("arian");
      continue;
    }
    if (n.includes("montan")) {
      out.add("montanist");
      continue;
    }
    if (n.includes("gnostic")) {
      out.add("gnostic");
      continue;
    }
    if (n.includes("marcion")) {
      out.add("marcionite");
      continue;
    }
    if (n.includes("jewish") && n.includes("christ")) {
      out.add("jewish-christian");
      continue;
    }
    if (n.includes("church of the east") || n.includes("assyrian") || n.includes("east syriac")) {
      out.add("church-of-the-east");
      continue;
    }
    if (
      n.includes("oriental orthodox") ||
      n.includes("miaphys") ||
      n.includes("coptic orthodox") ||
      n.includes("armenian apostolic") ||
      n.includes("ethiopian orthodox") ||
      n.includes("syriac orthodox")
    ) {
      out.add("miaphysite");
      continue;
    }
    if (n.includes("novatian") || n.includes("rigorist")) {
      out.add("novatianist");
      continue;
    }
    if (n.includes("pelagian")) {
      out.add("pelagian");
      continue;
    }
    if (n.includes("sabell") || n.includes("modalist")) {
      out.add("modalist");
      continue;
    }
    if (n.includes("adoption") || n.includes("dynamic monarch")) {
      out.add("adoptionist");
      continue;
    }
    if (n.includes("paulian") || n.includes("paul of samosata")) {
      out.add("paulianist");
      continue;
    }
    if (n.includes("protestant")) {
      out.add("protestant");
      continue;
    }
    if (n.includes("anglican")) {
      out.add("anglican");
      continue;
    }
    if (n.includes("catholic")) {
      out.add("catholic");
      continue;
    }
    if (n.includes("orthodox")) {
      out.add("orthodox");
      continue;
    }

    out.add(asciiSlug(part));
  }

  return Array.from(out.values()).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function rankPresenceStatus(value: string): number {
  const normalized = value.trim().toLowerCase();
  if (normalized === "attested") return 6;
  if (normalized === "suppressed") return 5;
  if (normalized === "probable") return 4;
  if (normalized === "claimed_tradition" || normalized === "claimed tradition") return 3;
  if (normalized === "unknown") return 2;
  if (normalized === "not_attested") return 1;
  return 0;
}

async function main(): Promise<void> {
  await mkdir(OUT_MAPPINGS_DIR, { recursive: true });

  const [inventoryCities, inventoryPeople, inventoryPolities] = await Promise.all([
    readTsvFile(resolve(AUDIT_DIR, "inventory_cities.tsv")),
    readTsvFile(resolve(AUDIT_DIR, "inventory_key_figures.tsv")),
    readTsvFile(resolve(AUDIT_DIR, "inventory_polities.tsv")),
  ]);

  const mappingCityKeys = await tryReadTsvFile(OUT_CITY_KEYS_PATH);
  const mappingCityAliases = await tryReadTsvFile(OUT_CITY_ALIASES_PATH);
  const mappingPeople = await tryReadTsvFile(OUT_PERSON_TOKENS_PATH);
  const mappingPolities = await tryReadTsvFile(OUT_POLITY_TOKENS_PATH);

  const cityKeyToSlug = new Map<string, string>();
  const cityKeyToLabel = new Map<string, string>();

  if (mappingCityKeys) {
    for (const row of mappingCityKeys) {
      const rawAncient = row.raw_city_ancient?.trim();
      const rawCountry = row.raw_country_modern?.trim();
      const slug = row.canonical_city_slug?.trim();
      const label = row.canonical_city_label?.trim();
      if (!rawAncient || !rawCountry || !slug) continue;
      cityKeyToSlug.set(`${rawAncient}|||${rawCountry}`, slug);
      if (label) cityKeyToLabel.set(slug, label);
    }
  } else {
    for (const row of inventoryCities) {
      const rawAncient = row.city_ancient?.trim();
      const rawCountry = row.country_modern?.trim();
      const slug = row.city_id_suggested?.trim();
      const label = row.city_ancient_mode?.trim() || rawAncient;
      if (!rawAncient || !rawCountry || !slug) continue;
      cityKeyToSlug.set(`${rawAncient}|||${rawCountry}`, slug);
      cityKeyToLabel.set(slug, label);
    }
  }

  const cityAliasToSlug = new Map<string, string>();
  if (mappingCityAliases) {
    for (const row of mappingCityAliases) {
      const alias = row.alias?.trim();
      const slug = row.canonical_city_slug?.trim();
      if (!alias || !slug) continue;
      cityAliasToSlug.set(alias, slug);
    }
  }

  const personRawToSlug = new Map<string, string>();
  const personCanonToSlug = new Map<string, string>();

  if (mappingPeople) {
    for (const row of mappingPeople) {
      const rawToken = row.raw_person_token?.trim();
      const slug = row.canonical_person_slug?.trim();
      const label = row.canonical_person_label?.trim();
      if (rawToken && slug) personRawToSlug.set(rawToken, slug);
      if (label && slug) personCanonToSlug.set(label, slug);
    }
  } else {
    for (const row of inventoryPeople) {
      const canon = row.canonical_name?.trim();
      const slug = row.person_id_suggested?.trim();
      if (!canon || !slug) continue;
      personCanonToSlug.set(canon, slug);
    }
  }

  const polityTokenToSlug = new Map<string, string>();
  const politySlugToLabel = new Map<string, string>();

  const persuasionTokenToSlugs = new Map<string, string[]>();
  const persuasionSlugToLabel = new Map<string, string>();

  const finalContent = await readFile(FINAL_PATH, "utf8");
  const finalRecords = parseFinalTsv(finalContent);

  const [denominationsRows, peopleExtraRows, empiresRows, worksRows, eventsRows, archaeologyRows, edgesRows, relationsRows] =
    await Promise.all([
      tryReadTsvFile(IN_DENOMINATIONS_PATH),
      tryReadTsvFile(IN_PEOPLE_EXTRA_PATH),
      tryReadTsvFile(IN_EMPIRES_PATH),
      tryReadTsvFile(IN_WORKS_PATH),
      tryReadTsvFile(IN_EVENTS_PATH),
      tryReadTsvFile(IN_ARCHAEOLOGY_PATH),
      tryReadTsvFile(IN_EDGES_PATH),
      tryReadTsvFile(IN_RELATIONS_PATH),
    ]);

  const persuasionMetaBySlug = new Map<
    string,
    { year_start: string; year_end: string; description: string; wikipedia_url: string; citations: string }
  >();

  if (denominationsRows) {
    for (const row of denominationsRows) {
      const denomId = row.id?.trim();
      if (!denomId) continue;
      const slug = denomIdToPersuasionSlug(denomId);
      if (!slug) continue;

      persuasionMetaBySlug.set(slug, {
        year_start: row.year_start?.trim() ?? "",
        year_end: row.year_end?.trim() ?? "",
        description: row.description?.trim() ?? "",
        wikipedia_url: row.wikipedia_url?.trim() ?? "",
        citations: row.citations?.trim() ?? "",
      });
    }
  }

  const peopleExtraBySlug = new Map<string, TsvRow>();
  if (peopleExtraRows) {
    for (const row of peopleExtraRows) {
      const id = row.id?.trim();
      if (!id) continue;
      peopleExtraBySlug.set(id, row);
    }
  }

  const empireBySlug = new Map<string, TsvRow>();
  if (empiresRows) {
    for (const row of empiresRows) {
      const id = row.id?.trim();
      if (!id) continue;
      empireBySlug.set(id, row);
    }
  }

  const empireIds = new Set<string>(Array.from(empireBySlug.keys()));

  const polityTokensUniverse = new Set<string>();
  for (const record of finalRecords) {
    const token = record.ruling_empire_polity.trim();
    if (!token) continue;
    polityTokensUniverse.add(token);
  }

  for (const rawToken of Array.from(polityTokensUniverse.values()).sort((a, b) => a.localeCompare(b))) {
    const slug = suggestPolitySlug(rawToken, empireIds);
    if (!slug) continue;
    polityTokenToSlug.set(rawToken, slug);

    const empire = empireBySlug.get(slug);
    politySlugToLabel.set(slug, empire?.name_display?.trim() ?? rawToken);
  }

  const rawPersuasionTokensUniverse = new Set<string>();
  for (const record of finalRecords) {
    for (const token of splitParenAwareSemi(record.denomination_label_historic)) {
      if (!token || isPresenceStatusToken(token)) continue;
      rawPersuasionTokensUniverse.add(token);
    }
    for (const token of splitParenAwareSemi(record.modern_denom_mapping)) {
      if (!token || isMetaPersuasionToken(token)) continue;
      rawPersuasionTokensUniverse.add(token);
    }
  }

  for (const raw of Array.from(rawPersuasionTokensUniverse.values()).sort((a, b) => a.localeCompare(b))) {
    const slugs = suggestPersuasionSlugs(raw);
    if (slugs.length === 0) continue;
    persuasionTokenToSlugs.set(raw, slugs);
    if (slugs.length === 1) {
      persuasionSlugToLabel.set(slugs[0], canonicalPersuasionLabel(slugs[0]));
    }
  }

  const usedCitySlugs = new Set<string>();
  const usedPersonSlugs = new Set<string>();
  const usedPolitySlugs = new Set<string>();
  const usedPersuasionSlugs = new Set<string>();

  const citySlugToRows = new Map<string, RawRecord[]>();

  const citySlugToStartCandidates = new Map<
    string,
    { yearBucketMin: number | null; plantedScholarlyMin: number | null; plantedEarliestMin: number | null }
  >();

  const missingCoverageIssues = new Map<string, number>();

  function recordCoverageIssue(kind: string, rawValue: string): void {
    const key = `${kind}::${rawValue}`;
    missingCoverageIssues.set(key, (missingCoverageIssues.get(key) ?? 0) + 1);
  }

  for (const record of finalRecords) {
    const cityAncient = record.city_ancient.trim();
    const countryModern = record.country_modern.trim();

    const citySlug = cityKeyToSlug.get(`${cityAncient}|||${countryModern}`) ?? asciiSlug(`${cityAncient}-${countryModern}`);
    if (!cityKeyToSlug.has(`${cityAncient}|||${countryModern}`)) {
      recordCoverageIssue("missing_city_key", `${cityAncient}|||${countryModern}`);
    }

    if (!citySlugToRows.has(citySlug)) citySlugToRows.set(citySlug, []);
    citySlugToRows.get(citySlug)?.push(record);
    usedCitySlugs.add(citySlug);

    const yearBucket = parseIntOrNull(record.year_bucket);
    const plantedScholarly = parseIntOrNull(record.church_planted_year_scholarly);
    const plantedEarliest = parseIntOrNull(record.church_planted_year_earliest_claim);

    const current = citySlugToStartCandidates.get(citySlug) ?? {
      yearBucketMin: null,
      plantedScholarlyMin: null,
      plantedEarliestMin: null,
    };

    citySlugToStartCandidates.set(citySlug, {
      yearBucketMin:
        yearBucket === null
          ? current.yearBucketMin
          : current.yearBucketMin === null
            ? yearBucket
            : Math.min(current.yearBucketMin, yearBucket),
      plantedScholarlyMin:
        plantedScholarly === null
          ? current.plantedScholarlyMin
          : current.plantedScholarlyMin === null
            ? plantedScholarly
            : Math.min(current.plantedScholarlyMin, plantedScholarly),
      plantedEarliestMin:
        plantedEarliest === null
          ? current.plantedEarliestMin
          : current.plantedEarliestMin === null
            ? plantedEarliest
            : Math.min(current.plantedEarliestMin, plantedEarliest),
    });

    for (const rawToken of splitTopLevel(record.key_figures)) {
      const token = rawToken.trim();
      if (!token) continue;
      const slug = personRawToSlug.get(token) ?? personCanonToSlug.get(stripParentheticals(token)) ?? asciiSlug(stripParentheticals(token) || token);
      usedPersonSlugs.add(slug);
    }

    const polityRaw = record.ruling_empire_polity.trim();
    if (polityRaw) {
      const politySlug = polityTokenToSlug.get(polityRaw) ?? asciiSlug(polityRaw);
      usedPolitySlugs.add(politySlug);
      if (!polityTokenToSlug.has(polityRaw)) {
        recordCoverageIssue("missing_polity_token", polityRaw);
      }
    }

    const rawPersuasionTokens = [
      ...splitParenAwareSemi(record.denomination_label_historic).filter((t) => !isPresenceStatusToken(t)),
      ...splitParenAwareSemi(record.modern_denom_mapping).filter((t) => !isMetaPersuasionToken(t)),
    ];

    for (const token of rawPersuasionTokens) {
      const raw = token.trim();
      if (!raw) continue;
      if (!persuasionTokenToSlugs.has(raw)) {
        const slugs = suggestPersuasionSlugs(raw);
        if (slugs.length > 0) {
          persuasionTokenToSlugs.set(raw, slugs);
        }
      }

      const slugs = persuasionTokenToSlugs.get(raw);
      if (!slugs || slugs.length === 0) {
        recordCoverageIssue("missing_persuasion_token", raw);
        continue;
      }

      for (const slug of slugs) {
        usedPersuasionSlugs.add(slug);
      }
    }
  }

  const cityKeyRows: string[][] = [];
  const cityAliasRows: string[][] = [];

  const cityKeySeen = new Set<string>();
  const cityAliasSeen = new Set<string>();

  if (mappingCityKeys) {
    for (const row of mappingCityKeys) {
      const rawAncient = row.raw_city_ancient?.trim();
      const rawCountry = row.raw_country_modern?.trim();
      const rawModern = row.raw_city_modern?.trim() ?? "";
      const slug = row.canonical_city_slug?.trim();
      const label = row.canonical_city_label?.trim() ?? "";
      const notes = row.notes?.trim() ?? "";
      if (!rawAncient || !rawCountry || !slug) continue;
      if (!usedCitySlugs.has(slug)) continue;
      const key = `${rawAncient}\t${rawCountry}\t${rawModern}\t${slug}`;
      if (cityKeySeen.has(key)) continue;
      cityKeySeen.add(key);
      cityKeyRows.push([
        tsvSafe(rawAncient),
        tsvSafe(rawCountry),
        tsvSafe(rawModern),
        tsvSafe(slug),
        tsvSafe(label),
        tsvSafe(notes),
      ]);
    }
  } else {
    for (const [key, slug] of cityKeyToSlug.entries()) {
      if (!usedCitySlugs.has(slug)) continue;
      const [rawAncient, rawCountry] = key.split("|||");
      const label = cityKeyToLabel.get(slug) ?? rawAncient;
      const k = `${rawAncient}\t${rawCountry}\t\t${slug}`;
      if (cityKeySeen.has(k)) continue;
      cityKeySeen.add(k);
      cityKeyRows.push([tsvSafe(rawAncient), tsvSafe(rawCountry), "", tsvSafe(slug), tsvSafe(label), ""]);
    }
  }

  cityKeyRows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

  if (mappingCityAliases) {
    for (const row of mappingCityAliases) {
      const alias = row.alias?.trim();
      const slug = row.canonical_city_slug?.trim();
      const kind = row.alias_kind?.trim() ?? "other";
      if (!alias || !slug) continue;
      if (!usedCitySlugs.has(slug)) continue;
      const key = `${alias}\t${slug}\t${kind}`;
      if (cityAliasSeen.has(key)) continue;
      cityAliasSeen.add(key);
      cityAliasRows.push([tsvSafe(alias), tsvSafe(slug), tsvSafe(kind)]);
    }
  } else {
    for (const [alias, slug] of cityAliasToSlug.entries()) {
      if (!usedCitySlugs.has(slug)) continue;
      const key = `${alias}\t${slug}\tother`;
      if (cityAliasSeen.has(key)) continue;
      cityAliasSeen.add(key);
      cityAliasRows.push([tsvSafe(alias), tsvSafe(slug), "other"]);
    }
  }

  cityAliasRows.sort((a, b) => a[0].localeCompare(b[0]));

  const persuasionTokenRows: string[][] = [];
  const persuasionTokensSorted = Array.from(persuasionTokenToSlugs.keys()).sort((a, b) => a.localeCompare(b));
  for (const raw of persuasionTokensSorted) {
    if (isMetaPersuasionToken(raw)) continue;
    const slugs = persuasionTokenToSlugs.get(raw) ?? [];
    if (slugs.length === 0) continue;
    if (slugs.length === 1 && slugs[0] === "multiple") continue;
    const label = slugs.length === 1 ? canonicalPersuasionLabel(slugs[0]) : raw;
    const notes = "";
    persuasionTokenRows.push([tsvSafe(raw), tsvSafe(slugs.join(";")), tsvSafe(label), tsvSafe(notes)]);
  }

  const personTokenRows: string[][] = [];
  if (mappingPeople) {
    for (const row of mappingPeople) {
      const raw = row.raw_person_token?.trim();
      const slug = row.canonical_person_slug?.trim();
      const label = row.canonical_person_label?.trim() ?? "";
      const note = row.disambiguation_note?.trim() ?? "";
      if (!raw || !slug) continue;
      if (!usedPersonSlugs.has(slug)) continue;
      personTokenRows.push([tsvSafe(raw), tsvSafe(slug), tsvSafe(label), tsvSafe(note)]);
    }
  } else {
    for (const [canon, slug] of personCanonToSlug.entries()) {
      if (!usedPersonSlugs.has(slug)) continue;
      personTokenRows.push([tsvSafe(canon), tsvSafe(slug), tsvSafe(canon), ""]);
    }
  }
  personTokenRows.sort((a, b) => a[0].localeCompare(b[0]));

  const polityTokenRows: string[][] = [];
  for (const [raw, slug] of polityTokenToSlug.entries()) {
    if (!usedPolitySlugs.has(slug)) continue;
    polityTokenRows.push([tsvSafe(raw), tsvSafe(slug), tsvSafe(politySlugToLabel.get(slug) ?? raw)]);
  }
  polityTokenRows.sort((a, b) => a[0].localeCompare(b[0]));

  const coverageIssueRows: string[][] = [];
  for (const [key, mentions] of missingCoverageIssues.entries()) {
    const [kind, rawValue] = key.split("::");
    coverageIssueRows.push([tsvSafe(kind), tsvSafe(rawValue ?? ""), String(mentions)]);
  }
  coverageIssueRows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

  await writeTsv(
    OUT_CITY_KEYS_PATH,
    ["raw_city_ancient", "raw_country_modern", "raw_city_modern", "canonical_city_slug", "canonical_city_label", "notes"],
    cityKeyRows,
  );

  await writeTsv(OUT_CITY_ALIASES_PATH, ["alias", "canonical_city_slug", "alias_kind"], cityAliasRows);

  await writeTsv(
    OUT_PERSUASION_TOKENS_PATH,
    ["raw_persuasion_token", "canonical_persuasion_slugs", "canonical_persuasion_label", "notes"],
    persuasionTokenRows,
  );

  await writeTsv(
    OUT_PERSON_TOKENS_PATH,
    ["raw_person_token", "canonical_person_slug", "canonical_person_label", "disambiguation_note"],
    personTokenRows,
  );

  await writeTsv(
    OUT_POLITY_TOKENS_PATH,
    ["raw_polity_token", "canonical_polity_slug", "canonical_polity_label"],
    polityTokenRows,
  );

  await writeTsv(OUT_COVERAGE_ISSUES_PATH, ["issue_kind", "raw_value", "row_mentions"], coverageIssueRows);

  const citySlugToPrimary = new Map<
    string,
    {
      city_ancient_primary: string;
      city_modern_primary: string;
      country_modern_primary: string;
      lat: string;
      lon: string;
      location_precision: LocationPrecision;
    }
  >();

  for (const row of inventoryCities) {
    const slug = row.city_id_suggested?.trim();
    if (!slug) continue;
    if (!usedCitySlugs.has(slug)) continue;
    if (citySlugToPrimary.has(slug)) continue;

    citySlugToPrimary.set(slug, {
      city_ancient_primary: row.city_ancient_mode?.trim() ?? "",
      city_modern_primary: row.city_modern_mode?.trim() ?? "",
      country_modern_primary: row.country_modern?.trim() ?? "",
      lat: row.lat_mode?.trim() ?? "",
      lon: row.lon_mode?.trim() ?? "",
      location_precision: normalizeLocationPrecision(row.location_precision_mode ?? ""),
    });
  }

  const cityEntityRows: string[][] = [];
  for (const [slug, primary] of citySlugToPrimary.entries()) {
    const candidates = citySlugToStartCandidates.get(slug);
    const startYear =
      candidates?.plantedScholarlyMin ?? candidates?.plantedEarliestMin ?? candidates?.yearBucketMin ?? null;

    const label = cityKeyToLabel.get(slug) ?? primary.city_ancient_primary ?? slug;

    cityEntityRows.push([
      tsvSafe(slug),
      tsvSafe(label),
      tsvSafe(primary.city_ancient_primary),
      tsvSafe(primary.city_modern_primary),
      tsvSafe(primary.country_modern_primary),
      tsvSafe(primary.lat),
      tsvSafe(primary.lon),
      tsvSafe(normalizeLocationPrecision(primary.location_precision)),
      startYear === null ? "" : String(startYear),
    ]);
  }

  cityEntityRows.sort((a, b) => a[1].localeCompare(b[1]));

  await writeTsv(
    OUT_CITIES_PATH,
    [
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
    cityEntityRows,
  );

  const persuasionEntityRows: string[][] = [];
  const seenPersuasion = new Set<string>();
  const extraPersuasionSlugs = [
    "proto-orthodox",
    "nicene",
    "homoian",
    "homoiousian",
    "anomoian",
    "quartodeciman",
    "ebionite",
    "nazarene",
    "valentinian",
    "jewish-christian",
    "basilidean",
    "sethian",
    "ophite",
    "manichaean",
    "encratite",
    "tatianist",
    "modalist",
    "adoptionist",
    "paulianist",
  ];

  for (const slug of Array.from(new Set([...usedPersuasionSlugs.values(), ...extraPersuasionSlugs])).sort((a, b) => a.localeCompare(b))) {
    if (seenPersuasion.has(slug)) continue;
    seenPersuasion.add(slug);
    const label = canonicalPersuasionLabel(slug);
    const stream = canonicalPersuasionStream(slug);

    const meta = persuasionMetaBySlug.get(slug);
    persuasionEntityRows.push([
      tsvSafe(slug),
      tsvSafe(label),
      tsvSafe(stream),
      tsvSafe(meta?.year_start ?? ""),
      tsvSafe(meta?.year_end ?? ""),
      tsvSafe(meta?.description ?? ""),
      tsvSafe(meta?.wikipedia_url ?? ""),
      tsvSafe(meta?.citations ?? ""),
      "",
    ]);
  }

  await writeTsv(
    OUT_PERSUASIONS_PATH,
    [
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
    persuasionEntityRows,
  );

  const peopleEntityRows: string[][] = [];
  const seenPeople = new Set<string>();

  function addPersonRow(slug: string, label: string): void {
    if (seenPeople.has(slug)) return;
    seenPeople.add(slug);

    const extra = peopleExtraBySlug.get(slug);
    peopleEntityRows.push([
      tsvSafe(slug),
      tsvSafe(extra?.name_display?.trim() ?? label),
      tsvSafe(extra?.name_alt?.trim() ?? ""),
      tsvSafe(extra?.birth_year?.trim() ?? ""),
      tsvSafe(extra?.death_year?.trim() ?? ""),
      tsvSafe(extra?.death_type?.trim() ?? ""),
      tsvSafe(extra?.roles?.trim() ?? ""),
      tsvSafe(parseCityOfOriginId(extra?.city_of_origin_id?.trim() ?? "")),
      tsvSafe(extra?.apostolic_connection?.trim() ?? ""),
      tsvSafe(extra?.description?.trim() ?? ""),
      tsvSafe(extra?.wikipedia_url?.trim() ?? ""),
      tsvSafe(extra?.citations?.trim() ?? ""),
      "",
    ]);
  }

  for (const [raw, slug] of personRawToSlug.entries()) {
    if (!usedPersonSlugs.has(slug)) continue;
    addPersonRow(slug, stripParentheticals(raw) || raw);
  }

  for (const [canon, slug] of personCanonToSlug.entries()) {
    if (!usedPersonSlugs.has(slug)) continue;
    addPersonRow(slug, canon);
  }

  for (const slug of Array.from(peopleExtraBySlug.keys()).sort((a, b) => a.localeCompare(b))) {
    const extra = peopleExtraBySlug.get(slug);
    if (!extra) continue;
    addPersonRow(slug, extra.name_display?.trim() ?? slug);
  }

  peopleEntityRows.sort((a, b) => a[1].localeCompare(b[1]));

  await writeTsv(
    OUT_PEOPLE_PATH,
    [
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
    peopleEntityRows,
  );

  const polityEntityRows: string[][] = [];
  const seenPolity = new Set<string>();

  function addPolityRow(slug: string, label: string): void {
    if (seenPolity.has(slug)) return;
    seenPolity.add(slug);

    const empire = empireBySlug.get(slug);
    polityEntityRows.push([
      tsvSafe(slug),
      tsvSafe(empire?.name_display?.trim() ?? label),
      tsvSafe(empire?.name_alt?.trim() ?? ""),
      tsvSafe(empire?.year_start?.trim() ?? ""),
      tsvSafe(empire?.year_end?.trim() ?? ""),
      tsvSafe(empire?.capital?.trim() ?? ""),
      tsvSafe(empire?.region?.trim() ?? ""),
      tsvSafe(empire?.description?.trim() ?? ""),
      tsvSafe(empire?.wikipedia_url?.trim() ?? ""),
      tsvSafe(empire?.citations?.trim() ?? ""),
    ]);
  }

  for (const [token, slug] of polityTokenToSlug.entries()) {
    if (!usedPolitySlugs.has(slug)) continue;
    addPolityRow(slug, politySlugToLabel.get(slug) ?? token);
  }

  for (const slug of Array.from(empireBySlug.keys()).sort((a, b) => a.localeCompare(b))) {
    const empire = empireBySlug.get(slug);
    if (!empire) continue;
    addPolityRow(slug, empire.name_display?.trim() ?? slug);
  }

  polityEntityRows.sort((a, b) => a[1].localeCompare(b[1]));

  await writeTsv(
    OUT_POLITIES_PATH,
    [
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
    polityEntityRows,
  );

  const noteRows: string[][] = [];
  const noteSeen = new Set<string>();

  const noteMentionRows: string[][] = [];
  const noteMentionSeen = new Set<string>();

  const placeStateByDecadeRows: string[][] = [];

  function addNote(row: string[]): string {
    const noteId = stableHash(row.join("\t"));
    const fullRow = [...row, noteId];
    const key = fullRow.join("\t");
    if (noteSeen.has(key)) return noteId;
    noteSeen.add(key);
    noteRows.push(fullRow);

    const bodyMd = row[7] ?? "";
    if (bodyMd) {
      for (const mention of extractBracketMentions(bodyMd)) {
        const mKey = `${noteId}::${mention.type}::${mention.slug}`;
        if (noteMentionSeen.has(mKey)) continue;
        noteMentionSeen.add(mKey);
        noteMentionRows.push([noteId, mention.type, mention.slug]);
      }
    }

    return noteId;
  }

  function addStateNote(params: {
    citySlug: string;
    yearBucket: number;
    stateKey: string;
    stateValue: string;
  }): void {
    const stateValue = params.stateValue.trim();
    addNote([
      String(params.yearBucket),
      "",
      "city",
      tsvSafe(params.citySlug),
      "state",
      tsvSafe(params.stateKey),
      tsvSafe(stateValue),
      "",
      "",
    ]);
  }

  for (const [citySlug, records] of citySlugToRows.entries()) {
    const sorted = [...records].sort(
      (a, b) => (parseIntOrNull(a.year_bucket) ?? 0) - (parseIntOrNull(b.year_bucket) ?? 0),
    );

    const byYear = new Map<number, RawRecord[]>();
    for (const record of sorted) {
      const yearBucket = parseIntOrNull(record.year_bucket);
      if (yearBucket === null) continue;
      if (!byYear.has(yearBucket)) byYear.set(yearBucket, []);
      byYear.get(yearBucket)?.push(record);
    }

    const years = Array.from(byYear.keys()).sort((a, b) => a - b);

    let prevPresence: string | null = null;
    let prevPersuasions: string | null = null;
    let prevPolity: string | null = null;
    let prevSubdivision: string | null = null;
    let prevPlantedScholarly: string | null = null;
    let prevPlantedEarliest: string | null = null;
    let prevPlantedBy: string | null = null;
    let prevApostolicThread: string | null = null;
    let prevCouncilContext: string | null = null;
    let prevEvidenceHash: string | null = null;
    let prevEvidenceNoteId: string | null = null;

    for (const yearBucket of years) {
      const group = byYear.get(yearBucket) ?? [];
      if (group.length === 0) continue;

      const presenceBest = group
        .map((r) => r.church_presence_status.trim().toLowerCase())
        .sort((a, b) => rankPresenceStatus(b) - rankPresenceStatus(a))[0] ?? "unknown";

      const historicTokens = sortedUnique(
        flatten(
          group.map((r) => splitParenAwareSemi(r.denomination_label_historic).filter((t) => !isPresenceStatusToken(t))),
        ),
      );

      const modernTokens = sortedUnique(
        flatten(group.map((r) => splitParenAwareSemi(r.modern_denom_mapping).filter((t) => !isMetaPersuasionToken(t)))),
      );

      const historicSlugs = sortedUnique(
        flatten(
          historicTokens.map((t) => {
            const slugs = persuasionTokenToSlugs.get(t) ?? suggestPersuasionSlugs(t);
            return slugs;
          }),
        ).filter(Boolean),
      );

      const modernSlugs = sortedUnique(
        flatten(
          modernTokens.map((t) => {
            const slugs = persuasionTokenToSlugs.get(t) ?? suggestPersuasionSlugs(t);
            return slugs;
          }),
        ).filter(Boolean),
      );

      const combinedSlugs = sortedUnique([...historicSlugs, ...modernSlugs]);

      const persuasionsValue =
        combinedSlugs.length === 0
          ? "unknown"
          : normalizeSetValue(combinedSlugs.map((s) => `persuasion:${s}`));

      const polityRawBest = group.map((r) => r.ruling_empire_polity.trim()).find(Boolean) ?? "";
      const polityValue = polityRawBest
        ? `polity:${polityTokenToSlug.get(polityRawBest) ?? asciiSlug(polityRawBest)}`
        : "";

      const subdivisionBest = group.map((r) => r.ruling_subdivision.trim()).find(Boolean) ?? "";
      const plantedScholarlyBest = group.map((r) => r.church_planted_year_scholarly.trim()).find(Boolean) ?? "";
      const plantedEarliestBest = group
        .map((r) => r.church_planted_year_earliest_claim.trim())
        .find(Boolean) ?? "";
      const plantedByBest = group.map((r) => r.church_planted_by.trim()).find(Boolean) ?? "";
      const apostolicThreadBest = group.map((r) => r.apostolic_origin_thread.trim()).find(Boolean) ?? "";
      const councilContextBest = group.map((r) => r.council_context.trim()).find(Boolean) ?? "";

      const evidenceCombined = group.map((r) => r.evidence_notes_and_citations.trim()).filter(Boolean).join("\n\n---\n\n");
      const evidenceNorm = normalizeEvidenceText(evidenceCombined);
      const evidenceHash = evidenceNorm ? stableHash(evidenceNorm) : "";

      const citations = sortedUnique(flatten(group.map((r) => extractCitationUrls(r.evidence_notes_and_citations)))).join(";");

      if (evidenceNorm && (prevEvidenceHash === null || evidenceHash !== prevEvidenceHash)) {
        const peopleSlugs = sortedUnique(
          flatten(
            group.map((r) =>
              splitTopLevel(r.key_figures)
                .map((raw) => {
                  const rawToken = raw.trim();
                  if (!rawToken) return "";
                  return (
                    personRawToSlug.get(rawToken) ??
                    personCanonToSlug.get(stripParentheticals(rawToken)) ??
                    asciiSlug(stripParentheticals(rawToken) || rawToken)
                  );
                })
                .filter(Boolean),
            ),
          ),
        );

        const peopleMentions = peopleSlugs.map((slug) => `[[person:${slug}]]`).join(" ");
        const persuasionMentions = combinedSlugs.map(
          (slug) => `[[persuasion:${slug}]]`,
        );

        const politySlug = polityRawBest ? polityTokenToSlug.get(polityRawBest) ?? asciiSlug(polityRawBest) : "";
        const polityMention = politySlug ? `[[polity:${politySlug}]]` : "";

        const evidenceBody =
          `${evidenceCombined}` +
          `\n\nMentions: ${[peopleMentions, persuasionMentions.join(" "), polityMention]
            .filter(Boolean)
            .join(" ")}`;

        prevEvidenceNoteId = addNote([
          String(yearBucket),
          "",
          "city",
          tsvSafe(citySlug),
          "evidence",
          "",
          "",
          tsvSafe(evidenceBody),
          tsvSafe(citations),
        ]);

        prevEvidenceHash = evidenceHash;
      }

      placeStateByDecadeRows.push([
        `city:${tsvSafe(citySlug)}`,
        String(yearBucket),
        tsvSafe(presenceBest),
        tsvSafe(combinedSlugs.join(";")),
        tsvSafe(polityRawBest ? polityTokenToSlug.get(polityRawBest) ?? asciiSlug(polityRawBest) : ""),
        tsvSafe(subdivisionBest),
        tsvSafe(plantedScholarlyBest),
        tsvSafe(plantedEarliestBest),
        tsvSafe(plantedByBest),
        tsvSafe(apostolicThreadBest),
        tsvSafe(councilContextBest),
        tsvSafe(prevEvidenceNoteId ?? ""),
      ]);

      if (prevPresence === null || presenceBest !== prevPresence) {
        addStateNote({ citySlug, yearBucket, stateKey: "presence_status", stateValue: presenceBest });
        prevPresence = presenceBest;
      }

      if (prevPersuasions === null || persuasionsValue !== prevPersuasions) {
        addStateNote({ citySlug, yearBucket, stateKey: "persuasions", stateValue: persuasionsValue });
        prevPersuasions = persuasionsValue;
      }

      if (prevPolity === null || polityValue !== prevPolity) {
        addStateNote({ citySlug, yearBucket, stateKey: "polity", stateValue: polityValue });
        prevPolity = polityValue;
      }

      if (prevSubdivision === null || subdivisionBest !== prevSubdivision) {
        if (subdivisionBest) {
          addStateNote({ citySlug, yearBucket, stateKey: "ruling_subdivision", stateValue: subdivisionBest });
        }
        prevSubdivision = subdivisionBest;
      }

      if (prevPlantedScholarly === null || plantedScholarlyBest !== prevPlantedScholarly) {
        if (plantedScholarlyBest) {
          addStateNote({
            citySlug,
            yearBucket,
            stateKey: "church_planted_year_scholarly",
            stateValue: plantedScholarlyBest,
          });
        }
        prevPlantedScholarly = plantedScholarlyBest;
      }

      if (prevPlantedEarliest === null || plantedEarliestBest !== prevPlantedEarliest) {
        if (plantedEarliestBest) {
          addStateNote({
            citySlug,
            yearBucket,
            stateKey: "church_planted_year_earliest_claim",
            stateValue: plantedEarliestBest,
          });
        }
        prevPlantedEarliest = plantedEarliestBest;
      }

      if (prevPlantedBy === null || plantedByBest !== prevPlantedBy) {
        if (plantedByBest) {
          addStateNote({ citySlug, yearBucket, stateKey: "church_planted_by", stateValue: plantedByBest });
        }
        prevPlantedBy = plantedByBest;
      }

      if (prevApostolicThread === null || apostolicThreadBest !== prevApostolicThread) {
        if (apostolicThreadBest) {
          addStateNote({
            citySlug,
            yearBucket,
            stateKey: "apostolic_origin_thread",
            stateValue: apostolicThreadBest,
          });
        }
        prevApostolicThread = apostolicThreadBest;
      }

      if (prevCouncilContext === null || councilContextBest !== prevCouncilContext) {
        if (councilContextBest) {
          addStateNote({ citySlug, yearBucket, stateKey: "council_context", stateValue: councilContextBest });
        }
        prevCouncilContext = councilContextBest;
      }
    }
  }

  noteRows.sort((a, b) => Number(a[0]) - Number(b[0]) || a[3].localeCompare(b[3]) || a[4].localeCompare(b[4]));

  await writeTsv(
    OUT_NOTES_PATH,
    [
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
    noteRows,
  );

  await writeTsv(
    OUT_NOTE_MENTIONS_PATH,
    ["note_id", "mentioned_type", "mentioned_slug"],
    noteMentionRows,
  );

  await writeTsv(
    OUT_PLACE_STATE_BY_DECADE_PATH,
    [
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
    placeStateByDecadeRows,
  );

  const inventoryCityBySlug = new Map<string, TsvRow>();
  for (const row of inventoryCities) {
    const slug = row.city_id_suggested?.trim();
    if (!slug) continue;
    if (!inventoryCityBySlug.has(slug)) inventoryCityBySlug.set(slug, row);
  }

  const canonicalCitySlugsInPlaces = new Set<string>();
  for (const row of cityEntityRows) {
    const slug = (row[0] ?? "").trim();
    if (slug) canonicalCitySlugsInPlaces.add(slug);
  }

  const inventorySigToCanonicalPlaceCitySlug = new Map<string, string>();
  for (const slug of canonicalCitySlugsInPlaces) {
    const inv = inventoryCityBySlug.get(slug);
    if (!inv) continue;
    const sig = `${inv.city_modern_mode?.trim() ?? ""}|||${inv.country_modern?.trim() ?? ""}|||${inv.lat_mode?.trim() ?? ""}|||${inv.lon_mode?.trim() ?? ""}`;
    if (!inventorySigToCanonicalPlaceCitySlug.has(sig)) inventorySigToCanonicalPlaceCitySlug.set(sig, slug);
  }

  function bestCitySlugMatch(slug: string): string | null {
    const parts = slug.split("-").filter(Boolean);
    for (let len = parts.length; len >= 1; len -= 1) {
      const prefix = parts.slice(0, len).join("-");
      const matches = Array.from(canonicalCitySlugsInPlaces).filter(
        (candidate) => candidate === prefix || candidate.startsWith(`${prefix}-`),
      );
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) {
        return matches.sort((a, b) => a.length - b.length || a.localeCompare(b))[0] ?? null;
      }
    }
    return null;
  }

  function resolveCitySlugForPlace(value: string): string | null {
    const raw = stripLeadingYearPrefix(value);
    if (!raw) return null;
    if (canonicalCitySlugsInPlaces.has(raw)) return raw;

    const inv = inventoryCityBySlug.get(raw);
    if (inv) {
      const sig = `${inv.city_modern_mode?.trim() ?? ""}|||${inv.country_modern?.trim() ?? ""}|||${inv.lat_mode?.trim() ?? ""}|||${inv.lon_mode?.trim() ?? ""}`;
      const canonical = inventorySigToCanonicalPlaceCitySlug.get(sig);
      if (canonical) return canonical;
    }

    const best = bestCitySlugMatch(raw);
    if (best) return best;

    if (raw.includes("bethlehem") && canonicalCitySlugsInPlaces.has("bethlehem-bethlehem")) {
      return "bethlehem-bethlehem";
    }

    return raw;
  }

  const referencedCitySlugs = new Set<string>();
  const referencedCitySlugsNeedingStub = new Set<string>();

  function noteReferencedCitySlug(value: string): string | null {
    const resolved = resolveCitySlugForPlace(value);
    if (!resolved) return null;
    referencedCitySlugs.add(resolved);
    if (!canonicalCitySlugsInPlaces.has(resolved) && !inventoryCityBySlug.has(resolved)) {
      referencedCitySlugsNeedingStub.add(resolved);
    }
    return resolved;
  }

  const placesRows: string[][] = [];
  const placeSeen = new Set<string>();

  for (const row of cityEntityRows) {
    const citySlug = row[0] ?? "";
    const label = row[1] ?? "";
    const lat = row[5] ?? "";
    const lon = row[6] ?? "";
    const precision = row[7] ?? "";
    const placeId = `city:${citySlug}`;
    if (placeSeen.has(placeId)) continue;
    placeSeen.add(placeId);
    placesRows.push([placeId, "city", tsvSafe(label), tsvSafe(lat), tsvSafe(lon), tsvSafe(precision), tsvSafe(citySlug), ""]);
  }

  if (archaeologyRows) {
    for (const r of archaeologyRows) {
      const id = r.id?.trim();
      if (!id) continue;
      const label = r.name_display?.trim() ?? id;
      const lat = r.lat?.trim() ?? "";
      const lon = r.lon?.trim() ?? "";
      const precision = r.location_precision?.trim() ?? "";
      const cityIdRaw = stripLeadingYearPrefix(r.city_id?.trim() ?? "");
      const cityId = cityIdRaw ? noteReferencedCitySlug(cityIdRaw) ?? cityIdRaw : "";
      const placeId = `archaeology:${id}`;
      if (placeSeen.has(placeId)) continue;
      placeSeen.add(placeId);
      placesRows.push([
        placeId,
        "archaeology",
        tsvSafe(label),
        tsvSafe(lat),
        tsvSafe(lon),
        tsvSafe(precision),
        tsvSafe(cityId),
        tsvSafe(id),
      ]);
    }
  }

  if (worksRows) {
    for (const r of worksRows) {
      const writtenCity = r.city_written_id?.trim() ?? "";
      if (writtenCity) noteReferencedCitySlug(writtenCity);
      for (const recipient of splitSemi(r.city_recipient_ids ?? "")) {
        if (recipient) noteReferencedCitySlug(recipient);
      }
    }
  }

  if (eventsRows) {
    for (const r of eventsRows) {
      const cityId = r.city_id?.trim() ?? "";
      if (cityId) noteReferencedCitySlug(cityId);
    }
  }

  if (edgesRows) {
    for (const r of edgesRows) {
      const srcType = r.source_type?.trim();
      const tgtType = r.target_type?.trim();
      const tgtId = r.target_id?.trim();
      if (srcType === "person" && tgtType === "city" && tgtId) {
        noteReferencedCitySlug(tgtId);
      }
    }
  }

  if (relationsRows) {
    for (const r of relationsRows) {
      const srcType = r.source_type?.trim();
      const srcId = r.source_id?.trim();
      const tgtType = r.target_type?.trim();
      const tgtId = r.target_id?.trim();

      if (!srcType || !tgtType) continue;

      const maybeRegisterPlace = (placeId: string): void => {
        const v = (placeId ?? "").trim();
        if (!v) return;
        if (v.startsWith("city:")) {
          const citySlug = v.slice("city:".length);
          if (citySlug) noteReferencedCitySlug(citySlug);
        }
      };

      if (srcType === "place" && srcId) maybeRegisterPlace(srcId);
      if (tgtType === "place" && tgtId) maybeRegisterPlace(tgtId);
    }
  }

  for (const slug of referencedCitySlugs) {
    if (canonicalCitySlugsInPlaces.has(slug)) continue;

    const placeId = `city:${slug}`;
    if (placeSeen.has(placeId)) continue;

    const inv = inventoryCityBySlug.get(slug);
    if (inv) {
      const label = inv.city_ancient?.trim() || titleCaseFromSlug(slug);
      const lat = inv.lat_mode?.trim() ?? "";
      const lon = inv.lon_mode?.trim() ?? "";
      const precision = inv.location_precision_mode?.trim() ?? "unknown";
      placeSeen.add(placeId);
      placesRows.push([
        placeId,
        "city",
        tsvSafe(label),
        tsvSafe(lat),
        tsvSafe(lon),
        tsvSafe(precision),
        tsvSafe(slug),
        "",
      ]);
      continue;
    }

    if (referencedCitySlugsNeedingStub.has(slug)) {
      placeSeen.add(placeId);
      placesRows.push([
        placeId,
        "city",
        tsvSafe(titleCaseFromSlug(slug)),
        "",
        "",
        "unknown",
        tsvSafe(slug),
        "",
      ]);
    }
  }

  placesRows.sort((a, b) => a[0].localeCompare(b[0]));

  await writeTsv(
    OUT_PLACES_PATH,
    ["place_id", "place_type", "place_label", "lat", "lon", "location_precision", "city_slug", "archaeology_id"],
    placesRows,
  );

  const footprintRows: string[][] = [];
  const footprintSeen = new Set<string>();

  function addFootprint(params: {
    entityType: string;
    entityId: string;
    placeId: string;
    yearStart: string;
    yearEnd: string;
    weight: string;
    reason: string;
  }): void {
    if (!params.entityType || !params.entityId || !params.placeId) return;
    const key = `${params.entityType}::${params.entityId}::${params.placeId}::${params.yearStart}::${params.yearEnd}::${params.reason}`;
    if (footprintSeen.has(key)) return;
    footprintSeen.add(key);
    footprintRows.push([
      tsvSafe(params.entityType),
      tsvSafe(params.entityId),
      tsvSafe(params.placeId),
      tsvSafe(params.yearStart),
      tsvSafe(params.yearEnd),
      tsvSafe(params.weight),
      tsvSafe(params.reason),
    ]);
  }

  const workPlaceIndex = new Map<string, Array<{ placeId: string; yearStart: string; yearEnd: string }>>();

  if (worksRows) {
    for (const r of worksRows) {
      const workId = r.id?.trim();
      if (!workId) continue;
      const yStart = String(parseIntOrNull(r.year_written_earliest ?? "") ?? "");
      const yEnd = String(parseIntOrNull(r.year_written_latest ?? "") ?? "");

      const writtenCity = noteReferencedCitySlug(r.city_written_id?.trim() ?? "");
      if (writtenCity) {
        const placeId = `city:${writtenCity}`;
        addFootprint({
          entityType: "work",
          entityId: workId,
          placeId,
          yearStart: yStart,
          yearEnd: yEnd,
          weight: "5",
          reason: "written_in",
        });
        if (!workPlaceIndex.has(workId)) workPlaceIndex.set(workId, []);
        workPlaceIndex.get(workId)?.push({ placeId, yearStart: yStart, yearEnd: yEnd });
      }

      for (const recipient of splitSemi(r.city_recipient_ids ?? "")) {
        const citySlug = noteReferencedCitySlug(recipient);
        if (!citySlug) continue;
        const placeId = `city:${citySlug}`;
        addFootprint({
          entityType: "work",
          entityId: workId,
          placeId,
          yearStart: yStart,
          yearEnd: yEnd,
          weight: "4",
          reason: "sent_to",
        });
        if (!workPlaceIndex.has(workId)) workPlaceIndex.set(workId, []);
        workPlaceIndex.get(workId)?.push({ placeId, yearStart: yStart, yearEnd: yEnd });
      }
    }
  }

  if (eventsRows) {
    for (const r of eventsRows) {
      const eventId = r.id?.trim();
      if (!eventId) continue;
      const yStart = emptyIfNullToken(r.year_start?.trim() ?? "");
      const yEnd = emptyIfNullToken(r.year_end?.trim() ?? "");
      const cityId = noteReferencedCitySlug(r.city_id?.trim() ?? "");
      if (!cityId) continue;
      addFootprint({
        entityType: "event",
        entityId: eventId,
        placeId: `city:${cityId}`,
        yearStart: yStart,
        yearEnd: yEnd,
        weight: "4",
        reason: "held_in",
      });
    }
  }

  if (archaeologyRows) {
    for (const r of archaeologyRows) {
      const archId = r.id?.trim();
      if (!archId) continue;
      const yStart = emptyIfNullToken(r.year_start?.trim() ?? "");
      const yEnd = emptyIfNullToken(r.year_end?.trim() ?? "");
      addFootprint({
        entityType: "archaeology",
        entityId: archId,
        placeId: `archaeology:${archId}`,
        yearStart: yStart,
        yearEnd: yEnd,
        weight: "5",
        reason: "located_at",
      });
    }
  }

  const doctrineToWorkEdges = new Map<string, Array<{ workId: string; rel: string; weight: string }>>();

  if (edgesRows) {
    for (const r of edgesRows) {
      const srcType = r.source_type?.trim();
      const srcId = r.source_id?.trim();
      const rel = r.relationship?.trim();
      const tgtType = r.target_type?.trim();
      const tgtId = r.target_id?.trim();
      const dStart = emptyIfNullToken(r.decade_start?.trim() ?? "");
      const dEnd = emptyIfNullToken(r.decade_end?.trim() ?? "");
      const weight = r.weight?.trim() ?? "";

      if (srcType === "person" && srcId && tgtType === "city" && tgtId) {
        const citySlug = noteReferencedCitySlug(tgtId);
        if (citySlug) {
          addFootprint({
            entityType: "person",
            entityId: srcId,
            placeId: `city:${citySlug}`,
            yearStart: dStart,
            yearEnd: dEnd,
            weight: weight || "3",
            reason: rel || "related_to_city",
          });
        }
      }

      if (srcType === "work" && srcId && tgtType === "doctrine" && tgtId) {
        if (!doctrineToWorkEdges.has(tgtId)) doctrineToWorkEdges.set(tgtId, []);
        doctrineToWorkEdges.get(tgtId)?.push({ workId: srcId, rel: rel || "mentions", weight: weight || "3" });
      }
    }
  }

  if (relationsRows) {
    for (const r of relationsRows) {
      const srcType = r.source_type?.trim();
      const srcId = r.source_id?.trim();
      const rel = r.relation_type?.trim();
      const tgtType = r.target_type?.trim();
      const tgtId = r.target_id?.trim();
      const yStart = emptyIfNullToken(r.year_start?.trim() ?? "");
      const yEnd = emptyIfNullToken(r.year_end?.trim() ?? "");
      const weight = r.weight?.trim() ?? "";

      if (srcType === "person" && srcId && tgtType === "place" && tgtId) {
        addFootprint({
          entityType: "person",
          entityId: srcId,
          placeId: tgtId,
          yearStart: yStart,
          yearEnd: yEnd,
          weight: weight || "3",
          reason: rel || "related_to_place",
        });
      }

      if (srcType === "event" && srcId && tgtType === "place" && tgtId) {
        addFootprint({
          entityType: "event",
          entityId: srcId,
          placeId: tgtId,
          yearStart: yStart,
          yearEnd: yEnd,
          weight: weight || "3",
          reason: rel || "related_to_place",
        });
      }

      if (srcType === "work" && srcId && tgtType === "place" && tgtId) {
        addFootprint({
          entityType: "work",
          entityId: srcId,
          placeId: tgtId,
          yearStart: yStart,
          yearEnd: yEnd,
          weight: weight || "3",
          reason: rel || "related_to_place",
        });
        if (!workPlaceIndex.has(srcId)) workPlaceIndex.set(srcId, []);
        workPlaceIndex.get(srcId)?.push({ placeId: tgtId, yearStart: yStart, yearEnd: yEnd });
      }

      if (srcType === "work" && srcId && tgtType === "doctrine" && tgtId) {
        if (!doctrineToWorkEdges.has(tgtId)) doctrineToWorkEdges.set(tgtId, []);
        doctrineToWorkEdges.get(tgtId)?.push({ workId: srcId, rel: rel || "mentions", weight: weight || "3" });
      }
    }
  }

  for (const [doctrineId, workLinks] of doctrineToWorkEdges.entries()) {
    for (const link of workLinks) {
      const places = workPlaceIndex.get(link.workId) ?? [];
      for (const p of places) {
        addFootprint({
          entityType: "doctrine",
          entityId: doctrineId,
          placeId: p.placeId,
          yearStart: p.yearStart,
          yearEnd: p.yearEnd,
          weight: link.weight,
          reason: `via_work_${link.rel}`,
        });
      }
    }
  }

  const persuasionPresenceIndex = new Map<string, number[]>();

  for (const row of placeStateByDecadeRows) {
    const placeId = row[0] ?? "";
    const decade = parseIntOrNull(row[1] ?? "") ?? null;
    const persuasionSlugs = splitSemi(row[3] ?? "");
    if (!placeId || decade === null) continue;
    for (const slug of persuasionSlugs) {
      const key = `${slug}::${placeId}`;
      if (!persuasionPresenceIndex.has(key)) persuasionPresenceIndex.set(key, []);
      persuasionPresenceIndex.get(key)?.push(decade);
    }
  }

  for (const [key, decades] of persuasionPresenceIndex.entries()) {
    const [slug, placeId] = key.split("::");
    const sorted = Array.from(new Set(decades)).sort((a, b) => a - b);
    if (sorted.length === 0) continue;

    let runStart = sorted[0];
    let prev = sorted[0];

    const flush = (start: number, end: number): void => {
      addFootprint({
        entityType: "persuasion",
        entityId: slug,
        placeId,
        yearStart: String(start),
        yearEnd: String(end + 9),
        weight: "3",
        reason: "presence",
      });
    };

    for (let i = 1; i < sorted.length; i += 1) {
      const d = sorted[i];
      if (d === prev + 10) {
        prev = d;
        continue;
      }
      flush(runStart, prev);
      runStart = d;
      prev = d;
    }

    flush(runStart, prev);
  }

  footprintRows.sort(
    (a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]) || a[3].localeCompare(b[3]),
  );

  await writeTsv(
    OUT_ENTITY_PLACE_FOOTPRINTS_PATH,
    ["entity_type", "entity_id", "place_id", "year_start", "year_end", "weight", "reason"],
    footprintRows,
  );

  console.log(`[final_data] Wrote ${OUT_CITY_KEYS_PATH}`);
  console.log(`[final_data] Wrote ${OUT_CITY_ALIASES_PATH}`);
  console.log(`[final_data] Wrote ${OUT_PERSUASION_TOKENS_PATH}`);
  console.log(`[final_data] Wrote ${OUT_PERSON_TOKENS_PATH}`);
  console.log(`[final_data] Wrote ${OUT_POLITY_TOKENS_PATH}`);
  console.log(`[final_data] Wrote ${OUT_COVERAGE_ISSUES_PATH}`);
  console.log(`[final_data] Wrote ${OUT_CITIES_PATH}`);
  console.log(`[final_data] Wrote ${OUT_PERSUASIONS_PATH}`);
  console.log(`[final_data] Wrote ${OUT_PEOPLE_PATH}`);
  console.log(`[final_data] Wrote ${OUT_POLITIES_PATH}`);
  console.log(`[final_data] Wrote ${OUT_NOTES_PATH}`);
  console.log(`[final_data] Wrote ${OUT_PLACES_PATH}`);
  console.log(`[final_data] Wrote ${OUT_NOTE_MENTIONS_PATH}`);
  console.log(`[final_data] Wrote ${OUT_PLACE_STATE_BY_DECADE_PATH}`);
  console.log(`[final_data] Wrote ${OUT_ENTITY_PLACE_FOOTPRINTS_PATH}`);
}

main().catch((error: unknown) => {
  console.error("[final_data] Failed:", error);
  process.exitCode = 1;
});
