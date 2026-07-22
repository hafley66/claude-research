---
name: scip-consuming
description: Reading index.scip in Rust and Go, building adjacency maps, querying by symbol and range, streaming for memory efficiency, and real usage patterns from Sourcegraph tooling.
type: reference
metadata:
  source: https://pkg.go.dev/github.com/sourcegraph/scip/bindings/go/scip
  depth: advanced
---

# Consuming SCIP Indexes

## File Format Basics

`index.scip` is a raw protobuf-encoded `Index` message. No framing. No magic bytes. The entire file decodes to a single top-level `scip.Index`.

**Quick inspection without code:**
```sh
# requires protoc and scip.proto
cat index.scip | protoc --decode=scip.Index scip.proto

# via SCIP CLI
scip print index.scip
scip print --json index.scip
scip stats --from index.scip
```

---

## Reading in Rust

**Dependency** (uses prost-generated types):
```toml
[dependencies]
scip = "0.6"         # crates.io/crates/scip — official Sourcegraph bindings
prost = "0.13"
```

The `scip` crate provides prost-generated types plus utility functions. The types mirror the protobuf schema exactly.

**Basic decode:**
```rust
use std::fs;
use prost::Message;
use scip::types::Index;

let bytes = fs::read("index.scip")?;
let index = Index::decode(bytes.as_slice())?;

for doc in &index.documents {
    println!("{}: {} occurrences", doc.relative_path, doc.occurrences.len());
}
```

**Streaming** (recommended for large indexes, avoids full load):

The Go bindings have a streaming API; Rust consumers typically decode fully then process per-document since the wire format has no per-document framing. For very large indexes in Rust, consider the experimental `scip expt-convert` CLI to produce SQLite first.

---

## Reading in Go

**Import:**
```go
import (
    "github.com/sourcegraph/scip/bindings/go/scip"
    "google.golang.org/protobuf/proto"
    "os"
)
```

**Basic decode:**
```go
data, err := os.ReadFile("index.scip")
index := &scip.Index{}
err = proto.Unmarshal(data, index)
```

**Streaming decode (v0.3.0+, document-granularity):**
```go
visitor := &scip.IndexVisitor{
    VisitMetadata: func(ctx context.Context, m *scip.Metadata) error {
        // called once
        return nil
    },
    VisitDocument: func(ctx context.Context, d *scip.Document) error {
        // called per document; process and discard to avoid full memory load
        return nil
    },
    VisitExternalSymbol: func(ctx context.Context, si *scip.SymbolInformation) error {
        return nil
    },
}

f, _ := os.Open("index.scip")
defer f.Close()
err := visitor.ParseStreaming(ctx, f)
```

Streaming is strongly preferred for indexes from large repos (>10k files). Full decode can exhaust memory.

---

## Go Utility Functions

```go
// Normalize a document (sort occurrences and symbols for binary search)
doc = scip.CanonicalizeDocument(doc)

// Sort occurrences by range (required before binary-search lookups)
scip.SortOccurrences(doc.Occurrences)

// Point lookup: find all occurrences covering a given position
occs := scip.FindOccurrences(doc.Occurrences, line, character)

// Symbol lookup by name in a canonicalized document
sym := scip.FindSymbolBinarySearch(doc, "npm typescript 1.0.0 MyClass#")
// non-binary-search variant (no sort required):
sym = scip.FindSymbol(doc, symbolName)

// Remove ill-formed occurrences (bad ranges, empty symbols when required)
doc.Occurrences = scip.RemoveIllegalOccurrences(doc.Occurrences)

// Parse symbol string into structured form
parsed, err := scip.ParseSymbol("npm mypkg 1.0.0 Foo#bar().")
// or validate without allocating:
err = scip.ValidateSymbolUTF8(symbolStr)

// Symbol classification
scip.IsGlobalSymbol(sym)  // true if not "local N"
scip.IsLocalSymbol(sym)   // true if starts with "local "

// Build symbol table for a document
table := doc.SymbolTable()  // map[string]*SymbolInformation
```

---

## Building Adjacency Maps

