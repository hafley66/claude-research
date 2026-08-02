---
name: rust-graph-ultragraph
description: ultragraph 0.9.3's CSR graph for a sprefa-shaped 130M-edge dataflow graph -- freeze() copies at ~1.85x peak RSS (extrapolates past 16GB at production scale), inbound_edges is a real transposed index not a scan, SCC is iterative and stack-safe past 1M nodes, but there is no BFS/condensation/transitive-closure API and the crate is a single-maintainer side project of a causality framework. Verified empirically 2026-07-19.
---

# ultragraph 0.9.3 for sprefa's dataflow graph

Evidence crate: `~/projects/claude-research/labs/graph-ultragraph/` (re-run
command in its README.md). Every number below came from a binary in that
crate run with `cargo build --release` + `/usr/bin/time -l`, or from reading
`~/.cargo/registry/src/index.crates.io-*/ultragraph-0.9.3/src/**` directly, or
from `curl`ing the GitHub/crates.io APIs. Nothing here is transcribed from
docs.rs prose.

Pinned version: `ultragraph = "0.9.3"` (`cargo add` resolved this on
2026-07-19; matches the version named in the task). Rust: `rustc
1.97.0-nightly (9eb3be26b 2026-05-18)`. OS: macOS 14.6.1, 16GB RAM, 12 CPUs.
All measurements are `--release` builds.

## 1. Verdict table, H1-H8

