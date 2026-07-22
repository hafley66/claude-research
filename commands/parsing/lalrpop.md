---
description: lalrpop — LR(1)/LALR(1) parser generator with build-script codegen. Recovery is panic-mode only and parser-level (not lexer-level). Load when evaluating a classical LR generator for a stable DSL grammar.
---

# lalrpop

LR(1) (and LALR(1)) parser generator. Grammar in `.lalrpop` files, code emitted at build time.

## Crate

| Field | Value |
|---|---|
| crate | `lalrpop` (build-time) + `lalrpop-util` (runtime) |
| version | `0.23.1` (2026-03-11) |
| downloads | 52.1M total, 9.0M recent |
| MSRV | recent stable; ships on crates.io |

## Recovery model

Panic-mode via the `!` token. Grammar declarations import `ErrorRecovery` and add an explicit `errors` accumulator:

```rust
// in grammar.lalrpop
use lalrpop_util::ErrorRecovery;

grammar<'err>(errors: &'err mut Vec<ErrorRecovery<usize, Token<'_>, &'static str>>);

Stmt: Box<Stmt> = {
    <e:Expr> ";" => e,
    ! => { errors.push(<>); Box::new(Stmt::Error) },
};
```

Behavior:
- Parser injects the synthetic `!` token, runs the matching action, then drops input tokens until it can resume.
- Multiple errors collected in one parse.
- **Recovery is parser-level only.** Lexer errors (invalid tokens) abort. For IDE use this is a hard limit unless the lexer is custom-wrapped.

No GLR, no incremental reparse, no error nodes in a CST sense (recovery yields whatever AST node the action constructs).

## Incremental reparse

No.

## Lossless CST

No. The output is whatever the action closures return — typically a thin AST. Trivia (whitespace, comments) is dropped at the lexer stage unless the grammar threads it manually.

## LSP fit: 2/5

Workable for compile-time error reporting. Rough for live editing because lexer errors are unrecoverable and there is no incremental reparse.

## Production users

- RustPython (Python 3.5+ interpreter)
- gluon (functional language)
- Solang (Solidity compiler)
- ~23k reverse deps on crates.io (build-time use)

## Workflow

```toml
# Cargo.toml
[build-dependencies]
lalrpop = "0.23"

[dependencies]
lalrpop-util = "0.23"
regex = "1"  # default lexer dep
```

```rust
// build.rs
fn main() {
    lalrpop::process_root().unwrap();
}
```

Grammar in `src/grammar.lalrpop`, included with `lalrpop_mod!(grammar)`.

```lalrpop
// src/grammar.lalrpop
grammar;

pub Pipe: Pipe = {
    <head:Op> <tail:(">" <Op>)*> => Pipe { head, tail },
};

Op: Op = {
    <name:Ident> "(" <args:Args?> ")" => Op { name, args: args.unwrap_or_default() },
};
```

## Integration cost for sprefa: medium

- `.lalrpop` grammar replaces `_8_parse.rs`. Build-time codegen.
- Custom lexer recommended (the default regex lexer is slow and poorly recoverable).
- IDE-grade recovery requires wrapping the lexer to swallow bad chars and emit an `ERROR` token, then catching `!` at every grammar level — verbose.
- AST shape free, but threading trivia for round-trip is manual.

## When to pick

- Grammar is stable, classical LR-shaped, and compile-error reporting is the dominant concern.
- Want fast generated parsers with no runtime grammar construction.
- LSP is secondary or absent.

## When to skip

- Need keystroke-grade error tolerance.
- Grammar is ambiguous or evolves week to week (LR(1) conflicts will block iteration).
- Want a lossless tree.

## Sources

- [lalrpop on crates.io](https://crates.io/crates/lalrpop) — fetched 2026-04-18
- [lalrpop book: error recovery](https://lalrpop.github.io/lalrpop/tutorial/008_error_recovery.html) — fetched 2026-04-18
- [lalrpop GitHub](https://github.com/lalrpop/lalrpop) — fetched 2026-04-18

## LSP / tree-sitter interop

### LSP scaffolding
- No first-party LSP example. lalrpop is a build-time LALR(1) parser generator; the LSP layer is unrelated.
- Notable consumers wire their own LSP: `gluon-lang/gluon` uses lalrpop and ships a `gluon_language-server` crate built on `tower-lsp`-era plumbing. `RustPython` parser used lalrpop historically (now hand-written).
- Error recovery is limited (single-token lookahead, `error` productions) which constrains LSP UX -- partial-input parses produce coarser diagnostics than chumsky/tree-sitter.

### tree-sitter import / export
- None. lalrpop grammars (`.lalrpop` files) are a bespoke EBNF-with-Rust-actions DSL, not portable to tree-sitter.
- Dual-maintain a tree-sitter grammar for editor highlighting.

### Highlighting story
- Build-time generated parser produces your AST; downstream highlighting is hand-rolled (TextMate grammar or paired tree-sitter grammar).
- No semantic-tokens helper; emit from your own walker.

### Paired tree-sitter grammar?
- None bundled. Some downstream projects (e.g., gluon) maintain a separate tree-sitter grammar.

### Sprefa-specific note
lalrpop's error-recovery weakness directly hurts LSP-on-partial-input UX. Combined with no tree-sitter alignment, this is the worst axis for sprefa's "one grammar everywhere" goal.
