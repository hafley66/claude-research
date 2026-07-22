---
description: Mixing rayon and tokio correctly — thread pool coordination patterns, oversubscription failure mode, oneshot communication, thread budgets, cgroup pitfalls. Reference for CPU-heavy work in async code.
---

# rayon-x-tokio

Tokio runs I/O tasks; Rayon runs CPU tasks. Mixing them requires separation and coordination via `rayon::spawn + tokio::sync::oneshot`, not blocking the executor while waiting.

## Thesis

Tokio's `spawn_blocking` and `block_in_place` are intended for synchronous I/O (filesystem, synchronous APIs). CPU-heavy work belongs on Rayon's fixed-size pool. Coordinating the two requires dispatching Rayon work and awaiting its result on a oneshot channel, never blocking the Tokio executor thread itself.

## Failure mode

Both pools default to `available_parallelism()` (CPU core count). In a containerized environment, both spawn equal numbers of threads, causing 100% oversubscription. The Linux CPU scheduler throttles aggressively with N threads contending for N cores in short bursts (CFS throttling). PostHog observed 2+ second latency spikes from this configuration. Secondary failures: Tokio worker threads block while waiting for Rayon to complete (defeating work-stealing), and deep work queues explode during traffic spikes.

## Correct pattern

Spawn CPU work on Rayon, receive results via oneshot, never `.await` while holding Rayon's result lock:

```rust
use rayon::ThreadPool;
use tokio::sync::oneshot;

let pool = ThreadPool::new(num_cpus::get()).unwrap();

let (tx, rx) = oneshot::channel();
pool.spawn(move || {
    let result = expensive_cpu_work();
    let _ = tx.send(result);
});

let result = rx.await?;
```

Gate work queue depth with a semaphore to prevent explosion during traffic spikes:

```rust
let sem = Arc::new(tokio::sync::Semaphore::new(256));
let permit = sem.acquire().await?;
pool.spawn(move || {
    let _guard = permit; // hold permit until work completes
    expensive_work();
});
```

## Helper crates

- **tokio-rayon** (andybarron) — wraps `rayon::spawn + oneshot` into `tokio_rayon::spawn_async(|| cpu_work).await`. Handles channel plumbing.
- **async-rayon** — similar surface; provides `async_rayon::spawn(|| cpu_work).await` for offloading from async context.

Both abstract the dispatch pattern and provide `AsyncThreadPool` trait for customization.

## Tuning

Thread budget: Tokio gets `available_parallelism() / 2` (I/O threads mostly idle), Rayon gets full `available_parallelism()` (CPU-bound, will stay busy). Accept mild oversubscription on Tokio side since work is I/O-bound and threads park at `.await`. PostHog uses `num_cpus::get()` for both after dividing tokio by 2.

Semaphore capacity: Start at 256 or `available_parallelism() * 4`; increase if work queue measurement shows floor, decrease if memory use drifts.

## Gotchas

- **cgroup pitfall**: `available_parallelism()` reads cgroup **limit** (resource request), not containerized **quota** (what the scheduler enforces). Query cgroup v1 cpu.cfs_quota_us / cpu.cfs_period_us directly or use `num_cpus` crate which handles both v1/v2.
- **Not spawn_blocking**: CPU-heavy work on Tokio's blocking pool spawns unbounded threads; only use for synchronous I/O (file, database drivers that lack async).
- **Lock contention**: Oneshot is MPSC internally; sending from many Rayon tasks to one Tokio task stalls. Distribute results into separate channels or batch them.
- **Panic isolation**: Rayon panics poison the pool; use `std::panic::catch_unwind` or `.spawn_handler` to replace panicking tasks.

## Sources

- [PostHog: Untangling Tokio and Rayon in production — 2s to 94ms](https://posthog.com/blog/untangling-rayon-and-tokio) — fetched 2026-04-18
- [Alice Ryhl: Async: What is blocking?](https://ryhl.io/blog/async-what-is-blocking/) — fetched 2026-04-18
- [tokio-rayon GitHub — andybarron](https://github.com/andybarron/tokio-rayon) — fetched 2026-04-18
- [Rust forum: Can rayon and tokio cooperate?](https://users.rust-lang.org/t/can-rayon-and-tokio-cooperate/85022) — fetched 2026-04-18
- [Lobsters: Mixing rayon and tokio for fun and (hair) loss](https://lobste.rs/s/mebxps/mixing_rayon_tokio_for_fun_hair_loss) — fetched 2026-04-18
