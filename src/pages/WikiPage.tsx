import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { dataStore, getEntityLabel } from "../data/dataStore";
import type { Claim, ClaimEvidence, ClaimReview } from "../data/types";
import { kindIcon, kindLabel, KIND_ICONS } from "../components/shared/entityConstants";
import { getPredicateLabel } from "../domain/relationLabels";
import { getSourceExternalUrl, getSourceAccessTitle } from "../utils/sourceLinks";
import { usePaginatedList } from "../hooks/usePaginatedList";
import { Pagination, PAGE_SIZE } from "../components/shared/Pagination";
import { CrossPageNav } from "../components/shared/CrossPageNav";

// ─── Types ────────────────────────────────────────────────────────────────────

type WikiMode = "browse" | "audit";
type BrowseSelection = { kind: string; id: string };

const ENTITY_TABS: { kind: string; label: string }[] = [
  { kind: "person",      label: "People" },
  { kind: "place",       label: "Places" },
  { kind: "group",       label: "Groups" },
  { kind: "work",        label: "Works" },
  { kind: "event",       label: "Events" },
  { kind: "proposition", label: "Propositions" },
  { kind: "source",      label: "Sources" },
];

// ─── Claim audit helpers ──────────────────────────────────────────────────────

type ClaimAuditStatus = "no-evidence" | "unreviewed" | "disputed" | "needs-revision" | "approved" | "ok";

function getClaimAuditStatus(claim: Claim): ClaimAuditStatus {
  const evidence = dataStore.claimEvidence.getForClaim(claim.claim_id);
  if (evidence.length === 0) return "no-evidence";
  const reviews = dataStore.claimReviews.getForClaim(claim.claim_id);
  if (reviews.length === 0) return "unreviewed";
  if (reviews.some((r) => r.review_status === "disputed")) return "disputed";
  if (reviews.some((r) => r.review_status === "needs_revision")) return "needs-revision";
  if (reviews.every((r) => r.review_status === "approved")) return "approved";
  return "ok";
}

function getClaimBorderClass(status: ClaimAuditStatus): string {
  switch (status) {
    case "no-evidence": return "wiki-border--red";
    case "unreviewed": case "needs-revision": return "wiki-border--orange";
    case "disputed": return "wiki-border--red";
    case "approved": return "wiki-border--green";
    default: return "";
  }
}

function getEntityAllClaims(kind: string, id: string): Claim[] {
  return dataStore.claims.getForEntity(kind, id)
    .filter((c) => !dataStore.claims.isInfraPredicate(c.predicate_id));
}

// ─── Precomputed audit index (built once) ─────────────────────────────────────

interface ClaimAuditRow {
  claim: Claim;
  status: ClaimAuditStatus;
  evidenceCount: number;
  reviewCount: number;
  subjectLabel: string;
  objectLabel: string;
  isDuplicate: boolean;
}

let _auditCache: ClaimAuditRow[] | null = null;
function getAuditRows(): ClaimAuditRow[] {
  if (_auditCache) return _auditCache;
  const all = dataStore.claims.getAll().filter((c) => c.claim_status === "active" && !dataStore.claims.isInfraPredicate(c.predicate_id));
  const dupeMap = new Map<string, number>();
  for (const c of all) {
    const key = `${c.subject_type}:${c.subject_id}|${c.predicate_id}|${c.object_type}:${c.object_id}`;
    dupeMap.set(key, (dupeMap.get(key) ?? 0) + 1);
  }
  _auditCache = all.map((c) => {
    const ev = dataStore.claimEvidence.getForClaim(c.claim_id);
    const rv = dataStore.claimReviews.getForClaim(c.claim_id);
    const key = `${c.subject_type}:${c.subject_id}|${c.predicate_id}|${c.object_type}:${c.object_id}`;
    return {
      claim: c,
      status: getClaimAuditStatus(c),
      evidenceCount: ev.length,
      reviewCount: rv.length,
      subjectLabel: getEntityLabel(c.subject_type, c.subject_id),
      objectLabel: c.object_mode === "entity" && c.object_id
        ? getEntityLabel(c.object_type, c.object_id)
        : (c.value_text || (c.value_year != null ? String(c.value_year) : "") || ""),
      isDuplicate: (dupeMap.get(key) ?? 0) > 1,
    };
  });
  return _auditCache;
}

// ─── Entity list helpers ──────────────────────────────────────────────────────

function getAllEntities(kind: string): { id: string; label: string; count: number; countLabel: string }[] {
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
    default: return [];
  }
}

// ─── Global search ────────────────────────────────────────────────────────────

type GlobalSearchResult = { kind: string; id: string; label: string };

function globalSearch(query: string): GlobalSearchResult[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  const results: GlobalSearchResult[] = [];
  const limit = 8;
  for (const e of dataStore.people.getAll()) {
    if (results.length >= limit * 7) break;
    if (e.person_label.toLowerCase().includes(q) || e.person_id.toLowerCase().includes(q))
      results.push({ kind: "person", id: e.person_id, label: e.person_label });
  }
  for (const e of dataStore.places.getAll()) {
    if (results.length >= limit * 7) break;
    if (e.place_label.toLowerCase().includes(q) || e.place_id.toLowerCase().includes(q) || (e.place_label_modern && e.place_label_modern.toLowerCase().includes(q)))
      results.push({ kind: "place", id: e.place_id, label: e.place_label });
  }
  for (const e of dataStore.groups.getAll()) {
    if (results.length >= limit * 7) break;
    if (e.group_label.toLowerCase().includes(q) || e.group_id.toLowerCase().includes(q))
      results.push({ kind: "group", id: e.group_id, label: e.group_label });
  }
  for (const e of dataStore.works.getAll()) {
    if (results.length >= limit * 7) break;
    if (e.title_display.toLowerCase().includes(q) || e.work_id.toLowerCase().includes(q))
      results.push({ kind: "work", id: e.work_id, label: e.title_display });
  }
  for (const e of dataStore.events.getAll()) {
    if (results.length >= limit * 7) break;
    if (e.event_label.toLowerCase().includes(q) || e.event_id.toLowerCase().includes(q))
      results.push({ kind: "event", id: e.event_id, label: e.event_label });
  }
  for (const e of dataStore.propositions.getAll()) {
    if (results.length >= limit * 7) break;
    if (e.proposition_label.toLowerCase().includes(q) || e.proposition_id.toLowerCase().includes(q))
      results.push({ kind: "proposition", id: e.proposition_id, label: e.proposition_label });
  }
  for (const e of dataStore.sources.getAll()) {
    if (results.length >= limit * 7) break;
    if (e.title.toLowerCase().includes(q) || e.source_id.toLowerCase().includes(q))
      results.push({ kind: "source", id: e.source_id, label: e.title });
  }
  return results.slice(0, 40);
}

