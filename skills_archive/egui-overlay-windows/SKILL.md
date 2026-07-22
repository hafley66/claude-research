---
name: egui-overlay-windows
description: Creating transparent borderless always-on-top winit windows with egui rendering via the egui_overlay crate. Click-through, window positioning, GLFW+wgpu backend, custom shape painting (bezier curves, circles, lines). Trigger on egui overlay, transparent window, borderless window, floating overlay, egui_overlay crate, egui painting, egui shapes, egui bezier.
license: MIT
metadata:
  audience: developers
  workflow: tmux-overlay
---

## What this covers

Using `egui_overlay` to create transparent, borderless, always-on-top windows that render arbitrary egui content. This crate solves the hard platform-specific problems (transparency compositing, click-through, window level) that raw winit leaves as exercises.

## macOS transparency: the full stack

Three independent layers must all be configured. Missing any one produces an opaque window.

### Layer 1: NSWindow properties (most commonly missed)

winit's `.with_transparent(true)` sets a flag but does NOT configure the NSWindow. The macOS compositor checks `isOpaque` and `backgroundColor` on the NSWindow itself. Without these, the compositor treats the window as solid and skips compositing through it.

```rust
#[cfg(target_os = "macos")]
use raw_window_handle::{HasWindowHandle, RawWindowHandle};

// After creating the winit Window:
#[cfg(target_os = "macos")]
{
    if let Ok(handle) = window.window_handle() {
        if let RawWindowHandle::AppKit(appkit) = handle.as_raw() {
            unsafe {
                use objc2_app_kit::{NSColor, NSView};
                let ns_view: &NSView = appkit.ns_view.cast().as_ref();
                if let Some(ns_window) = ns_view.window() {
                    ns_window.setOpaque(false);
                    ns_window.setBackgroundColor(Some(&NSColor::clearColor()));
                    ns_window.setHasShadow(false);
                }
            }
        }
    }
}
```

**Deps**: `raw-window-handle = "0.6"` as explicit dep. `objc2-app-kit` with features `NSColor`, `NSView`, `NSWindow` -- winit already depends on this (v0.2.2), so no binary bloat.

**Access path**: winit `Window` -> `HasWindowHandle` -> `AppKitWindowHandle.ns_view` -> cast to `&NSView` -> `.window()` -> `NSWindow`.

### Layer 2: wgpu CompositeAlphaMode

The wgpu surface alpha mode controls how GPU-rendered pixels blend with windows behind:

```rust
let caps = surface.get_capabilities(&adapter);
let alpha_mode = if caps.alpha_modes.contains(&wgpu::CompositeAlphaMode::PreMultiplied) {
    wgpu::CompositeAlphaMode::PreMultiplied  // preferred on macOS Metal
} else if caps.alpha_modes.contains(&wgpu::CompositeAlphaMode::PostMultiplied) {
    wgpu::CompositeAlphaMode::PostMultiplied  // fallback, works with NSWindow fix
} else {
    caps.alpha_modes[0]
};
```

Clear the render pass to transparent:
```rust
ops: wgpu::Operations {
    load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
    store: wgpu::StoreOp::Store,
}
```

### Layer 3: egui panel background

egui's default dark theme paints an opaque background. Both `Frame::none()` (remove panel chrome) AND `.fill(TRANSPARENT)` are needed:

```rust
egui::CentralPanel::default()
    .frame(egui::Frame::none().fill(egui::Color32::TRANSPARENT))
    .show(ctx, |ui| { /* content */ });
```

Or set it globally via visuals:
```rust
let mut visuals = egui::Visuals::dark();
visuals.window_fill = egui::Color32::TRANSPARENT;
visuals.panel_fill = egui::Color32::TRANSPARENT;
ctx.set_visuals(visuals);
```

### egui_overlay crate shortcut

`egui_overlay::start()` sets wgpu surface alpha mode to `Auto`, which resolves to `Opaque` on macOS. To get actual transparency you must inline `start()` and set `PostMultiplied` manually, plus the NSWindow properties above.

## Crate

```toml
[dependencies]
egui_overlay = "0.9"  # check crates.io for latest
```

**Backend**: GLFW for windowing (not winit directly), wgpu on macOS, three-d/OpenGL on Linux.

Three-layer architecture:

