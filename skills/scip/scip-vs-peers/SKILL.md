---
name: scip-vs-peers
description: SCIP vs LSIF (why it was abandoned), vs LSP (indexing-time vs query-time), vs Kythe (Google's approach), vs ctags/universal-ctags. When to use each.
type: reference
metadata:
  source: https://sourcegraph.com/blog/announcing-scip
  depth: intermediate
---

# SCIP vs Peer Systems

## SCIP vs LSIF

### What LSIF Was

LSIF (Language Server Index Format) was Microsoft's attempt to serialize LSP responses into a static file. It modeled code intelligence as a graph of JSON objects:

- **Vertices**: documents, ranges, result sets, monikers, hover results, definition results, reference results
- **Edges**: directed relationships between vertices
- **IDs**: opaque incrementing integers used as edge targets

The core idea: run a language server, capture the responses to LSP queries, write them out as a graph. An LSP consumer becomes an LSIF producer.

### Why LSIF Was Abandoned

Sourcegraph removed LSIF support in version 4.6. Their documented reasons:

**Graph encoding with opaque IDs**:
- IDs are global, monotonically incrementing integers with no semantic meaning
- Connecting edges requires these IDs to be established before the edge is written, imposing strict ordering constraints on emission
- Cyclic dependencies require complex bookkeeping to avoid forward-reference problems
- Globally incrementing IDs make partial index updates (touching only some documents) structurally difficult — you cannot merge two LSIF files without renumbering IDs

**Moniker complexity**:
- The "import moniker" and "export moniker" mechanism for cross-package symbols was under-specified and silently broke navigation if implemented incorrectly
- `resultSet` and monikers were distinct vertex types requiring triple bookkeeping per definition

**Size**:
- Uncompressed: ~5x larger than SCIP
- gzip-compressed: ~4x larger than SCIP
- JSON vs. protobuf explains most of the gap; the graph structure (repeated ID references) contributes the rest

**Performance**:
- Sourcegraph reported a 10x CI speedup replacing `lsif-node` with `scip-typescript` for the same TypeScript codebase

**Developer experience**:
- Debugging LSIF required tracing numeric IDs through a flat JSON stream
- Snapshot testing was described as "painful" with LSIF payloads; SCIP's human-readable symbol strings make snapshot diffs legible

### What SCIP Changed

SCIP replaces the graph encoding with a flat document-centric model:

| LSIF concept       | SCIP equivalent |
|--------------------|-----------------|
| Document vertex    | `Document` message |
| Range vertex       | `Occurrence.range` field |
| ResultSet vertex   | (eliminated) |
| DefinitionResult   | `Occurrence.symbol_roles & Definition` |
| ReferenceResult    | all occurrences sharing the same `symbol` string |
| Import moniker     | global symbol string (human-readable) |
| Export moniker     | same global symbol string |
| HoverResult        | `SymbolInformation.documentation` |
| Integer IDs        | (eliminated) |

The core insight: symbol strings are stable, human-readable, and globally unique without requiring an ID registry. Finding all references to a symbol is a string equality scan, not a graph traversal.

### What LSIF Cannot Express That SCIP Can

- `signature_documentation`: a structured signature field separate from hover docs
- `SymbolInformation.kind`: fine-grained semantic classification (87 values)
- `enclosing_range`: function body range attached to occurrences
- `ForwardDefinition` role: C/C++ forward declarations

### Migration

Sourcegraph 4.5 → 4.6 dropped LSIF read support entirely. A migration guide (`sourcegraph.com/docs/admin/how-to/lsif-scip-migration`) covers converting historical LSIF data.

---

## SCIP vs LSP

### LSP's Model

LSP (Language Server Protocol) is designed for real-time editor integration. It runs a language server as a live process and issues queries:

```
editor → textDocument/definition (cursor position) → language server → range
editor → textDocument/references (cursor position) → language server → []range
```

Every query is answered on demand by the running server. Results are not persisted.

### Fundamental Tradeoff

| Dimension          | LSP                              | SCIP                              |
|--------------------|----------------------------------|-----------------------------------|
| When computed      | Query-time (per request)         | Index-time (batch, offline)       |
| Persistence        | None (ephemeral responses)       | Full (index.scip file)            |
| Latency            | Low (cached in server state)     | Zero (pre-indexed)                |
| Coverage           | Open files only (typically)      | Entire repo + dependencies        |
| Cross-repo         | Requires live server per repo    | Declarative via symbol strings    |
| CPU cost per query | Low (re-uses analysis state)     | Zero (scan pre-built index)       |
| Setup              | Install language server          | Run indexer, upload SCIP          |
| Stale risk         | Always current                   | Stale until re-indexed            |
| Scale limit        | Single machine memory            | File size only                    |

### Where LSP Beats SCIP

- **Real-time**: LSP sees the file as-you-type; SCIP is always a snapshot of a past commit
- **Completions**: LSP provides autocomplete; SCIP has no concept of it
- **Type hover on expressions**: LSP resolves types at arbitrary expressions; SCIP only records what the indexer chose to emit
- **Diagnostics**: LSP runs the compiler live; SCIP diagnostics are optional and emitted at index time

### Where SCIP Beats LSP

- **Cross-repo at scale**: LSP requires a live server per repo; SCIP indexes from multiple repos are merged server-side
- **Search integration**: SCIP symbol strings enable exact-match "find all references across all indexed repos"
- **No running process**: SCIP consumers are stateless readers
- **Reproducibility**: SCIP indexes are deterministic snapshots tied to a commit

### Claude Code Context (December 2025)

Anthropic shipped native LSP support in Claude Code (go-to-definition, find-references, hover for 11 languages). This is runtime LSP, not SCIP. SCIP adoption in AI tooling remains sparse as of early 2026.

---

## SCIP vs Kythe

### Kythe's Architecture

Kythe (originally "Grok", developed at Google, open-sourced 2014) uses a property graph model.

**VName**: Every entity has a 5-tuple identifier:
```
VName = {
  signature: string,  // opaque; unique per (corpus, root, path, language)
  corpus:    string,  // collection of related files, e.g. a repository
  root:      string,  // subtree within corpus
  path:      string,  // relative path of the containing file
  language:  string,  // e.g. "go", "java"
}
```

**Nodes**: every entity (file, anchor, function, variable, type) is a node identified by its VName plus a bag of facts (key-value properties).

**Anchors**: source locations are first-class nodes. An anchor has a VName and facts like `/kythe/loc/start` and `/kythe/loc/end`. All references point to anchors, not raw ranges.

**Edges**: directed, labeled relationships between nodes. Forward edges are emitted; the Kythe pipeline generates reverse edges automatically. Edge labels follow a schema, e.g., `/kythe/edge/ref`, `/kythe/edge/defines`, `/kythe/edge/typed`, `/kythe/edge/childof`.

**Storage**: Kythe's data is stored in a distributed key-value store (BigTable at Google). The open-source tooling supports LevelDB. Queries are graph traversals.

### Key Differences

| Dimension               | Kythe                                 | SCIP                              |
|-------------------------|---------------------------------------|-----------------------------------|
| Data model              | Property graph                        | Flat document + occurrence list   |
| Entity ID               | 5-tuple VName (structured, opaque)    | Symbol string (grammar-defined)   |
| Cross-references        | Edge traversal in graph               | String equality scan              |
| Schema extensibility    | Liberal: add node/edge types freely   | Schema-controlled (add to .proto) |
| Query interface         | Graph query API (Serving API)         | Scan + filter on flat index       |
| Storage                 | Distributed KV store (production)     | Single protobuf file              |
| Index build pipeline    | Extractor + analyzer + pipeline tools | Single indexer binary per lang    |
| Build tool integration  | Deep (Bazel, extraction phase)        | Shallow (run indexer after build) |
| Complexity              | High (multiple pipeline stages)       | Low-moderate                      |
| Google-internal scale   | Entire Google monorepo                | Repository-scale                  |

### Kythe's Strengths vs. SCIP

- **Richer semantic graph**: Kythe can express type relationships, macro expansions, generated code lineage, and call graphs in the same graph — these require the extender to add new edge types without schema approval
- **Build-integrated extraction**: Kythe's "extractor" hooks into the compiler directly (compiler plugins, Bazel aspects), providing higher fidelity for complex build systems
- **Cross-language links**: Kythe can link a Java interface implementation to its C++ counterpart via shared edges — SCIP has no equivalent cross-language relationship
- **Google monorepo scale**: Kythe runs on the entire Google codebase; SCIP's tested scale is large-but-not-Google

### Kythe's Weaknesses vs. SCIP

- **Operational complexity**: Running Kythe requires the extraction pipeline, analysis phase, serving binary, and distributed storage. SCIP is a single binary + protobuf file.
- **Opaque signatures**: VName signatures are generated by the analyzer and not human-readable. Debugging requires tooling. SCIP symbols are legible in a text editor.
- **Developer ecosystem**: Kythe has few third-party indexers. SCIP has 10+ actively maintained indexers from Sourcegraph.
- **Incremental updates**: Kythe's graph store handles updates more naturally; SCIP re-indexes wholesale.

### When to Use Kythe

- You are at Google-scale and need graph query semantics
- You need cross-language semantic edges (e.g., proto definition to generated Java/Python/C++ code)
- You have Bazel build infrastructure and can afford the extraction pipeline
- You need richer semantic subgraphs (call graphs, type hierarchies)

### When to Use SCIP

- You want a file on disk that encodes "find references" for your repo
- You're building tooling that needs to scan all occurrences of a symbol
- You want human-readable symbol IDs in your debugging output
- You're integrating with Sourcegraph's code intelligence

---

## SCIP vs universal-ctags

### What ctags Does

`ctags` (and its maintained successor `universal-ctags`) scans source files with regular expressions and language-specific parsers to extract a flat list of symbol definitions. Output is a "tags file" — a tab-separated text file with:

```
symbol_name   source_file   /pattern/   kind   scope
```

No references. No type resolution. No cross-file semantic analysis. Just "where is this name defined?"

### Comparison

| Dimension              | universal-ctags                    | SCIP                              |
|------------------------|------------------------------------|-----------------------------------|
| References             | No                                 | Yes                               |
| Type resolution        | No (regex-based)                   | Yes (compiler-accurate)           |
| False positives        | Yes (overloaded names)             | No (compiler-resolved)            |
| False negatives        | Yes (dynamic dispatch, macros)     | Minimal (depends on indexer)      |
| Setup required         | None (runs on any source)          | Requires language toolchain       |
| Speed                  | Very fast (seconds for large repo) | Slow (minutes for large repo)     |
| Output size            | Small (definitions only)           | Large (all occurrences + docs)    |
| Cross-repo             | No                                 | Yes (via symbol strings)          |
| Languages              | 120+                               | 14 (official indexers)            |
| Use in Sourcegraph     | "Search-based" code nav fallback   | "Precise" code nav (primary)      |
| Hover documentation    | No                                 | Yes                               |
| Semantic kinds         | Coarse (function, variable, class) | 87 fine-grained kinds             |

### Sourcegraph's Two-Tier Model

Sourcegraph uses ctags as a zero-configuration fallback ("search-based code intelligence") and SCIP as the opt-in precise layer. When no SCIP index exists for a repo, ctags-based navigation fires. This gives always-available navigation with occasional false positives, vs. zero-config. SCIP provides compiler-accurate results when the indexer runs in CI.

### When ctags Is Sufficient

- You only need "go to definition" (not "find all references")
- You don't need hover documentation
- The codebase uses a language without a SCIP indexer
- Setup time and CI cost matter more than precision
- You're doing editor tagging (Vim, Emacs tag jump)

### When to Upgrade to SCIP

- "Find references" returning false positives causes friction
- You need cross-file or cross-repo navigation
- Hover documentation with type signatures is required
- You have overloaded function names or dynamic dispatch patterns

---

## Summary Decision Matrix

| Need                                   | Best tool          |
|----------------------------------------|--------------------|
| Zero-config, any language              | universal-ctags    |
| Precise find-references, 14 languages  | SCIP               |
| Real-time, in-editor, single file      | LSP                |
| Cross-repo at Sourcegraph scale        | SCIP               |
| Google monorepo, Bazel, graph queries  | Kythe              |
| Cross-language semantic linking        | Kythe              |
| Historical; do not use in new systems  | LSIF               |
