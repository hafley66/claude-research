# /batching-jutsu

Audit a codebase (or a proposed design) for batching discipline.
Answer the question: "is this N+1-shaped, and if so, does batching
actually help here, or am I about to build a slower-with-more-steps
version?"

Primary language: Rust. Secondary: rxjs / Node / Go / Python.

Pairs with `/async-jutsu` (which audits push/pull/dam shape) and
`/theory:unified-batching` (the one-page synthesis of why batching
is one idea restated at every layer).

---

## Arguments

- (none): full sweep — enumerate N+1 sites, classify each by
  batching payoff, report sweet spots per effect kind
- `here`: audit the current file only
- `path <p>`: audit a specific file/dir
- `design`: audit a design sketch rather than code; use the
  cost-model table to decide which boundaries should be batched
- `numbers`: report only the sweet-spot table for the effect kinds
  in this codebase, no prose

---

## The mental model

Batching is a **time-space tradeoff with a known shape**. It is not
a universal improvement. It is a cost-model decision per seam.

```
batching pays iff:
    (per-call fixed cost × N)  ≫  (N × per-item variable cost)

i.e. fixed cost dominates AND variable cost is flat in batch size.
```

The four regimes:

```
                time gain (amortization)
                     ^
           LARGE ──┤  git odb read, sqlite BEGIN/COMMIT, network RTT,
                    │  stream prepare plans, IN-rewrite queries
                    │     → ALWAYS batch
                    │
           MEDIUM ──┤  tree-sitter parser alloc, pattern compile, JSON parse
                    │     → batch if not already-parallel via rayon
                    │
           SMALL ──┤  HashMap get, Arc::clone, span slice, mmap read
                    │     → do not batch; passthrough
                    │
           NONE  ──┤  already-parallel work (rayon par_iter, SIMD)
                    │     → batching = worse; hurts parallelism
                    └─────────────────────────────>
                          SMALL      MEDIUM      LARGE       space cost
                                (items buffered inflight)
```

---

## Three invariants of batching

1. **Applicative beats monadic.**
   Two fetches that do not depend on each other (`liftA2 f a b`)
   can be collapsed into one dispatch. Two fetches where the second
   needs the first's result (`a >>= \x -> b(x)`) cannot.
   Haxl paper 2014 formalized this. DataLoader ticks the same way.
   redux-saga ticks the same way. sprefa batcher windows the same way.

2. **Passthrough is the zero-cost default.**
   A batcher with `window=0, max_batch=1, coalesce=identity` has
   ~10ns overhead (one TypeId lookup + one function call). The
   batcher *shape* is not the cost; the *policy* is. Having one
   `Batcher<E>` per effect kind with a passthrough policy is free.

3. **Tail latency is the hidden cost.**
   Bigger batches = lower throughput per-op = higher latency for
   the last item in a batch. Interactive paths (LSP hover, CLI
   first-output-token) need small windows (8–16ms) or leading-edge
   dispatch. Throughput paths (bulk scan, write flush) can afford
   50–500ms windows.

---

## Pass 1 — identify N+1 sites

For every loop that calls an IO/CPU/store/API function, classify:

**Silent N+1** — singular-only API called in a loop

```rust
for item in items {
    let result = single_fetch(item).await;  // N calls, N round-trips
}
// there is no fetch_many() to accidentally-almost-call
```

Green flag: call site is obviously serial.
Red flag: singular-only API is a **design smell**, because batching
is inexpressible. A plural method (`fetch_many(&[T]) -> Vec<U>`)
makes accidental loops obvious.

**Loud N+1** — plural API exists, consumer uses singular-in-loop

