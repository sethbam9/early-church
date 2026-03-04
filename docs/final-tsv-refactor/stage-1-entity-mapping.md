# Stage 1 — Entity cleanup + slug mapping (NO changes to `final.tsv`)

## Goal
Create an authoritative *mapping layer* that converts every raw token in `final.tsv` into a canonical slug (cities, sects, people, works, polities, etc.). This is the prerequisite for splitting `final.tsv` into normalized files.

## Key principle
- **`final.tsv` stays read-only**.
- We create *new* mapping/alias tables that become the source of truth.
- We do not “fix data” by editing historical rows; we fix it by **mapping raw strings to canonical entities**.

## Inputs
- `final.tsv`
- `docs/final-tsv-audit/` inventories + issue reports

## Outputs (new files to create later)
Create a new folder like `data/mappings/` containing:

### 1) City key → city slug
`data/mappings/city_keys.tsv`
- `raw_city_ancient`
- `raw_country_modern`
- `raw_city_modern` (optional)
- `canonical_city_slug`
- `canonical_city_label`
- `notes` (optional)

**Rule:** the *raw* key is `(city_ancient + country_modern)` from `final.tsv`.

### 2) City aliases (variants → same slug)
`data/mappings/city_aliases.tsv`
- `alias`
- `canonical_city_slug`
- `alias_kind` (ancient_name | modern_name | transliteration | typo | other)

### 3) Historic sect token → sect slug
`data/mappings/sect_tokens.tsv`
- `raw_sect_token`
- `canonical_sect_slug`
- `canonical_sect_label`
- `notes`

### 4) Modern denom token → denom/sect slug
`data/mappings/modern_denom_tokens.tsv`
- `raw_modern_token`
- `canonical_modern_slug`
- `canonical_modern_label`

### 5) People token → person slug
`data/mappings/person_tokens.tsv`
- `raw_person_token`
- `canonical_person_slug`
- `canonical_person_label`
- `disambiguation_note` (e.g., “Ignatius of Antioch” vs others)

### 6) Polity token → polity slug
`data/mappings/polity_tokens.tsv`
- `raw_polity_token`
- `canonical_polity_slug`
- `canonical_polity_label`

## Slug rules (stable IDs)
- Slugs are **lowercase ASCII**, hyphen-separated.
- Use minimal disambiguators only when needed:
  - Cities: prefer `city-ancient-name` + (if needed) `-country`.
  - People: include “of-place” or other disambiguator.
  - Works: include author slug or short disambiguator if needed.
- Once a slug is published, it should be treated as **stable**.

## Coverage requirement (hard gate)
Before Stage 2 begins:
- Every `final.tsv` row must have:
  - `city_ancient/country_modern` covered by `city_keys.tsv`
  - all `denomination_label_historic` tokens covered by `sect_tokens.tsv`
  - all `modern_denom_mapping` tokens covered by `modern_denom_tokens.tsv`
  - all `key_figures` tokens covered by `person_tokens.tsv`
  - `ruling_empire_polity` covered by `polity_tokens.tsv`
- Unknown tokens are not allowed; add rows to mappings until coverage is 100%.

## Duplicate/contradiction handling (mapping-first)
- If there are duplicate `(decade + city + country)` rows, do **not** delete anything.
- Decide in mappings whether:
  - they represent the *same* entity (merge via same slug), or
  - they represent different entities requiring disambiguated slugs.

## Stage 1 exit criteria
- Mapping tables exist and provide **100% token coverage** for `final.tsv`.
- A single canonical slug exists for every real-world entity.
- Ambiguities are explicitly encoded in mappings/aliases (not hidden in prose).
