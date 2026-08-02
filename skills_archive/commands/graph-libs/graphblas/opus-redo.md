---
description: What the first GraphBLAS evaluation missed - LAGraph does ship SCC and it is correct, but its cost scales with graph DEPTH and dies on sprefa's 1,000,000-deep worst case; the transpose 12-23x was a benchmark artifact; the NonCommercial binding is a non-issue at 443 lines. Verified 2026-07-20.
argument-hint: [section]
---

# SuiteSparse:GraphBLAS, second evaluation

Re-run of `graphblas/` to attack what the first pass stopped short of. Lab:
`~/projects/claude-research/labs/graph-graphblas-opus/`. Every number below
came out of a binary in that crate, built `--release` and run on the machine
described in its README.

## Verdict

**Still do not adopt, for a sharper reason than the first pass had.**

The first evaluation reported "SCC is absent, LAGraph is NOT LINKED AT ALL"
and left GraphBLAS's fate resting on a licensing blocker. Both halves of that
were wrong.

1. **LAGraph ships SCC and it is correct.** `LAGraph_scc` is exported by
   `liblagraphx.dylib`, which Homebrew's `suite-sparse` 7.12.2 already
   installs. It agrees with sprefa's `tarjan` as a partition on every graph
   tested.
2. **The licensing blocker dissolves.** A from-scratch, dependency-free FFI
   shim covering GraphBLAS plus LAGraph is **443 lines and 56 declarations**
   (`src/gbsys.rs`). It took one iteration to get right. The CC-BY-NC-4.0
   crates are simply unnecessary.
3. **GraphBLAS still fails the bar, on performance.** The bar was: cover
   something the free SQL route cannot. That something is SCC.
   `LAGraph_scc`'s cost scales with the DEPTH of the condensation, and
   sprefa's stated worst case is depth 1,000,000. A 4,000-node path takes
   **158 seconds** where sprefa's iterative Tarjan takes under 0.0001s. The
   one function that would have justified a C toolchain is the one LAGraph
   does badly at exactly sprefa's worst case.

The nuance the first pass could not have reached: LAGraph's **stable**
algorithms are excellent. `LAGr_ConnectedComponents` (FastSV) does the same
1,000,000-deep path in **0.265s**, completely depth-insensitive, and beats a
hand-written union-find by 4.9x at 10M edges. The depth catastrophe is
specific to the experimental `LAGraphX` SCC, not to GraphBLAS or to LAGraph
generally. Weakly connected components is a different operation from strongly
connected components, and sprefa needs the latter.

## Hypotheses

| # | hypothesis | result | measured |
|---|---|---|---|
| H0 | LAGraph links and provides SCC | **CONFIRMED, then REFUTED on cost** | `LAGraph_scc` exported, correct on all 5 graphs; 158.4s at depth 4,000 vs tarjan <0.0001s |
| H0b | LAGraph's stable API is usable | **CONFIRMED** | `LAGr_ConnectedComponents`: 1M-deep path in 0.265s, depth-insensitive, 4.9x faster than union-find at 10M edges |
| H1 | descriptor transpose is 12-23x faster | **REFUTED** | 1.21x with materialization forced; 0.99x once A' is stored `GxB_BY_COL` |
| H2 | format control dominates memory | **REFUTED** | auto already picks the best; forcing hypersparse costs 1.85x memory for zero speed |
| H3 | masks express sprefa's operations | **PARTIAL** | halt predicate yes, exactly; edge-kind filtering **no**, structurally |
| H4 | multi-source rides free in one mxm | **CONFIRMED, with a trap** | total time FLAT from 8 to 256 sources; the descriptor form re-transposes A every step, costing 3.9x |
| H5 | a from-scratch binding is ~30 declarations | **PARTIAL** | 56 declarations, 443 lines, zero dependencies |
| H6 | the C dependency is expensive to distribute | **REFUTED for the system-library route** | 4.16s clean build against ~137s for the vendored route |

## H0. LAGraph, linked