// ─── Fixed-position tooltip (portal) ──────────────────────────────────────────

function FixedTooltip({ anchorRef, children }: { anchorRef: React.RefObject<HTMLElement | null>; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const tooltipW = 280;
    const tooltipH = 200;
    let top = rect.bottom + 4;
    let left = rect.left;
    if (top + tooltipH > window.innerHeight) top = rect.top - tooltipH - 4;
    if (left + tooltipW > window.innerWidth) left = window.innerWidth - tooltipW - 8;
    if (left < 4) left = 4;
    setPos({ top, left });
  }, [anchorRef]);

  if (!pos) return null;
  return createPortal(
    <div className="wiki-tooltip wiki-tooltip--fixed" style={{ top: pos.top, left: pos.left }}>{children}</div>,
    document.body,
  );
}

// ─── Field tooltip content ────────────────────────────────────────────────────

function EntityTooltipContent({ kind, id }: { kind: string; id: string }) {
  const rows: [string, string][] = [];
  if (kind === "person") {
    const e = dataStore.people.getById(id);
    if (e) {
      rows.push(["ID", e.person_id], ["Kind", e.person_kind]);
      if (e.name_alt.length) rows.push(["Alt names", e.name_alt.join("; ")]);
      if (e.name_native) rows.push(["Native", e.name_native]);
      if (e.birth_year_display) rows.push(["Born", e.birth_year_display]);
      if (e.death_year_display) rows.push(["Died", e.death_year_display]);
      if (e.notes) rows.push(["Notes", e.notes.slice(0, 120)]);
    }
  } else if (kind === "place") {
    const e = dataStore.places.getById(id);
    if (e) {
      rows.push(["ID", e.place_id], ["Kind", e.place_kind]);
      if (e.place_label_modern) rows.push(["Modern", e.place_label_modern]);
      if (e.modern_country_label) rows.push(["Country", e.modern_country_label]);
      if (e.lat != null) rows.push(["Coords", `${e.lat}, ${e.lon}`]);
      rows.push(["Precision", e.location_precision]);
    }
  } else if (kind === "work") {
    const e = dataStore.works.getById(id);
    if (e) {
      rows.push(["ID", e.work_id], ["Type", e.work_type], ["Kind", e.work_kind]);
      if (e.title_original) rows.push(["Original title", e.title_original]);
      if (e.language_original) rows.push(["Language", e.language_original]);
    }
  } else if (kind === "event") {
    const e = dataStore.events.getById(id);
    if (e) { rows.push(["ID", e.event_id], ["Type", e.event_type], ["Kind", e.event_kind]); }
  } else if (kind === "group") {
    const e = dataStore.groups.getById(id);
    if (e) { rows.push(["ID", e.group_id], ["Kind", e.group_kind], ["Christian", e.is_christian ? "yes" : "no"]); }
  } else if (kind === "proposition") {
    const e = dataStore.propositions.getById(id);
    if (e) {
      const topic = dataStore.topics.getById(e.topic_id);
      rows.push(["ID", e.proposition_id]);
      if (topic) rows.push(["Topic", topic.topic_label]);
      if (e.description) rows.push(["Description", e.description.slice(0, 120)]);
    }
  } else if (kind === "source") {
    const e = dataStore.sources.getById(id);
    if (e) {
      rows.push(["ID", e.source_id], ["Kind", e.source_kind]);
      if (e.author) rows.push(["Author", e.author]);
      if (e.year) rows.push(["Year", e.year]);
    }
  } else if (kind === "passage") {
    const e = dataStore.passages.getById(id);
    if (e) {
      const src = dataStore.sources.getById(e.source_id);
      rows.push(["ID", e.passage_id], ["Locator", e.locator]);
      if (src) rows.push(["Source", src.title]);
      if (e.excerpt) rows.push(["Excerpt", e.excerpt.slice(0, 120)]);
    }
  }
  if (rows.length === 0) return null;
  return (
    <table className="wiki-tooltip-table">
      <tbody>
        {rows.map(([k, v]) => <tr key={k}><td className="wiki-tooltip-key">{k}</td><td className="wiki-tooltip-val">{v}</td></tr>)}
      </tbody>
    </table>
  );
}

// ─── Entity chip (with portal tooltip) ────────────────────────────────────────

