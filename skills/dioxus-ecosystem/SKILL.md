---
name: dioxus-ecosystem
description: Dioxus component ecosystem -- charts, tables, data grids, UI libraries, icons, forms, modals, theming, virtual scrolling. Ecosystem maturity vs egui. Trigger on dioxus charts, dioxus table, dioxus components, dioxus ui library, dioxus icons, dioxus ecosystem, dioxus crates, dioxus widgets.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

The Dioxus component ecosystem for native desktop apps: charts, tables, UI component libraries, and ecosystem maturity assessment as of early 2026.

## Charts / Visualization

### dioxus-charts (primary option)

- github.com/dioxus-community/dioxus-charts -- 89 stars, 14.5k downloads, v0.4.0 (Jan 2026)
- SVG-based, CSS-customizable
- Chart types: PieChart (pie/donut/gauge), BarChart (vertical/horizontal/stacked), LineChart
- Works for web and desktop
- **Limitation**: only 3 chart types, no scatter, heatmap, candlestick

### plotters-dioxus

- 11 stars, 5.5k downloads -- **stale** (pre-0.5 Dioxus API)
- Wraps the `plotters` crate as a Dioxus component
- Would need porting to 0.7

### Other approaches

- **plotters** SVG output embedded via `dangerous_inner_html`
- **charming** (ECharts binding) -- only viable through WebView JS interop
- **JS chart libs** (Chart.js, D3, ECharts) via `eval` in desktop mode -- most practical path for complex charting since Dioxus desktop runs on WebView anyway
- No dedicated Freya charting crate exists

### Assessment

Charting is thin. `dioxus-charts` covers basics. For anything beyond bar/line/pie: render plotters to SVG and embed, or use JS chart libs through the WebView.

## Tables / Data Grids

| Crate | Downloads | Status | Features |
|---|---|---|---|
| **dioxus-tabular** | 396 | Active (Oct 2025) | Multi-column sort, per-column filter, column reorder/hide, data export |
| **dioxus-sortable** | 5,536 | Stale (Nov 2023) | Generic sortable tables, type-safe |
| **dioxus-table** + macro | 3,060 | Stale | Derive-macro-driven table rendering |
| **table-rs** | 1,808 | -- | Cross-framework (Yew/Dioxus/Leptos) |

### Virtual scrolling

| Crate | Stars/Downloads | Description |
|---|---|---|
| **dioxus-lazy** (dioxus-community) | 32 stars | Virtualized list, sync/async item factories |
| **dioxus-nox-virtualize** | 31 dl | Virtual list viewport math |
| **dioxus-recycle-list** | 17 dl | Dynamic-height virtualized list |
| **dioxus-virtual-window** | 15 dl | Virtualized scrolling hooks |

### Assessment

**dioxus-tabular** is the most feature-complete table. No single crate provides sort + filter + virtual scroll + pagination + inline editing as one package. Compose `dioxus-tabular` + `dioxus-lazy` for large datasets. Significant gap vs egui where `egui_table` has 709k downloads.

## UI Component Libraries

### Tier 1: Official / dioxus-community

| Crate | Stars | Downloads | Purpose |
|---|---|---|---|
| dioxus-free-icons | 185 | 103k | SVG icon sets |
| lucide-dioxus | -- | 29k | Lucide icon port |
| dioxus-charts | 89 | 14.5k | Bar/line/pie charts |
| dioxus-lazy | 32 | -- | Virtual scrolling |
| dioxus-material | 25 | -- | Material Design 3 |
| dioxus-spring | 21 | -- | Animation framework |
| dioxus-i18n | 58 | 30k | Internationalization |
| dioxus-radio | 75 | -- | Global state with topic subscriptions |
| dioxus-helmet | 24 | -- | Document head management |
| dioxus-clipboard | 8 | -- | Clipboard access |

### Tier 2: Community

| Crate | Downloads | What |
|---|---|---|
| **adui-dioxus** | 115 | Ant Design 6.0 port -- massive component set (Button, Form, Table, Modal, Drawer, DatePicker, TreeSelect, Upload, Carousel, Steps). 26 stars, very new (Dec 2025). **Web-only (wasm32)**. |
| **dioxus-bootstrap** | 6,840 | Bootstrap components |
| **dioxus-tw-components** | 9,504 | Tailwind-based components |
| **lumen-blocks** | 557 | shadcn-inspired, built on dioxus-primitives |
| **dioxus-primitives** | 1,193 | Official unstyled foundation -- **placeholder, v0.0.0** |
| **shadcn-rust** | 6,733 | shadcn-style CLI for Rust frameworks |

### Tier 3: Headless (dioxus-nox family)

~24 crates, all very fresh. Modal, Drawer, Toast, Command Palette (cmdk), Select/Combobox, Tabs, Tag Input, Timer, Toggle Group, Inline Confirm, Master-Detail layout, Shell layout, Markdown editor, Password Strength. All ARIA-accessible, unstyled, composable. v0.13.x.

### Forms

- **dioxus-form** -- 4,374 dl, automatic form serializer
- adui-dioxus has Form with validation rules

### Icons

Well-covered: dioxus-free-icons (103k dl), lucide-dioxus (29k), dxc-icons (1.9k), freya-icons (667).

### Maps

- **dioxus-leaflet** -- 3,970 dl

### Theming/Styling

- Built-in TailwindCSS support in Dioxus CLI
- Dioxus 0.7: scoped CSS, CSS modules
- dioxus_style (224 dl) -- compile-time scoped CSS/SCSS
- Dioxus 0.7 mentions first-party primitives modeled after shadcn/Radix

## Ecosystem Maturity: Dioxus vs egui

| Category | Dioxus | egui |
|---|---|---|
| Charts | `dioxus-charts` (3 types, 14k dl) | `egui_plot` (5.7M dl, built-in, rich) |
| Tables | Fragmented, ~5 crates, <6k dl each | `egui_table` (709k dl, integrated) |
| Virtual scroll | `dioxus-lazy` (32 stars) | Built into scroll areas |
| Icons | 103k dl, strong | Fewer options |
| Forms | Basic (4k dl) | Immediate-mode, built-in |
| Theming | Multiple CSS framework bindings | Built-in style system |

### Community size

| Metric | Dioxus | egui |
|---|---|---|
| GitHub stars | 35.3k | 28.4k |
| Crate downloads (core) | 1.21M | ~70M+ |
| Used by (GitHub) | 3.9k | ~15k+ |

Dioxus has higher star count but much lower actual usage.

### Key gaps

1. No mature charting solution
2. No integrated data grid (sort + filter + virtual scroll + pagination)
3. Component fragmentation (multiple competing half-finished libraries)
4. adui-dioxus promising but embryonic (115 downloads, web-only)
5. dioxus-primitives is a placeholder (v0.0.0, 12 lines of code)
6. Most ecosystem crates target web, not native desktop

### What works well

- Routing (first-party, 681k dl)
- Icons (well-covered)
- State management (signals, first-party, 1.1M dl)
- i18n
- dioxus-nox family (architecturally sound headless components, if it gains traction)
