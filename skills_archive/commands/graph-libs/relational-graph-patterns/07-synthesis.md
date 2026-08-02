---
description: what the design space actually offers against the seven operations, and whether sprefa's SQL fixpoint should change
argument-hint: [section]
---

# Synthesis: what the design space offers, and what sprefa is already doing right

## Coverage table

| operation | adjacency list (app code) | recursive CTE (SQLite/DuckDB) | closure table | materialized path / nested sets |
|---|---|---|---|---|
| `tarjan` (SCC) | yes, iteratively, as sprefa already does | no clean expression; SCC needs two-directional fixpoints per candidate component, not a shape recursive CTEs are built for | no (a closure table answers reachability, not component membership, without extra machinery) | no (tree-only patterns) |
| `build_condensed` | yes | no, same reason as above | no | no |
| `count_pairs` | yes, via the condensation, without ever building the Theta(V^2) pair table | only by enumerating the full closure, i.e. exactly the Theta(V^2) table `scc.rs` was written to avoid | yes, trivially (`SELECT COUNT(*)`), but only because the table already paid the Theta(V^2) storage cost up front | no |
| `reaches_from` | yes | yes | yes (single lookup) | yes for tree ancestry, no for general graphs |
| `reached_by` | yes | yes | yes | yes for tree ancestry, no for general graphs |
| `multi_source_walk` (depth cap) | yes | yes, verified by probe | needs an extra maintained depth column | free (path length is depth), tree-only |
| `multi_source_halt_bfs` (halt predicate) | yes, the reason `walk.rs` exists | yes, verified by probe (WHERE clause gates expansion, contrary to what the petgraph lab found for `Bfs`/`Control`) | not natural without redesigning the trigger logic | not natural |