### All-references map (symbol → []occurrence)

Build a symbol-keyed map of every reference occurrence across all documents:

```go
type OccurrenceRef struct {
    DocPath string
    Occ     *scip.Occurrence
}

refs := map[string][]OccurrenceRef{}

for _, doc := range index.Documents {
    for _, occ := range doc.Occurrences {
        if occ.Symbol == "" {
            continue // syntactic-only occurrence
        }
        refs[occ.Symbol] = append(refs[occ.Symbol], OccurrenceRef{
            DocPath: doc.RelativePath,
            Occ:     occ,
        })
    }
}
```

### Definition map (symbol → single occurrence)

```go
defs := map[string]OccurrenceRef{}

for _, doc := range index.Documents {
    for _, occ := range doc.Occurrences {
        if occ.SymbolRoles & int32(scip.SymbolRole_Definition) != 0 {
            defs[occ.Symbol] = OccurrenceRef{DocPath: doc.RelativePath, Occ: occ}
        }
    }
}
```

### Implementation map (symbol → []implementors)

```go
impls := map[string][]string{} // interface symbol → implementor symbols

for _, doc := range index.Documents {
    for _, si := range doc.Symbols {
        for _, rel := range si.Relationships {
            if rel.IsImplementation {
                impls[rel.Symbol] = append(impls[rel.Symbol], si.Symbol)
            }
        }
    }
}
// Also check external_symbols
for _, si := range index.ExternalSymbols {
    for _, rel := range si.Relationships {
        if rel.IsImplementation {
            impls[rel.Symbol] = append(impls[rel.Symbol], si.Symbol)
        }
    }
}
```

---

## Query Patterns

### Find all references to a symbol

```go
func FindReferences(index *scip.Index, targetSymbol string) []OccurrenceRef {
    var results []OccurrenceRef
    for _, doc := range index.Documents {
        for _, occ := range doc.Occurrences {
            if occ.Symbol == targetSymbol {
                results = append(results, OccurrenceRef{DocPath: doc.RelativePath, Occ: occ})
            }
        }
    }
    return results
}
```

### Find definition of a symbol

```go
func FindDefinition(index *scip.Index, targetSymbol string) *OccurrenceRef {
    defRole := int32(scip.SymbolRole_Definition)
    for _, doc := range index.Documents {
        for _, occ := range doc.Occurrences {
            if occ.Symbol == targetSymbol && occ.SymbolRoles & defRole != 0 {
                return &OccurrenceRef{DocPath: doc.RelativePath, Occ: occ}
            }
        }
    }
    return nil
}
```

### Find symbol at position (point-in-range lookup)