### What is actually there

LAGraph 1.2.1, **BSD-2-Clause** (`SPDX-License-Identifier` read from
`LAGraph.h:6`), shipped by Homebrew `suite-sparse` 7.12.2 as
`liblagraph.1.2.1.dylib` and `liblagraphx.1.2.1.dylib`. The first evaluation
had this package installed and used it only to read headers.

Stable `LAGraph.h` exposes 8 algorithms: `LAGr_BreadthFirstSearch`,
`LAGr_ConnectedComponents`, `LAGr_Betweenness`, `LAGr_PageRank`,
`LAGr_PageRankGAP`, `LAGr_SingleSourceShortestPath`, `LAGr_TriangleCount`,
`LAGr_SortByDegree`. **No SCC.**

SCC lives in the experimental header, `LAGraphX.h:829`:

```c
LAGRAPHX_PUBLIC
int LAGraph_scc (
    GrB_Vector *result,     // output: array of component identifiers
    GrB_Matrix A,           // input matrix
    char *msg
) ;
```

It takes a raw `GrB_Matrix`, so it needs no `LAGraph_Graph` wrapper and
imposes no symmetry precondition. `nm -gU liblagraphx.dylib` confirms
`_LAGraph_scc`, `_LG_SCC_edge_removal`, and `_LG_SCC_trim_one` are real
exported symbols.

`LAGraphX.h` also contains `LAGraph_RegularPathQuery`, which takes an
adjacency matrix **decomposition by edge label**. That is the shape H3 lands
on independently.

### Correctness

`l0_scc` compares against `tarjan` copied verbatim from sprefa's
`src/graph/scc.rs`, as partitions rather than raw labels, since LAGraph names
a component by a representative node id and Tarjan by a counter.

```
textbook:              nodes=5      | tarjan 3 comps      | LAGraph_scc 3 comps      | agree=true
chained_cycles_1k_x10: nodes=10000  | tarjan 1000 comps   | LAGraph_scc 1000 comps   | agree=true
sprefa_shaped:         nodes=283127 | tarjan 283124 comps | LAGraph_scc 283124 comps | agree=true
path_250 .. path_4000: exact match on all five depths
```

Correct everywhere it was run. The problem is elsewhere.

### The depth catastrophe

`LAGraph_scc` is forward-backward with iterative trimming. Trimming peels
degree-0 nodes one layer at a time, so the number of rounds tracks the DEPTH
of the condensation, not the node count. A path graph is the worst case: it
peels one node per round.

Single path of N nodes, every node its own SCC:

| depth | LAGraph_scc | sprefa tarjan | ratio per doubling |
|---|---|---|---|
| 250 | 0.1222s | <0.0001s | |
| 500 | 0.5564s | <0.0001s | 4.55x |
| 1,000 | 3.2832s | <0.0001s | 5.90x |
| 2,000 | 21.8163s | <0.0001s | 6.64x |
| 4,000 | 158.3809s | <0.0001s | 7.26x |

Cost per doubling of depth sits between 4.55x and 7.26x and is rising, so the
empirical exponent runs from 2.19 to 2.86 and has not settled. Extrapolating
from 4,000 to the stated worst case of 1,000,000 is a 250x increase in depth:
at the most favourable exponent observed that is ~114 days, at the least
favourable ~36 years.

**The 1,000,000-node path did not complete.** It was started twice and killed,
once after roughly 4 minutes and once at 12 minutes of a run that had reached
only the 16,000-depth case. No number is reported for it because none was
obtained.

That size is not the whole story. Size alone is cheap:

```
sprefa_shaped: 283,127 nodes / 261,704 edges | tarjan 0.0122s | LAGraph_scc 0.1488s
```

283,127 nodes finish in 0.15s because a random sparse graph has a shallow
condensation. 10,000 nodes arranged as 1,000 chained cycles take **23.9
seconds**, because that graph is depth-1,000. Depth drives the cost, and
sprefa's brief names depth 1,000,000 as the case to assume.

