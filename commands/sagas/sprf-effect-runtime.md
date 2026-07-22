---
description: Opinionated shape for sprefa v2 — ops yield pure Effect descriptions, interpreter batches per-tick using Haxl collapse, rxRust wraps the whole runtime as Observables. Load before designing op effect surfaces.
---

# sprf-effect-runtime

## Premise

Combine three ideas already researched:

- **redux-saga**: ops are pure descriptions of effects; one interpreter drives IO.
- **Haxl**: batching is structural, not scheduled; Applicative collapse per tick.
- **rxRust** (from sprf-rx-runtime.md): one time-language on top; everything is Observable.

Result: plugin ops that are testable by effect-value equality, pipelines that collapse N+1 automatically, reactive runtime that looks like rxjs from the outside.

## Layer stack

```
user code:    /rx:rxrust-core          → Observable<Cursor>
              operators: debounce, combine_latest, share
              ────────────────────────────────────────────
saga layer:   Op::pipe emits Effect descriptions
              interpreter drains per tick
              ────────────────────────────────────────────
batch layer:  group Effects by batch_key
              dispatch batched_run per bucket
              route results back via oneshot
              ────────────────────────────────────────────
primitives:   rayon pool, tokio runtime, ignore::WalkParallel
              ast-grep-core for matching
```

## The seven invariants

1. **Ops yield descriptions, never perform IO.** `Op::step` / `Op::pipe` returns `Effect` or `Cursor`, no `Reader::bytes` in op body.
2. **Interpreter owns IO.** Single drain-loop per pipeline run.
3. **Tick = cancellation horizon.** Token-cancel = flush; fresh token = new batch window. Matches existing `TaskGuard` discipline.
4. **batch_key is op-declared.** `Effect::batch_key(&self) -> (Kind, Repo, Rev, Path, ...)`. Interpreter never invents keys.
5. **Batched result routing is structural.** Each yielded Effect carries an oneshot Sender; interpreter fills, op resumes.
6. **Plural is the only door.** `batched_run(Vec<Self>) -> Vec<Out>`. Singular case is `batched_run(vec![one])`.
7. **rxRust wraps, does not penetrate.** Outer code sees `Observable<Cursor>`; interpreter lives inside one `observable::create` source. See rxrust-x-rayon pattern.

## Canonical Effect trait

```rust
pub trait Effect: Send + 'static {
    type Out: Send + 'static;

    fn batch_key(&self) -> BatchKey;

    fn run_batch(batch: Vec<Self>, cx: &OpCtx) -> Vec<Self::Out>
    where Self: Sized;
}

pub enum EffectOr<T> {
    Eff(Box<dyn AnyEffect>),   // erased Effect + oneshot Sender inside
    Out(T),                     // the op's normal output (Cursor)
}
```

## Op shape

```rust
pub trait Op: Send + Sync {
    fn pipe<'a>(
        &'a self,
        cx: &'a OpCtx,
        input: BoxStream<'a, Arc<[Cursor]>>,
    ) -> BoxStream<'a, EffectOr<Arc<[Cursor]>>>;
}
```

The existing `Op::pipe` gains one variant in the stream item. No other op surface changes. Ops that do not need batching just emit `EffectOr::Out(cursors)` always; ops that need it yield `Eff(...)` with a oneshot inside, await the receiver, then emit `Out(cursors)`.

## Interpreter loop (pseudocode)

```rust
async fn drive(ops: Vec<BoxStream<EffectOr<_>>>, cancel: CancellationToken) {
    loop {
        // Tick boundary: collect all ready effects across all ops
        let mut pending: Vec<Box<dyn AnyEffect>> = Vec::new();
        let mut outputs: Vec<Arc<[Cursor]>> = Vec::new();

        for op in ops.iter_mut() {
            while let Poll::Ready(Some(item)) = poll!(op.next()) {
                match item {
                    EffectOr::Eff(e) => pending.push(e),
                    EffectOr::Out(c) => outputs.push(c),
                }
            }
        }

        if pending.is_empty() && outputs.is_empty() {
            tokio::select! {
                _ = cancel.cancelled() => return,
                _ = ready_next(&mut ops) => continue,
            }
        }

        // emit outputs immediately
        for c in outputs { downstream.send(c).await; }

        // Haxl collapse: group by batch_key, dispatch each group
        let groups = group_by(pending, |e| e.batch_key());
        for (key, batch) in groups {
            rayon::spawn(move || {
                let results = run_batch_erased(key, batch);
                for (sender, result) in results { sender.send(result); }
            });
        }
    }
}
```

