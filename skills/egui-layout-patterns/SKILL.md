---
name: egui-layout-patterns
description: Common egui layout recipes mapped from CSS/web mental models -- centering, spacing, grow/shrink, grid forms, sticky headers, responsive breakpoints, card layouts, toolbar patterns
license: MIT
compatibility: opencode
metadata:
  depth: intermediate
---

## What this covers

CSS-to-egui layout translation for common UI scenarios. Three tiers: built-in egui, egui_flex, egui_taffy.

Trigger on: egui layout, egui center, egui flex, egui grid, egui spacing, egui responsive, egui align, egui card, egui toolbar, egui sidebar, how to layout egui.

## Center content (CSS: `display:flex; justify-content:center; align-items:center`)

```rust
// Built-in: center horizontally
ui.vertical_centered(|ui| {
    ui.label("Centered horizontally");
});

// Built-in: center both axes in available space
ui.centered_and_justified(|ui| {
    ui.label("Dead center");
});

// Manual: center a fixed-size widget in remaining space
let available = ui.available_size();
ui.allocate_ui_at_rect(
    Rect::from_center_size(ui.max_rect().center(), Vec2::new(300.0, 200.0)),
    |ui| {
        ui.label("Centered box");
    },
);

// egui_flex
Flex::horizontal()
    .justify(FlexJustify::Center)
    .align_items(FlexAlign::Center)
    .show(ui, |flex| {
        flex.add_simple(|ui| { ui.label("Centered"); });
    });
```

## Space between items (CSS: `justify-content: space-between`)

```rust
// Built-in: left and right ends of a row
ui.horizontal(|ui| {
    ui.label("Left");
    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
        ui.label("Right");
    });
});

// egui_flex
Flex::horizontal()
    .justify(FlexJustify::SpaceBetween)
    .show(ui, |flex| {
        flex.add_simple(|ui| { ui.label("Left"); });
        flex.add_simple(|ui| { ui.label("Right"); });
    });
```

## Grow to fill (CSS: `flex: 1`)

```rust
// egui_flex
Flex::horizontal().show(ui, |flex| {
    flex.add(FlexItem::new().grow(1.0), |ui| {
        ui.text_edit_singleline(&mut self.search);  // stretches
    });
    flex.add_simple(|ui| {
        ui.button("Search");  // natural width
    });
});

// Built-in approximation: use available_width
ui.horizontal(|ui| {
    let button_width = 60.0;
    let input_width = ui.available_width() - button_width - ui.spacing().item_spacing.x;
    ui.add(TextEdit::singleline(&mut self.search).desired_width(input_width));
    ui.button("Search");
});
```

## Fixed sidebar + fluid main (CSS: `grid-template-columns: 250px 1fr`)

```rust
// Built-in: panels (the idiomatic egui way)
SidePanel::left("sidebar")
    .resizable(true)
    .default_width(250.0)
    .show(ctx, |ui| {
        ui.label("Sidebar content");
    });
CentralPanel::default().show(ctx, |ui| {
    ui.label("Main content fills remaining space");
});

// egui_taffy: explicit grid
TaffyPass::new().show(ui, |tui| {
    tui.style(Style {
        display: Display::Grid,
        grid_template_columns: vec![px(250.0), fr(1.0)],
        size: Size { width: percent(1.0), height: percent(1.0) },
        ..Default::default()
    }).add(|tui| {
        tui.style(Style::default()).ui(|ui| { ui.label("Sidebar"); });
        tui.style(Style::default()).ui(|ui| { ui.label("Main"); });
    });
});
```

## Form layout (CSS: `display:grid; grid-template-columns: auto 1fr`)

