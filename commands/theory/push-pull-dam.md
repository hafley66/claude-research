---
description: Push vs pull vs bounded channel (the dam). The shape used by ripgrep, rust-analyzer, alacritty, Kafka, Node streams, Flowable, Akka, tokio-console. Mental model + nine worked examples + why there is no fourth option.
---

# push-pull-dam

## The shape in one picture

```
                  ┌─────────────────────────────────────┐
                  │  OUTSIDE: push (ergonomic API)      │
                  │  events, rxRust, LSP callbacks      │
                  └──────────────▲──────────────────────┘
                                 │ subscriber.next(x)
                                 │
                                 │ ← the seam
                                 │
                  ┌──────────────┴──────────────────────┐
                  │  BOUNDED CHANNEL: the dam           │
                  │  capacity N; send BLOCKS when full  │
                  └──────────────▲──────────────────────┘
                                 │ rx.recv (pull)
                                 │
                  ┌──────────────┴──────────────────────┐
                  │  INSIDE: pull (bounded throughput)  │
                  │  walker → parse → match             │
                  └─────────────────────────────────────┘
```

## Algebra

```
PUSH:   Producer :: () -> emit(A)        // fires whenever
        Consumer :: A -> ()              // must handle everything

PULL:   Producer :: () -> Option<A>      // returns on demand
        Consumer :: loops { next() }     // controls timing

BACKPRESSURE:
  push, without dam:   buffer → ∞ → OOM
  push, with dam:      send blocks, upstream parks
  pull, inherent:      silence IS the dam
```

The difference is **who holds the clock**. Push = producer, pull = consumer.

## Why you can't avoid the dam

Every time you have **an event source you do not own** (OS, network, keyboard, filesystem, LSP client, another thread) pushing into **work you do own**, you need a bounded queue whose fullness translates into slowdown. Three forms:

1. **Block the pusher** (Rust `sync_channel::send`)
2. **Drop events** (UDP, React concurrent mode's `startTransition`)
3. **Demand-signal protocol** (Reactive Streams `request(n)`, HTTP/2 flow-control, Kafka `buffer.memory`)

There is no fourth option. Every "push + fast producer" program either has a dam or has an OOM bug in the future.

## Nine codebases that use this shape

| Codebase | Push side | Bounded dam | Pull side |
|---|---|---|---|
| [ripgrep](https://github.com/BurntSushi/ripgrep) | `WalkParallel` | `crossbeam_channel::bounded` | stdout printer |
| [rust-analyzer](https://github.com/rust-lang/rust-analyzer) | LSP notifications | `crossbeam::channel::bounded` | salsa query DB |
| biome | rayon scope walker | `crossbeam::channel::unbounded` + rayon pool throttle | collector thread |
| [tokio-console](https://github.com/tokio-rs/console) | task events | HTTP/2 flow-control window | render loop |
| [alacritty](https://github.com/alacritty/alacritty) | PTY bytes | ring buffer | 60fps render loop |
| Node.js streams | `write()` | `highWaterMark` | reader `'data'` / async iter |
| Kafka | producer `send()` | `buffer.memory` (default 32MB) | consumer `poll()` |
| RxJava Flowable | `onNext` | `request(n)` demand | subscriber |
| [Akka/Pekko Streams](https://doc.akka.io/docs/akka/current/stream/index.html) | `Source` | buffers on every stage | `Sink` |

## The shape, by case

### ripgrep

Walker pushes `DirEntry`s as the OS emits them → bounded channel → printer pulls as stdout accepts. When the terminal is slow, the walker parks naturally because `tx.send` blocks.

### rust-analyzer

Two seams, not one: (1) LSP IO thread pushes notifications into `crossbeam::channel::bounded` → main loop pulls. (2) Main loop invalidates salsa queries (push side); UI hover demands (pull side) trigger recomputation through salsa's red-green propagation with early cutoff.

### biome

Variant: uses `crossbeam::channel::unbounded()` because the rayon scope itself is the throttle — at most `num_threads` files are in flight at once on the producer side, so the queue can't grow unboundedly even without an explicit cap. Works; fragile; not the recipe to copy.

### tokio-console

The dam lives at the wire. Instrumented task emits events → gRPC stream over HTTP/2. HTTP/2 per-stream flow-control windows are exactly a bounded channel at the protocol level. When the console client renders slowly, credits don't return, server backs off.

### alacritty

PTY master is push (kernel writes whenever the child writes). Render loop is pull at 60fps. Between: `VecDeque` ring buffer + condvar. PTY read thread parks on a full buffer. This is the textbook shortest example.

### Node.js streams (v2+) and Deno

Writable has `highWaterMark`. `write()` returns `false` when the buffer crosses the mark; caller must wait for `'drain'`. Same pattern: push API, bounded buffer, explicit backpressure signal to the producer.

### Kafka

Producer side: `send()` queues into an in-memory accumulator capped by `buffer.memory` (default 32MB). When full, `send()` blocks up to `max.block.ms`, then throws. Consumer side: `poll()` is pull. End-to-end: push produce, pull consume, bounded at both seams.

### RxJava Flowable vs Observable

Flowable is literally `Observable + backpressure` added because Observable had the rxjs `mergeMap` problem. Implements [Reactive Streams spec](https://www.reactive-streams.org/) — `request(n)` flows upstream, `onNext` flows downstream. Pull-for-demand, push-for-data. Same shape, made explicit at the type level.

### Akka / Pekko Streams

Whole library is this pattern. `Source → Flow → Sink` with bounded buffers on every stage; demand propagates upstream as a count. Reactive-Streams compliant. Cannot construct a graph without the dam.

## The four corners

```
             PUSH                       PULL
         ┌──────────────────────┬──────────────────────┐
  BLIND  │  rxjs mergeMap       │  sync unbuffered chan│
  (no    │  DOM events          │  sync Iterator       │
  back-  │  Node v1 streams     │                      │
  press.)│  → unbounded queue   │                      │
         ├──────────────────────┼──────────────────────┤
  BACK-  │  bounded mpsc        │  futures::Stream     │
  PRESS- │  Reactive Streams    │  buffer_unordered(N) │
  URE    │  Kafka producer      │  → inherent          │
         │  Node v2+ highWater  │                      │
         └──────────────────────┴──────────────────────┘
```

`rxjs mergeMap(fn, N)` lives in the top-left: N caps concurrency, not input. Input queue is unbounded. Use `Flowable` or drop to `futures::Stream` for the bottom-right.

## Rust recipe

```rust
fn scan(files: Vec<PathBuf>) -> impl SharedObservable<Item = Hit, Err = ()> {
    observable::create(move |subscriber| {
        let (tx, rx) = std::sync::mpsc::sync_channel::<Hit>(256);  // the dam

        rayon::spawn(move || {
            files.into_par_iter().for_each(|p| {
                for hit in scan_one(&p) {
                    if tx.send(hit).is_err() { return; }   // blocks when full
                }
            });
            drop(tx);
        });

        std::thread::spawn(move || {
            for hit in rx.iter() {
                if subscriber.is_closed() { return; }
                subscriber.next(hit);
            }
            subscriber.complete();
        });
    })
}
```

Three parts: producer (inside), channel (seam), forwarder (outside). One knob: channel capacity.

## Memorize

> **Push on top, pull at the bottom, bounded channel in the middle. The channel's capacity is the only place backpressure lives.**

Every "reactive + high throughput" Rust program ends up looking like this. rxRust didn't invent it, tokio didn't invent it, Akka didn't invent it. It is the shape forced by the push/pull split.

## Related commands

- [/rx:rxrust-x-rayon](../rx/rxrust-x-rayon.md) — sources hide rayon inside `observable::create`
- [/orchestrator:sprf-rx-runtime](../orchestrator/sprf-rx-runtime.md) — the sprefa application
- [/sagas:applicative-batching](../sagas/applicative-batching.md) — batching as the structural counterpart to backpressure
- [/theory:systems-batching](./systems-batching.md) — hardware rings are the same shape
- [/futures:futures-stream-zoo](../futures/futures-stream-zoo.md) — the pull-based toolkit

## Sources (fetched 2026-04-18)

- [Reactive Streams specification](https://www.reactive-streams.org/)
- [Node.js backpressure guide](https://nodejs.org/en/docs/guides/backpressuring-in-streams/)
- [Kafka producer configs](https://kafka.apache.org/documentation/#producerconfigs)
- [RxJava Flowable docs](https://reactivex.io/RxJava/3.x/javadoc/io/reactivex/rxjava3/core/Flowable.html)
- [Akka Streams](https://doc.akka.io/docs/akka/current/stream/index.html)
- [ripgrep source](https://github.com/BurntSushi/ripgrep)
- [rust-analyzer main loop](https://github.com/rust-lang/rust-analyzer/tree/master/crates/rust-analyzer/src)
- [alacritty event loop](https://github.com/alacritty/alacritty/tree/master/alacritty_terminal/src)
- [tokio-console](https://github.com/tokio-rs/console)
- [without.boats on FuturesUnordered](https://without.boats/blog/futures-unordered/)
- [futures::buffer_unordered](https://docs.rs/futures/latest/futures/stream/trait.StreamExt.html#method.buffer_unordered)
