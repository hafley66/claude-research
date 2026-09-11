---
name: swi-prolog-performance-jutsu
description: Profile and optimize SWI-Prolog compilers, Datalog evaluators, fixpoints, tabling, dynamic predicates, and relation-heavy programs using semantic parity and bounded measurements.
---

# SWI-Prolog Performance Jutsu

Use this skill when SWI-Prolog wall time, inference count, tabling, fixpoint
evaluation, dynamic facts, or relational fanout needs attribution or repair.

## Required posture

1. Capture canonical output, diagnostics, wall time, and inferences before edits.
2. Bound every probe. Run one compiler/profile process at a time.
3. Profile the slow phase directly. A whole-process profile can hide the loop.
4. Count actual relation rows by head and inspect representative terms.
5. State argument modes at the dominant call path. Groundness controls indexing
   and table variant cardinality.
6. Separate setup, repeated traversal, answer materialization, duplicate rejection,
   validation, and cleanup.
7. Make one physical change. Compare canonical bytes and exact diagnostics.
8. Keep wall and inference gates separate. Wall detects load; inference detects work.

SWI inferences count predicate-resolution work. They are not output rows or machine
instructions. Report both inferences and produced rows.

## Measurement tools

- `statistics(inferences, N)` around the narrow call.
- `library(prolog_profile)` for calls, redos, failures, self time, and child time.
- `library(prolog_wrap)` for temporary per-predicate exclusive inference attribution.
- `current_table/2` and `table_statistics/2` while tables are live.
- Canonical term output plus byte comparison for semantic parity.
- Opt-in phase tracing whose metrics are collected outside the timed body.

For engine behavior that changes storage and measurement choices, read
[references/swi-runtime-behavior.md](references/swi-runtime-behavior.md). It covers
JITI activation and invalidation, logical-update generations, table ordering,
garbage collection, profiler resolution, and version-sensitive determinism.

Label process-global table counters as global. SWI does not expose every counter per
relation. Do not present a process-global duplicate count as relation-local evidence.

## Decision sequence

```text
slow wall time
  -> stage trace
  -> dominant predicate and call path
  -> input cardinalities and modes
  -> actual outputs and table variants
  -> repeated-work equation
  -> one indexed, memoized, or demand-shaped replacement
  -> exact parity plus bounded performance gate
```

Common measured shapes:

- Triangular transitive closure materialized although every consumer asks a fully
  bound ordering question.
- Fixpoint relaxation rescanning every dependency and every level on each pass.
- The same pure rule set stratified repeatedly by checker and evaluator.
- One fresh table per ground call variant, repeated across strata or rounds.
- Dynamic row lookup with a free leading argument defeating JITI.
- An unbound closure sweep publishing internal helper relations.

When Prolog lists are acting as tables and repeated `memberchk/2` calls scan
them, read [references/indexed-storage.md](references/indexed-storage.md)
before designing an assoc or manual hash layer. SWI dynamic predicates use
JITI across multiple arguments and support deep indexing into compound terms.
Measure build lifetime, clause order, duplicate behavior, cleanup, JITI shape,
C-level scan work, charged inferences, wall time, and memory separately.

For fixes and concrete Prolog shapes, read
[references/measured-patterns.md](references/measured-patterns.md).
That reference also covers whole-bag rescans, overlapping proof paths, callback
qualification, finalizer failures, and subprocess pipe lifecycles. Its V7 audit
evidence link contains measured examples, not universal performance budgets.

## Semantic gates

Before changing evaluation or scheduling, pin:

- exact ordered strata;
- positive and negative dependency behavior;
- recursive SCC termination;
- aggregate gaps;
- exact closure rows and diagnostics;
- generated-rule invalidation;
- cache cleanup on success, failure, and exception;
- thread or evaluation-ID isolation where mutable state exists.

A hash selects a bucket. Full-term equality decides a memo hit.

Record the SWI version beside inference and determinism gates. Engine releases can
change clause selection, charged inferences, and whether an indexed call leaves a
choice point.

Keep tests smaller than the compiler budget they protect. If one test exceeds the
budget, split setup from assertions or use a smaller semantic fixture. Never hide the
overrun by raising the timeout or prewarming the measured path.