| # | Hypothesis | Verdict | Measured evidence |
|---|---|---|---|
| H1 | Freezable model / memory layout | CONFIRMED, and the freeze cost is the load-bearing number for this decision | `DynamicGraph<N,W>`: `nodes: Vec<Option<N>>` (tombstone removal) + `edges: Vec<Vec<(usize,W)>>` (per-node adjacency lists) + `root_index`. `CsmGraph<N,W>`: **two independent CSRs** -- `forward_edges` and `backward_edges`, each a `CsrAdjacency<W> { offsets: Vec<usize>, targets: Vec<usize>, weights: Vec<W> }`. `freeze()` COPIES, does not move: it preallocates `vec![0; total_edges]` for both forward and backward `targets`/`weights` *before* consuming the old adjacency lists. Measured peak RSS: 1M edges, build-only 90MB -> build+freeze 166MB (1.84x). 10M edges, build-only 889MB -> build+freeze 1,641MB (1.85x). Ratio is stable across the one order of magnitude tested. |
| H2 | Bidirectional traversal via scan vs index | CONFIRMED real index, DECISIVE | Source: `inbound_edges` reads `self.backward_edges` (`types/storage/graph_csm/graph_traversal.rs:41-55`), a CSR built in the *same* `freeze()` pass as the forward one (`types/storage/graph_dynamic/graph_freeze.rs`). Empirical: at 10M edges (max in-degree found = 9, uniform-random corpus), `inbound_edges` on the max-in-degree(9) node cost 6.4ns/call over 2,000,000 calls; on a 0-in-degree node it cost 0.0ms total over the same 2,000,000 calls. A per-call O(E) scan over 10M edges done 2,000,000 times could not possibly finish in 0.0ms -- this is the decisive proof, not just the source read. `outbound_edges` on the max-out-degree(10) node cost 6.9ns/call, the same order as inbound, confirming both directions are equally O(degree). |
| H3 | SCC stack safety | CONFIRMED iterative, did not abort at target N | `strongly_connected_components()` uses an explicit heap-allocated `dfs_stack: Vec<(usize, slice::Iter<'_, usize>)>` with a `// Simulate recursion` comment (`graph_csm_algo_structural.rs:33,44`) -- Tarjan's algorithm run as an explicit state machine, not native recursion. 1,000,000-node path graph: `strongly_connected_components()` returned exactly 1,000,000 singleton components (correct) in 34.2ms, peak RSS 160MB. No abort was found up to the requested N=1,000,000 (task said not to hunt for a wall past this size). Because the "stack" is a `Vec` on the heap, it is not comparable 1:1 to petgraph's per-thread call-stack figure (108MB of *thread stack* at N=1,000,000, user-supplied, not independently verified here) -- the practical implication is the same: ultragraph's SCC cannot blow a default 8MB thread stack, ever, at any N, because it does not recurse. |
| H4 | Traversal with predicates/depth caps | CONFIRMED absent from the crate; hand-rolled and measured | `GraphTraversal<N,W>` has exactly two methods: `outbound_edges`, `inbound_edges` (`traits/graph_traversal.rs`). No BFS, DFS, callback, halt predicate, or depth cap exists anywhere in the crate (`grep -rniE "condens|transitive|ancestor|descendant|closure"` across `src/` returns one doc-comment word, no function). Wrote both shapes sprefa needs over `outbound_edges`: a halt-predicate BFS (30 lines) and a depth-capped multi-source BFS (31 lines), in `src/bin/h4_traversal.rs`. On the realistic corpus shape (ratio 1.0819, no giant component at that density -- see caveat below) ultragraph-via-trait was 1.04x slower than a hand-rolled raw-CSR walk (1,896 vs 1,972 nodes/ms) over 2,627 reached nodes. On a denser synthetic graph (10M edges, avg out-degree 20, 500,000 nodes, full reachability) ultragraph was 1.32x slower (8,783 vs 11,592 nodes/ms) over the full 500,000-node walk -- the more trustworthy number since it isn't dominated by per-call overhead on a tiny result set. |
| H5 | Full algorithm inventory | DONE, see table below | Enumerated from source, not docs. |
| H6 | Scale ceiling within budget | 10,000,000 edges / 10,819,000 nodes built+frozen in 2,984ms at 1,641MB peak RSS -- this is where the 2GB budget line sits, so it is also the practical ceiling under the stated constraint, not a discovered wall. **Extrapolation (LABELED, not measured):** linear scaling from the 1M->10M ratio puts 130M edges at roughly 1,641MB x 13 ≈ **21GB peak RSS during freeze()**, which does not fit in this 16GB machine. This is the single most consequential number in this report. |
| H7 | API ergonomics / failure modes | CONFIRMED, exhaustively enumerated | Querying an **unfrozen** graph does not silently misbehave -- every trait method (`outbound_edges`, `is_reachable`, `strongly_connected_components`, ...) returns `Err(GraphError::GraphNotFrozen)`. Out-of-range index -> `Err(GraphError::NodeNotFound(i))`. Mutating a **frozen** graph -> `Err(GraphError::GraphIsFrozen)`. `add_edge` to a nonexistent target on a dynamic graph -> `Err(GraphError::EdgeCreationError{source,target})`. All 8 `GraphError` variants (source has one more than tested: `AlgorithmError(&'static str)`, an internal-invariant-violation error that should be unreachable absent a crate bug) implement `Display` with a human-readable message -- verbatim strings quoted in section 3. |
| H8 | Project health | Stated plainly: single-maintainer risk | GitHub (`deepcausality-rs/deep_causality`, `api.github.com` fetched 2026-07-19): 268 stars, 22 forks, 3 open issues, last push 2026-07-19. Contributors (`/contributors`, top 6): `marvin-hansen` 4,193 commits; `dependabot[bot]` 102; `github-actions[bot]` 44; three human accounts (`vaijira`, `mvanhorn`, `micrypt`) at **1 commit each**. crates.io downloads (`crates.io/api/v1/crates/ultragraph`): 45,718 total, 24,201 recent, vs petgraph's 434,390,117 total -- **9,502x** fewer downloads. Release history: 31 versions since 2023-08-17, including a 10-month gap (2024-01 to 2024-11) and a 7-month gap (2024-11 to 2025-06) before becoming near-monthly from mid-2025 on, coinciding with the 0.5.x -> 0.8.0 jump (likely the CSR rewrite this lab is testing). The crate's own crates.io description reads "Hypergraph data structure" though everything tested here is an ordinary directed graph API. **Bus factor is effectively 1.** The crate lives at `deepcausality-rs/deep_causality`'s `ultragraph/` subdirectory, not a standalone repo. |

### H5 detail: full algorithm inventory from source

All five traits live under `ultragraph::traits::*`, all bounded by
`GraphView<N, W>`, all `CsmGraph`-only (none of them are implemented for
`DynamicGraph` -- every one requires `.freeze()` first, confirmed by H7).

