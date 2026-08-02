---
description: Second evaluation of petgraph; the first one missed that the visit traits are implementable on our own storage, which unlocks the whole algo module in 61 lines. Verified 2026-07-20.
argument-hint: [section]
---

# petgraph, second evaluation

Lab: `~/projects/claude-research/labs/graph-petgraph-opus/`. Every number below
came out of `cargo run --release` in that crate. petgraph 0.8.3, rustc
1.97.0-nightly (9eb3be26b 2026-05-18), macOS Darwin 23.6.0, 16GB.

## Verdict, corrected

**Adopt petgraph as an algorithm library over sprefa's own storage.** The first
evaluation's conclusion, "good storage, none of the 7 graph functions cleanly
replaceable", rested on a false premise.

petgraph's algorithms are generic over *traits*, and those traits are public. The
first run tested them against `petgraph::csr::Csr`, found `Csr` lacks
`IntoNeighborsDirected`, and stopped. Implementing the traits on our own
compressed structure was never tried. It works, it takes **61 non-blank lines**,
and it produces an SCC partition **identical to sprefa's `tarjan`** while running
**1.47x faster** and holding **both edge directions in 62% of the memory** that
sprefa's forward-only `Vec<Vec<u32>>` uses.

| | first run | this run |
|---|---|---|
| petgraph items that COMPILE on our storage | 0 | 16 of 16 tried |
| items that RUN correctly at 1,000,000 nodes | 0 | 11 |
| lines to unlock them | not measured | 61 |
| SCC vs sprefa `tarjan`, 1M nodes / 2M edges | not measured | identical partition, 155ms vs 229ms |
| recursive implementations found | 2 | **3** |
| halt predicate | "no library provided it cleanly" | `EdgeFiltered` on edge source, all 7 `walk.rs` cases pass |

## What the first run got wrong or missed