### The stable API, for contrast

`LAGr_ConnectedComponents` (FastSV) is a different algorithm and behaves
completely differently. It computes WEAKLY connected components and needs a
symmetric structure, so a directed graph is symmetrized first (timed
separately).

| graph | union-find baseline | LAGr_ConnectedComponents | symmetrize |
|---|---|---|---|
| 1,000,000-deep path | 0.0168s | **0.2651s** | +0.2908s |
| sprefa_shaped (283k nodes) | 0.0080s | 0.0086s | +0.0132s |
| 10M edges / 2M nodes | 0.1715s | **0.0347s** | +0.1858s |

All three agree with union-find on the component count. The 1M-deep path that
`LAGraph_scc` cannot finish costs FastSV 0.265s. At 10M edges FastSV beats
union-find by 4.9x on the algorithm itself, though the symmetrize step gives
the end-to-end win back unless the symmetric matrix is built once and reused.

This is worth stating plainly because it narrows what the depth result means.
The depth sensitivity belongs to the experimental `LAGraphX` SCC
implementation specifically, and it collides with sprefa's stated worst case.
GraphBLAS's kernels and LAGraph's stable algorithms are fast on the same
machine and the same graphs.

## Traps

### GxB_JIT_ERROR (-7001) with an empty message

`LAGraph_scc` fails on a stock Homebrew install:

```
LAGraph_scc failed: info = -7001, msg = ""
```

`-7001` is `GxB_JIT_ERROR` (`GraphBLAS.h:407`). The message string is empty,
which is what makes this expensive to diagnose. `GxB_BURBLE` gives the cause:

```
/Users/chrishafley/.SuiteSparse/GrB10.3.1/src/include/GB_omp_kernels.h:40:14:
  fatal error: 'omp.h' file not found
   40 |     #include <omp.h>
      |              ^~~~~~~
(jit failure: compiler error; compilation disabled)
```

Homebrew bakes `-Xclang -fopenmp` into the GraphBLAS JIT compiler flags and
links `/opt/homebrew/opt/libomp/lib/libomp.dylib`, but omits
`-I/opt/homebrew/opt/libomp/include`. Any JIT-compiled kernel that includes
`omp.h` fails.

This surfaces only for algorithms using a **user-defined operator**, because
those cannot use GraphBLAS's precompiled kernels and must be JIT-compiled.
`LAGraph_scc` needs a JIT build of its `LG_SCC_trim_one` select op. Stock
`GrB_*` calls never touch the JIT, so the whole library appears healthy and
SCC alone appears broken.

Fix at runtime, no rebuild:

```rust
// gbsys::repair_jit_flags
let mut buffer: Vec<c_char> = vec![0; 8192];
GrB_Global_get_String(GrB_GLOBAL, buffer.as_mut_ptr(), GxB_JIT_C_COMPILER_FLAGS);
let patched = format!("{current} -I/opt/homebrew/opt/libomp/include\0");
GrB_Global_set_String(GrB_GLOBAL, patched.as_ptr() as *const c_char,
                      GxB_JIT_C_COMPILER_FLAGS);
```

Generalization worth keeping: **a library that JIT-compiles at runtime carries
its build machine's toolchain configuration into your process.** The failure
appears at the first call that needs a user-defined operator, which can be
long after install and far from anything the caller controls.

### GxB_BITMAP allocates n^2 regardless of nvals

Forcing `GxB_BITMAP` on an n-by-n matrix allocates n^2 bytes whatever the edge
count. At sprefa's 283,127 nodes that is ~80GB. Measured at 4,000 nodes with
19,989 edges:

```
small forced=bitmap  memory=16.00 MB  bytes/edge=800.5  20 vxm steps=0.0219s
small forced=sparse  memory= 0.10 MB  bytes/edge=  4.8  20 vxm steps=0.0010s
```

160x the memory and 20x slower. `GxB_FULL` silently resolves to bitmap for a
matrix with absent entries. Bitmap and full were therefore never forced above
4,000 nodes in this lab.

