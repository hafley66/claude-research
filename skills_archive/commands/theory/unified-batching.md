---
description: Unified synthesis — reactive batching as one idea restated at every layer (FP theory, hardware rings, dataflow engines). One-page read before architecting a new runtime.
---

# unified-batching

## One claim

**Batching is the same design at every layer of the stack because every layer has a fixed per-operation cost it wants to amortize, and the cheapest way to amortize is a ring of submissions plus a flush edge.**

| Layer | Fixed cost | Ring | Flush edge | Grain |
|---|---|---|---|---|
| DRAM | row activation (~50 ns) | prefetcher | cache line fill | 64 B line / 8 KB row |
| CPU | decode slot | vector unit | instruction retire | SIMD lanes (4–64) |
| Syscall | mode switch (~1 µs) | io_uring SQ | `io_uring_enter` | N SQEs |
| NVMe | PCIe TLP | command queue | doorbell MMIO | 32 B commands |
| TCP | header + ACK | Nagle / TSO | MSS / `TCP_PUSH` | 64 KB super-seg |
| GPU | ioctl + state diff | command buffer | `vkQueueSubmit` | N draws |
| SQL op | virtual call | vector (~1024 rows) | pipeline breaker | 1024 rows |
| Saga effect | dispatch + channel | effect queue | tick boundary | N effects |
| Haxl fetch | round-trip | `Fetch` accumulator | monadic `>>=` | N requests |
| Build system | recompile | dirty set | dependency closure | N targets |
| Salsa | hash + lookup | query DAG | revision bump | N queries |
| rxjs DataLoader | microtask | key map | `process.nextTick` | N keys |
| React render | reconciliation | state queue | microtask boundary | N updates |

Every row is an instance of: producer fills ring → flush edge transfers ownership → consumer drains → completion posts back.

## Three complementary invariants

**1. Applicative-first composition** (Haxl, GHC ApplicativeDo).
Reserve `bind` / `await` for real data dependency. Default composition exposes independence so the scheduler sees siblings. Every sequential `>>=` is a flush edge; writing the code in a way that minimizes binds moves the flush edge outward and grows the batch.

**2. Static plan as first-class value** (Arrows, Free monads, Compiling to Categories).
The pipeline is a data structure, not a closure. Same AST drives: run, trace, explain, diff, compile. The compiler-community term is "data-centric compilation"; the FRP term is "signal function". sprefa's `Pipeline` enum is this.

**3. Delta in, delta out with cutoff** (Differential Dataflow, Adapton, Salsa).
Every op's signature is `batch → batch`; reparse is a delta not a restart; propagation stops when an op's output hash matches last run. This is why 1000 reparses can be O(changed) not O(total).

## The same pattern across scales

- **Nanoseconds**: SIMD batches 16 floats. Compiler-owned, invisible to you.
- **Microseconds**: io_uring batches N syscalls. Kernel API, visible SQ/CQ.
- **Milliseconds**: DuckDB batches 1024 rows. Query engine, `RecordBatch`.
- **Tens of ms**: React batches state updates per microtask. Scheduler-owned.
- **Seconds**: Differential Dataflow batches per epoch. Timestamp-owned.
- **Minutes**: Bazel batches a dirty-set rebuild. Dependency-owned.

Picking the grain is picking which of these you run at. A reactive code-analysis runtime runs at microtask-to-epoch scale: effect coalesce per tick (ms), query memoize per source-change (s).

## The sprefa synthesis

For a Rust reactive runtime doing code analysis at 500-repo scale:

1. **Inner loop: vectorized.** `Op::pipe` over `Arc<[Cursor]>` batches; op bodies iterate the slice once. DuckDB shape.
2. **Op boundary: applicative.** Sibling ops in a Fork see each other's effects in the same tick; interpreter coalesces by `batch_key`. Haxl shape.
3. **Pipeline structure: arrow.** `Pipeline` enum (Seq/Fork/Leaf) is the static plan; framework owns rewriting, ops own bodies. Arrow / Compiling-to-Categories shape.
4. **Reparse: delta.** `on_source_change` advances a revision counter; Salsa red-green marks dirty cone; cutoff fires when output hash matches. Salsa + Adapton shape.
5. **Cross-repo: epochs.** Each source-change is an epoch boundary; frontiers advance across reader layers (blob/WT/buffer) in order. DD/Flink shape.
6. **IO seam: ring.** Reader/Store/Mutations use bounded channels as SQ/CQ; `TaskGuard::drop` is the completion drain; `CancellationToken` is the queue-wide abort. io_uring shape.
7. **Plural is the only door.** `Reader::bytes_many`, `Store::load_many`, `batched_run(Vec<Self>)`. Singular becomes `call_many(vec![one])`. Persistent shape.

Each item is a different research tradition. All seven describe the same design.

## Related commands

- [/sagas:redux-saga-essence](../sagas/redux-saga-essence.md)
- [/sagas:applicative-batching](../sagas/applicative-batching.md)
- [/sagas:sprf-effect-runtime](../sagas/sprf-effect-runtime.md)
- [/theory:fp-reactive-batching](./fp-reactive-batching.md) — the FP theory deep dive
- [/theory:systems-batching](./systems-batching.md) — hardware rings from DRAM to GPU
- [/theory:dataflow-incremental](./dataflow-incremental.md) — Volcano → Salsa, DB execution history
- [/orchestrator:sprf-rx-runtime](../orchestrator/sprf-rx-runtime.md) — rxRust-on-top layer

## Canonical citations (date-stamped 2026-04-18)

- [Marlow et al., Haxl ICFP 2014](https://simonmar.github.io/bib/papers/haxl-icfp14.pdf) — batching is structural
- [McSherry et al., Differential Dataflow CIDR 2013](https://www.cidrdb.org/cidr2013/Papers/CIDR13_Paper111.pdf) — delta in / delta out
- [Mokhov/Mitchell/PJ, Build Systems à la Carte ICFP 2018](https://www.microsoft.com/en-us/research/uploads/prod/2018/03/build-systems.pdf) — Tasks/Rebuilder/Scheduler factoring
- [Hughes, Arrows SCP 2000](https://www.cse.chalmers.se/~rjmh/Papers/arrows.pdf) — static wiring
- [Acar, Self-Adjusting Computation CMU 2005](https://www.cs.cmu.edu/~rwh/students/acar.pdf) — cutoff theory
- [Boncz/Zukowski/Nes, MonetDB/X100 CIDR 2005](https://cidrdb.org/cidr2005/papers/P19.pdf) — vectorized execution
- [Leis et al., Morsel SIGMOD 2014](https://db.in.tum.de/~leis/papers/morsels.pdf) — work-stealing on batches
- [Axboe, io_uring](https://kernel.dk/io_uring.pdf) — kernel ring batching
- [Drepper, memory](https://www.akkadia.org/drepper/cpumemory.pdf) — DRAM rows
- [Elliott, Compiling to Categories ICFP 2017](http://conal.net/papers/compiling-to-categories/compiling-to-categories.pdf) — plan extraction