1. **The traits are implementable on our own type.** This is the whole finding.
   Detail and code in [H0](#h0).
2. **A third recursive implementation**: `algo::is_cyclic_directed` overflows the
   stack at the same threshold as `depth_first_search`, because it *is*
   `depth_first_search` (`src/algo/mod.rs:290`). The first run checked
   `tarjan_scc` and `depth_first_search` and stopped at two.
3. **The halt predicate has a clean expression in petgraph.** "Record the node,
   do not expand through it" is exactly "remove every edge whose *source* is a
   halt node", which is `EdgeFiltered::from_fn(graph, |edge| !halt[edge.source()])`.
   All seven of `walk.rs`'s own test cases reproduce. The first run tried to apply
   the predicate to the walker's output, where it cannot work, and recorded that
   as a "naive-halt trap" rather than as a solved problem. See [H4](#h4).
4. **The recursive/iterative split runs per-item, so each item must be checked on
   its own.** `Dfs` and `DfsPostOrder`, the walker *structs*, are iterative and
   traverse a 1,000,000-deep path in 6ms and 11ms. `depth_first_search`, the callback *function*, is
   recursive. The first run reported petgraph's DFS as recursive without
   distinguishing the two, which made the stack problem look unavoidable.
5. **A 1GB-stack thread costs 110µs to spawn** and let the recursive `tarjan_scc`
   run a 1M-deep path in 41ms. The first run treated recursion as disqualifying
   without pricing this. It remains the worse option, since `kosaraju_scc` is
   both safe and faster, but the price was worth knowing.

## What the first run got right, re-tested

- `algo::tarjan_scc` is recursive (`src/algo/scc/tarjan_scc.rs:74`, the inner
  `visit`) and overflows the default 8MB stack. CONFIRMED.
- `visit::depth_first_search` is recursive (`src/visit/dfsvisit.rs:261`,
  `dfs_visitor`) and overflows. CONFIRMED.
- `visit::Control::Prune` has the right halt semantics. CONFIRMED on our storage:
  a 6-node chain pruned at node 3 discovers `[0, 1, 2, 3]`.
- `kosaraju_scc` does not compile against `Csr`. CONFIRMED, error quoted below.
- `Reversed<&Csr>` does not compile. CONFIRMED, same error.
- `Csr::from_sorted_edges` beats `add_edge` by orders of magnitude, and streaming
  construction is the right shape. CONFIRMED by construction: `DualCsr::from_edges`
  builds 1M edges in 10.4ms with no intermediate adjacency lists.

My crash thresholds differ from the first run's (65,420 vs 74,529 for
`tarjan_scc`; 58,099 vs ~43,500 for `depth_first_search`). Both are correct.
The threshold depends on the graph type's `NodeId` size and on what the compiler
inlines into the recursive frame, so it moves with the storage under test. The
conclusion is unchanged: sprefa's 283,127 nodes are 4.3x and 4.9x past the line.

## Hypothesis table

| # | hypothesis | result | measurement |
|---|---|---|---|
| H0 | visit traits are implementable on our own compressed storage | **CONFIRMED** | 61 lines minimal, 218 lines full; 16/16 compile, 11 run at 1M nodes |
| H1 | the first run's 7-function frame missed usable algorithms | **CONFIRMED** | `dominators`, `all_simple_paths`, `feedback_arc_set`, `toposort`, `bridges` all run on our storage |
| H2 | `Reversed` / `EdgeFiltered` / `NodeFiltered` compose over custom storage | **CONFIRMED** | `Reversed<EdgeFiltered<&DualCsr, F>>` compiles and runs |
| H3 | a dense bitset `VisitMap` beats `HashSet` | **CONFIRMED** | 15.0x faster, 73.4x smaller at 1M nodes |
| H4 | an iterative DFS/BFS walker exists, so the halt predicate needs no recursion | **CONFIRMED** | `Dfs`/`DfsPostOrder` iterative; halt-BFS passes all 7 `walk.rs` cases |
| H5 | a big-stack thread is an acceptable workaround | **CONFIRMED but unnecessary** | 1GB stack spawns in 110µs; `kosaraju_scc` is safe and faster anyway |

<a name="h0"></a>
## H0: the whole `algo` module on our own storage

### The minimal trait surface

Six traits, 61 non-blank lines, `NodeId = u32` with no newtype. Full file:
`labs/graph-petgraph-opus/src/bin/minimal.rs`.

```rust
pub struct Csr {
    pub out_offsets: Vec<u32>,
    pub out_targets: Vec<u32>,
    pub in_offsets: Vec<u32>,
    pub in_targets: Vec<u32>,
}

pub struct Bits(Vec<u64>);
impl VisitMap<u32> for Bits {
    fn visit(&mut self, node: u32) -> bool {
        let (word, bit) = (node as usize / 64, node % 64);
        let fresh = self.0[word] & (1 << bit) == 0;
        self.0[word] |= 1 << bit;
        fresh
    }
    fn is_visited(&self, node: &u32) -> bool {
        self.0[*node as usize / 64] & (1 << (*node % 64)) != 0
    }
    fn unvisit(&mut self, node: u32) -> bool {
        let seen = self.is_visited(&node);
        self.0[node as usize / 64] &= !(1 << (node % 64));
        seen
    }
}
impl GraphBase for Csr {
    type NodeId = u32;
    type EdgeId = u32;
}
impl NodeCount for Csr {
    fn node_count(&self) -> usize { self.out_offsets.len() - 1 }
}
impl Visitable for Csr {
    type Map = Bits;
    fn visit_map(&self) -> Bits {
        Bits(vec![0; (self.out_offsets.len() - 1).div_ceil(64)])
    }
    fn reset_map(&self, map: &mut Bits) {
        map.0.iter_mut().for_each(|word| *word = 0);
    }
}
impl<'a> IntoNeighbors for &'a Csr {
    type Neighbors = core::iter::Copied<core::slice::Iter<'a, u32>>;
    fn neighbors(self, node: u32) -> Self::Neighbors {
        let (lo, hi) = (self.out_offsets[node as usize], self.out_offsets[node as usize + 1]);
        self.out_targets[lo as usize..hi as usize].iter().copied()
    }
}
impl<'a> IntoNeighborsDirected for &'a Csr {
    type NeighborsDirected = core::iter::Copied<core::slice::Iter<'a, u32>>;
    fn neighbors_directed(self, node: u32, dir: Direction) -> Self::NeighborsDirected {
        let (offsets, targets) = match dir {
            Direction::Outgoing => (&self.out_offsets, &self.out_targets),
            Direction::Incoming => (&self.in_offsets, &self.in_targets),
        };
        let (lo, hi) = (offsets[node as usize], offsets[node as usize + 1]);
        targets[lo as usize..hi as usize].iter().copied()
    }
}
impl<'a> IntoNodeIdentifiers for &'a Csr {
    type NodeIdentifiers = core::ops::Range<u32>;
    fn node_identifiers(self) -> Self::NodeIdentifiers {
        0..(self.out_offsets.len() - 1) as u32
    }
}
```

Output, byte for byte:

```
kosaraju_scc        = [[0, 1, 2], [3, 4], [5]]
toposort is Err     = true
has_path 0->4       = true
idom(4)             = Some(3)
all_simple_paths    = [[0, 1, 2, 3, 4]]
```

The key structural point: `GraphRef: Copy + GraphBase`, so the traversal traits
are implemented for `&Csr`. `GraphBase`, `Visitable`, and
`NodeCount` go on the owned type. That split is the only non-obvious part, and
the compiler states it clearly if you get it backwards.

### The full surface

`labs/graph-petgraph-opus/src/lib.rs`, 218 non-blank lines in the trait section,
adds `Data`, `GraphProp`, `NodeIndexable`, `NodeCompactIndexable`,
`IntoNodeReferences`, `IntoEdgeReferences`, `IntoEdges`, `IntoEdgesDirected` and
five small iterator structs. That unlocks the edge-reference algorithms
(`feedback_arc_set`, `page_rank`, `bridges`, `articulation_points`,
`floyd_warshall`).

### Correctness against sprefa's own tarjan

`src/bin/crosscheck.rs` copies `sprefa/src/graph/scc.rs::tarjan` verbatim and
compares SCC partitions as sets (component numbering differs between algorithms,
the partition does not).

| nodes | edges | sprefa `tarjan` | `kosaraju_scc` over `DualCsr` | partitions identical |
|---|---|---|---|---|
| 1,000 | 2,000 | 46µs | 59µs | yes (409 components) |
| 100,000 | 200,000 | 8.12ms | 7.10ms | yes (36,544 components) |
| 1,000,000 | 2,000,000 | 228.7ms | 155.2ms | yes (363,451 components) |

Storage at every scale: `Vec<Vec<u32>>` **19.3 bytes/edge forward-only** against
`DualCsr` at **12.0 bytes/edge for both directions**. sprefa's `Cond` keeps
`cadj` and `cadj_rev`, so the honest comparison is 38.6 against 12.0.

### Every algorithm tried

At 1,000,000 nodes on a path graph, worst case for depth. `OK` means it ran to
completion on the default 8MB stack.

| algorithm | 1M-deep path | notes |
|---|---|---|
| `kosaraju_scc` | **OK** 39.7ms | iterative, the SCC answer |
| `toposort` | **OK** 16.9ms | returns `Err(Cycle)` on cyclic input |
| `has_path_connecting` | **OK** 4.7ms | |
| `dominators::simple_fast` | **OK** 340.6ms | iterative |
| `bridges` | **OK** 22.3ms | |
| `articulation_points` | **OK** 91.5ms | see the `size_hint` trap |
| `greedy_feedback_arc_set` | **OK** 209.6ms | needs a `GraphIndex` newtype |
| `connected_components` | **OK** 10.3ms | |
| `min_spanning_tree` | **OK** 68.6ms | |
| `Dfs` walker | **OK** 5.4ms | iterative |
| `DfsPostOrder` walker | **OK** 9.4ms | iterative |
| `floyd_warshall` | ran on small input | O(V^3), unusable at sprefa scale |
| `page_rank` | **too slow** | O(V^2), see below |
| `tarjan_scc` | **STACK OVERFLOW** | recursive |
| `depth_first_search` | **STACK OVERFLOW** | recursive |
| `is_cyclic_directed` | **STACK OVERFLOW** | recursive, new find |
| `condensation` | **does not apply** | not generic, see below |

<a name="h1"></a>
## H1: inventory, judged for sprefa

Enumerated from the vendored source, `src/algo/`.

### Worth using

| item | sprefa use |
|---|---|
| `kosaraju_scc` | direct replacement for `scc.rs::tarjan`, verified identical |
| `dominators::simple_fast` | control-flow dominance over a call or dataflow graph; sprefa has no equivalent today |
| `all_simple_paths` | enumerate every path between two code entities, with min/max intermediate-node bounds; sprefa has no equivalent |
| `greedy_feedback_arc_set` | which edges to cut to break dependency cycles; directly useful for a "why is this module circular" answer |
| `toposort` | build/analysis ordering, and a cheap `Err(Cycle)` cycle witness |
| `has_path_connecting` | single-pair reachability without materializing a set |
| `bridges` | edges whose removal disconnects the graph, so single points of coupling |
| `articulation_points` | nodes whose removal disconnects the graph |
| `connected_components` | count of weakly connected regions |

### Not worth using

| item | why |
|---|---|
| `condensation` | **not generic**. `pub fn condensation<N, E, Ty, Ix>(g: Graph<N, E, Ty, Ix>, make_acyclic: bool) -> Graph<Vec<N>, E, Ty, Ix>` takes a concrete `Graph` **by value**. It cannot see custom storage, and it allocates a `Vec<N>` per component. `scc.rs::build_condensed` stays hand-written. |
| `page_rank` | measured O(V^2): 3,000 nodes 70.8ms, 6,000 nodes 282.9ms, 12,000 nodes 1.164s. Each doubling costs 4x. At 283,127 nodes that is hours. |
| `floyd_warshall`, `johnson` | O(V^3) and O(V^2 log V + VE) all-pairs. sprefa's whole `count_pairs` design exists to avoid materializing all pairs. |
| `k_shortest_path`, `bellman_ford`, `astar`, `dijkstra`, `spfa` | weighted shortest paths. sprefa's edges carry a kind ordinal and no weight. |
| `steiner_tree`, `min_spanning_tree` | undirected tree construction; no current question needs it. |
| `isomorphism`, `maximal_cliques`, `matching`, `coloring` | no sprefa question maps to these. `maximal_cliques` and the isomorphism family are also recursive. |
| `ford_fulkerson`, `dinics` | max-flow; no current question. |
| `tred` (transitive reduction) | operates on its own toposorted adjacency-list type, and requires a DAG. sprefa's graphs are cyclic. |

### The 7-function replacement table

| sprefa function | petgraph answer |
|---|---|
| `tarjan` | **replaced** by `kosaraju_scc`, identical partition, 1.47x faster at 1M/2M |
| `build_condensed` | **keep**. `condensation` is not generic and allocates per component. Building `Cond` from `kosaraju_scc`'s output is ~30 lines. |
| `count_pairs` | **keep**. Nothing in petgraph counts reachable pairs from a condensation. |
| `reaches_from` | **replaced** by the `Dfs` or `Bfs` walker over `&DualCsr` |
| `reached_by` | **replaced** by the same walker over `Reversed(&DualCsr)` |
| `multi_source_walk` | **keep**. No petgraph traversal carries a per-node depth with a cap. The walkers expose `stack` publicly, so a depth-carrying variant is a small fork rather than a rewrite. |
| `multi_source_halt_bfs` | **replaced** by `Bfs` over `EdgeFiltered`, all 7 test cases pass. See [H4](#h4). |

Four of seven replaced, against the first run's zero.

<a name="h2"></a>
## H2: adaptor composition

All of these compile and run over `&DualCsr`:

```
kosaraju_scc(Reversed(&DualCsr))            = 3 sccs
kosaraju_scc(&EdgeFiltered)                 = 6 sccs
kosaraju_scc(Reversed(&EdgeFiltered))       = 6 sccs
kosaraju_scc(&NodeFiltered)                 = 2 sccs
kosaraju_scc(Reversed(&NodeFiltered))       = 2 sccs
```

`Reversed<EdgeFiltered<&DualCsr, F>>` is reverse reachability restricted to edges
of a chosen kind, which is one of sprefa's stated needs, at zero implementation
cost. The adaptors are zero-sized wrappers holding a reference and a closure, so
composition allocates nothing.

<a name="h3"></a>
## H3: the visit map

`Visitable::Map` is ours to choose. At 1,000,000 nodes, visiting every node:

| map | time | bytes |
|---|---|---|
| dense bitset (`Vec<u64>`) | 2.17ms | 125,000 |
| `HashSet<Node>` | 32.48ms | ~9,175,040 (capacity 1,835,008) |

**15.0x faster, 73.4x smaller.** For dense u32 ids this is free, and it applies to
every algorithm at once, since they all obtain their visited set through
`Visitable`. petgraph's own `Graph` uses `FixedBitSet`, so this matches what the
built-in types already do; the point is that a custom storage type must
deliberately choose it and gets nothing by default.

<a name="h4"></a>
## H4: the halt predicate, solved

The halt semantics from `walk.rs` are: a halt node is *recorded* when reached and
does not *propagate*. That is exactly the graph with every out-edge of a halt node
deleted, which `EdgeFiltered` expresses by filtering on `edge.source()`.

```rust
fn halt_bfs_via_edge_filter(
    graph: &DualCsr,
    starts: &[(u32, u32)],
    halt: &[bool],
) -> Vec<(u32, u32)> {
    let filtered = EdgeFiltered::from_fn(graph, |edge| !halt[edge.source().0 as usize]);
    let mut out: Vec<(u32, u32)> = Vec::new();
    let mut by_tag: BTreeMap<u32, Vec<u32>> = Default::default();
    for &(tag, node) in starts {
        by_tag.entry(tag).or_default().push(node);
    }
    for (tag, seeds) in by_tag {
        // Multi-source: seed the walker's public stack directly.
        let mut bfs = Bfs { stack: VecDeque::new(), discovered: graph.visit_map() };
        for seed in seeds {
            if bfs.discovered.visit(Node(seed)) {
                bfs.stack.push_back(Node(seed));
            }
        }
        while let Some(node) = bfs.next(&filtered) {
            out.push((tag, node.0));
        }
    }
    out.sort_unstable();
    out
}
```

Run against all seven of `walk.rs`'s own test cases, copied verbatim:

```
PASS linear_chain_records_start_and_downstream: [(0, 1), (0, 2), (0, 3)]
PASS halt_node_is_recorded_but_not_expanded:    [(0, 1), (0, 2)]
PASS cycle_terminates_and_dedups:               [(7, 1), (7, 2), (7, 3)]
PASS two_tags_keep_separate_reach_sets:         [(10, 0), (10, 2), (10, 3), (20, 1), (20, 2), (20, 3)]
PASS multiple_starts_one_tag:                   [(0, 1), (0, 2), (0, 4), (0, 5), (0, 6)]
PASS start_that_is_halt_is_recorded_only:       [(9, 0)]
PASS empty_starts_is_empty:                     []
all 7 walk.rs cases reproduced = true
```

At scale: 1M-node path with a halt every 1000 nodes, seeded at node 0, reaches
1,001 nodes in **182µs**.

### Why the first run's "naive-halt trap" was avoidable

`Bfs::next` and `Dfs::next` return a node **and expand it in the same call**. The
successors are pushed before the caller ever sees the node, so a caller that
inspects the returned node and decides not to expand is already too late. That is
the trap, and it is real.

The fix is to move the predicate from the caller into the graph. `EdgeFiltered`
runs the predicate inside `neighbors()`, which is upstream of the push. The
predicate belongs on the edge rather than on the node.

### Multi-source is supported, undocumented

`Bfs`, `Dfs`, and `DfsPostOrder` all expose `pub stack` and `pub discovered`, and
`Dfs::from_parts(stack, discovered)` is public. Seeding several roots is
constructing the struct literally, as above. No constructor advertises this.

<a name="h5"></a>
## H5: pricing the big-stack thread

| stack size | spawn + join |
|---|---|
| 8MB | 162µs |
| 64MB | 126µs |
| 256MB | 45µs |
| 1024MB | 110µs |

Spawn cost is flat, because the stack is reserved as virtual address space and
committed lazily. Running the **recursive** `tarjan_scc` on a 1M-deep path inside a
1GB-stack thread took **41.1ms** and peak RSS reached **193MB**, so only the pages
actually touched were committed.

The workaround is cheap and real. It is still the worse choice: `kosaraju_scc` did
the same 1M-node job in 39.7ms on the default stack with no thread, no reserved
address space, and no threshold to get wrong later. Reach for the big stack only
if some future algorithm is recursive and has no iterative equivalent.

## Traps, with verbatim errors

### `Csr` cannot be reversed or traversed backwards

Reproduction: `labs/graph-petgraph-opus/traps/csrcheck.rs.txt` (kept as text
because it does not compile).

```
error[E0277]: the trait bound `Csr: IntoNeighborsDirected` is not satisfied
 --> src/bin/csrcheck.rs:7:59
  |
7 |     let _ = algo::kosaraju_scc(petgraph::visit::Reversed(&graph));
  |             ------------------                            ^^^^^ the trait `IntoNeighborsDirected` is not implemented for `Csr`
```

Confirms the first run. The lesson changed: skip `Csr`, keep petgraph. Our own
type implements the trait in nine lines.

### `articulation_points` silently requires an exact `size_hint`

A hand-written `NodeReferences` iterator using the `Iterator` default `size_hint`
of `(0, None)` produces, at runtime, from inside a transitive dependency:

```
thread 'main' panicked at fixedbitset-0.5.7/src/lib.rs:426:9:
insert at index 0 exceeds fixedbitset size 0
```

`algo::articulation_points` sizes its internal vectors from
`g.node_references().size_hint().0` (`src/algo/articulation_points.rs:57`).
Nothing in `IntoNodeReferences` documents that the lower bound must be exact.
Implement `size_hint` on any custom `NodeReferences` iterator. One line.

### `GraphIndex` blocks a bare `u32` node id

`greedy_feedback_arc_set` requires `G::NodeId: GraphIndex`. The trait is public
(`src/graph_impl/mod.rs:2279`) with `#[doc(hidden)]` methods, and it is
implemented only for `NodeIndex` and `EdgeIndex`. The orphan rule forbids
implementing it for `u32`. A `#[repr(transparent)] struct Node(pub u32)` costs
nothing at runtime and unlocks it:

```rust
impl petgraph::graph::GraphIndex for Node {
    fn index(&self) -> usize { self.0 as usize }
    fn is_node_index() -> bool { true }
}
```

If `feedback_arc_set` is not wanted, `NodeId = u32` works directly, as
`minimal.rs` shows.

### Recursion is per-item and the crate gives no signal

Three of sixteen items tested overflow the default 8MB stack on a 1M-deep path.
Bisected thresholds on our storage:

| item | last OK N | crashes by N | bytes/node |
|---|---|---|---|
| `algo::tarjan_scc` | 64,932 | 65,420 | 128.2 |
| `visit::depth_first_search` | 57,611 | 58,099 | 144.4 |
| `algo::is_cyclic_directed` | 57,611 | 58,099 | 144.4 |

The last two are identical because `is_cyclic_directed` is a thin wrapper over
`depth_first_search` (`src/algo/mod.rs:290`). Nothing in its name, signature, or
docs suggests a DFS callback with a recursive interior.

Meanwhile `kosaraju_scc`, `toposort`, `dominators::simple_fast`, `bridges`,
`articulation_points`, and both DFS walker structs all handle 1,000,000 nodes
fine. The lesson generalizes: probe each algorithm you intend to use on a deep
path graph in its own process, and read the exit code. That probe is ~20 lines
(`src/main.rs`, `probe` mode) and is worth keeping as a test.

## Environment

- petgraph 0.8.3, vendored at
  `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/petgraph-0.8.3/`
- rustc 1.97.0-nightly (9eb3be26b 2026-05-18)
- macOS Darwin 23.6.0, 16GB
- All timings `--release` with `debug = true` for symbols
- Peak RSS across the full run: **193MB**, well inside the 2GB budget
- Largest graph built: 1,000,000 nodes / 2,000,000 edges, inside the 10M edge cap

## What I could not test and why

- **A real sprefa graph.** The sprefa repo was read-only to me and I did not query
  its SQLite. All graphs here are synthetic: path graphs for depth, xorshift
  random graphs for SCC structure. The 1M/2M random graph produced 363,451
  components, which is a plausible shape without being sprefa's actual topology.
  Re-run `crosscheck.rs` against a dumped real edge list before committing.
- **The 150M-node / 130M-edge target.** Capped at 10M edges by the memory budget.
  `DualCsr` is 12.0 bytes/edge both directions, flat across three scales, so 130M
  edges extrapolates to ~1.6GB for the graph plus 8 bytes/node of offsets. That is
  extrapolation rather than measurement.
- **`multi_source_walk` with a depth cap on petgraph walkers.** I established that
  no petgraph traversal carries depth and that `Bfs::stack` is public, so a fork is
  small. I did not write it.
- **`page_rank`'s exact complexity from source.** I measured the 4x-per-doubling
  scaling at three sizes and stopped; I did not read the implementation to confirm
  where the quadratic term comes from.
- **`k_shortest_path`, `johnson`, `steiner_tree`, `matching`, `isomorphism`,
  `maximal_cliques`, `ford_fulkerson`, `dinics`, `coloring`, `tred`.** Judged from
  signatures and the workload, without being run. None has a sprefa question
  attached, so the cost of running them was not justified.
- **Comparison against `rustworkx-core`**, which wraps petgraph and may expose
  iterative variants of the three recursive items. Queued separately.

## Reproducing

```
cd ~/projects/claude-research/labs/graph-petgraph-opus
cargo run --release --bin minimal          # the 61-line proof
cargo run --release --bin crosscheck       # SCC identical to sprefa's tarjan
cargo run --release -- h0                  # every algorithm on custom storage
cargo run --release -- h2                  # adaptor composition
cargo run --release -- h3                  # visit map
cargo run --release -- h4                  # halt predicate, all 7 walk.rs cases
cargo run --release -- h5                  # big-stack thread pricing
cargo run --release -- probe <algo> <n>    # one algorithm, own process
```
