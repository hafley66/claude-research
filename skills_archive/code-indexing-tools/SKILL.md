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
| JS/TS | `oxc_parser` (oxc.rs) | Fast parser, AST, linter, transformer, minifier, formatter (oxfmt beta Feb 2026) | AST only, no cross-file |
| Python | `ruff_python_parser` | Hand-written recursive descent, 2x faster than RustPython's | AST only |
| Python | `rustpython-parser` | LALRPOP-based | Parsing only, superseded by ruff's |
| Go | `gosyn` (`github.com/chikaku/gosyn`) | Experimental Go parser | Parsing only |
| Go | `tree-sitter-go` | tree-sitter grammar | Syntactic tags only |
| Kotlin | `tree-sitter-kotlin` | tree-sitter grammar | Syntactic tags only |

Pattern: pure-Rust semantic parsers exist for JS/TS (oxc) and Rust (ra_ap). Everything else falls to tree-sitter grammars for syntactic extraction plus custom scope resolution.

## OXC toolchain (oxc.rs) -- March 2026 state

VoidZero (Evan You) project. Arena-allocated AST, modular crates, zero GC overhead.

| Component | Status | Speed vs alternatives |
|---|---|---|
| `oxc_parser` | Stable | 3x faster than SWC, 5x faster than Biome (Biome parses CST not AST) |
| `oxlint` | v1.0 (Jun 2025), 650+ rules | 50-100x faster than ESLint, 2.5x faster than Biome |
| `oxc_transformer` | Stable | 4x faster than SWC, 40x faster than Babel |
| `oxc_minifier` | Stable | Ships as part of Rolldown pipeline |
| `oxfmt` | Beta (Feb 2026) | 3x faster than Biome, 35x faster than Prettier |
| Rolldown | 1.0 RC (Jan 2026) | OXC-powered bundler |

**Vite 8 (March 2026)**: Rolldown is the default bundler, OXC is the default transformer. Compatibility layer auto-converts esbuild/rollupOptions configs. Real-world: Linear prod builds went 46s → 6s.

### Node.js API surface (NAPI)

```js
import { transformSync } from 'oxc-transform';
const { code } = transformSync('file.ts', src, { typescript: { declaration: true } });
```

Packages: `oxc-parser`, `oxc-transform`, `oxc-minify`.

### Oxlint JS plugins (alpha March 2026)

- ESLint v9+ compatible plugin API -- most existing ESLint plugins run unmodified
- 4.8x speed advantage retained even with JS plugins active ("raw transfer" interop)
- NOT supported: custom file parsers (Vue/Svelte/Angular), type-aware lint rules

### OXC vs Biome

OXC produces an AST (JS/TS/JSX only), has ESLint v9-compatible plugin model, and owns the bundler story (Rolldown/Vite). Biome produces a CST (error-resilient), covers CSS/JSON/etc., is editor-first, uses a custom plugin model (not ESLint-compatible), and has no bundler. These are not direct competitors.

## Hybrid architecture (recommended for rename daemons)

1. **Own SQLite index** (sprefa's approach) for fast normalized string matching, cross-repo awareness, byte-span tracking
2. **Declarative rule engine** for structured files (JSON/YAML/TOML) -- CSS-style selectors with git context, file path, and structural position dimensions. Named captures, value regex splitting, grouped ref emit with parent linkage. Rules replace hard-coded Rust per file format.
3. **Consume SCIP indexes** when available for high-fidelity symbol resolution
4. **tree-sitter + lightweight scope resolution** for incremental updates when SCIP re-indexing is too slow
5. **oxc** for JS/TS AST when you need deeper-than-syntactic extraction without SCIP
6. **ast-grep** for code file pattern matching (planned, types exist in sprefa rule engine but engine not yet wired)
7. SCIP from rust-analyzer for Rust, rather than embedding ra_ap_ide

This gives: fast incremental updates (tree-sitter watches), accurate cross-file resolution (SCIP snapshots), declarative config-file extraction (rule engine), and a unified query layer (SQLite) across all languages and repos.

### sprefa rule engine status (as of 2026-03-24)

Core complete: types with schemars JSON Schema generation, depth-first tree walker with 8 step types (key, key_match, any, depth_min/max/eq, parent_key, array_item, leaf, object), emit with value regex and parent_key linkage, git context matching, file path matching. 49 tests. Pending: ast-grep integration, RuleExtractor trait impl, constraint/assertion system, pre-compiled rule optimization.
