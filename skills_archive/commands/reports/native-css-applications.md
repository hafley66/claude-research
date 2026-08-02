# Native CSS Applications — what these features *unlock* (demos & ideas, not specs)

*Compiled 2026-05-31. The "so what" companion to `native-css-jutsu.md` and the five cited briefs.
Specs, versions, and Baseline tiers live in the siblings (`anchor-positioning-popover.md`,
`scroll-driven-animations.md`, `new-stable-css-sweep.md`, `css-language-features-and-mindbenders.md`,
`cross-engine-intent.md`). This file is concrete builds: working patterns, real-world demos, copy-able
code, and the honest ceiling on each (what still needs JS). Citations inline; source roundup at end.*

## Reliability legend (carried from the briefs, re-verified May 2026)

| Tier | Meaning | Build posture |
|---|---|---|
| **SAFE** | Baseline Newly/Widely, all 3 engines | foundation — ship it |
| **ENHANCE** | 2 engines, 1 catching up | progressive enhancement + fallback |
| **CHROMIUM** | Blink-only, no cross-engine commitment | internal tools / Electron / Tauri / known-Chromium viewers only |

---

## 1. Node / graph editors — the flagship (your idea)

The instinct was right, and the mechanism is sharper than expected: anchor positioning kills the
**edge-drawing/tethering** layer (the part everyone hand-rolls with `getBoundingClientRect()` +
`requestAnimationFrame`). It does **not** give you a graph engine. Scope it correctly and it's a big win.

### 1.1 The two-anchor edge (zero-JS tethering)

`anchor()` can reference a *different* named anchor per inset property. Pin one box's top-left to node
A's port and its bottom-right to node B's port, and it becomes a box that spans exactly between them and
**re-tethers itself with zero JS whenever either node moves**:

```css
.node-a .port-out { anchor-name: --a-out; }
.node-b .port-in  { anchor-name: --b-in; }

.edge {
  position: absolute;
  top:    anchor(--a-out bottom);
  left:   anchor(--a-out right);
  bottom: anchor(--b-in  top);
  right:  anchor(--b-in  left);
  /* box now stretches corner-to-corner between the two ports */
}
.edge > svg { width: 100%; height: 100%; }   /* draw the curve inside */
```

What's free: the edge's bounding box, position, live re-layout on drag, viewport-fallback. What you
still author: the curve and arrowhead inside the box.

### 1.2 Confirmed in the wild (not theoretical)

