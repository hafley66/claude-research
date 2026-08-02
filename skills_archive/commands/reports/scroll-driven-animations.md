# CSS Scroll-Driven Animations — Raw Research Brief

*Compiled 2026-05-31. The user found this spec "turbulent"; this brief explains why and gives current status. Synthesized form lives in `native-css-jutsu.md`.*

## 1. SPEC STATUS & HISTORY — WHY IT WAS TURBULENT

**Current spec status:** Scroll-driven Animations Module Level 1, W3C **Working Draft, June 6, 2023** (latest published TR). Editor's Draft at drafts.csswg.org/scroll-animations-1/. Still a WD, not CR. ([w3.org/TR/scroll-animations-1](https://www.w3.org/TR/scroll-animations-1/), [drafts.csswg.org/scroll-animations-1](https://drafts.csswg.org/scroll-animations-1/))

**Why early adopters got burned — the syntax was rewritten twice:**

| Era | Mechanism | Status now |
|---|---|---|
| 2020–2021 | `@scroll-timeline` **at-rule** with descriptors `source`, `orientation`, `scroll-offsets`, `time-range` | **REMOVED** |
| 2022→ | `scroll-timeline` / `view-timeline` **properties** + `scroll()` / `view()` functions + `animation-range` | Current |

The original 2021 syntax (Bram.us, [The Future of CSS, Part 1, 2021-02-23](https://www.bram.us/2021/02/23/the-future-of-css-scroll-linked-animations-part-1/)):

```css
/* OBSOLETE — do not use */
@scroll-timeline progressbar-timeline {
  source: selector(#scrollContainer);
  orientation: vertical;
  scroll-offsets: 0%, 100%;
  time-range: 1s;       /* descriptor later deleted entirely */
}
#progressbar {
  animation: 1s linear forwards adjust-progressbar;
  animation-timeline: progressbar-timeline;
}
```

Chrome implemented this at-rule behind a flag (Chrome Canary 107-era, also Firefox 97 behind a flag), then it was ripped out. The CSSWG replaced the at-rule with the property/function model in the 2022 rewrite. Bram.us rewrote its series accordingly ([Scroll-Linked Animations with ScrollTimeline and ViewTimeline, 2022-10-27](https://www.bram.us/2022/10/27/scroll-linked-animations-with-scrolltimeline-and-viewtimeline/)). This is the turbulence: code written against `@scroll-timeline` no longer parses.

Other documented breaking changes in the Changes section of the spec ([w3.org/TR/scroll-animations-1](https://www.w3.org/TR/scroll-animations-1/)):
- Removed `scroll-timeline-attachment` / `view-timeline-attachment` → replaced by **`timeline-scope`** (Issue 7759).
- Named timelines switched from `<custom-ident>` to **`<dashed-ident>`** (must start with `--`) (Issue 8746). Code using non-dashed timeline names broke.

Naming history note: the feature was renamed from "Scroll-linked Animations" to "Scroll-driven Animations" in Gecko in Firefox 110 (Bugzilla [1807685](https://bugzilla.mozilla.org/show_bug.cgi?id=1807685), RESOLVED FIXED).

### Current syntax (complete)

**`animation-timeline`** — names which timeline drives an animation. Must be declared *after* the `animation` shorthand (the shorthand resets it to `auto`).
```css
animation-timeline: auto | none | --my-name | scroll(...) | view(...);
```

**Named scroll timeline:**
```css
scroll-timeline-name: --dashed-ident;          /* must start with -- */
scroll-timeline-axis: block | inline | x | y;   /* default block */
scroll-timeline: --name block;                  /* shorthand */
```

**Named view timeline:**
```css
view-timeline-name: --dashed-ident;
view-timeline-axis: block | inline | x | y;     /* default block */
view-timeline-inset: auto | <length-percentage>{1,2};  /* default auto */
view-timeline: --name block;                    /* shorthand: name + axis only */
```

**`timeline-scope`** — hoists a timeline name up to an ancestor so non-descendant subjects can reference it:
```css
timeline-scope: --name;
```

**`scroll()` anonymous function:** `scroll(<scroller> <axis>)`
- scroller: `nearest` (default), `root`, `self`
- axis: `block` (default), `inline`, `x`, `y`

**`view()` anonymous function:** `view(<axis> <inset>)`
- axis: `block` (default), `inline`, `x`, `y`
- inset: `auto` (default) or `<length-percentage>{1,2}`

**`animation-range` / `animation-range-start` / `animation-range-end`:**
Named ranges: `cover`, `contain`, `entry`, `exit`, `entry-crossing`, `exit-crossing` (each takes an optional 0–100% offset). `normal` is the default.
```css
animation-range: entry 0% cover 50%;
animation-range-start: entry 25%;
animation-range-end: cover 50%;
```
(Syntax confirmed: [developer.chrome.com/docs/css-ui/scroll-driven-animations](https://developer.chrome.com/docs/css-ui/scroll-driven-animations), [MDN scroll-timeline](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-timeline), [WebKit guide, 2025-06-20](https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/).)

### Working examples

**Scroll-progress bar** (anonymous scroll timeline of the root scroller):
```css
@keyframes grow-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
#progress {
  position: fixed; left: 0; top: 0; width: 100%; height: 4px;
  background: red; transform-origin: 0 50%;
  animation: grow-progress auto linear;
  animation-timeline: scroll();   /* == scroll(nearest block); use scroll(root) to force document */
}
```

**Reveal-on-scroll** (view timeline, subject is the element itself):
```css
@keyframes reveal { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
.card {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% cover 40%;
}
```

### JS API (Web Animations API)
```js
// ScrollTimeline
el.animate({ transform: ['scaleX(0)', 'scaleX(1)'] }, {
  fill: 'forwards',
  timeline: new ScrollTimeline({ source: document.documentElement, axis: 'block' }),
});

// ViewTimeline with range
el.animate({ opacity: [0, 1] }, {
  timeline: new ViewTimeline({ subject: el, axis: 'block' }),
  rangeStart: 'entry 25%',
  rangeEnd: 'cover 50%',
});
```
(Per [developer.chrome.com/docs/css-ui/scroll-driven-animations](https://developer.chrome.com/docs/css-ui/scroll-driven-animations).)

---

## 2. BROWSER SUPPORT MATRIX (mid-2026)

| Browser | First version | Date | Notes |
|---|---|---|---|
| **Chrome** | **115** | 2023-05-05 | Full CSS + WAAPI. Compositor perf improvements landed ~Chrome 116. ([developer.chrome.com](https://developer.chrome.com/docs/css-ui/scroll-driven-animations)) |
| **Edge** | **115** | 2023 | Chromium-based, tracks Chrome |
| **Opera** | **101** | 2023 | Chromium-based |
| **Samsung Internet** | **23** | 2023 | |
| **Safari (macOS) / Safari iOS** | **26.0** | 2025-09-15 | Shipped stable. ([webkit.org/blog/17333](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/), [Apple release notes](https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes)) |
| Safari 26.4 | — | 2026-03-24 | Added **threaded** (compositor-thread) scroll-driven animations. ([webkit.org/blog/17862](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/)) |
| Safari 26.5 | — | 2026 | Four reliability fixes. ([webkit.org/blog/17938](https://webkit.org/blog/17938/webkit-features-for-safari-26-5/)) |
| **Firefox** | **not shipped** | — | Behind flag `layout.css.scroll-driven-animations.enabled`. **Default ON in Nightly since Fx 136**; OFF in Release/Beta/DevEdition (prefs present since Fx 110). ([MDN Experimental features](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Experimental_features)) |

**Firefox detail (the conflicting-info zone — flag, not flag-free):**
- Pref exists since **Fx 110**; enabled by default **only in Nightly (Fx 136+)**.
- Fx 150 (2026-04-21) added `<timeline-range-name>` values to `animation-range*` — still behind the flag. ([web-standards.dev Firefox 150](https://web-standards.dev/news/2026/04/firefox-150/))
- Fx 151 (2026-05-19) still lists scroll-driven animations under **Experimental web features**, default OFF. ([MDN Firefox 151 release notes](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/151))
- Part of **Interop 2026** ([webkit.org/blog/17818](https://webkit.org/blog/17818/announcing-interop-2026/)), so an unflag is expected during 2026, but no shipped stable Firefox release as of 2026-05-31. No confirmed Fx 152/153 unflag date found — flag this as TBD.
- Meta bug: Bugzilla [1676780](https://bugzilla.mozilla.org/show_bug.cgi?id=1676780); Nightly-enable bug [1817303](https://bugzilla.mozilla.org/show_bug.cgi?id=1817303).

**Baseline status:** **Limited availability** (not Baseline). MDN's `animation-timeline` page shows the "Limited availability" badge "because it does not work in some of the most widely-used browsers" — i.e., Firefox stable. ([MDN animation-timeline](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline))

**caniuse:** `animation-timeline: scroll()` global usage **~83%** (82.96%). Chrome/Edge 115+, Opera 101+, Samsung 23+, Safari 26.0+ (desktop+iOS), Firefox "Disabled by default" 110–154. ([caniuse mdn-css_properties_animation-timeline_scroll](https://caniuse.com/mdn-css_properties_animation-timeline_scroll)) Earlier search snippets citing "Chrome 115 in 2024" are wrong; Chrome 115 shipped 2023-05-05 — flag those as stale.

---

## 3. POLYFILL — flackr/scroll-timeline

- **Repo:** [github.com/flackr/scroll-timeline](https://github.com/flackr/scroll-timeline). No tagged GitHub releases; ~271 commits, actively developed, ~64 open issues / ~22 open PRs.
- **npm:** `scroll-timeline-polyfill` (Libraries.io shows 1.1.0). The repo README itself does not name the npm package; the published package mirrors flackr's dist. ([npm scroll-timeline-polyfill](https://www.npmjs.com/package/scroll-timeline-polyfill), [Libraries.io](https://libraries.io/npm/scroll-timeline-polyfill))
- **Load:**
  ```html
  <script src="https://flackr.github.io/scroll-timeline/dist/scroll-timeline.js"></script>
  ```
  or `import 'https://flackr.github.io/scroll-timeline/dist/scroll-timeline.js'` or, via npm, `import "scroll-timeline-polyfill/dist/scroll-timeline.js"`. It self-registers only if native support is absent, and registers the needed CSS Typed OM classes.
- **Supports:** `ScrollTimeline` and `ViewTimeline` JS objects; CSS `animation-timeline` with `scroll()`/`view()`; named `scroll-timeline`/`view-timeline`; `animation-range`. ([README](https://github.com/flackr/scroll-timeline/blob/master/README.md))
- **Known gaps:**
  - `animation-timeline: view()` combined with `animation-range` is reported broken (Issue [#205](https://github.com/flackr/scroll-timeline/issues/205)).
  - `animation-range` support with scroll-timeline reported flaky vs native (Issue [#151](https://github.com/flackr/scroll-timeline/issues/151)).
  - Cross-origin stylesheets cannot be processed — CSS must be same-origin or inline `<style>` (README, documented limitation).
- **Performance:** It is a JS shim, so it runs on the **main thread** (the README does not document the internal loop; community reports indicate rAF-style polling plus IntersectionObserver-like behavior for view timelines). It cannot deliver the native off-main-thread/compositor behavior. Treat as functional, not jank-free. Flag: the exact internal mechanism (rAF vs scroll-event) is not stated in primary docs — uncertain.
- **Maintenance:** active (CI, recent commits), but no formal versioned releases.

---

## 4. SHORTCOMINGS / ROUGH EDGES

**Performance / off-main-thread:**
- Scroll-driven animations *can* run on the **compositor thread**, decoupled from the main thread, so they stay smooth (targeting 120Hz) even under heavy JS. ([developer.chrome.com/blog/scroll-animation-performance-case-study](https://developer.chrome.com/blog/scroll-animation-performance-case-study))
- Off-main-thread only for **compositor-friendly properties**: `transform` (translate/scale/rotate), `opacity` (and filter on some engines). Animating layout/paint properties (width, height, top/left, color, box-shadow, etc.) forces the animation onto the **main thread** and reintroduces jank. The Chrome case study shows this qualitatively (CSS version "completely unaffected by heavy JS") but gives **no numeric metrics**. Examples deliberately use `scaleX`/`opacity`.
- Safari got threaded scroll-driven animations only in **26.4** (2026-03-24); 26.0–26.3 ran them on the main thread. ([webkit.org/blog/17862](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/))
- Polyfill is always main-thread (Section 3).

**Accessibility — `prefers-reduced-motion`:**
- Best practice: gate animations with `@media (prefers-reduced-motion: no-preference)` (progressive enhancement) rather than blanket `animation: none`. NRK uses exactly this pattern. ([developer.chrome.com/blog/nrk-casestudy](https://developer.chrome.com/blog/nrk-casestudy), [web.dev/articles/prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion))
- WebKit's own guide recommends wrapping in `@media not (prefers-reduced-motion)` and notes large/parallax/zoom effects carry higher motion-sickness risk than small progress bars. ([webkit.org/blog/17101](https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/))
- Maps to **WCAG 2.3.3 Animation from Interactions**. ([w3.org WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html))
- Note: Chrome's perf case study contains **no** a11y guidance — accessibility lives in the WebKit/NRK/web.dev sources.

**Other rough edges / gotchas:**
- **Timeline must find its source.** A named timeline is only visible to the subject if the subject is a **descendant** of the element declaring `scroll-timeline-name`/`view-timeline-name`; otherwise you need `timeline-scope` on a common ancestor. This scoping is the most-reported source of "my animation does nothing." ([MDN scroll-timeline](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-timeline))
- **`<dashed-ident>` required.** Timeline names must start with `--`; non-dashed names silently fail.
- **Shorthand resets `animation-timeline`.** Declaring `animation-timeline` *before* the `animation` shorthand gets clobbered.
- **Zero-length scroll range** edge case (currentTime when range is 0) is still an open spec discussion (csswg-drafts Issue [#7778](https://github.com/w3c/csswg-drafts/issues/7778)).
- **Cross-engine `animation-range` parity** is incomplete: works in Chrome 115+ and Safari 26+, Firefox flag-only, polyfill partial (Section 3).
- **Layout-dependent timelines:** view/scroll timelines depend on scroller geometry; dynamic content resize can shift ranges. Firefox has a longstanding related quirk (smooth-scroll reset, Bugzilla [1692708](https://bugzilla.mozilla.org/show_bug.cgi?id=1692708)).

---

## 5. Stale / conflicting info flagged
- "Chrome 115 shipped in 2024" (one search snippet) — **wrong**; 2023-05-05.
- "Firefox fully implemented, just behind a flag" is true but commonly **overstated as shipping**; it is default-on in **Nightly only** as of Fx 136, OFF in stable through Fx 151.
- Polyfill internal mechanism (rAF vs scroll-event) — **not documented in primary sources**; treat as uncertain.
- No confirmed Firefox stable unflag version/date found; Interop 2026 inclusion implies 2026 but is unconfirmed.

### Key source URLs
- Spec: https://www.w3.org/TR/scroll-animations-1/ · https://drafts.csswg.org/scroll-animations-1/
- Chrome: https://developer.chrome.com/docs/css-ui/scroll-driven-animations · https://developer.chrome.com/blog/scroll-animation-performance-case-study
- WebKit: https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/ · https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ · https://webkit.org/blog/17862/webkit-features-for-safari-26-4/
- MDN: https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline · https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Experimental_features · https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/151
- Firefox bugs: https://bugzilla.mozilla.org/show_bug.cgi?id=1676780 · =1817303 · =1807685
- caniuse: https://caniuse.com/mdn-css_properties_animation-timeline_scroll
- Polyfill: https://github.com/flackr/scroll-timeline · issues #205, #151 · https://www.npmjs.com/package/scroll-timeline-polyfill
- History: https://www.bram.us/2021/02/23/the-future-of-css-scroll-linked-animations-part-1/ · https://www.bram.us/2022/10/27/scroll-linked-animations-with-scrolltimeline-and-viewtimeline/
