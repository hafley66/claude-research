---
name: sprefa-zoom-level-2
description: Detailed implementation roadmap for sprefa's schema redesign and query layer evolution. Task ordering, file mapping, current world state, and rationale for each step.
license: MIT
metadata:
  audience: developers
  workflow: implementation-guide
invocable: true
---

# sprefa zoom level 2: implementation roadmap

## What sprefa is

Cross-codebase pattern extraction engine. Declarative rules in `.sprf` files describe what to extract from git repos (JSON keys, YAML values, AST nodes, imports, etc). Results go into SQLite. Users query with SQL. The thesis: git is the universal substrate across workplaces, sprefa accumulates relational facts on top of git history.

## Current world state (as of 2026-04-04)

### Codebase structure

```
crates/
  extract/   -- Extractor trait, RawRef type. Zero sqlx. Pure.
  js/        -- JS/TS extraction via oxc_parser. Zero sqlx.
  rs/        -- Rust extraction via syn. Zero sqlx.
  rules/     -- .sprf rule compiler, walk engine, query compiler. Zero sqlx.
               query.rs (~700 LOC) compiles Datalog-style queries to SQL CTEs.
  index/     -- File walking, content hashing, parallel extraction. Zero sqlx.
  sprf/      -- Parser (_1_parse.rs), AST (_0_ast.rs), pattern compiler (_2_pattern.rs),
               lowering (_3_lower.rs). The .sprf language frontend.
  schema/    -- SQLite migrations, type definitions. Has sqlx.
  cache/     -- flush.rs (write to DB), resolve.rs (import resolution), 
               match_links.rs, discovery.rs. Has sqlx.
  scan/      -- Scanner orchestrator. Bridges extraction and cache. Has sqlx.
  watch/     -- File change detection, rewrite queries. Has sqlx.
  server/    -- HTTP API for search/status. Has sqlx.
  cli/       -- Entry point. Creates SqlitePool, wires everything.
```

### Current schema (what gets replaced)

13 tables. The pain points:

- `strings` -- deduped string values. Every value goes through here.
- `refs` -- physical locations in files. Points to string_id. 11 columns including span, node_path, ref_kind.
- `repo_refs` -- repo-level metadata strings without file anchor. Parallel to refs.
- `matches` -- semantic layer. Points to ref_id OR repo_ref_id (dual anchor, CHECK constraint). Has rule_name, kind, group_id.
- `match_labels` -- KV store on matches. Only used for scan="repo"|"rev".
- `match_links` -- materialized cross-file edges between matches.

To get a match's string value: `match -> ref (or repo_ref) -> string -> value`. 3 JOINs. COALESCE for the dual anchor. Every query hits this chain. The `builtin_relation()` function in query.rs has two modes (match-ID vs all-string) because of this.

### Current extraction flow

```
Extractor produces Vec<RawRef>     (one per captured value)
  -> ExtractedFile bundles them     (per file, with content_hash)
  -> flush() writes to DB           (strings, refs, matches, match_labels)
     group_id: (file_id, local_group) -> monotonic global counter
  -> match_labels stores scan="repo"|"rev" for discovery
```

The MatchResult from the walk engine is a HashMap of captures -- a TUPLE. flush() shreds it into individual RawRef rows (one per capture), tags them with a local group number, then reassembles via group_id. Every query then re-joins by group_id to reconstruct the tuple. Round trip for nothing.

### Current .sprf syntax

```sprf
rule deploy($SVC, repo($REPO), rev($TAG)) > 
  fs(**/values.yaml) > json({ svc: $SVC, repo: $REPO, tag: $TAG });

check orphan_dep($X) > $.has_kind($X, "dep") not dep_link($X, $_);

query all_deps($A, $C) > dep_to_package($A, $B) all_deps($B, $C);
```

Four statement types: rule, link, query, check. The query/check bodies are custom Datalog that compiles to SQL CTEs via query.rs. 12 `$.` builtins with a registry in `builtin_relation()`.

### What's wrong

