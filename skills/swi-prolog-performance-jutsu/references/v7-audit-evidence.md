# V7 audit evidence: rescans, proof paths, and lifecycle

Evidence snapshot: 2026-09-11, Sprefa receipt
`v7/receipts/27_swi_prolog_gotcha_audit.md`. Native Astra read all 67 V7 Prolog
files, 24,918 lines in that inventory. This reference preserves measured examples
for the reusable patterns in [measured-patterns.md](measured-patterns.md).
It is historical evidence, not a claim that these defects remain in later code.
Source locations below identify the audit snapshot; subsequent edits can move them.

## Measurement scope

One fresh SWI process compiled
`v7/test/fixtures/lexical_binding/7_nearest_shadow.dl7` with `DL7_TRACE=off`,
empty compiler caches, and targeted `library(prolog_wrap)` wrappers. Output was
810 rows, no diagnostics, and 2,933,144 **instrumented** inferences. Each wrapper
counted inclusive work across outermost calls of that predicate, excluding nested
recursive self-accounting. Wrapper overhead is included. This audit did not
establish a replacement algorithm's speedup or an unwrapped benchmark total.

| Predicate | Calls | Inclusive inferences | Share of instrumented compile |
| --- | ---: | ---: | ---: |
| checker `dense_index_diagnostics/4` | 4 | 538,594 | 18.36% |
| evaluator `demand_cone_rules/6` | 15 | 431,151 | 14.70% |
| evaluator `collect_closure/4` | 15 | 173,510 | 5.92% |
| evaluator `worklist_loop/5` | 4 | 22,005 | 0.75% |
| syntax `materialize_syntax/4` | 0 | 0 | 0% |
| extract `accepted_rows/2` | 0 | 0 | 0% |

`bind_diagnostics/3` totaled 553,468 inclusive inferences and contains the dense
check above. Do not add parent and child costs. Collection is a measured reference
point, not another open defect. No wall-time ranking was inferred.

Synthetic scaling constructed inputs before the inference counter. One serial
process exercised sizes 100, 200, 400; initial cases can include autoload/JIT work.

| Target | 100 | 200 | 400 | Input |
| --- | ---: | ---: | ---: | --- |
| dense checks | 11,003 | 42,002 | 164,002 | one index-0 edge per distinct owner |
| worklist | 6,810 | 23,302 | 86,602 | N queued keys, zero levels, self-reader gap 0 |
| materializer | 287,759 | 1,134,231 | 4,508,431 | N atom frontiers, four rows per node |
| TSI acceptance | 72,873 | 285,416 | 1,130,816 | one syntax run, N facts and N witnesses |

The exact probes were capped with `timeout 15s`; no SWI processes overlapped.
No source or test replacement was used to obtain these measurements.

## Causal source anchors

- `v7/src/2_comptime/1_checker.pl:338`,
  `dense_index_diagnostics(+Edges,+AllEdges,+Origins,-Diagnostics)`:
  `count_owner_edges/3` scans AllEdges for each edge, producing E² visits.
- `v7/src/1_libtime/0_evaluator.pl:197`,
  `demand_cone_fixpoint(+Strata,+Level,+Rules,+Dependencies,+Selected,-Plain)`:
  every pass joins every selected rule head against all dependencies, then scans
  all rules and sorts the enlarged set. Multiple definitions repeat head joins.
- The same evaluator at line 784,
  `worklist_loop(+Queue,+Index,+Levels0,-Levels,+Debug)`:
  `append(Queue0,Enqueued,Queue)` copies Queue0 even when Enqueued is empty.
- `v7/src/0_reader/1b_syntax_materializer.pl:43`,
  `materialize_node(+Node,+Rows,+Seen0,-Seen,-Result,-Sources,-Diagnostics)`:
  six full row scans per node for presence, four payload roles, and source;
  forms additionally scan child edges. Node/source duplicate checks use bag
  cardinality, while payloads are deduplicated separately.
- `v7/src/2_comptime/0c_extract_loader.pl:288`,
  `accepted_rows(+ground Rows,-Accepted)`: witness/run/completeness joins repeat
  per fact. Scope/relation completeness is invariant within this call.

## Executed correctness probes

### Fallback choicepoint repeats downstream checker work

`v7/src/2_comptime/1_checker.pl:99`, `debug_checker_input/2`, had a structured
clause and uncommitted fallback. The public checker advertised `det`:

```prolog
findall(D, dl7_checker:check_datalog(
    basement_program(root_graph([],[]),datalog_program([],[],[])),
    [], _, D), Ds).
% Ds = [[], []].
```

This proves duplicate checker solutions for that mode, not duplicate compiler
rows. Compiler callers can hide the second path by committing to the first result.

### Constructive overlap survives until tuple deduplication

`v7/src/1_libtime/0_evaluator.pl:1202`, `cons_construct/3`, had empty-tail and
general proper-list clauses. Its construction mode returned two raw answers:

```prolog
findall(L,
    dl7_evaluator:cons_relation(const(a),const([]),L), Ls).
% Ls = [const([const(a)]), const([const(a)])].
```

Tabled callers deduplicated the tuple. No duplicate final closure row was claimed.

### Caller-private callback exposes missing meta declaration

`v7/bench/0_compiler_performance.pl:392` exported `diagnostic_outcome/3` and `/2`
without meta declarations. A separate importing module's private `local_probe/0`
produced `existence_error(procedure,dl7_compiler_performance:local_probe/0)`.
The first probe mistakenly exported the callback into `user` and passed; making
it private exposed the error. Built-in-only callback tests also passed.

### Reporting error bypasses trace reset

`v7/src/2_comptime/1b_compiler_tracer.pl:86`, `finish_compile_trace/2`, wrote JSON
before resetting the active marker. With `DL7_TRACE=json` and trace path
`/dev/null/astra-audit.jsonl`, catching `with_compile_trace(audit,true)` observed
`existence_error(directory,'/dev/null')` and one residual `active_compile_trace/1`
fact. The probe explicitly reset state afterward. A subsequent compile would take
the source's nested-scope branch; that consequence was source-derived, not a
separate measured compile.

## Source-confirmed operational path, not a deadlock experiment

The wrappers at `v7/src/3_emit/3_rust_type_region_mainer.pl:67`,
`v7/src/4_tool/2_dl7_rust_region_mainer.pl:43`, and
`v7/src/4_tool/0_source_query_mainer.pl:94` drained stdout before stderr.
The first two also synchronously wrote all stdin first and matched only
`process_wait(Pid,exit(Exit))`. Their input/output modes are bound executable,
arguments, and optional input; exit, stdout, and stderr are outputs.

The circular wait and missing unconditional resource cleanup were established
from source. No deadlocking child, pipe-capacity threshold, or process leak was
measured. A file-spooled alternative already existed in
`v7/src/4_tool/5_extract_sqlite_query_mainer.pl`.

## Evidence limits

This snapshot did not justify new table modes/subsumption or persistent caching.
Hash lookups already rechecked exact terms and hashed only ground arguments.
Global table counters were already labeled global. The proposed public malformed
seed setup-leak example was withdrawn because outer seed selection filters that
shape before installation. Partial setup exceptions require a reachable fault
probe of their own.
