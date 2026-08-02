---
description: Re-run of the SQLite-native graph evaluation under stress; the positive conclusion survives and gets stronger, but the first pass missed a 4,000x reverse-traversal index cliff, understated the depth-cap cost, and wrongly ruled SCC out of SQL, verified 2026-07-20
argument-hint: [section]
---

# SQLite-native graph traversal, second pass

Adversarial re-run of `sqlite-native/`. The brief was to break the prior
positive conclusion. It did not break. It moved: **6 of 7 functions are
reachable in SQL, up from the 4 previously claimed**, and the scaling claim
that was previously asserted from one repository is now measured across a 38x
range of table sizes.

Three corrections to the first pass, one of them a production-relevant
performance cliff.

## Verdict

**The prior conclusion SURVIVES.** Every claim re-checked held, and the
decisive scaling experiment came out on the strong side.

| the first pass said | this pass found |
|---|---|
| plain `WITH RECURSIVE` covers 4 of 7 | covers 6 of 7; SCC and condensation are expressible and verified correct |
| sub-millisecond on the real table | confirmed; 0.23ms for a 362-node reach |
| halt predicate is a `WHERE` clause | confirmed; 12 of 12 `walk.rs` tests reproduced, not 7 |
| `closure.c` dead, graphqlite imposes a schema | not re-derived, accepted |
| depth dedup key decides termination | confirmed and sharpened; the cap is a work budget as much as a correctness knob |
| `count(*)` over-counts multi-path nodes | confirmed; the trap is specific to depth-carrying CTEs |
| SCC and `count_pairs` stay in Rust | **refuted.** Both run in SQL. SCC is exact against Tarjan; `count_pairs` sweeps the whole graph in 4s |

### Hypotheses

| # | claim | result | measurement |
|---|---|---|---|
| H1 | seeded cost tracks the REACHED set, not the table | **CONFIRMED** | 10x more edges costs 1.04x for a 300-node frontier, 1.13x for 3,000 |
| H1b | large reachable sets stay acceptable | **PARTIAL** | 200,000-node reach = 433ms tuned, 743ms untuned |
| H2 | min-depth-wins needs post-processing | **CONFIRMED** | `GROUP BY MIN` 1.86ms, window 2.47ms, node-only 0.24ms; the first two agree exactly |
| H3a | pragmas matter | **CONFIRMED** | `cache_size=-64000` alone removes the entire 10M-table penalty (0.70ms to 0.29ms) |
| H3b | a reverse index matters | **CONFIRMED, biggest miss** | 160ms to 0.04ms, ~4,000x |
| H3c | `MATERIALIZED` hints change recursive CTEs | **REFUTED** | 0.23 / 0.26 / 0.25ms, no effect |
| H3d | prepared reuse matters | **REFUTED** | 6ms vs 5ms over 200 seeds |
| H3e | hand-rolled semi-naive can beat the CTE | **REFUTED** | 787ms vs 0.28ms, 2,800x worse |
| H4 | SCC is out of reach in SQL | **REFUTED** | forward-backward + driver loop, 3.2s, output identical to Tarjan |
| H5 | `count_pairs` needs Rust | **REFUTED on this data** | 269,457 traversals in 4s |
| H6 | a formulation carries depth and terminates on cycles | **PARTIAL** | the path-string form terminates in 1ms on real data and `MemoryError`s on a dense synthetic component |

---

## H1. The decisive scaling experiment

The claim under test: because `rel_df_edge` is `WITHOUT ROWID` with
`PRIMARY KEY ("from","to")`, the recursive join is a PK-prefix seek, so a
seeded traversal costs what it reaches rather than what the table holds.

### The query plan

`EXPLAIN QUERY PLAN` on the forward CTE, real table, verbatim:

```
(2, 0, 0, 'CO-ROUTINE reach')
(6, 2, 0, 'SETUP')
(8, 6, 84, 'SEARCH edge USING PRIMARY KEY (from=?)')
(27, 2, 0, 'RECURSIVE STEP')
(29, 27, 216, 'SCAN r')
(30, 27, 45, 'SEARCH e USING PRIMARY KEY (from=?)')
(46, 0, 196, 'SCAN reach')
```

`SEARCH ... USING PRIMARY KEY (from=?)` in the recursive step is the seek.
The plan is byte-identical on the 1M and 10M synthetic tables.

