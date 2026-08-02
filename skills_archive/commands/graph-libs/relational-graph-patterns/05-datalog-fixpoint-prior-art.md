---
description: semi-naive evaluation, magic sets, and where datalog-as-SQL is known to stop scaling -- citations verified against DBLP
argument-hint: [section]
---

# Datalog and fixpoints in SQL: verified prior art

sprefa already lowers recursive `.dl` rules to a SQL fixpoint
(`src/engine/derive.rs`). This section covers what has been published about
that general approach. Every citation below was checked against DBLP
directly during this survey (not recalled from training and left
unverified); none were found to need correcting, but if a citation is not
listed here it was not confirmed and is deliberately left out rather than
guessed at.

## Semi-naive evaluation

**Bancilhon, F. and Ramakrishnan, R., "An Amateur's Introduction to
Recursive Query Processing Strategies," SIGMOD 1986, pp. 16-52.** (Verified
via DBLP.) This is the paper that names and formalizes semi-naive
evaluation: instead of re-running the full recursive query to a fixpoint
every iteration (naive evaluation, which recomputes every previously-found
row again on every pass), semi-naive evaluation tracks only the rows newly
derived in the previous iteration (the "delta") and joins only that delta
against the base relations, so each iteration's work is proportional to
what is new, not to everything found so far.

sprefa's own code names this directly: `src/engine/derive.rs` documents "the
naive loop" and "semi-naive delta" as two paths behind an A/B lever
(`force_naive_fixpoint`), with the naive path counted explicitly as
overhead ("the waste semi-naive removes") via a `fixpoint_full_reruns`
counter. This is the textbook distinction from the 1986 paper, implemented
as a measurable, toggleable choice rather than assumed.

## Magic sets

**Bancilhon, F., Maier, D., Sagiv, Y., and Ullman, J.D., "Magic Sets and
Other Strange Ways to Implement Logic Programs," PODS 1986, pp. 1-15.**
(Verified via DBLP.) Magic sets rewrite a recursive datalog program so that
constants bound in a query (for example, "reachable from node 7"
specifically, rather than "all reachable pairs") get pushed into the
recursive rule itself, so the fixpoint only ever computes rows relevant to
that bound query instead of the unconstrained full relation. This is the
same shape as the difference between `count_pairs` (needs the whole
condensation, no starting constant to push in) and `reaches_from`/
`reached_by` (bound at a single start or target node, the exact case magic
sets targets) in `scc.rs`.

Whether sprefa's engine performs anything equivalent to a magic-sets rewrite
was not established by this survey (this would require reading the query
planner's constant-propagation logic specifically, out of scope for a
literature survey); flagged in the "what could not be established" section
of the [synthesis](07-synthesis.md).

## The general survey

**Green, T.J., Huang, S.S., Loo, B.T., and Zhou, W., "Datalog and Recursive
Query Processing," Foundations and Trends in Databases, Vol. 5, No. 2,
2013, pp. 105-195. DOI: 10.1561/1900000017.** (Verified via DBLP.) This is
the standard modern survey covering semi-naive evaluation, magic sets, and
the broader landscape of datalog evaluation strategies including
stratification for negation (sprefa's own `!halt(mid, _)` rule shape is a
stratified-negation use, per `src/engine/strata.rs`'s stratum-splitting
logic) and incremental/differential re-evaluation on top of a base fixpoint.
Recommended as the entry point for anyone extending sprefa's fixpoint
engine who wants the full formal treatment rather than the two founding
papers above.

## Where SQL-as-datalog-target is known to stop scaling

The two costs this survey can state with direct evidence, distinct from
what the timing lab (`labs/graph-sqlite`) will measure directly:

1. **Deduplication cost is baked into the termination mechanism, not
   optional.** [01-sqlite-recursive-cte.md](01-sqlite-recursive-cte.md)
   quotes the SQLite spec directly: `UNION`'s row-by-row "no identical row
   has been previously added" check is what makes a recursive query over a
   cyclic graph terminate at all. There is no way to ask for semi-naive-only
   incremental evaluation without also paying a dedup check against
   accumulated history, in plain recursive-CTE SQL; the corresponding
   costed lever inside sprefa's own engine (`force_naive_fixpoint`,
   `fixpoint_full_reruns`) exists because sprefa controls the query shape
   directly rather than depending on `WITH RECURSIVE` for this, and can
   fall back to hand-rolled Rust when the shape does not fit.
2. **A pure SQL fixpoint has no merge-by-key primitive**, per
   [01-sqlite-recursive-cte.md](01-sqlite-recursive-cte.md)'s min-depth
   probe and [03-sql-pgq-and-duckdb.md](03-sql-pgq-and-duckdb.md)'s
   `USING KEY` finding. Any datalog rule whose intended semantics is "keep
   the best value per key across iterations" (min-depth BFS, single-source
   shortest path, PageRank-style monotone aggregation) either needs a
   dialect extension like DuckDB's `USING KEY`, or accumulates every
   candidate value and collapses afterward, or moves outside SQL entirely.
   sprefa's own engine already made the third choice for exactly the two
   hardest cases (`try_native_halt_bfs` and the SCC/condensation path in
   `scc.rs`), a design decision this survey did not have to
   guess at because the code states its own reasoning inline
   (`src/engine/derive.rs`, the comment above `try_native_halt_bfs`:
   "bypassing the SQLite semi-naive fixpoint").

## A named alternative to SQL as the fixpoint target: Soufflé

**Soufflé (`souffle-lang/souffle`)**, checked via the GitHub API: not
archived, last push 2026-07-13, 1,124 stars. Its own description: "Soufflé
is a variant of Datalog for tool designers crafting analyses in Horn
clauses. Soufflé synthesizes a native parallel C++ program from a logic
specification." This is architecturally the opposite choice from sprefa's:
instead of lowering datalog to a SQL fixpoint evaluated by an existing
engine (SQLite), Soufflé compiles the datalog program itself into
standalone native code with its own specialized data structures per
relation (including a B-tree or a hash variant chosen per relation's access
pattern), avoiding the SQL engine's general-purpose row format entirely.
Soufflé is widely used for exactly sprefa's problem domain, static-analysis
datalog over large codebases, which makes it a legitimate design-space
neighbor worth naming even though adopting it is a different question
(compiling to native code vs. reactively re-lowering to changed SQL on
every edit) from anything this survey was asked to recommend.

**Differential Datalog (DDlog)**, originally `vmware/differential-datalog`,
checked via the GitHub API: **archived**, moved to the
`vmware-archive` organization, last push 2023-07-07. DDlog specifically
targeted incremental re-evaluation of datalog programs (built on
Differential Dataflow) and is the closest published system, by name, to
"incrementally re-run a datalog fixpoint as inputs change," which is
sprefa's own reactive-tick model. Its archival is worth stating plainly
next to Soufflé's continued activity: the incremental-recomputation
approach to datalog had at least one serious industrial implementation, and
that implementation is no longer maintained.
