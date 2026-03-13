import React from "react";
import { dataStore } from "../../data/dataStore";
import { kindIcon, kindLabel } from "./entityConstants";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { CrossPageNav } from "./CrossPageNav";
import { ExternalLink } from "./ExternalLink";
import s from "./EntityHeader.module.css";

// ─── Data model ───────────────────────────────────────────────────────────────

interface HeaderRow {
  label: string;
  value: string;
  linkKind?: string;
  linkId?: string;
}

export interface EntityHeaderData {
  title: string;
  subtitle: string;
  tags: string[];
  rows: HeaderRow[];
  notes?: string;
  url?: string;
}

export function getEntityHeaderData(kind: string, id: string): EntityHeaderData {
  const empty: EntityHeaderData = { title: id, subtitle: "", tags: [], rows: [] };

  if (kind === "person") {
    const e = dataStore.people.getById(id);
    if (!e) return empty;
    const rows: HeaderRow[] = [];
    if (e.name_native) rows.push({ label: "Native name", value: e.name_native });
    if (e.name_alt.length) rows.push({ label: "Also known as", value: e.name_alt.join(", ") });
    if (e.birth_year_display) rows.push({ label: "Born", value: e.birth_year_display });
    if (e.death_year_display) rows.push({ label: "Died", value: e.death_year_display });
    return {
      title: e.person_label,
      subtitle: [e.birth_year_display, e.death_year_display].filter(Boolean).join(" – "),
      tags: [e.person_kind !== "individual" ? e.person_kind : ""].filter(Boolean),
      rows,
      notes: e.notes || undefined,
    };
  }

  if (kind === "place") {
    const e = dataStore.places.getById(id);
    if (!e) return empty;
    const rows: HeaderRow[] = [];
    if (e.place_label_modern && e.place_label_modern !== e.place_label)
      rows.push({ label: "Modern name", value: e.place_label_modern });
    if (e.modern_country_label) rows.push({ label: "Country", value: e.modern_country_label });
    if (e.lat != null) rows.push({ label: "Coordinates", value: `${e.lat.toFixed(4)}°, ${e.lon?.toFixed(4)}°` });
    rows.push({ label: "Precision", value: e.location_precision.replace(/_/g, " ") });
    if (e.parent_place_id) {
      const parent = dataStore.places.getById(e.parent_place_id);
      rows.push({ label: "Parent place", value: parent?.place_label ?? e.parent_place_id, linkKind: "place", linkId: e.parent_place_id });
    }
    const subtitle = [
      e.place_label_modern && e.place_label_modern !== e.place_label ? `modern: ${e.place_label_modern}` : "",
      e.modern_country_label,
    ].filter(Boolean).join(" · ");
    return {
      title: e.place_label,
      subtitle,
      tags: [e.place_kind],
      rows,
      notes: e.notes || undefined,
    };
  }

  if (kind === "group") {
    const e = dataStore.groups.getById(id);
    if (!e) return empty;
    return {
      title: e.group_label,
      subtitle: "",
      tags: [e.group_kind, e.is_christian ? "Christian" : "non-Christian"],
      rows: [],
      notes: e.notes || undefined,
    };
  }

  if (kind === "work") {
    const e = dataStore.works.getById(id);
    if (!e) return empty;
    const rows: HeaderRow[] = [];
    if (e.title_original) rows.push({ label: "Original title", value: e.title_original });
    if (e.language_original) rows.push({ label: "Language", value: e.language_original });
    rows.push({ label: "Type", value: e.work_type });
    const preferredSrc = dataStore.sources.getPreferredForWork(e.work_id);
    return {
      title: e.title_display,
      subtitle: [e.work_type, e.language_original].filter(Boolean).join(" · "),
      tags: [e.work_kind !== "single_work" ? e.work_kind : ""].filter(Boolean),
      rows,
      notes: e.notes || undefined,
      url: preferredSrc?.url || undefined,
    };
  }

  if (kind === "event") {
    const e = dataStore.events.getById(id);
    if (!e) return empty;
    return {
      title: e.event_label,
      subtitle: "",
      tags: [e.event_type, e.event_kind !== "simple" ? e.event_kind : ""].filter(Boolean),
      rows: [],
      notes: e.notes || undefined,
    };
  }

  if (kind === "proposition") {
    const e = dataStore.propositions.getById(id);
    if (!e) return empty;
    const topic = dataStore.topics.getById(e.topic_id);
    const dim   = dataStore.dimensions.getById(e.dimension_id);
    const rows: HeaderRow[] = [];
    if (topic) rows.push({ label: "Topic", value: topic.topic_label, linkKind: "topic", linkId: topic.topic_id });
    if (dim) rows.push({ label: "Dimension", value: dim.dimension_label });
    if (e.polarity_family) rows.push({ label: "Polarity family", value: e.polarity_family });
    return {
      title: e.proposition_label,
      subtitle: topic?.topic_label ?? e.topic_id,
      tags: [],
      rows,
      notes: e.description || undefined,
    };
  }

  if (kind === "source") {
    const e = dataStore.sources.getById(id);
    if (!e) return empty;
    const rows: HeaderRow[] = [];
    if (e.author) rows.push({ label: "Author", value: e.author });
    if (e.editor) rows.push({ label: "Editor", value: e.editor });
    if (e.year) rows.push({ label: "Year", value: e.year });
    if (e.publisher) rows.push({ label: "Publisher", value: e.publisher });
    if (e.container_title) rows.push({ label: "In", value: e.container_title });
    if (e.isbn_issn) rows.push({ label: "ISBN/ISSN", value: e.isbn_issn });
    rows.push({ label: "Kind", value: e.source_kind });
    return {
      title: e.title,
      subtitle: [e.author, e.year].filter(Boolean).join(" · "),
      tags: [e.source_kind],
      rows,
      notes: e.notes || undefined,
      url: e.url || undefined,
    };
  }

  if (kind === "topic") {
    const e = dataStore.topics.getById(id);
    if (!e) return empty;
    const linkedProps = dataStore.propositions.getByTopic(id);
    const rows: HeaderRow[] = [];
    rows.push({ label: "Kind", value: e.topic_kind });
    rows.push({ label: "Propositions", value: `${linkedProps.length}` });
    for (const p of linkedProps) {
      rows.push({ label: "→", value: p.proposition_label, linkKind: "proposition", linkId: p.proposition_id });
    }
    return {
      title: e.topic_label,
      subtitle: e.topic_kind,
      tags: [e.topic_kind],
      rows,
      notes: e.notes || undefined,
    };
  }

  if (kind === "editor_note") {
    const e = dataStore.editorNotes.getById(id);
    if (!e) return empty;
    return { title: e.note_kind, subtitle: "", tags: [e.note_kind], rows: [] };
  }

  return empty;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EntityHeaderProps {
  kind: string;
  id: string;
  showAllFields?: boolean;
  onSelectEntity?: (kind: string, id: string) => void;
  currentPage?: "map" | "graph" | "wiki";
  hideExternalLink?: boolean;
}

export function EntityHeader({ kind, id, showAllFields = false, onSelectEntity, currentPage, hideExternalLink }: EntityHeaderProps) {
  const data = getEntityHeaderData(kind, id);

  return (
    <div className={s.block}>
      <div className={s.topRow}>
        <div className={s.kindBadge}>{kindIcon(kind)} {kindLabel(kind)}</div>
        {currentPage && <CrossPageNav kind={kind} id={id} current={currentPage} />}
      </div>
      <div className={s.title}>{data.title}</div>
      {data.subtitle && <div className={s.subtitle}>{data.subtitle}</div>}
      {data.tags.length > 0 && (
        <div className={s.tags}>
          {data.tags.map((t, i) => <span key={i} className={s.tag}>{t}</span>)}
        </div>
      )}

      {showAllFields && (
        <>
          {data.rows.length > 0 && (
            <div className={s.factGrid}>
              {data.rows.map(({ label, value, linkKind, linkId }) => (
                <React.Fragment key={label}>
                  <span className={s.factLabel}>{label}</span>
                  <span className={s.factValue}>
                    {linkKind && linkId && onSelectEntity ? (
                      <button type="button" className={s.mentionLink} onClick={() => onSelectEntity(linkKind, linkId)}>
                        {value}
                      </button>
                    ) : value}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
          {data.notes && (
            <p className={s.desc}>
              <MarkdownRenderer onSelectEntity={onSelectEntity}>{data.notes}</MarkdownRenderer>
            </p>
          )}
          {data.url && !hideExternalLink && (
            <ExternalLink href={data.url} className={s.link}>
              Read online
            </ExternalLink>
          )}
        </>
      )}
    </div>
  );
}
