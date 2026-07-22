---
description: peg (rust-peg) — PEG macro parser. Grammar inline in Rust via peg::parser! macro. No recovery, no incremental. Load when evaluating a small inline grammar with zero file/codegen overhead.
---

# peg

PEG parser generator delivered as a single `peg::parser!{}` macro. Grammar lives inline in `.rs` files; no `.peg` source file, no build script.

## Crate

| Field | Value |
|---|---|
| crate | `peg` |
| version | `0.8.5` (2025-03-02) |
| downloads | 24.9M total, 4.65M recent |

## Recovery model

None. Standard PEG: ordered choice + backtracking. On failure, the macro returns `Result<T, ParseError<L>>` where `ParseError` carries the position and the set of expected literals at that position.

```rust
peg::parser!{
  grammar sprf() for str {
    rule _() = quiet!{ [' ' | '\t' | '\n']* }
    rule ident() -> &'input str = $(['a'..='z' | 'A'..='Z' | '_']+)
    rule arg() -> &'input str = ident()
    rule op() -> Op = name:ident() "(" _ args:(arg() ** (_ "," _)) _ ")"
                       { Op { name: name.into(), args } }
    pub rule pipe() -> Vec<Op> = head:op() tail:(_ ">" _ o:op() { o })*
                                  { let mut v = vec![head]; v.extend(tail); v }
  }
}

let ops = sprf::pipe("a() > b(x, y) > c()")?;
```

`?` action body (`{? expr.parse().map_err(|_| "u32") }`) lets a rule fail with a custom expected-token label.

## Incremental reparse

No.

## Lossless CST

No.

## LSP fit: 1/5

Single-error abort. Suitable for batch parse, not for live editing.

## Production users

- Small DSL parsers and config languages.
- `pueue` task scheduler (filter syntax).
- Several `nom` alternatives in academic / hobby projects.
- Smaller footprint than `pest` because no separate grammar file.

## Integration cost for sprefa: very low

Drop the macro into `_8_parse.rs`. No build script, no derive, no extra crate beyond `peg`. Quickest swap on the table — but the diagnostic regression matches pest.

## When to pick

- Grammar small and stable; want zero ceremony.
- Batch CLI workflow; LSP errors are best-effort.

## When to skip

- Multi-error parse needed.
- Grammar has left recursion (PEG forbids; rewrite required).
- Need a navigable tree (output is what the action blocks build).

## Sources

- [peg on crates.io](https://crates.io/crates/peg) — fetched 2026-04-18
- [peg docs](https://docs.rs/peg/latest/peg/) — fetched 2026-04-18
