# CSS Native Features 2023–2026: Replacing JavaScript — Raw Research Brief

*Compiled 2026-05-31. Broad sweep of newly-stable/Baseline CSS for least-JS docs tooling, native graph drawing, and filesystem-explorer UIs. Synthesized form lives in `native-css-jutsu.md`.*

Status legend per [MDN/web.dev Baseline](https://web.dev/baseline): **Limited** = not in all engines (needs polyfill/fallback); **Newly** = in all 3 engines but <30 months; **Widely** = all engines >30 months (use freely).

---

## A. SELECTORS & STRUCTURE

### `:has()` — parent/relational selector
Style an element based on its descendants/siblings. Enables parent selection, impossible before.
```css
.folder:has(.file.selected) { background: #e3f2fd; }   /* dir containing a selected file */
.row:has(> .row[aria-expanded="true"]) { ... }          /* expanded tree node */
h1:has(+ h2) { margin-bottom: .25rem; }                 /* heading followed by subheading */
```
- **Baseline: Newly (2023)**, crossing to Widely ~mid-2026. Chrome/Edge 105+ (Aug 2022), Safari 15.4+ (Mar 2022), Firefox 121+ (Dec 19 2023). ~93.5% global.
- Replaces: JS classList toggling on parents, jQuery `:has`, MutationObserver-driven parent styling.
- Shortcomings: Specificity = most-specific arg (like `:is()`). Cannot nest `:has()` inside `:has()`; no pseudo-elements as args. Performance scales with subtree size; anchor narrowly (`.x:has(> .y)` not `body:has(.y)`).
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/:has · https://web.dev/blog/baseline2023 · https://caniuse.com/css-has

### CSS Nesting (native `&`)
Nest rules without a preprocessor; `&` = parent selector.
```css
.card {
  & .title { font-weight: bold; }   /* or just  .title {...}  since relaxed syntax */
  &:hover { box-shadow: 0 4px 8px #0001; }
  &.active { ... }                  /* compound: REQUIRES & */
}
```
- **Baseline: Newly (2023→safe in 2026, ~90%+)**. Chrome/Edge 120+, Firefox 117+, Safari 17.2+. The relaxed-syntax update (late 2023) made `&` optional for descendant/type selectors; older Chrome/Safari need the leading `&`.
- Replaces: Sass/Less *for nesting only*.
- Gotchas vs Sass: (1) No string concatenation — `&__child` becomes `&` + type selector `__child` (a descendant), NOT `.card__child`. BEM suffixing is impossible. (2) Parent is wrapped in `:is()`, so specificity = highest in the list. (3) Native is browser-parsed and stricter; invalid nested rule drops only that block.
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting · https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting/Using_CSS_nesting

### `@scope` — scoped styles + donut scope
Bound rules to a DOM subtree, with optional lower exclusion limit.
```css
@scope (.article-body) to (figure) {   /* applies between root (incl) and limit (excl) = "donut" */
  img { border: 5px solid black; }
}
@scope (.card) { :scope { padding: 1rem; } p { color: inherit; } }
```
- **Baseline: Newly (December 2025)** — youngest of group A; safe but young. Chrome/Edge 118+ (2023), Safari 17.4+ (2024), **Firefox 146 (Dec 9 2025)** flipped it on by default (was behind `layout.css.at-scope.enabled` from FF128). ~88% global.
- Replaces: CSS-in-JS scoping, BEM naming discipline, Shadow DOM purely for style isolation.
- Shortcomings: Proximity-based cascade ("scoping proximity") is a new mental model. Bare selectors get `:where(:scope)` (zero specificity) prepended. Young Baseline — verify older Firefox ESR.
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/@scope · https://caniuse.com/css-cascade-scope · https://web.dev/blog/web-platform-12-2025

### `@layer` — cascade layers
Explicit specificity buckets; layer order beats per-rule specificity.
```css
@layer reset, framework, app;        /* later = higher priority */
@layer app { .btn { color: rebeccapurple; } }
```
- **Baseline: Widely (March 2022)** — fully safe.
- Ordering: first-declared = lowest; last = highest; within the comparison specificity/source-order are ignored. Unlayered styles beat all layers. `!important` reverses layer order.
- Replaces: specificity hacks, `!important` wars, ITCSS ordering conventions.
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/@layer

---

## B. LAYOUT

### Subgrid
A nested grid reuses parent track sizes/lines instead of making its own — aligns columns across nested components (tables, tree columns, card rows).
```css
.tree { display: grid; grid-template-columns: max-content 1fr auto; }
.tree-row { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; }
```
- **Baseline: Widely (became Widely 2026-03-15; Newly since 2023-09-15)** — safe. Chrome/Edge 117+ (Sep 2023), Firefox 71+ (2019), Safari 16+ (2022). ~92%+.
- Replaces: JS column-width measuring/sync, duplicated track definitions, table-layout hacks for aligned tree/grid columns.
- Shortcomings: No implicit track creation in a subgridded axis — unknown item counts stack in the last track; use `grid-auto-rows` on the non-subgrid axis.
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Subgrid · https://web.dev/articles/css-subgrid

### Container Queries (size) + units
Style a component by its container's size, not the viewport — true component responsiveness.
```css
.panel { container-type: inline-size; container-name: side; }
@container side (width > 400px) { .card { grid-template-columns: 1fr 1fr; } }
.title { font-size: max(1.5rem, 1rem + 2cqi); }   /* cqi = 1% of container inline-size */
```
Units: `cqw` `cqh` `cqi` `cqb` `cqmin` `cqmax`. `cqi`/`cqb` writing-mode-aware; `cqw`/`cqh` physical.
- **Baseline: Newly→Widely (size queries since 2023)** — safe. Chrome/Edge 105+, Firefox 110+ (Feb 2023), Safari 16+. ~93%+.
- Replaces: viewport media-query breakpoints for reusable components; ResizeObserver-driven JS layout.
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries

### Style Queries (`@container style(--x: y)`)
- **Limited** (not Baseline). Chrome + Safari support custom-property style queries; **Firefox lands in 2026 (Interop 2026)**. Container scroll-state queries: Chrome/Edge/Opera as of Dec 2025. Progressive enhancement.
- Source: https://blog.logrocket.com/container-queries-2026/ · https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_size_and_style_queries

### `:has()` + container queries combo
`:has()` sets a state class/attr or container-type conditionally; container query reads container width. Both Baseline-safe individually; combining works wherever both ship (all engines 2024+). Good for "explorer panel collapses based on its own width AND whether it contains a selection."

### Anchor positioning (brief — covered in `anchor-positioning-popover.md`)
Tether an element to an anchor in pure CSS. **Baseline: Newly (Jan 2026)** — VERIFIED 2026-05 all 3 engines: Chrome/Edge 125+, Safari 26.0 (Sep 2025), **Firefox 147 enabled by default (Jan 13 2026)**. https://developer.chrome.com/blog/anchor-positioning-api · https://caniuse.com/css-anchor-positioning

### `reading-flow` / `reading-order`
Make keyboard/focus and a11y traversal follow visual order in grid/flex/block when DOM order differs.
```css
.grid { display: grid; reading-flow: grid-order; }
.item { reading-order: 2; }   /* needs reading-flow != normal */
```
Values: `normal | flex-visual | flex-flow | grid-rows | grid-columns | grid-order | source-order`.
- **Limited — Chrome/Edge 137+ only (May 2025)**. No Firefox/Safari yet. A11y impact: fixes WCAG 2.4.3 focus-order mismatches caused by `order`/`grid-template-areas` reordering. Progressive enhancement; not the only a11y mechanism.
- Source: https://developer.chrome.com/blog/reading-flow · https://developer.mozilla.org/en-US/docs/Web/CSS/reading-flow

---

## C. VIEW TRANSITIONS

### Same-document (SPA-style cross-fade / morph)
```js
document.startViewTransition(() => updateDOM());
```
```css
.thumb { view-transition-name: hero; }   /* or view-transition-name: match-element (auto) */
::view-transition-old(hero), ::view-transition-new(hero) { animation-duration: .3s; }
```
- **Baseline: Newly (Oct 14 2025)** — safe-ish, young. Chrome/Edge 111+, Safari 18+, **Firefox 144 (Oct 14 2025)**. Auto-naming (`match-element`) Chrome 137; nested groups Chrome 140; `:active-view-transition`, `view-transition-class` now Baseline.
- Replaces: Framer Motion / GSAP page-state crossfades, FLIP-animation libs.

### Cross-document (MPA — ideal for static docs sites)
```css
/* in BOTH the source and destination page CSS */
@view-transition { navigation: auto; }
@keyframes slide-in { from { transform: translateY(100%); } }
::view-transition-new(root) { animation: .4s ease both slide-in; }
```
- **Limited (NOT Baseline)** — `@view-transition` works in **Chrome/Edge 126+ and Safari 18.2+ only**; **Firefox ignores it** (snaps without animation; expected 2026). Same-origin only, no cross-origin redirects.
- Replaces: Astro `<ViewTransitions>` JS shim, Turbo/Barba.js, swup. Animated MPA navigation in zero JS where supported, graceful no-anim fallback elsewhere.
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/@view-transition · https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available · https://developer.chrome.com/blog/view-transitions-in-2025

---

## D. FORM / WIDGET NATIVE CONTROLS

### Customizable `<select>`
Fully CSS-stylable native select; style the popup and project rich content into the button.
```css
select, ::picker(select) { appearance: base-select; }
::picker(select) { border-radius: 8px; }
option::checkmark { color: green; }
selectedcontent .desc { display: none; }   /* show only part of the option in the button */
```
- **Limited — Chrome/Edge 134/135+ only (Mar 2025)**, not behind a flag. **Firefox and Safari actively implementing** (Mozilla bug 1958445; Interop 2026). Not Baseline.
- Replaces: react-select, Downshift, Choices.js, Select2 — with native a11y/keyboard for free.
- Shortcomings: Chromium-only today; must ship a fallback (default select still works).
- Source: https://developer.chrome.com/blog/a-customizable-select · https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/select

### `<details>`/`<summary>` accordions + `name` + `::details-content`
Native disclosure; `name` makes exclusive accordions (only one open per group), no JS.
```html
<details name="faq"><summary>Q1</summary><p>A1</p></details>
<details name="faq"><summary>Q2</summary><p>A2</p></details>
```
```css
::details-content { transition: height .3s, content-visibility .3s allow-discrete; height: 0; overflow: clip; }
[open]::details-content { height: auto; }   /* needs interpolate-size for the animation */
```
- `<details>`/`<summary>`: **Widely (since 2020)**. `name` exclusive accordion: Chrome/Edge 120+, Firefox 130+, Safari 17.2+ (**Baseline-safe 2025**). `::details-content`: **Baseline Newly (Sep 2025)** — Chrome 131+, Firefox 143+, Safari 18.4+.
- Replaces: Accordion JS (jQuery UI accordion, Bootstrap collapse).
- Shortcoming: the height-auto open/close *animation* only works in Chromium (needs `interpolate-size`, see H).
- Source: https://developer.mozilla.org/en-US/blog/html-details-exclusive-accordions/ · https://developer.chrome.com/blog/styling-details · https://developer.mozilla.org/en-US/docs/Web/CSS/::details-content

### Popover API (brief — covered in `anchor-positioning-popover.md`)
`popover` attr + `popovertarget` button; light-dismiss, top layer, focus mgmt, declarative. **Baseline Newly (Jan 27 2025) → Widely (Apr 2025)**. Chrome 114+, Firefox 125+, Safari 17+. https://web.dev/blog/popover-baseline

### `field-sizing: content` — auto-growing inputs/textareas
```css
textarea { field-sizing: content; min-block-size: 3lh; max-block-size: 20lh; }
```
- **Limited — Chromium only** (Chrome/Edge). No Firefox/Safari as of mid-2025. Not Baseline.
- Replaces: autosize.js, manual scrollHeight measuring.
- Shortcoming: ship a JS fallback (autosize) for Firefox/Safari. `size`/`rows`/`cols` ignored when active.
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/field-sizing

### `<dialog>` + `showModal()` + top layer
```js
dialog.showModal();   // top layer, ::backdrop, Esc-to-close, focus trap, inert background — all free
```
- **Baseline: Widely (March 2022)** — fully safe. `:modal`, `:open`, `::backdrop` supported. New `closedby="any"` adds light-dismiss.
- Replaces: jQuery UI dialog, Bootstrap modal, focus-trap libs, manual `aria-modal` wiring.
- Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog

---

## E. NATIVE CAROUSEL / SCROLL UI

### CSS Carousel: `::scroll-button()`, `::scroll-marker`, `::scroll-marker-group`
Browser-generated prev/next buttons and dot markers for a scroll container — accessible carousel with no JS.
```css
.carousel { scroll-snap-type: x mandatory; scroll-marker-group: after; }
.carousel::scroll-button(left)  { content: "◀"; }
.carousel::scroll-button(right) { content: "▶"; }
.carousel li::scroll-marker { content: ""; }              /* a dot */
.carousel li::scroll-marker:target-current { background: black; }   /* active dot */
```
- **Limited (NOT Baseline)** — Chrome/Edge **135+ (Mar 20 2025)**, default-on. **Safari 19/26+** lands early 2026; **Firefox** behind `layout.css.scroll-driven-animations.enabled` (markers/buttons not yet shipped). From CSS Overflow 5.
- Replaces: Swiper, Slick, Glide, Splide — native ARIA roles, keyboard, screen-reader support, no CLS/hydration cost.
- Shortcoming: Chromium-only in production; Firefox/Safari users get a plain scrollable container (functional, no generated controls). Build snap+overflow as the base, treat markers/buttons as enhancement.
- Source: https://developer.chrome.com/blog/carousels-with-css · https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Overflow/Carousels · https://developer.mozilla.org/en-US/docs/Web/CSS/::scroll-marker

### `scroll-snap`
```css
.track { scroll-snap-type: x mandatory; }
.slide { scroll-snap-align: start; scroll-snap-stop: always; }
```
- **Baseline: Widely (April 2022)** — fully safe. `scroll-snap-stop: always` forces stopping at each snap point even on fast flicks; `scroll-padding` offsets snap edges (e.g. for sticky headers).
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll_snap

### `overscroll-behavior`
`contain`/`none` stops scroll chaining and bounce/pull-to-refresh from a scroll region. **Widely** (safe). Not affected by scroll-snap. https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior

---

## F. TYPOGRAPHY & TEXT

### `text-wrap: balance` and `text-wrap: pretty`
```css
h1, h2, blockquote { text-wrap: balance; }   /* even line lengths, short blocks */
p { text-wrap: pretty; }                       /* avoid orphans/short last line, long blocks */
```
- `balance`: **Baseline 2024 (Mar 2024)** — Chrome/Edge 114+, Firefox 121+, Safari 17.5+. Limited to short blocks (≤6 lines Chromium, ≤10 Firefox).
- `pretty`: **Limited** — Chrome/Edge 117+, Opera 103+, **Safari 26+**; **Firefox unsupported (early 2026)**. Graceful fallback to normal wrap, so safe as enhancement. Perf cost on long text.
- Replaces: JS line-balancing (wrap-balancer, Text-balance polyfill).
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap · https://developer.chrome.com/blog/css-text-wrap-pretty · https://webkit.org/blog/16547/better-typography-with-text-wrap-pretty/

### `hyphens`
`hyphens: auto` (needs `lang` attr). Widely supported across engines; safe. Combine with `text-wrap` and `overflow-wrap`. https://developer.mozilla.org/en-US/docs/Web/CSS/hyphens

### `line-clamp` (unprefixed) vs `-webkit-line-clamp`
- Unprefixed `line-clamp`: **Limited / NOT Baseline** — spec changed to "collapse" model (CSSWG, Sep 2025); not shipped unprefixed in Blink/WebKit yet.
- `-webkit-line-clamp`: deprecated but **fully specified and universally supported** as the 3-property combo:
```css
.excerpt { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
```
- 2026 recommendation: keep using `-webkit-line-clamp` (the reliable path). Replaces JS truncation/ellipsis libs.
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/line-clamp · https://github.com/Igalia/explainers/blob/main/css/line-clamp/README.md

---

## G. COLOR & VISUAL

### `color-mix()`
```css
--accent: oklch(60% .2 250);
.hover { background: color-mix(in oklch, var(--accent), white 20%); }
```
- **Baseline: Widely** — Chrome/Edge 111+, Firefox 113+, Safari 16.2+. Replaces Sass `mix()`/`lighten()`/`darken()`, JS color libs (tinycolor).
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix

### Relative color syntax (`rgb(from …)`, `oklch(from …)`)
```css
.tint { background: oklch(from var(--accent) calc(l + .1) c h); }
```
- **Newly→safe** — Chrome/Edge 119+, Firefox 128+, Safari 16.4+. Replaces preprocessor color math.
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_colors/Relative_colors

### `oklch()` / `oklab()` / `color()` wide gamut
```css
color: oklch(70% 0.15 200);
color: color(display-p3 1 0 0);   /* vivid P3 red beyond sRGB */
```
- **Baseline: Widely** — Chrome/Edge 111+, Firefox 113+ (May 2023), Safari 15.4–16.2+. Perceptually uniform; correct for P3 displays.
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch

### `light-dark()`
```css
:root { color-scheme: light dark; }
body { background: light-dark(#fff, #111); color: light-dark(#111, #eee); }
```
- **Baseline: Newly (May 13 2024)** — Chrome/Edge 123+, Firefox 120+, Safari 17.5+. Widely ~late 2026. Requires `color-scheme: light dark`. Replaces duplicated `prefers-color-scheme` blocks and JS theme toggling for colors.
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark · https://web.dev/articles/light-dark

### `@property` (typed, animatable custom properties)
```css
@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
.box { background: linear-gradient(var(--angle), red, blue); transition: --angle .5s; }
.box:hover { --angle: 180deg; }   /* gradients now animate */
```
- **Baseline: Newly (July 9 2024)** — Chrome/Edge 85+ (2020), Safari 16.4+, Firefox 128+ (Jul 2024). Replaces JS rAF-driven gradient/number animation; type-safe with fallback to plain custom props.
- Shortcoming: `initial-value` must be computationally independent (no `em`); discrete fallback if invalid.
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/@property · https://web.dev/blog/at-property-baseline

### `color-scheme`
`color-scheme: light dark` opts UI (form controls, scrollbars) into native dark rendering and powers `light-dark()`. Widely; safe. https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme

---

## H. SIZING / MISC

### `:user-valid` / `:user-invalid`
Validation styling only after user interaction (unlike `:valid`/`:invalid` which fire immediately).
```css
input:user-invalid { border-color: red; }
```
- **Baseline: Widely (since ~late 2023)** — safe. Replaces JS "touched/dirty" form-state tracking (Formik/RHF for styling).
- Source: https://web.dev/articles/user-valid-and-user-invalid-pseudo-classes

### `inert` attribute
Disables an element subtree (no focus, no clicks, removed from a11y tree). **Baseline: Widely (April 2023)** — safe. Replaces focus-trap/tabindex-juggling libs (esp. off-canvas explorers, modal backgrounds). https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert

### `aspect-ratio`
**Baseline: Widely** — Chrome/Edge 88, Firefox 89, Safari 15. Safe. Replaces padding-top % hack and JS sizing. https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio

### `margin-trim`
Strips edge margins of first/last children inside a container (clean vertical rhythm).
- **Limited — Safari only** (shipped 2+ years ago); no Chromium/Firefox. Not Baseline. Enhancement.
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/margin-trim · https://webkit.org/blog/16854/margin-trim/

### `text-box-trim` / `text-box-edge`
Trim font line-box leading above/below text for precise vertical alignment (docs/heading rhythm).
```css
h1 { text-box: trim-both cap alphabetic; }   /* shorthand */
```
- **Limited (NOT Baseline)** — Chrome/Edge 133+ (Feb 2025), Safari 18.2+ (Dec 2024); **no Firefox**.
- Source: https://developer.chrome.com/blog/css-text-box-trim · https://developer.mozilla.org/en-US/docs/Web/CSS/text-box-trim

### `calc-size()` + `interpolate-size: allow-keywords` (animate to `height: auto`)
```css
:root { interpolate-size: allow-keywords; }
.panel { height: 0; overflow: clip; transition: height .3s; }
.panel.open { height: auto; }              /* now animates */
/* or per-element: */ .panel.open { height: calc-size(auto, size); }
```
- **Limited — Chromium only (Chrome/Edge 129+, Sep 2024)**. No Firefox/Safari. Not Baseline.
- Replaces: JS height-measuring expand/collapse (slideDown/slideUp), the `max-height` transition hack.
- Shortcoming: ship a `max-height` fallback for Firefox/Safari; this is what gates animated `<details>`/accordions cross-browser.
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/interpolate-size · https://developer.chrome.com/docs/css-ui/animate-to-height-auto

### `@starting-style` (entry animations for popover/dialog/`display:none`)
```css
[popover] { opacity: 0; transition: opacity .3s, overlay .3s allow-discrete, display .3s allow-discrete; }
[popover]:popover-open { opacity: 1; }
@starting-style { [popover]:popover-open { opacity: 0; } }
```
- **Baseline: Newly (Aug 6 2024)** — Chrome/Edge 116+, Safari 17.4+, Firefox 129+. Pair with `transition-behavior: allow-discrete` (**Baseline Aug 2024**). Replaces `setTimeout`/double-rAF entry-animation hacks; unsupported browsers skip the entry transition (safe enhancement).
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style · https://web.dev/blog/baseline-entry-animations

---

## Quick decision table for the use cases

| Feature | Status | Safe in 2026 no polyfill? | Best fit |
|---|---|---|---|
| `:has()` | Newly→Widely | Yes | tree/explorer parent-state styling |
| Nesting, `@layer` | Widely | Yes | authoring ergonomics, framework CSS |
| `@scope` | Newly (Dec 2025) | Yes (young) | scoped doc/widget styles, donut scope |
| Subgrid | Widely | Yes | aligned tree/table columns |
| Container size queries + `cqi` | Widely | Yes | responsive explorer panels |
| Style queries | Limited | No (FF 2026) | enhancement |
| `reading-flow` | Limited (Chrome 137) | No | a11y enhancement |
| Same-doc View Transitions | Newly (Oct 2025) | Mostly | doc state morphs |
| Cross-doc `@view-transition` | Limited (no FF) | No — graceful fallback | static docs MPA nav |
| Customizable `<select>` | Limited (Chromium) | No — needs fallback | replace react-select later |
| `<details name>` accordion | Newly/Widely | Yes | native accordions |
| `::details-content` | Newly (Sep 2025) | Yes | styled disclosure |
| Animated open (`interpolate-size`) | Limited (Chromium) | No — `max-height` fallback | accordion animation |
| `field-sizing` | Limited (Chromium) | No — autosize fallback | auto-grow inputs |
| `<dialog>`/`showModal` | Widely | Yes | modals |
| CSS carousel markers/buttons | Limited (Chromium; Safari 26 soon) | No — base on snap | carousels |
| `scroll-snap`, `overscroll-behavior`, `aspect-ratio`, `inert`, `:user-valid` | Widely | Yes | core UI |
| `color-mix`, `oklch`, relative color, `@property` | Widely/Newly | Yes | theming, animated gradients |
| `light-dark()` | Newly (May 2024) | Yes | dark mode |
| `text-wrap: balance` | Newly (2024) | Yes | headings |
| `text-wrap: pretty` | Limited (no FF) | Enhancement | body text |
| `line-clamp` unprefixed | Limited | No — use `-webkit-` | truncation |
| `margin-trim`, `text-box-trim` | Limited (Safari/partial) | No | rhythm enhancement |
| `@starting-style` | Newly (2024) | Yes | entry animations |

**Pattern across all the Chromium-only items** (cross-doc view transitions, customizable select, carousel markers, `field-sizing`, `interpolate-size`, `text-wrap: pretty`): each degrades to a functional non-animated/native baseline, so they are safe as progressive enhancement but must not be the only path. The fully-safe core for docs/graph/explorer tooling is `:has()` + subgrid + container queries + `@layer`/nesting + `<dialog>`/`<details>`/`inert` + scroll-snap + the modern color stack.
