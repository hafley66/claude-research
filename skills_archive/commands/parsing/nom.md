---
description: nom — original Rust parser combinator. Mature, dominant in binary/protocol parsing. No recovery focus, no incremental, no CST. Load when surveying combinators or considering a binary parser.
---

# nom

Function-based parser combinator. Predates winnow; winnow forked from nom 7.

## Crate

| Field | Value |
|---|---|
| crate | `nom` |
| version | `8.0.0` (2025-01-26) |
| downloads | 484M total, 92M recent |

Stable, slow release cadence. v8 introduced GAT-based parser back-propagation (the `Parser` trait carries the output type as an associated type, letting the compiler specialize per use site).

## Recovery model

None. Three error modes:

- `Err::Error(E)` — recoverable, `alt` tries the next branch.
- `Err::Failure(E)` — committed, alternation does not retry.
- `Err::Incomplete(Needed)` — streaming-only.

Single-error parse. Custom error types via the `ParseError` trait; `VerboseError` aggregates context labels along the failure path.

```rust
use nom::{IResult, bytes::complete::tag, character::complete::alpha1, sequence::delimited};

fn op(input: &str) -> IResult<&str, &str> {
    let (input, name) = alpha1(input)?;
    let (input, _) = delimited(tag("("), args, tag(")"))(input)?;
    Ok((input, name))
}
```

## Incremental reparse

No.

## Lossless CST

No. Output is closure-defined; trivia is the parser author's problem.

## LSP fit: 2/5

Same as winnow. Single-error abort, no recovery primitives.

## Production users

- Binary/network protocol parsers across the ecosystem (DNS, HTTP/2, BGP, image formats, archive formats).
- Many crates pre-2023; new work tends to land in winnow.
- Notable: `pdf-rs`, `der-parser`, `wasmparser` (historical), ICU collation, `weezl`, `flatbuffers-rs`.

## Differences vs winnow

- nom retains `(Stream, Output)` return style — more explicit lifetime ceremony.
- nom uses GATs in v8; compile times slightly higher, certain advanced parsers ergonomically nicer.
- Smaller stdlib; combinators frequently pulled from `nom_locate`, `nom-supreme`, etc.
- Cadence: winnow ships often, nom ships rarely.

## Integration cost for sprefa: low

Same shape as winnow. Choose nom over winnow only if a transitive dep already pulls nom and dedup matters.

## When to pick

- Binary parser, especially one with an existing nom-based reference.
- Already have nom in the dep graph.

## When to skip

- IDE / multi-error / recovery is needed.
- Starting fresh — winnow is the strictly newer choice with broader builtins.

## Sources

- [nom on crates.io](https://crates.io/crates/nom) — fetched 2026-04-18
- [nom 8 docs](https://docs.rs/nom/latest/nom/) — fetched 2026-04-18

## LSP / tree-sitter interop

### LSP scaffolding
- No first-party LSP example. nom is a byte/streaming parser combinator library; LSP wiring is fully BYO.
- Community LSPs that use nom internally exist for small DSLs (TOML-likes, config formats) but typically only for the parse step; the LSP plumbing is hand-written on `tower-lsp`/`lsp-server` (gluon) crates.
- nom's error types (`VerboseError`, `nom_locate`) map to LSP `Diagnostic` after manual translation. There is no built-in span/label richness comparable to chumsky `Rich`.

### tree-sitter import / export
- None. nom and tree-sitter are unrelated. Dual-maintain a tree-sitter grammar if you want highlighting outside the LSP.

### Highlighting story
- Hand-rolled. Either ship a tree-sitter grammar separately, write a TextMate grammar, or emit semantic tokens manually from a nom-produced AST.
- Span tracking requires `nom_locate::LocatedSpan`; raw `&str` parsers lose offsets.

### Paired tree-sitter grammar?
- None.

### Sprefa-specific note
nom gives sprefa nothing for editor ecosystem reach. Strong fit for binary/streaming DSLs, weak fit for "one grammar for parser + ast-grep + helix + zed."
