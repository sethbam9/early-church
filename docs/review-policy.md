# Review Policy

How claims are reviewed and tracked in `claim_reviews.tsv` and `claim_review_events.tsv`.

## Snapshot vs History

- `claim_reviews.tsv` — one row per claim, current review state (snapshot)
- `claim_review_events.tsv` — append-only history of all review actions

## Review Statuses

| Status | Meaning |
|--------|---------|
| `unreviewed` | No reviewer has examined this claim |
| `reviewed` | Examined but not formally approved |
| `approved` | Reviewer confirms the claim is well-evidenced |
| `disputed` | Reviewer disagrees with the claim or its evidence |
| `needs_revision` | Claim needs changes before approval |

## Review Event Types

| Event | When to use |
|-------|-------------|
| `created` | Claim first entered the dataset |
| `reviewed` | Reviewer examined the claim |
| `approved` | Reviewer formally approved |
| `disputed` | Reviewer raised an objection |
| `reopened` | Previously approved claim reopened for re-examination |
| `needs_revision` | Reviewer requests specific changes |

## Confidence Levels

| Level | Meaning |
|-------|---------|
| `low` | Reviewer is uncertain about their assessment |
| `medium` | Reviewer is moderately confident |
| `high` | Reviewer is very confident in their assessment |

## Workflow

1. New claims start as `unreviewed`
2. AI or human reviewer examines evidence and sets status
3. Each review action creates a `claim_review_events.tsv` row
4. The `claim_reviews.tsv` snapshot is updated to reflect current state
