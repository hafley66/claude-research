# CTE vs the engine's own materialized tables

Back to [index.md](index.md).

## H5: reproducing rel_port_reach

sprefa's engine already computes and stores a halt-BFS result:
`rel_port_reach`, 292,923 rows. Its rule, read from `.dl/flow-panel.dl`
(lines 433-559), is exactly the H2 halt pattern applied to the code
dataflow graph:

```
port_of(node, port)            <- node IS a param/ret port pin
port_of_reach_seed(port, n)    <- port_of(from_node, port), flow_edge(from_node, n)
port_non_port_flow_edge(a, b)  <- flow_edge(a, b), !port_of(a, _)
port_of_reach_rec(port, n)     <- seed(port, n)
                                 | port_of_reach_rec(port, m), port_non_port_flow_edge(m, n)
```

`port_non_port_flow_edge` drops every edge whose SOURCE is a port pin --
the same "halted node never produces children" rule proven in H2, here
expressed as a relation filter instead of a CTE `WHERE` clause, because
the dl engine lowers to a semi-naive SQL fixpoint rather than a literal
`WITH RECURSIVE`. This lab's CTE reproduces the identical relation
directly:

```sql
WITH RECURSIVE
halt_set(node) AS (SELECT DISTINCT node FROM rel_port_of),
seed(port, node) AS (
    SELECT port_of.port, flow_edge."to"
      FROM rel_port_of AS port_of
      JOIN rel_flow_edge AS flow_edge ON flow_edge."from" = port_of.node
     WHERE port_of.port IN (...)
),
reach(port, node) AS (
    SELECT port, node FROM seed
    UNION
    SELECT reach.port, edge."to"
      FROM reach JOIN rel_flow_edge edge ON edge."from" = reach.node
     WHERE reach.node NOT IN (SELECT node FROM halt_set)
)
SELECT port, node FROM reach
```

Tested against 10 real ports sampled from `rel_port_of_reach_rec` (the 5
largest reach sets and the 5 smallest), comparing the CTE's output set
against the engine's stored rows:

```
port=6344282652906292301: cte_rows=22601 engine_rows=22601 [OK]
port=6369526495454369256: cte_rows=7605  engine_rows=7605  [OK]
port=-2475333695761305334: cte_rows=6787 engine_rows=6787  [OK]
port=2456328690741957225: cte_rows=5415  engine_rows=5415  [OK]
port=-2647098807912780026: cte_rows=4190 engine_rows=4190  [OK]
port=-9130622577183216328: cte_rows=1    engine_rows=1     [OK]
port=-9067214157247851311: cte_rows=1    engine_rows=1     [OK]
port=-9062863422187495735: cte_rows=1    engine_rows=1     [OK]
port=-9019280394512109788: cte_rows=1    engine_rows=1     [OK]
port=-8942358399005932735: cte_rows=1    engine_rows=1     [OK]
```

Exact match on all 10, including the largest sampled port at 22,601 rows.
This is real production data, not a synthesized graph: the CTE pattern
proven abstractly in H2 reproduces an actual materialized relation
sprefa's engine computes today, byte for byte in row identity.

### The engine's materialize-once call was already correct

Timing the same 10 ports, per-port:

```
CTE recomputation, 10 ports, one query each: 143.350ms total, 14.335ms/port
reading rel_port_of_reach_rec (already materialized): 21.863ms total, 2.186ms/port
```

Reading the stored table is 6.6x faster than recomputing it live. A
single CTE covering all 10 ports at once (the H3 multi-tag batching
pattern) still takes 109.865ms for 46,603 rows -- batching the query
helps relative to a per-port loop, but does not close the gap with simply
reading a table that was already computed once and is now just being
scanned.

sprefa's engine already made this exact trade-off, correctly, by
materializing `rel_port_reach` instead of treating it as a view. See H8
for how this generalizes.

## H8: the crossover question

The workload's actual shape: SQLite pays a query cost every time; an
in-memory structure (a `Csr`, or a materialized SQL table) pays a build
cost once and then answers queries near-instantly. The question is how
many repeated queries against the SAME snapshot it takes before paying
the build cost wins.

**One number in this section is a real measurement: the other three are
estimates, clearly separated below.**

### The measured anchor

H5's materialized-vs-CTE comparison IS this question, answered one layer
up, with no extrapolation: reading `rel_port_reach` costs 2.186ms/port,
recomputing it costs 14.335ms/port, a 6.6x factor on real production
data. sprefa's own architecture already encodes "a `save` rel queried
thousands of times wants the snapshot; a transient rel queried once does
not" by choosing to materialize `rel_port_reach` rather than leave it a
view.

### The estimate

Extrapolating `Csr::from_sorted_edges`'s cited cost (6ms per 1M edges,
from the petgraph lab, not measured here) to the real 261,704-edge
`rel_df_edge` table:

```
build_cost = 6.0ms/1M edges * 261,704/1,000,000 = 1.570ms
```

Against the measured SQLite per-query cost (0.27ms, single-seed unbounded
CTE on real data, H1/H4), at three assumed in-memory query costs (NONE of
these three were run; they bound an order of magnitude):

| assumption | assumed csr query cost | crossover point |
|---|---|---|
| optimistic: pure pointer-chase, ~1000 edges at ~1ns/edge | 0.000363ms | ~5.8 queries |
| likely: BFS with allocation/bookkeeping overhead, 100x optimistic | 0.0363ms | ~6.7 queries |
| pessimistic: CSR pays similar per-node overhead to a hash-map BFS | 0.15ms | ~13.1 queries |

The range holds across all three assumptions: **somewhere in the
single-digit to low-teens repeated-query count**, building an in-memory
snapshot starts winning over paying SQLite's per-query cost every time,
under this extrapolation.

### Where this lands for sprefa's tier design

This maps onto the `save`-vs-transient rel distinction already in
sprefa's model: a rel queried once per tick wants zero build cost (query
it directly, no snapshot); a rel queried many times against the same
revision wants precomputation, whether that precomputation is a `Csr` in
Rust or a materialized SQL table like `rel_port_reach` already is today.
The crossover point is low enough (single digits to low teens) that most
relations queried more than a handful of times per revision are past it.

## What this section could not measure

No Rust harness exists in this lab; the CSR-per-query cost is bounded by
assumption, not measured. The only apples-to-apples, non-extrapolated
number in this section is the H5 materialized-vs-CTE 6.6x, and it is
already the answer sprefa picked in production before this lab ran.

## Working code

- `~/projects/claude-research/labs/graph-sqlite/h5_vs_engine.py`
- `~/projects/claude-research/labs/graph-sqlite/h8_crossover.py`
