---
name: egui-advanced-patterns
description: Advanced egui application patterns -- animation (built-in + manual + staggered + spring), custom wgpu PaintCallback, Scene zoom/pan, node graph widgets, LOD, FrameCache, large app architecture from Rerun. Trigger on egui animation, egui performance, egui wgpu, egui paint callback, egui scene, egui zoom pan, egui large app, egui architecture, egui advanced.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Patterns for building sophisticated egui applications: animation, custom GPU rendering, zoom/pan scenes, performance optimization, and large-app architecture. Drawn from Rerun source code and the egui ecosystem.

## Animation in immediate mode

### Built-in API (egui::Context)

| Method | What |
|---|---|
| `animate_bool(id, bool) -> f32` | 0.0..1.0 over `Style::animation_time`, linear |
| `animate_bool_responsive(id, bool) -> f32` | Same but `quadratic_out` easing |
| `animate_bool_with_easing(id, bool, fn(f32)->f32) -> f32` | Custom easing |
| `animate_bool_with_time(id, bool, f32) -> f32` | Custom duration |
| `animate_bool_with_time_and_easing(id, bool, f32, fn(f32)->f32) -> f32` | Both |
| `animate_value_with_time(id, f32, f32) -> f32` | Animate any f32 to target |

Internals: `AnimationManager` stores `BoolAnim { last_value, last_tick }` and `ValueAnim { from_value, to_value, toggle_time }`. Linear interpolation clamped to [0,1], frame-rate independent via `stable_dt`. When target changes mid-animation, restarts from current interpolated position. Calls `request_repaint()` automatically while animating.

### Manual per-frame animation

```rust
ctx.input(|i| {
    let t = i.time;       // seconds since start (f64)
    let dt = i.stable_dt; // smoothed frame delta (f32)
});
```

### Easing functions

egui built-in: `emath::easing::quadratic_out`. The `simple_easing` crate (re-exported by `egui_animation`) provides 30 functions: `linear`, `quad_in/out/in_out`, `cubic_*`, `elastic_*`, `bounce_*`, etc. All `fn(f32) -> f32` mapping `[0,1] -> [0,1]`.

### Staggered animations

No built-in. Pattern: per-element IDs with offset delay:

```rust
for (i, item) in items.iter().enumerate() {
    let id = ui.id().with(("item_anim", i));
    let should_show = elapsed > i as f64 * 0.05; // 50ms stagger
    let t = ctx.animate_bool_with_time_and_easing(
        id, should_show, 0.3, simple_easing::cubic_out
    );
    // use t for opacity, translation, scale
}
```

### Spring physics (manual)

```rust
struct SpringState { pos: f32, vel: f32 }

fn tick(s: &mut SpringState, target: f32, dt: f32) {
    let stiffness = 100.0;
    let damping = 10.0;
    let force = -stiffness * (s.pos - target) - damping * s.vel;
    s.vel += force * dt;
    s.pos += s.vel * dt;
}
// Call each frame with ctx.input(|i| i.stable_dt)
// ctx.request_repaint() while spring is still moving
```

### Rerun's animation patterns

**Maximize animation** (viewport_ui.rs): stores `MaximizeAnimationState` enum in `ctx.data_mut()` temp storage. Uses `remap_clamp` + `quadratic_out` easing on elapsed time to lerp between source and target rects.

**Loading indicator** (loading_indicator.rs): procedural animation using `ui.input(|i| i.time)` with phase-shifted dots. Each dot has `phase = (speed * time + offset).fract()`, alpha derived from phase.

**Collapse openness**: `CollapsingState::openness(ctx) -> f32` returns 0.0..1.0 animated value for expand/collapse.

### `egui_animation` crate

```toml
egui_animation = "0.10" # egui 0.33+
```

Provides: `animate_eased`, `animate_position` (scroll-compensated), `animate_ui_translation`, `animate_repeating` (looping 0->1->0), `Collapse` widget.

### Repaint control

- `ctx.request_repaint()` -- immediate (continuous mode)
- `ctx.request_repaint_after(Duration)` -- scheduled (battery-friendly)

## Custom wgpu rendering (PaintCallback)

Three-phase flow:

### 1. Register resources at startup
```rust
render_state.renderer.callback_resources.insert(MyResources {
    pipeline, bind_group, vertex_buffer, // ...
});
```

### 2. Emit callback during UI
```rust
let callback = egui_wgpu::Callback::new_paint_callback(
    rect,
    MyCallbackType { /* per-frame uniforms */ },
);
ui.painter().add(callback);
```

### 3. Implement CallbackTrait
```rust
impl egui_wgpu::CallbackTrait for MyCallbackType {
    fn prepare(&self, device, queue, screen_desc, encoder, resources)
        -> Vec<wgpu::CommandBuffer>
    {
        // Upload uniforms, update buffers
        // Can create own render pass here for multi-pass
        vec![]
    }

    fn paint<'a>(&'a self, info: PaintCallbackInfo, render_pass, resources) {
        let res = resources.get::<MyResources>().unwrap();
        render_pass.set_pipeline(&res.pipeline);
        render_pass.draw(0..3, 0..1);
    }
}
```

### Multi-pass rendering

In `prepare()`, use the provided `&mut CommandEncoder` to create a separate render pass targeting your own texture. In `paint()`, blit that texture as a textured quad into egui's pass. This enables shadow maps, depth testing, post-processing.

### Rerun's approach

