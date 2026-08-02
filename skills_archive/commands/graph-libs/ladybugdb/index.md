---
description: Adversarial measurement of LadybugDB (lbug 0.18.2, the live Kuzu fork) and its algo extension SCC, run against sprefa's real 261,704-edge dataflow graph plus synthetics to 10M edges. Tests whether the documented "disk-based graph algorithms" claim survives contact with a constrained buffer pool. It does not.
argument-hint: "[verdict | h0-build | h1-out-of-core | h2-correctness | h3-depth | h4-ingest | h5-incremental | traps]"
---

# LadybugDB `algo` SCC: measured, not read

Everything below is measured on this machine. Doc quotes are treated as claims.

## Verdict

**DO NOT ADOPT.** Three independent blockers, any one of which is disqualifying.

1. **The algorithm is not out-of-core.** Per-vertex state is allocated from the
   buffer pool and cannot spill. Give it a buffer pool smaller than roughly
   2.2x the on-disk graph and it hard-fails with a buffer manager exception.
   The measured floor is 110 to 165 bytes per vertex, linear in V.
   At the 150M-node target that is 16 to 24 GB of required buffer pool on a
   16 GB machine.
2. **The `scc` variant returns silently wrong answers at its default settings.**
   On sprefa's real graph it fabricated a strongly connected component out of
   two vertices that have an edge in one direction only. On a path graph of
   depth 1,000 it reported 21 components where the truth is 1,001. No error,
   no warning, deterministic.
3. **Incremental mutation runs at ~200 edges/sec.** Bulk `COPY` runs at
   2.9M edges/sec. Full rebuild beats incremental update for any delta above
   about 42 edges, which makes the reactive-engine fit story moot.

`scc_ko` (Kosaraju) is correct everywhere I tested it and is the only variant
worth discussing. It is still 6.3x slower than a plain in-memory Tarjan on the
same graph while saving 23% RSS.

## Hypothesis table

| H | Claim under test | Result | Decisive number |
|---|---|---|---|
| H0 | Builds and loads the `algo` extension | **PARTIAL** | Builds in 8.70s. Extension load fails out of the box; needed 87 forced `-Wl,-u` symbol roots to fix |
| H1 | Algorithm is out-of-core, not just storage | **REFUTED** | 64MB buffer pool on a 333MB graph: `Buffer manager exception`. Floor scales linearly at 110-165 B/vertex |
| H2 | SCC partition is correct | **REFUTED (`scc`) / CONFIRMED (`scc_ko`)** | `scc_ko` hash-identical to Tarjan on 3/3 graphs. `scc` default wrong on 3/3 |
| H3 | Scales, and survives depth | **REFUTED** | Path depth 10,000: `scc` 125,939ms vs `scc_ko` 12ms. Depth 100,000 `scc` exceeded a 600s cap |
| H4 | Ingestion cost is tolerable | **CONFIRMED** | 261,704 real edges in 212ms; 10M in 2,317ms. Store is 17.2MB vs 6.6MB SQLite table |
| H5 | Supports incremental insert/delete | **REFUTED** | 203 edge inserts/sec, 192 deletes/sec. Batched UNWIND is worse at 66/sec |

## Is the algorithm out-of-core, or only the storage?

**Only the storage.** This is the direct answer to the gap the prior agent left open.

The docs are accurate about the graph and silent about the algorithm state, and
the algorithm state is the entire cost at scale. Measured minimum viable buffer
pool, bisected on a power-of-two grid:

| Edges | Vertices | Store on disk | Min buffer pool that completes | Ratio to store | Bytes/vertex |
|---|---|---|---|---|---|
| 1,000,000 | 490,811 | 33 MB | 64 MB (32 MB fails) | 1.9x | 68-137 |
| 5,000,000 | 2,454,218 | 173 MB | 384 MB (256 MB fails) | 2.2x | 104-164 |
| 10,000,000 | 4,908,708 | 327 MB | 768 MB (512 MB fails) | 2.3x | 109-164 |

