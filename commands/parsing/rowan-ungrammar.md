---
description: rowan + ungrammar — rust-analyzer's CST stack. Lossless red/green trees, errors as nodes, hand-written event-based parser. Tree model, not a parser generator. Load when evaluating "keep the parser hand-written but get a better tree".
---

# rowan-ungrammar

Two crates that together encode rust-analyzer's syntax layer. Neither is a parser; they are the substrate the parser writes into.

## Crates

| Crate | Version | Updated | Role |
|---|---|---|---|
| `rowan` | `0.16.1` | 2026-04-03 | Generic lossless CST: GreenNode (immutable, deduped), SyntaxNode (red, cursored). |
| `ungrammar` | `1.16.1` | 2022-03-05 | Tiny DSL for declaring node-kind shapes; codegen input only, not runtime. |
| `cstree` | (alt) | active | rowan-compatible fork with built-in `interner` and `Send + Sync` trees. |

`ungrammar` has not shipped a release since 2022 but is stable and still used by rust-analyzer's `xtask codegen`.

## Architecture

Green tree:
- Immutable, position-independent, hash-consed.
- A `GreenNode` is `(SyntaxKind, Vec<GreenElement>)` where children are `GreenNode | GreenToken`.
- Identical subtrees deduplicate, giving structural sharing across reparses.

Red tree:
- `SyntaxNode` wraps a `GreenNode` + parent pointer + offset.
- Cursors built on demand, dropped freely.
- `SyntaxNode::text_range()`, `.parent()`, `.children()`, `.descendants()` form the navigation API.

Errors:
- No separate diagnostic list at the tree level. The parser pushes a `SyntaxKind::ERROR` node whose children are the unrecognized tokens.
- Diagnostics are produced by the parser as a side channel and rendered against the tree's text ranges.

## Recovery model

`rowan` itself has none — recovery is whatever the hand-written parser does. The rust-analyzer parser uses an event-based design:

1. Lexer emits a flat token stream.
2. Recursive descent functions emit `Event::Start(kind)`, `Event::Token`, `Event::Finish`, `Event::Error(msg)`.
3. A separate pass replays events into a `GreenNodeBuilder` to construct the tree.

Recovery is panic-mode: on unexpected token, emit `Event::Error` plus an `ERROR` node wrapping the bad span, then resync at a known follow set (statement boundary, closing delimiter). Skipped tokens still appear under the `ERROR` node — nothing is lost.

```rust
// minimal rowan parser body (event-style)
fn parse_pipe(p: &mut Parser) {
    let m = p.start();
    parse_op(p);
    while p.at(T![>]) {
        p.bump(T![>]);
        if !p.at_op() {
            p.error("expected op after `>`");
            // wrap garbage in ERROR until next statement boundary
            let e = p.start();
            while !p.at(T![;]) && !p.at(EOF) { p.bump_any(); }
            e.complete(p, ERROR);
        } else {
            parse_op(p);
        }
    }
    m.complete(p, PIPE);
}
```

## Incremental reparse

Manual but feasible. rust-analyzer reparses only the affected block (function/item) and stitches the new green subtree into the old tree, exploiting structural sharing. There is no built-in `Tree::edit`-style API; the host writes the splice logic.

## Lossless CST

Yes. This is the entire point of the stack. Whitespace and comments are tokens, retained as children of their containing node.

## ungrammar workflow

```ungram
SourceFile = Stmt*
Stmt = Pipe | Fork | Comment
Pipe = Op ('>' Op)*
Op = name:Ident '(' Args? ')'
```

`xtask codegen` reads `*.ungram`, generates typed accessor traits over `SyntaxNode`:

```rust
impl Pipe {
    pub fn ops(&self) -> AstChildren<Op> { ... }
}
```

Pure codegen — no runtime dependency on `ungrammar` itself.

## LSP fit: 5/5 (with the parser cost)

rust-analyzer is the canonical IDE backend; rowan+hand-parser is its proof. The fit is excellent if the hand-written parser is in scope.

## Production users

- rust-analyzer
- Biome (forked rowan internally for JS/TS/CSS)
- Apollo router GraphQL parser
- Several Solidity / smart contract toolchains
- `cstree` is used by rune, slang (Solidity), and a few config languages

## Integration cost for sprefa: high

- Tree model is best-in-class but **the hand-written parser stays hand-written**. Replacing `_8_parse.rs` means rewriting it against a `GreenNodeBuilder`, not deleting it.
- Need a `SyntaxKind` enum + `Language` impl + per-node typed wrappers (or codegen via ungrammar).
- Requires writing recovery logic (panic-mode at known sync points).
- Payoff: lossless CST, structural sharing across reparses, the same substrate every Rust IDE tool already speaks.

## When to pick

- Hand-written parser is non-negotiable (precise control over recovery and error messages) but the AST model needs upgrade.
- Want round-trippable trees for refactor/rewrite ops.
- Long-term commitment to LSP-grade tooling.

## When to skip

- Want recovery for free (use tree-sitter or chumsky).
- Grammar small enough that a flat AST + Vec of diagnostics suffices.

## Sources

- [rowan on crates.io](https://crates.io/crates/rowan) — fetched 2026-04-18
- [rowan docs](https://docs.rs/rowan/0.16.1/rowan/) — fetched 2026-04-18
- [ungrammar on crates.io](https://crates.io/crates/ungrammar) — fetched 2026-04-18
- [rust-analyzer architecture](https://rust-analyzer.github.io/book/contributing/architecture.html) — fetched 2026-04-18
- [Easy Lossless Trees with Nom and Rowan, Kiran Shila](https://blog.kiranshila.com/post/easy_cst) — fetched 2026-04-18

## LSP / tree-sitter interop

### LSP scaffolding
- rowan is the lossless syntax-tree library extracted from rust-analyzer. The canonical LSP built on it is `rust-analyzer` itself, which is the reference implementation for production Rust LSPs.
- Other LSPs on rowan: `wgsl-analyzer`, `taplo` (TOML LSP), `nickel-lang`, `air` (R LSP), `move-analyzer`. The pattern is: hand-written parser emits rowan green/red trees -> semantic analysis layer -> `tower-lsp`/`lsp-server` driver.
- rowan trees are designed for incremental reparse and lossless round-trip (whitespace + comments preserved), which is the main LSP UX win.
- Error recovery is parser-defined; rust-analyzer's parser is the gold-standard reference for "keep parsing through garbage and produce a usable tree."

### tree-sitter import / export
- None. rowan is its own CST format. Dual-maintain a tree-sitter grammar for editor highlighting outside the LSP.
- ra has experimented with tree-sitter for syntax highlighting in some surfaces but the parser is hand-written.

### Highlighting story
- Inside the LSP: semantic tokens via tree walk classification (rust-analyzer's `syntax_highlighting` module is the reference).
- Outside the LSP: BYO tree-sitter grammar or TextMate.

### Paired tree-sitter grammar?
- None bundled. `tree-sitter-rust` exists separately and is maintained independently of rust-analyzer.

### Sprefa-specific note
rowan is the right shape for production LSP semantics (lossless CST, incremental, error-tolerant) but gives zero free editor highlighting outside the LSP. For sprefa's one-grammar-everywhere goal, rowan still forces a parallel tree-sitter grammar.
