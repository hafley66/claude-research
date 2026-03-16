---
name: egui-app-dev
description: Compound skill for egui application development. Loads ecosystem map, advanced patterns (animation, wgpu, architecture), overlay windows, layout crates. Trigger on egui app, egui development, build egui app, egui project, egui help.
license: MIT
metadata:
  audience: developers
  workflow: egui-development
---

## egui Application Development Reference

This skill indexes the full egui skill family. Load this one to get the complete picture.

### Skill index

| Skill | What it covers | When to load |
|---|---|---|
| **egui-ecosystem** | Crate map: layout, visualization, text, dialogs, theming, animation, overlay, infrastructure crates with GitHub links | Choosing crates, finding what exists |
| **egui-advanced-patterns** | Animation API (built-in + manual + spring), PaintCallback for custom wgpu, Scene zoom/pan, LOD, FrameCache, Rerun architecture patterns | Building anything beyond basic widgets |
| **egui-overlay-windows** | Transparent click-through overlays, custom shape painting (bezier, circles, lines), fan-out curves, CompositeAlphaMode, retina, GLFW vs winit vs raw NSWindow | Overlay/HUD apps |
| **egui-flex** | Flexbox layout: Flex containers, FlexItem grow/shrink/basis, wrapping | Complex layouts |
| **egui-dock** | Docking/tab panels: DockState, TabViewer trait, drag-and-drop | IDE-style panel layouts |
| **egui-dnd** | Drag-and-drop for lists: reorderable items, swap animations | Reorderable lists |

### Quick reference: egui core concepts

**Immediate mode**: UI is a function of state, rebuilt every frame. No retained widget tree. State lives in your app struct, not in the UI.

**Coordinate system**: Logical points (DPI-independent). `pixels_per_point` = 2.0 on retina. All Painter/Shape coordinates are in logical points.

**Frame lifecycle**:
1. `App::update(ctx, frame)` called each frame
2. Build UI via `CentralPanel`, `SidePanel`, `Window`, etc.
3. egui tessellates shapes into triangles
4. Backend renders triangles via wgpu/glow

**Key types**:
- `egui::Context` -- frame state, animation, memory, input
- `egui::Ui` -- layout cursor, allocates space, creates widgets
- `egui::Painter` -- draws shapes (circle, rect, line, bezier, text)
- `egui::Response` -- widget interaction result (clicked, hovered, dragged)
- `egui::Shape` -- renderable primitive (14 variants including CubicBezier)
- `egui::Id` -- unique widget identity for animation and state storage

**State storage**:
- `ctx.data_mut(|d| d.insert_temp(id, value))` -- per-frame temp
- `ctx.data_mut(|d| d.insert_persisted(id, value))` -- across frames, serializable
- `ctx.memory_mut(|m| m.caches.cache::<MyCache>().get(key))` -- FrameCache

**Input access**:
```rust
ctx.input(|i| {
    i.time          // wall clock seconds (f64)
    i.stable_dt     // smoothed frame delta (f32)
    i.pointer       // mouse position, buttons, drag
    i.key_pressed(Key::Escape)
    i.modifiers     // ctrl, shift, alt, cmd
});
```

**Custom painting without widgets**:
```rust
let painter = ctx.layer_painter(egui::LayerId::background());
painter.set_clip_rect(ctx.screen_rect());
painter.circle_filled(pos, radius, color);
painter.add(Shape::CubicBezier(bezier));
```

### Backends

| Backend | Crate | Platform |
|---|---|---|
| eframe (recommended) | `eframe` | Desktop (winit+wgpu) + Web (wasm) |
| egui_overlay | `egui_overlay` | Desktop overlay (GLFW+wgpu/three-d) |
| Raw winit+wgpu | `egui-wgpu` + `egui-winit` | Maximum control |
| Raw glow | `egui_glow` | OpenGL contexts |

### Starting a new egui project

```toml
[dependencies]
eframe = "0.31"  # includes egui + winit + wgpu
```

```rust
fn main() -> eframe::Result {
    eframe::run_native("My App", eframe::NativeOptions::default(),
        Box::new(|_cc| Ok(Box::new(MyApp::default()))))
}

struct MyApp { /* state */ }

impl eframe::App for MyApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.heading("Hello");
        });
    }
}
```

### For overlay apps specifically

```toml
[dependencies]
egui_overlay = "0.9"
```

See `egui-overlay-windows` skill for the full setup including:
- Inlining `start()` for PostMultiplied alpha on macOS
- `layer_painter` for transparent drawing without widget backgrounds
- `set_clip_rect` to prevent egui clipping
- `set_passthrough(true)` for click-through
- Retina `max_texture_dimension_2d = 8192` fix
- CubicBezierShape for curves between points
- Fan-out algorithm for parallel curves
