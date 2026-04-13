---
name: datalog-dsl-design
description: Designing a Datalog DSL that compiles to SQL -- embedding foreign patterns (regex, AST, globs), built-in relations over database tables, incremental materialization, parser and compiler pipeline design.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Designing a Datalog DSL Compiled to SQL

How to design a domain-specific datalog language where the backend is SQLite and the domain is source code metadata (strings, files, matches, links).

## The Design Space

Pure datalog syntax is minimal: `head :- body.` The question is how much to add.

**Spectrum**:
```
Raw Horn clauses  →  Souffle (typed, components)  →  QL/CodeQL (OO, classes)
    minimal              practical                       familiar to devs
    hard to read         good sweet spot                 complex to implement
```

For a DSL compiled to SQL, the Souffle level is the right target: typed declarations, aggregation, but no OO class hierarchy.

## Built-In Relations

The EDB is the existing database schema, exposed as named relations:

```datalog
% Built-in EDB relations (backed by SQL tables)
.decl file(repo: symbol, path: symbol, stem: symbol, ext: symbol, dir: symbol)
.decl match(repo: symbol, file: symbol, kind: symbol, value: symbol, norm: symbol)
.decl link(src_id: number, tgt_id: number, label: symbol)
.decl tag(repo: symbol, tag_name: symbol)
.decl branch(repo: symbol, branch_name: symbol)
.decl repo(name: symbol)
```

Users don't write `.input` directives for these -- they exist automatically. The compiler knows their schemas and maps them to SQL tables.

## Extraction Rules: Embedding Foreign Patterns

The core challenge: a datalog DSL for code analysis needs to embed regex, AST patterns (tree-sitter/ast-grep), and file globs.

### Option A: String Literals with Prefixed Built-In Predicates

```datalog
% Built-in predicates that invoke extractors
extract(File, Kind, Value) :-
    file(_, File, _, "ts", _),
    re_match(File, "import\\s+\\{(.+)\\}\\s+from", Value),
    Kind = "import_name".
```

Pro: pure datalog syntax, no extensions. Con: regex escaping in strings is painful, multi-line patterns are unreadable.

### Option B: Tagged Delimiters

```datalog
extract(File, import_name, Name) :-
    file(_, File, _, "ts", _),
    ast |import { $Name } from '$_'| in File.

extract(File, image_repo, Value) :-
    file(_, File, _, "yaml", Dir),
    Dir = "helm/templates",
    re |image:\s*(.+)| in File as Value.
```

The `|...|` delimiters contain raw pattern text. The `ast` or `re` prefix selects the pattern engine. `in File` binds the file to search. Capture variables (`$Name`, group 1) bind to datalog variables.

Pro: patterns are readable, no escaping. Con: new syntax -- the parser needs to handle delimiters.

### Option C: Separate Pattern Blocks

```datalog
.pattern js_import lang=typescript
    import { $$$NAMES } from '$SOURCE'
.end

.pattern yaml_image
    re: image:\s*(.+)
.end

extract(File, import_name, Name) :-
    file(_, File, _, "ts", _),
    js_import(File, Name, _).

extract(File, image_repo, Value) :-
    file(_, File, _, "yaml", "helm/templates"),
    yaml_image(File, Value).
```

Pro: clean separation, patterns are declared once and reused. Con: verbose, indirection.

### Option D: Pipe Blocks (d2-style, recommended)

```datalog
extract(File, import_name, Name) :-
    file(_, File, _, "ts", _),
    File matches ast |
        import { $$$Name } from '$_'
    |.

extract(File, dep_name, Name) :-
    file(_, File, "package", "json", _),
    File matches jq |
        .dependencies | keys[]
    | as Name.
```

Multi-line patterns use pipe-delimited blocks. Single-line patterns use inline pipes: `re |pattern|`. The delimiter is `|` on its own line for multi-line, or `|...|` inline.

This is the d2 approach (d2lang.com uses `|` for multi-line text blocks). It avoids backtick nesting and is unambiguous in the grammar.

