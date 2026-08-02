---
description: Parallelizing ast-grep-core scans across files with rayon. Per-file parse+match is embarrassingly parallel; pattern compiles once via Arc<Pattern>.
---

# rayon-x-ast-grep

Rayon scales ast-grep scans across files by distributing per-file parse+match work across the thread pool. Each thread owns a fresh tree-sitter `Root` — never share parsing state. Pattern is compiled once and shared immutably.

## Thesis

Per-file parsing and AST matching are embarrassingly parallel: no shared mutable state, no cross-file dependencies inside the hot path. The cost is one-time pattern compilation; amortize over arc-wrapped reference. Emit owned `Hit` structs via bounded channel to avoid collecting unbounded result vectors at scale.

## Shape

Three approaches, ranked by generality:

| Approach | Use when | Notes |
|----------|----------|-------|
| `par_iter` on `Vec<PathBuf>` | Files already enumerated | Simplest; requires preloading Vec |
| `par_bridge` on `ignore::Walk` | Respecting .gitignore | Bridge sequential walk → parallel ops; unbounded iterator |
| `ignore::WalkParallel` (ast-grep native) | Maximum control | Spawns threads directly; no rayon overhead; reference impl |

**Recommendation**: Start with `par_bridge(walk.into_iter())` for streaming unbounded walks. Escalate to `WalkParallel` only if benchmarks prove rayon overhead material (unlikely for parse-heavy workloads).

## Canonical snippet

```rust
use ignore::WalkBuilder;
use rayon::prelude::*;
use std::sync::Arc;

let pattern = Arc::new(compiled_pattern); // once
let walk = WalkBuilder::new(root_dir)
    .build_parallel();

let (tx, rx) = crossbeam_channel::bounded(256); // emit, not collect

walk.run(|| {
    let pattern = Arc::clone(&pattern);
    let tx = tx.clone();
    Box::new(move |result| {
        let entry = result.ok()?;
        if entry.file_type()?.is_file() {
            let src = std::fs::read_to_string(entry.path()).ok()?;
            // per-file tree is owned by this thread's closure; never shared
            let tree = parser.parse(&src, None);
            for m in matcher.find_all(tree.root_node(), &src) {
                let hit = Hit { path: entry.path().into(), m };
                let _ = tx.try_send(hit); // bounded; backpressure via spill
            }
        }
        ignore::WalkState::Continue
    })
});

// drain rx in main thread
while let Ok(hit) = rx.recv() {
    process(hit);
}
```

Or with rayon `par_bridge`:

```rust
let pattern = Arc::new(compiled_pattern);
let (tx, rx) = crossbeam_channel::bounded(256);

ignore::WalkBuilder::new(root_dir)
    .build()
    .par_bridge()
    .for_each_with((pattern, tx), |(pat, ch), entry| {
        let entry = entry.ok();
        let src = std::fs::read_to_string(entry.path()).ok();
        let tree = parser.parse(src, None);
        for m in matcher.find_all(tree.root_node(), src) {
            let _ = ch.try_send(Hit { path: entry.path().into(), m });
        }
    });
```

## Memory notes

- **Tree-sitter `Root` is per-thread scoped**. Each worker owns its own parser instance and tree; drop immediately after match collection. Never stash `Root` across file boundaries.
- **Pattern via `Arc<Pattern>`**. Compile once in main thread, clone the Arc for each worker. The Pattern itself is immutable; no `Mutex`.
- **Bounded channels prevent unbounded buffering**. Crossbeam's bounded channel blocks senders when the queue hits capacity, applying natural backpressure. Avoid collecting hits into `Vec`; stream to channel and drain from receiver.
- **Content is owned per-hit**. If your `Hit` struct carries `String` path, `Vec<Capture>`, etc., the owned bytes live on the heap and are freed as hits are consumed. No aliasing into source buffers.

## Gotchas

- **`ignore::WalkParallel` vs rayon**. ast-grep's reference uses `WalkParallel::run()` directly, not rayon. If you layer rayon on top, you get two thread pools (rayon + ignore's threads). For CPU-bound patterns, rayon may starve. Prefer rayon's global pool by using `par_bridge` or stick to `WalkParallel` alone.
- **Parser must be `Send`**. Tree-sitter parsers in Rust (e.g., via `tree-sitter` crate) are `Send` but not `Sync`. Each thread needs its own instance; do not share one parser via `Arc<Mutex<Parser>>`.
- **Late-binding captures**. If captures reference source bytes, they are borrowed from the source string passed to `parse()`. Ensure captures are projected to owned `String` / `Vec` before sending across the channel, or store source alongside the hit.
- **Panic safety**. `WalkParallel` is not `UnwindSafe`. Catch panics in per-file closures to avoid poisoning the walk; wrap in `catch_unwind`.

## Sources

- [ignore::WalkParallel docs](https://docs.rs/ignore/latest/ignore/struct.WalkParallel.html) — fetched 2026-04-18
- [rayon::iter::ParallelBridge docs](https://docs.rs/rayon/latest/rayon/iter/trait.ParallelBridge.html) — fetched 2026-04-18
- [ast-grep Performance Tip (parallel parsing via findInFiles)](https://ast-grep.github.io/guide/api-usage/performance-tip.html) — fetched 2026-04-18
- [ripgrep source / ignore crate origin](https://github.com/BurntSushi/ripgrep) — fetched 2026-04-18
