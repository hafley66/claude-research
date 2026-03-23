---
name: egui-table-core
description: egui_table (rerun-io) API -- Table builder, Column sizing, TableDelegate trait, SplitScroll 4-quadrant layout, virtual scrolling, sticky columns, grouped headers, rendering flow
license: MIT
compatibility: opencode
metadata:
  source: https://github.com/rerun-io/egui_table
  crate: egui_table 0.7.0
  egui: 0.33.x
  depth: intermediate
---

## What this covers

The `egui_table` crate by rerun-io. A delegate-pattern virtual-scrolling table for egui with sticky columns, grouped headers, column resize, and auto-sizing. ~900 lines of code, 4 source files.

Trigger on: egui table, egui_table, egui datagrid, egui virtual table, egui columns, rerun table widget.

## Architecture

4 source files, 3 modules:

- `columns.rs` -- `Column` struct, constrained auto-sizing algorithm
- `split_scroll.rs` -- `SplitScroll` + `SplitScrollDelegate`, the 4-quadrant scroll primitive
- `table.rs` -- `Table`, `TableDelegate`, `TableState`, cell/header info types, rendering

Table sits on SplitScroll. SplitScroll creates 4 quadrants: fixed top-left, h-scroll top-right, v-scroll bottom-left, full-scroll bottom-right. One real `egui::ScrollArea` gets painted over with fake scroll regions.

### Rendering flow

1. `Table::show()` loads/creates state, sizes columns
2. `SplitScroll::show()` called with internal delegate
3. `right_bottom_ui` runs FIRST (the real ScrollArea):
   - Computes visible column + row ranges from viewport
   - Calls `TableDelegate::prepare()` with `PrefetchInfo`
   - Iterates visible rows, calls `row_ui()` per row
   - Iterates visible columns within each row, calls `cell_ui()` per cell
4. `left_top_ui` renders sticky header cells for sticky columns
5. `right_top_ui` renders header cells for scrollable columns
6. `left_bottom_ui` renders body cells for sticky columns
7. `finish()` paints column resize handles

## Dependencies

```toml
[dependencies]
egui_table = "0.7"  # requires egui 0.33.x
```

## Column

```rust
pub struct Column {
    pub current: f32,              // Initial width. Default: 100.0
    pub range: Rangef,             // Allowed width range. Default: 4.0..=INFINITY
    pub id: Option<egui::Id>,     // Unique ID within table
    pub resizable: bool,           // User-resizable? Default: true
    pub auto_size_this_frame: bool,
}
```

Builder:
```rust
Column::new(200.0)
    .range(50.0..=400.0)
    .id(egui::Id::new("name_col"))
    .resizable(true)
```

Static `Column::auto_size(columns, target_width)` distributes width evenly across columns respecting their `range` constraints, saturating those that hit min/max first.

## AutoSizeMode

```rust
pub enum AutoSizeMode {
    Never,           // Default
    Always,          // Resize columns every frame
    OnParentResize,  // Resize only when parent width changes
}
```

## HeaderRow

```rust
pub struct HeaderRow {
    pub height: f32,
    pub groups: Vec<Range<usize>>,  // Column index ranges for grouping
}
```

Empty `groups` = one header cell per column. Populated = columns within a range merge under one header cell. Enables hierarchical/grouped headers.

```rust
// Two header rows: first grouped, second ungrouped
.headers([
    HeaderRow { height: 24.0, groups: vec![0..1, 1..4, 4..8] },
    HeaderRow::new(24.0),
])
```

## Table builder

```rust
Table::new()
    .id_salt("my_table")            // Required if multiple tables in same UI
    .num_rows(10_000)                // Total row count (virtual scrolling)
    .columns(vec![col; 20])          // Column definitions
    .num_sticky_cols(1)              // Non-scrolling left columns
    .headers([HeaderRow::new(24.0)]) // Header definitions
    .auto_size_mode(AutoSizeMode::OnParentResize)
    .stick_to_bottom(false)          // For log/terminal UIs
    .scroll_to_row(500, Some(Align::Center))     // Programmatic scroll
    .scroll_to_column(3, None)                    // None = minimal scroll
    .show(ui, &mut my_delegate)
```

`scroll_to_*` alignment: `None` = scroll just enough to bring into view. `Some(Align::TOP/Center/BOTTOM)` for explicit positioning.

## TableDelegate trait

```rust
trait TableDelegate {
    // Required
    fn header_cell_ui(&mut self, ui: &mut Ui, cell: &HeaderCellInfo);
    fn cell_ui(&mut self, ui: &mut Ui, cell: &CellInfo);

    // Optional
    fn prepare(&mut self, _info: &PrefetchInfo) {}       // Pre-fetch data for visible range
    fn row_ui(&mut self, _ui: &mut Ui, _row_nr: u64) {} // Full-row background/interaction
    fn default_row_height(&self) -> f32 { 20.0 }
    fn row_top_offset(&self, _ctx: &Context, _table_id: Id, row_nr: u64) -> f32 {
        row_nr as f32 * self.default_row_height()
    }
}
```

### Info structs

```rust
pub struct CellInfo {
    pub col_nr: usize,
    pub row_nr: u64,
    pub table_id: Id,
}

pub struct HeaderCellInfo {
    pub group_index: usize,
    pub col_range: Range<usize>,
    pub row_nr: usize,            // Header row index
    pub table_id: Id,
}

pub struct PrefetchInfo {
    pub num_sticky_columns: usize,
    pub visible_columns: Range<usize>,
    pub visible_rows: Range<u64>,
    pub table_id: Id,
}
```

## TableState persistence

```rust
let state_id = Table::new().id_salt("my_table").get_id(ui);

// Load
let state = TableState::load(ui.ctx(), state_id);

// Reset (clear persisted column widths)
TableState::reset(ui.ctx(), state_id);
```

Column widths auto-persist to egui's `Memory` via `IdMap<f32>`.

## SplitScroll (lower-level primitive)

Available for custom layouts beyond Table. Creates 4-quadrant layout with independent scroll regions:

```rust
SplitScroll {
    scroll_enabled: Vec2b::new(true, true),
    fixed_size: Vec2::new(sticky_width, header_height),
    scroll_outer_size: Vec2::new(viewport_w, viewport_h),
    scroll_content_size: Vec2::new(total_content_w, total_content_h),
    stick_to_bottom: false,
}.show(ui, &mut my_split_delegate);
```

```rust
trait SplitScrollDelegate {
    fn left_top_ui(&mut self, ui: &mut Ui);     // Fixed corner
    fn right_top_ui(&mut self, ui: &mut Ui);    // H-scrollable header
    fn left_bottom_ui(&mut self, ui: &mut Ui);  // V-scrollable gutter
    fn right_bottom_ui(&mut self, ui: &mut Ui); // Full-scroll body (called FIRST)
    fn finish(&mut self, _ui: &mut Ui) {}
}
```

## What the crate does NOT provide

All of these are userland (see egui-table-patterns skill):

- Row selection (single/multi)
- Expand/collapse rows
- Pagination
- Sorting
- Filtering
- Cell editing
- Cell margins (use `egui::Frame`)
- Row grid lines
- Column reordering
- Text wrapping (default is `TextWrapMode::Extend`)