### Method

Synthetic tables use the exact production schema and are built from
**disjoint components** of a fixed node count, so a seed's reachable set is
exactly that count no matter how many edges the table holds. That is what
isolates reached-set cost from table-size cost.

```sql
CREATE TABLE e ("from" INTEGER, "to" INTEGER,
                PRIMARY KEY ("from","to")) WITHOUT ROWID
```

Node ids are random 64-bit signed, matching the real table's hash ids. Each
component gets a spanning ring plus out-degree 3, so it is densely cyclic.
Median of 3 runs per seed, median across 5 seeds, warm.

### Result

| table | edges | file | 300-node frontier | 3,000-node frontier |
|---|---|---|---|---|
| synthetic | 1,003,210 | 25MB | **0.28ms** | **4.15ms** |
| synthetic | 10,000,037 | 247MB | **0.29ms** | **4.71ms** |

**10x the edges costs 1.04x and 1.13x.** Cost is governed by the reached set.
H1 confirmed.

### The trap inside H1

Run untuned, the same comparison looks much weaker:

| pragma set | 300-node frontier on the 10M table |
|---|---|
| default (2MB cache) | 0.70ms |
| `cache_size=-64000` | 0.29ms |
| `cache_size=-256000` | 0.30ms |
| `mmap_size=1GB` | 0.29ms |

The default-cache number is 2.4x the 1M-table number, which would have read as
"cost grows with table size". The cause is page-cache thrash: 300 scattered seeks
across a 247MB file miss a 2MB cache. One pragma removes it entirely.

**A scaling benchmark run with default SQLite pragmas measures the page cache,
not the algorithm.** The first pass measured one 261,704-edge table, small
enough that the OS page cache hid this.

### Where it stops being acceptable

A single seed reaching 200,000 nodes in the 10M-edge table:

| configuration | time |
|---|---|
| default | 743ms |
| `cache_size=-64000` | 676ms |
| `cache_size=-256000` | 479ms |
| mmap 1GB + cache 64MB + `temp_store=MEMORY` | **433ms** |

That is ~2.2 microseconds per reached node, and it is linear in the reached
set. The practical ceiling for an interactive query is therefore around
100,000 reached nodes. Above that, plan for a materialized answer.

The real `df_edge` graph never gets near this. Mean reachable-set size over
500 uniformly random nodes is **6.5**, and the largest seeds reach ~630. This
graph is close to a forest, which is why every real-data number in both passes
is sub-millisecond. Any conclusion drawn here transfers to another graph only
if that graph is also shallow.

---

## H3. The optimization surface, and the one real cliff

### Reverse traversal without an index costs 4,000x

This is the finding the first pass missed. On a table with only the
`PRIMARY KEY ("from","to")`, a reverse CTE cannot seek and SQLite silently
builds a throwaway index per query:

```
SCAN edge
BLOOM FILTER ON e (to=?)
SEARCH e USING AUTOMATIC COVERING INDEX (to=?)
```

Measured on the real 261,704-edge data, three seeds, median of 3:

| index on the table | reverse traversal (51 / 71 / 52 nodes reached) |
|---|---|
| none | 160.23ms / 161.19ms / 158.83ms |
| `CREATE INDEX ix ON edge("to")` | 0.04ms / 0.05ms / 0.04ms |
| `CREATE INDEX ix ON edge("to","from")` | 0.04ms / 0.05ms / 0.04ms |

**~4,000x.** The index costs 152ms to build once.

Two things follow.

**A single-column index on `"to"` is already covering here.** The plan says
`SEARCH edge USING COVERING INDEX ix (to=?)` for the one-column form. On a
`WITHOUT ROWID` table an index's payload is the full primary key, so an index
on `("to")` physically stores `("to","from")`. The wider index buys nothing.
This is specific to `WITHOUT ROWID`; the same reasoning does not hold on a
rowid table.

**The live database is already correct.** `rel_df_edge` carries both
`idx_df_edge_from` and `idx_df_edge_to`, so production reverse traversal is on
the fast path today. The cliff is a hazard for any NEW edge relation declared
with a `WITHOUT ROWID` PK and no `"to"` index, and for the recent index-demand
work that prunes indexes: **an index on the reverse column of a traversed edge
relation is not redundant with the primary key, and pruning it costs four
orders of magnitude.**

