---
description: Empirical evaluation of graph libraries for large non-resident code graphs, one writeup per library
argument-hint: [library-name]
---

# /graph-libs

Empirical evaluations of graph libraries, each backed by a lab crate that was
actually built and run. Written for the sprefa v6 graph layer, useful for any
project choosing a graph representation at scale.

**Every claim in these documents comes from executed code or from reading
vendored source.** Documentation prose was explicitly rejected as evidence
during this research, after three separate capability claims taken from docs
turned out to be wrong.

## The workload these were judged against

Measured from the live sprefa database on 2026-07-19, one repository:

| quantity | value |
|---|---|
| dataflow nodes | 283,127 (one row per node, 283,127 distinct ids) |
| dataflow edges | 261,704 |
| files | 506 |
| functions | 10,805 |
| nodes per file | ~559 |

Growth is linear in code size. The 500-repository target is ~150M nodes and
~130M edges. Node ids are dense u32; edges are `(u32, u32)` plus a small kind
ordinal. Graphs are built once per `(family, revision)` and queried many
times, so an immutable snapshot is acceptable. Worst-case path depth to
assume is 1,000,000.

Machine for all measurements: 16GB. That ceiling drives several of the
verdicts and is why tests were capped at 10M edges.

## The six functions any candidate has to cover

From `sprefa/src/graph/scc.rs` (180 lines) and `walk.rs` (251 lines):

| function | what it does |
|---|---|
| `tarjan` | strongly connected components, ITERATIVE (stack-safe) |
| `build_condensed` | condensation of the SCC quotient graph |
| `count_pairs` | reachable pair counting |
| `reaches_from` | forward reachability from a seed set |
| `reached_by` | reverse reachability into a target set |
| `multi_source_walk` | depth-capped BFS from many seeds |
| `multi_source_halt_bfs` | BFS with a halt predicate: REACH nodes marked `port_in` and report them, but do NOT continue through them |

The halt predicate is the operation most libraries lack. It differs from a
node filter: a filtered node is invisible, while a halted node must be a
reachable, reported endpoint that does not propagate.

## Library writeups

> **Read [STATE.md](STATE.md) first.** A second adversarial round overturned
> this table on two of three libraries, and a third round is running against
> real data. The verdicts below are current as of 2026-07-20; STATE.md tracks
> which ones are still standing.

| library | language | verdict | doc |
|---|---|---|---|
| petgraph | Rust | **4 of 7 ops via 61 lines of trait impls** (revised, see `opus-redo.md`) | [petgraph/](petgraph/) |
| ultragraph | Rust | **rejected** (freeze peaks at 1.85x) | [ultragraph/](ultragraph/) |
| SuiteSparse:GraphBLAS | C via Rust bindings | **rejected**; `LAGraph_scc` exists and works, and costs 158.4s at depth 4,000 | [graphblas/](graphblas/) |
| **SQLite recursive CTE** | none needed | **covers 6 of 7 operations**, SCC included at 3.2s | [sqlite-native/](sqlite-native/) |
| LadybugDB (Kuzu fork) | C++ via `lbug` | docs claim out-of-core SCC, **under test** | [ladybugdb/](ladybugdb/) |
| `ext/misc/closure.c` | C | **dead code**, gated behind `SQLITE_TEST` | [sqlite-native/](sqlite-native/) |
| graphqlite | C | works, but imposes its own 14-table schema | [sqlite-native/](sqlite-native/) |
| relational patterns survey | n/a | design space + prior art | [relational-graph-patterns/](relational-graph-patterns/) |
| graph (Neo4j Labs) | Rust | queued | [neo4j-graph/](neo4j-graph/) |
| rustworkx-core | Rust | queued | [rustworkx/](rustworkx/) |
| igraph | C | queued, license-blocked | [igraph/](igraph/) |
| Boost.Graph / NetworKit / GBBS | C++ | queued | [cpp-libraries/](cpp-libraries/) |

## Standing conclusion

> **SUPERSEDED 2026-07-20.** The counts below are the first-round result. The
> adversarial round moved SQL from 4 of 7 to 6 of 7 and petgraph from 0 of 7 to
> 4 of 7. See [STATE.md](STATE.md). The paragraphs are kept because the
> mechanism they describe (a halt predicate is a `WHERE` clause on the
> recursive term) is still correct.