| Layer | Crate | Role |
|---|---|---|
| Windowing | `egui_window_glfw_passthrough` | GLFW fork with per-window mouse passthrough (GLFW 3.4 unstable) |
| Rendering (macOS) | `egui_render_wgpu` | wgpu/Metal backend |
| Rendering (Linux/Win) | `egui_render_three_d` | OpenGL via three-d |
| Orchestration | `egui_overlay` | `EguiOverlay` trait, `start()` runs event loop |

## Basic overlay window

```rust
use egui_overlay::EguiOverlay;

struct MyOverlay {
    color: egui::Color32,
}

impl EguiOverlay for MyOverlay {
    fn gui_run(
        &mut self,
        egui_context: &egui::Context,
        _default_gfx_backend: &mut egui_overlay::egui_render_three_d::ThreeDBackend,
        glfw_backend: &mut egui_overlay::egui_window_glfw_passthrough::GlfwBackend,
    ) {
        // Transparent background
        egui::CentralPanel::default()
            .frame(egui::Frame::none().fill(self.color))
            .show(egui_context, |ui| {
                ui.label("overlay content");
            });
    }
}

fn main() {
    egui_overlay::start(MyOverlay {
        color: egui::Color32::from_black_alpha(180),
    });
}
```

## Window positioning and sizing

```rust
fn gui_run(&mut self, ctx: &egui::Context, _gfx: &mut ThreeDBackend, glfw: &mut GlfwBackend) {
    glfw.window.set_pos(self.target_x, self.target_y);
    glfw.window.set_size(self.target_w as i32, self.target_h as i32);

    egui::CentralPanel::default()
        .frame(egui::Frame::none().fill(egui::Color32::from_rgba_unmultiplied(255, 0, 0, 200)))
        .show(ctx, |_ui| {});
}
```

### Terminal inset awareness

When positioning an overlay to align with a tmux pane (e.g. to match the tmux status bar), the pane pixel rect derived from cell coordinates alone is narrower than the visible terminal row. Terminal emulators pad the cell grid with internal margins (iTerm2: ~4px left, ~4px right, ~2px top). These margins are not part of the cell grid dimensions.

To span the full visible row, extend `set_pos` leftward by `insets.left` and `set_size` width by `insets.left + insets.right`. Without this, the overlay will float a few pixels inside the terminal edges and leave a visible gap on each side.

## Click-through behavior

egui_overlay's GLFW backend checks `egui::Context::wants_pointer_input()` and `wants_keyboard_input()` each frame. When false (mouse over transparent area, not hovering any widget), passthrough is enabled. This is per-frame toggling.

macOS bug: when passthrough enabled, top half of titlebar also becomes passthrough. Workaround: run without decorations.

To make the entire window click-through (pure HUD):

```rust
fn gui_run(&mut self, ctx: &egui::Context, _gfx: &mut ThreeDBackend, glfw: &mut GlfwBackend) {
    glfw_backend.set_passthrough(true); // must be called every frame

    let painter = ctx.layer_painter(egui::LayerId::background());
    painter.set_clip_rect(ctx.screen_rect());

    egui::CentralPanel::default()
        .frame(egui::Frame::none().fill(egui::Color32::from_black_alpha(150)))
        .show(ctx, |ui| {
            ui.label("read-only HUD element");
        });
}
```

Note: `Area` widgets paint background rects, breaking transparency. Use `layer_painter` directly for transparent drawing.

## Custom shape painting

For drawing arbitrary shapes without Window/Area widgets (the overlay drawing use case):

### Getting a full-screen painter

```rust
// Option A: background order -- draws below all panels/widgets
let painter = ctx.layer_painter(egui::LayerId::background());
painter.set_clip_rect(ctx.screen_rect()); // prevent clipping at default bounds

// Option B: foreground order -- draws ABOVE all panels/widgets (use for HUD)
let painter = ctx.layer_painter(egui::LayerId::new(egui::Order::Foreground, egui::Id::new("hud")));
```

`Order::Background` draws below egui panels. `Order::Foreground` draws above them. For HUD overlays that must float over app content (radar, status bar, tooltips), use `Order::Foreground`.

// Option B: allocate_painter via CentralPanel
egui::CentralPanel::default()
    .frame(egui::Frame::none())
    .show(ctx, |ui| {
        let (response, painter) = ui.allocate_painter(
            ui.available_size(),
            egui::Sense::hover(),
        );
        // painter is yours
    });
