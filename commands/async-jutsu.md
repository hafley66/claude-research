# /async-jutsu

Audit async code against the shape used by high-throughput production tools (ripgrep, rust-analyzer, alacritty, tokio-console, Kafka, Flowable, Akka Streams, DuckDB, Haxl, DataLoader). Confirm whether the current code is doing async **relatively correctly** or hiding a push-without-a-dam / unbounded queue / N+1 / missing-cancellation bug.

Primary language: Rust. Secondary: rxjs / Node / Go / Python asyncio. Same questions apply.

## Arguments

- (none): full sweep of async shape in the current context
- `here`: audit the current file only
- `path <p>`: audit a specific file/dir
- `seam`: focus on the seams (boundaries between push and pull)
- `n+1`: focus on N+1 / batching opportunities
- `cancel`: focus on cancellation hygiene

## Instructions

Walk the code in three passes. Report findings inline; do not editorialize. Report counts, file:line, and verdict per check.

### Pass 1 — identify the shape

For every async construct, classify:

- **Push or pull?**
  - push: event callback, `subscriber.next`, `tx.send`, `fn(event: Event)`, DOM handler, LSP notification, OS epoll event
  - pull: `Iterator`, `Stream::poll_next`, `async fn` awaiting, `rx.recv`, `select!` with `recv`
- **Who holds the clock?** The active voice. Producer fires = push. Consumer asks = pull.
- **Where does push meet pull?** These are the seams. Every seam needs a dam or it leaks.

### Pass 2 — check the dams

At every seam, answer:

- [ ] Is there a bounded channel / buffer?
  - Rust: `tokio::sync::mpsc::channel(N)`, `std::sync::mpsc::sync_channel(N)`, `crossbeam_channel::bounded(N)`. Capacity present.
  - Bad: `crossbeam_channel::unbounded()`, `tokio::sync::mpsc::unbounded_channel()`, raw `Vec` accumulator, `HashMap` memo without eviction.
- [ ] Is N tuned or default?
  - Rule of thumb: 256–1024 for throughput work. 1–32 for interactive. Document the choice.
- [ ] Does `send` / `try_send` block or return an error?
  - Block: good (producer slows). Error-and-drop: OK only if drops are acceptable (UDP, telemetry). Error-and-ignore: bug.
- [ ] rxjs flavour: `mergeMap(fn, N)` — N caps concurrency, not input. Input queue unbounded. Red flag unless upstream is throttled.
- [ ] Go flavour: `make(chan T)` without capacity is synchronous rendezvous (OK). `make(chan T, N)` bounded. `make(chan T, 1_000_000)` is hiding the problem.

### Pass 3 — check the eight invariants

For the reactive/async pipeline as a whole:

1. **Bounded everywhere it matters.** No unbounded channel / map / Vec along any producer-faster-than-consumer edge.
2. **Cancellation is a first-class edge.** `CancellationToken`, `AbortHandle`, `AbortController`, `Context`, `tokio_util::sync::CancellationToken`, `select!` with a cancel arm. If a task spawns work, dropping the task aborts the work.
3. **Concurrency cap is explicit.** `buffer_unordered(N)`, `FuturesUnordered` with a gate, `Semaphore`, `rayon::ThreadPool::install`. No `for_each(spawn)` fire-and-forget loops.
4. **No oversubscription.** Tokio worker threads + rayon pool ≠ 2× cores. If both, tokio gets cores/2, rayon default.
5. **Ordered vs unordered is deliberate.** `buffered(N)` preserves input order (slow job blocks everyone). `buffer_unordered(N)` emits in completion order. Pick with intent.
6. **N+1 is loud.** Any loop that calls a singular fetch/read/query/parse per item, where a plural API exists or could be built. If the signature is `fn one(x) -> T` and it's called in a tight loop, flag it. Plural-only APIs (`fn many(&[X]) -> Vec<T>`) make accidental loops obvious.
7. **Content contract honored.** In Rust: any op reading bytes tries slot → byte_range → reader fallback, in order. Anywhere a downstream op re-reads what upstream already loaded is a contract violation.
8. **Lifetimes don't cross threads.** `Send + 'static` at every `tokio::spawn` / `rayon::spawn` / channel send. Borrowed data means project to owned before the seam.

### Language-specific smells

**Rust**

- `async fn` inside `rayon::par_iter` closure: wrong. rayon closures are sync; block on the future or restructure.
- `tokio::spawn` inside a `tokio::spawn` loop with no join: task leak; cancellation doesn't cascade.
- `Arc<Mutex<_>>` held across `.await`: deadlock risk; use `tokio::sync::Mutex` or restructure.
- `block_on` inside an async fn: thread-pool starvation.
- `.collect::<Vec<_>>().await` on a `Stream`: materializes everything; replaces stream with Vec; kills backpressure.

**rxjs**

- `mergeMap(fn, N)` without upstream throttle: input queue unbounded. Use `Flowable` (RxJava) or drop to `from(asyncIterator)`.
- `Subject` with late subscribers expecting history: use `ReplaySubject` or `BehaviorSubject`.
- `.subscribe()` without `.unsubscribe` / `takeUntil`: memory leak.
- Nested `.subscribe` inside `.subscribe`: should be `mergeMap`/`switchMap`.

**Node.js**

- Writable `write()` without checking return value: backpressure ignored.
- `for (const x of asyncIterable)` inside a hot loop without `Promise.all` batching where possible: serial where parallel was intended.
- EventEmitter beyond ~10 listeners: soft leak warning exists; usually a `removeListener` missed.

**Go**

- Unbuffered `chan` expecting producer to not block: will deadlock.
- `go f()` with no `context.Context` cancellation path: goroutine leak.
- `select {}` with only `<-ctx.Done()`: holds a goroutine forever waiting to die. Use it in a loop with actual work.

**Python asyncio**

- `asyncio.gather(*tasks)` over an unbounded list: like rxjs mergeMap without N. Use `asyncio.Semaphore` + gather.
- `loop.run_until_complete` nested: one loop per thread.

### The two shapes to verify

**Push + dam + pull (the common shape)**

```
[push source] --> [bounded channel cap N] --> [pull consumer]
       |                     |                        |
   OS / event            capacity = the                rate-controlled
   emits freely          only place back-              by downstream
                         pressure lives
