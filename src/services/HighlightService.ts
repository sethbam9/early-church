import type { CorrespondenceArc, HighlightEntry, Selection } from "../domain/types";
import type { IDataStore } from "../domain/repositories";

const COLORS = {
  direct: "#e67e22",
  secondary: "#f39c12",
  event: "#8e44ad",
  doctrine: "#2980b9",
  archaeology: "#27ae60",
};

export interface HighlightResult {
  cityHighlights: Record<string, HighlightEntry>;
  arcs: CorrespondenceArc[];
}

export function computeHighlights(
  selection: Selection | null,
  decade: number,
  store: IDataStore,
): HighlightResult {
  if (!selection) return { cityHighlights: {}, arcs: [] };

  switch (selection.kind) {
    case "person":
      return highlightByPerson(selection.id, decade, store);
    case "doctrine":
      return highlightByDoctrine(selection.id, decade, store);
    case "event":
      return highlightByEvent(selection.id, decade, store);
    case "work":
      return highlightByWork(selection.id, decade, store);
    case "archaeology":
      return highlightByArchaeology(selection.id, store);
    case "city":
      return highlightByCity(selection.id, decade, store);
    default:
      return { cityHighlights: {}, arcs: [] };
  }
}

function addCityHighlight(
  map: Record<string, HighlightEntry>,
  cityId: string,
  color: string,
  label: string,
  intensity: 1 | 2 | 3,
): void {
  if (!cityId || cityId === "null") return;
  const existing = map[cityId];
  if (!existing || existing.intensity < intensity) {
    map[cityId] = { color, label, intensity };
  }
}

