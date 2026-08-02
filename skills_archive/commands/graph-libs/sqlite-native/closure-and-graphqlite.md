# The two C extensions, and SCC in SQL

Back to [index.md](index.md).

## H4: ext/misc/closure.c

### It does not run in a normal build

The file's own header, read before compiling anything:

```
** WARNING:  Experimental and obsolete.  Demonstration and testing only.
**
** This virtual table was created prior to the addition of support for
** common table expressions in SQLite.  Common table expressions are a
** better and more portable solution to any problem that this virtual
** table solves.
**
** Given its experimental and testing-only status, the code here is
** deactivated unless compiled with -DSQLITE_TEST=1
```

That deactivation lives in the registration function itself, confirming
the header comment in code:

```c
int sqlite3_closure_init(sqlite3 *db, char **pzErrMsg, const sqlite3_api_routines *pApi){
  int rc = SQLITE_OK;
  SQLITE_EXTENSION_INIT2(pApi);
  (void)pzErrMsg;
#if defined(SQLITE_TEST) && !defined(SQLITE_OMIT_VIRTUALTABLE)
  rc = sqlite3_create_module(db, "transitive_closure", &closureModule, 0);
#endif /* SQLITE_TEST && !SQLITE_OMIT_VIRTUALTABLE */
  return rc;
}
```

Built with `gcc -fPIC -dynamiclib -I. closure.c -o closure_notest.dylib`
(no `-DSQLITE_TEST`), the extension loads without any error --
`sqlite3_closure_init` runs and returns `SQLITE_OK` -- but
`sqlite3_create_module` never executed. Confirmed empirically:

```
conn.load_extension('./notest/closure.dylib')   # succeeds silently
conn.execute("CREATE VIRTUAL TABLE ct USING transitive_closure(...)")
# sqlite3.OperationalError: no such module: transitive_closure
```

This is the actual distribution finding: a normal build of this extension
compiles clean, links clean, loads clean, and does nothing. There is no
error at any of those steps to tell you why. Only the `CREATE VIRTUAL
TABLE` fails, and only with a generic "no such module" message that gives
no hint the extension you just successfully loaded is the reason.

### Forced to compile with -DSQLITE_TEST=1, it matches the CTE exactly

Built with `gcc -fPIC -dynamiclib -I. -DSQLITE_TEST=1 closure.c -o
closure.dylib` (filename matters: SQLite's extension-loading convention
derives the entry-point symbol from the basename, so
`sqlite3_closure_init` only resolves automatically for a file literally
named `closure.dylib`, not `closure_test.dylib` -- confirmed by hitting
`dlsym(...): symbol not found` on the renamed variants first).

Correctness passed on the same four-case hand-built graph as H1 (chain,
disconnected component, self-loop, 2-cycle). Timed on the real
261,704-edge table, same seed as H1:

| depth | count | median time |
|---|---|---|
| depth<=1 | 133 | 0.049ms |
| depth<=3 | 291 | 0.237ms |
| depth<=5 | 315 | 0.241ms |
| unbounded | 363 | 0.283ms |

These match H1's CTE numbers exactly, once H1's depth-capped counts are
taken as `count(DISTINCT node)` rather than raw `count(*)` -- see H2b in
[recursive-cte.md](recursive-cte.md) for why the raw CTE row count and
closure.c's distinct-node count diverged on the first pass (311 vs 291 at
depth 3) until that fix was applied.

Reverse traversal, by swapping `idcolumn`/`parentcolumn` in the query's
`WHERE` clause rather than rebuilding the virtual table:

```sql
SELECT count(*) FROM ct WHERE root=? AND idcolumn='from' AND parentcolumn='to'
```

gave 2, matching a hand-written reverse CTE exactly.

