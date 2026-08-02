---
description: Adversarial re-run of the petgraph verdict against dumped edge lists from the live sprefa DB. The SCC correctness claim survives; the speed claim, the 12.0 bytes/edge claim, the 1.56GB extrapolation, and the stack-overflow argument do not.
argument-hint: [hypothesis]
---

# petgraph on real sprefa graphs

Lab: `~/projects/claude-research/labs/graph-petgraph-realdata/`. Six edge lists
dumped from `~/.local/state/sprefa/roots/fbabddda40d22347/db.sqlite` (read-only
URI, daemon live). Every number below came out of `cargo run --release` in that
crate against those dumps.

## Verdict

**Adopt with named conditions, and drop `kosaraju_scc`.**

The prior run's central correctness claim holds: `kosaraju_scc` over a custom
`DualCsr` produces a partition byte-identical to sprefa's `tarjan` on all six
real graphs. The performance claim that justified replacing `tarjan` is a
measurement artifact and reverses under a controlled comparison.

The prior run compared sprefa's `tarjan` reading `Vec<Vec<u32>>` against
petgraph's `kosaraju_scc` reading `DualCsr`, and attributed the whole difference
to petgraph. Moving sprefa's own `tarjan` onto `DualCsr`, changing nothing but
the neighbor lookup, makes it the faster of the two:

| graph | tarjan / `Vec<Vec<u32>>` | tarjan / `DualCsr` | `kosaraju_scc` / `DualCsr` |
|---|---|---|---|
| `rel_df_edge` (269,457 n / 261,704 e) | 19.5ms | **9.9ms** | 14.2ms |
| `rel_flow_edge` (271,218 n / 371,404 e) | 18.3ms | **9.9ms** | 15.0ms |
| synthetic 1M / 2M random | 196.8ms | **102.7ms** | 119.6ms |

The prior run's "1.47x faster" was the CSR layout, which is sprefa's to keep for
free. With storage held constant petgraph is **1.16x to 1.43x slower**. The
reversal reproduces on the prior run's own synthetic graph (same 363,451
components at 1M/2M), so it was findable without real data.

Conditions for the remaining adoption:

1. Keep `scc.rs::tarjan`. Move it onto CSR slices. That is a ~5-line change to
   the neighbor lookup and it is the single largest measured win in this report.
2. Adopt petgraph for the algorithms sprefa does not have: `dominators`,
   `all_simple_paths`, `greedy_feedback_arc_set`, `toposort`, `bridges`,
   `articulation_points`. The trait surface claim is accurate and those are real
   capability gains.
3. Budget `16V + 8E` bytes, not `12E`. See H2.
4. Do not use petgraph's `Bfs`/`Dfs` walkers for the multi-tag halt walk. They
   allocate an O(V) visit map per tag; `walk.rs`'s generation stamp is O(1). At
   15,851 tags the petgraph form is 3.8x slower. See H6.
5. Treat `kosaraju_scc`'s `Vec<Vec<NodeId>>` return as disqualifying at corpus
   scale: 40.0 bytes/node measured, flat, against `tarjan`'s 4.0. See H4.

## Hypothesis table

| # | hypothesis | result | measured |
|---|---|---|---|
| H1 | SCC partition still matches on real graphs | **CONFIRMED** | identical on 6/6 graphs, exact set equality |
| H2 | `DualCsr` is 12.0 bytes/edge on real data | **REFUTED** | 16.24 B/edge, and 24.47 B/edge with the mandatory id dictionary |
| H3 | real depth would overflow petgraph's recursive `tarjan_scc` | **REFUTED** | max DFS depth 690 across all six; threshold is 65,420 (95x margin) |
| H4 | `kosaraju_scc` is O(V)-resident | **CONFIRMED, worse than stated** | 40.00 B/node flat at real scale, 1M and 10M; the return value, not just the internals |
| H5 | build cost is negligible next to algorithm time | **REFUTED** | build is 4.2x to 27.7x the algorithm time; crossover 1.5 to 297 queries |
| H6 | 61 trait lines, `EdgeFiltered` reproduces `walk.rs` | **PARTIAL** | 58 impl lines (61 with structs), halt semantics identical on real data; walker allocation scales badly |

