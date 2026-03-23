# 3D Graphics from First Principles (to PS1)

## The core problem

You have a 3D world (vertices in space) and a 2D screen (pixels). The entire graphics pipeline is: **transform 3D points into 2D positions, then fill in the pixels between them.**

## Step 1: Vertices and Triangles

Everything is triangles. A cube is 12 triangles. A character model is thousands. Each triangle is 3 vertices, and each vertex has:

- **Position** (x, y, z) -- where it is in 3D space
- **UV coordinates** (u, v) -- where to sample the texture (explained below)
- **Color** or **Normal** -- for lighting
- **Any other data** you want to interpolate across the surface

## Step 2: Transforms (vertex processing)

Each vertex passes through a chain of matrix multiplications:

```
Model space  →  World space  →  Camera space  →  Clip space  →  Screen space
   (local)      (placed in       (relative to     (perspective    (pixel
                 scene)           camera)          projection)    coordinates)
```

**Model matrix**: positions/rotates/scales the object in the world
**View matrix**: moves everything relative to the camera (camera doesn't move -- the world moves around it)
**Projection matrix**: applies perspective (far things get smaller). This is the step that divides x and y by z (the "perspective divide").

On PS1, the GTE (a coprocessor) did these matrix multiplies in fixed-point. No floating point unit existed.

## Step 3: Rasterization

After projection, you have 2D triangle coordinates on screen. **Rasterization** determines which pixels fall inside each triangle.

For each pixel inside the triangle, the rasterizer computes **barycentric coordinates** -- three weights (w0, w1, w2) that describe where the pixel sits relative to the triangle's three corners. These weights are used to blend (interpolate) any per-vertex data across the surface:

```
pixel_value = w0 * vertex0_value + w1 * vertex1_value + w2 * vertex2_value
```

This is how smooth gradients appear across a triangle -- the hardware (or software) linearly blends vertex data for every pixel.

## Step 4: Texture Mapping

A **texture** is a 2D image. **UV coordinates** are 2D coordinates (0.0 to 1.0) that say "for this vertex, look at this position in the texture."

Each vertex carries a (u, v) pair. The rasterizer interpolates UVs across the triangle (using barycentric coordinates), and for each pixel, it looks up the color in the texture at the interpolated (u, v). This lookup is called **sampling**.

```
vertex 0: uv = (0.0, 0.0)  →  top-left of texture
vertex 1: uv = (1.0, 0.0)  →  top-right of texture
vertex 2: uv = (0.5, 1.0)  →  bottom-center of texture

pixel in the middle of the triangle: uv ≈ (0.5, 0.33)
→ sample texture at that position → get a color → that's the pixel color
```

**Texture filtering** controls what happens when the UV lands between texels (texture pixels):
- **Nearest-neighbor**: snap to closest texel. Blocky, sharp. (PS1 did this)
- **Bilinear**: blend 4 surrounding texels. Smooth, blurry. (PS2 and modern GPUs)

## Step 5: The Perspective Correction Problem

Here's where PS1 diverges from modern GPUs.

When interpolating UVs across a triangle, there are two ways to do it:

**Perspective-correct interpolation** (modern GPUs): accounts for the fact that a triangle receding into the distance should have its texture compressed more at the far end. Mathematically, this requires dividing by the interpolated depth (1/z) at each pixel. The texture looks "correct" -- parallel lines on a floor tile stay parallel.

**Affine interpolation** (PS1): just linearly blends the UVs in screen space, ignoring depth. This is cheaper (no per-pixel division) but produces the signature PS1 texture warping -- on any surface that isn't perpendicular to the camera, the texture appears to swim, bend, and warp as the camera moves.

Visual diagram:

```
Perspective-correct:          Affine (PS1):
┌──────────────┐              ┌──────────────┐
│  ·  ·  ·  ·  │              │  ·  ·  ·  · │
│  ·  ·  ·  ·  │              │ ·  ·  · ·   │
│  ·  ·  ·  ·  │              │·  · ·  ·    │
│  ·  ·  ·  ·  │              │ · · ·       │
└──────────────┘              └──────────────┘
Grid stays regular            Grid distorts toward vanishing point
```

The PS1's GTE had no hardware division for the perspective correction step. Division is expensive in fixed-point. So they skipped it. Every PS1 game has this warp.

## Step 6: Depth / Z-Buffer

When two triangles overlap on screen, which pixel wins?

**Z-buffer** (modern GPUs, PS2): a second screen-sized buffer stores the depth of each pixel. When drawing a new pixel, compare its depth against what's already stored. Closer wins. This handles all overlap correctly with no sorting needed.

**No Z-buffer** (PS1): the PS1 GPU had no Z-buffer. Games used the **painter's algorithm** -- sort triangles back-to-front, draw far things first, then closer things paint over them. This is why PS1 games have polygon sorting artifacts (flickering faces, triangles poking through each other) -- sorting every triangle perfectly is expensive and often approximate.

## Step 7: Lighting

**Per-vertex (Gouraud shading)** -- PS1's approach: compute lighting intensity at each vertex (dot product of vertex normal and light direction), then interpolate the intensity across the triangle. Cheap, but lighting looks faceted on low-poly models because there are few vertices to interpolate between.

**Per-pixel (Phong shading, normal mapping)** -- modern approach: interpolate the normal vector across the triangle, compute lighting at every pixel. Smooth results but requires per-pixel math the PS1 couldn't afford.

```
Gouraud (PS1):                    Phong (modern):
┌─────────────┐                   ┌─────────────┐
│dark    light│                   │  smooth     │
│  ·          │                   │  gradient   │
│     ·       │                   │  with       │
│        light│                   │  highlight  │
└─────────────┘                   └─────────────┘
3 values interpolated             full computation per pixel
```

## Step 8: Color Depth and Dithering

Modern GPUs: 8 bits per channel (256 levels) = 16.7 million colors.

PS1: **5 bits per channel** (32 levels) = 32,768 colors. You see banding in gradients. The PS1 applied **ordered dithering** (a Bayer matrix pattern) to break up the bands into a noise pattern that's less visually offensive.

## Putting it all together: the PS1 pipeline

```
Vertices (model data)
    │
    ▼
GTE: transform × MVP matrix (fixed-point, no FPU)
    │
    ▼
Snap to integer screen coordinates (vertex jitter)
    │
    ▼
GPU: rasterize triangles
    │
    ▼
Interpolate UVs AFFINELY (no perspective correction, texture warp)
    │
    ▼
Sample texture with NEAREST filtering (blocky texels)
    │
    ▼
Multiply by Gouraud vertex color (per-vertex lighting)
    │
    ▼
Dither + quantize to 15-bit color
    │
    ▼
Write to framebuffer (no Z-test, painter's algorithm order)
    │
    ▼
Display (320×240 or 512×448)
```

Every step is a compromise for speed on 1994 hardware. Each compromise produces a visible artifact. The collection of all these artifacts is "the PS1 look."

## Glossary

| Term | Meaning |
|---|---|
| **Vertex** | A point in 3D space with associated data (position, UV, color, normal) |
| **Triangle** | 3 vertices. The atomic unit of 3D rendering. Everything is triangles. |
| **UV coordinates** | 2D coordinates mapping a vertex to a position on a texture |
| **Texel** | A pixel in a texture (texture element) |
| **Sampling** | Looking up a texel at a given UV coordinate |
| **Rasterization** | Determining which screen pixels fall inside a projected triangle |
| **Barycentric coordinates** | Weights describing a point's position relative to a triangle's 3 vertices |
| **Interpolation** | Blending per-vertex values smoothly across a triangle's surface |
| **Affine** | Linear interpolation in screen space (no depth correction) |
| **Perspective-correct** | Interpolation that accounts for depth (divides by z) |
| **Z-buffer / depth buffer** | Per-pixel depth storage for correct overlap resolution |
| **Painter's algorithm** | Draw back-to-front, relying on draw order instead of depth testing |
| **Gouraud shading** | Lighting computed at vertices, interpolated across face |
| **Dithering** | Adding structured noise to hide quantization banding |
| **GTE** | PS1 coprocessor for geometry transforms (fixed-point matrix math) |
| **Clip space** | Coordinate space after projection, before perspective divide |
| **NDC** | Normalized Device Coordinates -- after dividing by w, range [-1,1] |
| **Framebuffer** | The pixel buffer that gets displayed on screen |
