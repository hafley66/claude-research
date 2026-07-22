---
name: vello-renderer
description: Vello GPU 2D vector rendering engine -- Scene API, fill/stroke/text/layers, wgpu integration, render-to-texture, peniko styling, kurbo geometry. Trigger on vello, gpu 2d rendering, vector rendering rust, vello scene, render to texture.
license: MIT
metadata:
  audience: developers
  workflow: ui-rendering
---

## What this covers

Vello: a GPU compute-centric 2D vector graphics renderer from the Linebender project. Uses prefix-scan algorithms to parallelize path rasterization on GPU. PostScript/Canvas-inspired immediate mode scene API.

## Version and requirements

```toml
[dependencies]
vello = "0.7"    # latest as of March 2025
# pulls in wgpu 28, peniko 0.6, kurbo 0.13, skrifa 0.40
```

Requires **compute shader support** (not available on all GPUs/drivers).
Rust edition 2024, requires Rust 1.92+.

## Core types

| Type | Purpose |
|------|---------|
| `Scene` | Records drawing commands. Cheap to clone. |
| `Renderer` | GPU renderer. Executes scenes on wgpu device. |
| `RenderParams` | Per-frame config: dimensions, background color, AA method |
| `RendererOptions` | Renderer creation config: AA support, thread count |
| `AaConfig` | Antialiasing: Area, Msaa8, Msaa16 |
| `Glyph` / `DrawGlyphs` | Text glyph rendering |

## Scene drawing API

```rust
let mut scene = Scene::new();

// Fill a shape with a solid color
scene.fill(
    Fill::NonZero,           // fill rule
    Affine::IDENTITY,        // transform
    Color::RED,              // brush (Color, Gradient, or Image)
    None,                    // brush transform
    &Circle::new((100.0, 100.0), 50.0),  // shape (kurbo)
);

// Stroke a path
scene.stroke(
    &Stroke::new(2.0),      // stroke style
    Affine::IDENTITY,
    Color::BLACK,
    None,
    &my_bez_path,
);

// Clipping via layers
scene.push_clip_layer(
    &Rect::new(0.0, 0.0, 200.0, 200.0),
    &Fill::NonZero,
    Affine::IDENTITY,
);
// ... draw clipped content ...
scene.pop_layer();

// Compositing layers with blend modes
scene.push_layer(
    &clip_shape,
    &Fill::NonZero,
    Compose::SrcOver,
    Affine::IDENTITY,
    BlendMode::default(),
);
scene.pop_layer();

// Images
scene.draw_image(&image_brush, transform);

// Text glyphs
scene.draw_glyphs(font_ref, size, transform, brush, glyphs);

// Reset for next frame
scene.reset();
```

## Rendering to screen (wgpu integration)

```rust
// 1. Create wgpu device
let instance = wgpu::Instance::default();
let adapter = instance.request_adapter(&opts).await.unwrap();
let (device, queue) = adapter.request_device(&desc, None).await.unwrap();

// 2. Create Vello renderer
let renderer = Renderer::new(
    &device,
    RendererOptions {
        surface_format: Some(surface_format),
        use_cpu: false,
        antialiasing_support: AaSupport::area_only(),
        num_init_threads: None,
    },
).unwrap();

// 3. Each frame: render scene to texture
renderer.render_to_texture(
    &device,
    &queue,
    &scene,
    &texture_view,
    &RenderParams {
        base_color: Color::TRANSPARENT,
        width,
        height,
        antialiasing_method: AaConfig::Area,
    },
).unwrap();
```

## Styling primitives (peniko 0.6)

All re-exported through vello:

- `Color` -- RGBA color
- `Gradient` -- linear, radial, sweep gradients with ColorStops
- `Brush` / `BrushRef` -- solid, gradient, or image fill
- `Fill` -- NonZero or EvenOdd fill rule
- `Stroke` -- width, cap (Butt/Round/Square), join (Miter/Round/Bevel), dash pattern
- `BlendMode` -- Porter-Duff compositing + blend operations
- `Compose` -- SrcOver, SrcIn, SrcOut, etc.

## Geometry primitives (kurbo 0.13)

- `Affine` -- 2D affine transformation matrix
- `BezPath` -- bezier path (move, line, quad, cubic segments)
- `Rect`, `RoundedRect`, `Circle`, `Ellipse`, `Line`, `Arc`
- `Shape` trait -- implemented by all geometric types
- `Point`, `Vec2`, `Size`

## Text rendering

Uses `skrifa` 0.40 for glyph rasterization with autohinting. Text is drawn as individual `Glyph` structs:

```rust
struct Glyph {
    id: u32,     // glyph index
    x: f32,      // x offset
    y: f32,      // y offset
}
```

Colored/bitmap emoji supported via `ColorPainter`.

For higher-level text layout (line breaking, shaping, bidi), use **Parley** separately -- Vello only handles final glyph placement.

## Headless / render-to-texture

No windowing built in. Vello renders to any wgpu TextureView:

```rust
renderer.render_to_texture(&device, &queue, &scene, &texture_view, &params)?;
```

This makes it embeddable in game engines, overlay windows, offscreen rendering, or screenshot tools.

## CPU fallback

```rust
RendererOptions {
    use_cpu: true,  // software rasterization
    ..
}
```

Separate `vello_cpu` crate also available for environments without GPU compute.

## Stability

Version 0.7.0, pre-1.0. Active development by Linebender (Raph Levien's group). Scene API is relatively stable but renderer internals and shader pipeline still evolving. The wgpu version dependency updates frequently (currently wgpu 28).
