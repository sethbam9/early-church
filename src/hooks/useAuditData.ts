import { useState, useMemo, useCallback } from "react";
import { dataStore } from "../data/dataStore";
import { getAuditRows } from "../utils/claimAudit";
import type { ClaimAuditStatus } from "../utils/claimAudit";
import { usePaginatedList } from "./usePaginatedList";

export type AuditFilter = {
  statusFilter: ClaimAuditStatus | "all" | "flagged" | "duplicates";
  entityTypeFilter: string;
  predicateFilter: string;
  certaintyFilter: string;
  searchFilter: string;
  roleFilter: "all" | "supports" | "opposes" | "contextualizes" | "mentions";
  assertionModeFilter: "all" | "explicit" | "strong_inference" | "weak_inference" | "background_only";
  weightFilter: "all" | "high" | "medium" | "low" | "unscored";
  flagFilter: "all" | "PARAPHRASE_RISK" | "UNSCORED_WEIGHT" | "TERTIARY_ONLY" | "WEIGHT_TENSION";
};

export type AuditSortCol = "subject" | "predicate" | "object" | "certainty" | "ev" | "rev" | "status" | "year" | "updated" | "reviewed" | "weight";
export type AuditSortDir = "asc" | "desc" | "default";

export const AUDIT_EVIDENCE_ROLES: Array<{ key: AuditFilter["roleFilter"]; label: string }> = [
  { key: "all", label: "All roles" },
  { key: "supports", label: "Supports" },
  { key: "opposes", label: "Opposes" },
  { key: "contextualizes", label: "Contextualizes" },
  { key: "mentions", label: "Mentions" },
];

export const ASSERTION_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All modes" },
  { value: "explicit", label: "Explicit" },
  { value: "strong_inference", label: "Strong inference" },
  { value: "weak_inference", label: "Weak inference" },
  { value: "background_only", label: "Background only" },
];

export const WEIGHT_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All weights" },
  { value: "high", label: "High (≥0.7)" },
  { value: "medium", label: "Medium (0.4–0.7)" },
  { value: "low", label: "Low (<0.4)" },
  { value: "unscored", label: "Unscored" },
];

export const FLAG_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All flags" },
  { value: "PARAPHRASE_RISK", label: "Paraphrase risk" },
  { value: "UNSCORED_WEIGHT", label: "Unscored weight" },
  { value: "TERTIARY_ONLY", label: "Tertiary sources only" },
  { value: "WEIGHT_TENSION", label: "Weight tension" },
];