Two rows are the genuine gap, and they are the same two rows sprefa's own
engine already special-cases: **SCC/condensation** and **min-by-key
aggregation across a fixpoint** (the merge `multi_source_walk` performs for
free, that the min-depth probe in
[01-sqlite-recursive-cte.md](01-sqlite-recursive-cte.md) shows a plain
recursive CTE does not provide without DuckDB's `USING KEY` extension).
Nothing in this survey found a pattern, standard, or embedded engine that
covers SCC/condensation as cleanly as a hand-rolled iterative Tarjan does,
and nothing but DuckDB's `USING KEY` (a single vendor's dialect extension,
not a standard, and not yet checked against this workload's scale) closes
the min-by-key gap in SQL.

## sprefa is already doing the thing this survey would recommend

Reading `src/engine/derive.rs` during this survey found that sprefa's
engine already implements exactly the split this synthesis would otherwise
have to propose as a design change:

- The default path lowers recursive `.dl` rules to a semi-naive SQL
  fixpoint (`derive.rs`'s own comments name "semi-naive delta" directly,
  with a `force_naive_fixpoint` A/B lever and a `fixpoint_full_reruns`
  counter that treats the naive fallback's redundant work as a countable
  cost, not an assumed one).
- For the specific shape behind `multi_source_halt_bfs`,
  `try_native_halt_bfs` recognizes the rule pattern (`head(tag, node) <-
  head(tag, mid), !halt(mid, _), edge(mid, node).`) and **bypasses the
  SQLite semi-naive fixpoint entirely**, replacing the head relation with
  the result of `walk.rs`'s in-memory BFS computed once, in the engine's
  own words: "the same rows the fixpoint would reach, computed once in
  memory."
- That bypass is not applied unconditionally. `port_reach` itself is
  explicitly excluded from it (`if derived_rules[comp_rules[0]].head.rel ==
  "port_reach" { return Ok(false); }`) with the reasoning inline: `port_reach`
  has two independent seed rules and its edge relation can still be growing
  when the native component is visited, which the SQL scheduler's ordinary
  dependency tracking handles but a one-shot native bypass would not. This
  is a real, previously-discovered scheduling hazard, not a theoretical
  caveat this survey is raising for the first time; it shows the split is
  being applied carefully rather than blanket-adopted.
- The condensation approach in `scc.rs` is the equivalent move for the
  reachable-pair-counting and SCC operations: computed once in memory,
  explicitly to avoid the closure table's Theta(V^2) storage cost that this
  survey's own comparison in
  [04-relational-patterns.md](04-relational-patterns.md) independently
  arrives at as the closure table pattern's central weakness.

## What the survey suggests going forward

**Keep the SQL fixpoint as the default lowering path.** No pattern found in
this survey beats "one query, evaluated by an engine that already exists,
maintained by nobody" for the common case: `reaches_from`, `reached_by`,
depth-capped walks, and the base/seed rules that feed the native BFS
recognizer are all cleanly expressible as recursive CTEs (verified, not
assumed), and there is no standard or widely-adopted engine in this survey
that does noticeably better at that common case than what sprefa already
runs.

**Keep bypassing to native Rust for the two shapes SQL structurally cannot
express well: SCC/condensation, and any min-by-key fixpoint.** This is not
new advice; it is a description of `try_native_halt_bfs` and `scc.rs`'s
existing design, with this survey's independent literature check landing
on the same two gaps sprefa's own code comments already name. The one
concrete new lever this survey surfaces for that second gap is DuckDB's
`USING KEY`: if a rel tier ever moves its recursive fixpoint evaluation
from SQLite onto DuckDB (for the analytical/batch half of the workload, per
[03-sql-pgq-and-duckdb.md](03-sql-pgq-and-duckdb.md)), `USING KEY` recursive
CTEs are a real, documented, non-bespoke way to express min-by-key
aggregation in SQL that SQLite's own recursive CTE grammar does not offer,
which could shrink the set of shapes needing a native Rust bypass, at the
cost of a second SQL dialect and an unproven extension surface
(`duckpgq`, if it were ever wanted) with two crash-class bugs opened in the
same week this survey checked it.

**Do not adopt `ext/misc/closure.c`.** It is dead code in a normal SQLite
build, explicitly marked experimental and obsolete by its own authors, who
recommend recursive CTEs instead in the same file. This settles the
question the parent lazy-rel-tier plan implicitly raises about whether a
native SQLite closure-table virtual table is available "for free": it is
not, and building on it would mean patching and shipping a build of SQLite
carrying test-only code.

**Do not adopt CozoDB, Kuzu, or any single "replace the whole engine"
embedded graph database found in this survey.** Kuzu is archived. CozoDB,
despite being the closest match on paper (a Rust-embeddable datalog
database with recursive queries and graph algorithms), is stalled by every
measure this survey checked, including its own community asking the
question directly and getting silence. This is the exact trap the parent
task's Kuzu warning describes, reproduced independently on a second
candidate: on-paper fit is not evidence of a maintained project, and has to
be checked, every time, against actual commit and issue activity rather
than a README's framing.

## What I could not establish

- **Whether sprefa's engine performs anything equivalent to a magic-sets
  rewrite** (pushing a bound start/target constant into the recursive rule
  before evaluation, per Bancilhon/Maier/Sagiv/Ullman 1986). This would
  require reading the query planner's constant-propagation path in detail,
  which is an engine-internals question outside a literature-and-source
  survey's scope as assigned; flagged rather than guessed at.
- **The ISO/IEC 9075-16:2023 SQL/PGQ standard text itself.** It is
  paywalled; every claim about what it standardizes in this survey traces
  to a secondary source (Wikipedia's SQL:2023 article), not the standard
  document, and is marked as such in
  [03-sql-pgq-and-duckdb.md](03-sql-pgq-and-duckdb.md).
- **Which vendors beyond DuckDB implement SQL/PGQ.** Oracle is commonly
  reported elsewhere to support `GRAPH_TABLE`/property-graph views since
  Oracle Database 23c/23ai; this survey's own attempts to fetch Oracle's
  documentation directly returned 403/404 responses, so that claim is
  deliberately left out rather than stated on the strength of prior
  general knowledge alone.
- **Whether SQLite's internal implementation of the `UNION` recursive-CTE
  row-dedup check is a linear scan, a hash, or a tree** (i.e., its actual
  big-O per iteration). The spec states the behavior, not the mechanism;
  determining the mechanism would mean reading SQLite's VDBE bytecode
  generation for `WITH RECURSIVE`, which is squarely the other lab's
  territory (`labs/graph-sqlite`, recursive CTE timings), not duplicated
  here.
- **duckpgq's actual reachability performance or correctness at any
  scale.** This survey read its documentation and checked its issue
  tracker; it did not build or run it, per this survey's own scope (source
  and specification reading, not benchmarking).
- **A dedicated, credible libSQL/Turso graph *extension* distinct from
  libSQL itself.** Searches during this survey did not surface one beyond
  libSQL's own general-purpose extension points (WASM UDFs, custom virtual
  tables), which is a negative result, not a confirmed absence; a
  differently-worded search might find one this survey did not.