| Trait | Method | Signature | Relevant to sprefa's reachability/closure/ancestors/descendants/condensation/cycle/topo-sort needs? |
|---|---|---|---|
| `StructuralGraphAlgorithms` | `strongly_connected_components` | `fn(&self) -> Result<Vec<Vec<usize>>, GraphError>` | Yes -- replaces `tarjan`, see table below. |
| | `articulation_points` | `fn(&self) -> Result<Vec<usize>, GraphError>` | No sprefa equivalent exists to replace. |
| | `bridges` | `fn(&self) -> Result<Vec<(usize, usize)>, GraphError>` | No sprefa equivalent exists to replace. |
| | `biconnected_components` | `fn(&self) -> Result<Vec<Vec<usize>>, GraphError>` | No sprefa equivalent exists to replace. |
| `TopologicalGraphAlgorithms` | `find_cycle` | `fn(&self) -> Result<Option<Vec<usize>>, GraphError>` | Partial -- finds *a* cycle path, not per-component cyclic flags; does not give `Cond.cyclic: Vec<bool>` directly. |
| | `has_cycle` | `fn(&self) -> Result<bool, GraphError>` | Whole-graph yes/no, not per-node/per-component. |
| | `topological_sort` | `fn(&self) -> Result<Option<Vec<usize>>, GraphError>` | Yes in principle for a DAG-shaped condensation, but sprefa's `count_pairs` computes its own topo order over the condensed DAG (a much smaller graph than the raw one), so there is little to gain by routing that through this method on the raw graph. |
| `PathfindingGraphAlgorithms` | `is_reachable` | `fn(&self, usize, usize) -> Result<bool, GraphError>` | Single-pair only. `reaches_from`/`reached_by` need the FULL reachable set from one node, which this does not provide; would need `is_reachable` called O(V) times, that's O(V) times more expensive than a BFS. |
| | `shortest_path_len` | `fn(&self, usize, usize) -> Result<Option<usize>, GraphError>` | Not used by sprefa's baseline. |
| | `shortest_path` | `fn(&self, usize, usize) -> Result<Option<Vec<usize>>, GraphError>` | Not used by sprefa's baseline. |
| | `shortest_weighted_path` | `fn(&self, usize, usize) -> Result<Option<(Vec<usize>, W)>, GraphError> where W: Copy + Ord + Default + Add<Output=W>` | Dijkstra; not used by sprefa's baseline. |
| `CentralityGraphAlgorithms` | `betweenness_centrality` | `fn(&self, directed: bool, normalized: bool) -> Result<Vec<(usize, f64)>, GraphError>` | Not used by sprefa's baseline. |
| | `pathway_betweenness_centrality` | `fn(&self, pathways: &[(usize, usize)], directed: bool, normalized: bool) -> Result<Vec<(usize, f64)>, GraphError>` | Not used by sprefa's baseline. |
| `GraphTraversal` | `outbound_edges` / `inbound_edges` | `fn(&self, usize) -> Result<impl Iterator<Item = usize> + '_, GraphError>` | The only two traversal primitives that exist; everything else (BFS, halt, depth cap, condensation, transitive closure, ancestors/descendants as sets) must be hand-written on top of these two, exactly as sprefa does today over its own `adj: &[Vec<u32>]`. |

**No condensation, transitive closure, or batch ancestors/descendants method
exists anywhere in the crate** -- `grep -rniE
"condens|transitive|ancestor|descendant|closure"` over the vendored source
returns exactly one hit, a doc-comment on `graph_csm_algo_topological.rs:17`
using the word "descendants" in prose, not a function.

## 2. Replacement table for sprefa's 6 hand-rolled functions

Baseline read: `src/graph/scc.rs` (`tarjan`, `Cond`/`build_condensed`,
`count_pairs`, `reaches_from`, `reached_by`), `src/graph/walk.rs`
(`multi_source_walk`, `multi_source_halt_bfs`).