Bonus reversal, not in the assigned brief: the 1.47x speedup claim. **REFUTED**,
see Verdict.

## H1: partition equality on real graphs. CONFIRMED

`tarjan` copied verbatim from `sprefa/src/graph/scc.rs` against
`kosaraju_scc(&DualCsr)`. Partitions canonicalized as sorted lists of sorted
components and compared with `==`, so component numbering differences do not
mask a divergence.

| relation | nodes | edges | components | identical | largest SCC | nontrivial SCCs |
|---|---|---|---|---|---|---|
| `rel_df_edge` | 269,457 | 261,704 | 269,429 | **yes** | 6 | 16 |
| `rel_flow_edge` | 271,218 | 371,404 | 242,669 | **yes** | 22,257 | 483 |
| `rel_call_edge` | 7,835 | 17,500 | 7,778 | **yes** | 9 | 26 |
| `rel_member_edge` | 13,019 | 25,314 | 12,904 | **yes** | 14 | 40 |
| `rel_port_edge` | 8,671 | 22,154 | 7,145 | **yes** | 1,224 | 131 |
| `rel_bare_edge` | 6,263 | 18,699 | 6,206 | **yes** | 9 | 26 |

Zero divergence. The conclusion holds across six relations with very different
topology: `rel_df_edge` is a near-forest (largest SCC 6), `rel_flow_edge` has a
22,257-node cycle. This is the one prior claim that survives untouched.

Real structure differs sharply from the synthetic test that established it. The
prior run's 1M/2M random graph had a node/edge ratio of 0.50 and 363,451
components. Real relations run 0.39 to 1.03 nodes per edge, and `rel_df_edge`
has 269,429 components over 269,457 nodes, meaning 99.99% of nodes are singleton
SCCs. The correctness result was insensitive to that difference. The memory
results were not.

## H2: 12.0 bytes/edge. REFUTED

Real node ids are 64-bit symbol hashes spanning the full `i64` range, not dense
`u32`:

| relation | distinct ids | min id | max id |
|---|---|---|---|
| `rel_df_edge` | 269,457 | -9223224868596891321 | 9223314837342996344 |
| `rel_call_edge` | 7,835 | -9221985413353213917 | 9222796147100753148 |

Density against the id range is ~3e-14. A CSR offsets array indexed by node id
is impossible. A dictionary from `i64` to dense `u32` has to exist before any
CSR does, and it costs 8 bytes per node permanently, since results have to be
mapped back. The synthetic benchmark generated dense ids and never paid this.

Measured, with the dictionary counted:

| relation | nodes/edge | `DualCsr` | + dict | honest total | `Vec<Vec<u32>>` fwd |
|---|---|---|---|---|---|
| `rel_df_edge` | 1.030 | 16.24 B/e | 8.24 B/e | **24.47 B/e** | 38.95 B/e |
| `rel_flow_edge` | 0.730 | 13.84 B/e | 5.84 B/e | **19.68 B/e** | 28.46 B/e |
| `rel_call_edge` | 0.448 | 11.58 B/e | 3.58 B/e | **15.16 B/e** | 18.51 B/e |
| `rel_port_edge` | 0.391 | 11.13 B/e | 3.13 B/e | **14.26 B/e** | 16.10 B/e |

The exact cost is `8V + 8E` for `DualCsr` plus `8V` for the dictionary, so
`16V + 8E`. Bytes per edge is not a constant; it is a function of the node/edge
ratio. 12.0 B/edge corresponds to a ratio of 0.50, which is exactly the
synthetic graph and none of the real ones. On `rel_df_edge`, offsets are 50.7%
of `DualCsr` on their own.

### The corrected extrapolation

