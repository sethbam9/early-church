/**
 * Universal entity hover card — shows entity details on hover.
 * Extracted from WikiPage's EntityTooltipContent + FixedTooltip for use everywhere.
 */
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import { kindIcon, kindLabel } from "./entityConstants";
import s from "./EntityHoverCard.module.css";

function getEntityFacts(kind: string, id: string): [string, string][] {
  const rows: [string, string][] = [];
  if (kind === "person") {
    const e = dataStore.people.getById(id);
    if (e) {
      rows.push(["Kind", e.person_kind]);
      if (e.name_alt.length) rows.push(["Alt names", e.name_alt.join("; ")]);
      if (e.birth_year_display) rows.push(["Born", e.birth_year_display]);
      if (e.death_year_display) rows.push(["Died", e.death_year_display]);
      if (e.notes) rows.push(["Notes", e.notes.slice(0, 100)]);
    }
  } else if (kind === "place") {
    const e = dataStore.places.getById(id);
    if (e) {
      rows.push(["Kind", e.place_kind]);
      if (e.place_label_modern) rows.push(["Modern", e.place_label_modern]);
      if (e.modern_country_label) rows.push(["Country", e.modern_country_label]);
      rows.push(["Precision", e.location_precision]);
    }
  } else if (kind === "work") {
    const e = dataStore.works.getById(id);
    if (e) {
      rows.push(["Type", e.work_type], ["Kind", e.work_kind]);
      if (e.language_original) rows.push(["Language", e.language_original]);
    }
  } else if (kind === "event") {
    const e = dataStore.events.getById(id);
    if (e) rows.push(["Type", e.event_type], ["Kind", e.event_kind]);
  } else if (kind === "group") {
    const e = dataStore.groups.getById(id);
    if (e) rows.push(["Kind", e.group_kind], ["Christian", e.is_christian ? "yes" : "no"]);
  } else if (kind === "proposition") {
    const e = dataStore.propositions.getById(id);
    if (e) {
      const topic = dataStore.topics.getById(e.topic_id);
      if (topic) rows.push(["Topic", topic.topic_label]);
      if (e.description) rows.push(["Desc", e.description.slice(0, 100)]);
    }
  } else if (kind === "source") {
    const e = dataStore.sources.getById(id);
    if (e) {
      rows.push(["Kind", e.source_kind]);
      if (e.author) rows.push(["Author", e.author]);
      if (e.year) rows.push(["Year", e.year]);
    }
  }
  return rows;
}

interface EntityHoverCardProps {
  kind: string;
  id: string;
  anchorEl: HTMLElement;
}

function HoverCardPortal({ kind, id, anchorEl }: EntityHoverCardProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const rect = anchorEl.getBoundingClientRect();
    const tooltipW = 280;
    const tooltipH = 180;
    let top = rect.bottom + 4;
    let left = rect.left;
    if (top + tooltipH > window.innerHeight) top = rect.top - tooltipH - 4;
    if (left + tooltipW > window.innerWidth) left = window.innerWidth - tooltipW - 8;
    if (left < 4) left = 4;
    setPos({ top, left });
  }, [anchorEl]);

  if (!pos) return null;

  const label = getEntityLabel(kind, id);
  const facts = getEntityFacts(kind, id);

  return createPortal(
    <div className={s.tooltip} style={{ top: pos.top, left: pos.left }}>
      <div className={s.kind}>{kindIcon(kind)} {kindLabel(kind)}</div>
      <div className={s.title}>{label}</div>
      {facts.length > 0 && (
        <dl className={s.facts}>
          {facts.map(([k, v]) => (
            <div key={k} className={s.factRow}>
              <dt className={s.factKey}>{k}</dt>
              <dd className={s.factVal}>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>,
    document.body,
  );
}

/**
 * Wrap any element to show a hover card for an entity.
 * Usage: <EntityHoverWrap kind="person" id="paul"><button>Paul</button></EntityHoverWrap>
 */
export function EntityHoverWrap({ kind, id, children }: { kind: string; id: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <span
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={s.wrap}
    >
      {children}
      {hovered && ref.current && <HoverCardPortal kind={kind} id={id} anchorEl={ref.current} />}
    </span>
  );
}
