---
description: Workflow for making UI edits — styling, layout, component changes, and CSS modifications
---

# UI Edit Workflow

Follow these steps when making any UI changes (CSS, layout, component styling, new components).

## Pre-flight

1. Read `docs/ui_rules.md` — single source of truth for architecture, component catalog, forbidden patterns, and feature log.
2. Check if a **shared component** already exists for what you need:
   - `src/components/shared/` — Chip, Tabs, ToggleGroup, SearchInput, DropdownSelect, Slider, Pagination, EntityLink, EntityHoverCard, EvidenceCard, ExternalLink, NoteCard, CrossPageNav, PathPickerInput, PanelShell, Timeline, Hl, Badge, MarkdownRenderer, CertaintyBadge, FilterChips, Switch, DerivationChain, PassageReference, EntityHeader, FootprintCard, MapGraphOverlay, InfoIcon
   - **Rule: Do NOT add new CSS if a shared component already handles the pattern.** Justify any exception.
3. Check if a **CSS module** already defines the class you need. Search the relevant `.module.css` file before adding new classes.

## Icon System Rules (CRITICAL)

- **Entity kind icons** → `KindIcon` component from `entityConstants.ts`, backed by `KIND_ICON_COMPONENTS` in `icons.tsx`.
- **Place kind icons (React)** → `PlaceKindIcon` component from `entityConstants.ts`.
- **Place kind icons (Leaflet SVG strings)** → `buildPlaceKindIconSvg(placeKind, strokeColor, size)` from `icons.tsx`. Uses the SAME `PLACE_KIND_SVG_PATHS` as the React components — always in sync.
- **NEVER** inline a place-kind SVG path string in a component file. Always import from `icons.tsx`.
- **No emoji icons** — all icons must use Lucide React components. `KIND_ICONS` / `kindIcon()` have been removed.
- **Color maps** → `KIND_COLORS`, `PRESENCE_COLORS`, `STANCE_COLORS` from `entityConstants.ts`.
- **Label maps** → `KIND_LABELS`, `PRESENCE_LABELS`, `STANCE_LABELS`, `PLACE_KIND_LABELS` from their respective exports.

## Making Changes

4. Use CSS Modules exclusively (`import s from "./Foo.module.css"`). Never use global class names.
5. **No static inline styles** except for truly dynamic runtime values (e.g., `style={{ background: dynamicColor }}`).
6. **No duplicate CSS**: if a style pattern already exists in a shared component's CSS module, use that component rather than re-implementing the style.
7. **Business logic must not live in UI files**:
   - Data fetching, filtering, sorting, computed values → extract to a custom hook (`src/hooks/use*.ts`).
   - Color maps, icon maps, label maps → import from `src/components/shared/entityConstants.ts` or `icons.tsx`.
   - Claim audit logic → `src/utils/claimAudit.ts`.
   - Entity list helpers → `src/utils/entityListHelpers.ts`.
8. Every entity reference/link must use `<EntityLink>` or be wrapped with `<EntityHoverWrap>` for universal hover tooltips.
9. External links must use `<ExternalLink>` (shows ↗ icon).

## Section Header Format

- All collapsible section headers in ClaimsPanel, EntityDetail tabs, etc. must use **`{count} Title`** format (e.g., "3 Derived Places", "12 Notes"), not "Title (count)".
- Use `sectionToggleBtn` CSS class from `Wiki.module.css` for collapsible section toggle buttons.

## Sub-tab Display Pattern

- EntityDetail sub-tabs display **icon + count only** (no label text).
- Label appears in `title` attribute for tooltip on hover.
- Count badge uses `.detailSubTabCount` CSS class with small font, muted color, and pill background.

## Icon Vertical Alignment

- Icons in badges, buttons, or inline elements should use `display: inline-flex; align-items: center; justify-content: center;` for proper vertical centering.
- Examples: `.reviewBadge`, `.entityItemIcon` in wiki entity lists.

## Global Search Navigation

- **Map**: Uses app store `setSelection()` to update map state directly.
- **Wiki/Graph**: Uses URL params (`/wiki?kind=X&id=Y`, `/graph?kind=X&id=Y`) to avoid cross-contamination.
- Each page handles its own URL params via `useSearchParams` in page-specific hooks (`useWikiPageState`, `useGraphPageState`).

## Post-edit Cleanup

10. **Remove unused CSS**: after every edit, check if any CSS classes in the modified `.module.css` are no longer referenced in the corresponding `.tsx`. Delete dead classes immediately.
11. **Remove unused imports**: check for unused component/hook imports in modified files.
12. **Remove unused code**: if a component, hook, or utility function is no longer referenced anywhere, delete it.
13. Run type check:
    ```
    npx tsc --noEmit
    ```
14. Run production build:
    ```
    npm run build
    ```
15. Both must pass with zero errors before considering the edit complete.

## Updating Documentation

16. Add feature log entries to `docs/ui_rules.md` for any significant UI changes.
17. Update `docs/features.md` if behavior of any page or component changes.
18. Update `docs/user-guide.md` if a user-facing workflow or tip changes.

## Key Principles

- **Minimal diffs**: prefer editing existing files over creating new ones.
- **Reuse over reinvent**: always check shared components first.
- **CSS budget**: no new CSS class unless the pattern doesn't exist yet. Justify new classes.
- **Clean as you go**: dead CSS and dead code must be removed in the same edit session, not deferred.
- **Consistent spacing**: use design token variables (`var(--space-*)`, `var(--radius-*)`, `var(--font-size-*)`) over hardcoded pixel values where tokens exist.
- **Section count format**: `{count} Title`, not `Title (count)`.
- **Map markers = React icons**: `buildPlaceKindIconSvg` always derives from `PLACE_KIND_SVG_PATHS` — same visual as `PlaceKindIcon`.
