---
description: petgraph 0.8.3 for the sprefa graph layer. Csr storage is genuinely good; none of the six baseline algorithms ports over cleanly, and the one that is stack-safe will not compile against Csr at all.
argument-hint: [section]
---

# petgraph 0.8.3

## Verdict

Adopt `petgraph::csr::Csr` as sprefa's edge storage. It uses roughly half the
memory of a `Vec<Vec<u32>>` adjacency list at every scale measured, and builds
in milliseconds from a pre-sorted edge stream, which is exactly the shape a
`SELECT ... ORDER BY source, target` query already produces.

Do not adopt petgraph's traversal or SCC algorithms as a replacement for
`scc.rs` or `walk.rs`. None of the six baseline functions ports over cleanly.
Worse, the one SCC algorithm that is actually safe on deep graphs
(`kosaraju_scc`) refuses to compile against the very representation
(`Csr`) you would want to store the graph in. The algorithm that does
compile against `Csr` (`tarjan_scc`) is recursive and crashes on a chain far
shallower than sprefa's real data already contains.

Everything below explains why, with the exact commands to reproduce every
number in `~/projects/claude-research/labs/graph-petgraph/README.md`.

## Why: the Csr trap

`Csr` is petgraph's compressed-sparse-row graph. It is the representation you
want for memory (see [memory.md](memory.md) for the numbers), and it is
also the representation with the narrowest set of traits implemented on it.
Concretely, `Csr` implements `IntoNeighbors` (forward edges only) but never
`IntoNeighborsDirected` (forward or backward, your choice, on demand).

That single missing trait blocks two things at once, for the same underlying
reason:

- `Reversed(&csr)`, petgraph's edge-reversing adaptor, requires
  `IntoNeighborsDirected` on the wrapped graph. It will not compile:

  ```
  error[E0277]: the trait bound `Csr: IntoNeighborsDirected` is not satisfied
     --> examples/h6_reversed_csr_fail.rs:18:48
      |
   18 |     while let Some(_node) = dfs.next(Reversed(&csr)) {}
      |                                 ----           ^^^ the trait `IntoNeighborsDirected` is not implemented for `Csr`
  ```

- `kosaraju_scc`, petgraph's iterative, stack-safe SCC algorithm, ALSO
  requires `IntoNeighborsDirected` internally (it needs a reversed pass
  before its forward pass). It will not compile against a `Csr` either:

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

`tarjan_scc`, by contrast, needs only `IntoNeighbors` plus two bookkeeping
traits `Csr` already has, so it compiles and runs fine against a `Csr`.
Confirmed by actually running it:

  ```
  scc_count=1 sccs=[[2, 1, 0]]
  ```

Put the two facts together and the choice a user of this crate is actually
forced into becomes plain: build the graph as `Csr` and get the fast,
compact representation, but be stuck with the recursive SCC algorithm that
will eventually crash the process on a deep enough graph; or build the graph
as `petgraph::Graph` (or `StableGraph`) instead, which supports
`IntoNeighborsDirected` and unlocks the safe algorithm, but gives up the
memory and construction-speed advantage that was the reason to reach for
`Csr` in the first place. Nobody who reads petgraph's docs top to bottom
would predict this from the API surface. It only shows up when you actually
try to compile the combination you want, which is exactly why this lab
treats "does it compile against the representation I actually chose" as a
first-class question, not an afterthought. Full detail on the recursion
itself, including exact crash thresholds, is in
[stack-safety.md](stack-safety.md).

## Why: the depth_first_search + Control result is the dangerous kind

`visit::Control::Prune`, driven through `depth_first_search`, is the correct
mechanism for sprefa's halt-predicate requirement: reach a node, report it,
and stop expanding past it without touching its siblings. This was proven
exactly, on a hand-built 12-node graph, and the semantics match
`multi_source_halt_bfs` node for node (full proof in
[traversal.md](traversal.md)).

The danger is that this correctness is exactly what makes the finding worth
writing down. A developer reads the API, writes a small test with a dozen
nodes, watches it pass, and ships it. The bug waiting behind that pass is a
stack depth bug, and it only appears once the graph has enough chained depth
to matter. For sprefa, that depth shows up in production data; a small test
suite will never reach it.

