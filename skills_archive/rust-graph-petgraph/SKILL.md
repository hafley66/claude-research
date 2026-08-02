---
name: rust-graph-petgraph
description: petgraph 0.8.3 capability reference for sprefa v6's graph layer -- what it replaces in scc.rs/walk.rs, what it costs (bytes/edge, ms, peak RSS at 1M/10M edges), and what it cannot do (Csr has no reverse traversal, tarjan_scc/depth_first_search are recursion-limited), verified empirically 2026-07-19.
---

Lab crate: `~/projects/claude-research/labs/graph-petgraph/` (README.md there
has the exact re-run command for every number below). Baseline compared
against: `/Users/chrishafley/projects/sprefa/src/graph/scc.rs` (180 lines) and
`walk.rs` (251 lines).

## 1. Verdict table

| # | Hypothesis | Verdict | Measured |
|---|---|---|---|
| H1 | tarjan_scc is recursive, crashes on deep chains | CONFIRMED | Recursive call at `tarjan_scc.rs:96` (`self.visit(w, g, f)`). Default 8176KB main-thread stack: last-ok N=74528, first-crash N=74529 (exact bracket, path graph). Bytes/node from bracket: 112.34. At N=1,000,000: crashes at 100MB stack, survives at 115MB (confirms prior ~108MB estimate). |
| H2 | kosaraju_scc iterative, survives, matches tarjan's order | CONFIRMED, with a hard caveat | No recursion in `kosaraju_scc.rs`; drives iterative `Dfs`/`DfsPostOrder` walkers. Survives N=74529 (1ms, 6.3-7.2MB peak) and N=1,000,000 (22ms, 61.6-74.6MB peak), both on the default stack, no thread needed. Ordering matches tarjan_scc exactly on a 5000-node cyclic graph (100 SCCs, `same_order=true`). CAVEAT: requires `IntoNeighborsDirected`, which `Csr` never implements -- confirmed compile failure (`examples/kosaraju_csr_fail.rs`). `tarjan_scc` DOES compile against `Csr` (confirmed, `examples/tarjan_csr_ok.rs`). So the safe algorithm is not reachable on sprefa's own Csr representation without first building a second reverse structure or switching representations. |
| H3 | Csr vs Vec<Vec<u32>> memory/speed, 1M and 10M edges | CONFIRMED | 1M edges: vecvec 43.6 B/edge (43,599,040 B peak, 35ms build); csr 21.4 B/edge (21,382,208 B peak, 6ms build + 18ms sort/dedup). 10M edges: vecvec 42.5 B/edge (424,776,192 B peak, 449ms build); csr 17.4 B/edge (173,688,128 B peak, 68ms build + 205ms sort/dedup). Csr is ~2.4x smaller and faster to bulk-load once pre-sorted, at both scales measured. Extrapolation ONLY (not measured) to the 500-repo, ~130M-edge target: csr ~2.26GB, vecvec ~5.53GB, straight-line from the 1M/10M curve. |
| H4 | Csr::from_sorted_edges constraints | CONFIRMED | Unsorted input -> `Err(EdgesNotSorted { first_error: (1, 2) })`. Duplicate sorted edges -> ALSO `Err(EdgesNotSorted { first_error: (0, 1) })` -- no separate duplicate-error variant; an equal-adjacent pair fails the strict-increasing check. A trailing node with no edges (id above the max endpoint actually seen) silently vanishes: `node_count` is inferred purely from the max endpoint in the edge list. Bulk `add_edge` measured directly through 1,000,000 edges (not skipped, per the hypothesis's own instruction): 2000 edges = 0.34ms ... 1,000,000 edges = 120,430.94ms (120.4 seconds). Doubling ratios settle at ~4.0-4.05x from 64,000 through 256,000 (consistent with O(n^2)); the final, non-doubling (3.9x edges) step to 1,000,000 shows an 18.05x time increase. `from_sorted_edges` builds the same 1,000,000 edges in 6ms (+18ms sort) -- roughly 4 orders of magnitude faster than one-at-a-time `add_edge` at this scale. 10,000,000-edge bulk `add_edge` was NOT run (see section 6). |
| H5 | visit::Control::Prune semantics | CONFIRMED, decisive for sprefa | Exact-set assertion passes on the hand-built 12-node graph: `discovered == {0,1,2,5,6,7,9}`. The pruned node IS discovered and IS finished (`DfsEvent::Finish` still fires); only its OUTGOING edges are skipped. A sibling edge from the same parent as a pruned node (6->9, sibling of the pruned 6->7) is untouched. This matches `multi_source_halt_bfs`'s halt semantics exactly for a single-source, single-tag traversal. |
| H6 | Reversed<G> over Csr/DiGraph/StableDiGraph | PARTIAL / CONFIRMED with a hard constraint | `Reversed<&DiGraph>` and `Reversed<&StableDiGraph>` both compile and traverse correctly (`[2, 1, 0]` from a reversed DFS seeded at the chain's tail, both graph types). `Reversed<&Csr>` does NOT compile: `the trait bound Csr: IntoNeighborsDirected is not satisfied` (verbatim, section 3). Workaround (build a second, transposed Csr) measured at 10M edges: 282ms build, 273,106,496 B peak RSS -- roughly DOUBLING total graph memory versus the forward-only Csr alone (174MB) at that scale. At 1M edges: 33ms, 29,361,120 B peak. |
| H7 | Depth-capped BFS, two ways | CONFIRMED, with a stack-size finding beyond the original prediction | Two working implementations exist (section 4): `depth_first_search` + `Control` (32 lines, expresses a depth cap AND a halt predicate simultaneously in one pass -- both `control_small` cases pass) and a hand-rolled `Bfs`-walker loop (25 lines, depth cap only). The `Bfs::next()` naive-halt trap is real and reproduced exactly: checking a halt predicate on the value `.next()` returns is too late, because `.next()` already expanded that node's neighbors as a side effect before returning it (`bfs_naive_halt_is_broken`: reached leaks node 2 and 3 past a halt at node 1). Additionally: `depth_first_search`'s underlying recursion crashes at a LOWER N than tarjan_scc on the identical deep-chain shape and default stack -- bracket [43418 ok, 43563 crash], versus tarjan's [74528 ok, 74529 crash]. Bytes/node estimate ~192.6, roughly 1.7x heavier per frame than tarjan_scc's ~112.3, because the visitor closure carries more captured state (a depth-tracking HashMap, a pending-child-depth Option). At N=1,000,000 this Control-based traversal needs a stack between 180MB (crashes) and 220MB (survives) -- again, well over tarjan_scc's ~108-115MB for the same N. |
| H8 | NodeFiltered/EdgeFiltered overhead at 10M edges | CONFIRMED near-zero | 3 runs at 10M edges: baseline 55-57ms, node-filtered 51-54ms (-4.4% to -8.0%), edge-filtered 49-51ms (-7.6% to -12.0%). The "overhead" is negative every run -- i.e. not distinguishable from measurement noise for an always-true predicate. |
| H9 | Repo health via GitHub API | CONFIRMED | 3965 stars, 285 open issues, 454 forks, not archived, last push 2026-04-04. Only 4 tagged releases in the last ~2 years (0.8.0 2025-04-05, 0.8.1 2025-04-07, 0.8.2 2025-06-06, 0.8.3 2025-09-30), none since -- despite 131 commits in the same window and an open issue created 2026-07-14 (5 days before this lab ran). Two directly relevant issues found: #399 "tarjan_scc overflows the stack" (opened 2021-02-21, closed, maintainer reply "It's documented one of them is recursive and one of them is not, so this is expected" -- no code fix, by design) and #727 "Non-recursive DFS" (opened 2025-02-03, STILL OPEN as of today) where a maintainer initially disputed the recursion claim, citing `Dfs`'s own doc comment "`Dfs` is not recursive", until the reporter pointed at the OTHER recursive DFS (`dfsvisit.rs:241`, `depth_first_search`) specifically -- i.e. a petgraph maintainer was not aware, as of mid-2025, that a second recursive DFS implementation exists in their own crate. PR #413 (merged 2021-04-26, "Modified Tarjan SCC to reduce memory usage") added the Pierce space-efficient variant that gives today's ~112 bytes/node figure, but did not remove the recursion, confirmed still present in 0.8.3 five years later. |

## 2. Replacement table: sprefa's 6 baseline functions

| Function (file:lines) | petgraph replaces it? | With what | Measured cost | What's missing |
|---|---|---|---|---|
| `tarjan(adj: &[Vec<u32>])` (scc.rs:13-59, iterative Tarjan) | NO, not safely | `tarjan_scc` compiles against `Csr` but is recursive (H1: crashes past ~74.5k-deep chains on default stack, needs a ~108-115MB custom-stack thread at N=1M). `kosaraju_scc` is iterative and safe (H2) but will not compile against `Csr` at all. | tarjan_scc: 34ms at N=1M (115MB stack thread, no crash). kosaraju_scc: 22ms / 61.6-74.6MB peak at N=1M, but n/a on Csr. | Nothing in petgraph is BOTH iterative-safe AND Csr-compatible for this exact operation. sprefa's own hand-rolled iterative tarjan over `&[Vec<u32>]` stays. |
| `build_condensed(adj) -> Cond{comp,ncomp,size,cyclic,cadj,cadj_rev,members}` (scc.rs:73-100) | PARTIAL | `algo::condensation(Graph, make_acyclic) -> Graph<Vec<N>, E, Ty, Ix>`, built internally on `kosaraju_scc` (iterative, safe -- read from `algo/mod.rs:477-514`). | NOT benchmarked at sprefa's 283,127-node scale (see section 6) -- it takes `petgraph::Graph` by VALUE, not `Csr`, so a fair measurement means first pricing a `Graph` build, an unasked hypothesis. | No `cyclic` per component (derive from self-loops on the condensed graph, only present if `make_acyclic=false`); no `size` (derive via `members[i].len()`); no `cadj_rev` directly, though `Reversed<condensed_graph>` DOES compile here since the condensed graph is a `petgraph::Graph`, not a `Csr` (H6's Csr limitation does not apply once condensed). |
| `count_pairs(cond) -> u128` (scc.rs:103-141, topo + bitset reachability count) | NO | Nothing. `toposort` exists for ordering/cycle detection, not for counting reachable pairs. | n/a | Entire function. Stays bespoke. |
| `reaches_from`/`reached_by` (scc.rs:146-180, BFS over condensed cadj/cadj_rev) | PARTIAL, same caveat as build_condensed | `Bfs` walker over the (already-condensed) graph -- component counts are small enough that recursion/stack is a non-issue regardless of algorithm choice at this stage. | Not benchmarked; both are the same shape of `while let Some(...) = queue.pop_front()` loop against different backing storage, no measured advantage either way. | Only reachable once the migration off Csr from build_condensed has already been paid. |
| `multi_source_walk(adj, starts, halt, depth_cap)` (walk.rs:40-89, depth-carrying multi-tag BFS with halt+cap) | NO | `Bfs` (wrong shape, H7's naive-halt trap, section 3) plus `NodeFiltered`/`EdgeFiltered` (single boolean predicate, not multi-tag depth tracking) plus `Control` via `depth_first_search` (recursive, ruled out at sprefa's real depths per H1/H7). | n/a | Multi-tag per-tag visited-generation reset (sprefa's `seen[node] != gen`, O(1) between tags, vs a single shared `discovered` VisitMap you'd clear per tag, O(n) per tag) and depth-carrying frontier state (`(tag, node, depth)` triples). The only correct hand-rolled construction (pop/expand/return against `Bfs`'s own public fields, checking halt/depth BEFORE pushing) is not "using petgraph's BFS" so much as rewriting the walker's guts under petgraph's field names. Stays bespoke. |
| `multi_source_halt_bfs(adj, starts, halt)` (walk.rs:104-114, thin wrapper over the above) | NO, same reasons | -- | -- | Same as above. |

The one bright spot outside this table: for a SINGLE-source, single-tag
traversal, `depth_first_search` + `Control::Prune` correctly implements
record-but-do-not-expand semantics (H5, proven exactly). It is not a
replacement for either walk.rs function as written (both are multi-source,
multi-tag, depth-carrying) -- it is a viable building block only for a
narrower, hypothetical single-seed version, and it inherits the recursion
hazard (H7).

## 3. Every trap hit, quoted verbatim

**Csr has no reverse traversal (H6).** `examples/h6_reversed_csr_fail.rs`:
```
error[E0277]: the trait bound `Csr: IntoNeighborsDirected` is not satisfied
   --> examples/h6_reversed_csr_fail.rs:18:48
    |
 18 |     while let Some(_node) = dfs.next(Reversed(&csr)) {}
    |                                 ----           ^^^ the trait `IntoNeighborsDirected` is not implemented for `Csr`
    = note: required for `&Csr` to implement `IntoNeighborsDirected`
    = note: required for `Reversed<&Csr>` to implement `IntoNeighbors`
note: required by a bound in `Dfs::<N, VM>::next`
   --> .../petgraph-0.8.3/src/visit/traversal.rs:110:12
```

**kosaraju_scc has the SAME missing capability (H2/H6), found while writing
H6.** `examples/kosaraju_csr_fail.rs`:
```
error[E0277]: the trait bound `Csr: IntoNeighborsDirected` is not satisfied
  --> kosaraju_csr_fail.rs:6:30
   |
 6 |     let sccs = kosaraju_scc(&csr);
   |                ------------  ^^^ the trait `IntoNeighborsDirected` is not implemented for `Csr`
note: required by a bound in `kosaraju_scc`
  --> .../petgraph-0.8.3/src/algo/scc/kosaraju_scc.rs:98:8
   |
98 |     G: IntoNeighborsDirected + Visitable + IntoNodeIdentifiers,
```
`tarjan_scc`'s bound (`IntoNodeIdentifiers + IntoNeighbors + NodeIndexable`,
no directed-neighbor requirement) IS satisfied by `Csr` -- confirmed by
actually running `examples/tarjan_csr_ok.rs`: `scc_count=1 sccs=[[2, 1, 0]]`.

**tarjan_scc stack overflow, runtime symptom (H1).** Exact process abort text
at N=74529 (default 8176KB stack, no debug build, `--release`):
```
thread 'main' (111170592) has overflowed its stack
fatal runtime error: stack overflow, aborting
```
Same symptom text at N=1,000,000 with a 100MB custom stack, spawned via
`std::thread::Builder::new().stack_size(...)`:
```
thread '<unknown>' (111172482) has overflowed its stack
fatal runtime error: stack overflow, aborting
```
This is a hard process abort (SIGABRT after Rust's guard-page trap, shell
exit code 134), not a catchable panic -- there is no way to recover in-process
once the recursion goes this deep; the only mitigation is staying under the
threshold or provisioning a large enough dedicated stack ahead of time.

**depth_first_search + Control has the same hazard, at a LOWER threshold
(H7).** Identical abort text, but the crash bracket is [43418 ok, 43563
crash] versus tarjan_scc's [74528 ok, 74529 crash] on the exact same path
graph shape and default stack -- the `Control`-based traversal's stack frame
is heavier (measured ~192.6 bytes/node vs tarjan's ~112.3).

**Bfs::next() halt-after-expansion trap (H7), runtime symptom (not a compile
error -- a silent logic bug).** Chain 0->1->2->3, halt intended at node 1:
```
bfs_naive_halt_is_broken reached={0, 1, 2, 3} naive_intent={0, 1} matches_naive_intent=false
```
Checking the halt predicate on the value `.next()` hands back is always one
step too late, because `Bfs::next()` (traversal.rs:294-308) pops the front
node and pushes ITS neighbors onto the queue as a side effect, before
returning that node to the caller.

**Csr::from_sorted_edges rejects duplicates as "not sorted", not as a
distinct error (H4).**
```
duplicate_edges -> Err(EdgesNotSorted { first_error: (0, 1) })
```
Same variant, same shape, as the genuinely-unsorted-input case:
```
unsorted_input -> Err(EdgesNotSorted { first_error: (1, 2) })
```
There is no `DuplicateEdge` variant to match against separately.

**Csr silently drops trailing isolated nodes (H4).** Edges only ever
reference ids 0..=5; `from_sorted_edges` infers `node_count=6`, nothing more:
```
isolated_trailing_node -> node_count=6 (edges only reference ids 0..=5; a hypothetical isolated node 10 is NOT represented)
```
Use `Csr::with_nodes(n)` + explicit `add_edge` calls if isolated high-numbered
nodes must survive.

## 4. Working code from tests that passed

Every snippet below is the ACTUAL source in the lab crate (not paraphrased),
and every one has a passing `cargo test --release` or a printed pass=true /
matches expectation line backing it, per README.md's command list.

**H5 -- the sprefa `port_reach` shape, proven exact (`src/bin/h5_prune.rs`),
passing test `prune_records_node_skips_its_out_edges_finish_still_fires`:**
```rust
depth_first_search(graph, Some(seed), |event| -> Control<()> {
    match event {
        DfsEvent::Discover(node, _time) => {
            let index = index_of(node);
            discovered.insert(index);
            discover_order.push(index);
            if port_in.contains(&index) {
                Control::Prune
            } else {
                Control::Continue
            }
        }
        DfsEvent::Finish(node, _time) => {
            finished.insert(index_of(node));
            Control::Continue
        }
        _ => Control::Continue,
    }
});
```
Result: `discovered == {0,1,2,5,6,7,9}`, matching sprefa's
`multi_source_halt_bfs` semantics exactly for a single seed.

**H7 -- depth cap AND halt predicate together via Control, 32 lines
(`src/bin/h7_depth_bfs.rs::control_capped_halted_reach`), both
`control_small` cases pass:**
```rust
fn control_capped_halted_reach(
    graph: &DiGraph<(), ()>,
    seed: NodeIndex,
    depth_cap: usize,
    halt: &HashSet<usize>,
) -> BTreeSet<usize> {
    let mut depth_of: HashMap<NodeIndex, usize> = HashMap::new();
    depth_of.insert(seed, 0);
    let mut pending_child_depth: Option<usize> = None;
    let mut reached = BTreeSet::new();

    depth_first_search(graph, Some(seed), |event| -> Control<()> {
        match event {
            DfsEvent::TreeEdge(parent, _child) => {
                pending_child_depth = Some(depth_of[&parent] + 1);
                Control::Continue
            }
            DfsEvent::Discover(node, _time) => {
                let depth = if node == seed { 0 } else { pending_child_depth.take().expect("TreeEdge precedes Discover") };
                depth_of.insert(node, depth);
                reached.insert(node.index());
                if halt.contains(&node.index()) || depth >= depth_cap {
                    Control::Prune
                } else {
                    Control::Continue
                }
            }
            _ => Control::Continue,
        }
    });
    reached
}
```
Relies on `DfsEvent::TreeEdge(parent, child)` always firing immediately
before `DfsEvent::Discover(child)` in the recursive implementation, so
per-node depth can be tracked without a side channel.

**H7 -- depth cap ONLY via the Bfs walker, 25 lines, hand-layered against its
PUBLIC fields (`src/bin/h7_depth_bfs.rs::bfs_depth_cap_correct`), passes:**
```rust
let mut bfs = Bfs::new(&graph, nodes[0]);
let mut reached = BTreeSet::new();
let depth_cap = 2usize;
let mut depth = 0usize;
let mut layer_remaining = 1usize; // seed is the only node at depth 0
while layer_remaining > 0 && depth <= depth_cap {
    if let Some(node) = bfs.next(&graph) {
        reached.insert(node.index());
    } else {
        break;
    }
    layer_remaining -= 1;
    if layer_remaining == 0 {
        depth += 1;
        layer_remaining = if depth <= depth_cap { bfs.stack.len() } else { 0 };
    }
}
```
This works for a pure depth cap (only needs to stop ITERATION, never needs to
retroactively un-expand) but cannot ALSO express a halt predicate the way the
Control version does -- see the naive-halt trap above.

**H6 -- Reversed<G> over DiGraph and StableDiGraph, both pass
(`src/bin/h6_reversed.rs::digraph_small`):**
```rust
let mut dfs = Dfs::new(Reversed(&graph), c);
let mut visited = Vec::new();
while let Some(node) = dfs.next(Reversed(&graph)) {
    visited.push(node.index());
}
// visited == [2, 1, 0], confirmed by running
```
Identical pattern against `StableDiGraph` also passes with the same result.

## 5. Versions and environment

- petgraph `=0.8.3` (pinned in `Cargo.toml`), vendored source read directly at
  `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/petgraph-0.8.3/`.
- `rustc 1.97.0-nightly (9eb3be26b 2026-05-18)`, `cargo 1.97.0-nightly
  (4d1f98451 2026-05-15)`.
- macOS (Darwin 23.6.0), 12 cores, 16GB physical memory, default `ulimit -s` =
  8176 KB (confirmed via `ulimit -s` at test time).
- Every timing/memory number above is a `--release` build
  (`opt-level = 3, debug = false`); `cargo build --release` and `cargo test
  --release` both confirmed green over the whole crate (excluding the
  intentionally-non-compiling negative examples, which are excluded from
  Cargo's target discovery via `autoexamples = false` and compiled standalone
  with `rustc` instead).
- Peak RSS measured with `/usr/bin/time -l` (macOS "peak memory footprint"
  line) as the authoritative source; each binary also self-reports via
  `getrusage(RUSAGE_SELF, ...)` as a cross-check (`self_peak_rss_bytes` in
  `src/lib.rs`) -- the two agreed within a few percent on every run.

## 6. What I could not test, and why

- **Bulk `add_edge` at 10,000,000 edges: not run.** The 1,000,000-edge point
  alone took 120.4 seconds and the doubling series already showed an
  unambiguous ~4x-per-doubling trend by 64,000 edges. Extrapolating the same
  curve to 10M lands somewhere in the hour range for zero new information
  about whether the growth is quadratic -- already settled.
- **`petgraph::algo::condensation` was read from source, not benchmarked at
  sprefa's real 283,127-node/261,704-edge scale.** It takes `petgraph::Graph`
  by VALUE, not `Csr`. Benchmarking it honestly would require first measuring
  the cost of building sprefa's whole graph as a `petgraph::Graph` instead of
  a `Csr` -- a distinct hypothesis this lab was not asked to run (H3 only
  compared `Csr` against `Vec<Vec<u32>>`). Reported as untested in the
  replacement table rather than guessed at.
- **100,000,000-edge or larger graphs: never attempted, by design.** The task
  brief fixed a hard 10,000,000-edge ceiling after a prior run's 100M-edge
  attempt swapped the machine. All H3/H6/H8 numbers at "10M" are the largest
  actually built; the 130M-edge, 500-repo target figure quoted in H3 is a
  straight-line extrapolation from the measured 1M/10M curve, explicitly
  labeled as such, not a measurement.
- **H1's exact crash N for the default stack was binary-searched to a single
  node** (`74528` ok / `74529` crash) but **H7's Control-based crash bracket
  was only narrowed to a band of ~145 nodes** (`43418` ok / `43563` crash) --
  narrower than needed to make the point (petgraph's `Control` path needs
  meaningfully more stack per node than `tarjan_scc`'s own recursion), so the
  search was not pushed to single-node precision there; reported honestly as
  a bracket, not a point.
- **No test in this lab exceeded roughly 425MB peak RSS** (the 10M-edge
  `Vec<Vec<u32>>` build, H3) or ran longer than the 120.4-second `add_edge`
  point above; the 2GB memory ceiling from the task brief was never
  approached, so nothing was skipped purely for hitting that budget -- the
  skips above are all "would take a long time for no new evidence" or
  "requires a different, unasked-for benchmark," not memory-driven.