| sprefa function | What it does | ultragraph replaces it? | With what | Measured cost |
|---|---|---|---|---|
| `tarjan` (iterative Tarjan, `scc.rs:13-59`) | node -> component id, ncomp | **Yes** | `CsmGraph::strongly_connected_components()` -- same algorithm shape (explicit heap `dfs_stack`), different output shape (`Vec<Vec<usize>>` of member lists, not a `(comp_id, ncomp)` pair; a trivial O(V) remap converts one to the other) | 1M-node path graph: 34.2ms, 160MB peak. Correctness verified against a planted 3-cycle in `tests/integration.rs`. |
| `build_condensed` (`Cond` with `cadj`, `cadj_rev`, `cyclic`, `members`, `size`) | SCC + condensed DAG both directions + per-component cyclic flag | **Partial.** SCC output is replaced (above). The condensed DAG (`cadj`/`cadj_rev`), per-component `cyclic` flag, and `members` index are **not provided** and must still be hand-built from the SCC result, same as today -- ultragraph gives you the partition, not the condensation. | Hand-roll unchanged (same ~20 lines `build_condensed` already has, fed by ultragraph's SCC instead of the in-repo `tarjan`) | Not separately measured; this is a wash, not a win. |
| `count_pairs` (condensation + topo order + per-component reachability bitset, `scc.rs:103-141`) | Theta(V) total reachable-pair count, no materialized closure | **No.** Zero hits for `condens`/`transitive`/`closure` as identifiers anywhere in the crate (grep-verified); `is_reachable` is single-pair only, not a batch/count primitive. | Must fully hand-roll on top of the condensation, exactly as today | Not applicable; no ultragraph primitive to measure. |
| `reaches_from` (BFS over the condensed DAG forward, `scc.rs:146-161`) | all nodes reachable from `start` | **No batch equivalent**, but the raw-graph BFS underneath it is now cheaper to write since ultragraph hands you a working `outbound_edges` for free | Hand-rolled halt/depth BFS over `outbound_edges` (`h4_traversal.rs`, 30-31 lines each) | 1.04x-1.32x slower than a hand-rolled raw CSR walk, see H4. |
| `reached_by` (BFS over `cadj_rev`, the *hand-built reverse condensed DAG*, `scc.rs:165-180`) | all nodes that reach `target` | **Partial win.** sprefa's own raw graph has no reverse adjacency today -- `cadj_rev` only exists at the condensation level. ultragraph's `inbound_edges` is a real O(degree) reverse index over the RAW graph (confirmed H2), so a `reached_by`-shaped walk over the raw graph no longer requires hand-building a reverse adjacency list first. | `inbound_edges` in place of a hand-built reverse CSR | Same per-call cost profile as `outbound_edges` (6.4-6.9ns/call in the H2 measurement); the win is a full transposed CSR (168MB extra at 10M edges) built by `freeze()` at no extra code, not raw speed. |
| `multi_source_walk` / `multi_source_halt_bfs` (`walk.rs`, tag-scoped generation-stamped BFS, halt mask, optional depth cap) | multi-tag, halt-gated, depth-capped BFS in one pass | **No.** `GraphTraversal` exposes only the two edge iterators; no callback, halt, or depth-cap primitive exists to call into. | Hand-rolled over `outbound_edges`, same shape as sprefa's own (single-tag versions shown in `h4_traversal.rs`; the multi-tag generation-stamp trick from `walk.rs` ports over unchanged, it only needs an edge iterator) | 1.04x-1.32x slower than raw CSR (H4); sprefa's own `multi_source_walk` already IS the raw-CSR version, so adopting ultragraph here is a straight ~1.3x regression bought for nothing, since the halt/depth logic must be hand-written either way. |

**Net reading of this table:** ultragraph replaces exactly one of six
functions outright (`tarjan`, with a shape change you must adapt to), and
gives a modest ergonomic win on one more (`reached_by`, because the crate
now hands you a real reverse index instead of you building one). The other
four (`build_condensed`'s DAG/cyclic/members bookkeeping, `count_pairs`,
`reaches_from`'s condensation-aware short-circuiting, and the halt/depth
walk logic itself) are unaffected either way -- they are hand-rolled today
and stay hand-rolled on top of ultragraph, at a measured 1.04x-1.32x
per-edge-touch tax versus the current raw-CSR code for the parts that do
route through the crate's iterators.

## 3. Traps, quoted verbatim

- **Freeze is not a move.** `graph_dynamic/graph_freeze.rs` preallocates
  `vec![0; total_edges]` and `vec![W::default(); total_edges]` for BOTH
  `fwd_targets`/`fwd_weights` and `back_targets`/`back_weights` before the old
  `DynamicGraph`'s adjacency lists are fully consumed. Measured consequence:
  peak RSS during `freeze()` is ~1.85x the pre-freeze `DynamicGraph`'s own
  footprint, not ~1.0x. At the 130M-edge production target this extrapolates
  (labeled, not measured) to ~21GB, which will not fit in 16GB.

- **Querying an unfrozen graph does not "just work slower" -- it errors,
  every time.** Verified for `outbound_edges`, `is_reachable`, and
  `strongly_connected_components`:
  ```
  [h7] outbound_edges on unfrozen graph -> Err(GraphNotFrozen)
  [h7] is_reachable on unfrozen graph -> Err(GraphNotFrozen)
  [h7] strongly_connected_components on unfrozen graph -> Err(GraphNotFrozen)
  ```

- **Mutating a frozen graph errors, it does not panic or silently no-op:**
  ```
  [h7] add_node on FROZEN graph -> Err(GraphIsFrozen)
  ```

- **Out-of-range node index errors with the index echoed back:**
  ```
  [h7] outbound_edges(9999) on frozen graph -> Err(NodeNotFound(9999))
  ```

- **`add_edge` to a target that does not exist reports `EdgeCreationError`,
  not `NodeNotFound`** -- a naming trap if you're grepping for the wrong
  variant:
  ```
  [h7] add_edge(a, 9999) on dynamic graph -> Err(EdgeCreationError { source: 0, target: 9999 })
  ```

- **`GraphError::AlgorithmError(&'static str)` exists but was never
  triggered in any test here.** Source comments describe it as firing only
  when an internal Tarjan invariant is violated (e.g. `tarjan_stack` empty
  mid-pop) -- effectively "this would mean a bug in the crate itself," not a
  condition callers should plan to handle.

- **The realistic corpus shape has no giant component.** The real sprefa
  ratio (1.0819 nodes per edge, average out-degree just under 1) is BELOW
  the giant-component threshold for a uniform-random digraph. A BFS from 200
  random seeds over a 10M-edge, 10.8M-node graph at that ratio reached only
  2,627 nodes. This is not an ultragraph defect -- it means naive uniform
  random-graph generation is the wrong synthetic fixture for throughput
  testing, not that the real graph lacks connectivity (the real graph has
  actual call-graph structure, not uniform-random edges, and is presumably
  far more connected than this synthetic stand-in). `gen_dense_corpus` in the
  lab works around this for throughput measurement; it is not a claim about
  the real corpus's actual connectivity, which was not measured here.

- **crates.io lists this crate under the description "Hypergraph data
  structure"** even though every type and method tested here (`CsmGraph`,
  `DynamicGraph`, CSR adjacency, Tarjan SCC) is an ordinary directed-graph
  API. No hypergraph (edges connecting more than two nodes) construct was
  found anywhere in `src/`.