Note also that `idx_df_edge_from` IS redundant. It duplicates the primary key
prefix on a `WITHOUT ROWID` table, and the forward plan uses the primary key,
never that index.

### Everything else on the optimization surface is noise

| knob | result |
|---|---|
| `AS MATERIALIZED` / `AS NOT MATERIALIZED` | accepted, no effect: 0.26ms / 0.25ms against 0.23ms baseline. Recursive CTEs are already materialized into a queue; the hint has nothing to change |
| prepared reuse, 200 seeds | 6ms same cursor vs 5ms fresh cursor with altered SQL text. Below noise |
| `UNION` vs `UNION ALL` | depends on the cap, see H6. At cap 64, `UNION` is 3,961 rows / 3.44ms and `UNION ALL` is 14,754 rows / 6.44ms. `UNION` wins whenever the graph has multiple paths |
| `temp_store=MEMORY` | folded into the tuned config above; contributes to the 200k case, invisible on small reaches |

### Hand-rolled semi-naive loses by 2,800x

Manual iteration with temp tables, the classical "beat the CTE" trick:

```
semi-naive temp tables: 362 nodes, max depth 18, 786.67ms
single recursive CTE  : 362 nodes,               0.28ms
```

The temp-table version pays DDL, `ANALYZE`-less plans, and a `NOT IN` anti-join
per level. It does yield true BFS depth as a side effect, which the CTE does
not, but 2,800x is not a price worth paying for that.

**Recommended pragma set for a traversal-heavy connection:**

```sql
PRAGMA cache_size=-64000;      -- 64MB, the whole 10M-table penalty
PRAGMA mmap_size=1073741824;
PRAGMA temp_store=MEMORY;
```

---

## H6. Cycle handling, hardened

### What exactly diverges

`WITH RECURSIVE` with `UNION` dedups on the **entire output row**. Carrying a
depth column means `(node, 5)` and `(node, 9)` are distinct rows, and a cycle
manufactures a fresh depth for the same node on every lap. The recursion never
runs dry.

Measured, real data, a 362-node reachable set, depth carried, no cap, with
`LIMIT 200000` as a leash:

```
rows=200000  distinct=362  max_depth=3080   222ms
```

362 distinct nodes, 200,000 rows, depth 3,080 and climbing when the leash
stopped it. Without the `LIMIT` this query does not terminate.

### The cap is a work budget as well as a correctness knob

Sharpening the first pass. True BFS eccentricity for this seed is **18**,
established two independent ways (the semi-naive loop and the path-string
form below). Yet the depth-carrying CTE keeps producing rows all the way to
whatever cap is set, because the cycle keeps minting new depths:

| cap | `UNION ALL` rows | `UNION` rows | distinct nodes | `UNION` time |
|---|---|---|---|---|
| 3 | 310 | 310 | 290 | 0.22ms |
| 8 | 536 | 483 | 324 | 0.35ms |
| 16 | 1,148 | 843 | 358 | 0.65ms |
| 32 | 3,890 | 1,881 | **362** | 1.52ms |
| 64 | 14,754 | 3,961 | 362 | 3.44ms |
| (node-only dedup, no cap) | | 362 | 362 | **0.27ms** |

Below the eccentricity, rows are lost (cap 16 finds 358 of 362). Above it,
every extra unit of cap is pure waste: cap 64 does 12.7x the work of the
node-only form for the same answer set. `port_reach`'s historical cap of 64
sat about 3.5x past what its data needed.

**Rule: the cap must be at least the true eccentricity for correctness, and
every unit beyond it is burned work. Both halves matter and neither is
knowable from the query.**

The `count(*)` trap the first pass found is a consequence of the same thing:
at cap 3, `count(*)` is 310 against 290 distinct. It applies only to
depth-carrying CTEs. A node-only CTE is `count(*)`-safe by construction.

### Formulations that carry depth and terminate

**Visited-set accumulator via a second recursive reference: blocked.** SQLite
rejects it outright:

```
sqlite3.OperationalError: multiple recursive references: reach
```

That single error closes the entire family of "check the accumulated visited
set inside the recursive term" designs. This is a hard language limit rather
than a performance problem.