## H1. The transpose 12-23x was a benchmark artifact

The first evaluation measured a descriptor-based transpose as 12-23x faster
than a materialized, reused transpose, and did not isolate the cause. With
every matrix forced through `GrB_Matrix_wait(A, GrB_MATERIALIZE)` before
timing, the effect is gone. 1,000,000 nodes, 4,000,000 edges, 20 `mxv` steps:

| path | time | vs descriptor |
|---|---|---|
| descriptor transpose (`GrB_INP0 = GrB_TRAN`) | 0.0990s | 1.00x |
| materialized A', stored `GxB_BY_ROW` | 0.1196s | 1.21x |
| materialized A', stored `GxB_BY_COL` | 0.0977s | 0.99x |

Materializing A' cost 0.0572s once. Both matrices are 20.0 MB.

The residual 1.21x is a kernel choice, named by `GxB_BURBLE`:

```
GrB_mxv C=A'*B, dot_product (iso dot2)      <- descriptor path
GrB_mxv C=A*B, saxpy (...)                  <- materialized-by-row path
```

A descriptor transpose on a CSR matrix means reading it as CSC, which costs
nothing and selects the dot-product kernel. A materialized A' stored by row is
a genuinely different physical layout and selects saxpy. Storing A' by column
makes the two paths identical, at 0.99x.

So the mechanism is real and the magnitude was not. A 20x gap of that shape
should be assumed to be a pending-state or materialization artifact until
`GrB_Matrix_wait` is in the harness.

## H2. Format control changes nothing worth having

sprefa's graph averages under one edge per node, which reads like the case
`GxB_HYPERSPARSE` exists for. The measurements say otherwise.

283,127 nodes / 261,704 edges:

| forced | actual | memory | bytes/edge | 20 vxm steps |
|---|---|---|---|---|
| auto | sparse | 2.18 MB | 8.3 | 0.0001s |
| hypersparse | hypersparse | 4.04 MB | 15.5 | 0.0001s |
| sparse | sparse | 2.18 MB | 8.3 | 0.0001s |

10,000,000 edges / 2,000,000 nodes:

| forced | actual | memory | bytes/edge | 20 vxm steps |
|---|---|---|---|---|
| auto | sparse | 48.00 MB | 4.8 | 0.2437s |
| hypersparse | hypersparse | 73.88 MB | 7.4 | 0.2435s |
| sparse | sparse | 48.00 MB | 4.8 | 0.2235s |

SuiteSparse's automatic choice is `sparse` in every case, and it is the best
choice on both memory and speed. Forcing hypersparse costs **1.85x the
memory** at sprefa's shape for no speed change at all.

The reason average degree misleads: hypersparse pays off when most ROWS are
entirely empty, since it stores an explicit list of non-empty ones. With
261,704 edges spread over 283,127 nodes most rows do hold an entry, so the
hyperlist is pure overhead. Average degree under 1 does not imply empty rows.

At 48.00 MB for 10M edges, GraphBLAS's storage is **4.8 bytes per edge**,
against petgraph `Csr`'s 17.4 measured in the earlier lab. Storage was never
GraphBLAS's problem.

## H3. The mask surface, and the edge-kind wall

All four mask combinations on `vxm`, graph `0 -> {1,2,3}`, frontier `{0}`,
with a mask where node 1 is present-and-true, node 2 is present-but-false, and
node 3 is absent:

| mask form | result | selects |
|---|---|---|
| none | `[1, 2, 3]` | everything |
| valued (default) | `[1]` | present AND true |
| `GrB_STRUCTURE` | `[1, 2]` | present, value ignored |
| `GrB_COMP` | `[2, 3]` | not true |
| `GrB_STRUCTURE` + `GrB_COMP` | `[3]` | not present |

The halt predicate is the structural complement, and it reproduces sprefa
exactly. Chain `0->1->2->3`, seed `{1}`, halt `{2}`:

```
GraphBLAS masked walk         -> [1, 2]
sprefa multi_source_halt_bfs  -> [1, 2]
```

Node 2 is reached and recorded, and does not propagate to 3. This confirms the
first evaluation's one solid result.

### Edge-kind filtering cannot be done with a mask

sprefa needs "traverse only edges of kind k", which SQL does with a `WHERE`
clause on the edge row. GraphBLAS cannot express this with a mask, for a
structural reason worth stating precisely:

**A mask on `mxv`/`vxm` selects which entries of the OUTPUT VECTOR may be
written. It indexes NODES. An edge-kind predicate selects which entries of the
MATRIX participate. Those are different index spaces.**

The demonstration: put two edges of different kinds between the same pair of
nodes, `0 -> 5` as kind 0 and `0 -> 5` as kind 1. In one boolean matrix they
collapse to `nvals=1`. The kind ordinal was never in the matrix, so no mask
over node indices can recover it.

The workable form is one matrix per kind:

```
per-kind matrix, kind 0 -> [1]
per-kind matrix, kind 1 -> [3]
per-kind memory: kind0=292 B, kind1=292 B, combined=300 B
```

This is exact, and it is the shape `LAGraph_RegularPathQuery` already assumes
("adjacency matrix decomposition" by label). The cost is a fixed per-matrix
overhead multiplied by the number of kinds, plus losing the ability to
traverse several kinds in one operation without an eWiseAdd first. For a small
kind ordinal that is affordable, while remaining a real modelling constraint
that a `WHERE` clause does not impose.

## H4. Multi-source rides nearly free, behind a trap

Multi-source BFS is one `mxm` with one frontier column per source. 2,000,000
nodes, 10,000,000 edges, 6 BFS steps:

| sources | total secs | secs/source | frontier nvals | frontier format |
|---|---|---|---|---|
| 1 | 0.0024 | 0.00242 | 18,605 | sparse |
| 2 | 0.0059 | 0.00296 | 35,372 | hypersparse |
| 4 | 0.0105 | 0.00264 | 64,523 | hypersparse |
| 8 | 0.9939 | 0.12424 | 106,403 | hypersparse |
| 16 | 0.9794 | 0.06121 | 199,503 | sparse |
| 32 | 1.0109 | 0.03159 | 437,708 | sparse |
| 64 | 0.9660 | 0.01509 | 1,038,459 | sparse |
| 128 | 1.0080 | 0.00788 | 2,172,172 | sparse |
| 256 | 0.9651 | 0.00377 | 4,196,058 | sparse |

Total wall time is **flat from 8 to 256 sources**, so per-source cost falls 32x
across that range. That is the answer to "how many sources before it stops
paying": it never stops paying up to 256, because the marginal source is free.

### The cliff at 8, isolated

The 90x jump between 4 and 8 sources is not a density effect and not a format
effect (8 is hypersparse, the same as 4). `GxB_BURBLE` names it:

```
sources=4:
  GrB_mxm (1-thread bucket transpose) C=A*B', saxpy
    (transposed B: 2000000-by-4, bool, 4 entries)

sources=8:
  GrB_mxm (12-thread atomic bucket transpose) C=A*B', saxpy
    (transposed B: 2000000-by-2000000, bool, 9999990 entries)
```

At 4 sources SuiteSparse transposes the tiny frontier, 4 entries. At 8 it
flips which operand it physically transposes and re-transposes **the entire
10,000,000-edge adjacency matrix on every step**. The flat ~1s is the cost of
re-transposing A six times, which is why it does not vary with source count.

Materializing A' once and dropping the descriptor removes the per-step
transpose:

| sources | descriptor form | pre-materialized A' | speedup |
|---|---|---|---|
| 8 | 0.9939s | 0.2562s | 3.88x |
| 32 | 1.0109s | 0.2851s | 3.55x |
| 128 | 1.0080s | 0.2845s | 3.54x |
| 256 | 0.9651s | 0.2305s | 4.19x |

