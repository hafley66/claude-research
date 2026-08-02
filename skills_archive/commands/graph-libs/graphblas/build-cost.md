# Build, distribution cost, and binding risk

## What a clean build actually does

`suitesparse_graphblas_sys` does not vendor a tarball and does not offer a prebuilt binary
path. Its `build.rs` does a live `git clone` of `DrTimothyAldenDavis/GraphBLAS` the first
time it runs, checks out a pinned commit, patches a couple of header files to avoid a symbol
collision with a bundled zstd copy, then runs the whole C library through `cmake` with
`--parallel` (which respects cargo's own `-j`/`NUM_JOBS`, so capping cargo's job count also
caps the C build). Only after that succeeds does `bindgen` parse the resulting
`GraphBLAS.h` and generate the raw Rust FFI declarations, and only after that does `rustc`
compile the roughly 92 dependency crates this pulls in (including `git2`, which itself needs
`libssh2-sys`, `libgit2-sys`, and `openssl-sys` as build-dependencies just to perform the
clone) plus the wrapper crate itself.

Measured on this lab's machine, 12-core Apple Silicon, `cargo build --release -j 4`:

- Clone, cmake configure, cmake build, and install: **114.50 seconds**, peak RSS
  565,641,216 bytes during that phase.
- `bindgen` parsing the full header plus `rustc` compiling the dependency tree: **21.86
  seconds**.
- Total: **roughly 137 seconds (2.3 minutes)**, every time the vendored clone is missing or
  stale.

That clone gets cached under `~/.cargo/registry/src/.../graphblas_implementation/` once it
succeeds, so a normal `cargo build` on an unchanged toolchain does not repeat the full cost.
But anything that clears or does not share that cache, a fresh CI runner, a `cargo clean` of
the registry, a container rebuilt from scratch, pays the full ~137 seconds again, and pays it
with a **live network dependency inside the build step itself**: a build machine with no
route to `github.com` cannot build this crate at all, cleanly. That is a meaningfully
different property from a normal Rust dependency, where `cargo build --offline` against a
warm registry cache is expected to just work.

## Trap 1: an interrupted clone breaks the build permanently, with no self-repair

A prior interrupted run in this lab left a partially-cloned `SuiteSparse_GraphBLAS`
directory: git objects fetched, nothing checked out. Retrying the build did not recover;
it failed immediately, every time, with:

```
thread 'main' (111174361) panicked at .../suitesparse_graphblas_sys-0.4.4/build.rs:191:35:
Failed to clone graphblas repository: '.../suitesparse_graphblas_sys-0.4.4/graphblas_implementation/SuiteSparse_GraphBLAS' exists and is not an empty directory; class=Invalid (3); code=Exists (-4)
```

The build script's own clone-detection logic checks only whether the target header file
exists; it does not check whether the directory it is about to clone into is empty, and it
has no recovery path for a partial clone left by an earlier interrupted build, a killed CI
job, or an out-of-disk-space failure midway through. The fix was a manual
`rm -rf` of exactly that one subdirectory (not the whole registry cache) before rebuilding.
Any CI pipeline that can be killed mid-build, which is most of them, needs to account for
this failure mode explicitly, because the crate will not recover from it on its own.

## Trap 2: a macOS-only env var the build script cannot infer

Even after the clone succeeded and the whole C library compiled (with cmake reporting
`OpenMP was not found`, building GraphBLAS single-threaded), the Rust build script itself
still panicked:

```
CMake Warning at CMakeLists.txt:601 (message):
  WARNING: OpenMP was not found (or was disabled with GRAPHBLAS_USE_OPENMP).
  ...

thread 'main' (111180413) panicked at .../suitesparse_graphblas_sys-0.4.4/build.rs:88:17:
Unable to read environment variable SUITESPARSE_GRAPHBLAS_SYS_COMPILER_PATH. For example, when using GCC on Ubuntu 22.04, please set it to "/usr/lib/gcc/x86_64-linux-gnu/11". environment variable not found
```

The build script's OpenMP static-library auto-detection (`search_compiler_path()` in its own
source) has exactly one branch, gated on `cfg!(target_os = "linux") && cfg!(target_arch =
"x86_64")`. Every other platform, including this one, hits the panic above unconditionally,
regardless of whether OpenMP was actually used in the resulting build. The C library itself
already reported it was not using OpenMP at all in this build, so the panic serves only the
build script's own internal sanity check. Nothing downstream ever links against `libgomp` in
this configuration.