**Four of the seven operations need no library at all.** Hand-written
`WITH RECURSIVE` CTEs reproduce `reaches_from`, `reached_by`,
`multi_source_walk`, and `multi_source_halt_bfs` against the real 261,704-edge
table in sub-millisecond time, with zero new dependencies. The halt predicate,
the operation no in-memory library provided cleanly, is a `WHERE` clause on
the recursive term, verified against all seven of `walk.rs`'s own test cases.
The same pattern already appears in production `.dl/flow-panel.dl`.

A CTE also reproduced the engine's materialized `rel_port_reach` byte for
byte across 10 sampled ports, including a 22,601-row case.

**Three operations stay in Rust**: SCC (`tarjan`), `build_condensed`, and
`count_pairs`. Recursive CTEs cannot express SCC, and `count_pairs` needs
distinct-node counting that a depth-capped CTE gets wrong (see the trap
below).

**If an in-memory snapshot is wanted** for a hot rel queried thousands of
times, `petgraph::csr::Csr` is the storage: 17.4 bytes per edge against 42.5
for `Vec<Vec<u32>>`, built from a sorted edge stream in milliseconds. Its
algorithms do not come along; see the two petgraph traps below.

**GraphBLAS** expresses the halt predicate natively with no recursion, proven
by exact-set assertion, and remains the only compiled candidate that does. It
costs a C toolchain on every build machine plus roughly 30 FFI declarations
written in-house to avoid a NonCommercial binding. Worth revisiting only if
the CTE route hits a wall.

Everything else evaluated was rejected on measurement.

## Cross-cutting findings

Collected here as they land, because they outlive any single library choice.

### Build-then-compress doubles peak memory

`ultragraph`'s `freeze()` preallocates its compressed structures before
consuming the adjacency lists it builds from, giving a measured peak RSS of
**1.85x the final size**, stable across scales (166MB at 1M edges, 1,641MB at
10M). Extrapolated to 130M edges that is ~21GB, which does not fit a 16GB
machine.

This is structural, not an implementation defect: any design that builds
adjacency lists and then compresses them holds both representations at once.

The way out is to fill a compressed structure directly from a sorted edge
stream with no intermediate. Since these edges live in SQLite, `ORDER BY src,
dst` produces exactly that stream, which is also the input shape
`petgraph::Csr::from_sorted_edges` requires. Prefer streaming construction
over build-then-freeze.

The petgraph lab confirmed the same conclusion from the speed side:
`from_sorted_edges` took **6ms** where incremental `add_edge` took **120.4
seconds** for the same 1M edges, roughly four orders of magnitude. Streaming
construction wins on both memory and time, and both labs found it
independently.

### Recursion in a library algorithm is invisible until scale

petgraph ships **two** recursive implementations, and neither is obvious from
the API. Measured crash thresholds on a default 8MB stack:

| implementation | crashes at | stack per node |
|---|---|---|
| `algo::tarjan_scc` | N = 74,529 | 112.3 bytes |
| `visit::depth_first_search` | N ~ 43,500 | 192.6 bytes |

One sprefa repository has **283,127** dataflow nodes, which is 3.8x and 6.5x
past those thresholds. Both APIs look correct, pass every small test, and
fail only on real data.

The second one is the more dangerous find, because `depth_first_search` plus
`Control::Prune` has exactly the right SEMANTICS for a halt-predicate
traversal (proven on a 12-node graph), so it reads as the correct answer.
GitHub issue #727 records a maintainer being unaware that this second
recursive DFS existed at all.

When evaluating any graph library, grep its algorithm sources for
self-recursive calls before trusting them at scale. A doc comment saying
"recursive" is a gift; most implementations do not say.

### A library's concrete types are not its API; its traits are

petgraph's stack-safe `kosaraju_scc` requires `IntoNeighborsDirected`, which
the concrete `petgraph::csr::Csr` never implements, so it does not compile
against that type. The recursive `tarjan_scc` does compile against `Csr`.

