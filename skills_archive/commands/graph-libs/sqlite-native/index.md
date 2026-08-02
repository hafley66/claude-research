---
description: SQLite-native graph work, verified empirically 2026-07-19: recursive CTEs alone reproduce four of sprefa's six graph functions on real data with zero new dependencies; both C extensions evaluated (closure.c, graphqlite) carry real adoption costs.
argument-hint: [section]
---

# SQLite-native graph algorithms

## Verdict

Adopt hand-written `WITH RECURSIVE` queries over the existing `rel_*` tables
for forward reach, reverse reach, multi-source depth-capped walks, and the
halt-predicate walk. This needs no new dependency: it is SQL, running
against the SQLite database sprefa already writes to. Measured on the real
261,704-edge `rel_df_edge` table, every one of these queries runs in under
a millisecond, and a hand-built 12-node correctness proof shows the halt
predicate -- the one operation neither petgraph nor ultragraph could
express cleanly -- has an exact, verified expression as a `WHERE` clause on
the recursive term.

Do not adopt `ext/misc/closure.c`. It does not run in a normal SQLite
build; SQLite's own source marks it experimental and obsolete, and
recommends recursive CTEs instead -- which is exactly what this lab reaches
for independently in H1.

Do not adopt `graphqlite`. It builds and runs (after installing a modern
`bison`), and it genuinely ships an iterative, stack-safe Tarjan SCC plus
real Cypher. But loading it creates 14 new tables in whatever database you
load it into -- it needs its own property-graph schema, not sprefa's
`rel_*` tables, so adopting it means an ETL migration, not a query layer on
top of what already exists. One year old, 2 open issues, C in a daemon's
write path.

Tarjan's SCC and the condensation-based pair-count stay in Rust
(`scc.rs`). A recursive CTE is a monotonic fixpoint over a growing set; it
has no mechanism for "visit, recurse, then revise a value on the way back
up," which is what low-link computation is. That is a structural mismatch,
confirmed in H6, not a missing feature.

## Hypothesis results

| # | hypothesis | verdict | headline number |
|---|---|---|---|
| H1 | recursive CTE baseline | CONFIRMED, with two traps found | single-seed unbounded reach: 0.23-0.31ms on 261,704 real edges |
| H2 | halt predicate in a CTE | CONFIRMED (decisive) | 7/7 walk.rs parity cases + 12-node proof, exact match |
| H2b | min-depth-wins cost | CONFIRMED, cheap | GROUP BY + MIN(depth) overhead: 5.8% to 13.6% of raw query time |
| H3 | multi-source + depth cap, one CTE | CONFIRMED | 10.8x faster than a 1000-seed Python loop of single-seed CTEs |
| H4 | closure.c extension | REFUTED for adoption | dead by default (`SQLITE_TEST` gate); matches H1 exactly once force-built |
| H5 | CTE vs the engine's own materialized `rel_port_reach` | CONFIRMED equal, CTE 6.6x slower | 10/10 sampled ports exact match; 2.19ms/port read vs 14.3ms/port recompute |
| H6 | SCC in SQL | PARTIAL / effectively negative | mutual-reachability predicate correct, full SCC is Theta(V^2) |
| H7 | graphqlite | REFUTED for adoption | builds and runs; requires its own 14-table schema |
| H8 | CSR-vs-CTE crossover | ESTIMATE, one measured anchor | ~6-13 repeated queries (estimated); 6.6x measured one layer up (H5) |

Detail:
- [recursive-cte.md](recursive-cte.md) -- H1, H2, H2b, H3: the CTE patterns, the traps, the SQL that ran, the EXPLAIN QUERY PLAN evidence.
- [closure-and-graphqlite.md](closure-and-graphqlite.md) -- H4, H6, H7: the two C extensions and the SCC-in-SQL question.
- [engine-comparison.md](engine-comparison.md) -- H5, H8: CTE vs sprefa's own materialized tables, and the amortization math.

## The six-function replacement table