1. **EAV shredding**: tuples get shredded into individual match rows, group_id reconstructs them. N-1 self-joins per N-arity rule.
2. **3-hop value resolution**: match -> ref -> string for every read.
3. **Custom query compiler reimplements SQLite**: ~700 LOC for CTE generation, topo-sort, negation, builtin registry. SQLite already does all of this.
4. **match-ID vs string-value split**: builtins need two modes because of the dual-anchor schema.
5. **match_labels as KV store**: only used for scan annotations, should be compile-time metadata.
6. **No in-memory mode**: everything goes through sqlx. Can't run a single-pass extraction without SQLite.

---

## Target architecture

### .sprf syntax (new)

```sprf
rule(deploy_config) >
  fs(**/services.yaml) > json({ services: { $SVC: { image: "repo($REPO):rev($TAG)" } } });

rule(npm_scoped) >
  fs(**/package.json) > json({ dependencies: { "@$SCOPE/$NAME": $_ } });

check(missing_tags) {
  SELECT dc.svc, dc.repo, dc.tag
  FROM deploy_config dc
  LEFT JOIN repo_tags rt ON rt.repo = dc.repo AND rt.tag = dc.tag
  WHERE rt.repo IS NULL;
}
```

Three statement types: `rule(name) > selectors;`, `check(name) { SQL }`, `query(name) { SQL }`.

- No head arg list. Columns inferred from `$VAR`s in body.
- Annotations inline at capture site: `repo($REPO)`, `rev($TAG)`, `file($PATH)`.
- Quoted values with inline patterns: `"$REPO:$TAG"` compiled to regex.
- Post-capture transforms: `$REPO = split($IMAGE, "/", 0)` -- Rust str method dispatch.
- SQL blocks are raw SQL, parser captures as string, hands to SQLite.
- Links removed as concept (just `CREATE TABLE AS SELECT` in SQL).

### Schema (new)

Per-rule SQLite tables. One row per extraction event. Dual ref/str columns.

```sql
CREATE TABLE "infra.deploy_config" (
  id INTEGER PRIMARY KEY,
  svc_ref INTEGER REFERENCES refs(id),  svc_str INTEGER REFERENCES strings(id),
  repo_ref INTEGER REFERENCES refs(id), repo_str INTEGER REFERENCES strings(id),
  tag_ref INTEGER REFERENCES refs(id),  tag_str INTEGER REFERENCES strings(id),
  repo_id INTEGER, file_id INTEGER, rev TEXT
);
```

Two views auto-generated per rule:
- `deploy_config` -- fast path, JOIN strings only for values
- `deploy_config_refs` -- provenance path, JOIN strings + refs for values + spans + node_path

String index (refs/strings tables) stays separate for refactoring/rename/FTS.

Drops: matches, group_id, match_labels, repo_refs, match_links.

### Store trait

```rust
trait Store {
    fn unscanned_repos(&self, table: &str, column: &str) -> Vec<String>;
    fn unscanned_revs(&self, table: &str, column: &str) -> Vec<(String, String)>;
    fn add_repo(&mut self, name: &str, root_path: &str);
    fn add_rev(&mut self, repo: &str, rev: &str);
    fn flush_rule(&mut self, rule: &str, columns: &[&str], rows: Vec<Vec<String>>);
}
```

SqliteStore for persistent mode. MemoryStore for single-run. Discovery loop is generic over `impl Store`.

### Discovery

Compiler collects `Vec<ScanTarget { table, column, kind }>` from `repo()`/`rev()` annotations at parse time. Discovery loop queries annotated columns for unscanned values, clones/fetches, extracts, flushes, repeats until fixpoint. Replaces match_labels.

---

## Implementation sequence

### Phase A: Foundation (no existing code breaks)

