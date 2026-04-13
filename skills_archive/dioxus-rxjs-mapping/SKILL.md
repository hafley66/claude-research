---
name: dioxus-rxjs-mapping
description: RxJS to Dioxus/Rust reactive pattern translation -- Observable vs Signal, operator mapping, async streams, side effects, error handling, mental model table. Trigger on rxjs dioxus, observable signal, rxjs rust, reactive rust, rxjs equivalent dioxus, switchmap dioxus, combinelatest dioxus.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Mental model translation from RxJS reactive patterns to Dioxus/Rust. For developers coming from RxJS/ngrx/redux-observable who want to understand how those patterns map.

## The Fundamental Shift

RxJS Observables are **push-based streams of values over time**. Dioxus Signals are **reactive cells** -- a single value that can change, where reads are auto-tracked and writes trigger re-execution of subscribers.

A `Signal<T>` is closest to a `BehaviorSubject<T>` that you never call `.subscribe()` on. Reading it (`.read()`) inside a reactive context auto-creates a subscription. Writing triggers re-runs.

```typescript
// RxJS
const count$ = new BehaviorSubject(0);
count$.subscribe(val => console.log(val));
count$.next(count$.getValue() + 1);
```

```rust
// Dioxus
let mut count = use_signal(|| 0);
rsx! { "{count}" }  // auto-subscribes
count += 1;          // triggers re-render
```

## Subject Equivalents

| RxJS | Dioxus | Notes |
|---|---|---|
| `Subject<T>` | No direct equivalent | Signals always have current value. For fire-and-forget: channels via `use_coroutine` |
| `BehaviorSubject<T>` | `Signal<T>` | Both hold current value, notify on change. Signal auto-tracks. |
| `ReplaySubject<T>` | No equivalent | Accumulate into `Signal<Vec<T>>` manually |
| `AsyncSubject<T>` | `use_resource(...)` | Resolves a future, provides final value as `Option<Result<T, E>>` |

## Auto-tracking vs Explicit Subscribe

**RxJS**: subscriptions explicit and imperative. Call `.subscribe()`, manage `Subscription` lifecycle, call `.unsubscribe()`.

**Dioxus**: subscriptions implicit and declarative. Any `.read()` inside a reactive scope (component body, `use_memo`, `use_effect`) auto-registers. No `Subscription` object.

Key consequence: **signals only auto-subscribe inside reactive scopes.** Reading in event handlers or spawned futures does NOT subscribe.

```rust
// DOES subscribe (component body)
fn Counter() -> Element {
    let count = use_signal(|| 0);
    rsx! { "{count}" }  // re-renders when count changes
}

// Does NOT subscribe (event handler)
onclick: move |_| {
    let val = count.read();  // one-shot read
}
```

## Operator Mapping

| RxJS Operator | Dioxus Equivalent | How |
|---|---|---|
| `map(fn)` | `use_memo(move \|\| transform(signal()))` | Memo re-runs when signal changes, caches result |
| `filter(fn)` | `use_memo` returning `Option<T>` | Manual |
| `distinctUntilChanged` | **Built into `use_memo`** | Only propagates when `PartialEq` says value differs |
| `combineLatest([a$, b$])` | `use_memo(move \|\| (a(), b()))` | Read multiple signals in one memo |
| `withLatestFrom(b$)` | Just read `b` when needed | Signals always readable |
| `switchMap(fn)` | `use_resource` | Cancels previous future, spawns new on dependency change |
| `mergeMap(fn)` | `spawn(async { ... })` in effect | Each task runs independently, no auto-cancel |
| `debounceTime(ms)` | Manual via coroutine + timeout | See debounce pattern below |
| `throttleTime(ms)` | Manual via coroutine + interval | No built-in |
| `scan(fn, seed)` | `use_signal(seed)` + `use_effect` that accumulates | Manual |
| `tap(fn)` | `use_effect` | Runs side effects when dependencies change |
| `startWith(val)` | `use_signal(\|\| val)` | Signals always have initial value |
| `shareReplay(1)` | `Signal<T>` already does this | Shared (Copy) + holds current value |
| `take(n)` / `takeUntil` | No equivalent | Signals live for component lifetime; drop handles cleanup |
| `forkJoin([a$, b$])` | `tokio::join!(a, b)` in `use_resource` | Rust's join macro |
| `merge(a$, b$)` | `tokio::select!` or `futures::stream::select` | Inside async task |

### use_memo as your pipe chain

```typescript
// RxJS
const result$ = count$.pipe(
  map(x => x * 2),
  filter(x => x > 10),
  distinctUntilChanged()
);
```

```rust
// Dioxus: memo chain
let count = use_signal(|| 0);
let doubled = use_memo(move || count() * 2);
let result = use_memo(move || {
    let d = doubled();
    if d > 10 { Some(d) } else { None }
});
// distinctUntilChanged is automatic
```

### Debounce pattern

