---
description: Live aggregation of the graph-library research arc - what is settled, what is contradicted, what three running agents are still testing
argument-hint: [settled|open|pending|contradicted]
---

# Research state, as of 2026-07-20

The single page to read first. Every library writeup in this folder is a
snapshot from one lab run; this file says which snapshots are still true.

## Health warning on every VERDICT in this folder

The measurements here are reproducible and were run against real data. **The
verdicts built on top of them are unreliable and should be treated as one
reader's inference, not as findings.**

In a single session the recommendation moved: adopt petgraph, reject petgraph,
adopt SQLite, qualify SQLite, keep the existing code, adopt petgraph again.
Every one of those was stated with confidence. Each reversal was found only
because someone asked for another pass, which means the reversals nobody asked
for are still in here.

Each lab spent minutes to hours with a library that has years of production use
behind it. That is enough to measure a specific claim. It is not enough to
support "adopt" or "reject".

How to use this folder:

| trust | content |
|---|---|
| high | numbers with a named query, a named graph, and a quoted query plan |
| high | correctness results verified by exact set equality against an independent implementation |
| medium | numbers extrapolated beyond the measured range, all labelled as such |
| **none** | any sentence recommending adoption or rejection |

The adoption decision needs a person who knows the domain, reading the numbers.
It should not be read off this file.

## Reading order for someone arriving cold

1. This file.
2. `README.md` for the workload definition and the 7-function baseline.
3. The `opus-redo.md` in each library folder, which supersedes that library's
   `index.md` wherever they disagree.
4. `relational-graph-patterns/scc-and-counting-prior-art.md` for what the
   literature does and does not contain.

## Provenance of every conclusion

Two rounds have run. A first round on sonnet produced the `index.md` files. A
second adversarial round on opus produced the `opus-redo.md` files, and it
overturned the first round on two of three libraries. A third round is running
now against real data.

**Rule that emerged and should be kept**: a conclusion measured on synthetic
graphs is a hypothesis about real graphs. Four separate reversals in this arc
came from stopping at the first compile error, the first cache-warm number, the
first documentation sentence, or the first synthetic benchmark.

## SETTLED

| claim | evidence | where |
|---|---|---|
| ultragraph rejected | `freeze()` peaks at 1.85x final size, stable across a 10x range | `ultragraph/index.md` |
| `closure.c` is dead code | `sqlite3_closure_init` gates `sqlite3_create_module` behind `#if defined(SQLITE_TEST)` | `sqlite-native/closure-and-graphqlite.md` |
| GraphBLAS rejected | 4 of 7 ops work, the same 4 SQL covers for free; needs a C toolchain everywhere | `graphblas/opus-redo.md` |
| streaming construction beats build-then-compress | `from_sorted_edges` 6ms vs `add_edge` 120.4s for 1M edges | `petgraph/opus-redo.md` |
| petgraph ships 3 recursive implementations | `tarjan_scc`, `depth_first_search`, and `is_cyclic_directed` (which IS `depth_first_search`) | `petgraph/opus-redo.md` |
| `Dfs` / `DfsPostOrder` walkers are iterative | 1M-deep path in 6ms / 11ms | `petgraph/opus-redo.md` |
| no published SQL SCC exists | 46 logged queries, zero hits across SO, dba.SE, GitHub search, DuckDB/DuckPGQ, recursive-CTE literature | `relational-graph-patterns/scc-and-counting-prior-art.md` |
| CozoDB is not out-of-core | its SCC calls `edges.as_directed_graph(...)`, building a full in-memory CSR first | `out-of-core-graph.md` |
| no petgraph-over-disk prior art | 6 phrasings, nothing on GitHub, crates.io, r/rust, users.rust-lang.org | `out-of-core-graph.md` |

## CONTRADICTED, do not cite

| stale claim | who killed it | correction |
|---|---|---|
| "petgraph: storage yes, algorithms no" | `petgraph/opus-redo.md` | 61 lines of trait impls unlock `algo`; 4 of 7 ops replaced |
| "the compact representation and the safe algorithm are mutually exclusive" | same | true for the concrete `Csr`, false for a custom structure implementing the visit traits |
| "SQL covers 4 of 7" | `sqlite-native/opus-redo.md` | 6 of 7; SCC works via forward-backward decomposition |
| "recursive CTEs cannot express SCC" | same | they can, with a host driver loop, at 3.2s vs 155ms compiled |
| "the halt predicate is absent from petgraph" | `petgraph/opus-redo.md` | `EdgeFiltered::from_fn(g, \|e\| !halt[e.source()])` reproduces all `walk.rs` cases |
| "GraphBLAS SCC is absent" | `graphblas/opus-redo.md` | `LAGraph_scc` was installed on the machine during the first evaluation; one `nm \| grep` away |
| "the NonCommercial binding blocks GraphBLAS" | same | 443-line shim, 56 declarations, zero deps, one iteration |
| "GraphBLAS clean build is 137s" | same | 4.16s using system libraries |
| "`walk.rs` has 7 test cases" | `sqlite-native/opus-redo.md` | it has 12; the 5 missed are the depth-carrying ones |

