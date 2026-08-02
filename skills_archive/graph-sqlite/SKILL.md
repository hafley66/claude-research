---
name: graph-sqlite
description: SQLite-native graph reachability for sprefa's v6 graph layer. Recursive CTEs replace 4 of sprefa's 6 graph functions with zero new dependencies, verified on the real 261,704-edge rel_df_edge table. Load when designing or querying reachability/halt-BFS/multi-source-walk over data already living in a SQLite rel table, or when evaluating ext/misc/closure.c or graphqlite as candidates.
---

# graph-sqlite

Verified 2026-07-19 against the real sprefa db
(`~/.local/state/sprefa/roots/fbabddda40d22347/db.sqlite`, `rel_df_edge`:
261,704 rows, `WITHOUT ROWID`, `PRIMARY KEY("from","to")`). Full labs:
`~/projects/claude-research/labs/graph-sqlite/`. Full writeup:
`~/projects/claude-research/commands/graph-libs/sqlite-native/`.

## Verdict

Write `WITH RECURSIVE` CTEs directly against existing `rel_*` tables. Zero
new dependency, sub-millisecond on real data, exact semantic match to
sprefa's Rust `walk.rs`/`scc.rs` for 4 of 6 functions. Do not reach for
`ext/misc/closure.c` (dead in a normal build) or `graphqlite` (needs its
own 14-table schema, not a query layer over `rel_*`). SCC stays in Rust.

## Hypothesis verdict table