## 4. Working code from passing tests

`tests/integration.rs`, run via `cargo test --release` (6 passed, 0 failed):

```rust
#[test]
fn inbound_edges_are_the_exact_transpose_of_outbound_edges() {
    let (num_nodes, edges) = gen_corpus_shaped(5_000, 2);
    let frozen = build_frozen(num_nodes, &edges);

    let mut expected_out: Vec<Vec<u32>> = vec![Vec::new(); num_nodes];
    let mut expected_in: Vec<Vec<u32>> = vec![Vec::new(); num_nodes];
    for &(source, target, _) in &edges {
        expected_out[source as usize].push(target);
        expected_in[target as usize].push(source);
    }
    for list in expected_out.iter_mut().chain(expected_in.iter_mut()) {
        list.sort_unstable();
    }

    for node in 0..num_nodes {
        let mut actual_out: Vec<u32> = frozen
            .outbound_edges(node)
            .unwrap()
            .map(|target| target as u32)
            .collect();
        actual_out.sort_unstable();
        assert_eq!(actual_out, expected_out[node], "outbound mismatch at node {node}");

        let mut actual_in: Vec<u32> = frozen
            .inbound_edges(node)
            .unwrap()
            .map(|source| source as u32)
            .collect();
        actual_in.sort_unstable();
        assert_eq!(actual_in, expected_in[node], "inbound mismatch at node {node}");
    }
}
```

The halt-predicate BFS sprefa needs, written over `outbound_edges` (from
`src/bin/h4_traversal.rs`, exercised at 10M edges in section H4 above):

