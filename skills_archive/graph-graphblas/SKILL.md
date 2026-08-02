---
name: graph-graphblas
description: SuiteSparse:GraphBLAS from Rust for sprefa v6's graph layer -- builds and runs, masks correctly express "visit but do not expand," but the only viable binding is CC-BY-NC-4.0 (noncommercial) and every clean build vendors+compiles the whole C library from a live git clone. Verified empirically 2026-07-19.
metadata:
  type: reference
---

# graph-graphblas

Lab crate: `~/projects/claude-research/labs/graph-graphblas/` (read its README for exact
repro commands). Every number below came out of a binary in that crate's `src/bin/`, run
with `/usr/bin/time -l` on a 16GB Apple Silicon Mac, never above 10,000,000 edges.

## H0 verdict -- IT BUILDS AND RUNS, WITH TWO REQUIRED WORKAROUNDS

**Cleared, but not out of the box.** `graphblas_sparse_linear_algebra` 0.63.1
(`suitesparse_graphblas_sys` 0.4.4 underneath) builds, links, and runs correctly on macOS
14.6.1/arm64, rustc 1.97.0-nightly, from a stock `cargo build --release`. Total clean build
time **~137s (~2.3 min)** on 12 cores with `-j4`. Two things had to be fixed by hand before
that worked, both quoted verbatim in the traps section below:

1. **A stale/interrupted vendored git clone left the build permanently broken** until the
   half-cloned `graphblas_implementation/SuiteSparse_GraphBLAS/` directory was manually
   `rm -rf`'d -- the build script does not detect or recover from this itself.
2. **macOS needs an env var the crate cannot infer for itself** (`SUITESPARSE_GRAPHBLAS_SYS_COMPILER_PATH`),
   because the build script's OpenMP-library auto-detection is hardcoded to `linux` +
   `x86_64` only. This is required even though this machine's own cmake build reports
   `OpenMP was not found` and compiles GraphBLAS single-threaded -- the crate demands an
   unrelated GNU `libgomp.a` purely to satisfy its own build script's sanity check, not
   because anything downstream links against it.

Once both were fixed, three source-level API mismatches from the partial prior run also had
to be corrected (wrong `set_value` call shape, missing trait imports, `SparseMatrix::new`
taking `Size` by value not by reference) -- ordinary compile errors, not infrastructure
problems, fixed in minutes. See the "traps" section for exact compiler text.

**The bigger finding is H10: the only two crates that make this binding possible
(`graphblas_sparse_linear_algebra` and `suitesparse_graphblas_sys`, both by `code-sam`) are
licensed CC-BY-NC-4.0 -- Creative Commons NonCommercial. That is a hard blocker for any
commercial use of sprefa through this binding**, independent of whether the code works. See
H10 below; this is not a footnote.

## Verdict table, H1-H11

