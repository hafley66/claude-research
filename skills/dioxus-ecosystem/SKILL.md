---
name: dioxus-ecosystem
description: Dioxus component ecosystem -- charts, tables, data grids, UI libraries, icons, forms, modals, theming, virtual scrolling. Ecosystem maturity vs egui. Trigger on dioxus charts, dioxus table, dioxus components, dioxus ui library, dioxus icons, dioxus ecosystem, dioxus crates, dioxus widgets.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

The Dioxus component ecosystem for native desktop apps: charts, tables, UI component libraries, and ecosystem maturity assessment as of March 2026. Current stable: v0.7.3 (Jan 2026).

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
| **dioxus-tabular** | 400 (218 recent) | Active (Nov 2025), v0.3.0 | Multi-column sort, per-column filter, column reorder/hide, data export. Type-safe column-as-component pattern. ~2800 LOC. 11 stars. MIT/Apache-2.0. |
| **table-rs** | 1,814 | Active (Mar 2026), v0.0.5 | Multi-framework (Yew/Dioxus/Leptos). Sort, pagination, search with URL sync. 21 stars. Has JS interop (207 lines JS). |
| **dioxus-sortable** | 5,539 | **Stale** (Nov 2023) | Generic sortable tables, PartialOrdBy trait. Stuck on pre-0.6 Dioxus. LGPL-3.0. 28 stars. |
| **dioxus-table** | 3,060 | **Abandoned** (May 2022) | Derive-macro table, 96 LOC. Not compatible with modern Dioxus. |

### Virtual scrolling

| Crate | Downloads | Status | Description |
|---|---|---|---|
| **dioxus-nox-virtualize** | 35 | Brand new (Mar 2026) | Virtual list viewport math, part of dioxus-nox monorepo (20+ crates). Zero community adoption yet. |
| **dioxus-lazy** | 2,389 | **Stale** (Oct 2024) | Alpha-only releases, not viable. |
| **dioxus-virtual-scroll** | unpublished | Experimental (Feb 2026) | Unpublished GitHub repo, not usable. |

### What does NOT exist

- No production-grade virtual scrolling
- No AG-Grid / TanStack Table equivalent (column resize, cell editing, row grouping, pinned columns, infinite scroll)
- No native Dioxus core table primitives (not on 0.8 roadmap)
- No drag-to-reorder columns (dioxus-tabular has programmatic reorder only)
- No cell editing -- all current solutions are read-only display
- No row virtualization integrated with any table crate

### Assessment

**dioxus-tabular** is the only option with sound architecture and active maintenance. Covers sorting/filtering/visibility but no virtualization, cell editing, or column resizing. **table-rs** adds pagination and search but has JS deps and targets three frameworks generically. Building a data-heavy grid requires substantial custom work on top of these primitives. Compose `dioxus-tabular` + custom virtual scroll for large datasets.

## UI Component Libraries

### Tier 1: Official / dioxus-community

| Crate | Stars | Downloads | Purpose |
|---|---|---|---|
| dioxus-free-icons | 185 | 103k | SVG icon sets |
| lucide-dioxus | -- | 29k | Lucide icon port |
| dioxus-charts | 89 | 14.5k | Bar/line/pie charts |
| dioxus-material | 25 | -- | Material Design 3 |
| dioxus-spring | 21 | -- | Animation framework |
| dioxus-i18n | 58 | 30k | Internationalization |
| dioxus-radio | 75 | -- | Global state with topic subscriptions |
| dioxus-helmet | 24 | -- | Document head management |
| dioxus-clipboard | 8 | -- | Clipboard access |

### Tier 1.5: DioxusLabs/components (First-party primitives)

- 280 stars, 273 commits, active
- Published as `dioxus-primitives` v0.0.0 (placeholder version)
- 28 foundational components: checkbox, radio_group, select, slider, switch, toggle, toggle_group, label, date_picker, calendar, and more
- Unstyled, ARIA-accessible, keyboard-navigable
- Shadcn-style styled variants via `dx components add`
- Gallery: dioxuslabs.com/components/
- **No form state management, validation, or submission logic** -- pure input primitives

### Tier 2: Community

| Crate | Downloads | What |
|---|---|---|
| **adui-dioxus** | 115 | Ant Design 6.0 port -- massive component set (Button, Form, Table, Modal, Drawer, DatePicker, TreeSelect, Upload, Carousel, Steps). 26 stars, Dec 2025. **Web-only (wasm32)**. Form with validation rules. |
| **dioxus-bootstrap** | 6,840 | Bootstrap components |
| **dioxus-tw-components** | 9,504 | Tailwind-based components |
| **lumen-blocks** | 557 | shadcn-inspired, built on dioxus-primitives |
| **shadcn-rust** | 6,733 | shadcn-style CLI for Rust frameworks |

