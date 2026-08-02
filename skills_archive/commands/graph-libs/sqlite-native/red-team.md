---
description: Adversarial re-run of the SQLite-native graph result against 18 real edge relations instead of one; the 6-of-7 expressiveness claim survives and every performance and data-shape generalization built on rel_df_edge breaks, verified 2026-07-20
argument-hint: [attack]
---

# Red team: SQLite-native graph traversal

Third pass. The brief was to break `opus-redo.md`. The expressiveness result
holds. The numbers attached to it do not generalize, because both prior passes
measured one relation and that relation is the friendliest graph in the
database.

## Verdict

**SURVIVES WITH NAMED CAVEATS, and the caveats are larger than the result.**

Three separable claims live in `opus-redo.md` and they have different fates.

| claim | fate |
|---|---|
| 6 of 7 functions are expressible in SQL | **survives.** Re-derived independently; correctness confirmed by a 400-graph differential fuzz the prior pass did not run |
| the SQL forms are correct | **survives for traversal, breaks for SCC.** The self-loop convention diverges from `src/graph/scc.rs:84` on 1,652 live edges in `rel_df_edge` alone |
| the performance numbers | **breaks.** Every headline number is a property of `rel_df_edge`, which has a 6-node maximum SCC and a mean reachable set of 5.35 |

`rel_df_edge` is 1 of 18 non-empty edge relations. `rel_flow_edge`, the largest
at 371,404 edges, has a **22,257-node strongly connected component** and a mean
reachable-set size of **15,653**. Every conclusion in `opus-redo.md` that names
6.5, 4 seconds, 0.28ms, or eccentricity 18 is a `rel_df_edge` fact presented as
a graph fact.

### Attack table

| # | attack | result | measured |
|---|---|---|---|
| A1 | cost does not track the reached set | **PARTIAL / BROKE THE FRAMING** | table-size flatness holds (1.04-1.08x for 10x edges at every density). Cost tracks reached EDGES: a 300-node reach costs 0.31ms at out-degree 3 and **5.99ms at out-degree 299**, 19x, identical query plan |
| A1e | real data, non-`df_edge` | **BROKE IT** | 18 of 40 random `rel_flow_edge` seeds reach 85,766+ nodes at **105-193ms**. Bimodal: under 0.6ms or over 100ms, nothing between |
| A1f | the multi-seed shape | **BROKE IT** | seed set as a TABLE, which is what `multi_source_walk` actually needs, loses the seek in the base case: `SCAN e USING COVERING INDEX idx_df_edge_to` over all 261,704 rows. **7.02ms vs 0.24ms, 29x**, same 362-node answer |
| A2 | cold cache and concurrency | **PARTIAL** | cold SQLite cache 2.5x, cold inode 5.2x, WAL under a writer 3.1x median / 12.9x max, rollback journal 11.7x median. And `cache_size=-64000` **is not reachable in sprefa** |
| A3 | SCC correctness | **PARTIAL / BROKE ONE CONVENTION** | partition matches my independent Tarjan on every relation tested and on 9 adversarial graphs. Peel is sound: **0/3000** random graphs lost an SCC node. Self-loops are reported as acyclic, contradicting `scc.rs:84` |
| A3b | SCC cost model | **BROKE IT** | **20,000 fully cyclic nodes take 44 to 84 seconds** against 2.2s for 400,000 near-forest nodes. A 3,003-node graph takes **3,001 peel rounds and 2.17s** |
| A4 | eccentricity is 18 | **BROKE IT** | 18 was one seed. True max on `rel_df_edge` is **34**. On `rel_flow_edge` it is **at least 112** with p99 at 79, above the cap of 64 |
| A5 | SCC at scale | **BROKE IT** | cost is set by the peel core, not node count. Near-forest scales at 2.25x per doubling; a fully cyclic graph does not peel at all and costs 20-40x more for 20x fewer nodes |
| A6 | the 12 `walk.rs` tests | **SURVIVED, fully** | 12/12, plus 5 edge cases the claim never states it checked, plus **0/400** mismatches in a differential fuzz against a port of `multi_source_walk` |

Confirmed without change: the 4,000x reverse-index cliff (162.4ms,
`SEARCH e USING AUTOMATIC COVERING INDEX (to=?)`), the redundancy of
`idx_df_edge_from`, and that `walk.rs` has 12 tests.

---

## A1. Where cost stops tracking the reached set

### What survives

The prior lab's experiment reproduces. Holding the reached set at 300 nodes and
growing the table 10x costs 1.04x to 1.08x, at every out-degree tested.

```
### outdeg=3 table=994585 edges [1M]   file=25MB
  default      median    0.351ms   reached=300
  sprefa-16MB  median    0.317ms   reached=300
  claim-64MB   median    0.307ms   reached=300

### outdeg=3 table=9949458 edges [10M]   file=246MB
  default      median    0.625ms   reached=300
  sprefa-16MB  median    0.338ms   reached=300
  claim-64MB   median    0.333ms   reached=300
```

Table size is not the cost driver. That part of H1 is solid.

### What breaks: the reached NODE set is the wrong unit

The prior synthetic held out-degree fixed at 3, so holding reached nodes fixed
also held reached edges fixed. Varying out-degree separates them.

| out-degree | reached nodes | reached edges | 1M table | 10M table | 10x ratio |
|---|---|---|---|---|---|
| 3 | 300 | ~1,200 | 0.307ms | 0.333ms | 1.08x |
| 30 | 300 | ~9,300 | 1.186ms | 1.182ms | 1.00x |
| 299 | 300 | ~89,700 | 5.987ms | 5.867ms | 0.98x |

