# Recursive CTEs: the baseline, the halt predicate, and two traps

Back to [index.md](index.md).

## H1: the zero-dependency baseline

Forward reachability from a seed, over the real `rel_df_edge` table
(261,704 rows, `WITHOUT ROWID`, `PRIMARY KEY("from","to")`):

```sql
WITH RECURSIVE reach(node) AS (
    SELECT :seed
    UNION
    SELECT edge."to" FROM reach JOIN rel_df_edge edge ON edge."from" = reach.node
)
SELECT count(*) FROM reach
```

Correctness was checked first, on a hand-built graph covering a chain, a
disconnected component, a self-loop, and a 2-cycle, all four cases passing
before any timing ran (`h1_baseline_cte.py::correctness_check`).

Timed against the seed with the highest out-degree in the real table (132
direct children), median of 3 runs each:

| depth cap | count | median time |
|---|---|---|
| 1 | 133 | 0.050ms |
| 3 | 291 | 0.222ms |
| 5 | 315 | 0.294ms |
| unbounded | 363 | 0.229ms |

A 100-seed set, unbounded, ran in 0.975ms total.

### Is the recursive step index-driven?

`EXPLAIN QUERY PLAN` against the real table:

```
(23, 20, 53, 'SEARCH edge USING COVERING INDEX idx_df_edge_from (from=?)')
```

Against a scratch copy with ONLY the `WITHOUT ROWID` `PRIMARY KEY("from",
"to")` and no standalone index:

```
(23, 20, 55, 'SEARCH edge USING PRIMARY KEY (from=?)')
```

Both plans drive the recursive join through a `SEARCH ... (from=?)` step,
not a scan. The live schema happens to also carry a redundant-looking
`idx_df_edge_from` (and `idx_df_edge_to`), but the composite `WITHOUT
ROWID` primary key alone is sufficient: its leading column is `from`, so a
`WHERE from=?` predicate is already a prefix search on the clustering key.

## H2 (decisive): the halt predicate, proven exact

sprefa's `multi_source_halt_bfs` (`src/graph/walk.rs`): from a seed set,
walk forward, record every node reached, but never expand out of a node
marked `halt`. The halted node is still a reported, reachable endpoint,
just not a stepping stone.

The claim under test: put the halt-set exclusion in the `WHERE` clause of
the CTE's RECURSIVE term, not the base term and not the outer `SELECT`:

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

This filters which ROW gets to be the left side of the next join. A
halted node's row already exists (produced by its parent, before anyone
knew it was a halt node) and stays in the result; the filter only stops
that row from producing children.

### Parity with walk.rs's own test suite

Every `assert_eq!` in `walk.rs`'s `#[cfg(test)]` block was replayed as SQL
against the pattern above, using the identical graphs and identical
expected outputs from the Rust source. All seven pass:

```
[OK] linear_chain_records_start_and_downstream
[OK] halt_node_is_recorded_but_not_expanded
[OK] cycle_terminates_and_dedups
[OK] two_tags_keep_separate_reach_sets
[OK] multiple_starts_one_tag
[OK] start_that_is_halt_is_recorded_only
[OK] empty_starts_is_empty
```

### A fresh 12-node proof, and a semantics correction caught mid-proof

A hand-built graph, seeded at node 0, halting at node 2:

```
0 -> 1 -> 2(HALT) -> 3 -> 4
          2 -> 5
0 -> 6 -> 7
7 -> 8, 8 -> 7            (cycle on the untouched branch)
6 -> 9 -> 2                (diamond: node 2 reached a second way)
2 -> 10
0 -> 11
```

The first draft of this test predicted node 2's direct children (5 and 10)
would still be recorded, on the theory that halt means "stop one hop past
the halt point." That prediction was wrong, and the assertion catching it
is why this section exists. Re-reading `multi_source_walk`:

```rust
while let Some((mid, d)) = queue.pop_front() {
    if let Some(h) = halt { if h[mid as usize] { continue; } }
    ...
    for &node in &adj[mid as usize] { ... }
}
```

`continue` fires before `adj[mid]` is ever touched. A halted node's DIRECT
children are never visited, not merely its grandchildren. The corrected,
verified result:

```
halted result:  [(0,0), (0,1), (0,2), (0,6), (0,7), (0,8), (0,9), (0,11)]
naive (no halt): adds (0,3), (0,4), (0,5), (0,10)
```

Naive BFS over-reaches by exactly `{3, 4, 5, 10}`, every direct and
indirect child of the halt node, while the SQL pattern matches
`multi_source_halt_bfs` exactly -- including through the diamond re-entry
at node 2 (arriving via both `1->2` and `9->2`) and the cycle on the
untouched branch (`7<->8`). Node 2's own halt status decides its
expansion; which parent's row happened to produce it first does not
matter, because SQLite's recursive-CTE dedup means only one `(tag, node)`
row for node 2 ever exists to be checked.

**This pattern already appears in production, independently discovered.**
sprefa's own `.dl/flow-panel.dl`
(lines 452-470) implements the identical pattern independently, for the
identical reason:

```
port_non_port_flow_edge(from_node, to_node) <-
  flow_edge(from_node, to_node),
  !port_of(from_node, _).
```

This removes every edge whose SOURCE is a port pin from the relation the
recursive rule walks -- exactly "exclude a halted node from producing
children," expressed as a relation filter instead of a CTE `WHERE` clause,
because the dl engine lowers to a semi-naive SQL fixpoint rather than a
literal recursive CTE. The two mechanisms are structurally the same idea.
See [engine-comparison.md](engine-comparison.md) (H5) for the CTE
reproducing this exact production relation on the real data.