One rayon hop per batch group. Tokio drives the loop. Each op resumes when its oneshot fills.

## Loud N+1 doors for sprefa

- **`Reader::bytes_many(&[(FilePath, ByteRange)]) -> HashMap<(FilePath, ByteRange), Bytes>`** — plural is the only door. Singular becomes `bytes_many(vec![one])`.
- **`Store::load_many(&[Row]) -> Vec<Option<Snapshot>>`** — same shape for Phase 2 SqliteStore.
- **`ast_grep::Pattern::find_all_many(&[(Root, &Pattern)])`** — maybe later; parse is per-file so less batchable.

Any op that internally loops a singular call now reads ugly at review.

## rxRust wrapper

```rust
pub fn run_pipeline(pipeline: Pipeline, cx: OpCtx) -> impl SharedObservable<Item = Cursor> {
    observable::create(move |subscriber| {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<Arc<[Cursor]>>(256);
        tokio::spawn(drive(pipeline.ops(cx), cx.cancel.clone(), tx));
        tokio::spawn(async move {
            while let Some(chunk) = rx.recv().await {
                for c in chunk.iter() {
                    if subscriber.is_closed() { return; }
                    subscriber.next(c.clone());
                }
            }
            subscriber.complete();
        });
    })
}
```

From the outside: `run_pipeline(...).debounce_time(50ms).subscribe(...)`. One time-language.

## What this adds to current v2

- New enum `EffectOr<T>` wrapping `Op::pipe` stream item. One-line change in `_5_op.rs`.
- New trait `Effect` in `mutations.rs` (or sibling `effects.rs`). Co-exists with `MutationEffect`; reads live on `Effect`, writes on `MutationEffect`.
- New `interpreter` module owning the drive loop. Replaces ad-hoc per-op IO calls.
- `Reader` grows `bytes_many`; existing `bytes` becomes a thin wrapper.

Phase-1 invariants unchanged. No effect on existing ops that emit only `Cursor`.

## Where this earns its keep

- Cross-repo xref (G5) — many repos ask for the same commit's blob; batch_key = (repo, rev, path).
- Cross-op content reads — two ops seeing the same cursor both reach for its source; interpreter collapses.
- SqliteStore Phase 2 — per-row `load_one` becomes `load_many` structurally.

## Where to not use it

- Single-op pipelines with no cross-cursor sharing. Pure overhead.
- Parse — per-file, not batchable.
- Walker — already parallel.

Gate adoption per op via `trait BatchingOp: Op`. Non-batching ops keep emitting plain `Cursor`.

## Related

- [redux-saga-essence](./redux-saga-essence.md) — the pattern and Rust crate landscape
- [applicative-batching](./applicative-batching.md) — Haxl collapse + tick coalescing primitives
- [/orchestrator:sprf-rx-runtime](../orchestrator/sprf-rx-runtime.md) — the rxRust-on-top layer this nests into
- [/rx:rxrust-x-rayon](../rx/rxrust-x-rayon.md) — how rayon hides inside source observables

## Sources

- [redux-saga docs](https://redux-saga.js.org/docs/api/) — fetched 2026-04-18
- [Haxl paper](https://simonmar.github.io/bib/papers/haxl-icfp14.pdf) — fetched 2026-04-18
- [async-graphql DataLoader](https://docs.rs/async-graphql/latest/async_graphql/dataloader/struct.DataLoader.html) — fetched 2026-04-18
- [genawaiter](https://docs.rs/genawaiter/0.99.1) — fetched 2026-04-18
- [tokio-stream chunks_timeout](https://docs.rs/tokio-stream/latest/tokio_stream/trait.StreamExt.html#method.chunks_timeout) — fetched 2026-04-18
