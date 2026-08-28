# SWI-Prolog, Common Lisp, and Racket Crosswalk

Research date: 2026-08-28

Capability labels:

```text
native             supplied by the language/runtime
library            supplied by the named library
adapter            a bounded layer over a nearby facility
implement          requires a new engine component
external-runtime   calls another logic runtime
```

## Capability table

| SWI facility useful to DL7 | Shortest Common Lisp route | Shortest Racket route | Coverage note |
| --- | --- | --- | --- |
| Reader terms, symbols, interning | CL reader, packages, `intern`, readtables | reader, symbols, syntax objects, scope sets | Native in both hosts |
| Macro expansion and phase-0 lowering | `defmacro`, compiler macros, `eval-when` | hygienic macros, expanders, `#lang` | Racket tracks lexical scopes in syntax objects; CL macros receive Lisp objects |
| First-order unification | `cl-gambol`, PAIP Prolog, miniKanren ports | Racklog or miniKanren | Library capability; occurs-check policy varies |
| Backtracking and multiple answers | Prolog libraries or Screamer nondeterminism | Racklog or miniKanren streams | Search order and fairness vary |
| Function-free Horn rules | `cl-datalog`, `cl-grph`, Prolog libraries | `datalog` and `datalog/sexp` | Racket Datalog is the shortest bottom-up/table-oriented route |
| Recursive least fixpoint | Datalog library, explicit seminaive worklist | Racket Datalog | General CL supplies collections and control flow; the logic algorithm comes from a library |
| General Prolog tabling and SLG completion | implement, embed SWI, or use an engine that documents tabling | implement or embed another engine; Racket Datalog tables its Datalog domain | Racklog is a Prolog embedding without documented SLG tabling |
| Variant or subsumptive call tables | implement or embed SWI | implement or embed a tabling engine | Needed for recursive compiler queries with logic variables |
| Answer subsumption and lattice tabling | implement or retain SWI | implement; Rosette solves constraints with different semantics | Useful for shortest path and abstract interpretation |
| Well-founded negation and delayed goals | implement or retain SWI | Racket Datalog's language restrictions cover its own semantics | General Prolog behavior requires a dedicated engine |
| Dynamic facts, assertions, and retractions | ordinary CL tables plus library adapter | Racket Datalog assertion/query APIs | Incremental dependency repair remains a separate capability |
| Incremental tabling after updates | implement or retain SWI incremental tabling | implement incremental dependency maintenance | A mutable fact store alone does not update completed recursive tables |
| Constraint logic over finite domains | Screamer gives finite-domain constraint search | Rosette for SMT-backed symbolic constraints; cKanren family for relational constraints | APIs and propagation semantics differ from `clpfd` |
| Rational and real arithmetic constraints | implement or call a solver through CFFI | Rosette solver interface | SWI `clpq` and `clpr` remain the shortest Prolog route |
| Constraint Handling Rules | implement CHR rules/constraint store or retain SWI | implement/package-specific research | CHR is useful for user-defined type-class and type-constraint solvers |
| Attributed variables | custom variable metadata and wake queues | miniKanren/cKanren constraint stores provide related machinery | SWI integrates attributes with unification and coroutining |
| Coroutining, freeze, and delayed wakeup | implement suspension queues | miniKanren streams or custom scheduler | Host continuations and lazy streams cover control, with different variable semantics |
| DCG lowering | LispWorks Common Prolog includes DCGs; otherwise macros | parser-tools or a Racklog-level macro | A CL macro can append hidden state arguments mechanically |
| Term inspection and construction | native lists, structures, `typecase`, MOP | native pairs, structs, `match`, syntax objects | Native host strength |
| Module and namespace system | packages plus ASDF systems | modules, submodules, phases, `#lang` | Logic predicate visibility still needs a compiler-level policy |
| Source locations and hygienic binding | reader wrappers plus explicit source objects | syntax objects carry source and scopes | Racket has the shorter built-in path for hygienic source-aware expansion |
| Graph SCC, topological order, worklists | CL collections plus graph library or direct algorithm | `graph` package and native collections | Independent of logic resolution |
| Foreign C API | CFFI; ECL embedding; SBCL alien interface | Racket FFI | Native host/runtime integration |
| Standalone executable | SBCL saved image; ECL compiled executable | `raco exe`, then `raco distribute` | Measure runtime dependencies with platform tools |
| Embedding SWI | CFFI or a C host embedding both runtimes | Racket FFI to `libswipl` | Every OS thread calling SWI needs an attached Prolog engine |
| Concurrent isolated query engines | host threads plus library-specific state; embedded SWI engines | Racket places/threads plus library-specific state | Logic tables and substitutions require explicit ownership |
| Saved compiler state | SBCL image or embedded serialized compiler graph | Racket executable or serialized module data | SWI saved states can also attach resource archives |