export function useAuditData() {
  const [filters, setFilters] = useState<AuditFilter>({
    statusFilter: "all", entityTypeFilter: "all", predicateFilter: "", certaintyFilter: "all",
    searchFilter: "", roleFilter: "all", assertionModeFilter: "all", weightFilter: "all", flagFilter: "all",
  });
  const [sortCol, setSortCol] = useState<AuditSortCol | null>(null);
  const [sortDir, setSortDir] = useState<AuditSortDir>("default");

  const toggleSort = useCallback((col: AuditSortCol) => {
    if (sortCol !== col) { setSortCol(col); setSortDir("desc"); }
    else if (sortDir === "desc") setSortDir("asc");
    else if (sortDir === "asc") { setSortCol(null); setSortDir("default"); }
    else { setSortDir("desc"); }
  }, [sortCol, sortDir]);

  const setSortColDir = useCallback((col: AuditSortCol | null, dir: AuditSortDir) => {
    setSortCol(col); setSortDir(dir);
  }, []);

  const allRows = useMemo(() => getAuditRows(), []);

  const stats = useMemo(() => {
    let noEv = 0, unrev = 0, disp = 0, appr = 0, dupes = 0, needsRev = 0;
    for (const r of allRows) {
      if (r.status === "no-evidence") noEv++;
      if (r.status === "unreviewed") unrev++;
      if (r.status === "disputed") disp++;
      if (r.status === "approved") appr++;
      if (r.status === "needs-revision") needsRev++;
      if (r.isDuplicate) dupes++;
    }
    return { total: allRows.length, noEv, unrev, disp, appr, needsRev, dupes };
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
    if (filters.roleFilter !== "all") {
      rows = rows.filter((r) => {
        const ev = dataStore.claimEvidence.getForClaim(r.claim.claim_id);
        return ev.some((e) => e.evidence_role === filters.roleFilter);
      });
    }
    if (filters.assertionModeFilter !== "all") {
      rows = rows.filter((r) => {
        const ev = dataStore.claimEvidence.getForClaim(r.claim.claim_id);
        return ev.some((e) => e.assertion_mode === filters.assertionModeFilter);
      });
    }
    if (filters.weightFilter !== "all") {
      if (filters.weightFilter === "unscored") {
        rows = rows.filter((r) => r.hasUnscoredSupports);
      } else {
        rows = rows.filter((r) => {
          const w = r.avgWeight;
          if (w === null) return false;
          if (filters.weightFilter === "high") return w >= 0.7;
          if (filters.weightFilter === "medium") return w >= 0.4 && w < 0.7;
          if (filters.weightFilter === "low") return w < 0.4;
          return true;
        });
      }
    }
    if (filters.flagFilter !== "all") {
      rows = rows.filter((r) => r.computedFlags.includes(filters.flagFilter));
    }
    return rows;
  }, [allRows, filters]);

  const sorted = useMemo(() => {
    if (!sortCol || sortDir === "default") return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "subject":   cmp = a.subjectLabel.localeCompare(b.subjectLabel); break;
        case "predicate": cmp = a.claim.predicate_id.localeCompare(b.claim.predicate_id); break;
        case "object":    cmp = a.objectLabel.localeCompare(b.objectLabel); break;
        case "certainty": cmp = a.claim.certainty.localeCompare(b.claim.certainty); break;
        case "ev":        cmp = a.evidenceCount - b.evidenceCount; break;
        case "rev":       cmp = a.reviewCount - b.reviewCount; break;
        case "status":    cmp = a.status.localeCompare(b.status); break;
        case "year": {
          const ay = a.yearSort, by = b.yearSort;
          if (ay == null && by == null) cmp = 0;
          else if (ay == null) cmp = 1;
          else if (by == null) cmp = -1;
          else cmp = ay - by;
          break;
        }
        case "updated":   cmp = a.claim.updated_at.localeCompare(b.claim.updated_at); break;
        case "reviewed":  cmp = a.latestReviewAt.localeCompare(b.latestReviewAt); break;
        case "weight": {
          const aw = a.avgWeight, bw = b.avgWeight;
          if (aw == null && bw == null) cmp = 0;
          else if (aw == null) cmp = 1;
          else if (bw == null) cmp = -1;
          else cmp = aw - bw;
          break;
        }
      }
      return cmp * dir;
    });
  }, [filtered, sortCol, sortDir]);

  const pagination = usePaginatedList(sorted, 50);

  const statusChips: { key: AuditFilter["statusFilter"]; label: string; count: number; cls: string }[] = [
    { key: "all", label: "All", count: stats.total, cls: "" },
    { key: "flagged", label: "Flagged", count: stats.noEv + stats.unrev + stats.disp + stats.needsRev, cls: "auditChipRed" },
    { key: "no-evidence", label: "No evidence", count: stats.noEv, cls: "auditChipRed" },
    { key: "unreviewed", label: "Unreviewed", count: stats.unrev, cls: "auditChipOrange" },
    { key: "needs-revision", label: "Needs revision", count: stats.needsRev, cls: "auditChipOrange" },
    { key: "disputed", label: "Disputed", count: stats.disp, cls: "auditChipRed" },
    { key: "approved", label: "Approved", count: stats.appr, cls: "auditChipGreen" },
    { key: "duplicates", label: "Duplicates", count: stats.dupes, cls: "auditChipOrange" },
  ];

  return {
    filters, setFilters,
    sortCol, sortDir, toggleSort, setSortColDir,
    stats, statusChips, pagination,
  };
}

