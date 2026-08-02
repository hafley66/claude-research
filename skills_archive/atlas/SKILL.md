---
name: atlas
description: Author an annotated graph atlas + guided tours for a concept domain (networking, a codebase, a protocol). You write ONE data file (d2 + `#` annotations + tours); a generator stamps a standalone, graph-only HTML you open from file://.
---

# atlas

Author a directed graph with cone-focus, isolation, hop-distance labels, SCC/cycle
detection, topo tiers (tier 0 = no deps), click-to-detail, dotted leaders to a sidebar, and
a regroupable node tree-map. You write one data file; a generator inlines the renderer
around it into a single self-contained `.html`.

Renderer: `~/projects/anim` (React/TS). Build the bundle once, then stamp per-graph files.

## Authoring loop

1. Build the renderer bundle once: `cd ~/projects/anim && npm run build:embed` → `dist/atlas.js`.
2. Write one source file under `~/projects/anim/atlases/`:
   - `<topic>.d2` — d2 graph + `#` annotation comments. No tours.
   - or `<topic>.atlas.js` — an ES module with tours:
     ```js
     export default {
       d2: `<d2 graph + # annotation comments>`,
       tours: { "<tour name>": [ <step>, ... ] },
     }
     ```
3. Generate the standalone file:
   ```
   npm run atlas:file atlases/<topic>.atlas.js        # -> atlases/<topic>.html
   node bin/atlas-file.mjs atlases/<topic>.d2 -o out.html [--title T] [--link]
   ```
4. Open `atlases/<topic>.html` directly (`file://`, no server). Walk the tours, drag nodes,
   switch the sidebar `group by`.
5. Where the graph surprises you (unexpected cycle, wrong tier) = a gap. Fix the d2; regenerate.

The `.html` inlines the whole renderer (~10MB) so it opens anywhere. `--link` instead writes
`<script src="atlas.js">` and drops `atlas.js` beside the html (smaller, needs the sibling file).
Keep the `.d2`/`.atlas.js` source checked in; the generated `.html` is a build artifact.

## The graph: D2

The `d2` field is real [D2](https://d2lang.com), compiled by `@terrastruct/d2` (WASM).
Structural subset:

```
container: Label {        # container = a compound box + sidebar folder; children are nodes
  child
  other
}
container.child -> other.thing      # edge a -> b means "a depends on / rides on b"
container.child -> container.child  # cycles are fine — SCCs are detected & colored
```

Node id = the fully-qualified dotted key (`network.route`). Edge direction = dependency.
Real recursion surfaces as an SCC the learner can toggle.

Reserved keywords: the real d2 compiler rejects its keywords as id parts — `link`, `class`,
`style`, `label`, `shape`, `icon`, `near`, `tooltip`, `width`, `height`, `direction`,
`constraint`, `grid-rows`, `source`, `target`. Don't name a node/container `link`; use
`datalink`/`l2` etc. A compile error returns `reserved keywords ...` or `"x" must be the last
part of the key`.

## Annotations: `#` comments in the same d2 (compiler ignores them, atlas scans them)

```
# @ <id> : note text            node annotation (✱ in sidebar, tooltip, detail panel)
# @ <a> -> <b> : note text      edge annotation
# tag <id> : tag1, tag2         facets — power the sidebar "group by: tag"
# diff add|del|mod <id>         colors a node (or `a -> b` edge) green/red/amber
# src <id> = path:line          file ref → fs panel; powers "group by: source folder"
# src <a> -> <b> = path:line    edge file ref
# view focus=<id> mode=cone layout=dagre dir=LR   opening camera
```

Keys are dotted node ids or `a -> b` pairs. Annotate densely — this is the point.

## Sidebar group-by

The left rail regroups the graph nodes live: `container` (dotted nesting), `source folder`
(`# src` dirname), `tag` (`# tag`), `kind` (api / leaf / cycle / node). Clicking a row cones
that node.

## Tours: the teaching layer

Ordered steps. Each lights one node's cone (`focus`) or walks a chain (`path`). `isolate:
true` hides everything else for that step; `note` is the narration.

```js
tours: {
  "packet down the stack": [
    { focus: "app.http", isolate: false, note: "Start at L7." },
    { path: ["app.http", "session.tls", "transport.tcp"], isolate: true, note: "Down the stack." },
  ],
}
```

Author MANY short tours (one concept each) over one long one. Tours need the `.atlas.js`
form (a `.d2` carries graph + annotations only).

## Datalog source

A datalog model (`head :- body` rules, `%` annotations, `functor/arity` ids) converts to an
atlas module:

```
node bin/datalog-to-atlas.mjs model.dl --tours tours.json -o atlases/<topic>.atlas.js
```

Rules become edges, `% folder:` becomes containers, `%` annotations become `#`, and
`functor/arity` ids are rewritten to dotted d2 ids (also in tours). Then generate as above.

## Files

- Renderer + scripts: `~/projects/anim` (`bin/atlas-file.mjs`, `bin/datalog-to-atlas.mjs`).
- Sources + generated graphs: `~/projects/anim/atlases/`.
- Reference content: `~/projects/anim/atlases/networking.atlas.js`.
- Superseded: `~/projects/horn-cyto-explorer` (deprecated; see its DEPRECATED.md).