#### Step 1: Store trait -- DONE (2026-04-04)
**Status**: Store trait defined as the complete data boundary. SqliteStore implements it.
**What landed**:
- `crates/cache/src/store.rs` -- Store trait with: `ensure_repo`, `ensure_rev`, `flush_batch`, `create_rule_tables`, `unscanned_repos/revs`, `delete_files`, `rename_files`. Domain types: `CaptureEntry`, `ExtractionRow`, `FileResult`, `RuleTableSpec`. Conversion function `to_file_results()` bridges RawRef pipeline to Store input.
- `crates/cache/src/sqlite_store.rs` -- SqliteStore with full `flush_batch` impl: string interning, ref insertion, per-rule table row insertion, file registration. `create_rule_tables` delegates to RuleTableDef DDL. `delete_files`/`rename_files` delegate to flush.rs (transitional).
- `sprefa_extract` promoted from dev-dep to dep in cache/Cargo.toml.
**Design decision**: Store trait uses `impl Future` return types (not `async_trait`), so Scanner uses `S: Store` generics (not `dyn Store`). Works on nightly 1.96.

**What's NOT wired yet** (remaining Step 1 work):
- Scanner still holds `SqlitePool`, not a Store. Needs `store: S` field.
- Scanner still calls `sprefa_cache::flush()` (old path). Needs to also/instead call `store.flush_batch()`.
- `store.create_rule_tables()` not called at startup yet.
- `to_file_results()` conversion not called anywhere yet.
- These 6 cache modules still do raw sqlx outside Store:
  - `flush.rs` -- entire old flush path (absorbed by `flush_batch` once old schema drops)
  - `discovery.rs` -- discover_scan_targets, scanned_revs, log_discovery_batch
  - `match_links.rs` -- resolve_match_links (goes away with SQL blocks)
  - `meta.rs` -- flush_repo_meta (fold into ensure_repo or new Store method)
  - `scan_context.rs` -- load_scan_context, has_stale_scanner_hash (needs Store methods)
  - `resolve.rs` -- resolve_import_targets (goes away or becomes SQL UDF)

#### Step 2: Accept pending snapshots -- DONE (2026-04-04)
All 5 `.snap.new` files accepted.

### Phase B: Schema migration (breaks matches/group_id)

#### Step 3: Per-rule tables + dual views -- PARTIAL (2026-04-04)
**What landed**:
- `crates/schema/src/rule_tables.rs` -- `RuleTableDef` with DDL generation: `create_table_sql()` (creates `{name}_data` table), `create_view_sql()` (creates `{name}` view joining strings for values), `create_refs_view_sql()` (creates `{name}_refs` view joining strings+refs for provenance). `ScanTarget` extraction from annotated columns. `from_matches()` constructor. Tests pass.
- SqliteStore.flush_batch already handles per-rule table INSERT (in sqlite_store.rs).

**What's NOT done yet**:
- Wire `store.create_rule_tables()` call at startup (in CLI after loading ruleset)
- Wire `store.flush_batch()` call after extraction (in Scanner)
- Migrate Scanner from `SqlitePool` to `Store` generic
- Old flush.rs not gutted yet (coexists with Store path)
- matches/match_labels/repo_refs tables not dropped yet (keep until discovery migrated)
- No integration test yet (extract -> per-rule table -> view query)
- **Cut the query engine**: `crates/rules/src/query.rs` (~700 LOC), QueryDef, QueryAtom, builtin_relation(), topo_sort, CTE compilation -- all dead. The relational phase is raw SQL against per-rule views. No custom compiler. This also means `_3_lower.rs` drops `lower_query()` and `lower_link()`, the `DerivedRules` struct loses `query_rules`, and `_0_ast.rs` drops `QueryDecl`/`Atom`/`Term` (replaced by `CheckDecl { name, sql: String }` / `QueryDecl { name, sql: String }`). Links are gone as a language concept (just `CREATE TABLE AS SELECT` in user SQL).

