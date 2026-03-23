---
name: ps1-graphics-rust
description: PS1/PS2 era retro 3D graphics in Rust -- affine texture mapping, vertex snapping, dithering, low-res rendering, wgpu/egui custom pipelines, software renderers, WGSL shader recipes
license: MIT
compatibility: opencode
metadata:
  depth: intermediate
---

## What this covers

Replicating PlayStation 1 and PS2 era rendering aesthetics in Rust. Hardware characteristics, shader techniques, crate options, and egui/wgpu integration.

Trigger on: ps1 graphics, ps1 shader, ps1 aesthetic, psx rendering, retro 3d rust, low poly rust, vertex snapping, affine texture, ps2 graphics, playstation style rust, retro renderer.

## PS1 Hardware Characteristics

The PS1's GTE (Geometry Transformation Engine) and GPU had specific limitations that created the signature look:

| Property | PS1 Behavior | Why It Looks Like That |
|---|---|---|
| Texture mapping | **Affine** (no perspective correction) | GTE had no division unit. UVs interpolated linearly in screen space, causing texture swimming/warping on angled surfaces |
| Vertex positions | **Integer screen coords** (fixed-point, no FPU) | Polygon corners snap between pixel positions each frame, causing jitter |
| Texture filtering | **Nearest-neighbor only** | No bilinear/trilinear. Textures look blocky and sharp |
| Color depth | **15-bit** (5 bits per channel) | Ordered dithering applied to mask banding |
| VRAM | **1MB** | Textures typically 64x64 or 128x128, 4-bit or 8-bit indexed color |
| Z-buffer | **None** | Painter's algorithm (back-to-front sorting). Causes polygon fighting and z-sorting artifacts |
| Lighting | **Per-vertex Gouraud shading** | Lighting computed at vertices, interpolated across faces. No per-pixel lighting |
| Draw distance | **Fog to solid color** | Hides geometry pop-in |
| Throughput | **~90K textured lit polygons/sec** | Low poly counts are a feature, not a bug |

Sources:
- David Colson, "Building a PS1 style retro 3D renderer" (2021): https://www.david-colson.com/2021/11/30/ps1-style-renderer.html
- Polybox source (C++ reference impl): https://github.com/DavidColson/Polybox

## PS2 Graphics Synthesizer

The PS2 GS fixed most PS1 artifacts but has its own character:

| Property | PS2 Behavior |
|---|---|
| Texture mapping | Perspective-correct |
| Texture filtering | Bilinear |
| Z-buffer | Hardware (no sorting artifacts) |
| Color depth | 32-bit |
| eDRAM | 4MB, 48GB/s internal bandwidth |
| Polygon throughput | ~6-20M textured/lit polygons/sec |
| Vertex processing | VU1 microcode (effectively a vertex shader) |
| Programmable shaders | No (GS is fixed-function, VU microcode is the flexibility) |

The PS2 aesthetic is "early 2000s 3D" without strong signature artifacts. Less visually distinctive than PS1.

Sources:
- PS2 Dev Wiki - Graphics Synthesizer: https://www.psdevwiki.com/ps2/Graphics_Synthesizer
- Maister, "PS2 GS Emulation: The Final Frontier of Vulkan Compute Emulation" (2024): https://themaister.net/blog/2024/07/03/playstation-2-gs-emulation-the-final-frontier-of-vulkan-compute-emulation/
- parallel-gs (Vulkan compute GS emulator): https://github.com/Arntzen-Software/parallel-gs

## Rust Crate Landscape

### Aesthetic / Rendering

| Crate | What | Downloads | Status |
|---|---|---|---|
| `bevy_psx` | Bevy plugin: vertex snapping, palette quantization, low-res render targets, nearest-neighbor upscale | 704 | Active, Bevy-only |
| `euc` | Software renderer with custom Rust shader functions. Full pipeline control. | 115K | Mature, no_std |
| `retrofire` | 90s demoscene software 3D renderer, subpixel rasterizer | 299 | Active, no_std |
| `aftershock` | Pure Rust software rendering API | 12.5K | Maintained |
| `portablegl` | Port of PortableGL (OpenGL 3.x core in software) | 140 | New (Mar 2026) |

