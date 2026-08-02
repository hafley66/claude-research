---
description: Applicative-vs-Monad batching insight (Haxl), DataLoader tick coalescing, loud N+1 design. Load when the goal is making N+1 a structural non-option rather than a lint rule.
---

# applicative-batching

## The core insight

Haxl (Marlow et al., "There is no Fork", ICFP 2014): **batching is a property of the shape of composition, not of the scheduler.**

- `Applicative`'s `<*>` exposes both effect arguments to the runtime at once → independent fetches collapse into one round trip.
- `Monad`'s `>>=` hands the continuation a value → the left effect must resolve before the right is even known → scheduler cannot see a fetch it has not been told about.

A system that reifies work as Applicative-first makes N+1 type-level impossible. A system that lets users write `do`-notation silently serializes. The monadic `>>=` is the flush point — every `await` in Rust is a `>>=`.

## Pattern table

| System | Trigger | Key-collapse | Pure ops? | Source |
|---|---|---|---|---|
| Haxl `Fetch` | monadic `>>=` boundary; Applicative pass accumulates | `DataSource` groups by request type; `DataCache` dedups on request GADT | yes | [ICFP 2014 paper](https://simonmar.github.io/bib/papers/haxl-icfp14.pdf) |
| DataLoader (JS) | `process.nextTick` / microtask after current sync frame | `Map<key, Promise>` memo per loader; `batchLoadFn(keys[])` | no | [graphql/dataloader](https://github.com/graphql/dataloader) |
| async-graphql `DataLoader` (Rust) | `tokio::time::sleep(delay)` per pending batch | `HashMap<K, oneshot::Sender<V>>` | no | [docs.rs](https://docs.rs/async-graphql/latest/async_graphql/dataloader/struct.DataLoader.html) |
| Apollo BatchHttpLink | 10ms network window default | operation-hash dedup | no | [Apollo docs](https://www.apollographql.com/docs/react/api/link/apollo-link-batch-http/) |
| React 18 automatic batching | microtask boundary after event/promise/setTimeout | state updates per fiber keyed by setter | no | [React 18 blog](https://react.dev/blog/2022/03/29/react-v18) |
| `requestAnimationFrame` | next paint frame | caller-owned | no | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) |
| Persistent `selectList :: [Filter v] -> m [Entity v]` | explicit plural API | SQL `IN (?)` | yes | [yesodweb book](https://www.yesodweb.com/book/persistent) |

## Rust primitives for tick/frame coalescing

- `tokio::task::yield_now().await` — cooperative point; drains local run-queue. Closest thing to a microtask boundary.
- `futures::stream::StreamExt::ready_chunks(n)` — synchronous greedy coalesce of whatever is `Poll::Ready`, no timer.
- `tokio_stream::StreamExt::chunks_timeout(n, dur)` — window by count or duration, whichever first. The async-graphql DataLoader shape.
- `futures::stream::StreamExt::buffer_unordered(n)` — concurrent fan-out; coalesce must happen upstream.
- `tokio::sync::Notify` + `Mutex<Vec<Req>>` — hand-rolled batch with explicit flush edge.

## Loud N+1 design patterns

Four doors to make N+1 a non-option:

1. **Plural-only API** (Persistent). No singular primitive exists; `load_one` is literally `load(&[key])[0]`. Accidental loops become obvious at the call site.
2. **Applicative-only composition** (Haxl with `ApplicativeDo`). Monadic bind is the flush point; if you never bind, you never flush.
3. **Loader with microtask coalesce** (DataLoader). Call `load(k)` N times in a sync frame; exactly one batch goes out.
4. **Typed effect queue + interpreter** (redux-saga + Haxl hybrid). Ops yield `Effect` values; interpreter sees all pending effects before dispatching; groups by `batch_key`.

## Applicability to sprefa

`Op::pipe(BoxStream<Arc<[Cursor]>>) -> BoxStream<Arc<[Cursor]>>` already has Haxl shape — the unit of flow is a chunk, not a cursor, so a single pipe call is structurally a batch. The N+1 risk is per-cursor `reader.bytes()` inside an op body; the content contract (PATH A slot → B byte_range → C reader) already dedups through cached slots.

Three structural moves to make N+1 louder:

- **Plural-door Reader**: `Reader::bytes_many(&[FilePath]) -> HashMap<FilePath, Bytes>`. Single-file read becomes a degenerate batch-of-one. Accidental per-cursor loops surface at review as "why is this calling `bytes_many` N times with a singleton".
- **Tick collector between fork arms**: `chunks_timeout(max_batch, max_delay)` on cross-arm boundaries. Give the scheduler a window to see sibling effects.
- **Cancel-token = flush edge**: already present. `on_source_change` cancels the token; `TaskGuard::drop` aborts; new token = fresh batch horizon. Matches `process.nextTick` role for DataLoader.

## The sprefa opportunity

Cursors carry `byte_range` and `slots`; reads already cache by path+range. Adding a batching interpreter layer (see sprf-effect-runtime.md) lets per-cursor "fetch source at range" calls from different ops in a tick coalesce into one `bytes_many` round — without changing op bodies. This is the Haxl collapse applied to code analysis.

## Sources

- [Marlow et al. "There is no Fork" ICFP 2014](https://simonmar.github.io/bib/papers/haxl-icfp14.pdf) — fetched 2026-04-18
- [graphql/dataloader README](https://github.com/graphql/dataloader) — fetched 2026-04-18
- [async-graphql DataLoader](https://docs.rs/async-graphql/latest/async_graphql/dataloader/struct.DataLoader.html) — fetched 2026-04-18
- [React 18 automatic batching](https://react.dev/blog/2022/03/29/react-v18) — fetched 2026-04-18
- [GHC ApplicativeDo](https://ghc.gitlab.haskell.org/ghc/doc/users_guide/exts/applicative_do.html) — fetched 2026-04-18
- [tokio-stream chunks_timeout](https://docs.rs/tokio-stream/latest/tokio_stream/trait.StreamExt.html#method.chunks_timeout) — fetched 2026-04-18
- [futures ready_chunks](https://docs.rs/futures/latest/futures/stream/trait.StreamExt.html#method.ready_chunks) — fetched 2026-04-18
- [Apollo BatchHttpLink](https://www.apollographql.com/docs/react/api/link/apollo-link-batch-http/) — fetched 2026-04-18
