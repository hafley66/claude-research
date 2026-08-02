# native-css-jutsu

<!-- Staging note: frontmatter stripped so this stays a plain report and does NOT auto-register
     as a skill. To promote: move a copy to commands/ or skills/native-css-jutsu/SKILL.md and
     restore the description/argument-hint frontmatter. Original frontmatter:
     description: Prime with current native CSS/HTML capabilities (anchor positioning,
       scroll-driven animations, View Transitions, native widgets) to replace JS UI libs.
       Least-JS frontend jutsu for docs/graph/filesystem-explorer tooling.
     argument-hint: [anchor|scroll|view-transitions|widgets|all] -->


Frontend jutsu: do natively in CSS/HTML what used to need JS libraries. Built for docs
tooling, native graph drawing, and filesystem-explorer UIs where the goal is **least JS,
let CSS do its thing**. The throughline: native popover + anchor positioning kills
popper.js / Floating UI / MUI Popper, View Transitions kills page-transition libs,
`<details name>` + `::details-content` kills accordion libs, container queries kill
ResizeObserver components, `@property` + `color-mix` + relative color kill runtime Sass.

`$ARGUMENTS` selects a focus section (`anchor`, `scroll`, `view-transitions`, `widgets`,
or `all`). Default `all`.

**Research date: 2026-05-31.** Browser status moves fast; the staleness flags at each
section tell you what to re-verify at caniuse/MDN before relying on it.

---

## 0. Baseline tier cheat-sheet — what's safe in 2026

Three tiers. Build on tier 1 unconditionally, progressively-enhance with tier 2/3.

| Tier | Meaning | Features |
|---|---|---|
| **1. Widely available** | Safe everywhere, no polyfill | Popover API, `:has()`, nesting, container queries (size), subgrid, `@layer`, `color-mix()`, `@property`, `oklch`/`oklab`, `text-wrap: balance`, `<dialog>`, scroll-snap, `inert`, `aspect-ratio`, `-webkit-line-clamp` |
| **2. Newly available** | Mostly safe, verify Firefox/Safari version | View Transitions (same-doc), `light-dark()`, relative color, `@scope`, `@starting-style`, `<details name>`, `text-wrap: pretty`, cross-doc View Transitions |
| **3. Limited (Chromium-only / flagged)** | Progressive-enhance only, NOT portable | **CSS Anchor Positioning** (needs polyfill), **Scroll-Driven Animations** (no Safari), customizable `<select>`, `field-sizing`, CSS Carousel (`::scroll-button`/`::scroll-marker`), `reading-flow`, `interpolate-size`/`calc-size()`, `::details-content` animation, `text-box-trim` |

Sources for tier status: MDN Baseline <https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility>,
web.dev "CSS Wrapped" yearly posts, Interop project <https://wpt.fyi/interop-2025>, caniuse.com.

---

## 1. ANCHOR POSITIONING + POPOVER — the popper.js / MUI Popper killer

**Status TL;DR:** Popover API is **Widely available** (safe everywhere since ~2024).
CSS Anchor Positioning is **Limited / tier 3** — Chromium 125+ (May 2024), Safari partial
since Safari 26 (late 2025), Firefox still behind a flag. **Use the OddBird polyfill or
progressive-enhance for cross-browser in 2026.**

### The combo that replaces popper.js

```html
<button id="trigger" popovertarget="tip">Hover me</button>
<div id="tip" popover="auto">Native tooltip — no JS, no z-index, light-dismiss free</div>

<style>
  #trigger { anchor-name: --trigger; }
  #tip {
    position-anchor: --trigger;
    position-area: top center;          /* 3x3 grid around the anchor */
    margin-bottom: 8px;
    position-try-fallbacks: flip-block; /* auto-flip on collision */
  }
</style>
```

`popover` puts it in the **top layer** (escapes `overflow:hidden`, no z-index war),
gives **light-dismiss + Esc** for free; anchor positioning tethers it. This is why the
popover+anchor combo is the recommended pairing — a bare anchored element still gets
clipped by scroll containers, the top layer doesn't.

### Anchor positioning syntax (current)

