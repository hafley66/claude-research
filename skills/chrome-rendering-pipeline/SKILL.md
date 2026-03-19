---
name: chrome-rendering-pipeline
description: Chrome/Blink rendering pipeline internals -- dirty tracking, display item caching, composited layers, tiling, GPU rasterization (Skia/Graphite), incremental layout, compositor thread. Comparison to Vello/Blitz. Trigger on chrome rendering, blink pipeline, compositing layers, display list caching, tile rasterization, paint invalidation, chrome gpu, skia graphite, rendering optimization.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Chrome's rendering pipeline optimization techniques -- how it achieves "don't draw if it didn't change" at every stage. Comparison to Vello/Blitz approach for Rust GUI rendering.

## The 12-Stage Pipeline

| Stage | Thread | Output |
|---|---|---|
| **Animate** | Main | Mutated computed styles from declarative timelines |
| **Style** | Main | Computed styles on each DOM element |
| **Layout** | Main | Immutable fragment tree (sizes, positions) |
| **Pre-paint** | Main | Property trees (transform, clip, effect, scroll) + invalidation flags |
| **Scroll** | Main | Updated scroll offsets via property tree mutation |
| **Paint** | Main | Display item list grouped into paint chunks |
| **Commit** | Main->Compositor | Copies property trees + display list to compositor thread |
| **Layerize** | Compositor | Breaks display list into composited layer list |
| **Raster** | Workers/GPU | GPU texture tiles from display lists |
| **Activate** | Compositor | Pending tree becomes active tree |
| **Aggregate** | Viz | Merges all compositor frames into single global frame |
| **Draw** | GPU | Pixels on screen |

Core optimization: **stages can be skipped if their inputs haven't changed.** Compositor-only animations skip Style, Layout, Pre-paint, and Paint entirely.

## Dirty Tracking and Invalidation

### Layout dirty bits

Three bits on `LayoutObject` control traversal:
- `NeedsPaintPropertyUpdate` -- this object needs recalc
- `SubtreeNeedsPaintPropertyUpdate` -- subtree needs traversal
- `DescendantNeedsPaintPropertyUpdate` -- some descendant needs update

Propagate upward on change, consumed during `PrePaintTreeWalk` which only enters marked subtrees. CSS `contain: layout` stops propagation at boundaries.

### Paint invalidation

During Pre-paint, `PaintInvalidator` walks marked subtrees to identify which display items will produce different output. Categorized by reason (full repaint, geometry change, incremental) which controls downstream raster invalidation scope.

### Granularity

Two levels:
1. **Paint chunk level** (`RasterInvalidator`): compare old vs new chunks. New/disappeared/moved chunks get full invalidation. Property-only changes invalidate only the difference region.
2. **Display item level** (`DisplayItemRasterInvalidator`): within matched chunks, individually invalidated items get full or incremental raster invalidation.

## Display Lists and Caching

### What display items are

Smallest unit of a display list. Identified by `(client pointer, type enum)`. Types:
- `DrawingDisplayItem`: holds `PaintRecord` (Skia `SkPicture`) with actual draw ops
- `ForeignLayerDisplayItem`: references external `cc::Layer` (plugins, video)
- `ScrollbarDisplayItem`: scrollbar rendering

Grouped into **paint chunks**: sequential items sharing same property tree state (transform, clip, effect, scroll nodes). Chunks are the unit for compositing decisions.

### Recording vs executing

Paint **records** draw commands, does not rasterize. `PaintController` accumulates display items. `DrawingDisplayItem` stores a `PaintRecord` (serialized Skia commands). These are replayed later during Raster by worker threads (software) or translated to GPU commands (GPU raster).

### Two caching mechanisms

**Display item caching**: before painting, call `UseCachedItemIfPossible()`. If client wasn't invalidated, reuse previous `DrawingDisplayItem` verbatim, skipping all draw-call recording for that item.

**Subsequence caching**: `SubsequenceRecorder` wraps an entire paint layer's output. If unchanged, the entire subsequence of display items copies from previous frame's list. Skips painting whole stacking contexts at once.

During `commitNewDisplayItems`, `RasterInvalidator` and `DisplayItemRasterInvalidator` compare old and new to determine which tile regions need re-rasterization.

## Compositing Layers

### What they are

A compositing layer gets its own GPU-backed texture (or tile set). Once rasterized, the compositor can reposition, transform, blend, or apply opacity without repainting. Texture persists in GPU memory until invalidated.

### Promotion criteria

- 3D or perspective CSS transforms
- `will-change: transform`, `will-change: opacity`
- CSS animations on transform or opacity
- Accelerated CSS filters
- `position: fixed` or `position: sticky`
- `<video>` with hardware decoding, `<canvas>` with WebGL
- Has composited descendant (ancestor promotion)
- Overlaps composited sibling at lower z-index (overlap promotion)

