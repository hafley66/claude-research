---
name: egui-dnd
description: Drag and drop for egui lists -- reorderable items, drag handles, swap animations, touch support. Trigger on egui drag drop, egui dnd, egui reorder, egui_dnd, drag and drop egui.
license: MIT
metadata:
  audience: developers
  workflow: ui-rendering
---

## What this covers

`egui_dnd` from the hello_egui workspace. Drag-and-drop reordering for lists in egui. Handles detection, animation, and state management.

## Crate

```toml
egui_dnd = "0.10"  # check crates.io for latest
```

## Simple usage

```rust
use egui_dnd::dnd;

let mut items = vec!["alpha", "beta", "gamma"];

dnd(ui, "my_list").show_vec(&mut items, |ui, item, handle, state| {
    ui.horizontal(|ui| {
        handle.ui(ui, |ui| {
            ui.label(if state.dragged { ">>>" } else { ":::" });
        });
        ui.label(*item);
    });
});
```

`show_vec` mutates the Vec in place when items are dropped.

## Configuration

```rust
dnd(ui, "my_list")
    .with_animation_time(0.2)           // all animations
    .with_return_animation_time(0.15)   // snap-back on cancel
    .with_swap_animation_time(0.1)      // item swap animation
    .with_mouse_config(DragDropConfig { /* ... */ })
    .with_touch_config(Some(DragDropConfig { /* ... */ }))
    .show_vec(&mut items, |ui, item, handle, state| {
        // ...
    });
```

## DragDropItem trait

Items need a unique ID. Auto-implemented for anything `Hash`:

```rust
pub trait DragDropItem {
    fn id(&self) -> Id;
}
```

## Manual state management

Use `.show()` instead of `.show_vec()` for custom update handling:

```rust
let response = dnd(ui, "list").show(items.iter(), |ui, item, handle, state| {
    // render item
});

if let Some(update) = response.final_update() {
    // apply update manually
    response.update_vec(&mut items);
}
```

## Response queries

```rust
response.is_dragging()          // currently dragging
response.dragged_item_id()      // which item
response.is_drag_finished()     // just dropped
response.final_update()         // DragUpdate with src/dst indices
```

## Key files

- Source: `hello_egui/crates/egui_dnd/src/`
- Examples: `hello_egui/crates/egui_dnd/examples/`