**This reverses the first evaluation's guidance.** That pass concluded the
descriptor transpose is the fast path. For `mxv` it is roughly neutral (H1,
1.21x). For `mxm` with 8 or more columns it is a trap costing ~3.9x, and
pre-materializing A' is correct.

Against 256 separate single-source runs (256 x 0.0024s = 0.614s), one batched
`mxm` with a pre-materialized transpose takes 0.2305s, a 2.7x win.

## H5. The from-scratch binding, written

`src/gbsys.rs`, hand-written against the Homebrew headers:

| quantity | value |
|---|---|
| lines | **443** |
| `extern "C"` declarations | **56** (48 functions, 8 statics) |
| crates.io dependencies | **0** |
| build.rs | 11 lines, two `println!` link directives |
| licence | writable as MIT or Apache-2.0; wraps Apache-2.0 + BSD-2-Clause |

The first evaluation estimated 27 to 30. The real number is 56, because that
estimate did not include LAGraph, format control (`GxB_Matrix_Option_*`),
memory introspection, JIT repair, or `GrB_Matrix_wait`, all of which turned
out to be necessary to answer the questions honestly.

It took one iteration. The only correction needed was adding
`GrB_Global_get_String` / `GrB_Global_set_String` after the JIT trap surfaced.
The cost of the whole detour was far below the cost of diagnosing that trap.

Two techniques that made it cheap and are worth reusing:

**Do not transcribe enum values by hand.** `probe_consts.c` compiles against
the real headers and prints every constant the shim needs:

```c
printf("GxB_SPARSITY_CONTROL=%d\n", (int)GxB_SPARSITY_CONTROL);
printf("GxB_HYPERSPARSE=%d\n", (int)GxB_HYPERSPARSE);
```

**Verify symbol names against the dylib before writing the declaration.**
`nm -gU libgraphblas.dylib | grep -E " _GrB_wait$"` returns nothing, because
the polymorphic `GrB_wait` in the header is a macro over `GrB_Matrix_wait` and
`GrB_Vector_wait`. Same for `GrB_eWiseAdd`, which resolves to
`GrB_Vector_eWiseAdd_BinaryOp`. Every opaque handle is a pointer to an
incomplete struct, so `*mut c_void` is complete and correct for all of them.

The `LAGraph_Graph` struct is public in the header, and reproducing its layout
in Rust was avoidable: `LAGraph_scc` takes a raw `GrB_Matrix`, and
`LAGr_ConnectedComponents` needs only `LAGraph_New` plus
`LAGraph_Cached_IsSymmetricStructure`, both of which operate on the opaque
handle.

**The NonCommercial licensing finding, while accurate, was not a blocker.**
Both crates are confirmed CC-BY-NC-4.0 (`license = "CC-BY-NC-4.0"` in both
`Cargo.toml` files). Neither is needed.

## H6. Distribution cost

The system-library route is dramatically cheaper than the vendored route the
first lab used.

| | first lab (vendored) | this lab (system libs) |
|---|---|---|
| clean build | ~137s | **4.16s** |
| dependency crates | ~92 | 8, all from `rand` for test graphs |
| needs cmake | yes | no |
| needs git clone at build time | yes, ~400MB | no |
| needs network at build time | yes | no |
| needs bindgen | yes | no |
| contributor setup | env var pinned to Homebrew gcc's libgomp | `brew install suite-sparse libomp` |

`cargo clean && cargo build --release -j4` measured at 4.16s real. `build.rs`
is 11 lines and emits only a link search path and an rpath.

Honest counts against that: the system route requires the library present on
every build machine and pins you to whatever version the distribution ships,
which is how the JIT trap arrives. The vendored route removes the system
dependency and costs ~137s plus a network clone. Both remain available, and
the first lab proved the vendored path works.

**Cross-compilation was not tested.** Linking a platform dylib and a runtime
JIT that shells out to `clang` both point against it, but that is reasoning
rather than measurement, so it is recorded as untested.

## The seven-function table