```

Questions to ask at the seam:
- What happens when the channel is full? (send blocks? errors? drops?)
- What happens when the consumer exits? (channel closes? sender errors? task aborts?)
- What is N? Why that value?

**Pure pull (Stream in, Stream out)**

```
[stream source] --.map(f)--> .buffer_unordered(N) --> [sink]
                                |
                         N in flight; upstream
                         only polled when slot
                         opens; zero queue
```

Questions:
- Is N sized to the downstream work?
- Is it ordered or unordered? Intentional?
- Any sync blocking in `f`? That needs `spawn_blocking` or rayon.

### Red flags (immediate)

- Unbounded channel on a producer-faster-than-consumer edge
- `spawn` inside a loop with no join handle kept
- `futures::future::join_all(infinite)` 
- `Arc<Mutex<_>>` held across `.await`
- `rxjs mergeMap(fn)` without N, or with large N, fed by uncontrolled source
- `for` loop of `.await` where items are independent and could run via `buffer_unordered`
- N+1 shape: loop calling singular fetch where plural API exists or could exist
- No cancellation wiring past one level deep
- rayon and tokio both defaulting to full core count

### Green flags (confirmation)

- Bounded channel with documented capacity
- `buffer_unordered(N)` where N is tied to pool size
- `select!` cancellation arm on every long-running task
- Plural-only IO APIs (`load_many`, `bytes_many`, `find_all`)
- Cancellation token threaded through every spawn
- Rayon work hidden inside `observable::create` or `tokio::spawn_blocking`, not mixed freely

## Output format

Walk the three passes, producing a report:

```
## Shape
- Push source: <file:line> <description>
- Pull consumer: <file:line>
- Seam: <file:line>, dam = <present|absent>, cap = <N|unbounded>

## Invariants
[ ] 1. Bounded where needed — <pass/fail, file:line>
[ ] 2. Cancellation first-class — <pass/fail>
[ ] 3. Concurrency cap explicit — <pass/fail>
[ ] 4. No oversubscription — <pass/fail>
[ ] 5. Ordered/unordered deliberate — <pass/fail>
[ ] 6. N+1 loud — <pass/fail; list loops>
[ ] 7. Content contract — <if applicable>
[ ] 8. Send + 'static at spawn sites — <pass/fail>

## Red flags
- <file:line> <flag> <one-line why>

## Green flags
- <file:line> <flag>

## Verdict
<single paragraph: is this doing async relatively correctly vs ripgrep / rust-analyzer / alacritty shape?>
```

Do not suggest fixes unless asked. Report the shape. Leave interpretation to the user.

## Pass 4 — shootout fairness (when comparing two stacks)

When the audit is "is stack B a perf tax vs stack A?" rather than
"is stack A correct?", the comparison is a separate discipline.
Before trusting any wall-time delta between two stacks:

- **Match batching model.** Opportunistic drain dispatches
  whatever depth was in the queue at wakeup; fixed-count dispatches
  exactly N. Comparing wall-time at zero-work without matching
  dispatch depth is a category error; delta is a counting
  artifact, not a topology result.
- **Match producer pacing.** Unpaced + zero-work saturates the
  consumer and measures channel mechanics, not the stack at its
  target regime. Add arrival pacing (fixed, sine, pareto) matched
  to the expected production workload.
- **Surface fixture exhaustion.** `--max N` silently capped at
  available-file-count is not the requested load. Print effective
  count next to requested; warn on mismatch.
- **Noise floor gate.** Sub-10ms wall regimes need
  `(p90 − p10) / p50 < 0.10` across ≥ 10 trials before deltas
  are real. Below that, variance is larger than the signal.
- **Calibrate platform floors.** `thread::sleep` on macOS has a
  ~250µs per-call floor. Closed-form predictions must subtract
  `N_sleeps × floor` or every scored case overshoots by ~25%.

## The shootout matrix

Any async-shape or batching decision lives in four orthogonal
axes. Audits lock three and vary one:

    Stack        — how items cross the seam (channel + executor)
    ArrivalGen   — shape of time entering (flat / sine / pareto / burst)
    EffectKind   — cost curve of one dispatch (LARGE / MEDIUM / NONE)
    BatchPolicy  — opportunistic / windowed-{leading,trailing} /
                   fixed-count / passthrough / adaptive

Comparing two stacks answers "is this stack a perf tax?"
Comparing two policies answers "is batching worth it here?"
Mixing more than one axis = category error; the delta is
unattributable.

## Related

- `/theory:push-pull-dam` — the nine-codebase comparative study
- `/theory:unified-batching` — why batching + backpressure are the same idea restated
- `/theory:fp-reactive-batching` — Haxl, DD, Salsa prior art
- `/theory:systems-batching` — hardware rings as the same pattern
- `/sagas:applicative-batching` — loud N+1 design
- `/rx:rxrust-core`, `/futures:futures-stream-zoo` — Rust-specific primitives
- `/rayon:rayon-x-tokio` — oversubscription failure mode
- `/orchestrator:sprf-rx-runtime` — the opinionated sprefa shape

## Purpose

After running /async-jutsu the user should know whether their async code matches the shape used by production-grade high-throughput tools, or where it silently diverges. Not a linter; a mirror.
