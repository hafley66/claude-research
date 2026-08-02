---
description: ultragraph is a dual-CSR directed-graph crate with a real transposed index and iterative SCC, rejected because freeze() peaks at 1.85x final size, which puts the 130M-edge target past this machine's memory
argument-hint: [section]
---

# ultragraph

**Verdict: rejected for the sprefa v6 graph layer.**

If you read nothing past this paragraph: ultragraph builds a correct,
reasonably fast dual compressed-sparse-row graph, but the way it gets there
(`DynamicGraph::freeze() -> CsmGraph`) holds the old adjacency lists and the
new compressed arrays in memory at the same time. Measured peak RSS during
that step is 1.85x the graph's final size, stable at both scales tested
(166MB at 1M edges, 1,641MB at 10M edges). Carried linearly to the
500-repository target of 130M edges, that is roughly 21GB of peak memory on
a machine that has 16GB total. That single number is disqualifying on its
own, independent of everything else in this document.

Everything below explains what the crate does well, what it is missing, why
the memory result generalizes past this one crate, and what it would cost to
adopt anyway.

## The freeze() mechanism, and why it generalizes

`ultragraph::DynamicGraph<N, W>` stores edges as an adjacency list: one
`Vec<(usize, W)>` per source node. `CsmGraph<N, W>`, the frozen form, stores
two compressed-sparse-row structures side by side: `forward_edges` and
`backward_edges`, each an `{offsets, targets, weights}` triple of flat
`Vec`s. Turning one into the other is `freeze()`, and reading its source
shows exactly what happens: before it touches a single old edge, it
allocates `fwd_targets`, `fwd_weights`, `back_targets`, and `back_weights` at
their FULL final size (`vec![0; total_edges]`, `vec![W::default();
total_edges]`, four times). Only after those four vectors exist does it walk
the old adjacency lists and copy edges into them. The old `DynamicGraph` is
consumed by value, so its memory is technically reclaimable as the walk
proceeds, but the four new vectors are already fully sized before that
reclaiming can happen. For one brief window, both representations of the
whole graph are live at once.

That is exactly what the measurement shows. A `DynamicGraph` built from 10M
edges and never frozen peaks at 889MB. The same graph, frozen, peaks at
1,641MB, a factor of 1.85. At 1M edges the same ratio holds: 90MB unfrozen,
166MB frozen. The ratio being stable across a 10x range in graph size is
what makes the extrapolation to 130M edges trustworthy as an order of
magnitude, even though it was never built and measured directly: roughly
21GB of peak RSS, on a 16GB machine, just to get the graph into its final
form once.

The reason this is worth writing down as a general finding, not just a
ultragraph complaint, is that it is structural to any "build a mutable
structure, then compress it" design. Whenever a library gives you a
convenient builder type and a separate, faster query type, and the
conversion between them is a real data transformation rather than a
reinterpretation, that conversion has to hold both shapes in memory at once
for at least a moment. The size of that moment scales with the graph, not
with some fixed overhead, so it does not shrink relative to the final graph
as the graph grows. Any library shaped like ultragraph's `Dynamic -> Static`
split will show the same curve.

The way out skips the intermediate representation entirely rather than
optimizing the freeze: fill the compressed structure directly from a
stream of edges that is already in the order the compressed structure wants
them, most simply a stream sorted by source node. Since sprefa's edges live
in SQLite, `SELECT source, target, kind FROM edge ORDER BY source, target`
produces exactly that stream, and it is also the input shape
`petgraph::Csr::from_sorted_edges` asks for directly. Streaming construction
turns the freeze step from "hold two representations, one of them full size,
at once" into "hold one growing array and one small pointer into the
source," which does not have a 1.85x moment because there is no second
full-size representation to hold.

## What it gets right

None of this is a case against CSR-shaped graphs in general, and it would be
unfair to let the memory result overshadow what the crate does correctly.

The dual-CSR claim in ultragraph's own naming is real, not marketing. `CsmGraph`
genuinely stores two independent CSR structures, one forward and one
backward, both built in the same `freeze()` pass. `inbound_edges` reads from
the backward one, and it is a true transposed index, not a scan over every
edge in the graph looking for matches. That distinction is not just a source
read; it was proven at the timing level. At 10M edges, calling
`inbound_edges` on a node with in-degree 0, two million times in a row, took
0.0ms in total. An O(edge-count) scan repeated two million times over a
10M-edge graph is not a thing that finishes in 0.0ms; the only explanation
consistent with that number is that the cost of the call tracks the
requested node's degree, which is what a real index looks like. That same
zero-cost-when-empty behavior is the strongest single piece of evidence in
this whole evaluation, because it rules out the failure mode directly rather
than arguing from the source code alone.

Its strongly-connected-components implementation is also genuinely
iterative, not recursive with a deep-graph landmine waiting in it. Reading
the source shows Tarjan's algorithm run as an explicit state machine over a
heap-allocated stack of `(node, remaining-neighbor-iterator)` pairs, with a
comment in the code that says as much: "Simulate recursion." Fed a
1,000,000-node graph shaped as one long chain, the worst case for a
recursive implementation, it finished in 34.2 milliseconds using 160MB of
peak memory, and returned the correct answer (1,000,000 separate
single-node components, since a path graph has no cycles). For comparison,
petgraph's `tarjan_scc` on the same shape of input needs on the order of
100 to 115MB of thread stack space (a figure carried over from outside this
lab, not independently reproduced here), which risks the default 8MB
stack on most platforms well before reaching that depth unless the caller
raises it. ultragraph sidesteps that risk entirely by not recursing, and
that is a real, specific advantage worth crediting precisely rather than
waving at generally.

