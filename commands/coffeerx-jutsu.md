# /coffeerx-jutsu

Explain a chunk of Rust (async + tokio streams, rayon, spawn_blocking, oneshot, join_all, etc.) to a JS/React/RxJS engineer by writing the logic **twice**:

1. First as **CoffeeScript using RxJS**, with numbered line labels `# [01]`, `# [02]`, ...
2. Then the **Rust**, with the same labels as `// [NN]` comments above the matching lines.

Same labels line up one-to-one. Code first, prose last.

Target: `$ARGUMENTS`

## Instructions

1. Read the target code (file path, function name, or pasted snippet from `$ARGUMENTS`).
2. Write the Coffee/RxJS version first, using the mental model table below as the translation rules.
3. Number every semantically important line in Coffee with `# [NN]`. Skip noise (imports, braces, etc.).
4. Write the Rust with `// [NN]` comments **directly above** the matching line. One label per line is fine; a line may carry more than one label if it fuses steps.
5. Keep both versions roughly the same vertical length so the eye can scan label-to-label.
6. After the two code blocks, print the **mental model table** below. Append any row specific to the target that isn't already covered.
7. Minimum prose. One or two sentences at most if a concept has no clean JS analog (e.g. "rayon workers cannot `.await`; that's why the oneshot bridge exists").

## Output shape

````
### CoffeeScript / RxJS

```coffee
# [01] ...
# [02] ...
```

### Rust

```rust
// [01]
...
// [02]
...
```

### Mental model

| Rust | JS/RxJS |
|---|---|
| ... | ... |
```
````

## Mental model table (default rows)

| Rust | JS/RxJS |
|---|---|
| `BoxStream<T>` / `impl Stream<Item=T>` | `Observable<T>` |
| `.then(async \|x\| ...)` | `mergeMap(fn, 1)` |
| `.buffer_unordered(N)` | `mergeMap(fn, N)` |
| `.flat_map(\|x\| stream::iter(xs))` | `mergeMap((x) => from(xs))` |
| `.map(fn)` (sync) | `map(fn)` |
| `.filter_map(fn)` | `mergeMap((x) => fn(x) ? of(fn(x)) : EMPTY)` |
| `futures::future::join_all(vec)` | `Promise.all(arr)` |
| `tokio::spawn(async { ... })` | fire-and-forget async IIFE |
| `tokio::spawn_blocking(\|\| ...)` | `pool.runOne(fn)` returning `Promise` |
| `rayon::spawn(\|\| ...)` + `oneshot` | `pool.runOne(fn)` returning `Promise` |
| `rayon::par_iter(xs).map(fn).collect()` inside `spawn_blocking` | `pool.runBatch(xs, fn)` returning `Promise<Result[]>` |
| `tokio::sync::oneshot::channel()` | `new Promise((resolve) => ...)`; sender = `resolve` |
| `tokio::sync::mpsc::channel(N)` | `Subject` with backpressure buffer of N |
| `Arc<T>` | plain JS reference |
| `Arc<Mutex<T>>` | shared object + explicit lock (rare in JS, usually unneeded) |
| `CancellationToken::cancelled()` race | `takeUntil(cancel$)` |
| Two-phase batch: `join_all` I/O → `spawn_blocking(\|\| par_iter)` CPU | `Promise.all` prefetch → `pool.runBatch` compute |
| `cursor.content` / `cursor.byte_range` (sprefa) | input payload passed into the `mergeMap` / batch fn |

## Rules of thumb to emit alongside

- Never `.await` inside `rayon::spawn` or `par_iter`. Rayon workers are sync. Bridge out via `oneshot`.
- `spawn_blocking` is for long sync work on tokio's blocking pool; `rayon::spawn` is for CPU work on rayon's work-stealing pool. Prefer rayon for parallel CPU; prefer `spawn_blocking` for single long sync calls (e.g. blocking I/O libs).
- Per-item CPU unit goes to the CPU pool. The async runtime handles orchestration and I/O only.
- `buffer_unordered(N)` is the knob for concurrency; `N=1` collapses to sequential `.then`.
