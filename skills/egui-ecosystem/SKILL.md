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

| Crate | What | Notes |
|---|---|---|
| `egui_flex` | Flexbox layout | hello_egui, own algorithm (not Taffy) |
| `egui_taffy` | CSS Flex/Grid/Block via Taffy | PPakalns/egui_taffy (hello_egui version is a stub) |
| `egui_dock` | IDE-style docking tabs | Adanos020/egui_dock, serde, ~3.1M downloads |
| `egui_tiles` | Tiling layout with drag-and-drop | By Rerun team |
| `egui_virtual_list` | Virtual scroll, varying row heights | hello_egui |
| `egui_infinite_scroll` | Infinite scroll | hello_egui |

## Visualization

| Crate | What |
|---|---|
| `egui_plot` | 2D plots: lines, scatter, bars, ~4.6M downloads |
| `egui_graphs` | Network/graph visualization |
| `egui-snarl` | Node-graph editor, serde support |
| `egui_node_graph` | Node graph editor (older) |
| `walkers` | Slippy maps (OpenStreetMap, Mapbox) |
| `egui-gizmo` | 3D transformation gizmo |

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
| `egui_modal` | Modal dialogs |

## Theming

| Crate | What |
|---|---|
| `catppuccin-egui` | Catppuccin pastel theme |
| `egui_colors` | Color styling toolkit |
| `egui-shadcn` | Shadcn/ui-inspired components |

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

## Meta-collection

`hello_egui` (lucasmerlin) bundles: egui_flex, egui_dnd, egui_virtual_list, egui_infinite_scroll, egui_router, egui_form, egui_pull_to_refresh.

## Notable apps built with egui

| App | What | Why study |
|---|---|---|
| **Rerun** (rerun-io/rerun) | Multimodal data visualization | Most ambitious egui app. Built egui_tiles and egui_table. By egui's author. |
| **Ruffle** (ruffle-rs/ruffle) | Flash emulator | egui as secondary GUI around core engine |
| **Gossip** (mikedilger/gossip) | Nostr social client | Full desktop app with SQLite |

## Not egui

- **Lapce** uses Floem (own framework), NOT egui
- **Zed** uses GPUI (own framework), NOT egui