The brief's target is 150M nodes / 130M edges, a ratio of 1.15, worse than any
relation measured.

| | prior claim | corrected |
|---|---|---|
| formula | `12.0 * E` | `16V + 8E` |
| 130M edges, 150M nodes | **1.56 GB** | **3.44 GB** |

2.2x understated. The graph alone, before any algorithm state.

## H3: real depth. REFUTED

Max DFS stack depth measured by simulating the recursion iteratively, so the
number is what a recursive implementation would actually have reached.

| relation | max DFS depth | condensation longest path | largest SCC | longest simple path bound | ecc max | ecc mean | reach mean |
|---|---|---|---|---|---|---|---|
| `rel_df_edge` | 33 | 39 | 6 | 44 | 28 | 3.34 | 5.30 |
| `rel_flow_edge` | **690** | 101 | 22,257 | 22,357 | 110 | 16.00 | 15,560.37 |
| `rel_call_edge` | 15 | 22 | 9 | 30 | 15 | 2.73 | 17.54 |
| `rel_port_edge` | 130 | 22 | 1,224 | 1,245 | 22 | 4.52 | 887.98 |
| `rel_member_edge` | 16 | 23 | 14 | 36 | 15 | 1.86 | 34.59 |

Answering the question directly: **petgraph's recursive `tarjan_scc` would not
overflow on this data.** Worst measured depth is 690 against a 65,420-frame
threshold, a 95x margin. Even the worst-case longest-simple-path bound, 22,357
on `rel_flow_edge`, sits 2.9x under the threshold.

The brief's "assume depth 1,000,000" is wrong by three orders of magnitude, and
the other lab's eccentricity-18 figure is right for `rel_df_edge` (max 28, mean
3.34) and wrong as a generalization. `rel_flow_edge` has mean reachable-set size
15,560 and eccentricity up to 110. "Shallow" is a property of some sprefa
relations, not of code graphs.

The depth/eccentricity distinction the brief flagged is real and visible:
`rel_port_edge` has eccentricity 22 and DFS depth 130, and `rel_flow_edge` has
eccentricity 110 and DFS depth 690. Depth exceeds eccentricity by 5.9x and 6.3x
because of intra-SCC wandering. Neither gets near the stack limit.

This does not change the recommendation to avoid recursive algorithms. It does
remove stack safety as a reason to prefer `kosaraju_scc`, which was one of the
prior run's stated grounds. Combined with the speed reversal, nothing is left
supporting the swap.

## H4: O(V) algorithm state. CONFIRMED, and worse than the other agent said

Verified from source at
`~/.cargo/registry/src/index.crates.io-*/petgraph-0.8.3/src/algo/scc/kosaraju_scc.rs`.
The other agent's reading is correct: `finish_order: Vec<NodeId>` (line 104)
takes a push for every node, alongside `dfs.discovered` and `dfs.stack`.

It understates the cost. The dominant term is the **return value**, not the
internals. `kosaraju_scc` returns `Vec<Vec<G::NodeId>>`: 24 bytes of `Vec`
header per component, plus members. On a graph that is mostly singleton SCCs,
which every real sprefa relation is, that is 24 bytes of header per node with a
4-element minimum allocation behind it.

Measured, `/usr/bin/time -l` peak RSS:

| graph | nodes | sccs | kosaraju return value | per node | sprefa `tarjan` return | peak RSS |
|---|---|---|---|---|---|---|
| `rel_df_edge` | 269,457 | 269,429 | 10,777,176 B | **40.00 B/node** | 1,077,828 B (4.00 B/node) | 37.1 MB |
| `rel_flow_edge` | 271,218 | 242,669 | 9,869,880 B | 36.39 B/node | 1,084,872 B (4.00 B/node) | 36.0 MB |
| synth 1M isolated | 1,000,000 | 1,000,000 | 40,000,000 B | **40.00 B/node** | 4,000,000 B | 60.4 MB |
| synth 1M path | 1,000,000 | 1,000,000 | 40,000,000 B | 40.00 B/node | 4,000,000 B | 84.4 MB |
| synth 10M isolated | 10,000,000 | 10,000,000 | 400,000,000 B | **40.00 B/node** | 40,000,000 B | 500.4 MB |

