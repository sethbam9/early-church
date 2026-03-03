# Early Christianity Atlas (AD 33–800)

Interactive decade-driven relational atlas of early Christianity. Every entity — city, person, event, work, doctrine, archaeological site — is anchored to decade buckets and interconnected through a typed edge graph. Selecting anything illuminates everything related across the entire map and all panels.

## Stack

- **Vite** — build tooling
- **React 18 + TypeScript** — UI framework
- **Leaflet** — map rendering
- **Zustand** — global state management
- **Domain-Driven Design** — repository pattern with data-source-independent domain layer

## Architecture

```
src/
├── domain/           # Entity interfaces & repository contracts
│   ├── types.ts      # All domain types (Person, Event, Work, Doctrine, Quote, Edge, etc.)
│   └── repositories.ts # IRepository interfaces (IPersonRepository, IEdgeRepository, etc.)
├── data/
│   ├── repositories/ # InMemory implementations of all repositories
│   ├── generated/    # Build output (git-ignored JSON files)
│   └── runtimeData.ts # Creates repository singletons from generated JSON
├── stores/
│   └── appStore.ts   # Zustand store — single source of truth for all UI state
├── services/
│   └── HighlightService.ts # Cross-entity highlight cascade
├── components/
│   ├── controls/     # TimelineControl, FilterPanel, SearchBar, MapToolbar
│   ├── panels/       # CityChronicle, EventTrack, DoctrineExplorer, CorrespondencePanel, ArchaeologyPanel, EssayPanel, DetailsPanel
│   └── shared/       # Badge, CitationList, PersonCard, QuoteCard, KeyboardShortcutHelp
├── App.tsx           # Thin orchestrator (~280 lines)
├── main.tsx          # React entry point
└── styles.css        # All styles
```

## Data Files

| File | Description | Status |
|---|---|---|
| `final.tsv` | City × Decade presence records (3835 rows) | Existing |
| `data/people.tsv` | Person entities (18 rows) | Template |
| `data/events.tsv` | Historical events (14 rows) | Template |
| `data/works.tsv` | Written works (14 rows) | Template |
| `data/doctrines.tsv` | Doctrine/topic entities (12 rows) | Template |
| `data/quotes.tsv` | Direct quotes & attributions (12 rows) | Template |
| `data/archaeology.tsv` | Physical sites (12 rows) | Template |
| `data/edges.tsv` | All relationships between entities (70 rows) | Template |
| `data/starred_pois.json` | Legacy starred POIs | Kept for backward compat |
| `essays/*.md` | Essay panel content | Existing |

## Features

### 1. Key Events Timeline
Browse councils, persecutions, martyrdoms, and political events chronologically. Filter by event type. Each event links to people, cities, and doctrines.

### 2. Correspondence Web (Prosopography)
Select any person to see their network: who discipled them, who they corresponded with, which cities they served, what works they authored. Relationships rendered as arcs on the map.

### 3. Doctrine Timeline
Choose a doctrine topic (e.g., Real Presence, Apostolic Succession, Trinity). See direct quotes and attributions ordered chronologically. Map highlights cities where the doctrine was discussed.

### 4. Location Chronicle
Click any city → see its full decade-by-decade timeline from founding to current decade. Each decade card shows presence status, key figures, denomination, evidence. Links to related events and people.

### 5. Archaeology Layer
Churches, catacombs, baptisteries, monasteries, and inscriptions displayed as star markers on the map. Click for detailed site information including discovery notes and significance.

### Cross-Entity Highlight Cascade
When you select anything (person, doctrine, event, city, work, archaeology site), the `HighlightService` computes which cities should be highlighted on the map and with what color/intensity. This is the "web" that makes everything interconnected.

## Run Locally

```bash
npm install
npm run build:data   # Parses all TSV files → generates JSON
npm run dev
```

Open: `http://localhost:5173`

## Build for Production

```bash
npm run build        # Runs build:data + tsc + vite build
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play/pause timeline |
| `← / →` | Previous/next decade |
| `/` | Focus search field |
| `L` | Toggle left panel |
| `D` | Toggle right panel |
| `Esc` | Clear current selection |
| `?` | Show/hide shortcut help |

## Future: Database Migration

The domain layer is fully independent of the data source. All UI code uses `IRepository<T>` interfaces. Swapping TSV/JSON for a database requires only new repository implementations in `src/data/repositories/` — zero UI changes.

```typescript
// Current (TSV → JSON → in-memory):
const personRepo = new InMemoryPersonRepository(generatedJson);

// Future (SQL/Supabase):
const personRepo = new SqlPersonRepository(dbClient);
```

For user-editable data, add CRUD methods to the repository interface and implement with your chosen backend.

## Documentation

- **[Data Architecture Plan](docs/data_architecture_plan.md)** — Full entity schemas, edge vocabulary, implementation roadmap
- **[Enhancements](docs/enhancements.md)** — UI/UX enhancements implemented
- **[Research Articles](docs/research_articles.md)** — Reference bibliography
