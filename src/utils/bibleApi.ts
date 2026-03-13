/**
 * Bible text fetch utility.
 * Uses bible-api.com (public, no auth required, World English Bible).
 * Also generates STEP Bible links for deeper study.
 */

export interface BibleVerse {
  book_id: string;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface BiblePassageResult {
  reference: string;
  text: string;
  verses: BibleVerse[];
  translation_id: string;
  translation_name: string;
  error?: string;
}

const CACHE = new Map<string, BiblePassageResult>();

/**
 * Parse an OSIS-style locator into { book, chapter, verses }.
 * Handles: "Mark.1.14-15", "1Cor.15.3-8", "Acts.15.1-29", "John.1.28-34"
 */
function parseLocator(locator: string): { book: string; chapter: string; verses: string } | null {
  // Match: BookName.Chapter.Verses  (verses may be "3", "3-8", or empty)
  const m = locator.match(/^(.+?)\.(\d+)(?:\.(.+))?$/);
  if (!m) return null;
  let verses = m[3] ?? "";
  // Handle 4-segment OSIS like Mark.1.16.20 → verses "16.20" → "16-20"
  if (verses && /^\d+\.\d+$/.test(verses)) {
    verses = verses.replace(".", "-");
  }
  return { book: m[1] ?? "", chapter: m[2] ?? "", verses };
}

/**
 * Convert an OSIS reference (e.g., "Mark.1.14-15") to a bible-api.com
 * compatible reference (e.g., "mark 1:14-15").
 */
function osisToApiRef(osis: string): string {
  const p = parseLocator(osis);
  if (!p) return osis;
  const base = `${p.book} ${p.chapter}`;
  return p.verses ? `${base}:${p.verses}` : base;
}

/**
 * Convert an OSIS reference to a STEP Bible URL.
 * Format: https://www.stepbible.org/?q=reference=Mark.1.14-15
 */
export function osisToStepBibleUrl(osis: string): string {
  return `https://www.stepbible.org/?q=reference=${encodeURIComponent(osis)}`;
}

/**
 * Convert a locator string (e.g., "Mark.1.14-15" or "1Cor.15.3-8")
 * to a display-friendly reference (e.g., "Mark 1:14-15").
 */
export function locatorToDisplay(locator: string): string {
  const p = parseLocator(locator);
  if (!p) return locator;
  const base = `${p.book} ${p.chapter}`;
  return p.verses ? `${base}:${p.verses}` : base;
}

/**
 * Fetch Bible passage text from bible-api.com.
 * Caches results in memory. Returns null on error.
 */
export async function fetchBiblePassage(locator: string): Promise<BiblePassageResult | null> {
  const cached = CACHE.get(locator);
  if (cached) return cached;

  const apiRef = osisToApiRef(locator);

  try {
    const resp = await fetch(`https://bible-api.com/${encodeURIComponent(apiRef)}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.error) return null;

    const result: BiblePassageResult = {
      reference: data.reference ?? apiRef,
      text: data.text?.trim() ?? "",
      verses: data.verses ?? [],
      translation_id: data.translation_id ?? "web",
      translation_name: data.translation_name ?? "World English Bible",
    };
    CACHE.set(locator, result);
    return result;
  } catch {
    return null;
  }
}
