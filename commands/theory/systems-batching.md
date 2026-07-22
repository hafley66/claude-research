---
description: Hardware batching theory — io_uring, NVMe, TCP TSO, SIMD, GPU command buffers, DRAM rows. Every layer converges on {queue, worker, doorbell}. Load when designing the IO seam of a reactive runtime.
---

# systems-batching

## Thesis

Every hardware boundary with a fixed per-operation cost converges on the same three-part shape: a **submission queue** the producer fills, a **doorbell/flush** that hands a batch off, and a **completion queue** the consumer drains. Syscalls, NVMe, TCP, SIMD, vectorized SQL, GPU command buffers, and DRAM rows all amortize a fixed overhead (mode switch, PCIe TLP, decode bookkeeping, row activation) across N operations. The per-op curve is hyperbolic: `cost(N) = fixed/N + variable`, asymptoting to `variable` as N grows. A software runtime that ignores this shape at its own IO seam gives up the same throughput factor the hardware gave up before it adopted rings.

## 1. io_uring (Linux 5.1+)

- **Insight.** Shared-memory SQ/CQ rings batch N syscalls into one `io_uring_enter` (zero, with SQPOLL).
- **Mechanism.** Producer writes SQEs into a ring mmap'd with the kernel, bumps the tail, optionally rings a doorbell. Kernel drains, posts CQEs. `IORING_SETUP_SQPOLL` = a kernel thread polls the tail, syscall disappears entirely.
- **Rust.** `tokio-uring`, `glommio`, `io-uring` (low-level), `monoio`.
- [Axboe, "Efficient IO with io_uring"](https://kernel.dk/io_uring.pdf) — fetched 2026-04-18

## 2. NVMe command queues

- **Insight.** NVMe spec: up to 64K submission queues × 64K depth. QD=1 leaves ~90% of SSD IOPS on the floor.
- **Mechanism.** Per-core SQ/CQ pair in host DRAM, 32-byte commands, one MMIO doorbell write per batch amortizes the PCIe round trip. IOPS-vs-QD curves flatten at QD 32–128 (consumer), QD 256+ (enterprise).
- **Rust.** `vroom` (userspace NVMe), `spdk-rs`.
- [NVM Express Base Spec 2.0 §3.3](https://nvmexpress.org/specifications/) — fetched 2026-04-18

## 3. TCP batching

- **Insight.** Small-packet workloads dominated by per-packet header + per-syscall cost. TSO/GSO push segmentation to NIC; `TCP_CORK`/`MSG_MORE` holds bytes until a full MSS.
- **Mechanism.** Nagle coalesces sub-MSS writes against un-ACKed data; TSO hands 64KB super-segments to the NIC; `sendmmsg`/`recvmmsg` batch N datagrams per syscall; epoll edge-triggered forces batched drain.
- **Rust.** `tokio::net` (edge-triggered via mio), `socket2` for `TCP_CORK`, `nix::sys::socket::sendmmsg`.
- [Corbet, LWN on TSO](https://lwn.net/Articles/564978/) — fetched 2026-04-18

## 4. CPU SIMD / vectorization

- **Insight.** One vector instruction retires 4/8/16/64 scalar ops; amortized cost is (decode + issue) / lane count.
- **Mechanism.** SSE (128b), AVX/AVX2 (256b), AVX-512 (512b), ARM SVE. LLVM auto-vectorizes counted loops when aliasing, alignment, trip count permit. Intrinsics and portable SIMD expose lanes explicitly.
- **Rust.** `core::simd` (nightly `portable_simd`), `std::arch` (stable intrinsics), `wide`, `pulp`, `multiversion`.
- [Intel Intrinsics Guide](https://www.intel.com/content/www/us/en/docs/intrinsics-guide/index.html) — fetched 2026-04-18
- [Rust portable_simd #86656](https://github.com/rust-lang/rust/issues/86656) — fetched 2026-04-18

## 5. Vectorized database execution

- **Insight.** Tuple-at-a-time Volcano loses to batch-at-a-time; 1024-row vectors fit L1 and let the inner kernel auto-vectorize.
- **Mechanism.** MonetDB/X100 introduced column vectors as execution unit (CIDR 2005). DuckDB: 2048 rows. ClickHouse blocks: 65536. Photon compiles vector kernels. Morsel-driven parallelism (Leis SIGMOD 2014) adds push-based scheduling over ~100K-row morsels. Kersten VLDB 2018 shows vectorization and compilation converge within a constant factor when both are tuned.
- **Rust.** `datafusion` (Arrow RecordBatch, 8192 default), `polars` (chunked Arrow).
- [Boncz/Zukowski/Nes, MonetDB/X100, CIDR 2005](https://cidrdb.org/cidr2005/papers/P19.pdf) — fetched 2026-04-18
- [Kersten, compiled+vectorized, VLDB 2018](https://www.vldb.org/pvldb/vol11/p2209-kersten.pdf) — fetched 2026-04-18

## 6. GPU command buffers

- **Insight.** Per-draw-call CPU overhead (validation, state diff, ioctl) is fixed; indirect and bindless draws move parameters into GPU buffers so one submit dispatches thousands.
- **Mechanism.** Vulkan `VkCommandBuffer` recorded once, submitted via `vkQueueSubmit` with N buffers. `vkCmdDrawIndexedIndirectCount` reads draw args from a GPU buffer. Metal `MTLIndirectCommandBuffer`. WebGPU `GPUCommandEncoder`. Mesa/panfrost + AGX (Rosenzweig) expose the same ring-doorbell shape at the kernel driver seam.
- **Rust.** `wgpu`, `ash`, `vulkano`, `metal-rs`.
- [Vulkan 1.3 §5 Command Buffers](https://registry.khronos.org/vulkan/specs/1.3-extensions/html/vkspec.html#commandbuffers) — fetched 2026-04-18

## 7. Memory access batching

- **Insight.** DRAM charges for row activation, not column access; sequential access amortizes `tRCD` (~15 ns row hit vs ~50 ns row miss) across a whole row (~8 KB).
- **Mechanism.** L1 stride + L2 streamer prefetchers speculatively batch cache lines ahead of demand. GPU memory coalescing merges 32 threads' loads into one 128-byte transaction when lanes hit consecutive addresses.
- **Rust.** `core::intrinsics::prefetch_read_data`, `packed_simd`/`wide` for gather/scatter lowering.
- [Drepper, "What Every Programmer Should Know About Memory"](https://www.akkadia.org/drepper/cpumemory.pdf) — fetched 2026-04-18

## 8. The common shape

- **Insight.** Every layer converges on `{queue, worker, doorbell}` because every layer has a fixed per-op cost to amortize: mode switch (syscall), PCIe TLP (NVMe/GPU), header+ACK (TCP), decode slot (SIMD), interpreter dispatch (SQL), row activation (DRAM).
- **Mechanism.** Producer enqueues into bounded ring; flush signal (doorbell, syscall, `TCP_PUSH`, `vkQueueSubmit`, `commit`) transfers ownership; consumer drains and posts completions. Backpressure = ring fullness.

## Latency / throughput tradeoff table

| Operation | Per-op latency (unbatched) | Batch amortization curve |
|---|---|---|
| `read()` syscall | ~1 µs mode switch | 1/N → ~50 ns/op at SQPOLL |
| NVMe 4 KB read | ~80 µs @ QD1 | knee QD32, plateau QD128 (~500K IOPS) |
| TCP small packet | ~1 µs syscall + ~40B hdr | linear-in-N bytes until MSS, step at TSO 64KB |
| Scalar add | ~0.3 ns | 1/lane; AVX-512 = 1/16 for f32 |
| Row through SQL op | ~50–200 ns dispatch | 1/N; inner loop SIMD-izes at N≥256 |
| GPU draw call | ~1–10 µs CPU overhead | 1/N with indirect; flat after buffer reuse |
| DRAM random load | ~50 ns row miss | 1× row hit (~15 ns); coalesced GPU = 32× per TLP |

## Lessons for a software reactive runtime

- **Treat the op boundary as a ring, not a call.** `BoxStream<Arc<[Cursor]>>` already models SQ batching; keep the batch (`Arc<[_]>`), never fan out to `Vec<Cursor>` per item.
- **Put the doorbell where the fixed cost lives.** For sprefa v2: parse, reader open, store write. Batch at those seams; let cheap interior ops stream.
- **Bounded rings give backpressure for free.** `runtime.buffer_size` is ring depth; depth tunes latency vs throughput the same way NVMe QD does.
- **Amortize parse + IO like TSO amortizes MSS.** Collect cursors until a natural flush (end of file, end of pass, cancellation), then hand the batch to the reader/store in one shot.
- **Sequential access beats clever access.** Reader ordering respecting blob/WT/buffer layering is the DRAM-row-hit analog; random access pays the row-miss cost every time.
- **Cancellation is the completion-queue drain.** `TaskGuard::drop` + `CancellationToken` is the CQ-side equivalent of `vkQueueWaitIdle` before tearing down command buffers.
- **Vectorize the inner kernel, dispatch the outer loop.** Vectorized-DB lesson: write op bodies as tight loops over `&[Cursor]` so LLVM SIMD-izes; keep the `dyn Op` dispatch one level out.

## Sources

- [kernel.dk io_uring](https://kernel.dk/io_uring.pdf) — fetched 2026-04-18
- [NVMe Base Spec 2.0](https://nvmexpress.org/specifications/) — fetched 2026-04-18
- [LWN TSO/FQ](https://lwn.net/Articles/564978/) — fetched 2026-04-18
- [LWN TCP segmentation offload](https://lwn.net/Articles/244631/) — fetched 2026-04-18
- [Intel Intrinsics Guide](https://www.intel.com/content/www/us/en/docs/intrinsics-guide/index.html) — fetched 2026-04-18
- [Rust portable_simd #86656](https://github.com/rust-lang/rust/issues/86656) — fetched 2026-04-18
- [MonetDB/X100 CIDR 2005](https://cidrdb.org/cidr2005/papers/P19.pdf) — fetched 2026-04-18
- [Kersten VLDB 2018](https://www.vldb.org/pvldb/vol11/p2209-kersten.pdf) — fetched 2026-04-18
- [Leis Morsel-Driven SIGMOD 2014](https://db.in.tum.de/~leis/papers/morsels.pdf) — fetched 2026-04-18
- [DuckDB why](https://duckdb.org/why_duckdb) — fetched 2026-04-18
- [Vulkan 1.3 spec](https://registry.khronos.org/vulkan/specs/1.3-extensions/html/vkspec.html#commandbuffers) — fetched 2026-04-18
- [Drepper memory](https://www.akkadia.org/drepper/cpumemory.pdf) — fetched 2026-04-18
- [Latency numbers gist](https://gist.github.com/jboner/2841832) — fetched 2026-04-18
- [tokio-uring](https://github.com/tokio-rs/tokio-uring) — fetched 2026-04-18
- [glommio](https://github.com/DataDog/glommio) — fetched 2026-04-18
