import { useState } from "react";
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown, StickyNote, MapPin } from "lucide-react";
import s from "./Wiki.module.css";
import { dataStore, getEntityLabel } from "../../data/dataStore";
import { useClaimsData, EVIDENCE_ROLES } from "../../hooks/useClaimsData";
import { CERTAINTY_OPTIONS } from "../shared/entityConstants";
import { SearchInput } from "../shared/SearchInput";
import { DropdownSelect } from "../shared/Dropdown";
import { EntityLink } from "../shared/EntityLink";
import { NoteCard } from "../shared/NoteCard";
import { ClaimRow } from "./ClaimRow";
import { DerivationChain } from "../shared/DerivationChain";

interface ClaimsPanelProps {
  kind: string;
  id: string;
  onSelectEntity: (kind: string, id: string) => void;
  selectedClaimId: string | null;
  onSelectClaim: (id: string) => void;
}

export function ClaimsPanel({ kind, id, onSelectEntity, selectedClaimId, onSelectClaim }: ClaimsPanelProps) {
  const {
    roleFilter, setRoleFilter, certFilter, setCertFilter, reviewFilter, setReviewFilter,
    predSearch, setPredSearch,
    claims, grouped, stats, editorNotes,
  } = useClaimsData(kind, id);

  // Source-specific: show passages and their linked claims
  if (kind === "source") {
    const passages = dataStore.passages.getBySource(id);
    return (
      <div className={s.claimsPanel}>
        <div className={s.auditSummary}>
          <span className={s.auditTotal}>{passages.length} passages</span>
        </div>
        {passages.length === 0 && <div className={s.emptyState}>No passages for this source.</div>}
        {passages.map((p) => {
          const linkedEvidence = dataStore.claimEvidence.getAll().filter((ev) => ev.passage_id === p.passage_id);
          return (
            <div key={p.passage_id} className={s.predGroup}>
              <div className={s.predGroupHeader}>
                <span className={s.predId}>{p.locator || p.passage_id}</span>
                <span className={`${s.predDesc} ${s.faint}`}>{p.locator_type}</span>
                <span className={`${s.predCount} ${s.faint}`}>{linkedEvidence.length} claim(s)</span>
              </div>
              {p.excerpt && <div className={`${s.excerpt} ${s.excerptIndent}`}>{p.excerpt}</div>}
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
              {linkedEvidence.length === 0 && <div className={`${s.emptySub} ${s.faint} ${s.emptySubIndent}`}>No claims reference this passage.</div>}
            </div>
          );
        })}
      </div>
    );
  }

  const [notesOpen, setNotesOpen] = useState(false);

  if (claims.length === 0 && editorNotes.length === 0) return <div className={s.emptyState}>No claims for this entity.</div>;

  return (
    <div className={s.claimsPanel}>
      {/* Editor notes — collapsible, collapsed by default */}
      {editorNotes.length > 0 && (
        <div className={s.predGroup}>
          <button type="button" className={s.sectionToggleBtn} onClick={() => setNotesOpen((v) => !v)}>
            <span className={s.predId}><StickyNote size={11} /> {editorNotes.length} Notes</span>
            {notesOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {notesOpen && editorNotes.map((note) => (
            <NoteCard key={note.editor_note_id} note={note} onSelectEntity={onSelectEntity} yearLabel={note.note_kind} />
          ))}
        </div>
      )}

      {/* Filters — directly above claims count */}
      <div className={s.evRoleFilter}>
        <DropdownSelect
          value={roleFilter ?? "all"}
          onChange={(value) => setRoleFilter(value as any)}
          options={EVIDENCE_ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
        />
        <DropdownSelect
          value={certFilter}
          onChange={(value) => setCertFilter(value)}
          options={CERTAINTY_OPTIONS}
        />
        <DropdownSelect
          value={reviewFilter}
          onChange={(value) => setReviewFilter(value)}
          options={[
            { value: "all", label: "All review" },
            { value: "unreviewed", label: "Unreviewed" },
            { value: "reviewed", label: "Reviewed" },
            { value: "approved", label: "Approved" },
            { value: "disputed", label: "Disputed" },
          ]}
        />
        <SearchInput value={predSearch} onChange={setPredSearch} placeholder="Filter predicate…" />
      </div>

      <div className={s.auditSummary}>
        <span className={s.auditTotal}>{stats.total} claims</span>
        {stats.noEv > 0 && <span className={`${s.auditChip} ${s.auditChipRed}`}>{stats.noEv} no evidence</span>}
        {stats.unrev > 0 && <span className={`${s.auditChip} ${s.auditChipOrange}`}>{stats.unrev} unreviewed</span>}
        {stats.disp > 0 && <span className={`${s.auditChip} ${s.auditChipRed}`}>{stats.disp} disputed</span>}
        {stats.appr > 0 && <span className={`${s.auditChip} ${s.auditChipGreen}`}>{stats.appr} approved</span>}
      </div>
      {grouped.map(([predicateId, predClaims]) => {
        return (
          <div key={predicateId} className={s.predGroup}>
            <div className={s.predGroupHeader}>
              <span className={s.predId}>{predClaims.length} {predicateId.replace(/_/g, " ")}</span>
            </div>
            {predClaims.map((claim) => (
              <ClaimRow key={claim.claim_id} claim={claim} focusKind={kind} focusId={id}
                onSelectEntity={onSelectEntity} onSelectClaim={onSelectClaim}
                isSelected={claim.claim_id === selectedClaimId} roleFilter={roleFilter} />
            ))}
          </div>
        );
      })}

      {/* Derived places for propositions — shown at bottom after all claims */}
      {kind === "proposition" && <PropositionPlaces propId={id} onSelectEntity={onSelectEntity} />}
    </div>
  );
}

// ── Derived Places for Propositions ──────────────────────────────────────────

function PropositionPlaces({ propId, onSelectEntity }: { propId: string; onSelectEntity: (k: string, i: string) => void }) {
  const [open, setOpen] = useState(false);
  const [expandedPlace, setExpandedPlace] = useState<string | null>(null);
  const presenceRows = dataStore.propositionPlacePresence.getForProposition(propId);
  if (presenceRows.length === 0) return null;

  return (
    <div className={s.predGroup}>
      <button type="button" className={s.sectionToggleBtn} onClick={() => setOpen((v) => !v)}>
        <span className={s.predId}><MapPin size={11} /> {presenceRows.length} Derived Places</span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && presenceRows.map((pp) => {
        const isOpen = expandedPlace === `${pp.place_id}-${pp.year_start}`;
        const yearRange = pp.year_start != null
          ? `AD ${pp.year_start}${pp.year_end != null && pp.year_end !== pp.year_start ? `–${pp.year_end}` : ""}`
          : "";
        return (
          <div key={`${pp.place_id}-${pp.year_start}-${pp.year_end}`} className={s.claimRow}>
            <div className={s.claimMain} onClick={() => onSelectEntity("place", pp.place_id)}>
              <div className={s.claimLeft}>
                <span className={s.predLabel}>{pp.stance}</span>
                <EntityLink kind="place" id={pp.place_id} onClick={() => onSelectEntity("place", pp.place_id)} />
                <span className={s.faint}>
                  <TrendingUp size={11} /> {pp.supporting_claim_count}
                  {" "}<TrendingDown size={11} /> {pp.opposing_claim_count}
                </span>
              </div>
              <div className={s.claimRight}>
                {yearRange && <span className={s.year}>{yearRange}</span>}
                {pp.derived_edge_ids.length > 0 && (
                  <span className={s.evCount} title={`${pp.derived_edge_ids.length} derivation chain(s)`}>
                    {pp.derived_edge_ids.length}drv
                  </span>
                )}
                <button type="button" className={s.expandBtn}
                  onClick={(e) => { e.stopPropagation(); setExpandedPlace(isOpen ? null : `${pp.place_id}-${pp.year_start}`); }}
                  title={isOpen ? "Hide derivation" : "Show derivation"}>
                  {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>
            </div>
            {isOpen && (
              <div className={s.claimEvidence}>
                {pp.derived_edge_ids.length > 0 ? (
                  pp.derived_edge_ids.map((edgeId) => (
                    <DerivationChain key={edgeId} edgeId={edgeId} onSelectEntity={onSelectEntity} />
                  ))
                ) : (
                  <div className={s.emptySub}>No derivation chain available.</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
