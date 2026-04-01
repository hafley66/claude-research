---
name: rust-build-cache
description: Rust compilation caching, disk management, and why cargo target/ grows so large
license: MIT
compatibility: opencode
metadata:
  source: https://doc.rust-lang.org/cargo/reference/build-cache.html
  depth: intermediate
---

## The problem

`target/` grows without bound. A single Rust project can produce 2-10 GB. With 10 projects, that's 20-100 GB just in build artifacts. macOS gives you no warning until you're at 0 bytes.

## Why target/ is so large

Rust's compilation model:

1. **Each crate compiles to an `.rlib`** -- a static archive of object code plus metadata. One per dependency per profile (dev/release/test/bench = 4x).
2. **Monomorphization happens at the call site** -- generic functions like `Vec<T>::push` get compiled into the crate that calls them, not into the library crate. This means your crate's artifact embeds concrete instantiations of every generic it touches.
3. **Incremental compilation artifacts** -- `.d` dep-info files, fingerprints, per-function object files, query cache. These allow recompilation of only changed functions but add overhead.
4. **Each profile is fully independent** -- `dev`, `release`, `test` each have their own full copy of every dependency compiled at different opt levels.
5. **Proc-macros compile twice** -- once as a host binary (to run during your build) and once for the target.

A typical web service project: ~200 deps × 4 profiles × ~5 MB average = 4 GB. Add incremental artifacts and it's easily 8-10 GB.

## What NOT to do: shared target-dir

It seems logical to set `target-dir = "~/.cargo/target-shared"` in `~/.cargo/config.toml` so all projects share one directory. Don't do this:

- **Concurrent build failures**: cargo has a long-standing bug (rust-lang/cargo#14053, cargo#354) where two cargo instances writing to the same target-dir cause spurious link errors and missing artifact panics.
- **Fingerprint confusion**: path-dep crates with the same name/version across projects can collide.
- **cargo clean nukes everything**: `cargo clean` in any project deletes artifacts for all of them.

## What actually works: sccache

sccache (Mozilla, actively maintained) is a `rustc` wrapper. Instead of cargo managing artifact reuse, sccache intercepts every `rustc` invocation, hashes the inputs, and returns a cached object file if one exists. Each project keeps its own `target/`, but rustc invocations that would produce identical output are short-circuited.

```
project A builds serde 1.0.195  →  sccache stores artifact keyed by (source hash, flags, toolchain)
project B builds serde 1.0.195  →  sccache returns cached artifact, rustc is never invoked
```

**Setup:**
```bash
cargo install sccache
```

```toml
# ~/.cargo/config.toml
[build]
rustc-wrapper = "sccache"
```

**Inspect:**
```bash
sccache --show-stats    # hit rate, cache size, requests
sccache --stop-server   # flush and stop the daemon
```

**Cache location (macOS):** `~/Library/Caches/Mozilla.sccache`
**Default size limit:** 10 GB (configurable via `SCCACHE_CACHE_SIZE`)

**What sccache cannot cache:**
- Proc-macro crates (they require linking a host binary)
- `bin`, `dylib`, `cdylib` crates (linker invocations are not cached)
- Anything with `build.rs` output that changes (env vars, generated files)

In practice, proc-macros (`serde_derive`, `tokio-macros`, `async-trait`, etc.) are a small fraction of compile time. The bulk of time is pure lib crates, which sccache handles well.

**Hit rate expectations:**
- Fresh project, first build: 0% (nothing cached yet)
- Same project, unchanged deps: ~90%+
- New project using same ecosystem deps: ~60-80% depending on feature flag overlap

Note: sccache keys on feature flags. `tokio` with `features=["full"]` and `tokio` with `features=["rt"]` are different cache entries.

## Disk reclamation: cargo-sweep and cargo-cache

sccache prevents redundant recompilation but doesn't shrink existing `target/` dirs. For that:

```bash
cargo install cargo-sweep cargo-cache
```

**cargo-sweep** -- removes old artifacts:
```bash
cargo sweep --time 14        # delete artifacts older than 14 days in current project
cargo sweep --time 30 -r ~/projects   # recursively sweep all projects
cargo sweep --installed      # delete artifacts for toolchain versions no longer installed
```

**cargo-cache** -- inspect what's eating space:
```bash
cargo cache              # summary: registry, git checkouts, build cache
cargo cache --autoclean  # remove old registry sources and git checkouts
```

Suggested weekly cron (`crontab -e`):
```
0 3 * * 0 ~/.cargo/bin/cargo-sweep --time 30 -r ~/projects >> ~/Library/Logs/cargo-sweep.log 2>&1
```

## The correct mental model

```
~/.cargo/registry/     ← downloaded source tarballs (cargo-cache manages this)
~/.cargo/git/          ← git dep checkouts (cargo-cache manages this)
~/Library/Caches/Mozilla.sccache/  ← sccache artifact cache (self-managed, size-capped)

project/target/dev/    ← current incremental artifacts (cargo-sweep manages this)
project/target/release/
project/target/test/
```

sccache and `target/` are complementary:
- sccache avoids redundant compilation across projects
- `target/` still holds the final linked artifacts and incremental state for the current project
- cargo-sweep prunes `target/` entries you haven't touched recently

## When to actually cargo clean

Almost never. Legitimate cases:
- Proc-macro changed but cargo's fingerprint didn't pick it up (rare, usually only when hacking on the macro itself)
- Linker errors that look like symbol conflicts after a major dep update
- Switching between toolchain channels (stable ↔ nightly) can occasionally leave stale artifacts

If in doubt: `cargo clean -p <crate-name>` cleans only that crate's artifact, not the whole tree.

## Reference

- Cargo build cache docs: https://doc.rust-lang.org/cargo/reference/build-cache.html
- sccache repo: https://github.com/mozilla/sccache
- cargo#354 (shared target-dir concurrency): https://github.com/rust-lang/cargo/issues/354
- cargo#14053 (shared target-dir fingerprint bug): https://github.com/rust-lang/cargo/issues/14053
- cargo-sweep: https://github.com/holmgr/cargo-sweep
- cargo-cache: https://github.com/matthiaskrgr/cargo-cache