## OPEN, being tested right now

Three agents launched 2026-07-20, all against the live sprefa DB read-only,
all told that confirming a prior result is a valid outcome.

| agent | lab | writeup it owns | decisive question |
|---|---|---|---|
| ~~petgraph real-data~~ | `labs/graph-petgraph-realdata/` | `petgraph/real-data-crosscheck.md` | **LANDED, see below** |
| ~~LadybugDB~~ | `labs/graph-kuzu-realdata/` | `ladybugdb/index.md` | **LANDED, rejected, see below** |
| ~~SQLite red team~~ | `labs/graph-sqlite-adversarial/` | `sqlite-native/red-team.md` | **LANDED, see below** |

### SQLite red team result, 2026-07-20

**Survives with caveats larger than the result.** The 6-of-7 expressiveness
claim holds and is better evidenced than before. Every performance and
data-shape number attached to it is a `rel_df_edge` fact presented as a graph
fact.

Root cause is a sampling error. `rel_df_edge` is **1 of 18** non-empty edge
relations and the friendliest graph in the database (max SCC 6, mean reach
5.35). `rel_flow_edge`, the largest at 371,404 edges, has a **22,257-node SCC**
and mean reach **15,653**.

| attack | result | number |
|---|---|---|
| A1 cost tracks reached set | PARTIAL, framing broke | table-size flatness holds; cost tracks reached EDGES: same 300-node reach is 0.31ms at out-degree 3, **5.99ms at 299**, identical plan |
| A1e real-relation seeds | **BROKE IT** | 18 of 40 random `rel_flow_edge` seeds reach 85,766 nodes at **105-193ms**; bimodal, nothing between 0.6ms and 100ms |
| A1f multi-seed shape | **BROKE IT** | seeding from a TABLE (the only shape `multi_source_walk` has) loses the seek: `SCAN e USING COVERING INDEX`, **7.02ms vs 0.24ms** |
| A2 cold cache / concurrency | PARTIAL | cold 2.5-5.2x, WAL under a writer 3.1x median; `cache_size=-64000` is **unreachable in sprefa** |
| A3 SCC correctness | PARTIAL, one convention broke | peel is sound (0/3000); partition matches an independent Tarjan on 9 adversarial graphs; **self-loops reported acyclic** |
| A4 eccentricity 18 | **BROKE IT** | one seed. True max on `rel_df_edge` is **34**; `rel_flow_edge` is **>=112** with p99 79, above the cap of 64 |
| A5 SCC scaling | **BROKE IT** | FB-SCC is **quadratic in peel-core size**, independent of component count; fit holds across 40x with <4% residuals |
| A6 walk.rs reproduction | **SURVIVED fully** | 12/12 plus 5 edge cases plus **0/400** differential fuzz mismatches |

Unchanged and re-confirmed: the 4,000x reverse-index cliff (162.4ms,
`AUTOMATIC COVERING INDEX`), `idx_df_edge_from` redundancy, `walk.rs` has 12
tests.

Two gaps left open: SQL FB-SCC on `rel_flow_edge` exceeded 25 minutes without
completing, so that relation has no measured SCC time and its 22,257-node
component rests on one Tarjan implementation alone. A giant-SCC traversal under
a concurrent writer was never composed from the two worst cases measured
separately.

### LadybugDB result, 2026-07-20: DO NOT ADOPT

The docs-only conclusion did not survive measurement. **The algorithm is
out-of-core in its storage alone.** Per-vertex algorithm state is allocated from
the buffer pool and cannot spill. Constraining the pool below ~2.2x the on-disk
graph is a hard failure:

```
Buffer manager exception: Unable to allocate memory! The buffer pool is full and no memory could be freed!
```

| edges | vertices | store | min buffer pool | bytes/vertex |
|---|---|---|---|---|
| 1M | 490,811 | 33 MB | 64 MB | 68-137 |
| 5M | 2,454,218 | 173 MB | 384 MB | 104-164 |
| 10M | 4,908,708 | 327 MB | 768 MB | 109-164 |

Linear in V. At 150M nodes that needs **16-24 GB** of buffer pool on a 16 GB
machine. RSS also plateaus at 707MB for a 327MB store regardless of the cap,
the signature of materialized O(V) state. The two doc quotes are accurate about
the graph and silent about algorithm state, and algorithm state is the whole
cost.

