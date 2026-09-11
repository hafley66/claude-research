# SWI runtime behavior affecting performance work

Use this reference when a proposed index, table, cache, or profiler result depends
on SWI engine behavior rather than only on the program's logical relation.

## JITI clause indexing

JITI evaluates instantiated arguments at call time and may build single-argument,
multi-argument, or deep indexes. Expose stable ground keys as predicate arguments.

Inspect the realized shape:

```prolog
?- use_module(library(prolog_jiti)).
?- jiti_list(module:predicate(_, _, _)).
?- jiti_suggest_modes(module:predicate(_, _, _)).
?- predicate_property(module:predicate(_, _, _), indexed(Index)).
```

Relevant SWI 10.0.2 defaults measured during the DL7 investigation:

- index consideration starts around 10 clauses;
- minimum speedup is 1.5;
- multi-argument consideration uses a 3.0 speedup ratio;
- more than 10 percent variable clauses at an argument can suppress its index;
- deep indexing is documented to descend at most seven levels;
- dynamic indexes are reconsidered when clauses double or fall below one quarter
  of the indexed population.

Keep compile-lifetime stores immutable after warmup where possible. Repeated
assert/retract churn can invalidate the index and charge the next lookup for its
reconstruction. `mode/1` guides index selection and does not change semantics.

JITI narrows candidates. The predicate must still perform exact unification after
hash or prefix selection. Preserve authored assertion order when duplicate keys use
first-match behavior.

Official references:

- https://www.swi-prolog.org/pldoc/man?section=jitindex
- https://www.swi-prolog.org/pldoc/man?section=prologjiti

## Dynamic predicates and store lifetime

SWI's logical update view gives every goal a starting generation. A clause remains
visible to a goal when that generation lies inside the clause's created-to-erased
interval. A long-running goal can retain clauses erased by another operation.

Use an explicit compile or evaluation identity and unconditional cleanup:

```prolog
setup_call_cleanup(
    install_store(StoreId, Rows),
    run_with_store(StoreId, Result),
    clear_store(StoreId)
).
```

Count residual clauses after success, failure, and exception. `retractall/1` removes
dynamic clauses while retaining predicate properties. Recorded-database entries
require their references to be passed to `erase/1`.

## Tables

Variant tabling memoizes per call variant and stores answers in tries. Generator
answer order is unspecified. Do not substitute variant tabling for an ordered
first-match relation without an output-order checksum. Mode-directed `first/1` can
express answer selection, but duplicate and aggregation semantics still need tests.

Count variants, answers, reuse, and space while the tables remain live:

```prolog
?- table_statistics(Predicate, Subgoals, Answers).
?- use_module(library(tableutil)).
```

Infinite answer sets exhaust table memory. Use tabling restraints when relation
growth is not structurally bounded.

## Garbage collection and choice points

Erased dynamic clauses can remain visible to older goals. Stale choice points also
retain stack references, and atom GC scans stacks conservatively. Clause GC and atom
GC share the `gc` thread and cannot scan concurrently.

Measure with the key supported by SWI 10.0.2:

```prolog
statistics(garbage_collection, [Count, Time]).
```

`statistics(gc, _)` is a domain error on that version. Manual GC calls move the
pause rather than remove its cost, so measure them only at explicit phase boundaries.

## Hashes and groundness

`term_hash/2` leaves its hash unbound for a non-ground term. A hash-index lookup can
therefore degrade into enumeration when its expected input mode is violated. Hash
only ground keys and check the complete term after lookup. `variant_hash/2` and
`variant_sha1/2` operate modulo variable renaming and reject cyclic terms.

## Profiler interpretation

The kernel profiler samples time, normally at 200 samples per second. Fast goals can
finish without one sample; SWI 10.0.2 was measured raising `zero_divisor` for such a
profile. Scale the workload or use `call_time/2` for short phases.

Use `library(prolog_profile)` for call counts and `library(prolog_wrap)` for temporary
argument-shape probes. C-implemented scans may consume wall time while charging few
Prolog inferences. Keep wall, inference, call-count, and scanned-element measurements
separate.

## Version evidence

Record `current_prolog_flag(version_data, Version)` with performance results. SWI
issue 1386 documents a patch-series clause-indexing regression that changed whether
a successful call left a choice point. Inference statistics can also differ by a few
counts according to the official statistics documentation.

Sources and the full source-level audit are recorded in Sprefa receipts
`v7/receipts/48_swi_official_docs_flash41.md` and
`v7/receipts/49_swi_source_issues_glm53f.md`.
