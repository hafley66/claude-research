---
description: the design space for graph queries in relational and embedded databases, surveyed 2026-07-19
argument-hint: [section]
---

# Relational and embedded-database patterns for graph queries

Literature-and-source survey, complementary to `labs/graph-sqlite`'s
empirical recursive-CTE timing lab (a different agent's work, not
duplicated here). This document reads specifications, source, and
repository health; it does not benchmark. See the parent
[`graph-libs/README.md`](../README.md) for the shared workload (283,127
dataflow nodes, 261,704 edges measured, ~150M/~130M at the 500-repository
target, 16GB laptop, non-resident-by-default requirement) and the seven
baseline operations from `~/projects/sprefa/src/graph/scc.rs` and
`walk.rs`.

## Verdict

**Keep sprefa's SQL fixpoint as the default lowering path, and keep
bypassing it to native Rust for the two shapes it cannot cover well: SCC
and condensation, and any min-by-key aggregation across a recursive
fixpoint.** `src/engine/derive.rs` already does this today: a semi-naive
SQL fixpoint by default, with `try_native_halt_bfs`
recognizing the halt-BFS rule shape and swapping in `walk.rs`'s in-memory
BFS instead, and `scc.rs`'s condensation approach avoiding the
Theta(V^2) closure table that `count_pairs` would otherwise need. This
survey's literature check and probes land on the same two gaps sprefa's
own code comments already name, independently.

No pattern, standard, or embedded engine surveyed here beats "one recursive
CTE, evaluated by an engine that already exists" for the common case
(`reaches_from`, `reached_by`, depth-capped walks): all are cleanly
expressible, verified against sprefa's own test vectors, not assumed. Two
specific, checkable things did NOT hold up on inspection and are worth
remembering on their own: `ext/misc/closure.c` is dead code in a normal
SQLite build (its own header calls it "Experimental and obsolete...
Demonstration and testing only," compiled out unless built with
`-DSQLITE_TEST=1`), and CozoDB, an embeddable Rust datalog-and-graph
database that looks like the closest match to sprefa's own model of
anything checked in this survey, is stalled: last push 2024-12-04, and its
own issue tracker has an unanswered "Is cozo still being maintained?"
thread running from December 2025 to June 2026. Full detail in
[07-synthesis.md](07-synthesis.md).

## Method

Every claim in this survey is tagged one of:

- **SPEC**: quoted directly from a vendor specification page (SQLite's
  `lang_with.html`, DuckDB's `with.html`, PostgreSQL's `ltree.html`), fetched
  during this survey.
- **SOURCE**: read from vendored source code, not a summary of it
  (`ext/misc/closure.c`, 984 lines, fetched in full and read line by line;
  sprefa's own `src/engine/derive.rs` and `src/graph/scc.rs`/`walk.rs`).
- **PROBE**: a small, reproducible `:memory:` sqlite3 check run against
  exact test vectors copied from `walk.rs`, not a benchmark. Script and
  notes: `~/projects/claude-research/labs/relational-graph-survey/`.
- **REPO HEALTH**: `gh api repos/<owner>/<repo>` (archived flag, last push,
  issue activity), not a README's self-description, not WebSearch (budget
  was exhausted for this survey; WebFetch and `gh api` were used
  throughout instead).
- **Secondary source**: general knowledge or a tertiary source (Wikipedia),
  marked explicitly wherever used, and never substituted for a primary
  source that was reachable.

Nothing here reports a benchmark number; that is `labs/graph-sqlite`'s job,
not duplicated in this document.

## Sections

1. [SQLite recursive CTEs against the seven operations](01-sqlite-recursive-cte.md):
   self-reference/mutual-recursion limits, `UNION` vs `UNION ALL`
   termination, whether the halt predicate is expressible (verified: yes),
   and the one real gap (min-by-key merge).
2. [`ext/misc/closure.c`, read from source](02-closure-c.md): dead code in
   a normal build, depth pruning genuinely pushed into the traversal loop,
   AVL-tree memory shape, and how modest a halt-predicate patch would be if
   anyone still wanted to build on deprecated code.
3. [SQL/PGQ and DuckDB](03-sql-pgq-and-duckdb.md): the ISO/IEC
   9075-16:2023 standard, `duckpgq`'s real-but-research-grade maturity
   (checked via its own issue tracker, not just its README), and DuckDB's
   `USING KEY` recursive CTE clause, the one SQL-dialect feature found in
   this survey that closes the min-by-key gap directly.
4. [The classic relational patterns](04-relational-patterns.md): adjacency
   list, recursive CTE, closure table, materialized path, nested sets,
   compared on read/write/storage cost and what each can express, with
   sprefa's own `rel_port_reach` placed precisely against the closure-table
   row.
5. [Datalog and fixpoints in SQL: verified prior art](05-datalog-fixpoint-prior-art.md):
   semi-naive evaluation and magic sets (both DBLP-verified citations),
   the Green/Huang/Loo/Zhou survey, Soufflé as the compile-to-native
   alternative to lowering into SQL, and differential-datalog's (DDlog)
   archival.
6. [Adjacent embedded engines](06-adjacent-embedded-engines.md): libSQL/
   Turso, CozoDB (stalled), indradb, oxigraph, SurrealDB, Cayley, all
   checked for repository health via the GitHub API, with Kuzu's
   archival restated as the pattern to watch for.
7. [Synthesis](07-synthesis.md): the coverage table across all seven
   operations and every pattern, why sprefa's existing split is already the
   right answer, and a full "what I could not establish" accounting.

## Related

- Shared workload and six-baseline-function framing: `../README.md`
- Empirical SQLite lab (recursive CTE timings, `closure.c` compilation,
  `graphqlite` build), owned by a different agent, not duplicated here:
  `commands/graph-libs/sqlite-native/`
- This survey's scratch notes and reproducible probes:
  `~/projects/claude-research/labs/relational-graph-survey/`
- Sibling library writeups for tone and depth comparison: `../petgraph/`,
  `../ultragraph/`