**Path-string simple-path check: works on real data, explodes on dense
graphs.** Carry the path as a string and refuse to revisit:

```sql
WITH RECURSIVE reach(node, depth, path) AS (
  SELECT "to", 1, '/'||"from"||'/'||"to"||'/' FROM edge WHERE "from" = ?
  UNION ALL
  SELECT e."to", r.depth+1, r.path||e."to"||'/'
  FROM edge e JOIN reach r ON e."from" = r.node
  WHERE instr(r.path, '/'||e."to"||'/') = 0
)
SELECT node, MIN(depth) FROM reach GROUP BY node
```

On the real graph this terminates with no cap at all: **368 rows for 362
distinct nodes, max depth 18, 1ms.** It gives true unbounded BFS depth on a
cyclic graph, which nothing else in this document does.

It enumerates simple paths, so it is exponential in path multiplicity. On one
300-node synthetic component with out-degree 3 it dies:

```
MemoryError
```

with `hard_heap_limit=1000000000` set and a `LIMIT 5000000` leash it never
reached. It survives on real `df_edge` only because that graph is nearly a
tree: 368 path-rows for 362 nodes means almost every node has exactly one path
to it.

**Verdict on H6: depth-capped BFS is safe on cyclic graphs provided the cap
exceeds the eccentricity, and the cap must be justified from data rather than
picked. There is no general formulation that carries depth and terminates
unbounded.** The path-string form is a legitimate option on
near-tree graphs and a memory bomb elsewhere; gate it on a measured path
multiplicity, never on hope.

---

## H2. Min-depth-wins, priced

`multi_source_walk` returns each node once at its minimum depth. Three
candidates, real data, cap 32, median of 3:

| formulation | rows | time |
|---|---|---|
| CTE then `GROUP BY node` with `MIN(depth)` | 362 | **1.86ms** |
| CTE then `row_number() OVER (PARTITION BY node ORDER BY depth)` | 362 | 2.47ms |
| node-only dedup, depth discarded | 362 | **0.24ms** |

The first two produce identical output (`sorted(a) == sorted(b)` is `True`).
`GROUP BY MIN` is 33% faster than the window and simpler to read; use it.

Correctness against `walk_keeps_min_depth_when_two_paths` (0→1→4 at depth 2
and 0→2→3→4 at depth 3): the `GROUP BY MIN` form returns `(0, 4, 2)` and never
`(0, 4, 3)`. Confirmed as part of the 12-test oracle below.

**Carrying depth costs 7.8x** over discarding it. If a caller only needs the
reachable set, dropping the depth column is the single largest available win.

### The oracle: 12 of 12

`walk.rs` has **12** tests, not the 7 the brief and the first pass reference.
All 12 were re-implemented as CTEs against in-memory tables with the
production schema, and all 12 pass, including the 5 depth-carrying ones the
first pass did not cover.

```
PASS  linear_chain_records_start_and_downstream
PASS  halt_node_is_recorded_but_not_expanded
PASS  cycle_terminates_and_dedups
PASS  two_tags_keep_separate_reach_sets
PASS  multiple_starts_one_tag
PASS  start_that_is_halt_is_recorded_only
PASS  empty_starts_is_empty
PASS  walk_depth_is_bfs_layer
PASS  walk_depth_cap_records_at_cap_but_stops
PASS  walk_keeps_min_depth_when_two_paths
PASS  walk_cycle_with_cap_terminates
PASS  walk_halt_and_depth
12/12 pass
```

The multi-source, halt-gated, depth-carrying general case, matching
`multi_source_walk` exactly:

```sql
WITH RECURSIVE reach(tag, node, depth) AS (
  SELECT tag, node, depth FROM starts
  UNION
  SELECT r.tag, e."to", r.depth+1 FROM reach r
  JOIN edge e ON e."from" = r.node
  WHERE r.node NOT IN (SELECT node FROM halt)
    AND (:cap IS NULL OR r.depth < :cap)
    AND r.depth < 64
)
SELECT tag, node, MIN(depth) FROM reach GROUP BY tag, node ORDER BY tag, node
```

Note the halt test is on `r.node`, the node being expanded FROM, which is what
makes a halt node recorded but not expanded. The unconditional `r.depth < 64`
is the divergence leash for the uncapped case, and by H6 it is a work budget
that must be sized to the data.

---