| # | Question | Verdict | Measured |
|---|---|---|---|
| H1 | Representation & memory | Plain 2D sparse matrix (CSR/CSC-like; SuiteSparse also has hypersparse/bitmap/full formats chosen automatically, not user-selected here) | 1M edges: 999,995 stored, peak RSS 62,586,880 B = **62.6 B/edge**. 10M edges: 9,999,990 stored, peak RSS 570,949,632 B = **57.1 B/edge**. petgraph CSR ideal ~8 B/edge -- GraphBLAS here runs **~7-8x** that, whole-process RSS (includes runtime init + temp edge-list Vec, not isolated matrix bytes). |
| H2 | BFS as masked mxv | **Works, exact match** | 12-node hand graph: exact reached-set match, cross-checked against a second pure-Rust BFS. 1M edges: BFS 25.2ms (build 325ms). 10M edges: BFS 125.1ms (build 1.076s). |
| H3 | Halt-predicate (reach, don't expand) | **DECISIVE: YES, masks express it correctly** | Complement mask on `GrB_Vector_apply` filters the frontier before each vxm step. Naive BFS reaches `{1,2,3}`; halt-aware masked walk reaches `{1,2}` only, both asserted equal to known answers and to each other's inequality. |
| H4 | Depth-capped multi-source BFS as mxm | **Works, exact match, no cross-source contamination** | 2 disjoint chains, cap=2 stops one hop short; cap=5/unbounded reach the full chain. 10M edges, k=8 sources: cap=2 in 310µs, cap=5 in 4.55ms, unbounded in 1.012s. |
| H5 | Reachability both directions + transpose cost | **Correct both ways; descriptor is NOT literally free but is far cheaper than materializing** | Forward/backward differ correctly (`{0,1,2}` vs `{0,1,2,3}`), materialized A^T agrees exactly. 20-repeat backward walk at 10M edges: transpose-descriptor path **2.50s** vs materialize-once (57ms) + repeat-on-materialized **57.93s** -- descriptor path is **23x faster**, not just "amortized-materialize" cost. See caveat below. |
| H6 | SCC | **Absent from this binding** (`LAGraph_scc` exists only in experimental LAGraphX, unlinked). Reference only: sprefa's own Tarjan, 1M-node path graph, **14.6ms**. |
| H7 | LAGraph reachability from Rust | Not through this crate. `pathrex-sys` (MIT) binds LAGraph directly but was not built here (see "could not test"). Its generated surface is narrow: `pathrex-sys/src/` is only `lib.rs` (3,684 bytes) + `lagraph_sys_generated.rs` (9,590 bytes) -- a small, curated subset for pathrex's own RPQ needs, not a general `mxv`/`mxm`/`apply`/transpose surface like `suitesparse_graphblas_sys`'s ~600KB bindgen dump. It likely cannot run H2-H5 as written without extending its own binding first. |
| H8 | pathrex / RPQ | Real library (has `lib.rs` + `rpq/{mod,nfarpq,rpqmatrix}.rs`, not CLI-only), MIT, but 0.1.0, created 2026-03-11, 1 GitHub star, 9 open issues, 0 forks, ~14-48 downloads. Not production-viable as-is; not built here. |
| H9 | Binding risk | Single author (`code-sam`/Sam Dekker). `graphblas_sparse_linear_algebra`: 15 stars, 1 open issue, forks=3, pushed 2026-05-28, created 2021-07-01. **767 occurrences of `unsafe`** across 24,841 lines / 158 files -- every operator's `.apply()` is one `unsafe` FFI call; this is a thin shim, not a safety-proven abstraction. The `_sys` crate itself has only 12 `unsafe` occurrences (as expected for a bindgen shim -- the "safe" wrapper crate carries almost all the unsafe surface). |
| H10 | License | **SuiteSparse:GraphBLAS C library: Apache-2.0** (verified from the real LICENSE file at the exact vendored commit this crate compiles). **Both `graphblas_sparse_linear_algebra` 0.63.1 AND `suitesparse_graphblas_sys` 0.4.4 carry byte-identical CC-BY-NC-4.0 text** (`diff` confirms it), so the NonCommercial restriction is not something one layer adds on top of a clean lower layer -- it covers the entire binding, sys crate included. A from-scratch minimal binding covering exactly what H2-H5 needed is roughly 30 FFI declarations against the Apache-2.0 C header -- small enough that the NC binding is a detour, not a permanent blocker. See full text and the FFI count below. |
| H11 | Build & distribution cost | **Full C toolchain + cmake + git required on EVERY build machine.** No vendored tarball, no prebuilt binary path: `suitesparse_graphblas_sys`'s build.rs does a live `git clone` of `DrTimothyAldenDavis/GraphBLAS` on first build (breaks hermetic/offline CI). Default build mode (`GRAPHBLAS_COMPACT=true`, JIT enabled) means **production machines may need a C compiler at RUNTIME** for uncommon operator/type combinations, not just at build time. Cross-compilation: untested, no sign it was designed for it. ~137s clean build here. |

## What this replaces from sprefa's own graph code

Baseline read: `src/graph/scc.rs` (`tarjan`, `build_condensed`, `count_pairs`, `reaches_from`,
`reached_by`) and `src/graph/walk.rs` (`multi_source_walk`, with `multi_source_halt_bfs` as a
thin wrapper around it -- 6 primary functions, one wrapper).

| sprefa function | GraphBLAS replaces it? | Expression | Measured cost |
|---|---|---|---|
| `tarjan` (iterative Tarjan SCC) | **No** -- not exposed by this binding at all | LAGraph_scc exists in C but is unreachable from `graphblas_sparse_linear_algebra`/`suitesparse_graphblas_sys` (zero `lagraph` references in either crate's source) | sprefa's own: 14.6ms on a 1M-node path (H6) |
| `build_condensed` (SCC condensation + DAG) | **No** -- depends on `tarjan` | n/a | n/a |
| `count_pairs` (closure size via condensation, no materialized pairs) | **No** -- depends on `tarjan`/`build_condensed`; GraphBLAS's own transitive-closure idiom (repeated `mxm` on the boolean semiring) computes reachable PAIRS directly and does not avoid the O(V^2) worst case the way the condensation-counting trick does | n/a | Full transitive closure was not attempted at 10M edges: worst-case O(V^2) output makes this the first place the memory budget bites (see "could not test") |
| `reaches_from` (closure-free forward reach from the condensation) | **Yes, as a masked-mxv BFS** (H2), though it does not use the condensation trick -- it is a real per-query BFS, not O(1) lookup into a precomputed structure | `vxm(frontier, A, LOR_LAND_BOOL, mask=complement(visited), replace)` looped to fixpoint | 10M edges: 125.1ms per query (H2) |
| `reached_by` (closure-free backward reach) | **Yes, via the transpose descriptor** (H5) -- same mxv loop, `transpose_first_argument=true`, no second matrix materialized per query | `mxv(A, frontier, transpose=true, mask=complement(visited), replace)` looped to fixpoint | 10M edges, single query: consistent with H2's ~125ms order of magnitude (H5's numbers are for 20-repeat batches; see table) |
| `multi_source_walk` / `multi_source_halt_bfs` (multi-tag depth-carrying BFS with a halt set) | **Yes, and this is the standout win** -- multi-source becomes ONE `mxm` call per hop (H4) instead of sprefa's per-tag sequential BFS, and the halt semantics are expressible with a complement mask on `GrB_Vector_apply` (H3), matching sprefa's exact "recorded but not expanded" contract | mxm-based multi-source stepping (H4) + masked-apply frontier filtering (H3) | H4, 10M edges, k=8 sources, unbounded: 1.012s for all 8 sources at once vs sprefa's current one-BFS-per-tag loop (not benchmarked here; sprefa's `multi_source_walk` is already O(V+E) per tag, so the GraphBLAS win here is constant-factor batching across sources via one `mxm`, not a complexity-class change) |

