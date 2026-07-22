---
name: scip-indexers
description: Running scip-typescript, scip-java, rust-analyzer, scip-python, scip-clang, scip-dotnet, scip-ruby; output format; cross-repo setup; building a custom indexer.
type: reference
metadata:
  source: https://github.com/sourcegraph/scip
  depth: intermediate
---

# SCIP Indexers

## Available Indexers

| Language(s)               | Indexer                        | Upstream               |
|---------------------------|--------------------------------|------------------------|
| TypeScript, JavaScript    | scip-typescript                | sourcegraph/scip-typescript |
| Java, Scala, Kotlin       | scip-java                      | sourcegraph/scip-java  |
| Rust                      | rust-analyzer (built-in)       | rust-lang/rust-analyzer |
| Python                    | scip-python (Pyright fork)     | sourcegraph/scip-python |
| C, C++                    | scip-clang                     | sourcegraph/scip-clang |
| C#, Visual Basic          | scip-dotnet (Roslyn-based)     | sourcegraph/scip-dotnet |
| Ruby                      | scip-ruby (Sorbet-based)       | sourcegraph/scip-ruby  |
| Go                        | scip-go                        | sourcegraph/scip-go    |
| Dart                      | scip-dart                      | sourcegraph/scip-dart  |
| PHP                       | scip-php                       | sourcegraph/scip-php   |

All indexers output `index.scip` in the working directory by default.

---

## SCIP CLI (inspector/validator)

Install:
```sh
git clone https://github.com/sourcegraph/scip.git --depth=1
cd scip && go build ./cmd/scip
# or download pre-built binary from releases page
```

Commands:
```sh
scip print index.scip               # human-readable dump for debugging
scip print --json index.scip        # JSON output
scip lint index.scip                # flag potential issues
scip stats --from index.scip        # occurrence/symbol counts
scip snapshot --from index.scip --to ./snapshots   # generate golden test files
scip test --from index.scip         # validate against snapshot test files
scip expt-convert --output index.db # [EXPERIMENTAL] convert to SQLite
```

`scip snapshot` generates files with carets (`^`) annotating each occurrence, useful for golden testing during indexer development.

Upload to Sourcegraph:
```sh
npm install -g @sourcegraph/src
export SRC_ACCESS_TOKEN=YOUR_TOKEN
export SRC_ENDPOINT=https://sourcegraph.example.com
src code-intel upload -file=index.scip
```

---

## scip-typescript

**Install:**
```sh
npm install -g @sourcegraph/scip-typescript
# Node v18 or v20 required
```

**Run (TypeScript project with tsconfig.json):**
```sh
npm install
scip-typescript index
```

**Run (JavaScript project, no tsconfig):**
```sh
npm install
scip-typescript index --infer-tsconfig
```

**Workspace support:**
```sh
scip-typescript index --yarn-workspaces
scip-typescript index --pnpm-workspaces
```

**Key flags:**

| Flag                  | Purpose |
|-----------------------|---------|
| `--infer-tsconfig`    | Generates tsconfig for JS-only projects |
| `--progress-bar`      | Shows current file (noisy for CI) |
| `--no-global-caches`  | Lower memory, slower indexing |
| `--yarn-workspaces`   | Monorepo support (Yarn) |
| `--pnpm-workspaces`   | Monorepo support (pnpm) |

**OOM workaround:**
```sh
node --max-old-space-size=16000 "$(which scip-typescript)" index
```

**Quality note for JS**: Add `@types/*` devDependencies to improve type resolution quality; without them inference degrades significantly.

**Latest release**: v0.4.0 (October 2025)

---

## scip-java

Supports Java, Scala, Kotlin. Wraps the SemanticDB compiler plugin.

**Basic indexing (auto-detects Gradle or Maven):**
```sh
scip-java index
# outputs index.scip in current directory
```

**Key flags:**

| Flag           | Purpose |
|----------------|---------|
| `--output`     | Output path (default: `index.scip`) |
| `--targetroot` | SemanticDB output dir (`build/semanticdb-targetroot` for Gradle, `target/semanticdb-targetroot` for Maven) |
| `--[no-]text`  | Whether to pass `-text:on` to SemanticDB compiler plugin |
| `--build-tool` | Force build tool selection (auto-detected by default) |

