# /batching-jutsu

Audit a codebase or design for batching discipline: "is this N+1-shaped, and
does batching actually help here?" Primary Rust; also rxjs/Node/Go/Python.
Pairs with /async-jutsu (push/pull/dam shape).

Arguments: (none)=full sweep | `here` | `path <p>` | `design` | `numbers`
(sweet-spot table only).

## Mental model

Batching is a time-space tradeoff, decided per seam by cost model:

```
batching pays iff (per-call fixed cost F) >> (per-item variable cost v)
                  AND v is flat in batch size
```

Regimes: LARGE fixed cost (git odb read, sqlite BEGIN/COMMIT, network RTT,
statement prepare) = always batch. MEDIUM (parser alloc, pattern compile) =
batch unless already rayon-parallel. SMALL (HashMap get, mmap read) =
passthrough. Already-parallel work = batching LOSES (caps throughput at 1/C
of the parallel baseline).

## Three invariants

1. **Applicative beats monadic.** Independent fetches collapse into one
   dispatch; dependent chains cannot (Haxl 2014, DataLoader).
2. **Passthrough is the zero-cost default.** The batcher shape isn't the
   cost; the policy is.
3. **Tail latency is the hidden cost.** Interactive paths want 8-16ms
   windows or leading-edge; throughput paths afford 50-500ms.

## Pass 1 — N+1 taxonomy

- **Silent N+1**: singular-only API called in a loop; batching inexpressible.
  Plural APIs (`fetch_many(&[T])`) make loops obvious — singular-only IO is
  a design smell.
- **Loud N+1**: plural API exists, caller does `fetch_many(&[item])` in a
  loop. Grep-catchable.
- **Pseudo-batch**: `join_all(items.map(single_fetch))` — concurrency
  without coalescing; burns N x fixed cost.
- **Structural batch**: call sites only have `put(Fetch{key})`; batcher
  windows + dispatches plural. N+1 impossible by construction.
- **Opportunistic batch**: block on first item, non-blocking `try_recv`
  drain of whatever queued, dispatch, one knob (MAX_BATCH). Self-tunes with
  arrival rate; backpressure free from queue fill. Prior art: NAPI, Nagle,
  Postgres group commit, block-layer plug/unplug.

## Pass 2 — cost model per effect

```
effect / fixed cost / variable cost / batch size where amortization flattens
/ already-parallel? / interactive-or-throughput?
```

Reference points: git odb read F=10-100us sweet 1-8 @4ms window; sqlite
SELECT F~100us sweet 64 (IN-rewrite); sqlite INSERT F~1ms sweet 100-1000
@50ms trailing; shell exec / HashMap get: never batch; tree-sitter parse:
1-16 per rayon worker, no window.

WINS: F >= 10x v and v flat. LOSES: F <= v, or already-parallel, or tail
budget blown. NEUTRAL: pick for code simplicity.

## Pass 3 — policy knobs

```
WINDOW_MS    interactive 8-16 | throughput 50-500 | one-shot 0 | opportunistic 0
MAX_INFLIGHT cpu: rayon pool | io: 1 if shared resource, cores if independent
MAX_BATCH    ~ F/v break-even; sweet spot N* ~ sqrt(2*lambda*F)
LEADING      true if first-token latency matters
```

Shapes: **opportunistic** (default; flat amortization curve) / **windowed
leading** (stepped fixed cost + interactive) / **windowed trailing**
(stepped + throughput: COMMIT, fsync) / **passthrough** (no F) /
**fixed-count** (`bufferCount(N)` — safe only with reliable near shutdown;
holds last partial batch hostage on long-lived streams — pair with
buffer_time) / **adaptive** (add LAST, only on production evidence).

Space: `MAX_INFLIGHT x MAX_BATCH x sizeof(E)` summed per kind; target <1MB.

## Equations (when the table doesn't decide)

```
per_item(N) = F/N + v                      amortization curve
N*          = sqrt(2*lambda*F)             sweet-spot batch (lambda = arrival rate)
tail(N)     = N/(2*lambda) + W             last-item latency
parallel ceiling: batching rayon work caps at 1/C of baseline
applicative ratio: fan-out tree B^d leaves / d dispatches; monadic chain = 1
Kingman: E[wait] ~ (rho/(1-rho)) * ((Ca^2+Cs^2)/2) * E[svc]; keep rho < 0.8;
         batchy dispatch inflates Cs and thus tail
```

## Measurement hygiene

Match batching model AND producer pacing when comparing stacks (unpaced
zero-work measures channel mechanics); surface fixture exhaustion (--max N
silently capped); noise gate (p90-p10)/p50 < 0.10 over >=10 trials before
trusting sub-10ms deltas; macOS thread::sleep floor ~250us/call; measure
passthrough, don't assume it.

## Red flags

Singular-only IO in a loop; join_all over a source with a plural API;
batching rayon work; bufferCount alone on a long-lived stream; WINDOW=0 with
MAX_BATCH>1; interactive window >16ms; LEADING=false on interactive;
shared-resource MAX_INFLIGHT>1 without a safety story; inflight RAM >1% of
budget.

## Green flags

Plural-only IO APIs; per-kind policy registry; passthrough for parallel
work; knobs documented with rationale; space accounted; `put(E)` not loops.

## Output

N+1 sites (file:line, shape) / cost table / WINS-LOSES-NEUTRAL partition /
design gaps (singular APIs to pluralize, pseudo-batches) / space cost vs
budget / policy table. Report the shape; leave interpretation to the user.