```rust
// Built-in: Grid (the best option for label:input pairs)
egui::Grid::new("form")
    .num_columns(2)
    .spacing([12.0, 8.0])
    .show(ui, |ui| {
        ui.label("Name");
        ui.text_edit_singleline(&mut self.name);
        ui.end_row();

        ui.label("Email");
        ui.text_edit_singleline(&mut self.email);
        ui.end_row();

        ui.label("Role");
        egui::ComboBox::from_id_salt("role")
            .selected_text(&self.role)
            .show_ui(ui, |ui| {
                ui.selectable_value(&mut self.role, "Admin".into(), "Admin");
                ui.selectable_value(&mut self.role, "User".into(), "User");
            });
        ui.end_row();
    });
```

## Card / bordered box (CSS: `border: 1px solid; border-radius: 8px; padding: 16px`)

```rust
egui::Frame::none()
    .inner_margin(16.0)
    .rounding(8.0)
    .stroke(ui.visuals().widgets.noninteractive.bg_stroke)
    .fill(ui.visuals().window_fill)
    .show(ui, |ui| {
        ui.heading("Card Title");
        ui.separator();
        ui.label("Card body content");
    });
```

## Card grid / wrapping tiles (CSS: `display:flex; flex-wrap:wrap; gap:8px`)

```rust
// egui_flex
Flex::horizontal()
    .wrap(true)
    .gap(Size { width: px(8.0), height: px(8.0) })
    .show(ui, |flex| {
        for item in &self.items {
            flex.add(FlexItem::new().basis(200.0), |ui| {
                egui::Frame::none()
                    .inner_margin(12.0)
                    .rounding(6.0)
                    .fill(ui.visuals().faint_bg_color)
                    .show(ui, |ui| {
                        ui.label(&item.title);
                        ui.label(&item.description);
                    });
            });
        }
    });

// egui_taffy: CSS grid auto-fill
TaffyPass::new().show(ui, |tui| {
    tui.style(Style {
        display: Display::Grid,
        grid_template_columns: vec![fr(1.0), fr(1.0), fr(1.0)],
        gap: Size { width: px(8.0), height: px(8.0) },
        ..Default::default()
    }).add(|tui| {
        for item in &self.items {
            tui.style(Style::default()).ui(|ui| {
                ui.label(&item.title);
            });
        }
    });
});
```

## Toolbar row (CSS: `display:flex; align-items:center; gap:4px; padding:4px`)

```rust
TopBottomPanel::top("toolbar").show(ctx, |ui| {
    ui.horizontal(|ui| {
        ui.spacing_mut().item_spacing.x = 4.0;

        if ui.button("New").clicked() { /* */ }
        if ui.button("Open").clicked() { /* */ }
        if ui.button("Save").clicked() { /* */ }

        ui.separator();

        // Push remaining items to right
        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            ui.label("Status: OK");
            if ui.button("Settings").clicked() { /* */ }
        });
    });
});
```

## Vertical stack with gap (CSS: `display:flex; flex-direction:column; gap:8px`)

```rust
// Built-in: adjust spacing
ui.spacing_mut().item_spacing.y = 8.0;
ui.label("First");
ui.label("Second");
ui.label("Third");

// Or scope it
ui.scope(|ui| {
    ui.spacing_mut().item_spacing.y = 12.0;
    ui.label("Spaced");
    ui.label("Items");
});
```

## Scroll container with max height (CSS: `max-height:300px; overflow-y:auto`)

```rust
ScrollArea::vertical()
    .max_height(300.0)
    .show(ui, |ui| {
        for i in 0..100 {
            ui.label(format!("Row {i}"));
        }
    });

// Both axes
ScrollArea::both()
    .max_height(400.0)
    .max_width(600.0)
    .show(ui, |ui| {
        // wide + tall content
    });
```

## Sticky header + scrollable body (CSS: `position:sticky; top:0`)

```rust
// The panel approach (idiomatic)
TopBottomPanel::top("header").show(ctx, |ui| {
    ui.heading("Always visible header");
});
CentralPanel::default().show(ctx, |ui| {
    ScrollArea::vertical().show(ui, |ui| {
        // scrollable content
    });
});

// Inside a single area
ui.heading("Sticky header");
ui.separator();
ScrollArea::vertical()
    .max_height(ui.available_height())
    .show(ui, |ui| {
        for i in 0..200 {
            ui.label(format!("Item {i}"));
        }
    });
```

