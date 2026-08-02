# futures::Stream Ecosystem Reference

> Async iteration for Rust. Pull-based (consumer asks), not push-based. Zero-cost abstraction binding async I/O to the executor.
>
> **Fetched 2026-04-18**

## Why It Exists

`Stream<Item = T>` mirrors `Iterator<Item = T>` but suspends between yields instead of blocking. Essential because async Rust cannot represent request/response chains alone—anything beyond REST hits flow control, batching, timeouts, throttling. When you use tonic (gRPC) or tokio_tungstenite (WebSocket), the only usable interfaces are streams.

Unlike `Future<Output = T>` (single value), streams model sequences. Unlike synchronous iteration, streams allow other tasks to run while buffering completes.

## Operator Inventory

**StreamExt** (46 combinators across both libraries):

| Method | Purpose |
|--------|---------|
| `map`, `filter`, `filter_map` | Transform; filter if condition holds |
| `buffered(n)` | Buffer futures to `n`, return results in input order |
| `buffer_unordered(n)` | Buffer futures to `n`, return in completion order |
| `for_each`, `fold` | Reduce stream to side effect or accumulator |
| `collect`, `chunks` | Batch items |
| `take`, `skip`, `take_while` | Limit or skip |
| `zip`, `chain`, `flatten` | Combine or nest streams |
| `then`, `and_then` | Map items to futures (async map) |
| `select_all`, `merge` | Multiplex multiple streams |

**TryStreamExt** (parallel methods for `Result`-bearing streams):
- `try_buffer_unordered`, `try_fold`, `try_collect`, `try_for_each`

**tokio_stream extras** (time-aware, `Tokio` feature required):
- `timeout`, `throttle`, `chunks_timeout` — per-item delays
- `peekable`, `fuse` — lookahead, guaranteed termination

## Push vs Pull: rx vs futures

**futures::Stream (pull-based):**
- Consumer calls `poll_next()` → executor wakes as futures resolve
- Stream is lazy; nothing happens until you poll
- Backpressure is implicit: polling blocks on slow operations
- Fits async I/O (network, disk awaits signals)

**rxRust (push-based):**
- Producer emits values to subscribers (observers)
- Subscription is eager; streams hot by default
- Backpressure explicit via `Subject` bounded buffers or `BackpressureStrategy`
- Fits event systems, UI updates, click streams

RxJS operators (map, filter, merge, etc.) map conceptually cleanly to both, but rxRust's imperative error handling and hot/cold semantics differ from futures' exception propagation. If you think in "emit to subscribers," reach for rxRust. If you think in "executor polls when ready," futures::Stream is closer to metal.

## Backpressure Model

futures::Stream applies **pull-based backpressure**: the consumer controls throughput. `buffered(n)` and `buffer_unordered(n)` *apply backpressure to the underlying stream*—the producer blocks until buffer slots free.

```rust
stream.buffer_unordered(10)  // Max 10 futures polled; 11th waits for a slot
    .for_each(|result| async { handle(result) })
    .await
```

Without explicit bounds, streams are unbuffered: each future resolves before the next is spawned.

## Canonical Snippet: buffer_unordered

Parallel HTTP requests, unordered results, bounded concurrency:

```rust
use futures::stream::{self, StreamExt};

async fn fetch_many_unordered(urls: Vec<&str>, max_concurrent: usize) {
    stream::iter(urls)
        .map(|url| fetch(url))
        .buffer_unordered(max_concurrent)  // Max N futures at once
        .for_each(|result| async move {
            match result {
                Ok(body) => println!("{}", body),
                Err(e) => eprintln!("error: {}", e),
            }
        })
        .await
}
```

Compare: `buffered(max_concurrent)` returns results in input order; unordered is ~15% faster (lower latency) if order doesn't matter.

## Gotchas

1. **FuturesUnordered as sub-executor**: `FuturesUnordered` (used internally by `buffer_unordered`) only polls when explicitly polled. If the executor doesn't poll the stream timely, buffered futures stall. No hidden concurrency—you see it in stack traces.

2. **Deadlock with buffered + sync primitives**: Combining `buffer_unordered` with bounded channels or mutexes can deadlock. The sequencing between buffer-fill and consumer-drain becomes circular. Use the "scoped task" pattern (spawn tasks onto the executor) instead.

3. **pin_mut! pitfall**: Streams are pinned. `for_each` consumes the stream, so you cannot iterate twice:
   ```rust
   pin_mut!(stream);
   while let Some(x) = stream.next().await { }
   // stream now exhausted; no second iteration
   ```

4. **BoxStream type erasure cost**: `dyn Stream` requires heap allocation and virtual dispatch. `Box<dyn Stream<Item = T>>` is slower than concrete `impl Stream`. Use when trait objects are necessary (factory return type); prefer type parameters otherwise.

5. **0-capacity buffer_unordered**: `buffer_unordered(0)` is nonsensical and will block forever. Always use `n >= 1`.

6. **Differences between futures::StreamExt and tokio_stream::StreamExt**: both define `StreamExt`, but with different methods. Import one and use fully-qualified syntax for the other to avoid collisions.

## Sources

- [without.boats: FuturesUnordered and the order of futures](https://without.boats/blog/futures-unordered/)
- [Rust Async Book: Streams, Asynchronous Programming in Rust](https://rust-lang.github.io/async-book/05_streams/01_chapter.html)
- [futures::stream::StreamExt documentation](https://docs.rs/futures/latest/futures/stream/trait.StreamExt.html)
- [tokio_stream::StreamExt documentation](https://docs.rs/tokio-stream/latest/tokio_stream/trait.StreamExt.html)
- [Guillaume Endignoux: Asynchronous streams in Rust (part 1)](https://gendignoux.com/blog/2021/04/01/rust-async-streams-futures-part1.html)