**Supported build tools**: Gradle, Maven, sbt. Gradle 8 auto-indexing has had compatibility issues (issue #544 in scip-java).

**Architecture**: scip-java uses the SemanticDB compiler plugin to extract semantic information during compilation, then transforms SemanticDB protobuf output into SCIP.

---

## rust-analyzer (Rust indexer)

Rust indexing is built directly into rust-analyzer, not a separate binary. The `scip` subcommand runs batch analysis.

**Run:**
```sh
rust-analyzer scip .
# outputs index.scip
```

**How it works**: Performs full project analysis (equivalent to IDE startup), emits all definitions, references, hover docs, and symbol metadata. Requires `Cargo.toml` at the project root.

**Symbol generation improvements**: PR #18758 (rust-analyzer) improved symbol generation; PR #13456 added symbols for local crates. Closure captures and generic params are emitted as local symbols with `enclosing_symbol` set.

**scip-rust wrapper**: `github.com/sourcegraph/scip-rust` is a thin wrapper around rust-analyzer's SCIP output, primarily used by Sourcegraph's CI pipeline.

---

## scip-python

Fork of Pyright (Microsoft's Python type checker) with SCIP emission.

**Install:**
```sh
npm install -g @sourcegraph/scip-python
# requires Python 3.10+, Node v16+
```

**Run:**
```sh
# Activate virtualenv first
source .venv/bin/activate
scip-python index . --project-name=my-project
```

**Key flags:**

| Flag                   | Purpose |
|------------------------|---------|
| `--project-name`       | Required; project identifier for symbols |
| `--project-version`    | Version for stable cross-repo symbol IDs |
| `--target-only=<path>` | Index only a subdirectory |
| `--project-namespace`  | Prepend a namespace prefix to all symbols |
| `--environment=<path>` | Custom package env JSON (avoids pip call) |

**Environment JSON format** (alternative to pip discovery):
```json
[
  {
    "name": "requests",
    "version": "2.31.0",
    "files": ["path/to/requests/__init__.py", "..."]
  }
]
```

**OOM:**
```sh
NODE_OPTIONS="--max-old-space-size=8192" scip-python index .
```

**Key design note**: scip-python modifies Pyright minimally; changes are concentrated in `packages/pyright-scip/`. It does not terminate on timeout and preserves indexed files under high memory conditions.

---

## scip-clang

C/C++ indexer requiring a JSON compilation database.

**Install**: Download binary from releases (x86_64 Linux glibc 2.16+, arm64 macOS).

**Run:**
```sh
# Generate compilation database first
cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=ON -B build
scip-clang --compdb-path=build/compile_commands.json
```

**Compilation database generation:**
- CMake: `-DCMAKE_EXPORT_COMPILE_COMMANDS=ON`
- Bazel: use hedronvision or grailbio extractors
- Meson: Ninja backend
- Make/other: use [Bear](https://github.com/rizsotto/Bear)

**Key flags:**
```sh
scip-clang --compdb-path=<path>
scip-clang --compdb-path=<path> --show-compiler-diagnostics
```

**Resource requirements**:
- ~2MB temp disk per translation unit
- ~2MB /dev/shm per core (Linux)
- ~2GB RAM per core

**Known limitations:**
- Pre-compiled headers not supported
- Must be invoked from project root
- CUDA indexing requires Clang 16+ (GCC header compatibility issues)

---

## scip-dotnet

C# and Visual Basic indexer via Roslyn compiler.

**Install (.NET 8.0+):**
```sh
dotnet tool install --global scip-dotnet
```

**Run:**
```sh
scip-dotnet index
# generates index.scip at project root
```

**Docker alternative:**
```sh
docker run -v $(pwd):/app sourcegraph/scip-dotnet:latest scip-dotnet index
```

**Debug logging:**
```sh
export Logging__LogLevel__Default=Debug
scip-dotnet index
```

No special project configuration required.

---

## scip-ruby

Sorbet-based indexer. Best results with Sorbet adoption (`# typed: true` or higher).

**Install:**
```ruby
# Gemfile
gem 'scip-ruby', require: false, group: :development
```
```sh
bundle install
```

Or download binary:
```sh
ARCH="$(uname -m)" OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
curl -L "https://github.com/sourcegraph/scip-ruby/releases/latest/download/scip-ruby-${ARCH}-${OS}" -o scip-ruby
chmod +x scip-ruby
```

**Run:**
```sh
bundle exec scip-ruby      # auto-detects sorbet/config
bundle exec scip-ruby .    # index all files
```

**CI note**: Wrap in `set +e` / `set -e` to avoid blocking CI on non-critical failures. Project is marked experimental.

**Limitation**: Quality degrades significantly for `# typed: false` files. Requires Sorbet.

---

## scip-go

Go module indexer.

**Install:**
```sh
go install github.com/sourcegraph/scip-go/cmd/scip-go@latest
```

**Run:**
```sh
scip-go
# or with explicit module info
scip-go --module-name=github.com/org/repo --module-version=v1.2.3
```

**Cross-repo limitation**: Due to Go's module design, cross-repo navigation for scip-go indexes does not resolve correctly. Cannot navigate to Go standard library without special handling. Workaround: `--go-version=go1.X.Y` flag plus manually indexing the Go stdlib.

---

## Cross-Repository Indexing

Cross-repo navigation requires both the dependent repo and dependency repos to have SCIP indexes uploaded to the same Sourcegraph instance at matching commits/versions.

For **scip-clang** specifically, supply a package map JSON:
```json
[
  {"path": "/path/to/external/abseil", "package": "abseil@20230125.2"},
  {"path": "/path/to/external/protobuf", "package": "protobuf@3.21.0"}
]
```

Package IDs are `name@version`. The system uses longest-prefix matching when a file path could match multiple package roots. Version strings must be consistent across all indexed repos and must not be reused.

**Quadratic scaling problem**: For a dependency chain A → B → C, A gets indexed three times, B twice, C once. There is no shared cache for pre-built dependency indexes in scip-clang (incremental builds issue closed as "not planned" in January 2026).

**Cross-repo for Go**: Known broken by design; see scip-go section above.

**Cross-repo for Ruby**: Open issue (scip-ruby #125), unresolved.

---

## Building a Custom Indexer

### Minimum viable emission

An indexer must emit a valid `Index` message containing:

1. **`Metadata`** — project root URI, tool name/version, text encoding
2. **`Document`** per source file — relative path, language
3. **`Occurrence`** per semantic entity — range, symbol, symbol_roles
4. **`SymbolInformation`** per defined symbol — at minimum the `symbol` string

Optional but recommended for full navigation:
- `SymbolInformation.documentation` — hover docs
- `Relationship` messages — implements/references edges
- `Occurrence.syntax_kind` — for syntax highlighting without full semantic resolve
- `Index.external_symbols` — for cross-package hover docs

### Recommended implementation order

1. Emit occurrences + symbols for a single file, verify with `scip print`
2. Iterate over all entity kinds (functions, classes, fields, etc.)
3. Add hover documentation
4. Add `Relationship` messages (implementation edges)
5. Add cross-file/cross-package symbol resolution

### Using language bindings

**Go:**
```go
import "github.com/sourcegraph/scip/bindings/go/scip"

index := &scip.Index{
  Metadata: &scip.Metadata{
    ProjectRoot: "file:///home/user/project",
    ToolInfo: &scip.ToolInfo{Name: "my-indexer", Version: "0.1.0"},
  },
  Documents: []*scip.Document{...},
}
```

**Rust**: use the `scip` crate (`crates.io/crates/scip`), generated via prost from scip.proto.

**TypeScript/Haskell**: auto-generated bindings available in the repo.

**Other languages**: run `protoc` on `scip.proto` using the target language's protobuf plugin.

### Snapshot testing during development

```sh
# After emitting index.scip:
scip snapshot --from index.scip --to ./snapshots
git diff ./snapshots   # review changes visually

# For CI:
scip test --from index.scip   # validates against committed snapshot files
```

Snapshot files annotate source with carets showing what each occurrence emits:
```
function foo(x: number): string {
//       ^^^ definition npm mypkg 1.0.0 foo().
//           ^ parameter npm mypkg 1.0.0 foo().(x)
```

### Symbol naming conventions

Follow the package manager ecosystem conventions:
- `npm <package-name> <version>` for Node.js packages
- `cargo <crate-name> <version>` for Rust crates
- `maven <group:artifact> <version>` for JVM
- `pip <package-name> <version>` for Python
- `go . <module-path> <version>` for Go modules

Use `.` (dot) for empty/unspecified package component slots. Use backtick escaping in symbol names for characters outside `[a-zA-Z0-9_+\-$]`.

### Debugging

```sh
scip print --json index.scip | jq '.documents[0].occurrences[0:5]'
scip lint index.scip   # surfaces malformed ranges, empty symbols, etc.
```
