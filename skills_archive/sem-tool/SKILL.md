---
name: sem-tool
description: sem CLI and MCP server -- entity-level semantic diffs, impact analysis, blame, log, context budgeting. Tree-sitter entity extraction across 22 languages, SQLite-cached dependency graphs.
trigger: sem diff, sem impact, sem blame, sem log, sem entities, sem context, semantic diff, entity diff, code entity, sem mcp, sem-mcp, sem tool
---

# sem -- Semantic Code Intelligence

Entity-level alternative to line-level git diffs. Extracts functions, classes, methods, types from source via tree-sitter, then diffs/blames/tracks at that granularity.

Source: `~/projects/sem` | Install: `brew install sem-cli` | Binary: `sem`

## Core Data Model

### SemanticEntity
```
sem-core/src/model/entity.rs

id:              "path::type::name" or "path::parent::name"
file_path:       String
entity_type:     "function" | "class" | "method" | "struct" | "trait" | ...
name:            String
parent_id:       Option<String>      # methods nested in classes
content:         String              # full source text
content_hash:    String              # xxhash of content
structural_hash: Option<String>      # xxhash of AST (ignores formatting)
start_line:      usize
end_line:        usize
metadata:        Option<HashMap<String, String>>
```

### SemanticChange
```
sem-core/src/model/change.rs

change_type:      Added | Modified | Deleted | Moved | Renamed
entity_type:      String
entity_name:      String
file_path:        String
old_entity_name:  Option<String>
old_file_path:    Option<String>
before_content:   Option<String>
after_content:    Option<String>
structural_change: Option<bool>     # true = AST changed, false = cosmetic only
```

### EntityGraph
```
sem-core/src/parser/graph.rs

entities:     HashMap<String, EntityInfo>       # id -> info
edges:        Vec<EntityRef>                    # from_entity, to_entity, ref_type
dependents:   HashMap<String, Vec<String>>      # reverse: who references entity
dependencies: HashMap<String, Vec<String>>      # forward: what entity references
```

Edge types: `Calls`, `TypeRef`, `Imports`

## Entity Matching (3-phase)

1. **Exact ID match** -- same path::type::name in before/after = modified or unchanged
2. **Structural hash match** -- same AST structure, different name = renamed/moved
3. **Fuzzy similarity** -- >80% token overlap = probable rename

## CLI Commands

```bash
sem diff                              # working changes
sem diff --staged                     # staged only
sem diff --commit abc1234             # specific commit
sem diff --from HEAD~5 --to HEAD      # range
sem diff -v                           # word-level inline diffs
sem diff --format json|plain|markdown
sem diff --file-exts .py .rs          # filter by extension
sem diff file1.ts file2.ts            # arbitrary file comparison
echo '[...]' | sem diff --stdin --format json  # pipe file changes

sem impact authenticateUser           # full impact analysis
sem impact authenticateUser --deps    # direct dependencies only
sem impact authenticateUser --dependents  # direct dependents only
sem impact authenticateUser --tests   # affected tests only
sem impact authenticateUser --file src/auth.ts  # disambiguate

sem blame src/auth.ts                 # entity-level blame
sem log authenticateUser              # entity history
sem log authenticateUser -v --limit 20

sem entities src/auth.ts              # list entities in file
sem context authenticateUser          # LLM context with token budget
sem context authenticateUser --budget 4000

sem setup    # replace git diff globally with sem
sem unsetup  # revert
```

All commands accept `--json` for machine output.

## MCP Server

Binary: `sem-mcp` (crate at `sem/crates/sem-mcp/`)

Config:
```json
{
  "mcpServers": {
    "sem": {
      "command": "sem-mcp"
    }
  }
}
```

### 6 Tools

| Tool | Parameters | Returns |
|------|-----------|---------|
| `sem_entities` | `file_path` | entities array: id, name, type, start_line, end_line, parent_id |
| `sem_diff` | `base_ref?, target_ref?, file_path?` | summary counts + changes array with change_type, entity info, content |
| `sem_blame` | `file_path` | per-entity: author, date, commit, summary |
| `sem_impact` | `file_path, entity_name, mode?("all"\|"deps"\|"dependents"\|"tests")` | dependencies, dependents, transitive impact, affected tests |
| `sem_log` | `entity_name, file_path?, limit?(default 50)` | history: commit, author, date, change_type ("modified (logic)"\|"modified (cosmetic)"\|"added"\|"deleted") |
| `sem_context` | `file_path, entity_name, token_budget?(default 8000)` | prioritized context entries with token estimates |

### MCP Server Internals

`sem-mcp/src/server.rs`: `SemServer` struct holds:
- `context: Arc<Mutex<Option<RepoContext>>>` -- lazy git repo
- `registry: Arc<ParserRegistry>` -- tree-sitter parser plugins
- `entity_cache: Arc<Mutex<EntityCache>>` -- LRU (500 entries)
- `graph_cache: Arc<Mutex<Option<CachedGraph>>>` -- manifest hash + graph + entities

Repo discovery: absolute path hint -> `SEM_REPO` env var -> cwd

## SQLite Cache

Location: `.sem/cache.db` in repo root. Created by MCP server for graph persistence.