## What is missing: everything past the edge iterator

Past those two primitives, `outbound_edges` and `inbound_edges`, the
traversal surface of this crate is empty. There is no BFS, no DFS, no
callback-driven walk, no way to stop expansion at a marked node while still
recording that the node was reached, and no way to cap how many hops a walk
is allowed to take. A search of the entire source tree for anything related
to condensation, transitive closure, ancestor sets, or descendant sets comes
back with one hit, a single word used in a doc comment, not a function.

This matters concretely for the workload sprefa needs, because the single
most important operation in that workload is exactly the kind the crate does
not provide: walk forward from a set of seed nodes, record every node you
reach, but stop expanding out of any node marked as a port, while still
recording that port as reached. That halt-and-record behavior is different
from filtering a node out of the walk entirely; a filtered node is invisible,
while a halted node is a visible, reported stopping point. ultragraph has no
primitive that expresses this, so it has to be written by hand on top of
`outbound_edges`, exactly the same shape of code that already exists in
sprefa's own `walk.rs` today.

That hand-written version was built and measured against a hand-rolled raw
array walk with no crate in the loop at all, to put a number on what routing
through `outbound_edges`'s trait-object iterator actually costs versus
indexing a plain slice directly. On a graph with a real giant connected
component (500,000 of 500,000 nodes reached from 20 seeds), the version
built on `outbound_edges` ran at 8,783 nodes per millisecond against 11,592
nodes per millisecond for the raw array, a 1.32x tax. On the graph shape
that actually matches sprefa's real node-to-edge ratio, where far fewer
nodes were reachable at all from the seeds tried, the tax measured smaller,
1.04x, but that number carries less weight because it was measured over only
2,627 reached nodes rather than half a million. Either way, adopting
ultragraph here buys nothing: the halt-and-record logic has to be written by
hand regardless of which library sits underneath it, and doing so on top of
ultragraph's iterator costs somewhere between 4% and 32% more than doing the
identical thing over a plain array.

## Bus factor, stated plainly

Whatever the technical merits, this is a crate maintained by one person as
part of a different project, and a reader deciding whether to depend on it
needs that stated without softening.

`ultragraph` lives inside `deepcausality-rs/deep_causality`, a
causality-reasoning framework, as a subdirectory, not as its own repository.
Pulling the contributor list from GitHub shows one account, `marvin-hansen`,
with 4,193 commits; two automated accounts (`dependabot[bot]`,
`github-actions[bot]`) with 102 and 44; and three human accounts each with
exactly one commit. That describes a maintained-by-one-person project with a
few drive-by contributions on top.
crates.io reports 45,718 total downloads for this crate, against
434,390,117 for petgraph, a difference of roughly 9,500x. The release
history has two multi-month dead periods, ten months between January and
November 2024 and seven months between November 2024 and June 2025, before
the crate picked up a near-monthly cadence starting mid-2025, which appears
to line up with a rewrite (the version numbers jump from the 0.5.x series
straight to 0.8.0 around that point, and 0.8.0 is plausibly when the CSR
design tested in this lab was introduced). None of this is disqualifying by
itself in the way the memory result is, but it means depending on this crate
means depending on one person's continued attention, on a piece of a
project whose primary purpose is not graph algorithms.

## Net verdict against the six-function baseline

sprefa's current graph code is `tarjan`, `build_condensed`, `count_pairs`,
`reaches_from`, `reached_by` in `scc.rs`, and `multi_source_walk` /
`multi_source_halt_bfs` in `walk.rs`. Measured against those six:

| function | ultragraph's answer |
|---|---|
| `tarjan` | Replaced outright by `strongly_connected_components()`. Same algorithm shape (an explicit heap stack simulating recursion), a different output shape (a list of member-lists rather than a component-id array), which is a trivial remap. |
| `build_condensed` | Only the SCC partition is replaced. The condensed DAG in both directions, the per-component cyclic flag, and the member index still have to be built by hand from that partition, same as today. |
| `count_pairs` | Not replaced. No condensation, transitive closure, or reachable-pair counting exists in the crate in any form. |
| `reaches_from` | Not replaced as a batch operation; `is_reachable` only answers single-pair questions, and asking it once per node would cost far more than one BFS. The forward walk underneath it still has to be hand-written, same as today. |
| `reached_by` | The one place ultragraph earns a real, if modest, win: sprefa's own code has no reverse adjacency over the raw graph today (only over the small condensed DAG), and `inbound_edges` provides one for free as a side effect of `freeze()`. The walk logic on top of it still has to be hand-written. |
| `multi_source_walk` / `multi_source_halt_bfs` | Not replaced. No halt predicate or depth cap exists anywhere in the crate; both have to be hand-written over `outbound_edges`, at a measured 1.04x-1.32x cost over doing the identical walk on a raw array. |

Read plainly: one function replaced outright, one given a modest assist, and
four left exactly where they are today, now paying a small tax to route
through the crate's iterator instead of a plain slice. Combined with the
freeze() memory ceiling, that is not enough to justify the dependency, the
bus-factor risk, or the loss of direct control over the memory layout.

## Further detail

- [evidence.md](evidence.md): the full hypothesis-by-hypothesis table,
  traps quoted verbatim, working code from passing tests, environment
  details, and what was not tested and why.
