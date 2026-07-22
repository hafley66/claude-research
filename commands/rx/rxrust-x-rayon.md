---
description: Parallel data processing with rxRust and rayon — hiding rayon inside observables, not the scheduler layer.
---

# rxrust-x-rayon

rxRust's SharedScheduler expects futures (tokio-shaped), while rayon runs closures. Attempting to implement SharedScheduler over rayon causes a fundamental impedance mismatch.

## Thesis

Do not reach for a custom `SharedScheduler` over rayon. Instead, hide rayon inside source observables: use `observable::create()` to spawn rayon work, then drive the subscriber from within rayon closures. Build a `par_map` operator on top via `flat_map + observable::create` for ergonomic parallel transformation.

This trades scheduler integration for composability: rayon scopes stay local, subscriber flow stays observable-shaped, and oversubscription is explicit (you control rayon thread count vs subscriptions).

## API shape

```rust
// Source observable: rayon work flows to subscriber
fn parallel_produce<T: Send + 'static>(
    producer: impl Fn(usize) -> T + Send + 'static,
    count: usize,
) -> impl Observable<Item = T, Err = ()> {
    observable::create(move |mut sub| {
        rayon::scope(|s| {
            for i in 0..count {
                let prod = &producer;
                s.spawn(move |_| {
                    if !sub.is_closed() {
                        sub.next(prod(i));
                    }
                });
            }
        });
        sub.complete();
    })
}

// par_map operator: transform in parallel via flat_map shim
pub trait ParMapExt<T: Send + 'static>: Observable<Item = T, Err = ()> + Sized {
    fn par_map<U: Send + 'static>(
        self,
        f: impl Fn(T) -> U + Send + Sync + 'static,
    ) -> impl Observable<Item = U, Err = ()> {
        self.flat_map(move |item| {
            observable::create(move |mut sub| {
                let result = f(item);
                if !sub.is_closed() {
                    sub.next(result);
                }
                sub.complete();
            })
        })
    }
}
```

## Gotchas

1. **Send + 'static only** — Rayon's `scope()` requires closures to be `'static`. Lifetime-carrying refs (ast-grep `Node<'r>`, `&str`) must be projected to owned types (`String`, `Arc<Node>`) before entering rayon scope.

2. **Lifetime stripping at the source** — If your upstream observable carries references, project them to owned before calling `par_map`. Do not try to carry the lifetime into the parallel closure.

3. **No nested par_map** — Rayon threads under rayon threads causes work-stealing contention and deadlock risk. Use `par_map` at one level; compose other operators linearly.

4. **Oversubscription is your problem** — `rayon::scope()` blocks until all spawned work completes. If subscriptions exceed rayon's thread pool size, you serialize. Monitor RSS and task count explicitly; the framework provides no backpressure signal.

5. **Subscriber closure holds no state across iterations** — Each rayon spawn sees a fresh clone of the closure. Reductions (fold, scan) must live in the rayon scope, not the subscriber.

## Canonical snippet

```rust
use rxrust::prelude::*;
use rayon;

// Parallel computation on owned data
observable::of(vec![1, 2, 3, 4, 5])
    .flat_map(|batch| {
        observable::create(move |mut sub| {
            rayon::scope(|s| {
                for item in batch {
                    s.spawn(move |_| {
                        let result = item * item;  // CPU work
                        if !sub.is_closed() {
                            sub.next(result);
                        }
                    });
                }
            });
            sub.complete();
        })
    })
    .subscribe(|x| println!("result: {}", x));

// Output: result: 1, result: 4, result: 9, result: 16, result: 25
// (order unspecified; rayon work-stealing reorders)
```

For ergonomic use, wrap flat_map in a helper:

```rust
fn par_each<T: Send + 'static>(
    items: Vec<T>,
    f: impl Fn(T) + Send + Sync + 'static,
) -> impl Observable<Item = (), Err = ()> {
    observable::create(move |mut sub| {
        rayon::scope(|s| {
            for item in items {
                s.spawn(move |_| {
                    f(item);
                    if !sub.is_closed() {
                        sub.next(());
                    }
                });
            }
        });
        sub.complete();
    })
}
```

## Sources

- [rxRust GitHub](https://github.com/rxRust/rxRust) — fetched 2026-04-18
- [rayon crates.io](https://docs.rs/rayon/latest/rayon/) — fetched 2026-04-18
- [rxrust::scheduler docs](https://docs.rs/rxrust/latest/rxrust/scheduler/) — fetched 2026-04-18
- [How Rust makes Rayon's data parallelism magical](https://developers.redhat.com/blog/2021/04/30/how-rust-makes-rayons-data-parallelism-magical) — fetched 2026-04-18
- [Implementing data parallelism with Rayon Rust](https://blog.logrocket.com/implementing-data-parallelism-rayon-rust/) — fetched 2026-04-18
