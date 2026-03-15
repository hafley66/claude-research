---
name: egui-overlay-windows
description: Creating transparent borderless always-on-top winit windows with egui rendering via the egui_overlay crate. Click-through, window positioning, GLFW+wgpu backend. Trigger on egui overlay, transparent window, borderless window, floating overlay, egui_overlay crate.
license: MIT
metadata:
  audience: developers
  workflow: tmux-overlay
---

## What this covers

Using `egui_overlay` to create transparent, borderless, always-on-top windows that render arbitrary egui content. This crate solves the hard platform-specific problems (transparency compositing, click-through, window level) that raw winit leaves as exercises.

## Crate

```toml
[dependencies]
egui_overlay = "0.9"  # check crates.io for latest
```

**Backend**: GLFW for windowing (not winit directly), wgpu on macOS, three-d/OpenGL on Linux.

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
    // Position the window at specific screen coordinates
    glfw.window.set_pos(self.target_x, self.target_y);
    glfw.window.set_size(self.target_w as i32, self.target_h as i32);

    // Render content
    egui::CentralPanel::default()
        .frame(egui::Frame::none().fill(egui::Color32::from_rgba_unmultiplied(
            255, 0, 0, 200
        )))
        .show(ctx, |_ui| {});
}
```

## Click-through behavior

egui_overlay's GLFW backend supports passthrough mode where clicks go through to the window below when not hitting an egui widget. This is the default behavior - areas without egui widgets are click-transparent.

To make the entire window click-through (pure HUD, no interaction):

```rust
fn gui_run(&mut self, ctx: &egui::Context, _gfx: &mut ThreeDBackend, glfw: &mut GlfwBackend) {
    // Force passthrough on the entire window
    glfw.window.set_mouse_passthrough(true);

    // Render read-only content
    egui::CentralPanel::default()
        .frame(egui::Frame::none().fill(egui::Color32::from_black_alpha(150)))
        .show(ctx, |ui| {
            ui.label("read-only HUD element");
        });
}
```

## Multiple overlay windows

egui_overlay runs one window per `start()` call. For multiple overlays, spawn each in its own thread:

```rust
fn spawn_overlay(pane_id: String, rect: PixelRect, color: egui::Color32) -> JoinHandle<()> {
    std::thread::spawn(move || {
        egui_overlay::start(PaneOverlay {
            pane_id,
            rect,
            color,
        });
    })
}
```

Communication between the main thread (which tracks tmux geometry) and overlay threads: use `Arc<AtomicI32>` for position/size updates, or `crossbeam::channel` for richer messages.

```rust
struct PaneOverlay {
    pane_id: String,
    rect: Arc<Mutex<PixelRect>>,  // updated by geometry tracker
    color: egui::Color32,
}

impl EguiOverlay for PaneOverlay {
    fn gui_run(&mut self, ctx: &egui::Context, _gfx: &mut ThreeDBackend, glfw: &mut GlfwBackend) {
        let rect = self.rect.lock().unwrap();
        glfw.window.set_pos(rect.x, rect.y);
        glfw.window.set_size(rect.w as i32, rect.h as i32);

        egui::CentralPanel::default()
            .frame(egui::Frame::none().fill(self.color))
            .show(ctx, |_ui| {});

        ctx.request_repaint(); // continuous update loop
    }
}
```

## Platform notes

### macOS
- Uses wgpu backend (Metal). Transparency works well.
- Window level: `NSWindow.setLevel(.floating)` is handled by egui_overlay.
- Spaces: overlay windows follow the active Space by default.
- Retina: egui handles scale factor internally via `pixels_per_point`.

### Linux X11
- Uses three-d/OpenGL backend.
- Compositing manager required for transparency (picom, compton, etc).
- Without compositor: transparent regions render as black.

### Linux Wayland
- Runs under Xwayland. Native Wayland has no concept of global window positioning (by design). This is a fundamental limitation - Wayland compositors don't allow clients to choose their own position.
- Sway/Hyprland have IPC for window rules that can force positions.

## Alternatives to egui_overlay

If egui_overlay's GLFW dependency is problematic:

- **Raw winit + wgpu + egui**: Full control but must handle transparency, click-through, and window level manually per platform. winit issues #851, #1434, #1980 document the pitfalls.
- **x11-overlay crate**: X11-only, Cairo rendering. Simpler but no GPU.
- **Raw platform APIs**: NSWindow on macOS, XCreateWindow with visual on X11. Maximum control, maximum platform code.

## Testing

egui_overlay windows require a display. For CI:
- Linux: `xvfb-run` provides a virtual X11 display
- macOS: CI runners have a real display
- Headless unit tests: test the data flow (position updates, state management) without rendering. Only integration tests need a display.
