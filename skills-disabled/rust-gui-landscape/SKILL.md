---
name: rust-gui-landscape
description: Rust GUI framework landscape -- Iced, Slint, Xilem, Floem, Makepad, Relm4 compared. Architecture, rendering, maturity, ecosystem, accessibility, licensing. Trigger on rust gui, iced gui, slint, xilem, floem, makepad, relm4, rust gui comparison, rust native gui, rust desktop framework.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

The retained-mode Rust GUI framework landscape beyond egui and Dioxus, as of early 2026. Honest maturity and capability assessment for each.

## Iced

### Architecture

Elm Architecture (TEA): State struct, Message enum, `update()` mutates state from messages, `view()` builds widget tree from state. Unidirectional data flow. No fine-grained reactivity -- every message causes full `view()` rebuild (though 0.14's reactive rendering minimizes GPU work by diffing visual output).

Closer to Redux than to signals. Predictable (time-travel debugging works naturally), more boilerplate for large UIs where only one leaf changed.

### Rendering

wgpu-based custom renderer. cosmic-text for text layout. 0.14+ reactive rendering: only changed widgets emit GPU commands (60-80% CPU reduction for mostly-static UIs). WebGPU backend for WASM.

### Version & Maturity

Current: 0.14.0 (December 2024). Pre-1.0, breaking changes between versions. Release cadence irregular (~2-4 months).

### Widget Ecosystem

Built-in (0.14): button, text_input, text_editor, scrollable, slider, toggler, checkbox, radio, pick_list, combo_box, tooltip, markdown, canvas, image, svg, **table** (new), **grid** (new), float, pin, sensor.

Community:
- `iced_aw`: tabs, card, modal, date/time pickers, color picker
- `plotters-iced`: Plotters charting backend
- `iced_plot`: GPU-accelerated plotting, millions of data points
- `iced_table`: dedicated table widget (also now built-in)

### Styling

Rust trait-based (`StyleSheet`). Themes via `Palette` (Oklch color space in 0.14). Per-widget-type styling. No CSS, no cascading, no selectors. Common complaint from web developers.

### Issues

- **No accessibility** (screen readers can't see iced windows)
- Documentation incomplete (book + examples, gaps)
- API instability (pre-1.0 breaking changes)
- No CSS-like styling
- Async ergonomics verbose vs signal frameworks

### Community

~29,900 stars, 1,525 forks, 409 open issues. MIT license. Primary maintainer: Héctor Ramón (hecrj). System76 provides financial backing through COSMIC desktop.

### Production Users

- **System76 COSMIC Desktop** -- full Linux DE (compositor, file manager, terminal, settings, app store)
- **Halloy** -- IRC client
- **Kraken** -- financial trading interfaces

## Slint

### Architecture

Declarative `.slint` DSL compiled to Rust (or C++/JS/Python). Reactive property system: property changes auto-propagate to dependent properties and UI. Closer to Qt/QML than Elm or React.

### Rendering

Three backends: FemtoVG (OpenGL ES 2.0), Skia, Software renderer (CPU, targets MCUs). Can also use Qt's QStyle for native widgets.

### Maturity

**Most mature.** Stable 1.x API with no-breaking-changes commitment within 1.x. Founded by former Qt engineers (KDAB alumni). Commercial company (SixtyFPS GmbH).

### Accessibility

**Best in class** among Rust GUI frameworks. Windows Narrator support. Full IME.

### Issues

- **Licensing**: GPL-3.0 / Royalty-Free (desktop) / Paid (embedded). The Qt business model reborn.
- **DSL lock-in**: `.slint` markup is proprietary, not portable
- **Two-language ergonomics**: `.slint` files + Rust code boundary can be awkward

### Community

~22,000 stars, 841 forks. Production users in embedded/industrial (OTIV rail automation, SK Signet EV chargers).

## Xilem (Linebender)

### Architecture

SwiftUI-inspired functional reactive. Compose "views" that diff against retained Masonry widget layer. Vello (GPU compute-shader vector renderer) for painting. Parley for text.

### Maturity

**Alpha.** No stable release. Been in development since 2022 (successor to Druid). Monthly progress blogs. Active but not production-usable.

### Widgets

Basic only: button, checkbox, text input, flex, grid, prose, canvas. No charts, tables, tree views.

### Community

~4,925 stars. Raph Levien (Google Fonts) is primary architect. Google-affiliated contributors.

### Production Users

None. Runebender (font editor) being ported as validation.

## Floem (Lapce)

### Architecture

**Signal-based reactive** (closest to SolidJS/Leptos in Rust GUI). Signals (`RwSignal::new()`), view tree constructed once and mutated in place. Layout via Taffy (flexbox/grid).

### Rendering

wgpu via Vger/Vello, tiny-skia fallback.

### Maturity

Pre-1.0, early. Built primarily for Lapce code editor. Experimental WASM support.

### Issues

- **No accessibility** (Narrator can't see window, no IME)
- Tuple-based widget composition limited to 16 children (Rust generics)
- Sparse documentation
- Small community outside Lapce

### Community

~4,058 stars, MIT license. Lapce is the only production user.

## Makepad

### Architecture

Retained-mode with custom DSL. **Shader-based styling** -- visual properties defined as GPU shader code. "Live design" system for hot-reloading UI without recompilation.

### Rendering

**GPU-only custom renderer.** Direct Metal (macOS), DX11 (Windows), OpenGL (Linux), WebGL (WASM). Everything is shaders.

### Maturity

1.0 released May 2025. Built for creative tools (DAWs, visual editors).

### Issues

- **No accessibility**
- **Documentation is Discord-only**, DSL undocumented publicly
- Opinionated Blender-like aesthetic, customizing requires shader knowledge
- Small team, limited community contributions

### Community

~6,247 stars, MIT license. Production: Robrix (Matrix client), Moly (AI client).

## Relm4 (GTK4)

### Architecture

Elm-like (MVU) on top of gtk4-rs. `view!` macro for declarative GTK widget construction. GTK4 does all rendering.

### Maturity

Stable. GTK4 is battle-tested. Good documentation (book-level).

### Widget Ecosystem

**Full GTK4 ecosystem** -- richest widget set of any option. libadwaita for adaptive layouts.

### Issues

- **GTK apps don't look native on Windows/macOS** (look like GNOME apps everywhere)
- Build dependencies painful on non-Linux (pkg-config, system libs)
- Narrator issues on Windows

### Community

~1,842 stars, Apache-2.0.

## Comparison Table

| | Iced | Slint | Xilem | Floem | Makepad | Relm4 |
|---|---|---|---|---|---|---|
| Architecture | Elm (TEA) | DSL + reactive | SwiftUI-like | Signal-based | Retained + shaders | Elm on GTK4 |
| Renderer | wgpu | Skia/FemtoVG/SW | Vello (compute) | wgpu/Vello | Custom GPU | GTK4 (Cairo) |
| Maturity | Pre-1.0 (0.14) | **1.x stable** | Alpha | Early | 1.0 (nominal) | Stable |
| Accessibility | None | **Best** | Partial | None | None | Partial |
| Tables | Built-in | Built-in | None | None | Basic | GTK ColumnView |
| Charts | plotters-iced | Limited | None | None | None | GTK plotting |
| Styling | Rust traits | DSL/Fluent/Material | Minimal | Inline | Shaders | GTK CSS |
| License | MIT | **GPL/RF/Paid** | Apache-2.0 | MIT | MIT | Apache-2.0 |
| Stars | ~29.9k | ~22k | ~4.9k | ~4k | ~6.2k | ~1.8k |

## 2025 Survey Result

The boringcactus survey tested 18 Rust GUI frameworks against basic criteria (builds, accessibility, IME, native feel). Only Slint, Dioxus (web mode), and Tauri passed all tests. 94.4% failure rate.

## Framework Selection Guide

**Need production stability today**: Slint (if licensing acceptable) or Relm4 (if Linux-first)
**Need reactive signals**: Floem (immature) or Dioxus (best model, immature native)
**Need to handle complex state at scale**: Iced (COSMIC proves it)
**Building creative/visual tools**: Makepad
**Long-term architectural bet**: Xilem (if you can wait years)
**Need accessibility**: Slint (only real option)
