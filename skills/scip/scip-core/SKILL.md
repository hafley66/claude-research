---
name: scip-core
description: SCIP Code Intelligence Protocol protobuf schema, symbol string grammar, occurrence range encoding, role bitmask flags, and index file anatomy.
type: reference
metadata:
  source: https://github.com/sourcegraph/scip/blob/main/scip.proto
  depth: advanced
---

# SCIP Core: Protobuf Schema and Format

SCIP (pronounced "skip") is a language-agnostic code indexing protocol backed by a Protocol Buffer schema. It replaces LSIF and powers "go to definition", "find references", and "find implementations" in Sourcegraph.

The canonical schema lives at `scip.proto` in `github.com/sourcegraph/scip`. All field numbers below are authoritative from that file.

---

## Top-Level: Index

The root message. The entire index.scip file decodes to a single `Index`.

```proto
message Index {
  Metadata metadata         = 1;
  repeated Document documents = 2;
  repeated SymbolInformation external_symbols = 3;
}
```

- `metadata`: version, tool info, project root URI
- `documents`: one entry per source file indexed; contains all occurrences and local symbol info
- `external_symbols`: `SymbolInformation` for symbols referenced in documents but defined in other packages (i.e., not emitted as a full Document). Used for cross-repo/cross-package hover docs and relationships.

---

## Metadata (field 1 of Index)

```proto
message Metadata {
  ProtocolVersion version          = 1;
  ToolInfo tool_info               = 2;
  string project_root              = 3;  // URI, e.g. "file:///home/user/myproject"
  TextDocumentEncoding text_document_encoding = 4;
}

message ToolInfo {
  string name              = 1;  // indexer name, e.g. "scip-typescript"
  string version           = 2;
  repeated string arguments = 3; // CLI args used to invoke the indexer
}

enum ProtocolVersion {
  UnspecifiedProtocolVersion = 0;
}

enum TextDocumentEncoding {
  UnspecifiedTextDocumentEncoding = 0;
  UTF8  = 1;
  UTF16 = 2;
}
```

`project_root` must be an absolute URI. Relative paths in `Document.relative_path` are resolved against this root.

---

## Document (field 2 of Index)

One `Document` per source file.

```proto
message Document {
  string relative_path               = 1;  // relative to project_root
  repeated Occurrence occurrences    = 2;
  repeated SymbolInformation symbols = 3;
  string language                    = 4;  // Language enum value as string
  string text                        = 5;  // optional; full file text
  PositionEncoding position_encoding = 6;
}
```

- `symbols` contains `SymbolInformation` for symbols *defined* in this document (definitions only)
- `occurrences` covers both definitions and references in this document
- `text` is optional; including it enables consumers to resolve ranges without reading the source files
- `language` is the `Language` enum name stringified (e.g., `"TypeScript"`, `"Rust"`, `"Go"`)

---

## Occurrence (field 2 of Document)

The atomic unit of SCIP. Every semantic or syntactic annotation in a document is an Occurrence.

```proto
message Occurrence {
  repeated int32 range                    = 1;  // 3 or 4 elements; see below
  string symbol                           = 2;  // symbol string (global or "local N")
  int32 symbol_roles                      = 3;  // bitmask of SymbolRole
  repeated string override_documentation = 4;  // overrides SymbolInformation.documentation
  SyntaxKind syntax_kind                  = 5;  // syntactic highlight class
  repeated Diagnostic diagnostics         = 6;
  repeated int32 enclosing_range          = 7;  // same format as range; e.g. function body
}
```

### Range Encoding

`range` is a **half-open [start, end)** source range encoded as integers:

- **3 elements**: `[startLine, startCharacter, endCharacter]` — single-line range; end line == start line
- **4 elements**: `[startLine, startCharacter, endLine, endCharacter]` — multi-line range

All values are **zero-indexed**. The character interpretation (byte offset vs. code unit) depends on `Document.position_encoding`.

```
// Example: identifier "foo" on line 5, columns 10-13
range = [5, 10, 13]     // 3-element, single line

// Example: multi-line string on lines 3-7
range = [3, 0, 7, 6]    // 4-element
```

`enclosing_range` uses the same format; typically the surrounding function, class, or block body. Used for "current file symbol outline" and collapse/expand features.

### PositionEncoding

```proto
enum PositionEncoding {
  UnspecifiedPositionEncoding          = 0;
  UTF8CodeUnitOffsetFromLineStart      = 1;
  UTF16CodeUnitOffsetFromLineStart     = 2;  // default for most editors (LSP compat)
  UTF32CodeUnitOffsetFromLineStart     = 3;
}
```

---

## SymbolRole Bitmask

`symbol_roles` is an `int32` bitmask. Non-zero values mean the occurrence has semantic content (a symbol field is required when symbol_roles != 0).