| Property / function | Purpose | Example |
|---|---|---|
| `anchor-name` | name an anchor element | `anchor-name: --a;` |
| `position-anchor` | default anchor for positioned el | `position-anchor: --a;` |
| `anchor()` | value = an anchor edge | `top: anchor(bottom); left: anchor(left);` |
| `anchor-size()` | size from anchor dims | `width: anchor-size(width);` |
| `position-area` | grid placement (was `inset-area`) | `position-area: top center;` |
| `@position-try` + `position-try-fallbacks` | collision fallbacks | see below |
| `position-try-order` | pick fallback by space | `position-try-order: most-height;` |
| `position-visibility` | hide when anchor scrolls off | `position-visibility: anchors-visible;` |

> **Rename gotcha:** `inset-area` → `position-area` (CSSWG resolution, early 2024).
> Any tutorial using `inset-area` is stale. Also `anchor-scroll` was dropped for
> `position-visibility` + automatic scroll compensation.

```css
@position-try --flip-to-top  { position-area: top center; }
@position-try --flip-to-left { position-area: center left; }
.tooltip {
  position: absolute;                  /* MUST be absolute or fixed */
  position-anchor: --trigger;
  position-area: bottom center;
  position-try-fallbacks: --flip-to-top, --flip-to-left; /* or flip-block / flip-inline */
}
```

### Popover API