### Compositor-only path

For transform, opacity, some filters: animation runs entirely on compositor thread. Main thread never participates. Pipeline: Animate (compositor-side) -> Activate -> Aggregate -> Draw. This is why `transform` animations are silky even when JS blocks the main thread.

## Tiling

Each `PictureLayer` divided into tiles:
- Software raster: ~256x256px
- GPU raster: viewport-width x (viewport-height / 4)

### Tile management

- `TileManager` assigns priorities based on distance from viewport, scroll prediction
- Only tiles intersecting invalidation rects get re-rasterized
- Unaffected tiles remain cached
- Fast scrolling: low-res fallback tiles displayed while high-res ones rasterize

### Pending vs active tree

Compositor maintains two layer trees:
- **Pending tree**: staging where new tiles rasterize
- **Active tree**: currently being drawn
- Activation only when all visible high-res tiles ready (prevents showing incomplete content)

## GPU Acceleration

### CPU vs GPU work

| CPU | GPU |
|---|---|
| Style, Layout, Paint recording | Tile rasterization (GPU raster mode) |
| Display list generation | Compositing (layer drawing) |
| Tile priority calculation | Texture management, blending |
| Property tree construction | Frame buffer composition |

### Rasterization modes

**Software**: worker threads run Skia software rasterizer, upload bitmaps as GPU textures.

**GPU (Ganesh)**: Skia's OpenGL/Vulkan backend translates paint records directly to GPU commands.

**GPU (Graphite)**: Ganesh successor. Key improvements:
- Independent `Recorder` objects producing `Recording`s on multiple threads
- Hardware depth testing: each draw op gets z-value, GPU skips overdraw on opaque regions
- Consolidates shader pipelines (reduce compilation jank)
- Uses Dawn (WebGPU impl) as abstraction over Metal/Vulkan/D3D12
- 15% improvement on MotionMark 1.3
- Future: GPU compute path rasterization (inspired by Vello/Pathfinder)

## Incremental Layout

### Dirty subtree layout

Chrome does NOT relayout entire DOM. Dirty bits propagate upward from changed nodes. Only dirty subtrees traversed. Fragment tree is immutable: new fragments for changed subtrees, unchanged subtrees retain previous fragments.

### CSS Containment

`contain: layout`: nothing outside element affects internal layout. Stops dirty bit propagation. Measured: layout time from ~17ms to ~0.5ms.

`contain: paint`: creates new stacking context and formatting context, limits paint invalidation scope.

`content-visibility: auto`: combines all containment types + skips all rendering work for off-screen elements. Measured: 232ms to 30ms (7x improvement).

### Full relayout triggers

- Viewport resize
- Font loading affecting text metrics
- Writing-mode changes at root
- Table/flex container structural changes

## Comparison: Vello/Blitz vs Chrome

| Aspect | Chrome (Skia/Graphite) | Vello |
|---|---|---|
| Architecture | CPU records, GPU rasterizes tiles | GPU handles everything via compute shaders |
| Pipeline | Record (CPU) -> Raster tiles (GPU) -> Composite (GPU) | Encode scene (CPU) -> Flatten -> Bin -> Coarse -> Fine (all GPU) |
| Anti-aliasing | MSAA (Ganesh), depth testing (Graphite) | Area AA (analytical), MSAA8/16 |
| Incremental updates | Dirty tracking, subsequence caching, tile caching | **None -- full-frame re-render** |
| Intermediate storage | GPU texture tiles cached across frames | Per-tile command lists, consumed immediately |

Vello: up to 100x faster on raw rendering throughput. But zero incremental infrastructure -- re-renders full scene every frame. Chrome's optimization story is about *not rendering* unchanged things.

## What Blitz Currently Lacks

| Chrome has | Blitz status |
|---|---|
| Dirty subtree layout | Full relayout via Taffy |
| Display item caching | None, re-records everything |
| Composited layers (GPU texture cache) | None, no layer promotion |
| Tile-based rasterization | Full-frame Vello render |
| Compositor thread | Single-threaded |
| content-visibility offscreen culling | None |

## Highest-Value Optimizations to Port

For a Dioxus-native renderer (charts, datagrids, efficient rendering):

1. **Dirty subtree tracking**: Dioxus signals already provide this at component level. Wire signal subscriptions to "only re-record paint commands for changed components."

2. **Display item caching**: if a component didn't re-render, reuse its previous Vello scene fragment. Architecturally straightforward with Dioxus's diffing.

3. **Layer promotion for animated elements**: encode animated charts/scrolling as separate GPU textures. Animate texture, not content.

4. **Offscreen culling**: for datagrid with 10k rows, skip all work for off-viewport rows. Natural with Dioxus virtual DOM.

5. **Tile-based rasterization**: hardest to retrofit, matters less for app UIs than browser pages with massive scrollable content.
