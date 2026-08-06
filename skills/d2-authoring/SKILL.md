---
name: d2-authoring
description: >
  Author D2 (d2lang) diagrams that compile clean and render right the first time, with real
  code snippets embedded inside shapes. Covers block-string fences for code/markdown, the
  diagram kinds D2 has natively, layout-engine choice (dagre/elk/tala), LLM authoring
  foot-guns, and a headless compile gate. Use whenever producing a .d2 file, converting a
  mermaid diagram, embedding code in a diagram, or deciding between d2 and mermaid.
triggers:
  - d2
  - d2lang
  - .d2
  - diagram
  - architecture diagram
  - sequence diagram
  - flowchart
  - mermaid
  - code in a diagram
  - render diagram
---

# d2-authoring

Receipts: every behavior marked **[verified]** was executed against `d2 0.7.1` and
`@terrastruct/d2@0.1.33` (research agent, 2026-08-04). Everything else carries a doc URL.

---

## 1. Code and markdown inside shapes

This is the reason to pick D2. A shape's label can be a fenced block string.

### Fences

| form | use | source |
| --- | --- | --- |
| `|md ... |` | markdown | https://d2lang.com/tour/text/#standalone-text-is-markdown |
| `|<lang> ... |` | syntax-highlighted code | https://d2lang.com/tour/text/#code |
| ``|`<lang> ... `|`` | code containing `|` | https://d2lang.com/tour/text/#advanced-block-strings |
| `|<sym><lang> ... <sym>|` | any non-alphanumeric `<sym>` as the fence | same |
| `|tex ... |` / `|latex ... |` | MathJax, no linebreaks, no `font-size` | https://d2lang.com/tour/text/#latex |

```d2
compile step: |`ts
  export function compile(src: string): Result<Diagram, Err[]> {
    const ast = parse(src);
    return ast.ok ? lower(ast.value) : ast;
  }
`| {
  style.fill: "#f6f8fa"
}

notes: |md
  ## contract
  - sync above the SqlRunner seam
  - one `insert_rows` per batch
|
notes.shape: rectangle

compile step -> notes: reads
```

### Language list

Chroma's full language set, plus D2 aliases `md`=markdown, `tex`=latex, `js`=javascript,
`go`=golang, `py`=python, `rb`=ruby, `ts`=typescript. Unknown language falls back to plain
text with no highlighting, silently.
Source: https://d2lang.com/tour/text/#code ,
https://github.com/alecthomas/chroma#supported-languages

### Escaping foot-guns **[verified]**

| snippet content | `|ts ... |` | ``|`ts ... `|`` | `|~ts ... ~|` |
| --- | --- | --- | --- |
| `type A = Fish \| Bird` | **fails**: `block string must be terminated with \|` | ok | ok |
| ``const s = `hi ${n}` `` | ok | ok | ok |
| ``const s = a `\| b`` | ok | **fails**: `unexpected text after ts block string` | ok |

Rule: default to the backtick fence ``|`lang ... `|`` for code. Only the two-character
sequence `` `| `` breaks it. If the snippet contains that sequence, switch to `|~lang ... ~|`.

### Sizing behavior **[verified]**

- Code blocks do **not** wrap. One 150-char line produced a 1821px-wide SVG; the same
  diagram with short lines was 865px.
- `width:` on a code shape is a floor, not a clamp. `width: 300` on an 805px-wide snippet
  still rendered 1005px total.
- **Hard-wrap snippets yourself at ~55 columns.** Elide bodies with `// ...`.

### Other label rules

- A markdown label implies `shape: text` (no border). Add `x.shape: rectangle` to get a box.
  **[verified]**: 3 rect elements without it, 4 with.
  Source: https://d2lang.com/tour/text/#markdown-label
- Since v0.7.0, markdown/latex/code work as labels on containers that also have children, and
  as edge labels. **[verified]** both.
  Source: https://github.com/d2lang/d2/blob/master/ci/release/changelogs/v0.7.0.md
- Markdown renders via XHTML `foreignObject`. Pure SVG editors (Illustrator) will not show it.
  HTML inside markdown must be well-formed (`<br/>`, never `<br>`).
  Source: https://d2lang.com/tour/troubleshoot/
- Markdown tables beat hand-built grids for tabular data.
  Source: https://d2lang.com/tour/grid-diagrams/

---

## 2. Diagram kinds D2 has, and the mermaid gap

### Native to D2