```rust
for item in items {
    let result = db.fetch_many(&[item]).await;  // N calls with batch-of-1
}
// grep-catchable: `fetch_many(&[` in a loop body
```

Green flag: lint can catch this. Reviewers can catch this.

**Pseudo-batch** — `join_all(per_item_fut)` / `FuturesUnordered`
over a loop

```rust
join_all(items.iter().map(|i| single_fetch(i))).await;
// N futures inflight; looks parallel but dispatches N calls
```

This is what v2 sprefa does at `ops/_9_ast_grep.rs:310` and
`ops/_3_fs.rs:242`. It has concurrency but no coalescing. If the
underlying source can take `&[Req]` in one call, this shape burns
N× the per-call fixed cost.

**Structural batch** — plural API + batcher window + applicative
collapse

```rust
// every call site writes `put(Fetch { key })`
// batcher collects calls inside a window, dispatches `fetch_many`
let value = ctx.put(Fetch { key }).await;
```

This is Haxl / DataLoader / tower-batch-control. N+1 becomes
impossible at the call site because there is no singular API.

**Opportunistic batch** — dispatch loop wakes on first item,
non-blocking drains whatever else is queued, dispatches a batch
of whatever depth happened to be there. Self-tuning by arrival rate.

```rust
loop {
    let first = queue.recv().await;                 // block for work
    let mut batch = vec![first];
    while let Ok(more) = queue.try_recv() {         // NON-BLOCKING drain
        batch.push(more);
        if batch.len() >= MAX_BATCH { break; }
    }
    source.many(&batch).await;
}
```

One knob (`MAX_BATCH` for memory safety). No window timer, no
controller, no stats. Arrival rate at the queue is the signal;
"drain what's already there" is the response.

| load | queue depth at wakeup | batch | behavior |
|---|---|---|---|
| low | 1 | 1 | passthrough, low latency |
| medium | a few | few | partial amortization |
| high | many | MAX_BATCH | full amortization |
| overload | saturated | MAX_BATCH + backpressure | producers slowed |

The trade-off aligns with the workload automatically. Low load =
latency matters = you get it. High load = throughput matters = you
get it. Backpressure emerges for free from queue fill.

Prior art (this is a 40-year-old pattern):
- Linux NAPI (interrupt coalescing, 2003)
- Nagle's algorithm (TCP, 1984)
- Postgres group commit (fsync coalescing)
- Linux block layer plug/unplug
- ClickHouse async_insert
- eBPF ring buffers

**When opportunistic is the right shape**:
- effect has flat amortization curve (git odb read, http RPC, list-files)
- MAX_INFLIGHT = 1 or "N independent loops"
- no need for "wait to see if more arrive" (no stepped fixed cost)

**When it isn't**:
- stepped fixed cost (sqlite BEGIN/COMMIT wants trailing window
  even when queue is empty — let more INSERTs arrive first)
- interactive priority needed (LSP hover must beat bulk scan even
  at high load → priority queues, not single FIFO)
- cost-asymmetric batch sizes (rare — most sources flatten around
  MAX_BATCH)

For most effect kinds, opportunistic is the simplest policy that
still batches usefully.

---

## Pass 2 — classify by cost model

For each seam, determine which regime it's in. Use the table.

### Cost model template per effect

```
effect: <name>
fixed cost (per-call):  <time>   — syscall / lock / prepare / RTT
variable cost (per-item): <time>  — actual payload work
batch size where amortization flattens: <N>
is the underlying source already-parallel? <y/n>
is the caller interactive (LSP) or throughput (CLI/bulk)?
```

Concrete example table for a code-analysis scanner:

| effect | fixed | variable | sweet spot batch | window | leading |
|---|---|---|---|---|---|
| git odb read | 10–100µs (Mutex + syscall) | 0 (blob size ~KB) | 1–8 | 4ms | yes |
| worktree mmap read | ~0 (already mmaped) | byte copy | 1 (passthrough) | 0 | — |
| list files (git tree walk) | 1–50ms | 0 | ∞ per rev | 0 (one-shot) | — |
| tree-sitter parse | μs (alloc) | ∝ file size | 1–16 per rayon worker | 0 | — |
| ast-grep match | 0 (pattern cached) | ∝ tree size | rayon-pool-size | 0 | — |
| sqlite SELECT | ~100µs (prepare) | row mat | 64 (IN-rewrite) | 8ms | no |
| sqlite INSERT | ~1ms (BEGIN/COMMIT) | row insert | 100–1000 | 50ms | no |
| shell exec | 1–10ms (fork) | 0 | 1 (never batch) | — | — |
| network RPC | RTT ~10–100ms | 0 | bulk endpoint size | 50ms | no |
| HashMap get | ~10ns | 0 | 1 (never batch) | — | — |
| template render | 0 (pure) | ∝ segs | identity-coalesce | 0 | — |
| human approval | seconds | 0 | 1 per fingerprint | — | — |

### Wins / loses / neutral partition

**batching WINS**: `fixed ≥ 10× variable` AND variable is flat in
batch size.
Examples: syscalls (git odb), BEGIN/COMMIT, network RTT, lock
acquires, statement prepare, stream plans.

**batching LOSES**: `fixed ≤ variable` OR batching holds tail
latency hostage OR work is already-parallel.
Examples: mmap reads, pure CPU on isolated items, anything already
in `rayon::par_iter`, interactive first-token latency.

**batching NEUTRAL**: wide flat region. Pick based on code
simplicity. Passthrough batcher has zero perf impact, so using
the same abstraction everywhere is fine.

---

## Pass 3 — the policy knobs

Every batcher has the same four knobs:

```
WINDOW_MS     = how long to wait for more requests before dispatch
MAX_INFLIGHT  = how many batches can be running at once
MAX_BATCH     = cap on items in one batch (past this, amortization flat)
LEADING       = dispatch the first request immediately?
```

### Picking the numbers

```
WINDOW_MS:
  interactive (LSP hover, first CLI token)  →  8–16ms
  throughput (bulk scan, write flush)       →  50–500ms
  one-shot (cache fill, one result expected) →  0
  opportunistic (flat amortization curve)   →  0 (use try_recv drain)

MAX_INFLIGHT:
  CPU-bound effect      →  rayon pool size
  IO-bound effect       →  1 if shared resource (single repo lock)
                          cores if independent (per-file mmap)
  network-bound         →  whatever the remote side can handle

MAX_BATCH:
  derived:  fixed_cost / per_item_cost
  past this, per-item cost dominates and amortization flattens
  so more items = more tail latency for no gain
  opportunistic also uses this as memory cap

LEADING:
  true   if first-token latency matters (LSP, CLI)
  false  if throughput is all that matters (bulk writes)
  trailing always true (don't hold items forever)
  N/A    for opportunistic (always effectively leading-edge)
```

### Choosing policy shape per effect

```
opportunistic (WINDOW_MS=0, try_recv drain)
  → flat amortization curve
  → arrival rate varies across workloads
  → one knob is enough (MAX_BATCH)
  → examples: git odb read, http RPC, list files, ast-grep match

windowed (WINDOW_MS>0, LEADING=true)
  → stepped fixed cost (want to wait for more arrivals)
  → interactive path, first-token latency matters
  → examples: LSP query-store, sqlite SELECT with IN-rewrite

windowed-trailing (WINDOW_MS>0, LEADING=false)
  → throughput path, no interactivity
  → stepped fixed cost (sqlite COMMIT, disk fsync)
  → examples: sqlite INSERT, file edit flush

passthrough (WINDOW_MS=0, MAX_BATCH=1)
  → no fixed cost to amortize
  → uniform shape without abstraction cost
  → examples: HashMap get, mmap read, template render

fixed-count (WINDOW_MS=0, MAX_BATCH=N, no timer)
  → dispatch only when exactly N items have arrived
  → no time-based flush; partial batch held indefinitely between
    arrivals until producer shuts down
  → rxjs `bufferCount(N)`, rxrust `buffer_count(N)` in isolation
  → safe only when producer shutdown is reliable and close in time
    (bulk CLI scan with known finite input)
  → red flag on long-lived streams or interactive paths:
    stalls the last partial batch hostage until shutdown
  → prefer opportunistic, OR pair with buffer_time to add a
    trailing flush

adaptive controller (measure p99, adjust policy)
  → workload shifts dramatically (cold vs warm, dev vs CI)
  → only for effects where static policy turns out wrong
  → add LAST, after production data justifies the complexity
```

Default to **opportunistic**. Switch to **windowed** only for
effects with stepped fixed cost. Switch to **passthrough** only
when amortization is provably absent. Add **adaptive** only when
observability shows a static policy is miscalibrated.

### Space accounting

```
inflight_ram_per_kind ≈ MAX_INFLIGHT × MAX_BATCH × sizeof(E)

sum across all effect kinds = total batcher memory overhead
on a 16GB budget, target <1MB total inflight
```

---

## Pass 4 — design posture

### Rust idiomatic shape

```rust
trait EffectKind: Send + 'static {
    type Response: Send + 'static;
}

trait Batcher<E: EffectKind>: Send + Sync {
    const WINDOW_MS:    u64;
    const MAX_INFLIGHT: usize;
    const MAX_BATCH:    usize;
    const LEADING:      bool;
    fn coalesce(&self, reqs: &[E]) -> BatchReq<E>;
    async fn dispatch(&self, req: BatchReq<E>) -> Vec<E::Response>;
}

impl RtCtx {
    pub async fn put<E: EffectKind>(&self, e: E) -> E::Response { ... }
}
```

One dyn cell (`TypeId -> Arc<dyn BatcherEntry>`), everything else
monomorphized. Applicative collapse is mechanical: requests in the
same window bucket get one `dispatch` call.

### Prior art to cite

**Windowed / applicative batching:**
- Haxl (Marlow et al. 2014) — Haskell monadic+applicative batching
- DataLoader (Lee Byron 2016) — GraphQL per-key tick coalescing
- tower-batch-control (Rust, Zcash/zebra) — production batcher over
  `tower::Service`
- salsa (Rust, rust-analyzer) — memoization as time-batching
- Build Systems à la Carte (Mokhov 2018) — applicative-vs-monadic
  scheduling formalized
- Timely / Differential Dataflow — stream-delta batching as
  windowing

**Opportunistic / coalescing-under-backpressure:**
- Nagle's algorithm (Nagle 1984) — TCP small-write coalescing on
  unacknowledged-segment backpressure
- Linux NAPI (Jamal Hadi Salim et al. 2003) — interrupt→polling
  switch on packet rate; the kernel template for this pattern
- Postgres group commit — first fsync alone, concurrent COMMITs
  ride along in next fsync
- Linux block layer plug/unplug — first I/O plugs the queue,
  subsequent I/Os accumulate until threshold or timer
- TCP delayed ACK — coalesce ACKs up to 40ms window
- ClickHouse async_insert — server-side single→batch switch
- eBPF ring buffer — per-item vs batched wakeup by arrival rate

**Adaptive / self-tuning:**
- Nagle ALGORITHM vs TCP_NODELAY — explicit opt-out knob, still
  active 40 years on
- TensorFlow Serving dynamic batching — timeout OR batch-full
  whichever first, per-model configurable
- Triton Inference Server dynamic batching — same pattern
- AWS SDK adaptive retry mode — runtime-tuned rate limiting
- Linux CoDel (Controlled Delay) — queue management by sojourn
  time, not depth

---

## Output format

```
## N+1 sites found
- <file:line> <shape> <regime: silent|loud|pseudo-batch|structural>

## Cost model per effect
| effect | fixed | variable | sweet batch | window | leading |
|---|---|---|---|---|---|
...

## Partition
WINS:    <effects>
LOSES:   <effects>  (batching would hurt; do passthrough)
NEUTRAL: <effects>

## Design gaps
- <singular-only APIs that should be plural>
- <pseudo-batch sites that need structural batchers>
- <already-parallel work being accidentally serialized by a batcher>

## Space cost
Total inflight RAM at proposed policy: <MB>
Budget: <MB>
Verdict: <fits | over-budget>

## Policy table (the four knobs per kind)
| effect | WINDOW_MS | MAX_INFLIGHT | MAX_BATCH | LEADING |
|---|---|---|---|---|
...
```

Do not suggest fixes unless asked. Report the shape. Leave
interpretation to the user.

---

## Red flags (immediate)

- Singular-only IO API called in any loop (silent N+1)
- `join_all(per_item_futures)` over a source with a plural API
  (pseudo-batch burning fixed cost)
- Batching already-parallel work (rayon par_iter wrapped in a
  window = hurting parallelism; throughput ceiling = 1/C of
  parallel baseline)
- `buffer_count(N)` in isolation on a long-lived stream (no
  time-based flush; last partial batch held until shutdown).
  Pair with `buffer_time` or switch to opportunistic.
- Zero `WINDOW_MS` + non-zero `MAX_BATCH` (batcher never collapses)
- Interactive-path batching with `WINDOW_MS > 16ms` (tail latency
  visible to user)
- Throughput-path batching with `WINDOW_MS < 1ms` (coalesce window
  too small to amortize)
- `LEADING=false` on interactive path (first-token latency = full
  window even if queue is empty)
- Shared-resource effect with `MAX_INFLIGHT > 1` without a
  concurrency-safety story
- Batcher inflight RAM > 1% of process budget (space/time tradeoff
  out of balance)

## Green flags

- Plural-only IO APIs (`bytes_many`, `files_many`, `insert_rows`)
- Batcher registry keyed by `TypeId` → per-kind policy isolation
- Passthrough batchers for already-parallel work
- Policy knobs documented per effect kind with rationale
- Space accounting per kind, total under budget
- Applicative-collapse obvious at call site (`put(E)` not `loop`)

---

## Verdict templates

For each effect kind, pick one:

- **Batch-worthy, correctly batched.** Policy matches cost model.
- **Batch-worthy, under-batched.** Currently N+1 or pseudo-batch.
  Measurable win available.
- **Batch-worthy, over-batched.** Window too large for latency
  requirement, or batches already-parallel CPU work.
- **Batch-worthy, wrong shape.** Currently windowed where
  opportunistic would self-tune, or opportunistic where stepped
  fixed cost makes a trailing window win.
- **Not batch-worthy, correctly passthrough.** Zero-cost abstraction
  in place, no win available.
- **Not batch-worthy, incorrectly batched.** Abstraction is costing
  more than it saves.

---

## Purpose

After running `/batching-jutsu`, the user should know, per effect
kind in their codebase:

1. Is this seam N+1-shaped today?
2. Does batching help here, or would passthrough be better?
3. What policy knobs (window, inflight, batch-cap, leading) match
   the cost model?
4. What is the total inflight RAM at the proposed policy?
5. What plural-API refactors would close silent N+1 by design?

This is a mirror, not a linter. The cost model is the decision
procedure; the command just surfaces the data.

---

## Math appendix

The taxonomy above assumes these six equations. Useful when the
cost-model table alone does not decide the case.

### 1. Per-item amortization curve

For a batch of N items with per-call fixed cost F and per-item
variable cost v:

```
t(N)        = F + N·v             total dispatch time
per_item(N) = F/N + v             amortized per-item cost
```

As N → ∞ per-item cost → v. The ratio F/v says how many items
must ride in a batch before fixed cost stops dominating.

### 2. Sweet-spot MAX_BATCH

Under arrival rate λ, expected tail latency for the last item in
a batch of N is ≈ N/(2λ). Amortization gain is F·(1 − 1/N).
Setting marginal gain equal to marginal tail cost:

```
d(gain)/dN = d(tail)/dN
F/N² = 1/(2λ)
N* ≈ sqrt(2 · λ · F)
```

Sweet spot scales with √(arrival rate × fixed cost), not with
F/v. F/v is the break-even — below it batching loses, above it
batching wins but not linearly.

### 3. Stepped-cost: why windowed beats opportunistic

For effects with stepped fixed cost (BEGIN/COMMIT, RTT), dispatch
cost depends on batch depth only:

```
cost(d) = F + d·v          d = items in this dispatch
```

Opportunistic fires on first arrival with queue depth d_now:
```
expected_cost_opp = F + d_now·v
```

Windowed-trailing holds for window W, gathering ≈ λ·W more
arrivals:
```
expected_cost_win = F + (d_now + λW)·v
amortization_gain = 0                   (same F paid either way)
tail_added        = W                    (worst-case hold time)
throughput_gain   = (d_now + λW) / d_now items per F
```

Windowed wins iff the interactive budget W can afford `W` of
added tail and the throughput multiplier (1 + λW/d_now) is worth
the complexity.

### 4. Already-parallel throughput ceiling

C cores doing one item at variable cost v:
```
throughput_parallel = C / v
```

Batching the same work and dispatching through one worker:
```
throughput_batched = 1 / (F/N + v) → 1/v   as N → ∞
```

Batching on top of parallel substrate caps throughput at **1/C of
parallel baseline**. This is why batching LOSES for rayon par_iter
work: the abstraction costs up to a factor of C in throughput.

### 5. Applicative-collapse compression ratio

For K independent fetches in the same window, compression ratio:
```
applicative_ratio = K → 1       (one dispatch serves all)
```

For a monadic chain `a >>= λx → b(x) >>= λy → c(y)`, compression is
0 — each depends on prior result. Realistic fan-in tree of depth d
with fan-out B:
```
leaves  = B^d      requests
batched = d        dispatches (one per level)
ratio   = B^d / d
```

The batcher's real payoff is this ratio, not N per se. A codebase
with deeply-nested monadic IO will show ratio ≈ 1 even after a
batcher is installed; one with broad independent fan-outs will
see ratio = B^d / d.

### 6. Little's Law and Kingman's approximation

Steady-state queueing identity:
```
L = λ · W                      Little's Law
```

L = items in system, λ = arrival rate, W = time in system.
Useful at the seam: given λ and observed L, infer W without a
clock.

Wait time under G/G/1 queue (arbitrary arrival and service
distributions, one server):
```
E[wait] ≈ (ρ / (1−ρ)) · ((Cₐ² + Cₛ²) / 2) · E[service]       Kingman
```

ρ = utilization (λ · E[service]), Cₐ = CoV of inter-arrival time,
Cₛ = CoV of service time. Consequences:

- at ρ = 0.8, wait multiplier vs service ≈ 4× (already bad)
- at ρ = 0.95, wait multiplier ≈ 19×
- bimodal / heavy-tailed service (Cₛ large) inflates wait
  super-linearly

Why this matters for batching: any policy that increases Cₛ
(e.g. windowed-trailing occasionally dispatches a giant batch)
inflates tail wait by Kingman. Adaptive policies can trade Cₛ
for utilization and lose overall if they miscalibrate.

### Putting it together

Given an effect with fixed cost F, variable cost v, arrival rate
λ, core count C, dependency shape (applicative ratio R):

```
break_even_N = F / v
sweet_spot_N = sqrt(2 · λ · F)
throughput_ceiling = min(1/v, C/v if already-parallel)
realistic_compression = R   (not batch_size)
tail_latency_budget = N / (2λ) + W
wait_inflation = (ρ / (1−ρ)) · ((Cₐ² + Cₛ²) / 2)
```

Pick MAX_BATCH between break_even_N and sweet_spot_N.
Pick WINDOW_MS from tail_latency_budget.
Cap expected throughput at throughput_ceiling.
Use wait_inflation to check ρ budget is below 0.8.

---

## Measurement hygiene

The cost-model table tells you what you should see. Verifying
what you do see is a separate discipline. When comparing two
stacks or two policies:

- **Match batching model.** Opportunistic drain and fixed-count
  buffer dispatch different numbers of items per call at the
  same input rate. Wall-time comparison at zero-work is a
  category error unless both paths dispatch the same depth
  distribution. Pair opportunistic-vs-opportunistic or
  fixed-vs-fixed.
- **Fixture exhaustion gate.** `--max N` silently capped at the
  number of files present is not the requested load. Surface
  effective item count next to requested.
- **Noise floor gate.** Sub-10ms wall-time regimes need
  `(p90 − p10) / p50 < 0.10` across ≥ 10 trials before deltas
  are real. Below that, differences are trial-to-trial variance.
- **Calibrate sleep overhead.** `thread::sleep` on macOS has a
  ~250µs floor per call. Closed-form predictions must subtract
  this from the per-sleep budget or all scored cases show
  ~25% overshoot.
- **Produce pacing matters.** Unpaced + zero-work saturates the
  consumer and measures channel mechanics, not the stack under
  its target regime. Add realistic arrival pacing before
  trusting any shootout.
- **Passthrough is measured, not axiomatic.** Hand-rolled
  passthrough (`if buf.len() >= cap`) can be slower than a
  library operator chain if the library monomorphizes through
  a tighter inner loop. Measure your call site; the sign of
  the overhead can flip.

---

## Related

- `/async-jutsu` — push/pull/dam shape, cancellation, oversubscription
- `/theory:unified-batching` — one-page synthesis, why every layer
  converges on batching
- `/theory:fp-reactive-batching` — Haxl, FRP, Arrows, Free monads,
  Build Systems à la Carte
- `/theory:systems-batching` — hardware rings, io_uring, NVMe, TSO,
  SIMD — same pattern at silicon
- `/theory:dataflow-incremental` — Timely, Differential, Salsa,
  Adapton — batching as windowed delta propagation
- `/sagas:applicative-batching` — loud N+1 as design discipline
- `/sagas:redux-saga-essence` — effect-reification as the vehicle
  for structural batching
- `/rayon:rayon-core` — data-parallel work-stealing; when batching
  would fight rayon
- `/rx:rxrust-core` — observable operators (`throttle_time`,
  `buffer_time`, `window_time`) as batchers in disguise
