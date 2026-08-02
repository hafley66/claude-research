# D2 Diagram Language Reference

Research date: 2026-05-18  
Primary project: <https://github.com/terrastruct/d2>  
Language docs: <https://d2lang.com>  
Docs source: <https://github.com/terrastruct/d2-docs>  
Latest release observed: `v0.7.1`, 2025-08-19, <https://github.com/terrastruct/d2/releases/tag/v0.7.1>

This document is a compact reference for humans and LLMs working with D2, with extra focus on animations, composition, grouping, grid structure, and recent changelog and issue state.

## Executive Index

D2 is a declarative text-to-diagram language. A `.d2` file describes shapes, containers, connections, styles, imports, variables, and optional multi-board composition. The CLI renders SVG by default and can also render PNG, PDF, PPTX, GIF, ASCII, and stdout output.

Core primitives:

| Concept | Syntax or field | Purpose |
|---|---|---|
| Shape | `x`, `x: Label`, `x.shape: cloud` | Node/object declaration |
| Connection | `a -> b`, `a -- b`, `a <-> b` | Relationship between shapes |
| Container | `group: { child }` | Hierarchical grouping |
| Style | `x.style.fill: red` | Visual styling |
| Class | `classes: { danger: { style.fill: red } }` | Reusable attributes and tags |
| Glob | `*.style.fill: yellow` | Bulk target shapes/connections |
| Grid | `grid-rows`, `grid-columns` | Structured cell layout |
| Board | `layers`, `scenarios`, `steps` | Multi-board composition |
| Animation | `--animate-interval`, `style.animated` | Board transitions or animated object/edge styling |
| Internal link | `x.link: layers.foo` | Click to another board |
| External link | `x.link: https://...` | Click to external URL |
| Tooltip | `x.tooltip: ...` | Hover or fixed note |
| Imports | `@file`, `...@file` | Modular diagrams |
| Variables | `${var}`, spread substitutions | Reuse values and config |
| Model slicing | `suspend`, `unsuspend` | Define one model, render views |

## Tour Page Inventory

The D2 docs tour currently includes these page families:

| Area | Pages |
|---|---|
| Introduction | What is D2, dev tool versus design tool, design decisions, community, roadmap |
| Getting started | Install, hello world, shapes, connections, containers |
| Special objects | Text/code/Markdown/LaTeX, icons/images, SQL tables, UML classes, sequence diagrams, grid diagrams |
| Customization | Themes, styles, classes, dimensions, positions, sketch mode, interactive links/tooltips, fonts |
| Layouts | Overview, dagre, ELK, TALA |
| In depth | Strings, variables, globs, comments, overrides/null, models, legend, autoformat |
| Composition | Intro, layers, scenarios, steps, linking between boards, export formats |
| Imports | Syntax, use cases, modular classes, model-view, nested composition |
| Extensions | VSCode, Vim, Obsidian, Slack, Discord, community plugins |
| API | D2 Oracle create/set/delete/rename/move and ID deltas |
| CLI and output | CLI manual, exports, cheat sheet, FAQ, troubleshooting, contributing |

Source page list was taken from `docs/tour` in `terrastruct/d2-docs`.

## Basic Language Model

### Shapes

Shapes can be declared by key, labeled by assigning a value, and given a type with `shape`.

```d2
api
db: PostgreSQL
cache.shape: cylinder
```

Keys are case-insensitive. Labels are display text. Connections reference keys, not labels.

Default shape type is `rectangle`. Common shape values include rectangle, square, circle, oval, diamond, cloud, cylinder, queue, package, document, page, parallelogram, hexagon, callout, stored_data, step, person, and `c4-person`. Special object shapes include `sql_table`, `class`, `sequence_diagram`, `image`, `text`, Markdown/code/LaTeX blocks, and grid containers.

1:1 ratio shapes:

| Shape | Behavior |
|---|---|
| `circle` | Width and height stay equal |
| `square` | Width and height stay equal |

### Connections

Valid connection operators:

```d2
a -- b
a -> b
a <- b
a <-> b
```

Labels attach after `:`.

```d2
client -> api: request
api -> db: query
```

Repeated connections create multiple edges. Connection chains are allowed.

```d2
a -> b -> c
```

Connections can be referenced by original ID plus index:

```d2
a -> b
(a -> b)[0].style.stroke: red
```

Arrowheads are configured with `source-arrowhead` and `target-arrowhead`.

```d2
order -> user: {
  target-arrowhead.shape: diamond
  target-arrowhead.style.filled: true
}
```

Arrowhead shape options include `triangle`, `arrow`, `diamond`, `circle`, `box`, `cross`, `cf-one`, `cf-one-required`, `cf-many`, and `cf-many-required`.

## Lexical Pitfalls In Unquoted Labels

D2 supports unquoted shape and connection labels (`key: My Label { ... }`), but the lexer reserves several characters for connection syntax. Putting them in an unquoted label silently breaks parsing.

| Character | Why reserved | Example that fails |
|---|---|---|
| `[` `]` | Connection indexing — `(a -> b)[0]` | `ast: ast[lang] { ... }` |
| `(` `)` | Connection grouping and shape-array filter | `key: foo (bar) { ... }` is hazardous; fails outright in some positions |
| `{` `}` | Map open/close | obvious |
| `;` | Statement terminator inside maps | `key: a; b` |
| `#` | Line comment | `key: c#5 issue` |
| `--` `->` `<-` `<->` | Connection operators | `key: a -> b explanation` |
| `&` `!&` | Filter expressions inside maps | `key: &foo bar` |
| `:` second one | Key separator | `key: a: b` |

Symptom in the wild:

```
err: -:104:15: unexpected text after unquoted string
err: -:109:1: unexpected map termination character } in file map
```

caused by

```d2
ast:   ast[lang] (rust/c/cpp via ast-grep) { class: grammar }
```

Both the `[lang]` and the trailing `(...)` are lexed as connection-syntax fragments, so the parser desynchronizes and the container's closing `}` then looks like a stray termination.

Fix: quote any label that contains a reserved character.

```d2
ast: "ast<lang> — rust/c/cpp via ast-grep" { class: grammar }
```

Slashes, dots, the middle-dot `·`, em dash `—`, and angle brackets `<>` are safe unquoted. Parens are the most common hazard — easy to write, easy to miss until d2 fails.

Tooltips, connection labels, and class strings have the same lexer; quote them on the same rule.

**Programmatic-generation rule**: when emitting D2 from code or an LLM, default to quoting every label. Unquoted form is only safe for trivial identifier-style strings (`[A-Za-z0-9_.·—]`).

Other related quoting cases already noted elsewhere in this doc:

- Board names containing `.` must be quoted in `link` paths: `a.link: layers."2012.06"`.
- Single quotes bypass variable substitution: `'${not_a_var}'`.

## Style Attribute Placement

Style keywords (`bold`, `italic`, `underline`, `font-size`, `fill`, `stroke`, `border-radius`, `shadow`, `multiple`, `3d`, `animated`, etc.) only work in two forms:

```d2
# inside a style map
foo: { style: { bold: true; font-size: 14 } }

# as dotted attribute
foo: { style.bold: true }
foo.style.bold: true
```

Bare `bold: true` directly inside a shape map is rejected as `bold must be style.bold`. The mistake is easy to make when adjusting an attribute originally written inside `style: { ... }` and then moving it next to `class: foo`.

Common shape: `class` applies a style preset, and you want to bold *this one* instance on top. Right way:

```d2
node: "label" { class: stage; style.bold: true }   # OK
node: "label" { class: stage; bold: true }         # ERR: bold must be style.bold
```

## Markdown Hazards In Tooltips And Connection Labels

`tooltip:` values and any label rendered through Markdown (`|md ... |`) are parsed as HTML/Markdown. Substrings that look like an HTML opening tag fail with `malformed Markdown: attribute name without = in element`.

Real case:

```d2
reg: "registry.rs" { tooltip: "string-shape → Box<dyn Op> factory" }
#                                              ^^^^^^^^^^
# `<dyn Op>` parses as an HTML element; `dyn` is then read as an attribute
# with no `=` value → error.
```

Fix options:

| Option | Example |
|---|---|
| Rephrase to drop the angle brackets | `"string-shape to Box of dyn Op factory"` |
| Backtick-quote as code | `` "string-shape → `Box<dyn Op>` factory" `` |
| HTML entities | `"string-shape → Box&lt;dyn Op&gt; factory"` |

Plain shape *labels* (not tooltips, not `|md|` blocks) are not Markdown-parsed, so `"FactStore<Cursor>"` and `"ast<lang>"` work fine as shape labels. The hazard is specifically: tooltip values, Markdown blocks, and any string rendered as HTML.

## Layout Direction Is A Lie When Root Shapes Have Cross-Edges

`direction: down` at the root **does not** force top-down stacking when there are many root-level sibling containers with edges between them. Both `dagre` and `elk` will choose layout dimensions to minimize edge crossings — when the edges cross-cut the structure (e.g. tier 8 → tier 5 back-edges), the engines spread siblings horizontally. A 10-tier "top to bottom" diagram easily renders as a 27000×1400 single strip — 19:1 aspect ratio, unreadable on any screen.

The fix is structural, not a style flag: wrap the root-level containers in a single explicit `grid-rows` master.

```d2
diagram: "" {
  style: { fill: white; stroke: white }
  grid-rows: 10        # one row per tier
  grid-columns: 1
  grid-gap: 40

  t0: { ... }
  t1: { ... }
  ...
  t9: { ... }
}
```

Grid layout is a hard constraint, not a hint — children stack as specified regardless of edge routing. Edges then route around or through the stack.

Two follow-on gotchas with this wrapper:

1. **Title and legend** need to be *children* of the master too. If they live at the root with `near: top-center` / `near: bottom-left`, the master container's viewBox may not expand to include them; the title appears in the SVG but is clipped by the outer `<svg>` element. Move them inside the master as additional grid rows (`grid-rows: 12` to leave room).
2. **Edge references** must use the qualified path `diagram.t0.foo`, not the bare `t0.foo`. D2 silently drops edges that reference unknown identifiers, so the diagram compiles and renders without arrows — the failure mode is invisible until you grep for `marker-end` in the SVG.

`title:` at the root is also a special-cased key on newer d2 versions — when used as a child key of a grid container the markdown shape does not render. Rename the child to `header:` (or anything else) and the markdown shape appears in the grid flow.

## `double-border: true` Renders As Solid Black In Stacked Grid Cells

`double-border: true` on a shape class works fine for a standalone shape, but inside a grid-laid container the inner and outer borders touch on tall cells and render as a solid filled rectangle (text becomes unreadable on top of black fill). Substitute `stroke-width: 2` for a similar visual weight without the artifact.

Triggered specifically when:

- shape uses `double-border: true`
- shape is inside a container that uses `grid-rows` or `grid-columns`
- cells are forced into a tall narrow aspect ratio by sibling widths

## Edge Spaghetti — Cross-Tier Jump Budget

The most common reason a layered diagram becomes unreadable is *not* node density — it is the number of edges that span more than one tier. Once a single diagram has more than ~3 edges that cross 3+ tiers, the layout engine has to route long arcs through containers and the visual coherence collapses regardless of layout engine.

Practical heuristic when designing layered diagrams (verified against `d2 0.7.1`):

- Adjacent-tier edges (N → N+1): unlimited. These convey the flow.
- One-tier-skipping edges (N → N+2): up to ~5 in a 10-tier diagram before clutter sets in.
- Long jumps (N → N+3 or more): aim for zero. Replace with one anchored back-edge from the *driver* (e.g. shells → runtime) and rely on tier titles to convey upstream/downstream meaning.

When in doubt: **containment + a tier title is a free edge**. A child cell inside a tier container implicitly belongs to that tier; you do not need an arrow to say so.

## Grouping And Containers

Containers are normal D2 objects with children.

```d2
aws: {
  api
  db
  api -> db
}
```

Container labels can be shorthand or explicit:

```d2
svc: Service {
  api
}

cluster: {
  label: Production Cluster
  api
}
```

Inside a container, `_` references the parent scope.

```d2
cluster: {
  api
  api -> _.outside
}
outside
```

FAQ constraint: an object cannot be part of more than one container. For repeated appearances, use multiple shapes with matching labels or split views with composition.

## Composition: Layers, Scenarios, Steps

D2 composition defines multiple boards inside one diagram.

| Keyword | Inheritance | Common use |
|---|---|---|
| `layers` | New blank board | Different abstraction levels, zoomable diagrams |
| `scenarios` | Inherit from base layer | Alternate states or variants |
| `steps` | First step inherits from parent, later steps inherit previous step | Sequences and walkthroughs |

Minimal shape:

```d2
root -> item

layers: {
  details: {
    item -> internal
  }
}

scenarios: {
  outage: {
    item.style.opacity: 0.3
    fallback
  }
}

steps: {
  one: { start }
  two: { start -> finish }
}
```

### Layers

A layer represents another abstraction level. It starts from an empty board, so the layer defines its own objects.

Use cases:

| Use | Mechanism |
|---|---|
| Architecture zoom | Root component links to a layer with lower-level internals |
| Alternative abstraction | Layer board omits parent objects and uses its own model |
| PDF navigation | Root page links to layer pages |

### Scenarios

A scenario represents another view of the base board. It inherits base objects and modifies or adds to them.

Use cases:

| Use | Mechanism |
|---|---|
| Normal versus hotfix deployment | Base deployment plus scenario-specific edge changes |
| Showing change | Dim inherited objects, add the changed flow |
| Variant comparison | Same root graph with altered labels/styles/connections |

### Steps

A step represents a sequential build-up. Each step inherits from the previous step.

Use cases:

| Use | Mechanism |
|---|---|
| Process walkthrough | Step 1 introduces actor, step 2 adds action, step 3 adds result |
| Animation storyboard | Each step becomes a frame |
| Reveal effect | Later boards add objects or connections |

### Internal Links

`link` can point to board paths.

```d2
api.link: layers.api_detail

layers: {
  api_detail: {
    handler -> database
  }
}
```

If a board name includes `.`, quote the segment.

```d2
a.link: layers."2012.06"
```

In `link` values, `_` means parent board, not parent container.

### Board Export Formats

| Format | Multi-board behavior |
|---|---|
| Multiple SVGs | Default for multi-board SVG output, board links rewrite to filesystem paths |
| Single animated SVG | Use `--animate-interval=1200`; boards cycle in one SVG |
| Single animated GIF | Same board-cycle idea for GIF contexts |
| PDF | Each board becomes a page; internal links point to pages |
| PPTX | Each board can become presentation material |

Docs source: <https://d2lang.com/tour/composition/> and <https://d2lang.com/tour/composition-formats/>

