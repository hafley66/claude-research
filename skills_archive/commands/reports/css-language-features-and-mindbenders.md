# CSS as a Language: `if()`, `@function`, typed `attr()`, loops, invoker commands + mind-benders

*Compiled 2026-05-31. Companion to `native-css-jutsu.md`. Citation-dense; versions verified against MDN browser-compat-data, Chrome/WebKit blogs, chromestatus, Open UI, caniuse. Conflict/stale flags inline.*

> One-line orientation: the "programming-language" CSS features (`if()`, `@function`, typed `attr()`, `sibling-index()`) are all **Chromium-only / Baseline: Limited** as of mid-2026 — use them as progressive enhancement, not foundation. The cross-engine wins are `light-dark()`, `contrast-color()`, `text-autospace`, **invoker commands** (Baseline Newly Dec 2025), and `:state()`.

Browser stable dates used for ship claims: Chrome 129 = 2024-09-17 · 133 ≈ 2025-02-04 · 135 = 2025-03-25 · 137 = 2025-05-27 · 138 = 2025-06-24 · 139 = 2025-08-05 · 140 ≈ 2025-09-02.

---

## 1. `if()` — inline conditionals

Three condition wrappers only: `style()`, `media()`, `supports()`, plus `else`.

```css
/* media + else */
button { width: if(media(any-pointer: fine): 30px; else: 44px); }

/* style() custom-property switch */
background: if(
  style(--scheme: ice):  linear-gradient(#caf0f8, white, #caf0f8);
  style(--scheme: fire): linear-gradient(#ffc971, white, #ffc971);
  else: none;
);

/* boolean composition + nesting allowed, works inside calc() */
color: if(style((--scheme: dark) or (--scheme: very-dark)): white; else: black);
```

