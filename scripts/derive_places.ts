/**
 * derive_places.ts
 *
 * Generates data/places.tsv deterministically from:
 *   - data/cities.tsv   → one row per city  (place_type = "city")
 *   - data/archaeology.tsv → one row per site (place_type = "archaeology")
 *
 * Output is sorted: archaeology rows first (alphabetical), then city rows (alphabetical).
 * Run via:  npm run data:derive-places
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "data");

interface PlaceRow {
  place_id: string;
  place_type: "city" | "archaeology";
  place_label: string;
  lat: string;
  lon: string;
  location_precision: string;
  city_id: string;
  archaeology_id: string;
}

function parseTsv(path: string): Record<string, string>[] {
  const text = readFileSync(path, "utf-8");
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const cols = line.split("\t");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cols[i] ?? ""));
    return row;
  });
}

// --- Read source files ---
const cities = parseTsv(join(DATA, "cities.tsv"));
const archaeology = parseTsv(join(DATA, "archaeology.tsv"));

const places: PlaceRow[] = [];

// City rows
for (const c of cities) {
  places.push({
    place_id: `city:${c.city_id}`,
    place_type: "city",
    place_label: c.city_label,
    lat: c.lat,
    lon: c.lon,
    location_precision: c.location_precision,
    city_id: c.city_id,
    archaeology_id: "",
  });
}

// Archaeology rows
for (const a of archaeology) {
  places.push({
    place_id: `archaeology:${a.archaeology_id}`,
    place_type: "archaeology",
    place_label: a.name_display,
    lat: a.lat,
    lon: a.lon,
    location_precision: a.location_precision,
    city_id: a.city_id,
    archaeology_id: a.archaeology_id,
  });
}

// Sort: archaeology first (alpha), then city (alpha)
places.sort((a, b) => {
  if (a.place_type !== b.place_type) {
    return a.place_type === "archaeology" ? -1 : 1;
  }
  return a.place_id.localeCompare(b.place_id);
});

// --- Write output ---
const HEADER = [
  "place_id",
  "place_type",
  "place_label",
  "lat",
  "lon",
  "location_precision",
  "city_id",
  "archaeology_id",
].join("\t");

const body = places
  .map((p) =>
    [
      p.place_id,
      p.place_type,
      p.place_label,
      p.lat,
      p.lon,
      p.location_precision,
      p.city_id,
      p.archaeology_id,
    ].join("\t")
  )
  .join("\n");

writeFileSync(join(DATA, "places.tsv"), HEADER + "\n" + body + "\n", "utf-8");

console.log(
  `places.tsv derived: ${cities.length} cities + ${archaeology.length} archaeology = ${places.length} places`
);
