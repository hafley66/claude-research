---
description: rxRust × tokio scheduler wiring, from_future/from_stream bridges, observe_on/subscribe_on contexts. Covers default feature flag, SharedScheduler shape, multi-runtime hazards.
---

# rxrust-x-tokio

## Thesis

rxRust's default `scheduler` feature pulls tokio for work dispatch and time-based operators (`interval`, `timer`, `delay`). `SharedScheduler` is tokio-shaped: spawns work via `spawn()` / `block_on()`. Bridges `from_future()` and `from_stream()` adapt std `Future` and `futures::Stream` into observables. `observe_on()` and `subscribe_on()` shift execution onto a scheduler context; beware Send+'static closure bounds when crossing `Shared` contexts. Disable default to bring your own executor.

## API surface

- `observable::from_future(future)` — wraps `Future<Output=T>` into single-emission observable
- `observable::from_stream(stream)` — wraps `Stream<Item=T>` into per-item observable; calls `next()` for each item
- `observe_on(scheduler)` — shift downstream ops to run on scheduler (Shared only; Local runs immediate)
- `subscribe_on(scheduler)` — shift source subscription to scheduler
- `SharedScheduler::new(handle)` — wraps tokio `JoinHandle`-spawning closure; compatible with `tokio::runtime::Handle::current()`
- Time ops: `interval(duration)`, `timer(duration, interval)`, `delay(duration)` all require scheduler feature

## Gotchas

- **Scheduler feature flag** — default enabled. Disable via `default-features = false` in `Cargo.toml`, then no tokio; you must implement `SharedScheduler` (or stick `Local`). Build fails silently if you call time ops without it.
- **Multi-runtime collision** — `observe_on()` / `subscribe_on()` require `tokio::runtime::Handle::current()` to exist. Running rxRust in a non-tokio executor (async-std, custom) loses default scheduler; implement your own via `SharedScheduler` trait.
- **Send+'static across observe_on** — `Shared` context forces closures + types through scheduler spawn boundary. Borrowed lifetimes (`&str`, `Node<'r>`) cannot cross. Project to owned (`.to_string()`) at observable boundary.
- **from_future blocks current task** — `from_future()` waits inside `block_on()` equivalent; if source future blocks tokio thread, downstream operators stall. Use `tokio::spawn()` wrapper for non-blocking background work.
- **late subscriber misses events** — `from_stream()` does not replay; late subscribers on non-buffered source miss items. Use `ReplaySubject` or `BehaviorSubject` if ordering is critical.

## Canonical snippet

```rust
use rxrust::prelude::*;
use std::time::Duration;
use tokio::runtime::Runtime;

let rt = Runtime::new().unwrap();

// from_future: wrap tokio task
rt.block_on(async {
    observable::from_future(async { 42 })
        .map(|x| x * 2)
        .subscribe(|x| println!("future: {}", x));
});

// from_stream + observe_on
let (tx, rx) = tokio::sync::mpsc::channel(10);
observable::from_stream(
    tokio_stream::wrappers::ReceiverStream::new(rx)
)
    .observe_on(tokio::runtime::Handle::current().into())
    .filter(|x| x % 2 == 0)
    .subscribe(|x| println!("stream: {}", x));

// spawn sender in background
rt.spawn(async move {
    for i in 0..5 { tx.send(i).await.ok(); }
});
```

Custom scheduler (disable default):

```rust
// Cargo.toml: rxrust = { version = "...", default-features = false }

use rxrust::scheduler::SharedScheduler;

let handle = tokio::runtime::Handle::current();
let scheduler = SharedScheduler::new(move |task| {
    let h = handle.clone();
    h.spawn(async move { task.await })
});

observable::of(1, 2, 3)
    .observe_on(scheduler)
    .subscribe(|x| println!("{}", x));
```

## Sources

- [rxRust GitHub](https://github.com/rxRust/rxRust) — fetched 2026-04-18
- [rxrust::scheduler docs](https://docs.rs/rxrust/latest/rxrust/scheduler/) — fetched 2026-04-18
- [rxrust crates.io](https://crates.io/crates/rxrust) — fetched 2026-04-18
- [Tokio runtime docs](https://docs.rs/tokio/latest/tokio/runtime/) — fetched 2026-04-18
