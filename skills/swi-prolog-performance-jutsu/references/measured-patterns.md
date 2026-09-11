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
9. [Sprefa receipts](#sprefa-receipts)

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

## Sprefa receipts

When working in Sprefa, read these in order:

- `v7/receipts/9_dl7_evaluator_lookup_perf.md`: relation grouping and dynamic row index.
- `v7/receipts/10_dl7_evaluator_trace.md`: active-scope tracing and metric lifecycle.
- `v7/receipts/11_compiler_performance_gate.md`: wall/inference gates and failure trace.
- `v7/receipts/18_cold_comptime_attribution.md`: phase and relation attribution.
- `v7/receipts/19_indexed_stratification_worklist.md`: indexed worklist with exact parity.
