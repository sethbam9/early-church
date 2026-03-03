# UI Design Rules — Early Christianity Atlas

## 1. Two Visual Chip Types

### Info Badge (`.badge`)
- **Purpose**: Display-only metadata (event type, location, date range, status).
- **Style**: Solid 1px border `#ccb093`, background `#fff6ec`, text `var(--ink)`. No cursor change, no hover effect, no arrow.
- **Never** make a badge look clickable.

### Entity Chip (`.entity-chip`)
- **Purpose**: Clickable navigation to another entity (person, event, doctrine, city, work).
- **Style**: Dashed 1px border `var(--accent)`, text `var(--accent-strong)`, trailing `→` arrow, `cursor: pointer`.
- **On hover**: border becomes solid, background darkens.
- **Selected state**: filled accent background, white text.

**Rule**: If it navigates somewhere, use `.entity-chip`. If it's just labeling, use `.badge`.

## 2. Right Panel — Master-Detail Pattern

Every tab in the right panel follows the same interaction pattern:

1. **List view** (default): Scrollable list of items with search/filter bar at top.
2. **Detail view**: Clicking any item expands detail **inline below the list** within the same tab. A "← Back to list" or collapse affordance returns to list-only view.
3. **Never** auto-switch to the Details tab from another tab. Cross-entity chips open the target's own tab.

### Tab State Rules
- Each tab maintains its own selection state.
- Selecting a city on the map opens the **Details** tab and clears any selection on other tabs.
- Clicking an entity-chip within a tab opens that entity's tab and clears the originating tab's selection.
- Switching tabs manually does NOT clear state — tabs remember their last selection.

## 3. Right Panel Width Modes

- **Normal**: `390px` fixed width alongside the map.
- **Wide**: Panel expands to `60%` of the viewport, overlapping the map. Toggle via a `⬌` button in the tab bar.
- The map remains rendered underneath (for arc/highlight context) but is partially covered.

## 4. Map Markers

### City Circles
- Default: `radius: 6`, presence-status color, `weight: 2`.
- Highlighted (via HighlightService): `radius: 7`, highlight color, `weight: 2.5`.
- **Selected**: `radius: 9`, accent border `#9f4e1f`, `weight: 3`. PLUS an outer pulsing ring (`radius: 16`, dashed, CSS animation `selected-pulse`).

### Archaeology Stars
- Default: `★` icon, gold background.
- Selected: red background, white text.

### Tooltips
- Format: `Ancient Name · Modern Name, Country (date range)`
- English-only tile layer (CartoDB Voyager).

## 5. City Chronicle Timeline

- **Vertical timeline** with left border line and dots.
- Each decade is a **compact row**, NOT a card.
- Only show fields that **changed** from the previous decade (diff-only).
- "No changes" rows show a single muted line.
- Each diff field gets its own line with a label prefix (e.g., `Figures:`, `Polity:`, `Denom:`).
- The **active decade** row is highlighted with accent left-border and auto-scrolled into view.

## 6. Lists Are Always Searchable

Every list of 5+ items must have a search input at the top. This applies to:
- Events list
- People list
- Doctrines list
- Quotes list
- Works list
- Archaeology sites list
- Essays list
- City chronicle people/events chips (if >8)

## 7. Typography & Spacing

- **Panel headers**: `h2`, margin `0 0 6px`.
- **Section headers**: `h3`, margin `14px 0 6px`.
- **Sub-headers** (within detail): `h4`, margin `8px 0 4px`, `0.88rem`.
- **Body text**: `0.9rem`, `line-height: 1.42`.
- **Muted text**: `color: var(--muted)`, `0.86rem`.
- **Card padding**: `8px`, border-radius `8px`.
- **Section gaps**: `8px` between cards, `10px` between sections.

## 8. Color Vocabulary

| Purpose | Color |
|---|---|
| Accent / Interactive | `#9f4e1f` (--accent) |
| Strong accent | `#7c3710` (--accent-strong) |
| Muted text | `#6f6657` (--muted) |
| Panel background | `#fffdf8` (--panel) |
| Card background | `#fff` |
| Active/highlight bg | `#fff7ee` |
| Hover bg | `#fdf4e9` |
| Selected bg | `#fff7ee` + accent border |
| Direct highlight (map) | `#e67e22` |
| Event highlight (map) | `#8e44ad` |
| Doctrine highlight (map) | `#2980b9` |
| Archaeology highlight (map) | `#27ae60` |

## 9. Relationship Label Inversion

When displaying edges from entity X's perspective:
- If the edge is `X → Y` with relationship `R`: display as `R → Y`.
- If the edge is `Y → X` with relationship `R`: display the **inverse** label.

Inverse labels:
| Forward | Inverse |
|---|---|
| `disciple_of` | `teacher_of` |
| `bishop_of` | `had_bishop` |
| `authored` | `authored_by` |
| `sent_to` | `received_from` |
| `attended` | `attended_by` |
| `led` | `led_by` |
| `affirms` | `affirmed_by` |
| `condemned_by` | `condemned` |
| `ordained_by` | `ordained` |
| `martyred_at` | `site_of_martyrdom` |
| `located_in` | `contains` |
| `held_in` | `hosted` |

## 10. Correspondence Arcs

Arcs are rendered for ANY edge where both endpoints resolve to city coordinates:
- `person → city` (bishop_of, visited, wrote_from, active_in, martyred_in)
- `person → person` where both have city edges (corresponded_with, disciple_of)
- `work → city` (sent_to, written_in)

Arc style: dashed polyline, color by relationship type, weight = edge weight.