```proto
enum SymbolRole {
  UnspecifiedSymbolRole = 0x0;
  Definition            = 0x1;   // this occurrence is the definition of the symbol
  Import                = 0x2;   // import/require statement
  WriteAccess           = 0x4;   // variable is being written
  ReadAccess            = 0x8;   // variable is being read
  Generated             = 0x10;  // occurrence in generated code
  Test                  = 0x20;  // occurrence in test code
  ForwardDefinition     = 0x40;  // forward declaration (C/C++)
}
```

Occurrences that are purely syntactic (e.g., keyword highlighting) have `symbol_roles = 0` and no `symbol` field. Semantic occurrences have at least `ReadAccess` or `Definition`.

**Definition detection**: `(symbol_roles & Definition) != 0` is the canonical check.

---

## Symbol String Format

The symbol is a structured string, not an opaque numeric ID. Global symbols are stable across index runs; local symbols are document-scoped counters.

### Grammar

```
<symbol>     ::= <scheme> ' ' <package> ' ' <descriptor>+
               | 'local ' <local-id>

<package>    ::= <manager> ' ' <package-name> ' ' <version>

<descriptor> ::= <namespace>
               | <type>
               | <term>
               | <method>
               | <type-parameter>
               | <parameter>
               | <meta>
               | <macro>

<namespace>       ::= <name> '/'
<type>            ::= <name> '#'
<term>            ::= <name> '.'
<method>          ::= <name> '(' <disambiguator>? ')'  '.'
<type-parameter>  ::= '[' <name> ']'
<parameter>       ::= '(' <name> ')'
<meta>            ::= <name> ':'
<macro>           ::= <name> '!'

<name>       ::= <identifier> | '`' [^`]+ '`'   // backtick-escaped for special chars
<identifier> ::= [a-zA-Z0-9_+\-$]+
```

**Spaces in components** are escaped as double spaces. The `.` placeholder means "empty/unspecified" for package components. `scheme` must not be empty, must not start with `'local'`.

### Descriptor.Suffix Enum

```proto
enum Suffix {
  UnspecifiedSuffix = 0;
  Namespace         = 1;   // '/'  — packages, modules
  Type              = 2;   // '#'  — classes, interfaces, structs
  Term              = 3;   // '.'  — variables, constants, functions
  Method            = 4;   // '()'  — methods with optional disambiguator
  TypeParameter     = 5;   // '[]'  — generic type params
  Parameter         = 6;   // '()'  — function parameters
  Meta              = 7;   // ':'   — indexer-defined metadata
  Local             = 8;   // used for local symbol scoping
  Macro             = 9;   // '!'   — macros
}
```

### Examples

```
// TypeScript function in npm package
npm typescript-parser 1.0.0 src/parser/Parser#parse().

// Rust struct field
rust-analyzer . . std::collections::HashMap#insert().

// Local variable (document-scoped)
local 42

// Go method with method receiver
go . github.com/myorg/myrepo . MyService#HandleRequest().
```

### Package Components

- `<manager>`: package manager identifier (e.g., `npm`, `cargo`, `maven`, `pip`, `go`)
- `<package-name>`: package name in that ecosystem
- `<version>`: version string (semver, git tag, etc.)
- Use `.` (single dot) for any component that is empty or not applicable

---

## SymbolInformation (field 3 of Document, field 3 of Index)

Carries metadata about a symbol. In `Document.symbols`, emitted for *defined* symbols only. In `Index.external_symbols`, for referenced-but-not-defined symbols.

```proto
message SymbolInformation {
  string symbol                          = 1;  // full symbol string
  repeated string documentation          = 3;  // markdown docs (field 2 is reserved)
  repeated Relationship relationships    = 4;
  Kind kind                              = 5;  // SymbolInformation.Kind enum
  string display_name                    = 6;  // human-readable name, no encoding
  Document signature_documentation      = 7;  // rendered signature as a Document
  string enclosing_symbol                = 8;  // parent symbol string; mainly for locals
}
```

Note: field 2 is reserved/skipped.

### Kind Enum (87 values, selected)

```proto
enum Kind {
  UnspecifiedKind      = 0;
  AbstractMethod       = 1;
  Accessor             = 2;
  Array                = 3;
  Boolean              = 6;
  Class                = 7;
  Constant             = 10;
  Constructor          = 11;
  Enum                 = 16;
  EnumMember           = 17;
  Field                = 23;
  Function             = 24;
  Interface            = 30;
  Method               = 34;
  Module               = 37;
  Namespace            = 38;
  Null                 = 39;
  Object               = 40;
  Operator             = 41;
  Package              = 42;
  Parameter            = 44;
  Property             = 49;
  Struct               = 66;
  Trait                = 72;
  Type                 = 73;
  TypeAlias            = 74;
  TypeParameter        = 77;
  Union                = 80;
  Variable             = 82;
  // ... 87 total covering most language constructs
}
```

