import { dataStore } from "../data/dataStore";
import { getEntityAllClaims } from "../utils/claimHelpers";
import { ESSAYS } from "../data/essays";

export interface EntityListItem {
  id: string;
  label: string;
  count: number;
  countLabel: string;
}

export function getAllEntities(kind: string): EntityListItem[] {
  switch (kind) {
    case "person": return dataStore.people.getAll().map((e) => ({
      id: e.person_id, label: e.person_label,
      count: getEntityAllClaims("person", e.person_id).length, countLabel: "claims",
    }));
    case "place": return dataStore.places.getAll().map((e) => ({
      id: e.place_id, label: e.place_label,
      count: getEntityAllClaims("place", e.place_id).length, countLabel: "claims",
    }));
    case "group": return dataStore.groups.getAll().map((e) => ({
      id: e.group_id, label: e.group_label,
      count: getEntityAllClaims("group", e.group_id).length, countLabel: "claims",
    }));
    case "work": return dataStore.works.getAll().map((e) => ({
      id: e.work_id, label: e.title_display,
      count: getEntityAllClaims("work", e.work_id).length, countLabel: "claims",
    }));
    case "event": return dataStore.events.getAll().map((e) => ({
      id: e.event_id, label: e.event_label,
      count: getEntityAllClaims("event", e.event_id).length, countLabel: "claims",
    }));
    case "proposition": return dataStore.propositions.getAll().map((e) => ({
      id: e.proposition_id, label: e.proposition_label,
      count: getEntityAllClaims("proposition", e.proposition_id).length, countLabel: "claims",
    }));
    case "source": {
      return dataStore.sources.getAll().map((e) => {
        const passages = dataStore.passages.getBySource(e.source_id);
        return {
          id: e.source_id, label: e.title,
          count: passages.length, countLabel: "passages",
        };
      });
    }
    case "topic": return dataStore.topics.getAll().map((e) => ({
      id: e.topic_id, label: e.topic_label,
      count: getEntityAllClaims("topic", e.topic_id).length, countLabel: "claims",
    }));
    case "editor_note": return dataStore.editorNotes.getAll().map((e) => ({
      id: e.editor_note_id, label: e.body_md.slice(0, 60) + (e.body_md.length > 60 ? "…" : ""),
      count: 0, countLabel: "",
    }));
    case "essay": return ESSAYS.map((e) => ({
      id: e.id, label: e.title,
      count: 0, countLabel: "",
    }));
    default: return [];
  }
}

export const REVIEW_META: Record<string, { icon: string; cls: string }> = {
  approved:      { icon: "✓", cls: "reviewApproved" },
  reviewed:      { icon: "◉", cls: "reviewReviewed" },
  disputed:      { icon: "✗", cls: "reviewDisputed" },
  needs_revision:{ icon: "↻", cls: "reviewWarn" },
  unreviewed:    { icon: "○", cls: "reviewUnreviewed" },
};