The recommended pattern per Sourcegraph contributor (issue #178):

1. Sort occurrences by range (done once via `CanonicalizeDocument`)
2. Binary search for occurrences whose range contains the target position
3. Extract `occ.Symbol` from matching occurrences
4. Look up the symbol in the refs/defs maps

```go
func SymbolAtPosition(doc *scip.Document, line, char int32) string {
    // doc must be canonicalized (sorted) first
    occs := scip.FindOccurrences(doc.Occurrences, line, char)
    for _, occ := range occs {
        if occ.Symbol != "" {
            return occ.Symbol
        }
    }
    return ""
}
```

### Find callers of a function

SCIP does not have an explicit "caller" relationship. Callers are all non-definition occurrences of a function symbol:

```go
func FindCallers(index *scip.Index, funcSymbol string) []OccurrenceRef {
    defRole := int32(scip.SymbolRole_Definition)
    var callers []OccurrenceRef
    for _, doc := range index.Documents {
        for _, occ := range doc.Occurrences {
            if occ.Symbol == funcSymbol && occ.SymbolRoles & defRole == 0 {
                callers = append(callers, OccurrenceRef{DocPath: doc.RelativePath, Occ: occ})
            }
        }
    }
    return callers
}
```

---

## Range Operations (Go)

```go
// Parse range from occurrence
r, err := scip.NewRange(occ.Range)    // validates; returns error on bad range
r = scip.NewRangeUnchecked(occ.Range) // no validation

// Range comparison
r.Compare(other)         // -1, 0, 1 by start position
r.Contains(position)     // point-in-range test
r.Intersects(other)      // overlap test
r.IsSingleLine()         // true if start line == end line

// Position comparison
p1.Compare(p2)
p1.Less(p2)
```

Breaking change in v0.4.0: `NewRange` now validates and returns an error; previously it was infallible. The `SortRanges` function now accepts `[]Range` instead of `[]*Range` to avoid heap allocations.

---

## SourceFile Utilities (Go)

```go
// Load source file for range-to-text resolution
sf, err := scip.NewSourceFileFromPath(absPath, relPath)

// Resolve a range to its text
text := sf.RangeText(r)

// Batch load all files in a directory
files, err := scip.NewSourcesFromDirectory("/path/to/project")
```

---

## Symbol Formatting (Go)

```go
// Verbose: includes all components
formatted, err := scip.VerboseSymbolFormatter.Format(symbolStr)

// Error-tolerant verbose
formatted = scip.LenientVerboseSymbolFormatter.FormatSymbol(parsed)

// Descriptor-only (strips scheme and package)
formatted = scip.DescriptorOnlyFormatter.Format(symbolStr)

// Custom formatter
formatter := scip.SymbolFormatter{
    IncludeScheme:         func(s string) bool { return false },
    IncludePackageVersion: func(v string) bool { return false },
    IncludeDescriptor:     func(d string) bool { return true },
}
```

---

## Performance Characteristics

**Memory**: A medium Rust or TypeScript project (50k LOC) produces an index.scip typically in the 5–50 MB range (compressed). Full decode into Go structs can use 3–10x the file size in heap (pointer overhead, string allocation).

**CPU**: Scanning all occurrences across all documents is O(total occurrences). For large indexes (millions of occurrences), pre-building the symbol→occurrences map once and reusing it is critical.

**Streaming vs. full load**: Use streaming when processing documents independently (e.g., per-file analysis). Full load is fine for small indexes or when building cross-document adjacency maps.

**SQLite export** (`scip expt-convert`): Experimental. Converts to SQLite for range-indexed queries. Not suitable for production as of 2025; no documented schema stability guarantees.

**Sorting**: `SortOccurrences` is a prerequisite for `FindOccurrences` binary search. `CanonicalizeDocument` does both occurrence and symbol sorting. Do this once per document, not per query.

**Local symbols**: `local N` symbols are document-scoped. Never put them in cross-document maps; they will collide across documents. Filter with `scip.IsLocalSymbol()` before inserting into global maps.

---

## Real Usage Patterns from Sourcegraph Tooling

**Cross-document reference index**: Sourcegraph's backend builds a database keyed on (symbol, repo, commit). Each occurrence becomes a row. The symbol string is the join key across repos when cross-repo indexes are present.

**`external_symbols` handling**: When a document references a symbol not defined in any indexed document, that symbol appears in `Index.external_symbols`. Hover documentation for standard library symbols comes from here. Consumers should load external_symbols into the same symbol table; missing entries degrade hover docs but do not break reference lookup.

**Occurrence deduplication**: Some indexers may emit duplicate occurrences for the same range (e.g., both a syntactic and semantic occurrence). Consumers should be tolerant of multiple occurrences at the same range. The semantic occurrence (non-zero `symbol_roles`) takes precedence for navigation.

**Per-issue workaround for local variable lookup (issue #178)**:
- Build a hash table keyed by symbol name for refs and defs
- Build a sorted (or interval-tree) structure keyed by range for position queries
- The two structures serve different query shapes: "what does this symbol mean?" vs. "what symbol is at this position?"

**Multibyte character handling** (v0.6.0 fix): Symbol parsing previously panicked on multibyte code points in names. If consuming pre-v0.6.0 indexes, validate symbols before parsing to avoid panics in Rust consumers.

**Windows path issue** (open as of September 2024, issue #282): The SCIP CLI misinterprets `C:\path` as a host:port URL. When writing cross-platform consumers, normalize project root URIs to use forward slashes.