Sources:
- bevy_psx: https://github.com/tajo48/bevy_psx
- bevy_psx_shader (unpublished, git-only): https://github.com/vixeliz/bevy_psx_shader
- euc: https://github.com/zesterer/euc
- retrofire: https://github.com/jdahlstrom/retrofire
- aftershock: https://github.com/Phobos001/aftershock

### PS1 Emulators in Rust (study, not aesthetic)

| Crate | What | Links |
|---|---|---|
| `psx` | Actual PS1 homebrew SDK (no_std, targets real hardware) | https://github.com/ayrtonm/psx-sdk-rs |
| `trapezoid-core` | PSX emulator backed by vulkano | https://crates.io/crates/trapezoid-core |
| rustation | Software renderer PS1 emulator (2017, historical) | https://github.com/simias/rustation |

### Dithering Utilities

| Crate | What | Downloads |
|---|---|---|
| `dithereens` | Error-diffusion quantization | 4.2K |
| `dithers` | 13 algorithms (Floyd-Steinberg, Bayer, etc.) | 19 |

## WGSL Shader Recipes

### Affine texture mapping (the PS1 warp)

The key insight: use `@interpolate(linear, center)` on UV coordinates. This is WGSL's equivalent of GLSL's `noperspective` -- it tells the rasterizer to interpolate linearly in screen space instead of perspective-correcting.

```wgsl
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) @interpolate(linear, center) uv: vec2<f32>,
    @location(1) @interpolate(linear, center) color: vec3<f32>,  // Gouraud
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.position = uniforms.mvp * vec4<f32>(in.position, 1.0);
    out.uv = in.uv;
    out.color = in.color;
    return out;
}
```

Source: WGSL interpolation spec discussion: https://github.com/gpuweb/gpuweb/issues/802
Tutorial: Daniel Ilett, "PS1 Affine Texture Mapping" (2021): https://danielilett.com/2021-11-06-tut5-21-ps1-affine-textures/

### Vertex snapping / jitter

After projection, quantize clip-space position to a virtual resolution grid:

```wgsl
@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    var clip_pos = uniforms.mvp * vec4<f32>(in.position, 1.0);

    // Snap to grid (e.g., 160x120 virtual resolution)
    let grid = vec2<f32>(160.0, 120.0);
    var snapped = clip_pos.xy / clip_pos.w;          // NDC
    snapped = floor(snapped * grid + 0.5) / grid;    // quantize
    clip_pos = vec4<f32>(snapped * clip_pos.w, clip_pos.zw);

    out.position = clip_pos;
    out.uv = in.uv;
    return out;
}
```

Lower grid values = more jitter. 160x120 is aggressive PS1. 320x240 is subtle.

### 15-bit color + Bayer dithering

```wgsl
// 4x4 Bayer matrix
fn bayer4x4(pos: vec2<i32>) -> f32 {
    let bayer = array<f32, 16>(
         0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
        12.0/16.0,  4.0/16.0, 14.0/16.0,  6.0/16.0,
         3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
        15.0/16.0,  7.0/16.0, 13.0/16.0,  5.0/16.0,
    );
    let idx = (pos.y % 4) * 4 + (pos.x % 4);
    return bayer[idx];
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    var color = textureSample(t_diffuse, s_diffuse, in.uv).rgb;
    color *= in.color;  // Gouraud vertex lighting

    // Dither + quantize to 5 bits per channel (32 levels)
    let screen_pos = vec2<i32>(in.position.xy);
    let dither = bayer4x4(screen_pos) - 0.5;  // center around 0
    let levels = 31.0;  // 5-bit = 32 levels
    color = floor((color + dither / levels) * levels + 0.5) / levels;

    return vec4<f32>(color, 1.0);
}
```

### Nearest-neighbor sampling (wgpu side)

```rust
let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
    mag_filter: wgpu::FilterMode::Nearest,
    min_filter: wgpu::FilterMode::Nearest,
    mipmap_filter: wgpu::FilterMode::Nearest,
    ..Default::default()
});
```

### Draw distance fog

```wgsl
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let depth = in.position.z / in.position.w;
    let fog_start = 0.3;
    let fog_end = 0.9;
    let fog_factor = clamp((depth - fog_start) / (fog_end - fog_start), 0.0, 1.0);
    let fog_color = vec3<f32>(0.1, 0.1, 0.15);  // dark blue-gray

    var color = /* your lit, dithered color */;
    color = mix(color, fog_color, fog_factor);
    return vec4<f32>(color, 1.0);
}
```