## H4. SCC in SQL: the first pass was wrong

The claim "recursive CTEs cannot express SCC" is true of a single CTE and
false of SQL plus a driver loop. Kosaraju needs DFS finish order, which is not
expressible. Tarjan needs a lowlink stack, also not expressible. **The
forward-backward (FB) decomposition needs neither**, and it is built from
exactly the two CTEs already in production use.

FB: for a pivot node, `SCC(pivot) = Descendants(pivot) ∩ Predecessors(pivot)`.
Remove it, repeat on what is left.

The naive form runs FB over all 269,457 nodes. A cheap pre-pass shrinks it:
iteratively delete every node with no surviving in-edge or no surviving
out-edge, since only the residual core can hold a non-trivial SCC.

```sql
-- peel, to fixpoint
DELETE FROM core WHERE node NOT IN
  (SELECT e."to" FROM edge e JOIN core c ON e."from"=c.node);
DELETE FROM core WHERE node NOT IN
  (SELECT e."from" FROM edge e JOIN core c ON e."to"=c.node);
```

Measured, real data, `PRAGMA cache_size=-64000`, with `ix_to` present:

| phase | result |
|---|---|
| peel | 269,457 nodes to a **2,156-node core** in 36 rounds, **3,119ms** |
| FB over the core | 4,256 CTE executions, **63ms** |
| total | **3.2s** |

Output: 16 non-trivial SCCs, sizes `[6, 4, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2]`,
44 nodes total.

Checked against an independent iterative Tarjan over the same edge set:

```
Tarjan (python, iterative): 269457 nodes, 269429 components, 452ms
non-trivial SCCs: 16, sizes [6, 4, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2]
total nodes in non-trivial SCCs: 44
```

**Identical.** The SQL route is exact.

It is also 7x slower than an interpreted Tarjan and far slower than the Rust
one, and the peel is 98% of that cost at 36 full-table round trips. So the
practical verdict stands where the first pass put it, for a different and
better-supported reason: **SCC in SQL is possible and correct, and it loses on
speed rather than on expressiveness.** Keep `tarjan` in Rust. Reach for FB
only where SCC is wanted without loading the graph into memory, for instance a
one-shot CLI against a database it does not own.

The peel round count is the lever if this is ever revisited. 36 rounds is the
longest chain of degree-1 tails in the graph, and a smarter peel (delete by
degree count rather than by anti-join, or peel from a precomputed degree
table) should cut it substantially.

---

## H5. The remaining two functions

### `build_condensed`: SQL, easily

Given a component assignment, the condensed DAG is one statement:

```sql
SELECT DISTINCT c1.comp, c2.comp
FROM edge e
JOIN comp c1 ON c1.node = e."from"
JOIN comp c2 ON c2.node = e."to"
WHERE c1.comp <> c2.comp
```

Measured with an identity component map over the full real edge set:
**260,052 condensed edges, 299ms.** The other fields `Cond` carries (`size`,
`cyclic`, `members`, `cadj_rev`) are all `GROUP BY` or a reversed projection
of the same table.

`build_condensed` is therefore SQL-expressible with **no blocker**, and it
inherits H4's constraint: it is only as available as the component assignment
feeding it.

### `count_pairs`: SQL, and faster than expected

`count_pairs` sums `|reach(node)|` over every node. The first pass called this
out of reach. Measured, real data, one node-only CTE per node:

| sample | result |
|---|---|
| 500 uniformly random seeds | 3,232 pairs, 7ms, **0.01ms/seed** |
| mean reachable-set size | 6.5 |
| extrapolated full sweep, 269,457 nodes | **~4 seconds**, exact |
| estimated total pairs | 1.74e6 |

`count(*)` over a node-only CTE has no distinct-counting trap; that trap
belongs to depth-carrying CTEs only.

**The blocker here is the data shape rather than SQL.** This works because mean reach is
6.5. On the synthetic 200,000-node component a single seed costs 433ms, so the
same sweep would be six orders of magnitude worse. `scc.rs`'s bitset-over-
components approach is O(ncomp²/64) and does not care about reach-set size,
which is exactly the case SQL cannot follow it into.

**Rule: `count_pairs` in SQL is viable if and only if mean reachable-set size
stays small. Measure it before relying on it, and keep the Rust path for
graphs with large strongly connected regions.**