**`scc` is silently wrong.** On sprefa's real graph it merged two vertices into
one SCC that have an edge in one direction only, verified against `edges.csv`
independently of the oracle. On a heavily cyclic synthetic it was 65% off. Root
cause: the effective default `maxIterations` is bit-identical to 20, while the
DOCUMENTED default is 100, and passing 100 explicitly yields a different,
correct answer. Non-convergence returns the partial partition **with no error**.

`scc_ko` was hash-exact against sprefa's Tarjan on 3/3 graphs, shows no depth
sensitivity, and at 10M edges is **6.3x slower than plain in-memory Tarjan** for
under 23% RSS saving.

Depth cliff confirmed and worse than LAGraph's: at path depth 10,000 `scc` is
either wrong (41 components against 10,001) or takes 125,939ms. No setting is
both fast and correct.

**No incremental story**: ~200 edges/sec individual mutation against 2.9M/sec
bulk COPY. A full rebuild (212ms) beats incremental at 43 edges, so a reactive
engine re-ticking on file change cannot use it.

Packaging corrections to the prior research:

| prior claim | correction |
|---|---|
| `-rdynamic` in `build.rs` is the fix | stale; `lbug` 0.18.2 already emits it, and it is insufficient on macOS. Apple's linker dead-strips the 87 symbols the extension needs. All 87 are DEFINED in `liblbug.a`, 0 missing. Fix needs each forced as a dead-strip root via `-Wl,-u`, since `-no_dead_strip` was removed from Apple's new ld |
| clean build 8.70s | it does not build. `build.rs` curls a prebuilt 77.5MB `liblbug.a` from `main` rather than compiling the bundled C++ tree. That drift is why the core's `bindGraphEntry` ABI disagrees with every published extension |
| extension version matches | no 0.18.2 extension exists (404); the crate is 0.18.2 |
| MIT confirmed | no LICENSE file in the published crate. Cargo metadata says MIT; only `third_party` licenses ship, all permissive |

## Production defects found by the research, not yet fixed

These are sprefa bugs surfaced as side effects. They live in `~/projects/sprefa`.

Verified against the live DB 2026-07-20. The list is shorter than the research
made it look, because two reported defects are not defects.

| defect | receipt | fix size |
|---|---|---|
| three traversable relations lack a reverse index | `rel_map_edge` (139,709 rows), `rel_bom_edge` (25,314), `rel_port_edge` (22,154). Confirmed: PK autoindex only. 4,000x cliff | 3 DDL |
| `idx_df_edge_from` is redundant | duplicates the PK prefix; the forward plan never uses it | 1 DDL |
| depth cap 64 against `rel_flow_edge` p99 eccentricity 79 | capped walks silently truncate on the largest relation | policy |
| `cache_size` capped at 16MB | assert at `src/db.rs:1540`, `temp_store=FILE` | policy |

**Reported and NOT actually defects:**

| reported | reality |
|---|---|
| self-loop SCC convention mismatch | `src/graph/scc.rs:83-84` already sets `cyclic` for a self-edge. The SQL forward-backward implementation was the wrong one, and it is not being adopted |
| `tarjan` should move to CSR slices | the 2x was measured on data graphs. All six callers (`typecheck.rs:1174`, `typed_plan.rs:402`, `strata.rs:499`, `strata.rs:570`, `derive.rs:2084`, `derive.rs:2187`) pass RULE graphs, which are small |

### petgraph real-data result, 2026-07-20

**The "petgraph is faster" claim was a storage confound.** The prior run
compared `tarjan(&Vec<Vec<u32>>)` against `kosaraju_scc(&DualCsr)` and credited
the difference to petgraph. Building the missing control cell reverses it:

| graph | tarjan / `Vec<Vec<u32>>` | tarjan / `DualCsr` | kosaraju / `DualCsr` |
|---|---|---|---|
| `rel_df_edge` | 19.5ms | **9.9ms** | 14.2ms |
| `rel_flow_edge` | 18.3ms | **9.9ms** | 15.0ms |
| synth 1M/2M | 196.8ms | **102.7ms** | 119.6ms |

With storage held constant petgraph runs 1.16x to 1.43x slower. The win was CSR
all along. It reproduces on the prior run's own synthetic graph, so real data
was never needed to catch it.

| # | hypothesis | result | number |
|---|---|---|---|
| H1 | SCC partition matches on real data | CONFIRMED | identical on 6/6 real relations, exact set equality |
| H2 | 12.0 bytes/edge | **REFUTED** | 16.24 B/e, 24.47 B/e with the mandatory id dictionary |
| H3 | recursive `tarjan_scc` overflows | **REFUTED** | max DFS depth 690 against a 65,420 threshold, 95x margin |
| H4 | O(V) algorithm state | CONFIRMED, worse | 40.00 B/node against tarjan's 4.00 |
| H5 | build cost negligible | **REFUTED** | build is 4.2x to 27.7x algorithm time |
| H6 | 61 lines, halt predicate | PARTIAL | 58 impl lines; halt exact; walker 3.8x slower at scale |

