# Cross-Engine Intent: will Firefox/Safari implement the Chromium-only CSS/HTML?

*Compiled 2026-05-31. Positions read directly from `mozilla/standards-positions` and `WebKit/standards-positions` GitHub labels (authoritative). Companion to `css-language-features-and-mindbenders.md` and `native-css-jutsu.md`.*

> **Headline:** the gap is closing on the high-profile features and widening on the long tail. Catch-up is selective — concentrated on features that have a formal standards position AND/OR Interop backing. The two flagship "CSS as a language" features, **`if()` and `@function`, are the riskiest**: neither Mozilla nor WebKit has taken a position, and neither is in Interop 2026.

## Legend
Mozilla labels: `positive` / `neutral` / `negative` / `defer` / (none = no signal). WebKit labels: `support` / `neutral` / `oppose` / `blocked` / (none = no signal). "No signal" = an issue exists but carries no `position:` label.

## Summary table

| # | Feature | Chrome | Safari | Firefox | Moz | WebKit | Interop 2026 | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | `if()` | ✅ 137 | ❌ | ❌ | none | none | No | **No signal** |
| 2 | `@function` | ✅ 139 | ❌ | ❌ | none | none | No | **No signal** |
| 3 | typed `attr()` | ✅ 133 | ❌ | ❌ | **positive** | none | **Yes** | Likely soon |
| 4 | `sibling-index/count` | ✅ 138 | ✅ 26.2 | ❌ | positive | support | No | Catching up |
| 5 | scroll-state CQ | ✅ 133 | ❌ | ❌ | none | none | No | **No signal** |
| 6 | customizable `<select>` | ✅ 135 | TP only | ❌ | positive | support | No | Likely soon |
| 7 | `field-sizing` | ✅ 123 | ✅ 26.2 | ❌ | positive | support | No | Catching up |
| 8 | `interpolate-size`/`calc-size` | ✅ 129 | ❌ | ❌ | positive | none | No | **Contested** |
| 9 | CSS Carousel (`::scroll-marker`) | ✅ 135 | ❌ | ❌ | none | none | No | **No signal** |
| 10 | `reading-flow`/`reading-order` | ✅ 137 | ❌ | ❌ | none | none | No | **No signal** |
| 11 | `corner-shape`/`superellipse()` | ✅ 139 | ❌ | ❌ | none | support | No | **Contested** |
| 12 | cross-doc view transitions | ✅ 126 | ✅ 18.2 | flag | positive | support | **Yes** | Catching up |
| 13 | scroll-driven animations | ✅ 115 | ✅ 26.0 | Nightly | positive | support | **Yes** | Catching up |
| 14 | anchor positioning | ✅ 125 | ✅ 26.0 | ✅ 147 | positive | support | **Yes** | **Cross-engine ✓** |
| 15 | `caret-animation` | ✅ 139 | ❌ | ❌ | none | none | No | **No signal** |

## Three tiers to design against

