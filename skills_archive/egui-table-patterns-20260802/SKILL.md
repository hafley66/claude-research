---
name: egui-table-patterns
description: Userland patterns for egui_table -- row selection, expand/collapse, pagination, action buttons, row hover, alternating colors, cell margins, text truncation, sticky header text
license: MIT
compatibility: opencode
metadata:
  source: https://github.com/rerun-io/egui_table
  depth: intermediate
---

## What this covers

Patterns for building features that egui_table doesn't ship out of the box: selection, expand/collapse, pagination, action buttons, sorting, and visual polish. All implemented via the `TableDelegate` trait callbacks.

Trigger on: egui table selection, egui table expand, egui table pagination, egui table action buttons, egui table row click, egui table patterns.

Depends on: egui-table-core skill for API reference.

## Row selection

```rust
struct MyTable {
    data: Vec<Row>,
    selected: HashSet<u64>,
    last_selected: Option<u64>,
}

impl TableDelegate for MyTable {
    fn cell_ui(&mut self, ui: &mut Ui, cell: &CellInfo) {
        if cell.col_nr == 0 {
            // Checkbox column
            let mut checked = self.selected.contains(&cell.row_nr);
            if ui.checkbox(&mut checked, "").changed() {
                if ui.input(|i| i.modifiers.shift) {
                    // Shift-click range select
                    if let Some(anchor) = self.last_selected {
                        let range = anchor.min(cell.row_nr)..=anchor.max(cell.row_nr);
                        for r in range {
                            self.selected.insert(r);
                        }
                    }
                } else if checked {
                    self.selected.insert(cell.row_nr);
                } else {
                    self.selected.remove(&cell.row_nr);
                }
                self.last_selected = Some(cell.row_nr);
            }
        }
        // ... other columns
    }

    fn row_ui(&mut self, ui: &mut Ui, row_nr: u64) {
        // Highlight selected rows
        if self.selected.contains(&row_nr) {
            ui.painter().rect_filled(
                ui.max_rect(), 0.0,
                ui.visuals().selection.bg_fill,
            );
        }
    }
}
```

## Expand/collapse rows

Key insight: override `row_top_offset` to account for expanded row heights. The table uses this for virtual scroll positioning.

```rust
struct MyTable {
    data: Vec<Row>,
    expanded: BTreeMap<u64, bool>,  // BTreeMap for range queries in row_top_offset
    row_height: f32,
    expanded_extra_height: f32,     // Additional height when expanded (e.g. 48.0)
}

impl TableDelegate for MyTable {
    fn cell_ui(&mut self, ui: &mut Ui, cell: &CellInfo) {
        if cell.col_nr == 0 {
            let is_expanded = self.expanded.get(&cell.row_nr).copied().unwrap_or(false);
            let expandedness = ui.ctx().animate_bool(Id::new(cell.row_nr), is_expanded);

            // Draw collapse icon
            let (_, response) = ui.allocate_exact_size(Vec2::splat(10.0), Sense::click());
            egui::collapsing_header::paint_default_icon(ui, expandedness, &response);
            if response.clicked() {
                self.expanded.insert(cell.row_nr, !is_expanded);
            }

            // Show expanded content (animated)
            if expandedness > 0.0 {
                ui.label("Detail row content here");
            }
        }
    }

    fn row_top_offset(&self, ctx: &Context, _table_id: Id, row_nr: u64) -> f32 {
        // Sum up extra height from all expanded rows above this one
        let extra: f32 = self.expanded
            .range(0..row_nr)
            .map(|(r, expanded)| {
                let t = ctx.animate_bool(Id::new(r), *expanded);
                t * self.expanded_extra_height
            })
            .sum();
        row_nr as f32 * self.row_height + extra
    }

    fn default_row_height(&self) -> f32 { self.row_height }
}
```

## Pagination

Pagination is purely data-side. Slice your data, adjust `num_rows`.

```rust
struct MyTable {
    all_data: Vec<Row>,
    page: usize,
    page_size: usize,
}

impl MyTable {
    fn page_data(&self) -> &[Row] {
        let start = self.page * self.page_size;
        let end = (start + self.page_size).min(self.all_data.len());
        &self.all_data[start..end]
    }

    fn total_pages(&self) -> usize {
        (self.all_data.len() + self.page_size - 1) / self.page_size
    }

    fn show(&mut self, ui: &mut Ui) {
        // Table with current page rows only
        Table::new()
            .num_rows(self.page_data().len() as u64)
            .columns(self.columns.clone())
            .headers([HeaderRow::new(24.0)])
            .show(ui, self);

        // Pagination controls below table
        ui.horizontal(|ui| {
            if ui.button("<").clicked() && self.page > 0 {
                self.page -= 1;
            }
            ui.label(format!("Page {} / {}", self.page + 1, self.total_pages()));
            if ui.button(">").clicked() && self.page + 1 < self.total_pages() {
                self.page += 1;
            }
        });
    }
}
```

