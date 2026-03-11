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

export const KIND_COLORS: Record<string, string> = {
  person:      "#c47c3a",
  work:        "#4a9eca",
  proposition: "#9b72cf",
  event:       "#e67e22",
  place:       "#e9a84a",
  group:       "#e63946",
  topic:       "#6c757d",
  source:      "#2a9d8f",
};

export const CERTAINTY_COLORS: Record<string, string> = {
  attested:  "var(--attested)",
  probable:  "var(--probable)",
  possible:  "#8e8070",
  uncertain: "#c0392b",
};

export const POLARITY_META: Record<string, { icon: string; cls: string }> = {
  supports:       { icon: "✓", cls: "rel-polarity--supports" },
  opposes:        { icon: "✗", cls: "rel-polarity--opposes"  },
  not_applicable: { icon: "~", cls: "rel-polarity--neutral"  },
};

export const STANCE_COLORS: Record<string, string> = {
  affirms: "#1a7a5c",
  opposes: "#c0392b",
  mixed:   "#b07e10",
  neutral: "#8e8070",
  unknown: "#8e8070",
};

export const STANCE_LABELS: Record<string, string> = {
  affirms: "Affirms",
  opposes: "Opposes",
  mixed:   "Mixed",
  neutral: "Neutral",
  unknown: "Unknown",
};