function EntityChip({ kind, id, onClick }: { kind: string; id: string; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const label = id ? getEntityLabel(kind, id) : "";
  return (
    <span ref={ref} className="wiki-entity-chip" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button type="button" className="wiki-chip-btn" onClick={onClick}>
        {kindIcon(kind)} {label || id}
      </button>
      {hovered && <FixedTooltip anchorRef={ref}><EntityTooltipContent kind={kind} id={id} /></FixedTooltip>}
    </span>
  );
}

// ─── Review badge ─────────────────────────────────────────────────────────────

const REVIEW_META: Record<string, { icon: string; cls: string }> = {
  approved:      { icon: "✓", cls: "wiki-review--approved" },
  reviewed:      { icon: "◉", cls: "wiki-review--reviewed" },
  disputed:      { icon: "✗", cls: "wiki-review--disputed" },
  needs_revision:{ icon: "↻", cls: "wiki-review--warn" },
  unreviewed:    { icon: "○", cls: "wiki-review--unreviewed" },
};

// ─── Evidence row ─────────────────────────────────────────────────────────────

function EvidenceRow({ ev, onSelectEntity }: { ev: ClaimEvidence; onSelectEntity: (kind: string, id: string) => void }) {
  const passage = dataStore.passages.getById(ev.passage_id);
  const source  = passage ? dataStore.sources.getById(passage.source_id) : null;
  const url     = getSourceExternalUrl(source);
  return (
    <div className="wiki-evidence-row">
      <span className={`wiki-ev-role wiki-ev-role--${ev.evidence_role}`}>{ev.evidence_role}</span>
      {passage && (
        <button type="button" className="wiki-chip-btn" onClick={() => onSelectEntity("source", passage.source_id)} title={ev.passage_id}>
          {source?.title ?? passage.source_id}{passage.locator ? ` ${passage.locator}` : ""}
        </button>
      )}
      {passage?.excerpt && <span className="wiki-ev-excerpt faint">{passage.excerpt.slice(0, 80)}…</span>}
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="wiki-ev-link">↗</a>}
    </div>
  );
}

// ─── Claim row ────────────────────────────────────────────────────────────────

