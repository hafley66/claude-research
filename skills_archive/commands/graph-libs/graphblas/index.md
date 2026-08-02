---
description: SuiteSparse:GraphBLAS via Rust bindings for the sprefa graph layer. The linear-algebra formulation genuinely solves the halt-predicate problem no other library tested has solved, but the only working binding is CC-BY-NC-4.0, a real blocker for a commercial tool. Verified empirically 2026-07-19.
argument-hint: [section]
---

# SuiteSparse:GraphBLAS (via `graphblas_sparse_linear_algebra` 0.63.1)

## Verdict

GraphBLAS is the first library evaluated for sprefa's graph layer that actually solves the
halt-predicate problem, on purpose, as a structural consequence of how it expresses
traversal, not as a workaround. petgraph's `Control::Prune` gets the semantics right but
recurses and crashes around node 43,500. ultragraph has no traversal primitives past a raw
edge iterator at all. GraphBLAS expresses "reach a node, report it, do not expand through
it" as one masked vector operation, with no recursion and no stack of any kind involved, and
that expression was proven correct on a hand-built graph where the naive answer and the
correct answer differ (`{1,2,3}` versus `{1,2}`, detail in [masks.md](masks.md)).

That capability is real. Adopting it is not currently a clean decision, for one reason that
has nothing to do with the algorithm: **the only Rust binding that actually builds and runs,
`graphblas_sparse_linear_algebra` 0.63.1 (and the `suitesparse_graphblas_sys` 0.4.4 crate
underneath it), is licensed CC-BY-NC-4.0 -- Creative Commons NonCommercial.** Every operation
this document describes was run against that binding. If sprefa is or becomes a commercial
product, that license is a real blocker on this specific dependency, full stop, independent
of whether the code works or the numbers are good. Full precision on exactly what is and is
not restricted, and what it would cost to route around it, is in
[licensing.md](licensing.md) -- read that before anyone acts on the capability findings
below.

Three more things worth knowing before the detail: a trap in this crate's `assign`/
`subassign` operations silently deletes data instead of merging it, which is the kind of bug
that produces a confidently wrong answer rather than a crash ([masks.md](masks.md)); using
GraphBLAS's transpose descriptor turned out to be dramatically faster than materializing the
transpose once and reusing it, a genuinely counterintuitive result reported honestly as not
fully explained ([masks.md](masks.md)); and SCC has no answer at all through this binding,
because LAGraph is not linked into it ([build-cost.md](build-cost.md) covers what building
it costs; this page's six-function table below covers what it means for sprefa's code).

## Why the halt predicate falls out of the math, not a special case

Every prior library evaluated treats "stop expanding past this node" as a traversal-shaped
problem: a callback, a `Control` enum, a check inside a loop body. GraphBLAS treats a BFS
step as a single algebraic operation, `next_frontier = frontier * adjacency_matrix` over a
boolean semiring, and a mask is just a second vector multiplied elementwise against that
operation's output or input before it is allowed to take effect. Filtering the frontier by
"not halted" before the next multiply uses the exact same masking mechanism GraphBLAS
already uses for every other masked operation in the library, applied to one more vector,
with no separate code path for "halt-aware BFS" versus "BFS" the way there would be in a
hand-written walker. The correctness proof and
the exact operation sequence are in [masks.md](masks.md); the short version is that the
naive walk reaches `{1,2,3}` on a four-node chain with node 2 marked halted, and the
mask-filtered walk reaches `{1,2}`, both asserted against known answers and against each
other, with node 2 correctly recorded as reached without ever becoming a source of further
expansion. No stack, no recursion, no depth limit imposed by a call frame: the entire walk
is a fixed number of matrix operations, each one flat, each one over the whole frontier at
once.

## The six baseline functions

Read `src/graph/scc.rs` (`tarjan`, `build_condensed`, `count_pairs`, `reaches_from`,
`reached_by`) and `walk.rs` (`multi_source_walk`, with `multi_source_halt_bfs` as a thin
wrapper). Full detail and measured numbers for the "yes" rows are in
[masks.md](masks.md); what "no" means concretely is in [build-cost.md](build-cost.md).

| function | GraphBLAS replaces it? | how |
|---|---|---|
| `tarjan` (iterative SCC) | No, not through this binding at all | `LAGraph_scc` exists in the C library's experimental LAGraphX extensions, but neither `graphblas_sparse_linear_algebra` nor `suitesparse_graphblas_sys` links or exposes LAGraph in any form. A grep for `lagraph` across both crates' full source returns zero matches. |
| `build_condensed` (SCC quotient graph) | No, same reason | Depends on SCC, which is unavailable. |
| `count_pairs` (reachable pair count via the condensation, avoiding O(V^2) storage) | No | GraphBLAS's own idiom for this shape of question is repeated `mxm` on the boolean semiring, which computes the full reachable-pair MATRIX directly rather than a count derived from a condensation. That is exactly the O(V^2) worst case sprefa's condensation trick exists to dodge, and it was not attempted at any nontrivial scale for that reason (see [build-cost.md](build-cost.md)). |
| `reaches_from` (forward reach from a seed set) | Yes | Masked-mxv BFS to fixpoint. Exact match on a 12-node hand graph; 125.1ms at 10,000,000 edges for one query. |
| `reached_by` (reverse reach into a target set) | Yes | Same masked-mxv loop, using the matrix-transpose descriptor instead of building a second matrix. Correctness proven on a graph where forward and backward answers provably differ (`{0,1,2}` versus `{0,1,2,3}`). |
| `multi_source_walk` / `multi_source_halt_bfs` (multi-tag, depth-carrying, halt-aware BFS) | Yes, and this is the strongest result in the lab | Multi-source stepping becomes ONE matrix-matrix multiply (`mxm`) per hop across every seed at once, instead of one BFS per tag; the halt predicate is the masked-apply frontier filter described above. Depth caps are just an iteration-count cap on the outer loop. Two disjoint 4-node chains proven not to cross-contaminate; 8 sources over 10,000,000 edges, unbounded, in 1.012 seconds. |