Both `scc` and `scc_ko` have identical minimums, so this is a shared per-vertex
allocation in the GDS frontier machinery rather than an artifact of either
algorithm.

Peak RSS plateaus at the working set and ignores the cap once above the floor:

| Buffer pool cap | Peak RSS (10M edges, `scc_ko`) |
|---|---|
| 768 MB | 707 MB |
| 1024 MB | 708 MB |
| 1536 MB | 709 MB |
| unlimited | 732 MB |

A genuinely out-of-core algorithm would hold RSS near the cap and stream. RSS
here sits at 707MB for a 327MB store regardless of what the cap says, which is
the signature of materialized O(V) state.

Extrapolation to the 150M-node target at the measured 110-165 B/vertex floor:
16.5 to 24.6 GB of required buffer pool. The stated machine has 16 GB.

### Verbatim failure

```
Error: Query execution failed: Buffer manager exception: Unable to allocate
memory! The buffer pool is full and no memory could be freed!
```

"no memory could be freed" is the tell. The pages holding algorithm state are
pinned and unevictable.

## H2: correctness

Oracle is sprefa's own iterative Tarjan from `/Users/chrishafley/projects/sprefa/src/graph/scc.rs`,
ported verbatim into the lab crate. Comparison is exact: partition canonicalized
to sorted groups of sorted member ids, then FNV-1a hashed. Same hash means same
components and same membership.

| Graph | Oracle ncomp / hash | `scc_ko` | `scc` (default) |
|---|---|---|---|
| sprefa `rel_df_edge`, 261,704 edges | 269,429 / `86e820990473d57d` | **exact match** | 269,428 / `0f79df4c81da96d4` **WRONG** |
| synthetic 1M edges, heavily cyclic | 172,619 / `a3284389c6a60338` | **exact match** | 285,903 / `5b98352bde75b270` **WRONG (+65%)** |
| path graph depth 1,000 | 1,001 / `55d60c14ac0e2811` | **exact match** | 21 **WRONG (-98%)** |

### The false merge, verified against source edges

On the real graph, `scc` placed two vertices in one component:

```
-1464491826794474348  ->  2366205149662603154   edge exists
 2366205149662603154  -> -1464491826794474348   NO SUCH EDGE
```

Checked directly against `edges.csv`, independent of the oracle. One direction
only, so they cannot be strongly connected. `scc` merged them anyway.

### The default `maxIterations` is not what the docs say

The docs render the signature as `strongly_connected_components(G, maxIterations := 100)`,
which reads as a default of 100. Measured behavior on the real graph:

| `maxIterations` | ncomp | hash |
|---|---|---|
| 1 | 94,192 | `476de9231ede43e0` |
| 5 | 239,448 | `15a8e72b62a5ce04` |
| 10 | 267,707 | `ff76810a01ca4999` |
| **20** | **269,428** | **`0f79df4c81da96d4`** |
| 21 and above | 269,429 | `86e820990473d57d` (correct) |
| **omitted (default)** | **269,428** | **`0f79df4c81da96d4`** |

The default output is bit-identical to `maxIterations := 20` and differs from
`maxIterations := 100`. Passing the documented default explicitly produces a
different, correct answer than omitting the parameter. Deterministic across 5
runs.

The deeper defect: when the coloring fails to converge within the cap, it
returns the partially-converged partition as if it were the answer. Silent
non-convergence on a correctness-critical primitive.

## H3: scaling and the depth cliff

Random graphs, both variants, in-memory Tarjan for calibration:

| Edges | `scc_ko` ms | `scc` ms | Tarjan ms | `scc_ko` RSS | Tarjan RSS |
|---|---|---|---|---|---|
| 1,000,000 | 630 | 7,402 | 48 | 131 MB | 112 MB |
| 5,000,000 | 4,003 | 133,175 | 584 | 401 MB | 489 MB |
| 10,000,000 | 8,763 | 112,754 | 1,394 | 732 MB | 955 MB |

