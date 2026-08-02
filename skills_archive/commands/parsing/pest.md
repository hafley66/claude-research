---
description: pest — PEG parser generator with .pest grammar files and derive macro. Pretty error messages via auto-generated Span context. No recovery, no incremental reparse. Load when evaluating a quick-start PEG for a small DSL.
---

# pest

PEG parser generator. Grammar in `.pest` files, parsed via `#[derive(Parser)]`.

## Crate

| Field | Value |
|---|---|
| crate | `pest` (runtime) + `pest_derive` (proc macro) |
| version | `2.8.6` (2026-02-05) |
| downloads | 224M total, 41.8M recent |
| companion | `pest_meta`, `pest_debugger` |

Heavily used in the Rust ecosystem; one of the most-downloaded parsing crates.

## Recovery model

None at the parse level. PEG semantics: ordered choice with backtracking; on failure the entire parse returns `Err(pest::error::Error)`. Error message is the union of expected rules at the deepest position the parser reached.

```rust
let err = MyParser::parse(Rule::pipe, ";;>broken").unwrap_err();
println!("{}", err);
//  --> 1:1
//   |
// 1 | ;;>broken
//   | ^---
//   |
//   = expected ident or comment
```

The error-formatter is the win: `pest::error::Error::Display` renders a caret-pointed snippet automatically. No multi-error parse; first failure aborts.

## Incremental reparse

No.

## Lossless CST

No. The result is a `Pairs<Rule>` iterator over matched spans; whitespace handled via the implicit `WHITESPACE` rule and discarded by default. Atomic rules (`@`) suppress whitespace inside; silent rules (`_`) hide from output.

## LSP fit: 2/5

Single-error abort is the deal-breaker. Diagnostics-per-keystroke means the user only sees one error at a time and gets nothing past it.

## Workflow

```pest
// src/sprf.pest
WHITESPACE = _{ " " | "\t" | "\n" }
COMMENT    = _{ "#" ~ (!"\n" ~ ANY)* }

ident = @{ (ASCII_ALPHA | "_") ~ (ASCII_ALPHANUMERIC | "_")* }
op    =  { ident ~ "(" ~ args? ~ ")" }
pipe  =  { op ~ (">" ~ op)* }
file  =  { SOI ~ pipe* ~ EOI }
```

```rust
#[derive(Parser)]
#[grammar = "sprf.pest"]
struct SprfParser;

let pairs = SprfParser::parse(Rule::file, &source)?;
for pair in pairs {
    match pair.as_rule() {
        Rule::pipe => walk_pipe(pair),
        _ => {}
    }
}
```

## Production users

- Handlebars-rust
- pest itself (self-hosted)
- many config-format crates (graphviz parsers, csl-rs, ron variants)
- educational DSLs and small language projects

Few production compilers; pest's niche is "small grammar, pretty errors".

## Integration cost for sprefa: low

- Grammar in one `.pest` file, derive macro in the AST module.
- Replaces `_8_parse.rs` directly with a `Pairs` walker.
- Diagnostic story regresses (single error, no recovery).
- LSP cannot show all problems at once.

## When to pick

- Small DSL, batch compilation, no LSP.
- Iterating fast on grammar shape during prototyping.
- Want pretty CLI error messages with zero diagnostic effort.

## When to skip

- IDE / multi-error reporting is required.
- Grammar has left recursion (PEG forbids it; refactor needed).
- Want a navigable tree past the matched-pairs iterator.

## Sources

- [pest on crates.io](https://crates.io/crates/pest) — fetched 2026-04-18
- [pest book](https://pest.rs/book/) — fetched 2026-04-18
- [pest_derive](https://docs.rs/pest_derive/) — fetched 2026-04-18

## LSP / tree-sitter interop

### LSP scaffolding
- pest itself ships `pest-language-server` / `pest-ide-tools` for editing `.pest` grammar files (i.e., LSP for grammar authors, not for the languages you parse).
- No first-party LSP template for "I parsed my DSL with pest, now scaffold an LSP." BYO with `tower-lsp` is the norm.
- pest's PEG model gives clean span info on every `Pair`, so diagnostic mapping is straightforward; error recovery is weak (PEG ordered choice, no panic-mode), which limits LSP-on-partial-input UX.

### tree-sitter import / export
- No converter. Conceptually `.pest` (PEG) and `tree-sitter`'s GLR are different families; a mechanical port is not viable.
- Dual-maintain.

### Highlighting story
- pest produces a CST-shaped `Pair` tree, so post-parse classification into semantic tokens is mechanical. Still BYO LSP plumbing.
- TextMate or tree-sitter for editor highlighting outside the LSP.

### Paired tree-sitter grammar?
- None bundled.

### Sprefa-specific note
pest gives a CST-like output that maps cleanly to semantic tokens, but the editor-ecosystem reach (ast-grep/helix/zed) still requires a separate tree-sitter grammar. Same one-grammar-everywhere problem.