```

### Shape types (all in `egui::Shape` / `epaint`)

| Shape | Constructor |
|---|---|
| Circle | `Shape::circle_filled(center, radius, color)` / `Shape::circle_stroke(center, radius, stroke)` |
| Rectangle | `Shape::rect_filled(rect, rounding, color)` / `Shape::rect_stroke(rect, rounding, stroke)` |
| Line segment | `Shape::line_segment([p1, p2], stroke)` |
| Polyline | `Shape::line(points: Vec<Pos2>, stroke)` |
| Closed polygon | `Shape::closed_line(points, stroke)` |
| Dashed line | `Shape::dashed_line(path, stroke, dash_len, gap_len) -> Vec<Shape>` |
| Cubic bezier | `Shape::CubicBezier(CubicBezierShape { points: [Pos2; 4], closed, fill, stroke })` |
| Quadratic bezier | `Shape::QuadraticBezier(QuadraticBezierShape { points: [Pos2; 3], closed, fill, stroke })` |
| Ellipse | `Shape::Ellipse(...)` |
| Path | `Shape::Path(PathShape { points, closed, fill, stroke })` |
| Mesh | `Shape::Mesh(Arc<Mesh>)` for custom triangle meshes |
| Callback | `Shape::Callback(...)` for raw wgpu/OpenGL |

### Cubic bezier curves

```rust
use egui::{Shape, epaint::CubicBezierShape, Pos2, Color32, PathStroke};

let bezier = CubicBezierShape::from_points_stroke(
    [start, ctrl1, ctrl2, end],   // [Pos2; 4]
    false,                         // closed
    Color32::TRANSPARENT,          // fill
    PathStroke::new(2.0, Color32::WHITE),
);
painter.add(Shape::CubicBezier(bezier));
```

Points: `[0]` = start, `[1]` = first control point, `[2]` = second control point, `[3]` = end.

### Painter convenience methods

```rust
painter.circle_filled(center, radius, color);
painter.circle_stroke(center, radius, stroke);
painter.rect_filled(rect, rounding, color);
painter.rect_stroke(rect, rounding, stroke);
painter.line_segment([p1, p2], stroke);
painter.line(points, stroke); // polyline
painter.arrow(origin, vec, stroke);
painter.text(pos, anchor, text, font_id, color);
painter.add(shape);       // any Shape variant
painter.extend(shapes);   // batch add Vec<Shape>
```

All coordinates are screen-space logical points. Shapes are regenerated each frame (immediate mode).

### Hit testing on painted shapes

Shapes added via `painter.add()` return no `Response`. Manual hit testing:

```rust
let clicked = ctx.input(|i| {
    i.pointer.any_click()
        && i.pointer.interact_pos().map_or(false, |p| shape_rect.contains(p))
});
let hovered = ctx.input(|i| {
    i.pointer.hover_pos().map_or(false, |p| shape_rect.contains(p))
});
if hovered { ctx.set_cursor_icon(egui::CursorIcon::PointingHand); }
```

This applies to any shape painted directly onto a `layer_painter` -- buttons, icons, minimap elements, etc.

### Coordinate mapping

```rust
use egui::emath::RectTransform;
let to_screen = RectTransform::from_to(local_rect, screen_rect);
let screen_pos = to_screen * local_pos;
```

## Fanning out parallel bezier curves

For connecting a source word to multiple target words without overlapping curves:

```rust
fn fan_curves(
    origin: Pos2,
    targets: &[Pos2],
    painter: &egui::Painter,
    stroke: PathStroke,
) {
    let n = targets.len();
    for (i, &target) in targets.iter().enumerate() {
        let midpoint = Pos2::new(
            (origin.x + target.x) / 2.0,
            (origin.y + target.y) / 2.0,
        );
        // Offset control points perpendicular to the line
        let dx = target.x - origin.x;
        let dy = target.y - origin.y;
        let len = (dx * dx + dy * dy).sqrt().max(1.0);
        let nx = -dy / len; // perpendicular normal
        let ny = dx / len;

        // Fan offset based on index
        let spread = 30.0; // pixels
        let offset = (i as f32 - (n - 1) as f32 / 2.0) * spread;

        let ctrl1 = Pos2::new(
            midpoint.x + nx * offset - dx * 0.1,
            midpoint.y + ny * offset - dy * 0.1,
        );
        let ctrl2 = Pos2::new(
            midpoint.x + nx * offset + dx * 0.1,
            midpoint.y + ny * offset + dy * 0.1,
        );

        let bezier = CubicBezierShape::from_points_stroke(
            [origin, ctrl1, ctrl2, target],
            false,
            Color32::TRANSPARENT,
            stroke.clone(),
        );
        painter.add(Shape::CubicBezier(bezier));
    }
}
```

## Multiple overlay windows

egui_overlay runs one window per `start()` call. For multiple overlays, spawn each in its own thread:

```rust
fn spawn_overlay(pane_id: String, rect: PixelRect, color: egui::Color32) -> JoinHandle<()> {
    std::thread::spawn(move || {
        egui_overlay::start(PaneOverlay { pane_id, rect, color });
    })
}
```

Communication: `Arc<Mutex<T>>` or `crossbeam::channel`.

## Performance

GPU cost is primarily fill rate. A fullscreen transparent surface on retina Mac (3840x2400 physical pixels) requires the compositor to blend every pixel, but this is negligible on Apple Silicon (compositor is hardware-accelerated, transparent windows are a first-class macOS feature). egui rendering cost is proportional to shape count, not window size -- shapes tessellate into triangles.

## Alternative overlay approaches

| Approach | Effort | Click-through | macOS transparency | Custom painting |
|---|---|---|---|---|
| `egui_overlay` | Low | Built-in (per-widget) | PostMultiplied wgpu | Full epaint API |
| eframe + ViewportBuilder | Medium | Manual `set_cursor_hittest` | `clear_color` + Frame::none | Full epaint API |
| Raw winit + wgpu + egui_wgpu | High | Manual per-frame toggle | Manual CompositeAlphaMode | Full epaint + raw wgpu callbacks |
| Raw NSWindow + objc2 + wgpu | Very high | `ignoresMouseEvents` directly | `setOpaque:NO` + `clearColor` (proven working) | Anything |

### winit transparent window (without egui_overlay)

```rust
use winit::window::WindowAttributes;
let attrs = WindowAttributes::default()
    .with_transparent(true)
    .with_decorations(false);
