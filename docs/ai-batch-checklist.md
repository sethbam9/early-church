# AI Batch Checklist

6-stage pipeline for AI-assisted data curation batches.

## Stage 1 — Scope

- [ ] Define the batch scope (e.g., "add Cyprian's letters evidence")
- [ ] Estimate row counts: sources, passages, claims, evidence
- [ ] Check for existing coverage — search before creating

## Stage 2 — Harvest

- [ ] Follow `/patristic-data-harvest-workflow` for retrieval
- [ ] Capture source metadata, passages with excerpts, and claim packets
- [ ] Use the source tier ladder (Tier 1 first)

## Stage 3 — Draft

- [ ] Create source/passage/claim/evidence rows following `/data-edit` rules
- [ ] Set `support_aspect` and `assertion_mode` on all new `supports` evidence
- [ ] Use correct `certainty` levels — do not default to `attested` without strong evidence
- [ ] Check for redundancy rules (R5-R8) before adding claims

## Stage 4 — Validate

- [ ] Run: `python3 scripts/validate_canonical_data.py --data-dir data --scan-root data/sheets`
- [ ] Fix all errors (exit code must be 0)
- [ ] Review warnings — address P1 source mismatches and P5 missing excerpts

## Stage 5 — Evidence Quality Check

- [ ] Run: `python3 scripts/validate_canonical_data.py --data-dir data --check-evidence`
- [ ] Review flagged claims: no_evidence, no_supports, missing_excerpt, source_mismatch, weak_aspect
- [ ] For `certainty=attested` claims, ensure quality `support_aspect` coverage

## Stage 6 — Review & Commit

- [ ] Run: `python3 scripts/validate_canonical_data.py --data-dir data --json` for machine-readable summary
- [ ] Verify derived tables regenerated correctly
- [ ] Build passes: `npx vite build`
- [ ] Commit with descriptive message