Wraps their `re_renderer::ViewBuilder` in a `ReRendererCallback`. `prepare()` calls `view_builder.draw()` which runs the full 3D rendering pipeline. `paint()` calls `view_builder.composite()` to blit the result into egui's render pass.

### Texture sharing

```rust
let texture_id = renderer.register_native_texture(device, &texture_view, filter);
// Use texture_id in egui::Image
```

Reference: `egui_demo_app/src/apps/custom3d_wgpu.rs`

## Scene (zoom/pan canvas)

Built into egui since ~0.30:

```rust
let mut scene_rect = /* persisted Rect */;
Scene::new()
    .zoom_range(0.1..=4.0)
    .show(ui, &mut scene_rect, |ui| {
        // Draw in scene coordinates
        // Pan/zoom handled automatically via TSTransform
    });
```

`TSTransform { scaling: f32, translation: Vec2 }` maps between scene space and screen space. Pan = drag updates translation. Zoom = compose transforms toward pointer position.

## Level-of-detail (from Rerun)

```rust
pub enum LevelOfDetail { Full, Low }

impl LevelOfDetail {
    pub fn from_scaling(scale: f32) -> Self {
        if scale < 0.20 { Self::Low } else { Self::Full }
    }
}

// In draw:
match lod {
    Full => draw_text_label(ui, label, highlight),
    Low  => draw_rect_label(ui, label, highlight), // simple colored rect
}
```

## Performance

### FrameCache

```rust
struct MyComputer;
impl ComputerMut<&str, usize> for MyComputer {
    fn compute(&mut self, input: &str) -> usize { /* expensive */ }
}
type MyCache<'a> = FrameCache<usize, MyComputer>;

let result = ctx.memory_mut(|mem| mem.caches.cache::<MyCache<'_>>().get(input));
```

Evicts entries not accessed in the current frame.

### Visibility culling

egui does not auto-cull. Pattern:

```rust
let visible_rect = ui.clip_rect();
for item in &items {
    if item.rect.intersects(visible_rect) {
        draw_item(ui, item); // full widget
    } else {
        ui.allocate_space(item.size); // reserve space only
    }
}
```

Rerun's `ListItem` has `render_offscreen` flag: `let should_render = render_offscreen || ui.is_rect_visible(rect);`

### Tessellation

- Enable `rayon` feature for parallel tessellation
- egui recycles `Vec<u32>` / `Vec<Vertex>` from dropped meshes
- Small filled circles use textured rects from font atlas (no polygon tess)
- Text galleys are aggressively cached

### Frame budget

Target ~1-2ms for typical UIs. Profile with `puffin`.

## Large app architecture (Rerun patterns)

### State management layers

| Layer | Storage | Lifetime |
|---|---|---|
| Persistent | `egui::Memory` / storage | Across sessions |
| Frame-local | `ctx.data_mut()` temp | Current frame only |
| Animation | `AnimationManager` | Until settled |
| View state | `ViewStates` map | While view exists |

### Two-pass layout

Gather layout stats frame N, apply frame N+1. Stores metrics in `ctx.data()` against scope IDs. Eliminates jitter from immediate-mode layout.

### Command channels

Deferred state mutations via `CommandSender`/`CommandReceiver` to avoid borrow conflicts during rendering.

### Blueprint as data store

User interactions (resize, reorder, change view type) written as revisions to a blueprint store. Next frame reads those revisions. Undo = revert to previous revision.

## Reusable widget pattern (Widget trait + builder)

The idiomatic way to build reusable components. Struct fields are props; builder methods configure optional ones; `impl Widget` provides the render call via `ui.add(...)`.

```rust
// Struct fields = required props, builder methods = optional props
struct MyWidget<'a> { label: &'a str, secondary: bool }
impl<'a> MyWidget<'a> {
    fn new(label: &'a str) -> Self { Self { label, secondary: false } }
    fn secondary(mut self, v: bool) -> Self { self.secondary = v; self }
}
impl egui::Widget for MyWidget<'_> {
    fn ui(self, ui: &mut egui::Ui) -> egui::Response {
        ui.label(self.label) // real impl allocates space, paints, returns Response
    }
}
// Call site:
ui.add(MyWidget::new("hello").secondary(true));
```

### Children via closure (wrapper/container pattern)

For components that decorate arbitrary content -- FormField, Card, Section:

```rust
struct FormField<'a> { label: &'a str, error: Option<&'a str> }
impl<'a> FormField<'a> {
    fn show(self, ui: &mut egui::Ui, content: impl FnOnce(&mut egui::Ui)) {
        ui.vertical(|ui| {
            ui.strong(self.label);
            content(ui);
            if let Some(err) = self.error {
                ui.colored_label(egui::Color32::RED, err);
            }
        });
    }
}
// Usage:
FormField { label: "Email", error: validate_email(&self.email) }
    .show(ui, |ui| { ui.text_edit_singleline(&mut self.email); });
```

Note: no MUI-equivalent library exists because each component is 20-50 lines and the egui ecosystem is fragmented across multiple GUI frameworks. Components are written inline or in local modules.

## Notable widget crates

| Crate | What |
|---|---|
| `egui-snarl` | Node graph editor, `SnarlViewer<T>` trait |
| `egui_graphs` | Graph visualization on petgraph |
| `egui-keyframe` | Timeline/keyframe editor, bezier curves, dope sheet |
| `egui_dock` | Docking/tab panel system |
| `egui_tiles` | N-way split layout (by emilk) |
| `egui-modal` | Modal dialogs with backdrop |
| `egui_animation` | Animation helpers + easing |
