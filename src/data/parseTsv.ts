export type TsvRow = Record<string, string>;

export function parseTsv(raw: string): TsvRow[] {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const headers = lines[0]!.split("\t").map((h) => h.trim());
  const rows: TsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split("\t");
    const row: TsvRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = (cols[j] ?? "").trim();
    }
    if (Object.values(row).some((v) => v !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

export function int(v: string | undefined): number | null {
  if (!v || v.toLowerCase() === "null") return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function float(v: string | undefined): number | null {
  if (!v || v.toLowerCase() === "null") return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function splitSemi(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && s.toLowerCase() !== "null");
}

export function str(v: string | undefined): string {
  const s = (v ?? "").trim();
  return s.toLowerCase() === "null" ? "" : s;
}
