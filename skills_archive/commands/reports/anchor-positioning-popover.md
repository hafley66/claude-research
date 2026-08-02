# CSS Anchor Positioning + HTML Popover API — Raw Research Brief

*Compiled 2026-05-31. Goal: replace popper.js / Floating UI / MUI Popper with native CSS+HTML. Citation-dense source brief; synthesized form lives in `native-css-jutsu.md`.*

> Data conflict flagged up front: caniuse/Firefox-147 vs Bugzilla "all channels" enablement (Dec 2025) vs some sources citing Firefox 132. Resolved toward primary sources (WebKit blog, Bugzilla, caniuse).

---

## 1. SPEC STATUS & HISTORY

### 1.1 CSS Anchor Positioning Level 1 spec

| Field | Value | Source |
|---|---|---|
| Type | W3C **Working Draft** (Recommendation track), not yet CR | [w3.org/TR/css-anchor-position-1](https://www.w3.org/TR/css-anchor-position-1/) |
| Latest dated WD | **2026-03-27** (`WD-css-anchor-position-1-20260327`); a newer `20260511` build is also referenced | [TR snapshot](https://www.w3.org/TR/2026/WD-css-anchor-position-1-20260327/) |
| Editor's Draft | [drafts.csswg.org/css-anchor-position-1](https://drafts.csswg.org/css-anchor-position-1/) (ahead of TR) | CSSWG |
| Editors | Tab Atkins-Bittner, Ian Kilpatrick, Elika Etemad | spec header |
| Level 2 | Separate ED exists (anchored container queries, extended features) | [drafts.csswg.org/css-anchor-position](https://drafts.csswg.org/css-anchor-position/) |

**Milestones / changelog:**

- **2024-07-18** — CSSWG resolves to rename `inset-area` → `position-area` (issue [csswg-drafts#10209](https://github.com/w3c/csswg-drafts/issues/10209); tracked in [mdn/content#34893](https://github.com/mdn/content/issues/34893), Chrome status [feature/5142143019253760](https://chromestatus.com/feature/5142143019253760)). Same era: `position-try-options` → `position-try-fallbacks`.
- **2025-05-12** — CSSWG blog "Update on CSS Anchor Positioning" ([w3.org/blog/CSS/2025/05/12](https://www.w3.org/blog/CSS/2025/05/12/update-on-css-anchor-positioning/)).
- **2025-10-07** — CSSWG blog "Updated Working Draft: WD refinements" ([w3.org/blog/CSS/2025/10/07](https://www.w3.org/blog/CSS/2025/10/07/css-anchor-position-wd-refinements/)). Renamed `x/y-self-` keywords in `position-area` to `self-x/y-`.
- **2026-01-30** WD → **2026-03-27** WD: added `match-parent` value to `position-area`; marked `position-area` discretely animatable. ([w3.org/TR](https://www.w3.org/TR/css-anchor-position-1/))

Naming note: the current spec text uses `position-area` throughout; `inset-area` survives only as a historical/aliased name. Sources that still say `inset-area` predate Chrome 129.

### 1.2 Properties & functions — current syntax

All grammar quoted from [drafts.csswg.org/css-anchor-position-1](https://drafts.csswg.org/css-anchor-position-1/) and [w3.org/TR/css-anchor-position-1](https://www.w3.org/TR/css-anchor-position-1/), cross-checked against MDN.

**`anchor-name`** — turns an element into an anchor.
```
Value: none | <dashed-ident>#
```
```css
.btn { anchor-name: --my-anchor; }
```

**`position-anchor`** — default anchor for the positioned element.
```
Value: normal | none | auto | <anchor-name> | match-parent   (initial: normal)
```
```css
.popup { position: absolute; position-anchor: --my-anchor; }
```

**`anchor()`** function — resolves to a length from an anchor edge; valid only in inset properties.
```
anchor( <anchor-name>? && <anchor-side>, <length-percentage>? )
<anchor-side> = inside | outside | top | left | right | bottom
             | start | end | self-start | self-end | center | <percentage>
```
```css
.menu { position: absolute; top: anchor(--btn bottom); left: anchor(--btn 50%); }
```

**`anchor-size()`** function — resolves to an anchor dimension; valid in sizing/inset/margin.
```
anchor-size( [ <anchor-name> || <anchor-size> ]?, <length-percentage>? )
<anchor-size> = width | height | block | inline | self-block | self-inline
```
```css
.tooltip { width: anchor-size(--btn width); max-height: calc(anchor-size(height) * 2); }
```

**`position-area`** (formerly `inset-area`, renamed 2024-07-18) — 3×3 grid placement relative to the anchor. Replaces manual inset math for most cases.
```
Value: none | <position-area>
/* two keywords from {block,inline,physical} rows/cols, e.g.: */
```
```css
.popover { position: absolute; position-anchor: --btn; position-area: block-end center; }
```
Keyword families: `top/bottom/left/right`, `block-start/-end`, `inline-start/-end`, `start/end/center`, `self-*`, `span-*`, `span-all`, plus `match-parent` (added 2026-Q1).

**`position-try`** (shorthand for order + fallbacks):
```
Value: <'position-try-order'>? || <'position-try-fallbacks'>
```
```css
.popup { position-try: most-height flip-block, flip-inline; }
```

**`position-try-fallbacks`** — ordered alternate positions tried on overflow.
```
Value: none | [ [<dashed-ident> || <try-tactic>] | <position-area> ]#
<try-tactic> = flip-block || flip-inline || flip-start || flip-x || flip-y
```
```css
.menu { position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline, --custom; }
```
Note: `flip-x`/`flip-y` are present in current spec/Safari 26.2; older docs list only `flip-block/-inline/-start`. ([MDN position-try-fallbacks](https://developer.mozilla.org/en-US/docs/Web/CSS/position-try-fallbacks))

**`position-try-order`** — reorder fallbacks by available space.
```
Value: normal | <try-size>
<try-size> = most-width | most-height | most-block-size | most-inline-size
```
```css
.dropdown { position-try-order: most-height; }
```

**`position-visibility`** — conditionally hide when anchor/overflow conditions hit. Initial value `anchors-visible`; discrete animation; "strongly hidden" = behaves like `visibility:hidden`.
```
Value: always | [ anchors-valid || anchors-visible || no-overflow ]
```
```css
.infobox { position-anchor: --my-anchor; position: fixed;
           position-area: top span-all; position-visibility: anchors-visible; }
```
([MDN position-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/position-visibility))

**`@position-try`** at-rule — named fallback bundle. Allowed inside: inset props, margin props, sizing props, self-alignment props, `position-anchor`, `position-area`.
```
@position-try <dashed-ident> { <declaration-list> }
```
```css
@position-try --below { position-area: block-end; margin-block-start: 0.5em; }
```

**`anchor-scope`** (in ED/MDN, scopes an anchor-name to a subtree): `none | all | <dashed-ident>#`.

### 1.3 The Popover API

Sources: [MDN Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API), [web.dev/blog/popover-api](https://web.dev/blog/popover-api), [web.dev/blog/popover-baseline](https://web.dev/blog/popover-baseline).

| Piece | Detail |
|---|---|
| `popover` attribute | `auto` (default; light-dismiss + closes other auto popovers), `manual` (no light-dismiss, no auto-close), `hint` (separate stack for tooltips) |
| `popovertarget` | button attr referencing popover `id`; turns the button into the control |
| `popovertargetaction` | `show` \| `hide` \| `toggle` (default `toggle`) |
| `:popover-open` | pseudo-class matching while a popover is showing |
| `::backdrop` | pseudo-element behind a popover (top-layer backdrop) |
| Light dismiss | `auto`/`hint` close on outside click, Esc, or focus moving out |
| Top layer | popovers render in the browser top layer, above all `z-index`; no stacking-context traps |
| Implicit anchor | using `popovertarget`/`id` or `showPopover({source})` creates an **implicit anchor reference** between control and popover (feeds anchor positioning) ([MDN Using anchor positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning/Using)) |

**`popover=hint`** behavior ([developer.chrome.com/blog/popover-hint](https://developer.chrome.com/blog/popover-hint), [una.im/popover-hint](https://una.im/popover-hint/)): a hint forms a stack subordinate to `auto`. Opening a hint does **not** close an open `auto` stack (e.g. a tooltip over an open `<select>` picker); opening an `auto` popover **does** dismiss open hints. Hints light-dismiss and close other hints. A hint nested inside an auto popover joins the auto stack.

### 1.4 Composition — replacing popper.js with a full example

The pattern: popover provides top-layer + open/close + dismiss; anchor positioning provides placement + fallbacks. No JS.

```html
<button popovertarget="menu" style="anchor-name: --trigger">Open menu</button>
<div id="menu" popover>
  <a href="#">Item one</a>
  <a href="#">Item two</a>
</div>
```
```css
#menu {
  position: absolute;            /* popover defaults to fixed-centered; reset */
  inset: auto;                   /* clear UA centering for popovers/dialogs */
  position-anchor: --trigger;
  position-area: block-end span-inline-end;   /* below, aligned to start edge */
  margin-block-start: 0.25rem;
  position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
  position-visibility: anchors-visible;
}
```
The `inset: auto` reset is required because popover/dialog UA styles center them in the viewport. ([developer.chrome.com/blog/anchor-positioning-api](https://developer.chrome.com/blog/anchor-positioning-api), [developer.chrome.com/docs/css-ui/anchor-positioning-api](https://developer.chrome.com/docs/css-ui/anchor-positioning-api))

Tooltip variant using `hint` so it does not dismiss menus:
```html
<button aria-describedby="tip" style="anchor-name: --b">Hover me</button>
<div id="tip" popover="hint" role="tooltip">Helpful text</div>
```
```css
#tip { position: absolute; inset: auto; position-anchor: --b;
       position-area: top; position-try-fallbacks: flip-block; }
```
(Showing/hiding a hint on hover still needs a few lines of JS or the emerging `interesttarget`/`interestfor` attribute; pure-CSS hover-show is not part of the popover API.)

---

## 2. BROWSER SUPPORT MATRIX (mid-2026)

### 2.1 Anchor positioning

Primary: [caniuse.com/css-anchor-positioning](https://caniuse.com/css-anchor-positioning) (global ~82.8%), [webkit.org](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/), Bugzilla, [w3.org/TR](https://www.w3.org/TR/css-anchor-position-1/).

| Engine | First full support | Notes |
|---|---|---|
| **Chrome / Edge (Chromium)** | **125** (2024-05-10) | Flagged 117–124. Post-125 staged: `position-try-fallbacks` renamed in **128**, `position-area` in **129**, `anchor-scope` in **131**. ([oddbird README](https://github.com/oddbird/css-anchor-positioning), [developer.chrome.com](https://developer.chrome.com/blog/anchor-positioning-api)) |
| **Safari / WebKit** | **26.0** (2025-09-15) | Shipped `anchor-name`, `position-anchor`, `anchor()`, `position-area`, `position-try`, implicit anchors for pseudo-elements. Refined across point releases: **26.2** added `flip-x`/`flip-y`; **26.4** fixed scrollable-container overflow alignment; **26.5** more fixes. ([WebKit 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/), [26.2](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/), [26.4](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/)) Earlier blog claims of "Safari 18.2/18.4 partial" appear in secondary sources only; WebKit's own posts mark 26.0 as the ship point. **Flag.** |
| **Firefox** | **147** (stable, per caniuse) | Behind `layout.css.anchor-positioning.enabled`. Nightly default Firefox **145** (bug [1988224](https://bugzilla.mozilla.org/show_bug.cgi?id=1988224)); all-channels enablement landed ~**2025-12-02** (bug [1988225](https://bugzilla.mozilla.org/show_bug.cgi?id=1988225)); caniuse shows 145–146 "disabled by default", **147+** full. Meta bug [1838746](https://bugzilla.mozilla.org/show_bug.cgi?id=1838746) still NEW (open sub-bugs remain). `position-try-order` not yet implemented (bug 1989059); style/layout interleaving for `anchor()` transitions not supported (bug 1924226). |
| Mobile | Chrome Android **148+**, Safari iOS **26.0+**, Samsung Internet **27+**, Firefox Android **150+** | caniuse |

**Conflict to flag:** several secondary blogs say "Firefox 132" shipped it without flags. caniuse and Bugzilla disagree — Firefox 132 is wrong; treat **145 Nightly / ~147 stable** as authoritative. "Safari 18.2+ core support" claims similarly conflict with WebKit's 26.0 attribution; prefer WebKit.

### 2.2 Popover API (shipped earlier, separate timeline)

Primary: [web.dev/blog/popover-baseline](https://web.dev/blog/popover-baseline), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API), caniuse.

| Engine | Version | Date |
|---|---|---|
| Chrome / Edge | 114 | 2023 |
| Safari | 17.0 | 2023-09 |
| Firefox | 125 | 2024-04 |

**Baseline: Newly available** as of all three (2024), then **Widely available** ~April 2025 ([web.dev/blog/popover-baseline](https://web.dev/blog/popover-baseline)).

`popover=hint` is a **separate, narrower** feature ([web-features-explorer popover-hint](https://web-platform-dx.github.io/web-features-explorer/features/popover-hint/), [caniuse.com/wf-popover-hint](https://caniuse.com/wf-popover-hint)):

| Engine | hint support |
|---|---|
| Chrome / Edge | **133** (2025-02-04) |
| Firefox | **149** (2026-03-24, bug [1867743](https://bugzilla.mozilla.org/show_bug.cgi?id=1867743)) |
| Safari | **not supported** as of mid-2026 |

`popover=hint` Baseline = **Limited availability** — blocked by Safari since ~March 2026; on Interop 2026 list.

### 2.3 Baseline summary (web-platform-dashboard / MDN)

| Feature | Baseline status (mid-2026) |
|---|---|
| Anchor positioning (core) | **Newly available** — reached cross-engine when Firefox shipped (Jan 2026). `position-try-fallbacks`, `position-visibility` tagged "Baseline 2026 Newly available, since January 2026" on MDN. |
| Popover API | **Widely available** (since ~April 2025) |
| `popover=hint` | **Limited availability** (Safari gap) |

---

## 3. POLYFILL STATUS

### 3.1 `@oddbird/css-anchor-positioning`

Source: [github.com/oddbird/css-anchor-positioning](https://github.com/oddbird/css-anchor-positioning) README, npm registry, [oddbird.net/2025/05/06/polyfill-updates](https://www.oddbird.net/2025/05/06/polyfill-updates/).

| Field | Value |
|---|---|
| Latest version | **0.9.0** (published 2026-02-11) |
| Recent cadence | 0.6.0 (2025-05) → 0.6.1 (2025-06) → 0.7.0 (2025-10) → 0.8.0 (2025-11) → 0.9.0 (2026-02). Created 2022-09. Actively maintained. |
| Target browsers | Firefox 54+, Chrome 51–124, Edge 79–124, Safari 10+ (not applied to Chromium 125+) |
| Demo / WPT | [anchor-positioning.oddbird.net](https://anchor-positioning.oddbird.net/) |

**Supports:** `anchor-name`, `position-anchor`, `anchor()`, `anchor-size()`, `position-area` (via wrapper element), `position-try` fallbacks, `anchor-scope`, configurable Shadow DOM roots.

**Does NOT support (verbatim from README):**
- Position Fallback: `position-try-order` (try-size in shorthand parsed but ignored); `flip-start` only partially (property names + anchor sides); `position-area` as a try-tactic; fallback with percentage anchor-side values or anchor functions via custom properties.
- `anchor-scope` on pseudo-elements.
- `anchor-center` value for `justify-self`/`align-self`/`justify-items`/`align-items`.
- `position-visibility` property.
- **Dynamically added/removed anchors or targets** (the React/Vue problem — only elements present when the polyfill runs are processed).
- Anchors/targets in separate shadow roots ([#191](https://github.com/oddbird/css-anchor-positioning/issues/191)); constructed stylesheets ([#228](https://github.com/oddbird/css-anchor-positioning/issues/228)).
- Vertical/RTL writing-modes for anchor functions (partial).
- Implicit anchors / `position-anchor: auto`.
- JS APIs `CSSPositionTryRule`, `CSS.supports()`.
- `position-area` wrapper element breaks `~ target`, `+ target`, `> target`, `:nth-*` selectors; overflow alignment not applied when target overflows inset-modified CB but fits original CB.

**Inline-style gotcha:** React/Vue strip unknown inline style props (`el.style.anchorName`), so polyfill won't see them; use `setAttribute('style', …)` or static `style="…"`.

**Performance:** updates on scroll/resize by default; `useAnimationFrame: true` updates every frame (for transform-animated anchors) — README says "use sparingly." Config via `window.ANCHOR_POSITIONING_POLYFILL_OPTIONS` (`elements`, `excludeInlineStyles`, `roots`, `useAnimationFrame`).

**Load:**
```html
<script type="module">
  if (!("anchorName" in document.documentElement.style)) {
    import("https://unpkg.com/@oddbird/css-anchor-positioning");
  }
</script>
```
Build tools: `import polyfill from '@oddbird/css-anchor-positioning/fn';` (returns a promise).

### 3.2 Popover polyfill

The Popover API is Widely available, so polyfilling is largely unnecessary for evergreen targets. OddBird also maintains a popover polyfill for older browsers ([oddbird.net/2025/05/06/polyfill-updates](https://www.oddbird.net/2025/05/06/polyfill-updates/), [oddbird.net/polyfill](https://www.oddbird.net/polyfill/)). For full native parity you need both polyfills only on legacy engines; `popover=hint` has no broad polyfill and is Safari-blocked.

---

## 4. SHORTCOMINGS / ROUGH EDGES

### 4.1 Containing-block / DOM-order gotchas

Source: [Frontend Masters "The Big Gotcha"](https://frontendmasters.com/blog/the-big-gotcha-of-anchor-positioning/), [MDN Using](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning/Using), [oddbird.net/2025/01/29/anchor-position-validity](https://www.oddbird.net/2025/01/29/anchor-position-validity/).

- The positioned element's **containing block cannot be a descendant of the anchor's containing block**. If the anchor is the positioned element's offset parent / creates its CB, anchoring silently fails. This is the most common breakage.
- **Layout order rule:** the anchor must be laid out before the positioned element. If the anchor is itself absolutely positioned, the positioned element must come **after** it in source order.
- Anchor must be a visible DOM node; `display:none` anchor → element falls back to its nearest positioned ancestor.
- Multiple elements sharing one `anchor-name`: the positioned element binds to the **last** one in source order. Use `anchor-scope` to isolate.

### 4.2 Scroll / overflow clipping

- An anchor box is **clipped by intervening boxes**: if the anchor's ink-overflow rect is fully clipped by an ancestor (via `overflow`, `clip-path`, paint containment) that sits between the anchor and the abspos's CB, positioning is affected. Top layer (popover) helps escape `overflow:hidden`/`z-index` traps that broke older JS solutions.
- Safari fixed scrollable-container alignment-overflow only in **26.4**; behavior across point releases is inconsistent.

### 4.3 Accessibility caveats

Sources: [MDN tooltip role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tooltip_role), [developer.chrome.com/docs/css-ui/anchor-positioning-api](https://developer.chrome.com/docs/css-ui/anchor-positioning-api), [inclusive-components.design/tooltips-toggletips](https://inclusive-components.design/tooltips-toggletips/).

- Anchor positioning creates **no semantic relationship** — it is pure layout. You must add `aria-describedby` (tooltip) / `aria-details` (richer content) / `aria-labelledby` (popover title) yourself. Screen-reader support for `aria-details` is still uneven.
- `content`-property text on pseudo-elements is not reliably announced; keep critical text in real DOM.
- Popover `auto` gives dialog-ish focus handling and Esc; `hint` does not move focus. WAI-ARIA `tooltip` widgets should not take focus and should close on blur/Esc.
- DOM order vs visual order: anchor positioning lets visual placement diverge from DOM/tab order, which can desync reading order from visual order if you over-rely on it.

### 4.4 Where it still can't fully replace Floating UI

Sources: [floating-ui.com/docs/migration](https://floating-ui.com/docs/migration), [/docs/arrow](https://floating-ui.com/docs/arrow), [/docs/virtual-elements](https://floating-ui.com/docs/virtual-elements), [/docs/size](https://floating-ui.com/docs/size).

| Capability | Native CSS+HTML | Floating UI |
|---|---|---|
| Basic place + flip/shift on overflow | Yes (`position-area` + `position-try-fallbacks`) | `flip()`, `shift()` |
| Order by most space | `position-try-order` (Chrome/Safari; not FF yet) | `autoPlacement()` |
| **Arrow positioning** | **No built-in arrow middleware**; center an arrow manually (e.g. anchor the arrow too) — no auto data like `data-popper-arrow` | `arrow()` / `FloatingArrow` computes arrow offset |
| **Virtual / non-DOM reference** (cursor coords, canvas object) | **No** — anchor must be a real, laid-out element | `virtualElements` |
| Resize floating element to fit (`size`) | Partial via `anchor-size()` + `position-try-order`; no general "available space" callback | `size()` middleware |
| Detached/unmounted anchor (virtualized lists) | Breaks (anchor must exist + be laid out) | JS keeps tracking |
| Cross-root / cross-origin shadow DOM | Limited; native anchor across separate shadow roots is constrained | JS computes positions |
| Continuous transform-follow | Native updates on scroll/resize; no per-frame guarantee for transform-animated anchors (FF lacks interleaving) | `autoUpdate({animationFrame})` |

Practical line ([botmonster](https://botmonster.com/web-dev/css-anchor-positioning-tooltips-popovers/), [pockit blog](https://pockit.tools/blog/css-anchor-positioning-api-complete-guide/)): native handles the ~90% case (tooltips, dropdowns, menus, basic popovers) with less code and better perf. Keep a JS lib for: arrows you don't want to hand-roll, virtual/cursor-follow elements, anchors that mount/unmount (virtualized lists), and complex cross-shadow-root scenarios.

---

## 5. Source disagreements / staleness flags

1. **Firefox version**: secondary blogs say 132; caniuse + Bugzilla say 145 Nightly / ~147 stable (all-channels enable ~2025-12-02). Trust the latter.
2. **Safari version**: some blogs cite "18.2 core / 18.4 fallbacks"; WebKit's own posts attribute the ship to **26.0** (2025-09-15) with refinements through 26.2–26.5. Trust WebKit.
3. **`inset-area`**: any doc using `inset-area` or `position-try-options` predates Chrome 129 (2024) and is stale on naming.
4. **`flip-x`/`flip-y`**: newer additions; older MDN/spec excerpts list only `flip-block/-inline/-start`.
5. **spec WD date** moves fast (Jan→Mar→May 2026 builds); cite the dated snapshot, not "latest", for reproducibility.