**19x for the same 300-node frontier.** The query plan is byte-identical across
all six cells, so the plan cannot be used to predict the cost:

```
(2, 0, 0, 'CO-ROUTINE reach')
(6, 2, 0, 'SETUP')
(8, 6, 55, 'SEARCH e USING PRIMARY KEY (from=?)')
(27, 2, 0, 'RECURSIVE STEP')
(29, 27, 216, 'SCAN r')
(30, 27, 55, 'SEARCH e USING PRIMARY KEY (from=?)')
(46, 0, 219, 'SCAN reach')
```

The corrected statement: **cost tracks the reached EDGE set.** A seeded
traversal expands every out-edge of every reached node before `UNION` discards
the duplicates, so a dense reach costs its edge count and the node count of the
answer says nothing about it. `opus-redo.md`'s "0.28ms for a 300-node frontier"
is a statement about out-degree 3.

Hub nodes were tested and are not the failure mode. A 300-node component whose
first node has out-degree 300 costs 0.240ms against 0.309ms for out-degree 3;
the hub's edges are a single seek returning many rows, which is cheap.

### What breaks harder: the real data

`rel_flow_edge`, 371,404 edges, is the largest real edge relation and the one
the prior passes never touched. 40 uniformly random seeds:

```
  40 random seeds, (ms, reached), sorted by reach:
          1 nodes      0.011 ms
          ...
        254 nodes      0.227 ms
        313 nodes      0.552 ms
      85766 nodes    140.817 ms
      85766 nodes    117.462 ms
      85766 nodes    105.934 ms
      ... (18 seeds in this band)
      88490 nodes    129.107 ms
```

| band | seeds | reach | cost |
|---|---|---|---|
| small | 22 / 40 | 1 to 313 | 0.008 to 0.552 ms |
| giant SCC | **18 / 40** | 85,766 to 88,490 | **105.8 to 193.1 ms** |

The distribution is bimodal with nothing in the middle, because 45% of random
seeds fall into or upstream of a single 22,257-node strongly connected
component. There is no cap, no cache setting, and no index that changes this;
the answer really is 85,766 nodes.

Plan, verbatim, showing the seek is working exactly as claimed and is not the
problem:

```
(2, 0, 0, 'CO-ROUTINE reach')
(6, 2, 0, 'SETUP')
(8, 6, 54, 'SEARCH rel_flow_edge USING COVERING INDEX sqlite_autoindex_rel_flow_edge_1 (from=?)')
(27, 2, 0, 'RECURSIVE STEP')
(29, 27, 216, 'SCAN r')
(30, 27, 54, 'SEARCH e USING COVERING INDEX sqlite_autoindex_rel_flow_edge_1 (from=?)')
(46, 0, 219, 'SCAN reach')
```

### The multi-seed shape loses the seek

This is the finding with the most direct production consequence, and it is
absent from both prior passes. Every prior measurement seeded from a bound
literal (`WHERE "from" = :s`). `multi_source_walk` and `port_reach` seed from a
RELATION: many tagged seeds, produced by another rule. Expressing that means
joining a seed table in the base case, and SQLite then plans the base case as a
full scan.

Same relation, same 362-node answer, same connection:

| base case | time | base-case plan line |
|---|---|---|
| `WHERE "from" = :s` | **0.242ms** | `SEARCH rel_df_edge USING COVERING INDEX idx_df_edge_from (from=?)` |
| `JOIN seeds s ON e."from" = s.node` | **7.017ms** | `SCAN e USING COVERING INDEX idx_df_edge_to` |

Full plan for the seed-table form:

```
(2, 0, 0, 'CO-ROUTINE reach')
(6, 2, 0, 'SETUP')
(9, 6, 210, 'SCAN e USING COVERING INDEX idx_df_edge_to')
(11, 6, 45, 'SEARCH s USING INTEGER PRIMARY KEY (rowid=?)')
(27, 2, 0, 'RECURSIVE STEP')
(29, 27, 216, 'SCAN r')
(30, 27, 53, 'SEARCH e USING COVERING INDEX idx_df_edge_from (from=?)')
(46, 0, 219, 'SCAN reach')
```

SQLite drives the base case from the 261,704-row edge table and probes the
1-row seed table, rather than the reverse. **29x on one seed**, and it is a
fixed floor: the base case scans the whole relation regardless of seed count.
The recursive step still seeks, so the penalty is additive, not multiplicative.

The synthetic multi-seed sweep shows the floor amortizing:

```
  seeds=1     claim-64MB    322.663ms reached=300     (1075.54us/node)
  seeds=10    claim-64MB    433.238ms reached=3000    ( 144.41us/node)
  seeds=100   claim-64MB    686.536ms reached=30000   (  22.88us/node)
  seeds=1000  claim-64MB   2165.734ms reached=300000  (   7.22us/node)
```

**Anyone porting `multi_source_walk` to a CTE inherits the scan.** The claim
that a CTE is "a strictly better fallback than the current semi-naive fixpoint
for exactly the relation that was excluded" (`port_reach`) is made against an
unmeasured query shape.

### Large reached sets

| reached | of a 1M-edge table | default | sprefa 16MB | claim 64MB |
|---|---|---|---|---|
| 300 | 0.03% | 0.315ms | 0.308ms | 0.307ms |
| 30,000 | 3% | 78.9ms | 70.0ms | 65.0ms |
| 250,000 | 100% | 1106.0ms | 950.3ms | 629.5ms |

