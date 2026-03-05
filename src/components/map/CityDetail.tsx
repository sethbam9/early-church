import { useState, useMemo, useEffect, useRef } from "react";
import { dataStore } from "../../data/dataStore";
import { useAppStore } from "../../stores/appStore";
import type { PlaceState } from "../../data/dataStore";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";

function Hl({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "rgba(26,122,92,0.25)", color: "inherit", borderRadius: 2, padding: "0 1px" }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SubTab = "info" | "timeline" | "people" | "doctrines" | "events" | "works" | "archaeology";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "info",        label: "Info" },
  { id: "timeline",    label: "Timeline" },
  { id: "people",      label: "People" },
  { id: "doctrines",   label: "Doctrines" },
  { id: "events",      label: "Events" },
  { id: "works",       label: "Works" },
  { id: "archaeology", label: "Archaeology" },
];

const PRESENCE_LABELS: Record<string, string> = {
  attested:          "Attested",
  probable:          "Probable",
  claimed_tradition: "Claimed tradition",
  suppressed:        "Suppressed",
  unknown:           "Unknown",
  not_attested:      "Not attested",
};

const PRESENCE_COLORS: Record<string, string> = {
  attested:          "#1a7a5c",
  probable:          "#b07e10",
  claimed_tradition: "#c47d2a",
  suppressed:        "#c0392b",
  unknown:           "#8e8070",
  not_attested:      "#8e8070",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface CityDetailProps {
  cityId: string;
  onBack: () => void;
  onSelectEntity: (kind: string, id: string) => void;
}

// ─── CityDetail ───────────────────────────────────────────────────────────────

export function CityDetail({ cityId, onBack, onSelectEntity }: CityDetailProps) {
  const [subTab, setSubTab] = useState<SubTab>("info");
  const activeDecade = useAppStore((s) => s.activeDecade);

  const city        = dataStore.cities.getById(cityId);
  const placeStates = dataStore.map.getPlaceStatesForCity(cityId);
  const notes       = dataStore.notes.getForEntity("city", cityId);
  const footprints  = dataStore.footprints.getForPlace(`city:${cityId}`);

  // Current state at active decade (or nearest past)
  const currentState = useMemo(() => {
    const exact = placeStates.find((ps) => ps.decade === activeDecade);
    if (exact) return exact;
    const past = placeStates.filter((ps) => ps.decade <= activeDecade);
    return past.length > 0 ? past[past.length - 1] : placeStates[0];
  }, [placeStates, activeDecade]);

  // People via footprints + relations
  const cityPeople = useMemo(() => {
    const personIds = new Set<string>(
      footprints.filter((f) => f.entity_type === "person").map((f) => f.entity_id),
    );
    // Also via relations
    for (const r of dataStore.relations.getForEntity("city", cityId)) {
      const otherId = r.source_id === cityId ? r.target_id : r.source_id;
      const otherType = r.source_id === cityId ? r.target_type : r.source_type;
      if (otherType === "person") personIds.add(otherId);
    }
    return Array.from(personIds)
      .map((id) => dataStore.people.getById(id))
      .filter(Boolean) as NonNullable<ReturnType<typeof dataStore.people.getById>>[];
  }, [cityId, footprints]);

  // Works by city's people
  const cityWorks = useMemo(() => {
    const seen = new Set<string>();
    const works: NonNullable<ReturnType<typeof dataStore.works.getById>>[] = [];
    for (const p of cityPeople) {
      for (const w of dataStore.works.getByAuthor(p.person_id)) {
        if (!seen.has(w.work_id)) { seen.add(w.work_id); works.push(w); }
      }
    }
    return works;
  }, [cityPeople]);

  // Events at this city
  const cityEvents = useMemo(() =>
    dataStore.events.getAll().filter((e) => e.primary_place_id === `city:${cityId}`),
    [cityId],
  );

  // Archaeology sites at this city
  const cityArchaeology = useMemo(() =>
    dataStore.archaeology.getAll().filter((a) => a.city_id === cityId),
    [cityId],
  );

  // Doctrines: attested vs traditionally assumed
  const doctrineRows = useMemo(() => {
    const decadeYear = activeDecade;
    const workIds = new Set(cityWorks.map((w) => w.work_id));
    return dataStore.doctrines.getAll()
      .filter((d) => d.first_attested_year != null && d.first_attested_year <= decadeYear)
      .map((d) => {
        const quotes = dataStore.quotes.getByDoctrine(d.doctrine_id);
        const hasLocalQuote = quotes.some((q) => q.work_id && workIds.has(q.work_id));
        const firstWorkLocal = d.first_attested_work_id ? workIds.has(d.first_attested_work_id) : false;
        const attested = hasLocalQuote || firstWorkLocal;
        return { doctrine: d, attested };
      });
  }, [activeDecade, cityWorks]);

  if (!city) {
    return (
      <div className="detail-panel">
        <div className="detail-back-bar">
          <button type="button" className="back-btn" onClick={onBack}>← Back</button>
        </div>
        <div className="empty-state">City not found.</div>
      </div>
    );
  }

  const presenceColor = PRESENCE_COLORS[currentState?.presence_status ?? "unknown"] ?? "#8e8070";

  return (
    <div className="detail-panel">
      {/* Back bar */}
      <div className="detail-back-bar">
        <button type="button" className="back-btn" onClick={onBack}>← Back</button>
        <span className="detail-crumb">Places › City</span>
      </div>

      {/* Header */}
      <div className="detail-header">
        <div className="detail-kind-badge">🏛 City</div>
        <div className="detail-title">{city.city_label}</div>
        <div className="detail-subtitle">
          {city.city_modern !== city.city_ancient
            ? `${city.city_ancient} · modern: ${city.city_modern}`
            : city.city_ancient}
          {city.country_modern ? ` · ${city.country_modern}` : ""}
        </div>

        {currentState && (
          <div className="detail-tags" style={{ marginTop: 6 }}>
            <span className="tag">AD {activeDecade}</span>
            <span
              className="tag"
              style={{
                background: `${presenceColor}18`,
                borderColor: `${presenceColor}55`,
                color: presenceColor,
              }}
            >
              {PRESENCE_LABELS[currentState.presence_status] ?? currentState.presence_status}
            </span>

            {/* Clickable polity tag */}
            {currentState.polity_id && (
              <button
                type="button"
                className="tag tag-clickable"
                onClick={() => onSelectEntity("polity", currentState.polity_id!)}
                title="View polity details"
              >
                {dataStore.polities.getById(currentState.polity_id)?.polity_label ?? currentState.polity_id}
              </button>
            )}

            {/* Clickable persuasion tags */}
            {(currentState.persuasion_ids ?? []).map((pid) => {
              const persuasion = dataStore.persuasions.getById(pid);
              if (!persuasion) return null;
              return (
                <button
                  key={pid}
                  type="button"
                  className="tag tag-clickable tag-persuasion"
                  onClick={() => onSelectEntity("persuasion", pid)}
                  title="View persuasion details"
                >
                  {persuasion.persuasion_label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="detail-sub-tabs">
        {SUB_TABS.filter((t) => {
          if (t.id === "archaeology") return cityArchaeology.length > 0;
          return true;
        }).map((t) => {
          const counts: Partial<Record<SubTab, number>> = {
            people: cityPeople.length,
            doctrines: doctrineRows.length,
            events: cityEvents.length,
            works: cityWorks.length,
            archaeology: cityArchaeology.length,
          };
          const c = counts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              className={`detail-sub-tab${subTab === t.id ? " active" : ""}`}
              onClick={() => setSubTab(t.id)}
            >
              {t.label}{c != null ? ` (${c})` : ""}
            </button>
          );
        })}
      </div>

      {/* Tab body */}
      <div className="detail-body">
        {subTab === "info"        && <InfoTab city={city} currentState={currentState} notes={notes} onSelectEntity={onSelectEntity} />}
        {subTab === "timeline"    && <TimelineTab placeStates={placeStates} activeDecade={activeDecade} notes={notes} onSelectEntity={onSelectEntity} />}
        {subTab === "people"      && <PeopleTab people={cityPeople} onSelectEntity={onSelectEntity} />}
        {subTab === "doctrines"   && <DoctrinesTab rows={doctrineRows} onSelectEntity={onSelectEntity} />}
        {subTab === "events"      && <EventsTab events={cityEvents} onSelectEntity={onSelectEntity} />}
        {subTab === "works"       && <WorksTab works={cityWorks} onSelectEntity={onSelectEntity} />}
        {subTab === "archaeology" && <ArchaeologyTab sites={cityArchaeology} onSelectEntity={onSelectEntity} />}
      </div>
    </div>
  );
}

// ─── Info tab ─────────────────────────────────────────────────────────────────

function InfoTab({ city, currentState, notes, onSelectEntity }: {
  city: NonNullable<ReturnType<typeof dataStore.cities.getById>>;
  currentState: PlaceState | undefined;
  notes: ReturnType<typeof dataStore.notes.getForEntity>;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const q = searchQuery.trim();

  // Evidence note for the current decade
  const evidenceNote = useMemo(() => {
    if (!currentState?.evidence_note_id) return null;
    return notes.find((n) => n.note_id === currentState.evidence_note_id) ?? null;
  }, [currentState, notes]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="fact-grid">
        {city.christianity_start_year != null && (
          <>
            <span className="fact-label">Christianity est.</span>
            <span className="fact-value">AD {city.christianity_start_year}</span>
          </>
        )}
        <span className="fact-label">Location precision</span>
        <span className="fact-value">{city.location_precision?.replace(/_/g, " ")}</span>
        {city.lat != null && city.lon != null && (
          <>
            <span className="fact-label">Coordinates</span>
            <span className="fact-value">{city.lat.toFixed(4)}, {city.lon.toFixed(4)}</span>
          </>
        )}
        {currentState?.church_planted_by && (
          <>
            <span className="fact-label">Planted by</span>
            <span className="fact-value"><Hl text={currentState.church_planted_by} query={q} /></span>
          </>
        )}
        {currentState?.apostolic_origin_thread && (
          <>
            <span className="fact-label">Apostolic thread</span>
            <span className="fact-value"><Hl text={currentState.apostolic_origin_thread} query={q} /></span>
          </>
        )}
        {currentState?.ruling_subdivision && (
          <>
            <span className="fact-label">Region</span>
            <span className="fact-value"><Hl text={currentState.ruling_subdivision} query={q} /></span>
          </>
        )}
        {currentState?.council_context && (
          <>
            <span className="fact-label">Council</span>
            <span className="fact-value">{currentState.council_context}</span>
          </>
        )}
        {currentState?.church_planted_year_scholarly != null && (
          <>
            <span className="fact-label">Planted (scholarly)</span>
            <span className="fact-value">AD {currentState.church_planted_year_scholarly}</span>
          </>
        )}
        {currentState?.church_planted_year_earliest_claim != null && (
          <>
            <span className="fact-label">Planted (earliest claim)</span>
            <span className="fact-value">AD {currentState.church_planted_year_earliest_claim}</span>
          </>
        )}
      </div>

      {evidenceNote && (
        <div>
          <div className="detail-section-title">Evidence for AD {currentState?.decade}</div>
          <div className="note-card">
            <MarkdownRenderer onSelectEntity={onSelectEntity} searchQuery={q}>{evidenceNote.body_md}</MarkdownRenderer>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Timeline tab ─────────────────────────────────────────────────────────────

function TimelineTab({ placeStates, activeDecade, notes, onSelectEntity }: {
  placeStates: PlaceState[];
  activeDecade: number;
  notes: ReturnType<typeof dataStore.notes.getForEntity>;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const q = useAppStore((s) => s.searchQuery).trim();
  const [expandedDecades, setExpandedDecades] = useState<Set<number>>(new Set());
  const activeRowRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to active decade whenever it changes
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeDecade]);

  const toggleDecade = (decade: number) => {
    setExpandedDecades((prev) => {
      const next = new Set(prev);
      if (next.has(decade)) next.delete(decade);
      else next.add(decade);
      return next;
    });
  };

  const noteById = useMemo(() => {
    const m = new Map<string, (typeof notes)[0]>();
    for (const n of notes) m.set(n.note_id, n);
    return m;
  }, [notes]);

  if (placeStates.length === 0) return <div className="empty-state">No timeline data.</div>;

  return (
    <div className="timeline-list">
      {placeStates.map((ps) => {
        const isActive   = ps.decade === activeDecade;
        const hasNote    = !!ps.evidence_note_id;
        const note       = ps.evidence_note_id ? noteById.get(ps.evidence_note_id) : null;
        const isExpanded = expandedDecades.has(ps.decade);
        const polity     = ps.polity_id ? dataStore.polities.getById(ps.polity_id) : null;

        return (
          <div
            key={ps.decade}
            ref={isActive ? activeRowRef : null}
            className={`timeline-row${isActive ? " active" : ""}`}
          >
            <div className="timeline-row-header" onClick={() => hasNote && toggleDecade(ps.decade)}>
              <span className="timeline-year">AD {ps.decade}</span>
              <span className={`status-dot ${ps.presence_status}`} />
              <span className="timeline-status">
                {PRESENCE_LABELS[ps.presence_status] ?? ps.presence_status}
              </span>
              {polity && (
                <button
                  type="button"
                  className="timeline-polity-btn"
                  onClick={(e) => { e.stopPropagation(); onSelectEntity("polity", ps.polity_id!); }}
                >
                  {polity.polity_label}
                </button>
              )}
              {ps.persuasion_ids?.map((pid) => {
                const p = dataStore.persuasions.getById(pid);
                return p ? (
                  <button
                    key={pid}
                    type="button"
                    className="timeline-persuasion-btn"
                    onClick={(e) => { e.stopPropagation(); onSelectEntity("persuasion", pid); }}
                  >
                    {p.persuasion_label}
                  </button>
                ) : null;
              })}
              {hasNote && (
                <span className="timeline-expand-icon" style={{ marginLeft: "auto" }}>
                  {isExpanded ? "▲" : "▼"}
                </span>
              )}
            </div>

            {isExpanded && note && (
              <div className="timeline-evidence">
                <div className="note-year">{note.note_kind}</div>
                <MarkdownRenderer onSelectEntity={onSelectEntity} searchQuery={q}>{note.body_md}</MarkdownRenderer>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── People tab ───────────────────────────────────────────────────────────────

function PeopleTab({ people, onSelectEntity }: {
  people: NonNullable<ReturnType<typeof dataStore.people.getById>>[];
  onSelectEntity: (kind: string, id: string) => void;
}) {
  const q = useAppStore((s) => s.searchQuery).trim();
  if (people.length === 0) return <div className="empty-state">No associated people.</div>;

  return (
    <div className="conn-list">
      {people.map((p) => (
        <div key={p.person_id} className="conn-card" onClick={() => onSelectEntity("person", p.person_id)}>
          <span className="conn-icon">👤</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="conn-name"><Hl text={p.person_label} query={q} /></div>
            <div className="conn-rel">{p.roles.slice(0, 2).join(", ")}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Doctrines tab ────────────────────────────────────────────────────────────

function DoctrinesTab({ rows, onSelectEntity }: {
  rows: { doctrine: ReturnType<typeof dataStore.doctrines.getAll>[0]; attested: boolean }[];
  onSelectEntity: (kind: string, id: string) => void;
}) {
  if (rows.length === 0) return <div className="empty-state">No doctrines recorded for this period.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div className="detail-section-title" style={{ marginBottom: 4 }}>
        <span style={{ color: "#1a7a5c" }}>■ Attested locally</span>
        {" · "}
        <span style={{ color: "#b07e10" }}>■ Traditionally assumed</span>
      </div>
      {rows.map(({ doctrine: d, attested }) => (
        <div
          key={d.doctrine_id}
          className="conn-card"
          style={{ borderLeft: `3px solid ${attested ? "#1a7a5c" : "#b07e10"}` }}
          onClick={() => onSelectEntity("doctrine", d.doctrine_id)}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="conn-name">{d.name_display}</div>
            <div className="conn-rel">
              {d.category}
              {d.first_attested_year ? ` · AD ${d.first_attested_year}` : ""}
            </div>
          </div>
          <span
            className="tag"
            style={{
              fontSize: "0.68rem",
              background: attested ? "#1a7a5c18" : "#b07e1018",
              borderColor: attested ? "#1a7a5c55" : "#b07e1055",
              color: attested ? "#1a7a5c" : "#b07e10",
              flexShrink: 0,
            }}
          >
            {attested ? "Attested" : "Assumed"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Archaeology tab ──────────────────────────────────────────────────────────

function ArchaeologyTab({ sites, onSelectEntity }: {
  sites: ReturnType<typeof dataStore.archaeology.getAll>;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  if (sites.length === 0) return <div className="empty-state">No archaeology sites here.</div>;
  return (
    <div className="conn-list">
      {sites.map((a) => (
        <div key={a.archaeology_id} className="conn-card" onClick={() => onSelectEntity("archaeology", a.archaeology_id)}>
          <span className="conn-icon">★</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="conn-name">{a.name_display}</div>
            <div className="conn-rel">
              {a.site_type}
              {a.year_start ? ` · AD ${a.year_start}` : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Events tab ───────────────────────────────────────────────────────────────

function EventsTab({ events, onSelectEntity }: {
  events: ReturnType<typeof dataStore.events.getAll>;
  onSelectEntity: (kind: string, id: string) => void;
}) {
  if (events.length === 0) return <div className="empty-state">No events recorded here.</div>;

  return (
    <div className="conn-list">
      {events.map((e) => (
        <div key={e.event_id} className="conn-card" onClick={() => onSelectEntity("event", e.event_id)}>
          <span className="conn-icon">⚡</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="conn-name">{e.name_display}</div>
            <div className="conn-rel">
              {e.year_start ? `AD ${e.year_start}` : ""}
              {e.event_type ? ` · ${e.event_type}` : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Works tab ────────────────────────────────────────────────────────────────

function WorksTab({ works, onSelectEntity }: {
  works: NonNullable<ReturnType<typeof dataStore.works.getById>>[];
  onSelectEntity: (kind: string, id: string) => void;
}) {
  if (works.length === 0) return <div className="empty-state">No associated works.</div>;

  return (
    <div className="conn-list">
      {works.map((w) => (
        <div key={w.work_id} className="conn-card" onClick={() => onSelectEntity("work", w.work_id)}>
          <span className="conn-icon">📜</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="conn-name">{w.title_display}</div>
            <div className="conn-rel">
              {w.author_name_display}
              {w.year_written_start ? ` · AD ${w.year_written_start}` : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// MarkdownNote replaced by shared MarkdownRenderer
