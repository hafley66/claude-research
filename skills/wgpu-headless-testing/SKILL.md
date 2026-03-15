---
name: wgpu-headless-testing
description: Running wgpu/egui in CI without a GPU using Mesa llvmpipe software backend, xvfb virtual display, headless rendering to texture, visual regression with insta snapshots. Trigger on headless GPU, software renderer, CI GPU testing, visual regression rust, wgpu CI, egui headless, llvmpipe.
license: MIT
metadata:
  audience: developers
  workflow: tmux-overlay
---

## What this covers

Running GPU-rendered Rust applications (wgpu, egui, eframe) in CI environments that have no GPU, using software rendering backends and virtual displays. Visual regression testing with snapshot comparison.

## Software GPU backend: Mesa llvmpipe

wgpu can render using OpenGL, which Mesa's llvmpipe implements entirely in software (CPU). No GPU hardware needed.

### Environment setup

```bash
# Ubuntu CI
sudo apt-get install -y mesa-utils libgl1-mesa-dri libegl1-mesa

# Force wgpu to use OpenGL backend (which Mesa provides via llvmpipe)
export WGPU_BACKEND=gl

# Verify software rendering is active
glxinfo | grep "OpenGL renderer"
# Should show: "llvmpipe (LLVM 14.0.0, 256 bits)" or similar
```

### GitHub Actions

```yaml
jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install display and GPU deps
        run: |
          sudo apt-get update
          sudo apt-get install -y xvfb mesa-utils libgl1-mesa-dri libegl1-mesa tmux

      - name: Run visual tests
        env:
          WGPU_BACKEND: gl
        run: xvfb-run -a cargo test --features visual-tests
```

### macOS CI

macOS GitHub Actions runners have a real display and Metal GPU. No special setup needed.

```yaml
  visual-tests-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: cargo test --features visual-tests
```

## xvfb: virtual X11 display

winit/GLFW need an X11 display to create windows, even if nobody sees them. `xvfb` (X virtual framebuffer) provides one.

```bash
# Run a command with a virtual display
xvfb-run -a cargo test

# -a: auto-pick a free display number
# Sets DISPLAY=:99 (or next available) automatically
```

For manual control:

```bash
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
cargo test
kill %1
```

## Headless rendering to texture (no window needed)

For pure rendering tests that don't need window positioning, render directly to a texture buffer. No display server needed at all.

```rust
use wgpu::*;

async fn render_to_buffer(width: u32, height: u32) -> Vec<u8> {
    let instance = Instance::new(InstanceDescriptor {
        backends: Backends::GL,  // software backend
        ..Default::default()
    });

    let adapter = instance.request_adapter(&RequestAdapterOptions {
        power_preference: PowerPreference::LowPower,
        compatible_surface: None,  // no surface = headless
        force_fallback_adapter: true,  // prefer software
    }).await.unwrap();

    let (device, queue) = adapter.request_device(
        &DeviceDescriptor::default(), None
    ).await.unwrap();

    // Create texture to render into
    let texture = device.create_texture(&TextureDescriptor {
        label: Some("render target"),
        size: Extent3d { width, height, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: TextureDimension::D2,
        format: TextureFormat::Rgba8UnormSrgb,
        usage: TextureUsages::RENDER_ATTACHMENT | TextureUsages::COPY_SRC,
        view_formats: &[],
    });

    // ... render pass here ...

    // Read pixels back
    let buffer = device.create_buffer(&BufferDescriptor {
        label: Some("readback"),
        size: (width * height * 4) as u64,
        usage: BufferUsages::COPY_DST | BufferUsages::MAP_READ,
        mapped_at_creation: false,
    });

    let mut encoder = device.create_command_encoder(&Default::default());
    encoder.copy_texture_to_buffer(
        ImageCopyTexture { texture: &texture, mip_level: 0, origin: Origin3d::ZERO, aspect: TextureAspect::All },
        ImageCopyBuffer { buffer: &buffer, layout: ImageDataLayout { offset: 0, bytes_per_row: Some(width * 4), rows_per_image: Some(height) } },
        Extent3d { width, height, depth_or_array_layers: 1 },
    );
    queue.submit(Some(encoder.finish()));

    let slice = buffer.slice(..);
    slice.map_async(MapMode::Read, |_| {});
    device.poll(Maintain::Wait);

    slice.get_mapped_range().to_vec()
}
```

