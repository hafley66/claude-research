---
description: Dataflow + incremental computation prior art — Volcano, vectorized DB (MonetDB/X100, DuckDB, Photon), compiled queries (HyPer, Umbra), Morsel-driven, Timely/Differential Dataflow, Materialize, Flink/Spark SS, Salsa/Adapton/Incremental. Load when designing the execution shape of a reactive code-analysis runtime.
---

# dataflow-incremental

## Thesis

Redux-saga coalesces dispatched actions; Haxl/DataLoader fuse concurrent fetches; React's scheduler batches state updates. One layer down, the database community rediscovered the same primitive under different names: vectors (MonetDB/X100), morsels (HyPer), epochs (Naiad), revisions (Salsa), micro-batches (Spark). Every system resolves three axes: push vs pull, grain of batch, invalidation propagation. The common spine: push-based, batched, deterministically-invalidated dataflow graph.

## 1. Volcano (pull, 1 tuple)

- **Primitive**: single tuple per `next()`.
- **Direction**: pull.
- **Dirty**: none.
- Virtual call per row kills IPC on modern CPUs.
- [Graefe, Volcano, IEEE TKDE 1994](https://paperhub.s3.amazonaws.com/dace52a42c07f7f8348b08dc2b186061.pdf) — fetched 2026-04-18

## 2. Vectorized (push-batch, ~1024 rows)

- **Primitive**: column vectors per op call.
- **Direction**: push.
- **Dirty**: none.
- MonetDB/X100 sized vectors to L1. DuckDB: 2048. Photon: columnar Arrow batches.
- [Boncz/Zukowski/Nes, X100, CIDR 2005](https://www.cidrdb.org/cidr2005/papers/P19.pdf) — fetched 2026-04-18
- [Raasveldt/Mühleisen, DuckDB, SIGMOD 2019](https://duckdb.org/pdf/SIGMOD2019-demo-duckdb.pdf) — fetched 2026-04-18
- [Dehghani et al., Photon, SIGMOD 2022](https://www.databricks.com/wp-content/uploads/2022/07/photon-published.pdf) — fetched 2026-04-18

## 3. Compiled queries (push, tuple-in-register)

- **Primitive**: whole pipeline fused into one LLVM function; tuple lives in registers across op boundaries.
- **Direction**: push via conditional jump inside one function.
- **Dirty**: none; plan recompiled per statement. Umbra adds adaptive compiler.
- [Neumann, data-centric compilation, VLDB 2011](https://www.vldb.org/pvldb/vol4/p539-neumann.pdf) — fetched 2026-04-18
- [Neumann & Freitag, Umbra, CIDR 2020](https://www.cidrdb.org/cidr2020/papers/p29-neumann-cidr20.pdf) — fetched 2026-04-18

## 4. Morsel-driven parallelism (hybrid push+pull, 10k–100k rows)

- **Primitive**: morsel = row batch owned by one worker at a time; work-stealing across a fixed pool; NUMA-aware.
- **Direction**: push within stage, pull across pipeline breakers.
- **Dirty**: none.
- The Rayon-shape for SQL.
- [Leis et al., Morsel-Driven, SIGMOD 2014](https://db.in.tum.de/~leis/papers/morsels.pdf) — fetched 2026-04-18

## 5. Timely / Differential Dataflow (push, epoch batch, frontier dirty)

- **Primitive**: `(data, time, diff)` triples grouped into batches per logical time; arrangements share indexed state.
- **Direction**: push. Frontiers (lower bounds on future timestamps) trigger flushing.
- **Dirty**: inherent — records carry partial-order timestamps; operators recompute only over timestamps whose frontier advanced.
- [Murray et al., Naiad, SOSP 2013](https://sigops.org/s/conferences/sosp/2013/papers/p439-murray.pdf) — fetched 2026-04-18
- [McSherry et al., Differential Dataflow, CIDR 2013](https://www.cidrdb.org/cidr2013/Papers/CIDR13_Paper111.pdf) — fetched 2026-04-18

## 6. Materialize

- **Primitive**: same as DD; every SQL view is a long-running dataflow maintaining its output.
- **Direction**: push.
- **Dirty**: arrangement + frontier.
- [McSherry et al., Materialize, VLDB 2023](https://materialize.com/wp-content/uploads/2023/05/materialize-vldb-2023.pdf) — fetched 2026-04-18

## 7. Flink / Spark Structured Streaming

- **Primitive**: Flink — record + watermark, Chandy-Lamport checkpoint barriers. Spark SS — micro-batch bounded by trigger interval.
- **Direction**: push (Flink), micro-batch push (Spark).
- **Dirty**: Flink watermarks advance, windows close. Spark RDD lineage re-executed per micro-batch.
- [Carbone et al., Flink, IEEE Data Eng. 2015](http://sites.computer.org/debull/A15dec/p28.pdf) — fetched 2026-04-18
- [Armbrust et al., Structured Streaming, SIGMOD 2018](https://cs.stanford.edu/~matei/papers/2018/sigmod_structured_streaming.pdf) — fetched 2026-04-18
- [Chandy/Lamport, distributed snapshots, TOCS 1985](https://lamport.azurewebsites.net/pubs/chandy.pdf) — fetched 2026-04-18

## 8. Incremental computation (pull + invalidate, memoized DAG)

- **Primitive**: computation graph of thunks (Acar), articulation points (Adapton), queries (Salsa) memoized on input fingerprints.
- **Direction**: pull with push-flavored invalidation.
- **Dirty**: per-node revision counter (Salsa); change-propagation DAG (Acar/Adapton); height-ordered recompute heap (Jane Street Incremental).
- Salsa red-green: input write marks dependents red; query read recomputes red nodes, re-greens if output hash matches (early cutoff).
- [Acar/Blelloch/Harper, AFP, TOPLAS 2006](https://www.cs.cmu.edu/~rwh/papers/afp/toplas06.pdf) — fetched 2026-04-18
- [Hammer et al., Adapton, PLDI 2014](https://www.cs.umd.edu/~mwh/papers/adapton.pdf) — fetched 2026-04-18
- [Salsa book](https://salsa-rs.github.io/salsa/) — fetched 2026-04-18
- [Jane Street Incremental](https://github.com/janestreet/incremental) — fetched 2026-04-18

## 9. Rust today

| Crate | Purpose |
|---|---|
| [salsa](https://github.com/salsa-rs/salsa) | memoized query DAG, revisions, red-green; engine behind rust-analyzer |
| [timely](https://github.com/TimelyDataflow/timely-dataflow) + [differential-dataflow](https://github.com/TimelyDataflow/differential-dataflow) | McSherry's crates; production at Materialize scale |
| [datafusion](https://datafusion.apache.org/) | Arrow-native vectorized engine; plan → physical ops → vector push loop |
| [arrow-rs](https://github.com/apache/arrow-rs) | columnar memory layout; lingua franca for vectorized Rust |
| [polars](https://github.com/pola-rs/polars) | chunked Arrow, vectorized DataFrame |

## Comparison table

| System | Model | Grain | Direction | Dirty | Language |
|---|---|---|---|---|---|
| Volcano | iterator | 1 tuple | pull | none | C++ |
| MonetDB/X100, DuckDB | vectorized | ~1024 rows | push | none | C++ |
| Photon | vectorized | Arrow batch | push | none | C++ |
| HyPer, Umbra | compiled | 1 tuple (fused) | push | none | C++/LLVM |
| Morsel | vec + schedule | 10k-100k rows | push+pull | none | C++ |
| Timely/DD | timestamped deltas | epoch batch | push | frontier | Rust |
| Materialize | DD over SQL | epoch batch | push | frontier | Rust |
| Flink | event-time stream | record + watermark | push | watermark | Java |
| Spark SS | micro-batch | trigger interval | push | lineage | Scala |
| Salsa/Adapton | memoized DAG | query node | pull + invalidate | rev counter | Rust/OCaml |
| DataFusion | vectorized | RecordBatch | push | none | Rust |

## Lessons for sprefa-shaped code-analysis runtime

- **Salsa query DAG at the top layer.** Each `CursorExpr` is a memoized node keyed by `(source_hash, config_hash)`; red-green cutoff is what makes 1000 reparses (G7) cheap.
- **DD-shaped delta contract for cross-file effects.** `(Cursor, site, diff)` triples, flushed on epoch boundaries matching source-change commits; arrangements are the natural home for cross-repo xrefs (G4/G5).
- **Keep the inner loop vectorized, DuckDB-style.** `Arc<[Cursor]>` is already a vector; no per-cursor virtual calls inside a hot op — batch traversal of the tree-sitter cursor then emit one slice.
- **Morsel pattern at repo granularity.** Sequential repos outside, work-steal files inside, respecting the 16GB budget by never buffering content-carrying cursors across op boundaries.
- **Watermarks = reader epochs.** A buffer-change watermark advances past git-blob + worktree layers only when all three reader layers agree; this is the discipline that makes `on_source_change` cancel-safe.
- **Push vs pull is not a choice per op.** Pull at the edge (LSP hover demand), push inside (`Op::pipe` streams). Salsa outer pull + DD inner push is the exact shape.
- **Invalidation is inherent, not bolted on.** Store Salsa revisions alongside `scanner_hash`; an op's `ExprDone` is a frontier advance; `MutationPrompt` acquires the next epoch's write lock.

## Sources

- [Graefe Volcano 1994](https://paperhub.s3.amazonaws.com/dace52a42c07f7f8348b08dc2b186061.pdf) — fetched 2026-04-18
- [MonetDB/X100 CIDR 2005](https://www.cidrdb.org/cidr2005/papers/P19.pdf) — fetched 2026-04-18
- [DuckDB SIGMOD 2019](https://duckdb.org/pdf/SIGMOD2019-demo-duckdb.pdf) — fetched 2026-04-18
- [Photon SIGMOD 2022](https://www.databricks.com/wp-content/uploads/2022/07/photon-published.pdf) — fetched 2026-04-18
- [Neumann VLDB 2011](https://www.vldb.org/pvldb/vol4/p539-neumann.pdf) — fetched 2026-04-18
- [Leis Morsel SIGMOD 2014](https://db.in.tum.de/~leis/papers/morsels.pdf) — fetched 2026-04-18
- [Naiad SOSP 2013](https://sigops.org/s/conferences/sosp/2013/papers/p439-murray.pdf) — fetched 2026-04-18
- [Differential Dataflow CIDR 2013](https://www.cidrdb.org/cidr2013/Papers/CIDR13_Paper111.pdf) — fetched 2026-04-18
- [Flink IEEE 2015](http://sites.computer.org/debull/A15dec/p28.pdf) — fetched 2026-04-18
- [Structured Streaming SIGMOD 2018](https://cs.stanford.edu/~matei/papers/2018/sigmod_structured_streaming.pdf) — fetched 2026-04-18
- [AFP TOPLAS 2006](https://www.cs.cmu.edu/~rwh/papers/afp/toplas06.pdf) — fetched 2026-04-18
- [Adapton PLDI 2014](https://www.cs.umd.edu/~mwh/papers/adapton.pdf) — fetched 2026-04-18
- [Materialize VLDB 2023](https://materialize.com/wp-content/uploads/2023/05/materialize-vldb-2023.pdf) — fetched 2026-04-18
- [Kersten VLDB 2018](https://www.vldb.org/pvldb/vol11/p2209-kersten.pdf) — fetched 2026-04-18
- [salsa](https://github.com/salsa-rs/salsa), [differential-dataflow](https://github.com/TimelyDataflow/differential-dataflow), [DataFusion](https://datafusion.apache.org/), [arrow-rs](https://github.com/apache/arrow-rs) — fetched 2026-04-18