```rust
fn halt_bfs_on_ultragraph(
    graph: &CsmGraph<u32, u8>,
    starts: &[u32],
    halt: &[bool],
) -> Vec<u32> {
    let mut seen = vec![false; halt.len()];
    let mut out = Vec::new();
    let mut queue: VecDeque<u32> = VecDeque::new();
    for &start in starts {
        if !seen[start as usize] {
            seen[start as usize] = true;
            out.push(start);
            queue.push_back(start);
        }
    }
    while let Some(node) = queue.pop_front() {
        if halt[node as usize] {
            continue;
        }
        for neighbor in graph.outbound_edges(node as usize).unwrap() {
            let neighbor = neighbor as u32;
            if !seen[neighbor as usize] {
                seen[neighbor as usize] = true;
                out.push(neighbor);
                queue.push_back(neighbor);
            }
        }
    }
    out
}
```

Building and freezing (the only construction path in the crate):

```rust
pub fn build_frozen(num_nodes: usize, edges: &[Edge]) -> CsmGraph<u32, u8> {
    let mut graph: DynamicGraph<u32, u8> = DynamicGraph::with_capacity(num_nodes, None);
    for node_id in 0..num_nodes {
        graph.add_node(node_id as u32).expect("add_node");
    }
    for &(source, target, kind) in edges {
        graph.add_edge(source as usize, target as usize, kind).expect("add_edge");
    }
    graph.freeze()
}
```

## 5. Versions and environment

- `ultragraph = "0.9.3"`, resolved and locked (`Cargo.lock` in the lab crate).
- Released 2026-07-14 per `crates.io/api/v1/crates/ultragraph/versions`.
- `rustc 1.97.0-nightly (9eb3be26b 2026-05-18)`, `cargo 1.97.0-nightly (4d1f98451 2026-05-15)`.
- macOS 14.6.1 (BuildVersion 23G93), 16GB RAM (`sysctl hw.memsize` = 17,179,869,184 bytes), 12 CPUs.
- Every timing/memory number above is from a `--release` build; `Cargo.toml`
  additionally sets `[profile.release] debug = true` so `/usr/bin/time -l`
  symbolication and `perf`-style inspection stay available if needed later.
- Peak-RSS measurement tool: `/usr/bin/time -l` (macOS), field `peak memory
  footprint`. `swaps: 0` on every run in this report; `vm_stat` was checked
  before the session and showed free+inactive pages well above every
  measured peak.

## 6. What I could not test, and why

- **130M-edge / 150M-node scale was never built.** The task's hard cap is
  10,000,000 edges and ~2GB peak RSS; 10M edges already measured at 1,641MB
  peak. The 130M-edge figures in this report are explicitly labeled
  extrapolations from the measured 1M->10M linear trend, not measurements.
  A previous run in this same lab that tried 100M edges swapped the machine
  (per the task's own account) -- not repeated here.

- **The high-in-degree case for H2 was weaker than intended.** The
  ratio-1.0819 uniform-random corpus produces a maximum observed in-degree of
  only 9 at 10M edges (an artifact of uniform random assignment at that
  density, not a crate limitation). The 0-in-degree timing result (0.0ms
  over 2,000,000 calls) is still decisive against an O(E) scan, but a
  purpose-built skewed/power-law degree distribution, which was not built,
  would have given a cleaner high-degree-vs-low-degree contrast at similar
  absolute degree magnitudes.

- **petgraph's 108MB stack-at-N=1,000,000 figure was not independently
  reproduced in this session.** It is carried from the task prompt as a
  comparison point, and the two numbers are not apples-to-apples besides
  (thread call-stack bytes vs heap-allocated `Vec` bytes) -- flagged rather
  than silently treated as equivalent.

- **The real 283,127-node / 261,704-edge sprefa graph was not loaded into
  ultragraph.** All measurements use synthetic graphs shaped by the same
  node:edge ratio (1.0819) or a denser synthetic alternative
  (`gen_dense_corpus`), not the actual database. Real-graph connectivity,
  degree skew, and SCC structure could differ from both synthetic shapes
  used here.

- **Betweenness centrality and Dijkstra (`shortest_weighted_path`) were read
  from source (signatures in section H5) but never invoked or timed.**
  sprefa's stated workload (reachability, condensation, port-reach BFS) does
  not need them, so no measurement budget was spent there.

- **Articulation points / bridges / biconnected components** exist in the
  crate (`StructuralGraphAlgorithms`) and were read from source but not
  invoked; sprefa's baseline (`scc.rs`, `walk.rs`) has no equivalent
  functions to compare against, so there was nothing to replace-test.
