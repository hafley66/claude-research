---
name: sprefa-dl
description: Use the `dl` engine (sprefa v5) to query a codebase as datalog-over-code — call graphs, import/type graphs, blast radius, lint rails, and codemods. Reach for this when an agent needs structured facts about code (who calls X, what imports Y, what breaks if Z changes) instead of grepping, or wants a reactive .dl rule/LSP diagnostic/codemod.
---

# sprefa `dl` — datalog over code

`dl` extracts facts from source (`scan` + `match_line`/`ast`/`match_ast`/`json`),
lets you write recursive datalog rules, and lowers them to a SQLite fixpoint.
Output is a `?` query, an LSP/`--check` diagnostic, an MCP response, or a
generated/spliced file (`gen`). Every fact is keyed on `(repo, path, rev)`;
matched values carry byte spans, so a match is a coordinate you can squiggle
or rewrite.

`match_line`/`match_ast` are the current names (2026-07-20 rename); `match`/
`sg` are their pre-rename spellings, kept working forever as deprecated
aliases (never a hard break) but each emits a `deprecated-op-name` warning
naming its replacement. Both directions matter equally: `match_line` is a
LINE REGEX, correct only for flat text (ini/env/log/csv); `match_ast` is
ast-grep structural matching, correct for source code. Reach for `match_ast`
on anything the language's parser understands — a line regex silently misses
any construct spanning more than one line.

## Before you write a rule (the constraints that bite)

Read these first; each one is a silent zero-match or a confusing error otherwise.
Run `dl prog.dl --parse-only` to parse + typecheck with NO scan (sub-second fast
fail) before a full run.

- **Captures are UPPERCASE.** In `match_ast`/`ast_yaml` patterns a metavar is `$NAME`
  or `$$$ARGS`; a lowercase `$name` is matched as LITERAL text, not a capture
  (a warn fires). Descriptive-but-uppercase: `$CALLEE`, `$$$CALL_ARGS`.
- **`$$$NAME` is structure only.** A `$$$` multi-metavar matches a node LIST; it
  binds no head var. Bind a single node with `$NAME`, or read the span outputs.
- **Arithmetic is head/comparison only.** `line + 1` is legal in a rule head
  (`next_line(scan_path, line + 1) <- ...`) or on a comparison side, never as a
  body binding. To COMPUTE a value, put the expression in the head, not `l = m+1`.
  (Same for `replace`/`split`/etc. — compute in the head, not a body `x = ...`.)
- **Concat strings by interpolation, not `+`.** There is NO `+`/`concat`
  operator on text. Build a string with `${var}` holes in a double-quoted
  literal, in a HEAD term (same compute-in-head rule as above):
  `node_ref(sym, "fs", "${path}:${line}") <- decl(sym, path, line).` The holes
  also fill `sh` templates (`sh curl("https://api/${owner}/${name}") -> ...`).
- **`_` is the don't-care var.** Use it for a body column you never read
  (`caller(fn) <- call_edge(fn, _).`) or a fixed-schema sink column you skip.
  With KWARGS you just OMIT the column instead (unmentioned = NULL), so a named
  head rarely needs `_` at all.
- **KWARGS exist — name head columns.** Any atom with one `col: term` goes into
  named mode: `diag(path: p, line: l, msg: m)` fills a fixed-schema sink by name
  (order-free, unmentioned columns NULL); a bare `edge(from, to)` puns to its own
  columns. Full rules in "Rule heads: named args, kwargs, bare puns" below.
- **Regexes are Rust-flavor.** No lookahead/lookbehind (`(?!...)`), no backrefs.
  Anchor with `^`, `$`, `\b`, and character classes instead.
- **`comment_node` sees ALL comments; the regex `comment` op is whole-line only.**
  The built-in `comment_node(path, line, col, end_line, end_col, text, kind)` rel
  records EVERY comment (line/block/doc, incl. inline trailing) grammar-backed
  (oxc for TS, tree-sitter for Rust/Kotlin/Python/Go/C/...), so a `//` inside a
  string is never a row. `std/suppress.dl` rides it for the eslint/biome
  `dl-disable-line`/`dl-disable`/`dl-enable` grammar. The regex `comment` op still
  only detects whole-line comments by prefix — use it for files with no grammar.