At 10M edges Kosaraju-in-LadybugDB is **6.3x slower** than in-memory Tarjan for a
23% RSS saving. (The Tarjan RSS figure is inflated by my harness holding the
155MB CSV and an id map, so the real saving is smaller than 23%.)

### Depth

The sibling LAGraph lab found BFS-coloring SCC costing 158.4s at depth 4,000.
LadybugDB's `scc` has the same failure shape and is worse, because it does not
merely get slow. It gets slow **or** wrong depending on `maxIterations`, with no
setting that is both fast and right.

| Path depth | `scc` default | `scc` with `maxIterations` >= depth | `scc_ko` | Truth |
|---|---|---|---|---|
| 1,000 | 21 comps, 33ms **wrong** | 1,001 comps, 1,129ms correct | 1,001, **4ms** | 1,001 |
| 10,000 | 41 comps, 1,050ms **wrong** | 10,001 comps, **125,939ms** correct | 10,001, **12ms** | 10,001 |
| 100,000 | 316 comps, 6,989ms **wrong** | exceeded 600s cap | 100,001, **91ms** | 100,001 |

Cost grows roughly quadratically in depth (1.1s at 1k, 126s at 10k, ~114x per
10x). At depth 10,000 `scc` correct-mode is **10,495x slower** than `scc_ko`.

`scc_ko` shows no depth sensitivity at all and is the clear winner on this axis.
The docs recommend Kosaraju "for sparse graphs or those with high diameter",
which reads as performance guidance. It is a correctness requirement.

## H4: ingestion

| Dataset | Nodes | Edges | DDL | COPY nodes | COPY edges | Total | Store size |
|---|---|---|---|---|---|---|---|
| sprefa `rel_df_edge` | 269,457 | 261,704 | 26ms | 74ms | 89ms | **212ms** | 17.2 MB |
| synthetic 1M | 490,811 | 1,000,000 | 32ms | 93ms | 224ms | 372ms | 33 MB |
| synthetic 5M | 2,454,218 | 5,000,000 | 26ms | 243ms | 944ms | 1,238ms | 165 MB |
| synthetic 10M | 4,908,708 | 10,000,000 | 27ms | 408ms | 1,855ms | **2,317ms** | 333 MB |

Bulk load is genuinely fast: 2.9M edges/sec on the real graph. Ingest is not the
blocker.

Footprint against the source, for the same 261,704 edges:

| Store | Bytes |
|---|---|
| SQLite `rel_df_edge` table | 6.64 MB |
| plus `idx_df_edge_from` / `_to` | 11.62 MB |
| LadybugDB store | 17.2 MB |

Comparable to the SQLite table plus its two indexes. No amplification problem here.

## H5: incremental fit

sprefa re-ticks on file change, so per-tick edge deltas are the real access
pattern. Measured against a copy of the real-graph store:

| Operation | Form | Throughput |
|---|---|---|
| Node insert | one statement each | 224/sec |
| Edge insert | one statement each | **203/sec** |
| Edge delete | one statement each | **192/sec** |
| Node insert | UNWIND in one transaction | 21,914/sec |
| Edge insert | UNWIND in one transaction | **66/sec** |
| Edge delete | UNWIND in one transaction | **76/sec** |
| Edge insert | bulk `COPY` | **2,940,000/sec** |

Batching made edges *worse*. `UNWIND [...] AS p MATCH (a:N),(b:N) WHERE a.id=p[1] AND b.id=p[2]`
plans as a cartesian join per unwind row rather than two primary-key lookups, so
the batched form loses the index the per-statement form was getting. Node insert
batches fine (98x gain), which isolates the problem to the two-endpoint MATCH.

The arithmetic that settles it: a full rebuild of the whole 261,704-edge graph
costs 212ms. At 203 edge-inserts/sec, incremental update matches that at
**43 edges**. Any tick touching more than ~43 edges is better off rebuilding
from scratch, so there is no incremental story to adopt.