```rust
let debounced = use_signal(|| String::new());

use_coroutine(move |mut rx: UnboundedReceiver<String>| async move {
    while let Some(value) = rx.next().await {
        let mut latest = value;
        loop {
            match tokio::time::timeout(
                Duration::from_millis(300),
                rx.next()
            ).await {
                Ok(Some(newer)) => latest = newer,
                _ => break,
            }
        }
        debounced.set(latest);
    }
});
```

## Async Streams vs Observables

| Aspect | RxJS Observable | Rust `Stream` |
|---|---|---|
| Push vs Pull | Push (producer drives) | Pull (consumer polls via `.next().await`) |
| Backpressure | Must handle explicitly | Natural (consumer-driven) |
| Cancellation | `unsubscribe()` or `takeUntil` | Drop the future/stream |
| Error channel | Built into Observable | `Stream<Item = Result<T, E>>` |
| Multicast | `share()`, `shareReplay()` | Use channels for fan-out |
| Operators | 100+ built-in | `StreamExt`: `map`, `filter`, `take`, `skip`, `chain`, `zip`, `merge`, `fold`, `for_each` |

### Bridging streams to signals

Dioxus does not natively consume `Stream`. Bridge via `use_coroutine` or `spawn`:

```rust
let data = use_signal(|| vec![]);
use_coroutine(move |_rx: UnboundedReceiver<()>| async move {
    let mut stream = some_tokio_stream();
    while let Some(item) = stream.next().await {
        data.write().push(item);
    }
});
```

## use_coroutine as Epic/Effect Service

Closest to ngrx Effects or redux-observable epics:

```rust
enum Action { Search(String), LoadMore }

let results = use_signal(|| vec![]);
let handle = use_coroutine(move |mut rx: UnboundedReceiver<Action>| async move {
    while let Some(action) = rx.next().await {
        match action {
            Action::Search(query) => {
                let res = api::search(&query).await;
                results.set(res.unwrap_or_default());
            }
            Action::LoadMore => { /* ... */ }
        }
    }
});

rsx! { button { onclick: move |_| handle.send(Action::Search("foo".into())), "Search" } }
```

Processes sequentially by default (no switchMap). For cancellation, use `tokio::select!` or `AbortHandle`.

## Side Effects and Cleanup

| RxJS | Dioxus |
|---|---|
| `tap` | `use_effect` (runs after render) |
| `finalize` / `takeUntil` + `unsubscribe` | `use_drop` or effect cleanup closure |
| Subscription management | Automatic: signals drop with component |

```rust
use_effect(move || {
    let listener = setup_listener();
    move || { listener.remove(); }  // cleanup on re-run or unmount
});
```

## Error Handling

| RxJS | Dioxus |
|---|---|
| `catchError(err => of(fallback))` | `match` on `Result<T, E>` |
| `retry(3)` | Loop with counter in async task |
| `retryWhen(notifier)` | Call `resource.restart()` from button or timer |

```rust
let data = use_resource(move || async move {
    let mut attempts = 0;
    loop {
        match fetch_data().await {
            Ok(val) => return Ok(val),
            Err(e) if attempts < 3 => { attempts += 1; sleep(Duration::from_secs(1)).await; }
            Err(e) => return Err(e),
        }
    }
});
```

## Rust Reactive Crates

### rxrust
Direct RxJS port. Observable, Subject, BehaviorSubject, operators (map, filter, scan, merge, combine_latest, throttle_time, debounce_time, etc.). Does NOT integrate with Dioxus signals. Use inside async tasks, write results to signals. Maintenance slowed (2023-2024).

### futures-signals
Zero-cost FRP on `futures`. `Mutable<T>` (like BehaviorSubject), `Signal` trait with `map`, `dedupe`, `throttle`, `map_future`. `MutableVec<T>` with efficient diff-based list operations. Philosophically closer to Dioxus signals than rxrust. Separate reactive system, not wired into Dioxus rendering.

### Integration reality
None plug directly into Dioxus's reactive graph. The bridge is always: run reactive/stream logic in async task, write results to `Signal`, Dioxus handles rendering reactivity.

## Where the Model Breaks Down

1. **Higher-order Observables** (switchMap, concatMap, exhaustMap): only `use_resource` provides switchMap-like behavior. concatMap (queue) and exhaustMap (ignore while busy) require manual coroutine implementation.

2. **Multicasting** (share, refCount, publish): irrelevant. Signals are inherently shared (Copy) with no cold/hot distinction.

3. **Schedulers** (observeOn, subscribeOn): Dioxus rendering is single-threaded. Async work on tokio. No scheduling signals onto specific threads.

4. **Completion**: Observables complete. Signals never complete -- they exist for scope lifetime. Model as `Signal<Option<T>>` if needed.

5. **Backpressure**: Signals are synchronous writes, no overflow concept. For actual backpressure, use `tokio::sync::mpsc` (bounded channel) or `Stream` combinators.
