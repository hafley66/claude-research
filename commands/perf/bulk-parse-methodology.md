---
description: Synthesized methodology for perf-testing a Rust bulk-parse tool (ast-grep-style scanner). Distilled from biome + oxc. Concrete checklist before writing sprefa's first benchmark.
---

# bulk-parse-methodology

Synthesis of biome and oxc perf practice. Use when setting up benches for a bulk parsing / code-analysis tool.

## The invariants both projects share

1. **criterion2 + CodSpeed simulation** — deterministic instruction counting, not wall-clock. Catches sub-5% regressions on shared runners.
2. **Allocator pinned in bench crate head** — biome swaps jemalloc/mimalloc; oxc ships a `NeverGrowInPlaceAllocator` that omits realloc. Libc defaults destroy arena-heavy signal.
3. **Setup outside the measured region** — criterion `iter_batched` / `iter_with_setup_wrapper`; divan `with_inputs`. Parse+setup must not contaminate the stage under test.
4. **Reuse arenas across iterations, reset inside loop** — matches production pattern (reader/allocator reused across reparse), stabilizes warmup.
5. **Throughput::Bytes on every byte-reading bench** — reports MB/s, makes cross-op and cross-commit comparison dimensional.
6. **Fetch-once URL cache in `target/`** — no vendored blobs, no submodules for perf fixtures.
7. **Paths-filter / dep-graph CI matrix** — don't run every bench on every PR. biome uses `paths-filter`; oxc uses `cargo tree` on changed crates.
8. **CodSpeed owns the numeric gate** — no threshold constants committed.

## Bench shape template

```rust
fn bench_op(c: &mut Criterion) {
    let fixture = BenchCase::fetch("react.development.js");
    let mut group = c.benchmark_group("op_name");
    group.throughput(Throughput::Bytes(fixture.len() as u64));

    // cold (uncached) variant
    group.bench_function("cold", |b| {
        b.iter_batched(
            || setup_fresh(&fixture),
            |input| run_op(input),
            BatchSize::SmallInput,
        );
    });

    // warm (cached / reparse) variant
    group.bench_function("warm", |b| {
        let mut cache = prewarm(&fixture);
        b.iter_batched(
            || cache.clone_for_reuse(),
            |input| run_op(input),
            BatchSize::SmallInput,
        );
    });
}
```

## Fixture discipline

- **Three buckets**: `real/` (downloaded at pinned commits), `spec/` (language-spec corner cases), `synthetic/` (axis stress: deep-nested, wide-sibling, many-markers).
- **Two tiers by size**: `minimal` runs on every PR; `complicated` opt-in, `.take(1)` or gated by label.
- **Axis-named files**: `attribute-heavy.html` beats `test1.html`. The filename is the test description.

## Stage isolation

- One bench binary per stage. Feature-gate deps (`optional = true`) so each binary builds with minimum crates.
- oxc example: lexer, parser, semantic, transformer, codegen, formatter, minifier, linter, pipeline — nine binaries.
- For a scanner tool: walker, parse, match, single-op-pipe, multi-op-pipe, end-to-end pipeline.

## FFI / async boundary trick

When the stage-under-test crosses an unreliable timing boundary (NAPI, tokio, LSP):

- Run the actual measurement out-of-band (vitest, external harness).
- Export a `results.json`.
- Ship a fake criterion bench (`sample_size(10)`, `warm_up_time = 1µs`, `SamplingMode::Flat`) that reads the JSON and burns proportional CPU cycles so CodSpeed sees consistent shapes.
- oxc reference: `tasks/benchmark/benches/parser_napi.rs`.

## End-to-end beyond micros

biome runs `hyperfine` against the CLI on cloned real repos (`webpack`, `prettier`, `eslint`) via `.github/workflows/bench_cli.yml`, triggered by `!bench_cli` PR comment. Output posted as markdown table. Not a gate, signal for human review.

## Allocation-count snapshots

oxc commits `allocs_*.snap` alongside wall-time benches. For a 16GB-for-500-repos target, allocation count per unit of work is a first-class metric, not a corollary of time. Snapshot-test it like any other assertion.

## Profiling (when you need to look)

- Neither project ships tracing-chrome/samply/flamegraph in the bench harness.
- Profiling is operator-attached when investigating a specific regression, not standing infrastructure.
- RUSTFLAGS `-C debuginfo=1 -C strip=none -g` on bench builds is required if CodSpeed-style symbol resolution matters.

## Applied to sprefa v2

- Bench crates per op: `_1_repo`, `_2_line`, `_3_md`, `_4_marker`, `_5_json`, `_6_cursor_ref`. Plus `_pipeline` end-to-end.
- Fixtures: pull 10 pinned commits of real repos via jsdelivr-gh, cache under `target/fixtures/`.
- Axes: deep-nested JSON, wide-object, many-markers, long-line, many-files.
- Cold vs warm per op (reparse is the Phase 1 goal).
- `Throughput::Bytes` on every parse/walk/match op.
- Paths-filter per op on `src/ops/_*_<op>.rs`.
- CodSpeed simulation mode, no threshold constants in-repo.
- Allocation-count snapshots per op to catch cursor/content bloat.

## Sources

- [biome-benchmarks](../perf/biome-benchmarks.md)
- [oxc-benchmarks](../perf/oxc-benchmarks.md)
- [criterion.rs docs](https://bheisler.github.io/criterion.rs/book/) — fetched 2026-04-18
- [divan docs](https://docs.rs/divan) — fetched 2026-04-18
- [CodSpeed simulation instrument](https://docs.codspeed.io/docs/instruments/simulation) — fetched 2026-04-18
- [hyperfine](https://github.com/sharkdp/hyperfine) — fetched 2026-04-18