**Safe — genuine cross-engine intent (ordered by strength):**
1. Anchor positioning — shipped in all 3 engines. The clearest success story.
2. Scroll-driven animations — 2 stable + Firefox Nightly default + Interop 2026.
3. Cross-document view transitions — Chrome + Safari stable, Firefox has same-doc + Interop 2026 commits cross-doc.
4. `field-sizing` — 2 stable (Chrome + Safari 26.2), both positions affirmative, Firefox bug [1832409](https://bugzilla.mozilla.org/show_bug.cgi?id=1832409).
5. `sibling-index()`/`sibling-count()` — 2 stable (Chrome + Safari 26.2), both affirmative.
6. Typed `attr()` — Mozilla positive ([#1143](https://github.com/mozilla/standards-positions/issues/1143)) + **Interop 2026 focus area**; WebKit issue unlabeled but Interop participation is the stronger signal. WebKit impl bug [26609](https://bugs.webkit.org/show_bug.cgi?id=26609).
7. Customizable `<select>` — Mozilla positive ([#1060](https://github.com/mozilla/standards-positions/issues/1060), w/ `concerns: compatibility`), WebKit support ([#386](https://github.com/WebKit/standards-positions/issues/386)), Safari TP 238 has a working impl.

**Contested — one engine in, one silent (enhancement only, watch closely):**
- `interpolate-size`/`calc-size()` — Mozilla positive ([#1022](https://github.com/mozilla/standards-positions/issues/1022)), **WebKit silent** ([#348](https://github.com/WebKit/standards-positions/issues/348) open, unlabeled). This is the one gating cross-browser animated `<details>`/accordions — risky on the Safari side.
- `corner-shape`/`superellipse()` — WebKit support ([#229](https://github.com/WebKit/standards-positions/issues/229)), **Mozilla silent** ([#823](https://github.com/mozilla/standards-positions/issues/823)). Apple-friendly (squircles), so WebKit impl plausible; Firefox is the risk.

**Risky — Chromium-only, zero cross-engine commitment (do NOT build a foundation on these):**
- `if()` — Moz [#1167](https://github.com/mozilla/standards-positions/issues/1167) no label, WebKit [#453](https://github.com/WebKit/standards-positions/issues/453) no label.
- `@function` — Moz [#1148](https://github.com/mozilla/standards-positions/issues/1148) no label, WebKit [#437](https://github.com/WebKit/standards-positions/issues/437) no label.
- scroll-state container queries — Moz [#896](https://github.com/mozilla/standards-positions/issues/896), WebKit [#261](https://github.com/WebKit/standards-positions/issues/261), both unlabeled.
- CSS Carousel (`::scroll-marker`/`::scroll-button`) — both open with **i18n + a11y concerns** attached, no position (Moz [#1161](https://github.com/mozilla/standards-positions/issues/1161), WebKit [#447](https://github.com/WebKit/standards-positions/issues/447)).
- `reading-flow`/`reading-order` — Moz [#1056](https://github.com/mozilla/standards-positions/issues/1056), WebKit [#378](https://github.com/WebKit/standards-positions/issues/378), no labels.
- `caret-animation` — Moz [#1100](https://github.com/mozilla/standards-positions/issues/1100), WebKit [#417](https://github.com/WebKit/standards-positions/issues/417) (filed by Igalia, slightly warmer), no positions.

## Interop 2026 — the formal commitment device (20 focus + 4 investigation)

Once a feature is an Interop focus area, all three vendors have signed up to pass the same WPT tests. Full 2026 list ([web.dev](https://web.dev/blog/interop-2026), [WebKit](https://webkit.org/blog/17818/announcing-interop-2026/), [interop README](https://github.com/web-platform-tests/interop/blob/main/2026/README.md), [Mozilla Hacks](https://hacks.mozilla.org/2026/02/launching-interop-2026/)):

Container style queries · **CSS anchor positioning** · **CSS attr()** · CSS contrast-color() · CSS zoom · Custom highlights · Dialogs and popovers (`closedby`, `:open`, `popover=hint`) · Fetch uploads/ranges · IndexedDB · JSPI for Wasm · Media pseudo-classes · Navigation API · Scoped custom element registries · **Scroll-driven animations** · Scroll snap · **CSS shape()** · **View transitions (incl. cross-document)** · Web compat · WebRTC · WebTransport.
Investigation: Accessibility testing · JPEG XL · Mobile testing · WebVTT.

Of the 15 researched features, only **4** are formal Interop 2026 commitments: typed `attr()`, view transitions (incl. cross-doc), scroll-driven animations, anchor positioning (plus container *style* queries and `shape()` adjacent).

## How much Safari/Firefox actually shipped in 2025-2026 (momentum)

- **Safari 26.0** (Sep 2025): anchor positioning, scroll-driven animations, `text-wrap: pretty`, `contrast-color()`, `progress()`, `margin-trim`. ([WebKit](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/))
- **Safari 26.2** (Dec 2025): `field-sizing`, `sibling-index()`/`sibling-count()`, Navigation API, invoker commands. ([WebKit](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/))
- **Safari 26.4** (2026): threaded scroll-driven animations, anchor refinements. ([WebKit](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/))
- **Safari TP 238/242** (2026): customizable `<select>` (preview).
- **Firefox 144** (Oct 2025): same-document view transitions, invoker commands.
- **Firefox 147** (Jan 13 2026): **anchor positioning stable** — the headline Firefox catch-up. Meta bug [1838746](https://bugzilla.mozilla.org/show_bug.cgi?id=1838746) (~28 open edge-case deps).
- **Firefox Nightly 136+:** scroll-driven animations default-on (not yet Release).
- **Interop 2025 result:** [97% year-end](https://webkit.org/blog/17808/interop-2025-review/) (from 29% baseline); Safari jumped 43→99, the largest gain.

## On "Google ships ahead of consensus"

No direct "Google ships too fast" quote surfaced from Mozilla/Apple in 2025-2026 Interop posts. The framing is structural, not rhetorical: Mozilla frames Interop as "a cross-browser commitment" distinct from each vendor's roadmap; WebKit frames 2025 as "convergence." The real signal is in the data — features get cross-engine traction once they enter Interop, and the six no-signal features above are exactly the ones Chrome shipped without first securing positions from the other two engines.

## Stale / conflicting flags
- Several summaries claimed `field-sizing` shipped in Safari 26.0 — wrong, it's **26.2**.
- `sibling-index/count` Firefox impl: **not** confirmed shipped (no Firefox version found); Safari 26.2 confirmed.
- Scroll-driven animations in Firefox: sources say "soon/weeks"; concrete state is **Nightly-136+-default only**, still flagged in Release.
- `corner-shape` Mozilla #823: could not confirm a labeled close — treated as **no signal** pending a labeled position.