I did not find a form that beats ~200 edges/sec. Prepared statements or a
`MERGE`-based path might do better; see "what I could not test".

## H0 and the traps

The gate passes, and only after work that the documentation does not describe.

### Trap 1: multi-statement query returns Ok while doing nothing

```rust
conn.query("INSTALL algo; LOAD algo;")   // -> Ok
```

This returns `Ok` and loads nothing. The result object reflects the first
statement only. My first gate run reported success against a database where the
extension had never loaded; the lie surfaced later as "function
strongly_connected_components is not defined". Issue one statement per `query`
call.

### Trap 2: the `-rdynamic` advice is stale, and insufficient anyway

The prior research reported that you must add `println!("cargo:rustc-link-arg=-rdynamic");`
to your own `build.rs`. For `lbug` 0.18.2 that is obsolete. The crate's own
`build.rs` already emits it:

```rust
if !cfg!(windows) && link_mode() == "static" {
    println!("cargo:rustc-link-arg=-rdynamic");
}
```

Confirmed in the emitted metadata (`cargo:rustc-link-arg=-rdynamic`), and 1,818
lbug symbols do get exported. Loading still fails:

```
Error: Query execution failed: IO exception: Failed to load library:
/Users/chrishafley/.lbdb/extension/0.18.1/osx_arm64/algo/libalgo.lbug_extension
which is needed by extension: algo.
Error: dlopen(.../libalgo.lbug_extension, 0x0006): symbol not found in flat
namespace '__ZN4lbug8function11GDSFunction14getLogicalPlanEPNS_7planner7PlannerERKNS_6binder18BoundReadingClauseENSt3__16vectorINS9_10shared_ptrINS5_10ExpressionEEENS9_9allocatorISD_EEEERNS2_11LogicalPlanE'
```

The cause is Apple's linker dead-stripping. rustc passes `-Wl,-dead_strip`
unconditionally, and it runs after `-rdynamic`. Diff of what the extension needs
against what the archive defines:

| Measure | Count |
|---|---|
| lbug symbols undefined in `libalgo.lbug_extension` | 87 |
| of those, defined in `liblbug.a` | **87** |
| genuinely missing | **0** |
| `GDSFunction` symbols surviving into the binary | 1 of 10 |

Every needed symbol is present and stripped. The obvious fix is rejected:

```
ld: unknown options: -no_dead_strip
```

Apple's new linker removed it. What works is forcing each symbol to be a
dead-strip root. In the lab's `build.rs`:

```rust
println!("cargo:rustc-link-arg-bins=-Wl,-u,{sym}");   // x87
```

Symbol list generated with `nm -u libalgo.lbug_extension | grep 4lbug | sort -u`.
After this, 8 of 10 `GDSFunction` symbols survive and the extension loads.

Use `rustc-link-arg-bins`, not `RUSTFLAGS`. Setting it globally breaks the
proc-macro build:

```
error: could not compile `quote` (build script) due to 1 previous error
error: could not compile `proc-macro2` (build script) due to 1 previous error
```

### Trap 3: version skew between core and extension

The crate is 0.18.2. The extension server has no 0.18.2:

| Extension version | HTTP |
|---|---|
| 0.17.0 | 200 |
| 0.18.0 | 200 |
| 0.18.1 | 200 |
| **0.18.2** | **404** |

Worse, the shipped core and its own same-version extension disagree on an ABI
signature. Every published extension (0.17.0, 0.18.0, 0.18.1) resolves against:

```
GDSFunction::bindGraphEntry(main::ClientContext&, std::string const&)
```

Every published core static library exports:

```
GDSFunction::bindGraphEntry(main::ClientContext&, graph::ParsedNativeGraphEntry const&)
```

The v0.18.1 source defines **both** overloads (`src/function/gds/gds.cpp:67` and
`:121`), so the string form exists and is stripped rather than absent. That is
why the `-u` fix works. Pinning `LBUG_VERSION=0.18.1` to match the extension is
still required, and by itself does not fix the load.

