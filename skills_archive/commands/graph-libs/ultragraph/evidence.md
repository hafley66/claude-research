---
description: Hypothesis-by-hypothesis measurements, traps, working code, and environment backing the ultragraph verdict in index.md
argument-hint: [section]
---

# ultragraph: evidence

Companion to [index.md](index.md), which has the verdict and the reasoning.
This document is the raw backing: every hypothesis tested, quoted trap
output, code from tests that actually passed, and the environment the
numbers came from. All numbers are from the lab crate at
`~/projects/claude-research/labs/graph-ultragraph/`; nothing here is
transcribed from docs.rs.

## Hypothesis table

| # | Hypothesis | Result | Measured number |
|---|---|---|---|
| H1 | `Freezable` model: is `CsmGraph` a real CSR, and what does freezing cost | CONFIRMED, and the cost is the disqualifier | `CsmGraph` holds two independent CSR structures, `forward_edges` and `backward_edges`, each `{offsets, targets, weights}`. Peak RSS ratio (frozen over unfrozen): 1.84x at 1M edges (90MB to 166MB), 1.85x at 10M edges (889MB to 1,641MB). |
| H2 | Is `inbound_edges` a real transposed index or an O(edges) scan | CONFIRMED real index | Source: reads a `backward_edges` CSR built in the same `freeze()` pass as the forward one. Timing: `inbound_edges` on a 0-in-degree node cost 0.0ms total over 2,000,000 calls at 10M edges; the max-in-degree(9) node cost 6.4ns per call over the same 2,000,000 calls; `outbound_edges` on the max-out-degree(10) node cost 6.9ns per call, the same order of magnitude. |
| H3 | Is `strongly_connected_components` recursive or iterative | CONFIRMED iterative | Explicit heap-allocated `dfs_stack: Vec<(usize, slice::Iter<'_, usize>)>`, with a `// Simulate recursion` comment in the source. A 1,000,000-node path graph (worst case for a recursive implementation) returned the correct 1,000,000 singleton components in 34.2ms at 160MB peak RSS, no abort. |
| H4 | Does the crate offer BFS/DFS with a callback, halt condition, or depth cap | CONFIRMED absent | `GraphTraversal` has exactly two methods, `outbound_edges` and `inbound_edges`. A search of the whole source tree for condensation, transitive closure, ancestor sets, or descendant sets returns one doc-comment word, no function. Hand-rolled halt/depth BFS over `outbound_edges`, measured against a raw-array walk: 1.32x slower on a graph with a real giant component (500,000 of 500,000 nodes reached), 1.04x slower on the realistic sparse corpus shape (only 2,627 nodes reached, a weaker sample). |
| H5 | Full algorithm inventory | Done from source | Five traits (`StructuralGraphAlgorithms`, `TopologicalGraphAlgorithms`, `PathfindingGraphAlgorithms`, `CentralityGraphAlgorithms`, `GraphTraversal`), all requiring a frozen `CsmGraph`. Full signatures in the skill file's H5 table; nothing in any of them provides condensation, transitive closure, or batch ancestor/descendant sets. |
| H6 | Scale ceiling within the 10M-edge, ~2GB budget | 10,000,000 edges, 10,819,000 nodes, built and frozen in 2,984ms at 1,641MB peak RSS. Extrapolated (labeled, not measured) to 130M edges at roughly 21GB peak, past this machine's 16GB. |
| H7 | What actually errors, and does an unfrozen graph work, error, or silently misbehave | CONFIRMED, exhaustively | Every trait method on an unfrozen graph returns `Err(GraphError::GraphNotFrozen)`, not a silent slow path. Out-of-range index returns `Err(GraphError::NodeNotFound(index))`. Mutating a frozen graph returns `Err(GraphError::GraphIsFrozen)`. See the traps section for exact output. |
| H8 | Project health | Stated plainly in index.md | GitHub: 268 stars, 22 forks, 3 open issues. Contributors: one account at 4,193 commits, three human accounts at 1 commit each. crates.io: 45,718 downloads total versus petgraph's 434,390,117. Release gaps of 10 and 7 months in the history. |

## Traps, quoted verbatim

Querying an unfrozen graph does not run slower, it refuses outright, for
every trait method tested:

```
[h7] outbound_edges on unfrozen graph -> Err(GraphNotFrozen)
[h7] is_reachable on unfrozen graph -> Err(GraphNotFrozen)
[h7] strongly_connected_components on unfrozen graph -> Err(GraphNotFrozen)
```

Mutating a frozen graph errors rather than panicking or silently doing
nothing:

```
[h7] add_node on FROZEN graph -> Err(GraphIsFrozen)
```

An out-of-range node index echoes the offending index back in the error:

```
[h7] outbound_edges(9999) on frozen graph -> Err(NodeNotFound(9999))
```

`add_edge` to a target that does not exist reports `EdgeCreationError`, a
trap if you go looking for `NodeNotFound` instead:

```
[h7] add_edge(a, 9999) on dynamic graph -> Err(EdgeCreationError { source: 0, target: 9999 })
```

The realistic sprefa node-to-edge ratio, 1.0819 nodes per edge, sits below
the giant-component threshold for a uniform-random directed graph. A BFS
from 200 random seeds over a 10M-edge, 10.8M-node graph built at that ratio
reached only 2,627 nodes total. This is not a defect in ultragraph; it means
a uniform-random synthetic graph at that density is the wrong fixture for
throughput testing, since the real sprefa graph has actual call-graph
structure rather than uniformly random edges and is presumably far better
connected. A denser synthetic generator (average out-degree 20) was built
specifically to get a throughput number over a real giant component instead.

`GraphError` has one variant that was read from source but never triggered
in any test here: `AlgorithmError(&'static str)`. The source comments
describe it as firing only when an internal Tarjan invariant is violated,
which would indicate a bug in the crate rather than a condition a caller
needs to plan for.

crates.io's own description of this crate is "Hypergraph data structure,"
even though nothing tested here (or found in the source) connects an edge to
more than two nodes; every type exercised in this lab is an ordinary
directed graph.

## Working code from passing tests

`tests/integration.rs` in the lab crate, run with `cargo test --release`, 6
tests passed, 0 failed. The test that proves H2 by checking `inbound_edges`
against an independently computed ground truth for every node:

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

The halt-predicate BFS sprefa needs, written by hand over `outbound_edges`
because the crate has no such primitive, exercised at 10M edges in the H4
measurement above:

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

Building and freezing, the only construction path the crate offers:

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

## Environment

- `ultragraph = "0.9.3"`, resolved and locked in the lab crate's
  `Cargo.lock`, released 2026-07-14 per crates.io.
- `rustc 1.97.0-nightly (9eb3be26b 2026-05-18)`, `cargo 1.97.0-nightly
  (4d1f98451 2026-05-15)`.
- macOS 14.6.1 (build 23G93), 16GB RAM, 12 CPUs.
- Every timing and memory number above is from a `--release` build,
  confirmed by inspecting the build output directly rather than assuming
  the default profile.
- Peak RSS was read from `/usr/bin/time -l`'s "peak memory footprint"
  field on macOS. Every run in this evidence set reported `swaps: 0`; no
  run touched swap.

## What I could not test, and why

- **130M edges was never built.** The stated budget for this lab was
  10,000,000 edges and roughly 2GB of peak memory, and 10M edges already
  measured at 1,641MB peak, close to that ceiling. The 130M-edge figures in
  this writeup are explicitly labeled extrapolations from the measured
  1M-to-10M trend, not measurements. A prior attempt in this same lab that
  tried 100M edges swapped the machine and was not repeated.

- **The high-in-degree side of H2 was weaker than intended.** At 10M edges,
  the uniform-random corpus produced a maximum observed in-degree of only 9,
  an artifact of random assignment at that density rather than a limitation
  of the crate. The 0-in-degree timing result (0.0ms over 2,000,000 calls)
  is still decisive against an O(edges) scan, but a purpose-built skewed
  degree distribution, which was not built, would have given a cleaner
  contrast between high and low degree at comparable absolute magnitudes.

- **petgraph's stack-usage figure for `tarjan_scc` was not independently
  reproduced in this lab.** It is carried over as a comparison point from
  outside this session, and the two numbers being compared, thread-stack
  bytes against heap-allocated `Vec` bytes, are not strictly the same kind
  of measurement; that distinction is flagged rather than treated as an
  apples-to-apples comparison.

- **The real 283,127-node, 261,704-edge sprefa graph was never loaded into
  ultragraph.** Every measurement in this lab uses synthetic graphs, either
  matching the real node-to-edge ratio (1.0819) with uniformly random edges
  or a denser synthetic alternative built to guarantee a giant component.
  The real graph's actual degree distribution, connectivity, and SCC
  structure could differ from both synthetic stand-ins used here.

- **Betweenness centrality and Dijkstra's shortest weighted path** exist in
  the crate and their signatures were read from source, but neither was
  invoked or timed. Nothing in sprefa's baseline workload (reachability,
  condensation, halted BFS) calls for them, so no measurement budget was
  spent there.

- **Articulation points, bridges, and biconnected components** exist in the
  crate and were read from source but not invoked. sprefa's baseline has no
  equivalent function to compare against, so there was nothing to
  replace-test.
