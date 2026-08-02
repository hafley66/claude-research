# Licensing, precisely

Read directly from LICENSE files, not from Cargo.toml metadata or the GitHub API (the GitHub
API reports `license: Other (NOASSERTION)` for `code-sam/graphblas_sparse_linear_algebra`,
which is a metadata gap, not an answer). Four questions, answered in the order that matters
for a decision.

## a) Does the NonCommercial restriction cover both crates, or only the high-level wrapper?

Both, identically. `diff` between
`~/.cargo/registry/src/index.crates.io-*/graphblas_sparse_linear_algebra-0.63.1/LICENSE` and
the corresponding `suitesparse_graphblas_sys-0.4.4/LICENSE` produces zero output: the two
files are byte-for-byte the same license text. This matters because a common shape for this
kind of split is a permissive low-level `-sys` crate (raw FFI declarations, arguably not
very creative to begin with) underneath a more restrictively-licensed high-level wrapper.
That is not the case here. `suitesparse_graphblas_sys`, the crate that does nothing but
declare the C function signatures and vendor the build, carries the exact same
CC-BY-NC-4.0 restriction as the safe wrapper built on top of it. There is no permissive
layer to fall back to within this author's crates.

## b) The C library's own license, read at the exact commit this crate compiles

Two different documents describe this, and they say slightly different things, which is
itself worth knowing.

The Homebrew-installed `suite-sparse` 7.12.2 (used in this lab only for convenient header
and license reading, never linked against) ships a combined `LICENSE.txt` that says:

> SuiteSparse:GraphBLAS, Timothy A. Davis, (c) 2017-2021, All Rights Reserved. The following
> Apache-2.0 applies to all of SuiteSparse:GraphBLAS except for the @GrB MATLAB interface...
> No files that are compiled and packaged as part of the libgraphblas.so or libgraphblas.a
> libraries are licensed under the GNU GPLv3.

That describes an explicit carve-out: a MATLAB interface under GPLv3, explicitly excluded
from the compiled library.

The actual source `suitesparse_graphblas_sys` vendors, cloned live during the build to commit
`1fd54756ca57cae44e8cf91137ba5107824e8e7b` (tag `v10.3.1`), has its own `LICENSE` file at the
repository root, and it reads differently:

> SuiteSparse:GraphBLAS, Timothy A. Davis, (c) 2017-2025, All Rights Reserved. The following
> Apache-2.0 applies to all of SuiteSparse:GraphBLAS, except for 3rd-party software...
> Dependencies on 3rd-party software: [RMM (Apache-2.0), Jitify (BSD-3-Clause), CUB
> (BSD-3-Clause)], all under the CUDA directory.

No mention of MATLAB or GPL anywhere in this version's `LICENSE` file. The 3rd-party
carve-out it does describe is CUDA-only code (`GRAPHBLAS_USE_CUDA` is off in this lab's
build, so none of it gets compiled regardless). Both documents land in the same place for
anyone using the plain C library the way this lab did: the core is Apache-2.0, nothing GPL
ever enters `libgraphblas.a`. But the license TEXT itself changed between whatever version
produced the Homebrew documentation and the exact v10.3.1 tree vendored here, so re-reading
the LICENSE file at whatever commit is actually being compiled is the right habit, not
assuming last year's wording still applies. LAGraph carries BSD-2-clause in both sources.

## c) The alternative binding, `pathrex-sys` 0.1.0

A different author entirely: `SparseLinearAlgebra` on GitHub, not `code-sam`. Its `LICENSE`
file, read directly from the repository root, is a standard MIT license:

> MIT License
>
> Copyright (c) 2026 SparseLinearAlgebra
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this
> software...

No NonCommercial restriction anywhere in this crate's chain.

Repository health via the GitHub API: 1 star, 9 open issues, 0 forks, created 2026-03-11,
most recently pushed 2026-07-19 -- actively worked on, not abandoned, but very young and with
essentially no external adoption signal yet (14 to 48 total crates.io downloads depending on
which of its two published crates is counted). Its `pathrex-sys/build.rs` clones GraphBLAS
with `git clone --depth 1 --branch v10.3.1`, a shallow clone pinned to a tag, plus a
`deps/LAGraph` git submodule -- a lighter and more targeted vendoring approach than
`suitesparse_graphblas_sys`'s full, unshallowed clone of the whole repository history.