## H2b: what min-depth-wins costs

A plain `UNION` recursive CTE dedups on the FULL row. If a query carries a
`depth` column, a node reached at two different path lengths within the
cap produces two rows, one per length -- `count(*)` on that CTE
over-counts. `multi_source_walk` instead keeps a node once, at its
MINIMUM depth (`merge(MinBy(depth))`; walk.rs's own
`walk_keeps_min_depth_when_two_paths` test proves this in Rust).

On the real data, single seed, the raw CTE and a `GROUP BY node, MIN(depth)`
version:

| depth cap | raw rows | distinct nodes | raw time | dedup time | overhead |
|---|---|---|---|---|---|
| 1 | 133 | 133 | 0.098ms | 0.111ms | +13.6% |
| 3 | 311 | 291 | 0.298ms | 0.324ms | +8.7% |
| 5 | 387 | 315 | 0.379ms | 0.401ms | +5.8% |
| 20 | 1102 | 363 | 1.242ms | 1.116ms | -10.1% |

At depth cap 3, the raw CTE returns 311 rows for what is actually 291
distinct nodes -- 20 rows are the same node counted twice, once per path
length. The 100-seed multi-source case shows the same shape: 520 raw rows,
475 deduped `(tag, node)` pairs, +9.1% overhead for the fix.

**The fix is cheap and is exactly `count(DISTINCT node)` or `GROUP BY
node, MIN(depth)`.** It is a single extra aggregation pass over an
already-small row set, not a second query or a client-side merge, and the
overhead does not track the depth cap the way the raw row count does
(GROUP BY collapses duplicates in the same pass it counts them). Any CTE
reporting a node SET or a node COUNT at a depth cap, over a graph that is
not a tree, needs this; `h4_closure_ext.py`'s numbers only lined up with
this file's H1 numbers after making that switch (see
[closure-and-graphqlite.md](closure-and-graphqlite.md)).

## Trap: depth-tracking + "unbounded" diverges on a cycle

`WITH RECURSIVE` dedups on the WHOLE row emitted by the recursive term. A
query that carries a `depth` column and removes the cap (intending
"unbounded, but I still want the depth") never converges if the seed's
reachable set contains a cycle, because every pass through the cycle
produces a new `(node, depth)` pair that has never been seen before.

Measured on the real highest-out-degree seed:

```
dedup on node alone:              363 distinct nodes, 6.23ms, converges
dedup on (node, depth), capped
  at depth<200:                   12,802 ROWS (only 363 distinct nodes exist), 12.42ms
```

The same 363-node reachable set produces 12,802 `(node, depth)` rows by
depth 200 and keeps growing linearly. An uncapped depth-tracking version
of this exact query did not terminate in 60 seconds and was killed
manually; this lab does not have a number for how long it would actually
take, because letting it run further serves no purpose once the growth
curve is confirmed linear-and-unbounded.

**Rule:** dedup an unbounded reachability CTE on node identity alone
(`reach(node)`, no depth column). Track depth only together with a
`WHERE`-clause cap in the recursive term; never carry depth with no cap.

## Working code

All SQL above ran, verbatim or near-verbatim, in:
- `~/projects/claude-research/labs/graph-sqlite/h1_baseline_cte.py`
- `~/projects/claude-research/labs/graph-sqlite/h2_halt_predicate.py`
- `~/projects/claude-research/labs/graph-sqlite/h2b_min_depth_cost.py`
- `~/projects/claude-research/labs/graph-sqlite/h3_multi_source.py`

## H3: multi-source + depth cap, one CTE vs a Python loop

```sql
WITH RECURSIVE reach(tag, node, depth) AS (
    SELECT column1 AS tag, column2 AS node, column3 AS depth FROM (VALUES ...)
    UNION
    SELECT reach.tag, edge."to", reach.depth + 1
      FROM reach JOIN rel_df_edge edge ON edge."from" = reach.node
     WHERE reach.depth < :cap
)
SELECT tag, count(*) FROM reach GROUP BY tag
```

(Note the `column1 AS tag` form: SQLite 3.53.2 does not accept
`(VALUES ...) AS v(tag, node, depth)` table-valued column aliasing --
`near "(": syntax error` -- even though it accepts `VALUES` as a row
source. Aliasing has to happen on `column1`/`column2`/`column3` in the
outer `SELECT` instead. This is a real syntax trap hit while writing this
lab, not a documentation claim.)

Correctness: the multi-seed CTE's per-tag counts were checked against
running the single-seed CTE once per seed, 20 seeds, depth cap 5 -- exact
match. Timing, real data:

| seeds | depth cap | one CTE | loop of single-seed CTEs | speedup |
|---|---|---|---|---|
| 10 | 1 | 0.023ms | 0.061ms | 2.7x |
| 10 | 5 | 0.063ms | 0.093ms | 1.5x |
| 100 | 1 | 0.138ms | 0.584ms | 4.2x |
| 100 | 5 | 0.451ms | 0.915ms | 2.0x |
| 1000 | 1 | 1.755ms | 18.979ms | 10.8x |
| 1000 | 5 | 7.412ms | 24.691ms | 3.3x |

The speedup grows with seed count, as expected: each single-seed query
pays SQLite's per-statement overhead independently, while the batched
version pays it once. At 1000 seeds and a tight depth cap, batching is an
order of magnitude faster.
