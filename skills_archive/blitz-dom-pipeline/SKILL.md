---
name: blitz-dom-pipeline
description: Blitz DOM processing pipeline -- BaseDocument state machine, Stylo CSS resolution, Taffy layout computation, stylo_taffy bridge, dirty node tracking, incremental updates, headless embedding. Trigger on blitz-dom, BaseDocument, stylo_taffy, blitz style resolution, blitz layout, blitz dirty tracking.
license: MIT
metadata:
  audience: developers
  workflow: ui-rendering
---

## What this covers

The core of Blitz: how `BaseDocument` processes DOM nodes through style resolution, layout computation, and event handling. This is the headless engine that can run without any windowing or rendering.

## BaseDocument state machine

BaseDocument holds a flat `Vec<Node>` and runs a 3-phase cycle:

```
     Events/Mutations
           |
           v
   mark nodes dirty (RestyleHint)
           |
           v
   ┌───────────────────┐
   │  Phase 1: STYLE   │  Stylo (Mozilla CSS engine)
   │  selector match    │  cascade, inheritance
   │  -> ComputedValues │  per node
   └────────┬──────────┘
            |
   ┌────────v──────────┐
   │  Phase 2: LAYOUT  │  Taffy (CSS layout engine)
   │  ComputedValues   │  -> taffy::Style (via bridge)
   │  flex/grid/block  │  -> Layout { x, y, w, h }
   └────────┬──────────┘
            |
   ┌────────v──────────┐
   │  Phase 3: PAINT   │  (external, via blitz-paint)
   │  walk layout tree │
   │  emit anyrender   │
   │  paint commands   │
   └───────────────────┘
```

## The stylo_taffy bridge

The critical glue between CSS resolution and layout. Lives in `packages/stylo_taffy/`.

```rust
// Wrapper type that bridges Stylo's ComputedValues to Taffy's Style
TaffyStyloStyle<T>

// Core conversion function
convert::to_taffy_style(computed_values: &ComputedValues) -> taffy::Style
```

This converts CSS properties (display, flex-direction, margin, padding, grid-template-columns, etc.) into Taffy's `Style` struct. It's a large mapping -- every CSS layout property needs a corresponding Taffy representation.

## Dirty tracking

Incremental updates via `RestyleHint` flags:

1. Mutation or event marks nodes with `RestyleHint`
2. `doc.poll()` checks dirty bits
3. Only re-resolves style for dirty subtrees
4. Only re-layouts when style changes affect layout
5. Minimal repaint region

## Document poll cycle

```rust
impl Document for BaseDocument {
    fn poll(&mut self, waker: Option<Waker>) {
        // 1. Run animations
        // 2. Check for pending resource loads (images, fonts)
        // 3. If style-dirty: resolve_stylist() via Stylo
        // 4. If layout-dirty: compute layout via Taffy
        // 5. If anything changed: signal redraw needed
    }
}
```

## Headless usage (no window)

BaseDocument is a pure data structure. It does not need winit, wgpu, or any rendering backend:

```rust
use blitz_dom::{BaseDocument, DocumentConfig};

let mut doc = BaseDocument::new(config);
// ... add nodes, set styles ...
doc.poll(None);  // resolve style + layout

// Now query layout results
let node = doc.get_node(node_id);
let layout = node.layout();  // taffy::Layout { location, size, ... }
```

This is what enables:
- Headless rendering (render to texture via Vello)
- Embedding in game engines (Bevy integration exists)
- Custom overlay windows (use your own winit loop)
- Testing without a display

## Key source files

- `packages/blitz-dom/src/document.rs` -- BaseDocument, poll cycle
- `packages/blitz-dom/src/stylo.rs` -- Stylo CSS resolution
- `packages/blitz-dom/src/layout/mod.rs` -- Taffy layout integration
- `packages/blitz-dom/src/layout/construct.rs` -- Layout tree construction
- `packages/blitz-dom/src/mutator.rs` -- DOM mutation API
- `packages/stylo_taffy/src/convert.rs` -- ComputedValues to taffy::Style
- `packages/stylo_taffy/src/lib.rs` -- TaffyStyloStyle wrapper

## Integration with Dioxus

`dioxus-native-dom` wraps BaseDocument and implements Dioxus's `WriteMutations` trait:

```
Dioxus VirtualDom
    |
    v
DioxusDocument (wraps BaseDocument)
    |
mutation_writer translates VirtualDom patches:
    createElement -> doc.create_node()
    setAttribute  -> doc.set_attribute()
    appendChild   -> doc.append_child()
    etc.
    |
    v
marks affected nodes dirty
    |
    v
next poll() re-resolves style + layout
```

This is a hard dependency (not feature-gated). Dioxus native rendering always goes through Blitz.
