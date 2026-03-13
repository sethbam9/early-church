---
description: Workflow for making UI edits — styling, layout, component changes, and CSS modifications
---

# UI Edit Workflow

Follow these steps when making any UI changes (CSS, layout, component styling, new components).

## Pre-flight

1. Read `docs/ui_rules.md` — single source of truth for architecture, component catalog, forbidden patterns, and feature log.
2. Check if a **shared component** already exists for what you need:
   - `src/components/shared/` — Chip, Tabs, ToggleGroup, SearchInput, DropdownSelect, Slider, Pagination, EntityLink, EntityHoverCard, EvidenceCard, ExternalLink, NoteCard, CrossPageNav, PathPickerInput, PanelShell, Timeline, Hl, Badge, MarkdownRenderer
   - **Rule: Do NOT add new CSS if a shared component already handles the pattern.** Justify any exception in the PR/commit message.
3. Check if a **CSS module** already defines the class you need. Search the relevant `.module.css` file before adding new classes.

## Making Changes

4. Use CSS Modules exclusively (`import s from "./Foo.module.css"`). Never use global class names.
5. **No static inline styles** except for truly dynamic runtime values (e.g., `style={{ background: dynamicColor }}`).
6. **No duplicate CSS**: if a style pattern already exists in a shared component's CSS module, use that component rather than re-implementing the style.
7. **Business logic must not live in UI files**:
   - Data fetching, filtering, sorting, computed values → extract to a custom hook (`src/hooks/use*.ts`).
   - Color maps, icon maps, label maps → import from `src/components/shared/entityConstants.ts`.
   - Claim audit logic → `src/utils/claimAudit.ts`.
   - Entity list helpers → `src/utils/entityListHelpers.ts`.
8. Every entity reference/link must use `<EntityLink>` or be wrapped with `<EntityHoverWrap>` for universal hover tooltips.
9. External links must use `<ExternalLink>` (shows ↗ icon).

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
    npx vite build
    ```
15. Both must pass with zero errors before considering the edit complete.

## Updating Documentation

16. If the change resolves an item in `docs/ui-goals.md`, mark it as `[x]` in the issue tracker.
17. If the change introduces a new UI pattern or shared component, add it to the relevant section in `docs/ui-goals.md`.

## Key Principles

- **Minimal diffs**: prefer editing existing files over creating new ones.
- **Reuse over reinvent**: always check shared components first.
- **CSS budget**: no new CSS class unless the pattern doesn't exist yet. Justify new classes.
- **Clean as you go**: dead CSS and dead code must be removed in the same edit session, not deferred.
- **Consistent spacing**: use design token variables (`var(--space-*)`, `var(--radius-*)`, `var(--font-size-*)`) over hardcoded pixel values where tokens exist.