#### Step 4: Discovery via annotated columns
**Problem**: discovery currently reads match_labels WHERE key='scan'. match_labels is gone.
**Action**:
- Compiler collects ScanTarget list from parsed rules' `repo()`/`rev()` annotations
- Store trait gets `unscanned_repos()`/`unscanned_revs()` methods (already designed)
- SqliteStore impl queries annotated columns from per-rule tables
- Discovery loop in scanner.rs becomes generic over Store
**Files**:
- `crates/cache/src/store.rs` -- already has the methods
- `crates/cache/src/sqlite_store.rs` -- implement unscanned_repos/revs queries
- `crates/scan/src/scanner.rs` -- rewrite discovery loop against Store trait
- `crates/cache/src/discovery.rs` -- gut or delete (logic moves to scanner.rs)
**Current state of discovery.rs**: `scanned_revs()` returns HashSet, `log_discovery_batch()` does multi-row INSERT. Match_labels read for scan targets. Replace with: query per-rule table annotated columns, diff against repos/repo_revs.
**Test**: diamond chain E2E test must still pass (4-repo discovery across 3 rounds).
**Why immediately after step 3**: discovery is broken between step 3 and step 4. No window allowed.

### Phase C: Parser changes (breaks .sprf syntax)

#### Step 5: New syntax -- rule(name), headless captures, inline annotations
**Problem**: rule heads repeat variable names. Annotations are separated from capture site. No inline string patterns. No post-capture transforms.
**Action**:
- Change parser: `rule(name) > body;` instead of `rule name(args) > body;`
- Infer columns from `$VAR`s found in body
- Parse annotations inline: `repo($REPO)` in value position
- Parse quoted values with `$VAR` interpolation: `"$REPO:$TAG"` -> regex
- Parse transform atoms: `$OUT = func($IN, args)` after selector chain
- Add transform dispatch in extractor: match func name -> str method call
**Files**:
- `crates/sprf/src/_0_ast.rs` -- RuleDecl loses head args, gains TransformAtom. Statement enum: Rule, Check (raw SQL), Query (raw SQL).
- `crates/sprf/src/_1_parse.rs` -- `rule(name)` parsing. Inline annotation detection. Quoted pattern regex compilation. Transform atom parsing.
- `crates/sprf/src/_2_pattern.rs` -- quoted value patterns: scan for `$VAR` inside quotes, compile surrounding literals to regex with named capture groups.
- `crates/rules/src/extractor.rs` -- apply_transform() dispatch table: split, strip_prefix, to_lowercase, trim, re, etc. Runs between walk and flush.
**Current state of _1_parse.rs**: recursive descent. Handles `rule name(args) > slots;` where slots are `tag(body)` separated by `>`. Also handles `link(...)`, `query name(args) > atoms;`, `check name(args) > atoms;`. The query/check parsing and Atom struct go away in step 6.
**Current state of _2_pattern.rs**: `parse_json_body()` handles `{ key: $VAR }`, `{ $K: $V }`, `{ key: [...$ITEM] }`, `{ **: ... }`, `{ re:pattern: $V }`, `{ glob_*: $V }`. Needs extension for quoted value patterns.
**Test**: parse new syntax, lower, extract against test fixtures. All existing rule patterns must still work.
**Why now**: parser must change before SQL blocks can be added (the query/check Atom parsing code needs to die first to avoid conflicts).

#### Step 6: SQL blocks -- check(name) { SQL }, query(name) { SQL }
**Problem**: query.rs is ~700 LOC reimplementing SQLite. Custom Datalog compiler for CTEs, negation, builtins.
**Action**:
- Parser: `check(name) { ... }` captures everything between braces as raw SQL string
- Parser: `query(name) { ... }` same
- AST: CheckDecl and QueryDecl hold name + raw SQL string
- CLI: `sprefa check` iterates all CheckDecls, executes SQL, prints rows, exits 1 if any non-empty
- Delete or gut: query.rs (CTE compiler, builtin_relation(), topo_sort, compile_body_select, etc.)
- Delete: QueryAtom, the entire Datalog body compilation pipeline
**Files**:
- `crates/sprf/src/_1_parse.rs` -- add brace-delimited SQL block parsing
- `crates/sprf/src/_0_ast.rs` -- CheckDecl { name, sql: String }, QueryDecl { name, sql: String }
- `crates/rules/src/query.rs` -- delete CTE compiler, builtin registry, negation compilation
- `crates/rules/src/types.rs` -- delete QueryDef, QueryAtom
- `crates/cli/src/main.rs` -- `sprefa check` runs raw SQL, report violations
**Current state of query.rs**: `compile_query_with_deps()` -> `topo_sort()` -> `compile_cte()` per query -> `compile_body_select()` with positive/negated atom handling -> `compile_final_select()` with match-ID or all-string resolution -> `builtin_relation()` registry of 12 builtins. All of this goes away.
**Test**: write check blocks in .sprf, run against extracted data, verify violations detected. OpenAPI E2E test rewritten to use SQL check block.
**Why now**: can't delete query.rs until SQL blocks exist as replacement.

