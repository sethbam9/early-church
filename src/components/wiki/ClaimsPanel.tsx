import s from "./Wiki.module.css";
import { dataStore } from "../../data/dataStore";
import { useClaimsData, EVIDENCE_ROLES } from "../../hooks/useClaimsData";
import { CERTAINTY_OPTIONS } from "../shared/entityConstants";
import { SearchInput } from "../shared/SearchInput";
import { DropdownSelect } from "../shared/Dropdown";
import { NoteCard } from "../shared/NoteCard";
import { ClaimRow } from "./ClaimRow";

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

  if (claims.length === 0 && editorNotes.length === 0) return <div className={s.emptyState}>No claims for this entity.</div>;

  return (
    <div className={s.claimsPanel}>
      {/* Filters */}
      <div className={s.evRoleFilter}>
        <DropdownSelect
          value={roleFilter ?? "all"}
          onChange={setRoleFilter}
          options={EVIDENCE_ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
        />
        <DropdownSelect
          value={certFilter}
          onChange={setCertFilter}
          options={CERTAINTY_OPTIONS}
        />
        <DropdownSelect
          value={reviewFilter}
          onChange={setReviewFilter}
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

      {/* Editor notes in-feed */}
      {editorNotes.length > 0 && (
        <div className={s.predGroup}>
          <div className={s.predGroupHeader}>
            <span className={s.predId}>editor notes</span>
            <span className={`${s.predCount} ${s.faint}`}>{editorNotes.length}</span>
          </div>
          {editorNotes.map((note) => (
            <NoteCard key={note.editor_note_id} note={note} onSelectEntity={onSelectEntity} yearLabel={note.note_kind} />
          ))}
        </div>
      )}

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
              <span className={s.predId}>{`(${predClaims.length}) ${predicateId.replace(/_/g, " ")}`}</span>
            </div>
            {predClaims.map((claim) => (
              <ClaimRow key={claim.claim_id} claim={claim} focusKind={kind} focusId={id}
                onSelectEntity={onSelectEntity} onSelectClaim={onSelectClaim}
                isSelected={claim.claim_id === selectedClaimId} roleFilter={roleFilter} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