---

## H7. What the engine already does

`src/engine/derive.rs` has two native recognizers that bypass the SQL fixpoint,
dispatched in order (derive.rs:805-815):

```rust
fn try_native_walk(...) -> Result<bool> {
    if self.try_native_depth_walk(comp_rules, derived_rules, timed)? {
        return Ok(true);
    }
    self.try_native_halt_bfs(comp_rules, derived_rules, timed)
}
```

- **`try_native_depth_walk`** (derive.rs:822) recognizes
  `head(node, depth)` / `head(tag, node, depth)` with a `MinBy(depth)` merge
  and a recursive `depth < cap` guard, calling
  `crate::walk::multi_source_walk` (derive.rs:1120). This is `multi_source_walk`.
- **`try_native_halt_bfs`** (derive.rs:1198) recognizes a 2-column head with
  one recursive rule of the form
  `head(tag, node) <- head(tag, mid), !halt(mid, _), edge(mid, node).`,
  calling `crate::walk::multi_source_halt_bfs` (derive.rs:1479). This is
  `multi_source_halt_bfs`.

Both carry a `DL_NO_HALT_BFS` A/B lever back onto the SQL fixpoint, and a
`DL_BFS_TRACE` miss trace.

`port_reach` is excluded by name, and the reason is scheduling rather than
semantics (derive.rs:1208-1214):

```rust
// port_reach has two independent seed rules. Its edge relation can
// still be growing when the native component is visited, while the
// SQL scheduler will revisit the component through the dependency.
// Keep this relation on the complete fixpoint path.
if derived_rules[comp_rules[0]].head.rel == "port_reach" {
    return Ok(false);
}
```

The native walk computes a closure once from the adjacency it sees. The SQL
fixpoint gets revisited when a dependency grows. So `port_reach` stays on SQL
because its input is not yet stable when the recognizer would fire, and that
is a property of the scheduler rather than of the walk.

### Where a CTE fits

**Complement rather than replace.** The two native recognizers own the reactive
in-tick path and beat any CTE there, because they hold the adjacency in memory
across a whole multi-tag walk rather than re-seeking B-trees per hop.

The CTE route is for the three places the native path does not reach:

1. **Ad-hoc and one-shot queries** against a database the process does not own
   and has not loaded. Zero setup, no adjacency build.
2. **`port_reach`-shaped relations excluded for scheduling reasons.** A CTE is
   a SQL-side construct, so it participates in the fixpoint normally and does
   not have the staleness problem the native recognizer has. That makes it a
   strictly better fallback than the current semi-naive fixpoint for exactly
   the relation that was excluded.
3. **Shapes the recognizer misses.** Every `miss!` arm currently falls back to
   the generic semi-naive fixpoint. A CTE lowering would be a much better
   fallback than that fixpoint for any shape reducible to seeded traversal.

The CTE would duplicate the native path only if it were applied to relations
the recognizers already claim, which there is no reason to do.

---

## The seven-function table, answered

| function | SQL verdict | evidence |
|---|---|---|
| `reaches_from` | **yes** | 0.23ms / 362 nodes; PK-prefix seek; flat across 38x table size |
| `reached_by` | **yes, with an index on the reverse column** | 0.04ms indexed, 160ms without |
| `multi_source_walk` | **yes** | CTE + `GROUP BY MIN(depth)`, 1.86ms; cap must exceed eccentricity |
| `multi_source_halt_bfs` | **yes** | `WHERE r.node NOT IN halt`; 12/12 oracle |
| `build_condensed` | **yes** | one `SELECT DISTINCT`, 299ms over 260,052 condensed edges |
| `count_pairs` | **yes on shallow graphs only** | 4s full sweep at mean reach 6.5; infeasible if reach sets are large |
| `tarjan` | **expressible, keep in Rust** | FB + driver loop is exact vs Tarjan, 3.2s against 452ms interpreted |

Up from 4 of 7 to 6 of 7, with the seventh possible and slow.

---

## Traps

**A default-pragma benchmark measures the page cache.** `cache_size=-64000`
turned an apparent 2.4x table-size penalty into a 1.04x one. Any scaling claim
made without stating the cache setting is unfalsifiable.

