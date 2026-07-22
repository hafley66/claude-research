---
description: redux-saga pattern distilled + Rust crate landscape for saga-shaped ops (genawaiter, async-stream, effing-mad, reffect). Load when designing pure-op + interpreter runtimes.
---

# redux-saga-essence

## The pattern in 100 words

Ops are pure generator functions that `yield` plain *Effect descriptions* (`call(fn,args)`, `put(action)`, `take(pattern)`, `select(fn)`, `fork(saga)`, `all`, `race`, `cancel`). A central middleware/interpreter reads each yielded effect, performs it, and resumes the generator with the result via `gen.next(value)`. Ops stay pure (produce descriptions only); interpreter owns IO, cancellation, composition. Sagas compose via `fork` (detached child with supervisor tree) and `take*` (listen on action bus). Test = assert the yielded Effect objects, no mocks.

## Invariants

1. **Op = pure description producer.** No IO inside the op; only yields values of type `Effect`.
2. **Interpreter owns IO.** One chokepoint consumes the yield stream, dispatches, resumes.
3. **Resumption is bidirectional.** `gen.next(result)` feeds the effect's result back in. This is what distinguishes a saga from an `Iterator`.
4. **Composition via bus.** `fork` creates a supervised child; cancellation cascades through the task tree.
5. **Batching is interpreter-local.** Because every effect goes through one point, same-kind effects within a tick can coalesce. Haxl makes this first-class (see applicative-batching.md); redux-saga leaves it implicit.
6. **Determinism for test.** Assert `gen.next()` yields expected Effect; no IO, no mocks.

## Rust crate landscape (April 2026)

| Crate | Version | Stable | Mechanism | Notes |
|---|---|---|---|---|
| [genawaiter](https://docs.rs/genawaiter/0.99.1) | 0.99.1 | yes | async block + thread-local yield smuggle | `Co<Y, R>::yield_` gives resume args; sync + Send variants; zero-alloc path |
| [async-stream](https://docs.rs/async-stream/0.3.6) | 0.3.6 | yes | proc-macro rewrites `yield` → channel send | one-way, no resume value; cheap |
| [futures::stream::unfold](https://docs.rs/futures/latest/futures/stream/fn.unfold.html) | part of futures 0.3 | yes | closure state machine | no macro, collapses past 2 yield points |
| std `Coroutine` | nightly only ([#43122](https://github.com/rust-lang/rust/issues/43122)) | no | native `yield` with resume arg | `gen {}` keyword reserved in 2024 edition; block semantics still nightly |
| [effing-mad](https://github.com/rosefromthedead/effing-mad) | 0.1.0 | nightly | coroutine + coproduct of effect types | dormant since ~2023, research-grade |
| [reffect](https://github.com/js2xxx/reffect) | unreleased | nightly | `#[effectful]` + `#[group_handler]` | git-only |
| [effective](https://docs.rs/effective) | 0.3.1 | yes | single trait generalizing Iterator/Future/Try | not an effect DSL; adapter chains only |
| [eff](https://docs.rs/eff) | 0.1.0 | nightly (2019) | dead | skip |

## Four saga-op sketches in Rust

**A. genawaiter sync + resume args (recommended for stable)**

```rust
use genawaiter::{sync::Gen, sync::Co};

enum Effect { Read(FilePath), Parse(Bytes), Emit(Cursor) }
enum EffectOut { Bytes(Bytes), Tree(Tree), Unit }

fn saga_op(root: FilePath) -> Gen<Effect, EffectOut, impl Future<Output = ()>> {
    Gen::new(|co: Co<Effect, EffectOut>| async move {
        let EffectOut::Bytes(b) = co.yield_(Effect::Read(root)).await else { return };
        let EffectOut::Tree(t)  = co.yield_(Effect::Parse(b)).await   else { return };
        co.yield_(Effect::Emit(Cursor::from(t))).await;
    })
}
```

**B. async-stream (one-way)**

```rust
fn saga_op(root: FilePath) -> impl Stream<Item = Effect> {
    async_stream::stream! {
        yield Effect::Read(root);
        // cannot observe the read's result here; fire-and-forget only
    }
}
```

**C. Hand-rolled enum + mpsc (matches existing sprefa shape)**

```rust
trait SagaOp {
    fn step(&mut self, last: Option<EffectOut>) -> Option<Effect>;
}
```

**D. Effect trait + batching interpreter (the Haxl shape)**

```rust
trait Effect: Send + 'static {
    type Out: Send;
    fn batch_key(&self) -> BatchKey;
    fn run_batch(batch: Vec<Self>) -> Vec<Self::Out> where Self: Sized;
}
```

See sprf-effect-runtime.md for how this lands on sprefa's `Op::pipe`.

## Actor frameworks as interpreter

[ractor](https://docs.rs/ractor) / [kameo](https://docs.rs/kameo) / [actix](https://docs.rs/actix) give supervisor trees and mailboxes — redux-saga's `fork`/`cancel`/action-bus map to `spawn_link` / `cancel` / `mpsc`. Not a saga library, but the primitives are isomorphic to saga composition. [Alice Ryhl's actors with tokio](https://ryhl.io/blog/actors-with-tokio/) is the idiomatic writeup.

## Tradeoffs

- **Purity cost.** Every effect crosses a dyn boundary + channel. Amortized by batching when N+1 exists, net loss when it does not. Gate per op (`trait BatchingOp`), not universal.
- **Generators on stable.** genawaiter pays one `Poll::Pending` round per yield + one Arc<UnsafeCell<...>> for the resume slot. async-stream is cheaper but one-way. Native Coroutine remains nightly.
- **Cancellation.** Already handled by `TaskGuard` + `CancellationToken`; saga `fork`/`cancel` maps 1:1.
- **Testability.** Win. `step()` + `Vec<Effect>` assertions beat mocking `Reader`.
- **Ergonomics.** Variant A (genawaiter) ≈ real redux-saga feel; variant C (hand-rolled enum) wins on zero dependency.

## Sources

- [redux-saga Effect creators](https://redux-saga.js.org/docs/api/) — fetched 2026-04-18
- [genawaiter docs.rs](https://docs.rs/genawaiter/0.99.1) — fetched 2026-04-18
- [async-stream docs.rs](https://docs.rs/async-stream/0.3.6) — fetched 2026-04-18
- [Rust Coroutine tracking #43122](https://github.com/rust-lang/rust/issues/43122) — fetched 2026-04-18
- [RFC 3513 gen blocks](https://rust-lang.github.io/rfcs/3513-gen-blocks.html) — fetched 2026-04-18
- [effing-mad](https://github.com/rosefromthedead/effing-mad) — fetched 2026-04-18
- [reffect](https://github.com/js2xxx/reffect) — fetched 2026-04-18
- [Alice Ryhl — Actors with Tokio](https://ryhl.io/blog/actors-with-tokio/) — fetched 2026-04-18
