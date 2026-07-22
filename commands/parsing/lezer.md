---
description: lezer — CodeMirror's incremental LR with recovery. JS-only runtime. Cross-reference for tree-sitter's design lineage; not Rust-reachable. Load when comparing IDE parser architectures.
---

# lezer

Incremental LR(1)+GLR parser system for CodeMirror 6. JavaScript runtime only.

## Status for Rust

Not Rust-reachable. The runtime (`@lezer/lr`, `@lezer/common`) is JS; the generator (`@lezer/generator`) is JS. No Rust port or binding exists as of 2026-04. Listed here only as the design cousin of tree-sitter so the comparison matrix is complete.

## Architecture summary

- LR core with GLR fallback for ambiguity (similar to tree-sitter).
- Built-in error recovery: on parse error, the parser inserts a synthetic node and resumes; the resulting tree contains `error` nodes spanning the bad region.
- Incremental reparse with structural sharing of tree nodes.
- Compact tree representation tuned for editor memory (small int IDs, packed buffers).
- Three packages: `@lezer/generator` (offline parse table builder), `@lezer/lr` (runtime), `@lezer/common` (Tree primitives).

Grammar source is a `.grammar` file; generator emits a JS module exporting a parse table.

## Why it's listed

- Tree-sitter's design lineage influenced lezer; lezer's design fed back into tree-sitter incremental work. Reading lezer's recovery docs is useful background when tuning a tree-sitter grammar.
- If sprefa ever ships a browser playground (CodeMirror-based editor for `.sprf`), lezer is the only realistic in-browser parser, and the grammar would have to be ported (lezer grammar is not tree-sitter-compatible).

## Recommendation

Skip for the Rust pipeline. Revisit only if a web playground becomes a deliverable.

## Sources

- [lezer guide](https://lezer.codemirror.net/docs/guide/) — fetched 2026-04-18
- [CodeMirror 6](https://codemirror.net/) — reference
