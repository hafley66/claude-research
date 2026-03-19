---
name: dioxus-warts-status
description: Dioxus known issues, warts, gotchas, pending breaking changes, community health, risk factors for adoption. Subsecond bugs, native renderer crashes, mobile gaps, 0.8 roadmap. Trigger on dioxus bugs, dioxus issues, dioxus gotchas, dioxus status, dioxus roadmap, dioxus 0.8, dioxus stability, dioxus risks.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Current warts, known issues, pending changes, and community health assessment for Dioxus as of early 2026. Current stable: v0.7.3.

## Subsecond Hot-Patching (19 open bugs)

The 0.7 flagship feature. Works in happy-path (single crate, mold linker, macOS/Linux) but has substantial edge cases:

### Linker sensitivity
- Only reliable with `mold` linker (#4713)
- Fails with `wild` linker (#4158), `rust-lld.exe` on Windows (#4694), `target-cpu=native` (#4962)

### Windows issues
- Fails outside VS command prompt (#4911)
- Breaks on first build in empty project (#4692)
- Doesn't patch binary properly (#4890)

### Other
- Hotpatching and hotreloading can disable each other (#5317)
- WASM: `RefCell: Already borrowed` panics (#4902), bloats release bundle (#5131)
- Doesn't detect changes in all workspace crates (#5314)
- Router crashes with >5 routes (#4632)
- Restarting doesn't compile latest changes (#4671)
- Stack overflow in `dioxus_devtools::serve_subsecond` (#5311)
- Tailwind class edits don't regenerate CSS during hotpatch (#4231)

## Native Renderer Issues (dioxus-native / Blitz)

Explicitly pre-alpha:

- Minimal app instantly crashes on Windows (#4901)
- SIGSEGV on window close (#5128)
- Blank window on NixOS (#5133)
- Checkbox signals don't propagate (#5282)
- Incompatible with `sea-orm` (#4866)
- Bevy integration panics on interaction (#4854)
- Tracking issue #4479 for "Native parity with Desktop"

## Desktop (WebView) Issues

- Empty window on Linux (#3845)
- Tray icon broken on macOS (#3635)
- `document::Title` doesn't affect window title on Wayland (#4425)
- XDG_DATA_HOME pollution during dev on Linux (#4444)
- CSP level lower than Tauri (#2713)

## Mobile Issues

- iOS App Store deployment broken (#3817)
- iOS simulator scrolling prevents execution (#4894)
- No mobile permissions support (#3870)
- No native file picker (#3849)
- Android 9.0 incompatible (#3401)
- Android app icon broken (#3685)
- Android template build fails on Windows (#5118)
- Android bundling fails on NixOS (#3762)

## Build and CLI

- `wasm-opt` fails with status code 6 (#5119)
- Tailwind CSS bundling broken (#3721)
- Windows server filename randomization prevents firewall config (#3787)
- `dioxus-cli` installation linking failure on Windows (#3886)

## 0.8 Roadmap

Milestone 14% complete (8/54 issues), originally due June 30, 2025 (8+ months overdue). Discussion #5024.

### Headline features planned
- Native API overhaul: custom permissions, Swift/Kotlin/Java FFI
- Native SwiftUI/Kotlin widget embedding
- Subsecond workspace improvements
- Proper `event.target` across webview boundaries
- DOM API standardization across platforms
- Portal support
- DX tool extraction to separate repo
- Migration from webview to Winit for dioxus-webview
- Liveview merged into fullstack (breaking, #2699)

### Stretch goals
- Rust-only builder patterns (HTML macro alternatives)
- VSCode/Cursor inline simulator
- `dx deploy` command
- Plugin support, web-worker support, generic Android support

### Planned breaking changes
- Liveview merging into fullstack (#2699)
- `children` always generated on prop builders (#2281)
- Signals-as-functions restricted to `Copy` instead of `Clone` (#4412)
- Props spreading rework (#1870)
- Context providers `Arc` -> `Box` (#4696)
- WebSocket naming standardization (#4917)
- Navigator and RouterContext merged (#3206)
- Compile-time validation for GET request bodies (#4906)

### Active infrastructure PR
#5328 by jkelleyrtp: ripping out Tauri bundler (v2), replacing SWC with esbuild, CI overhaul.

## Community Health

### Core team
- **jkelleyrtp** (Jon Kelley): creator, primary architect, active March 2026
- **ealmloff** (Evan Almloff): second core contributor, bug fixes, hydration, stores
- Both consistently active on recent PRs

### Funding
GitHub Sponsors page exists. README mentions "full-time core team." Structure opaque. Appears to be a small org (2-3 core members), not VC-backed.

### Contribution patterns
- 61 contributors for 0.6-to-0.7 release
- Architecture decisions dominated by jkelleyrtp and ealmloff
- Community contributions tend to be bug fixes and small features
- Multiple unanswered Q&A discussions (community support capacity stretched)

### Concerns
- 599 open issues, substantial backlog for team size
- 0.8 milestone 8+ months overdue (planning optimism)
- The web target is the most mature path; native desktop and mobile lag significantly

## Risk Factors for Adoption

1. **Native renderer is pre-alpha.** Crashes on Windows, segfaults, blank windows.
2. **Subsecond is fragile.** 19 open bugs, linker-specific, platform-specific.
3. **Mobile is early.** No permissions, no file picker, iOS/Android deployment issues.
4. **Small core team.** Two people carrying web, desktop, mobile, native, SSR, CLI.
5. **Breaking changes incoming.** 0.8 changes signal APIs, merges liveview, reworks props/context.
6. **Milestone slippage.** 0.8 is 8+ months late.
7. **Desktop webview is stable-ish** but has platform-specific issues.
8. **Web target is most mature.** If targeting native desktop, expect rougher edges.

## Dioxus vs egui for Native Desktop

| | Dioxus | egui |
|---|---|---|
| Paradigm | Retained-mode virtual DOM | Immediate-mode |
| Rendering | WebView (stable) or Blitz (pre-alpha) | Custom GPU (epaint/wgpu), stable |
| Styling | CSS, Tailwind | Programmatic Rust structs |
| State | Signals (reactive/unidirectional) | Immediate: checked every frame |
| Maturity | Pre-1.0, frequent breaking changes | Stable API, widely used in production |
| Hot reload | Subsecond (ambitious but buggy) | N/A (immediate mode = instant) |
| Best for | Cross-platform apps also targeting web | Dev tools, data viz, debug UIs, game panels |

egui is stable and predictable. Dioxus is ambitious and volatile. For native desktop specifically, egui has production track record. Dioxus Native is pre-alpha with crash bugs.