Depth pushdown: reading the source (`closureQuery`'s BFS loop) shows
`if (pAvl->iGeneration >= mxGen) continue;` gating expansion INSIDE the
traversal, before the child-fetching query for that node even runs --
this is pushdown, not a post-filter, confirmed by reading the code before
timing anything. The timing (`depth<=0`: 0.006ms vs unbounded: 0.289ms,
50.6x) is corroborating, not the proof by itself, since a small graph
could make a post-filter look fast too.

### Verdict

Every number closure.c produced matches what the CTE in H1 already
produces, once dedup semantics line up, using a force-enabled test-only
build flag SQLite's own maintainers do not want production code to set.
The zero-dependency CTE is available with none of that -- no compile
step, no filename convention, no forced test flag, no vendored C. This
extension answers its own adoption question in its header comment.

## H6: is SCC expressible in SQLite?

Tarjan's algorithm is procedural: a single DFS pass with an explicit call
stack and a low-link array mutated during backtracking. A recursive CTE
computes a monotonically growing SET via a fixpoint; it has no operation
for "visit, recurse, then revise a value on the way back up." That is a
structural mismatch, not a missing feature.

What SQL CAN do is the SCC PREDICATE directly: x and y are in the same SCC
iff x reaches y and y reaches x. Proven correct on a hand-built graph with
two 2/3-node cycles bridged by a one-way edge, plus an isolated node:

```sql
WITH RECURSIVE
reach(src, dst) AS (
    SELECT "from", "to" FROM edge
    UNION
    SELECT reach.src, edge."to" FROM reach JOIN edge ON edge."from" = reach.dst
),
mutual(member, co_member) AS (
    SELECT forward.src, forward.dst FROM reach forward
    JOIN reach backward ON backward.src = forward.dst AND backward.dst = forward.src
)
SELECT member AS node, min(co_member) AS scc_rep FROM mutual GROUP BY member
```

Result: `{0,1,2}` share representative 0, `{3,4}` share representative 3,
the isolated node 5 is its own singleton -- exactly right.

Computing ALL SCCs this way needs the full mutual-reachability join, an
`(x, y)` pair test across every pair, which is precisely the Theta(V^2)
cost `scc.rs`'s own header comment says its condensation approach exists
to avoid ("without ever building the Theta(V^2) pair table," `scc.rs:6`).
This was proven correct only on a small hand-built graph and was
deliberately not run at the real 283,127-node scale, per the memory
budget: materializing an all-pairs mutual-reachability table over that
many nodes is the exact quadratic blowup the condensation exists to
sidestep, so running it would only reproduce a cost sprefa's own Rust code
was written specifically to avoid.

**SCC stays in Rust.**

## H7: graphqlite

### It builds on macOS, with one real trap

`git clone https://github.com/colliery-io/graphqlite.git` (commit
`0aae7eb3a0a33e93cbd348698c3d04589867e1ed`, 2026-06-04), then `make
extension` fails immediately against the system toolchain:

```
bison -d -o build/parser/cypher_gram.tab.c src/backend/parser/cypher_gram.y
src/backend/parser/cypher_gram.y:20.1-5: invalid directive: `%code'
src/backend/parser/cypher_gram.y:20.7-14: syntax error, unexpected identifier
make: *** [build/parser/cypher_gram.tab.h] Error 1
```

macOS ships `/usr/bin/bison` at GNU Bison 2.3, Apple's GPLv2-frozen build,
which predates the `%code` directive graphqlite's grammar uses. `brew
install bison` (3.8.2, keg-only, not on PATH by default) and rerunning
with `PATH=/opt/homebrew/opt/bison/bin:$PATH make extension` builds clean
end to end, producing `build/graphqlite.dylib`. This is the standard
"macOS ships an ancient bison" trap, hit directly rather than assumed.

### What it actually ships (read from source, not the README)

The README's algorithm bullet list is accurate as far as it goes --
"PageRank, Louvain, Dijkstra, BFS/DFS, connected components, and more" --
but the actual file list is bigger and more specific:

```
src/backend/executor/graph_algo_traversal.c
src/backend/executor/graph_algo_knn.c
src/backend/executor/graph_algo_apsp.c
src/backend/executor/graph_algo_eigenvector.c
src/backend/executor/graph_algo_closeness.c
src/backend/executor/graph_algo_community.c
src/backend/executor/graph_algo_astar.c
src/backend/executor/graph_algo_components.c   <- WCC (union-find) + SCC (Tarjan)
src/backend/executor/graph_algorithms.c
src/backend/executor/graph_algo_louvain.c
src/backend/executor/graph_algo_paths.c
src/backend/executor/graph_algo_similarity.c
src/backend/executor/graph_algo_centrality.c
src/backend/executor/graph_algo_pagerank.c
src/backend/executor/graph_algo_betweenness.c
src/backend/executor/graph_algo_triangle.c
```

`graph_algo_components.c` implements SCC via an explicitly **iterative**
Tarjan (`tarjan_iterative`, an explicit `call_frame` stack, not C-stack
recursion) -- the same stack-safety discipline as sprefa's own `scc.rs`
and unlike petgraph's recursive `tarjan_scc`. This was verified end to end,
not just read: loading the built extension, creating the same two-cycle
graph as H6 via Cypher `CREATE`, and calling `RETURN scc()` returned

```
[{"node_id":1,...,"component":1},{"node_id":2,...,"component":1},
 {"node_id":3,...,"component":1},{"node_id":4,...,"component":0},
 {"node_id":5,...,"component":0},{"node_id":6,...,"component":2}]
```

grouping the two cycles into two components and the isolated node into
its own, in 1.5ms.

### It does not query existing tables

`csr_graph_load` (`graph_algorithms.c`), the function every algorithm
above calls to get its in-memory graph, hardcodes its source tables:

```c
rc = sqlite3_prepare_v2(db, "SELECT id FROM nodes ORDER BY id", -1, &stmt, NULL);
...
rc = sqlite3_prepare_v2(db, "SELECT source_id, target_id FROM edges", -1, &stmt, NULL);
```

`nodes` and `edges` are not configurable, and they are graphqlite's own
tables, created the moment the extension loads -- confirmed by loading it
into a fresh `:memory:` connection and listing tables immediately after:

```
[('nodes',), ('sqlite_sequence',), ('edges',), ('property_keys',),
 ('node_labels',), ('node_props_int',), ('node_props_text',),
 ('node_props_real',), ('node_props_bool',), ('edge_props_int',),
 ('edge_props_text',), ('edge_props_real',), ('edge_props_bool',),
 ('node_props_json',), ('edge_props_json',), ...]
```

Fourteen tables, an EAV-style property graph schema (`property_keys` plus
four typed `node_props_*` / `edge_props_*` families), created
unconditionally. `README.md`'s "works with any SQLite database, no server
required" is true in the narrow sense that it does not need a separate
server process -- it is not true in the sense that matters for sprefa:
adopting graphqlite means an ETL from `rel_df_edge` / `rel_df_node` into
`edges` / `nodes`, kept in sync, not a query layer that reads sprefa's
existing tables in place.

### Verdict

graphqlite is real, iterative-safe, functionally verified end to end on
this machine, and the wrong shape for sprefa. The cost is not "it doesn't
work"; the cost is "it works, but only against a schema you'd have to
build and maintain a migration into, duplicating data that already lives
in `rel_df_edge`/`rel_df_node`." One year old (created 2025-07-19 per the
repository's own metadata), 391 stars, 2 open issues, C in a daemon's
write path, for a feature set (Cypher, PageRank, Louvain, centrality) that
sprefa does not currently need and the recursive-CTE approach already
covers the specific six functions this evaluation was scoped to answer.

## Working code

- `~/projects/claude-research/labs/graph-sqlite/h4_closure_ext.py`
- `~/projects/claude-research/labs/graph-sqlite/h6_scc.py`
- `~/projects/claude-research/labs/graph-sqlite/vendor/closure.c` (vendored source)
- `~/projects/claude-research/labs/graph-sqlite/vendor/graphqlite/` (cloned, built)