Net: GraphBLAS's masked-mxv/mxm shape is a **real, correct, reasonably fast** replacement
for `multi_source_walk`/`multi_source_halt_bfs` and for ad hoc `reaches_from`/`reached_by`
queries. It has **no answer at all** for `tarjan`/`build_condensed`/`count_pairs` through this
binding -- SCC and the condensation-counting trick stay pure Rust regardless of the licensing
question.

## Build and distribution cost, bluntly

- Every clean build needs: a C/C++ toolchain, `cmake`, and `git` -- and **network access**,
  because the C library is fetched via a live `git clone` inside `build.rs`, not a vendored
  tarball. This alone breaks offline/hermetic CI unless the clone is pre-seeded and kept
  warm across builds (it does get cached in `~/.cargo/registry/src/.../graphblas_implementation/`
  once cloned, but a `cargo clean` of the registry cache, a fresh CI runner, or a corrupted
  partial clone -- see traps below -- forces the full ~400MB clone + cmake build again).
- macOS requires a manual env var workaround not needed on the crate's assumed target
  (Linux + GCC). This lab pins it in `.cargo/config.toml`; any consumer would need to do the
  same or hit the exact panic quoted below.
- Default build mode (`GRAPHBLAS_COMPACT=true` since `build-standard-kernels` is not a
  default feature, JIT enabled since `disable-just-in-time-compiler` is also not default)
  means the FactoryKernels (pre-compiled kernels for common type/operator pairs) are
  skipped from the build, and GraphBLAS's own JIT compiler fills gaps **at runtime** by
  invoking a C compiler again, on the deployment machine, the first time an uncommon
  operator/type combination is used. No JIT cache directory appeared during this lab's runs
  (`find ~ -iname '*GraphBLAS*' -newer ...` came up empty), meaning every operator this lab
  exercised (`LOR_LAND_BOOL`, `Identity`, `LogicalOr`) was covered by the compact-mode
  built-in/PreJIT set -- but the structural risk (a production server silently needing `cc`
  on PATH the first time an unusual op fires) was not fully ruled out, only not observed.