**Grammar addition**:
```
pattern_literal = pattern_type "|" content "|"
                | pattern_type "|" NEWLINE content_lines NEWLINE "|"
pattern_type    = "ast" | "re" | "jq" | "ast-rule"
```

## Rule Heads as Materialization

A rule head can be:
1. **Query-only** (IDB, not stored): useful for ad-hoc exploration
2. **Materialized** (INSERT into a table): useful for derived relations that other rules depend on

Convention: rules in a `.rules` file are materialized. Rules in a query (interactive REPL or `sprefa query`) are query-only.

```datalog
% In a rules file: materialized
dep_link(Src, Tgt) :-
    match(_, _, dep_name, N, _) as Src,
    match(_, _, package_name, N, _) as Tgt.

% In a query: not materialized, just returns results
?- match(_, _, export_name, N, _), \+ dep_link(_, N).
```

The compiler emits:
- Rules file: `INSERT OR IGNORE INTO match_links SELECT ...`
- Query: `SELECT ... FROM ...`

## Compilation Pipeline

```
source.dl
    │
    ├─ parse (pest/winnow, ~400 lines)
    │      └─ AST: Vec<Declaration | Rule | Query>
    │
    ├─ resolve built-ins
    │      └─ map relation names to SQL table schemas
    │
    ├─ type check
    │      └─ verify arity, column types match declarations
    │
    ├─ safety check
    │      └─ every head variable appears in a positive body literal
    │
    ├─ stratify
    │      └─ topological sort on dependency graph
    │      └─ reject negative cycles
    │
    ├─ plan
    │      └─ for each stratum, for each IDB predicate:
    │         - collect rules with that head
    │         - compile each body → SELECT
    │         - UNION ALL multiple rules
    │         - wrap recursive rules in WITH RECURSIVE or fixpoint loop
    │
    └─ emit SQL
           └─ Vec<String> of SQL statements
```

### Parser Grammar (pest sketch)

```pest
program = { SOI ~ (declaration | rule | query | pattern_decl)* ~ EOI }

declaration = { ".decl" ~ ident ~ "(" ~ typed_args ~ ")" }
typed_args  = { typed_arg ~ ("," ~ typed_arg)* }
typed_arg   = { ident ~ ":" ~ type_name }
type_name   = { "symbol" | "number" | ident }

rule  = { head ~ ":-" ~ body ~ "." }
query = { "?-" ~ body ~ "." }

head = { atom ~ ("as" ~ ident)? }
body = { literal ~ ("," ~ literal)* }

literal = { pos_literal | neg_literal | comparison | pattern_match }
pos_literal = { atom }
neg_literal = { "\\+" ~ atom }
comparison  = { term ~ cmp_op ~ term }
pattern_match = { ident ~ "matches" ~ pattern_literal }

atom = { ident ~ "(" ~ terms ~ ")" }
terms = { term ~ ("," ~ term)* }
term = { variable | string | number | "_" }
variable = @{ ASCII_ALPHA_UPPER ~ (ASCII_ALPHANUMERIC | "_")* }
ident = @{ ASCII_ALPHA_LOWER ~ (ASCII_ALPHANUMERIC | "_")* }

pattern_literal = { pattern_type ~ "|" ~ pattern_content ~ "|" }
pattern_type = { "ast" | "re" | "jq" | "ast-rule" }
pattern_content = { (!"|" ~ ANY)* }

cmp_op = { "=" | "!=" | "<" | ">" | "<=" | ">=" }
```

Estimated implementation: ~400 lines for the grammar + parse tree, ~300 lines for the compiler.

## Incremental Evaluation via SQL

Semi-naive evaluation maps directly to the INSERT OR IGNORE + fixpoint pattern:

```rust
loop {
    let mut changed = false;
    for stratum in &strata {
        for sql in &stratum.insert_statements {
            let rows = sqlx::query(sql).execute(&pool).await?;
            if rows.rows_affected() > 0 {
                changed = true;
            }
        }
    }
    if !changed { break; }
}
```

Each `insert_statement` is:
```sql
INSERT OR IGNORE INTO derived_relation(col1, col2)
SELECT ...
FROM ...
WHERE ... ;
```