### Tier 3: Headless (dioxus-nox family)

~24 crates, all very fresh (Mar 2026). Modal, Drawer, Toast, Command Palette (cmdk), Select/Combobox, Tabs, Tag Input, Timer, Toggle Group, Inline Confirm, Master-Detail layout, Shell layout, Markdown editor, Password Strength, Virtualize, DnD. All ARIA-accessible, unstyled, composable. v0.13.x. **Note: AI-generated learning project by author's own admission. Near-zero downloads (13-47 per crate). Not production-ready.**

### Forms

| Library | Form State | Dirty/Touched | Validation | Schema-based | Downloads |
|---------|-----------|---------------|------------|-------------|-----------|
| **dioxus-forms** (NEW, Dec 2025) | use_form hooks | **Yes** | **Sync + Async** | No | 51 |
| **vld + vld-dioxus** (NEW, Mar 2026) | N/A (validation only) | N/A | **Yes** | **Yes (Zod-like)** | 29 |
| dioxus-form | Serde serialization | No | No | No | 4,374 |
| adui-dioxus Form | Form/FormItem | Unclear | Rule-based | No | 115 |
| Dioxus 0.7 built-in | Signals (manual) | No | No | No | N/A |

**dioxus-forms** (github.com/ap-1/dioxus-forms) is the closest to React Hook Form: `use_form()` / `use_form_field()` / `use_field_bind()` hooks, dirty tracking, touched tracking, sync+async field-level validation, dynamic field arrays, conditional error display. Brand new, single release.

**vld + vld-dioxus** (github.com/s00d/vld) is the first real Zod-for-Rust: `schema!` macro, string/collection validators, composable (optional, nullable, default, refine, transform), union types, recursive schemas, JSON Schema/OpenAPI generation. `vld-dioxus` adds `validate_args!` for server functions, `check_field()` for reactive UI validation. Shared client/server validation rules.

**Gap**: No single library combines form state management (dioxus-forms) with schema validation (vld). A `dioxus-forms` + `vld` composition would be the closest analog to React Hook Form + Zod.

### Icons

Well-covered: dioxus-free-icons (103k dl), lucide-dioxus (29k), dxc-icons (1.9k), freya-icons (667).

### Maps

- **dioxus-leaflet** -- 3,970 dl

### Theming/Styling

- Built-in TailwindCSS support in Dioxus CLI
- Dioxus 0.7: scoped CSS, CSS modules
- dioxus_style (224 dl) -- compile-time scoped CSS/SCSS
- First-party primitives modeled after shadcn/Radix via `dx components add`

## Ecosystem Maturity: Dioxus vs egui

| Category | Dioxus | egui |
|---|---|---|
| Charts | `dioxus-charts` (3 types, 14k dl) | `egui_plot` (5.7M dl, built-in, rich) |
| Tables | Fragmented, ~5 crates, <6k dl each | `egui_table` (709k dl, integrated) |
| Virtual scroll | Nothing production-ready | Built into scroll areas |
| Icons | 103k dl, strong | Fewer options |
| Forms | dioxus-forms (51 dl, new), vld (29 dl, new) | Immediate-mode, built-in |
| Theming | Multiple CSS framework bindings | Built-in style system |
| Primitives | DioxusLabs/components (280 stars, 28 components) | Built-in |

### Community size

| Metric | Dioxus | egui |
|---|---|---|
| GitHub stars | 35.3k | 28.4k |
| Crate downloads (core) | 1.21M | ~70M+ |
| Used by (GitHub) | 3.9k | ~15k+ |

Dioxus has higher star count but much lower actual usage.

### Key gaps

1. No mature charting solution
2. No integrated data grid (sort + filter + virtual scroll + pagination + cell editing)
3. Component fragmentation (multiple competing half-finished libraries)
4. dioxus-forms and vld are days-to-weeks old, unproven
5. Most ecosystem crates target web, not native desktop
6. dioxus-nox is AI-generated, not production-ready despite breadth

### What works well

- Routing (first-party, 681k dl)
- Icons (well-covered)
- State management (signals, first-party, 1.1M dl)
- i18n
- First-party primitives (DioxusLabs/components, 28 accessible components, active)
- Server functions and fullstack data flow (0.7)
