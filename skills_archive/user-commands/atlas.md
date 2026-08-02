---
description: Draw/explain something as a standalone interactive atlas HTML (opens in browser)
argument-hint: <what to show> [as path/to/file.html]
---

Goal: turn **$ARGUMENTS** into ONE self-contained `.html` file that opens to a live,
interactive graph (cytoscape) with side panels — then open it in the browser. No build,
no server, no repo. The renderer loads from a CDN; you only author the config.

Do all of this without asking follow-ups unless the subject is truly ambiguous.

## 1. Author the atlas config

Write a d2 graph + `#` annotation lines describing $ARGUMENTS:

- **edges** (d2): `a -> b`, chains `a -> b -> c`; containers `net: L3 { ip; route }`
  render as compound boxes. Node ids are dotted (`net.route`) and are the join key.
- `# @ id : text` — note shown in the detail panel + node tooltip.
- `# src id = path:line` — fs address (streams into the `fs` tree panel).
- `# ref <panel> id = locator` — per-panel address. Panels:
  `fs`=`path:line` · `sql`=`table:pred` or `db.table.col` · `api`=`GET /v1/x/{id}` ·
  `url`=full URL · `code`=`pkg.mod.sym` · any other key → default `/`-split tree.
- `# tag id : hub,sink` — style (hub/sink/dead/ghost · fn/type/module/relation).
- `# diff add|del|mod id` — tint.
- `# view focus=<id> mode=cone|neighbors|downstream|upstream layout=dagre|elk|tree|rings|force|grid dir=TB|LR|BT|RL iso`
  — REQUIRED, exactly one. Pins the slice the page opens on. Focus the key node.

Rules: keep the graph to the nodes the explanation needs; give key nodes a `# @` note
and ≥1 `# src`/`# ref` so panels light up; pick panel kinds that fit the domain.

## 2. Write the HTML file

Pick a path: `as <path>` from $ARGUMENTS if given, else `./atlas-<slug>.html` in the cwd
(slug = kebab of the subject). Write EXACTLY this, replacing only the config block:

```html
<!doctype html>
<meta charset="utf8">
<title>atlas · SUBJECT</title>
<style>html,body{margin:0;height:100%} atlas-graph{display:block;height:100vh}</style>
<script src="https://cdn.jsdelivr.net/gh/hafley66/anim@main/dist/atlas.js"></script>
<atlas-graph>
<script type="application/atlas">
YOUR_CONFIG_HERE
</script>
</atlas-graph>
```

## 3. Open it + report

- Open it: `open "<path>"` (macOS). If not macOS, skip and just give the path.
- Print, on its own line: **`atlas → <absolute path>`** and one sentence on what it shows.
- Mention they can edit the `<script type="application/atlas">` block in the file and
  reload — no rebuild. The `@main` CDN may cache ~12h; that only affects the renderer
  code, never their config.

Reference (only if deeper detail needed): https://github.com/hafley66/anim →
`AGENTS.md` "Right panel — interactive atlas". The CDN file is built from `src/embed.jsx`.
