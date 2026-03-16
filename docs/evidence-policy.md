# Evidence Policy

Rules governing how claims are linked to passage evidence in `claim_evidence.tsv`.

## Columns

| Column | Required | Values |
|--------|----------|--------|
| `claim_id` | yes | FK → claims.tsv |
| `passage_id` | yes | FK → passages.tsv |
| `evidence_role` | yes | supports, opposes, contextualizes, mentions |
| `support_aspect` | when role=supports | whole_claim, subject, predicate, object, date, place, context, attribution |
| `assertion_mode` | when role=supports | explicit, strong_inference, weak_inference, background_only |
| `excerpt_override` | no | Override passage excerpt for this specific evidence link |
| `evidence_weight` | no | 0.0–1.0 |
| `notes` | no | Free text |

## Validator Rules

### P1 — Source Mismatch (WARNING)
For `work_*` claims, supports evidence should come from passages of the same work as `claim.subject_id`. Cross-work evidence triggers a warning.

### P3 — Quality Aspect (WARNING)
`certainty=attested` claims with populated `support_aspect` fields must have at least one supports row where `support_aspect` is in {whole_claim, predicate, object}.

### P4 — Supports + Background Only (ERROR)
`evidence_role=supports` combined with `assertion_mode=background_only` is invalid. Background passages should use `evidence_role=contextualizes`.

### P5 — Missing Excerpt (WARNING)
Supports evidence with no excerpt on the passage and no `excerpt_override` triggers a warning.

## Best Practices

1. Always set `support_aspect` and `assertion_mode` on new `supports` rows
2. Use `whole_claim` when the passage directly asserts the entire claim
3. Use `predicate` or `object` when the passage only demonstrates part of the claim
4. Use `explicit` when the passage states the fact directly; `strong_inference` when the fact is clearly implied
5. Reserve `contextualizes` for passages that provide background without directly supporting