The fix used in this lab, pinned in the lab crate's `.cargo/config.toml`:

```toml
[env]
SUITESPARSE_GRAPHBLAS_SYS_COMPILER_PATH = "/opt/homebrew/Cellar/gcc/16.1.0/lib/gcc/16"
```

pointing at the `libgomp.a`/`libgomp.dylib` installed by `brew install gcc`. Every one of
this lab's binaries ran correctly with this env var set, and none of them needed OpenMP
threading in practice; this is purely a build-script requirement, unrelated to runtime
behavior. Anyone consuming this crate on macOS needs the same workaround, or an equivalent
GCC install, before a clean build succeeds at all.

## What "compact" mode means for a deployed binary

Two Cargo features control how much of the C library gets pre-compiled:
`build-standard-kernels` (off by default) and `disable-just-in-time-compiler` (also off by
default). With both left at their defaults, as this lab's build was, GraphBLAS compiles in
`GRAPHBLAS_COMPACT` mode: the pre-compiled `FactoryKernels` (specialized, fast code for
common type/operator combinations) are skipped from the build entirely, and gaps get filled
by GraphBLAS's own JIT compiler invoking a C compiler **at runtime**, the first time an
uncommon operator/type combination is actually used. That means every machine RUNNING the
production deployment can need a working C compiler on `PATH`, in addition to whatever
machine built the Rust binary in the first place, unless that default is explicitly turned
off. No JIT cache
directory (the usual sign the JIT actually fired) appeared anywhere on this machine during
any run in this lab, so every operator this lab exercised (`LOR_LAND_BOOL`, `LogicalOr`,
`Identity`, `First`) was already covered by the compact build's built-in fallback or its
pre-generated `PreJIT` bundle. Whether an operator/type combination sprefa would actually
need falls outside that covered set was not tested.

## Cross-compilation

Nothing in the build pipeline, a live git clone, a `cmake` invocation, `bindgen` needing
`libclang`, and per-OS hardcoded OpenMP path assumptions, was written with cross-compilation
as a design goal, and none of it was attempted here. Treat cross-compiling this dependency
as an open question requiring its own investigation, not as a reasonable default expectation.

## Binding risk (H9)

Single author: `code-sam` (Sam Dekker), both crates. `graphblas_sparse_linear_algebra`'s
GitHub repository: 15 stars, 1 open issue, 3 forks, created 2021-07-01, most recently pushed
2026-05-28. `unsafe` appears **767 times** across 24,841 lines and 158 files in that crate;
every operator's `.apply()` method body is a single `unsafe` call into the raw C API,
wrapped in a typed, ergonomic Rust signature on the outside but carrying essentially none of
the internal safety proof a "safe wrapper" name usually implies. The `suitesparse_graphblas_sys`
crate underneath it, by contrast, has only 12 `unsafe` occurrences in its own hand-written
code, which is the expected shape for a thin `bindgen`-generated shim: nearly all of the real
unsafe surface area lives one layer up, in the crate marketed as the safe interface.

## Ordinary API-mismatch errors, for completeness

Three plain compile errors, fixed in minutes once the two infra traps above were cleared,
none of them infrastructure problems:

```
error[E0599]: no method named `set_value` found for struct `SparseMatrix<T>` in the current scope
  = help: trait `SetSparseMatrixElement` which provides `set_value` is implemented but not in scope
```

Nearly every operation in this crate is a trait method requiring an explicit `use` of that
trait; the obvious `matrix.set_value(...)` call does not resolve without importing
`collections::sparse_matrix::operations::SetSparseMatrixElement` first.

```
error[E0061]: this function takes 3 arguments but 1 argument was supplied
  .set_value(&(0, 1).into(), true)
```

`set_value` takes `(row_index: usize, column_index: usize, value: T)` as three separate
positional arguments, not a coordinate tuple or struct: `matrix.set_value(0, 1, true)`.

`SparseMatrix::new` takes its `Size` argument by value, not by reference, another one-line
fix once the compiler pointed at it.
