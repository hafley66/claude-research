---
name: scip-issues-notes
description: Known limitations from GitHub issues, incremental indexing status, cross-language gaps, performance gotchas on large repos, and community workarounds.
type: reference
metadata:
  source: https://github.com/sourcegraph/scip/issues
  depth: advanced
---

# SCIP Issues and Known Limitations

## Incremental Indexing

### Status: Not Supported (as of early 2026)

SCIP indexers analyze entire projects on every run. There is no mechanism in the protocol or any official indexer to produce a delta index or to re-use prior index artifacts for unchanged files.

**scip-clang incremental builds (issue #183)**:
- Opened April 2023, closed "not planned" January 2026
- Proposal: Bazel aspect that produces per-translation-unit shards, then merges
- Technical design was sound (single-TU mode + merge-only mode) but was not implemented
- Merge step would always run even for small changes — necessitating parallelization

**Tree-sitter alternative** (sheeptechnologies RFC #4):
- Community project proposing to replace SCIP dependency with Tree-sitter based file-incremental indexing
- Tree-sitter queries can extract structure without type checkers or build tools
- Enables true file-granularity incremental processing
- Trade-off: loses type resolution (becomes syntactic, not semantic)

**Practical implication for large repos**:
- Medium repo (10k+ files): indexing can take minutes
- Any commit re-triggers full index
- Sourcegraph's CI pipeline runs indexers on every push; for large monorepos this is significant
- No workaround exists within the SCIP protocol

---

## Cross-Language Support Gaps

### Go: Cross-Repo Navigation Broken by Design

`scip-go` documentation explicitly states:
> "Due to the current protocol design cross-repo navigation will not work."

Cannot navigate to Go standard library without special handling. Workaround: use `--go-version=go1.X.Y` flag when indexing, then manually index the Go stdlib version and upload separately.

Root cause: Go's module system encodes version information in a way that does not map cleanly to SCIP's package manager convention for symbol strings.

### Ruby: Cross-Repo Not Implemented (scip-ruby issue #125)

Cross-repo code navigation is an open issue for scip-ruby. Status: unresolved as of 2025. Project is marked "experimental."

### Python: Dependency Resolution via pip

scip-python calls `pip` at index time to discover package metadata. In environments without pip access or network isolation, this fails. Workaround: supply `--environment` flag with a JSON file listing packages manually.

### C/C++: Quadratic Cross-Repo Scaling

scip-clang's cross-repo implementation (merged PR #338) works but scales quadratically with dependency graph depth. For a chain A → B → C:
- A is indexed 3 times
- B is indexed 2 times
- C is indexed 1 time

There is no package-level caching of dependency indexes. Every downstream package re-indexes all transitive dependencies. Proposed solutions (reuse indexes from dependencies, namespace-hint-based partial indexing) were discussed in issue #184 but not implemented.

### Java/Gradle 8: Auto-Indexing Broken

scip-java auto-indexing of Gradle 8 projects has compatibility issues (issue #544 in scip-java). Gradle 7 works. For Gradle 8, manual configuration may be required.

### TypeScript: Memory Consumption

Large TypeScript monorepos can OOM during indexing. Known mitigation: `--no-global-caches` flag (trades speed for memory). For extreme cases: increase Node heap:
```sh
node --max-old-space-size=16000 "$(which scip-typescript)" index
```

---

## Protocol-Level Limitations

### No Streaming Write Format

`index.scip` is a single protobuf message. There is no way to append documents to an existing index file. Updating a single file's entries requires re-indexing the entire project and re-writing the full index.

The protocol has no concept of "index shards" or "partial index" that can be merged at query time. This is the root architectural constraint blocking incremental indexing.

### Local Symbols Scope

`local N` symbols are document-scoped and carry no information about what they represent beyond their `enclosing_symbol`. If you need to identify a local variable across documents (impossible by design), you must use the enclosing global symbol plus positional context.

**Consumer gotcha**: local symbol counters reset per document. `local 42` in document A and `local 42` in document B are different symbols. Never merge local symbols into a cross-document map.

### No Query API

SCIP is a data format, not a service. There is no query API, no RPC interface, no server process. Consumers must load the index and implement their own query layer. The experimental `scip expt-convert` SQLite conversion provides an indexed store but has no stability guarantees.

### External Symbols Are Best-Effort

`Index.external_symbols` is optional. If an indexer omits external symbol information, hover documentation for standard library and third-party symbols is unavailable. This is particularly noticeable for auto-generated code or macros where the indexer cannot determine the source location.

---

## Wire Format Limitations

### Windows Path Bug (issue #282, open as of September 2024)

The SCIP CLI misinterprets colons in Windows file paths (`C:\...`) as host:port separators. This affects `scip print`, `scip lint`, and related commands on Windows. No workaround documented; issue remains open with `graph/scip` and `team/graph` labels.

### No Magic Bytes / No Framing

`index.scip` has no file magic, no version header, no per-document framing. You cannot:
- Detect a SCIP file without trying to decode it
- Seek to a specific document without decoding everything before it
- Verify file integrity without full decode

For streaming reads (Go SDK v0.3.0+), the streaming API provides document-granularity callbacks but still reads linearly.

### Multibyte Symbol Parsing (fixed in v0.6.0)

Pre-v0.6.0 Go and Rust symbol parsers panicked on multibyte code points in symbol names. If consuming indexes generated by older indexers and parsed by older library versions, this could surface as a crash. Fixed in v0.6.0; MSRV bumped to Rust 1.81.0 in the same release.

---

## API Breaking Changes (Historical)

### v0.6.0

- `IndexVisitor` now accepts `context.Context` and returns `error` (breaking Go API change)
- `ParseSymbol` hardened against multibyte code points

### v0.4.0

- `NewRange` now validates and returns an error (was infallible)
- `SortRanges` accepts `[]Range` instead of `[]*Range`

### v0.3.0

- Added streaming parse API (`IndexVisitor.ParseStreaming`)

---

## Performance Gotchas

### Full Decode Memory

Decoding a large index.scip fully into memory uses 3–10x the file size due to protobuf struct overhead (pointer-per-field, string allocations). A 20MB index.scip may use 100–200MB of heap. Use the Go streaming API or process per-document.

### Sorting Prerequisite

`FindOccurrences` and `FindSymbolBinarySearch` require sorted input. `CanonicalizeDocument` does this. If you skip canonicalization and use binary-search variants, results are undefined. The linear-scan variants (`FindSymbol`, basic `FindOccurrences` without sort precondition) are always correct but slower.

### Large Repos and `scip stats`

`scip stats` loads the full index. On repositories with millions of occurrences, this takes seconds to minutes. Not suitable for tight feedback loops.

### Diagnostic Field Inflation

Emitting full compiler diagnostics in `Occurrence.diagnostics` significantly inflates index size. Most consumers only need navigation (definition/reference), not diagnostics. Consider omitting diagnostics from the SCIP index if they're available via another channel (e.g., LSP at edit time).

---

## Community Workarounds

### Local Variable Lookup (issue #178)

Sourcegraph contributor recommendation for building a "find references of variable at cursor" tool:

1. Build two structures:
   - `map[symbol][]OccurrenceRef` for fast symbol-to-locations lookup
   - Sorted occurrence list per document for position-to-symbol lookup (binary search by range)
2. For a cursor position: binary search the sorted occurrence list to find overlapping occurrences, extract the symbol
3. Look up that symbol in the first map
4. Filter out the `local N` symbols from cross-document maps (they're document-scoped)

### Avoid Re-Indexing for Read-Only Queries

If you only need to query an index and not regenerate it, the `scip expt-convert` SQLite export (experimental) gives you a queryable database. The schema is not stable, but for throw-away analysis scripts this is convenient.

### scip-python Without pip

```sh
# Generate environment JSON manually
pip list --format=json > pip-list.json
# Transform to SCIP environment format, then:
scip-python index . --project-name=myproject --environment=./pip-env.json
```

### Debugging Malformed Indexes

```sh
scip lint index.scip     # reports bad ranges, missing symbols, etc.
scip print index.scip | head -200   # spot-check first documents
scip print --json index.scip | jq '.documents | length'
scip print --json index.scip | jq '[.documents[].occurrences | length] | add'
```

### CI Memory for Large TypeScript Monorepos

```yaml
# GitHub Actions
- name: Index TypeScript
  run: |
    node --max-old-space-size=16000 "$(which scip-typescript)" index \
      --yarn-workspaces
  env:
    NODE_OPTIONS: ""  # Clear any inherited NODE_OPTIONS that might conflict
```

---

## Ecosystem Gaps (as of early 2026)

- **No Bazel-native indexer**: scip-clang supports Bazel via compilation database extraction, but there is no first-class Bazel aspect in any official SCIP indexer
- **No Elixir/Erlang indexer**: despite Language enum entries
- **No Haskell indexer**: despite Haskell bindings in the SDK
- **scip-php**: listed in indexer table but minimal documentation; maintenance status unclear
- **scip-dart**: listed; status unclear
- **GitLab SCIP support (GitLab issue #412981)**: open as of 2024; GitLab does not natively consume SCIP indexes; requires Sourcegraph integration
- **AI tooling adoption**: sparse; Anthropic's Claude Code shipped native LSP (not SCIP) support in December 2025