## Hypothesis results

Full working code and traps for every row are in [masks.md](masks.md) (H1-H6) and
[build-cost.md](build-cost.md) (H0, H9, H11); the licensing rows (H10, plus the pathrex
alternative referenced by H7/H8) are in [licensing.md](licensing.md).

| # | question | verdict | headline number |
|---|---|---|---|
| H0 | Does it build at all | Yes, with two required workarounds | ~137 seconds clean build, two infra traps fixed by hand |
| H1 | Memory per edge | Confirmed, roughly 7-8x a raw CSR baseline | 57.1 bytes/edge at 10,000,000 edges (whole-process RSS) versus petgraph's ~8 bytes/edge ideal |
| H2 | BFS as masked matrix-vector multiply | Confirmed, exact match | 125.1ms at 10,000,000 edges |
| H3 | Halt predicate via a complement mask | **Confirmed, decisive** | `{1,2,3}` naive versus `{1,2}` halt-aware, asserted unequal and each correct |
| H4 | Depth-capped multi-source BFS as matrix-matrix multiply | Confirmed, no cross-source contamination | 8 sources, 10,000,000 edges, unbounded: 1.012s |
| H5 | Reachability both directions, transpose cost | Confirmed correct; performance result unexplained | descriptor path 23x faster than materialize-and-reuse at 10,000,000 edges |
| H6 | SCC | Absent from this binding | LAGraph unlinked; sprefa's own Tarjan does 1,000,000 path nodes in 14.6ms as a reference point |
| H7/H8 | LAGraph / RPQ via `pathrex` | Different crate, different author, MIT, not built here | see [licensing.md](licensing.md) |
| H9 | Binding risk | Single author, thin shim | 767 occurrences of `unsafe` across 24,841 lines; every operator's `.apply()` is one `unsafe` FFI call |
| H10 | License | **CC-BY-NC-4.0 on the only working binding** | see [licensing.md](licensing.md) -- this is the decision-critical finding |
| H11 | Build and distribution cost | Concrete and recurring | live git clone during every clean build; see [build-cost.md](build-cost.md) |

## What could not be tested, and why

- **Above 10,000,000 edges, at any point.** The lab's memory budget forbids it (an earlier,
  unrelated run at 100,000,000 edges swapped the machine). Every number quoted anywhere in
  this writeup for sprefa's actual target scale (roughly 130,000,000 edges) is a linear
  extrapolation from the 1M/10M points measured here, not a direct measurement.
- **Full transitive closure at any scale worth reporting.** Worst-case output is O(V^2);
  running it at 10,000,000 edges risked an output matrix denser than the memory budget, for
  a result sprefa's own condensation-counting trick exists specifically to avoid needing.
- **`pathrex`/`pathrex-sys` built and run.** It is MIT-licensed and LAGraph-capable, which
  would have turned H6/H7/H8 into running code instead of research. Building it means a
  second from-scratch vendored GraphBLAS C compile on top of the roughly 2.3 minutes already
  spent on the first, for a crate that is 0.1.0 with 1 GitHub star and 9 open issues.
  Reported from its public repository metadata and file listing instead of a build.
- **Root-causing the H5 transpose-descriptor speed result.** The numbers are real and the
  correctness cross-check passed, but WHY the freshly-materialized transpose is so much
  slower under repeated multiplication was not isolated within this lab's time budget. See
  [masks.md](masks.md) for the honest accounting and what would need measuring next.
- **Whether GraphBLAS's JIT compiler fires at runtime for an operator this lab never used.**
  No JIT cache directory appeared during any run here. Whether an uncommon operator/type
  pairing in production would trigger an on-the-fly `cc` invocation was not exercised.

## Environment

macOS 14.6.1 (23G93), arm64, 16GB RAM. rustc 1.97.0-nightly (9eb3be26b 2026-05-18), cargo
1.97.0-nightly (4d1f98451 2026-05-15). `graphblas_sparse_linear_algebra` 0.63.1,
`suitesparse_graphblas_sys` 0.4.4, vendoring SuiteSparse:GraphBLAS commit
`1fd54756ca57cae44e8cf91137ba5107824e8e7b` (tag `v10.3.1`). Every number above came from
`cargo build --release -j 4`; peak RSS measured with `/usr/bin/time -l`.

Lab crate, with a re-run command for every number in this writeup:
`~/projects/claude-research/labs/graph-graphblas/` (see its own `README.md`).

## Further detail

- [masks.md](masks.md): the H3 mask proof in full, the `GrB_Vector_assign` silent-delete
  trap, and the H5 transpose-descriptor surprise, all with working code and exact output.
- [licensing.md](licensing.md): the full four-part licensing answer -- which crates carry
  the NonCommercial restriction, the C library's own license read at the exact vendored
  commit, the `pathrex` alternative's license and real API surface, and the size of a
  from-scratch minimal binding.
- [build-cost.md](build-cost.md): the full H0 build story with both infra traps quoted
  verbatim, the H11 distribution-cost accounting, and the H9 binding-risk numbers.