| kind | trigger | source |
| --- | --- | --- |
| graph / flowchart / architecture | default | https://d2lang.com/tour/hello-world/ |
| sequence diagram | `shape: sequence_diagram` | https://d2lang.com/tour/sequence-diagrams/ |
| UML class | `shape: class` | https://d2lang.com/tour/uml-classes/ |
| ERD | `shape: sql_table` + `constraint: primary_key|foreign_key|unique` | https://d2lang.com/tour/sql-tables/ |
| grid / matrix / table | `grid-rows` / `grid-columns` / `grid-gap` | https://d2lang.com/tour/grid-diagrams/ |
| nested containers | `name: { child }` | https://d2lang.com/tour/containers/ |
| multi-board, animation | `layers` / `scenarios` / `steps` + `--animate-interval` | https://d2lang.com/tour/composition/ |
| C4 | `shape: c4-person`, theme 303 | https://d2lang.com/tour/c4/ |
| legend | `vars.d2-legend` | https://d2lang.com/tour/legend/ |

Shape catalog: `rectangle square page parallelogram document cylinder queue package step
callout stored_data person c4-person diamond oval circle hexagon cloud text code class
sql_table image sequence_diagram`.
Source: https://github.com/d2lang/d2/blob/master/d2target/d2target.go

`shape: hierarchy` exists in the source and compiles **[verified]**, but appears in no
changelog or doc page. Do not use it.

### Sequence diagram specifics

```d2
shape: sequence_diagram
client
server           # predeclare actors to fix left-to-right order
client -> server: POST /compile
server."handler runs sync"        # note, no connection
server -> server: internal retry  # self-message
error path: {                     # group / fragment
  server -> client: 500
}
```

Two rules that differ from the rest of D2: children share one scope (repeat mentions are
the same actor), and declaration order is render order.
Source: https://d2lang.com/tour/sequence-diagrams/

### No D2 equivalent, keep mermaid

Mermaid's kind list: https://mermaid.js.org/intro/syntax-reference.html

| mermaid kind | D2 status |
| --- | --- |
| `gantt`, `timeline`, `journey` | none. Time axis is absent from D2. |
| `pie`, `xychart`, `sankey`, `radar`, `treemap`, `quadrantChart` | none. D2 has no data-chart primitives. |
| `gitGraph` | none. |
| `mindmap` | none stable. |
| `kanban`, `packet`, `requirementDiagram` | none. |
| `stateDiagram` | no native kind. Approximate with `shape: oval` + `shape: diamond` + edges. |
| `erDiagram` | use `shape: sql_table`. |
| `block`, `architecture`, `c4Diagram` | use containers / C4 theme. |
| `flowchart`, `sequenceDiagram`, `classDiagram` | full D2 equivalents, use D2. |

For real data visualization (bars, lines, distributions) neither tool applies. Use the
`dataviz` skill.

---

## 3. Layout engines

| engine | bundled in CLI | in `@terrastruct/d2` wasm | license |
| --- | --- | --- | --- |
| dagre | yes (default) | yes (default) | free, MPL-2.0 |
| elk | yes | yes | free, MPL-2.0 |
| tala | separate binary plugin | **no** | proprietary, paid |

**[verified]** `d2 layout` prints `dagre (bundled)` and `elk (bundled)` only.
**[verified]** wasm `compile(src, { layout: "tala" })` rejects with
`layout option 'tala' not recognized`.
TALA install: https://github.com/terrastruct/tala#installation

### Which to pick

| diagram | engine | why |
| --- | --- | --- |
| (a) flowchart / pipeline | `dagre` | fastest, good hierarchical results. https://d2lang.com/tour/dagre/ |
| (b) sequence diagram | `dagre` | D2 runs its own sequence layout; engine barely matters. |
| (c) dense container nests, ERDs, class diagrams | `elk` | orthogonal routes, native container-to-container routing, `width`/`height` honored on containers, `sql_table` edges point at the exact row. https://d2lang.com/tour/elk/ |

Hard constraint **[verified]**: an edge from a container to its own descendant is a **compile
error** under dagre and compiles fine under elk.

```
err: Connection "(box -> box.inner)[0]" goes from a container to a descendant,
     but layout engine "dagre" does not support this.
```

Elk is roughly 6-9x slower on small graphs **[verified]**: 30ms dagre vs 280ms elk. Still
inside the 10-second law.

---

## 4. LLM authoring foot-guns

Things that compile and render wrong.

### Silent semantic collisions

- **Keys are case-insensitive.** `Parser` and `parser` are one shape. **[verified]**:
  `Parser -> lexer` + `parser -> emitter` produced 3 shapes, 4 expected.
  Source: https://d2lang.com/tour/shapes/
