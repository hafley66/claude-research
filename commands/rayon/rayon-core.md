---
description: rayon fundamentals — par_iter/par_bridge/scope/spawn API, work-stealing scheduler, panic propagation, ordering guarantees. Reference for data parallelism on fixed-size thread pools.
---

# rayon-core

rayon is a lightweight data-parallelism library that converts sequential computations into parallel operations via a work-stealing scheduler. Threads pull from local task deques first, then steal from other threads when idle.

## API surface

- `par_iter()` / `par_iter_mut()` / `into_par_iter()` — convert iterators to parallel variants; preserves order
- `par_chunks(n)` — partition into chunks, process in parallel; preserves order
- `par_bridge()` — bridge sequential iterator to parallel consumer; does not preserve order; mutex bottleneck on `next()`
- `scope(|s| { ... })` / `scope_fifo(|s| { ... })` — fork-join scopes; `spawn()` queues closures; all block until spawn-set drains
- `ThreadPool` / `ThreadPoolBuilder` — custom pools; `build()` local, `build_global()` one-time global
- `join(a, b)` — subdivide work into two parallel pieces; simple two-way fork
- `Configuration::num_threads()` / `current_num_threads()` / `available_parallelism()` — pool sizing; reads `RAYON_NUM_THREADS` env var or CPU count

## Gotchas

- **Work-stealing latency** — idle threads probe other deques before sleeping. Broadcasts execute after local work drains, before stealing. High contention + migration across NUMA nodes can degrade L3 cache; pin threads via `spawn_handler()` if needed.
- **Panics propagate** — if any spawned task panics, exactly one panic is re-raised after all threads finish. `spawn()` API has no obvious panic site, so default handler aborts process if panic is unobserved.
- **Nested pools** — creating a ThreadPool inside a rayon task is safe but redundant; prefer a single global pool or `scope()` for structured concurrency.
- **Calling from tokio context** — rayon spawns OS threads, not async tasks. Use `tokio::task::spawn_blocking()` to bridge, but configure rayon's `spawn_handler()` to call `spawn_blocking` explicitly or rayon will consume threads not accounted in tokio's blocking budget.
- **par_bridge ordering lost** — resulting ParallelIterator is unordered; `next()` serializes via Mutex, so becomes a bottleneck if the source iterator can't keep up with parallel demand.
- **available_parallelism reads cgroup limit, not request** — in K8s/container environments, this reads the pod's CPU limit, not guaranteed request. Without explicit `num_threads()` override, rayon can spawn threads with no guaranteed CPU time, causing oversubscription if tokio does the same.

## Canonical snippet

```rust
use rayon::prelude::*;

// simple parallel iteration
(0..1000).into_par_iter()
    .map(|x| x * x)
    .filter(|x| x % 2 == 0)
    .collect()

// custom pool
let pool = rayon::ThreadPoolBuilder::new()
    .num_threads(8)
    .thread_name(|i| format!("worker-{i}"))
    .build()
    .unwrap();

pool.install(|| {
    (0..100).into_par_iter().for_each(|x| println!("{x}"));
});

// fork-join scope
rayon::scope(|s| {
    s.spawn(|s| {
        // nested spawns allowed
        s.spawn(|_| println!("task 1"));
    });
    s.spawn(|_| println!("task 2"));
});
```

## Left-joins

- [rayon × tokio](./rayon-x-tokio.md) — bridging work-stealing and async; spawn_blocking wiring; avoiding oversubscription in containers
- [rayon × ast-grep](./rayon-x-ast-grep.md) — parallelizing tree walks; par_bridge() on file iterators; owned vs borrowed node types

## Sources

- [rayon crates.io](https://crates.io/crates/rayon) — fetched 2026-04-18
- [rayon docs.rs](https://docs.rs/rayon/latest/rayon/) — fetched 2026-04-18
- [Untangling Tokio and Rayon in production (PostHog)](https://posthog.com/blog/untangling-rayon-and-tokio) — fetched 2026-04-18
- [Async: What is blocking (Alice Ryhl)](https://ryhl.io/blog/async-what-is-blocking/) — fetched 2026-04-18
- [Rayon FAQ (GitHub)](https://github.com/rayon-rs/rayon/blob/main/FAQ.md) — fetched 2026-04-18
