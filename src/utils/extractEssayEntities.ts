/**
 * Extract all [[kind:id|label]] entity references from a markdown string.
 * Returns deduplicated entries grouped by kind.
 */

import { getEntityLabel } from "../data/dataStore";

export interface EssayEntityRef {
  kind: string;
  id: string;
  label: string;
}

const LINK_RE = /\[\[([^:\]]+):([^|\]]+)(?:\|([^\]]+))?\]\]/g;

export function extractEssayEntities(markdown: string): EssayEntityRef[] {
  const seen = new Set<string>();
  const refs: EssayEntityRef[] = [];
  let m: RegExpExecArray | null;
  while ((m = LINK_RE.exec(markdown)) !== null) {
    const kind = m[1]!;
    const id = m[2]!;
    const key = `${kind}:${id}`;
    if (seen.has(key) || kind === "bible") continue;
    seen.add(key);
    const label = m[3] || getEntityLabel(kind, id) || id.replace(/-/g, " ");
    refs.push({ kind, id, label });
  }
  return refs;
}

/** Group entity refs by kind, returning [kind, refs[]] pairs sorted by kind. */
export function groupByKind(refs: EssayEntityRef[]): [string, EssayEntityRef[]][] {
  const map = new Map<string, EssayEntityRef[]>();
  for (const r of refs) {
    if (!map.has(r.kind)) map.set(r.kind, []);
    map.get(r.kind)!.push(r);
  }
  const order = ["person", "place", "work", "group", "event", "proposition", "topic", "dimension", "source"];
  return [...map.entries()].sort((a, b) => {
    const ai = order.indexOf(a[0]);
    const bi = order.indexOf(b[0]);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
}