**`SEARCH ... USING AUTOMATIC COVERING INDEX` in a query plan means SQLite is
building an index per execution.** It appears alongside `BLOOM FILTER` and
costs 4,000x here. It reads like an optimization in the plan output. Grep for
`AUTOMATIC` in every `EXPLAIN QUERY PLAN` of a recursive CTE.

**On a `WITHOUT ROWID` table, an index on one column silently covers that
column plus the whole primary key.** `CREATE INDEX ix ON edge("to")` and
`CREATE INDEX ix ON edge("to","from")` produced identical plans and identical
times. Conversely, an index on the primary key's leading column is dead weight
(`idx_df_edge_from` is exactly that on the live table).

**`multiple recursive references` closes the visited-set design space.**

```
sqlite3.OperationalError: multiple recursive references: reach
```

No `NOT EXISTS (SELECT ... FROM the_cte)` inside a recursive term. Ever
tempting, always rejected.

**A depth cap is a work budget as much as a safety margin.** Setting it "generously"
above the true eccentricity costs linearly in wasted rows: 12.7x at cap 64
against the node-only form for the same 362 answers.

**The path-string simple-path formulation is `MemoryError` waiting on a dense
graph.** 1ms on real `df_edge` (368 path rows for 362 nodes), out of memory on
a single 300-node synthetic component with out-degree 3. Its cost is path
multiplicity, which is invisible from node and edge counts.

**Hand-rolled semi-naive iteration measured 2,800x slower.** The
folklore that manual loops beat recursive CTEs does not hold when the CTE
already has a PK-prefix seek.

**`walk.rs` has 12 tests, not 7.** The prior evaluation and the README's
six-function table both undercount, and the 5 missing ones are precisely the
depth-carrying cases where the divergence trap lives.

---

## Environment

- SQLite 3.53.2 via Python `sqlite3`, `page_size` 4096
- macOS Darwin 23.6.0, 16GB machine, two other labs running concurrently
- Live database opened `mode=ro` throughout; all writes went to
  `labs/graph-sqlite-opus/scratch.sqlite`, a copy
- Peak RSS of the scaling harness: **24MB**. Synthetic files 25MB and 247MB on
  disk
- All timings `time.perf_counter()`, median of 3 unless stated
- Real data: `rel_df_edge` 261,704 rows, 269,457 distinct nodes appearing in
  edges, `PRIMARY KEY ("from","to") WITHOUT ROWID`, live indexes
  `idx_df_edge_from` and `idx_df_edge_to`

Lab: `~/projects/claude-research/labs/graph-sqlite-opus/`

| script | covers |
|---|---|
| `gen_synth.py` | builds the 1M and 10M disjoint-component tables |
| `synth_lab.py` | H1 scaling, untuned |
| `h3_lab.py` | pragmas, index shapes, `MATERIALIZED`, prepared reuse, semi-naive, H2, H6 cost table |
| `h4_h6_lab.py` | H6 formulations, FB-SCC, condensation, `count_pairs` |
| `verify_lab.py` | H1 with matched pragmas, path-string blowup |
| `oracle_lab.py` | 12 `walk.rs` tests, Tarjan ground truth |

## What I could not test, and why

- **130M edges.** Capped at 10M by the memory and disk budget. H1's flatness
  across 1M and 10M plus a plan that does not change is the basis for
  extrapolating; it is an extrapolation.
- **Concurrent traversal under the daemon's write lock.** Every measurement is
  a single reader on an idle database. A traversal competing with tick writes
  is unmeasured and is the most likely place these numbers degrade.
- **`closure.c` dead-code and graphqlite schema claims.** Accepted from the
  first pass without re-derivation; they are source-reading claims and cheap
  to re-check if doubted.
- **`rel_port_reach` byte-for-byte parity.** Re-confirmed only that the
  materialized table has the shape and sizes reported (largest port 22,601
  rows, matching). The full 10-port set comparison was not re-run; the 12/12
  `walk.rs` oracle is the stronger correctness evidence and it is new.
- **A Rust-side timing of `tarjan`.** H4's comparison uses an interpreted
  Tarjan at 452ms as the reference, which flatters the SQL route. The Rust one
  will be considerably faster, which widens the gap and does not change the
  verdict.
- **Peel optimization for FB-SCC.** 36 anti-join rounds at 3.1s is clearly
  improvable and was left alone once the correctness result was in hand.