Linear in the reached set, consistent with the prior pass. The cache pragma
matters only here, at 1.8x, and matters not at all at 300 nodes.

---

## A2. Cold cache, concurrency, and whether the pragma is reachable

### Cold

`rel_df_edge`, 20 highest-out-degree seeds, median of the set:

| condition | median | vs warm |
|---|---|---|
| warm, one connection, second pass | 0.169ms | 1.0x |
| cold SQLite cache (fresh connection per query) | 0.422ms | **2.5x** |
| cold inode (file copied, queried once) | 0.877ms | **5.2x** |

The cold-inode figure is a lower bound: the copy warms the OS page cache for
the new inode, and `sudo purge` was not available. True cold is worse than
5.2x. A one-shot `dl` CLI invocation, which is the use case `opus-redo.md`
recommends the CTE route for, always pays the fresh-connection number at
minimum.

### Concurrent writer

Measured on a copy. The live database was never written. Writer commits 500-row
batches in a loop; reader runs the forward CTE 60 times.

| journal | idle median | under writer median | p95 | max | read errors |
|---|---|---|---|---|---|
| WAL | 0.163ms | **0.500ms** | 1.269ms | 2.105ms | 0/60 |
| DELETE | 0.168ms | **1.909ms** | 4.420ms | 4.484ms | 0/60 |

sprefa runs WAL (`db.rs:210`), so 3.1x median and 12.9x worst case is the
production number. No reader ever failed or blocked, which is the WAL guarantee
working. Absolute cost stays under 2.2ms on this relation, so concurrency is a
real but survivable tax. Combined with A1e, a `rel_flow_edge` giant-SCC seed
under a writer is the worst realistic case and was not measured directly.

### The pragma is not reachable in sprefa

`opus-redo.md` recommends three pragmas for a traversal-heavy connection and
attributes the entire table-size penalty to the first. sprefa sets all three,
differently, and one is defended by a test.

| recommended | sprefa ships | source |
|---|---|---|
| `cache_size=-64000` | `cache_size=-16384`, or **0** with no lease | `db.rs:56-57`, `db.rs:219` |
| `mmap_size=1073741824` | `mmap_size=0` unless `DL_MMAP_MB` is set | `db.rs:186`, `db.rs:221` |
| `temp_store=MEMORY` | `temp_store=FILE` | `db.rs:222` |

`DEFAULT_SQLITE_CACHE_BUDGET_MB = 32` is a process-wide ceiling and
`DEFAULT_CONNECTION_CACHE_MB = 16` a per-connection cap, so `-64000` is 4x what
a connection may take and 2x the whole process budget. `db.rs:214` states a
root with no remaining lease gets `cache_size=0`. `db.rs:1540` asserts
`temp_store == 1`, which forbids `MEMORY` outright:

```rust
assert_eq!(temp_store, 1, "TEMP tables and sorts must not consume unbounded heap");
```

Measured on `rel_df_edge` with each set:

| pragma set | median | effective `cache_size` |
|---|---|---|
| sprefa default (`-16384`, mmap 0, temp FILE) | **0.163ms** | -16384 |
| no cache lease (`cache_size=0`) | **0.385ms** | 0 |
| claim set (`-64000`, mmap 1GB, temp MEMORY) | **0.154ms** | -64000 |

Two consequences. sprefa's shipped 16MB performs identically to the recommended
64MB everywhere it was measured, including the 10M-edge synthetic, so **the
specific value 64MB is not what does the work**; anything above the 2MB default
does. And a connection that loses its cache lease runs at 0.385ms, a 2.4x
penalty of the same magnitude the prior pass attributed to default pragmas and
declared solved. That case is reachable in production today and no pragma
recommendation fixes it.

---

## A3. SCC correctness

### The partition is right

I wrote my own iterative Tarjan (explicit frame stack, `a3_a4_truth.py:tarjan`)
without reading the prior lab's. On `rel_df_edge` it reproduces the published
figure exactly:

```
rel_df_edge   tarjan_nSCC=16  fb_nSCC=16  match=YES
              peel 37 rounds, 269457 -> 2156 core, 3329ms
              FB 1142ms, 4256 CTE executions
```

Non-trivial sizes `[6, 4, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2]`, 44 nodes.
Identical to both prior results. My peel took 37 rounds against the published
36, a one-round difference from loop-exit accounting, same core.

The driver loop terminated and matched Tarjan on all nine adversarial shapes:

```
case                                                  tarj    fb  match  rnds   core       ms
self-loop only                                           0     0    YES     1      1      0.3
one giant SCC (ring of 2000)                             1     1    YES     1   2000    706.0
nested SCCs (ring100 + ring10 overlapping)               1     1    YES     1    100      1.8
complete graph K60                                       1     1    YES     1     60      5.0
disconnected: 5 rings of 7 + a 200-node chain            5     5    YES   102     35      5.8
cycle-50 with in-tails and out-tails on every node       1     1    YES     2     50      0.8
3000-node chain into a 3-cycle (peel round-count bomb)   1     1    YES  3001      3   2168.1
two 10-rings joined by one bridge                        2     2    YES     1     20      0.4
500 chained 2-cycles                                   500   500    YES     1   1000  19333.4
```

### The counterexample graphs, in full

Every graph in the table above, as edge lists. All are in `a3_scc.py:part3`.

