# Small Mode Spec for cc-hud

## Goal
A compact single-session view triggered from the legend. Fits in a terminal status-line-sized overlay (~140px tall). Shows the most important metrics for one session at a glance.

## Layout (3 rows)

### Row 0 (~18px): Controls + Time Navigator
- Active toggle, time toggle (same as big mode)
- [▲ back] button to return to big mode
- No fit button (time mode autofits)
- Compressed time navigator bar

### Row 1 (~42px): Session Legend Row
- Same draw_legend_row() as big mode, identical appearance
- Eye icon, swatch, active dot, name, stats, mini timeline

### Row 2 (~80px): Three Synced Mini Charts

#### Left: Cost per turn + total overlay (even width with middle)
- Bars: sum(in_cost + out_cost) per turn, single color, not split
- Line: total_cost cumulative (dotted in time mode, solid in turn mode)
- Current total cost at top-right, always visible
- Tooltip at top-left with solid opaque bg, on hover

#### Middle: Tokens per turn + total overlay (even width with left)
- Bars: sum(in_tok + out_tok) per turn, single color, not split
- Line: total_tokens combined (dotted in time mode, solid in turn mode)
- Current total tokens at top-right, always visible
- Tooltip at top-left with solid opaque bg, on hover

#### Right: Usage stacked bar (wide enough for labels)
- Stacked filled rects for usage percentages
- Sorted: smallest in front (higher z), largest in back
- Metric names ("5h", "7d") inside bars at top-left
- Tooltip at top-left with solid bg, ONLY on hover

### All Charts
- Linked cursor (synced crosshair)
- Synced to time navigator range
- No grid lines, no y-axis labels
- x-axis only in time mode
- Tooltips have solid opaque background

## Interaction
- **Enter small mode**: [→] button on legend rows (flat + sub-rows, not group headers)
- **Exit small mode**: [▲ back] button in control strip
- State: `small_mode_session: Option<String>` on Hud struct

## Data
- Chart data filtered to single selected session
- Bars are summed (not split in/out)
- Lines are combined totals
- Usage from global UsageData