## Animation

D2 has two animation concepts.

### 1. Board Animation

Board animation packages multiple boards into one animated SVG or GIF. The driver is the CLI `--animate-interval` flag.

```shell
d2 in.d2 out.svg --animate-interval=1200
d2 in.d2 out.gif --animate-interval=1200
```

The interval is milliseconds per board. The docs animation blog shows an animated SVG produced from D2 text and notes that omitting the animation flag splits the boards into separate SVG outputs.

Useful board-animation patterns:

| Pattern | Board type |
|---|---|
| Show before/after | `scenarios` |
| Show a timeline | `steps` |
| Show progressive construction | `steps` |
| Switch between system states | `scenarios` |
| Demonstrate grid build-up | `steps` or scenario/layer sequence |

CLI details from `d2cli/main.go` and man page:

| Flag | Meaning |
|---|---|
| `--animate-interval` | Package multiple boards as one SVG transitioning every N milliseconds; SVG/GIF only |
| GIF default | Current source defaults GIF interval to `1000ms` when omitted |
| `--target` | Render a board path; a path ending with `*` includes that board's scenarios, steps, and layers |
| `--bundle` | Bundle SVG assets and layers into output |

Current next changelog says GIF exports will work with `style.animated` and `animate-interval` is no longer required for GIFs, defaulting to `1000ms`.

### 2. Element Animation

`style.animated: true` can be used on connections and, since `v0.6.9`, on shapes.

```d2
a -> b: {
  style.animated: true
}

server: {
  style.animated: true
}
```

Historical points:

| Version | Change |
|---|---|
| `v0.1.6` | `animated` keyword implemented for connections |
| `v0.3.0` | `--animate-interval` introduced for multi-board diagrams |
| `v0.4.0` | Animated SVG namespaces fixed so multiple animated D2 SVGs can coexist on one page |
| `v0.4.1` | GIF export added |
| `v0.6.6` | Bidirectional connections animate in opposite directions |
| `v0.6.7` | Theme flag fixed for GIF output and scale flag fixed for animated SVG output |
| `v0.6.9` | `style.animated: true` supported on shapes |
| Next unreleased | GIF exports work with `animate: true`; GIF defaults animation interval to `1000ms` |

### Animation Limits And Open Issues

Issue query run on 2026-05-18.

