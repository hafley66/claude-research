---
description: Opinionated rxRust-on-top architecture for sprefa v2 scanner. Load when building or editing reactive scanner code.
---

# sprf-rx-runtime

## Core premise

Sprefa v2's scanner is a reactive pipeline: file discovery → pattern matching → capture emission → effect dispatch. This command anchors the architectural stack: rxRust Observable layer on top, rayon-parallelized source observables underneath (hidden from application code), ast-grep-core for pattern matching, ignore::WalkParallel for file system traversal.

One time language (rxRust Observables). No StreamExt in application code. No lifetimes crossing Subject boundaries.

## Layer stack (diagram-ish)

```
[Application: Observable chains]
  └─ map/filter/flat_map/share operators
[rxRust Observable::create sources]
  └─ rayon par_iter() producers
  └─ ignore::WalkParallel file walkers
[ast-grep Pattern matching]
  └─ Arc<Pattern> shared, compiled once
[I/O: Reader (git blob / WT / buffer stack)]
```

Semantics: Walking and parsing happen in parallel rayon threads *inside* the observable source. Operators (map/filter) run single-threaded or on the configured tokio scheduler. Emission is owned (no references escape source boundaries).

## Seven rules

1. **One time language: rxRust Observables.** All async composition through Observable chains and operators. No StreamExt, no tokio::spawn loops, no manual async/await scheduling in operators.

2. **Hide rayon inside observable::create sources only.** Use `rayon::ThreadPool::with_num_threads()` to spawn producers. Never call `par_iter()` in an operator. Operators stay single-threaded or scheduler-bound.

3. **Emit owned Hit values across Subject boundaries.** No `Node<'r>` or `&str` lifetimes crossing Observable subscription gates. Project to owned (String, byte_range, Arc<Captures>) inside the source before `subscriber.next()`.

4. **ignore::WalkParallel for file discovery; do not wrap in rayon.** Walk abstraction already has per-thread callbacks. Thread the Observable subscriber through the walker directly; emit as you traverse.

5. **Compile Pattern once, share Arc<Pattern>.** Pattern is expensive. Build it on startup, wrap in Arc, pass to all scanner sources. Never recompile per file or per thread.

6. **Bounded crossbeam channel if producer outruns Observable consumers.** If the walk/match source outpaces downstream consumption, use a bounded `crossbeam_channel` inside the source observable to back-pressure. Never unbounded queues.

7. **tokio workers = cores/2 at boot; rayon default = full cores.** Tokio scheduler for LSP async I/O and effect dispatch. Rayon pool for CPU-bound file walk and pattern matching. Explicit pools, sized once at startup.

## Reading order for related commands

- `/rx:rxrust-core` — Observables, Scheduler trait, operator inventory, gotchas (lifetimes, backpressure)
- `/rx:rxrust-x-rayon` — Why not rayon::ThreadPool as a Scheduler; producer sources pattern
- `/rx:rxrust-x-ast-grep` — Project owned captures; strip `'r` at source
- `/walkers:ignore-walkparallel` — Parallel file traversal; per-thread callback shape
- `/ast-grep:ast-grep-core-rust` — Pattern compile, matcher trait, captures extraction
- `/rayon:rayon-core` — Thread pool, par_iter, scoped tasks
- `/rayon:rayon-x-tokio` — When to use rayon (CPU) vs tokio (I/O); no nested await inside rayon closures

## Canonical scanner shape (pseudocode Rust, ~30 lines)

```rust
use rxrust::prelude::*;
use std::sync::Arc;
use ignore::WalkParallel;

pub fn scan_repo(repo: RepoPath, rules: Arc<Rules>) -> Observable<Arc<Hit>, ()> {
    observable::create(move |subscriber| {
        let walker = WalkParallel::new(&repo).threads(num_cpus::get());
        let pattern = Arc::new(rules.compile_pattern());
        
        walker.run(move || {
            let sub = subscriber.clone();
            let pattern = pattern.clone();
            move |result| {
                let path = result.ok()?.path();
                let bytes = std::fs::read(path).ok()?;
                
                // Single-threaded pattern matching per file
                for mtch in pattern.match_all(&bytes) {
                    let hit = Arc::new(Hit {
                        path: path.into(),
                        byte_range: mtch.range,
                        matched_text: bytes[mtch.range].to_vec(),
                        captures: mtch.captures.clone(),
                    });
                    if sub.is_closed() { return; }
                    sub.next(hit);
                }
                Some(())
            }
        });
        subscriber.complete();
    })
}

// Usage: consumers are Observable operators
scan_repo(repo, rules)
    .map(|hit| process_hit(&hit))
    .filter(|processed| should_emit(&processed))
    .subscribe(|final_hit| { /* effect */ })
```

Key points:
- `WalkParallel` runs per-thread callbacks; pass subscriber clones through.
- Pattern compiled once, wrapped in Arc.
- Owned Hit emitted; no references to file bytes or captures beyond the Arc boundary.
- Operators downstream (map/filter) run single-threaded on the configured scheduler.
- Backpressure via `is_closed()` check before next().

## Anti-patterns

**Nested par_map in operators**: Do not use rayon inside a map operator. The Observable operator is single-threaded; put parallelism in the source.

**Node<'r> across threads**: ast-grep nodes carry lifetime references to the source text. Extract owned captures inside the source observable; emit Arc<Captures> or owned Vec<String>.

**Double-pool Walk+rayon**: WalkParallel already parallelizes. Do not wrap it in a rayon par_iter().

**Unbounded Subject**: Always use BehaviorSubject or ReplaySubject for warm state, and bound any internal queues with crossbeam::bounded_channel.

**Observable logic in operators**: Operators are synchronous transformations. File I/O, pattern matching, effect dispatch all belong in the source observable or effect sink, never in a map/filter/flat_map body.

---

Last updated: 2026-04-18. Canonical reference: sprefa v2 chat_log and CLAUDE.md in `/Users/chrishafley/projects/sprefa/v2`.