40.00 B/node, flat across four orders of magnitude, is 10x what sprefa's
`(Vec<u32>, usize)` return costs for the same information.

### Does "whole corpus resident" survive?

At 150M nodes / 130M edges, from measured per-node constants:

| component | bytes |
|---|---|
| `DualCsr` + id dictionary (H2) | 3.44 GB |
| `kosaraju_scc` return value @ 40.0 B/node | 6.00 GB |
| `finish_order` @ 4 B/node | 0.60 GB |
| visit map @ 0.125 B/node | 0.02 GB |
| **total** | **~10.1 GB** |

On a 16GB machine, with a daemon and a 853MB SQLite file already resident. It
does not survive. Substituting sprefa's `tarjan` for `kosaraju_scc` removes 6.0
of those 10.1 GB, since it returns 4 B/node instead of 40. That single
substitution is worth more than every other memory decision in this evaluation.

Measured RSS scaling is 50.04 B/node total process at 10M isolated nodes, which
extrapolates to 7.5 GB at 150M nodes before edges are added, consistent with the
table.

## H5: build cost. REFUTED as negligible

End to end, in one process: open the live DB read-only, query, build the id
dictionary, densify, fill `DualCsr`, run `kosaraju_scc`.

| relation | open | query | dict+densify | csr | kosaraju | TOTAL | build:algo |
|---|---|---|---|---|---|---|---|
| `rel_df_edge` | 0.3ms | 30.0ms | 18.6ms | 6.6ms | 13.2ms | 68.7ms | **4.17x** |
| `rel_flow_edge` | 0.1ms | 43.0ms | 25.7ms | 8.6ms | 14.8ms | 92.3ms | **5.21x** |
| `rel_call_edge` | 0.1ms | 6.2ms | 0.7ms | 0.4ms | 0.4ms | 7.8ms | **19.00x** |
| `rel_port_edge` | 0.1ms | 12.5ms | 0.9ms | 0.5ms | 0.5ms | 14.5ms | **27.74x** |

Build dominates everywhere. The SQLite query alone is 2.3x to 15.5x the
algorithm time. Every prior comparison in this evaluation reported the last
column only.

### Crossover against the zero-build SQL alternative

Same reachability question two ways: a recursive CTE against the live table with
no build at all, against in-memory BFS over the built `DualCsr`. Averaged over
200 seeds. Row counts match exactly between the two, so this compares equal
answers.

| relation | build cost | SQL CTE / query | in-mem BFS / query | **crossover** |
|---|---|---|---|---|
| `rel_df_edge` | 55.1ms | 0.188ms | 0.002ms | **297.2 queries** |
| `rel_call_edge` | 7.3ms | 0.045ms | 0.001ms | **163.9 queries** |
| `rel_port_edge` | 13.9ms | 1.873ms | 0.022ms | **7.5 queries** |
| `rel_flow_edge` | 77.4ms | 51.289ms | 0.324ms | **1.5 queries** |

Two orders of magnitude of spread, and it tracks reachable-set size, not graph
size. `rel_df_edge` and `rel_flow_edge` are nearly the same size; their
crossovers differ by 198x. The reason is H3's reach column: `rel_df_edge` mean
reachable set is 5.30 nodes, so the CTE terminates almost immediately and there
is nothing to amortize. `rel_flow_edge` mean reachable set is 15,560, the CTE
costs 51ms, and one and a half queries pay for the build.

For the tier design, the decision rule is mean reachable-set size, not node or
edge count. Build the in-memory graph for relations with large reach
(`rel_flow_edge`, `rel_port_edge`); leave shallow relations (`rel_df_edge`,
`rel_call_edge`, `rel_member_edge`) in SQL unless a session will issue hundreds
of queries against one snapshot.

