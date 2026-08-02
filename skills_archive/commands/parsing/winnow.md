---
description: winnow — nom fork tuned for byte-oriented zero-copy parsing. Faster on most workloads, broader stdlib, unstable RecoverableParser trait. No incremental, no CST. Load when evaluating a combinator for a binary or text protocol.
---

# winnow

Parser combinator library; `nom` fork (started as `nom8`). Active, well-maintained.

## Crate

| Field | Value |
|---|---|
| crate | `winnow` |
| version | `1.0.1` (2026-03-30) |
| downloads | 508.7M total, 120.1M recent |
| MSRV | tracked; recent stable |

The most-downloaded combinator on crates.io; the de facto choice for new combinator-based work in 2026.

## Recovery model

Mostly absent in the stable API. The unstable `RecoverableParser` trait collects errors during a single parse pass, but it is gated and not yet ergonomic. Standard model is `Result<Output, ErrMode<E>>` with three modes:

- `ErrMode::Backtrack` — recoverable, alternation can retry.
- `ErrMode::Cut` — committed failure; no backtracking.
- `ErrMode::Incomplete` — streaming-only, more input needed.

```rust
use winnow::{Parser, Result, ascii::digit1, combinator::{alt, separated, delimited}};

fn pipe<'s>(input: &mut &'s str) -> Result<Vec<&'s str>> {
    separated(1.., op, ">").parse_next(input)
}
fn op<'s>(input: &mut &'s str) -> Result<&'s str> {
    let name = ident.parse_next(input)?;
    delimited("(", args, ")").parse_next(input)?;
    Ok(name)
}
```

`ContextError` accumulates `StrContext` labels along the failure path for human-readable error messages, but a failed parse still returns one error, not many.

## Incremental reparse

No.

## Lossless CST

No. Output is whatever the closures construct.

## LSP fit: 2/5

Same shape as nom — workable for tokenization and small expression languages, weak for IDE multi-error reporting.

## Differences vs nom

- Stateful streams via `Stateful<I, S>` for context-passing.
- `&mut Stream` mutation style instead of nom's `(Stream, Output)` return — fewer lifetimes in user code.
- Larger built-in combinator set; fewer external micro-crates needed.
- Avoids GATs (nom 8 uses them); easier to compile, slightly more flexible.
- Maintainer reports parity-or-better perf on most benches; "fastest" is a non-goal.

## Production users

- `toml_edit` / `toml` (the original driver of the fork)
- `gix-config` (gitoxide)
- `jiff` date parser
- many internal protocol parsers across crates.io

## Integration cost for sprefa: low

- Pure Rust, single crate.
- Can be folded into `_8_parse.rs` incrementally — combinators interleave with hand-rolled code freely.
- Diagnostics regress vs the current hand-rolled parser if it already collects multiple errors.

## When to pick

- Parser is mostly correctness-driven, not IDE-driven.
- Workload includes binary/streaming data alongside text.
- Want a stable 1.0 combinator with active maintenance.

## When to skip

- IDE multi-error parse is required and `RecoverableParser` is too unstable to depend on.
- Need lossless CST or incremental reparse.

## Sources

- [winnow on crates.io](https://crates.io/crates/winnow) — fetched 2026-04-18
- [winnow docs](https://docs.rs/winnow/latest/winnow/) — fetched 2026-04-18
- [winnow vs nom](https://docs.rs/winnow/latest/winnow/_topic/nom/index.html) — fetched 2026-04-18
- [Winnow 0.5 announce, epage](https://epage.github.io/blog/2023/07/winnow-0-5-the-fastest-rust-parser-combinator-library/) — fetched 2026-04-18

## LSP / tree-sitter interop

### LSP scaffolding
- No first-party LSP example. winnow is the actively maintained nom fork (epage); same posture: parse step only, LSP wiring BYO.
- Used inside `toml_edit` and `gix-config` parsers; not paired with an LSP template.
- Errors implement `ContextError` with stack-of-context labels, which translate to LSP `Diagnostic.relatedInformation` after manual mapping.

### tree-sitter import / export
- None.

### Highlighting story
- Same as nom: dual-maintain a tree-sitter grammar or TextMate file. Semantic tokens emitted manually from the AST after parse.

### Paired tree-sitter grammar?
- None.

### Sprefa-specific note
Same axis as nom: zero free editor reach. Pick winnow over nom for parser ergonomics, not for LSP/TS alignment.
