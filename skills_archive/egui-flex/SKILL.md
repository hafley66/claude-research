---
name: egui-flex
description: Flexbox layout for egui -- Flex containers, FlexItem grow/shrink/basis, justify/align, wrapping, nesting. Part of hello_egui. Trigger on egui flexbox, egui layout, egui_flex, flex layout egui.
license: MIT
metadata:
  audience: developers
  workflow: ui-rendering
---

## What this covers

`egui_flex` from the hello_egui workspace. Flexbox layout inside egui without external layout engines. Implements its own layout algorithm using direct measurement and positioning.

## Crate

```toml
egui_flex = "0.3"  # check crates.io for latest
```

Does NOT use Taffy. Pure egui layout code.

## Container API

```rust
use egui_flex::{Flex, FlexItem, item};

// Horizontal flex (default)
Flex::horizontal().show(ui, |flex| {
    flex.add(item(), Label::new("A"));
    flex.add(item(), Label::new("B"));
});

// Vertical flex
Flex::vertical().show(ui, |flex| {
    flex.add(item(), Label::new("Top"));
    flex.add(item(), Label::new("Bottom"));
});
```

## Builder methods on Flex

```rust
Flex::horizontal()
    .justify(FlexJustify::SpaceBetween)  // main axis: Start|End|Center|SpaceBetween|SpaceAround|SpaceEvenly
    .align_items(FlexAlign::Center)       // cross axis: Start|End|Center|Stretch
    .align_content(FlexAlignContent::Stretch) // multi-line cross axis
    .gap(Vec2::new(8.0, 4.0))           // spacing between items
    .wrap(true)                           // line wrapping
    .w_full()                             // 100% width
    .h_full()                             // 100% height
    .width(Size::Points(300.0))           // fixed width
    .height(Size::Percent(0.5))           // 50% height
    .show(ui, |flex| { /* ... */ });
```

## FlexItem configuration

```rust
flex.add(
    FlexItem::new()
        .grow(1.0)                    // flex-grow
        .basis(100.0)                 // flex-basis (default size)
        .align_self(FlexAlign::End)   // override cross-axis alignment
        .frame(Frame::dark_canvas(ui.style()))  // egui Frame styling
        .min_width(50.0)              // minimum size
        .min_height(20.0),
    Label::new("content"),
);

// Shorthand
flex.add(item().grow(1.0), Label::new("stretchy"));
```

## Adding content

```rust
// Standard egui widgets (Button, Label, TextEdit, Checkbox, etc.)
flex.add(item(), Button::new("Click"));
flex.add(item(), Label::new("Text"));

// Any Widget trait implementor
flex.add_widget(item(), my_custom_widget);

// Custom UI closure
flex.add_ui(item().grow(1.0), |ui| {
    ui.label("Custom content");
    ui.button("Inside closure");
});

// Spacer (empty grow)
flex.grow();

// Nested flex
flex.add_flex(item().grow(1.0), Flex::vertical(), |inner| {
    inner.add(item(), Label::new("Nested"));
});
```

## Supported widgets

All standard egui widgets implement `FlexWidget`:
Button, Label, Checkbox, Image, DragValue, Hyperlink, ImageButton, ProgressBar, RadioButton, Link, Slider, TextEdit, Spinner.

## Common patterns

**Toolbar:**
```rust
Flex::horizontal().w_full().show(ui, |flex| {
    flex.add(item(), Button::new("File"));
    flex.add(item(), Button::new("Edit"));
    flex.grow();  // push right-side items to the end
    flex.add(item(), Button::new("Settings"));
});
```

**Card layout with wrap:**
```rust
Flex::horizontal().wrap(true).gap(vec2(8.0, 8.0)).show(ui, |flex| {
    for card in &cards {
        flex.add_ui(item().basis(200.0), |ui| {
            ui.label(&card.title);
        });
    }
});
```

**Centered content:**
```rust
Flex::horizontal()
    .justify(FlexJustify::Center)
    .align_items(FlexAlign::Center)
    .w_full()
    .h_full()
    .show(ui, |flex| {
        flex.add(item(), Label::new("Centered"));
    });
```

## Key files

- Source: `hello_egui/crates/egui_flex/src/`
- Examples: `hello_egui/crates/egui_flex/examples/`
