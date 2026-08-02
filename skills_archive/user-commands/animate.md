---
description: Author or extend an animated explainer (markdown frames) for a topic; scaffolds the app on first use
argument-hint: <topic> [--replace]
---

Author or extend an animated explainer for: **$ARGUMENTS**

The explainer is a small Vite app that renders `src/frames.md`: one `## ` heading
per frame, prose = narration, a fenced code block = the code panel (token-tweened
between frames), a fenced `d2 <name>` block = the graph (reuse later with
`graph: <name>`). You author markdown; a build step compiles it and live-reloads.

## Step 1 — find or scaffold the app

Locate the animator app for THIS project:

1. Look for an existing app: a directory containing `src/frames.md` (check `./anim`,
   then `./v5/anim`, then `git ls-files | grep frames.md`). If found, use it.
2. If none exists, scaffold one:
   ```
   cp -R ~/projects/claude-research/frame-anim ./anim
   cd ./anim && npm install
   ```
   (The template needs the `d2` binary on PATH for graphs; frames still render
   without it.)

Call the chosen app directory APP below.

## Step 2 — author APP/src/frames.md

Write or extend `APP/src/frames.md` to explain the topic.

- **One idea per frame.** shiki-magic-move tweens the token delta, so keep
  neighbouring code blocks minimally different and let most text stay identical.
- **Code and graph are both optional.** A frame can be pure prose (a durable
  discussion note), prose + code, prose + graph, or all three. No git/commits
  needed: this file IS the artifact.
- The prose under the heading is the narration and is rendered as **markdown** —
  use lists, **bold**, links, `inline code`, blockquotes, tables freely. Good for
  capturing a session's thinking, not just code steps.
- The code block is the **full snapshot** at that step, not a diff.
- Use ```` ```lang ```` for the code panel (`prolog`, `rust`, `js`, `ts`, `sql`, ...).
- **Pull real code instead of pasting**: a `code: ../src/foo.rs#L10-24 [as lang]`
  line reads the span from the actual file at build time (dedented, lang from the
  extension). Cheaper and never drifts. Prefer this for real source.
- **Bind code to the graph**: `anchor: <code-token> -> <node>[, node]` makes a chip
  that, on hover, lights the matching graph node(s) and the code token together.
  Use single identifiers as tokens (e.g. `anchor: reaches -> reaches`).
- Graphs: define ```` ```d2 <name> ```` the first time, then `graph: <name>` to
  reuse. **Keep node ids stable across graphs** so a node holds its position frame
  to frame (that is what makes a change read as motion, not a jump).
- **Cycles colour themselves.** The build runs Tarjan on every graph and tints any
  node in a loop (one colour per cycle). Never hand-style a loop; just write the
  edges. Opt out with `# noautocolor` inside the d2 block.
- **Use the kit vocabulary, not style blocks** (`src/kit.d2`, prepended to every
  graph). Tag a node with `.class`:

  | word | meaning | look |
  |---|---|---|
  | `fn` | a function / value node | light box |
  | `relation` | a relation / table | blue cylinder |
  | `type` | a type | green hexagon |
  | `module` | a file / module | purple page |
  | `sink` | terminal, calls nothing | yellow |
  | `dead` | defined, never used | grey, dim |
  | `hub` | important node | thick stroke |
  | `ghost` | de-emphasised | faded, dashed |

  e.g. `helper.class: dead` · `log.class: sink` · `edge.class: relation`. Write
  `a -> b` plus a class, not a style block.
- Two graph layers are both fair game: the **data graph** (nodes = the things) and
  the **relation graph** (nodes = relations/types, edges = dependencies, self-loop
  = recursion). Use whichever the idea is about.
- **Book/tree layout.** Source can be a single `src/frames.md` OR a `src/deck/`
  tree of numbered chapter files (`01-foo.md`, `02-bar.md`, or nested folders).
  The FS is the table of contents: the build walks it in sorted order, the file
  name becomes the chapter (breadcrumb + the `o` outline). Prefer the tree once a
  deck grows past a handful of frames.
- **Graph from a database**: a ```` ```sql-graph <name> <db.sqlite> ```` fence runs
  the SELECT read-only (built-in `node:sqlite`) and renders the rows as a graph
  (2 cols = edges, +3rd = label, 1 col = nodes) through the same kit + auto-color
  pipeline. The tool only reads the DB file. (`npm run seed` makes a demo DB.)
- **Cross-link slides** with `[[chapter-or-slide]]` in the prose. These feed the
  deck's own import/export graph: press `m` for the map (chapters as containers,
  slides as nodes, `[[links]]` as edges, current slide marked, click to jump),
  rendered by the same d2 pipeline so circular references auto-colour as cycles.
- Default: **append** new `## ` frames. Pass `--replace` to start the file fresh.

## Step 3 — tell me how to see it

Print the new frame count and: `cd APP && npm run dev` then open the printed URL
(arrow keys / space to step). If the dev server is already running, the save
live-reloads. To author in the background while I keep working, run this as a
parallel agent.