function ClaimRow({ claim, focusKind, focusId, onSelectEntity, onSelectClaim, isSelected }: {
  claim: Claim;
  focusKind: string;
  focusId: string;
  onSelectEntity: (kind: string, id: string) => void;
  onSelectClaim: (claimId: string) => void;
  isSelected: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isSubject  = claim.subject_type === focusKind && claim.subject_id === focusId;
  const othKind    = isSubject ? claim.object_type  : claim.subject_type;
  const othId      = isSubject ? claim.object_id    : claim.subject_id;
  const predLabel  = getPredicateLabel(claim.predicate_id, isSubject);
  const auditStatus = getClaimAuditStatus(claim);
  const borderCls   = getClaimBorderClass(auditStatus);
  const evidence    = dataStore.claimEvidence.getForClaim(claim.claim_id);
  const reviews     = dataStore.claimReviews.getForClaim(claim.claim_id);

  const yearRange = claim.year_start
    ? `AD ${claim.year_start}${claim.year_end && claim.year_end !== claim.year_start ? `–${claim.year_end}` : ""}`
    : "";

  return (
    <div className={`wiki-claim-row ${borderCls}${isSelected ? " wiki-claim-row--selected" : ""}`}>
      <div className="wiki-claim-main" onClick={() => onSelectClaim(claim.claim_id)}>
        <div className="wiki-claim-left">
          <span className="wiki-pred-label">{predLabel}</span>
          {othId && claim.object_mode === "entity" ? (
            <EntityChip kind={othKind} id={othId} onClick={() => onSelectEntity(othKind, othId)} />
          ) : (
            <span className="wiki-claim-value">
              {claim.value_text || (claim.value_year != null ? `${claim.value_year}` : "") || (claim.value_boolean != null ? String(claim.value_boolean) : "")}
            </span>
          )}
          {claim.context_place_id && (
            <span className="wiki-context-place">
              <span className="faint">@ </span>
              <EntityChip kind="place" id={claim.context_place_id} onClick={() => onSelectEntity("place", claim.context_place_id)} />
            </span>
          )}
        </div>
        <div className="wiki-claim-right">
          {yearRange && <span className="wiki-year">{yearRange}</span>}
          {claim.certainty && claim.certainty !== "attested" && (
            <span className={`wiki-certainty wiki-certainty--${claim.certainty}`}>{claim.certainty}</span>
          )}
          {reviews.map((r, i) => {
            const m = REVIEW_META[r.review_status] ?? { icon: "?", cls: "" };
            const timestamp = r.reviewed_at ? new Date(r.reviewed_at).toISOString().split('T')[0] : '';
            return <span key={i} className={`wiki-review-badge ${m.cls}`} title={`${r.review_status} · ${r.confidence} · ${r.reviewer_id}${timestamp ? ` · ${timestamp}` : ''}`}>{m.icon}</span>;
          })}
          <span className="wiki-ev-count" title={`${evidence.length} evidence link(s)`}>
            {evidence.length}ev
          </span>
          <button type="button" className="wiki-expand-btn" onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}>
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="wiki-claim-evidence">
          {evidence.length === 0 && <div className="wiki-empty-sub">No evidence linked.</div>}
          {evidence.map((ev) => <EvidenceRow key={ev.passage_id} ev={ev} onSelectEntity={onSelectEntity} />)}
          {reviews.length > 0 && (
            <div className="wiki-claim-reviews-inline">
              {reviews.map((r, i) => {
                const m = REVIEW_META[r.review_status] ?? { icon: "?", cls: "" };
                const timestamp = r.reviewed_at ? new Date(r.reviewed_at).toISOString().split('T')[0] : '';
                return (
                  <div key={i} className="wiki-review-inline">
                    <span className={`wiki-review-badge ${m.cls}`}>{m.icon} {r.review_status}</span>
                    <span className="faint">{r.confidence}</span>
                    {r.reviewer_id && <span className="faint">by {r.reviewer_id}</span>}
                    {timestamp && <span className="faint">{timestamp}</span>}
                    {r.note && <span className="wiki-review-note-inline">{r.note}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Entity header ────────────────────────────────────────────────────────────

function EntityHeader({ kind, id, onBack, historyLength }: {
  kind: string; id: string; onBack: () => void; historyLength: number;
}) {
  const rows: [string, string][] = [];
  let title = getEntityLabel(kind, id);
  let subtitle = "";
  let tags: string[] = [];

  if (kind === "person") {
    const e = dataStore.people.getById(id);
    if (e) {
      subtitle = [e.birth_year_display, e.death_year_display].filter(Boolean).join(" – ");
      tags = [e.person_kind !== "individual" ? e.person_kind : ""].filter(Boolean);
      if (e.name_native) rows.push(["Native name", e.name_native]);
      if (e.name_alt.length) rows.push(["Also known as", e.name_alt.join(", ")]);
      if (e.notes) rows.push(["Notes", e.notes]);
    }
  } else if (kind === "place") {
    const e = dataStore.places.getById(id);
    if (e) {
      tags = [e.place_kind];
      if (e.place_label_modern) rows.push(["Modern name", e.place_label_modern]);
      if (e.modern_country_label) rows.push(["Country", e.modern_country_label]);
      if (e.lat != null) rows.push(["Coordinates", `${e.lat}°, ${e.lon}°`]);
      rows.push(["Precision", e.location_precision]);
      if (e.notes) rows.push(["Notes", e.notes]);
    }
  } else if (kind === "group") {
    const e = dataStore.groups.getById(id);
    if (e) {
      tags = [e.group_kind, e.is_christian ? "Christian" : "non-Christian"];
      if (e.notes) rows.push(["Notes", e.notes]);
    }
  } else if (kind === "work") {
    const e = dataStore.works.getById(id);
    if (e) {
      subtitle = `${e.work_type} · ${e.language_original}`;
      tags = [e.work_kind !== "single_work" ? e.work_kind : ""].filter(Boolean);
      if (e.title_original) rows.push(["Original title", e.title_original]);
      if (e.notes) rows.push(["Notes", e.notes]);
    }
  } else if (kind === "event") {
    const e = dataStore.events.getById(id);
    if (e) {
      tags = [e.event_type, e.event_kind !== "simple" ? e.event_kind : ""].filter(Boolean);
      if (e.notes) rows.push(["Notes", e.notes]);
    }
  } else if (kind === "proposition") {
    const e = dataStore.propositions.getById(id);
    if (e) {
      const topic = dataStore.topics.getById(e.topic_id);
      subtitle = topic?.topic_label ?? e.topic_id;
      if (e.dimension_id) { const dim = dataStore.dimensions.getById(e.dimension_id); if (dim) rows.push(["Dimension", dim.dimension_label]); }
      if (e.polarity_family) rows.push(["Polarity family", e.polarity_family]);
      if (e.description) rows.push(["Description", e.description]);
      if (e.notes) rows.push(["Notes", e.notes]);
    }
  } else if (kind === "source") {
    const e = dataStore.sources.getById(id);
    if (e) {
      title = e.title;
      subtitle = [e.author, e.year].filter(Boolean).join(" · ");
      tags = [e.source_kind];
      if (e.editor) rows.push(["Editor", e.editor]);
      if (e.publisher) rows.push(["Publisher", e.publisher]);
      if (e.container_title) rows.push(["In", e.container_title]);
      if (e.isbn_issn) rows.push(["ISBN/ISSN", e.isbn_issn]);
      if (e.url) rows.push(["URL", e.url]);
      if (e.notes) rows.push(["Notes", e.notes]);
    }
  }

  return (
    <div className="wiki-entity-header">
      {historyLength > 0 && (
        <button type="button" className="back-btn wiki-back-btn" onClick={onBack}>← Back</button>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="wiki-entity-kind-badge">{kindIcon(kind)} {kindLabel(kind)}</div>
        <CrossPageNav kind={kind} id={id} current="wiki" />
      </div>
      <div className="wiki-entity-title">{title}</div>
      {subtitle && <div className="wiki-entity-subtitle">{subtitle}</div>}
      {tags.length > 0 && (
        <div className="flex-wrap-4" style={{ marginTop: 4 }}>
          {tags.map((t, i) => <span key={i} className="tag">{t}</span>)}
        </div>
      )}
      {rows.length > 0 && (
        <div className="wiki-entity-fields">
          {rows.map(([k, v]) => (
            <div key={k} className="wiki-entity-field">
              <span className="wiki-field-key">{k}</span>
              <span className="wiki-field-val">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Claims panel (grouped by predicate) ──────────────────────────────────────

function ClaimsPanel({ kind, id, onSelectEntity, selectedClaimId, onSelectClaim }: {
  kind: string; id: string;
  onSelectEntity: (kind: string, id: string) => void;
  selectedClaimId: string | null;
  onSelectClaim: (id: string) => void;
}) {
  const claims = useMemo(() => getEntityAllClaims(kind, id), [kind, id]);
  const grouped = useMemo(() => {
    const map = new Map<string, Claim[]>();
    for (const c of claims) { const b = map.get(c.predicate_id) ?? []; b.push(c); map.set(c.predicate_id, b); }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [claims]);

  const stats = useMemo(() => {
    let noEv = 0, unrev = 0, disp = 0, appr = 0;
    for (const c of claims) {
      const s = getClaimAuditStatus(c);
      if (s === "no-evidence") noEv++;
      if (s === "unreviewed") unrev++;
      if (s === "disputed") disp++;
      if (s === "approved") appr++;
    }
    return { total: claims.length, noEv, unrev, disp, appr };
  }, [claims]);

  // Source-specific: show passages and their linked claims
  if (kind === "source") {
    const passages = dataStore.passages.getBySource(id);
    return (
      <div className="wiki-claims-panel">
        <div className="wiki-audit-summary">
          <span className="wiki-audit-total">{passages.length} passages</span>
        </div>
        {passages.length === 0 && <div className="empty-state">No passages for this source.</div>}
        {passages.map((p) => {
          const linkedEvidence = dataStore.claimEvidence.getAll().filter((ev) => ev.passage_id === p.passage_id);
          return (
            <div key={p.passage_id} className="wiki-pred-group">
              <div className="wiki-pred-group-header">
                <span className="wiki-pred-id">{p.locator || p.passage_id}</span>
                <span className="wiki-pred-desc faint">{p.locator_type}</span>
                <span className="wiki-pred-count faint">{linkedEvidence.length} claim(s)</span>
              </div>
              {p.excerpt && <div className="wiki-excerpt" style={{ margin: "4px 0 6px 4px" }}>{p.excerpt}</div>}
              {linkedEvidence.map((ev) => {
                const claim = dataStore.claims.getById(ev.claim_id);
                if (!claim) return null;
                return (
                  <ClaimRow
                    key={claim.claim_id}
                    claim={claim}
                    focusKind={claim.subject_type}
                    focusId={claim.subject_id}
                    onSelectEntity={onSelectEntity}
                    onSelectClaim={onSelectClaim}
                    isSelected={claim.claim_id === selectedClaimId}
                  />
                );
              })}
              {linkedEvidence.length === 0 && <div className="wiki-empty-sub faint" style={{ paddingLeft: 4 }}>No claims reference this passage.</div>}
            </div>
          );
        })}
      </div>
    );
  }

  const editorNotes = useMemo(() => dataStore.editorNotes.getForEntity(kind, id), [kind, id]);

  if (claims.length === 0 && editorNotes.length === 0) return <div className="empty-state">No claims for this entity.</div>;

  return (
    <div className="wiki-claims-panel">
      {/* Editor notes in-feed */}
      {editorNotes.length > 0 && (
        <div className="wiki-pred-group">
          <div className="wiki-pred-group-header">
            <span className="wiki-pred-id">editor notes</span>
            <span className="wiki-pred-count faint">{editorNotes.length}</span>
          </div>
          {editorNotes.map((note) => (
            <div key={note.editor_note_id} style={{ padding: "8px 10px", background: "var(--surface)", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", marginBottom: 4 }}>
              <div style={{ display: "flex", gap: "6px", marginBottom: "4px", fontSize: "0.72rem" }}>
                <span className="tag">{note.note_kind}</span>
                {note.created_by && <span className="faint">by {note.created_by}</span>}
              </div>
              <div style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>{note.body_md}</div>
            </div>
          ))}
        </div>
      )}

      <div className="wiki-audit-summary">
        <span className="wiki-audit-total">{stats.total} claims</span>
        {stats.noEv > 0 && <span className="wiki-audit-chip wiki-audit-chip--red">{stats.noEv} no evidence</span>}
        {stats.unrev > 0 && <span className="wiki-audit-chip wiki-audit-chip--orange">{stats.unrev} unreviewed</span>}
        {stats.disp > 0 && <span className="wiki-audit-chip wiki-audit-chip--red">{stats.disp} disputed</span>}
        {stats.appr > 0 && <span className="wiki-audit-chip wiki-audit-chip--green">{stats.appr} approved</span>}
      </div>
      {grouped.map(([predicateId, predClaims]) => {
        const predType = dataStore.predicateTypes.getById(predicateId);
        return (
          <div key={predicateId} className="wiki-pred-group">
            <div className="wiki-pred-group-header">
              <span className="wiki-pred-id">{`(${predClaims.length}) ${predicateId.replace(/_/g, " ")}`}</span>
            </div>
            {predClaims.map((claim) => (
              <ClaimRow key={claim.claim_id} claim={claim} focusKind={kind} focusId={id}
                onSelectEntity={onSelectEntity} onSelectClaim={onSelectClaim}
                isSelected={claim.claim_id === selectedClaimId} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Claim detail panel ───────────────────────────────────────────────────────

function ClaimDetailPanel({ claimId, onSelectEntity, onClose }: {
  claimId: string; onSelectEntity: (kind: string, id: string) => void; onClose: () => void;
}) {
  const claim = dataStore.claims.getById(claimId);
  if (!claim) return null;
  const evidence = dataStore.claimEvidence.getForClaim(claimId);
  const reviews  = dataStore.claimReviews.getForClaim(claimId);
  const fields: [string, string][] = [
    ["ID", claim.claim_id], ["Status", claim.claim_status], ["Predicate", claim.predicate_id],
    ["Subject", `${claim.subject_type}: ${claim.subject_id}`],
    ["Object mode", claim.object_mode],
  ];
  if (claim.object_mode === "entity") fields.push(["Object", `${claim.object_type}: ${claim.object_id}`]);
  else if (claim.value_text) fields.push(["Value (text)", claim.value_text]);
  else if (claim.value_year != null) fields.push(["Value (year)", String(claim.value_year)]);
  else if (claim.value_boolean != null) fields.push(["Value (bool)", String(claim.value_boolean)]);
  fields.push(["Certainty", claim.certainty], ["Polarity", claim.polarity]);
  if (claim.year_start != null) fields.push(["Year start", String(claim.year_start)]);
  if (claim.year_end != null) fields.push(["Year end", String(claim.year_end)]);
  if (claim.context_place_id) fields.push(["Context place", claim.context_place_id]);
  if (claim.created_by) fields.push(["Created by", claim.created_by]);
  if (claim.updated_at) fields.push(["Updated", claim.updated_at]);

  return (
    <div className="wiki-detail-panel">
      <div className="wiki-detail-header">
        <span className="wiki-detail-title">🔗 Claim Detail</span>
        <button type="button" className="close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="wiki-detail-body">
        <div className="wiki-detail-section">
          <div className="wiki-detail-section-title">Entities</div>
          <div className="wiki-detail-entity-row">
            <EntityChip kind={claim.subject_type} id={claim.subject_id} onClick={() => onSelectEntity(claim.subject_type, claim.subject_id)} />
            <span className="wiki-arrow-pred">{claim.predicate_id.replace(/_/g, " ")}</span>
            {claim.object_mode === "entity" && claim.object_id ? (
              <EntityChip kind={claim.object_type} id={claim.object_id} onClick={() => onSelectEntity(claim.object_type, claim.object_id)} />
            ) : (
              <span className="wiki-claim-value">{claim.value_text || claim.value_year || ""}</span>
            )}
          </div>
        </div>
        <div className="wiki-detail-section">
          <div className="wiki-detail-section-title">All fields</div>
          <div className="wiki-fields-grid">
            {fields.map(([k, v]) => (
              <div key={k} className="wiki-fields-row"><span className="wiki-field-key">{k}</span><span className="wiki-field-val">{v}</span></div>
            ))}
          </div>
        </div>
        <div className="wiki-detail-section">
          <div className="wiki-detail-section-title">Evidence ({evidence.length})</div>
          {evidence.length === 0 ? <div className="wiki-empty-sub">⚠ No evidence linked.</div> : (
            <div className="flex-col-8">
              {evidence.map((ev) => {
                const passage = dataStore.passages.getById(ev.passage_id);
                const source  = passage ? dataStore.sources.getById(passage.source_id) : null;
                const url     = getSourceExternalUrl(source);
                return (
                  <div key={ev.passage_id} className="wiki-ev-detail">
                    <div className="wiki-ev-detail-head">
                      <span className={`wiki-ev-role wiki-ev-role--${ev.evidence_role}`}>{ev.evidence_role}</span>
                      {passage && <button type="button" className="wiki-chip-btn" onClick={() => source && onSelectEntity("source", source.source_id)}>{source?.title ?? passage.source_id} {passage.locator}</button>}
                    </div>
                    {passage?.excerpt && <div className="wiki-excerpt">{passage.excerpt}</div>}
                    {url && source && <a href={url} target="_blank" rel="noopener noreferrer" className="citation-link">{getSourceAccessTitle(source)}</a>}
                    {ev.notes && <div className="faint" style={{ fontSize: "0.75rem" }}>{ev.notes}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="wiki-detail-section">
          <div className="wiki-detail-section-title">Reviews ({reviews.length})</div>
          {reviews.length === 0 ? <div className="wiki-empty-sub">○ Not reviewed.</div> : (
            <div className="flex-col-8">
              {reviews.map((r, i) => {
                const m = REVIEW_META[r.review_status] ?? { icon: "?", cls: "" };
                const timestamp = r.reviewed_at ? new Date(r.reviewed_at).toISOString().split('T')[0] : '';
                return (
                  <div key={i} className="wiki-review-detail">
                    <div className="wiki-review-detail-head">
                      <span className={`wiki-review-badge ${m.cls}`}>{m.icon} {r.review_status}</span>
                      <span className="faint">{r.confidence}</span>
                      {r.reviewer_id && <span className="faint">by {r.reviewer_id}</span>}
                      {timestamp && <span className="faint">{timestamp}</span>}
                    </div>
                    {r.note && <div className="wiki-review-note">{r.note}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Entity list (left panel) ─────────────────────────────────────────────────

function EntityList({ kind, search, selectedId, onSelect }: {
  kind: string; search: string; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const all = useMemo(() => getAllEntities(kind), [kind]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return all;
    return all.filter((e) => e.label.toLowerCase().includes(q) || e.id.toLowerCase().includes(q));
  }, [all, search]);
  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(filtered, 40);

  if (filtered.length === 0) return <div className="empty-state">No results.</div>;
  return (
    <div className="wiki-entity-list">
      {pageItems.map((e) => (
        <button key={e.id} type="button"
          className={`wiki-entity-item${selectedId === e.id ? " wiki-entity-item--active" : ""}`}
          onClick={() => onSelect(e.id)}>
          <span className="wiki-entity-item-label">{e.label}</span>
          {e.count > 0 && <span className="wiki-entity-item-count" title={e.countLabel}>{e.count}</span>}
        </button>
      ))}
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}

// ─── Audit view ───────────────────────────────────────────────────────────────

type AuditFilter = {
  statusFilter: ClaimAuditStatus | "all" | "flagged" | "duplicates";
  entityTypeFilter: string;
  predicateFilter: string;
  certaintyFilter: string;
  searchFilter: string;
};

function AuditView({ onSelectEntity, onSelectClaim, selectedClaimId }: {
  onSelectEntity: (kind: string, id: string) => void;
  onSelectClaim: (id: string) => void;
  selectedClaimId: string | null;
}) {
  const [filters, setFilters] = useState<AuditFilter>({
    statusFilter: "all", entityTypeFilter: "all", predicateFilter: "", certaintyFilter: "all", searchFilter: "",
  });

  const allRows = useMemo(() => getAuditRows(), []);

  const stats = useMemo(() => {
    let noEv = 0, unrev = 0, disp = 0, appr = 0, dupes = 0;
    for (const r of allRows) {
      if (r.status === "no-evidence") noEv++;
      if (r.status === "unreviewed") unrev++;
      if (r.status === "disputed") disp++;
      if (r.status === "approved") appr++;
      if (r.isDuplicate) dupes++;
    }
    return { total: allRows.length, noEv, unrev, disp, appr, dupes };
  }, [allRows]);

  const filtered = useMemo(() => {
    let rows = allRows;
    const sf = filters.statusFilter;
    if (sf === "flagged") rows = rows.filter((r) => r.status === "no-evidence" || r.status === "unreviewed" || r.status === "disputed" || r.status === "needs-revision");
    else if (sf === "duplicates") rows = rows.filter((r) => r.isDuplicate);
    else if (sf !== "all") rows = rows.filter((r) => r.status === sf);
    if (filters.entityTypeFilter !== "all") rows = rows.filter((r) => r.claim.subject_type === filters.entityTypeFilter || r.claim.object_type === filters.entityTypeFilter);
    if (filters.certaintyFilter !== "all") rows = rows.filter((r) => r.claim.certainty === filters.certaintyFilter);
    if (filters.predicateFilter) {
      const pq = filters.predicateFilter.toLowerCase();
      rows = rows.filter((r) => r.claim.predicate_id.includes(pq));
    }
    if (filters.searchFilter) {
      const sq = filters.searchFilter.toLowerCase();
      rows = rows.filter((r) => r.subjectLabel.toLowerCase().includes(sq) || r.objectLabel.toLowerCase().includes(sq) || r.claim.claim_id.toLowerCase().includes(sq));
    }
    return rows;
  }, [allRows, filters]);

  const { page, setPage, pageItems, total, pageSize } = usePaginatedList(filtered, 50);

  const statusChips: { key: AuditFilter["statusFilter"]; label: string; count: number; cls: string }[] = [
    { key: "all", label: "All", count: stats.total, cls: "" },
    { key: "flagged", label: "Flagged", count: stats.noEv + stats.unrev + stats.disp, cls: "wiki-audit-chip--red" },
    { key: "no-evidence", label: "No evidence", count: stats.noEv, cls: "wiki-audit-chip--red" },
    { key: "unreviewed", label: "Unreviewed", count: stats.unrev, cls: "wiki-audit-chip--orange" },
    { key: "disputed", label: "Disputed", count: stats.disp, cls: "wiki-audit-chip--red" },
    { key: "approved", label: "Approved", count: stats.appr, cls: "wiki-audit-chip--green" },
    { key: "duplicates", label: "Duplicates", count: stats.dupes, cls: "wiki-audit-chip--orange" },
  ];

  return (
    <div className="wiki-audit-view">
      {/* Stats bar */}
      <div className="wiki-audit-stats">
        <span className="wiki-audit-stat">{stats.total} total</span>
        <span className="wiki-audit-stat wiki-stat--red">{stats.noEv} no evidence</span>
        <span className="wiki-audit-stat wiki-stat--orange">{stats.unrev} unreviewed</span>
        <span className="wiki-audit-stat wiki-stat--red">{stats.disp} disputed</span>
        <span className="wiki-audit-stat wiki-stat--green">{stats.appr} approved</span>
        <span className="wiki-audit-stat wiki-stat--orange">{stats.dupes} duplicates</span>
      </div>

      {/* Filter bar */}
      <div className="wiki-audit-filters">
        <div className="wiki-audit-filter-row">
          {statusChips.map((c) => (
            <button key={c.key} type="button"
              className={`wiki-audit-chip-btn${filters.statusFilter === c.key ? " active" : ""} ${c.cls}`}
              onClick={() => setFilters((f) => ({ ...f, statusFilter: c.key }))}>
              {c.label} ({c.count})
            </button>
          ))}
        </div>
        <div className="wiki-audit-filter-row">
          <select className="wiki-audit-select" value={filters.entityTypeFilter}
            onChange={(e) => setFilters((f) => ({ ...f, entityTypeFilter: e.target.value }))}>
            <option value="all">All entity types</option>
            {ENTITY_TABS.map((t) => <option key={t.kind} value={t.kind}>{t.label}</option>)}
          </select>
          <select className="wiki-audit-select" value={filters.certaintyFilter}
            onChange={(e) => setFilters((f) => ({ ...f, certaintyFilter: e.target.value }))}>
            <option value="all">All certainty</option>
            <option value="attested">Attested</option>
            <option value="probable">Probable</option>
            <option value="possible">Possible</option>
            <option value="claimed_tradition">Claimed tradition</option>
            <option value="legendary">Legendary</option>
            <option value="unknown">Unknown</option>
          </select>
          <input type="text" className="wiki-audit-input" placeholder="Filter predicate…"
            value={filters.predicateFilter} onChange={(e) => setFilters((f) => ({ ...f, predicateFilter: e.target.value }))} />
          <input type="text" className="wiki-audit-input" placeholder="Search entities…"
            value={filters.searchFilter} onChange={(e) => setFilters((f) => ({ ...f, searchFilter: e.target.value }))} />
        </div>
      </div>

      {/* Results */}
      <div className="wiki-audit-results">
        <div className="wiki-audit-table-header">
          <span className="wiki-audit-col wiki-audit-col--subject">Subject</span>
          <span className="wiki-audit-col wiki-audit-col--pred">Predicate</span>
          <span className="wiki-audit-col wiki-audit-col--object">Object</span>
          <span className="wiki-audit-col wiki-audit-col--cert">Certainty</span>
          <span className="wiki-audit-col wiki-audit-col--ev">Ev</span>
          <span className="wiki-audit-col wiki-audit-col--rev">Rev</span>
          <span className="wiki-audit-col wiki-audit-col--status">Status</span>
        </div>
        {pageItems.map((row) => {
          const borderCls = getClaimBorderClass(row.status);
          const isSelected = row.claim.claim_id === selectedClaimId;
          return (
            <div key={row.claim.claim_id}
              className={`wiki-audit-row ${borderCls}${isSelected ? " wiki-audit-row--selected" : ""}${row.isDuplicate ? " wiki-audit-row--dupe" : ""}`}
              onClick={() => onSelectClaim(row.claim.claim_id)}>
              <span className="wiki-audit-col wiki-audit-col--subject" onClick={(e) => e.stopPropagation()}>
                <EntityChip kind={row.claim.subject_type} id={row.claim.subject_id} onClick={() => onSelectEntity(row.claim.subject_type, row.claim.subject_id)} />
              </span>
              <span className="wiki-audit-col wiki-audit-col--pred">{row.claim.predicate_id.replace(/_/g, " ")}</span>
              <span className="wiki-audit-col wiki-audit-col--object" onClick={(e) => e.stopPropagation()}>
                {row.claim.object_mode === "entity" && row.claim.object_id ? (
                  <EntityChip kind={row.claim.object_type} id={row.claim.object_id} onClick={() => onSelectEntity(row.claim.object_type, row.claim.object_id)} />
                ) : <span className="faint">{row.objectLabel}</span>}
              </span>
              <span className={`wiki-audit-col wiki-audit-col--cert wiki-certainty--${row.claim.certainty}`}>{row.claim.certainty}</span>
              <span className="wiki-audit-col wiki-audit-col--ev">{row.evidenceCount}</span>
              <span className="wiki-audit-col wiki-audit-col--rev">{row.reviewCount}</span>
              <span className={`wiki-audit-col wiki-audit-col--status wiki-status--${row.status}`}>
                {row.status.replace("-", " ")}{row.isDuplicate ? " ⚑" : ""}
              </span>
            </div>
          );
        })}
        {pageItems.length === 0 && <div className="empty-state">No claims match these filters.</div>}
      </div>
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}

// ─── WikiPage (root) ──────────────────────────────────────────────────────────

export function WikiPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<WikiMode>("browse");
  const [entityKind, setEntityKind] = useState("person");
  const [search, setSearch] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [showGlobalResults, setShowGlobalResults] = useState(false);
  const globalRef = useRef<HTMLDivElement>(null);
  const lastHandledParam = useRef("");

  // Selection history stack
  const [selection, setSelection] = useState<BrowseSelection | null>(null);
  const [history, setHistory] = useState<BrowseSelection[]>([]);

  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  // Handle deep-link from URL params (e.g. /wiki?kind=person&id=paul-of-tarsus)
  useEffect(() => {
    const kind = searchParams.get("kind");
    const id = searchParams.get("id");
    if (!kind || !id) return;
    const paramKey = `${kind}:${id}`;
    if (paramKey === lastHandledParam.current) return;
    lastHandledParam.current = paramKey;
    setMode("browse");
    setEntityKind(kind);
    setSelection({ kind, id });
    setHistory([]);
    setSelectedClaimId(null);
  }, [searchParams]);

  const pushSelection = useCallback((sel: BrowseSelection) => {
    setSelection((prev) => {
      if (prev) setHistory((h) => [...h, prev]);
      return sel;
    });
    setSelectedClaimId(null);
  }, []);

  const popSelection = useCallback(() => {
    setHistory((h) => {
      const newH = [...h];
      const prev = newH.pop() ?? null;
      setSelection(prev);
      return newH;
    });
    setSelectedClaimId(null);
  }, []);

  function handleSelectEntity(kind: string, id: string) {
    setMode("browse");
    if (kind !== entityKind) { setEntityKind(kind); setSearch(""); }
    pushSelection({ kind, id });
  }

  function handleSelectClaim(claimId: string) {
    setSelectedClaimId(claimId);
  }

  // Global search results
  const globalResults = useMemo(() => globalSearch(globalQuery), [globalQuery]);

  // Close global dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (globalRef.current && !globalRef.current.contains(e.target as Node)) setShowGlobalResults(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="wiki-page">
      {/* ── Left panel ── */}
      <div className="wiki-left">
        <div className="wiki-left-header">
          <div className="panel-eyebrow">Data Wiki</div>
          <div className="wiki-mode-toggle">
            <button type="button" className={`wiki-mode-btn${mode === "browse" ? " active" : ""}`} onClick={() => setMode("browse")}>Browse</button>
            <button type="button" className={`wiki-mode-btn${mode === "audit" ? " active" : ""}`} onClick={() => setMode("audit")}>Audit</button>
          </div>
        </div>

        {/* Global search */}
        <div className="wiki-global-search" ref={globalRef}>
          <span className="faint">🔍</span>
          <input type="text" placeholder="Search all entities…" value={globalQuery}
            onChange={(e) => { setGlobalQuery(e.target.value); setShowGlobalResults(true); }}
            onFocus={() => { if (globalQuery.length >= 2) setShowGlobalResults(true); }} />
          {globalQuery && <button type="button" className="close-btn" onClick={() => { setGlobalQuery(""); setShowGlobalResults(false); }}>✕</button>}
          {showGlobalResults && globalResults.length > 0 && (
            <div className="wiki-global-dropdown">
              {globalResults.map((r) => (
                <button key={`${r.kind}:${r.id}`} type="button" className="wiki-global-result"
                  onClick={() => { handleSelectEntity(r.kind, r.id); setShowGlobalResults(false); setGlobalQuery(""); setMode("browse"); }}>
                  <span className="wiki-global-result-icon">{kindIcon(r.kind)}</span>
                  <span className="wiki-global-result-label">{r.label}</span>
                  <span className="wiki-global-result-kind faint">{kindLabel(r.kind)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {mode === "browse" && (
          <>
            <div className="wiki-kind-tabs">
              {ENTITY_TABS.map((t) => (
                <button key={t.kind} type="button"
                  className={`wiki-kind-tab${entityKind === t.kind ? " active" : ""}`}
                  onClick={() => { setEntityKind(t.kind); setSelection(null); setHistory([]); setSearch(""); setSelectedClaimId(null); }}>
                  {KIND_ICONS[t.kind] ?? "•"} {t.label}
                </button>
              ))}
            </div>
            <div className="wiki-search-bar">
              <span className="faint">🔍</span>
              <input type="text" placeholder={`Filter ${ENTITY_TABS.find((t) => t.kind === entityKind)?.label.toLowerCase() ?? ""}…`}
                value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && <button type="button" className="close-btn" onClick={() => setSearch("")}>✕</button>}
            </div>
            <EntityList kind={entityKind} search={search} selectedId={selection?.kind === entityKind ? selection.id : null}
              onSelect={(id) => { pushSelection({ kind: entityKind, id }); }} />
          </>
        )}

        {mode === "audit" && (
          <div className="wiki-audit-left-info">
            <div className="wiki-audit-left-title">Claim Audit</div>
            <p className="faint" style={{ fontSize: "0.8rem", padding: "0 14px" }}>
              Review all claims across every entity. Filter by status, entity type, certainty, and predicate to find issues.
            </p>
            <p className="faint" style={{ fontSize: "0.78rem", padding: "4px 14px 0" }}>
              Red border = no evidence or disputed. Orange = unreviewed. Green = approved.
            </p>
          </div>
        )}
      </div>

      {/* ── Center ── */}
      <div className="wiki-center">
        {mode === "browse" && selection ? (
          <>
            <EntityHeader kind={selection.kind} id={selection.id} onBack={popSelection} historyLength={history.length} />
            <ClaimsPanel kind={selection.kind} id={selection.id}
              onSelectEntity={handleSelectEntity} selectedClaimId={selectedClaimId} onSelectClaim={handleSelectClaim} />
          </>
        ) : mode === "browse" ? (
          <div className="wiki-empty-center">
            <div className="panel-eyebrow" style={{ marginBottom: 8 }}>Select an entity</div>
            <div className="faint">Choose an entity from the browser or use the global search.</div>
          </div>
        ) : (
          <AuditView onSelectEntity={handleSelectEntity} onSelectClaim={handleSelectClaim} selectedClaimId={selectedClaimId} />
        )}
      </div>

      {/* ── Right: claim detail ── */}
      {selectedClaimId && (
        <ClaimDetailPanel claimId={selectedClaimId} onSelectEntity={handleSelectEntity}
          onClose={() => setSelectedClaimId(null)} />
      )}
    </div>
  );
}