## egui headless rendering (no wgpu needed)

egui can run its layout and produce shapes without any GPU context. Useful for testing widget layout, state, and interaction logic.

```rust
#[test]
fn hud_panel_layout() {
    let ctx = egui::Context::default();
    let raw_input = egui::RawInput {
        screen_rect: Some(egui::Rect::from_min_size(
            egui::Pos2::ZERO,
            egui::vec2(400.0, 300.0),
        )),
        ..Default::default()
    };

    let full_output = ctx.run(raw_input, |ctx| {
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.label("AP: 75%");
            ui.add(egui::ProgressBar::new(0.75));
        });
    });

    // Assert on the output shapes/primitives
    assert!(!full_output.shapes.is_empty());

    // Or tessellate and check mesh data
    let prims = ctx.tessellate(full_output.shapes, full_output.pixels_per_point);
    assert!(prims.len() > 0);
}
```

## Visual regression with insta

`insta` is the standard Rust snapshot testing crate. Stores snapshots in the repo, diffs on failure.

```toml
[dev-dependencies]
insta = { version = "1", features = ["yaml"] }
image = "0.25"
image-compare = "0.4"
```

### Snapshot approach 1: hash the rendered image

```rust
use sha2::{Sha256, Digest};

#[test]
fn gauge_visual_hash() {
    let pixels = render_gauge_to_buffer(0.75, 400, 100);
    let hash = format!("{:x}", Sha256::digest(&pixels));
    insta::assert_snapshot!(hash);
}
```

Brittle across platforms (font rendering, anti-aliasing differ). Use for single-platform CI only.

### Snapshot approach 2: structural snapshot of egui output

```rust
#[test]
fn gauge_structure() {
    let ctx = egui::Context::default();
    let output = run_gauge_ui(&ctx, 0.75);

    // Snapshot the paint commands, not pixels
    insta::assert_yaml_snapshot!(summarize_paint_commands(&output.shapes));
}
```

More stable across platforms since it tests layout/structure, not rendering.

### Snapshot approach 3: image diff with tolerance

```rust
use image_compare::Algorithm;

#[test]
fn visual_regression() {
    let rendered = render_to_image(400, 300);
    let reference = image::open("tests/fixtures/reference.png").unwrap();

    let result = image_compare::rgba_hybrid_compare(
        &rendered.into(),
        &reference.into(),
    ).unwrap();

    assert!(
        result.score > 0.98,
        "visual regression: similarity {:.3} (threshold 0.98)",
        result.score
    );
}
```

### Updating snapshots

```bash
# Review and accept new snapshots
cargo insta review

# Accept all without review (use with care)
cargo insta accept
```

Snapshots live in `tests/snapshots/` and get committed to the repo.

## Feature gating visual tests

Since visual tests need xvfb/display, gate them behind a feature:

```toml
# Cargo.toml
[features]
visual-tests = []
```

```rust
#[test]
#[cfg(feature = "visual-tests")]
fn full_overlay_renders() {
    // ... needs display
}
```

```bash
# Local dev (has display)
cargo test --features visual-tests

# CI without display
cargo test  # skips visual tests

# CI with xvfb
xvfb-run cargo test --features visual-tests
```

## Testing the tmux integration layer

Combine xvfb + tmux in CI:

```bash
# Start virtual display
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99

# Start tmux with known geometry
tmux -L test-socket new-session -d -x 200 -y 50
tmux -L test-socket split-window -h
tmux -L test-socket split-window -v

# Run integration tests
TMUX_SOCKET=test-socket cargo test --features integration-tests

# Cleanup
tmux -L test-socket kill-server
kill %1
```

## Known issues

- **llvmpipe rendering differs from real GPU**: Anti-aliasing, blending, and precision differ slightly. Don't expect pixel-identical output between software and hardware rendering. Use tolerance-based comparison.
- **GLFW under xvfb**: Some GLFW versions fail to initialize without a real GPU. May need `LIBGL_ALWAYS_SOFTWARE=1` in addition to `WGPU_BACKEND=gl`.
- **egui_overlay under xvfb**: The GLFW passthrough backend may not support all features under a virtual display. Test window creation separately from content rendering.