function highlightByPerson(
  personId: string,
  decade: number,
  store: IDataStore,
): HighlightResult {
  const highlights: Record<string, HighlightEntry> = {};
  const arcs: CorrespondenceArc[] = [];

  const edgesFrom = store.edges.getEdgesFrom(personId, "person", decade);
  const edgesTo = store.edges.getEdgesTo(personId, "person", decade);

  for (const edge of [...edgesFrom, ...edgesTo]) {
    if (edge.target_type === "city") {
      const intensity = edge.relation_type === "bishop_of" ? 3 : 2;
      addCityHighlight(highlights, edge.target_id, COLORS.direct, edge.relation_type, intensity as 1 | 2 | 3);
    }

    if (edge.target_type === "person" || edge.source_type === "person") {
      const otherId = edge.source_id === personId ? edge.target_id : edge.source_id;
      if (edge.relation_type === "corresponded_with" || edge.relation_type === "disciple_of" || edge.relation_type === "discipled") {
        const otherPerson = store.people.getById(otherId);
        if (otherPerson) {
          const personEdges = store.edges.getEdgesFrom(otherId, "person");
          for (const pe of personEdges) {
            if (pe.target_type === "city") {
              addCityHighlight(highlights, pe.target_id, COLORS.secondary, `via ${otherPerson.person_label}`, 1);

              const person = store.people.getById(personId);
              const personCityEdges = store.edges.getEdgesFrom(personId, "person").filter(
                (e) => e.target_type === "city",
              );
              if (personCityEdges.length > 0 && pe.target_id) {
                const firstEdge = personCityEdges[0];
                const fromRow = firstEdge ? store.churchRows.getById(firstEdge.target_id) : undefined;
                const toRow = store.churchRows.getById(pe.target_id);
                if (fromRow?.lat && fromRow?.lon && toRow?.lat && toRow?.lon) {
                  arcs.push({
                    fromLat: fromRow.lat,
                    fromLon: fromRow.lon,
                    toLat: toRow.lat,
                    toLon: toRow.lon,
                    relationship: edge.relation_type,
                    weight: edge.weight || 0,
                    label: `${person?.person_label ?? personId} → ${otherPerson.person_label}`,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return { cityHighlights: highlights, arcs };
}

function highlightByDoctrine(
  doctrineId: string,
  decade: number,
  store: IDataStore,
): HighlightResult {
  const highlights: Record<string, HighlightEntry> = {};
  const arcs: CorrespondenceArc[] = [];

  const edgesTo = store.edges.getEdgesTo(doctrineId, "doctrine");

  for (const edge of edgesTo) {
    if (edge.source_type === "work") {
      const work = store.works.getById(edge.source_id);
      if (work) {
        if (work.place_written_id) {
          addCityHighlight(highlights, work.place_written_id, COLORS.doctrine, `Written: ${work.title_display}`, 3);
        }
        for (const recipientId of work.place_recipient_ids) {
          addCityHighlight(highlights, recipientId, COLORS.doctrine, `Sent to: ${work.title_display}`, 2);
        }
      }
    }

    if (edge.source_type === "event") {
      const event = store.events.getById(edge.source_id);
      if (event?.primary_place_id) {
        addCityHighlight(highlights, event.primary_place_id, COLORS.event, event.name_display, 3);
      }
    }
  }

  return { cityHighlights: highlights, arcs };
}

function highlightByEvent(
  eventId: string,
  decade: number,
  store: IDataStore,
): HighlightResult {
  const highlights: Record<string, HighlightEntry> = {};

  const event = store.events.getById(eventId);
  if (event?.primary_place_id) {
    addCityHighlight(highlights, event.primary_place_id, COLORS.event, event.name_display, 3);
  }

  const edgesFrom = store.edges.getEdgesFrom(eventId, "event");
  for (const edge of edgesFrom) {
    if (edge.target_type === "city") {
      addCityHighlight(highlights, edge.target_id, COLORS.event, edge.relation_type, 2);
    }
  }

  const attendees = store.edges.getEdgesTo(eventId, "event").filter(
    (e) => e.source_type === "person" && (e.relation_type === "attended" || e.relation_type === "led"),
  );
  for (const att of attendees) {
    const personCities = store.edges.getEdgesFrom(att.source_id, "person").filter(
      (e) => e.target_type === "city",
    );
    for (const pc of personCities) {
      addCityHighlight(highlights, pc.target_id, COLORS.secondary, `Attendee home`, 1);
    }
  }

  return { cityHighlights: highlights, arcs: [] };
}

function highlightByWork(
  workId: string,
  decade: number,
  store: IDataStore,
): HighlightResult {
  const highlights: Record<string, HighlightEntry> = {};
  const work = store.works.getById(workId);
  if (!work) return { cityHighlights: highlights, arcs: [] };

  if (work.place_written_id) {
    addCityHighlight(highlights, work.place_written_id, COLORS.direct, `Written in`, 3);
  }
  for (const recipientId of work.place_recipient_ids) {
    addCityHighlight(highlights, recipientId, COLORS.secondary, `Sent to`, 2);
  }

  return { cityHighlights: highlights, arcs: [] };
}

function highlightByArchaeology(
  siteId: string,
  store: IDataStore,
): HighlightResult {
  const highlights: Record<string, HighlightEntry> = {};
  const site = store.archaeology.getById(siteId);
  if (site?.city_id) {
    addCityHighlight(highlights, site.city_id, COLORS.archaeology, site.name_display, 3);
  }
  return { cityHighlights: highlights, arcs: [] };
}

function highlightByCity(
  cityId: string,
  decade: number,
  store: IDataStore,
): HighlightResult {
  const highlights: Record<string, HighlightEntry> = {};
  addCityHighlight(highlights, cityId, COLORS.direct, "Selected city", 3);

  const edgesTo = store.edges.getEdgesTo(cityId, "city", decade);
  for (const edge of edgesTo) {
    if (edge.source_type === "person") {
      const personCities = store.edges.getEdgesFrom(edge.source_id, "person", decade).filter(
        (e) => e.target_type === "city" && e.target_id !== cityId,
      );
      for (const pc of personCities) {
        addCityHighlight(highlights, pc.target_id, COLORS.secondary, edge.relation_type, 1);
      }
    }
  }

  return { cityHighlights: highlights, arcs: [] };
}
