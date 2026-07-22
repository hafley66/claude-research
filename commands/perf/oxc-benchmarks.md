---
description: How oxc-project/oxc actually benchmarks its parser/lexer/semantic/codegen. Custom allocator, dep-graph CI matrix, CodSpeed simulation, FFI bench shims. Load when perf-testing Rust parsing pipelines.
---

# oxc-benchmarks

Reference for oxc's perf-testing methodology, extracted from `~/projects/ext/oxc` at HEAD 2026-04-18.

## Harnesses

| Harness | Where | Purpose |
|---|---|---|
| criterion2 | `tasks/benchmark/Cargo.toml:85` | fork of criterion.rs; `harness = false` + `criterion_group!` |
| CodSpeed simulation | `.github/workflows/benchmark.yml:95-99` | valgrind-style deterministic instruction counting |
| cargo-codspeed | `.github/workflows/benchmark.yml:77` | wraps criterion2 via `codspeed` feature flag |
| vitest bench | `napi/parser/bench.bench.js:3` | JS-side NAPI harness |
| fake-criterion shim | `tasks/benchmark/benches/parser_napi.rs:22-49` | reads vitest `results.json`, burns proportional CPU so CodSpeed sees consistent shapes |

## Custom deterministic allocator

`tasks/benchmark/src/lib.rs:5-40` defines `NeverGrowInPlaceAllocator` — a global allocator that omits `realloc`, eliminating OS memory-table variance. Arena-heavy code + libc realloc non-determinism destroys bench signal; this is the fix.

## Benchmark shapes

- **lexer only** — `tasks/benchmark/benches/lexer.rs:17,70-84`. Loops `Lexer::next_token_for_benchmarks` until `Eof` on pre-cleaned source (regex/template/JSX replaced with strings so error diagnostics do not dominate).
- **parser** — `parser.rs:8-35`. `Parser::parse` over `TestFiles::minimal()`. Allocator reused across warmup+measure, `reset()` inside iter loop.
- **ESTree serialization split** — `parser.rs:37-124`. `iter_with_setup_wrapper` runs parse in setup; measured region is UTF-8→16 span conversion + JSON serialization only.
- **semantic** — `semantic.rs:7-40`. Parse in setup; time `SemanticBuilder::build` + drop; errors moved out of measured region because one fixture is atypical.
- **codegen** — `codegen.rs:11-43` uses `iter_with_large_drop` to keep deallocation out of timing.
- **pipeline** — `pipeline.rs:15-77`. End-to-end parse→semantic→transform→minify→mangle→codegen, single allocator reset. The full-lint baseline.
- **linter** — `linter.rs:15-58`. Rebuilds semantic + ModuleRecord + ConfigStore per iter; measures `linter.run` only.
- **fake-bench FFI** — `parser_napi.rs:22-49`. `sample_size(10)`, `warm_up_time = 1µs`, `SamplingMode::Flat`; proportional cycle-burn against `file.duration * 266672645.0`. Shape for measuring NAPI/LSP boundaries where in-process instrumentation is unreliable.

## Feature-gated per-bench binary

`tasks/benchmark/Cargo.toml:57-128`. Every `oxc_*` dep is `optional = true`. Each bench built with `--no-default-features --features <component> --features codspeed`. Faster CI, cleaner "which layer regressed" signal.

## CI gates

- `.github/workflows/benchmark.yml:11-27` — triggers on PR synchronize, main push, manual. Paths filter limits to Rust + bench YAML.
- `.github/workflows/benchmark.yml:34-56` + `.github/scripts/generate-benchmark-matrix.js:15-65` — dynamic matrix. Changed files → `cargo tree` dep walk → shortlist of affected benches. Change `oxc_parser` → parser+semantic+linter+pipeline run; change `oxc_formatter` → formatter only.
- `RUSTFLAGS="-C debuginfo=1 -C strip=none -g --cfg codspeed"` (`benchmark.yml:80`) — debuginfo retained for CodSpeed symbol resolution.
- `CodSpeedHQ/action@v4.13.1 mode: simulation` (line 95-99) = regression gate.
- Label `0-merge` skips benches (line 37). Concurrency group cancels in-flight on new push (29-31).

## Fixtures and corpora

- `tasks/common/src/test_file.rs:18-90` — `TestFiles::{minimal,complicated,minifier,formatter}()`. All from jsdelivr CDN, cached in `target/<filename>`.
  - `minimal`: RadixUIAdoptionSection.jsx, react@17.0.2, cal.com.tsx, TypeScript@5.3.3 binder.ts.
  - `complicated`: + checker.ts (2.81MB), pdf.mjs (554K), antd.js (6.7M). Only `parser.rs:40,76` uses it with `.take(1)`.
- `tasks/coverage/` — test262/babel/TypeScript as git submodules. Conformance only, not perf.
- `oxc-project/benchmark-files@main` on jsdelivr for custom fixtures (`test_file.rs:41,67`).

## Profiling hooks

- Custom global allocator (above).
- `tasks/track_memory_allocations/` + `allocs_*.snap` snapshots — system + arena allocation counts, committed, regression-checked.
- RUSTFLAGS `-C debuginfo=1 -C strip=none -g` required by CodSpeed valgrind instrumentation.
- No samply, cargo-flamegraph, or tracing in the bench harness. `tracing` is scoped to `apps/oxlint` and `oxc_language_server`.

## Lessons to copy

- Deterministic allocator for benches — realloc non-determinism kills arena-heavy signal.
- One bench binary per stage; `optional = true` features per dep — fast CI + layered regression signal.
- `iter_with_setup_wrapper` / `iter_with_large_drop` to exclude prep and drop costs.
- Reuse arena across iterations with `reset()` inside the loop — mirrors production reuse pattern.
- CDN fetch + `target/` cache — no vendored blobs, no submodules for perf.
- Two-tier corpora (`minimal` default, `complicated` opt-in `.take(1)`) — keep PR-time CI fast, preserve full-size signal.
- Dynamic CI matrix from `cargo tree` on changed files.
- CodSpeed simulation over wall-clock — deterministic on shared runners, catches small-percent regressions.
- Fake-criterion shim for FFI/async boundaries where in-process timing is unreliable.
- Ship allocation-count snapshots alongside wall time. For a 16GB-for-500-repos target, alloc count per unit of work is a first-class metric.

## Sources

- [oxc criterion2 benches](file:///Users/chrishafley/projects/ext/oxc/tasks/benchmark/) — local clone, fetched 2026-04-18
- [oxc NeverGrowInPlaceAllocator](file:///Users/chrishafley/projects/ext/oxc/tasks/benchmark/src/lib.rs) — local clone, fetched 2026-04-18
- [oxc benchmark.yml](file:///Users/chrishafley/projects/ext/oxc/.github/workflows/benchmark.yml) — local clone, fetched 2026-04-18
- [oxc dynamic matrix generator](file:///Users/chrishafley/projects/ext/oxc/.github/scripts/generate-benchmark-matrix.js) — local clone, fetched 2026-04-18
- [oxc TestFiles](file:///Users/chrishafley/projects/ext/oxc/tasks/common/src/test_file.rs) — local clone, fetched 2026-04-18
- [oxc track_memory_allocations](file:///Users/chrishafley/projects/ext/oxc/tasks/track_memory_allocations/) — local clone, fetched 2026-04-18
- [oxc napi parser bench shim](file:///Users/chrishafley/projects/ext/oxc/tasks/benchmark/benches/parser_napi.rs) — local clone, fetched 2026-04-18
- [CodSpeed simulation docs](https://docs.codspeed.io/docs/instruments/simulation) — fetched 2026-04-18