- **Reserved keywords cannot be node names.** **[verified]** errors for `style`, `direction`,
  `vars`, `classes`, `layers`, `steps`. Quoting fixes it: `"style" -> parser` compiles.
  Full list: `label shape icon constraint tooltip link near width height direction top left
  grid-rows grid-columns grid-gap vertical-gap horizontal-gap class vars style classes
  source-arrowhead target-arrowhead layers scenarios steps` plus all `style.*` keys.
  Source: https://github.com/d2lang/d2/blob/master/d2ast/keywords.go
- **`direction:` inside a container is silently ignored** on dagre and elk. **[verified]**
  compiles with no warning. Per-container direction is TALA-only.
  Source: https://d2lang.com/tour/layouts/#directions-per-container-tala-only
- **Non-ASCII punctuation.** Full-width `：` will not register as a label separator.
  Source: https://d2lang.com/tour/troubleshoot/
- **`d2 validate` misses semantic errors.** See section 5.

### Layout blowups

| foot-gun | evidence **[verified]** | fix |
| --- | --- | --- |
| long edge labels | 2234px wide (dagre) vs 865px with short labels, same graph | keep edge labels under ~20 chars, or `\n`-wrap |
| unwrapped code lines | 1821px wide from one 150-char line | hard-wrap at ~55 cols |
| long node labels | same mechanism | `key: short { label: "the long text" }` or `\n` |
| cluttered edges on small shapes | docs | set explicit `width`/`height` for routing surface. https://d2lang.com/tour/troubleshoot/#connections-look-cluttered |
| deep nesting on dagre | container-to-descendant is a hard error | switch to elk |

### Contrast traps: the diagram compiles and cannot be read

Every one of these exited 0 on the compile gate. They were caught only by
rendering a PNG and looking at it.

| trap | evidence **[verified]** 2026-08-06, d2 0.7.1 | fix |
| --- | --- | --- |
| `style.stroke` on a `sql_table` paints the ROW BACKGROUND, beyond the border | a class setting `stroke: "#5f6368"` rendered every row dark grey under the theme's blue column names, unreadable; `stroke: "#b06000"` rendered every row orange with orange type text | never style a `sql_table`. Wrap it in a container and put `fill`/`stroke` on the container |
| `style.fill` on a `sql_table` does the same to rows | same render | same |
| chroma renders code COMMENTS light grey on a light code fill | `-- one table, both shapes of target` inside a `sql` block was near-invisible on `#f6f8fa` | put no meaning in a comment inside a code block. Move it to the shape's key label or an `md` label, which render at `style.font-color` |
| a light `class` fill without `style.font-color` inherits the theme's text colour | container titles went pale on `#fafafa` | every class that sets `fill` also sets `font-color` |

### Aspect ratio is set by direction plus engine, ahead of content

**[verified]** 2026-08-06: one 40-shape diagram, only the two header lines changed.

| `direction` | engine | size | ratio |
| --- | --- | --- | --- |
| `right` | elk | 14642 x 2074 | **7.06**, an unreadable ribbon |
| `down` | elk | 4996 x 8500 | 0.59 |
| `down` | dagre | 6950 x 6034 | **1.15** |
| `down` | dagre, nested sub-containers flattened | 6574 x 5734 | 1.15, tighter |

Rules that fall out of it:

- A chain longer than about 5 ranks wants `direction: down`. Keep
  `direction: right` for 2 to 4 stages, where width stays bounded.
- `dagre` packs ranks squarer than `elk` on the same graph. Reach for `elk` when
  you need orthogonal routing or container-to-descendant edges, and pay the aspect
  cost knowingly.
- One level of containers is free. A second level of nesting creates empty
  gutters, because the engine sizes the outer box to the diagonal span of the
  inner ones. Flatten and name the shapes instead: `r: "opus A: __catalog_rel"`
  beats `two: { r: ... }`.
- Grid layouts (`grid-rows` / `grid-columns`) pack PEER shapes tightly, and
  connections are not rendered inside a grid container. Use a grid for legends and
  matrices, and a normal container for anything with edges.

### Tiering: rank the graph before writing it

Write the diagram as numbered stages, one container per stage. A reader follows
containers and the engine ranks them, so visual order and logical order agree for
free. Number the container labels (`1. compiler`, `2. the forks`) so nobody has to
infer direction from arrow geometry.