- **Suppression is opt-in per rail.** `use "std/suppress.dl".` only defines the
  facts; a rail's `diag` rule MUST join both `!suppressed(path, line, code)` and
  `!suppressed(path, line, "*")`. `rail_finding(path, line, code)` opts into the
  stale-directive warning; `lint_candidate(path, line)` enables block directives.
  A `dl-disable-line` comment takes only a code list after the directive:
  trailing prose is parsed as bogus codes, each producing `dl-suppress-unused`.
- **`std/suppress.dl` ships visibility diags ON.** Every recognized directive
  gets a subtle INFO marker (code `dl-directive`, on the comment's byte span)
  naming its effect; a typo like `dl-disable-nextline` WARNs (`dl-directive-malformed`);
  a rail that heads `rail_finding(path, line, code)` also gets an unused-directive
  WARN (`dl-suppress-unused`). Silence a marker in place, self-hosting, with
  `// dl-disable-line dl-directive`. `examples/gen-zone-info.dl` is the opt-in
  twin for `BEGIN:`/`END:` generated-zone markers.
- **Anchor disjunct markers.** In an alternation, a shorter marker substring-
  matches a longer one (`dl-disable` inside `dl-disable-next-line`); anchor each
  branch (`^`, `\b`, trailing `$`) so they do not collide.
- **`scan` has two optional leading args** — copy-paste one of these two forms:
  - with repo: `scan(config_repo, rev, "src/**/*.rs", scan_path, rev_out)`
  - without:   `scan("src/**/*.rs", scan_path, rev_out)`
- **Pick the op by whether a grammar exists.** `match_ast`/`ast`/`ast_yaml`
  when the language has a grammar (below); `match_line` for substrings or a
  language with no grammar handle. Do not reach for `match_line` on a
  structural pattern — this is the whole reason for the 2026-07-20 rename
  (`sg`/`match` read as "cryptic op" vs. "the default", so authors reached for
  the line regex and wrote bad regex against structured languages; the new
  names sort next to each other and force the choice into view).
- **Embedded languages: TERM-form `match_ast`.** `match_ast(:lang, str_var,
  "pat"[, line, col, end_line, end_col])` runs the ast-grep grammar over a
  STRING bound earlier in the rule instead of a file — a styled-components css
  body captured by an outer `match_ast(:tsx)`, a markdown code fence, a
  response column. Spans are RELATIVE to the bound string (byte 0 = its start;
  carry the region's own line to reach file coordinates). Runs in the
  join+extract pass like term-form `json`/`jsonp`, so it heads its own rel
  (never co-headed with a derived rule). See `examples/styled-components.dl`
  and `examples/md-fences.dl`.
- **One rel = one rule kind.** Never head a rel with BOTH a source rule
  (`scan`/`match_line`/`ast`/`match_ast`/`ast_yaml`/`json`/`cmd`/`comment`) and
  a derived rule — the engine bails. Split into two rels, union in a third.
- **A `closure`/`scc`/`node2vec` rel can't be read unpinned in a rule body.** The
  recursive view materializes; seed a recursive rule instead, or pin both ends of
  a `?` query (`? reaches("a", x).`).
- **`match_line`'s trailing positional is an opaque MATCH ID, not the matched
  text.** `match_line(path, rev, /re/, line[, id][, col, end_col])` — that `id`
  is a big integer, not a string; a rail naming it `hit` is misleading.
  `split()` on it silently yields 0 rows. To get text, use Rust named capture
  groups in the regex: `/^### Name: (?<name>\S+)/` binds the dl var `name`
  directly.
- **`(?<name>...)` binds only from `match_line`'s source-op regex, not from a
  body `=~` on an already-bound var.** `path =~ /^(?<name>A|B).*$/` as a plain
  body constraint accepts under `--parse-only` but fails a full run with
  `unbound variable name`. Fix: compute it in the head instead —
  `replace_re(text, "^(A|B).*$", "$1")`.
- **`comment_node.text` has the comment tokens stripped.** No `//` or `/* */` in
  `text` — regexing for them there silently matches nothing.
- **`match_ast(...)` needs its `scan(...)` inline in the same rule body.**
  Supplying `(path, rev)` from a derived rel instead fails with `source rule
  ... missing scan`.
- **Negation is `!rel(...)` only.** `!(f =~ /.../)` is a parse error (`expected
  identifier, got LParen`). Fix: hoist the regex into a `foo_excluded` rel and
  negate that rel.
- **One source op per rule body.** Mixing two independent source ops (e.g.
  `comment_node` + an unrelated `scan`) with an `=~` constraint throws `unbound
  var in constraint` / "put the expression in the head" too — the fix is
  splitting into one rel per source op, not moving the expression to the head.
- **`//` inside a regex literal starts a comment.** Escape as `\/\/` in
  `/.../` patterns.
- **`?` queries are bare `?rel(vars).` only.** No `:-` filter clause, no `==`
  operator; equality is expressed by a shared variable across joined atoms.
- **`gen` sorts by rendered TEXT, not a bound sort-key column.** A sort-key
  column in the body has zero effect on row order; put the sort-relevant
  prefix inside the rendered string itself to control output order.
- **`gen` templates use `{var}`, not `${var}`.** `${var}` is the `diag`/string-
  head interpolation sigil; inside a `gen` template it fails at RUNTIME
  (`gen expects a template string here, got Interp(...)`), not at parse.
- **`ast_yaml` nesting is immediate.** `inside:` matches the immediate parent only,
  not any ancestor. RuleCore atomics are `pattern`, `kind`, `regex`, `nthChild`,
  `range`, `inside`, `has`, `precedes`, `follows`, `all`, `any`, `not`, and
  `matches` — there is no `field:` selector; reach name fields with
  `kind: identifier, inside: {kind: function_item}`. Under `(?i)`, character
  classes fold case too (`[A-Z0-9]` becomes `[A-Za-z0-9]`); use case-exact
  alternation branches for uppercase-boundary checks.

### Per-op language matrix

A `:lang` used outside its op's list bails at scan time — `match_ast`/
`ast_yaml` share the ast-grep grammars (they have `tsx`/`typescript`/`cpp`),
while `ast` runs tree-sitter (it has `bash`/`hcl`/`gotmpl`/`dockerfile` but NO
`tsx`). The real tables live in `src/sg.rs` (`SG_LANG_TABLE`) and
`src/engine/mod.rs` (`AST_LANG_TABLE`); a test keeps this block set-equal to
them:

    match_ast, ast_yaml: rust typescript tsx javascript python go json c cpp kotlin css html bash csharp java scala swift ruby php lua elixir haskell yaml
    ast: rust c kotlin python bash go hcl starlark jsonnet gotmpl dockerfile

## Install

```sh
# from a local clone (the crate lives at the repo root; run from there)
cargo install --path . --force
# or from git
cargo install --git https://github.com/hafley66/sprefa sprefa-dl
```

Turnkey, post-download (the skill text + starter `.dl` are embedded in the
binary, so this works on a prebuilt download with no source tree):

```sh
dl setup                 # install this skill + wire detected agents (Claude Code, opencode)
dl setup --project .     # bootstrap a repo: .dl/ rail + AGENTS.md/CLAUDE.md section
dl setup --print         # dump the embedded skill to stdout
```

From source, `install-dl.sh` also `cargo install`s the binary first.

## Discover examples + reusable libs (embedded in the binary, no disk)

The `.dl` corpus and the `std/` libs are baked into the binary, so these work on
a bare prebuilt download:

```sh
dl examples                      # list every embedded example (name + summary)
dl examples scip dataflow        # semantic search (cosine, offline stub embedder)
dl examples --show openapi-lsp   # print one to stdout (read/load without disk)
dl examples --std                # the use-able std libs
dl <(dl examples --show openapi-lsp)            # run an embedded example directly
```

Reusable tools: `use "std/callgraph.dl".` resolves from disk if present, else
from the embedded copy — a stdlib that works with no source tree. (Real semantic
search: build with `--features embed-fastembed` to swap the stub for an ONNX model.)

## Root, daemon, no-daemon (read this — it wastes the most time)

**ROOT is the current directory. There is NO `--root` flag.** Point `dl` at a
repo by running it FROM that directory (`cd <repo> && dl ...`). A spawned daemon
learns its root from `DL_DAEMON_ROOT`; you set that only when scripting a daemon.

| mode | command (run from the repo dir) | when |
|---|---|---|
| ad-hoc | `dl prog.dl` | one-off query, prints `?` rows |
| discovery | `dl --check` | runs every `<cwd>/.dl/*.dl`; exit 2 on any `diag` row (CI rail) |
| LSP | `dl prog.dl --lsp` | live editor diagnostics from `diag` rows |
| isolated | `dl prog.dl --no-daemon` | in-process, do NOT attach/spawn a daemon |

A one-shot AUTO-ATTACHES to a per-root daemon (warm incremental ticks). This
usually helps, but for a clean, reproducible one-off run — or when a daemon is
misbehaving — add `--no-daemon` (or `DL_NO_DAEMON=1`) to force the in-process
path. A generator/rail that must NOT see stale daemon state (e.g. regenerating
docs) should always use `--no-daemon`. Also use it for single-program isolation:
an unflagged `dl prog.dl` with an attached daemon merges through the daemon's
FULL `.dl/*.dl` corpus, not just `prog.dl`.

**Daemon lifecycle (the reinstall trap):** a long-running daemon holds its OLD
in-memory image after you `cargo install` a new `dl`. An auto-attaching one-shot
detects the drift and restarts it, but a purely reactive daemon (nothing
attaches, it just re-ticks on file changes) does NOT self-heal and will keep
running stale code. After reinstalling:

```sh
dl daemon status    # is it up? build_id, tick_count, settled, program
dl daemon restart   # stop + respawn for this root with the CURRENT binary
dl daemon stop      # just shut it down
```

`dl daemon restart` is the one-liner — no `kill`/`nohup`/pid-file dance. (The old
`--restart`/`--stop`/`--rows` flags still work, hidden, but prefer the subcommand.)

**Inspect the live daemon:** `dl daemon rows <REL>` prints a relation's current
rows from the running daemon (e.g. `dl daemon rows checkout_done`, `dl daemon rows
call_edge`) — the `?`-query shortcut for "what did this actually resolve to", no
temp file. `dl daemon status` confirms which binary the daemon is running.

## Common tasks (copy-paste, stop guessing)

**Most important commands**

| do | command |
|---|---|
| run a program | `dl prog.dl` (from the repo dir) |
| run inline, no file | `dl 'seen(path) <- scan("**/*.rs", path, rev). ? seen(path).'` |
| run a folder of rails | `dl some/rails/` (merges its `*.dl` once) |
| watch reactively | `dl watch prog.dl` (or `dl watch some/rails/`) — daemon serves it, hot-reloads |
| run all repo rails | `dl --check` (exit 2 on any `diag`) |
| fast validate, no scan | `dl prog.dl --parse-only` |
| live editor diagnostics | `dl prog.dl --lsp` |
| inspect a live rel | `dl daemon rows call_edge` |
| daemon status / reset after reinstall | `dl daemon status` / `dl daemon restart` |
| build a SCIP index | `dl index --install` |
| SCIP health screen | `dl doctor` |
| search the docs | `dl docs search '<anything>'` |
| read a guide / browse examples | `dl docs`, `dl examples` |

Root is always the current directory — there is NO `--root` flag. Point `dl` at a
repo by running from it (or configure it in `config.toml`). Inline source and a
folder run once in-process; `dl watch` is the reactive form.

**Check for more (self-documenting, don't guess the surface):** `dl docs search
'<words>'` ranks every guide + the CLI help (e.g. `dl docs search concat`); `dl
--help` (the trailer lists everything); `dl docs` (topic list → `dl docs syntax`,
`dl docs book 1`, `dl docs authoring`); `dl examples` (`dl examples <query>`
searches, `dl examples --show <name>` prints one); `dl daemon rows rel_catalog` /
`? rel_catalog(name, group, cols, doc).` (every builtin relation), `? fn_catalog(...)`
/ `? op_catalog(...)`.

**Config a repo set** (multi-repo, ghcacher, cross-repo): a TOML at
`$SPREFA_CONFIG` (else `$XDG_CONFIG_HOME/sprefa/config.toml`, else
`~/.config/sprefa/config.toml`). It populates the `repo` builtin.

```toml
[[repos]]
slug = "alpha/one"
root = "/path/to/checkout-a"

[[repos]]                       # not on disk yet? give a url, cloned on first scan
slug = "beta/two"
root = "/path/to/cache/beta"
url  = "git@github.com:org/beta.git"

[[org]]                         # expand a folder of checkouts into one [[repos]] each
dir  = "/path/to/orgs/hashicorp"
```

`dl setup --project .` bootstraps a repo (`.dl/` rail + AGENTS.md/CLAUDE.md section).

**Load files (scan) — the source op that feeds everything:**

```dl
src(scan_path) <- scan("src/**/*.rs", scan_path, rev).           # WORK tree (cwd)
old(scan_path) <- scan("HEAD~5", "src/**/*.rs", scan_path, rev). # a git rev
all(scan_path) <- scan("*", "WORK", "**/*.ts", scan_path, rev).  # every config repo
```

A BARE `scan` rule is enough: it populates `_file` AND triggers AST/SCIP/type/
call/dataflow extraction for the matched files. You never need a dummy
`match_line` to "force" a scan. Reuse library rules with `use "std/callgraph.dl".` (resolves from
disk or the embedded copy). Push a program into a running daemon with
`dl daemon load prog.dl` (watched, hot-reloads) or `dl daemon load-once prog.dl`
(eval once).

**Watch files (reactive):**

| want | command |
|---|---|
| editor diagnostics, live | `dl prog.dl --lsp` |
| background daemon for a repo | `dl daemon start` (from the repo; or it auto-spawns on first one-shot) |
| in-process re-tick on change | `dl prog.dl --watch` (no daemon, foreground) |

**ghcacher (both halves):** the config `[[repos]]`/`[[org]]` above is the repo set.

- API cache → SQLite: `dl examples/gh-cache.dl --lsp` (conditional GitHub polls,
  etag carry, entity extraction; `DL_POLL_SECS` = daemon re-tick cadence).
- Keep local checkouts current: `dl examples/gh-checkout.dl --lsp` (the `checkout`
  sink: clone-missing + fetch + fast-forward). Confirm it fired with
  `dl daemon rows checkout_done`.

## Which extractor (NEVER default to `match_line`)

`match_line` is a regex over raw text — the LAST resort, for flat text
(ini/env/log/csv) or a language with no grammar and no index. It is never the
right tool for structured source code: a construct spanning more than one
line silently never matches (the incident that forced the 2026-07-20 rename —
`match(...)` used to find `Err(_) => ... return;` in Rust found ZERO results
because the arm spans three lines; one `match_ast(...)` pattern `"return;"`
found 39, including every one a five-agent human audit found independently).
Prefer, in order:

1. **SCIP** (`scip_def`/`scip_ref`/`call_edge`/`type_link`) — compiler-accurate
   resolution. Turn it on with `dl index --install` (writes `.dl/index.scip`), or
   demand it per repo by heading `scip_want(repo)` from a rule, or point
   `$SPREFA_SCIP_INDEX` at an existing index. `dl doctor` says what's missing.
2. **`ast` / `match_ast` / `ast_yaml`** — structural patterns when the language
   has a grammar (see the matrix above). `$UPPERCASE` metavars capture with
   byte spans.
3. **built-in graph rels from a bare `scan`** — `call_edge`, `type_entity`,
   `df_edge`, `module_edge`, `comment_node`, `doc_comment` are already extracted;
   query them directly instead of re-parsing with regex.
4. **`match_line`** — only for substrings / a grammar-less file. Never
   `match_line(/./)` to force a scan (a bare `scan` already extracts). If you
   catch yourself regexing a call or an import, stop and use the graph rel or
   SCIP.

`match_line`/`match_ast` are the current names; `match`/`sg` are their
pre-rename spellings (2026-07-20), kept as deprecated aliases — both still
parse and run, but each warns (`deprecated-op-name`) naming its replacement.
Neither old name is "the good one that just got a longer name": both are
equally deprecated. Reach for the new names in anything you write.

**SCIP without the token-burn:** `dl index --install` (detects languages, installs
+ runs the right indexer, merges to `.dl/index.scip`) then run your program — the
`scip_*` rels are populated. For a multi-repo config, head `scip_want(repo)` and
the importer indexes that repo lazily on demand. Don't hand-roll indexer commands;
`dl index` / `dl doctor` own it.

## Rule heads: named args, kwargs, bare puns (v0.4.0)

Once ANY atom carries a `col: term`, the whole atom is in named mode: a term
that carries a name binds by name, a nameless term binds by position. A bare
`Var` puns to its own column (`edge(from, to)` == `edge(from: from, to: to)`),
and an unmentioned column is left `NULL`/don't-care. Works in rule heads too,
so a fixed-schema sink like `diag` (9 columns) is written by naming only the
columns you use:

```dl
rel import_edge(importer_path: text, imported_path: text, line: int).

diag(path: importer_path, line: line, severity: "warning", code: "long-import-chain",
     msg: "import chain worth checking") <-
    import_edge(importer_path, imported_path, line), line > 5.
```

## Lattice relations: `key(...)` + `merge(...)`

`key` names a conflict target narrower than the whole row (a choice-domain,
Soufflé-style); `merge` resolves a collision instead of silent-picking the
first write. Used for "one winner per id": a dispatch table, a lint severity
ceiling, an etag carry.

```dl
rel candidate(sym: text, score: int).
rel best(sym: text, score: int) key(sym) merge(MaxBy(score)).
best(sym, score) <- candidate(sym, score).
```

## Ports (`@in`/`@out`) + `--mcp`

`rel req(id: text, method: text, params: text) @in(rpc).` marks a rel a PORT:
`class` (`rpc`) names a fixed contract, never a transport, and the column
envelope is checked by NAME at declare time (`rpc` in = `id`/`method`/`params`,
out = `id`/`result`). `--mcp` binds `rpc` ports to stdio × JSON-RPC; the same
program could serve HTTP later unchanged. A rule/fact heading an `@in` port is
rejected: the serving loop is the only writer. See `examples/mcp-echo.dl`
(lattice dispatch) and `examples/mcp-server.dl` (tools/list + tools/call).

## Effect templates: `sh` / `sh!` / `sh*` + `collect()`

Content-addressed on `(head_rel, args)` so an unchanged request never re-fires:
`sh` = read effect (at-least-once retry), `sh!` = mutate effect (idempotency-
keyed, claimed and run exactly once), `sh*` = stream effect (each stdout line
fans into its own row). `collect(x, n)` batches every solution for `x` into one
request capped at `n` per batch, the ghcacher N-calls-become-1 win.

```dl
rel watched_endpoint(endpoint: text).

sh fetch_endpoint(endpoint) -> (status_code: int, body_text: text) =
  `curl -s -o /dev/null -w "%{http_code}" {endpoint}`.

rel endpoint_status(endpoint: text, status_code: int, body_text: text).
endpoint_status(endpoint, status_code, body_text) <-
    @async watched_endpoint(endpoint), fetch_endpoint(endpoint) -> (status_code, body_text).
```

`examples/gh-cache.dl` (etag-carry `sh`), `examples/npm-crawl.dl` (`sh*`),
`examples/gh-cache-batch.dl` (`collect`).

## When to reach for it (instead of grep)

- **Call graph / blast radius**: who calls X, what transitively reaches Z —
  `closure(call_edge)`, `reaches(Term, X)`.
- **Import graph**: `module_edge`, broken imports (`examples/lint-imports.dl`).
- **Type graph**: `type_edge(from, to, kind)`, `type_entity`/`type_sig`/`type_link`
  (SCIP-resolved sym→sym), cross-language (Rust/TS/Kotlin).
- **Dataflow**: `df_node`/`df_edge`/`df_arg`/`df_param`/`df_field`, unioned into
  `flow_edge` by `use "std/flow.dl".` (`examples/flow-interproc.dl`, `taint.dl`).
- **Lint rails**: a rule heading `diag(path, line, col, ..., severity, code, msg)`
  becomes a `--check`/`--lsp` gate (`examples/lint-*.dl`).
- **Codemods**: `--move OLD=NEW` rewrites import paths via the located span spine.
- **SCIP**: set `SPREFA_SCIP_INDEX` (or drop `index.scip` at root) to load
  compiler-backed `scip_def`/`scip_ref`/`scip_edge`.

## Extraction-family built-in relations

Each family populates lazily the first time a program references one of its
relations (a bare `scan` seeds the file set; referencing e.g. `type_entity`
opts type extraction in over that scan, no separate enable step). Full
schemas: `docs/reference/relations.md` (generated, grouped by `group`).

| family | key relations | opts in via |
|---|---|---|
| type | `type_entity`, `type_sig`, `type_link`, `type_edge`(`_rev`) | any `type_*` atom |
| call | `call_def`, `call_site`, `call_edge`, `call_name` | any `call_*` atom |
| dataflow | `df_node`, `df_edge`, `df_arg`, `df_param`, `df_field` | any `df_*` atom |
| doc | `doc_comment`, `doc_tag` | either atom |
| module | `module_edge`, `module_node` | any `module_*` atom |

Telemetry as facts: `rel_count(rel, rows)` and `stmt_ms(rel, ms)` report the
last tick's own row counts and per-statement wall time; `examples/perf-rails.dl`
turns them into a row-budget / slow-rule `diag` rail.

## `--hook`: Claude Code PostToolUse hook, as a rule

`dl --hook` reads a Claude Code hook event (PostToolUse JSON) on stdin, ticks
the program, and emits `inject`/`inject_skill`/`block` rows as the hook's
output: no editor, no bash, the condition is a rule. `dl setup --project .`
wires the `.claude/settings.json` registration.

```dl
rel inject_skill(skill_name: text).

inject_skill("testing") <-
    changed(changed_path), changed_path =~ /(_test\.|\.test\.|\.spec\.)/,
    !skill_loaded(_, _, "testing").
```

## Self-documenting (read these, don't guess the surface)

| op | kind | syntax |
|---|---|---|
| `aggregation` | body | `count sum min max` |
| `arith` | body | `+ - * / %` |
| `ast` | source | `ast(path, rev, :lang, "(query) @cap", line[, end])` |
| `ast_yaml` | source | `ast_yaml(path, rev, :lang, "rule yaml", line, ...)` |
| `atom` | body | `edge(from, to) / edge(to: dst) / edge("x", 1, kind: edge_kind)` |
| `closure` | body | `closure(edge)` |
| `cmd` | source | `cmd(path, rev, "tool {file}", line, out)` |
| `comment` | source | `comment(path, rev, /open/[, /close/], l0, l1, label)` |
| `comparison` | body | `= != < <= > >=` |
| `diag` | sink | `diag(path: hit_path, line: hit_line, msg: message[, col: , end_line: , end_col: , severity: , code: , hint: ]) <- ...` |
| `gen` | sink | `gen([:mode,] path, [l0, l1,] "{var} template")` |
| `glob` | body | `path ~~ "src/*"` |
| `graph_edge` | sink | `graph_edge(src: src_id, dst: dst_id, kind: kind) <- ...` |
| `graph_node` | sink | `graph_node(id: node_id, label: label, kind: kind[, file: , line: , parent: ]) <- ...` |
| `json` | source | `json(path, rev, q:{ $k: $v })` |
| `jsonp` | source | `jsonp(path, rev, "a.*.b", out)` |
| `match_ast` | source | `match_ast(path, rev, :lang, "$X.unwrap()", line[, col, end_line, end_col][, id])` — structural (ast-grep); the tool for SOURCE CODE |
| `match_line` | source | `match_line(path, rev, /re/, line[, id][, col, end_col])` — LINE REGEX; flat text only (ini/env/log/csv), never source code |
| `match` / `sg` | source (deprecated) | pre-rename spellings for `match_line`/`match_ast`; still parse and run, each warns naming its replacement |
| `negation` | body | `!edge(from, _)` |
| `node2vec` | body | `head(node_a, node_b, score) <- node2vec(edge)` |
| `query` | sink | `? rel(from, to). / ? rel(col: value).` |
| `regex` | body | `name =~ /^[A-Za-z]+$/` |
| `scan` | source | `scan([repo,][rev,] glob, path[, rev_out])` |
| `scc` | body | `head(rep, member) <- scc(edge)` |
| `strfn` | body | `split(text, sep, idx) / replace(text, from, to)` |
<!-- END: op-quickref -->

## Self-validating (dl lints dl, like rust-analyzer)

`dl_diag(path, line, col, end_line, end_col, severity, code, msg)` runs the
engine's own lex/parse/typecheck over every scanned `.dl` file. Build a rail:

```dl
rel agent_changed(changed_path: text).
agent_changed(changed_path) <- agent_touch(_, _, changed_path).

diag(path: changed_path, line: line, col: col, end_line: end_line, end_col: end_col,
     severity: severity, code: code, msg: msg) <-
    agent_changed(changed_path), changed_path =~ /\.dl$/,
    dl_diag(changed_path, line, col, end_line, end_col, severity, code, msg).
```

`examples/lint-dl-self.dl` is this rail; `dl --check` exits 2 on a broken `.dl`.

## Git-free agent relations

`agent_edit` / `agent_touch` read the harness session store keyed on the ROOT
directory (the cwd) — no git, the file need not be tracked or committed. Only
`changed` / `changed_line` / `created` need a git repo (empty outside one).
**Observed, unconfirmed:** inside a spawned subagent, `agent_edit`/`agent_touch`
returned 0 rows even after real Edit-tool calls in the same root — possibly
keyed to a harness session id the subagent doesn't share. Treat an empty result
as suspect, not as proof of no edits, when running inside a subagent.

## Authoring gotchas

- **N+1**: never a per-row write. Collect the set, one `insert_rows`/`refresh_rel`.
- **One rel = one rule kind**: never head a rel with both a source rule
  (`scan`/`match_line`/`ast`/`match_ast`/`json`/`cmd`/`comment`) and a derived
  rule — the engine bails. Split and union in a third rel.
- **Reserved names**: `repo`, `rev`, `content`, `file`, `string`, `ref`,
  `file_lines`, the `type_*`/`call_*`/`df_*`/`doc_*`/module-graph families,
  `dl_diag`, plus every relation any built-in family owns; pick another name
  (anim uses `node_ref`).
- **A source rule can't join a negated relation atom.** Mixing `scan(...)`
  (or any source op) with `!rel(...)` in the same body now bails ("source
  rules cannot join relations"). Split into a bare-scan rel plus a separate
  derived rel that does the `!rel(...)` filter.
- **Banned identifiers**: `provenance`→source, `substrate`→base,
  `load-bearing`→critical, `regime`→mode.

## Adding a built-in relation

See the `sprefa-v5-new-builtin-rel` skill. Short version (current pattern):
a `RelKind` impl in `src/rels/` + register in `rel_kinds()`, with `group`/`doc`
set on each `RelDecl` (an empty doc fails the doc-completeness test; the
catalog + generated README table read the decl). The reserved-name guard, both
tick paths, and decls wire automatically.
