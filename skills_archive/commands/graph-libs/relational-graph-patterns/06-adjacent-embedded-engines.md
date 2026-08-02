---
description: embeddable graph/datalog engines beyond SQLite and DuckDB -- repository health checked via the GitHub API, with two abandonment findings
argument-hint: [section]
---

# Adjacent embedded engines

All repository facts below came from `gh api repos/<owner>/<repo>` directly,
not from README claims or WebSearch (budget exhausted for this survey).
Dates are `pushed_at` from the API, not a README's claimed status.

## The warning case this section is built around: Kuzu

Per the parent task, already established and restated here for the
record: **Kuzu (`kuzudb/kuzu`)**, an embedded property-graph database
implementing Cypher, is **archived**, confirmed via
`gh api repos/kuzudb/kuzu`: `"archived": true`, `"pushed_at":
"2025-10-10T15:34:00Z"`. 4,014 stars, described as "Embedded property
graph database built for speed. Vector search and full-text search built
in. Implements Cypher." Everything about its description matches this
workload's shape; its archival disqualifies it regardless.

## libSQL / Turso

**`tursodatabase/libsql`**, checked via the GitHub API: not archived, last
push 2026-07-12, 16,975 stars, 437 open issues, actively developed: a
SQLite fork/superset (embedded replicas, remote sync, additional virtual
table and WAL hooks), rather than a distinct graph engine. Its own README (fetched
directly) lists extension points beyond vanilla SQLite: an "ALTER TABLE
extension for modifying column types and constraints," WebAssembly
user-defined functions, and "a virtual write-ahead log interface." It does
not surface any graph-specific extension, closure-table helper, or
recursive-CTE difference from upstream SQLite; recursive CTE behavior is
inherited from the SQLite core it forked, which means everything in
[01-sqlite-recursive-cte.md](01-sqlite-recursive-cte.md) applies to libSQL
unchanged. A dedicated search for a libSQL/Turso graph extension repository
did not surface a credible, health-checked candidate distinct from what is
already covered elsewhere in this survey.

## CozoDB: the candidate this survey's own version of the Kuzu warning

**`cozodb/cozo`**, described by itself as "A transactional,
relational-graph-vector database that uses Datalog for query." This is, on
paper, closer to sprefa's own model than anything else checked in this
survey: an embeddable (Rust-native, with RocksDB or sled or in-memory
backends), datalog-queried database with recursive Datalog, whole-graph
algorithms exposed to the query layer, and multiple language bindings.

Checked via the GitHub API: not archived, but last push **2024-12-04**,
over eighteen months before this survey (2026-07-19). 4,058 stars, 48 open
issues. The most direct evidence of its state is its own issue tracker:
issue #301, titled **"Is cozo still being maintained?"**, has ten
consecutive comments, each containing only a candle emoji (🕯️), from ten
different accounts, spanning 2025-12-04 through 2026-06-23, with no
maintainer reply recorded in the thread. The most recent substantive
comment, from 2026-06-23, does not answer the question either; it points
elsewhere: "Apology for the repeat: Many surely saw this already. But in
case you haven't: https://www.mnesticdb.com/" (a possible successor
project, not independently checked by this survey). This is the same shape
of finding the parent task flagged for Kuzu: a candidate that reads as
ideal from its description and turns out to be effectively unmaintained
once its actual repository activity is checked rather than assumed.

## indradb

**`indradb/indradb`**, "A graph database written in rust." Not archived.
Last push 2025-08-16 (a `v5.0.0` tag), roughly eleven months before this
survey. 2,454 stars, 17 open issues, several with low engagement and no
recent maintainer response (checked via
`gh api "repos/indradb/indradb/issues?state=all&sort=updated"`). Not
declared dead the way CozoDB's own issue tracker declares CozoDB's
uncertainty, but the same caution applies: check activity before assuming
maintenance, not on the strength of stars or a matching description alone.

## oxigraph

**`oxigraph/oxigraph`**, "SPARQL graph database." Actively maintained: not
archived, last push 2026-07-19 (the day of this survey), 1,762 stars, 130
open issues (open-issue volume on an active project, not a sign of decay
here given the commit cadence). Oxigraph is an embeddable Rust RDF triple
store queried via SPARQL, with RocksDB or in-memory backends, keeping the
graph out of process RAM by design in the disk-backed configuration. SPARQL
property paths (the `+`/`*` path operators) express bounded and unbounded
transitive reachability natively, which is a genuine candidate mechanism
for `reaches_from`/`reached_by`. It models an RDF triple graph
(subject-predicate-object), not sprefa's typed dataflow-node/edge model
directly, so adopting it would mean remodeling the data as triples rather
than reusing sprefa's existing node/edge tables. Not benchmarked or probed
further in this survey; named here as a credible, currently-healthy
candidate worth a dedicated evaluation lab if the survey's synthesis
motivates one.

## SurrealDB, noted but not recommended for a deep dive here

**`surrealdb/surrealdb`**, not archived, last push 2026-07-06, 32,731
stars, 704 open issues. Supports an embedded (in-process) mode with an
in-memory or RocksDB-backed store, and has native graph relations
(`RELATE`) with graph-traversal query syntax, as a full multi-model
database (documents, graph, time series, and more) with a correspondingly
large surface area and dependency footprint for a workload that needs
exactly seven graph operations; flagged as existing and healthy, not
evaluated further, since its scope is well beyond what this workload needs
and a fair verdict would require its own dedicated lab.

## Cayley

**`cayleygraph/cayley`**, "An open-source graph database." Not archived,
last push 2026-05-05, 15,050 stars. Written in Go, not Rust, which means
embedding it in sprefa's process would mean cross-language FFI or running
it as a separate server process, either of which works against the
"non-resident, single-process, 16GB laptop" framing of this workload. Noted
for completeness, not a serious candidate for the reasons stated.

## Summary table

| engine | language | embeddable in-process | health (as checked) | verdict |
|---|---|---|---|---|
| Kuzu | C++ | yes | **archived**, last push 2025-10-10 | disqualified |
| libSQL | Rust/C | yes (SQLite superset) | active, last push 2026-07-12 | inherits plain SQLite's recursive-CTE story; no distinct graph feature found |
| CozoDB | Rust | yes | not archived but **stalled**, last push 2024-12-04, open "is this maintained" issue unanswered | disqualified in practice, matches the Kuzu warning pattern exactly |
| indradb | Rust | yes | not archived, last push 2025-08-16, low recent engagement | caution, not actively evaluated further |
| oxigraph | Rust | yes | active, last push 2026-07-19 | credible candidate, different data model (RDF triples), not yet probed |
| SurrealDB | Rust | yes | active, last push 2026-07-06 | healthy but out of scope by size, not evaluated further |
| Cayley | Go | no (cross-language) | active, last push 2026-05-05 | disqualified by language/process boundary |
