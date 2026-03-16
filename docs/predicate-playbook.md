# Predicate Playbook

Quick-reference for choosing the right predicate when creating claims.

## Person → Place

| Predicate | Use when | Derivation |
|-----------|----------|------------|
| `bishop_of` | Person holds episcopal office at place | Direct edge; implies `active_in` (R7) |
| `active_in` | Person is active at place (non-bishop) | Direct edge; check R7/R8 first |
| `originated_in` | Person originates from place | Direct edge |

**Avoid**: `active_in` when `bishop_of` covers same person/place (R7). Prefer letting `authored_by+written_at` or `participant_in+event_occurs_at` derive presence (R8, rule 10).

## Work → Place

| Predicate | Use when |
|-----------|----------|
| `written_at` | Work was composed at place |
| `addressed_to_place` | Work is addressed to recipients at place |

## Work/Person → Proposition

| Predicate | Use when |
|-----------|----------|
| `work_affirms_proposition` | Work explicitly teaches the proposition |
| `work_opposes_proposition` | Work explicitly argues against the proposition |
| `work_develops_proposition` | Work develops or elaborates the proposition |
| `work_mentions_proposition` | Work references the proposition without taking a clear stance |
| `person_affirms_proposition` | Third-party source reports person's belief (NOT from their own works) |
| `person_opposes_proposition` | Third-party source reports person's opposition |

**Avoid**: `person_affirms_proposition` when the person's own authored works carry `work_affirms_proposition` (rule 8, P2).

## Group → Place

| Predicate | Use when |
|-----------|----------|
| `controls_place` | Group (polity) controls the place | Implies `group_present_at` (R5) |
| `group_present_at` | Group is present at place without political control |

**Avoid**: `group_present_at` when `controls_place` covers same group/place with overlapping dates (R5).

## Event

| Predicate | Use when |
|-----------|----------|
| `event_occurs_at` | Event takes place at a specific location |
| `participant_in` | Person participates in an event |
| `event_has_year` | Event has a specific year (infrastructure predicate) |

## Certainty Guide

| Level | When to use |
|-------|-------------|
| `attested` | Direct statement in a primary source with explicit evidence |
| `probable` | Strong inference from primary sources |
| `possible` | Reasonable inference, but evidence is indirect |
| `claimed_tradition` | Later tradition attributes this, but no contemporary evidence |
| `legendary` | Legendary or hagiographic account |
| `unknown` | Cannot assess certainty |