Whether it exposes enough surface to have run H2 through H5 as written: almost certainly
not, without extending it first. `pathrex-sys/src/` contains exactly two files: `lib.rs`
(3,684 bytes) and `lagraph_sys_generated.rs` (9,590 bytes). That is a small, curated or
narrowly-generated set of bindings built for pathrex's own regular-path-query engine
specifically, nowhere near the roughly 600 kilobytes of bindgen output
`suitesparse_graphblas_sys` produces by binding the whole of `GraphBLAS.h`. `pathrex` itself
(the higher-level crate, separate from `pathrex-sys`) does have a real library surface,
`lib.rs` plus `graph`, `formats`, `eval`, `rpq` (with `nfarpq.rs` and `rpqmatrix.rs`), and
`sparql` modules, not a CLI-only benchmarking tool as its description alone might suggest.
But reaching that RPQ-shaped API from a general `mxv`/`mxm`/`apply`/`transpose` need like
sprefa's would mean going around `pathrex`'s own abstraction to its `lagraph_sys` re-export,
which is itself the narrow generated surface described above, and very likely extending it.
This was not attempted in this lab; building it would have meant a second full, from-scratch
vendored GraphBLAS C compile on top of the roughly 2.3 minutes already spent on the first
one, for a crate at 0.1.0 with a single-digit star count.

## d) What a from-scratch minimal binding would cost

Counted directly from what H2 through H5 actually called, tracing each Rust operator used in
this lab down to the specific `graphblas_bindings::` FFI function or global it wraps (not
the wrapper crate's full surface, which is far larger):

- Lifecycle: `GrB_init`, `GrB_finalize` (2)
- Constructors/destructors/counts: `GrB_Matrix_new`, `GrB_Matrix_free`, `GrB_Matrix_nvals`,
  `GrB_Vector_new`, `GrB_Vector_free`, `GrB_Vector_nvals` (6)
- Element access, boolean only (every test in this lab used `bool` matrices/vectors):
  `GrB_Matrix_setElement_BOOL`, `GrB_Matrix_extractTuples_BOOL`,
  `GrB_Vector_setElement_BOOL`, `GrB_Vector_extractTuples_BOOL` (4)
- Core operations: `GrB_mxv`, `GrB_vxm`, `GrB_mxm`, `GrB_Vector_apply`, `GrB_Matrix_apply`,
  `GrB_transpose` (6)
- Merge: `GrB_Vector_eWiseAdd_Monoid`, `GrB_Matrix_eWiseAdd_Monoid` (2)
- Descriptors: either `GrB_Descriptor_new` plus one setter function (2), or hardcoding the
  roughly 5 of the crate's 30 precomputed `GrB_DESC_*` globals this lab's code actually used
  (`GrB_DESC_C`, `GrB_DESC_RC`, `GrB_DESC_RSC`, `GrB_DESC_RT0`, plus the default/NULL case)
- Type and operator constants: `GrB_BOOL`, `GrB_LOR_LAND_SEMIRING_BOOL`,
  `GrB_LOR_MONOID_BOOL`, `GrB_IDENTITY_BOOL`, `GrB_FIRST_BOOL` (5)

Total: roughly 27 to 30 distinct FFI declarations, against `GraphBLAS.h`, the reference
implementation of a formally published, stable API standard rather than an ad hoc header.
`bindgen` produces the raw signatures automatically; the actual work is choosing which
30 of the header's roughly 2,000 symbols to expose and writing a thin, safe-Rust wrapper
around each, the same shape of one-line wrapper this lab already had to write by hand for
the boolean semiring the existing crate lacks (`LorLandBool` in `src/lib.rs` of the lab
crate).

## Verdict, stated as a decision

CC-BY-NC-4.0 on `graphblas_sparse_linear_algebra`/`suitesparse_graphblas_sys` is a real
blocker for distributing sprefa commercially, and it covers the entire binding down to the
raw FFI layer per (a) above. The blocker sits on this specific dependency: the Apache-2.0 C
library underneath carries no such restriction at the exact commit this lab vendored and
compiled, so the technology itself remains available; only `code-sam`'s particular Rust
crates carry the restriction. Three ways forward, in order of increasing effort and
decreasing risk:

1. Evaluate `pathrex`/`pathrex-sys` further. MIT, but 0.1.0, single-digit-star, and its
   generated binding surface is narrow enough that using it for sprefa's needs likely means
   extending that binding first, not simply switching an import.
2. Write a fresh, minimal `bindgen` shim directly against the Apache-2.0 `GraphBLAS.h`,
   roughly 27 to 30 declarations per the count above. This sidesteps `code-sam`'s copyright
   on the *bindings* specifically, since raw `bindgen` output over someone else's
   Apache-2.0-licensed header is not `code-sam`'s original creative work to license
   restrictively. Not attempted in this lab; a scoping estimate, not a measurement.
3. Keep the NC binding for internal evaluation and prototyping only, with an explicit
   decision to not ship it, if the capability findings elsewhere in this evaluation are
   judged worth prototyping against before committing engineering time to option 2.