- **H2**: real node ids are full-range `i64` symbol hashes, density ~3e-14, so a
  dictionary must exist before any CSR does. Real cost is `16V + 8E` rather than
  `12E`. The 1.56GB corpus extrapolation becomes **3.44GB**.
- **H4**: the dominant term is kosaraju's RETURN value, `Vec<Vec<NodeId>>`, at 24B
  of header per component on graphs that are 99.99% singleton SCCs. Whole-corpus
  resident at 150M nodes computes to **~10.1GB**, of which 6.0GB is that return
  alone. sprefa's own tarjan removes it.
- **H5**: crossover against a zero-build SQL CTE spans **1.5 to 297 queries**, and
  it tracks mean reachable-set size rather than graph size. `rel_df_edge` and
  `rel_flow_edge` are near-identical in size with crossovers 198x apart. This is
  the tier-design decision rule.
- **H3**: the "assume depth 1,000,000" brief is off by three orders of magnitude.

**Free win, independent of every library question**: move sprefa's existing
`tarjan` onto CSR slices. A ~5-line neighbor-lookup change worth 2x.

## OPEN, nobody is testing

| question | why it matters |
|---|---|
| real depth distribution across ALL edge relations | eccentricity 18 was measured on dataflow alone, and three verdicts lean on it |
| end-to-end build cost for a resident snapshot | every library comparison so far measured algorithm time only; this is the number the tier design needs |
| does the merged auto-index policy (dc9b67b1) preserve reverse-column indexes | reverse traversal without one is ~4,000x slower; `idx_df_edge_to` must survive, `idx_df_edge_from` is genuinely redundant |
| `v6-deps` claims about sea-query, rmcp, tower-lsp-server, tracing | same research pass that produced the wrong petgraph note; never revisited |
| 4 queued labs | neo4j-graph, rustworkx, igraph (license-gated), cpp trio. See `labs/QUEUE.md` |

## The depth question, RESOLVED 2026-07-20

The brief said "assume worst-case path depth 1,000,000". Real measurement says
**max DFS depth 690**, three orders of magnitude off.

Eccentricity 18 turned out to be a single seed rather than a maximum. Measured
properly:

| relation | max eccentricity | mean reach |
|---|---|---|
| `rel_df_edge` | 34 | 5.35 |
| `rel_flow_edge` | **>=112**, p99 79 | 15,653 |

The p99 of 79 sits above the depth cap of 64, so a capped walk silently
truncates on the largest relation in the database.

Per-relation shape varies enormously and drives the build-cost crossover more
than graph size does. **`rel_df_edge` is 1 of 18 non-empty edge relations and
the friendliest one.** Any number measured only against it should be treated as
a dataflow fact rather than a graph fact.

Consequences now settled:

- petgraph's recursive `tarjan_scc` does NOT overflow on this data, 95x margin.
  The stack-safety concern that shaped the first two rounds was hypothetical.
- LAGraph's SCC depth catastrophe (158.4s at depth 4,000) never fires here, so
  the GraphBLAS rejection stands on its other reasons.

## Numbers that are arithmetic, not measurement

Flagged because they read like results and are not.

| number | what it actually is |
|---|---|
| ~~1.56GB for 130M edges~~ | REFUTED. Real cost is `16V + 8E`, giving **3.44GB** |
| ~~~2.2GB whole-corpus resident~~ | REFUTED. Measured terms give **~10.1GB** at 150M nodes, 6.0GB of it kosaraju's return value |
| ~21GB ultragraph at target scale | 1.85x freeze peak extrapolated linearly, never built |
| ~~~1GB kosaraju state~~ | measured at **40.00 B/node**, so 6.0GB at 150M nodes |

### The id dictionary cost is a v5 artifact

H2's dictionary term exists because v5 node ids are `i64` symbol hashes at
density ~3e-14, so a CSR needs a hash-to-dense-index map before it can exist.
v6 decision D1 (surrogate integer keys, no hashed ids) removes that term by
construction. Whoever costs the v6 graph layer should use `8E` plus dense
offsets rather than the `16V + 8E` measured here.

## Method caveats on the literature searches

Both prior-art passes ran after the session's WebSearch budget was exhausted
(200/200). They fell back to `lite.duckduckgo.com` via WebFetch, the Stack
Exchange API, and the GitHub API via curl. Three queries hit CAPTCHA, two
returned literal zero results. The negative findings are consistent and
multiply-sourced, and they carry less weight than a normal pass would.

Named gaps: DDlog / LogicBlox / BigDatalog internals unsettled, pgRouting doc
page 403s, Umbra papers unread.