### Trap 4: the build does not build

`cargo build --release` finishes in 8.70s because `build.rs` downloads a
prebuilt 77.5MB `liblbug.a` from GitHub rather than compiling the bundled
44MB C++ tree. Default source is the `main` branch (cache key `latest`), which
is how the core drifts ahead of every released extension. Anyone budgeting for a
Kuzu-sized C++ compile is budgeting for the wrong thing, and anyone expecting a
hermetic build should know `build.rs` shells out to `curl` at build time.

### Trap 5: Cypher lists are 1-based

```
Error: Query execution failed: Runtime exception: List extract takes 1-based position.
```

`p[0]` is invalid; use `p[1]`.

## Environment

| Item | Value |
|---|---|
| OS | macOS 14.6.1, build 23G93, aarch64 |
| Hardware | 16 GB RAM, 12 CPU |
| rustc | 1.97.0-nightly (9eb3be26b 2026-05-18) |
| cargo | 1.97.0-nightly (4d1f98451 2026-05-15) |
| Build profile | `--release`, confirmed via `Finished \`release\` profile [optimized]` |
| Parallelism | `-j4` throughout |
| Crate | `lbug` 0.18.2, core pinned `LBUG_VERSION=0.18.1` |
| Extension | `algo` 0.18.1, osx_arm64 |
| Clean release build | 8.70s |
| Binary size | 17.4 MB |
| Unique dependencies | 36 |
| Prebuilt static lib | 77.5 MB |
| License | `Cargo.toml` says MIT. **The published crate contains no top-level LICENSE file.** Only `lbug-src/third_party/*` licenses ship, all permissive (MIT, BSD, Apache-2.0); no copyleft found in 20 bundled deps |
| RSS method | `/usr/bin/time -l`, "maximum resident set size" |
| Data | `rel_df_edge` from the live sprefa store, opened `mode=ro`; 261,704 edges, 269,457 vertices with degree >= 1 |

Lab: `/Users/chrishafley/projects/claude-research/labs/graph-kuzu-realdata/`

## What I could not test, and why

| Untested | Reason |
|---|---|
| 150M-node behavior directly | 10M edge hard cap per budget. The O(V) floor is extrapolated from three measured points that are linear and consistent, so the extrapolation is well-supported, and it is still an extrapolation |
| Path depth 100,000 with `scc` at adequate `maxIterations` | Exceeded my 600s cap. Extrapolating the observed ~quadratic growth puts it near 3.5 hours. Recorded as "did not finish", not as a measured number |
| Whether a better-planned incremental form exists | I tested per-statement and UNWIND-in-transaction. Prepared statements, parameter binding, and `MERGE` were not tried. The 203/sec figure is a floor on what I could achieve, and a faster form may exist |
| Building the core from source | The bundled `lbug-src` is 0.18.2 and ships **no** extension directory, so a source build produces a core whose extension version 404s. There is no self-consistent from-source path with the published artifacts |
| Linux behavior | macOS only. The dead-strip trap is Apple-linker-specific and probably does not reproduce on GNU ld, where `-rdynamic` alone may well suffice. The H1 buffer-pool result is platform-independent and should reproduce anywhere |
| Concurrent query load during SCC | Single-threaded harness, one connection |
| `scc` non-default thread counts | `max_num_threads` left at default for all reported runs |

## If someone still wants to use it

Conditions, all required:

1. Use `scc_ko` only. Treat `scc` as unusable.
2. Budget 165 bytes per vertex of buffer pool, plus the store. Verify the graph
   fits before running rather than after the exception.
3. Pin `LBUG_VERSION` to a version the extension server actually serves.
4. Carry the 87-symbol `-u` list in `build.rs` on macOS, and regenerate it on
   every version bump.
5. Rebuild the store per tick. Do not attempt incremental edge mutation.
6. Accept 6.3x the runtime of in-memory Tarjan for a memory saving under 23%.

For sprefa specifically, conditions 2 and 5 are each independently fatal.
