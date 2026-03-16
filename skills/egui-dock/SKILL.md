---
name: egui-dock
description: Docking/tab panel system for egui -- DockState binary tree layout, TabViewer trait, drag-and-drop tab rearrangement, split panes, floating windows, serde persistence. Trigger on egui dock, egui tabs, egui docking, egui panels, egui_dock, tab layout egui.
license: MIT
metadata:
  audience: developers
  workflow: ui-rendering
---

## What this covers

`egui_dock`: IDE-style docking panel system. Users drag tabs between panels, split panes, float windows. The crate owns the chrome (tab bars, separators, drag overlay), you own the content via `TabViewer::ui()`.

## Crate

```toml
egui_dock = "0.15"  # check crates.io for latest
# optional: features = ["serde"] for layout persistence
```

## Core types

- **DockState<Tab>** -- top-level state. Contains surfaces (main + floating windows).
- **Tree<Tab>** -- binary tree of split nodes and leaf nodes.
- **Node<Tab>** -- Empty | Leaf(tabs) | Horizontal(split) | Vertical(split).
- **LeafNode<Tab>** -- holds `Vec<Tab>`, active tab index, rect/viewport.
- **Surface<Tab>** -- Empty | Main(Tree) | Window(Tree, WindowState).
- **DockArea** -- rendering widget, builder pattern.
- **TabViewer** -- trait you implement to define tab content.

## Minimal example

```rust
use egui_dock::{DockArea, DockState, TabViewer, NodeIndex};

struct MyTabs;
impl TabViewer for MyTabs {
    type Tab = String;
    fn title(&mut self, tab: &mut String) -> egui::WidgetText { tab.as_str().into() }
    fn ui(&mut self, ui: &mut egui::Ui, tab: &mut String) {
        ui.label(format!("Content of {tab}"));
    }
}

// Setup
let mut dock_state = DockState::new(vec!["Tab 1".into(), "Tab 2".into()]);

// Each frame
DockArea::new(&mut dock_state).show(ctx, &mut MyTabs);
```

## Programmatic layout

```rust
let mut dock = DockState::new(vec!["editor".into()]);
let surface = dock.main_surface_mut();

// Split root: left 30% gets sidebar, right 70% keeps editor
let [sidebar, editor] = surface.split_left(NodeIndex::root(), 0.3, vec!["sidebar".into()]);

// Split editor: bottom 20% gets terminal
let [editor, terminal] = surface.split_below(editor, 0.8, vec!["terminal".into()]);

// Add tab to existing leaf
surface.push_to_first_leaf(vec!["Tab 3".into()]);
```

## TabViewer trait

```rust
impl TabViewer for MyApp {
    type Tab = TabKind;

    // Required
    fn title(&mut self, tab: &mut TabKind) -> WidgetText { /* tab title */ }
    fn ui(&mut self, ui: &mut Ui, tab: &mut TabKind) { /* tab content */ }

    // Optional overrides
    fn on_close(&mut self, tab: &mut TabKind) -> OnCloseResponse {
        // Close, Focus (bring to front, don't close), or Ignore
        OnCloseResponse::Close
    }
    fn is_closeable(&self, tab: &TabKind) -> bool { true }
    fn on_add(&mut self, surface: SurfaceIndex, node: NodeIndex) {
        // "+" button pressed, push new tab
    }
    fn context_menu(&mut self, ui: &mut Ui, tab: &mut TabKind, surface: SurfaceIndex, node: NodeIndex) {
        // right-click menu
    }
    fn allowed_in_windows(&self, tab: &mut TabKind) -> bool { true }
}
```

## DockArea configuration

```rust
DockArea::new(&mut dock_state)
    .show_add_buttons(true)           // "+" button on tab bars
    .show_close_buttons(true)         // "x" on tabs
    .draggable_tabs(true)             // drag-and-drop
    .tab_context_menus(true)          // right-click
    .show_leaf_collapse_buttons(true) // minimize panels
    .allowed_splits(AllowedSplits::All) // All, LeftRightOnly, TopBottomOnly, None
    .show(ctx, &mut MyTabs);

// Or render inside existing UI
DockArea::new(&mut dock_state).show_inside(ui, &mut MyTabs);
```

## Index types

```rust
SurfaceIndex::main()  // surface 0 (the main window)
NodeIndex::root()     // node 0 (tree root)
TabIndex(0)           // first tab in a leaf
```

## Persistence (serde feature)

```rust
// Save
let json = serde_json::to_string(&dock_state).unwrap();

// Load
let dock_state: DockState<MyTab> = serde_json::from_str(&json).unwrap();
```

## Floating windows

Tabs dragged outside the main surface become floating windows automatically. Control with:
- `TabViewer::allowed_in_windows()` -- per-tab opt-out
- `DockArea::window_bounds(Rect)` -- constrain float area

## Architecture

Binary tree stored as flat `Vec<Node>` with implicit indexing:
- Root at 0
- Left child of n: `2n + 1`
- Right child of n: `2n + 2`

Each split node has a `fraction: f32` (0..1) controlling size ratio. Users can drag separators to resize.

## Key files

- Source: `egui_dock/src/`
- State: `dock_state/mod.rs` (DockState), `dock_state/tree/mod.rs` (Tree)
- Rendering: `widgets/dock_area/mod.rs`, `widgets/tab_viewer.rs`
- Drag & drop: `widgets/dock_area/drag_and_drop.rs`
- Examples: `egui_dock/examples/`
