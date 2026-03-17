---
name: egui-ecosystem
description: Map of the egui third-party crate ecosystem -- layout, visualization, text, dialogs, theming, infrastructure. Trigger on egui crates, egui ecosystem, egui widgets, egui libraries, what egui crates exist.
license: MIT
metadata:
  audience: developers
  workflow: ui-rendering
---

## What this covers

Third-party crates that extend egui. These are all pure Rust UI code -- they add kilobytes to binary size, not megabytes, since the heavy deps (wgpu, egui) are already in the tree.

## Layout & Containers

| Crate | What | Links |
|---|---|---|
| `egui_flex` | Flexbox layout | hello_egui, own algorithm (not Taffy) |
| `egui_taffy` | CSS Flex/Grid/Block via Taffy | [PPakalns/egui_taffy](https://github.com/PPakalns/egui_taffy) |
| `egui_dock` | IDE-style docking tabs | [Adanos020/egui_dock](https://github.com/Adanos020/egui_dock), serde, ~3.1M downloads |
| `egui_tiles` | N-way tiling layout with drag-and-drop | [rerun-io/egui_tiles](https://github.com/rerun-io/egui_tiles), by emilk |
| `egui_virtual_list` | Virtual scroll, varying row heights | hello_egui |
| `egui_infinite_scroll` | Infinite scroll | hello_egui |

## Visualization

| Crate | What | Links |
|---|---|---|
| `egui_plot` | 2D plots: lines, scatter, bars | ~4.6M downloads |
| `egui_graphs` | Network/graph visualization on petgraph | [blitzarx1/egui_graphs](https://github.com/blitzarx1/egui_graphs) |
| `egui-snarl` | Node-graph editor, SnarlViewer trait | [zakarumych/egui-snarl](https://github.com/zakarumych/egui-snarl) |
| `egui-graph-edit` | Opinionated node graph editor | [kamirr/egui-graph-edit](https://github.com/kamirr/egui-graph-edit) |
| `egui_node_graph` | Node graph editor (older) | |
| `walkers` | Slippy maps (OpenStreetMap, Mapbox) | |
| `egui-gizmo` | 3D transformation gizmo | |
| `egui-keyframe` | Keyframe timeline, bezier curve editor, dope sheet | [virtualritz/egui-keyframe](https://github.com/virtualritz/egui-keyframe) |

## Animation

| Crate | What | Links |
|---|---|---|
| `egui_animation` | Eased animations, position, repeating, collapse | [docs.rs/egui_animation](https://docs.rs/egui_animation), egui 0.33+ |
| `simple_easing` | 30 easing functions (quad, cubic, elastic, bounce...) | [docs.rs/simple_easing](https://docs.rs/simple_easing) |

See `egui-advanced-patterns` skill for animation API details.

## Text & Content

| Crate | What |
|---|---|
| `egui_commonmark` | Markdown/CommonMark renderer, ~735K downloads |
| `egui_code_editor` | Code editor with syntax highlighting |
| `egui_json_tree` | Interactive JSON tree viewer |

## Dialogs & Notifications

| Crate | What |
|---|---|
| `egui-file-dialog` | Full file dialog rendered in egui |
| `egui-notify` | Toast notifications |
| `egui_modal` | Modal dialogs with backdrop |

## Theming

| Crate | What |
|---|---|
| `catppuccin-egui` | Catppuccin pastel theme |
| `egui_colors` | Color styling toolkit |
| `egui-shadcn` | Shadcn/ui-inspired components |

## Overlay & Windowing

| Crate | What | Links |
|---|---|---|
| `egui_overlay` | Transparent click-through overlay windows | [coderedart/egui_overlay](https://github.com/coderedart/egui_overlay) |
| `screen_overlay` | Win + X11 overlay, RAII handles | [iwanders/screen_overlay](https://github.com/iwanders/screen_overlay) |
| raw winit+wgpu+egui | No crate -- manual setup, full control | See `egui-overlay-windows` skill |

See `egui-overlay-windows` skill for overlay details. The raw winit+wgpu approach avoids the GLFW dependency of `egui_overlay` and gives direct NSWindow access for transparency configuration. Requires more boilerplate but provides the most control for custom overlay geometry (border frames, shaped windows).

## Infrastructure

| Crate | What |
|---|---|
| `egui_dnd` | Drag and drop for lists |
| `egui_router` | SPA-style page routing with transitions |
| `egui_hooks` | React-like hooks |
| `egui_form` | Form validation |
| `egui_tracing` | Tracing/log viewer panel |
| `egui_struct` | Derive macro for auto-generating UI from structs |
| `iconflow` | 10+ embedded icon packs |
| `egui-probe` | Debug-inspect any type at runtime |

## Meta-collection

`hello_egui` ([lucasmerlin/hello_egui](https://github.com/lucasmerlin/hello_egui)) bundles: egui_flex, egui_dnd, egui_virtual_list, egui_infinite_scroll, egui_router, egui_form, egui_pull_to_refresh.

## Notable apps built with egui

| App | What | Why study |
|---|---|---|
| **Rerun** ([rerun-io/rerun](https://github.com/rerun-io/rerun)) | Multimodal data visualization | Largest egui app. Custom wgpu renderer, LOD, animation, blueprint-as-data architecture |
| **Ruffle** ([ruffle-rs/ruffle](https://github.com/ruffle-rs/ruffle)) | Flash emulator | egui as secondary GUI around core engine |
| **Gossip** ([mikedilger/gossip](https://github.com/mikedilger/gossip)) | Nostr social client | Full desktop app with SQLite |
| **Screenpipe** ([screenpipe/screenpipe](https://github.com/screenpipe/screenpipe)) | Screen memory + OCR pipeline | Hybrid AX + OCR, Tauri frontend |

See `egui-advanced-patterns` skill for Rerun architecture deep-dive and `screenpipe-architecture` for the capture pipeline.

## Not egui

- **Lapce** uses Floem (own framework), NOT egui
- **Zed** uses GPUI (own framework), NOT egui
