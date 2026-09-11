# Measured SWI-Prolog performance patterns

Read the section matching the measured call shape. These patterns came from DL6 and
DL7 compiler work and are reusable in relation-heavy SWI programs.

## Contents

1. [Attribute the narrow phase](#attribute-the-narrow-phase)
2. [Index dynamic relation rows](#index-dynamic-relation-rows)
3. [Replace full-scan relaxation with a worklist](#replace-full-scan-relaxation-with-a-worklist)
4. [Memoize pure repeated phases](#memoize-pure-repeated-phases)
5. [Audit tabling by call variant](#audit-tabling-by-call-variant)
6. [Detect materialized helper closure](#detect-materialized-helper-closure)
7. [Trace without perturbing normal execution](#trace-without-perturbing-normal-execution)
8. [Performance gates](#performance-gates)
9. [Index whole-bag scans at their invariant boundary](#index-whole-bag-scans-at-their-invariant-boundary)
10. [Count proof paths as well as distinct answers](#count-proof-paths-as-well-as-distinct-answers)
11. [Preserve callback module context](#preserve-callback-module-context)
12. [Make finalizer reset unconditional](#make-finalizer-reset-unconditional)
13. [Drain subprocess channels without circular waits](#drain-subprocess-channels-without-circular-waits)
14. [Sprefa receipts](#sprefa-receipts)

## Attribute the narrow phase

Intended mode:

```prolog
measure_call(+Label, :Goal, -WallMs, -Inferences).
```

Capture inference counters immediately around `Goal`. Run `profile/1` on that same
goal. A compiler-wide profile mixes parser, checker, evaluator, and cleanup costs.

For exclusive inference attribution, temporarily wrap named predicates and subtract
the inference deltas of wrapped child calls. Treat wrapper totals as perturbed
measurements and use ratios. Keep an unwrapped run as the authoritative total.

Always accompany cardinality with terms:

```prolog
aggregate_all(count, Row, Count),
findnsols(3, Row, Goal, Samples).
```

A low final row count can coexist with millions of failed lookups and rescans.

## Index dynamic relation rows

A generic dynamic predicate such as `evaluation_lower(Id, Call, Row)` may receive a
partially bound `Call`. If the indexed prefix remains hidden inside the term, JITI may
scan every installed row.

Expose bounded ground prefixes while retaining exact unification:

```prolog
evaluation_lower(Id, call(Rel, Args), Row) :-
    argument_hashes(Args, H1, H2, H3, H4),
    evaluation_lower_index(Id, Rel, H1, H2, H3, H4, Stored),
    Stored = Row.
```

Mode rules:

- Hash only ground arguments.
- Leave an unbound hash slot unbound.
- Use the hash for candidate selection only.
- Unify the stored row exactly after lookup to reject collisions.
- Store clause references and erase them at the evaluation lifecycle boundary.
- Test free relation, free row, partial arguments, arity zero, arity above the hash
  width, forced collision, and simultaneous evaluation IDs.

## Replace full-scan relaxation with a worklist

For constraints:

```text
level(Head) >= level(Body) + Gap
```

A repeated scan over `Dependencies × Levels × Passes` is avoidable. Build the reverse
dependency index once:

```prolog
dependency_index(+Dependencies, -ByBody). % Body -> [Head-Gap]
relax_worklist(+Changed, +ByBody, +Levels0, -Levels).
```

Algorithm:

1. Seed the queue with every body relation so initial gaps are enforced.
2. Pop one changed body.
3. Read only its dependent heads.
4. Raise a head level when `BodyLevel + Gap` exceeds the current level.
5. Enqueue that head only when its level changed.
6. Reconstruct the public level list in original relation order.

Use an `assoc` or `rbtree` for level lookup. Preserve semantic tests for positive
chains, negative edges, recursive SCCs, strict cycles, aggregates, and generated
rules. A worklist changes scheduling, so compare the full ordered strata term against
the former algorithm on real rule sets.

Measured DL7 result: cold inferences fell from 6,388,940 to 3,370,850 while 810
published rows and diagnostics stayed exact.

Inspect the queue implementation too. In `append(Rest, Enqueued, Next)`, an empty
`Enqueued` still copies the bound `Rest` list. N pops with no changes can copy
N(N-1)/2 cells. Reuse `Rest` when `Enqueued == []` as a bounded first correction;
measure before considering a difference-list queue. Preserve FIFO order.

For set-expansion fixpoints, a reverse dependency worklist alone does not address
repeated joins over the selected set. If each pass enumerates selected rules and
rescans all dependencies for each head, cost includes
`sum_pass(selected_rules * dependencies)`. K definitions of the same head repeat
that join K times. Index head-to-dependencies and relation-to-definitions once per
immutable input; expand newly discovered relation heads once, retaining the exact
final rule set and polarity/aggregate restrictions. A chain discovered one step
per pass can make the original join cubic in chain length.

## Memoize pure repeated phases

Apply memoization after measuring repeated calls with identical immutable inputs.
Treat the input term like a dependency array:

```text
memo_key = exact Rules term
memo_value = ordered Strata + Diagnostics
scope = one outer compile
```

If hashing is useful, store a bucket by hash and confirm the complete rules term with
`==`, `=@=`, or the equality appropriate to the groundness contract. A hash collision
must miss.

Lifecycle requirements:

```text
enter compile scope
  miss exact Rules -> compute and store
  hit exact Rules  -> reuse immutable result
  changed/generated Rules -> miss
leave on success/failure/exception -> erase scope entries
```

Nested scopes and concurrent threads need distinct scope identities. Calls outside a
scope execute normally and leave no persistent entry. Do not memoize dynamic clause
references, table handles, closure rows, or other lifecycle-bound values.

## Audit tabling by call variant

Variant tabling keys on the call shape. These calls create different tables:

```prolog
proves(Eval, call(Rel, [a, b])).
proves(Eval, call(Rel, [a, X])).
proves(Eval, call(Rel, [X, Y])).
```

Count distinct variant patterns per relation and stratum. Record argument modes such
as `[ground, ground]` or `[ground, free]`. A fully ground workload can create hundreds
of one-answer tables. A free call can enumerate the whole answer trie.

Inspect tables before cleanup. Per-stratum `setup_call_cleanup` may destroy tables
that the next stratum reconstructs. Reuse requires proof that round isolation,
negation freshness, and aggregate semantics remain intact.

## Detect materialized helper closure

Group published rows by relation. Check whether an internal helper dominates output
and whether consumers use it with all arguments bound.

A recursive ordering relation over dense indices produces a triangle:

```text
before(Owner, Earlier, Later) where Earlier < Later
rows per owner = n * (n - 1) / 2
```

If every consumer binds `Owner`, `Earlier`, and `Later`, a grounded integer comparison
can answer the question without materializing the closure. This changes the kernel
surface or publication contract, so require explicit semantic approval and pin all
consumers before replacing it.

Also inspect unbound closure collection such as:

```prolog
findall(Call, proves(EvaluationId, Call), Closure).
```

It publishes every table answer regardless of downstream demand.

## Trace without perturbing normal execution

Trace collection should require both an environment setting and an active compile
trace scope. A standalone evaluator call with tracing configured should emit no
compiler steps.

Wrap install, collect, and cleanup separately. Compute metrics after the timed body.
Collect table statistics while tables remain live. Cleanup metrics should use a
bound evaluation ID and `aggregate_all(count, Goal, Count)` rather than copying rows
with `findall/3`.

Metric callbacks can throw, fail, or return malformed terms. The traced operation and
cleanup must still complete. Record the step without metrics when collection fails.

## Performance gates

Pin both:

```text
wall_ms <= wall_budget       load-sensitive
inferences <= work_budget    deterministic work regression
```

Also pin output rows, diagnostics, and warm output parity. Print the fixture and
baseline name before compilation so an external timeout produces a named failure.
After a gate failure, one bounded diagnostic trace may run, while preserving the
original nonzero exit code.

Do not auto-update baselines. A row-count change requires an explained semantic or
metadata delta. A wall-only failure and an inference failure should have separate
labels.

## Index whole-bag scans at their invariant boundary

Recognize these modes before adding caches:

```prolog
check_edges(+Edges, +AllEdges, +Origins, -Diagnostics).
materialize_node(+Node, +Rows, -Result).
accepted_fact(+Rows, +FactId, +Relation).
```

Counting an owner's edges by traversing `AllEdges` inside every edge check visits
E² list cells, including when owners are all distinct. Construct owner-to-count
once outside that loop. Preserve diagnostics' original iteration and origin order.

Per-node lookups of presence, payload, source, and children can each rescan the
entire Rows bag. V nodes and R rows then imply O(VR), even if each node produces
one result. Index by node and row role once. Keep duplicate occurrences where
cardinality diagnostics distinguish one row from two; payload-set semantics may
differ from source-row or node-occurrence semantics.

Per-fact acceptance often repeats witness-to-run joins and scope/relation-wide
completeness checks. Separate fact-specific joins from invariant metadata: index
witnesses by fact, runs by identity, and completeness by exact scope/relation.
Measure with input construction outside the counter. A whole-compile fixture
that never exercises imports or syntax rewriting provides no attribution for
these paths; use a bounded synthetic scaling probe or relevant real fixture.

## Count proof paths as well as distinct answers

A comment declaring `det` or `semidet` does not enforce determinism. Inspect
overlapping structured and fallback clauses:

```prolog
debug_input(structured(X)) :- maybe_record(X).
debug_input(_).
```

On backtracking, both clauses can succeed and repeat all downstream work. A
structured-case commit is appropriate only when the fallback is genuinely an
alternative shape, not another intended answer. Probe the intended mode with
`findall/3` on a small input or a determinism check, including disabled tracing.
Retained choicepoints can also postpone `setup_call_cleanup/3` cleanup until
the protected goal's alternatives are exhausted or discarded.

Constructive special cases can overlap with their general clause:

```prolog
construct(Head, [], [Head]).
construct(Head, Tail, [Head|Tail]) :- is_list(Tail).
```

The mode `construct(+ground Head,+ground Tail,-List)` has two proofs when Tail
is empty. `sort/2` or tabled callers can hide this in final output. Compare raw
solution count separately from distinct tuple count. Remove a redundant case
only after checking all supported construction/deconstruction modes; distinguish
preserved answer sets from changed proof multiplicity.

## Preserve callback module context

Exported predicates that call caller-supplied goals need a matching meta-predicate
declaration, including forwarding convenience arities:

```prolog
:- meta_predicate diagnostic_outcome(+, 0, -).
:- meta_predicate diagnostic_outcome(0, -).
```

Without qualification, a caller-private callback may resolve inside the helper's
module and raise `existence_error(procedure, ...)`. Tests using only `true`, `fail`,
`throw`, or other built-ins miss this. Test from a separate module with a private
callback. Exporting the callback into `user` can accidentally mask the defect
through module inheritance. Closure arguments require their actual number of
additional call arguments, rather than automatically using `0`.

## Make finalizer reset unconditional

Metric-callback fallback is covered above. Also exercise exceptions in the
finalizer's own reporting, JSON creation, file open, or stream writes:

```prolog
finish_trace(State) :-
    setup_call_cleanup(true, report_trace(State), reset_trace_state).
```

The schematic reporting goal is intended to be deterministic. Putting reset after
reporting in a plain conjunction leaves state behind when reporting throws or
fails. An active-scope marker can then misclassify every later operation as nested.
Inject a controlled output failure, inspect residual state, and run a subsequent
scope. Preserve the original reporting error unless the API explicitly specifies
a diagnostic fallback; do not catch every error just to reach reset.

This does not cover partial setup: if state/resource acquisition itself throws
before setup succeeds, the protected cleanup has not been established. Audit
partial-acquisition ownership separately, using a reachable fault path.

## Drain subprocess channels without circular waits

With stdout and stderr pipes, reading stdout to EOF before draining stderr can
deadlock: the child fills stderr and waits for a reader before closing stdout;
the parent waits for stdout EOF. Writing all stdin first can add another cycle
when the child emits output before consuming the rest of its input. The threshold
depends on OS pipe capacity and child behavior, not the final output row count.

Use an existing file-spooled subprocess helper or concurrent draining appropriate
to the call's buffering contract. Own streams, temporary files, and process
reaping across exceptions as well as success. Inspect status before matching only
`exit(Code)`: `process_wait/2` can report `killed(Signal)`, and an exit-only match
can make a supposedly deterministic wrapper silently fail.

Do not launch an unbounded intentionally deadlocking child as a diagnostic.
An executable probe needs an outer deadline and explicit cleanup of that exact
child. Source-level identification of the circular wait should be labeled as
such when no runtime deadlock was exercised.

## Sprefa receipts

For the added rescan, proof-count, callback, and lifecycle patterns, see
[V7 audit evidence](v7-audit-evidence.md). It records one instrumented checkout
snapshot and separates runtime probes from source-derived claims.

When working in Sprefa, read these in order:

- `v7/receipts/9_dl7_evaluator_lookup_perf.md`: relation grouping and dynamic row index.
- `v7/receipts/10_dl7_evaluator_trace.md`: active-scope tracing and metric lifecycle.
- `v7/receipts/11_compiler_performance_gate.md`: wall/inference gates and failure trace.
- `v7/receipts/18_cold_comptime_attribution.md`: phase and relation attribution.
- `v7/receipts/19_indexed_stratification_worklist.md`: indexed worklist with exact parity.
