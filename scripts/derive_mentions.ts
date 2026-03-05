/**
 * derive_mentions.ts
 *
 * Generates data/note_mentions.tsv deterministically from:
 *   - data/notes.tsv  (parses [[type:id]] and [[type:id|label]] tags in body_md)
 *
 * Run via:  npm run data:derive-mentions
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "data");

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

function parseMentions(bodyMd: string): Array<{ type: string; slug: string }> {
  const out: Array<{ type: string; slug: string }> = [];
  const re = /\[\[([a-z_]+):([^\]|]+)(?:\|[^\]]*)?\]\]/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(bodyMd)) !== null) {
    const type = (match[1] ?? "").trim();
    const slug = (match[2] ?? "").trim();
    if (type && slug) out.push({ type, slug });
  }
  return out;
}

const notes = parseTsv(join(DATA, "notes.tsv"));

interface MentionRow {
  note_id:        string;
  mentioned_type: string;
  mentioned_slug: string;
}

const seen:     Set<string>   = new Set();
const mentions: MentionRow[]  = [];

for (const note of notes) {
  const noteId = note.note_id?.trim();
  const body   = note.body_md?.trim() ?? "";
  if (!noteId) continue;

  for (const m of parseMentions(body)) {
    const key = `${noteId}|${m.type}|${m.slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    mentions.push({ note_id: noteId, mentioned_type: m.type, mentioned_slug: m.slug });
  }
}

mentions.sort((a, b) =>
  a.note_id.localeCompare(b.note_id) ||
  a.mentioned_type.localeCompare(b.mentioned_type) ||
  a.mentioned_slug.localeCompare(b.mentioned_slug),
);

const HEADERS = ["note_id", "mentioned_type", "mentioned_slug"];
const lines = [
  HEADERS.join("\t"),
  ...mentions.map((m) => [m.note_id, m.mentioned_type, m.mentioned_slug].join("\t")),
];

writeFileSync(join(DATA, "note_mentions.tsv"), lines.join("\n") + "\n", "utf-8");
console.log(`note_mentions.tsv derived: ${mentions.length} mention rows from ${notes.length} notes`);
