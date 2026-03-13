/**
 * Centralised registry for human-readable predicate labels.
 * In the new schema, claims use `predicate_id` from `predicate_types.tsv`.
 * The dataStore provides predicate metadata at runtime; this module
 * offers a convenient helper that falls back to slug humanisation.
 *
 * ── Usage ──
 *   import { getPredicateLabel } from "@/domain/relationLabels";
 *   const label = getPredicateLabel(claim.predicate_id, isOutgoing);
 */

import { dataStore } from "../data/dataStore";

/**
 * Returns a human-readable label for a predicate.
 * @param predicateId  The `predicate_id` from `claims.tsv`.
 * @param isOutgoing   `true` if the contextual entity is the *subject*.
 */
export function getPredicateLabel(predicateId: string, isOutgoing: boolean): string {
  const pt = dataStore.predicateTypes.getById(predicateId);
  if (pt) return isOutgoing ? pt.predicate_label : (pt.inverse_label || pt.predicate_label);
  return predicateId.replace(/_/g, " ");
}

export const getRelationLabel = getPredicateLabel;