Peak RSS for the full end-to-end run including SQLite: 41.9 MB
(`rel_df_edge`), 49.8 MB (`rel_flow_edge`).

## H6: line count and the halt predicate. PARTIAL

### Line count, counted mechanically

`labs/graph-petgraph-opus/src/bin/minimal.rs`, lines 21 through 78, the region
between the trait-surface markers: **58 non-blank lines** of `impl` blocks. With
the two struct declarations they depend on it reaches 61. The claim is accurate.

Two corrections to how it was stated. Claim 1 names `NodeIndexable` and `Data`;
`minimal.rs` implements neither. It implements `VisitMap`, `GraphBase`,
`NodeCount`, `Visitable`, `IntoNeighbors`, `IntoNeighborsDirected`,
`IntoNodeIdentifiers`. `NodeIndexable` and `Data` appear only in the 218-line
full surface (measured here at 207 non-blank lines from line 131 of `lib.rs`).

Second, 61 lines is the cost for dense `u32` ids, which real sprefa data does
not have. The id dictionary is **21 further non-blank lines** and is not
optional. Real cost to reach `algo` from a live sprefa relation: 79 lines.

### Halt predicate on real data

`EdgeFiltered::from_fn(graph, |e| !halt[e.source()])` with `Bfs`, against a
direct port of `walk.rs`'s record-but-do-not-expand semantics. Halt set is every
node with out-degree >= 4, a structural choice rather than a hand-picked one.

| relation | seeds | halt nodes | sprefa walk | EdgeFiltered | identical |
|---|---|---|---|---|---|
| `rel_df_edge` | 271 | 2,962 / 269,457 | 1,361 pairs, 0.3ms | 1,361 pairs, 0.4ms | **yes** |
| `rel_flow_edge` | 273 | 6,586 / 271,218 | 2,567 pairs, 0.4ms | 2,567 pairs, 0.6ms | **yes** |
| `rel_port_edge` | 9 | 1,631 / 8,671 | 20 pairs, 0.0ms | 20 pairs, 0.0ms | **yes** |

Semantics reproduce exactly on real data. The prior claim stands on correctness.

It does not stand on cost. `Bfs` obtains its visited set from
`Visitable::visit_map()`, which allocates and zeroes O(V) per construction, and
the multi-tag walk constructs one per tag. `walk.rs` uses a generation stamp
(`seen: Vec<u32>` plus `gen`), which is O(1) per tag. Scaling the tag count on
`rel_df_edge`:

| tags | sprefa walk | EdgeFiltered + `Bfs` | ratio |
|---|---|---|---|
| 271 | 0.3ms | 0.4ms | 1.3x |
| 2,778 | 1.7ms | 4.0ms | 2.4x |
| 15,851 | 5.9ms | 22.6ms | **3.8x** |

The gap grows with tag count, as an O(tags * V) term against an O(tags) one.
`reset_map` does not help; it is also O(V). Keep `multi_source_walk`.

## Traps

### The borrow checker rejects the obvious max-depth loop

Measuring DFS depth by peeking at the stack while holding a mutable borrow of
its top:

```
error[E0502]: cannot borrow `stack` as immutable because it is also borrowed as mutable
   --> src/main.rs:149:16
    |
148 |         while let Some(&mut (v, ref mut ci)) = stack.last_mut() {
    |                                                ----- mutable borrow occurs here
149 |             if stack.len() > best { best = stack.len(); }
    |                ^^^^^ immutable borrow occurs here
150 |             let list = &adj[v as usize];
151 |             if *ci < list.len() {
    |                --- mutable borrow later used here
```

Fix is to copy the top by value and re-borrow for the increment. Noted because
sprefa's own `tarjan` uses the `while let Some(&(v, ci)) = work.last()` form for
exactly this reason, and the pattern is easy to break when instrumenting it.

### The storage confound is invisible unless you build the control

