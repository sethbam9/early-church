import { useNavigate } from "react-router-dom";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import type { Selection } from "../../data/dataStore";
import { useAppStore } from "../../stores/appStore";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";
import { getRelationLabel } from "../../domain/relationLabels";

const KIND_ICONS: Record<string, string> = {
  person: "👤",
  work: "📜",
  doctrine: "✝",
  event: "⚡",
  archaeology: "🏛",
  city: "🏙",
  persuasion: "⛪",
  polity: "⚔",
};

const KIND_LABELS: Record<string, string> = {
  person: "Person",
  work: "Work",
  doctrine: "Doctrine",
  event: "Event",
  archaeology: "Archaeology",
  city: "City",
  persuasion: "Persuasion",
  polity: "Polity",
};

const relLabel = getRelationLabel;

function yearRange(start: number | null, end: number | null): string {
  if (!start) return "";
  if (!end || end === start) return `AD ${start}`;
  return `AD ${start}–${end}`;
}

function placeLabel(placeId: string | null): string {
  if (!placeId) return "";
  if (placeId.startsWith("city:")) {
    const city = dataStore.cities.getById(placeId.slice(5));
    return city?.city_label ?? placeId.slice(5);
  }
  if (placeId.startsWith("archaeology:")) {
    const arch = dataStore.archaeology.getById(placeId.slice(12));
    return arch?.name_display ?? placeId.slice(12);
  }
  return placeId;
}

interface Props {
  selection: Selection;
  onClose: () => void;
  onNavigateToMap?: () => void;
}

