---
description: Using ast-grep-core inside rxRust pipelines. Node<'r> lifetime cannot cross Send boundaries; project to owned Hit at the source observable.
---

# rxrust-x-ast-grep

ast-grep-core provides structural code search via `Node<'r, D>` references tied to a `Root<D>` lifetime. That lifetime cannot cross thread boundaries or feed into a `Shared` rxRust context. Solution: compile Pattern once (Arc-wrap for sharing), parse+match sync on a producer thread (rayon or std::thread), emit owned `Hit` structs via `subscriber.next`.

## Thesis

`Node<'r, D>` borrows from `Root<D>`. `Root<D>` is Send (owns source text + parsed tree as owned buffers), but `Node<'r, D>` is not — the lifetime `'r` holds the borrow. Any operator crossing a Send boundary (e.g., `subscribe_on(SharedScheduler)`, `Shared` context) requires all values to be `Send + 'static`. Strip the lifetime at the source observable by projecting each `NodeMatch` into an owned `Hit`.

Pattern compilation is expensive (regex + metavariable parsing). Compile once, wrap in `Arc<Pattern>`, clone it into each producer thread.

## Owned Hit shape

```rust
struct Hit {
    path: String,
    byte_range: (usize, usize),
    matched_text: String,
    captures: HashMap<String, String>,
}
```

Parser and matcher both emit values by cloning into `Hit` — no borrowed data leaks from `Root`. All fields are owned strings. `Send + 'static` guaranteed.

## API shim (scan_files source)

```rust
observable::create(|sub| {
    let pattern = Arc::new(Pattern::try_from("$VAR = $_").unwrap());
    let walker = WalkBuilder::new("./src").build();
    
    rayon::scope(|s| {
        s.install(|| {
            walker.into_iter().for_each(|entry| {
                if sub.is_closed() { return; }
                let Ok(path) = entry?.path().to_str() else { return; };
                let Ok(src) = std::fs::read_to_string(path) else { return; };
                
                let lang = Lang::detect_from_name(path).unwrap_or(Lang::Rust);
                let root = parse(src.as_str(), lang);
                
                root.find(&pattern).for_each(|node_match| {
                    let range = node_match.range();
                    let text = node_match.text().to_string();
                    let captures = node_match
                        .get_captures()
                        .into_iter()
                        .map(|(k, v)| (k, v.text().to_string()))
                        .collect();
                    
                    sub.next(Hit {
                        path: path.to_string(),
                        byte_range: (range.0, range.1),
                        matched_text: text,
                        captures,
                    });
                });
            });
        });
    });
    sub.complete();
})
```

## Gotchas

- `Pattern` does not impl Clone. Wrap in `Arc<Pattern>` for sharing across threads.
- `Node<'r, D>::text()` returns `&'r str`. Call `.to_string()` immediately to break the lifetime.
- `NodeMatch::get_captures()` returns `HashMap<String, &str>`. Clone the values: `.map(|(k, v)| (k, v.to_string()))`.
- `parse(src, lang)` allocates the tree; `Root` is large (arena allocator). Do not buffer `Root` values in a bounded channel. Emit hits, drop root.
- `rayon::scope` ensures all threads join before the closure exits. Safer than spawning detached threads and ignoring `JoinHandle`.

## Canonical snippet

```rust
use ast_grep_core::{parse, Lang, Pattern};
use rxrust::prelude::*;
use std::sync::Arc;

fn scan_files_with_pattern(pattern_str: &str) -> impl Observable<Item = Hit, Err = ()> {
    let pattern = Arc::new(Pattern::try_from(pattern_str).unwrap());
    observable::create(move |sub| {
        ignore::WalkBuilder::new("./src").build().into_iter()
            .for_each(|entry| {
                if sub.is_closed() { return; }
                let Ok(entry) = entry else { return; };
                let path = entry.path();
                let Ok(src) = std::fs::read_to_string(path) else { return; };
                let lang = Lang::Rust; // or detect
                let root = parse(&src, lang);
                
                root.find(&pattern).for_each(|m| {
                    sub.next(Hit {
                        path: path.to_string_lossy().into_owned(),
                        byte_range: (m.start_byte(), m.end_byte()),
                        matched_text: m.text().to_string(),
                        captures: m.get_captures().into_iter()
                            .map(|(k, v)| (k, v.text().to_string()))
                            .collect(),
                    });
                });
            });
        sub.complete();
    })
}

scan_files_with_pattern("$X == $Y")
    .filter(|hit| hit.matched_text.len() > 5)
    .map(|hit| (hit.path.clone(), hit.captures.get("X").cloned()))
    .subscribe(|(path, var)| println!("{}: {:?}", path, var));
```

## Sources

- [ast-grep-core on crates.io](https://crates.io/crates/ast-grep-core) — fetched 2026-04-18
- [ast-grep API docs on docs.rs](https://docs.rs/ast-grep-core/latest/ast_grep_core/) — fetched 2026-04-18
- [ast-grep GitHub repository](https://github.com/ast-grep/ast-grep) — fetched 2026-04-18
- [ast-grep core concepts](https://ast-grep.github.io/advanced/core-concepts.html) — fetched 2026-04-18
- [rxRust observable context and Send boundaries](https://github.com/rxRust/rxRust) — fetched 2026-04-18
