---
description: adjacency list, recursive CTE, closure table, materialized path, nested sets -- read/write/storage tradeoffs and what each can express
argument-hint: [section]
---

# The classic relational patterns

Five patterns, compared on read cost, write cost, storage cost, general
graph vs tree/DAG-only, and whether a depth cap or halt predicate is
expressible. The nested-set and materialized-path claims are drawn from
established relational-modeling literature (Wikipedia's Nested set model
article, and PostgreSQL's `ltree` documentation fetched directly, tagged
SPEC where the quote is from the Postgres docs). The recursive-CTE and
closure-table rows restate findings from
[01-sqlite-recursive-cte.md](01-sqlite-recursive-cte.md) and
[02-closure-c.md](02-closure-c.md) rather than re-deriving them.

## Adjacency list plus application traversal

Store `(src, dst)` rows, one per edge; walk them in application code (this
is what `walk.rs` and `scc.rs` already do, in memory, over a `Vec<Vec<u32>>`
or an equivalent). Read cost for a single hop is one indexed lookup; a
multi-hop traversal is however many hops the query needs, each a
round trip if done in SQL, or a pointer follow if done in memory. Write
cost is one row per edge, no maintenance. Storage cost is exactly the edge
count, no derived data. Handles general graphs, cycles included. Depth cap
and halt predicate are both trivial to express, because the traversal loop
is code the caller controls directly, exactly why `walk.rs` exists instead
of a `.dl` rule for the halt-gated case.

The cost this pattern defers is repeated computation: every query that
needs reachability re-walks the graph from scratch, in the caller's memory
space, unless the caller adds its own cache.

## Recursive CTE

Covered in full in [01-sqlite-recursive-cte.md](01-sqlite-recursive-cte.md).
Summary for this comparison: read cost is one query, evaluated by the
engine's own queue-and-dedup machinery rather than caller code; write cost
is zero (nothing is stored, it recomputes from the base tables every time);
storage cost is zero beyond the base edge table. Handles general graphs,
`UNION` terminating on cycles by row-dedup. Depth cap and halt predicate
are both expressible (verified by probe against sprefa's own test vectors),
with the one gap being a min-per-key merge, which plain `UNION`/`UNION ALL`
recursive CTEs do not provide (SQLite) and DuckDB's `USING KEY` does
provide ([03-sql-pgq-and-duckdb.md](03-sql-pgq-and-duckdb.md)).

## Closure table (materialized transitive closure, trigger-maintained)

Store every reachable pair `(ancestor, descendant)` as a row, maintained by
triggers on insert/delete/update of the base edge table. Read cost for
"is X reachable from Y" or "everything Y reaches" is a single indexed
lookup, no traversal at query time at all, the fastest read of any pattern
here. That is also exactly its cost problem: write cost is proportional to
however many existing pairs a single new edge extends the closure by, which
is unbounded in the general case (one new edge between two large,
previously-disconnected components can multiply the pair count), and
storage cost is up to `O(V^2)` in the worst case, the exact blowup
`scc.rs`'s own comment calls out by name: "The condensation answers
reaches(x,*) and counts the full closure without ever building the
Theta(V^2) pair table." Handles general graphs (a cyclic component's pairs
just include self-pairs). Depth cap needs an extra `depth` column
maintained alongside each pair (as `closure.c`'s `iGeneration` field does);
halt predicate is not naturally expressible, because the table stores
finished reachability facts, not the traversal steps that would let a halt
flag block propagation mid-computation, without redesigning the trigger
logic to stop expanding through halted rows specifically.

sprefa's own `rel_port_reach` (292,923 rows, per the parent task's
description) is precisely this pattern: a materialized closure kept current
by the engine's semi-naive fixpoint standing in for hand-written triggers.
Its incremental-maintenance cost is the same `O(V^2)`-shaped risk in
principle; what keeps it bounded in practice is that it is a *contraction*
closure gated by the `port_in`/halt structure of the graph (each port's
reach stops at the next port, rather than reaching every downstream node
transitively), not a full unconstrained transitive closure. The general
lesson from this pattern still applies directly: any closure table, hand
triggered or engine-maintained, pays this write cost whenever an edge
change would extend reachability across a large boundary, and the halt
structure is precisely what sprefa already uses to keep that boundary
small.