| Issue | State | Signal |
|---|---|---|
| [#1461 more `animated`](https://github.com/terrastruct/d2/issues/1461) | Open | Broader animation surface requested |
| [#1698 Controlling animation speed](https://github.com/terrastruct/d2/issues/1698) | Open | More granular speed control requested |
| [#1979 Animated connections don't honor prefers-reduced-motion](https://github.com/terrastruct/d2/issues/1979) | Open | Accessibility behavior missing |
| [#1576 Animate-Interval loops through scenarios and layers](https://github.com/terrastruct/d2/issues/1576) | Open | Composition loop semantics remain a known topic |
| [#2566 cooler `animated: true` in sketch mode](https://github.com/terrastruct/d2/issues/2566) | Open | Sketch-mode animation appearance requested |
| [#1949 animated connections without dashed lines have icons](https://github.com/terrastruct/d2/issues/1949) | Open | Visual affordance request |
| [#653 animate keyword on crows foot](https://github.com/terrastruct/d2/issues/653) | Open | Arrowhead animation limitation |
| [#2698 panic: animate-interval plus force-appendix](https://github.com/terrastruct/d2/issues/2698) | Open | Recent crash involving animation and appendix |
| [#1823 Windows `d2.exe -w` animation errors](https://github.com/terrastruct/d2/issues/1823) | Open | Watch-mode/platform issue |

Closed animation issues include connection animation implementation [#639](https://github.com/terrastruct/d2/issues/639), bidirectional animation [#654](https://github.com/terrastruct/d2/issues/654), step animation [#767](https://github.com/terrastruct/d2/issues/767), animated SVG output for steps [#1280](https://github.com/terrastruct/d2/issues/1280), GIF export with animated keyword [#1666](https://github.com/terrastruct/d2/issues/1666), bidirectional sketch-mode animation [#1943](https://github.com/terrastruct/d2/issues/1943), scale flag for animated SVG [#2068](https://github.com/terrastruct/d2/issues/2068), and GIF theme flag [#2067](https://github.com/terrastruct/d2/issues/2067).

Animation docs and blog:

- <https://d2lang.com/blog/animation/>
- <https://d2lang.com/tour/composition/>
- <https://d2lang.com/tour/composition-formats/>
- <https://d2lang.com/tour/style/#animated>

## Grid Diagrams

Grid diagrams are structured layout objects using `grid-rows` and/or `grid-columns`.

```d2
board: {
  grid-columns: 3
  a
  b
  c
  d
}
```

Rules:

| Feature | Behavior |
|---|---|
| `grid-rows` only | Children fill rows and expand cells |
| `grid-columns` only | Children fill columns and expand cells |
| Both set | First field seen is dominant fill direction |
| `width`, `height` | Can force specific constructions |
| Cells | Same column shares width; same row shares height |
| Gap | `grid-gap`, `vertical-gap`, `horizontal-gap` |
| `grid-gap: 0` | Useful for maps and table-like constructions |
| Grid-to-grid connections | Normal |
| Cell-to-cell connections | Center-to-center straight segments because the grid imposes layout outside the layout engine |
| Nesting | Grid diagrams can nest inside grid diagrams |
| Alignment trick | Use invisible elements to pad/align |

Grid diagrams can be animated by modeling the build-up as composition boards and exporting with `--animate-interval`.

Docs: <https://d2lang.com/tour/grid-diagrams/>

## Sequence Diagrams And Groups

Declare sequence diagrams with `shape: sequence_diagram`.

```d2
seq: {
  shape: sequence_diagram
  alice -> bob: hello
}
```

Sequence diagrams use normal D2 syntax with two different semantics:

| Rule | Meaning |
|---|---|
| Shared child scope | Children of a sequence diagram refer to the same actors across nested groups |
| Definition order matters | Actors and messages render in source order |

Features:

| Feature | D2 form |
|---|---|
| Actors | Top-level child keys under sequence diagram |
| Messages | Connections between actors |
| Spans | Nested object on actor with connections |
| Groups | Unconnected container inside sequence diagram with connections or objects inside |
| Notes | Nested object on actor with no connections |
| Self-messages | Actor connects to itself |
| Lifelines | Inherit actor `stroke` and `stroke-dash` |

Group constraint: inside a sequence group, referenced actors in connections must already exist at the sequence top level.

Current issue signal: [#2750 Notes in nested groups break sequence diagrams](https://github.com/terrastruct/d2/issues/2750) opened 2026-05-14.

Docs: <https://d2lang.com/tour/sequence-diagrams/>

## Text, Markdown, Code, And LaTeX

D2 supports:

| Object | Notes |
|---|---|
| Standalone Markdown | Text blocks render Markdown |
| Markdown label | Shape must be declared explicitly |
| Non-Markdown text | `shape: text` |
| Code blocks | Set language to `go`, `ts`, `py`, etc.; Chroma handles highlighting |
| LaTeX | `latex` or `tex`, rendered through MathJax |
| Unicode | Non-Latin languages and emoji generally supported |

Recent changes:

| Version | Change |
|---|---|
| `v0.6.9` | GitHub-flavored Markdown tables in `md` blocks |
| `v0.6.9` | Variables substituted in Markdown blocks |
| `v0.7.0` | Markdown, LaTeX, and code usable as object labels |
| `v0.7.1` | Markdown, LaTeX, and code usable as edge labels |

Docs: <https://d2lang.com/tour/text/>

## SQL Tables And UML Classes

### SQL Tables

SQL tables are special shapes for database diagrams. Columns are fields. Constraints can express primary/foreign key relationships. ELK supports routing SQL table edges to exact columns as of `v0.6.2`.

Docs: <https://d2lang.com/tour/sql-tables/>

### UML Classes

`shape: class` supports UML class diagrams. Keys define fields or methods.

Rules:

| Class entry | Meaning |
|---|---|
| `name: type` | Field |
| `method(): type` | Method with return type |
| `method()` | Method returning void |
| `+` prefix | Public |
| `-` prefix | Private |
| `#` prefix | Protected |

Recent updates:

| Version | Change |
|---|---|
| `v0.7.1` | `style.underline` support for class fields and methods |
| Next unreleased | ASCII support for SQL tables and UML classes |

Docs: <https://d2lang.com/tour/uml-classes/>

## Styles

Valid style keywords from the docs:

| Style | Scope | Value |
|---|---|---|
| `opacity` | Shapes/connections | Float `0` to `1` |
| `stroke` | Shapes/connections | CSS color, hex, subset of gradients |
| `fill` | Shapes | CSS color, hex, subset of gradients |
| `fill-pattern` | Shapes | `dots`, `lines`, `grain`, `none` |
| `stroke-width` | Shapes/connections | Integer `1` to `15` |
| `stroke-dash` | Shapes/connections | Integer `0` to `10` |
| `border-radius` | Shapes/connections | Integer `0` to `20`; connection corners on engines with corner routes |
| `shadow` | Shapes | Boolean |
| `3d` | Rectangles/squares | Boolean |
| `multiple` | Shapes | Boolean |
| `double-border` | Rectangles/ovals | Boolean |
| `font` | Shapes/connections | Currently `mono` |
| `font-size` | Shapes/connections | Integer `8` to `100` |
| `font-color` | Shapes/connections | CSS color, hex, subset of gradients |
| `animated` | Shapes/connections | Boolean |
| `bold`, `italic`, `underline` | Text | Boolean |
| `text-transform` | Labels | `uppercase`, `lowercase`, `title`, `none` |

Root-level styles:

| Root style | Meaning |
|---|---|
| `style.fill` | Diagram background |
| `style.fill-pattern` | Background pattern |
| `style.stroke` | Frame |
| `style.stroke-width` | Frame width |
| `style.stroke-dash` | Frame dash |
| `style.double-border` | Double frame |

Docs: <https://d2lang.com/tour/style/>

## Themes, Fonts, Sketch

Themes are set by CLI flags or `d2-config` variables. Dark themes can be set separately for adaptive dark mode. Theme overrides use `theme-overrides` and `dark-theme-overrides`.

Special themes can set defaults beyond colors. The Terminal theme sets caps lock labels, no border radius, monospaced font, dotted fill pattern for containers, and double border on the outer container.

Sketch mode gives a hand-drawn aesthetic and supports animated connections. As of `v0.7.1`, sketch renders use custom font families when provided.

Font controls:

| Flag | Purpose |
|---|---|
| `--font-regular` | Regular font |
| `--font-italic` | Italic font |
| `--font-bold` | Bold font |
| `--font-semibold` | Semibold font |
| `--font-mono` | Monospace font, added in `v0.7.1` |
| `--font-mono-bold` | Monospace bold |
| `--font-mono-italic` | Monospace italic |
| `--font-mono-semibold` | Monospace semibold |

Docs:

- <https://d2lang.com/tour/themes/>
- <https://d2lang.com/tour/sketch/>
- <https://d2lang.com/tour/fonts/>

## Classes

Classes aggregate reusable attributes.

```d2
classes: {
  danger: {
    style.fill: "#ffdddd"
    style.stroke: red
  }
}

api.class: danger
```

Connection classes:

```d2
a -> b: { class: slow }

a -> b
(a -> b)[0].class: slow
```

Multiple classes are arrays and apply left-to-right.

```d2
node.class: [base; warning; selected]
```

Classes are also emitted into SVG class attributes, which makes them useful as tags for post-processing and custom CSS/JS.

Docs: <https://d2lang.com/tour/classes/>

## Globs

Globs target many shapes or connections at once.

```d2
*.style.fill: yellow
**.shape: circle
(** -> **)[*].style.stroke: red
```

Glob rules:

| Feature | Syntax |
|---|---|
| All in current scope | `*` |
| Recursive | `**` |
| Global recursive across layers/imports | `***` |
| Connection creation | `* -> *` |
| Indexed connection targeting | `(a -> b)[0]`, `(a -> b)[*]` |
| Filters | `&shape: circle` |
| Inverse filters | `!&shape: circle` |
| AND filters | Multiple `&...` lines |
| Endpoint filters | `&src: id`, `&dst: id`, `&src.style.fill: blue` |
| Property filters | `&connected: true`, `&leaf: true`, `&level: 0` |
| Filter by array membership | Works against class arrays |
| Filter existence | `&link: *` |

Glob behavior:

| Rule | Behavior |
|---|---|
| Applies backward and forward | A glob affects already defined and later defined matching objects |
| Case-insensitive | Matching ignores case |
| Scoped | A glob applies to its scope unless recursive/global |
| Recursive connection exception | Recursive connection globs target leaf shapes, not containers |
| Imported globs | Usually do not carry over; triple globs do |

Docs: <https://d2lang.com/tour/globs/>

## Variables And Configuration

Variables live under `vars` and can be substituted into diagram fields.

```d2
vars: {
  color: "#476CEF"
  label: API
}

api: ${label} {
  style.fill: ${color}
}
```

Important variable behaviors:

| Feature | Meaning |
|---|---|
| Nested variables | Vars can contain maps |
| Scoped variables | Vars resolve by scope |
| Single quotes | Bypass substitutions |
| Spread substitutions | Insert maps/arrays into current location |
| Markdown vars | Since `v0.6.9`, vars can substitute inside Markdown blocks |
| Current-scope references | Since `v0.6.7`, variable definitions can refer to other variables in current scope |

Config variables live under `vars.d2-config`.

Common config keys include layout engine, theme IDs, dark theme IDs, center, pad, scale, sketch, and theme overrides. D2.js `0.1.22` added support for several options: `themeID`, `darkThemeID`, `center`, `pad`, `scale`, `forceAppendix`, `target`, `animateInterval`, `salt`, and `noXMLTag`.

Docs: <https://d2lang.com/tour/vars/>

## Imports And Modular Diagrams

D2 imports support regular imports and spread imports.

```d2
lib: @models
...@classes
```

Patterns:

| Pattern | Use |
|---|---|
| Regular import | Import file as a nested object |
| Spread import | Merge imported map into current scope |
| Omit extension | Import `file` instead of `file.d2` |
| Partial import | Import a specific path |
| Relative import | Path relative to importing file |
| Absolute import | Supported as of `v0.6.7` |
| Imported boards | Used in nested composition and model-view patterns |

Useful high-level patterns:

| Pattern | Files |
|---|---|
| Modular classes | `classes.d2` plus `main.d2` |
| Model-view | `models.d2` plus focused view files |
| Nested composition | `overview.d2` imports child boards |
| C4 model | model file, view files, code-level layer files |

Docs:

- <https://d2lang.com/tour/imports/>
- <https://d2lang.com/tour/imports-use-cases/>
- <https://d2lang.com/tour/modular-classes/>
- <https://d2lang.com/tour/model-view/>
- <https://d2lang.com/tour/nested-composition/>

## Models, Suspend, Unsuspend

`suspend` marks shapes or connections for removal until later restored by `unsuspend`.

Common C4/model-view pattern:

```d2
# define model
customer -> system
system -> database

# hide model
**: suspend
(** -> **)[*]: suspend

# restore selected view
**: unsuspend {
  &level: 0
}

(** -> **)[*]: unsuspend {
  &src.level: 0
  &dst.level: 0
}
```

This supports "one model, multiple views" diagrams. The C4 blog identifies D2 `v0.7.0` as the release that filled key C4 gaps: `suspend`/`unsuspend`, Markdown labels, `c4-person`, C4 theme, and `d2-legend`.

Docs:

- <https://d2lang.com/tour/models/>
- <https://d2lang.com/blog/c4/>

## Positions And Layout

D2 normally delegates position to layout engines.

Layout engines:

| Engine | Notes |
|---|---|
| dagre | Default, fast layered/hierarchical layout based on Graphviz DOT ideas |
| ELK | Directed graph layout, mature, handles ports/column routing better in some cases |
| TALA | Terrastruct layout engine for software architecture diagrams, separate binary |

Layout-specific support:

| Feature | Engine note |
|---|---|
| `near` constants | All layout engines |
| `near` another object | TALA only |
| `width`/`height` on containers | ELK only per docs, with grid-specific sizing support added later |
| `top`/`left` fixed positions | TALA only |
| Container-to-descendant connection | Not supported by dagre |
| Per-container direction | TALA only |

`direction` values:

```d2
direction: right
# or up, down, left
```

`near` constants:

```d2
title: |md
  # System Overview
| {
  near: top-center
}
```

Near positions include `top-left`, `top-center`, `top-right`, `center-left`, `center-right`, `bottom-left`, `bottom-center`, and `bottom-right`.

Labels and icons can use `near`, `outside-*`, and `border-*` positions. `border-x` label positioning was added in `v0.7.1`.

Tooltips with `near` are always visible rather than hover-only.

Docs:

- <https://d2lang.com/tour/layouts/>
- <https://d2lang.com/tour/positions/>

## Interactive Features

```d2
x.tooltip: More detail
x.link: https://example.com
```

Tooltips use HTML title tags, so Markdown formatting does not render in regular hover tooltips. Static exports such as PNG convert tooltip icons to numbered markers and add an appendix. `v0.7.1` added fixed tooltips with `near`.

Links can target external URLs or internal board paths. `v0.6.9` added non-HTTP schemes such as `vscode://file/...`.

Docs: <https://d2lang.com/tour/interactive/>

## Legend

Legends can be defined through `vars.d2-legend`. The legend behaves like a mini diagram whose shapes/connections are deconstructed into a table. Opacity `0` items are excluded.

`v0.7.0` added diagram legends. `v0.7.1` added renaming of the "Legend" title.

Docs:

- <https://d2lang.com/tour/legend/>
- <https://d2lang.com/blog/c4/>

## Output Formats

| Output | Notes |
|---|---|
| SVG | Default; web-context SVG with CSS and `foreignObject` for Markdown |
| PNG | Rendered by Playwright/headless Chromium screenshotting SVG |
| PDF | PNG pages plus headers/fonts; links can remain clickable |
| PPTX | Presentation output, useful with composition |
| GIF | Short animated compositions |
| ASCII | New in `v0.7.1`, beta/alpha quality, `.txt` extension |
| Stdout | SVG by default; PNG supported with `--stdout-format png -` |

SVG technical notes:

| Detail | Meaning |
|---|---|
| Element classes | Base64-encoded IDs for safe CSS targeting |
| Deterministic hash prefix | Prevents conflicts in clip paths, gradients, etc. |
| Web context | Markdown relies on `foreignObject` and may not render correctly in some SVG viewers |

ASCII limitations from the ASCII blog and docs:

| Limitation | Notes |
|---|---|
| Styles | Mostly unsupported; `animated` and font do not apply |
| Themes | Moot for text output |
| Special text | Markdown, LaTeX, code are not generally rendered as rich content |
| Images/icons | Not supported as graphical assets |
| Shape fidelity | Some shapes become rectangle-like approximations |
| Status | Docs call ASCII beta; blog calls renderer alpha |

Docs:

- <https://d2lang.com/tour/exports/>
- <https://d2lang.com/blog/ascii/>

## API And Tooling

D2 can be used as a Go library and has an "Oracle" API for bidirectional edits:

| API | Purpose |
|---|---|
| `Create` | Create shape/connection |
| `Set` | Set a field |
| `Delete` | Delete an object/connection |
| `Rename` | Rename an object and update references |
| `Move` | Move object/container path |
| ID deltas | Track ID changes after programmatic modifications |

CLI and editor tooling:

| Tool | Notes |
|---|---|
| `d2 fmt` | Autoformat; `--check` added in `v0.6.9` |
| `d2 validate` | Added in `v0.7.0` |
| `d2 play` | Open input in online playground, added in `v0.6.9` |
| Watch mode | Live-reload workflow; watches imports as of `v0.6.2` |
| VSCode | Official extension |
| Vim | Official extension |
| Obsidian, Slack, Discord | Official integrations listed in docs/repo |
| D2.js | Browser/WASM package with separate changelog |

Docs:

- <https://d2lang.com/tour/api/>
- <https://d2lang.com/tour/man/>
- <https://github.com/terrastruct/d2/blob/master/d2js/js/CHANGELOG.md>

## Recent Release Timeline

| Version | Date | Major relevant changes |
|---|---:|---|
| `v0.7.1` | 2025-08-19 | ASCII output, `cross` arrowhead, edge labels can be Markdown/LaTeX/code, border label positioning, fixed tooltips with `near`, monospace font flags, scenario/step primary labels, board order preserved by formatter |
| `v0.7.0` | 2025-05-02 | Connection icons, `suspend`/`unsuspend`, endpoint glob filters, `level` filter, Markdown/LaTeX/code object labels, `c4-person`, diagram legends, `validate` command |
| `v0.6.9` | 2025-02-05 | Shape animation, connection links, Markdown var substitution, GitHub-flavored Markdown tables, box arrowheads, `fmt --check`, PNG stdout, `&connected` and `&leaf` filters, `play` command |
| `v0.6.8` | 2024-11-07 | SVG renders in non-browser contexts improved, deterministic PPTX metadata, empty board keywords removed, board shorthand label bug fix |
| `v0.6.7` | 2024-09-28 | Vars can reference current-scope vars, imported-board underscore references, absolute imports, gradients, sequence diagram layout fixes in child boards, GIF theme and animated SVG scale flag fixes |
| `v0.6.6` | 2024-08-02 | Glob inverse filters, glob filter values, bidirectional connection animation direction fix, nested board import fixes, scenario glob fixes |
| `v0.6.2` | 2023-12-07 | Single board rendering with `--target`, ELK SQL column routing, grid nested edges, watch mode watches imports |
| `v0.4.1` | 2023-04-18 | GIF exports and PPTX for multi-board compositions, grid gaps |
| `v0.4.0` | 2023-04-09 | Classes, grid diagrams, multi-board SVG link outputs, animated SVG namespace fix |
| `v0.3.0` | 2023-03-30 | `--animate-interval` for multi-board animations |
| `v0.1.6` | 2023-01-12 | `animated` keyword for connections |
| `v0.1.0` | 2022-12 era | Windows support, experimental sequence diagrams, LaTeX, direction, self-connections, arrowhead labels, SVG IDs |

Release sources:

- <https://github.com/terrastruct/d2/releases>
- <https://github.com/terrastruct/d2-docs/tree/master/docs/releases>

## Next Changelog Snapshot

From `ci/release/changelogs/next.md` in `terrastruct/d2` master as cloned on 2026-05-18:

| Area | Upcoming item |
|---|---|
| GIF animation | GIF exports work with `animate: true` keyword |
| GIF defaults | `animate-interval` no longer required for GIF, default `1000ms` |
| ASCII | SQL table and UML class shapes supported |
| ASCII | Newlines handled, empty left columns cropped |
| PNG | CLI prompts for Chromium download through CLI |
| Rendering | Remote images fetched more reliably |
| PPTX | Standards compliance improvements |
| Sequence | Invalid sequence diagram edge case fixed |
| SVG | Legend text overflow with monospace fixed |

Source: <https://github.com/terrastruct/d2/blob/master/ci/release/changelogs/next.md>

## Current Issue Signals

Open issues query run on 2026-05-18 showed 100 recent open issues from #2754 down to #2493. Relevant clusters:

| Cluster | Examples |
|---|---|
| Animation | [#2698](https://github.com/terrastruct/d2/issues/2698), [#2566](https://github.com/terrastruct/d2/issues/2566), [#1979](https://github.com/terrastruct/d2/issues/1979), [#1698](https://github.com/terrastruct/d2/issues/1698), [#1576](https://github.com/terrastruct/d2/issues/1576) |
| Composition and boards | [#2751](https://github.com/terrastruct/d2/issues/2751), [#2678](https://github.com/terrastruct/d2/issues/2678), [#2667](https://github.com/terrastruct/d2/issues/2667), [#2643](https://github.com/terrastruct/d2/issues/2643), [#1554](https://github.com/terrastruct/d2/issues/1554) |
| Grids | [#2743](https://github.com/terrastruct/d2/issues/2743), [#2493](https://github.com/terrastruct/d2/issues/2493), [#2259](https://github.com/terrastruct/d2/issues/2259) |
| Sequence diagrams | [#2750](https://github.com/terrastruct/d2/issues/2750), [#2676](https://github.com/terrastruct/d2/issues/2676), [#2633](https://github.com/terrastruct/d2/issues/2633), [#2568](https://github.com/terrastruct/d2/issues/2568) |
| Markdown/text sizing | [#2734](https://github.com/terrastruct/d2/issues/2734), [#2706](https://github.com/terrastruct/d2/issues/2706), [#2705](https://github.com/terrastruct/d2/issues/2705), [#2680](https://github.com/terrastruct/d2/issues/2680), [#2546](https://github.com/terrastruct/d2/issues/2546) |
| D2.js/WASM | [#2746](https://github.com/terrastruct/d2/issues/2746), [#2601](https://github.com/terrastruct/d2/issues/2601), [#2522](https://github.com/terrastruct/d2/issues/2522), [#2286](https://github.com/terrastruct/d2/issues/2286) |
| Layout engines | [#2719](https://github.com/terrastruct/d2/issues/2719), [#2717](https://github.com/terrastruct/d2/issues/2717), [#2683](https://github.com/terrastruct/d2/issues/2683), [#2673](https://github.com/terrastruct/d2/issues/2673), [#2597](https://github.com/terrastruct/d2/issues/2597) |
| ASCII | [#2634](https://github.com/terrastruct/d2/issues/2634), [#2631](https://github.com/terrastruct/d2/issues/2631), [#2630](https://github.com/terrastruct/d2/issues/2630), [#2629](https://github.com/terrastruct/d2/issues/2629), [#2627](https://github.com/terrastruct/d2/issues/2627), [#2625](https://github.com/terrastruct/d2/issues/2625), [#2624](https://github.com/terrastruct/d2/issues/2624), [#2621](https://github.com/terrastruct/d2/issues/2621) |
| Imports/files | [#2710](https://github.com/terrastruct/d2/issues/2710), [#2694](https://github.com/terrastruct/d2/issues/2694), [#2642](https://github.com/terrastruct/d2/issues/2642), [#2536](https://github.com/terrastruct/d2/issues/2536) |
| Colors/fonts/themes | [#2690](https://github.com/terrastruct/d2/issues/2690), [#2684](https://github.com/terrastruct/d2/issues/2684), [#2639](https://github.com/terrastruct/d2/issues/2639), [#2602](https://github.com/terrastruct/d2/issues/2602), [#2537](https://github.com/terrastruct/d2/issues/2537) |

Most recent open issues on 2026-05-18:

| Issue | Created | Title |
|---|---:|---|
| [#2754](https://github.com/terrastruct/d2/issues/2754) | 2026-05-18 | Issue |
| [#2752](https://github.com/terrastruct/d2/issues/2752) | 2026-05-16 | apiD2 encountered an API error |
| [#2751](https://github.com/terrastruct/d2/issues/2751) | 2026-05-14 | Feature request: alternatives in groups |
| [#2750](https://github.com/terrastruct/d2/issues/2750) | 2026-05-14 | Notes in nested groups break sequence diagrams |
| [#2746](https://github.com/terrastruct/d2/issues/2746) | 2026-05-11 | d2js WASM worker keeps Node event loop alive |
| [#2744](https://github.com/terrastruct/d2/issues/2744) | 2026-05-11 | Update body/container background to match SVG background |
| [#2743](https://github.com/terrastruct/d2/issues/2743) | 2026-05-04 | Feature request: snake-like grid layout |

## GitHub Issue Discussion Notes

Issue bodies and comments were sampled for animation, composition, grouping, grid, modularity, and model-view topics.

### Animation Semantics

| Issue | Discussion signal |
|---|---|
| [#1576 Animate-Interval loops through scenarios and layers](https://github.com/terrastruct/d2/issues/1576) | Initial maintainer response treated full board traversal as intentional for read-only animation, but on 2025-10-01 the maintainer revised the position: animations should traverse scenarios and steps, not layers. |
| [#1698 Controlling animation speed](https://github.com/terrastruct/d2/issues/1698) | User case: race-condition diagrams where different speeds show which path usually wins. Discussion explored `style.animation-speed`, `style.speed`, or making `style.animated` a float. No shipped syntax observed. |
| [#1979 prefers-reduced-motion](https://github.com/terrastruct/d2/issues/1979) | User requested generated CSS honor `prefers-reduced-motion` so animated paths stop for users with reduced-motion preference. No comments or fix observed. |
| [#1461 more `animated`](https://github.com/terrastruct/d2/issues/1461) | Desired extensions include blinking shapes, a moving circle or label along non-dashed lines, and later using connection icons as the moving element. Also raises interaction between `style.animated` and `--animate-interval`. |
| [#1949 animated non-dashed connections with icons](https://github.com/terrastruct/d2/issues/1949) | Maintainer indicated connection icons were a prerequisite. Discussion considered whether `animated` could choose `icon` or `label` as the moving artifact. |
| [#2566 sketch-mode animation](https://github.com/terrastruct/d2/issues/2566) | Request links to simulated hand-drawn SVG motion as an animation reference for sketch mode. |

Current animation model from discussion:

| Layer | Status |
|---|---|
| Static decorators | Implemented baseline: animated connection dash, shape bounce/blink class of effects |
| Expressive decorators | Proposed: fade in/out, flashing, icon motion, growing arrows |
| State transitions | Proposed: animate changes between board states, such as color changing from unhealthy to healthy |
| Time/delay/easing controls | Explicitly treated as out of scope in the animation framework discussion, despite users requesting duration and delays |
| Chaining | Expected to be modeled with board composition, especially steps |

Source: [GitHub Discussion #2677, "wip: Framework for animations"](https://github.com/terrastruct/d2/discussions/2677)

### Composition And Model View

| Issue | Discussion signal |
|---|---|
| [#711 model-view/C4-style views](https://github.com/terrastruct/d2/issues/711) | Original request wanted CLI-style filters such as tags, depth, and root node. Later discussion settled on a D2-native pattern: define model, suspend all shapes and edges, then `unsuspend` selected shapes/edges using globs and filters. |
| [#998 composition docs](https://github.com/terrastruct/d2/issues/998) | Maintainer summarized inheritance: layers are new trees, scenarios inherit from the layer, steps inherit from previous step. |
| [#554 modular D2 files](https://github.com/terrastruct/d2/issues/554) | Early demand centered on splitting large diagrams into modules and sharing style/class definitions. Imports later landed, but comments in 2025 still ask for clearer true modular class import examples. |
| [#2667 board references](https://github.com/terrastruct/d2/issues/2667) | Maintainer floated named boards, a global reference namespace, or root keyword to improve board reference ergonomics. A user suggested starting with a dot. |

Practical model-view pattern from #711:

```d2
# model
user -> softwareSystem
softwareSystem: {
  serviceA.class: ok
  serviceB
  serviceA -> serviceB
}

# clear model
**: suspend
(** -> **)[*]: suspend

# restore a view
*: unsuspend
**: unsuspend {
  &class: ok
}
(** -> softwareSystem.serviceA)[*]: unsuspend
(softwareSystem.serviceA -> **)[*]: unsuspend
```

### Grouping, Grids, And Missing Diagram Types

| Issue or discussion | Discussion signal |
|---|---|
| [#2751 alternatives in groups](https://github.com/terrastruct/d2/issues/2751) | Request for sequence-diagram alternatives inside one group, with separators between branches and support for more than two alternatives. Current workaround is consecutive groups, which does not express exclusivity. |
| [#2743 snake-like grid layout](https://github.com/terrastruct/d2/issues/2743) | Request for alternating row direction in grids, such as `A -> B -> C -> D`, next row `H <- G <- F <- E`, using syntax like `direction: alternating right left`. |
| [Discussion #328 cross-cutting containers](https://github.com/terrastruct/d2/discussions/328) | Cross-cutting containers are not directly possible. Maintainer proposed possible `constraint: [x.y; a]` syntax for a shape drawn around a bounding box of existing objects, with no children. |
| [Discussion #236 swim lanes](https://github.com/terrastruct/d2/discussions/236) | Swimlane diagrams remain a recurring request. A user tried approximating swimlanes with grid diagrams. |
| [Discussion #605 ports](https://github.com/terrastruct/d2/discussions/605) | Users want controlled connection points on shapes, especially for decision diamonds and flowcharts. Proposed syntax used `shape: port` as children of a parent. |
| [Discussion #1688 sequence alternatives/loops](https://github.com/terrastruct/d2/discussions/1688) | Maintainer initially treated option/alternative/loop support as mostly labels on groups, but later comments still report missing explicit support. |

## GitHub Discussions Signals

Recent and long-lived GitHub Discussions add these signals:

| Discussion | Signal |
|---|---|
| [#2720 Is the project still alive?](https://github.com/terrastruct/d2/discussions/2720) | Users are concerned by slower public activity and whether to invest in D2 versus Mermaid. This is an ecosystem confidence issue, not a language feature. |
| [#2677 animation framework](https://github.com/terrastruct/d2/discussions/2677) | Maintainer framed animation as diagram-specific legibility, not general animation authoring. Users requested duration/delay controls, large-scale style separation, AI generation, and swimlane priority. |
| [#905 How far is D2 1.0?](https://github.com/terrastruct/d2/discussions/905) | Pre-1.0 syntax changes discussed: remove case-insensitivity, make sequence spans/groups explicit, remove raw pipe strings, possibly change comment leader from `#` to `//`. These are discussion items, not observed shipped changes. |
| [#648 C4Model diagrams](https://github.com/terrastruct/d2/discussions/648) | Early user examples showed C4 in D2 using Markdown-like labels and containers. Later official C4 support arrived through `v0.7.0` features. |
| [#2714 manually advance through animation](https://github.com/terrastruct/d2/discussions/2714) | Recent request for manual control over SVG animation progression. |
| [#2711 Playground target rendering](https://github.com/terrastruct/d2/discussions/2711) | Request for playground ability to render a specific target board. |
| [#2535 d2oracle.Set multiple attributes](https://github.com/terrastruct/d2/discussions/2535) | Maintainer answer: set attributes one by one. |

## External Tutorials And User-Written Guidance

External sources are less current than official docs and GitHub issues, but they show how users teach and apply D2.

| Source | Coverage | Useful signal |
|---|---|---|
| [LogRocket, "A complete guide to declarative diagramming with D2"](https://blog.logrocket.com/complete-guide-declarative-diagramming-d2/) | Intro tutorial from 2023 covering install, shapes, connections, themes, styles, dimensions, strings, comments, overrides | Good beginner framing; stale on `animated` because it lists animation as connection-only, before `v0.6.9` shape animation |
| [Code4IT, "D2: like Mermaid, but better"](https://www.code4it.dev/architecture-notes/d2-diagrams/) | Practical article updated 2026-03-04 covering grouping, SQL tables, installation, VSCode, Obsidian, tips, layout engines, variables, Mermaid comparison | Useful practice: declare structure first, then list cross-container connections separately; use comments to group connections by outbound module |
| [netlab D2 output module](https://netlab.tools/outputs/d2/) | D2 as generated output for network topology, BGP, IS-IS, VRF graphs | Shows D2 used as a target language from structured data. It maps node/link attributes to D2 style fields and warns that layout-engine choice and declaration order affect clutter |
| [JetBrains Writerside D2 diagrams](https://www.jetbrains.com/help/writerside/d2-diagrams.html) | Documentation integration | Supports inline `d2` code blocks and referencing external `.d2` files from docs |
| [Tools-Online D2 architecture guide](https://www.tools-online.app/blog/D2-Diagrams-Online-Complete-Architecture-Diagram-Guide) | Architecture tutorial and comparison article | Frames D2 for microservices, cloud infrastructure, documentation, and professional stakeholder diagrams; emphasizes SVG for docs and PNG for presentations/chat |
| [Udemy course, "Master D2"](https://www.udemy.com/course/learn-d2-diagramming/) | 10-hour course listing | Course outline mirrors official tour but spends heavy time on grid diagrams, sequence diagrams, text/code/LaTeX, SQL tables, UML classes, icons/images |

External tutorial patterns:

| Pattern | Source signal |
|---|---|
| Keep cross-container connections outside nested declarations | Code4IT |
| Try layout engines when generated topology is cluttered | netlab, Code4IT |
| Use D2 as generated output from another model | netlab |
| Store `.d2` source beside docs and include by file reference | Writerside |
| Prefer D2 for architecture diagrams, Mermaid for GitHub-native or broad diagram type support | Code4IT, Tools-Online |
| Be cautious with old tutorials for exact feature lists | LogRocket predates shape animation, C4, ASCII, legends, and many glob features |

## Reddit And Community Discussion Signals

Reddit threads are noisy, but they reveal user friction and adoption patterns.

| Thread | Signal |
|---|---|
| [r/programming launch thread](https://www.reddit.com/r/programming/comments/x19u9w/d2_a_new_declarative_language_to_turn_text_into/) | Early comparisons centered on Mermaid, Graphviz, PlantUML, TikZ, and browser/CLI availability. Users asked about custom shapes, layout engines, bidirectional editor behavior, and CI use. |
| [r/programming grid diagrams thread](https://www.reddit.com/r/programming/comments/12gi908/d2_texttodiagram_language_introducing_grid/) | Grid release discussion raised layout-engine agnosticism, magic dimensions in examples, need for ports, manual coordinates, and cell width shifting during animations. |
| [r/selfhosted home-network thread](https://www.reddit.com/r/selfhosted/comments/1gin6ut/holy_crap_d2_diagrams_are_impressive/) | Users liked D2 for home network diagrams but wanted integrations with notes/wiki tools, more layout control, and better handling of complex overlapping group membership. |

Community pain points seen repeatedly:

| Pain point | Where it appears |
|---|---|
| GitHub-native rendering absent | Reddit, external comparisons |
| Layout control is limited by design | Reddit, discussions, FAQ |
| Ports/connection points requested | Reddit, GitHub Discussion #605 |
| Cross-cutting group membership requested | Reddit, GitHub Discussion #328 |
| Sequence alternatives/loops/swimlanes requested | GitHub Discussions #1688 and #236, Issue #2751 |
| Need style/module reuse at scale | Issue #554, Discussion #2677 |
| Animation needs accessibility and controls | Issues #1979 and #1698, Discussion #2677 |

## Updated Practical Guidance From External Research

For large diagrams:

1. Define model objects and containers first.
2. Put cross-container or cross-module edges in a separate connection section.
3. Use stable absolute IDs for cross-container edges.
4. Move reusable styling into classes and imported files where possible.
5. Use globs for bulk style defaults.
6. Use `suspend`/`unsuspend` to create model slices.
7. Use `layers` for zoomable abstraction, `scenarios` for alternate inherited states, and `steps` for temporal progression.
8. Test `dagre`, `elk`, and `tala` for larger diagrams.
9. Set `width` explicitly in grids when animation or labels cause cell-size jitter.
10. Avoid relying on D2 for diagram families users repeatedly report as weaker: detailed swimlanes, precise port routing, highly controlled sequence alternatives, and overlapping group membership.

## LLM Usage Notes

When generating D2:

1. Prefer explicit keys with short stable IDs and labels as values.
2. Use containers for ownership/grouping and board composition for alternate views.
3. Use `scenarios` for before/after or variant animation.
4. Use `steps` for temporal animation.
5. Use `layers` for zoom or abstraction changes.
6. Use `--animate-interval` only for SVG/GIF board animation.
7. Use `style.animated: true` for visual motion on shapes/connections.
8. Use globs and classes to avoid repeating styles across animation boards.
9. Use `suspend`/`unsuspend` when one model needs multiple filtered views.
10. Use `link` for internal board navigation in PDF/SVG/PPTX style workflows.
11. Use ELK or TALA when dagre routing/containers are insufficient.
12. Use TALA for `near` object references, `top`/`left`, and per-container direction.
13. Use grid diagrams for tables, maps, matrices, and precise cell structures.
14. Avoid assuming ports are a first-class language feature; FAQ says they are not currently supported in the requested sense.
15. Treat ASCII output as beta/alpha.
16. Quote every shape and connection label by default when generating D2. Unquoted labels containing `[ ] ( ) ; # & : -- -> <- <->` desync the parser; the error appears later at the next `}`, which makes the root cause hard to find. See "Lexical Pitfalls In Unquoted Labels" above.

## High-Value Example: Animated Scenario

```d2
direction: right

app -> api -> db
app -> cache

scenarios: {
  cache_down: {
    cache.style.opacity: 0.25
    app -> api: retry path {
      style.animated: true
      style.stroke: orange
    }
  }
}
```

Render:

```shell
d2 diagram.d2 diagram.svg --animate-interval=1200
```

## High-Value Example: Step Build-Up

```d2
steps: {
  one: {
    user
  }
  two: {
    user -> frontend
  }
  three: {
    frontend -> api
  }
  four: {
    api -> db: query {
      style.animated: true
    }
  }
}
```

Render as GIF:

```shell
d2 flow.d2 flow.gif --animate-interval=1000
```

## High-Value Example: Layered Zoom

```d2
system: Banking System {
  link: layers.system_detail
}

layers: {
  system_detail: {
    mobile -> api -> ledger
    api -> notifications
  }
}
```

Useful PDF/PPTX export:

```shell
d2 architecture.d2 architecture.pdf
d2 architecture.d2 architecture.pptx
```

## High-Value Example: Grid With Animation Potential

```d2
steps: {
  one: {
    matrix: {
      grid-columns: 2
      a
      b
    }
  }
  two: {
    matrix: {
      c
      d
    }
  }
}
```

`steps.two` inherits `steps.one`, so the grid gains cells over time.

## Source Links

- Home: <https://d2lang.com/>
- Tour intro: <https://d2lang.com/tour/intro/>
- Shapes: <https://d2lang.com/tour/shapes/>
- Connections: <https://d2lang.com/tour/connections/>
- Containers: <https://d2lang.com/tour/containers/>
- Styles: <https://d2lang.com/tour/style/>
- Classes: <https://d2lang.com/tour/classes/>
- Globs: <https://d2lang.com/tour/globs/>
- Grid diagrams: <https://d2lang.com/tour/grid-diagrams/>
- Sequence diagrams: <https://d2lang.com/tour/sequence-diagrams/>
- Composition: <https://d2lang.com/tour/composition/>
- Layers: <https://d2lang.com/tour/layers/>
- Scenarios: <https://d2lang.com/tour/scenarios/>
- Steps: <https://d2lang.com/tour/steps/>
- Linking: <https://d2lang.com/tour/linking/>
- Composition exports: <https://d2lang.com/tour/composition-formats/>
- Exports: <https://d2lang.com/tour/exports/>
- Layouts: <https://d2lang.com/tour/layouts/>
- Positions: <https://d2lang.com/tour/positions/>
- Text: <https://d2lang.com/tour/text/>
- Imports: <https://d2lang.com/tour/imports/>
- Models: <https://d2lang.com/tour/models/>
- Legend: <https://d2lang.com/tour/legend/>
- API: <https://d2lang.com/tour/api/>
- CLI manual: <https://d2lang.com/tour/man/>
- Animation blog: <https://d2lang.com/blog/animation/>
- C4 blog: <https://d2lang.com/blog/c4/>
- ASCII blog: <https://d2lang.com/blog/ascii/>
- Releases: <https://github.com/terrastruct/d2/releases>
- Next changelog: <https://github.com/terrastruct/d2/blob/master/ci/release/changelogs/next.md>
- D2.js changelog: <https://github.com/terrastruct/d2/blob/master/d2js/js/CHANGELOG.md>