- Cross-compilation: nothing in the build.rs (git clone + cmake + bindgen + per-OS
  hardcoded OpenMP paths) suggests this was designed with cross-compilation in mind, and it
  was not attempted here.
- Total measured clean-build time: **~137s (~2.3 min)** on a 12-core Apple Silicon Mac with
  `-j4` (114.50s for the vendored clone+cmake+install phase, 21.86s for bindgen+rustc across
  ~92 dependency crates). This is a real, recurring cost against a pure-Rust alternative
  that has none of it.

## Licensing verdict (read from the actual LICENSE files, not the GitHub API)

The GitHub API reports `license: Other (NOASSERTION)` for `code-sam/graphblas_sparse_linear_algebra`
-- that is a metadata gap, not the real answer. Full precision, all four questions:

**(a) Does CC-BY-NC-4.0 cover both crates, or only the wrapper?** Both, identically.
`diff` between `graphblas_sparse_linear_algebra-0.63.1/LICENSE` and
`suitesparse_graphblas_sys-0.4.4/LICENSE` produces zero output -- byte-for-byte the same
license text in both crates. The restriction covers the raw FFI declarations in the `-sys`
crate exactly as much as it covers the safe wrapper on top.

**(b) The C library's own license, read from the exact vendored source this crate
compiles** (not just the Homebrew install used for header/reference reading): the
`LICENSE` file inside the live git clone at commit `1fd54756ca57cae44e8cf91137ba5107824e8e7b`
(tag `v10.3.1`) reads:
> `SuiteSparse:GraphBLAS, Timothy A. Davis, (c) 2017-2025, All Rights Reserved. The
> following Apache-2.0 applies to all of SuiteSparse:GraphBLAS, except for 3rd-party
> software... Dependencies on 3rd-party software:` (RMM, Jitify, CUB -- all
> Apache-2.0/BSD-3-Clause, all CUDA-only code this build never compiles, since
> `GRAPHBLAS_USE_CUDA` is off here).

Note a real, if inconsequential, historical wrinkle: the Homebrew-installed 7.12.2 combined
`LICENSE.txt` describes a DIFFERENT carve-out -- an `@GrB` MATLAB interface under GPLv3,
explicitly excluded from the compiled `.so`/`.a`. The exact v10.3.1 source tree this crate
vendors and compiles does not mention MATLAB or GPL anywhere in its `LICENSE` file at all,
only the CUDA third-party dependencies above. Both editions land in the same place for this
binding either way (the core library is Apache-2.0, nothing GPL ever gets compiled into
`libgraphblas.a` here), but it means the license TEXT itself is not stable across releases
and should be re-read at whatever commit is actually vendored, not assumed from an older
doc. LAGraph: BSD-2-clause, confirmed from the same Homebrew install.

**`graphblas_sparse_linear_algebra` 0.63.1 and `suitesparse_graphblas_sys` 0.4.4** (the ONLY
binding this lab could get running): **CC-BY-NC-4.0**, read directly from each crate's
`LICENSE` file (not just the `license = "CC-BY-NC-4.0"` Cargo.toml field, which agrees):
> `Creative Commons Attribution-NonCommercial 4.0 International... the Licensor hereby
> grants You a worldwide, royalty-free, non-sublicensable, non-exclusive, irrevocable
> license to exercise the Licensed Rights in the Licensed Material to: A. reproduce and
> Share the Licensed Material... for NonCommercial purposes only; and B. produce,
> reproduce, and Share Adapted Material for NonCommercial purposes only.`