## Materialized path

Store, per node, the string (or array) of ancestor ids from the root down
to that node (Postgres's `ltree` extension is a concrete, checked
implementation of exactly this: label paths like `Top.Countries.Europe`,
fetched from `postgresql.org/docs/current/ltree.html`). SPEC, on what it
supports: ancestor/descendant tests as operators, `ltree @> ltree` ("is
left an ancestor of right, or equal") and `ltree <@ ltree` (the mirror),
backed by a GiST index (`gist_ltree_ops`) that also supports pattern
matching via `lquery`, DuckDB. SPEC path limits: up to 65,535 labels per
path, up to 1,000 characters per label, both documented ceilings rather
than measured limits.

Read cost for ancestor/descendant queries is an indexed prefix or interval
match, cheap. Write cost for a single node's insert or move is one row
update; the expensive case is moving a subtree, which requires rewriting
the path prefix of every descendant (a string or array rewrite, not a
single-row update, though still local to the moved subtree rather than
global). Storage cost grows with path depth times node count, worse than
an edge list. This pattern is fundamentally tree-shaped: a node's path
encodes exactly one route from the root, so it does not represent a node
with two parents, and it does not represent cycles at all. Depth cap is
free (path length is the depth). Halt predicate is not natural: the path
encodes ancestry, not a live traversal that could be interrupted mid-walk.

## Nested sets and nested intervals

Assign each node a `(left, right)` numeric interval by a tree traversal
that visits every node twice; a node's descendants are exactly the nodes
whose interval falls inside its own (drawn from Wikipedia's Nested set
model article, not independently re-derived here). Quoting that source
directly: containment tests need "no complex joins... Finding all
descendants or determining if one element contains another is
computationally inexpensive," which is the pattern's whole appeal, at the
cost that "Adding a new node requires renumbering all affected left and
right values throughout the table," and multiple-parent membership ("an
item cannot simultaneously belong to different parent branches") is
structurally unsupported. Same summary in different words: this pattern is
tree-only, like materialized path, but trades materialized-path's cheap
local move for an even cheaper containment read and an even more expensive
global-feeling write (in the worst case, a large fraction of the table's
interval columns get touched by one insert). Depth is not stored directly
but is derivable from ancestor-count along the containment chain, so a
depth cap needs an extra query dimension. Halt predicate is not natural,
for the same reason as materialized path: the structure encodes a finished
hierarchy, not a live walk.

## The comparison table

| pattern | read cost | write cost | storage cost | graphs it handles | depth cap | halt predicate |
|---|---|---|---|---|---|---|
| adjacency list + app traversal | one query per hop, or a full in-memory walk | O(1) per edge | O(edges) | general, cycles included | trivial (caller's loop) | trivial (caller's loop) |
| recursive CTE | one query, engine-driven queue | none (recomputed) | O(edges) | general, cycles terminate via UNION dedup | yes (verified) | yes (verified) |
| closure table | O(1) indexed lookup | up to O(pairs newly reachable) per edge change | up to O(V^2) pairs | general | needs an extra depth column | not natural without redesign |
| materialized path | indexed prefix/interval match | O(1) per node; O(subtree) per move | O(depth x nodes) | trees only | free (path length) | not natural |
| nested sets/intervals | cheapest containment test | O(table) worst case per insert | O(nodes), two ints each | trees only | needs a derived query | not natural |

sprefa's own choice for the seven operations, per `scc.rs`'s own header
comment, is neither a closure table nor a recursive CTE for the two hardest
cases (SCC/condensation and halt-gated BFS): it is hand-rolled in-memory
adjacency-list traversal, the first row of this table, specifically
because that is the only pattern here with no documented or measured
ceiling on any of the seven operations.
