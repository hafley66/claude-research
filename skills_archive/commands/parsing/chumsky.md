---
description: chumsky — Rust parser combinator with explicit recovery strategies (nested_delimiters, skip_then_retry_until, via_parser). Pairs with ariadne for diagnostics. Load when considering a pure-Rust combinator with IDE-grade error tolerance.
---

# chumsky

Recursive descent parser combinator; recovery is opt-in per parser via `recover_with()`.

## Crate

| Field | Value |
|---|---|
| crate | `chumsky` |
| stable | `0.12.0` |
| latest | `1.0.0-alpha.8` (2025-12-15) |
| downloads | 16.4M total, 6.77M recent |
| companion | `ariadne` 0.6.0 (diagnostics renderer, by same author) |
| repo | moved from GitHub to codeberg.org/zesterer/chumsky 2026-04 |

GitHub mirror was archived 2026-04-02; active development continues on Codeberg. Latest merge there 2026-04-15. v1 is alpha but is what the docs and ecosystem now target.

## Recovery model

`chumsky::recovery` exposes four strategies, each returned from a function and passed to `Parser::recover_with`:

| Strategy | Behavior |
|---|---|
| `nested_delimiters(open, close, [(o,c)…], fallback)` | Skip until matching close, respecting nesting; emit fallback AST node for the bad span. The bracket-balancing primitive. |
| `skip_until(end_pattern, fallback)` | Skip tokens until one of the given patterns; emit fallback. |
| `skip_then_retry_until(skip, retry)` | Skip until `retry` matches, then try the parser again. |
| `via_parser(p)` | Run a custom parser as the recovery path. |

```rust
use chumsky::prelude::*;
use chumsky::recovery::{nested_delimiters, skip_then_retry_until};

let expr = recursive(|expr| {
    let atom = ident()
        .or(expr.clone()
            .delimited_by(just('('), just(')'))
            .recover_with(nested_delimiters(
                '(', ')', [('[', ']'), ('{', '}')],
                |span| Expr::Error(span),
            )));
    atom.then_ignore(just(';'))
        .recover_with(skip_then_retry_until(any().ignored(), just(';').ignored()))
});
```

Recovered spans land as `Expr::Error(span)` in the AST and an error in the `Vec<Rich<_>>` returned alongside the partial parse — both are first-class outputs.

## Incremental reparse

No. Full reparse on every input. Combine with a debounce or coarse buffer-level dirty bit at the LSP layer.

## Lossless CST

No. The combinator returns whatever AST the closures construct; preserving trivia (whitespace/comments) requires the grammar author to thread it through manually or use a separate token-level pass. Not the model's strength.

## LSP fit: 4/5

Multi-error parse and partial AST are exactly what LSP needs; lack of incremental reparse is the only deduction. Pairs with `ariadne` for terminal-grade diagnostic rendering and exposes spans compatible with LSP `Range` after a column conversion.

## Production users

- Gleam compiler (lexer + parser, multi-error)
- Tao (toy ML language by chumsky's author)
- Stainless (Rust contract verifier, parser layer)
- Several smaller DSLs and config languages on lib.rs

## Integration cost for sprefa: low–medium

- Pure Rust, single crate, no codegen step — drops into `v2/src/_8_parse.rs` as a replacement.
- Grammar lives as Rust expressions; refactors are `cargo check`-driven.
- Existing op-owned diagnostic model maps cleanly onto chumsky's `Vec<Rich<Token, Span>>` output.
- v1-alpha churn risk: API has shifted between alpha tags; pinning is required.
- No incremental reparse means LSP must throttle reparse on its own.

## When to pick

- Want pure-Rust, no C, no codegen.
- Need recoverable errors from day one without writing recovery yourself.
- Comfortable pinning a v1 alpha and tracking releases manually.

## When to skip

- Need keystroke-grade incremental parsing.
- Want a stable 1.0 contract right now (use 0.12 or wait).
- Grammar is large enough that runtime construction cost matters (chumsky parsers build at runtime, not compile time).

## Sources

- [chumsky on crates.io](https://crates.io/crates/chumsky) — fetched 2026-04-18
- [chumsky::recovery docs](https://docs.rs/chumsky/1.0.0-alpha.8/chumsky/recovery/index.html) — fetched 2026-04-18
- [chumsky on Codeberg](https://codeberg.org/zesterer/chumsky) — fetched 2026-04-18
- [ariadne on crates.io](https://crates.io/crates/ariadne) — fetched 2026-04-18

## LSP / tree-sitter interop

### LSP scaffolding
- Canonical example is `examples/nano_rust.rs` in the chumsky repo, which pairs chumsky with `tower-lsp` to ship a complete toy LSP (diagnostics from parser errors, hover, goto-def).
- `tower-lsp` (and its newer fork `tower-lsp-server`) is the de-facto LSP framework when pairing with chumsky. The chumsky `Rich`/`Simple` error type maps directly to LSP `Diagnostic` with span, label, and notes.
- The `ariadne` crate (same author, zesterer) is the partner reporter; ariadne spans round-trip cleanly to LSP ranges via a `Source` wrapper.
- Community LSPs built on chumsky: `nrs-language-server`, `tinymist` (Typst LSP, partly chumsky-flavored ideas), several teaching repos.

### tree-sitter import / export
- No first-party tree-sitter integration. chumsky is a hand-written combinator parser; you would dual-maintain a `tree-sitter-<lang>` grammar separately if you want editor highlighting outside the LSP.
- chumsky's output is your own AST type; it does not produce a CST, so feeding chumsky-parsed trees into tree-sitter consumers requires a custom translation layer (rare in practice).

### Highlighting story
- Inside the LSP: semantic tokens via `tower-lsp`. chumsky's `Spanned<T>` gives you the byte ranges; classify token kinds during a post-parse walk.
- Outside the LSP: ship a hand-written TextMate grammar or a paired tree-sitter grammar. No generator from chumsky exists.
- For diagnostics-quality squiggles, chumsky's `Rich` errors with labels are the primary highlighting payoff.

### Paired tree-sitter grammar?
- None bundled. Editor-ecosystem coverage (helix/zed/neovim) is BYO grammar.

### Sprefa-specific note
chumsky gives sprefa a strong LSP error story (rich diagnostics with multi-span labels) but zero free editor highlighting. To ship one grammar usable by both the parser AND ast-grep/helix/zed, chumsky is the wrong axis -- it forces a parallel tree-sitter grammar.