## egui Integration via CallbackTrait

egui's wgpu backend exposes custom render passes. Render your PS1 scene to a texture, then display it in egui (optionally at low resolution with nearest-neighbor upscale).

```rust
use egui_wgpu::CallbackTrait;

struct Ps1Callback {
    pipeline: wgpu::RenderPipeline,
    bind_group: wgpu::BindGroup,
    vertex_buffer: wgpu::Buffer,
    // ... scene data
}

impl CallbackTrait for Ps1Callback {
    fn prepare(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        _screen_descriptor: &ScreenDescriptor,
        encoder: &mut wgpu::CommandEncoder,
        callback_resources: &mut CallbackResources,
    ) -> Vec<wgpu::CommandBuffer> {
        // Render PS1 scene to low-res texture (e.g. 320x240)
        // Then the egui frame displays it as an image
        vec![]
    }

    fn paint(
        &self,
        _info: PaintCallbackInfo,
        render_pass: &mut wgpu::RenderPass<'_>,
        _callback_resources: &CallbackResources,
    ) {
        render_pass.set_pipeline(&self.pipeline);
        render_pass.set_bind_group(0, &self.bind_group, &[]);
        render_pass.set_vertex_buffer(0, self.vertex_buffer.slice(..));
        render_pass.draw(0..self.vertex_count, 0..1);
    }
}
```

Reference example: https://github.com/emilk/egui/blob/main/crates/egui_demo_app/src/apps/custom3d_wgpu.rs
Gist with wgpu callback details: https://gist.github.com/zicklag/b9c1be31ec599fd940379cecafa1751b

## Software Renderer Path (euc)

For maximum PS1 accuracy without GPU shaders, `euc` lets you write the entire pipeline in Rust:

```rust
use euc::{Pipeline, rasterizer::Triangles};

struct Ps1Pipeline;

impl Pipeline for Ps1Pipeline {
    type Vertex = Vertex;
    type VsOut = VsOut;     // interpolated per-fragment
    type Pixel = [u8; 4];

    fn vert(&self, vertex: &Self::Vertex) -> ([f32; 4], Self::VsOut) {
        let mut clip = self.mvp * vertex.position;
        // Vertex snapping: quantize to integer screen coords
        let grid = 160.0;
        clip[0] = (clip[0] / clip[3] * grid).round() / grid * clip[3];
        clip[1] = (clip[1] / clip[3] * grid).round() / grid * clip[3];
        (clip.into(), VsOut { uv: vertex.uv, color: vertex.color })
    }

    fn frag(&self, vs_out: &Self::VsOut) -> Self::Pixel {
        // UVs are already affine (euc interpolates linearly by default
        // unless you implement perspective correction yourself)
        let texel = self.sample_nearest(vs_out.uv);
        let lit = texel * vs_out.color;  // Gouraud
        quantize_15bit_dithered(lit)
    }
}
```

Source: https://github.com/zesterer/euc

## Reference Material

| Resource | What | Link |
|---|---|---|
| David Colson (2021) | Best technical writeup of PS1 rendering | https://www.david-colson.com/2021/11/30/ps1-style-renderer.html |
| Polybox | C++ reference implementation from Colson's article | https://github.com/DavidColson/Polybox |
| Daniel Ilett (2021) | Affine texture mapping shader math tutorial | https://danielilett.com/2021-11-06-tut5-21-ps1-affine-textures/ |
| tipsy | 500-line C99 PS1-style renderer (minimal reference) | https://github.com/nkanaev/tipsy |
| psx_retroshader | Unity reference for vertex snapping + affine UV + color depth | https://github.com/dsoft20/psx_retroshader |
| WGSL interpolation spec | `@interpolate(linear)` discussion | https://github.com/gpuweb/gpuweb/issues/802 |
| PS2 Dev Wiki | GS hardware reference | https://www.psdevwiki.com/ps2/Graphics_Synthesizer |
| Maister (2024) | PS2 GS Vulkan compute emulation deep dive | https://themaister.net/blog/2024/07/03/playstation-2-gs-emulation-the-final-frontier-of-vulkan-compute-emulation/ |