// After creation:
window.set_cursor_hittest(false); // full click-through
```

wgpu surface: `CompositeAlphaMode::PostMultiplied` on macOS. `PreMultiplied` NOT supported on Metal.

eframe shortcut:
```rust
let options = eframe::NativeOptions {
    viewport: egui::ViewportBuilder::default()
        .with_transparent(true)
        .with_decorations(false),
    ..Default::default()
};
// Must return transparent clear color AND use Frame::none() on CentralPanel
```

## Focus stealing prevention on macOS (fullscreen / Spaces)

Getting any of these steps wrong or out of order causes the overlay to steal focus, switch Spaces, or flash at (0,0) before settling into position.

### Step 1: Set Accessory activation policy BEFORE GLFW init

`NSApp.setActivationPolicy(.Accessory)` must be called BEFORE `GlfwBackend::new()`. GLFW's `glfwInit()` calls `[NSApp run]` which triggers `[NSApp activate]`. If the policy is still `Regular` at that point, macOS treats the app as foreground and switches to its Space. Doing it after (e.g. on first frame) is too late.

```rust
// BEFORE GlfwBackend::new():
hide_dock_icon(); // sets Accessory policy

// THEN create window:
let glfw_backend = GlfwBackend::new(config);
```

### Step 2: FocusOnShow(false) hint

```rust
gtx.window_hint(glfw::WindowHint::FocusOnShow(false));
```

Prevents GLFW from requesting focus when `window.show()` is called. Without this, even Accessory apps can grab keyboard focus.

### Step 3: Start hidden, position, then show

```rust
gtx.window_hint(glfw::WindowHint::Visible(false));
// ... after computing position:
glfw_backend.window.set_pos(x, y);
glfw_backend.set_window_size([w, h]);
glfw_backend.window.show(); // only now
```

Prevents the window from flashing at the default (0,0) position before real position is computed.

### Combined order of operations

1. `hide_dock_icon()` -- sets Accessory activation policy
2. `GlfwBackend::new()` with `FocusOnShow(false)` + `Visible(false)` hints
3. Compute target position (tmux pane rect, etc.)
4. `window.set_pos()` + `set_window_size()`
5. `window.show()`

### hide_dock_icon implementation

```rust
use objc2::MainThreadMarker;
use objc2_app_kit::{NSApplication, NSApplicationActivationPolicy};