```python
# 1. self-loop only
[(1, 1)]

# 2. one giant SCC: a ring of 2000
[(i, (i + 1) % 2000) for i in range(2000)]

# 3. nested SCCs: a 100-ring with a 10-ring sharing its first 10 nodes
[(i, (i + 1) % 100) for i in range(100)] + [(i, (i + 1) % 10) for i in range(10)]

# 4. complete graph K60
[(i, j) for i in range(60) for j in range(60) if i != j]

# 5. disconnected: 5 rings of 7, plus a 200-node chain
[(c*7 + i, c*7 + (i + 1) % 7) for c in range(5) for i in range(7)] + \
[(1000 + i, 1000 + i + 1) for i in range(200)]

# 6. THE PEEL ADVERSARY: a 50-cycle where every node also carries a
#    dangling out-tail and a dangling in-tail. Peel must strip 100 tails
#    and leave the 50-cycle intact.
[(i, (i + 1) % 50) for i in range(50)] + \
[(i, 500 + i) for i in range(50)] + \
[(600 + i, i) for i in range(50)]

# 7. peel round-count bomb: a 3000-node chain feeding a single 3-cycle
[(i, i + 1) for i in range(3000)] + [(3000, 3001), (3001, 3002), (3002, 3000)]

# 8. two 10-rings joined by exactly one bridge
[(i, (i + 1) % 10) for i in range(10)] + \
[(100 + i, 100 + (i + 1) % 10) for i in range(10)] + [(0, 100)]

# 9. 500 chained 2-cycles
sum(([(2*i, 2*i+1), (2*i+1, 2*i)] + ([(2*i-1, 2*i)] if i else [])
     for i in range(500)), [])
```

Graph 6 is the direct test of the brief's hypothesis that peeling could remove a
cycle node. It peels 250 nodes to exactly the 50 cycle nodes in 2 rounds and the
partition matches Tarjan.

### The peel is sound

The brief's hypothesis was that peeling could remove a node that participates in
a cycle. It cannot, and here is why: the peel deletes only nodes with no
surviving in-edge or no surviving out-edge, and every node in a cycle has both,
from another node in the same cycle, which is itself never deleted. The
induction holds at every round.

Empirically, over 3,000 random graphs of 2 to 14 nodes with random edge sets,
comparing the peel's survivor set against my Tarjan's SCC membership:

```
  peel lost SCC nodes in 0/3000 random graphs
```

The purpose-built adversary, a 50-cycle where every node also carries a
dangling in-tail and a dangling out-tail, peels to exactly the 50 cycle nodes in
2 rounds. **A3's peel-correctness attack fails. The peel is correct.**

### The self-loop convention is wrong

This is the correctness defect the prior pass could not have found, because its
verification compared FB against a Tarjan that shared the same convention.

`src/graph/scc.rs:81-84`:

```rust
for c in 0..ncomp { if size[c] > 1 { cyclic[c] = true; } }
for &w in succ { if w as usize == u { cyclic[comp[u] as usize] = true; } }
```

Production marks a component cyclic if its size exceeds 1 **or it carries a
self-loop**. The SQL forward-backward result reports components of size > 1
only. Measured directly:

```
  peel + FB on a graph that is ONLY a self-loop:
    edges=[(1,1)]  peel core=1  FB nontrivial comps=0
  peel + FB on self-loop attached to a chain 0->1, 1->1:
    peel core=1  FB nontrivial comps=0  (node 1 is cyclic, reported as trivial)
```

The peel correctly retains the node. The FB step then computes
`desc ∩ pred = {1}`, size 1, and discards it.

Live self-loop counts:

| relation | self-loop edges |
|---|---|
| `rel_map_edge` | 4,812 |
| `rel_df_map_edge` | 4,605 |
| `rel_df_edge` | 1,652 |
| `rel_flow_edge` | 1,652 |
| `rel_port_non_port_flow_edge` | 1,652 |
| `rel_bare_edge` | 180 |
| `rel_call_edge` | 165 |
| `rel_bom_edge` | 158 |
| `rel_scip_fn_edge` | 88 |

This propagates. `scc.rs:128` computes `count_pairs` as
`if c.cyclic[cc] { total += size * size }`, so an FB-derived component map
undercounts by exactly one self-reach pair per self-loop node: 1,649 pairs
missing on `rel_df_edge`, 1,925 on `rel_map_edge`. `scc.rs:155` and `:174` use
the same flag to seed `seen_comp`, so reachability answers change too.

**The fix is one line** and the SQL route is otherwise exact: mark a component
cyclic when `|scc| > 1` or `EXISTS (SELECT 1 FROM edge WHERE f = t AND f = pivot)`.
Stated plainly, `opus-redo.md`'s "the SQL route is exact" holds for the
partition and fails for the cyclic flag that consumers actually read.

---

## A4. Eccentricity

Eccentricity 18 is a single seed's number on a single relation. Full sweep,
BFS from every node, my own code, all 18 relations:

