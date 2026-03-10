/**
 * Canonical entity-kind icons, labels, and presence-status styling.
 * Import from here instead of re-declaring these maps per-component.
 */

export const KIND_ICONS: Record<string, string> = {
  place: "🏛", person: "👤", work: "📜", event: "⚡",
  group: "✦", topic: "📖", dimension: "📊", proposition: "📝",
  source: "📚", passage: "📄", claim: "🔗", editor_note: "📋",
};

export const KIND_LABELS: Record<string, string> = {
  place: "Place", person: "Person", work: "Work", event: "Event",
  group: "Group", topic: "Topic", dimension: "Dimension", proposition: "Proposition",
  source: "Source", passage: "Passage", claim: "Claim", editor_note: "Note",
};

export function kindIcon(kind: string): string {
  return KIND_ICONS[kind] ?? "•";
}

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

export const PRESENCE_COLORS: Record<string, string> = {
  attested:          "#1a7a5c",
  probable:          "#b07e10",
  claimed_tradition: "#c47d2a",
  suppressed:        "#c0392b",
  unknown:           "#8e8070",
  not_attested:      "#8e8070",
};

export const PRESENCE_LABELS: Record<string, string> = {
  attested:          "Attested",
  probable:          "Probable",
  claimed_tradition: "Claimed tradition",
  suppressed:        "Suppressed",
  unknown:           "Unknown",
  not_attested:      "Not attested",
};

export function presenceColor(status: string): string {
  return PRESENCE_COLORS[status] ?? "#8e8070";
}
