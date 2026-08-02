---
name: d2-diagramming
description: D2 (Terrastruct declarative diagram language) reference -- text-to-diagram syntax for architecture, ER, sequence, and class diagrams compiled to SVG/PNG/PDF. Shapes, connections, containers, style.* keywords, classes/vars, sql_table/class shapes, markdown/code/latex blocks, layout engines (dagre/elk/tala), CLI. Load when authoring or generating .d2 diagrams or diagram-as-code.
license: MIT
metadata:
  audience: developers
  source: https://d2lang.com
  upstream: https://github.com/terrastruct/d2
---

# D2 Declarative Diagramming

D2 turns text into diagrams. Write `.d2`, compile to SVG/PNG/PDF. Default layout `dagre`, default shape `rectangle`. Keys are case-insensitive. Compile: `d2 in.d2 out.svg`.

## Core Syntax

```d2
# a comment
imageserver        # bare id => a rectangle labeled "imageserver"
a: API Server      # id `a`, label "API Server"  (id != label)
"with spaces"      # quote ids/labels containing reserved chars
```

### Connections

| Op   | Meaning                |
|------|------------------------|
| `->` | directed arrow         |
| `<-` | reverse arrow          |
| `<->`| bidirectional          |
| `--` | undirected line        |

```d2
a -> b: request                 # connection with a label
a -> b -> c                     # chained
x -> y: hi {                    # connection with nested attrs
  style.stroke: red
  style.stroke-dash: 3
}
(a -> b)[0].style.stroke: blue  # target the 0th a->b edge after the fact
```

A connection auto-creates referenced ids if they do not exist. Repeating `a -> b` makes a *second* edge; index with `[n]`.

### Containers / Nesting

```d2
network: {                 # block form
  ui
  api
  ui -> api
}
network.cache              # dot shorthand: creates network, then cache inside it
aws.region.vpc.ec2         # arbitrarily deep
```

Edges crossing containers must use the **full path** from a common scope:

```d2
job -> network.api: poll        # OK
job -> api                      # WRONG: makes a new top-level `api`
```

`_` refers to the parent scope from inside a container:

```d2
server: {
  process
  _.client -> process       # `client` lives one level up
}
```

An edge whose endpoint is a container attaches to the container box itself; an edge to `c.child` attaches to the child (and may render as crossing the container border).

### Container label, shape, direction

```d2
gcp: Google Cloud {        # shorthand label
  label: Google Cloud      # explicit-keyword form (equivalent)
  shape: cloud
}
direction: right           # diagram or per-container: up|down|right|left (default down)
```

## Shapes

`shape: <value>` (default `rectangle`). Catalogue:

| Shape          | Use for                         |
|----------------|---------------------------------|
| `rectangle`    | default node                    |
| `square`       | square node                     |
| `page`         | document/page                   |
| `parallelogram`| input/output                    |
| `document`     | a single document               |
| `cylinder`     | database / datastore            |
| `queue`        | message queue / bus             |
| `package`      | package / module                |
| `step`         | process step                    |
| `callout`      | annotation pointer              |
| `stored_data`  | persisted store                 |
| `person`       | actor / user                    |
| `c4-person`    | C4-style person                 |
| `diamond`      | decision                        |
| `oval`         | terminator                      |
| `circle`       | node / state                    |
| `hexagon`      | preparation / adapter           |
| `cloud`        | external system / internet      |
| `text`         | plain text, no Markdown         |
| `code`         | code block (see Text)           |
| `class`        | OOP class (fields/methods)      |
| `sql_table`    | DB table (rows + constraints)   |
| `image`        | external image (needs `icon`)   |
| `sequence_diagram` | sequence-diagram container  |

```d2
db: { shape: cylinder }
logo: { shape: image; icon: https://icons.terrastruct.com/aws/_Group%20Icons/AWS-Cloud_light-bg.svg }
```

`icon: <url|path>` adds an icon to any shape. `width:`/`height:` set pixel size.

### sql_table

```d2
users: {
  shape: sql_table
  id: int {constraint: primary_key}
  org_id: int {constraint: foreign_key}
  email: varchar {constraint: unique}
  created: timestamp with time zone
}
orgs: {
  shape: sql_table
  id: int {constraint: primary_key}
}
# FK edge pointing at an exact row:
users.org_id -> orgs.id
```

Constraints: `primary_key`→PK, `foreign_key`→FK, `unique`→UNQ. Multiple: `constraint: [primary_key; unique]`. For `sql_table`/`class`, `fill` styles the header, `stroke` styles the body, `font-color` styles header text.

### class shape

```d2
Animal: {
  shape: class
  +name: string          # + public, - private, # protected
  -id: int
  +speak(): void
  -internal(n int): bool
}
Dog -> Animal: extends
```

## Styling

Inline: `id.style.<key>: <value>`. Block: `id: { style: { <key>: <value> } }`.