## Action buttons in cells

Render buttons in the last column (or any column). Route by row.

```rust
fn cell_ui(&mut self, ui: &mut Ui, cell: &CellInfo) {
    match cell.col_nr {
        // ... data columns ...
        ACTIONS_COL => {
            ui.horizontal(|ui| {
                if ui.small_button("Edit").clicked() {
                    self.action = Some(Action::Edit(cell.row_nr));
                }
                if ui.small_button("Delete").clicked() {
                    self.action = Some(Action::Delete(cell.row_nr));
                }
            });
        }
        _ => {}
    }
}
```

Process `self.action` after `table.show()` returns, not inside `cell_ui` (avoid mutating data mid-render).

## Row hover highlight

```rust
fn row_ui(&mut self, ui: &mut Ui, _row_nr: u64) {
    if ui.rect_contains_pointer(ui.max_rect()) {
        ui.painter().rect_filled(
            ui.max_rect(), 0.0,
            ui.visuals().code_bg_color,
        );
    }
}
```

## Alternating row colors

```rust
fn cell_ui(&mut self, ui: &mut Ui, cell: &CellInfo) {
    if cell.row_nr % 2 == 1 {
        ui.painter().rect_filled(
            ui.max_rect(), 0.0,
            ui.visuals().faint_bg_color,
        );
    }
    // ... cell content
}
```

## Cell margins

The table provides zero margin by default. Wrap cell content in a Frame:

```rust
fn cell_ui(&mut self, ui: &mut Ui, cell: &CellInfo) {
    egui::Frame::NONE
        .inner_margin(Margin::symmetric(4, 0))
        .show(ui, |ui| {
            ui.label("Content with padding");
        });
}
```

## Text truncation

Cells default to `TextWrapMode::Extend`. For truncation:

```rust
fn cell_ui(&mut self, ui: &mut Ui, cell: &CellInfo) {
    if !ui.is_sizing_pass() {
        ui.style_mut().wrap_mode = Some(egui::TextWrapMode::Truncate);
    }
    ui.label("Long text that gets truncated when column is narrow...");
}
```

Guard with `is_sizing_pass()` so auto-sizing can still measure full text width.

## Sticky header text (stays visible while scrolling)

For grouped headers that span wide column ranges, anchor text to the visible clip rect:

```rust
fn header_cell_ui(&mut self, ui: &mut Ui, cell: &HeaderCellInfo) {
    let text = format!("Group {}", cell.group_index);
    let margin = 4.0;
    let galley = ui.painter().layout(text, FontId::default(), Color32::WHITE, f32::INFINITY);
    let mut pos = Align2::LEFT_CENTER
        .anchor_size(ui.clip_rect().shrink(margin).left_center(), galley.size())
        .min;
    pos.x = pos.x.at_most(ui.max_rect().right() - galley.size().x);
    ui.put(Rect::from_min_size(pos, galley.size()), Label::new(galley));
}
```

## Sorting

Sort your backing data, track sort state, re-render. Column headers detect clicks:

```rust
struct SortState {
    col: usize,
    ascending: bool,
}

fn header_cell_ui(&mut self, ui: &mut Ui, cell: &HeaderCellInfo) {
    let response = ui.horizontal(|ui| {
        ui.label(self.column_names[cell.col_range.start]);
        if self.sort.col == cell.col_range.start {
            ui.label(if self.sort.ascending { "^" } else { "v" });
        }
    }).response;

    if response.clicked() {
        if self.sort.col == cell.col_range.start {
            self.sort.ascending = !self.sort.ascending;
        } else {
            self.sort = SortState { col: cell.col_range.start, ascending: true };
        }
        self.sort_data();
    }
}
```

## Scroll-to navigation

```rust
// Scroll to a specific row after search
if let Some(found_row) = search_result {
    table = table.scroll_to_row(found_row, Some(Align::Center));
}

// Scroll to a specific column
table = table.scroll_to_column(col_idx, None);  // None = minimal scroll
```

## State reset

```rust
let state_id = Table::new().id_salt("my_table").get_id(ui);
TableState::reset(ui.ctx(), state_id);  // Clears persisted column widths
```
