# Early Christianity Atlas

An interactive research tool for exploring the geographic spread, relationships, and doctrinal history of early Christianity from AD 33 to AD 800. Built around a structured, evidence-backed dataset of people, places, works, events, groups, and doctrinal propositions, all linked by sourced claims.

---

## Features at a Glance

- **🗺 Map** — decade-by-decade playback of Christian presence across the ancient world, with filters for presence quality, place kind, groups, and doctrinal stances.
- **🕸️ Graph** — force-directed relationship graph with path finding, degrees-of-separation analysis, and predicate-level edge coloring.
- **📖 Wiki** — entity browser with full claim/evidence audit, relation tabs, timelines, and five long-form editorial essays.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [React 18](https://react.dev/) + [TypeScript 5](https://www.typescriptlang.org/) |
| Build tool | [Vite 5](https://vitejs.dev/) |
| Routing | [React Router v7](https://reactrouter.com/) |
| State management | [Zustand 5](https://zustand-demo.pmnd.rs/) |
| Map rendering | [Leaflet 1.9](https://leafletjs.dev/) (CARTO Voyager tiles) |
| Styling | CSS Modules + CSS custom-property design tokens |
| Markdown | [react-markdown](https://github.com/remarkjs/react-markdown) |
| Data format | TSV (tab-separated values), parsed at build time via Vite static imports |
| Data validation | Python 3 (`scripts/validate_canonical_data.py`) |
| Git hooks | [Husky](https://typicode.github.io/husky/) |

---

## Prerequisites

- **Node.js** ≥ 18 (LTS recommended)
- **npm** ≥ 9
- **Python 3.9+** (for data validation and derivation)

---

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd apostolic_church
```

### 2. Install dependencies

```bash
npm install
```

### 3. Validate and derive data

The app reads from TSV source tables in `data/sheets/`. Before starting the dev server, validate the data and regenerate derived tables:

```bash
npm run data:validate
```

This runs `scripts/validate_canonical_data.py` which:
- Checks all TSV tables for referential integrity, enum validity, and redundancy rules.
- Regenerates the derived tables in `data/derived/` (footprints, place states, proposition presence, first attestations, note mentions).

### 4. Start the development server

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or the next available port).

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Validate data, then start the Vite dev server |
| `npm run build` | Type-check + production build (output to `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run data:validate` | Validate all TSV tables and regenerate derived files |
| `npm run data:validate-full` | Full validation including Markdown essay content |
| `npm run data:validate-sparse` | Validate with sparse-row checks enabled |
| `npm run data:derive` | Alias for `data:validate` — re-runs derivation pipeline |

---

## Project Structure

```
apostolic_church/
├── data/
│   ├── sheets/          # Canonical TSV source tables (edit these)
│   │   ├── claims.tsv
│   │   ├── claim_evidence.tsv
│   │   ├── claim_reviews.tsv
│   │   ├── people.tsv
│   │   ├── places.tsv
│   │   ├── works.tsv
│   │   ├── events.tsv
│   │   ├── groups.tsv
│   │   ├── propositions.tsv
│   │   ├── topics.tsv
│   │   ├── dimensions.tsv
│   │   ├── sources.tsv
│   │   ├── passages.tsv
│   │   ├── editor_notes.tsv
│   │   └── predicate_types.tsv
│   ├── derived/         # Auto-generated — do not edit manually
│   │   ├── entity_place_footprints.tsv
│   │   ├── place_state_by_decade.tsv
│   │   ├── proposition_place_presence.tsv
│   │   ├── first_attestations.tsv
│   │   └── note_mentions.tsv
│   └── essays/          # Markdown essay bodies
│       ├── infant-baptism.md
│       ├── church-went-astray.md
│       ├── religion-of-the-apostles.md
│       ├── eucharist-center.md
│       └── apostolic-succession.md
│
├── src/
│   ├── styles/          # Global CSS (tokens, reset, Leaflet overrides)
│   ├── components/
│   │   ├── shared/      # Reusable UI primitives
│   │   ├── panel/       # EntityDetail, PanelShell, PanelLists
│   │   ├── map/         # LeftPanel, RightPanel
│   │   ├── wiki/        # AuditView, ClaimsPanel, ClaimRow, ClaimDetailPanel
│   │   └── layout/      # NavBar
│   ├── pages/           # MapPage, GraphPage, WikiPage
│   ├── hooks/           # Business logic hooks
│   ├── data/            # dataStore.ts, types.ts, essays.ts, parseTsv.ts
│   ├── stores/          # Zustand app store
│   ├── domain/          # Relation label helpers
│   └── utils/           # Formatting, claim audit, entity helpers
│
├── scripts/
│   └── validate_canonical_data.py   # Validation + derivation pipeline
│
├── docs/
│   ├── features.md      # Comprehensive feature reference
│   ├── user-guide.md    # Research workflows and use cases
│   ├── ui_rules.md      # Architecture rules for contributors
│   ├── app-data.md      # Application data model documentation
│   └── domain-models.md # TypeScript domain model reference
│
├── public/              # Static assets served at root
│   ├── favicon.ico
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── android-chrome-192x192.png
│   ├── android-chrome-512x512.png
│   └── site.webmanifest
│
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig.json
└── .windsurf/workflows/ # AI-assisted editing workflows
```

---

## Data Model

The dataset is organized around **claims** — structured assertions that link entities to each other or to scalar values via typed predicates, each backed by passages from primary sources.

### Core Entities

| Entity | File | Description |
|--------|------|-------------|
| `Place` | `places.tsv` | Geographic location with lat/lon, modern name, country, and kind (city/region/site/province/monastery/route) |
| `Person` | `people.tsv` | Historical individual with kind (apostle, bishop, theologian, emperor, etc.) and alternate names |
| `Work` | `works.tsv` | Canonical literary identity (e.g., *Letter to the Romans*) — distinct from its editions/translations |
| `HistoricalEvent` | `events.tsv` | Named event (martyrdom, council, baptism, journey) with type and date range |
| `Group` | `groups.tsv` | Sect, polity, or church community. `is_christian` flag governs map filtering |
| `Topic` | `topics.tsv` | Doctrinal or thematic category (e.g., Sacraments, Christology) |
| `Dimension` | `dimensions.tsv` | Sub-category within a topic |
| `Proposition` | `propositions.tsv` | A specific doctrinal claim (e.g., "Baptism regenerates") under a topic/dimension |
| `Source` | `sources.tsv` | Citable edition, manuscript, or web resource. Optionally linked to a canonical `Work` via `work_id` |
| `Passage` | `passages.tsv` | A specific locus within a source (chapter:verse, page, section) with an optional excerpt |
| `Claim` | `claims.tsv` | Subject → predicate → object assertion with certainty, date range, and status |
| `ClaimEvidence` | `claim_evidence.tsv` | Links a claim to a passage with a role (supports/opposes/contextualizes/mentions) and weight |
| `ClaimReview` | `claim_reviews.tsv` | One review record per claim — status (approved/pending/disputed), confidence, and reviewer notes |
| `EditorNote` | `editor_notes.tsv` | Free-form Markdown note attached to an entity or claim |

### Derived Tables

Generated automatically by the validation script — **never edit these directly**:

| Table | File | Description |
|-------|------|-------------|
| `EntityPlaceFootprint` | `entity_place_footprints.tsv` | Where each entity was active, inferred from claim chains |
| `PlaceStateByDecade` | `place_state_by_decade.tsv` | Presence status and dominant polity per place per decade |
| `PropositionPlacePresence` | `proposition_place_presence.tsv` | Doctrinal stance (affirms/opposes/mixed) per place per proposition |
| `FirstAttestation` | `first_attestations.tsv` | Earliest dated claim for each subject/predicate pair |
| `NoteMention` | `note_mentions.tsv` | Cross-reference index of `[[entity]]` links in editor notes |

### Key Predicates

Doctrinal direction is carried by the **predicate name** — there is no separate polarity column:

- `work_affirms_proposition` / `work_opposes_proposition`
- `person_affirms_proposition` / `person_opposes_proposition`
- `authored_by`, `written_at`, `addressed_to_place`
- `bishop_of`, `active_in`, `participant_in`
- `teacher_of`, `coworker_of`
- `event_occurs_at`, `event_has_year`

### Certainty Levels

`attested` → `probable` → `possible` → `uncertain`

---

## Editing Data

All source data lives in `data/sheets/*.tsv`. The recommended editing workflow is documented in `.windsurf/workflows/data-edit.md`.

**Key rules:**
- Edit **only** files in `data/sheets/` — never edit `data/derived/`.
- Bible references must use OSIS format (e.g., `Rom.1.1`, `Matt.28.19`).
- Run `npm run data:validate` after every edit batch to check integrity and regenerate derived files.
- Claim review rows are unique per `claim_id` — update existing rows, never insert duplicates.
- `bishop_of` implies `active_in` — do not store both.

---

## Deployment

The app is a pure static site. Build with:

```bash
npm run build
```

The `dist/` directory can be served from any static host (Netlify, GitHub Pages, Vercel, etc.).

For **GitHub Pages**, the `vite.config.ts` automatically sets `base` to `/<repo-name>/` when the `GITHUB_REPOSITORY` environment variable is present (set automatically by GitHub Actions).

---

## Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| Feature Reference | `docs/features.md` | Complete listing of every feature and expected behavior |
| User Guide | `docs/user-guide.md` | Research workflows and step-by-step use cases |
| UI Rules | `docs/ui_rules.md` | Architecture rules, component catalog, and contributor checklist |
| Data Model | `docs/app-data.md` | Application-level data model and store documentation |
| Domain Models | `docs/domain-models.md` | TypeScript type definitions and domain logic reference |