## Absolute positioning (CSS: `position:absolute; top:10px; right:10px`)

```rust
// Paint at absolute position within current area
let rect = ui.max_rect();
let badge_pos = rect.right_top() + Vec2::new(-40.0, 8.0);
ui.put(
    Rect::from_min_size(badge_pos, Vec2::new(32.0, 20.0)),
    Label::new(RichText::new("3").color(Color32::WHITE)),
);

// Or use Area for floating elements
Area::new(Id::new("floating_badge"))
    .fixed_pos(pos2(500.0, 10.0))
    .show(ctx, |ui| {
        ui.label("Floating");
    });
```

## Responsive: different layout at different widths

```rust
let width = ui.available_width();

if width > 800.0 {
    // Wide: side by side
    ui.horizontal(|ui| {
        ui.allocate_ui(Vec2::new(width * 0.5, 0.0), |ui| {
            self.left_panel(ui);
        });
        self.right_panel(ui);
    });
} else {
    // Narrow: stacked
    self.left_panel(ui);
    ui.add_space(12.0);
    self.right_panel(ui);
}
```

## Spacer / push-apart (CSS: `flex: 1` empty div)

```rust
ui.horizontal(|ui| {
    ui.label("Left");

    // Spacer: consume remaining width
    let remaining = ui.available_width() - 60.0; // minus right content width
    ui.add_space(remaining);

    ui.label("Right");
});

// Or use right-to-left layout switch (cleaner)
ui.horizontal(|ui| {
    ui.label("Left");
    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
        ui.label("Right");
    });
});
```

## Indent / nested (CSS: `margin-left: 16px`)

```rust
ui.indent("section_id", |ui| {
    ui.label("Indented content");
    ui.indent("nested", |ui| {
        ui.label("Double indented");
    });
});

// Or explicit
ui.add_space(16.0); // only works horizontally inside horizontal()

// Or with Frame
egui::Frame::none()
    .inner_margin(Margin { left: 16, ..Default::default() })
    .show(ui, |ui| {
        ui.label("Left-padded content");
    });
```

## Collapsible section (CSS: `<details><summary>`)

```rust
ui.collapsing("Advanced Settings", |ui| {
    ui.checkbox(&mut self.debug, "Debug mode");
    ui.checkbox(&mut self.verbose, "Verbose logging");
});

// With default open
CollapsingHeader::new("Open by default")
    .default_open(true)
    .show(ui, |ui| {
        ui.label("Content");
    });
```

## Interaction on already-allocated rects

`ui.interact(rect, id, sense)` conflicts with any child widget that already allocated that rect (plots, frames, scroll areas). The child claims the rect's interaction slot first; the secondary `interact` call produces unreliable or silently ignored results.

Prefer accessing the `Response` returned directly by the child widget:

```rust
// Wrong: conflicts with Plot's own allocation
let resp = ui.interact(plot_rect, some_id, Sense::click());

// Correct: use the response the plot already returns
let plot_resp = Plot::new("chart").show(ui, |pui| { ... });
if plot_resp.response.clicked() { ... }
```

Same applies to `Frame::show`, `ScrollArea::show`, and any widget that returns its own `Response`.

## Tabs (CSS: tab bar + conditional content)

```rust
ui.horizontal(|ui| {
    for (i, tab) in ["General", "Advanced", "About"].iter().enumerate() {
        if ui.selectable_label(self.active_tab == i, *tab).clicked() {
            self.active_tab = i;
        }
    }
});
ui.separator();

match self.active_tab {
    0 => { ui.label("General settings"); }
    1 => { ui.label("Advanced settings"); }
    2 => { ui.label("About info"); }
    _ => {}
}
```