| # | hypothesis | verdict | number |
|---|---|---|---|
| H1 | recursive CTE baseline | CONFIRMED | 0.23-0.31ms single-seed unbounded, 261,704 real edges |
| H2 | halt predicate in CTE `WHERE` on the recursive term | CONFIRMED, decisive | 7/7 walk.rs parity + 12-node proof, exact |
| H2b | min-depth-wins (`GROUP BY node, MIN(depth)`) cost | CONFIRMED cheap | 5.8-13.6% overhead |
| H3 | multi-source + depth cap, one CTE | CONFIRMED | 10.8x vs 1000-seed Python loop |
| H4 | `ext/misc/closure.c` | REFUTED for adoption | dead by default (`SQLITE_TEST` gate); matches H1 once force-built |
| H5 | CTE vs `rel_port_reach` (engine's materialized table) | CONFIRMED equal, CTE slower | 10/10 ports exact; 2.19ms read vs 14.3ms recompute (6.6x) |
| H6 | SCC in SQL | mostly negative | predicate correct, full SCC is Theta(V^2) |
| H7 | graphqlite | REFUTED for adoption | builds; needs own 14-table property-graph schema |
| H8 | CSR-vs-CTE crossover | ESTIMATE | ~6-13 queries (est.); 6.6x measured one layer up (H5) |

## Six-function replacement table

| sprefa fn (scc.rs / walk.rs) | SQLite-native form | verdict |
|---|---|---|
| `tarjan` | none | stays in Rust (H6: fixpoint CTE can't mutate-on-backtrack) |
| `build_condensed` | none | stays in Rust |
| `count_pairs` | mutual-reach predicate correct, Theta(V^2) at scale | stays in Rust |
| `reaches_from` | `WITH RECURSIVE reach(node) AS (...)`, dedup on node | YES |
| `reached_by` | same CTE, `from`/`to` swapped | YES |
| `multi_source_walk` | multi-seed CTE + `GROUP BY node, MIN(depth)` | YES |
| `multi_source_halt_bfs` | halt-set exclusion in the RECURSIVE term's `WHERE` | YES (the decisive result) |

## Working SQL (all ran, all verified against real data or a hand-built proof)

Forward reach, unbounded, dedup by node only (NOT depth, see trap below):
```sql
WITH RECURSIVE reach(node) AS (
    SELECT :seed
    UNION
    SELECT edge."to" FROM reach JOIN rel_df_edge edge ON edge."from" = reach.node
)
SELECT count(*) FROM reach
```

Depth-capped, correct node count (see trap: raw `count(*)` over-counts):
```sql
WITH RECURSIVE reach(node, depth) AS (
    SELECT :seed, 0
    UNION
    SELECT edge."to", reach.depth + 1
      FROM reach JOIN rel_df_edge edge ON edge."from" = reach.node
     WHERE reach.depth < :cap
)
SELECT node, min(depth) AS depth FROM reach GROUP BY node
```

Halt predicate (the operation no in-memory Rust library evaluated so far
provides cleanly): put the exclusion on the RECURSIVE term, not the base
term, not the outer `SELECT`:
```sql
WITH RECURSIVE reach(tag, node) AS (
    SELECT tag, node FROM starts
    UNION
    SELECT reach.tag, edge."to"
      FROM reach JOIN edge ON edge."from" = reach.node
     WHERE reach.node NOT IN (SELECT node FROM halt_set)
)
SELECT tag, node FROM reach
```
Proven exact against all 7 of walk.rs's own `multi_source_halt_bfs` test
cases plus a fresh 12-node graph with a diamond re-entry and a cycle. A
halted node's DIRECT children are never visited (the Rust `continue` in
`multi_source_walk` fires before touching `adj[mid]` at all) -- not merely
its grandchildren; a first draft of the 12-node proof assumed the weaker
semantics and the assertion failure caught it.

Multi-source, batched (10.8x faster than a per-seed loop at 1000 seeds):
```sql
WITH RECURSIVE reach(tag, node, depth) AS (
    SELECT column1 AS tag, column2 AS node, column3 AS depth FROM (VALUES ...)
    UNION
    SELECT reach.tag, edge."to", reach.depth + 1
      FROM reach JOIN rel_df_edge edge ON edge."from" = reach.node
     WHERE reach.depth < :cap
)
SELECT tag, node, min(depth) FROM reach GROUP BY tag, node
```

SCC predicate only (NOT full SCC computation -- Theta(V^2) at scale):
```sql
WITH RECURSIVE
reach(src, dst) AS (
    SELECT "from", "to" FROM edge
    UNION
    SELECT reach.src, edge."to" FROM reach JOIN edge ON edge."from" = reach.dst
)
SELECT forward.src AS member, forward.dst AS co_member FROM reach forward
JOIN reach backward ON backward.src = forward.dst AND backward.dst = forward.src
```

## Traps, quoted verbatim

**Depth-tracking + "unbounded" never converges on a cycle.** `UNION`
dedups on the WHOLE row; a `(node, depth)` row is never a duplicate across
a cycle traversal, so depth keeps incrementing forever. Measured: 363
distinct nodes convergent in 6.23ms via `reach(node)`; the SAME reachable
set via `reach(node, depth)` capped at depth<200 produces 12,802 rows and
is still growing linearly. Uncapped, it did not terminate in 60s and was
killed. Fix: dedup unbounded queries on node identity alone; only ever
carry depth together with a `WHERE`-clause cap.

**`count(*)` on a depth-tracked CTE over-counts a node reached at two path
lengths.** Real data: depth cap 3 gives `count(*)=311` but
`count(DISTINCT node)=291` -- 20 rows are the same node counted twice.
Matches walk.rs's own `merge(MinBy(depth))` semantics only after switching
to `count(DISTINCT node)` or `GROUP BY node, MIN(depth)`. Fix cost
measured at 5.8-13.6% overhead over the raw query -- cheap, not free, not
a second query.

**SQLite 3.53.2 rejects `(VALUES ...) AS v(col1, col2)` table-valued
aliasing:** `near "(": syntax error`, even though bare `VALUES (...)`
works fine as a row source. Use `column1 AS name` in the outer `SELECT`
instead.

**`ext/misc/closure.c` loads silently and does nothing** without
`-DSQLITE_TEST=1`: `sqlite3_closure_init` returns `SQLITE_OK`, but the
`sqlite3_create_module` call inside it is compiled out. Only surfaces
later as `sqlite3.OperationalError: no such module: transitive_closure`
when you try to actually use it -- the load step gives zero indication
anything is wrong.

**Loadable-extension entry-point resolution is filename-derived.** A file
must be named exactly `closure.dylib` for `sqlite3_closure_init` to
resolve automatically; `closure_test.dylib` looks for
`sqlite3_closuretest_init` (underscores stripped) and fails with
`dlsym(...): symbol not found`. Python's stdlib `sqlite3.load_extension`
takes no explicit entry-point argument, so the filename is the only lever.

**macOS ships GNU Bison 2.3** (`/usr/bin/bison`), which cannot parse
grammars using the `%code` directive: `invalid directive: '%code'`. Needed
`brew install bison` (3.8.2, keg-only) and
`PATH=/opt/homebrew/opt/bison/bin:$PATH` to build graphqlite.

**graphqlite creates 14 tables the instant it loads**, in ANY database:
`nodes`, `edges`, `property_keys`, `node_labels`,
`node_props_{int,text,real,bool,json}`,
`edge_props_{int,text,real,bool,json}`. It reads a hardcoded `SELECT id
FROM nodes` / `SELECT source_id, target_id FROM edges`, never sprefa's
`rel_*` tables. "Works with any SQLite database" (its own README) means
"no server process," not "queries your existing schema."

**CREATE VIRTUAL TABLE fails against a `mode=ro` connection** even for an
ephemeral, in-process virtual table: `attempt to write a readonly
database`. Fix: `CREATE VIRTUAL TABLE temp.ct USING ...` -- the temp
schema is writable regardless of the main db's open mode. Needed when
testing `closure.c` against the live read-only sprefa db.

## Environment

macOS 14.6.1, Apple clang 16.0.0 (`gcc` = clang alias), Python 3.14.6
stdlib `sqlite3` bundling SQLite 3.53.2 (`/usr/bin/sqlite3` CLI reports a
different, older 3.43.2 -- they are different binaries; all numbers here
are from the Python module). graphqlite commit
`0aae7eb3a0a33e93cbd348698c3d04589867e1ed` (2026-06-04). closure.c
vendored from `https://raw.githubusercontent.com/sqlite/sqlite/master/ext/misc/closure.c`.

## What I could not test and why

- graphqlite's other 14 algorithms (PageRank, Louvain, betweenness, A*,
  APSP, KNN, similarity, eigenvector/closeness centrality, triangle
  count): not run. The schema-migration finding (H7) already settles
  adoption; running them needs an ETL into graphqlite's own tables for no
  additional decision value.
- H8's crossover is an estimate with one measured anchor (H5's 6.6x); the
  three CSR-per-query costs are stated assumptions, not benchmarks -- no
  Rust harness exists in this lab.
- The 100M-edge / 500-repo extrapolation target from the shared
  `graph-libs/README.md`: not tested. Every real-data query here ran
  under a millisecond against the actual 261,704-edge table; there was no
  bottleneck to chase by synthesizing a larger graph.
- `port_out_reach` (the field-port half of `rel_port_reach`'s union): not
  separately reproduced; `port_of_reach_rec` (the half with the actual
  halt semantics) was, and both halves share the identical CTE pattern.