The prior run's benchmark is not wrong in what it measured. It measured
`tarjan(&Vec<Vec<u32>>)` against `kosaraju_scc(&DualCsr)` and reported the
difference as an algorithm result. Building the third cell of the table,
`tarjan(&DualCsr)`, takes about 40 lines of copy-and-edit and reverses the
conclusion. Any A-vs-B where A and B differ in two dimensions needs the control.

### `sqlite3` dumps of these tables are signed 64-bit

`SELECT "from", "to" FROM rel_df_edge` returns values spanning
`-9223224868596891321` to `9223314837342996344`. Parsing them as `u64` or `u32`
silently truncates or fails per row. They are `i64` symbol hashes.

## Environment

- petgraph 0.8.3, vendored at
  `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/petgraph-0.8.3/`
- rustc 1.97.0-nightly (9eb3be26b 2026-05-18)
- rusqlite 0.32.1, bundled SQLite; system `sqlite3` 3.43.2 used for the dumps
- macOS Darwin 23.6.0, arm64, 16GB
- All timings `--release` with `debug = true`
- Peak RSS measured with `/usr/bin/time -l` maximum resident set size, not
  `Vec::capacity` arithmetic
- Largest allocation in this run: 500.4 MB (10M-node synthetic), inside the 2GB
  budget; `vm_stat` checked before each large run
- Source DB opened read-only via `file:...?mode=ro` with the daemon live; never
  held open during a benchmark

Reproducing:

```
cd ~/projects/claude-research/labs/graph-petgraph-realdata
cargo run --release -- h1 rel_df_edge        # partition equality + storage control
cargo run --release -- h2 rel_df_edge        # bytes/edge with the dictionary
cargo run --release -- h3 rel_flow_edge      # depth, eccentricity, reach
cargo run --release -- h4real rel_df_edge    # kosaraju return-value size
cargo run --release -- h4synth 10000000 isolated
cargo run --release -- h5 rel_flow_edge      # end to end vs SQL CTE
SEED_STEP=17 cargo run --release -- h6 rel_df_edge
cargo run --release -- h7 1000000            # storage confound, synthetic
```

Edge dumps live in `labs/graph-petgraph-realdata/data/*.tsv`, regenerable with
`sqlite3 "file:$DB?mode=ro" 'SELECT "from","to" FROM rel_df_edge'`.

## What I could not test and why

- **The 150M-node target.** Capped at 10M by the memory budget with two other
  agents running. The 40.00 B/node and `16V + 8E` constants are flat across four
  orders of magnitude, so the 10.1 GB figure is extrapolation from measured
  constants rather than a measurement.
- **`rel_graph_edge`.** Enumerated and dumped, 0 rows. Not a usable test case.
- **Weighted or multi-kind edges.** `rel_call_edge`, `rel_member_edge`,
  `rel_type_edge`, and `rel_bare_edge` carry a `kind` column that I projected
  away to get a plain edge list. An evaluation of edge-kind-filtered traversal
  through `EdgeFiltered` on the real kind ordinals was not run.
- **Whether the CSR-backed `tarjan` passes sprefa's own test suite.** I verified
  it produces a partition identical to the original on all six real graphs and on
  two synthetic ones, and asserted that equality in the harness. I did not touch
  `sprefa/src/`, so the change is proposed rather than landed.
- **The other petgraph algorithms on real data.** `dominators`,
  `all_simple_paths`, `bridges`, `articulation_points`, and
  `greedy_feedback_arc_set` were judged from the prior run's synthetic results
  and their capability value, not re-measured here. The brief prioritized the
  five hypotheses above and the budget went there.
- **Whether `rel_flow_edge`'s 22,257-node SCC can grow past the 65,420-frame
  stack threshold as the corpus grows.** It is 2.9x under today. That margin is a
  measurement of the current corpus, not a guarantee.
- **`page_rank`'s quadratic term from source.** Unchanged from the prior run;
  not re-examined.
