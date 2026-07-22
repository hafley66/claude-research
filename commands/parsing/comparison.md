---
description: Decision matrix for Rust parsing libraries from a sprefa-v2 viewpoint. Columns cover recovery, incremental, CST, LSP fit, maturity, integration cost, grammar style. Top-3 recommendations at the bottom.
---

# comparison

Cross-cut of the per-library files. Use as the entry point; drill into individual files for code, sources, and version pins.

## Matrix

| Library | Recovery | Incremental | Lossless CST | LSP fit | LSP+TS bonus | Maturity | Integration cost | Grammar style |
|---|---|---|---|---|---|---|---|---|
| tree-sitter   | automatic, ERROR + MISSING nodes | yes (Tree::edit) | yes | 5 | 5 | 0.26, very stable, huge ecosystem | medium (C build, JS grammar) | declarative `grammar.js` + codegen |
| chumsky       | opt-in, 4 strategies              | no               | no  | 4 | 2 | 1.0-alpha.8, active on Codeberg  | low–medium                    | combinator (Rust expressions) |
| rowan + ungrammar | hand-written; framework only | manual splice    | yes | 5 (with parser) | 3 | rust-analyzer's substrate, very stable | high (parser stays hand-written) | tree model + ungram codegen |
| lezer         | automatic                         | yes              | yes | 5 (in JS) | n/a | mature              | not Rust-reachable            | declarative `.grammar` |
| lalrpop       | panic-mode `!` token, parser-only | no               | no  | 2 | 1 | 0.23, very stable, slow cadence  | medium                        | declarative `.lalrpop` + codegen |
| pest          | none                              | no               | no  | 2 | 2 | 2.8, very stable, huge install base | low                       | declarative `.pest` + derive |
| winnow        | unstable `RecoverableParser`      | no               | no  | 2 | 1 | 1.0.1, active, top downloads     | low                           | combinator (Rust functions) |
| nom           | none                              | no               | no  | 2 | 1 | 8.0, mature, slow cadence        | low                           | combinator (Rust functions) |
| peg           | none                              | no               | no  | 1 | 1 | 0.8, stable, niche               | very low                      | combinator macro (inline DSL) |

## Axes that actually matter for sprefa

1. **IDE-grade error tolerance.** Sprefa is a query language served over LSP. Single-error abort is a regression on the hand-rolled parser if it already collects multiple diagnostics per parse. This eliminates pest, peg, nom, lalrpop without custom wrapping, and leaves winnow only via the unstable trait.

2. **Incremental reparse.** Bulk-parse over 500 repos plus per-keystroke LSP reparse on the active document. tree-sitter is the only entry that gives this for free; rowan gives a substrate but the splice logic is the host's problem.

3. **Lossless tree.** Required if rename/refactor ops will round-trip the source. tree-sitter and rowan only.

4. **Pure-Rust toolchain.** Only chumsky, rowan, winnow, nom, peg, lalrpop, pest stay inside Cargo. tree-sitter brings a C runtime and a JS grammar source.

5. **Op-owned diagnostics fit.** All libraries can host op-emitted diagnostics; the question is whether they pre-aggregate parse errors into the same sink. tree-sitter (errors-as-nodes) and chumsky (`Vec<Rich>`) drop in cleanly.

## Top 3 picks for sprefa v2

### 1. tree-sitter

Best overall fit. Buys IDE-grade recovery, incremental reparse, and lossless CST in one move. Costs a C build dep and a `grammar.js` source file. Pays back in editor ecosystem reach (Helix/Neovim plugins for `.sprf` come almost free) and removes the need to author recovery logic.

Use when the goal is "delete the hand-written parser and never write recovery again". The `_8_parse.rs` rewrite is largely a tree-walker over `Node`s mapped to existing AST shapes.

### 2. rowan (+ ungrammar codegen)

Pick if the hand-written parser is load-bearing for reasons outside grammar (precise error messages, custom recovery, in-flight token rewriting for macros). Replace the AST with a green/red tree, gain lossless CST and structural sharing across reparses, keep full control over the parse loop. This is the rust-analyzer playbook.

Cost: medium-to-high one-time rewrite of the parser body to push events to a `GreenNodeBuilder` and to define `SyntaxKind`. Payoff: same substrate every modern Rust IDE tool already speaks.

### 3. chumsky

Pick if pure-Rust + multi-error recovery is the priority and incremental reparse can be deferred. Smallest delta from the current `_8_parse.rs`: combinators replace recursive-descent functions, recovery is added with `recover_with(nested_delimiters(...))` at every brace/paren site. Pin a v1 alpha version explicitly; track Codeberg releases.

Use when the team wants to stay inside Cargo, ship multi-error parse next quarter, and revisit incremental later.

## Decision flow

```
Need keystroke incremental reparse?
├── yes → tree-sitter
└── no  → Need lossless CST?
         ├── yes → rowan (hand-write parser) or tree-sitter (no incremental needed but still gets it)
         └── no  → Need multi-error parse?
                  ├── yes → chumsky
                  └── no  → winnow (combinator) or pest (declarative) or peg (inline)
```

## Cross-references

- `tree-sitter.md`, `chumsky.md`, `rowan-ungrammar.md` for the top 3 in depth.
- `lezer.md` for the IDE-parser design lineage; not Rust-reachable.
- `lalrpop.md`, `pest.md`, `winnow.md`, `nom.md`, `peg.md` for the runners-up.

## LSP+TS bonus rubric

Score = (a) LSP scaffolding maturity + (b) has-or-pairs-with tree-sitter grammar + (c) editor ecosystem already groks output. Each subscore 0-2, summed and clamped to 1-5.

| Library     | (a) LSP scaffolding              | (b) tree-sitter pair       | (c) editor reach       | LSP+TS bonus |
|-------------|----------------------------------|----------------------------|------------------------|--------------|
| tree-sitter | strong (helix/zed/ast-grep/ra-style examples) | IS the format         | universal              | 5            |
| rowan       | strong (rust-analyzer reference) | none, dual-maintain        | LSP only               | 3            |
| oxc         | strong (oxc_language_server)     | none (JS/TS upstream)      | LSP + existing TS-TM   | 3            |
| chumsky     | medium (nano_rust + tower-lsp)   | none, dual-maintain        | LSP only               | 2            |
| pest        | medium (pest-ide-tools for grammars) | none                   | LSP only               | 2            |
| logos       | weak alone, common as lexer layer | none                      | LSP semantic tokens    | 2            |
| lalrpop     | weak (gluon precedent)           | none                       | LSP only               | 1            |
| nom         | weak, BYO                        | none                       | LSP only               | 1            |
| winnow      | weak, BYO                        | none                       | LSP only               | 1            |
| combine     | weak, BYO                        | none                       | LSP only               | 1            |

### Sprefa framing
sprefa already runs ast-grep (tree-sitter under the hood) and ships an LSP crate. A parsing library that lets one grammar serve sprefa's parser AND ast-grep/helix/zed simultaneously is the structural win. Only **tree-sitter** scores 5 on this axis. **rowan** and **oxc** score 3 because they have production LSP precedent but force a parallel tree-sitter grammar for editor reach. Everything else is 1-2 and forces dual-maintenance for any editor-ecosystem reach.