export function EntityDetailPanel({ selection, onClose, onNavigateToMap }: Props) {
  const navigate = useNavigate();
  const searchQuery = useAppStore((s) => s.searchQuery).trim();

  function navigateTo(kind: string, id: string) {
    const routes: Record<string, string> = {
      person: "/people",
      work: "/works",
      doctrine: "/doctrines",
      event: "/events",
      archaeology: "/archaeology",
    };
    if (routes[kind]) {
      navigate(routes[kind]);
    }
  }

  function handleConnectionClick(kind: string, id: string) {
    const sel: Selection = { kind: kind as Selection["kind"], id };
    navigateTo(kind, id);
  }

  const { kind, id } = selection;
  const relations = dataStore.relations.getForEntity(kind, id);
  const notes = dataStore.notes.getForEntity(kind, id);
  const footprints = dataStore.footprints.getForEntity(kind, id);

  // ── Render by entity type ─────────────────────────────────────────────────

  let content: React.ReactNode;

  if (kind === "person") {
    const person = dataStore.people.getById(id);
    if (!person) { content = <p className="muted">Person not found.</p>; }
    else {
      const authoredWorks = dataStore.works.getByAuthor(id);
      const quotes = dataStore.quotes.getAll().filter((q) => q.work_id && authoredWorks.some((w) => w.work_id === q.work_id));
      content = (
        <>
          <div className="entity-header">
            <div className="entity-kind-badge">{KIND_ICONS.person} {KIND_LABELS.person}</div>
            <div className="entity-name">{person.person_label}</div>
            {person.name_alt.length > 0 && (
              <div className="entity-subtitle">Also known as: {person.name_alt.join(", ")}</div>
            )}
            {person.roles.length > 0 && (
              <div className="entity-card-tags">
                {person.roles.map((r) => <span key={r} className="tag accent">{r}</span>)}
              </div>
            )}
          </div>

          {person.description && <p className="entity-description">{person.description}</p>}

          <div className="fact-grid">
            {person.birth_year && <><span className="fact-label">Born</span><span className="fact-value">AD {person.birth_year}</span></>}
            {person.death_year && <><span className="fact-label">Died</span><span className="fact-value">AD {person.death_year}{person.death_type === "martyr" ? " (martyr)" : ""}</span></>}
            {person.city_of_origin_id && <><span className="fact-label">Origin</span><span className="fact-value">{dataStore.cities.getById(person.city_of_origin_id)?.city_label ?? person.city_of_origin_id}</span></>}
            {person.apostolic_connection && <><span className="fact-label">Apostolic</span><span className="fact-value">{person.apostolic_connection}</span></>}
          </div>

          {authoredWorks.length > 0 && (
            <div>
              <div className="entity-section-title">Works</div>
              <div className="connection-list">
                {authoredWorks.map((w) => (
                  <div key={w.work_id} className="connection-card" onClick={() => handleConnectionClick("work", w.work_id)}>
                    <div className="connection-node-icon">📜</div>
                    <div className="connection-info">
                      <div className="connection-name">{w.title_display}</div>
                      <div className="connection-rel">{yearRange(w.year_written_start, w.year_written_end)} · {w.work_type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {relations.length > 0 && (
            <div>
              <div className="entity-section-title">Connections ({relations.length})</div>
              <RelationList relations={relations} entityId={id} entityType={kind} onNavigate={handleConnectionClick} />
            </div>
          )}

          {footprints.length > 0 && (
            <div>
              <div className="entity-section-title">Map presence</div>
              {footprints.slice(0, 6).map((f, i) => (
                <div key={i} style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 4 }}>
                  {placeLabel(f.place_id)} · {yearRange(f.year_start, f.year_end)} · <span className="faint">{f.reason}</span>
                </div>
              ))}
            </div>
          )}

          {person.wikipedia_url && (
            <a href={person.wikipedia_url} target="_blank" rel="noopener noreferrer" className="citation-link">Wikipedia ↗</a>
          )}
        </>
      );
    }
  }

  else if (kind === "work") {
    const work = dataStore.works.getById(id);
    if (!work) { content = <p className="muted">Work not found.</p>; }
    else {
      const quotes = dataStore.quotes.getByWork(id);
      const author = work.author_person_id ? dataStore.people.getById(work.author_person_id) : null;
      content = (
        <>
          <div className="entity-header">
            <div className="entity-kind-badge">{KIND_ICONS.work} {KIND_LABELS.work}</div>
            <div className="entity-name">{work.title_display}</div>
            <div className="entity-subtitle">{work.author_name_display} · {yearRange(work.year_written_start, work.year_written_end)}</div>
          </div>

          {work.description && <p className="entity-description">{work.description}</p>}
          {work.significance && <p className="entity-description" style={{ fontStyle: "italic" }}>{work.significance}</p>}

          <div className="fact-grid">
            {work.work_type && <><span className="fact-label">Type</span><span className="fact-value">{work.work_type}</span></>}
            {work.language && <><span className="fact-label">Language</span><span className="fact-value">{work.language}</span></>}
            {work.place_written_id && <><span className="fact-label">Written in</span><span className="fact-value">{placeLabel(work.place_written_id)}</span></>}
            {work.place_recipient_ids.length > 0 && <><span className="fact-label">Sent to</span><span className="fact-value">{work.place_recipient_ids.map(placeLabel).join(", ")}</span></>}
          </div>

          {author && (
            <div>
              <div className="entity-section-title">Author</div>
              <div className="connection-card" onClick={() => handleConnectionClick("person", author.person_id)}>
                <div className="connection-node-icon">👤</div>
                <div className="connection-info">
                  <div className="connection-name">{author.person_label}</div>
                  <div className="connection-rel">{author.roles.join(", ")}</div>
                </div>
              </div>
            </div>
          )}

          {quotes.length > 0 && (
            <div>
              <div className="entity-section-title">Notable quotes ({quotes.length})</div>
              {quotes.slice(0, 3).map((q) => (
                <div key={q.quote_id} className="quote-card" style={{ marginBottom: 8 }}>
                  <div className="quote-text">"{q.text.slice(0, 220)}{q.text.length > 220 ? "…" : ""}"</div>
                  <div className="quote-meta">
                    <span>{q.work_reference}</span>
                    {q.stance && <span className={`quote-stance ${q.stance}`}>{q.stance}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {relations.length > 0 && (
            <div>
              <div className="entity-section-title">Connections</div>
              <RelationList relations={relations} entityId={id} entityType={kind} onNavigate={handleConnectionClick} />
            </div>
          )}

          {work.modern_edition_url && (
            <a href={work.modern_edition_url} target="_blank" rel="noopener noreferrer" className="citation-link">Read online ↗</a>
          )}
        </>
      );
    }
  }

  else if (kind === "doctrine") {
    const doctrine = dataStore.doctrines.getById(id);
    if (!doctrine) { content = <p className="muted">Doctrine not found.</p>; }
    else {
      const quotes = dataStore.quotes.getByDoctrine(id);
      const firstWork = doctrine.first_attested_work_id ? dataStore.works.getById(doctrine.first_attested_work_id) : null;
      content = (
        <>
          <div className="entity-header">
            <div className="entity-kind-badge">{KIND_ICONS.doctrine} {KIND_LABELS.doctrine}</div>
            <div className="entity-name">{doctrine.name_display}</div>
            <div className="entity-card-tags">
              <span className="tag accent">{doctrine.category}</span>
              <span className={`tag ${doctrine.controversy_level}`}>{doctrine.controversy_level} controversy</span>
            </div>
          </div>

          {doctrine.description && <p className="entity-description">{doctrine.description}</p>}
          {doctrine.resolution && <p className="entity-description" style={{ fontStyle: "italic" }}>{doctrine.resolution}</p>}

          <div className="fact-grid">
            {doctrine.first_attested_year && <><span className="fact-label">First attested</span><span className="fact-value">AD {doctrine.first_attested_year}</span></>}
            {firstWork && <><span className="fact-label">In</span><span className="fact-value"
              style={{ cursor: "pointer", color: "var(--accent-bright)" }}
              onClick={() => handleConnectionClick("work", firstWork.work_id)}
            >{firstWork.title_display}</span></>}
          </div>

          {quotes.length > 0 && (
            <div>
              <div className="entity-section-title">Primary sources ({quotes.length})</div>
              {quotes.map((q) => (
                <div key={q.quote_id} className="quote-card" style={{ marginBottom: 8 }}>
                  <div className="quote-text">"{q.text.slice(0, 280)}{q.text.length > 280 ? "…" : ""}"</div>
                  <div className="quote-meta">
                    <span>{q.work_reference}</span>
                    {q.year && <span>AD {q.year}</span>}
                    {q.stance && <span className={`quote-stance ${q.stance}`}>{q.stance}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {relations.length > 0 && (
            <div>
              <div className="entity-section-title">Connections</div>
              <RelationList relations={relations} entityId={id} entityType={kind} onNavigate={handleConnectionClick} />
            </div>
          )}
        </>
      );
    }
  }

  else if (kind === "event") {
    const event = dataStore.events.getById(id);
    if (!event) { content = <p className="muted">Event not found.</p>; }
    else {
      const figures = event.key_figure_person_ids.map((pid) => dataStore.people.getById(pid)).filter(Boolean);
      content = (
        <>
          <div className="entity-header">
            <div className="entity-kind-badge">{KIND_ICONS.event} {KIND_LABELS.event}</div>
            <div className="entity-name">{event.name_display}</div>
            <div className="entity-subtitle">{yearRange(event.year_start, event.year_end)}{event.region ? ` · ${event.region}` : ""}</div>
            <div className="entity-card-tags"><span className="tag accent">{event.event_type}</span></div>
          </div>

          {event.description && <p className="entity-description">{event.description}</p>}
          {event.significance && <p className="entity-description" style={{ fontStyle: "italic" }}>{event.significance}</p>}
          {event.outcome && (
            <div className="fact-grid">
              <span className="fact-label">Outcome</span>
              <span className="fact-value">{event.outcome}</span>
              {event.primary_place_id && <>
                <span className="fact-label">Location</span>
                <span className="fact-value">{placeLabel(event.primary_place_id)}</span>
              </>}
            </div>
          )}

          {figures.length > 0 && (
            <div>
              <div className="entity-section-title">Key figures</div>
              <div className="connection-list">
                {figures.map((p) => p && (
                  <div key={p.person_id} className="connection-card" onClick={() => handleConnectionClick("person", p.person_id)}>
                    <div className="connection-node-icon">👤</div>
                    <div className="connection-info">
                      <div className="connection-name">{p.person_label}</div>
                      <div className="connection-rel">{p.roles.join(", ")}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {relations.length > 0 && (
            <div>
              <div className="entity-section-title">Connections</div>
              <RelationList relations={relations} entityId={id} entityType={kind} onNavigate={handleConnectionClick} />
            </div>
          )}
        </>
      );
    }
  }

  else if (kind === "archaeology") {
    const site = dataStore.archaeology.getById(id);
    if (!site) { content = <p className="muted">Site not found.</p>; }
    else {
      content = (
        <>
          <div className="entity-header">
            <div className="entity-kind-badge">{KIND_ICONS.archaeology} {KIND_LABELS.archaeology}</div>
            <div className="entity-name">{site.name_display}</div>
            <div className="entity-card-tags"><span className="tag accent">{site.site_type}</span></div>
          </div>

          {site.description && <p className="entity-description">{site.description}</p>}
          {site.significance && <p className="entity-description" style={{ fontStyle: "italic" }}>{site.significance}</p>}

          <div className="fact-grid">
            {site.city_id && <><span className="fact-label">Near</span><span className="fact-value">{dataStore.cities.getById(site.city_id)?.city_label ?? site.city_id}</span></>}
            {(site.year_start || site.year_end) && <><span className="fact-label">Dated</span><span className="fact-value">{yearRange(site.year_start, site.year_end)}</span></>}
            {site.current_status && <><span className="fact-label">Status</span><span className="fact-value">{site.current_status}</span></>}
            {site.location_precision && <><span className="fact-label">Precision</span><span className="fact-value">{site.location_precision}</span></>}
          </div>

          {site.discovery_notes && (
            <div>
              <div className="entity-section-title">Discovery</div>
              <p className="entity-description">{site.discovery_notes}</p>
            </div>
          )}

          {site.uncertainty && (
            <div>
              <div className="entity-section-title">Uncertainty</div>
              <p className="entity-description">{site.uncertainty}</p>
            </div>
          )}

          {relations.length > 0 && (
            <div>
              <div className="entity-section-title">Connections</div>
              <RelationList relations={relations} entityId={id} entityType={kind} onNavigate={handleConnectionClick} />
            </div>
          )}
        </>
      );
    }
  }

  else if (kind === "city") {
    const city = dataStore.cities.getById(id);
    const placeStates = dataStore.map.getPlaceStatesForCity(id);
    if (!city) { content = <p className="muted">City not found.</p>; }
    else {
      content = (
        <>
          <div className="entity-header">
            <div className="entity-kind-badge">{KIND_ICONS.city} {KIND_LABELS.city}</div>
            <div className="entity-name">{city.city_label}</div>
            <div className="entity-subtitle">{city.city_ancient}{city.city_modern !== city.city_ancient ? ` (modern: ${city.city_modern})` : ""} · {city.country_modern}</div>
          </div>

          <div className="fact-grid">
            {city.christianity_start_year && <><span className="fact-label">Christianity est.</span><span className="fact-value">AD {city.christianity_start_year}</span></>}
            <span className="fact-label">Location</span>
            <span className="fact-value">{city.location_precision}</span>
          </div>

          {placeStates.length > 0 && (
            <div>
              <div className="entity-section-title">Timeline ({placeStates.length} decades)</div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {placeStates.map((ps) => (
                  <div key={ps.decade} style={{ display: "flex", gap: 10, fontSize: "0.82rem", padding: "4px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                    <span className="faint" style={{ width: 40, flexShrink: 0 }}>AD {ps.decade}</span>
                    <span className={`status-dot ${ps.presence_status}`} style={{ marginTop: 4 }} />
                    <span className="muted">{ps.presence_status.replace("_", " ")}</span>
                    {ps.polity_id && <span className="faint">{dataStore.polities.getById(ps.polity_id)?.polity_label ?? ps.polity_id}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {notes.length > 0 && (
            <div>
              <div className="entity-section-title">Evidence notes</div>
              {notes.slice(0, 3).map((n) => (
                <div key={n.note_id} className="note-card" style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-faint)", marginBottom: 4 }}>AD {n.year_bucket}</div>
                  <MarkdownRenderer onSelectEntity={handleConnectionClick} searchQuery={searchQuery}>{n.body_md}</MarkdownRenderer>
                  {n.citation_urls.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {n.citation_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="citation-link">{url}</a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      );
    }
  }

  else {
    content = <p className="muted">Select an entity to view details.</p>;
  }

  return (
    <div className="entity-detail">
      <div className="detail-panel-close" style={{ position: "relative", padding: "0 0 12px 0" }}>
        {onNavigateToMap && (
          <button type="button" className="view-on-map-btn" onClick={onNavigateToMap}>
            🗺 View on map
          </button>
        )}
        <button type="button" className="detail-panel-close-btn" onClick={onClose}>✕</button>
      </div>
      {content}
      {notes.length > 0 && kind !== "city" && (
        <div>
          <div className="entity-section-title">Evidence notes</div>
          {notes.slice(0, 2).map((n) => (
            <div key={n.note_id} className="note-card" style={{ marginBottom: 6 }}>
              <MarkdownRenderer onSelectEntity={handleConnectionClick} searchQuery={searchQuery}>{n.body_md}</MarkdownRenderer>
              {n.citation_urls.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {n.citation_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="citation-link">{url}</a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {citations(kind, id).length > 0 && (
        <div>
          <div className="entity-section-title">Sources</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {citations(kind, id).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="citation-link">{url}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function citations(kind: string, id: string): string[] {
  switch (kind) {
    case "person": return dataStore.people.getById(id)?.citations ?? [];
    case "work": return dataStore.works.getById(id)?.citations ?? [];
    case "doctrine": return dataStore.doctrines.getById(id)?.citations ?? [];
    case "event": return dataStore.events.getById(id)?.citations ?? [];
    case "archaeology": return dataStore.archaeology.getById(id)?.citations ?? [];
    default: return [];
  }
}

interface RelationListProps {
  relations: ReturnType<typeof dataStore.relations.getForEntity>;
  entityId: string;
  entityType: string;
  onNavigate: (kind: string, id: string) => void;
}

function RelationList({ relations, entityId, entityType, onNavigate }: RelationListProps) {
  return (
    <div className="connection-list">
      {relations.slice(0, 12).map((r) => {
        const isOutgoing = r.source_id === entityId && r.source_type === entityType;
        const otherType = isOutgoing ? r.target_type : r.source_type;
        const otherId = isOutgoing ? r.target_id : r.source_id;
        const label = getEntityLabel(otherType, otherId);
        const rel = relLabel(r.relation_type, isOutgoing);
        return (
          <div
            key={r.relation_id}
            className="connection-card"
            onClick={() => onNavigate(otherType, otherId)}
          >
            <div className="connection-node-icon">{KIND_ICONS[otherType] ?? "•"}</div>
            <div className="connection-info">
              <div className="connection-name">{label}</div>
              <div className="connection-rel">{rel}</div>
            </div>
            {r.weight && <div className="connection-weight">w{r.weight}</div>}
          </div>
        );
      })}
    </div>
  );
}