The UNIQUE constraint on the target table + INSERT OR IGNORE gives semi-naive semantics: only new tuples are inserted, duplicates are silently ignored, and `rows_affected()` tells you if anything changed.

## Negation Compilation

Stratified negation compiles to NOT EXISTS:

```datalog
dead_export(Name) :-
    match(_, _, export_name, Name, _),
    \+ match(_, _, import_name, Name, _).
```

```sql
SELECT m1.value AS name
FROM matches m1
WHERE m1.kind = 'export_name'
AND NOT EXISTS (
    SELECT 1 FROM matches m2
    WHERE m2.kind = 'import_name'
    AND m2.norm = m1.norm
);
```

The compiler must verify stratification at compile time:
1. Build predicate dependency graph
2. Mark edges through `\+` as negative
3. Find SCCs. Reject if any SCC has a negative edge.

## Aggregation Compilation

```datalog
dep_count(Repo, N) :- N = count : { match(Repo, _, dep_name, _, _) }.
```

```sql
SELECT m.repo, COUNT(*) AS n
FROM matches m
WHERE m.kind = 'dep_name'
GROUP BY m.repo;
```

The `count : { ... }` syntax wraps a sub-goal in GROUP BY. The grouped variables are those that appear both inside and outside the aggregate.

## Error Messages

Good errors for common mistakes:

**Unsafe rule** (variable in head not in positive body):
```
error: variable Z in head of rule is not bound by any positive body literal
  --> rules.dl:5:15
  |
5 | bad(X, Z) :- thing(X).
  |        ^ Z is not range-restricted
  |
  = help: every head variable must appear in at least one positive body literal
```

**Unstratifiable negation**:
```
error: negation cycle detected -- program is unstratifiable
  --> rules.dl:3:1
  |
3 | p(X) :- q(X), \+ p(X).
  | ^^^ p depends negatively on itself
  |
  = note: p -> (neg) p forms a cycle
  = help: restructure rules so negation only references lower strata
```

**Arity mismatch**:
```
error: relation 'match' expects 5 arguments, found 3
  --> rules.dl:7:5
  |
7 |     match(Repo, Kind, Value),
  |     ^^^^^^^^^^^^^^^^^^^^^^^^ expected match(repo, file, kind, value, norm)
```

## Testing Strategy

Property: for every datalog rule, the compiled SQL must produce the same result set as naive bottom-up evaluation.

Test approach:
1. Write rules in the DSL
2. Compile to SQL, execute against test database
3. Also evaluate using a reference Rust datalog evaluator (crepe or datafrog)
4. Assert result sets are equal

```rust
#[test]
fn transitive_closure_matches_reference() {
    let db = setup_test_db();
    insert_edges(&db, &[(1,2), (2,3), (3,4)]);

    // Compiled SQL
    let sql_results = execute_compiled_rules(&db, "
        reach(X, Y) :- edge(X, Y).
        reach(X, Y) :- reach(X, Z), edge(Z, Y).
    ");

    // Reference (crepe)
    let ref_results = crepe_transitive_closure(&[(1,2), (2,3), (3,4)]);

    assert_eq!(sql_results, ref_results);
}
```

## Design Decisions Summary

| Decision | Recommendation | Reason |
|----------|---------------|--------|
| Syntax | Souffle-like (typed decls, `:-` rules) | Familiar, well-specified |
| Pattern embedding | Pipe-delimited blocks | Readable, no escaping |
| Type system | Minimal (symbol, number) | SQLite is dynamically typed anyway |
| Negation | Stratified `\+` | Sound, compile-time verifiable |
| Aggregation | `count/min/max/sum : { ... }` | Matches Souffle, compiles to GROUP BY |
| Materialization | Rules file = INSERT, query = SELECT | Clear semantics |
| Incrementality | INSERT OR IGNORE + fixpoint loop | Simple, correct, uses SQLite features |
| Parser | pest or winnow, ~400 lines | Small grammar, good error reporting |
| Compiler | ~300 lines rule → SQL | Mechanical translation |
