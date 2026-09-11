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

For fixes and concrete Prolog shapes, read
[references/measured-patterns.md](references/measured-patterns.md).

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

Keep tests smaller than the compiler budget they protect. If one test exceeds the
budget, split setup from assertions or use a smaller semantic fixture. Never hide the
overrun by raising the timeout or prewarming the measured path.