- `popover="auto"` (light-dismiss, one-per-ancestor) | `"manual"` (no light-dismiss, stack) | `"hint"` (Chromium 133+, for tooltips that don't close autos — not yet Baseline)
- `popovertarget="id"` + `popovertargetaction="toggle|show|hide"` on the invoker
- `:popover-open` pseudo, `::backdrop` for backdrop
- Baseline **Widely available**: Chrome/Edge 114 (2023-05), Safari 17 (2023-09), Firefox 125 (2024-04)

### Browser support (mid-2026)

| | Anchor positioning | Popover API |
|---|---|---|
| Chrome/Edge | 125 (2024-05-14) | 114 (Widely) |
| Safari | partial, Safari 26 (late 2025) | 17 (Widely) |
| Firefox | flag `layout.css.anchor-positioning.enabled`, not stable | 125 (Widely) |
| **Baseline** | **Limited** | **Widely available** |

### Polyfill — @oddbird/css-anchor-positioning

- Repo <https://github.com/oddbird/css-anchor-positioning>, by OddBird (Miriam Suzanne et al., who drive the spec — good signal). ~0.5.x as of early-mid 2026.
- Supports `anchor()`, `anchor-size()`, `position-area`, `position-try` fallbacks, `@position-try`.
- **Gaps:** runtime CSS parser (not zero-cost; many anchors can jank), throttled reposition on scroll/resize (laggier than native), partial `position-visibility`, imperfect top-layer interaction.

```js
import polyfill from '@oddbird/css-anchor-positioning/fn';
polyfill();
```

### Where native still loses to Floating UI

1. **No `shift()`** — you get discrete flip fallbacks, not continuous slide-along-axis to stay in view. **Biggest functional gap.**
2. **No arrow primitive** — position the arrow yourself via a second anchor / pseudo-element. Floating UI's `arrow()` is more ergonomic.
3. **No virtual elements** — must anchor to a real DOM element with `anchor-name` (workaround: a zero-size element at the cursor). Floating UI anchors to cursor / text ranges natively.
4. Native **wins** on auto-update: scroll/resize handled automatically, no `autoUpdate()`.

**Verdict:** native covers ~90% of MUI Popper use (menus, selects, tooltips, autocomplete dropdowns). Keep Floating UI only when you need continuous `shift()`, arrow middleware, or virtual elements.

**Sources:** spec <https://www.w3.org/TR/css-anchor-position-1/> · MDN <https://developer.mozilla.org/en-US/docs/Web/CSS/anchor> · MDN Popover <https://developer.mozilla.org/en-US/docs/Web/API/Popover_API> · Chrome blog <https://developer.chrome.com/blog/anchor-positioning-api> · web.dev <https://web.dev/articles/anchor-positioning-api> · Firefox bug <https://bugzilla.mozilla.org/show_bug.cgi?id=1838746>
**Staleness:** verify Firefox flag→stable and exact Safari 26.x coverage at <https://caniuse.com/css-anchor-positioning>.

---

## 2. SCROLL-DRIVEN ANIMATIONS — the turbulent one

**Status TL;DR:** **Limited / tier 3.** Chrome/Edge 115+ (2023-07), Firefox shipped to
stable during 2025 (~136-143), **Safari NOT shipped** (in dev). Polyfill exists but runs
on the main thread, so it loses the whole performance benefit. Baseline: **Limited.**

### Why it felt turbulent (the breaking history)

The authoring model changed out from under early adopters. The **`@scroll-timeline`
at-rule was REMOVED** and replaced:

```css
/* OLD — REMOVED 2023, do not use. Any tutorial with this is STALE. */
@scroll-timeline my-timeline {
  source: selector("#scroller");
  scroll-offsets: 0%, 100%;
}
```

Replaced by `scroll-timeline`/`view-timeline` **properties** + `scroll()`/`view()`
**functions**, and `scroll-offsets` became `animation-range`. Chrome 115 (2023-07) shipped
the new model. **If you touched this in 2021-2022 and it broke, that's why.**

### Current syntax

| Property / function | Purpose |
|---|---|
| `animation-timeline` | attach a timeline to an animation |
| `scroll-timeline[-name][-axis]` | named scroll-progress timeline |
| `view-timeline[-name][-axis][-inset]` | timeline from an element's visibility in scrollport |
| `timeline-scope` | hoist a timeline name to an ancestor so non-descendants can use it |
| `scroll(<scroller> <axis>)` | anonymous: `scroll(root block)`, scroller = `nearest`\|`root`\|`self` |
| `view(<axis> <inset>)` | anonymous: `view(block 20%)` |
| `animation-range[-start/-end]` | which slice: `cover`\|`contain`\|`entry`\|`exit`\|`entry-crossing`\|`exit-crossing` |

```css
/* Scroll progress bar */
@keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.progress {
  position: fixed; inset: 0 0 auto 0; height: 4px;
  transform-origin: left; transform: scaleX(0); background: crimson;
  animation: grow linear;
  animation-timeline: scroll(root block);
}

/* Reveal on scroll */
@keyframes fade-in { from { opacity:0; transform: translateY(40px); } to { opacity:1; transform: none; } }
@media (prefers-reduced-motion: no-preference) {
  .card {
    animation: fade-in linear both;        /* `both` fill is usually required */
    animation-timeline: view();
    animation-range: entry 0% entry 100%;
  }
}
```

JS API: `new ScrollTimeline({source, axis})` / `new ViewTimeline({subject, axis})` via WAAPI.

### Browser support (mid-2026)

| Browser | Status | Version |
|---|---|---|
| Chrome/Edge | Shipped | 115 (2023-07-18) |
| Firefox | Shipped to stable in 2025 (verify exact ~136-143) | was flag `layout.css.scroll-driven-animations.enabled` |
| Safari | **NOT shipped** (WebKit in dev, partial in STP) | — |
| **Baseline** | **Limited** | |

### Polyfill — flackr/scroll-timeline

- Repo <https://github.com/flackr/scroll-timeline> (Robert Flack, spec editor). Polyfills the current model (properties, `scroll()`/`view()`, `animation-range`, JS constructors).
- **Critical gap:** runs on the **main thread via rAF** — the native off-main-thread compositor benefit is LOST under the polyfill. Will jank on heavy pages, the opposite of native's promise.

```html
<script src="https://flackr.github.io/scroll-timeline/dist/scroll-timeline.js"></script>
```

### Rough edges

- **Performance rule:** native runs off-main-thread **only** for compositable props — `transform`, `opacity`, `scale`, `rotate`, `translate`, filters. Animating `width/height/top/margin/color` forces main-thread and janks. **Animate only transform/opacity** for scroll work.
- **Silent failure on naming:** a named timeline is only visible to **descendants** of the declaring element. If the animated element isn't a descendant, nothing animates and there's **no console error**. Fix with `timeline-scope` on a common ancestor. This is the #1 "why isn't it working".
- Named `animation-range` keywords (`entry`, `cover`...) apply to **view** timelines; scroll timelines use percentages. Mixing fails silently.
- Always guard with `prefers-reduced-motion` (vestibular safety).
- Chrome DevTools has a scroll-driven-animations panel; otherwise debugging silent failures is painful.

**Sources:** spec <https://www.w3.org/TR/scroll-animations-1/> · MDN <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations> · Chrome docs (Bramus) <https://developer.chrome.com/docs/css-ui/scroll-driven-animations> · living demos/tools <https://scroll-driven-animations.style/> · polyfill <https://github.com/flackr/scroll-timeline> · Firefox bug <https://bugzilla.mozilla.org/show_bug.cgi?id=1807685>
**Staleness:** confirm Firefox exact stable version and any Safari 26.x/27 movement at <https://caniuse.com/css-scroll-timeline>.

---

## 3. VIEW TRANSITIONS — app-feel docs without a JS framework

### Same-document (SPA-style state changes)

```js
document.startViewTransition(() => updateTheDOM());
```
```css
::view-transition-old(root), ::view-transition-new(root) { animation-duration: .3s; }
.hero { view-transition-name: hero; } /* morphs across the two states */
```
Pseudo tree: `::view-transition`, `::view-transition-group()`, `::view-transition-image-pair()`, `::view-transition-old()`, `::view-transition-new()`.
**Baseline:** Newly→Widely during 2025. Chrome 111 (2023), Safari 18, Firefox 2025.

### Cross-document (MPA — the big one for static docs sites)

```css
/* on BOTH the old and new page. Native page-to-page transitions, no framework. */
@view-transition { navigation: auto; }
/* shared elements morph via matching view-transition-name across pages */
```
**Baseline:** Newly available. Chrome 126+ (2024), Safari 18.2+, Firefox in progress/2025.
**Replaces:** barba.js, swup, framework page-transition libs. A multi-page static docs
site gets app-like transitions in ~3 lines of CSS.

**Source:** MDN <https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API> · cross-doc <https://developer.chrome.com/docs/web-platform/view-transitions/cross-document>. Verify Firefox stable.

---

## 4. NATIVE WIDGETS — kill the component libraries

### `<details name>` accordion + animated `::details-content` (kills accordion libs)

```html
<details name="faq"><summary>Q1</summary>...</details>
<details name="faq"><summary>Q2</summary>...</details> <!-- exclusive: one open at a time -->
```
```css
details::details-content {                 /* Chrome 131+, tier 3 for the animation */
  block-size: 0; overflow: clip;
  transition: block-size .3s, content-visibility .3s allow-discrete;
}
details[open]::details-content { block-size: auto; }
```
`<details>` Widely; `name` attribute Newly (2024/25, all engines); `::details-content` animation Limited.

### `<dialog>` + `showModal()` + `@starting-style` (kills modal libs)

```css
dialog::backdrop { background: rgb(0 0 0 / .5); }
dialog { opacity: 1; transition: opacity .3s, overlay .3s allow-discrete, display .3s allow-discrete; }
@starting-style { dialog[open] { opacity: 0; } }
```
`<dialog>` **Widely available**; `@starting-style` Newly (Chrome 117, Safari 17.5, Firefox 129) — gives enter AND exit animation for popovers/dialogs/details with `transition-behavior: allow-discrete`, no JS.

### Customizable `<select>` (will kill react-select — tier 3, Chromium-only)

```css
select, ::picker(select) { appearance: base-select; }
```
```html
<select><button><selectedcontent></selectedcontent></button><option>...</option></select>
```
Chrome 135+ only (2025). Progressive-enhance; not portable.

### `field-sizing: content` (kills autosize-textarea JS — tier 3, Chromium-only)

```css
textarea { field-sizing: content; max-block-size: 10lh; }
```
Chrome 123+ only. Progressive-enhance.

**Sources:** details <https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details> · dialog <https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog> · @starting-style <https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style> · customizable select <https://developer.chrome.com/blog/rfc-customizable-select> · field-sizing <https://developer.mozilla.org/en-US/docs/Web/CSS/field-sizing>

---

## 5. LAYOUT / SELECTORS / COLOR — the supporting cast (mostly tier 1)

### Selectors & structure
- **`:has()`** (Widely, 2023) — parent selector. `li:has(> ul)` = folder-with-children; `.row:has(.checkbox:checked)` = selected row. Kills JS parent-state wiring.
- **CSS Nesting** (Widely, 2024) — native `&`. Use `&` explicitly to be safe. No `@extend`/loops (runtime only).
- **`@scope`** (Newly, verify Firefox) — donut scope: `@scope (.card) to (.card__content) { p { margin:0 } }`. Component CSS without build tooling.
- **`@layer`** (Widely, 2024) — `@layer reset, base, components, utilities;` tame specificity; park third-party CSS low.

### Layout
- **Subgrid** (Widely, 2024) — child grid inherits parent tracks. Align name/size/date columns across explorer rows; aligned tree indentation; matrix/table layouts for graphs.
- **Container queries** (Widely, 2024) — `container-type: inline-size` + `@container (min-width: 300px)`, units `cqi/cqw/cqb`. Kills ResizeObserver components. Style queries (`@container style(--theme: dark)`) Limited, custom-props only.
- **`reading-flow` / `reading-order`** (tier 3, Chromium 137+) — decouple visual order from tab/reading order; fixes the grid/flex-reorder a11y bug. Not portable yet.
- **`inert`** (Widely) — non-interactive subtree; disable offscreen panels/modal backdrops.

### Typography (docs quality)
- **`text-wrap: balance`** (Widely) for headings; **`pretty`** (Newly, Firefox later) for paragraph orphans. `balance` capped ~6-10 lines for perf.
- **`-webkit-line-clamp`** (Widely) — N-line truncation; the unprefixed `line-clamp` is still standardizing, use the `-webkit` form.
- **`text-box-trim` / `text-box-edge`** (tier 3, Chrome 133+/Safari 18.2) — trim half-leading for exact vertical rhythm without magic-number margins. `text-box: trim-both cap alphabetic;`

### Color & theming (kills runtime Sass)
- **`color-mix(in oklab, var(--accent) 80%, black)`** (Widely) — lighten/darken/mix at runtime.
- **Relative color** (Newly) — `oklch(from var(--brand) calc(l + .1) c h)`; derive whole palettes from one token.
- **`oklch`/`oklab`/`color(display-p3 ...)`** (Widely) — perceptually uniform, wide gamut. Great for graph/data-viz color scales.
- **`light-dark(white, #111)`** (Newly; needs `:root { color-scheme: light dark }`) — one-line theming, no dual `prefers-color-scheme` blocks.
- **`@property`** (Widely, 2024) — typed custom props that **animate**: `@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }` then `transition: --angle 1s`. Key for native gradient/graph/diagram animation.

### Sizing / misc
- **`interpolate-size: allow-keywords`** + **`calc-size(auto, size)`** (tier 3, Chrome 129+) — animate to `height: auto`. Kills the JS scrollHeight-measuring hack for accordion/tree expand. Progressive-enhance.
- **`:user-valid` / `:user-invalid`** (Newly/Widely) — validity styling only after interaction.
- **`aspect-ratio`** (Widely), **`margin-trim`** (Limited, Safari-led), **scroll-snap** + `overscroll-behavior: contain` (Widely).

### Native carousel (tier 3, Chromium 135+)
`::scroll-button(right)` + `::scroll-marker` / `scroll-marker-group` — pure-CSS carousels with prev/next + dot nav. Kills Swiper/Slick eventually; Chrome-only now.

**Source index:** MDN Baseline <https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility> · Chrome CSS/UI <https://developer.chrome.com/docs/css-ui> · Interop <https://wpt.fyi/interop-2025> · caniuse <https://caniuse.com/>

---

## 6. MAPPING TO THE USE CASES

**Docs tooling (least JS):**
cross-document View Transitions (page transitions, ~3 lines) · `<details name>` + `::details-content` accordions · `text-wrap: balance/pretty` + `text-box-trim` · `@layer` + `light-dark()` + `color-mix()` + relative color (no Sass) · container queries for reusable widgets.

**Native graph drawing:**
`@property` (animate node/edge custom-prop values) · `oklch` perceptual color scales · subgrid for aligned matrix/table layouts · anchor positioning (§1) for labels/tooltips tethered to nodes.

**Filesystem explorer UIs:**
`:has()` (folder-has-children, selection) · subgrid (aligned name/size/date columns) · `interpolate-size`/`calc-size()` (expand-to-auto tree animation, Chromium-only) · `inert` (offscreen panels) · scroll-snap + `overscroll-behavior` (panes) · anchor+popover (§1) for context menus.

---

## 7. RE-VERIFY BEFORE RELYING (the tier-3 / Newly watch-list)

These moved through 2025-2026; check caniuse/MDN at use time:
- Anchor positioning: Firefox flag→stable, Safari 26.x full coverage
- Scroll-driven animations: Safari shipping (the Baseline blocker), Firefox exact version
- `@scope`, relative color, cross-doc View Transitions, `text-box-trim`: Firefox stable versions
- Chromium-only (progressive-enhance, not portable): `field-sizing`, customizable `<select>`, CSS carousel, `reading-flow`, `interpolate-size`/`calc-size()`, `::details-content` animation
