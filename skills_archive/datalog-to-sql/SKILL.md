---
name: datalog-to-sql
description: Compiling Datalog rules to SQL queries -- rule bodies as JOINs, recursion as WITH RECURSIVE, negation as NOT EXISTS, semi-naive as INSERT WHERE NOT EXISTS. The translation from logic programs to relational queries.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Datalog to SQL Compilation

Every datalog construct has a direct SQL translation. This skill covers the mechanical compilation from rules to queries.

## Basic Rule → SELECT

A rule with one body literal is a direct SELECT:

```datalog
js_file(Path) :- file(Path, _, "js", _).
```

```sql
SELECT f.path FROM files f WHERE f.ext = 'js';
```

Each body literal becomes a FROM clause table. Constants become WHERE conditions.

## Multi-Literal Bodies → JOINs

Shared variables across literals become equi-join conditions:

```datalog
grandparent(X, Z) :- parent(X, Y), parent(Y, Z).
```

```sql
SELECT p1.parent AS x, p2.child AS z
FROM parent p1
JOIN parent p2 ON p1.child = p2.parent;
```

The compilation rule: each body literal gets a table alias. Each variable that appears in multiple literals generates a join condition (alias1.col = alias2.col). Variables appearing once are projected or ignored.

Three-literal example:

```datalog
uses_dep_of(A, C) :-
  match(A, _, import_name, N, _),
  match(B, _, export_name, N, _),
  match(B, _, dep_name, N2, _),
  match(C, _, package_name, N2, _).
```

```sql
SELECT m1.repo AS a, m4.repo AS c
FROM matches m1
JOIN matches m2 ON m1.norm = m2.norm
  AND m2.kind = 'export_name'
JOIN matches m3 ON m2.repo = m3.repo
  AND m3.kind = 'dep_name'
JOIN matches m4 ON m3.norm = m4.norm
  AND m4.kind = 'package_name'
WHERE m1.kind = 'import_name';
```

## Multiple Rules → UNION ALL

Two rules with the same head predicate compile to UNION ALL:

```datalog
reachable(X, Y) :- edge(X, Y).
reachable(X, Y) :- edge(X, Z), reachable(Z, Y).
```

Base case:
```sql
SELECT x, y FROM edge
```

Both (non-recursive form, single iteration):
```sql
SELECT x, y FROM edge
UNION ALL
SELECT e.x, r.y FROM edge e JOIN reachable r ON e.y = r.x;
```

## Recursion → WITH RECURSIVE

Recursive datalog rules compile to recursive CTEs:

```datalog
ancestor(X, Y) :- parent(X, Y).
ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).
```

```sql
WITH RECURSIVE ancestor(x, y) AS (
  -- Base case: first rule
  SELECT parent, child FROM parent
  UNION
  -- Recursive case: second rule
  SELECT p.parent, a.y
  FROM parent p
  JOIN ancestor a ON p.child = a.x
)
SELECT * FROM ancestor;
```

SQLite's recursive CTE terminates when an iteration produces no new rows -- this is exactly the fixpoint condition of bottom-up datalog evaluation.

**Transitive closure** (the most common recursive pattern):

```datalog
reach(X, Y) :- edge(X, Y).
reach(X, Y) :- reach(X, Z), edge(Z, Y).
```

```sql
WITH RECURSIVE reach(x, y) AS (
  SELECT src, dst FROM edge
  UNION
  SELECT r.x, e.dst
  FROM reach r
  JOIN edge e ON r.y = e.src
)
SELECT * FROM reach;
```

**Rooted transitive closure** (from a specific starting point -- much faster):

```datalog
?- reach(start_node, Y).
```

```sql
WITH RECURSIVE reach(y) AS (
  SELECT dst FROM edge WHERE src = 'start_node'
  UNION
  SELECT e.dst FROM reach r JOIN edge e ON r.y = e.src
)
SELECT * FROM reach;
```

The query planner can push the starting point into the base case, making this O(reachable) instead of O(all edges).

## Negation → NOT EXISTS

Stratified negation compiles to correlated NOT EXISTS:

```datalog
dead_export(X) :- match(_, _, export_name, X, _), \+ match(_, _, import_name, X, _).
```

```sql
SELECT m1.value AS x
FROM matches m1
WHERE m1.kind = 'export_name'
AND NOT EXISTS (
  SELECT 1 FROM matches m2
  WHERE m2.kind = 'import_name'
  AND m2.norm = m1.norm
);
```

The stratification guarantee means the negated subquery only references fully-computed relations. In SQL terms: the subquery doesn't reference the outer query's CTE recursively through negation.

**Negation with bound variables**:

```datalog
missing_in_repo(Name, Repo) :-
  match(_, _, package_name, Name, _),
  repo(Repo),
  \+ match(Repo, _, dep_name, Name, _).
```

```sql
SELECT m.value AS name, r.name AS repo
FROM matches m
CROSS JOIN repos r
WHERE m.kind = 'package_name'
AND NOT EXISTS (
  SELECT 1 FROM matches m2
  WHERE m2.kind = 'dep_name'
  AND m2.norm = m.norm
  AND m2.repo = r.name
);
```

## Semi-Naive → INSERT WHERE NOT EXISTS

For materializing derived relations incrementally (the pattern sprefa uses):

```datalog
% Materialize: for each new fact in edge/reach, derive new reach facts
reach(X, Y) :- edge(X, Y).
reach(X, Y) :- reach(X, Z), edge(Z, Y).
```

One iteration of semi-naive evaluation:

```sql
INSERT INTO reach(x, y)
SELECT e.src, e.dst FROM edge e
WHERE NOT EXISTS (
  SELECT 1 FROM reach r WHERE r.x = e.src AND r.y = e.dst
);

INSERT INTO reach(x, y)
SELECT r.x, e.dst
FROM reach r
JOIN edge e ON r.y = e.src
WHERE NOT EXISTS (
  SELECT 1 FROM reach r2 WHERE r2.x = r.x AND r2.y = e.dst
);
```

Run in a loop until both INSERTs affect 0 rows. This is the fixpoint.

With `INSERT OR IGNORE` and a UNIQUE constraint on (x, y), the WHERE NOT EXISTS is implicit:

```sql
-- Simpler with unique constraint
INSERT OR IGNORE INTO reach(x, y)
SELECT e.src, e.dst FROM edge e;

INSERT OR IGNORE INTO reach(x, y)
SELECT r.x, e.dst FROM reach r JOIN edge e ON r.y = e.src;
```

Loop until `changes() = 0`. This is exactly what `resolve_match_links` does in sprefa.

## Constants and Filters → WHERE

Ground terms (constants) in body literals compile to WHERE equality:

```datalog
ts_file(F) :- file(_, F, _, "ts", _).
helm_file(F) :- file(_, F, _, "yaml", "helm/templates").
```

```sql
SELECT f.path FROM files f WHERE f.ext = 'ts';
SELECT f.path FROM files f WHERE f.ext = 'yaml' AND f.dir = 'helm/templates';
```

Comparisons compile to WHERE conditions:

```datalog
large_file(F, Size) :- file_size(F, Size), Size > 10000.
```

```sql
SELECT f.path, f.size FROM file_size f WHERE f.size > 10000;
```

## Aggregation → GROUP BY

```datalog
dep_count(Repo, N) :- N = count : { match(Repo, _, dep_name, _, _) }.
max_tag(Repo, T) :- T = max V : { tag(Repo, V) }.
```

```sql
SELECT m.repo, COUNT(*) AS n
FROM matches m WHERE m.kind = 'dep_name'
GROUP BY m.repo;

SELECT t.repo, MAX(t.tag_name) AS t
FROM git_tags t GROUP BY t.repo;
```

Aggregates must be stratified: the aggregated relation must be fully computed before the aggregate runs. In SQL this is natural -- GROUP BY operates on a complete result set.

## The Compilation Pipeline

```
source text
    │
    ▼
  parse (pest/winnow)
    │
    ▼
  AST: Vec<Rule>
    │
    ▼
  stratify (topological sort, reject if negative cycle)
    │
    ▼
  strata: Vec<Vec<Rule>>
    │
    ▼
  for each stratum:
    for each IDB predicate P in stratum:
      collect all rules with head P
      compile each rule body → SELECT
      UNION ALL the SELECTs
      if recursive: wrap in WITH RECURSIVE
      if materializing: wrap in INSERT ... WHERE NOT EXISTS
    │
    ▼
  Vec<SqlStatement>
```

## SQLite-Specific Considerations

**Recursive CTE limits**: SQLite defaults to 1000 recursion depth. Override with `PRAGMA recursive_triggers` or increase the limit. For datalog fixpoint, this is rarely hit unless the graph is very deep.

**No EXCEPT ALL**: SQLite's EXCEPT does set difference (deduplicates). For datalog semantics this is fine -- datalog operates on sets, not bags.

**INSERT OR IGNORE**: SQLite's conflict resolution works perfectly for semi-naive. Define a UNIQUE constraint, use INSERT OR IGNORE, check `changes()` for the fixpoint test.

**FTS integration**: SQLite's FTS5 can participate in joins. A datalog literal like `fts_match(StringId, Query)` compiles to a JOIN against the FTS virtual table:

```sql
JOIN strings_fts fts ON fts.rowid = s.id WHERE fts.norm MATCH ?
```

## Performance

**Indexed joins**: the compiled SQL is fast when join columns are indexed. For a rule like `match(R, _, K1, N, _), match(R, _, K2, N, _)`, an index on `(kind, norm)` makes the join efficient.

**Cross-products**: under-constrained rules produce cross-products. A rule with two unrelated body literals generates a CROSS JOIN, which is O(n*m). The safety condition prevents infinite results but not large intermediate results.

**Rule ordering**: the SQL planner handles join ordering, but the datalog compiler can help by placing more selective literals first in the FROM clause.

**Materialization vs on-demand**: IDB predicates used in multiple places benefit from materialization (INSERT into a temp table). One-shot queries benefit from inline CTEs. The choice is a cost-based decision.

## Correspondence Table

| Datalog | SQL |
|---------|-----|
| Fact `p(a, b).` | `INSERT INTO p VALUES ('a', 'b')` |
| Rule body literal `p(X, Y)` | `FROM p` with alias |
| Shared variable `X` across literals | `ON p1.x = p2.x` (equi-join) |
| Constant in literal `p(X, "foo")` | `WHERE p.y = 'foo'` |
| Multiple rules, same head | `UNION ALL` |
| Recursive rule | `WITH RECURSIVE` |
| Negation `\+ p(X)` | `NOT EXISTS (SELECT 1 FROM p WHERE ...)` |
| Aggregate `count : { p(X, _) }` | `COUNT(*) ... GROUP BY` |
| Query `?- p(X, Y).` | `SELECT x, y FROM p` |
| Safety condition | Every SELECT column comes from a FROM table |
| Fixpoint | Loop INSERT OR IGNORE until changes() = 0 |
| Stratification | Evaluate strata in dependency order |
