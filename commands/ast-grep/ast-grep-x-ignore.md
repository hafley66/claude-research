# ast-grep × ignore crate: WalkParallel file traversal

**Fetched 2026-04-18**

ast-grep uses BurntSushi's `ignore` crate (same library powering ripgrep) for parallel file discovery. This is the reference implementation for bulk parsing at repo scale without blocking on I/O.

## Thesis

`WalkParallel` is not an iterator—it's a work-stealing thread pool that spawns N threads, each with its own visitor closure. The factory pattern (`Fn() -> Fn(DirEntry) -> WalkState`) splits concerns: builder config is one-shot, but the closure receives one instance per thread, enabling lock-free thread-local state accumulation. Files are never buffered to heap; results flow directly to a cross-thread channel or join at the end.

## Shape

### WalkBuilder config

```rust
WalkBuilder::new(root_path)
  .hidden(false)              // include .* dirs
  .gitignore(true)            // parse .gitignore + .git/info/exclude
  .follow_links(false)        // do not traverse symlinks
  .max_buffer_length(1024)    // entries queued per thread
  .build_parallel()           // → WalkParallel
```

Hidden files, gitignore respect, and depth come from the builder. Custom type filters (`.add_ignore`, `.add_custom_ignore`) compose before build.

### run() with visitor factory

```rust
walker.run(|| {
  // Closure factory: called once per thread
  // Local state lives here, no locking needed
  let mut local_matches = Vec::new();
  let mut local_errors = Vec::new();
  
  Box::new(move |result| {
    match result {
      Ok(entry) => {
        if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
          // Process file; accumulate in local vec
          match parse_and_match(entry.path()) {
            Ok(matches) => local_matches.extend(matches),
            Err(e) => local_errors.push((entry.path().into(), e)),
          }
          WalkState::Continue
        } else if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
          // Decide whether to skip this dir subtree
          if should_prune(entry.path()) {
            WalkState::Skip
          } else {
            WalkState::Continue
          }
        } else {
          WalkState::Continue
        }
      }
      Err(e) => {
        local_errors.push(("walk error".into(), e));
        WalkState::Continue
      }
    }
  })
})
```

Each thread runs its own closure. After all threads drain, results are merged. No `Mutex`, no channel overhead per file.

### Shuttling results out

Two patterns:

**1. Accumulate per-thread, merge at end** (simplest):
```rust
let results: Vec<_> = walker.run(|| {
  let mut local = Vec::new();
  Box::new(move |entry| {
    // ...
    local.push(...)
    WalkState::Continue
  })
}).collect(); // collects Vec<Vec<T>>; flatten if needed
```

**2. Send via crossbeam mpmc** (no collect, streaming):
```rust
let (tx, rx) = crossbeam::channel::unbounded();
walker.run(|| {
  let tx = tx.clone();
  Box::new(move |entry| {
    // ...
    let _ = tx.send(...);
    WalkState::Continue
  })
});
// tx dropped → rx.recv() returns None after drain
```

## Canonical snippet

```rust
use ignore::WalkBuilder;
use crossbeam::channel;

fn bulk_parse_dir(root: &Path) -> Result<Vec<ParseResult>> {
  let (tx, rx) = channel::unbounded();
  let builder = WalkBuilder::new(root)
    .hidden(false)
    .gitignore(true)
    .build_parallel();

  // Spawn parsing threads
  builder.run(|| {
    let tx = tx.clone();
    Box::new(move |entry_result| {
      match entry_result {
        Ok(entry) if entry.path().is_file() => {
          if let Some(content) = std::fs::read_to_string(entry.path()).ok() {
            let result = parse_and_extract(&content);
            let _ = tx.send((entry.path().to_path_buf(), result));
          }
          ignore::WalkState::Continue
        }
        Ok(_) => ignore::WalkState::Continue,
        Err(_) => ignore::WalkState::Continue,
      }
    })
  });

  drop(tx); // signal EOF
  Ok(rx.iter().collect())
}
```

## Gotchas

- **No inner iterator**: `run()` returns `()` or a `ParallelVisitor` object. Call `.collect()` only on the return value, not inside the closure.
- **Skip dirs aggressively**: Returning `WalkState::Skip` prevents recursion into that subtree. Return it only on `DirEntry` where `is_dir()` is true.
- **Thread-local state only**: Do not share `Arc<Mutex<T>>` across closures; each thread gets its own closure. Use `crossbeam::channel` for cross-thread communication if you need it.
- **Do NOT wrap in rayon**: `WalkParallel` owns its thread pool (configurable via `.threads(n)`). Wrapping in `rayon::par_bridge()` double-pools and wastes cores.
- **Threads default to 2**: On most systems, `WalkParallel` spawns 2 threads by default. Call `.threads(n)` on the builder to override. Do NOT call `.threads(0)` (panics).

## Sources

- [BurntSushi ripgrep ignore crate source: walk.rs](https://github.com/BurntSushi/ripgrep/blob/master/crates/ignore/src/walk.rs)
- [docs.rs: WalkParallel struct API](https://docs.rs/ignore/latest/ignore/struct.WalkParallel.html)
- [docs.rs: WalkBuilder struct API](https://docs.rs/ignore/latest/ignore/struct.WalkBuilder.html)
- [GitHub ast-grep: file discovery via ignore crate](https://github.com/ast-grep/ast-grep)