`signature_documentation` is a nested `Document` message whose `text` contains the rendered signature (e.g., `func Foo(x int) string`). The nested Document typically has no occurrences.

---

## Relationship (field 4 of SymbolInformation)

Expresses semantic edges between symbols.

```proto
message Relationship {
  string symbol         = 1;  // target symbol
  bool is_reference     = 2;  // source is a reference to target
  bool is_implementation = 3; // source implements target (interface satisfaction)
  bool is_type_definition = 4; // source is the type definition of target
  bool is_definition    = 5;  // source is a definition of target
}
```

Note from proto comments: "Update registerInverseRelationships on adding a new field here." Sourcegraph's backend generates inverse edges automatically from these forward declarations.

Common use: `is_implementation = true` when a struct implements an interface, enabling "Find implementations" navigation.

---

## Diagnostic (field 6 of Occurrence)

Optional compiler/linter diagnostics attached to an occurrence.

```proto
message Diagnostic {
  Severity severity        = 1;
  string code              = 2;  // error code, e.g. "TS2304"
  string message           = 3;
  string source            = 4;  // tool that produced it, e.g. "tsc"
  repeated DiagnosticTag tags = 5;
}

enum Severity {
  UnspecifiedSeverity = 0;
  Error               = 1;
  Warning             = 2;
  Information         = 3;
  Hint                = 4;
}

enum DiagnosticTag {
  UnspecifiedDiagnosticTag = 0;
  Unnecessary              = 1;
  Deprecated               = 2;
}
```

---

## SyntaxKind Enum (syntactic, no symbol required)

Used for syntax highlighting. 36 values. Occurrence can be purely syntactic (no symbol) or semantic (has symbol) or both.

Selected values:
```
Comment, PunctuationDelimiter, PunctuationBracket,
Keyword, IdentifierOperator,
Identifier, IdentifierBuiltin, IdentifierNull, IdentifierConstant,
IdentifierMutableGlobal, IdentifierParameter, IdentifierLocal,
IdentifierShadowed, IdentifierNamespace,
IdentifierFunction, IdentifierFunctionDefinition,
IdentifierMacro, IdentifierMacroDefinition,
IdentifierType, IdentifierBuiltinType, IdentifierAttribute,
RegexEscape, RegexRepeated, RegexWildcard, RegexDelimiter, RegexJoin,
StringLiteral, StringLiteralEscape, StringLiteralSpecial, StringLiteralKey,
CharacterLiteral, NumericLiteral, BooleanLiteral,
Tag, TagAttribute, TagDelimiter
```

---

## Language Enum

111 values covering all major languages. Used in `Document.language`. Examples:
```
Go = 33, Python = 70, Rust = 75, TypeScript = 94, JavaScript = 41,
Java = 42, Kotlin = 48, Scala = 78, CSharp = 16, CPP = 15,
Ruby = 73, PHP = 64, Swift = 83, Dart = 21, Elixir = 23, Zig = 111
```

---

## Index File Layout (Wire Format)

`index.scip` is a raw protobuf-encoded `Index` message. No framing, no compression by default.

To inspect without language bindings:
```sh
# Using protoc (requires scip.proto)
cat index.scip | protoc --decode=scip.Index scip.proto

# Using SCIP CLI
scip print index.scip
scip print --json index.scip
```

The protobuf wire format uses length-delimited records for repeated fields. Documents are not independently seekable (no length prefix per Document at the Index level); the entire binary must be decoded.

The `scip` CLI's streaming API (v0.3.0+) provides document-granularity streaming to avoid loading the entire index into memory at once.

---

## Occurrence Sort Order

Occurrences within a Document are conventionally sorted by range (line ascending, then character ascending). The Go bindings provide `SortOccurrences()` for normalization. The `CanonicalizeDocument()` function sorts both occurrences and symbols.

`FindOccurrences(occurrences, targetLine, targetCharacter)` performs a point-in-range lookup. After sorting, this can be done with binary search via the `FindSymbolBinarySearch()` variant.

---

## Key Invariants

1. Every occurrence with `symbol_roles != 0` must have a non-empty `symbol` field.
2. `local N` symbols are document-scoped. The `N` is an arbitrary unique counter per document; no semantic meaning.
3. `external_symbols` should include `SymbolInformation` for all symbols that appear in documents but have no corresponding Document entry. Missing external symbols degrade hover docs and relationship navigation but do not break reference lookup.
4. `enclosing_symbol` on `SymbolInformation` is typically only set for local symbols. For globals, the hierarchy is implied by descriptor nesting (e.g., `MyClass#myMethod().` is enclosed by `MyClass#`).
5. The `override_documentation` field on Occurrence overrides `SymbolInformation.documentation` for that specific occurrence — used when a generic type is instantiated and the hover doc should reflect the concrete type.
