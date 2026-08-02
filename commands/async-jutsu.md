# /async-jutsu

Audit async code against the shape of high-throughput production tools
(ripgrep, rust-analyzer, alacritty, Kafka, Akka, DataLoader): is it doing
async correctly, or hiding push-without-a-dam / unbounded queue / N+1 /
missing-cancellation? Primary Rust; also rxjs/Node/Go/Python asyncio.

Arguments: (none)=full sweep | `here` | `path <p>` | `seam` | `n+1` | `cancel`.

## Pass 1 — identify the shape

Classify every async construct: **push** (callbacks, tx.send, event
handlers) vs **pull** (Iterator, poll_next, await, recv). Who holds the
clock? Every place push meets pull is a **seam**; every seam needs a dam.

## Pass 2 — check the dams

At every seam: bounded channel/buffer present? (`mpsc::channel(N)` good;
`unbounded_channel`, raw Vec accumulator, memo map without eviction bad).
N tuned and documented (256-1024 throughput, 1-32 interactive)? Full-channel
behavior: block = good, error-and-drop = only if drops acceptable,
error-and-ignore = bug. rxjs `mergeMap(fn, N)` caps concurrency, NOT input —
input queue unbounded unless upstream throttled. Go `make(chan T, 1_000_000)`
is hiding the problem.

## Pass 3 — eight invariants

1. Bounded everywhere producer can outrun consumer.
2. Cancellation first-class: token/AbortHandle threaded through every spawn;
   dropping a task aborts its work.
3. Concurrency cap explicit (buffer_unordered(N), Semaphore); no
   fire-and-forget spawn loops.
4. No oversubscription: tokio workers + rayon pool != 2x cores.
5. Ordered vs unordered deliberate (buffered(N) = slow job blocks all).
6. N+1 loud: flag singular fetch in a loop where a plural API exists or
   could; plural-only APIs make loops obvious.
7. Content contract: downstream never re-reads what upstream loaded.
8. Send + 'static at every spawn/send; project borrows to owned at the seam.

## Language smells

- Rust: async fn inside rayon closure; spawn-in-loop with no join;
  `Arc<Mutex>` held across .await; block_on inside async; `.collect().await`
  on a Stream (kills backpressure).
- rxjs: mergeMap without N on uncontrolled source; Subject where late
  subscribers expect history; subscribe without takeUntil; nested subscribe.
- Node: ignoring write() return; serial for-await where parallel intended.
- Go: unbuffered chan expected not to block; `go f()` with no ctx cancel.
- Python: gather over unbounded list without Semaphore.

## The two shapes

Push + dam + pull: `[push source] -> [bounded chan cap N] -> [pull consumer]`
— ask: what happens when full? when consumer exits? why that N?
Pure pull: `stream -> map -> buffer_unordered(N) -> sink` — N sized to
downstream? ordered intentional? sync blocking inside f needs spawn_blocking.

## Red flags

Unbounded channel on a hot edge; spawn-in-loop unjoined; join_all(infinite);
Arc<Mutex> across .await; mergeMap uncapped; serial awaits over independent
items; N+1 loops; cancellation missing past one level; rayon+tokio both at
full cores.

## Green flags

Bounded documented channels; buffer_unordered tied to pool size; cancel arm
in every select; plural-only IO APIs; rayon hidden behind spawn_blocking.

## Shootout fairness (comparing two stacks)

Lock three axes, vary one: Stack / ArrivalGen (flat, sine, pareto, burst) /
EffectKind / BatchPolicy. Match batching model and producer pacing; surface
fixture exhaustion; noise gate (p90-p10)/p50 < 0.10 over >=10 trials;
subtract macOS sleep floor ~250us. Mixing axes = unattributable delta.

## Output

Shape (source/consumer/seam file:line, dam present?, cap) / 8 invariants
pass-fail / red flags / green flags / one-paragraph verdict vs production
shape. Not a linter; a mirror. No fixes unless asked.
