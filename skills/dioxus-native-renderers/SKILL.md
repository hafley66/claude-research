---
name: dioxus-native-renderers
description: Dioxus native rendering backends -- Blitz (Stylo+Taffy+Vello), Freya (tiny-skia), WebView (Wry). Architecture, status, maturity, comparison. Trigger on dioxus native, dioxus blitz, dioxus freya, dioxus skia, dioxus desktop rendering, dioxus wry, dioxus vello, dioxus-native.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

The three rendering paths for Dioxus desktop/native apps: WebView (Wry), Blitz (dioxus-native), and Freya. Current status as of early 2026.

## Path 1: WebView (Wry) -- Stable Default

Uses the OS webview (WebKit on macOS/Linux, WebView2 on Windows) via Wry/Tao (same stack as Tauri).

- Rust code runs natively in same process; webview only handles painting
- No IPC bridge needed for system access
- JS interop via `eval` for reaching into the webview
- Full CSS/JS support
- **Production-ready**

When to pick: need stability today, need full CSS/JS, acceptable browser runtime overhead.

## Path 2: Blitz / dioxus-native -- Alpha (GPU-rendered)

Shipped as `dioxus-native` in Dioxus 0.7. Pre-alpha quality. "Do not recommend building production applications with it."

**Repository**: github.com/DioxusLabs/blitz (1,231+ workflow runs, active development)

### Architecture

| Layer | Library | Purpose |
|---|---|---|
| CSS parsing + resolution | **Stylo** (Firefox/Servo) | Full CSS engine, battle-tested |
| Box layout | **Taffy** | Flexbox + Grid |
| Text layout | **Parley** | Text shaping and layout |
| GPU rendering | **Vello** (via wgpu) | GPU compute renderer (Linebender) |
| HTML parsing | **html5ever** | Standard HTML parser |
| Windowing | **Winit** | Cross-platform windows |
| Accessibility | **AccessKit** | Native a11y integration |

### Crate structure

- `blitz-dom` -- core DOM with style resolution, layout, event handling
- `blitz-html` -- HTML/XHTML parsing
- `blitz-paint` -- DOM to drawing commands
- `blitz-renderer-vello` -- concrete Vello+wgpu renderer
- `blitz-shell` -- window/rendering integration
- `blitz-net` -- resource fetching
- `dioxus-native` -- wraps everything for Dioxus VirtualDOM

### What works

- Complex website layouts "indistinguishable from Chrome and Safari"
- Flexbox, Grid, table, block, inline, absolute/fixed positioning
- Complex CSS selectors, media queries, CSS variables
- Basic `<form>` support
- AccessKit accessibility
- Hover styling, animations
- Custom widget support
- Named grid sections

### What doesn't work yet

- Not every CSS feature (check blitz.is/status/css for matrix)
- Writing direction bugs
- Missing many event types (mouseover, some form events)
- Missing widget types (some input types, iframe)
- Pages requiring JavaScript don't render
- Performance not yet focused on
- No WebRTC, WebSockets, localStorage (use Rust crates directly)
- Crashes on Windows (#4901), SIGSEGV on window close (#5128), blank on NixOS (#5133)
- Checkbox reactivity broken (#5282)

### Binary size

~12MB

### Release timeline

- Dioxus 0.6: Blitz not yet integrated
- Dioxus 0.7: shipped as `dioxus-native`, alpha
- Dioxus 0.8: continued investment toward production-ready

## Path 3: Freya -- Community (CPU-rendered via tiny-skia)

**Repository**: github.com/marc2332/freya -- 2.6k stars, 103 forks

### Critical change: Freya v0.4 drops Dioxus entirely

- v0.1-v0.3: used Dioxus VirtualDOM, RSX macro, hooks, reactivity
- v0.4 (in development, PR #1351): own reactive core, no more `rsx!()`, own component model
- Removed from Dioxus README in January 2026
- Now a separate GUI framework, not "the Skia renderer for Dioxus"

### Rendering

Uses **tiny-skia** (not full Skia):
- CPU-only, no GPU rendering
- Pure Rust, ~14 KLOC, compiles in <5s, adds ~200KB to binary
- 20-100% slower than real Skia on x86-64, 100-300% slower on ARM
- Still faster than cairo and raqote
- Runs on Raspberry Pi
- Perf tip: `RUSTFLAGS="-Ctarget-cpu=haswell"` for AVX on x86

### Elements and components

Own element set (not HTML):
- `rect` (container, analogous to div), `label` (text)
- Built-in components: Button, Switch, Slider, Checkbox, Input, Link, ScrollView, VirtualScrollView, Accordion, Tabs, Table, Calendar, ColorPicker, Dropdown

### Maturity

- Single primary maintainer (Marc Espin)
- v0.3 stable on crates.io, v0.4 is a breaking rewrite
- "Basically usable if you don't mind living on the bleeding edge and putting up with some jank" (2025 survey)
- No third-party ecosystem

## Comparison Table

| | Freya | Blitz/dioxus-native | WebView (Wry) |
|---|---|---|---|
| Status | v0.3 stable, v0.4 rewrite | Alpha (Dioxus 0.7) | Production-ready |
| Rendering | CPU (tiny-skia) | GPU (Vello/wgpu) | System webview |
| Backing | Solo maintainer | DioxusLabs org | Tauri team |
| CSS support | N/A (own elements) | Partial (Stylo, growing) | Full |
| Component lib | ~15 built-in | HTML elements + CSS | Entire web ecosystem |
| Accessibility | Limited | AccessKit | Native webview a11y |
| Ecosystem | None beyond built-in | Early | Massive |
| Binary size | Small (~200KB added) | ~12MB | Depends on platform webview |

## When to pick each

**Freya**: non-HTML component model, constrained hardware, small dependency tree, willing to track single maintainer. Note: no longer Dioxus-compatible as of v0.4.

**Blitz/dioxus-native**: HTML/CSS knowledge, want official Dioxus path, need GPU rendering, need accessibility, want web+native from same codebase. Accept alpha-quality crashes.

**WebView (Wry)**: production stability today, full CSS/JS, massive web ecosystem, acceptable browser overhead.
