---
name: code-indexing-tools
description: Landscape of code indexing, symbol resolution, and reference-tracking tools usable from Rust -- SCIP, ctags, tree-sitter tags, ra_ap_ide, per-language parsers
license: MIT
compatibility: opencode
metadata:
  source: web research, crate docs
  depth: intermediate
---
## What I do
- Map the ecosystem of code intelligence tools available as libraries from Rust
- Compare SCIP, LSIF, ctags, tree-sitter tags, and language-specific semantic libraries
- Guide architecture decisions for building rename/refactoring daemons and code indexers

## When to use me
Use when building code intelligence tooling, rename-refactoring systems, cross-repo reference tracking, or evaluating how to get symbol/reference data from source code into a queryable format.

## SCIP (Sourcegraph Code Intelligence Protocol)

The current standard for code intelligence interchange. Protobuf-based format storing symbol definitions, references, hover docs, and relationships.

### Key properties
- Human-readable string symbol IDs (unlike LSIF's opaque numeric graph IDs)
- Protobuf encoding -- compact, fast to parse
- Supersedes LSIF (deprecated by Sourcegraph)
- `scip` CLI converts between SCIP and LSIF

### Rust crate
```toml
[dependencies]
scip = "0.6"  # crates.io, generated from scip.proto
```

Read/write SCIP index files directly from Rust. Types generated from `scip.proto`.

### Available SCIP indexers

| Language | Indexer | Notes |
|---|---|---|
| Rust | rust-analyzer | `rust-analyzer scip .` emits SCIP directly |
| TypeScript/JS | scip-typescript | |
| Java/Scala/Kotlin | scip-java | Uses SemanticDB internally |
| Python | scip-python | |
| C/C++ | scip-clang | |
| Go | scip-go | |
| Ruby | scip-ruby | |
| C#/VB | scip-dotnet | |
| Dart, PHP | community indexers | |

### Architecture for a rename daemon
Run SCIP indexer per repo, consume index via `scip` crate, get complete symbol-to-reference map. Rename = lookup symbol ID, collect all occurrences, emit byte edits.

**Limitation**: SCIP indexes are point-in-time snapshots. Incremental re-indexing on file change requires re-running the indexer (or diffing).

### Links
- Repo: `github.com/sourcegraph/scip`
- Spec: `github.com/sourcegraph/scip/blob/main/scip.proto`
- Crate: `crates.io/crates/scip`

## LSIF (Language Server Index Format)

SCIP's predecessor. JSON graph with opaque numeric vertex/edge IDs. Harder to work with, 10-20% larger output than SCIP. Deprecated by Sourcegraph in favor of SCIP. GitLab still consumes LSIF natively. The `scip` CLI can convert SCIP to LSIF for GitLab compatibility.

Not recommended for new work.

## ctags (Universal-ctags)

### What it does
- 173 built-in parsers
- Extracts **definitions only** (functions, classes, structs, variables, macros, modules)
- No references, no scope resolution, no type information
- Purely syntactic

### API situation
- **No library API**. Issue #63 (make ctags a library) closed 2019 with no public C API.
- Subprocess-only from Rust. `run-ctags` crate is a thin subprocess wrapper.
- `libreadtags` (`github.com/universal-ctags/libreadtags`) is a C library for reading tags files after ctags generates them. Embeddable via FFI.

### Verdict
Insufficient for rename refactoring. Definitions only, no references, no cross-file resolution.

## tree-sitter tags

tree-sitter is a parser generator, not a code intelligence engine. But `tags.scm` query files provide syntactic symbol extraction.

### How tags.scm works
Grammar authors write query patterns using tree-sitter's query language:
```scheme
;; tags.scm for JavaScript
(function_declaration
  name: (identifier) @name) @definition.function

(call_expression
  function: (identifier) @name) @reference.call
```

Captures use `@definition.{kind}` and `@reference.{kind}`:
- Kinds: `function`, `method`, `class`, `module`, `interface`, `call`, `implementation`
- Output: entity name, role (definition/reference), file position, source line

### What it lacks
- No scope resolution
- No type information
- No cross-file awareness
- A `@reference.call` capture matches syntactic call sites but does not resolve which definition a reference points to

### What it gives
- Fast incremental reparsing when files change (tree-sitter's core strength)
- Structural context ("this is a function call" vs "this is a variable definition")
- Language grammar crates on crates.io: `tree-sitter-javascript`, `tree-sitter-go`, `tree-sitter-python`, `tree-sitter-rust`, `tree-sitter-kotlin`, etc.

### Verdict
Good foundation for fast syntactic pre-filtering. Build your own scope resolution and cross-file reference graph on top.

## ra_ap_ide (rust-analyzer as a library)

Full Rust semantic analysis without an LSP server.

### Key APIs
```rust
use ra_ap_ide::{AnalysisHost, Analysis, FileId, TextRange};

// AnalysisHost - mutable, accepts file changes via apply_change
// Analysis - immutable snapshot, main query entry point

let refs = analysis.find_all_refs(config)?;    // find references
let edits = analysis.rename(config)?;           // compute rename edits
let targets = analysis.goto_definition(config)?; // go to definition
```

Returns `ReferenceSearchResult`, `NavigationTarget`, etc.

### Tradeoffs
- Pulls in rust-analyzer's full semantic model (name resolution, type inference, trait solving)
- Heavy compile times
- Only works for Rust source code
- Published to crates.io as `ra_ap_ide`, `ra_ap_hir`, `ra_ap_syntax`, `ra_ap_vfs`

### Verdict
Maximum fidelity for Rust. Overkill to embed if you just need reference tracking. Consider consuming SCIP output from `rust-analyzer scip .` instead of linking ra_ap_ide directly.

## Pure-Rust parsers by language

| Language | Crate | Scope | Rename/refs? |
|---|---|---|---|
| Rust | `ra_ap_ide` | Full semantic analysis | Yes (rename, find refs) |
| Rust | `syn` | Proc-macro oriented parser | No, parsing only |
| JS/TS | `oxc_parser` (oxc.rs) | Fast parser, AST, linter | AST only, no cross-file |
| Python | `ruff_python_parser` | Hand-written recursive descent, 2x faster than RustPython's | AST only |
| Python | `rustpython-parser` | LALRPOP-based | Parsing only, superseded by ruff's |
| Go | `gosyn` (`github.com/chikaku/gosyn`) | Experimental Go parser | Parsing only |
| Go | `tree-sitter-go` | tree-sitter grammar | Syntactic tags only |
| Kotlin | `tree-sitter-kotlin` | tree-sitter grammar | Syntactic tags only |

Pattern: pure-Rust semantic parsers exist for JS/TS (oxc) and Rust (ra_ap). Everything else falls to tree-sitter grammars for syntactic extraction plus custom scope resolution.

## Hybrid architecture (recommended for rename daemons)

1. **Own SQLite index** (sprefa's approach) for fast normalized string matching, cross-repo awareness, byte-span tracking
2. **Consume SCIP indexes** when available for high-fidelity symbol resolution
3. **tree-sitter + lightweight scope resolution** for incremental updates when SCIP re-indexing is too slow
4. **oxc** for JS/TS AST when you need deeper-than-syntactic extraction without SCIP
5. SCIP from rust-analyzer for Rust, rather than embedding ra_ap_ide

This gives: fast incremental updates (tree-sitter watches), accurate cross-file resolution (SCIP snapshots), and a unified query layer (SQLite) across all languages and repos.
