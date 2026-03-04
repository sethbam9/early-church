# Normalization Action Items (NO edits to `final.tsv`)

## Scope / invariants
- `final.tsv` remains **read-only**.
- All “fixes” happen via:
  - `data/mappings/*.tsv` (authoritative slug/token mapping)
  - `data/entities/*.tsv` (canonical entities)
  - `data/notes.tsv` + `data/note_entities.tsv` (sparse timeline + cross-links)
- After each mapping change, re-run:
  - `tsx scripts/build_normalized_from_final.ts`
  - Confirm `data/mappings/mapping_coverage_issues.tsv` is empty (header-only).

## Current generated artifacts (already created)
- `data/mappings/`
  - `city_keys.tsv`, `city_aliases.tsv`
  - `sect_tokens.tsv`
  - `modern_denom_tokens.tsv` (**supports multi-slug values** via `canonical_modern_slug` = `slug1;slug2;...`)
  - `person_tokens.tsv`
  - `polity_tokens.tsv`
  - `mapping_coverage_issues.tsv`
- `data/entities/`
  - `cities.tsv`, `sects.tsv`, `people.tsv`, `polities.tsv`, `modern_denoms.tsv`
- `data/notes.tsv` and `data/note_entities.tsv`

## A. Duplicate row keys → canonical resolution strategy
**Audit count:** 87 duplicates by `(year_bucket + city_ancient + country_modern)`.
Source: `docs/final-tsv-audit/duplicate_row_keys.tsv`.

### Policy
- Do **not** delete duplicates in `final.tsv`.
- In normalized form:
  - A city gets **one** `city_slug`.
  - If two duplicate rows represent two *different claims/evidence*, keep both as separate **evidence notes** for the same decade.
  - If they are truly identical, collapse naturally (notes are slugged by stable hash of normalized evidence text).

### Required review list (largest repeat blocks)
- Joppa (Israel): 0040–0130 have duplicates.
- Edessa (Türkiye): 0060–0350 have duplicates.
- Seleucia-Ctesiphon (Iraq): 0100–0350 have duplicates.
- Nisibis (Türkiye): 0150–0350 have duplicates.

### Action items
- For each duplicated key group above:
  - Compare the two `final.tsv` evidence texts.
  - Decide whether they are:
    - Separate evidence streams (keep as separate evidence notes), or
    - Pure redundancy (ensure evidence normalizes identically so note hash collapses).

## B. Enum violations (location precision)
**Audit count:** 32 violations.
Source: `docs/final-tsv-audit/location_precision_violations.tsv`.

### Observed pattern
- All violations are `Emmaus` with `location_precision=approx_region` (not in allowed enum).

### Action items
- Ensure canonical `cities.tsv.location_precision` is in:
  - `exact`, `approx_city`, `region_only`, `unknown`
- For Emmaus specifically:
  - Use `region_only` (or `unknown`) in canonical entity output.
  - Add an evidence/state note explaining “location disputed”.

## C. Chronology contradictions
**Audit count:** 48 contradictions where:
- `church_presence_status=attested`
- but `church_planted_year_scholarly > decade_end`
Source: `docs/final-tsv-audit/chronology_contradictions.tsv`.

### Normalization rule
In the new model:
- The *timeline state* comes from sparse notes.
- A city’s `christianity_start_year` should be derived from:
  - earliest plausible planted year, *or*
  - earliest attested decade,
  - with contested claims expressed as notes (not as silent contradictions).

### Action items
- For each contradiction row:
  - Decide which field is wrong in source semantics:
    - Is the decade too early for `attested`? Then make the decade state “probable/claimed_tradition” in notes.
    - Or is the scholarly planted year too late? Then revise the planted-year claim (in notes / mapping-driven cleaned state).
- Do not leave the normalized state machine in a self-contradictory state.

## D. `denomination_label_historic` misused as presence status
**Audit count:** 33.
Source: `docs/final-tsv-audit/denomination_misused_as_status.tsv`.

### Problem
Values like `claimed tradition` / `claimed_tradition` appear in `denomination_label_historic`, but they are **presence status**, not a sect.

### Action items
- In normalization:
  - Treat these tokens as **presence status only**.
  - Ensure `sects.tsv` does not treat them as real sects.
- In mappings:
  - Option A (preferred): map these denom tokens to a sentinel (and exclude from sect-state computation).
  - Option B: keep them as a `sect:` value but mark as invalid/metadata (less clean).

## E. Hybrid / compound city names
**Audit count:** 33 hybrid `city_ancient` values containing `/` or `;`.
Source: `docs/final-tsv-audit/hybrid_city_names.tsv`.

### Examples
- `Cyprus / Salamis` (repeats across many decades)
- `Byzantium / Constantinople` (at least at 0320)

### Action items
- Decide whether these represent:
  - A single canonical city with multiple names over time (prefer **one city slug** + aliases), or
  - A region + city (model as separate entities).
- Encode decision in:
  - `data/mappings/city_keys.tsv` (map hybrid raw key to canonical `city_slug`)
  - `data/mappings/city_aliases.tsv` (add aliases for each component)

## F. Same ancient city mapped to multiple modern countries
**Audit count:** 1.
Source: `docs/final-tsv-audit/city_ancient_multiple_countries.tsv`.

### Case
- `Samaria` appears with:
  - `Israel`
  - `Palestinian Territories`

### Action items
- Pick one of these canonicalization approaches:
  - **Approach 1 (single city slug):** map both raw keys to the same `city_slug` and treat `country_modern_primary` as display-only.
  - **Approach 2 (two city slugs):** split into two city entities with disambiguated slugs.
- Add a note explaining the geopolitical ambiguity.

## G. URL normalization and citation hygiene
Source: `docs/final-tsv-audit/url_inventory.tsv`.

### Observations
- Heavy reliance on `www.newadvent.org`.
- Many URLs appear repeatedly across decade rows.

### Action items
- Ensure citations in `data/notes.tsv.citation_urls` are:
  - deduped per note
  - stripped of trailing punctuation
- Prefer putting citations on the **canonical evidence note** once, then attach that note to all relevant entities via `note_entities.tsv`.

## H. Notes redundancy rules (make the dataset sparse)
### Action items
- Maintain these invariants:
  - **State notes only on change** (`note_kind=state`).
  - Evidence notes only when text changes (`note_kind=evidence`).
  - Use `note_entities.tsv` to attach one note to multiple entities.
- Adopt a canonical “anchor” convention:
  - Person-biography facts anchor on `person:*`.
  - Work facts anchor on `work:*`.
  - City timeline state anchors on `city:*`.

## I. Operational checks
### Action items
- After any mapping edit:
  - Run `tsx scripts/build_normalized_from_final.ts`.
  - Confirm:
    - `mapping_coverage_issues.tsv` is empty.
    - entity tables have unique slugs.
    - notes produce expected `[[type:slug]]` references.

