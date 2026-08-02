---
description: SQL/PGQ (ISO/IEC 9075-16:2023), DuckDB's duckpgq extension, and DuckDB's USING KEY recursive CTE clause
argument-hint: [section]
---

# SQL/PGQ and DuckDB

## What SQL/PGQ is

SQL/PGQ is ISO/IEC 9075-16:2023, "Part 16: Property Graph Queries (SQL/PGQ),"
part of the SQL:2023 standard adopted June 2023. It standardizes a way to
declare a property graph view over existing relational tables and query it
with `GRAPH_TABLE` and a `MATCH` clause using path-pattern syntax, rather
than hand-writing the joins a graph query implies. This is drawn from a
Wikipedia summary, not the ISO text itself (the ISO standard is paywalled
and was not fetched); flagged here as secondary-source evidence, distinct
from the SPEC-tagged quotes elsewhere in this survey that came directly
from a vendor's own documentation.

## DuckDB's `duckpgq` extension: real, active, not production-labeled

Checked via the GitHub API (`gh api repos/cwida/duckpgq-extension`), not
WebSearch:

- Not archived. Last push 2026-07-14 (five days before this survey).
- 438 stargazers, 32 forks, 18 subscribers, MIT license.
- Recent commit history is active feature and bugfix work: a `match-rewrite`
  PR merged the same day as the last push, "Clean up header files and CI."

The project states its own maturity level directly, in its README: "This
repository is currently a research project and a work in progress." That
sentence, not stargazer count, is the operative fact for a production
decision.

Recent open issues corroborate the "research project" self-description
rather than contradicting it. Pulled via
`gh api repos/cwida/duckpgq-extension/issues`:

- #315, opened 2026-07-17: "Crash when a CTE containing GRAPH_TABLE is
  referenced more than once."
- #314, opened 2026-07-13: "Undirected edge matching returns duplicate rows
  for self-loop edges (should be deduplicated per SQL/PGQ standard)."
- #304, opened 2026-04-06: "SIGSEGV when combining path-quantified
  GRAPH_TABLE with UNION ALL."

Crash-class bugs (not just incorrect results) reported within the last
week, on core syntax combinations.

### Does it provide bounded reachability with predicates

Per `duckpgq.org`'s own docs (fetched directly, not inferred): `GRAPH_TABLE`
supports `MATCH` patterns with node/edge type constraints
(`(p1:Person)-[k:knows]->(p2:Person)`), undirected edges, variable-length
paths via `*`, and `ANY SHORTEST` for shortest-path queries. `WHERE`
clauses filter on edge and vertex properties in the shown examples
(`isBlocked = true`, timestamp ranges). The fetched docs page did not
surface `{min,max}`-style bounded quantifiers or any shipped whole-graph
algorithm library (PageRank, WCC, SCC) as of this fetch; their absence from
what was retrieved is not proof of absence from the project, only that this
survey did not find them documented at the fetched page.

### Verdict: plausible for the analytical half, not as a graph-query surface today

DuckDB itself (distinct from `duckpgq`) is a mature, actively maintained
columnar engine (`duckdb/duckdb`, not archived, pushed 2026-07-17, 39,545
stars) with its own `WITH RECURSIVE` support, useful for the analytical
half of this workload independent of `duckpgq` entirely: batch joins,
aggregation, and columnar scans over a materialized edge table are exactly
DuckDB's designed strength, and nothing about that use requires the SQL/PGQ
extension at all. Using plain DuckDB as a second engine for the
batch-analytical side of a rel tier (not the recursive-traversal side) is a
reasonable candidate independent of this section's findings.

Using `duckpgq` specifically as the query surface for the seven operations
is not recommended by this survey given the two crash-class issues opened
in the same week as the last measured push and the project's own
self-description as a research project. That could change; it is worth
re-checking, not adopting today.

## `USING KEY`: DuckDB's built-in answer to the min-depth gap

This is the one finding in this survey that most directly changes the
picture in [01-sqlite-recursive-cte.md](01-sqlite-recursive-cte.md).
Verified against DuckDB's own docs
(`duckdb.org/docs/current/sql/query_syntax/with.html`, fetched directly):

DuckDB 1.5.0 added `USING KEY` to recursive CTEs. Quoting the docs: "a CTE
with `USING KEY` has the ability to update rows that have been placed in
the union table in an earlier iteration"; "if the current iteration
produces a row with key `k`, it replaces a row with the same key `k` in the
union table (like a dictionary)." The docs' own worked example is
connected components, keeping the lowest reachable id per node:

```sql
WITH RECURSIVE connected_components(id, comp) USING KEY (id) AS (
    SELECT n.id, n.id AS comp
    FROM nodes AS n
        UNION ALL (
    SELECT DISTINCT ON (previous_iter.id) previous_iter.id, initial_iter.comp
    FROM
        recurring.connected_components AS previous_iter,
        connected_components AS initial_iter,
        edges AS e
    WHERE ((e.node1id, e.node2id) = (previous_iter.id, initial_iter.id)
       OR (e.node2id, e.node1id) = (previous_iter.id, initial_iter.id))
      AND initial_iter.comp < previous_iter.comp
    ORDER BY initial_iter.id ASC, previous_iter.comp ASC)
)
TABLE connected_components
ORDER BY id;
```

This is DuckDB's version of the `merge(MinBy(...))` lattice `walk.rs`
computes via a visited-generation stamp: a row with a smaller `comp` value
overwrites the stored row for that key instead of accumulating alongside
it. Constraints, per the same docs page: `USING KEY` requires the recursive
`UNION ALL` form (the plain `UNION` recursive form is deprecated for it as
of 1.5.0 and slated for removal by 2.1.0), the key columns are named
explicitly in the clause, and `recurring.<cte_name>` is needed to read all
accumulated rows (the bare CTE name inside the recursive term refers only
to the previous iteration's output, not the whole history).

This is real, working DuckDB syntax with a documented example matching the
exact shape sprefa's `multi_source_walk` needs (min-by-key over a recursive
join). It does not, on its own, resolve the `duckpgq` maturity concern
above; `USING KEY` is a plain-SQL recursive-CTE feature, independent of the
SQL/PGQ extension.