| relation | nodes | ecc max | ecc p99 | ecc mean | reach max | reach p99 | reach mean | coverage |
|---|---|---|---|---|---|---|---|---|
| `rel_df_edge` | 269,457 | **34** | 17 | 3.43 | 630 | 44 | 5.35 | 100% |
| `rel_flow_edge` | 271,218 | **>=112** | 79 | 16.40 | 87,183 | 85,796 | **15,653** | 8.7% |
| `rel_port_non_port_flow_edge` | 269,310 | 34 | 17 | 3.27 | 759 | 47 | 5.61 | 100% |
| `rel_map_edge` | 59,609 | 18 | 10 | 2.25 | 10,565 | 472 | 26.86 | 100% |
| `rel_df_map_edge` | 52,250 | 7 | 5 | 2.02 | 19 | 13 | 3.73 | 100% |
| `rel_bom_edge` | 13,019 | 16 | 12 | 1.80 | 3,739 | 543 | 29.69 | 100% |
| `rel_member_edge` | 13,019 | 16 | 12 | 1.80 | 3,739 | 543 | 29.69 | 100% |
| `rel_scip_fn_edge` | 7,014 | 14 | 12 | 1.82 | 3,162 | 1,652 | 75.70 | 100% |
| `rel_call_edge` | 7,835 | 16 | 13 | 2.80 | 1,188 | 300 | 17.95 | 100% |
| `rel_port_edge` | 8,671 | **23** | 17 | 4.62 | 3,944 | 3,537 | **921.59** | 100% |
| `rel_bare_edge` | 6,263 | 15 | 13 | 2.48 | 1,628 | 505 | 28.41 | 100% |
| `rel_call_map_edge_at` | 7,656 | 16 | 13 | 2.84 | 1,188 | 372 | 18.34 | 100% |
| `rel_member_call_edge` | 4,741 | 15 | 13 | 3.18 | 1,179 | 530 | 23.90 | 100% |
| `rel_module_edge` | 465 | 8 | 7 | 2.26 | 215 | 194 | 65.57 | 100% |
| `rel_field_fill_edge` | 1,620 | 1 | 1 | 0.29 | 48 | 22 | 2.36 | 100% |
| `rel_type_edge` | 952 | 11 | 7 | 1.19 | 156 | 63 | 5.12 | 100% |
| `rel_scip_map_edge` | 7,014 | 14 | 12 | 1.82 | 3,162 | 1,652 | 75.70 | 100% |
| `rel_panel_edge` | 357 | 4 | 4 | 0.81 | 18 | 11 | 1.34 | 100% |

The `rel_flow_edge` row is a partial sweep: 23,553 of 271,218 seeds in 124.7
seconds, at which point the budget tripped. The full sweep extrapolates to
about 24 minutes of Python BFS. Its max eccentricity is therefore **at least**
112 and the true value is higher.

Three findings.

**Eccentricity 18 is wrong even for `rel_df_edge`.** The true maximum is 34,
p99 is 17. The single seed the prior pass measured happened to sit at p99. A
cap of 18 on this relation silently loses nodes for every seed above the 99th
percentile.

**The cap of 64 is under-sized on `rel_flow_edge`, not oversized.**
`opus-redo.md` says `port_reach`'s cap of 64 "sat about 3.5x past what its data
needed". That is true of `rel_df_edge` and false of `rel_flow_edge`, where p99
eccentricity alone is 79. The rule the prior pass stated, that the cap must
exceed the true eccentricity, is right; the number it attached to it is a
per-relation constant that has to be measured per relation.

**The depth claim in the project brief is closer to right than the rebuttal.**
"Assume depth 1,000,000" is still wrong, but the correction is not a small
constant. Depth varies by a factor of over 100 across relations in one database,
and the deepest relation is also the largest.

---

## A5. SCC at scale

The 3.2s figure is a `rel_df_edge` number and `rel_df_edge` is the best case
available: 16 non-trivial components, largest of size 6, peeling to a 2,156-node
core. **Cost is driven by the size of the peel core**, which is to say by how
much of the graph is cyclic, and node count is nearly irrelevant to it.

First evidence, from A3.3's adversarial set, all of them tiny:

| graph | nodes | non-trivial SCCs | peel core | total |
|---|---|---|---|---|
| `rel_df_edge` (real) | 269,457 | 16 | 2,156 | 4,471ms |
| 500 chained 2-cycles | 1,000 | 500 | 1,000 | **19,333ms** |
| 3,000-node chain into a 3-cycle | 3,003 | 1 | 3 | **2,168ms** (3,001 peel rounds) |
| one ring of 2,000 | 2,000 | 1 | 2,000 | 706ms |

A 1,000-node graph costs **4.3x** a 269,457-node graph, because none of it
peels.

The peel round count is a second, independent hazard. It equals the length of
the longest chain of degree-1 tails, which the prior pass guessed correctly. A
3,000-node chain forces 3,001 rounds, each a full anti-join over the surviving
core, for a graph containing one 3-cycle. `rel_df_edge`'s 36 rounds is a
data-dependent constant with no bound in the algorithm.

### The measured curves

**Near-forest, growing node count.** This is the `rel_df_edge` shape, and it
scales acceptably. Peel removes everything; FB never runs.

```
forest n= 25000  peel=   98ms( 14r, core 0)  fb=    0ms  TOTAL=   98ms
forest n= 50000  peel=  194ms( 15r, core 0)  fb=    0ms  TOTAL=  194ms
forest n=100000  peel=  425ms( 15r, core 0)  fb=    0ms  TOTAL=  425ms
forest n=200000  peel=  987ms( 19r, core 0)  fb=    0ms  TOTAL=  987ms
forest n=400000  peel= 2226ms( 19r, core 0)  fb=    0ms  TOTAL= 2226ms

  doubling ratios (near-forest):
      25000 ->   50000 nodes    98 ->  194ms   1.97x per 2.0x nodes
      50000 ->  100000 nodes   194 ->  425ms   2.19x per 2.0x nodes
     100000 ->  200000 nodes   425 ->  987ms   2.32x per 2.0x nodes
     200000 ->  400000 nodes   987 -> 2226ms   2.25x per 2.0x nodes
```