| Key             | Value                                            | Notes                       |
|-----------------|--------------------------------------------------|-----------------------------|
| `opacity`       | 0.0–1.0                                           |                             |
| `fill`          | CSS color / hex / gradient                        | shapes; header for table/class |
| `fill-pattern`  | dots, lines, grain, none                          | shapes                      |
| `stroke`        | CSS color / hex / gradient                        |                             |
| `stroke-width`  | 1–15                                              |                             |
| `stroke-dash`   | 0–10                                              | dashed when >0              |
| `border-radius` | 0–20                                              | also on connections         |
| `shadow`        | true/false                                        | shapes                      |
| `3d`            | true/false                                        | rectangle/square only       |
| `multiple`      | true/false                                        | stacked-copies look         |
| `double-border` | true/false                                        | rectangles & ovals          |
| `font`          | mono                                              |                             |
| `font-size`     | 8–100                                             |                             |
| `font-color`    | CSS color / hex / gradient                        |                             |
| `bold` `italic` `underline` | true/false                            |                             |
| `text-transform`| uppercase, lowercase, title, none                 |                             |
| `animated`      | true/false                                        | connections (flow) & shapes |
| `filled`        | true/false                                        | arrowheads                  |

Root-level (whole-diagram background/frame): `fill`, `fill-pattern`, `stroke`, `stroke-width`, `stroke-dash`, `double-border`.

```d2
style.fill: "#fafafa"          # diagram background
a.style: { fill: "#cce5ff"; stroke: "#3366cc"; shadow: true; border-radius: 8 }
a -> b: { style: { stroke-dash: 4; animated: true } }
```

### near

Pin a shape to a fixed position or to another shape:

```d2
title: My System { near: top-center; shape: text; style.font-size: 28 }
legend: { near: bottom-left }
note: { near: api }            # near another shape's id
```

Constants: `top-left top-center top-right center-left center-right bottom-left bottom-center bottom-right`.

## Classes (reusable styles)

```d2
classes: {
  load balancer: {
    label: ""
    shape: hexagon
    style: { fill: "#e6f0ff"; stroke: "#3366cc"; multiple: true }
  }
  error: {
    style: { stroke: red; stroke-dash: 3 }
  }
}

lb1.class: load balancer
api.class: [load balancer; error]      # multiple, applied left-to-right
a -> b: { class: error }               # classes work on connections too
```

Object attributes override class attributes. Later classes in the array win.

## Vars (variables & config)

```d2
vars: {
  primary: "#4a86e8"
  d2-config: {                 # replaces CLI flags (CLI still overrides)
    layout-engine: elk
    theme-id: 300
    sketch: true
    pad: 20
  }
}
box: { style.fill: ${primary} }
label: "literal ${not-substituted} stays literal in single quotes"   # use '...' to escape
spread: { ...${some-map-var} }     # spread a map var's keys in
```

`${name}` substitutes; nested via `${a.b}`. Single-quoted strings do not substitute.

## Text, Markdown, Code, LaTeX

Standalone text is Markdown by default. Use block strings (pipes) to embed multi-line content without quote-escaping:

```d2
explanation: |md
  # Heading
  - bullet with **bold**
  - `code span`
|

snippet: |go
  func main() {
    fmt.Println("hi")
  }
|

formula: |latex
  \sum_{i=0}^{n} i^2
|

plain: { shape: text; label: "no markdown here" }
```

Code-block language id can be any supported language (aliases: `py js ts go`). LaTeX uses MathJax; ignores `font-size` (use `\tiny \small \large \huge`). If the body itself contains `|`, switch the delimiter: open/close with `|` plus a non-reserved char pair, e.g. `|`...`|`, `||`...`||`, or `|`+symbol like ` |·`...`·| `. Multiple pipes (`||`, `|||`) raise the escaping level.

## Sequence Diagrams

```d2
shape: sequence_diagram        # set on the container (or root)

alice -> bob: authenticate
bob -> bob: validate token     # self-message
bob -> db.query: lookup        # span: nested object = activation bar
db.query -> bob: row
bob -> alice: ok               # return

# notes: a nested object with NO connections to it
alice.note: "user is anonymous until this point"

# groups: container labeling a subset of interactions
loop: {
  alice -> bob: retry
  bob -> alice: 503
}
```

Actors render in declaration order; message order = vertical order. Declare actors at top level before using them inside groups. Lifeline inherits the actor's `stroke`/`stroke-dash`.

## Grids

```d2
grid-rows: 3                   # OR grid-columns: N (or both)
grid-gap: 40
a; b; c; d; e; f               # children flow into the grid
```

## Layout, Themes, Interactivity

- Layout engines: `dagre` (default, bundled), `elk` (bundled, better for big/nested + exact sql FK rows), `tala` (Terrastruct, install separately; best for software architecture). Select: `--layout elk` or `vars.d2-config.layout-engine`.
- Themes: numeric ids (e.g. 0 default, 200 dark mauve, 300/301 terminal, etc.). `--theme 200` or `vars.d2-config.theme-id`. Dark theme: `--dark-theme`.
- `tooltip: text` and `link: https://...` add hover tooltip / clickable nav (link can target another board). `icon:` for shape icons.
- `animated: true` on a connection animates flow; multi-board `.d2` (layers/scenarios/steps) exports to animated SVG/GIF.

