---
description: ignore crate (gitignore-aware fs walker) × rayon composition. Two patterns for parallelizing filesystem work. When to use sync Walk + par_bridge vs WalkParallel alone.
---

# ignore × rayon

Combining `ignore::Walk` (serial iterator over filtered paths) with `rayon` (work stealing) or `ignore::WalkParallel` (built-in multi-threaded visitor) requires careful attention to thread pooling. Walking a directory is cheap; parsing/processing files is expensive.

## Thesis

Two patterns exist:

1. **Sync Walk + par_bridge** — serial FS traversal (fast), parallel work distribution. Walker's `next()` is cheap. `par_bridge()` distributes items to rayon thread pool. Use when work per file is expensive (AST parsing, grep).

2. **WalkParallel alone** — built-in work-stealing queue; walks and visits on rayon-like internal threads. No external rayon needed. Use when work is cheap or you control the visitor closure fully.

Mixing WalkParallel with rayon's parallel iterators or par_bridge causes double-pooling and deadlock risk.

## Pattern A: Walk + par_bridge

Sync walker feeds rayon:

```rust
use ignore::WalkBuilder;
use rayon::prelude::*;

let walker = WalkBuilder::new("./src")
    .build()
    .into_iter()
    .filter_map(|e| e.ok())
    .map(|e| e.path().to_path_buf());

walker
    .par_bridge()           // fan out to rayon thread pool
    .for_each(|path| {
        let content = std::fs::read_to_string(&path).unwrap();
        // expensive: parse, grep, ast-walk
        process_file(&path, &content);
    });
```

Cost: zero when Walker produces slowly (gitignore filtering is the gating factor). rayon spreads the expensive part.

## Pattern B: WalkParallel visitor

Parallel walker, work in closure:

```rust
use ignore::WalkBuilder;

let walker = WalkBuilder::new("./src")
    .build_parallel(4)      // worker threads
    .run(|| {               // per-thread builder
        Box::new(|entry| {  // visitor closure runs on walker thread
            match entry {
                Ok(e) => {
                    let content = std::fs::read_to_string(e.path()).unwrap();
                    process_file(e.path(), &content);
                    ignore::WalkState::Continue
                }
                Err(_) => ignore::WalkState::Continue,
            }
        })
    });
```

Entire job (walk + work) runs on WalkParallel's internal threads. No rayon needed.

## Pattern C: WalkParallel producer + rayon consumer (channel)

Walk multi-threaded, hand off to rayon pool via crossbeam channel:

```rust
use ignore::WalkBuilder;
use crossbeam::channel;
use rayon::prelude::*;

let walker = WalkBuilder::new("./src").build_parallel(4);
let (tx, rx) = channel::unbounded();

std::thread::spawn(move || {
    walker.run(|| {
        let tx = tx.clone();
        Box::new(move |entry| {
            if let Ok(e) = entry {
                let _ = tx.send(e.path().to_path_buf());
            }
            ignore::WalkState::Continue
        })
    });
});

rx.into_iter()
    .par_bridge()
    .for_each(|path| {
        let content = std::fs::read_to_string(&path).unwrap();
        process_file(&path, &content);
    });
```

Decouples traversal (WalkParallel threads) from processing (rayon pool). Use when work is bursty or needs dynamic load rebalancing.

## When to pick which

| Pattern | Traversal | Work | Thread pools | When |
|---------|-----------|------|--------------|------|
| A (Walk + par_bridge) | serial | parallel | 1 (rayon) | most cases; cheap walk, expensive work |
| B (WalkParallel alone) | parallel | visitor | 0 external | cheap work or you own closure; minimal setup |
| C (WalkParallel → channel → rayon) | parallel | parallel | 2 (walker + rayon) | bursty work, decoupling needed, or bounded queue pressure |

**Ripgrep's choice:** WalkParallel (Pattern B). Its grep loop runs on walker threads; no rayon. Work per file (regex matching) is baked in.

**AST-grep over many repos:** Pattern A. Directory walk is fast (gitignore rules gated). Per-file parsing is the bottleneck.

## Gotchas

- **Never wrap WalkParallel in par_iter / par_bridge.** WalkParallel already uses multiple threads. Nesting rayon inside the visitor closure deadlocks if all rayon threads block waiting for WalkParallel to finish distributing work.

- **Thread pool exhaustion.** If your visitor closure spawns rayon work and that work waits on a channel fed by the walker, the walker threads block waiting on rayon threads, and rayon threads block waiting on the channel. Use crossbeam channels to decouple (Pattern C).

- **Single Ignore matcher per thread.** WalkParallel clones the Ignore state (Arc-wrapped) for each thread. Cheap. But gitignore matching is serialized per file within a thread.

- **Path buffer size.** Pattern A with par_bridge can starve rayon if the walker is very slow. Use `channel::bounded()` in Pattern C to throttle.

## Sources

- [BurntSushi/ripgrep Issue #1178 — sketch of using rayon for parallel directory traversal](https://github.com/BurntSushi/ripgrep/issues/1178) — fetched 2026-04-18
- [Avoiding Deadlock from Rayon Thread Pool Exhaustion](https://imfeld.dev/writing/avoiding_rayon_thread_pool_exhaustion) — fetched 2026-04-18
- [rayon FAQ](https://github.com/rayon-rs/rayon/blob/main/FAQ.md) — fetched 2026-04-18
- [ignore::WalkParallel docs](https://docs.rs/ignore/0.4.16/ignore/struct.WalkParallel.html) — fetched 2026-04-18
- [ripgrep/crates/ignore/src/walk.rs](https://github.com/BurntSushi/ripgrep/blob/master/crates/ignore/src/walk.rs) — fetched 2026-04-18