Cross-stage edges run from stage N to stage N+1. An edge that skips two stages is
a signal the stages are wrong, and it is also what draws the long swooping
connectors that eat width.

### Known-good conventions

```d2
vars: {
  d2-config: {
    layout-engine: elk    # pin in-file so any renderer agrees
    theme-id: 0
    pad: 20
  }
}
direction: right          # pipelines read left-to-right

classes: {                # style once, apply many
  hot: { style.fill: "#FE7070" }
}

ingest:    Ingest stage            # key short, label separate
normalize: Normalize\nand dedupe   # \n instead of a long line
store:     Store { class: hot }

ingest -> normalize: batch         # edge labels short
normalize -> store: insert_rows
```

- Keys: short, lowercase, `snake_case` or single words. Labels carry the prose.
- `direction: right` for pipelines and flows, `direction: down` for hierarchies and trees.
- One `classes:` block for repeated styling over per-shape `style:` maps.
- Wrap anything with reserved characters in `'` or `"`.
- `vars.d2-config` makes the file self-describing; flags and env vars still win over it.
  Source: https://d2lang.com/tour/vars/#configuration-variables
- No official style guide for generated diagrams exists as of 2026-08. The above derives
  from https://d2lang.com/tour/troubleshoot/ plus measured renders.

---

## 5. Validation gate

Treat a `.d2` file the way `tsc` treats a `.ts` file: never ship one you did not compile.

### Trap: `d2 validate` is parse-only **[verified]**

`d2cli/validate.go` calls `d2lib.Parse`, which runs the parser and stops. Semantic errors
survive it.

| input | `d2 validate` | full compile |
| --- | --- | --- |
| `a -> ` | exit 1 | exit 1 |
| `a: { shape: circl }` | **exit 0, "Success!"** | exit 1, `unknown shape "circl"` |
| `a.near: nonexistent` | **exit 0, "Success!"** | exit 1, `near key ... must be ...` |

Source: https://github.com/d2lang/d2/blob/master/d2cli/validate.go

### CLI gate (use this)

```bash
# exit 0 = compiles and lays out; exit 1 = error on stderr with file:line:col
d2 --layout=elk diagram.d2 - > /dev/null
```

Optional format ratchet, exit 1 when any file is unformatted:

```bash
d2 fmt --check diagram.d2
```

Exit codes come from `xmain.mainFatal`: any error is 1 unless an `ExitError` sets otherwise.
Source: https://github.com/terrastruct/util-go/blob/master/xmain/xmain.go

### Read the diagram back before shipping

ASCII render lets the agent inspect its own layout **[verified]**:

```bash
d2 diagram.d2 --stdout-format ascii -
```
```
 ┌─────────┐         ┌────────────┐         ┌──────┐
 │ ingest  │──batch─▶│ normalize  │──write─▶│store │
 └─────────┘         └────────────┘         └──────┘
```

Caveat **[verified]**: ASCII mode renders code and markdown labels as empty boxes. Use it to
check geometry, never content.

### Headless gate in Node

Package: **`@terrastruct/d2`** (npm, MPL-2.0).

```bash
npm i @terrastruct/d2
```

```js
// check-d2.mjs <file.d2>   -> exit 0 clean, exit 1 with parsed errors
import { D2 } from "@terrastruct/d2";
import { readFileSync } from "node:fs";

const d2 = new D2();
try {
  const { diagram, renderOptions } = await d2.compile(
    readFileSync(process.argv[2], "utf8"),
    { layout: "elk" }
  );
  const svg = await d2.render(diagram, renderOptions);
  console.log(`OK ${svg.length}B, ${diagram.shapes.length} shapes`);
  process.exit(0);            // REQUIRED: the worker keeps the loop alive
} catch (err) {
  // err.message is a JSON string: [{ range, errmsg }]
  let errs;
  try { errs = JSON.parse(err.message); } catch { errs = [{ errmsg: err.message }]; }
  for (const e of errs) console.error(e.errmsg);
  process.exit(1);
}
```

**[verified]** error shape:

```
[{"range":"index,0:12:12-0:17:17","errmsg":"index:1:13: unknown shape \"circl\""}]
```

`range` is `board,startLine:startCol:startByte-endLine:endCol:endByte`, zero-indexed.
The `errmsg` prefix is one-indexed `line:col`.

**[verified]** foot-gun: without `process.exit`, node hangs forever (timeout at 12s). The
`D2` class spawns a `node:worker_threads` worker and exposes no `close()`.
Source: https://github.com/d2lang/d2/blob/master/d2js/js/src/index.js