| function | SQLite-native replacement | verdict |
|---|---|---|
| `tarjan` (SCC) | none | stays in Rust; structural mismatch (H6) |
| `build_condensed` | none | built on `tarjan`'s output, stays in Rust |
| `count_pairs` | mutual-reachability SQL predicate is correct, but Theta(V^2) at scale | stays in Rust; condensation avoids exactly this cost |
| `reaches_from` | `WITH RECURSIVE`, dedup by node | YES (H1) |
| `reached_by` | same CTE, `from`/`to` swapped | YES (trivial; closure.c's idcolumn/parentcolumn swap confirms the direction is symmetric, H4) |
| `multi_source_walk` (depth-capped BFS) | multi-seed CTE + `GROUP BY node, MIN(depth)` | YES (H3, H2b) |
| `multi_source_halt_bfs` | halt-set exclusion in the recursive term's `WHERE` clause | YES (H2, the decisive result) |

## Environment

- macOS 14.6.1, Apple clang 16.0.0 (`gcc` is a clang alias).
- Python 3.14.6, stdlib `sqlite3` module bundling SQLite 3.53.2 (the `/usr/bin/sqlite3` CLI on this machine reports 3.43.2 -- they are different binaries with different bundled versions; all numbers in this writeup come from the Python module, not the CLI).
- Real data: `/Users/chrishafley/.local/state/sprefa/roots/fbabddda40d22347/db.sqlite`, opened `mode=ro` throughout, never written to. `rel_df_edge`: 261,704 rows, `WITHOUT ROWID`, `PRIMARY KEY("from","to")`, plus standalone `idx_df_edge_from` / `idx_df_edge_to` indexes already present in the live schema.
- Lab code: `~/projects/claude-research/labs/graph-sqlite/` -- `h1_baseline_cte.py` through `h8_crossover.py`, each independently runnable, each writing its own `hN_output.txt` from the actual run being quoted here.
- graphqlite build: commit `0aae7eb3a0a33e93cbd348698c3d04589867e1ed` (2026-06-04), cloned to `vendor/graphqlite/`. Built with Homebrew `bison` 3.8.2 (`brew install bison`, then `PATH=/opt/homebrew/opt/bison/bin:$PATH make extension`); the system `/usr/bin/bison` (GNU Bison 2.3, Apple's GPLv2-frozen build) fails on the grammar's `%code` directive.
- closure.c: vendored from `https://raw.githubusercontent.com/sqlite/sqlite/master/ext/misc/closure.c` into `vendor/closure.c`. Built twice: once matching a normal distribution (`gcc -fPIC -dynamiclib -I. closure.c -o closure_notest.dylib`, module never registers) and once forced (`-DSQLITE_TEST=1`, module works).

## What I could not test and why

- graphqlite's other 14 algorithms (PageRank, Louvain, betweenness, A*,
  APSP, KNN, similarity, eigenvector centrality, closeness, triangle
  count) were not run against real data. The schema-migration finding
  (H7) already answers the adoption question; running the rest would not
  change the verdict, and would mean writing an ETL from `rel_df_edge`/
  `rel_df_node` into graphqlite's `nodes`/`edges` tables for no decision
  value.
- H8's crossover estimate has exactly one measured data point (H5's
  materialized-vs-CTE 6.6x) and three assumed CSR-per-query costs, clearly
  labeled as assumptions in `h8_crossover.py`. No Rust harness exists in
  this lab to measure an actual CSR query; that number belongs to the
  petgraph lab, not this one.
- The 100M-edge / 500-repository extrapolation target from the shared
  `README.md` was not tested here. Every real-data query in this lab ran
  against the live 261,704-edge table, under a millisecond; there was no
  need to synthesize a larger graph to find a bottleneck; H3's 1000-seed
  test is the largest single query run (1.76ms for the multi-source
  version).
- `rel_port_reach`'s companion relation `port_out_reach` (the field-port
  half of the union) was not separately reproduced; H5 covers
  `port_of_reach_rec`, the larger and more structurally interesting half
  (the one with the actual halt semantics), and the two halves share the
  identical CTE pattern.