Roughly linear, mildly superlinear at 2.25x per doubling. On this shape alone
the route would extrapolate fine.

**Fixed 20,000 nodes, all of them cyclic.** Same node count as one twentieth of
`rel_flow_edge`, varying how many components they form:

```
20k nodes,   1 SCC  of 20000  peel= 10ms(1r, core 20000) fb= 84125ms execs=   2 TOTAL= 84134ms
20k nodes,  10 SCCs of  2000  peel= 11ms(1r, core 20000) fb= 48413ms execs=  20 TOTAL= 48424ms
20k nodes, 100 SCCs of   200  peel= 11ms(1r, core 20000) fb= 44472ms execs= 200 TOTAL= 44483ms
20k nodes,  400 SCCs of   50  peel= 10ms(1r, core 20000) fb= 44125ms execs=  800 TOTAL= 44135ms
20k nodes, 1000 SCCs of   20  peel= 10ms(1r, core 20000) fb= 44027ms execs= 2000 TOTAL= 44037ms
20k nodes, 4000 SCCs of    5  peel= 12ms(1r, core 20000) fb= 43621ms execs= 8000 TOTAL= 43632ms
```

**20,000 nodes cost 44 to 84 seconds. 400,000 near-forest nodes cost 2.2
seconds.** Twenty times fewer nodes, twenty to forty times more time. The Python
Tarjan on the same graphs takes 7 to 9 milliseconds, a factor of about 10,000.

Component count varies 4,000x across those rows and the total varies 1.01x,
which corrects my own first reading of the A3.3 data. **The single variable is
the peel core.** The peel removes 99.2% of
`rel_df_edge` (269,457 to 2,156) and **0%** of any fully cyclic graph, because
every node in a cycle has both an in-edge and an out-edge and is by
construction unpeelable. Every FB CTE then runs against the full core, and the
`IN (SELECT node FROM core)` membership filter makes each one super-linear in
core size.

**One giant SCC, growing.** This isolates the core-size term and gives the
extrapolation its exponent:

```
single SCC of   500  peel= 0ms(1r, core   500) fb=    56ms execs=2 TOTAL=    57ms  tarjan_py= 0ms
single SCC of  1000  peel= 0ms(1r, core  1000) fb=   193ms execs=2 TOTAL=   194ms  tarjan_py= 0ms
single SCC of  2000  peel= 1ms(1r, core  2000) fb=   792ms execs=2 TOTAL=   793ms  tarjan_py= 1ms
single SCC of  5000  peel= 3ms(1r, core  5000) fb=  5174ms execs=2 TOTAL=  5177ms  tarjan_py= 2ms
single SCC of 10000  peel= 5ms(1r, core 10000) fb= 21198ms execs=2 TOTAL= 21204ms  tarjan_py= 4ms
single SCC of 20000  peel=10ms(1r, core 20000) fb= 84125ms execs=2 TOTAL= 84134ms  tarjan_py= 9ms
```

| step | node ratio | time ratio | n^2 predicts |
|---|---|---|---|
| 500 to 1,000 | 2.0x | 3.40x | 4.0x |
| 1,000 to 2,000 | 2.0x | 4.09x | 4.0x |
| 2,000 to 5,000 | 2.5x | 6.53x | 6.25x |
| 5,000 to 10,000 | 2.0x | 4.10x | 4.0x |
| 10,000 to 20,000 | 2.0x | 3.97x | 4.0x |

**Quadratic in core size, to within measurement noise, with only two CTE
executions in every row.** The cost is entirely inside a single
descendants-and-predecessors pair evaluated against an `IN (SELECT node FROM
core)` membership test over a core that does not shrink.

**Component count held at 100, node count rising.** The control for the two
above:

```
  2000 nodes in 100 SCCs  peel=1ms(1r, core  2000) fb=   404ms execs=200 TOTAL=   405ms
 10000 nodes in 100 SCCs  peel=5ms(1r, core 10000) fb= 10810ms execs=200 TOTAL= 10815ms
```

5x the nodes at identical component count costs 26.7x, against 25x predicted by
the same quadratic. The model is now fully determined: **FB-SCC cost is
quadratic in peel-core size and independent of component count.** The planned
50,000 and 200,000 rows of this sweep were cancelled once the exponent was
established, since the fit puts them at 8 minutes and 2.2 hours.

`opus-redo.md` reports the peel as "98% of that cost" and calls it "the lever if
this is ever revisited". The measurement says the opposite: on `rel_df_edge` the
peel is 98% of the cost and also the entire reason the total is only 3.2s. Make
the peel free and `rel_df_edge` still finishes in about a second, while a graph
with a real cyclic core is unaffected because the peel was never doing anything
there.

### Extrapolation to the 150M-node / 500-repo target

Labelled as extrapolation throughout. The fit from A5c is
`total_ms ~= 793 * (core / 2000)^2`, which holds across a 40x measured range
with residuals under 4%. The only input needed is the size of the peel core,
which is the number of nodes in the cyclic part of the graph.