| | |
|---|---|
| Ship | Chrome/Edge **137** (2025-05-27), on by default. Firefox/Safari: not shipped. |
| Baseline | **Limited** |
| Sources | [MDN if()](https://developer.mozilla.org/en-US/docs/Web/CSS/if) · [Chrome blog](https://developer.chrome.com/blog/if-article) · [CSS-Tricks](https://css-tricks.com/lightly-poking-at-the-css-if-function-in-chrome-137/) |

Limits: `style()` tests **custom properties only** (not `if(style(color: white):…)`). No graceful degradation — non-supporting browsers drop the whole declaration, so precede with a plain fallback. No space between `if` and `(`. Nesting and use inside `calc()` are allowed.

---

## 2. Custom functions — `@function`

```css
@function --transparent(--color <color>, --alpha <number>: 0.8) returns <color> {
  result: oklch(from var(--color) l c h / var(--alpha));
}
section { background-color: --transparent(#faa6ff, 0.5); }

/* local vars + if() inside the body */
@function --narrow-wide(--narrow, --wide) {
  result: if(media(width < 700px): var(--narrow); else: var(--wide));
}

/* comma-containing args wrapped in {…} */
@function --max-plus-x(--list <length>#, --x <length>) {
  result: calc(max(var(--list)) + var(--x));
}
div { width: --max-plus-x({1px, 7px, 2px}, 3px); }   /* 10px */
```
Called as a dashed-function `--name(args)`. Untyped params/returns default to `type(*)`.

| | |
|---|---|
| Ship | Chrome/Edge **139** (2025-08-05). **Delayed from 136** — discard any "Chrome 136" claim. Firefox/Safari: not shipped. |
| Baseline | **Limited** |
| Sources | [MDN @function](https://developer.mozilla.org/en-US/docs/Web/CSS/@function) · [New in Chrome 139](https://developer.chrome.com/blog/new-in-chrome-139) · [delay blog](https://developer.chrome.com/blog/delaying-shipping-of-css-functions) · [chromestatus](https://chromestatus.com/feature/5179721933651968) |

Limits: no early return (last `result` in cascade wins; a later unconditional `result` overrides a `@media`-guarded one). Precedence in body: parameters > element custom props > local vars. **No usable recursion** — cycles are detected and resolve to guaranteed-invalid ([csswg #12595](https://github.com/w3c/csswg-drafts/issues/12595)). `@mixin`/`@apply` are NOT shipped yet — only `@function`. Spec: [CSS Functions & Mixins, csswg #9350](https://github.com/w3c/csswg-drafts/issues/9350).

---

## 3. Typed `attr()` — the content-reuse upgrade

Old `attr()` = string-only, `content` only. New typed `attr()` = any property, typed, with fallback.

```css
/* NEW (Chrome 133): attr(<name> type(<syntax>), <fallback>)  or unit shorthand */
.bar  { height: attr(data-value type(<percentage>), 0%); }   /* data-driven bar chart */
.chip { background: attr(data-color type(<color>), gray); }
.card { view-transition-name: attr(id type(<custom-ident>), none); }
h1    { font-size: attr(data-size px); }                      /* dimension shorthand */

/* OLD (still the only form in Firefox/Safari): string, content only */
.thing::after { content: attr(data-label); }
```

| | Old `attr()` | New typed `attr()` |
|---|---|---|
| Properties | `content` only | **any** property incl. custom props |
| Output type | `<string>` | `<color>`, `<number>`, `<integer>`, `<length>`, `<percentage>`, `<angle>`, `<time>`, `<custom-ident>`, `<image>` via `url()`, … |
| Fallback | none | 2nd arg |

| | |
|---|---|
| Ship | Chrome/Edge **133** (~2025-02-04). *Stale flag:* the blog header "Jan 15 2025" is the publish date, not stable ship — cite the **133** version. Firefox/Safari: typed `attr()` not shipped (string-in-`content` only). |
| Baseline | **Limited** |
| Sources | [Chrome blog](https://developer.chrome.com/blog/advanced-attr) · [una.im](https://una.im/advanced-attr) · [MDN attr()](https://developer.mozilla.org/en-US/docs/Web/CSS/attr) |

Use cases: bar charts / gauges from `data-value`, per-element theming from `data-color`, reuse `id`/`data-*` as `view-transition-name`, tooltip text. Caveat: not keyframe-animatable unless routed through a registered `@property`; cross-browser still needs JS or inline `style`.

---

## 4. Loops — no, but loop-shaped primitives exist

**There is no `for`/`while`/`@each` in CSS, and none is concretely proposed.** csswg surfaces only loop-*adjacent* ideas (grid `repeat()` ranges, group-effects), no iteration construct. Preprocessor loops (Sass `@for`/`@each`) remain the only real loops.

What shipped instead — `sibling-index()` / `sibling-count()` (1-based integers, no args, usable in `calc()`):

```css
li { animation-delay: calc(0.1s * (sibling-index() - 1)); }   /* stagger, no nth-child */
li { width: calc(100% / sibling-count()); }                   /* equal distribution */
.item { rotate: calc(360deg / sibling-count() * sibling-index()); }  /* radial layout */
```

| | |
|---|---|
| Ship | Chrome/Edge **138** (2025-06-24). Safari **26.2** per secondary sources (*verify on webstatus.dev*). Firefox: not in stable (positive position). |
| Baseline | **Limited** |
| Sources | [MDN sibling-index](https://developer.mozilla.org/en-US/docs/Web/CSS/sibling-index) · [chromestatus](https://chromestatus.com/feature/6225478530367488) · [Smashing](https://www.smashingmagazine.com/2026/05/mathematical-layouts-sibling-index-sibling-count/) |

Combined with `@function` + `if()` you can fake a lot of iteration. `children-count()` and selector-argument variants are proposal-only ([csswg #11068](https://github.com/w3c/csswg-drafts/issues/11068), [#9572](https://github.com/w3c/csswg-drafts/issues/9572)).

---

## 5. Invoker Commands — `command` / `commandfor`

Richer popover/dialog targeting, declarative built-ins, extensible custom commands. Superset of `popovertarget`.

> Naming history (to spot stale docs): proposed Oct 2023 as `invoketarget`/`invokeaction` + `InvokeEvent`; renamed to **`command`/`commandfor` + `CommandEvent`** on 2024-07-25. Anything mentioning `invoketarget`, `invokeaction`, `InvokeEvent`, or the `HTMLInvokeActionsV2` flag is pre-rename. ([Open UI explainer](https://open-ui.org/components/invokers.explainer/), [WebKit bug 276616](https://bugs.webkit.org/show_bug.cgi?id=276616))

```html
<button commandfor="confirm-dialog" command="show-modal">Delete Record</button>
<dialog id="confirm-dialog">
  <button commandfor="confirm-dialog" command="close" value="cancel">Cancel</button>
  <button commandfor="confirm-dialog" command="close" value="delete">Delete</button>
</dialog>
```
The button's `value` becomes the dialog's `returnValue` on `close`. Use `type="button"` to avoid form submission.

### Built-in commands — exactly 6 shipped (all engines)

| Target | command | Effect | JS equivalent |
|---|---|---|---|
| `<dialog>` | `show-modal` | open modal | `dialog.showModal()` |
| `<dialog>` | `close` | close, sets `returnValue` from `value` | `dialog.close()` |
| `<dialog>` | `request-close` | preventable `cancel` then close | `dialog.requestClose()` |
| `[popover]` | `show-popover` | show | `el.showPopover()` |
| `[popover]` | `hide-popover` | hide | `el.hidePopover()` |
| `[popover]` | `toggle-popover` | toggle | `el.togglePopover()` |

*Stale flag:* the March 2025 Chrome blog lists only 5 (omits `request-close`); current MDN compat + Safari 26.2 confirm **6**.

### Custom commands — must start with `--`

```html
<button commandfor="the-image" command="--rotate-left">Rotate Left</button>
<button commandfor="the-image" command="--reset">Reset</button>
<img id="the-image" src="/image.svg" alt="image">
```
```js
image.addEventListener("command", (e) => {           // CommandEvent on the TARGET
  // e.command = "--rotate-left" etc; e.source = the invoking <button>
  if (e.command === "--reset") image.style.rotate = "0deg";
  // ...
});
```
`CommandEvent`: `{ command, source }`, dispatched on `commandForElement`, non-bubbling, composed, trusted, cancellable. Custom commands do **no** default action and carry **no** automatic ARIA. ([MDN CommandEvent](https://developer.mozilla.org/en-US/docs/Web/API/CommandEvent))

### Proposed / NOT shipped (need JS or custom commands today)
`<details>` `toggle`/`open`/`close`; `<input type=number>` `step-up`/`step-down`; `show-picker`; media `play`/`pause`/`play-pause`/`toggle-muted`/fullscreen; `copy`/`share`. All from [Open UI Future Invokers](https://open-ui.org/components/future-invokers.explainer/). Some "work" in flagged Chrome only.

### Support & relation to popovertarget

| Browser | Version | Date |
|---|---|---|
| Chrome/Edge | **135** | 2025-04-01 |
| Firefox | **144** | 2025-10-14 (was flag `dom.element.commandfor`) |
| Safari | **26.2** | 2025-12-12 |

**Baseline: Newly available since 2025-12-12.** ~81% global. ([MDN compat button.json](https://github.com/mdn/browser-compat-data/blob/main/html/elements/button.json), [web-features-explorer](https://web-platform-dx.github.io/web-features-explorer/features/invoker-commands/))

- `popovertarget="x"` ≡ `commandfor="x" command="toggle-popover"`. When both present, `command`/`commandfor` wins.
- `popovertarget` is **NOT deprecated** (HTML spec as of 2026-05-28 has no deprecation marker); the explainer's "will eventually replace it" is aspirational. They coexist; prefer `command`/`commandfor` in new code.
- *Conflicts resolved:* Firefox is **144** (not 142); Safari is **26.2** (NOT 26.0 — 26.0/26.1 did not ship it).

Polyfill: [`invokers-polyfill`](https://github.com/keithamus/invokers-polyfill) (Keith Cirkel / Luke Warlow), v1.0.3 (2026-04-09). Covers the 6 built-ins + custom commands + `CommandEvent`; does **not** replicate the browser's ARIA handling (`aria-expanded`) — set it yourself. Mostly legacy-coverage now that all three engines shipped.

A11y: built-ins require real `<button>` (keyboard/focus/SR semantics free), browser manages focus + top-layer + ARIA relationships for dialog/popover. `commandfor` references by id and can't cross shadow DOM — use the `.commandForElement` property.

---

## 6. Mind-benders (verified, with ship status)

| Feature | What it does | Ship | Baseline | Note |
|---|---|---|---|---|
| **`corner-shape` + `superellipse()`** | real squircles/scoops/notches on `border-radius` | Chrome/Edge **139** (2025-08-05) | Limited | *prompt's "137" wrong*. [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/corner-shape) |
| **`shape()`** | responsive `clip-path`/`offset-path` with arcs/curves in CSS units (editable, unlike `path()`) | Chrome **135**, Safari **18.4**, Firefox **148** | **Newly ✓** | VERIFIED 2026-05 all 3 engines (was mis-said Chrome 137). [Chrome](https://developer.chrome.com/blog/css-shape) · [WebKit](https://webkit.org/blog/16794/the-css-shape-function/) · [caniuse](https://caniuse.com/css-shape) |
| **Scroll-state container queries** | `@container scroll-state(stuck/snapped/scrollable)` — style a stuck sticky header, no JS scroll listener | Chrome/Edge **133** | Limited | [Chrome](https://developer.chrome.com/blog/css-scroll-state-queries) · [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Conditional_rules/Container_scroll-state_queries) |
| **`contrast-color()`** | auto-pick black/white for contrast against a color | Chrome **147**, Safari **26.0**, Firefox **146** | **Newly ✓ (Apr 2026)** | VERIFIED Baseline Newly all 3 engines. only B/W, WCAG2 luminance, no guaranteed AA. [WebKit](https://webkit.org/blog/16929/contrast-color/) · [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/contrast-color) · [caniuse](https://caniuse.com/wf-contrast-color) |
| **`::scroll-marker` / `::scroll-button()`** | pure-CSS accessible carousel dots + prev/next | Chrome/Edge **135** | Limited | [Chrome](https://developer.chrome.com/blog/carousels-with-css) |
| **`reading-flow` / `reading-order`** | decouple focus/AT order from DOM order in flex/grid | Chrome/Edge **137** | Limited | [Chrome](https://developer.chrome.com/blog/reading-flow) |
| **`interpolate-size` / `calc-size()`** | animate to/from `auto`/`fit-content`/`max-content` | Chrome/Edge **129** | Limited | gates animated `<details>`. [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/interpolate-size) |
| **`text-autospace`** | auto spacing between CJK and Latin/numerals | all engines 2025 | **Newly (Nov 2025)** | `normal` shifts existing CJK layout. [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/text-autospace) |
| **`text-spacing-trim`** | CJK punctuation kerning | Chromium-leaning | Limited | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/text-spacing-trim) |
| **`caret-animation: manual`** | stop the blink so you can animate caret color | Chrome **139** | Limited | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/caret-animation) |
| **`:state()`** | match custom-element states via `ElementInternals.states` | engines 2024–25 | verify | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/:state) |
| **`:has-slotted`** | match `<slot>` with non-empty assigned content | — | Limited | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/:has-slotted) |
| **`::target-text`** | style the text-fragment-highlighted range (`#:~:text=`) | broad | verify | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/::target-text) |
| **Nested view-transition groups** | `::view-transition-group()` restores clipping/grouping | Chrome **140** | Limited | element-scoped concurrent transitions land Chrome 147. [Chrome](https://developer.chrome.com/docs/css-ui/view-transitions/nested-view-transition-groups) |
| **`light-dark()`** | pick value by color scheme inline | all engines 2024 | **Newly** | needs `color-scheme: light dark`. [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) |

```css
/* corner-shape squircle */
.tile { border-radius: 30px; corner-shape: squircle; }   /* squircle == superellipse(2) */

/* shape() editable clip-path */
.blob { clip-path: shape(from 0 0, line to 100% 0, arc to 50% 100% of 40% ccw, close); }

/* scroll-state: style a header BECAUSE it is stuck */
header { container-type: scroll-state; }
@container scroll-state(stuck: top) { h1 { box-shadow: 0 2px 8px #0003; } }

/* auto contrast text */
button { background: var(--c); color: contrast-color(var(--c)); }
```

---

## 7. What's safe vs progressive-enhancement (mid-2026)

| Cross-engine / safe-ish | Chromium-only — enhancement only |
|---|---|
| Invoker commands (Newly Dec 2025) · `light-dark()` · `text-autospace` · `:state()` · `shape()` ✓ · `contrast-color()` ✓ (both now verified cross-engine) | `if()` · `@function` · typed `attr()` · `sibling-index/count` · `corner-shape`/`superellipse()` · scroll-state queries · `::scroll-marker` · `reading-flow` · `interpolate-size` · `caret-animation` · nested VT groups |

The whole "CSS as a language" tier (`if`, `@function`, typed `attr`, `sibling-index`) is Chromium-only — powerful for internal tools / Electron / known-Chromium docs viewers, but needs fallbacks for the open web. Invoker commands are the one genuinely cross-engine new capability in this batch.

---

## Conflict / staleness ledger
1. `corner-shape`/`superellipse` = Chrome **139**, not 137.
2. `@function` = Chrome **139**, delayed from 136 — discard "136".
3. typed `attr()` "Jan 15 2025" is a blog date; ship = Chrome **133** (~Feb 2025).
4. Invoker commands: Firefox **144** (not 142); Safari **26.2** (not 26.0).
5. `contrast-color()` — **VERIFIED 2026-05** Baseline Newly (Apr 2026): Chrome 147, Safari 26.0, Firefox 146 ([caniuse](https://caniuse.com/wf-contrast-color)). `sibling-index/count` Safari 26.2 + Chrome 138 confirmed, **no Firefox → stays Limited** ([caniuse](https://caniuse.com/wf-sibling-count)).
6. `shape()` — **VERIFIED 2026-05** Baseline Newly: Chrome **135** (not 137), Safari 18.4, Firefox 148 ([caniuse](https://caniuse.com/css-shape)).
7. No CSS for-loop exists or is concretely proposed.
