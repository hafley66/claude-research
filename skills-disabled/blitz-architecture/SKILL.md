---
name: blitz-architecture
description: Dioxus Blitz rendering engine architecture -- package map, rendering pipeline (Stylo+Taffy+Vello), blitz-shell event loop, anyrender abstraction, headless usage. Trigger on blitz architecture, blitz packages, blitz rendering pipeline, dioxus native renderer, blitz-shell.
license: MIT
metadata:
  audience: developers
  workflow: ui-rendering
---

## What this covers

The Blitz rendering engine: a browser-style rendering pipeline in Rust that takes HTML or Dioxus RSX and renders it natively via GPU without a webview. Architecture, package responsibilities, data flow, and integration points.

## Package map

All packages live in the `DioxusLabs/blitz` repo under `packages/`.

| Package | Version | Role |
|---|---|---|
| `blitz-traits` | 0.2.0 | Base traits: NetProvider, ShellProvider, Viewport, event types |
| `blitz-dom` | 0.2.2 | Core headless DOM tree + 3-phase state machine (style/layout/events) |
| `stylo_taffy` | 0.2.0 | Bridge: Stylo ComputedValues to taffy::Style |
| `blitz-html` | 0.2.0 | html5ever wrapper, parses HTML into BaseDocument |
| `blitz-net` | 0.2.1 | Resource fetching (reqwest, data: URIs, file://) |
| `blitz-paint` | 0.2.1 | Walks laid-out DOM, emits anyrender paint commands |
| `blitz-shell` | 0.2.2 | Winit event loop, window lifecycle, event conversion, dev tools |
| `blitz` | 0.2.1 | High-level launcher for static HTML |
| `dioxus-native-dom` | 0.7.0 | VirtualDom mutation writer into BaseDocument |
| `dioxus-native` | 0.7.0 | Full Dioxus launcher (shell + renderer + components) |

## Rendering pipeline

```
HTML string  or  Dioxus RSX components
        |                  |
   html5ever          VirtualDom
        |            mutation_writer
        v                  v
   ┌─────────────────────────────────┐
   │      BaseDocument (blitz-dom)   │
   │                                 │
   │  Phase 1: STYLE (Stylo 0.12)   │
   │    selector match, cascade,     │
   │    inheritance                  │
   │    output: ComputedValues/node  │
   │                                 │
   │  Phase 2: LAYOUT (Taffy 0.9)   │
   │    ComputedValues -> Style      │
   │      (via stylo_taffy bridge)   │
   │    flex / grid / block / inline │
   │    output: Layout { x,y,w,h }  │
   │                                 │
   │  Phase 3: EVENTS               │
   │    winit -> DOM event dispatch  │
   └────────────┬────────────────────┘
                |
   ┌────────────v────────────────────┐
   │      blitz-paint                │
   │  walks layout tree, emits:     │
   │    backgrounds, borders, text,  │
   │    shadows, images, SVG,        │
   │    transforms, clips            │
   │  output: anyrender::PaintScene  │
   └────────────┬────────────────────┘
                |
      ┌─────────┼──────────┐
      v         v          v
  anyrender   vello_cpu  anyrender
  _vello      (fallback) _skia
  (GPU)                  (alt)
      |
  Vello 0.6 -> wgpu 27
      |
   pixels on screen
```

## blitz-shell: the event loop

Not just a winit wrapper. It's the application runtime that couples windows to documents.

**View struct** (one per window):
- `doc: Box<dyn Document>` -- the DOM being rendered
- `renderer: Rend` -- GPU backend (implements WindowRenderer)
- `waker: Option<Waker>` -- async task integration
- `pointer_pos`, `keyboard_modifiers`, `buttons` -- input state
- `animation_timer` -- animation frame scheduling
- `safe_area_insets` -- mobile safe area

**BlitzApplication** (implements winit ApplicationHandler):
- `windows: HashMap<WindowId, View<Rend>>` -- multi-window
- `pending_windows: Vec<WindowConfig<Rend>>` -- deferred init
- `event_queue: Receiver<BlitzShellEvent>` -- internal events

**Poll cycle**:
1. Winit event arrives
2. Convert to blitz UiEvent via convert_events.rs
3. `doc.handle_ui_event()` -- marks nodes dirty
4. `doc.poll(waker)` -- style resolve if dirty, layout if style-dirty
5. `paint_scene()` -- emit to anyrender
6. Renderer presents frame

**Built-in dev shortcuts**:
- Alt+D: layout visualization
- Alt+H: hover highlighting
- Alt+T: print taffy layout tree
- Ctrl+Plus/Minus/0: zoom

**Custom events** (BlitzShellEvent):
- `Poll { window_id }` -- document poll request
- `Navigate(NavigationOptions)` -- link clicks
- `Embedder(Arc<dyn Any>)` -- custom app events

## External dependencies

- **Stylo** 0.12: Mozilla's CSS engine. Full selector matching, cascade, inheritance.
- **Taffy** 0.9 (git rev): Flex, Grid, Block, Float layout. Owned by DioxusLabs.
- **Vello** 0.6: GPU 2D renderer. Compute shader path rasterization.
- **Parley** (git): Text layout and shaping (used by blitz-paint for text rendering).
- **html5ever** 0.37: HTML/XHTML parser.
- **Winit** 0.31.0-beta.2: Windowing (bleeding edge).
- **wgpu** 27: GPU abstraction.
- **AccessKit** 0.24: Accessibility (optional).

## Headless usage

Blitz can render without blitz-shell. The dioxus repo has a `native-headless` example:

```rust
// No window, no event loop
let dioxus_doc = DioxusDocument::new(config);
dioxus_doc.poll();                         // process DOM
paint_scene(&scene, &doc, scale, w, h);    // emit to Vello scene
vello_renderer.render_to_texture();        // GPU render to texture
```

This means the DOM+layout+paint pipeline can be embedded into any custom winit window, game engine (Bevy example exists), or overlay system.

## Stability (as of March 2025)

All 0.x versions. Key signals:
- Taffy pinned to git rev, not crates.io release
- Winit is a beta
- anyrender abstraction (multiple renderer backends) suggests paint API still being designed
- dioxus-native is 0.7.0, hard dependency on blitz (not optional)
- Active development, frequent breaking changes expected

## Key source files

- `packages/blitz-dom/src/document.rs` -- BaseDocument state machine
- `packages/blitz-dom/src/stylo.rs` -- Style resolution
- `packages/blitz-dom/src/layout/mod.rs` -- Layout engine
- `packages/stylo_taffy/src/convert.rs` -- CSS to Layout bridge
- `packages/blitz-paint/src/render.rs` -- Paint generation
- `packages/blitz-shell/src/window.rs` -- View struct, event handling
- `packages/blitz-shell/src/application.rs` -- BlitzApplication
