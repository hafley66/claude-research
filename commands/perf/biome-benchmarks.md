---
description: How biomejs/biome actually benchmarks its parser, analyzer, formatter. Harnesses (criterion + divan + codspeed + hyperfine), bench shapes, fixture sourcing, CI gates. Load before designing perf tests for a Rust code-analysis tool.
---

# biome-benchmarks

Reference for biome's perf-testing methodology, extracted from `~/projects/ext/biome` at HEAD 2026-04-18.

## Harnesses

| Harness | Where | Purpose |
|---|---|---|
| criterion | `crates/biome_*/benches/*.rs` | per-crate micro: parser, analyzer, formatter |
| divan | `crates/biome_module_graph/benches/module_graph.rs:8,26,56` | when setup (parse+semantic) must be excluded via `with_inputs` |
| cargo-codspeed | `.github/workflows/benchmark.yml:224,233` | simulation mode, owns regression gate |
| hyperfine | `.github/workflows/bench_cli.yml:40,86-91` | end-to-end CLI A/B on real repos |
| BenchCase | `crates/biome_test_utils/src/bench_case.rs:22-82` | downloads URL once, caches under `target/<hash>.<ext>` |

## Benchmark shapes

- **uncached + cached pair** — `crates/biome_js_parser/benches/js_parser.rs:42,62`. Cold parse vs `parse_js_with_cache` fed by pre-warmed `NodeCache` via `iter_batched`. Reparse cost visible separately.
- **throughput bytes** — every parse bench calls `group.throughput(Throughput::Bytes(code.len()))` (`js_parser.rs:41`) so criterion reports MB/s.
- **setup-outside / measure-inside** — `crates/biome_js_analyze/benches/js_analyzer.rs:43` parses once outside `b.iter`, only times `analyze(...)`.
- **axis-named fixtures** — `crates/biome_html_parser/benches/fixtures/real/` has `attribute-heavy.html`, `high-depth.html`, `wide-siblings.html`. Each file is a stress axis.
- **three buckets** — markdown uses `real/`, `spec/`, `synthetic/` dirs (`crates/biome_markdown_parser/benches/markdown_parser.rs:27-66`).
- **head-to-head op variants** — `crates/biome_grit_patterns/benches/grit_query.rs:63,69` benches `execute` vs `execute_optimized` on one input.

## Allocator pinning

Every bench crate head swaps the global allocator: jemalloc on linux/macOS, mimalloc on Windows, system on musl-aarch64. Template at `crates/biome_js_parser/benches/js_parser.rs:11-25`. Default libc allocator skews tree-building benches heavily.

## Fixtures and corpora

- `crates/biome_*/benches/libs-*.txt` — newline-separated pinned URLs (jsdelivr/unpkg). JS parser uses jquery, vue, react, svelte, d3, pixi, three, mathjax, typescript (`libs-js.txt:1-12`).
- Analyzer uses jsdelivr-gh with pinned commits (`analyzer-libs-js.txt`).
- Fetched lazily to `target/`, reused across runs via `BenchCase`.
- HTML/markdown fixtures committed in-tree by axis.
- CLI bench clones `webpack/webpack`, `prettier/prettier`, `eslint/eslint` at workflow time (`bench_cli.yml:63-77`).
- `Dockerfile.benchmark` pins rust + node digests for reproducible local runs.

## CI gates

- `benchmark.yml:52-148` — `dorny/paths-filter` gates per-language runs on which crate paths changed.
- `benchmark.yml:229-234` — CodSpeed `mode: simulation`, `cache-base: main`. No numeric threshold in-repo; CodSpeed owns it.
- `bench_cli.yml:18` — opt-in via `!bench_cli` PR comment; posts hyperfine markdown table back, no gate.

## Profiling hooks

None in-tree. Zero references to tracing-chrome, pprof, samply, tracing-flame, flamegraph across Cargo.toml or source. Profiling is operator-attached, external.

## Lessons to copy

- Two harnesses by layer: criterion per-op, hyperfine end-to-end CLI.
- Uncached vs cached with `iter_batched` — maps directly to Phase 1's "reactive scan on par with biome" goal (cold parse vs reparse).
- `Throughput::Bytes` on every byte-reading op so comparisons are dimensional.
- Pin jemalloc/mimalloc at bench crate head.
- Fetch-once URL cache (`BenchCase`) beats vendored blobs or submodules.
- Three-bucket fixtures (real/spec/synthetic) with axis-named files.
- Setup outside `b.iter` / inside `with_inputs`; time only the stage under test.
- Let CodSpeed own the numeric gate; keep repo free of threshold constants.
- Paths-filter to gate per-language bench jobs.

## Sources

- [biome criterion benches](file:///Users/chrishafley/projects/ext/biome/crates/biome_js_parser/benches/js_parser.rs) — local clone, fetched 2026-04-18
- [biome divan bench](file:///Users/chrishafley/projects/ext/biome/crates/biome_module_graph/benches/module_graph.rs) — local clone, fetched 2026-04-18
- [biome BenchCase fetcher](file:///Users/chrishafley/projects/ext/biome/crates/biome_test_utils/src/bench_case.rs) — local clone, fetched 2026-04-18
- [biome benchmark.yml](file:///Users/chrishafley/projects/ext/biome/.github/workflows/benchmark.yml) — local clone, fetched 2026-04-18
- [biome bench_cli.yml](file:///Users/chrishafley/projects/ext/biome/.github/workflows/bench_cli.yml) — local clone, fetched 2026-04-18
- [CodSpeed docs](https://docs.codspeed.io/) — fetched 2026-04-18
