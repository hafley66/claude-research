---
description: rxRust v1 reference — context model (Local/Shared), Scheduler trait, operator inventory, gaps vs rxjs. Load before composing rx pipelines in Rust.
---

# rxrust-core

rxRust is a Rust port of Reactive Extensions. v1 introduced a Context-driven architecture that picks Local (Rc/RefCell) vs Shared (Arc/Mutex) at compile time based on whether the stream crosses threads.

## API surface

- `observable::create(|subscriber| { ... })` — hand-rolled source; call `subscriber.next/complete/error`
- `observable::from_iter`, `from_future`, `from_stream`, `interval`, `timer`, `of`, `empty`, `never`
- `Subject` / `BehaviorSubject` / `ReplaySubject` — multicast entry points
- Operators: `map`, `filter`, `flat_map`, `merge_all`, `scan`, `take`, `skip`, `debounce_time`, `throttle_time`, `distinct_until_changed`, `combine_latest`, `with_latest_from`, `zip`, `buffer_count`, `window`, `group_by`, `share`, `ref_count`
- Scheduling: `observe_on(scheduler)`, `subscribe_on(scheduler)`
- Scheduler trait lives in `rxrust::scheduler`; `SharedScheduler` expects future-spawning (tokio-shaped), `LocalScheduler` runs on current thread

## Gotchas

- `Shared` context requires every value and closure to be `Send + 'static`. Lifetime-carrying types (ast-grep `Node<'r>`, `&str`) cannot cross a `Shared` operator boundary — project to owned at the source.
- Default `scheduler` feature pulls tokio. Disable via `default-features = false` then implement your own, but rayon cannot be a drop-in because it runs closures, not futures.
- Operator coverage is thinner than rxjs. Missing or different: `shareReplay({ refCount: true, bufferSize })` semantics, `exhaustMap`, `switchMap` (present as `switch_map` but edge cases differ), higher-order stream operators.
- Backpressure is cooperative. A fast producer inside `observable::create` must check `subscriber.is_closed()` or bound its own queue; no automatic pull-based flow control.
- `Subject` is not buffered by default; late subscribers miss events. Use `ReplaySubject` or `BehaviorSubject` for warm state.

## Canonical snippet (Rust)

```rust
use rxrust::prelude::*;

let subject = Subject::<i32, ()>::new();
subject.clone()
    .filter(|x| x % 2 == 0)
    .map(|x| x * 10)
    .subscribe(|x| println!("{x}"));

for i in 0..5 { subject.next(i); }
subject.complete();
```

Custom source emitting from a background thread (the shape to use for rayon/walker producers):

```rust
observable::create(move |sub| {
    std::thread::spawn(move || {
        for item in produce() {
            if sub.is_closed() { return; }
            sub.next(item);
        }
        sub.complete();
    });
})
```

## Left-joins

- [rxrust × rayon](./rxrust-x-rayon.md) — do not implement SharedScheduler over rayon; hide rayon inside source observables
- [rxrust × tokio](./rxrust-x-tokio.md) — default scheduler wiring, `from_future` bridge
- [rxrust × ast-grep](./rxrust-x-ast-grep.md) — project owned `Hit` types; strip `'r` at the source

## Sources

- [rxRust GitHub](https://github.com/rxRust/rxRust) — fetched 2026-04-18
- [rxrust crates.io](https://crates.io/crates/rxrust) — fetched 2026-04-18
- [rxrust::scheduler docs](https://docs.rs/rxrust/latest/rxrust/scheduler/) — fetched 2026-04-18
- [rxRust v1 CHANGELOG (context-driven architecture)](https://github.com/rxRust/rxRust/blob/master/CHANGELOG.md) — fetched 2026-04-18
- [rxRust missing features](https://github.com/rxRust/rxRust/blob/master/missing_features.md) — fetched 2026-04-18
- [Intro to rxRust (user forum announcement)](https://users.rust-lang.org/t/introduce-rxrust-reactive-extensions-for-rust/30902) — fetched 2026-04-18