```sql
CREATE TABLE files (
    path TEXT PRIMARY KEY,
    mtime_secs INTEGER NOT NULL,
    mtime_nanos INTEGER NOT NULL
);

CREATE TABLE entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    structural_hash TEXT,
    parent_id TEXT,
    metadata_json TEXT
);

CREATE TABLE edges (
    from_entity TEXT NOT NULL,
    to_entity TEXT NOT NULL,
    ref_type TEXT NOT NULL
);
```

Cache strategy: manifest hash (file paths + mtimes) -> memory LRU -> SQLite -> fresh rebuild. WAL mode, synchronous=NORMAL.

`sem-mcp/src/cache.rs` -- `DiskCache` type, `rusqlite` 0.32 with bundled SQLite.

## Entity Extraction

`sem-core/src/parser/plugins/code/`

Per-language config (`languages.rs`):
```rust
LanguageConfig {
    id: &str,
    extensions: &[&str],
    entity_node_types: &[&str],         // "function_declaration", "class_declaration"
    container_node_types: &[&str],      // for nesting
    call_entity_identifiers: &[&str],   // call-based languages (Elixir)
    suppressed_nested_entities: &[...], // exclude local vars
    scope_boundary_types: &[&str],      // prevent crossing scopes
    get_language: fn() -> Option<Language>,
}
```

Process: parse with tree-sitter -> recursive `visit_node()` -> match node types -> extract name + hashes -> handle nesting via parent_id -> compute line ranges.

### Rust Entity Types
functions, structs, enums, impls, traits, mods, consts

### Structured Data
- JSON: RFC 6901 JSON Pointers as identity
- YAML: dot-path notation
- TOML: section/property paths
- CSV: first column as row identity
- Markdown: heading hierarchy
- Vue/Svelte: component blocks + inner TS/JS entities

## Dependency Graph Building (2-pass)

`sem-core/src/parser/graph.rs`

**Pass 1** (parallel via rayon): extract entities from all files, build symbol table (name -> [entity_ids]), build import table (file_path, imported_name -> target_id)

**Pass 2** (parallel): for each entity, extract identifier references from content, resolve against symbol/import tables, skip parent-child pairs, create edges, build dependents/dependencies indexes

Graph ops:
- `get_dependencies(id)` -- direct deps
- `get_dependents(id)` -- direct dependents
- `impact_analysis(id)` -- BFS transitive (cap 10k)
- `test_impact()` -- filter to test entities
- `update_from_changes()` -- incremental on file changes

## Context Budgeting

`sem-core/src/parser/context.rs`

Greedy knapsack priority:
1. Target entity (full content) -- always included
2. Direct dependents (full content) -- while budget allows
3. Transitive dependents (signature only, first line) -- fill remaining

Token estimation: `words * 13 / 10` (~1.3 tokens/word)

## JSON Output Shapes

### sem diff --format json
```json
{
  "summary": { "fileCount": 2, "added": 1, "modified": 1, "deleted": 1, "total": 3 },
  "changes": [{
    "entityId": "src/auth.ts::function::validateToken",
    "changeType": "added",
    "entityType": "function",
    "entityName": "validateToken",
    "filePath": "src/auth.ts",
    "structural_change": true
  }]
}
```

### sem entities --json
```json
[{ "id": "src/auth.ts::function::validateToken", "name": "validateToken", "type": "function", "start_line": 42, "end_line": 55, "parent_id": null }]
```

### sem impact --json
```json
{
  "entity": "authenticateUser", "file": "src/auth.ts", "mode": "all",
  "dependencies": [{ "name": "...", "type": "...", "file": "...", "lines": [42, 55] }],
  "dependents": [...],
  "impact": { "total": 5, "entities": [...] },
  "tests": [...]
}
```

### sem blame --json
```json
{
  "file": "src/auth.ts", "entities": 3,
  "blame": [{ "name": "validateToken", "type": "function", "lines": [42, 55], "author": "Alice Chen", "date": "2024-03-15", "commit": "abc1234f", "summary": "Add token validation" }]
}
```

### sem log --json
```json
{
  "entity": "authenticateUser", "file": "src/auth.ts", "type": "function", "total_changes": 7,
  "changes": [{ "commit": "def5678", "author": "Bob Smith", "date": "2024-04-01", "message": "Refactor auth", "change_type": "modified (logic)" }]
}
```

### sem context --json
```json
{
  "entity": "authenticateUser", "token_budget": 8000, "tokens_used": 3542, "entries": 7,
  "context": [{ "entity": "authenticateUser", "type": "function", "file": "src/auth.ts", "role": "target", "tokens": 245, "content": "..." }]
}
```

## Key File Paths

| Component | Path |
|-----------|------|
| Core library | `~/projects/sem/crates/sem-core/` |
| Data models | `sem-core/src/model/{entity.rs, change.rs, identity.rs}` |
| Entity extraction | `sem-core/src/parser/plugins/code/{entity_extractor.rs, languages.rs}` |
| Dependency graph | `sem-core/src/parser/graph.rs` |
| Context budgeting | `sem-core/src/parser/context.rs` |
| Diff algorithm | `sem-core/src/parser/differ.rs` |
| MCP server | `~/projects/sem/crates/sem-mcp/` |
| MCP tools | `sem-mcp/src/tools.rs` |
| MCP handlers | `sem-mcp/src/server.rs` |
| SQLite cache | `sem-mcp/src/cache.rs` |
| CLI | `~/projects/sem/crates/sem-cli/` |
| CLI commands | `sem-cli/src/commands/{diff,entities,impact,blame,log,context}.rs` |