fn hide_dock_icon() {
    let mtm = unsafe { MainThreadMarker::new_unchecked() };
    let app = NSApplication::sharedApplication(mtm);
    app.setActivationPolicy(NSApplicationActivationPolicy::Accessory);
}
```

- `setActivationPolicy` requires no `unsafe` block in objc2 0.6+
- `Accessory` policy hides the dock icon and menu bar entry; the window still renders and receives events
- `new_unchecked()` is safe here when called before any GLFW init on the main thread

## Platform notes

### macOS
- Uses wgpu backend (Metal). Transparency works well.
- Window level: `NSWindow.setLevel(.floating)` handled by egui_overlay.
- Spaces: overlay windows follow the active Space by default.
- Retina: egui handles scale factor internally via `pixels_per_point`.
- **Retina framebuffer overflow**: `egui_overlay::start()` creates `WgpuBackend` with `Limits::downlevel_defaults()`, which sets `max_texture_dimension_2d = 2048`. Retina framebuffers exceed this (e.g. 3388px wide). Must inline `start()` and mutate the limit before backend creation:
  ```rust
  let mut wgpu_config = WgpuConfig::default();
  wgpu_config.device_descriptor.required_limits.max_texture_dimension_2d = 8192;
  ```
  Metal supports up to 16384.
- `has_shadow` viewport option should be false to prevent ghosting artifacts on transparent windows.

### Linux X11
- Uses three-d/OpenGL backend.
- Compositing manager required for transparency (picom, compton, etc).
- Without compositor: transparent regions render as black.

### Linux Wayland
- Runs under Xwayland. Native Wayland has no concept of global window positioning.
- Sway/Hyprland have IPC for window rules that can force positions.

## Reference projects

| Project | URL | What |
|---|---|---|
| egui_overlay | github.com/coderedart/egui_overlay | The crate itself, ~150 lines of glue |
| portal2-rust-overlay | github.com/LaVashikk/portal2-rust-overlay | Game overlay, egui HUD |
| screen_overlay (iwanders) | github.com/iwanders/screen_overlay | Win + X11 overlay, egui |
| wayscriber | github.com/devmobasa/wayscriber | Screen annotation for Wayland |
| rnote | github.com/flxzt/rnote | Vector drawing/annotation (GTK4) |

## Dirty-flag redraw throttle (winit)

Don't `request_redraw()` every frame in `about_to_wait`. For data-driven overlays where content only changes when external state updates, a dirty flag prevents 60fps CPU/GPU burn on static content:

```rust
struct SharedState {
    panes: Vec<PaneRect>,
    dirty: bool,
}

// Producer (async pipeline thread):
state.lock().unwrap().dirty = true;

// Consumer (winit event loop):
fn about_to_wait(&mut self, _event_loop: &ActiveEventLoop) {
    let dirty = self.state.lock().map(|s| s.dirty).unwrap_or(false);
    if dirty {
        if let Some(renderer) = &self.renderer {
            renderer.window.request_redraw();
        }
    }
}

// In RedrawRequested handler:
let mut s = self.state.lock().unwrap();
if !s.dirty { return; }
s.dirty = false;
let data = s.panes.clone();
// ... render data ...
```

## Border overlay geometry

For overlays that frame a target window with colored strips (leaving the center transparent):

```rust
// Top/bottom extend past target by thickness (fill corners).
// Left/right fit between top and bottom.
//
//   ┌──────────────────────────┐
//   │          TOP             │
//   ├───┬──────────────────┬───┤
//   │ L │   transparent    │ R │
//   ├───┴──────────────────┴───┤
//   │         BOTTOM           │
//   └──────────────────────────┘

fn compute_border_rects(target: &PixelRect, thickness: u32) -> [PixelRect; 4] {
    let t = thickness as i32;
    let tw = thickness;
    [
        PixelRect { x: target.x - t, y: target.y - t, w: target.w + 2*tw, h: tw },       // top
        PixelRect { x: target.x - t, y: target.y + target.h as i32, w: target.w + 2*tw, h: tw }, // bottom
        PixelRect { x: target.x - t, y: target.y, w: tw, h: target.h },                   // left
        PixelRect { x: target.x + target.w as i32, y: target.y, w: tw, h: target.h },     // right
    ]
}
```

The overlay window is sized to `target + thickness` on all sides. Each border rect is converted to window-local coordinates by subtracting the window origin.

## Testing

egui_overlay windows require a display. For CI:
- Linux: `xvfb-run` provides a virtual X11 display
- macOS: CI runners have a real display
- Headless unit tests: test data flow without rendering. Only integration tests need a display.
