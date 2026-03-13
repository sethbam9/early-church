import s from "./Wiki.module.css";
import { useAuditData, AUDIT_EVIDENCE_ROLES } from "../../hooks/useAuditData";
import type { AuditSortCol, AuditFilter } from "../../hooks/useAuditData";
import { ENTITY_TABS, CERTAINTY_OPTIONS } from "../shared/entityConstants";
import { Chip } from "../shared/Chip";
import { SearchInput } from "../shared/SearchInput";
import { DropdownSelect } from "../shared/Dropdown";
import { EntityLink } from "../shared/EntityLink";
import { Pagination } from "../shared/Pagination";
import { getClaimBorderClass } from "../../utils/claimAudit";

const COL_CLS: Record<string, string> = {
  subject: s.auditColSubject, predicate: s.auditColPred, object: s.auditColObject,
  year: s.auditColYear, certainty: s.auditColCert, ev: s.auditColEv, rev: s.auditColRev, status: s.auditColStatus,
};

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "default", label: "Default order" },
  { value: "updated-asc", label: "Claim updated ↑" },
  { value: "updated-desc", label: "Claim updated ↓" },
  { value: "reviewed-asc", label: "Sign-off date ↑" },
  { value: "reviewed-desc", label: "Sign-off date ↓" },
  { value: "year-asc", label: "Year ↑" },
  { value: "year-desc", label: "Year ↓" },
];
const STATUS_CLS: Record<string, string> = {
  "no-evidence": s.statusNoEvidence, unreviewed: s.statusUnreviewed,
  disputed: s.statusDisputed, "needs-revision": s.statusNeedsRevision,
  approved: s.statusApproved, ok: s.statusOk,
};
const CERT_CLS: Record<string, string> = {
  probable: s.certaintyProbable, possible: s.certaintyPossible,
  claimed_tradition: s.certaintyClaimedTradition, legendary: s.certaintyLegendary, unknown: s.certaintyUnknown,
};

interface AuditViewProps {
  onSelectEntity: (kind: string, id: string) => void;
  onSelectClaim: (id: string) => void;
  selectedClaimId: string | null;
}

