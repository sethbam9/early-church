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

const URL_REGEX = /https?:\/\/[^\s<>"'`\])]+/gi;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const FINAL_PATH = resolve(ROOT, "final.tsv");
const OUT_DIR = resolve(ROOT, "docs", "final-tsv-audit");

function formatYear(year: number): string {
  return String(year).padStart(4, "0");
}

function decadeEnd(yearBucket: number): number {
  return yearBucket === 33 ? 39 : yearBucket + 9;
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

function parseTsv(content: string): { headers: string[]; records: RawRecord[] } {
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
      columns = [
        ...columns.slice(0, headers.length - 1),
        columns.slice(headers.length - 1).join("\t"),
      ];
    }

    if (columns.length < headers.length) {
      columns = columns.concat(
        Array.from({ length: headers.length - columns.length }, () => ""),
      );
    }

    const record = {} as RawRecord;
    headers.forEach((header, index) => {
      record[header as RequiredColumn] = (columns[index] ?? "").trim();
    });

    records.push(record);
  }

  return { headers, records };
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

function stripParentheticals(value: string): string {
  return value.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

function cleanUrl(value: string): string {
  return value.replace(/[),.;]+$/g, "");
}

function isValidLocationPrecision(value: string): boolean {
  const v = value.trim();
  return v === "exact" || v === "approx_city" || v === "region_only" || v === "unknown";
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

function mostCommon(values: Map<string, number>): string {
  let best = "";
  let bestCount = -1;
  for (const [value, count] of values.entries()) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function increment(map: Map<string, number>, key: string): void {
  const k = key.trim();
  if (!k) return;
  map.set(k, (map.get(k) ?? 0) + 1);
}

function writeTsv(path: string, headers: string[], rows: string[][]): Promise<void> {
  const content = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n") + "\n";
  return writeFile(path, content, "utf8");
}

function toDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

async function main(): Promise<void> {
  const raw = await readFile(FINAL_PATH, "utf8");
  const { records } = parseTsv(raw);

  await mkdir(OUT_DIR, { recursive: true });

  const cities = new Map<
    string,
    {
      city_ancient: string;
      country_modern: string;
      city_modern: Map<string, number>;
      lat: Map<string, number>;
      lon: Map<string, number>;
      location_precision: Map<string, number>;
      planted_earliest: Map<string, number>;
      planted_scholarly: Map<string, number>;
      planted_by: Map<string, number>;
      apostolic_origin_thread: Map<string, number>;
      rows: number;
      years: number[];
    }
  >();

  const sectRawCounts = new Map<string, number>();
  const sectTokenCounts = new Map<string, number>();

  const modernRawCounts = new Map<string, number>();
  const modernTokenCounts = new Map<string, number>();

  const polityCounts = new Map<string, number>();

  const keyFigureRawCounts = new Map<string, number>();
  const keyFigureCanonCounts = new Map<string, number>();
  const keyFigureCanonVariants = new Map<string, Set<string>>();

  const duplicateKeyToLines = new Map<string, number[]>();
  const rowKeyCounts = new Map<string, number>();

  const locationPrecisionViolations: Array<{
    line: number;
    year_bucket: string;
    city_ancient: string;
    country_modern: string;
    location_precision: string;
  }> = [];

  const chronologyContradictions: Array<{
    line: number;
    year_bucket: string;
    decade_end: number;
    city_ancient: string;
    country_modern: string;
    church_presence_status: string;
    church_planted_year_scholarly: number;
  }> = [];

  const urlCounts = new Map<string, number>();
  const urlContexts = new Map<string, Array<{ line: number; year: string; city: string }>>();

  const cityAncientToCountries = new Map<string, Set<string>>();

  const denomLooksLikeStatus: Array<{
    line: number;
    year_bucket: string;
    city_ancient: string;
    country_modern: string;
    denomination_label_historic: string;
    church_presence_status: string;
  }> = [];

  const hybridCityNames: Array<{
    line: number;
    year_bucket: string;
    city_ancient: string;
    country_modern: string;
  }> = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const line = i + 2; // header is line 1

    const yearBucketNum = parseIntOrNull(record.year_bucket);
    const yearBucket = record.year_bucket;

    const cityAncient = record.city_ancient;
    const cityModern = record.city_modern;
    const countryModern = record.country_modern;

    const cityKey = `${cityAncient}|||${countryModern}`;

    if (cityAncient.includes("/") || cityAncient.includes(";")) {
      hybridCityNames.push({ line, year_bucket: yearBucket, city_ancient: cityAncient, country_modern: countryModern });
    }

    if (!cityAncientToCountries.has(cityAncient)) {
      cityAncientToCountries.set(cityAncient, new Set());
    }
    cityAncientToCountries.get(cityAncient)?.add(countryModern);

    if (!cities.has(cityKey)) {
      cities.set(cityKey, {
        city_ancient: cityAncient,
        country_modern: countryModern,
        city_modern: new Map(),
        lat: new Map(),
        lon: new Map(),
        location_precision: new Map(),
        planted_earliest: new Map(),
        planted_scholarly: new Map(),
        planted_by: new Map(),
        apostolic_origin_thread: new Map(),
        rows: 0,
        years: [],
      });
    }

    const cityAgg = cities.get(cityKey);
    if (cityAgg) {
      cityAgg.rows += 1;
      if (yearBucketNum !== null) cityAgg.years.push(yearBucketNum);

      increment(cityAgg.city_modern, cityModern || "(blank)");
      increment(cityAgg.lat, record.lat || "(blank)");
      increment(cityAgg.lon, record.lon || "(blank)");
      increment(cityAgg.location_precision, record.location_precision || "(blank)");
      increment(cityAgg.planted_earliest, record.church_planted_year_earliest_claim || "(blank)");
      increment(cityAgg.planted_scholarly, record.church_planted_year_scholarly || "(blank)");
      increment(cityAgg.planted_by, record.church_planted_by || "(blank)");
      increment(cityAgg.apostolic_origin_thread, record.apostolic_origin_thread || "(blank)");
    }

    increment(sectRawCounts, record.denomination_label_historic || "(blank)");
    for (const token of splitSemi(record.denomination_label_historic)) {
      increment(sectTokenCounts, token);
    }

    increment(modernRawCounts, record.modern_denom_mapping || "(blank)");
    for (const token of splitSemi(record.modern_denom_mapping)) {
      increment(modernTokenCounts, token);
    }

    increment(polityCounts, record.ruling_empire_polity || "(blank)");

    // Key figures
    for (const rawToken of splitTopLevel(record.key_figures)) {
      const rawClean = rawToken.trim();
      if (!rawClean) continue;
      increment(keyFigureRawCounts, rawClean);

      const canon = stripParentheticals(rawClean);
      if (canon) {
        increment(keyFigureCanonCounts, canon);
        if (!keyFigureCanonVariants.has(canon)) {
          keyFigureCanonVariants.set(canon, new Set());
        }
        keyFigureCanonVariants.get(canon)?.add(rawClean);
      }
    }

    // Duplicate key audit
    const rowKey = `${yearBucket}|${cityAncient}|${countryModern}`;
    rowKeyCounts.set(rowKey, (rowKeyCounts.get(rowKey) ?? 0) + 1);
    if (!duplicateKeyToLines.has(rowKey)) {
      duplicateKeyToLines.set(rowKey, []);
    }
    duplicateKeyToLines.get(rowKey)?.push(line);

    // Enum violations
    if (record.location_precision && !isValidLocationPrecision(record.location_precision)) {
      locationPrecisionViolations.push({
        line,
        year_bucket: yearBucket,
        city_ancient: cityAncient,
        country_modern: countryModern,
        location_precision: record.location_precision,
      });
    }

    // Chronology contradictions
    const plantedScholarly = parseIntOrNull(record.church_planted_year_scholarly);
    if (
      record.church_presence_status.trim().toLowerCase() === "attested" &&
      plantedScholarly !== null &&
      yearBucketNum !== null &&
      plantedScholarly > decadeEnd(yearBucketNum)
    ) {
      chronologyContradictions.push({
        line,
        year_bucket: yearBucket,
        decade_end: decadeEnd(yearBucketNum),
        city_ancient: cityAncient,
        country_modern: countryModern,
        church_presence_status: record.church_presence_status,
        church_planted_year_scholarly: plantedScholarly,
      });
    }

    // Denomination misused as status
    const denomNorm = record.denomination_label_historic.trim().toLowerCase();
    if (
      denomNorm === "attested" ||
      denomNorm === "probable" ||
      denomNorm === "claimed_tradition" ||
      denomNorm === "claimed tradition" ||
      denomNorm === "not_attested" ||
      denomNorm === "suppressed" ||
      denomNorm === "unknown"
    ) {
      denomLooksLikeStatus.push({
        line,
        year_bucket: yearBucket,
        city_ancient: cityAncient,
        country_modern: countryModern,
        denomination_label_historic: record.denomination_label_historic,
        church_presence_status: record.church_presence_status,
      });
    }

    // URLs
    const matches = record.evidence_notes_and_citations.match(URL_REGEX) ?? [];
    for (const match of matches) {
      const u = cleanUrl(match);
      if (!u) continue;
      urlCounts.set(u, (urlCounts.get(u) ?? 0) + 1);
      if (!urlContexts.has(u)) urlContexts.set(u, []);
      const ctx = urlContexts.get(u);
      if (ctx && ctx.length < 8) {
        ctx.push({ line, year: yearBucket, city: `${cityAncient} (${countryModern})` });
      }
    }
  }

  // Cities inventory
  const cityRows: string[][] = [];
  const citySlugCollisions = new Map<string, string[]>();

  for (const [key, agg] of cities.entries()) {
    const modeCityModern = mostCommon(agg.city_modern);
    const modeLat = mostCommon(agg.lat);
    const modeLon = mostCommon(agg.lon);
    const modePrecision = mostCommon(agg.location_precision);

    const cityId = `${asciiSlug(agg.city_ancient)}-${asciiSlug(modeCityModern !== "(blank)" ? modeCityModern : agg.country_modern)}`;

    if (!citySlugCollisions.has(cityId)) citySlugCollisions.set(cityId, []);
    citySlugCollisions.get(cityId)?.push(key);

    const yearsSorted = [...agg.years].filter((y) => Number.isFinite(y)).sort((a, b) => a - b);
    const yearMin = yearsSorted.length > 0 ? formatYear(yearsSorted[0]) : "";
    const yearMax = yearsSorted.length > 0 ? formatYear(yearsSorted[yearsSorted.length - 1]) : "";

    cityRows.push([
      cityId,
      agg.city_ancient,
      agg.country_modern,
      modeCityModern === "(blank)" ? "" : modeCityModern,
      modeLat === "(blank)" ? "" : modeLat,
      modeLon === "(blank)" ? "" : modeLon,
      modePrecision === "(blank)" ? "" : modePrecision,
      String(agg.rows),
      yearMin,
      yearMax,
      String(agg.city_modern.size),
      String(agg.lat.size),
      String(agg.lon.size),
      String(agg.location_precision.size),
      String(agg.planted_scholarly.size),
    ]);
  }

  cityRows.sort((a, b) => a[1].localeCompare(b[1]));

  await writeTsv(
    resolve(OUT_DIR, "inventory_cities.tsv"),
    [
      "city_id_suggested",
      "city_ancient",
      "country_modern",
      "city_modern_mode",
      "lat_mode",
      "lon_mode",
      "location_precision_mode",
      "rows",
      "year_min",
      "year_max",
      "city_modern_variants",
      "lat_variants",
      "lon_variants",
      "precision_variants",
      "planted_scholarly_variants",
    ],
    cityRows,
  );

  // City slug collisions
  const collisionRows: string[][] = [];
  for (const [slug, keys] of citySlugCollisions.entries()) {
    if (keys.length <= 1) continue;
    collisionRows.push([slug, String(keys.length), keys.join(" ; ")]);
  }
  collisionRows.sort((a, b) => Number(b[1]) - Number(a[1]));
  await writeTsv(
    resolve(OUT_DIR, "city_slug_collisions.tsv"),
    ["city_id_suggested", "collision_count", "city_keys"],
    collisionRows,
  );

  // Sect inventory
  const sectTokenRows = Array.from(sectTokenCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([token, mentions]) => [token, asciiSlug(token), String(mentions)]);
  await writeTsv(
    resolve(OUT_DIR, "inventory_sects.tsv"),
    ["historic_sect_token", "sect_id_suggested", "mentions"],
    sectTokenRows,
  );

  const sectRawRows = Array.from(sectRawCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([rawValue, mentions]) => [rawValue, String(mentions)]);
  await writeTsv(
    resolve(OUT_DIR, "inventory_sects_raw_values.tsv"),
    ["denomination_label_historic_raw", "rows"],
    sectRawRows,
  );

  // Modern mapping inventory
  const modernTokenRows = Array.from(modernTokenCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([token, mentions]) => [token, asciiSlug(token), String(mentions)]);
  await writeTsv(
    resolve(OUT_DIR, "inventory_modern_mappings.tsv"),
    ["modern_mapping_token", "modern_mapping_id_suggested", "mentions"],
    modernTokenRows,
  );

  const modernRawRows = Array.from(modernRawCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([rawValue, mentions]) => [rawValue, String(mentions)]);
  await writeTsv(
    resolve(OUT_DIR, "inventory_modern_mappings_raw_values.tsv"),
    ["modern_denom_mapping_raw", "rows"],
    modernRawRows,
  );

  // Polities inventory
  const polityRows = Array.from(polityCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, mentions]) => [name, asciiSlug(name), String(mentions)]);
  await writeTsv(
    resolve(OUT_DIR, "inventory_polities.tsv"),
    ["ruling_empire_polity", "polity_id_suggested", "mentions"],
    polityRows,
  );

  // Key figures inventory
  const keyFigureRows = Array.from(keyFigureCanonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([canon, mentions]) => {
      const variants = Array.from(keyFigureCanonVariants.get(canon) ?? []).sort();
      const sampleVariants = variants.slice(0, 6).join(" ; ");
      return [canon, asciiSlug(canon), String(mentions), sampleVariants];
    });
  await writeTsv(
    resolve(OUT_DIR, "inventory_key_figures.tsv"),
    ["key_figure_canonical", "person_id_suggested", "mentions", "sample_raw_variants"],
    keyFigureRows,
  );

  // Duplicate key rows
  const duplicateRows: string[][] = [];
  for (const [rowKey, lines] of duplicateKeyToLines.entries()) {
    if (lines.length <= 1) continue;
    const [year, city, country] = rowKey.split("|");
    duplicateRows.push([year, city, country, String(lines.length), lines.join(",")]);
  }
  duplicateRows.sort((a, b) => Number(b[3]) - Number(a[3]));
  await writeTsv(
    resolve(OUT_DIR, "duplicate_row_keys.tsv"),
    ["year_bucket", "city_ancient", "country_modern", "row_count", "line_numbers"],
    duplicateRows,
  );

  // Enum violations
  await writeTsv(
    resolve(OUT_DIR, "location_precision_violations.tsv"),
    ["line", "year_bucket", "city_ancient", "country_modern", "location_precision"],
    locationPrecisionViolations.map((v) => [
      String(v.line),
      v.year_bucket,
      v.city_ancient,
      v.country_modern,
      v.location_precision,
    ]),
  );

  // Chronology contradictions
  await writeTsv(
    resolve(OUT_DIR, "chronology_contradictions.tsv"),
    [
      "line",
      "year_bucket",
      "decade_end",
      "city_ancient",
      "country_modern",
      "church_presence_status",
      "church_planted_year_scholarly",
    ],
    chronologyContradictions.map((c) => [
      String(c.line),
      c.year_bucket,
      String(c.decade_end),
      c.city_ancient,
      c.country_modern,
      c.church_presence_status,
      String(c.church_planted_year_scholarly),
    ]),
  );

  // Denomination misused
  await writeTsv(
    resolve(OUT_DIR, "denomination_misused_as_status.tsv"),
    [
      "line",
      "year_bucket",
      "city_ancient",
      "country_modern",
      "denomination_label_historic",
      "church_presence_status",
    ],
    denomLooksLikeStatus.map((d) => [
      String(d.line),
      d.year_bucket,
      d.city_ancient,
      d.country_modern,
      d.denomination_label_historic,
      d.church_presence_status,
    ]),
  );

  // Hybrid city names
  await writeTsv(
    resolve(OUT_DIR, "hybrid_city_names.tsv"),
    ["line", "year_bucket", "city_ancient", "country_modern"],
    hybridCityNames.map((h) => [String(h.line), h.year_bucket, h.city_ancient, h.country_modern]),
  );

  // City ancient -> multiple countries
  const cityCountryRows: string[][] = [];
  for (const [city, countries] of cityAncientToCountries.entries()) {
    if (countries.size <= 1) continue;
    cityCountryRows.push([city, String(countries.size), Array.from(countries).sort().join(" ; ")]);
  }
  cityCountryRows.sort((a, b) => Number(b[1]) - Number(a[1]));
  await writeTsv(
    resolve(OUT_DIR, "city_ancient_multiple_countries.tsv"),
    ["city_ancient", "country_variant_count", "countries"],
    cityCountryRows,
  );

  // URL inventory
  const urlRows = Array.from(urlCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([url, count]) => {
      const domain = toDomain(url);
      const ctx = urlContexts.get(url) ?? [];
      const sample = ctx.map((c) => `${c.year}@${c.city}#${c.line}`).join(" ; ");
      return [url, domain, String(count), sample];
    });
  await writeTsv(
    resolve(OUT_DIR, "url_inventory.tsv"),
    ["url", "domain", "row_mentions", "sample_contexts"],
    urlRows,
  );

  // Summary markdown
  const summaryLines: string[] = [];
  summaryLines.push("# final.tsv audit (generated)");
  summaryLines.push("");
  summaryLines.push(`- **Rows**: ${records.length}`);
  summaryLines.push(`- **Unique city keys (city_ancient+country_modern)**: ${cities.size}`);
  summaryLines.push(`- **Unique historic sect tokens**: ${sectTokenCounts.size}`);
  summaryLines.push(`- **Unique modern mapping tokens**: ${modernTokenCounts.size}`);
  summaryLines.push(`- **Unique ruling polities**: ${polityCounts.size}`);
  summaryLines.push(`- **Unique key figure tokens (canonicalized)**: ${keyFigureCanonCounts.size}`);
  summaryLines.push("");
  summaryLines.push("## Issue counts");
  summaryLines.push("");
  summaryLines.push(`- **Duplicate (year_bucket+city_ancient+country_modern) keys**: ${duplicateRows.length}`);
  summaryLines.push(`- **location_precision violations**: ${locationPrecisionViolations.length}`);
  summaryLines.push(`- **Chronology contradictions (attested but planted_year_scholarly > decade end)**: ${chronologyContradictions.length}`);
  summaryLines.push(`- **denomination_label_historic misused as presence status**: ${denomLooksLikeStatus.length}`);
  summaryLines.push(`- **Hybrid city_ancient values containing '/' or ';'**: ${hybridCityNames.length}`);
  summaryLines.push(`- **city_ancient values assigned to multiple countries**: ${cityCountryRows.length}`);
  summaryLines.push("");
  summaryLines.push("## Output files");
  summaryLines.push("");
  summaryLines.push("- inventory_cities.tsv");
  summaryLines.push("- city_slug_collisions.tsv");
  summaryLines.push("- inventory_sects.tsv");
  summaryLines.push("- inventory_sects_raw_values.tsv");
  summaryLines.push("- inventory_modern_mappings.tsv");
  summaryLines.push("- inventory_modern_mappings_raw_values.tsv");
  summaryLines.push("- inventory_polities.tsv");
  summaryLines.push("- inventory_key_figures.tsv");
  summaryLines.push("- duplicate_row_keys.tsv");
  summaryLines.push("- location_precision_violations.tsv");
  summaryLines.push("- chronology_contradictions.tsv");
  summaryLines.push("- denomination_misused_as_status.tsv");
  summaryLines.push("- hybrid_city_names.tsv");
  summaryLines.push("- city_ancient_multiple_countries.tsv");
  summaryLines.push("- url_inventory.tsv");
  summaryLines.push("");

  await writeFile(resolve(OUT_DIR, "audit_summary.md"), summaryLines.join("\n") + "\n", "utf8");

  console.log(`[audit_final] Wrote audit outputs to ${OUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error("[audit_final] Failed:", error);
  process.exitCode = 1;
});