| function | GraphBLAS answer |
|---|---|
| `tarjan` (SCC, stack-safe) | `LAGraph_scc` exists and is CORRECT, and its cost scales with depth: 158.4s at depth 4,000, infeasible at the stated 1,000,000. **Cannot replace.** |
| `build_condensed` | no LAGraph entry point; would be hand-built on top of an SCC labelling that is not affordable. **Cannot replace.** |
| `count_pairs` | no entry point. Expressible as repeated `mxm` over the closure, which is the Theta(V^2) blowup `scc.rs` exists to avoid. **Cannot replace.** |
| `reaches_from` | `mxv` frontier loop, or `LAGr_BreadthFirstSearch`. Works. |
| `reached_by` | same with `GrB_INP0 = GrB_TRAN`, or a pre-materialized A'. Works. |
| `multi_source_walk` | one `mxm`, all sources at once, flat cost 8 to 256 sources. Works, and is the best fit of the seven. |
| `multi_source_halt_bfs` | structural complement mask, exact match to sprefa's expected output. Works. |

Four of seven work. Those same four are the four the SQL recursive CTE route
already covers with zero dependencies and sub-millisecond times. The three
that stay in Rust stay in Rust.

## What I could not test, and why

- **The 1,000,000-node path SCC.** Started twice, killed both times without
  completing. The scaling table up to depth 4,000 is what supports the
  conclusion; the extrapolation to 1M is labelled as an extrapolation and no
  measured number is claimed.
- **Cross-compilation.** Not attempted. See H6.
- **`GxB_BITMAP` / `GxB_FULL` above 4,000 nodes.** They allocate O(n^2), which
  at sprefa's node count is ~80GB. Deliberately skipped under the memory
  budget.
- **Graphs above 10,000,000 edges.** Budget cap. Peak RSS stayed at 579MB
  (`l2_format`) and 494MB (`l4_multisource`), both well inside 2GB.
- **`LAGraph_RegularPathQuery`.** Found in `LAGraphX.h` and it takes exactly
  the per-label matrix decomposition H3 arrives at independently. Not
  exercised. It is the most interesting unexplored surface here, and it is
  experimental, so it carries the same JIT and maturity exposure as
  `LAGraph_scc`.
- **Multi-threaded scaling.** GraphBLAS used up to 12 threads on this machine
  (visible in burble output as `12-thread atomic bucket transpose`). No
  thread-count sweep was run, so none of the timings are decomposed into
  per-core behaviour.

## What generalizes beyond GraphBLAS

**Concluding a capability is absent without linking the layer that provides it
is a measurement gap, not a finding.** LAGraph was installed on this machine
during the first evaluation and was used only for reading headers. The cost of
checking was `nm -gU liblagraphx.dylib | grep -i scc`.

**An unexplained 20x is a hypothesis about your harness first.** The transpose
result collapsed from 12-23x to 1.21x once `GrB_Matrix_wait(GrB_MATERIALIZE)`
was in the loop. Any library with deferred or pending computation needs an
explicit materialization barrier inside the timing harness before a number
means anything.

**Algorithm cost can track a shape parameter the workload description does not
lead with.** `LAGraph_scc` is fine at 283,127 nodes (0.15s) and unusable at
10,000 nodes arranged 1,000 deep (23.9s). Node and edge counts were the
headline figures; depth was the parameter that decided it. Check which
parameter an algorithm is actually sensitive to before benchmarking on size
alone.

**A runtime JIT imports its build machine's toolchain configuration into your
process.** The Homebrew package compiles and links correctly, passes stock
operations, and fails only at the first user-defined operator, with an empty
message string. Any library that compiles code at runtime can fail long after
install, in a way no build-time check would catch.

**Estimate the escape hatch before accepting a licensing blocker.** The
NonCommercial binding was accurate and irrelevant: 443 lines removed it. The
earlier writeup already suggested this; writing it converts the suggestion
into a fact and gives a real number, 56 declarations rather than 30.
