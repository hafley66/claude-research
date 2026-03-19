---
name: servo-rust-browser
description: Servo browser engine status, component ecosystem (Stylo, html5ever, Taffy), Blitz relationship, Ladybird Rust adoption, Verso (archived). Trigger on servo, rust browser, stylo, html5ever, browser engine rust, servo components, ladybird rust, blitz browser, web engine rust.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

The Rust browser engine landscape as of early 2026. Servo, its component ecosystem, Blitz's actual scope, and other players.

## Servo -- The Real Rust Browser Engine

**Status: Active and accelerating.**

### History

- Started at Mozilla Research ~2012
- Mozilla laid off Servo team August 2020, project went dormant ~2 years
- Transferred to Linux Foundation 2020, then Linux Foundation Europe 2023
- January 2023: external funding reactivated development
- Open governance via Technical Steering Committee

### Current State (2025-2026)

| Metric | Value |
|---|---|
| GitHub stars | ~36,000 |
| 2025 PRs merged | 3,183 (nearly double 2024's 1,771) |
| Contributors (2025) | 146 (8 with 100+ PRs each) |
| Monthly active contributors | ~42 |
| WPT pass rate | 48.2% -> 61.6% during 2025 (1.5M+ passing subtests) |

### Releases

- 0.0.1: October 2025
- 0.0.2: November 2025
- Continuing monthly through 0.0.4+
- **Alpha target: Summer 2026** (Linux and macOS)

### What it renders

- CSS: floats, tables, flexbox, fonts, font-variation-settings, CSS filters, inline SVG
- CSS Grid: still in progress
- JavaScript: Mozilla's SpiderMonkey (upgraded to v140, August 2025)
- Can render many real websites, complex sites still break

### Strategic angle: embeddable engine

Primary positioning is as an embeddable web engine, not competing head-on with Chrome/Firefox as daily driver:
- Embedding API being reworked (message-based -> handle-based)
- NLnet-funded project for Servo webview backend in Tauri via Wry (deadline April 2026)
- Already embedded by: Servo GTK, Servo Qt, Slint Servo, Cordova plugin
- `servoshell` (egui-based) is the first-party browser UI

### Funding

- NLnet / EU Next Generation Internet programme (specific work items)
- 4 bronze sponsors in 2025
- GitHub Sponsors tiers
- Igalia significant contributor
- Self-hosted CI runners funded
- Not VC-backed, dependent on external funding

## Blitz -- NOT a Browser

Blitz is a **rendering engine for Dioxus**, not a browser.

- Renders HTML+CSS to pixels using Servo components
- **No JavaScript** (explicitly out of scope)
- No networking stack, no browser chrome
- Purpose: power Dioxus Native apps, render ePUB/HTML email/markdown, HTML-to-image/PDF
- 3,400 stars, active development
- Listed on Servo's "Made with Servo" page
- Complements Servo, does not compete with it

### What Blitz uses from Servo

- **Stylo**: CSS parsing, selector matching, cascade, style resolution
- **html5ever**: HTML parsing

Plus non-Servo crates: Taffy (layout), Parley (text), Vello (GPU rendering), Winit (windowing).

## The Servo Component Ecosystem

Servo's most successful legacy. Standalone production crates used far beyond Servo:

| Crate | What | Used by |
|---|---|---|
| **Stylo** (`servo/stylo`) | Full CSS engine (Firefox's actual CSS engine since 2017) | Firefox, Blitz/Dioxus, Servo |
| **html5ever** | Spec-compliant HTML5 parser | Lightpanda, Blitz, scrapers, many tools |
| **cssparser** | Low-level CSS tokenizer/parser | Widely used in Rust CSS tooling |
| **selectors** | CSS selector matching | Standalone use |
| **url** | WHATWG URL parsing | Extremely widely used Rust crate |
| **Taffy** | CSS layout (flexbox, grid) | Blitz, Zed editor, Bevy UI |

These are usable independently. Blitz proves you can compose Stylo + Taffy + GPU renderer into a working pipeline without touching Servo's browser/networking stack.

## Ladybird

C++ browser engine (from SerenityOS), now independent under Ladybird Browser Initiative nonprofit.

**Rust adoption**: February 2026, adopted Rust as C++ successor language (abandoned Swift attempt due to poor C++ interop and limited non-Apple platform support). Ported JS parser and bytecode generator (~25,000 lines) from C++ to Rust in ~2 weeks using AI-assisted translation (Claude Code + Codex), with manual verification of byte-for-byte identical output. Incremental Rust porting going forward.

Timeline: Alpha 2026, beta 2027, stable 2028. Funded by Cloudflare, FUTO, Shopify, 37signals.

Not Rust-native but increasingly Rust-involved.

## Other Projects

### Gosub

From-scratch Rust browser engine. Active (pushed March 2026), 3,653 stars. HTML5 parser in development, CSS parser proof-of-concept, V8 for JavaScript. Very early, years from rendering real websites. Re-solving problems Servo already solved.

### Verso (Archived)

Browser built on Servo. Archived October 2025, 5,427 stars. Couldn't keep pace with Servo's changes. Contributions upstreamed to Servo. Servo's own `servoshell` now serves as first-party browser UI.

### Kosmonaut

Learning project, effectively dead since ~2021. Tiny CSS subset. Uses html5ever and cssparser.

## The Uncomfortable Truth

Nobody ships a daily-driver Rust browser today, and nobody will in 2026. Servo Summer 2026 alpha is the nearest milestone but still fails on complex real-world sites. The realistic near-term path is Servo-as-embeddable-engine (the Tauri/Wry angle) rather than Servo-as-standalone-browser. Building a browser engine is a decade-scale effort.

## Relationship Map

```
Servo (browser engine, 14 years in)
  ├─ Stylo (CSS) ──────→ Firefox (shipped 2017)
  │                   └─→ Blitz (Dioxus renderer)
  ├─ html5ever (HTML) ─→ Blitz, Lightpanda, many tools
  ├─ cssparser ────────→ widely used
  ├─ url ──────────────→ everywhere
  └─ Taffy (layout) ──→ Blitz, Zed, Bevy

Blitz (rendering engine, NOT browser)
  ├─ Uses: Stylo, html5ever, Taffy, Parley, Vello
  └─ Powers: Dioxus Native (dioxus-native crate)

Ladybird (C++ browser, adopting Rust)
  └─ Independent of Servo component ecosystem
```