- Cory Rylan ships flow charts with exactly this, gradient-stroked edges + pseudo-element arrowheads:
  [coryrylan.com/blog/flow-charts-with-css-anchor-positioning](https://coryrylan.com/blog/flow-charts-with-css-anchor-positioning)
- Roland Franke, comment→reply connectors:
  [rolandfranke.nl/.../drawing-connections-with-css-anchor-positioning](https://rolandfranke.nl/frontend-stories/drawing-connections-with-css-anchor-positioning/)
- Spanning across multiple anchors, CSS-Tricks guide:
  [css-tricks.com/css-anchor-positioning-guide](https://css-tricks.com/css-anchor-positioning-guide/)
- Multi-anchor / cross-referencing experiments, Roman Komarov:
  [kizu.dev/anchor-positioning-experiments](https://kizu.dev/anchor-positioning-experiments/)
- Browser baseline for the technique: Chrome 125+, Safari 26.0+, Firefox 147+ (no flag), all confirmed
  ([Chrome](https://developer.chrome.com/docs/css-ui/anchor-positioning-api), [caniuse](https://caniuse.com/css-anchor-positioning)). **SAFE** as of 2026, polyfill for older.

### 1.3 Strokes & arrowheads — three options

| Want | How | Cost |
|---|---|---|
| straight/diagonal line | `linear-gradient` on the spanning box `background` | CSS-only, documented ([Roland Franke](https://rolandfranke.nl/frontend-stories/drawing-connections-with-css-anchor-positioning/)) |
| bezier / orthogonal curve | inline `<svg><path>` filling the box (100%×100%) | you write the path `d`; no demos found doing it dynamically (claim, unverified at scale) |
| arrowhead | `::before`/`::after` with `clip-path` on the box end | CSS-only ([Cory Rylan](https://coryrylan.com/blog/flow-charts-with-css-anchor-positioning)) |

There is **no `::tether` pseudo-element**; arrowheads are pseudo-element workarounds. Gradient stroke is
the production-proven path; SVG-in-box is the right tool for real beziers but you own the geometry.

### 1.4 Node chrome — ports, tooltips, inspectors (anchor + popover)

Anchor + the Popover API (Baseline Widely) gives node tooltips, right-click menus, and inspector cards
with light-dismiss + Escape + top-layer focus handling, **all declarative**:

```html
<button anchor-name="--node" id="n1">Node</button>
<menu popover position-anchor="--node" position-area="block-start span-inline-start">
  <li>Inspect</li><li>Delete</li>
</menu>
```
```css
menu[popover] { position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline; }
```
Pattern: [Frontend Masters — popover context menus with anchor positioning](https://frontendmasters.com/blog/popover-context-menus-with-anchor-positioning/) ·
fallbacks: [MDN — using anchor positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning/Using)

### 1.5 Caveats and the honest ceiling

| Caveat | Impact | Workaround |
|---|---|---|
| abs-positioned edge can't anchor to abs-positioned **sibling** nodes in same context | spanning edge fails | wrap each node in a `relative` container; or keep nodes in flow |
| Safari vs Chrome differ on containing-block overflow | edge clips/shifts | test both; render menus via `popover` (top layer) ([OddBird Fall 2025](https://www.oddbird.net/2025/10/13/anchor-position-area-update/)) |
| `[popover]` inherits page margin → breaks `position-area` | menu mispositioned | `[popover] { margin: unset }` |
| OddBird polyfill = main-thread, no dynamic anchor add, React/Vue strip unknown inline styles | jank >20-30 anchors on old browsers | target native; cap polyfill use ([polyfill repo](https://github.com/oddbird/css-anchor-positioning)) |
| **no benchmarks** for 100s of native anchored edges | unknown ceiling | claim: native >> polyfill, unverified at specific counts |

**What anchor positioning does NOT do** (stays JS): path **routing** (avoiding node overlap), **auto-layout**
(dagre/elk), **pan/zoom**, drag interaction. Nobody markets it as a React Flow / rete.js / JointJS
replacement, and the search confirms that ([React Flow](https://reactflow.dev/learn/layouting/layouting),
[JsPlumb](https://jsplumbtoolkit.com/reactflow-alternative)). Correct framing: **CSS owns edge layout
+ node chrome; JS owns the graph engine.** That alone deletes the worst hand-rolled code in a node editor.

### 1.6 Minimal node-editor skeleton (what to build)

1. Nodes = flow/`relative` divs; ports = child els with `anchor-name`.
2. Edges = one abs `.edge` per connection, two-anchor pinned (1.1); curve via inner SVG.
3. Drag = the only required JS — update node `translate`/`top`/`left`; edges follow for free.
4. Menus/tooltips = `popover` + `position-anchor` (1.4).
5. Pan/zoom = JS transform on the canvas wrapper.
6. Old-browser path = OddBird polyfill, capped node count.

---

## 2. Documentation sites — least-JS

### 2.1 Reading-progress bar (SAFE-ish; Chromium + Safari, FF Nightly)

```css
@keyframes grow { from { transform: scaleX(0); } }
.progress {
  position: fixed; inset: 0 0 auto 0; height: 4px; background: red;
  transform-origin: left; animation: grow linear; animation-timeline: scroll();
}
```
No JS, no scroll listener. [Josh Comeau — scroll-driven animations](https://www.joshwcomeau.com/animation/scroll-driven-animations/) ·
[Smashing intro](https://www.smashingmagazine.com/2024/12/introduction-css-scroll-driven-animations/)

### 2.2 Animated table-of-contents (the timeline-scope trick)

The #1 gotcha you hit before: a named timeline is only visible to **descendants**. Put `timeline-scope`
on a common ancestor so a TOC item can react to a section it isn't nested in:

```css
main { timeline-scope: --section; }
.content  { view-timeline: --section; }
.toc-item { animation: fade backwards, fade forwards;
            animation-timeline: --section, --section;
            animation-range: entry, exit; }
```
[MDN timeline-scope](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/timeline-scope).
Watch `overflow:hidden` on intermediaries — use `overflow:clip`.

### 2.3 Accordions / collapsible API docs (`<details name>` + `::details-content`)

Exclusive accordion is pure HTML; the slide is the only Chromium-gated part:

```html
<details open name="api"><summary>GET /users</summary>…</details>
<details name="api"><summary>POST /users</summary>…</details>
```
```css
:root { interpolate-size: allow-keywords; }            /* CHROMIUM: enables 0→auto */
details::details-content {
  height: 0; overflow: clip; opacity: 0;
  transition: height .3s, opacity .3s, content-visibility .3s allow-discrete;
}
details[open]::details-content { height: auto; opacity: 1; }
```
`<details name>` exclusive = **SAFE** (all engines). `::details-content` = **SAFE** (Chrome 131 / FF 143 /
Safari 18.4). The **height slide is CHROMIUM-only** (`interpolate-size`, Chrome 129+) — FF/Safari snap;
fallback to `max-height`. [Chrome styling-details](https://developer.chrome.com/blog/styling-details) ·
[nerdy.dev details transitions](https://nerdy.dev/open-and-close-transitions-for-the-details-element)

### 2.4 Cross-document view transitions — MPA app-feel in 3 lines (ENHANCE)

```css
/* on every page, same origin */
@view-transition { navigation: auto; }
.hero { view-transition-name: hero; }   /* morphs across navigations */
```
Chrome 126+ / Safari 18.2+; **Firefox ignores it** (hard navigation, no animation — safe degrade).
Gotchas: 4s render timeout kills it silently (debug via `pagereveal`); set `object-fit` or snapshots
distort; the old `<meta name="view-transition">` is dead, CSS-only now.
[Chrome cross-doc VT](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document) ·
[CSS-Tricks gotchas](https://css-tricks.com/cross-document-view-transitions-part-1/)

### 2.5 A docs page that needs ≈no JS

reading-progress (2.1) + animated TOC (2.2) + `<details>` API blocks (2.3) + cross-doc transitions
between pages (2.4) + `text-wrap: pretty/balance` for headings + `light-dark()` theming. The only JS
left is a theme-toggle button and search. Everything visual is CSS.

---

## 3. Filesystem explorers / tree UIs

### 3.1 `:has()` chevrons + parent-of-selected (SAFE)

```css
li:has(details) > summary::before { content: "▶"; transition: transform .2s; }   /* folder */
li:not(:has(details)) > summary::before { content: none; }                        /* file   */
details[open] > summary::before { transform: rotate(90deg); }
.folder:has(.selected) { background: hsl(200 10% 92%); font-weight: 600; }        /* ancestor highlight */
```
[CSS-Tricks :has()](https://css-tricks.com/the-css-has-selector/). `:has()` = Baseline Widely.

### 3.2 subgrid — name/size/date columns aligned across nested rows (SAFE)

```css
.tree { display: grid; grid-template-columns: 1fr 100px 120px; gap: 16px; }
.row  { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; gap: inherit; }
```
Columns line up at any nesting depth — no fixed widths, no JS measuring.
[web.dev subgrid](https://web.dev/articles/css-subgrid) · [Comeau subgrid](https://www.joshwcomeau.com/css/subgrid/).
Baseline: Chrome 117 / Safari 16 / Firefox 145 → effectively SAFE 2026.

### 3.3 interpolate-size — animate tree-node expand to `height:auto` (CHROMIUM)

```css
:root { interpolate-size: allow-keywords; }
.node { height: 32px; overflow: clip; transition: height .25s; }
.node[open] { height: auto; }
```
Chrome 129+ only; `@supports (interpolate-size: allow-keywords)` then `max-height` fallback elsewhere.
[Chrome animate-to-height-auto](https://developer.chrome.com/docs/css-ui/animate-to-height-auto)

### 3.4 scroll-state container queries — sticky shadow + "more below" (CHROMIUM)

```css
.tree-header { position: sticky; top: 0; container-type: scroll-state; }
@container scroll-state(stuck: top) { .tree-header { box-shadow: 0 2px 8px #0001; } }

.tree-pane { overflow-y: auto; container-type: scroll-state; }
@container scroll-state(scrollable: block) { .more-below { display: block; } }
```
Chrome 133+ only (`scrolled` state 144+); no FF/Safari. Pure-CSS affordances that previously needed
`IntersectionObserver`/scroll listeners. [MDN scroll-state](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Conditional_rules/Container_scroll-state_queries) ·
[utilitybend](https://utilitybend.com/blog/is-it-scrolled-is-it-not-lets-find-out-with-css-container-scroll-state-queries/)

### 3.5 Free wins — `inert` split-pane, `<dialog>` rename (SAFE)

`inert` on the inactive pane disables focus/clicks/a11y (kills focus-trap libs). `<dialog>` +
`closedby="any"` for rename/confirm modals with backdrop + light-dismiss, no modal lib.

---

## 4. Cross-cutting mashups (ideas worth a demo)

| Idea | Stack | Tier |
|---|---|---|
| Node editor minimap | container queries scale a clone; anchor for viewport box | ENHANCE |
| Graph node "flowing" active edge | `@property` animated gradient stop on the edge box | SAFE |
| Docs callout that points at code | anchor + popover=hint pinned to a line span | ENHANCE |
| FS explorer breadcrumb shadow on scroll | scroll-state `stuck:top` | CHROMIUM |
| Tree row staggered reveal | `sibling-index()` in `animation-delay` | CHROMIUM |
| Spotlight/command palette | `<dialog>` + anchor + `:has()` result filtering | SAFE |
| Whole-app page morph | cross-doc `@view-transition` + named heroes | ENHANCE |

---

## 5. Consolidated browser reality (May 2026, re-verified)

| Feature | Chrome | Safari | Firefox | Tier |
|---|---|---|---|---|
| anchor positioning | 125 | 26.0 | 147 | **SAFE** |
| Popover API | 114 | 17 | 125 | **SAFE** (Widely) |
| `:has()` | 105 | 15.4 | 121 | **SAFE** (Widely) |
| subgrid | 117 | 16 | 145 | **SAFE** |
| `<details name>` + `::details-content` | 131 | 18.4 | 143 | **SAFE** |
| `inert`, `<dialog>` | ✅ | ✅ | ✅ | **SAFE** (Widely) |
| scroll-driven anim (scroll/view-timeline) | 115 | 26.0 | Nightly | **ENHANCE** |
| cross-doc view transitions | 126 | 18.2 | ❌ | **ENHANCE** |
| `contrast-color()` | 147 | 26.0 | 146 | **SAFE** (Newly, Apr 2026) |
| `shape()` | 135 | 18.4 | 148 | **SAFE** (Newly) |
| `interpolate-size`/`calc-size()` | 129 | ❌ | ❌ | **CHROMIUM** |
| scroll-state container queries | 133 | ❌ | ❌ | **CHROMIUM** |
| `sibling-index/count` | 138 | 26.2 | ❌ | **CHROMIUM** (Limited) |

Versions cross-checked against [caniuse](https://caniuse.com) + [webstatus.dev](https://webstatus.dev)
+ vendor blogs (see `cross-engine-intent.md` for the standards-positions detail).

## Source roundup
Anchor/node: [Cory Rylan](https://coryrylan.com/blog/flow-charts-with-css-anchor-positioning) ·
[Roland Franke](https://rolandfranke.nl/frontend-stories/drawing-connections-with-css-anchor-positioning/) ·
[CSS-Tricks guide](https://css-tricks.com/css-anchor-positioning-guide/) ·
[kizu.dev](https://kizu.dev/anchor-positioning-experiments/) ·
[Frontend Masters menus](https://frontendmasters.com/blog/popover-context-menus-with-anchor-positioning/) ·
[OddBird Fall 2025](https://www.oddbird.net/2025/10/13/anchor-position-area-update/) ·
[OddBird polyfill](https://github.com/oddbird/css-anchor-positioning) ·
[MDN using anchor](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning/Using).
Docs: [Josh Comeau SDA](https://www.joshwcomeau.com/animation/scroll-driven-animations/) ·
[Smashing SDA](https://www.smashingmagazine.com/2024/12/introduction-css-scroll-driven-animations/) ·
[MDN timeline-scope](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/timeline-scope) ·
[Chrome styling-details](https://developer.chrome.com/blog/styling-details) ·
[nerdy.dev details](https://nerdy.dev/open-and-close-transitions-for-the-details-element) ·
[Chrome cross-doc VT](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document) ·
[CSS-Tricks VT gotchas](https://css-tricks.com/cross-document-view-transitions-part-1/).
FS explorer: [CSS-Tricks :has()](https://css-tricks.com/the-css-has-selector/) ·
[web.dev subgrid](https://web.dev/articles/css-subgrid) ·
[Comeau subgrid](https://www.joshwcomeau.com/css/subgrid/) ·
[Chrome height-auto](https://developer.chrome.com/docs/css-ui/animate-to-height-auto) ·
[MDN scroll-state](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Conditional_rules/Container_scroll-state_queries) ·
[utilitybend scroll-state](https://utilitybend.com/blog/is-it-scrolled-is-it-not-lets-find-out-with-css-container-scroll-state-queries/).
Interactive: [scroll-driven-animations.style](https://scroll-driven-animations.style/).