export function AuditView({ onSelectEntity, onSelectClaim, selectedClaimId }: AuditViewProps) {
  const {
    filters, setFilters, sortCol, sortDir, toggleSort, setSortColDir,
    stats, statusChips, pagination,
  } = useAuditData();
  const { page, setPage, pageItems, total, pageSize } = pagination;

  const sortDropdownValue = sortCol && sortDir !== "default" ? `${sortCol}-${sortDir}` : "default";

  return (
    <div className={s.auditView}>
      {/* Stats bar */}
      <div className={s.auditStats}>
        <span className={s.auditStat}>{stats.total} total</span>
        <span className={`${s.auditStat} ${s.statRed}`}>{stats.noEv} no evidence</span>
        <span className={`${s.auditStat} ${s.statOrange}`}>{stats.unrev} unreviewed</span>
        <span className={`${s.auditStat} ${s.statRed}`}>{stats.disp} disputed</span>
        <span className={`${s.auditStat} ${s.statGreen}`}>{stats.appr} approved</span>
        <span className={`${s.auditStat} ${s.statOrange}`}>{stats.dupes} duplicates</span>
      </div>

      {/* Filter bar */}
      <div className={s.auditFilters}>
        <div className={s.auditFilterRow}>
          {statusChips.map((c) => (
            <Chip key={c.key} active={filters.statusFilter === c.key}
              onClick={() => setFilters((f) => ({ ...f, statusFilter: c.key }))}>
              {c.label} ({c.count})
            </Chip>
          ))}
        </div>
        <div className={s.auditFilterRow}>
          <DropdownSelect
            value={filters.entityTypeFilter}
            onChange={(v) => setFilters((f) => ({ ...f, entityTypeFilter: v }))}
            options={[
              { value: "all", label: "All entity types" },
              ...ENTITY_TABS.map((t) => ({ value: t.kind, label: t.label })),
            ]}
          />
          <DropdownSelect
            value={filters.certaintyFilter}
            onChange={(v) => setFilters((f) => ({ ...f, certaintyFilter: v }))}
            options={CERTAINTY_OPTIONS}
          />
          <DropdownSelect
            value={filters.roleFilter}
            onChange={(v) => setFilters((f) => ({ ...f, roleFilter: v as AuditFilter["roleFilter"] }))}
            options={AUDIT_EVIDENCE_ROLES.map((r) => ({ value: r.key, label: r.label }))}
          />
          <SearchInput value={filters.predicateFilter} onChange={(v) => setFilters((f) => ({ ...f, predicateFilter: v }))} placeholder="Filter predicate…" />
          <SearchInput value={filters.searchFilter} onChange={(v) => setFilters((f) => ({ ...f, searchFilter: v }))} placeholder="Search entities…" />
          <DropdownSelect
            value={sortDropdownValue}
            onChange={(v) => {
              if (v === "default") { setSortColDir(null, "default"); }
              else {
                const [col, dir] = v.split("-") as [AuditSortCol, "asc" | "desc"];
                setSortColDir(col, dir);
              }
            }}
            options={SORT_OPTIONS}
          />
        </div>
      </div>

      {/* Results */}
      <div className={s.auditResults}>
        <div className={s.auditTableHeader}>
          {([["subject","Subject"],["predicate","Predicate"],["object","Object"],["year","Year"],["certainty","Cert"],["ev","Ev"],["rev","Rev"],["status","Status"]] as [AuditSortCol,string][]).map(([col, label]) => {
            const arrow = sortCol === col ? (sortDir === "asc" ? " ▲" : sortDir === "desc" ? " ▼" : "") : "";
            const colCls = COL_CLS[col] ?? "";
            const cls = `${s.auditCol} ${colCls} ${s.auditSortHdr}${sortCol === col ? ` ${s.auditSortHdrActive}` : ""}`;
            return <button key={col} type="button" className={cls} onClick={() => toggleSort(col)}>{label}{arrow}</button>;
          })}
        </div>
        {pageItems.map((row) => {
          const borderCls = getClaimBorderClass(row.status);
          const isSelected = row.claim.claim_id === selectedClaimId;
          return (
            <div key={row.claim.claim_id}
              className={`${s.auditRow} ${s[borderCls] ?? ""}${isSelected ? ` ${s.auditRowSelected}` : ""}${row.isDuplicate ? ` ${s.auditRowDupe}` : ""}`}
              onClick={() => onSelectClaim(row.claim.claim_id)}>
              <span className={`${s.auditCol} ${s.auditColSubject}`} onClick={(e) => e.stopPropagation()}>
                <EntityLink kind={row.claim.subject_type} id={row.claim.subject_id} onClick={() => onSelectEntity(row.claim.subject_type, row.claim.subject_id)} />
              </span>
              <span className={`${s.auditCol} ${s.auditColPred}`}>{row.claim.predicate_id.replace(/_/g, " ")}</span>
              <span className={`${s.auditCol} ${s.auditColObject}`} onClick={(e) => e.stopPropagation()}>
                {row.claim.object_mode === "entity" && row.claim.object_id ? (
                  <EntityLink kind={row.claim.object_type} id={row.claim.object_id} onClick={() => onSelectEntity(row.claim.object_type, row.claim.object_id)} />
                ) : <span className={s.faint}>{row.objectLabel}</span>}
              </span>
              <span className={`${s.auditCol} ${s.auditColYear}`}>{row.yearLabel}</span>
              <span className={`${s.auditCol} ${s.auditColCert} ${CERT_CLS[row.claim.certainty] ?? ""}`}>{row.claim.certainty}</span>
              <span className={`${s.auditCol} ${s.auditColEv}`}>{row.evidenceCount}</span>
              <span className={`${s.auditCol} ${s.auditColRev}`}>{row.reviewCount}</span>
              <span className={`${s.auditCol} ${s.auditColStatus} ${STATUS_CLS[row.status] ?? ""}`}>
                {row.status.replace("-", " ")}{row.isDuplicate ? " ⚑" : ""}
              </span>
            </div>
          );
        })}
        {pageItems.length === 0 && <div className={s.emptyState}>No claims match these filters.</div>}
      </div>
      <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}