**[verified]** the wasm build honors in-file `vars.d2-config` (a file with `pad: 20` returned
`renderOptions.pad === 20`).

Multi-file with imports:

```js
await d2.compile({
  fs: { "main.d2": "a: @shared", "shared.d2": "x: {shape: circle}" },
  inputPath: "main.d2",
  options: { layout: "elk" },
});
```
Source: https://github.com/d2lang/d2/blob/master/d2js/js/README.md

---

## 6. Versions

| artifact | version | date | source |
| --- | --- | --- | --- |
| d2 CLI, latest stable | **v0.7.1** | 2025-08-19 | https://github.com/d2lang/d2/releases |
| `@terrastruct/d2` npm, latest | **0.1.33** | 2025-08-17 | https://registry.npmjs.org/@terrastruct/d2 |
| d2 core embedded in that wasm | `v0.7.0-HEAD` **[verified]** via `await d2.version()` | | |

- **The wasm package does NOT track the CLI release.** Independent version line
  (0.1.x vs 0.7.x), independent changelog at
  https://github.com/d2lang/d2/blob/master/d2js/js/CHANGELOG.md , and the shipped core
  reports `v0.7.0-HEAD` while the CLI is `v0.7.1`.
- Nightly wasm builds: `npm i @terrastruct/d2@nightly`.
- The repo moved from `terrastruct/d2` to **`d2lang/d2`** (2026-08-03). The npm scope
  stays `@terrastruct`.
- Master has an unreleased changelog (gif export via `animate: true`, d2ascii improvements
  for `sql_table` and `class`): https://github.com/d2lang/d2/blob/master/ci/release/changelogs/next.md

Pin both:
```json
{ "devDependencies": { "@terrastruct/d2": "0.1.33" } }
```

---

## House style (this project)

| decision | value |
| --- | --- |
| layout engine | `dagre` by default, because it packs squarer. `elk` when you need orthogonal routing or a container-to-descendant edge. Never tala (paid, absent from wasm). |
| direction | `direction: down` for anything over 4 stages, and for trees. `direction: right` for a bounded 2 to 4 stage pipeline. Never rely on per-container `direction`. |
| aspect target | between 0.7 and 1.5. Measure it, never eyeball it: `sips -g pixelWidth -g pixelHeight out.png`. Over 3.0 means the direction is wrong. |
| tiering | one numbered container per stage, edges from stage N to stage N+1. An edge skipping two stages means the stages are wrong. |
| sql_table | never carries `style.fill` or `style.stroke`; stroke paints the ROWS. Put the accent on a wrapper container. |
| every class that sets `fill` | also sets `style.font-color`. |
| theme | `theme-id: 0` (Neutral Default). `300` (Terminal) for anything mostly code. `303` (C4) for C4 diagrams. |
| config | always pin `vars.d2-config` in the file. Never depend on CLI flags for appearance. |
| code fence | ``|`lang ... `|`` by default. `|~lang ... ~|` when the snippet contains `` `| ``. |
| snippet width | hard-wrap at 55 columns, elide bodies with `// ...`. |
| keys vs labels | keys short and lowercase; prose goes in `label:`. |
| edge labels | under 20 chars, or `\n`-wrapped. |
| gate | `d2 --layout=<engine> file.d2 - > /dev/null` must exit 0 before the file is shown to anyone. `d2 validate` alone is insufficient. |
| self-check | render a PNG, downscale it, and LOOK at it before shipping. Every unreadable version described in section 4 exited 0 on the compile gate. `--stdout-format ascii` checks geometry and renders code and markdown labels as empty boxes, so it can never catch a contrast fault. |
| reach for mermaid instead | gantt, timeline, journey, gitGraph, mindmap, kanban, packet, requirement, quadrant, pie, xychart, sankey, radar, treemap. |
| reach for the `dataviz` skill instead | any actual data visualization. |
| never | `shape: hierarchy` (undocumented); TALA-only keywords (`top`, `left`, `near: <object>`, per-container `direction`); node names colliding with reserved keywords. |

### Starter template

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 0
    pad: 20
  }
}
direction: right

classes: {
  code: { style.fill: "#f6f8fa"; style.stroke: "#d0d7de" }
}

parse: |`ts
  const ast = parse(src);
  if (!ast.ok) return ast;
`| { class: code }

lower: Lower to IR
emit:  Emit SQL

parse -> lower: ast
lower -> emit: ir
```

Gate it:
```bash
d2 --layout=elk starter.d2 - > /dev/null && echo "shippable"
```
