# Common Lisp Logic Lab Report Contract

Each lab owns one directory and writes only inside it.

## Required files

```text
0_BRIEF.md       supplied experiment boundary
1_SOURCE.md      upstream library, docs, commit, license, and install commands
2_PROBE.lisp     smallest executable capability probe
3_BUILD.lisp     standalone-image build when the library loads successfully
4_RESULTS.md     commands, raw results, measurements, and capability classification
```

Additional source files follow dependency order with numeric prefixes.

## Required capability results

| Capability | Result vocabulary |
| --- | --- |
| nested term unification | native, adapter, implement, external-runtime, absent-from-probe |
| occurs check | same vocabulary plus exact observed policy |
| multiple answers | same vocabulary plus ordering |
| fair search | same vocabulary plus starvation probe |
| cyclic transitive closure | same vocabulary plus termination mechanism |
| Datalog fixpoint | same vocabulary |
| tabling | same vocabulary; name variant, subsumptive, answer-subsumption, or another form |
| constraints | same vocabulary; name supported domains |
| dynamic facts and retraction | same vocabulary |
| standalone image | built, blocked, unsupported, or external-runtime |

## Minimal output format

`2_PROBE.lisp` prints deterministic records:

```text
PROBE library=<name> version=<version-or-commit>
UNIFY <canonical-answer>
OCCURS <policy-and-result>
PATH <sorted-canonical-answer-set>
UPDATE <sorted-canonical-answer-set>
BINARY <bytes-or-blocker>
```

Sort sets before printing. Keep raw timing samples in `4_RESULTS.md`.

## Bounds

- one upstream library per lab
- one general logic fixture
- one standalone-image attempt
- five startup timing samples at most
- one dependency-install route
- no modifications outside the owned lab directory
- no global Quicklisp mutation
- no large generated test corpus
- no vendored dependency checkout in the final repository

## Final report questions

1. Which SWI capabilities does the library cover directly?
2. Which capabilities require adapters?
3. Does recursion over a cycle terminate, and through which algorithm?
4. Can the library compile into an SBCL executable image?
5. What are executable bytes, dynamic dependencies, startup samples, and peak RSS?
6. Which source files implement unification, search, rule evaluation, and caching?
7. What code would remain before the library could execute DL7 compiler rules?
