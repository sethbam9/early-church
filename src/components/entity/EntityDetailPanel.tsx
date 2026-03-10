import { useNavigate } from "react-router-dom";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import type { Selection } from "../../data/dataStore";
import { useAppStore } from "../../stores/appStore";
import { NoteCard } from "../shared/NoteCard";
import { KIND_ICONS, KIND_LABELS } from "../shared/entityConstants";
import { ClaimCard } from "../shared/RelationCard";

interface Props {
  selection: Selection;
  onClose: () => void;
  onNavigateToMap?: () => void;
}

export function EntityDetailPanel({ selection, onClose, onNavigateToMap }: Props) {
  const navigate = useNavigate();

  function handleConnectionClick(kind: string, id: string) {
    // Navigation handled by parent
  }

  const { kind, id } = selection;
  const claims = dataStore.claims.getForEntity(kind, id);
  const editorNotes = dataStore.editorNotes.getForEntity(kind, id);
  const footprints = dataStore.footprints.getForEntity(kind, id);

  let content: React.ReactNode;

  if (kind === "person") {
    const person = dataStore.people.getById(id);
    if (!person) { content = <p className="muted">Person not found.</p>; }
    else {
      content = (
        <>
          <div className="entity-header">
            <div className="entity-kind-badge">{KIND_ICONS.person} {KIND_LABELS.person}</div>
            <div className="entity-name">{person.person_label}</div>
            {person.name_alt.length > 0 && (
              <div className="entity-subtitle">Also known as: {person.name_alt.join(", ")}</div>
            )}
          </div>
          {person.notes && <p className="entity-description">{person.notes}</p>}
          <div className="fact-grid">
            {person.birth_year_display && <><span className="fact-label">Born</span><span className="fact-value">{person.birth_year_display}</span></>}
            {person.death_year_display && <><span className="fact-label">Died</span><span className="fact-value">{person.death_year_display}</span></>}
          </div>
        </>
      );
    }
  }

  else if (kind === "work") {
    const work = dataStore.works.getById(id);
    if (!work) { content = <p className="muted">Work not found.</p>; }
    else {
      content = (
        <>
          <div className="entity-header">
            <div className="entity-kind-badge">{KIND_ICONS.work} {KIND_LABELS.work}</div>
            <div className="entity-name">{work.title_display}</div>
            <div className="entity-subtitle">{work.work_type} · {work.language_original}</div>
          </div>
          {work.notes && <p className="entity-description">{work.notes}</p>}
          <div className="fact-grid">
            {work.title_original && <><span className="fact-label">Original</span><span className="fact-value">{work.title_original}</span></>}
          </div>
        </>
      );
    }
  }

  else if (kind === "event") {
    const event = dataStore.events.getById(id);
    if (!event) { content = <p className="muted">Event not found.</p>; }
    else {
      content = (
        <>
          <div className="entity-header">
            <div className="entity-kind-badge">{KIND_ICONS.event} {KIND_LABELS.event}</div>
            <div className="entity-name">{event.event_label}</div>
            <div className="entity-card-tags"><span className="tag accent">{event.event_type}</span></div>
          </div>
          {event.notes && <p className="entity-description">{event.notes}</p>}
        </>
      );
    }
  }

  else if (kind === "group") {
    const group = dataStore.groups.getById(id);
    if (!group) { content = <p className="muted">Group not found.</p>; }
    else {
      content = (
        <>
          <div className="entity-header">
            <div className="entity-kind-badge">{KIND_ICONS.group} {KIND_LABELS.group}</div>
            <div className="entity-name">{group.group_label}</div>
            <div className="entity-card-tags"><span className="tag accent">{group.group_kind}</span></div>
          </div>
          {group.notes && <p className="entity-description">{group.notes}</p>}
        </>
      );
    }
  }

  else if (kind === "proposition") {
    const prop = dataStore.propositions.getById(id);
    if (!prop) { content = <p className="muted">Proposition not found.</p>; }
    else {
      const topic = dataStore.topics.getById(prop.topic_id);
      content = (
        <>
          <div className="entity-header">
            <div className="entity-kind-badge">{KIND_ICONS.proposition} {KIND_LABELS.proposition}</div>
            <div className="entity-name">{prop.proposition_label}</div>
            {topic && <div className="entity-subtitle">{topic.topic_label}</div>}
          </div>
          {prop.description && <p className="entity-description">{prop.description}</p>}
        </>
      );
    }
  }

  else if (kind === "place") {
    const place = dataStore.places.getById(id);
    if (!place) { content = <p className="muted">Place not found.</p>; }
    else {
      content = (
        <>
          <div className="entity-header">
            <div className="entity-kind-badge">{KIND_ICONS.place} {KIND_LABELS.place}</div>
            <div className="entity-name">{place.place_label}</div>
            <div className="entity-subtitle">
              {place.place_label_modern && place.place_label_modern !== place.place_label ? `${place.place_label_modern} · ` : ""}
              {place.modern_country_label}
            </div>
          </div>
          {place.notes && <p className="entity-description">{place.notes}</p>}
          <div className="fact-grid">
            <span className="fact-label">Kind</span><span className="fact-value">{place.place_kind}</span>
            <span className="fact-label">Precision</span><span className="fact-value">{place.location_precision}</span>
          </div>
        </>
      );
    }
  }

  else {
    content = <p className="muted">Select an entity to view details.</p>;
  }

  return (
    <div className="entity-detail">
      <div className="detail-panel-close">
        {onNavigateToMap && (
          <button type="button" className="view-on-map-btn" onClick={onNavigateToMap}>
            🗺 View on map
          </button>
        )}
        <button type="button" className="detail-panel-close-btn" onClick={onClose}>✕</button>
      </div>
      {content}

      {claims.length > 0 && (
        <div>
          <div className="entity-section-title">Claims ({claims.length})</div>
          {claims.slice(0, 6).map((c) => (
            <ClaimCard
              key={c.claim_id}
              claim={c}
              entityId={id}
              entityType={kind}
              onSelectEntity={handleConnectionClick}
            />
          ))}
        </div>
      )}

      {editorNotes.length > 0 && (
        <div>
          <div className="entity-section-title">Editor Notes</div>
          {editorNotes.slice(0, 3).map((n) => (
            <NoteCard
              key={n.editor_note_id}
              note={n}
              onSelectEntity={handleConnectionClick}
            />
          ))}
        </div>
      )}

      {footprints.length > 0 && (
        <div>
          <div className="entity-section-title">Map presence</div>
          {footprints.slice(0, 6).map((f, i) => (
            <div key={i} className="graph-footprint-item">
              {getEntityLabel("place", f.place_id)} · AD {f.year_start ?? "?"}{f.year_end && f.year_end !== f.year_start ? `–${f.year_end}` : ""} · <span className="faint">{f.reason_predicate_id.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
