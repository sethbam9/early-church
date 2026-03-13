import { dataStore } from "../data/dataStore";
import type { Claim } from "../data/types";

/** Get all non-infrastructure claims for an entity. */
export function getEntityAllClaims(kind: string, id: string): Claim[] {
  return dataStore.claims.getForEntity(kind, id)
    .filter((c) => !dataStore.claims.isInfraPredicate(c.predicate_id));
}

export const EVIDENCE_ROLES = ["all", "supports", "opposes", "contextualizes", "mentions"] as const;
export type EvidenceRoleFilter = typeof EVIDENCE_ROLES[number];