**(c) The alternative binding, `pathrex-sys` 0.1.0**, a DIFFERENT author
(`SparseLinearAlgebra` on GitHub, not `code-sam`): **MIT**, confirmed by reading
`LICENSE` at the repo root directly (`Copyright (c) 2026 SparseLinearAlgebra`, standard MIT
text). Repository health via the GitHub API: 1 star, 9 open issues, 0 forks, created
2026-03-11, pushed as recently as 2026-07-19 (actively worked on, not abandoned, just very
young). Its `build.rs` does a shallow (`--depth 1`) clone of GraphBLAS pinned to tag
`v10.3.1` plus a `deps/LAGraph` git submodule -- lighter and cleaner than
`suitesparse_graphblas_sys`'s full, unshallowed clone. But its actual FFI SURFACE is narrow:
`pathrex-sys/src/` contains exactly two files, `lib.rs` (3,684 bytes) and
`lagraph_sys_generated.rs` (9,590 bytes) -- a small, curated/generated subset built for
pathrex's own RPQ (regular path query) needs specifically, nowhere near the ~600KB of
bindgen output `suitesparse_graphblas_sys` produces by binding the entire `GraphBLAS.h`.
It almost certainly does not expose `mxv`/`mxm`/`vxm`/`apply`/`transpose` generically the
way H2 through H5 needed; using it as a general GraphBLAS binding would mean extending its
own binding first, not just swapping an import.

