---
name: egui-performance-ceiling
description: egui immediate mode performance characteristics -- where it scales, where it breaks, widget count thresholds, text bottlenecks, layout nesting costs, comparison to retained-mode frameworks. Trigger on egui performance, egui ceiling, egui scaling, egui slow, egui widget count, immediate mode performance, egui vs retained.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Where egui's immediate mode architecture hits performance ceilings, why, and how it compares to retained-mode alternatives.

## The Core Cost Function

`O(total_widgets)` per frame, regardless of what changed. Every frame:

1. **Layout pass**: every `ui.horizontal()`, `ui.vertical()`, `ui.add()` computes size and position. Each widget does `Region::allocate_space`, cursor advance, clip rect check. ~1-5μs per widget.

2. **Paint pass**: every widget emits `Shape` commands into `PaintList`. Text generates vertex data through galley caching. Each `Shape` becomes triangles in `Mesh`.

## Performance Thresholds

| Widget count | Layout + Paint | 60fps headroom | 144fps headroom |
|---|---|---|---|
| 100 | ~0.1ms | 16.5ms left | 6.8ms left |
| 500 | ~0.5ms | 16.1ms | 6.4ms |
| 1,000 | ~1-2ms | 15ms | 5ms |
| 5,000 | ~5-10ms | 7ms | marginal |
| 10,000+ | ~15-30ms | frame drops | frame drops |

## What Actually Breaks Down

### Layout nesting depth

A flat list of 1000 labels is faster than 200 widgets nested 10 levels deep. Each nesting level adds cursor management, available-rect subdivision, and clip rect intersection. Deep `ui.horizontal` inside `ui.vertical` inside `ui.group` stacks up.

### Text

The other bottleneck. `epaint` tessellates text into triangles every frame unless galley cache hits. Text-heavy UIs (log viewer, code editor, table with 500 visible text cells) spend most time in text layout, not widget logic.

### ScrollArea doesn't fully help

`ScrollArea` clips paint commands for off-screen widgets, but still runs layout for everything (needs cumulative heights to compute scroll position). A 10,000-row scrollable list lays out 10,000 rows even if 20 are visible.

### No retained scene graph

Can't say "this subtree is clean, use last frame's triangles." Every frame generates fresh paint commands for the entire visible UI.

## What You Can Do

- Gate sections behind `if` to skip them (manual reactivity)
- Use `ScrollArea` for paint clipping
- Implement virtual scrolling manually (only create widgets for visible rows)
- Use `FrameCache` for expensive computations
- Minimize text widget count in hot paths
- Avoid deep nesting where possible

These are the programmer manually doing what a reactive retained-mode system does automatically.

## Comparison to Retained-Mode (Dioxus/Iced)

| Scenario | egui | Dioxus signals | Iced 0.14 |
|---|---|---|---|
| One button clicked, 500 widgets | All 500 re-laid-out | Only signal subscriber re-renders | Only changed widget re-painted |
| Text input updating a label | Full UI pass | Signal write -> only label re-renders | Message -> view rebuild, but reactive rendering skips unchanged |
| Idle (nothing changed) | No repaint (sleeps) | No repaint | No repaint |
| Animation on one element | Full UI pass every frame | Only animated component | Only animated widget re-painted |
| 10k row table, one cell changes | 10k layout + visible paint | One cell re-renders | One widget re-painted |

## Where egui Wins Despite the Ceiling

- **Simple to reason about**: no reactive graph, no subscription bugs, no lifecycle
- **Fastest time-to-working-app**: no build toolchain, no markup language, just Rust
- **Embedding**: trivially embeds in game engines, 3D viewers, existing wgpu apps
- **For most native tools (50-500 widgets)**: the ceiling is irrelevant, sub-ms rendering

## Where the Ceiling Matters

- Full applications with deep component trees (Figma-level complexity)
- Data-heavy dashboards with 1000+ visible data cells
- Text-heavy interfaces (editors, log viewers)
- High refresh rate targets (144fps+)
- Apps where CPU budget is shared with heavy background work
