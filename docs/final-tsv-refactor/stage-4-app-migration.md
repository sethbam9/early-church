# Stage 4 — App + build migration, validation, then expansion

## Goal
Switch the app from `final.tsv`-style decade rows to the normalized entity + notes graph.

## Build/data pipeline (later implementation)
- Update/extend data build scripts to:
  - read `data/entities/*.tsv`, `data/notes.tsv`, edges
  - validate referential integrity (`type:slug` resolution)
  - emit runtime JSON for the app

## App model changes (later implementation)
- Introduce a universal reference type: `EntityRef = { type, slug }`.
- Update panels to:
  - render entity details from entity tables
  - render decade-aware timelines from sparse notes
  - parse `[[type:slug]]` in notes into clickable entity chips

## City timeline behavior (carry-forward)
- For the active decade:
  - show notes whose `year_bucket == decade`
  - show the latest prior state notes as “still active (from YEAR)”

## Validation (hard gates)
- No broken slugs in:
  - edges
  - `[[type:slug]]` note references
- No unknown mapping tokens (Stage 1 coverage stays at 100%).

## Stage 4 exit criteria
- App builds and runs entirely on the new normalized tables.
- Users can navigate the historical web by clicking slug-linked references.
- The dataset is sparse (notes only on change) while still reconstructing full timelines.