## CLI

```sh
d2 in.d2 out.svg                  # compile (format inferred from extension)
d2 in.d2 out.png                  # PNG
d2 in.d2 out.pdf                  # PDF (multi-board => multi-page)
d2 --watch in.d2 out.svg          # live server + browser auto-reload
d2 --theme 200 in.d2 out.svg      # theme by id
d2 --layout elk in.d2 out.svg     # pick layout engine
d2 --sketch in.d2 out.svg         # hand-drawn look
d2 --dark-theme 200 in.d2         # theme used in dark mode
d2 fmt in.d2                      # autoformat in place
d2 --animate-interval 1500 in.d2 out.gif   # multi-board animation
```

Install: `curl -fsSL https://d2lang.com/install.sh | sh -s --` or `go install oss.terrastruct.com/d2@latest`.

## Recipes

### Styled architecture diagram

```d2
direction: right
style.fill: "#f7f8fa"
classes: {
  svc: { shape: rectangle; style: { fill: "#e8f0fe"; stroke: "#1a73e8"; border-radius: 8 } }
  ext: { shape: cloud; style: { fill: "#fff4e5"; stroke: "#e8710a" } }
}

user: { shape: person }
internet: { class: ext }

cluster: Kubernetes {
  gateway: API Gateway { class: svc }
  auth: Auth Service   { class: svc }
  api:  Core API       { class: svc }
  cache: { shape: cylinder; style.fill: "#e6ffed" }
}
db: PostgreSQL { shape: cylinder }

user -> internet -> cluster.gateway: HTTPS
cluster.gateway -> cluster.auth: verify
cluster.gateway -> cluster.api: route
cluster.api -> cluster.cache: read-through { style.stroke-dash: 3 }
cluster.api -> db: SQL
```

### SQL ER diagram

```d2
vars: { d2-config: { layout-engine: elk } }

users: {
  shape: sql_table
  id: bigint {constraint: primary_key}
  email: varchar {constraint: unique}
  created_at: timestamptz
}
orders: {
  shape: sql_table
  id: bigint {constraint: primary_key}
  user_id: bigint {constraint: foreign_key}
  total_cents: int
}
order_items: {
  shape: sql_table
  id: bigint {constraint: primary_key}
  order_id: bigint {constraint: foreign_key}
  sku: varchar
}

orders.user_id -> users.id
order_items.order_id -> orders.id
```

### Sequence diagram

```d2
shape: sequence_diagram

client -> gateway: POST /login
gateway -> auth: validate(creds)
auth -> auth: hash + compare
auth -> db.q: SELECT user
db.q -> auth: row
auth -> gateway: token
gateway -> client: 200 + JWT

auth.note: "rate-limited per IP"

retry: { 
  client -> gateway: refresh
  gateway -> client: 401
}
```

### Class diagram

```d2
direction: down

Shape: {
  shape: class
  \#x: float
  \#y: float
  +area(): float
  +move(dx float, dy float): void
}
Circle: {
  shape: class
  -radius: float
  +area(): float
}
Rectangle: {
  shape: class
  -w: float
  -h: float
  +area(): float
}

Circle -> Shape: extends { style.stroke-dash: 0 }
Rectangle -> Shape: extends
```

## Gotchas

- **id != label.** `a: API` declares id `a`; later refs must use `a`, not `API`. Edges between containers need the full id path (`x -> outer.inner`, never `x -> inner`).
- **Auto-creation.** Any unknown id in a connection is silently created. A typo'd path makes a stray node instead of erroring.
- **Repeated edges stack.** `a -> b` twice = two edges. Restyle a specific one with `(a -> b)[0]`.
- **Reserved keywords** (`shape style label icon near width height direction class link tooltip constraint source-arrowhead target-arrowhead grid-rows grid-columns vars classes layers scenarios steps` etc.) cannot be bare ids. Quote them: `"style": ...` to use as a literal node.
- **Quoting.** Wrap ids/labels with spaces or special chars in `"..."`. Single quotes `'...'` are literal (no `${}` substitution); double quotes substitute.
- **`#` starts a comment** at line level; in `class` member names escape it (`\#field`) or it is read as a comment.
- **Markdown needs a shape.** A bare label is plain; multi-line/Markdown requires a block string `|md ... |` or `shape: text`/`shape: code`.
- **Container edge semantics.** Edge to `parent` attaches to the box; edge to `parent.child` attaches to the child. ELK/TALA route sql_table FK edges to the exact row; dagre attaches to the table box.
- **Layout differences are real.** Switching `dagre`↔`elk`↔`tala` reflows everything; pin critical nodes with `near` if placement matters.
- **`_` is parent, not root.** Chain `_._` to climb multiple levels; there is no absolute-root token.
- **CLI vs vars precedence.** `vars.d2-config` sets defaults; explicit CLI flags override them.

## Primary Sources

- https://d2lang.com (tour: intro, containers, style, classes, vars, shapes, sql-tables, sequence-diagrams, text)
- https://github.com/terrastruct/d2 (README)