The underlying `dfs_visitor` function backing `depth_first_search` is
recursive (source, not docs: `petgraph-0.8.3/src/visit/dfsvisit.rs:241-301`,
the same shape of self-call as `tarjan_scc`'s). It crashes on the exact same
kind of long, thin dependency chain that `tarjan_scc` crashes on, and it
crashes SOONER: on a default 8176KB stack, the bracket where it starts to
fail is between node count 43,418 (survives) and 43,563 (crashes), against
`tarjan_scc`'s own bracket of 74,528 (survives) and 74,529 (crashes) on the
identical graph shape. Per-node stack cost works out to roughly 192.6 bytes
for the `Control`-driven traversal against roughly 112.3 bytes for
`tarjan_scc`, about 1.7 times heavier, because the visitor closure carries
extra state (a depth-tracking map, a pending-child-depth slot) on top of the
same recursive machinery petgraph already uses internally for
`depth_first_search`. At sprefa's assumed worst-case depth of 1,000,000
nodes, the `Control`-driven traversal needs a stack somewhere between 180MB
(confirmed crash) and 220MB (confirmed survives), more than double
`tarjan_scc`'s own 100 to 115MB bracket at the same depth.

GitHub issue [#727](https://github.com/petgraph/petgraph/issues/727),
"Non-recursive DFS", opened 2025-02-03 and still open as this was written,
confirms this generalizes past a single careless caller: a maintainer with
direct access to the source made the same mistake, in public, on the
project's own issue tracker. A reporter flags `depth_first_search` as
recursive. A maintainer's first reply pushes back, quoting the `Dfs`
struct's own doc comment: `"Dfs is not
recursive"`. That doc comment is true. It refers to the OTHER dfs, the
`Dfs`/`DfsPostOrder` walker family used by `kosaraju_scc`, which really is
iterative. Only after the reporter points at the specific line,
`dfsvisit.rs:241`, does the maintainer recognize that a second, recursive
depth-first traversal exists in the same crate. The thread ends without a
fix; the issue is still open. If a maintainer with source access can lose
track of which of two same-named-in-spirit traversal functions is recursive,
a downstream user reading only the public docs has no realistic chance of
catching this before it ships.

## Why: put the crash thresholds against the real workload

Both crash thresholds measured above are numbers in isolation until they are
set against what sprefa actually has to process. From the live database, one
repository, today: 283,127 dataflow nodes and 261,704 edges across 506
files. `tarjan_scc` starts crashing past roughly 74,500 nodes of chain depth
on a default stack. `depth_first_search` via `Control` starts crashing past
roughly 43,500. Both thresholds sit at well under a third of a single
repository's node count, and sprefa's own worst-case assumption for path
depth is 1,000,000, nearly 3.8 times the crash threshold measured for
`tarjan_scc` and over 13 times the threshold for the `Control`-driven walk.

The practical consequence: neither algorithm can be handed sprefa's real
data on a default thread stack and be expected to survive. Either would need
a dedicated worker thread carrying a stack sized in the hundreds of
megabytes, sized ahead of time for a depth the caller may not know in
advance, chosen wrong once and the process aborts with no panic to catch,
just `fatal runtime error: stack overflow, aborting`. sprefa's own iterative
`tarjan` in `scc.rs` and its own hand-rolled BFS in `walk.rs` never have this
problem, by construction, at any depth, on any stack. That is the actual
value being given up if either petgraph algorithm were adopted in place of
the existing code.

## The six baseline functions, honestly

None of the six functions in `scc.rs` and `walk.rs` is cleanly replaceable by
something in petgraph 0.8.3. Two are close enough to be worth naming
precisely; the other four are not close at all.

| function | petgraph replaces it? | how close |
|---|---|---|
| `tarjan` (iterative SCC) | no | `tarjan_scc` compiles against `Csr` but is recursive and crashes below sprefa's real depth (see above); `kosaraju_scc` is iterative and matches `tarjan_scc`'s ordering exactly on a tested cyclic graph, but will not compile against `Csr` at all. Neither option is both safe and usable on the chosen representation. |
| `build_condensed` (SCC quotient graph) | partial | `algo::condensation` exists, is built on the iterative `kosaraju_scc` internally, and returns member lists per component, which is most of what `build_condensed` computes. It takes a `petgraph::Graph` by value, not a `Csr`, so using it means first building the graph in a different, unmeasured representation. It also does not compute the `cyclic` flag or component sizes for you; those are cheap to derive afterward. This is the closest of the six to usable, conditioned on accepting the representation change. |
| `count_pairs` (reachable pair counting) | no | Nothing in petgraph counts reachable pairs. `toposort` orders nodes and detects cycles; it does not count anything. |
| `reaches_from` / `reached_by` (condensed-graph reachability) | partial, same condition as `build_condensed` | `Bfs` is a reasonable stand-in for the small BFS over the condensed graph, once that graph already exists as a `petgraph::Graph`. No measured advantage either way; it is the same loop shape against different storage. |
| `multi_source_walk` (multi-tag depth-carrying halt BFS) | no | See [traversal.md](traversal.md) for the full argument: petgraph's `Bfs` walker expands a node's neighbors before handing that node back to the caller, so a halt check on the returned value is always one step too late. The only correct construction rewrites the walker's internals under petgraph's field names, and even then petgraph has no equivalent of sprefa's per-tag visited-generation reset, which resets in constant time between tags instead of clearing a shared bitmap. |
| `multi_source_halt_bfs` (thin wrapper over the above) | no, same reasons | -- |

If a project is willing to give up `Csr` for the SCC-and-condensation half of
the workload specifically, `kosaraju_scc` plus `algo::condensation` cover
`tarjan`, most of `build_condensed`, and the small BFS behind
`reaches_from`/`reached_by` reasonably well, all iteratively and safely.
Nothing in petgraph reaches the two `walk.rs` functions at all. The halt
predicate they implement has no equivalent anywhere in petgraph's public
surface, in any form that survives contact with a real
halt-past-this-node requirement.

## Hypothesis table

Full detail, working code, and every trap for each row lives in
[stack-safety.md](stack-safety.md), [memory.md](memory.md), and
[traversal.md](traversal.md). Summary:

| # | hypothesis | verdict | headline number |
|---|---|---|---|
| H1 | `tarjan_scc` is recursive, crashes on deep chains | CONFIRMED | crash bracket 74,528 (ok) / 74,529 (crash) on default stack; needs 100 to 115MB of dedicated stack at N=1,000,000 |
| H2 | `kosaraju_scc` is iterative, survives, matches `tarjan_scc`'s ordering | CONFIRMED, with a hard caveat | survives N=1,000,000 in 22ms / 61.6 to 74.6MB peak RSS; will not compile against `Csr` |
| H3 | `Csr` versus `Vec<Vec<u32>>` memory and speed | CONFIRMED | at 10M edges: `Csr` 17.4 bytes/edge, `Vec<Vec<u32>>` 42.5 bytes/edge |
| H4 | `Csr::from_sorted_edges` constraints | CONFIRMED | bulk `add_edge` at 1M edges: 120.4 seconds; `from_sorted_edges` on the same data: 6ms |
| H5 | `visit::Control::Prune` semantics | CONFIRMED, decisive for sprefa | exact-set match on the 12-node hand-built graph |
| H6 | `Reversed<G>` over `Csr`/`DiGraph`/`StableDiGraph` | PARTIAL | works on `DiGraph`/`StableDiGraph`; does not compile on `Csr`; workaround (second transposed `Csr`) costs 273MB at 10M edges |
| H7 | depth-capped traversal, two ways | CONFIRMED, with a stack-size finding | `Control`-driven traversal crashes at a lower N (43,418/43,563) than `tarjan_scc` (74,528/74,529) |
| H8 | `NodeFiltered`/`EdgeFiltered` overhead at 10M edges | CONFIRMED near zero | measured overhead is negative on every run (noise) |
| H9 | repo health via the GitHub API | CONFIRMED | 3,965 stars, 285 open issues, issue #727 ("Non-recursive DFS") open since 2025-02-03 |

## What could not be tested, and why

- Bulk `add_edge` at 10,000,000 edges was never run. The 1,000,000-edge
  point alone took 120.4 seconds, and the doubling series already showed an
  unmistakable near-quadratic trend by 64,000 edges. A 10M run would cost on
  the order of an hour to confirm a trend that was already settled.
- `algo::condensation` was read from source, not benchmarked at sprefa's
  real 283,127-node scale. It takes a `petgraph::Graph` by value, not a
  `Csr`. A fair benchmark would first require measuring the cost of building
  sprefa's whole graph as a `petgraph::Graph`, a distinct question this lab
  was not asked to answer.
- No graph in this lab was built above 10,000,000 edges, following a fixed
  ceiling set after an earlier, unrelated run at 100,000,000 edges swapped
  the machine. The 130M-edge figure quoted for the 500-repository target in
  [memory.md](memory.md) is a straight-line extrapolation from the measured
  1M/10M curve, labeled as such, not a measurement.
- The crash bracket for `tarjan_scc` was narrowed to a single node
  (74,528/74,529). The bracket for the `Control`-driven traversal was
  narrowed only to a band of about 145 nodes (43,418/43,563), wide enough to
  make the comparison (it is meaningfully lower than `tarjan_scc`'s
  threshold) without spending more time closing a gap that does not change
  the conclusion.

## Environment

petgraph `=0.8.3`, pinned. `rustc 1.97.0-nightly (9eb3be26b 2026-05-18)`,
`cargo 1.97.0-nightly (4d1f98451 2026-05-15)`. macOS (Darwin 23.6.0), 12
cores, 16GB physical memory, default `ulimit -s` of 8176KB. Every number
above came from a `--release` build (`opt-level = 3`, `debug = false`);
`cargo build --release` and `cargo test --release` both run clean over the
lab crate. Peak RSS measured with `/usr/bin/time -l` on macOS, cross-checked
against each binary's own `getrusage(RUSAGE_SELF, ...)` read, agreeing
within a few percent on every run.

Lab crate, with a re-run command for every number in this writeup:
`~/projects/claude-research/labs/graph-petgraph/`.
