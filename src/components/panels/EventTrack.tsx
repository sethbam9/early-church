import { useMemo, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { dataStore } from "../../data/runtimeData";
import { Badge } from "../shared/Badge";
import { CitationList } from "../shared/CitationList";
import type { HistoricalEvent } from "../../domain/types";

const EVENT_TYPE_LABELS: Record<string, string> = {
  council: "Council",
  persecution: "Persecution",
  synod: "Synod",
  martyrdom: "Martyrdom",
  schism: "Schism",
  political: "Political",
  liturgical: "Liturgical",
  missionary: "Missionary",
  other: "Other",
};

export function EventTrack() {
  const activeDecade = useAppStore((s) => s.activeDecade);
  const setSelection = useAppStore((s) => s.setSelection);
  const setActiveRightPanel = useAppStore((s) => s.setActiveRightPanel);
  const selection = useAppStore((s) => s.selection);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const allEvents = useMemo(() => {
    const events = dataStore.events.getAll();
    return events.sort((a, b) => a.year_start - b.year_start);
  }, []);

  const eventTypes = useMemo(() => {
    const types = new Set(allEvents.map((e) => e.event_type));
    return Array.from(types).sort();
  }, [allEvents]);

  const filtered = useMemo(() => {
    let events = allEvents;
    if (typeFilter !== "all") events = events.filter((e) => e.event_type === typeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      events = events.filter((e) =>
        [e.name_display, e.description, e.city_ancient, e.region, e.outcome].join(" ").toLowerCase().includes(q),
      );
    }
    return events;
  }, [allEvents, typeFilter, searchQuery]);

  const selectedEventId = selection?.kind === "event" ? selection.id : null;

  return (
    <div className="event-track">
      <h2>Events Timeline</h2>
      <div className="event-track-filters">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search events..."
          style={{ flex: 1, minWidth: 120 }}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>{EVENT_TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>
        <span className="muted small">{filtered.length} events</span>
      </div>

      <div className="event-track-list">
        {filtered.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            isSelected={event.id === selectedEventId}
            isInCurrentDecade={event.year_start <= activeDecade + 9 && (event.year_end ?? event.year_start) >= activeDecade}
            onSelect={() => {
              setSelection({ kind: "event", id: event.id });
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface EventCardProps {
  event: HistoricalEvent;
  isSelected: boolean;
  isInCurrentDecade: boolean;
  onSelect: () => void;
}

function EventCard({ event, isSelected, isInCurrentDecade, onSelect }: EventCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`event-card ${isSelected ? "event-card-selected" : ""} ${isInCurrentDecade ? "event-card-current" : ""}`}
      onClick={onSelect}
    >
      <div className="event-card-header">
        <strong>{event.name_display}</strong>
        <span className="muted small">AD {event.year_start}{event.year_end && event.year_end !== event.year_start ? `–${event.year_end}` : ""}</span>
      </div>
      <div className="badge-row">
        <Badge>{EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}</Badge>
        {event.city_ancient && <Badge>{event.city_ancient}</Badge>}
        {event.region && <Badge>{event.region}</Badge>}
      </div>
      <p className="small">{event.description}</p>

      {expanded && (
        <>
          {event.significance && (
            <>
              <h4>Significance</h4>
              <p className="small">{event.significance}</p>
            </>
          )}
          {event.outcome && (
            <>
              <h4>Outcome</h4>
              <p className="small">{event.outcome}</p>
            </>
          )}
          {event.key_figure_ids.length > 0 && (
            <div className="entity-chip-list">
              <strong className="small">Key figures: </strong>
              {event.key_figure_ids.map((pid) => {
                const person = dataStore.people.getById(pid);
                return (
                  <button
                    key={pid}
                    type="button"
                    className="entity-chip"
                    onClick={(e) => {
                      e.stopPropagation();
                      useAppStore.getState().setSelection({ kind: "person", id: pid });
                      useAppStore.getState().setActiveRightPanel("correspondence");
                    }}
                  >
                    {person?.name_display ?? pid}
                  </button>
                );
              })}
            </div>
          )}
          <CitationList urls={event.citations} />
        </>
      )}

      <button
        type="button"
        className="link-button small"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}