### Phase D: Polish (independent, any order)

#### Step 7: SQLite UDFs
**Problem**: string operations (regex, split) and contextual lookups (repo_name, file_path) need to be available in SQL blocks.
**Action**: register custom functions at connection open.
- `re_extract(text, pattern, group)` -- regex capture
- `split_part(text, delim, index)` -- string split  
- `fzy_score(a, b)` -- fuzzy match score
- `repo_name(repo_id)` -- lookup
- `file_path(file_id)` -- lookup
- `file_hash(file_id)` -- xxh3 content hash
- Auto-create views: repo_tags, repo_branches, repo_revs_all
**Files**:
- `crates/schema/src/connection.rs` -- UDF registration + metadata view creation
**Independent**: UDFs enhance SQL blocks but nothing depends on them.

#### Step 8: File-scoped namespaces
**Problem**: multiple .sprf files might define rules with same names. Need isolation.
**Action**: `ATTACH DATABASE ':memory:' AS {filename}` per .sprf file. Rule tables created in file's schema. Temp views alias bare names for SQL blocks.
**Files**:
- `crates/schema/src/connection.rs` -- ATTACH per .sprf file
- `crates/cache/src/sqlite_store.rs` -- schema-qualified table names in DDL/INSERT
**Depends on**: SQL blocks (step 6) existing so namespace resolution matters.

#### Step 9: sprf_meta -- rule change detection
**Problem**: re-extracting everything on every run is wasteful at 500 repos.
**Action**: `sprf_meta` table with schema_hash + extract_hash per rule. Compare on startup, skip unchanged rules.
**Files**:
- `crates/schema/src/migrations.rs` -- sprf_meta table
- `crates/scan/src/scanner.rs` -- hash comparison before extraction
**Depends on**: per-rule tables (step 3) existing.

#### Step 10: MemoryStore
**Problem**: can't run single-pass extraction without SQLite.
**Action**: implement Store trait with HashSets/HashMaps. No sqlx dependency.
**Files**:
- NEW `crates/cache/src/memory_store.rs`
- `crates/cli/src/main.rs` -- flag to select store mode
**Depends on**: Store trait (step 1).

---

## Key design decisions and rationale

**Per-rule tables over unified facts table**: avoids EAV self-joins. One row per extraction event. SQLite handles hundreds of tables fine. NULL columns cost 1 byte.

**Dual ref/str columns**: str_id for fast query reads (1 JOIN to strings), ref_id for LSP provenance (span, node_path). Can't recover ref from str alone (ambiguous when same string appears multiple times in same file).

**Raw SQL over custom query compiler**: SQL is a solved problem. The custom compiler was reimplementing CTE generation, negation (NOT EXISTS), recursion (WITH RECURSIVE), and would need to grow aggregation, window functions, etc. Users know SQL. SQLite IS the query engine.

**LEFT JOIN + IS NULL over NOT EXISTS**: anti-join pattern, no correlated subqueries.

**Store trait over direct sqlx**: enables in-memory mode for single-run passes. Discovery algorithm doesn't know which Store it's using.

**Annotations inline at capture site**: `repo($REPO)` in the JSON pattern, not in a separate head declaration. Eliminates variable name repetition. Flush-time directives colocated with the data source.

**File-scoped namespaces via ATTACH**: SQLite's own schema resolution handles name isolation. No string rewriting of SQL blocks.

**Rule unions**: same `rule(name)` with same `$VAR` set = same table. Shape-checked at compile time. Different names, same shape = user writes UNION ALL view in SQL.

**Wide tables for branching**: union of all `$VAR`s across branches. NULLs for non-matching branch columns (1 byte each). COALESCE in SQL to query across branches.
