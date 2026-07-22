---
description: tree-sitter — incremental GLR parser with first-class error recovery, ERROR/MISSING nodes, lossless CST. Production-grade IDE backbone. Load when evaluating parser replacement for a Rust DSL/query language.
---

# tree-sitter

Incremental GLR parser generator with C runtime; Rust binding via the `tree-sitter` crate.

## Crate

| Field | Value |
|---|---|
| crate | `tree-sitter` |
| version | `0.26.8` (2026-03-31) |
| downloads | 17.6M total, 6.15M recent |
| companion | `tree-sitter-highlight` 0.26.8, `tree-sitter-cli` (codegen) |

## Recovery model

GLR (Generalized LR) over a deterministic LR core; on parse failure the parser opens parallel stacks and races them, then commits to the cheapest survivor. Two error node kinds end up in the tree:

- `ERROR` — the parser could not match grammar; the bad span is wrapped as an `ERROR` node whose children are still the recovered tokens.
- `MISSING` — a required token was synthesized to keep the tree well-formed; node has zero byte width but real `kind()`.

`Node::has_error()` walks the subtree; `Node::is_missing()` checks the synthesized flag. Recovery is automatic — the grammar author writes nothing for it.

## Incremental reparse

```rust
use tree_sitter::{Parser, InputEdit, Point};

let mut parser = Parser::new();
parser.set_language(&tree_sitter_rust::LANGUAGE.into())?;

let mut tree = parser.parse(&source, None).unwrap();

// edit happens
source.replace_range(old_range, new_text);
tree.edit(&InputEdit {
    start_byte, old_end_byte, new_end_byte,
    start_position: Point::new(row, col),
    old_end_position, new_end_position,
});

// reparse reuses untouched subtrees
let new_tree = parser.parse(&source, Some(&tree)).unwrap();
let changed = new_tree.changed_ranges(&tree);
```

`Tree::edit` marks affected subtrees; `Parser::parse(text, Some(&old))` reuses unchanged green nodes via structural sharing. `changed_ranges()` returns byte spans that differ — the LSP-grade reparse delta.

## Lossless CST

Yes. Tree retains every byte: whitespace and comments live as `extras`, recoverable via `Node::utf8_text(&source)`. Round-trip from tree back to source is exact.

## LSP fit: 5/5

Designed for editor integration. `parse on every keystroke` is in the project tagline. Async cancellation via `Parser::set_timeout_micros` and `set_cancellation_flag`.

## Production users

- Atom (origin, GitHub)
- Neovim (default highlighter since 0.5)
- Helix (entire syntax/selection model)
- Zed
- GitHub code navigation (server-side)
- ast-grep (pattern matching engine, closest analogue to sprefa v1)
- Emacs 29+ (built-in tree-sitter modes)

## Workflow

Grammar lives in `grammar.js` (a JS DSL). `tree-sitter generate` emits `parser.c` + `node-types.json`. Rust side links the C parser through `tree-sitter-<lang>` crates. For an in-tree grammar, `build.rs` compiles the generated C with `cc`.

```js
// grammar.js
module.exports = grammar({
  name: 'sprf',
  rules: {
    source: $ => repeat($._stmt),
    _stmt: $ => choice($.pipe, $.fork, $.comment),
    pipe: $ => seq($.op, repeat(seq('>', $.op))),
    op:   $ => seq($.ident, '(', optional($.args), ')'),
    // ...
  },
});
```

## Integration cost for sprefa: medium

- New build dependency on `tree-sitter-cli` (npm or cargo) and a C compiler.
- Grammar must be expressed in `grammar.js`; the `_8_parse.rs` hand-rolled walker is replaced by a generated parser + a thin Rust adapter that maps `Node` → existing AST.
- Captures: tree-sitter has its own query DSL (`(node_name) @capture`) — sprefa's existing capture model would either delegate to it or stay in a post-pass.
- Node kinds become `u16` ids from `node-types.json`; pattern-matching code reads `node.kind_id()` not `enum`.
- Op-owned diagnostics still work: each op walks tree-sitter nodes and emits its own diagnostics during the pipe step.

## When to pick

- Need IDE-grade error recovery without writing it.
- Want incremental reparse for free.
- Willing to add a C build step and a JS-DSL grammar source.
- Want to share grammars with the broader editor ecosystem (Helix, Neovim plugins for `.sprf` highlighting come free).

## When to skip

- Want a pure-Rust toolchain with no C / no node.
- Grammar is unstable and rewriting `grammar.js` every week is more painful than tweaking a hand-written parser.
- Need parsing of binary/streaming data (tree-sitter is text only).

## Sources

- [tree-sitter on crates.io](https://crates.io/crates/tree-sitter) — fetched 2026-04-18
- [tree-sitter docs](https://tree-sitter.github.io/tree-sitter/) — fetched 2026-04-18
- [tree-sitter Rust binding](https://docs.rs/tree-sitter/latest/tree_sitter/) — fetched 2026-04-18
- [tree-sitter GitHub](https://github.com/tree-sitter/tree-sitter) — fetched 2026-04-18

## LSP / tree-sitter interop

### LSP scaffolding
- tree-sitter is not an LSP framework, but it is the parsing core of many LSPs and editor servers: helix, zed, neovim's nvim-treesitter, GitHub's stack-graphs-based code nav, ast-grep's LSP mode, `tree-sitter-language-server` (linting `.scm` queries).
- For sprefa-shape projects, the canonical LSP wiring is `tower-lsp` (or `lsp-server`) + `tree-sitter` + tree-sitter `Query` for selectors + custom analyses. ast-grep's `crates/lsp` is a working reference.
- Incremental reparse is built in (`Tree::edit` + `Parser::parse(prev_tree)`), which is the main LSP UX win over hand-written parsers.
- Error recovery is GLR-based and best-in-class for partial input -- the scanner inserts `ERROR` and `MISSING` nodes and keeps going, so semantic tokens stay alive on a half-typed buffer.

### tree-sitter import / export
- It IS the format. Anything that consumes tree-sitter (helix, zed, neovim, ast-grep, GitHub semantic, difftastic) reads your `tree-sitter-<lang>` grammar directly.
- Grammars are authored in `grammar.js` (JS DSL) and compiled to a C parser via `tree-sitter generate`. Rust consumers link via the `tree-sitter` crate + a generated `tree-sitter-<lang>` crate.

### Highlighting story
- `highlights.scm` query files are the universal highlighting format -- helix, zed, neovim, GitHub Linguist (via tree-sitter-cli), bat, and others all consume them.
- Semantic tokens via LSP work too: walk the tree, classify nodes against `highlights.scm`, emit tokens. `tree-sitter-highlight` crate does this end-to-end.
- TextMate fallback: `tree-sitter-cli` can print tokens, but there is no first-party TextMate exporter; community tools exist.

### Paired tree-sitter grammar?
- By definition. The grammar IS the tree-sitter grammar.

### Sprefa-specific note
This is the only library on the list that lets sprefa ship one grammar usable by their parser AND ast-grep AND helix/zed/neovim for free, because sprefa already runs ast-grep (which is tree-sitter under the hood). A `tree-sitter-sprf` grammar would:
- power sprefa's own parser via the `tree-sitter` crate,
- power ast-grep pattern matching against `.sprf` files,
- power helix/zed/neovim syntax highlighting and structural editing,
- power sprefa's LSP semantic tokens through `tree-sitter-highlight` queries,
- power incremental reparse on every keystroke in the LSP buffer.

Maximum LSP+TS bonus by construction.