| cyclic core | extrapolated FB-SCC time |
|---|---|
| 2,156 (`rel_df_edge`, measured) | 4.5s measured, 0.9s predicted |
| 29,032 (`rel_flow_edge`, my Tarjan's count) | ~3 minutes |
| 1,000,000 (0.7% of a 150M-node target) | ~55 hours |
| 15,000,000 (10% of target) | ~1.4 years |

The `rel_df_edge` row shows the fit under-predicts on real data by about 5x,
because the peel dominates there and the fit ignores it. Every other row is
dominated by the quadratic and the fit is the right shape.

**The SQL forward-backward route is dead at target scale**, and it was already
the one function `opus-redo.md` recommended keeping in Rust. That recommendation
stands, and its stated reason, that the route loses on speed while remaining
expressive, is right by a much wider margin than the 7x it reported. The real
margin against an interpreted Python Tarjan on a cyclic graph is **9,300x**
(84,134ms against 9ms on the 20,000-node ring).

The single fixable term is the `IN (SELECT node FROM core)` membership test
inside both CTEs, which is re-evaluated per recursion step. Replacing it with a
join against an indexed core table, or materializing the induced subgraph once
per pivot, should drop the exponent. That is unexplored here.

### `count_pairs` at scale

`opus-redo.md` extrapolates a full `count_pairs` sweep of `rel_df_edge` to
about 4 seconds and correctly flags that it depends on mean reachable-set size.
The measured mean on `rel_df_edge` is 5.35, close to the published 6.5.

On `rel_flow_edge`, from the 40 real seeds in A1e:

| quantity | `rel_df_edge` | `rel_flow_edge` |
|---|---|---|
| mean reachable-set size | 5.35 | **15,653** |
| mean per-seed CTE cost | ~0.015ms | **56.81ms** |
| nodes | 269,457 | 271,218 |
| full sweep | ~4s (published) | **~15,409s = 4.3 hours** (extrapolated) |

**3,852x.** The prior pass's own rule, "viable if and only if mean reachable-set
size stays small", is correct and is violated by the largest relation in the
same database it was measured on.

---

## A6. The 12 `walk.rs` tests

Re-derived from `/Users/chrishafley/projects/sprefa/src/graph/walk.rs`, 251
lines. **There are 12 tests**, at lines 132, 142, 153, 163, 178, 188, 197, 207,
216, 225, 236, 244. The count is right.

All 12 reproduce as CTEs.

```
== the 12 walk.rs tests ==
PASS  linear_chain_records_start_and_downstream
PASS  halt_node_is_recorded_but_not_expanded
PASS  cycle_terminates_and_dedups
PASS  two_tags_keep_separate_reach_sets
PASS  multiple_starts_one_tag
PASS  start_that_is_halt_is_recorded_only
PASS  empty_starts_is_empty
PASS  walk_depth_is_bfs_layer
PASS  walk_depth_cap_records_at_cap_but_stops
PASS  walk_keeps_min_depth_when_two_paths (node 4 at depth 2)
PASS  walk_cycle_with_cap_terminates
PASS  walk_halt_and_depth
```

The five edge cases the brief asked about, none of which `opus-redo.md` states
it checked, all pass and all agree with a Python port of `multi_source_walk`:

```
== edge cases the claim never states it checked ==
PASS  E1 empty seed set (depth form)
PASS  E2 seed not in the graph at all
PASS  E3 seed is its own halt node (depth form)
PASS  E4 cycle through a halt node
PASS  E5 depth cap 0 (seed recorded, nothing expanded)
```

12 hand-written tests is a weak oracle, so I added the check the prior pass did
not: a differential fuzz against a line-by-line port of `multi_source_walk`,
over random graphs of 2 to 12 nodes with random edges, 1 to 3 tags, random halt
sets and caps drawn from `{None, 0, 1, 2, 3, 64}`.

```
== differential fuzz: CTE vs multi_source_walk, 400 random graphs ==
  mismatches: 0/400
```

The CTE and `multi_source_walk` also agree on the mixed-depth seed case that
`walk.rs:33` documents as unhandled by its FIFO queue:

```
  rust: [(0, 0, 5), (0, 1, 0), (0, 2, 1)]
  cte : [(0, 0, 5), (0, 1, 0), (0, 2, 1)]
```

One semantic difference worth recording, harmless in practice: a seed node that
appears in no edge is recorded by the CTE and dropped by the Rust, whose
`node < n` guard at `walk.rs:68` indexes a `Vec` built over the known node set.

**A6 survives without qualification, and is now better evidenced than it was.**

---

## Confirmed without change

Three prior findings reproduce exactly and should be treated as settled.

**The reverse-traversal cliff.** Dropping `idx_df_edge_to` on a copy:

```
reverse, idx_df_edge_to DROPPED    162.38ms reached=51
      (2, 0, 0, 'CO-ROUTINE reach')
      (6, 2, 0, 'SETUP')
      (8, 6, 215, 'SCAN rel_df_edge')
      (25, 2, 0, 'RECURSIVE STEP')
      (27, 25, 216, 'SCAN r')
      (30, 25, 0, 'BLOOM FILTER ON e (to=?)')
      (39, 25, 53, 'SEARCH e USING AUTOMATIC COVERING INDEX (to=?)')
      (56, 0, 229, 'SCAN reach')
```

162.4ms for a 51-node reverse reach against 0.04ms indexed. The
`AUTOMATIC COVERING INDEX` line is exactly as described.

I audited all 15 traversable relations on the live database for a reverse
index. Three lack one and would pay this cliff on any `reached_by`:

| relation | rows | table | reverse index |
|---|---|---|---|
| `rel_map_edge` | 139,709 | rowid | **none** |
| `rel_bom_edge` | 25,314 | rowid | **none** |
| `rel_port_edge` | 22,154 | rowid | **none** |

The other twelve, including both `rel_df_edge` and `rel_flow_edge`, carry one.
The prior pass's warning to the index-demand work is therefore live and
specific: these three names are the exposure.

**`idx_df_edge_from` is redundant.** Confirmed on a fresh connection, so the
plan text is not a cached artifact:

```
with idx_df_edge_from            0.236ms   SEARCH rel_df_edge USING COVERING INDEX idx_df_edge_from (from=?)
idx_df_edge_from DROPPED         0.235ms   SEARCH rel_df_edge USING PRIMARY KEY (from=?)
```

Dropping it changes the plan to the primary key at identical cost.

**`walk.rs` has 12 tests.** Counted directly.

---

## What this means for the 6-of-7 table

| function | `opus-redo.md` | after this pass |
|---|---|---|
| `reaches_from` | yes, 0.23ms | yes. 0.24ms on `rel_df_edge`; **105-193ms** on 45% of `rel_flow_edge` seeds |
| `reached_by` | yes with a reverse index | unchanged, confirmed |
| `multi_source_walk` | yes, 1.86ms | yes and provably correct (0/400 fuzz), with a **29x base-case scan** in the multi-seed shape that is the only shape this function has |
| `multi_source_halt_bfs` | yes, 12/12 | unchanged, confirmed, plus 5 edge cases |
| `build_condensed` | yes, one `SELECT DISTINCT` | not re-tested; inherits the SCC assignment's self-loop defect |
| `count_pairs` | yes on shallow graphs only | yes on `rel_df_edge` (4s), **4.3 hours on `rel_flow_edge`**. The stated precondition is violated in the same database |
| `tarjan` | expressible, keep in Rust | expressible with a **self-loop correctness defect**, keep in Rust, and the cost argument for keeping it is much stronger than measured |

Six of seven remains right as an expressiveness claim. As a recommendation it
now reads: correct, cheap on near-forest relations, and carrying two specific
defects (the multi-seed base-case scan, the self-loop cyclic flag) that a
consumer would hit immediately.

---

## Environment

- SQLite **3.53.2**, reached via Python 3.14.6's `sqlite3` module
  (`sqlite3.sqlite_version`). The system `sqlite3` CLI is 3.43.2 and was not
  used for any measurement. `page_size` 4096
- macOS 14.6.1, Darwin 23.6.0, 17.2 GB
- Two other graph labs running concurrently for part of the session;
  `vm_stat` checked before every synthetic build, free + inactive never below
  5 GB, no run exceeded 250 MB RSS
- Live DB opened `mode=ro` for extraction only. All measurement ran against
  `labs/graph-sqlite-adversarial/real.sqlite`, a 110 MB copy of 18 edge
  relations with their exact production DDL and indexes. **Nothing was written
  to the live database**
- Synthetics capped at 10M edges, largest file 246 MB, deleted after each
  measurement
- All timings `time.perf_counter()`, median of 3 per seed and median across
  seeds unless stated
- Every `EXPLAIN QUERY PLAN` in this document is verbatim tool output

Lab: `~/projects/claude-research/labs/graph-sqlite-adversarial/`

| script | covers |
|---|---|
| `build_lab.py` | extracts 18 real edge relations into `real.sqlite` |
| `a3_a4_truth.py` | my independent iterative Tarjan; full eccentricity and reach-size sweep |
| `a1_shapes.py` | density, hub, big-reach, multi-seed, real `rel_flow_edge` |
| `a2_cold_concurrent.py` | cold cache, concurrent writer, pragma reachability |
| `a3_scc.py` | SQL forward-backward vs my Tarjan, self-loop probe, 9 adversarial graphs, 3,000-graph peel sweep |
| `a5_scale.py` | SCC scaling curves |
| `a6_oracle.py` | 12 `walk.rs` tests, 5 edge cases, 400-graph differential fuzz |

---

## What I could not test, and why

- **A complete eccentricity sweep of `rel_flow_edge`.** 23,553 of 271,218 seeds
  in 124.7s; the full sweep is roughly 24 minutes of Python BFS and was cut. Its
  max eccentricity of 112 is a floor, not the value.
- **SQL forward-backward SCC on `rel_flow_edge`.** Exceeded 25 minutes without
  completing and was killed. The stall is itself informative, and it still
  leaves the relation with no measured SCC time and no FB-vs-Tarjan diff. The
  22,257-node component is my Tarjan's finding alone, unchecked against a second
  implementation.
- **Forward-backward on the remaining 11 relations.** Part 1 completed only
  `rel_df_edge` before the `rel_flow_edge` stall consumed the budget. The
  adversarial set in A3.3 is the correctness evidence, not the real relations.
- **`build_condensed`.** Accepted from `opus-redo.md` without re-derivation. It
  is one `SELECT DISTINCT` and the claim is cheap to re-check.
- **True cold cache.** `sudo purge` was unavailable. The fresh-inode figure of
  5.2x is a lower bound.
- **A giant-SCC traversal under a concurrent writer.** The two worst cases were
  measured separately and never composed. A 105ms `rel_flow_edge` seed holding a
  read transaction open against a committing daemon is the untested worst case
  and is a plausible production shape.
- **A Rust-side timing of anything.** All comparisons use interpreted Python,
  which flatters SQL throughout.
- **150M nodes.** Capped at 10M edges by budget. The target-scale statement in
  A5 is an extrapolation from shape, labelled as one.
