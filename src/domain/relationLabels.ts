/**
 * Centralized relation-label registry.
 *
 * Every `relation_type` slug used in `data/relations.tsv` should have an entry here.
 * - `forward`  — label shown when the CURRENT entity is the SOURCE of the relation
 * - `inverse`  — label shown when the CURRENT entity is the TARGET of the relation
 *
 * MAINTENANCE: whenever you add a new relation_type to relations.tsv, add a
 * corresponding entry here so the UI shows a meaningful label in both directions.
 */

export interface RelationLabelEntry {
  forward: string;
  inverse: string;
}

export const RELATION_LABELS: Record<string, RelationLabelEntry> = {
  // ── Discipleship / teaching ──────────────────────────────────────────────
  disciple_of:       { forward: "disciple of",       inverse: "teacher of" },
  teacher_of:        { forward: "teacher of",         inverse: "student of" },
  mentor_of:         { forward: "mentor of",          inverse: "mentored by" },
  student_of:        { forward: "student of",         inverse: "teacher of" },

  // ── Ecclesiastical office ────────────────────────────────────────────────
  bishop_of:         { forward: "bishop of",          inverse: "had bishop" },
  ordained:          { forward: "ordained",            inverse: "ordained by" },
  ordained_by:       { forward: "ordained by",        inverse: "ordained" },
  successor_of:      { forward: "successor of",       inverse: "preceded by" },

  // ── Family ───────────────────────────────────────────────────────────────
  parent_of:         { forward: "parent of",          inverse: "child of" },
  child_of:          { forward: "child of",           inverse: "parent of" },
  sibling_of:        { forward: "sibling of",         inverse: "sibling of" },

  // ── Authorship / works ───────────────────────────────────────────────────
  authored:          { forward: "authored",            inverse: "authored by" },
  wrote:             { forward: "wrote",               inverse: "written by" },
  translated:        { forward: "translated",          inverse: "translated by" },
  compiled:          { forward: "compiled",            inverse: "compiled by" },
  edited:            { forward: "edited",              inverse: "edited by" },

  // ── Doctrinal stance ─────────────────────────────────────────────────────
  affirms:           { forward: "affirms",             inverse: "affirmed by" },
  condemns:          { forward: "condemns",            inverse: "condemned by" },
  develops:          { forward: "develops",            inverse: "developed by" },
  disputes:          { forward: "disputes",            inverse: "disputed by" },
  modifies:          { forward: "modifies",            inverse: "modified by" },

  // ── Interpersonal ────────────────────────────────────────────────────────
  "co-worker":       { forward: "co-worker of",        inverse: "co-worker of" },
  co_worker:         { forward: "co-worker of",        inverse: "co-worker of" },
  corresponded_with: { forward: "corresponded with",   inverse: "corresponded with" },
  opposed:           { forward: "opposed",             inverse: "opposed by" },
  condemned_by:      { forward: "condemned by",        inverse: "condemned" },
  condemned:         { forward: "condemned",           inverse: "condemned by" },
  affiliated_with:   { forward: "affiliated with",     inverse: "affiliated with" },
  mediator_between:  { forward: "mediator between",    inverse: "mediated by" },
  sent_to:           { forward: "sent to",             inverse: "received from" },

  // ── Event participation ──────────────────────────────────────────────────
  participated_in:   { forward: "participated in",     inverse: "included" },
  attended:          { forward: "attended",            inverse: "attended by" },
  led:               { forward: "led",                 inverse: "led by" },
  organized:         { forward: "organized",           inverse: "organized by" },
  presided:          { forward: "presided at",         inverse: "presided over by" },
  martyred_at:       { forward: "martyred at",         inverse: "site of martyrdom of" },

  // ── Location / geography ─────────────────────────────────────────────────
  located_in:        { forward: "located in",          inverse: "contains" },
  held_in:           { forward: "held in",             inverse: "hosted" },
  founded_at:        { forward: "founded at",          inverse: "founding site of" },
  buried_at:         { forward: "buried at",           inverse: "burial site of" },

  // ── Canon / attestation ──────────────────────────────────────────────────
  first_mentions:    { forward: "first mentions",      inverse: "first attested in" },
  quotes:            { forward: "quotes",              inverse: "quoted by" },
  refutes:           { forward: "refutes",             inverse: "refuted by" },
  cites:             { forward: "cites",               inverse: "cited by" },
};

/**
 * Returns a human-readable label for a relation edge, correctly oriented
 * for the current entity (outgoing = source, incoming = target).
 */
export function getRelationLabel(relType: string, isOutgoing: boolean): string {
  const entry = RELATION_LABELS[relType];
  if (!entry) return relType.replace(/_/g, " ");
  return isOutgoing ? entry.forward : entry.inverse;
}