**(d) A from-scratch minimal binding's scope**, counted from exactly what H2-H5 called
(grepping the wrapper crate's own `graphblas_bindings::` imports down to the specific
functions actually exercised, not the crate's full surface): `GrB_init`/`GrB_finalize` (2);
`GrB_Matrix_new`/`_free`/`_nvals`, `GrB_Vector_new`/`_free`/`_nvals` (6);
`GrB_Matrix_setElement_BOOL`/`_extractTuples_BOOL`,
`GrB_Vector_setElement_BOOL`/`_extractTuples_BOOL` (4); `GrB_mxv`, `GrB_vxm`, `GrB_mxm`,
`GrB_Vector_apply`, `GrB_Matrix_apply`, `GrB_transpose` (6);
`GrB_Vector_eWiseAdd_Monoid`/`GrB_Matrix_eWiseAdd_Monoid` (2); a handful of the 30
precomputed `GrB_DESC_*` descriptor globals the wrapper imports wholesale, of which only
about 5 were ever actually used (`GrB_DESC_C`, `GrB_DESC_RC`, `GrB_DESC_RSC`, `GrB_DESC_RT0`,
plus the `NULL`/default case) -- or, more simply, just `GrB_Descriptor_new` + one setter
function instead of hardcoding any of the 30; and four type/operator constants
(`GrB_BOOL`, `GrB_LOR_LAND_SEMIRING_BOOL`, `GrB_LOR_MONOID_BOOL`, `GrB_IDENTITY_BOOL`,
`GrB_FIRST_BOOL`). Total: **roughly 27-30 distinct FFI declarations**, against a stable,
formally-specified, well-documented C API (`GraphBLAS.h` is the reference implementation of
an actual published standard, not an ad hoc header). `bindgen` generates the raw signatures
for free; the only work is picking which ~30 of the header's ~2000 symbols to expose and
writing the thin safe-Rust wrapper around them, the same shape of wrapper this lab already
wrote by hand for `LorLandBool` because the existing crate lacks it.

**Verdict, decision-grade: CC-BY-NC-4.0 on `graphblas_sparse_linear_algebra`/
`suitesparse_graphblas_sys` is a real distribution blocker for sprefa if sprefa is or becomes
a commercial product. The blocker sits on this specific binding**: the Apache-2.0 C library
underneath carries no such restriction at all. Three ways around it, in
order of effort: (1) `pathrex`/`pathrex-sys`, MIT, but 0.1.0 and unproven, and its binding
would need extending to cover H2-H5's surface; (2) a fresh, minimal `bindgen` shim directly
against the Apache-2.0 `GraphBLAS.h`, roughly 30 declarations per (d) above, sidestepping
`code-sam`'s copyright on the *bindings* entirely, since raw `bindgen` output over someone
else's Apache-2.0 header is not `code-sam`'s creative work to license restrictively; (3)
stay on the NC binding for internal/non-commercial evaluation only. None of this was built
in this lab; it is a scoping estimate, not a measurement.

## Traps: compiler and linker errors, verbatim

### Trap 1: interrupted git clone leaves the build permanently broken

A prior interrupted run left a half-cloned `SuiteSparse_GraphBLAS` directory with commits
fetched but nothing checked out. Retrying the build did not recover; it failed immediately:

```
thread 'main' (111174361) panicked at .../suitesparse_graphblas_sys-0.4.4/build.rs:191:35:
Failed to clone graphblas repository: '.../suitesparse_graphblas_sys-0.4.4/graphblas_implementation/SuiteSparse_GraphBLAS' exists and is not an empty directory; class=Invalid (3); code=Exists (-4)
```

Fix: `rm -rf` that exact directory (NOT the whole registry cache -- just the
`graphblas_implementation/SuiteSparse_GraphBLAS` subdirectory) and rebuild; `build.rs` clones
fresh into an empty directory correctly. The build script has no self-healing path for this;
it will fail identically forever until the directory is manually removed.

### Trap 2: macOS OpenMP-path panic, even though OpenMP is not in use

```
CMake Warning at CMakeLists.txt:601 (message):
  WARNING: OpenMP was not found (or was disabled with GRAPHBLAS_USE_OPENMP).
  See the GraphBLAS user guide on the consequences of compiling GraphBLAS
  without OpenMP. ...

thread 'main' (111180413) panicked at .../suitesparse_graphblas_sys-0.4.4/build.rs:88:17:
Unable to read environment variable SUITESPARSE_GRAPHBLAS_SYS_COMPILER_PATH. For example, when using GCC on Ubuntu 22.04, please set it to "/usr/lib/gcc/x86_64-linux-gnu/11". environment variable not found
```

The C library build ITSELF reports no OpenMP was found or used (single-threaded), but the
Rust build script unconditionally requires this env var anyway (its auto-detection,
`search_compiler_path()`, only has a branch for `cfg!(target_os = "linux") && cfg!(target_arch = "x86_64")`).
Fix used in this lab (`.cargo/config.toml`):

```toml
[env]
SUITESPARSE_GRAPHBLAS_SYS_COMPILER_PATH = "/opt/homebrew/Cellar/gcc/16.1.0/lib/gcc/16"
```

pointing at Homebrew GCC's `libgomp.a`/`libgomp.dylib`, installed via `brew install gcc`.
Nothing in this lab's binaries actually needed OpenMP threading; this only satisfies the
build script's own check.

### Trap 3: `GrB_Vector_assign`/`GxB_Vector_subassign` silently delete instead of merge

The single most consequential correctness trap. The obvious way to accumulate a BFS
`visited` set across rounds -- "insert just the newly-discovered node indices, don't touch
anything else" -- looks like it should be `GrB_Vector_assign`/`GxB_Vector_subassign` with no
mask, `ElementIndexSelector::All`, and no `REPLACE` descriptor bit set. **It is not.** Both
this crate's `insert` module (`GrB_Vector_assign`) and its `subinsert` module
(`GxB_Vector_subassign`) clear every destination position absent from the source vector,
REGARDLESS of the `REPLACE` flag, when called this way. Isolated repro
(`src/bin/debug_assign.rs` in the lab crate):

```rust
let mut w = SparseVector::<bool>::new(context.clone(), 6).unwrap();
w.set_value(0, true).unwrap();                      // w = {0}
let mut u = SparseVector::<bool>::new(context.clone(), 6).unwrap();
u.set_value(1, true).unwrap();                       // u = {1}
insert_op.apply(&mut w, &ElementIndexSelector::All, &u, &Assignment::<bool>::new(),
                &SelectEntireVector::new(context.clone()), &OperatorOptions::new_default())
    .unwrap();
// w is now {1} -- NOT {0, 1}. Node 0 vanished.
```

Output, both `insert` (assign) and `subinsert` (subassign) paths:

```
GrB_Vector_assign (insert::InsertVectorIntoVectorOperator), no mask, no replace, w={0} <- u={1}: w = [1]
GxB_Vector_subassign (subinsert::InsertVectorIntoSubVectorOperator), no mask, no replace, w={0} <- u={1}: w = [1]
```

This broke `h2_bfs.rs`'s first version outright: a 12-node hand-built BFS returned `[3, 5]`
(only the LAST round's frontier) instead of the correct `[0, 1, 2, 3, 4, 5]`, because every
round's "insert the new frontier into visited" call wiped every prior round's entries. Fix:
use element-wise addition with the `LogicalOr` monoid (`C = A eWiseAdd B`, true set-union
semantics, no index/mask ambiguity) to merge vectors instead of any assign/subassign call.
This is the single highest-value trap in this lab -- it is a silent WRONG ANSWER, not a
build failure, and would not be caught without an exact-set assertion.

### Ordinary API-mismatch compiler errors (fixed in minutes, listed for completeness)

```
error[E0599]: no method named `set_value` found for struct `SparseMatrix<T>` in the current scope
  = help: trait `SetSparseMatrixElement` which provides `set_value` is implemented but not in scope
```
Fix: `use graphblas_sparse_linear_algebra::collections::sparse_matrix::operations::SetSparseMatrixElement;`
-- nearly every operation in this crate is a trait method that must be imported explicitly;
the "obvious" `matrix.set_value(...)` does not resolve without it.

```
error[E0061]: this function takes 3 arguments but 1 argument was supplied
  .set_value(&(0, 1).into(), true)
```
`SetSparseMatrixElement::set_value` takes `(row_index: usize, column_index: usize, value: T)`
as three positional arguments, not a coordinate tuple/struct. Fix: `matrix.set_value(0, 1, true)`.

## Working code from passing tests

The decisive H3 halt-predicate walk (`src/bin/h3_halt.rs` in the lab, trimmed):

```rust
loop {
    // Complement-mask apply: keep only frontier entries that are NOT marked halt.
    let mut frontier_active = SparseVector::<bool>::new(context.clone(), num_nodes).unwrap();
    let filter_options = OperatorOptions::new(true, false, true); // replace, value-mask, complement
    apply_op.apply_to_vector(&identity, &frontier, &assign_accum, &mut frontier_active,
                              halt, &filter_options).unwrap();

    if frontier_active.number_of_stored_elements().unwrap() == 0 {
        break; // every remaining frontier node is halted: stop expanding
    }

    let mut next = SparseVector::<bool>::new(context.clone(), num_nodes).unwrap();
    let vxm_options = OptionsForOperatorWithMatrixAsSecondArgument::new(true, false, true, false);
    vxm_op.apply(&frontier_active, &semiring, adjacency, &assign_accum, &mut next,
                 &reached, &vxm_options).unwrap();
    if next.number_of_stored_elements().unwrap() == 0 { break; }

    // reached = reached UNION next (LogicalOr monoid -- avoids the assign/subassign trap)
    let mut merged = SparseVector::<bool>::new(context.clone(), num_nodes).unwrap();
    union_op.apply(&reached, &or_monoid, &next, &assign_accum, &mut merged,
                   &SelectEntireVector::new(context.clone()),
                   &OptionsForOperatorWithMatrixAsSecondArgument::new_default()).unwrap();
    reached = merged;
    frontier = next;
}
```

Output:
```
H3: naive BFS from node 1 (halt-blind)      = [1, 2, 3]
H3: halt-aware walk from node 1 (halt[2]=true) = [1, 2]
H3 PASS: naive BFS reaches {1,2,3}, halt-aware masked-apply walk reaches {1,2} only
H3 PASS: start-node-is-halt case reaches {1} only
```

The hand-written boolean semiring, required because the crate ships none (`src/lib.rs`):

```rust
use graphblas_sparse_linear_algebra::graphblas_bindings::GrB_LOR_LAND_SEMIRING_BOOL;
use graphblas_sparse_linear_algebra::graphblas_bindings::GrB_Semiring;
use graphblas_sparse_linear_algebra::operators::semiring::Semiring;

pub struct LorLandBool;
impl Semiring<bool> for LorLandBool {
    fn graphblas_type(&self) -> GrB_Semiring {
        unsafe { GrB_LOR_LAND_SEMIRING_BOOL }
    }
}
```

## Versions and environment

- macOS 14.6.1 (23G93), arm64 (Apple Silicon), 16GB RAM
- rustc 1.97.0-nightly (9eb3be26b 2026-05-18), cargo 1.97.0-nightly (4d1f98451 2026-05-15)
- `graphblas_sparse_linear_algebra` 0.63.1, `suitesparse_graphblas_sys` 0.4.4 (crates.io)
- Vendored SuiteSparse:GraphBLAS commit `1fd54756ca57cae44e8cf91137ba5107824e8e7b`
  (tag `v10.3.1`), cloned live from `github.com/DrTimothyAldenDavis/GraphBLAS`
- Homebrew `suite-sparse` 7.12.2 installed for header/LICENSE reference only (not linked)
- Homebrew `gcc` 16.1.0 installed for its `libgomp` (build-script workaround only, not
  linked into any actual binary since OpenMP was not compiled into GraphBLAS here)
- `cargo build --release -j 4` for every measurement; `-j4` also caps the internal
  `cmake --parallel` step via `NUM_JOBS`

## What I could not test, and why

- **Above 10,000,000 edges, at all.** The memory budget for this lab is hard: never build a
  graph above 10M edges (a previous run at 100M swapped the machine). Every "at 130M edges"
  or "at sprefa's target scale" number anywhere in this skill is a **linear extrapolation**
  from the measured 1M/10M points, not a direct measurement, and is labeled as such.
- **Full transitive closure at any nontrivial scale.** Worst-case output is O(V^2); this is
  exactly the wall sprefa's own `count_pairs` condensation trick exists to avoid, and
  repeating that mistake with GraphBLAS at 10M edges risked producing an output matrix
  denser than the memory budget allows. Not attempted.
- **`pathrex`/`pathrex-sys` built and run.** MIT-licensed and LAGraph-capable, which would
  have answered H6/H7/H8 with running code instead of research, but building it means a
  SECOND from-scratch vendored GraphBLAS C compile (a shallow clone of a different tag plus
  a LAGraph git submodule) on top of the ~2.3 minutes already spent on the first one, for a
  crate that is 0.1.0, has 1 GitHub star and 9 open issues, and was created 2026-03-11.
  Judged not worth the additional build time and disk/memory pressure given two other lab
  agents were running concurrently on the same 16GB machine; reported from crates.io/GitHub
  metadata and repository file listings instead.
- **Whether the JIT compiler ever fires at runtime for an operator this lab didn't use.**
  No JIT cache directory appeared during any run here (checked `~`, `/tmp`, `/var/tmp`), so
  it did not fire for `LOR_LAND_BOOL`/`Identity`/`LogicalOr`/`PLUS_TIMES`. Whether an
  uncommon operator/type pairing would trigger an on-the-fly `cc` invocation in production
  was not directly exercised.
- **Root-caused why H5's freshly-materialized transpose is ~12-23x slower under repeated
  mxv than the transpose descriptor on the originally-built matrix.** The measured numbers
  are real (H5 table above) and the correctness cross-check passed (both give identical
  reach sets), but the MECHANISM is not confirmed -- the leading hypothesis is that a matrix
  built via `GrB_transpose` into a bare `SparseMatrix::new` does not go through the same
  internal format "maturation"/optimization pass that a matrix built via bulk
  `from_element_list` insertion gets, but this was not isolated (e.g. by forcing a `GrB_wait`
  on the transposed matrix before timing) given the lab's time budget. Reported as an
  observed, reproducible, but not fully explained result.
