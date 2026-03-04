# Stage 3 — Notes system (sparse timeline) + anti-redundancy rules

## Goal
Replace the redundant “every decade has a row” pattern with a **sparse notes timeline**.

A note is only created when something *changes* or when there is a *new* significant claim/evidence.

## Core design
### Notes table
`data/notes.tsv`
- `note_slug` (unique, stable)
- `year_bucket` (decade bucket, e.g. 150)
- `year_exact` (optional)
- `primary_entity_type` (city | sect | person | work | polity | doctrine | event | council | other)
- `primary_entity_slug`
- `note_kind` (state | event | bio | quote | evidence | correction | other)
- `state_key` (optional; machine-parseable, e.g. `presence_status`, `dominant_sect`)
- `state_value` (optional; e.g. `attested`, or `sect:proto-orthodox`)
- `body_md` (markdown text)
- `citation_urls` (semicolon-separated URLs)

### Entity references inside notes (hyperlinks)
To create a *clickable web*, embed explicit references in `body_md`:
- `[[city:rome]]`
- `[[person:paul-the-apostle]]`
- `[[work:against-heresies]]`

(Alternative: store a `mentions` column, but the `[[type:slug]]` syntax is easiest to parse deterministically.)

## Anti-redundancy rules (critical)
### 1) Sparse “state notes” + carry-forward
- For each entity and each `state_key` (e.g., city presence status, dominant sect), **only write a new note when the value changes**.
- UI rule: for any decade, compute the active value as:
  - “latest note at or before the decade”
  - display as “carried forward from YEAR” when it’s old

This eliminates the 300-year repeated rows problem.

### 2) Avoid duplicate facts across entities
- Each historical fact should have **one canonical anchor note**.
- Other entities should reference it via `[[type:slug]]` mentions rather than copying the note.

**Example:** “Paul planted the church in Corinth”
- Canonical note lives on `person:paul-the-apostle` (or an `event` entity)
- It *mentions* `[[city:corinth]]`
- Corinth does not need the same note duplicated.

### 3) Optional: attach one note to multiple entities (without duplication)
If you truly want a note to appear in multiple entity timelines while storing it once:
`data/note_entities.tsv`
- `note_slug`
- `entity_type`
- `entity_slug`

This is a pure join table; the note text remains single-sourced.

## How `final.tsv` migrates conceptually (later)
- `city` rows become one `cities.tsv` entity row + sparse notes.
- `denomination_label_historic` per decade becomes **state notes** (only on changes).
- Duplicate decade rows become multiple notes at the same decade (different `note_kind` / `state_key`), not multiple city entities.

## Stage 3 exit criteria
- `notes.tsv` supports:
  - decade-aware city chronicle
  - deterministic hyperlinking via `[[type:slug]]`
  - carry-forward without creating redundant rows
- No duplicated note text is required to preserve navigability.
