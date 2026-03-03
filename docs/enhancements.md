# Enhancements Implemented

## UI / Layout

1. **Sidebar toggles**
   - Left controls panel can be shown/hidden.
   - Right details/essays panel can be shown/hidden.
   - Includes map toolbar buttons and keyboard shortcuts.

2. **Map toolbar**
   - Toggle controls panel
   - Toggle details panel
   - Fit map to visible markers
   - Jump to random visible site

3. **Keyboard shortcuts**
   - `Space`: Play/pause timeline
   - `← / →`: Previous/next decade
   - `/`: Focus search field
   - `L`: Toggle left panel
   - `D`: Toggle right panel
   - `Esc`: Clear current selection
   - `?`: Show/hide shortcut help

## Data / Details Behavior

4. **Decade-aware details fix**
   - Selected place now resolves to the best matching row for the currently selected decade.
   - If the exact decade is missing for a place, the app clearly labels fallback behavior.

5. **Context-aware key figure links**
   - Key figures are now rendered as clickable links.
   - Links open in a new tab and include disambiguation context.
   - Includes direct overrides for major early-Christian figures (e.g., Ignatius of Antioch).

6. **Shareability + navigation convenience**
   - Current state is reflected in URL query params (year, cumulative mode, search, sidebar state, selected item).
   - "Copy share URL" action added.

7. **Extra map actions**
   - Center on selected item
   - Clear details selection
   - Quick-jump chips to visible sites
