UI Refactor Plan (Architecture + Implementation Guide)
Purpose

Refactor the UI architecture to eliminate global CSS drift, standardize visual patterns, and enforce reusable UI primitives. The goal is a predictable design system where new screens are composed from shared components rather than ad-hoc styles.

This plan merges:

the structural CSS refactor strategy

the UI behavior goals

the Definition of Done requirements

It should be treated as the implementation specification for the AI coder.

Core Architecture Decisions
Styling System

Use:

CSS Modules for component styling

Design tokens for all colors, spacing, typography

Minimal global CSS

Do not introduce Tailwind or CSS-in-JS.

Rules

No new styles added to the global stylesheet except resets, tokens, and utilities.

Every reusable component owns its styles via ComponentName.module.css.

No inline styling except for dynamic numeric values or CSS variables.

All reusable UI patterns must be implemented as components.

Target Folder Structure
src/
  styles/
    tokens.css
    globals.css
    leaflet-overrides.css

  components/
    layout/
      NavBar.tsx
      NavBar.module.css

    shared/
      Button.tsx
      Button.module.css
      Chip.tsx
      Chip.module.css
      Dropdown.tsx
      Dropdown.module.css
      ToggleStateBtn.tsx
      ToggleStateBtn.module.css
      Card.tsx
      Card.module.css
      PanelSection.tsx
      PanelSection.module.css
      SearchInput.tsx
      SearchInput.module.css
      Badge.tsx
      Badge.module.css
      Tabs.tsx
      Tabs.module.css
      Timeline.tsx
      Timeline.module.css
      EntityLink.tsx
      EntityLink.module.css
      TooltipOverlay.tsx
      TooltipOverlay.module.css
      InformationalOverlay.tsx
      InformationalOverlay.module.css

    sidebar/
      SidebarShell.tsx
      SidebarShell.module.css
      EntityDetail.tsx
      EntityDetail.module.css
      RelatedEntityCard.tsx
      RelatedEntityCard.module.css

    map/
      LeftPanel.tsx
      LeftPanel.module.css
      RightPanel.tsx
      RightPanel.module.css
      CityDetail.tsx
      CityDetail.module.css

    graph/
      GraphPanel.tsx
      GraphPanel.module.css

  pages/
    MapPage.tsx
    GraphPage.tsx
    WikiPage.tsx
Design Tokens

Create src/styles/tokens.css.

All UI components must use tokens.

:root {
  --bg-app: #0b1020;
  --bg-surface: #121830;
  --bg-surface-2: #19213d;

  --text-primary: #eef2ff;
  --text-secondary: #b7c0d8;
  --text-muted: #8d97b0;

  --border-subtle: #2a3557;
  --border-strong: #41517d;

  --accent: #8fb4ff;
  --accent-soft: rgba(143,180,255,0.14);

  --success: #4caf50;
  --warning: #d4a72c;
  --danger: #d85b5b;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-pill: 999px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;

  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 20px;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.18);
  --shadow-md: 0 8px 24px rgba(0,0,0,0.22);

  --focus-ring: 0 0 0 3px rgba(143,180,255,0.35);
}
Global CSS Rules

globals.css should only contain:

reset styles

typography defaults

layout primitives

small utility helpers

Example utilities:

.stack-sm > * + * { margin-top: var(--space-2); }
.stack-md > * + * { margin-top: var(--space-4); }

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.text-muted {
  color: var(--text-muted);
}

Leaflet overrides belong in leaflet-overrides.css.

Shared UI Components
Chip

Used for:

filters

tags

entity indicators

Rules:

consistent padding

consistent pill radius

hover state for clickable chips

high-contrast selected state

default color scheme

Variants:

neutral
accent
success
warning
danger

Clickable chips must have hover effects.

Filter chips must invert colors when selected.

Dropdown

Rules:

consistent padding

consistent border radius

consistent background

overlay position logic (above/below depending on viewport)

ToggleStateBtn

Single container with:

label left

label right

filled background indicating active state

Used for modes such as:

browse vs audit

relations vs claims

Card

Used everywhere for:

entity displays

evidence

related entities

dropdown cards

No alternative card styles allowed.

RelatedEntityCard

