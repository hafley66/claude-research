---
name: taffy-layout
description: Taffy CSS layout engine -- flexbox, grid, block, float layout algorithms, TaffyTree API, trait-based custom trees, Style type, layout computation. Trigger on taffy, css layout rust, flexbox rust, grid layout rust, layout engine.
license: MIT
metadata:
  audience: developers
  workflow: ui-rendering
---

## What this covers

Taffy: a standalone CSS layout engine in Rust. Implements Flexbox, CSS Grid, Block, and Float layout. Owned by DioxusLabs. Used as the layout backend in Blitz.

## Version

```toml
[dependencies]
taffy = "0.9"    # latest stable, pre-1.0
```

Blitz pins to a git rev rather than crates.io release, suggesting the API is still shifting at the edges.

## Two API tiers

### High-level: TaffyTree

Manages its own node tree internally. Simpler for standalone usage.

```rust
use taffy::prelude::*;

let mut tree = TaffyTree::new();

// Create nodes with styles
let child_a = tree.new_leaf(Style {
    size: Size { width: length(100.0), height: length(50.0) },
    ..Default::default()
}).unwrap();

let child_b = tree.new_leaf(Style {
    size: Size { width: percent(0.5), height: auto() },
    flex_grow: 1.0,
    ..Default::default()
}).unwrap();

let root = tree.new_with_children(
    Style {
        display: Display::Flex,
        flex_direction: FlexDirection::Row,
        size: Size { width: length(500.0), height: length(300.0) },
        gap: Size { width: length(10.0), height: zero() },
        ..Default::default()
    },
    &[child_a, child_b],
).unwrap();

// Compute layout
tree.compute_layout(root, Size::MAX_CONTENT).unwrap();

// Read results
let layout = tree.layout(child_a).unwrap();
// layout.location.x, layout.location.y
// layout.size.width, layout.size.height
```

### Low-level: Trait-based

For embedding in UI frameworks that manage their own tree. Implement `LayoutPartialTree`:

```rust
compute_flexbox_layout(tree, node, inputs)
compute_grid_layout(tree, node, inputs)
compute_block_layout(tree, node, inputs)
compute_root_layout(tree, root, available_space)
round_layout(tree)  // snap to pixel boundaries
```

Blitz uses this approach -- BaseDocument implements the tree traits directly.

## Key types

| Type | Purpose |
|------|---------|
| `TaffyTree` | High-level node tree + layout engine |
| `NodeId` | Opaque handle to a node (slotmap-backed) |
| `Style` | CSS style properties (input to layout) |
| `Layout` | Computed result: location (x,y) + size (w,h) + margins + padding + border |
| `LayoutInput` | Constraints: sizing mode, available space, known dimensions |
| `LayoutOutput` | Raw algorithm output: size, baselines, collapsible margins |
| `Size<T>` | Generic 2D dimensions |
| `Rect<T>` | Margins, padding, borders |
| `Point<T>` | 2D position |
| `AvailableSpace` | Constraint: Definite(f32), MaxContent, MinContent |

## Style properties (subset)

```rust
Style {
    display: Display,           // Flex, Grid, Block, None
    position: Position,         // Relative, Absolute
    flex_direction: FlexDirection,
    flex_wrap: FlexWrap,
    flex_grow: f32,
    flex_shrink: f32,
    flex_basis: Dimension,
    justify_content: Option<JustifyContent>,
    align_items: Option<AlignItems>,
    align_self: Option<AlignSelf>,
    size: Size<Dimension>,
    min_size: Size<Dimension>,
    max_size: Size<Dimension>,
    margin: Rect<LengthPercentageAuto>,
    padding: Rect<LengthPercentage>,
    border: Rect<LengthPercentage>,
    gap: Size<LengthPercentage>,
    // Grid properties
    grid_template_columns: Vec<TrackSizingFunction>,
    grid_template_rows: Vec<TrackSizingFunction>,
    grid_column: Line<GridPlacement>,
    grid_row: Line<GridPlacement>,
    // ... many more
}
```

## Dimension helpers

```rust
length(100.0)     // 100px
percent(0.5)      // 50%
auto()            // auto
zero()            // 0
min_content()     // min-content
max_content()     // max-content
```

## Measure functions

For leaf nodes with intrinsic sizes (text, images):

```rust
tree.compute_layout_with_measure(
    root,
    Size::MAX_CONTENT,
    |known_dimensions, available_space, node_id, node_context, style| {
        // Return the measured size of this leaf
        Size { width: measured_w, height: measured_h }
    },
).unwrap();
```

Blitz uses this for text layout -- Parley measures text, Taffy positions the box.

## Layout algorithms

- **Flexbox**: Full CSS Flexbox spec. Most mature algorithm.
- **CSS Grid**: Track sizing, line-based placement, auto-placement, fr units.
- **Block**: Standard block flow with margins, floats.
- **Float**: CSS float layout (left/right/none).

## Stability

0.9.2, pre-1.0 but feature-complete for the layouts it supports. API surface is well-defined. The main instability is at the edges: new layout modes, edge cases in Grid, and the trait-based low-level API still evolving (which is why Blitz pins a git rev).