The first round read that as "the compact representation and the safe
algorithm are mutually exclusive" and stopped at the `E0277`. The adversarial
round implemented `GraphBase`, `Data`, `IntoNeighbors`,
`IntoNeighborsDirected`, `Visitable`, `IntoNodeIdentifiers`, and
`NodeIndexable` on a custom `DualCsr` in **61 non-blank lines**, which unlocked
the whole `algo` module on a memory layout of our own choosing.

Generalize this: when a library's algorithms are generic over public traits, a
compile error against one of its concrete types says nothing about the
library's reach. Check whether the trait bounds are public and implementable
before concluding an algorithm is unavailable. This single mistake produced the
largest reversal in the arc.

Two contracts the trait impls have to honor, both undocumented:
`algo::articulation_points` panics inside `fixedbitset` if a custom
`NodeReferences` iterator uses the default `size_hint` of `(0, None)`, and
`feedback_arc_set` needs `NodeId: GraphIndex`, which the orphan rule blocks for
a bare `u32` and forces a `#[repr(transparent)]` newtype.

### A recursive CTE's dedup key decides whether it terminates

Measured on the real edge table: a reachable set of **363 nodes** converges in
**6ms** when the CTE dedups on the node alone. The same set, deduped on
`(node, depth)`, produces **12,802 rows by depth 200 and keeps growing**,
because every distinct path length to a node is a distinct row and a cycle
manufactures new ones forever.

Carrying a depth column is therefore a termination hazard on any cyclic
graph, and code graphs are cyclic. Either dedup on the node and lose the
depth, or impose a depth cap, and know which one you chose.

Related trap from the same lab: `count(*)` over a depth-capped CTE
over-counts nodes reachable by several paths (**311 rows against 291 distinct
nodes** at depth 3). Counting distinct nodes requires saying so explicitly.

### Read the LICENSE file, never the package metadata

The working Rust bindings to SuiteSparse:GraphBLAS are **CC-BY-NC-4.0**,
Creative Commons NonCommercial, while the C library they wrap is Apache-2.0.
A permissively licensed library reached through a NonCommercial binding is
still NonCommercial for the consumer.

`diff` between `graphblas_sparse_linear_algebra-0.63.1/LICENSE` and
`suitesparse_graphblas_sys-0.4.4/LICENSE` produces zero output: the same text
byte for byte. There is no permissive `-sys` layer underneath, so the
restriction reaches the raw FFI declarations.

Two further wrinkles worth generalizing:

- **License text is not stable across releases of the same project.** The
  vendored SuiteSparse:GraphBLAS v10.3.1 `LICENSE` mentions only CUDA-related
  third-party carve-outs, while the Homebrew 7.12.2 `LICENSE.txt` separately
  describes a GPLv3 MATLAB interface carve-out that does not appear in the
  vendored tree at all. Pin the version you actually build, then read that
  version's file.
- **An encumbered binding over a permissive C library is a detour rather than
  a wall.** Counting exactly the calls a real workload needed gave 27 to 30
  FFI declarations against a formally specified, stable header. Establish
  that number before treating a binding's license as disqualifying.

## Conventions every writeup follows

1. **Frontmatter** with `description` and `argument-hint`.
2. **Verdict first.** A reader who stops after the first screen should know
   whether to adopt it.
3. **A hypothesis table**: each numbered hypothesis, CONFIRMED / REFUTED /
   PARTIAL, and the measured number.
4. **The six-function replacement table** above, answered per library, with
   "cannot replace" as a legitimate answer.
5. **Traps**, with compiler, linker, or runtime errors quoted verbatim. These
   age better than any benchmark.
6. **Working code**, copied only from tests that actually passed.
7. **Environment**: crate version, rustc version, OS, release build confirmed.
8. **"What I could not test and why"**, including anything skipped for the
   memory budget. A skipped test reported honestly beats a fabricated number.

Split into multiple files under the library's folder when one document gets
unwieldy, with an `index.md` linking them.

## Related

- Lab crates with reproducible runs: `~/projects/claude-research/labs/graph-*`
- Skill files (LLM-facing, terser): `~/projects/claude-research/skills/`
- Run queue and memory budget: `~/projects/claude-research/labs/QUEUE.md`