Rules:

expand icon on right

expanded content uses same width and layout

no nested cards

InformationalOverlay

Highest z-index.

Used for:

entity summary overlays

contextual information

EntityLink

Rules:

normal text appearance

optional dashed chip variant

hover tooltip always enabled

external links always show ↗

Shared UI Behaviors
Filter System

Rules:

No "Show All" label unless filters are active

Multi-select filters use chips

Single-select filters use dropdown

Search required if more than 10 options

Binary filters use switch

Timeline Component

Single shared component used across all entities.

Structure:

Left column: decade markers
Right column: entity cards

Features:

auto scroll to nearest decade before selected date

optional grouped display

Page-Specific Rules
Map Page

Default behavior:

Fit visible unless opened via entity link

If opened via entity link → center on entity

Centering must adjust for right panel width.

Features:

Proposition selection color-codes locations by stance

Timeline auto-scroll to nearest decade

Left panel filter rows sorted by linkage count

Selecting proposition highlights related locations

Graph Page

Graph rules:

clusters must be circular

center cluster when opened

maintain orb spacing

Pathfinder:

dropdown overlays follow overlay positioning rules

Kevin Bacon mode:

iterate by least intermediary links

Right panel:

only two "open elsewhere" links

back button restores previous node

return-to-state only shown when graph state changed

Hover behavior:

hovering entity or timeline card highlights graph node

Wiki Page

Entity summary view:

maximize vertical space

map/graph links left aligned

toggle between relations and claims

Filters:

must support role, certainty, and additional filters

Left panel:

entities sorted by linkage count

Essays:

tabbed markdown renderer

entity hover enabled

Tables:

headers left aligned

columns aligned with header

semi-transparent borders between columns

Shared UI Patterns

Must be universal across the application.

Filter Chips

centralized styling

inverted active state

no duplicate chip styling

Dropdown Cards

always use evidence card style

full width

same background

single internal/external link

Links

Rules:

internal links use hover tooltips

external links use ↗ indicator

Entity Hover

Universal.

Any entity reference must support hover summary.

Navigation Rules

Right panels must support:

back navigation

exit navigation

Back appears only if previous state exists.

Return-to-original appears only if the graph state changed.

Derived Cards

Cards without expandable content must show:

derivation trail popup on hover

Code Rules
Centralized Imports

No local color/icon/label maps.

All must come from shared modules.

Shared Rendering

Never inline render:

evidence

notes

pagination

tooltips

Always use shared components.

CSS Enforcement Rules

CSS must be significantly slimmer.

Chip, filter, and legend styles must be centralized.

No duplicated styling patterns.

No component-specific color systems.

No deep descendant selectors.

Bad:

.sidebar .entity-card .header span

Good:

.entityHeader
Refactor Implementation Phases
Phase 1 — Foundation

Create tokens.css

Split styles.css into

globals.css

leaflet-overrides.css

Replace hardcoded colors with tokens.

Phase 2 — Core Components

Implement:

Button

Chip

Dropdown

Card

ToggleStateBtn

TooltipOverlay

EntityLink

SearchInput

Tabs

Timeline

Phase 3 — Feature Refactor

Refactor highest-drift areas first:

sidebar components

map components

shared components

Move all styling into CSS Modules.

Phase 4 — UI Standardization

Enforce:

radius scale

spacing scale

shadow scale

hover interaction rules

Phase 5 — Cleanup

After each component migration:

delete corresponding global CSS

remove dead selectors

remove deprecated components

Definition of Done (DOD)

The refactor is complete only when:

All UI rules are implemented.

CSS is significantly slimmer.

Shared components control all patterns.

docs/ui_rules.md is updated.

Every attribute from every table is accessible in the wiki.

Table columns are aligned and bordered consistently.

No duplicate navigation or filters exist.

Overlays follow positioning rules.

Entity hover popups work everywhere.

Graph path finder and proposition highlighting work.

All filters use the shared chip system.

UI files have been fully scanned for rule compliance.

Reusable UI patterns always exist as components.

Deprecated styles and components are removed entirely.

Final Guiding Principle

All UI must be composed from shared primitives and tokens.

No new styling pattern should appear without first becoming a reusable component.