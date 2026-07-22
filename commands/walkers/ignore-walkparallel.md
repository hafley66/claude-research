# ignore::WalkParallel

**Fetched 2026-04-18**

Multi-threaded recursive directory iterator respecting `.gitignore`, custom ignore files, and file-type filters. Zero-copy visitor pattern with per-thread closure factories.

## API Surface

- **WalkBuilder** — configurable constructor (builder pattern)
  - `threads(n)` — thread count; `0` (default) uses heuristics
  - `hidden(bool)` — skip dotfiles; enabled by default
  - `git_ignore(bool)` — parse `.gitignore` rules; enabled by default
  - `add_custom_ignore_filename(name)` — register custom ignore file (chainable; later registrations have higher priority)
  - `types(TypesBuilder)` — file-type matcher (overrides previous)
  - `standard_filters(bool)` — toggle all standard filters as group (enabled by default)
  - `build_parallel()` → `WalkParallel`
- **WalkParallel** — parallel runner
  - `run(visitor_factory: FnOnce(...) -> Box<dyn FnMut(...) -> WalkState>)` — execute closure-per-thread
  - `visit(builder: ParallelVisitorBuilder)` — alternative: factory with per-thread Drop
- **DirEntry** — directory entry (Result wrapper for errors)
- **WalkState** — return type for visitor closure
  - `Continue` — process entry
  - `Skip` — skip directory (prunes subtree)
  - `Quit` — halt entire walk

## Visitor Pattern

`run()` accepts a factory returning `Box<dyn FnMut(Result<DirEntry, Error>) -> WalkState>`. Each thread receives its own closure instance. Return `WalkState` controls branching:

```rust
let mut walk = WalkBuilder::new(".")
    .threads(4)
    .build_parallel();

walk.run(|| {
    Box::new(|result| {
        match result {
            Ok(entry) => {
                let path = entry.path();
                println!("{}", path.display());
                WalkState::Continue
            }
            Err(e) => {
                eprintln!("error: {}", e);
                WalkState::Continue
            }
        }
    })
});
```

## Canonical: Count .rs files

```rust
use ignore::WalkBuilder;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

let count = Arc::new(AtomicUsize::new(0));
let mut walk = WalkBuilder::new("/path/to/repo")
    .threads(4)
    .build_parallel();

let count = Arc::clone(&count);
walk.run(move || {
    let count = Arc::clone(&count);
    Box::new(move |result| {
        if let Ok(entry) = result {
            if entry.path().extension().map_or(false, |e| e == "rs") {
                count.fetch_add(1, Ordering::Relaxed);
            }
        }
        ignore::WalkState::Continue
    })
});

println!("Found {} Rust files", count.load(Ordering::SeqCst));
```

## Gotchas

- **Visitor factory returns Box<dyn FnMut>** — not the closure itself. Factory is FnOnce, executed once per thread. Captures thread-local state inside Box.
- **WalkState::Skip on directory** — prunes entire subtree. On file, acts like Continue.
- **threads(0)** — spawns heuristic count; with rayon present, tune down to avoid oversubscription.
- **Gitignore parsing cached per-directory** — safe at scale; no repeated file I/O.
- **Errors are per-entry** — visitor receives `Result<DirEntry, Error>`; handle or ignore. Framework does not stop walk.
- **Symlinks not followed** — requires explicit configuration beyond this scope.
- **Atomic counting** — if aggregating results across threads, use Arc<Atomic*> not plain counter (data race).

## Left-joins

- `ignore-x-rayon.md` — composing WalkParallel with rayon thread pools
- `ripgrep-walk-integration.md` — ripgrep's use of WalkParallel in `main.rs`

## Sources

- [ignore crate on docs.rs](https://docs.rs/ignore/0.4.25/ignore/) (fetched 2026-04-18)
- [WalkParallel struct](https://docs.rs/ignore/0.4.25/ignore/struct.WalkParallel.html) (fetched 2026-04-18)
- [WalkBuilder struct](https://docs.rs/ignore/0.4.25/ignore/struct.WalkBuilder.html) (fetched 2026-04-18)
- [ripgrep: File Traversal and Filtering](https://github.com/BurntSushi/ripgrep/tree/master/crates/ignore) (reference implementation)