Primary references:

- [SWI tabling](https://www.swi-prolog.org/pldoc/man?section=tabling)
- [SWI constraint libraries](https://www.swi-prolog.org/pldoc/man?section=clp)
- [SWI CHR](https://www.swi-prolog.org/pldoc/man?section=chr)
- [SWI saved states](https://www.swi-prolog.org/pldoc/man?section=saved-states)
- [SWI foreign threads and engines](https://www.swi-prolog.org/pldoc/man?section=foreignthread)
- [Racket parenthetical Datalog](https://docs.racket-lang.org/datalog/Parenthetical_Datalog_Module_Language.html)
- [Racklog](https://docs.racket-lang.org/racklog/)
- [Racket syntax model](https://docs.racket-lang.org/reference/syntax-model.html)
- [Rosette](https://docs.racket-lang.org/rosette-guide/)
- [Racket executables](https://docs.racket-lang.org/raco/exe.html)
- [LispWorks Common Prolog](https://www.lispworks.com/documentation/lw80/kw-w/kw-prolog-1.htm)
- [Allegro Prolog](https://franz.com/products/prolog/index.lhtml)

## Compiler ownership if Common Lisp becomes phase 0

These responsibilities can move to Common Lisp after a bounded phase-0 probe:

| Responsibility | CL mechanism | Required output |
| --- | --- | --- |
| source reading | reader or parser over character streams | source-located syntax objects |
| punctuation and prefix syntax | readtable macros or dedicated parser | normalized core forms |
| syntactic binding expansion | macros over syntax objects | explicit scope and symbol edges |
| file/module discovery | ASDF/UIOP and compiler project rules | ordered module graph |
| command-line front end | UIOP command-line arguments | selected compiler request |
| artifact orchestration | ordinary CL functions | target-neutral plan and diagnostics |
| executable image | SBCL saved image or ECL executable | measurable front-end binary |

These responsibilities need equivalent lab receipts before leaving SWI:

| Responsibility currently covered by SWI | Required replacement receipt |
| --- | --- |
| unification | nested terms, variable aliasing, occurs policy, deterministic substitution output |
| tabled recursion | cyclic transitive closure reaches a completed answer set |
| compiler fixpoint | newly derived requests trigger work until no new canonical rows appear |
| negation and stratification | negative dependencies are rejected or scheduled with stated semantics |
| CLP and CHR | representative type and clock constraints reach the same solutions and failures |
| dynamic update handling | add and retract facts without stale recursive answers |
| query isolation | concurrent requests cannot share variables, tables, or mutable rule state accidentally |

## Single-binary shapes

### Shape A: SBCL front end plus SWI executable

```text
sprefa-cl -> serialized core -> swipl
```

Two executable files and one protocol. This shape measures the phase boundary with the fewest embedding variables.

### Shape B: Common Lisp executable plus dynamic `libswipl`

```text
SBCL or ECL executable
  -> CFFI
  -> libswipl.dylib
  -> embedded saved Prolog state
```

One application executable with a dynamic runtime dependency. Measure the executable, `libswipl`, saved-state resource, startup time, and resident memory.

### Shape C: native host containing both runtimes

```text
Rust or C process owner
  + embedded ECL-generated objects or a Lisp runtime image
  + embedded SWI runtime and saved state
  + sprefa-engine-rs
```

One process can own both runtime lifecycles. A single distributable file additionally requires static or embedded runtime artifacts supported by the selected CL implementation and SWI build.

## Hard boundary work

1. Preserve lexical symbol identity and logic variable identity across runtimes.
2. Preserve source locations through macro expansion and rule derivation.
3. Define ownership for CL objects, Prolog terms, and serialized buffers across two garbage collectors.
4. Attach one SWI engine per calling thread and close every query and foreign frame.
5. Define exception conversion in both directions.
6. Define table lifetime per compiler request, module generation, and dynamic update.
7. Package CL runtime data, SWI saved state, native libraries, and target emitters reproducibly.
8. Measure executable bytes, total distribution bytes, cold startup, warm compile, peak RSS, and cross-runtime call cost.
