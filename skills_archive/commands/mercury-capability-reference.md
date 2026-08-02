# Mercury Capability Reference

> Compiled 2026-07-28 from mercurylang.org official docs, the `Mercury-Language/mercury` repository, the mercury-users mailing list, Stack Overflow, Hacker News, and third-party tutorials. Two research streams merged; every factual claim carries an inline source link or a `gh` receipt.
>
> Mercury is the strongly-typed, pure, declarative logic programming language from the University of Melbourne (Somogyi, Henderson, Conway). Syntactically Prolog-family; semantically "logic Haskell" — Hindley-Milner types, a mode system, a determinism lattice, and purity annotations, compiling to native C. Its signature feature is **in-place destructive update of arrays in pure declarative code** via `unique` modes, which neither Prolog nor plain Haskell can match.

---

## Research Metadata

| Field | Value | Source |
|---|---|---|
| Name | Mercury | https://mercurylang.org/index.html |
| Homepage | https://mercurylang.org | — |
| Docs root | https://mercurylang.org/documentation/documentation.html | — |
| Repository | https://github.com/Mercury-Language/mercury | `gh api repos/Mercury-Language/mercury` |
| Default branch | `master` | same |
| Bug tracker | https://bugs.mercurylang.org (primary; GitHub Issues undercounts) | homepage |
| Mailing list archive | https://lists.mercurylang.org / mercury-users hypermail | contact page |
| License (compiler/tools) | **GPL-2.0** (`COPYING`) | repo LICENSE |
| License (core libs: browser, runtime, trace, library, mdbcomp, java/runtime, ssdb) | **LGPL-2.1** (`COPYING.LIB`) | repo LICENSE |
| Alternative licensing | "willing to offer alternative arrangements" on request | repo LICENSE |
| Copyright | "© 1993-2012 University of Melbourne; © 2013-2026 The Mercury team" | repo LICENSE |
| GitHub stars | 1,064 | `gh api repos/Mercury-Language/mercury` |
| Primary authors | **Zoltan Somogyi, Fergus Henderson, Thomas Conway** (University of Melbourne). Note: "Zobel" appears in some third-party citations but not on the core Mercury papers — treat those citations as confused. | https://mercurylang.org/documentation/papers.html |
| Active maintainers (2026) | `zsomogyi` (Somogyi, 5232 commits), `juliensf` (Julien Fischer, 1695), `wangp` (Peter Wang, 1598), `sebgod` (C#/.NET 10, agc revival), `markbrown` (declarative debugging) | `gh api .../contributors` |

### Versions verified 2026-07-28

| Channel | Version | Date | Source |
|---|---|---|---|
| **Stable (current)** | **Mercury 22.01.8** | 2023-09-17 | https://mercurylang.org/news.html · https://dl.mercurylang.org/release-22.01/release-notes-22.01.8.html |
| Latest ROTD (Release Of The Day) | `rotd-2026-07-28` (commit `f8b79a784ea4420e1305d8efbb000ee7af1b209a`) | 2026-07-28 | http://dl.mercurylang.org/index.html |
| Latest beta | `22.01.9-beta-2026-07-13` | 2026-07-13 | same |
| Release scheme | Calendar-versioned `YY.MM` since Feb 2010; patch releases bump the third component (`22.01.1` … `22.01.8`); nightly ROTDs between releases | RELEASE_NOTES + tags `version-YY_MM[_patch]` |

> **Version-line correction:** the 22.01 series shipped 2022-03-31; **22.01 dropped the Erlang backend** as unmaintained. Apple-Silicon macOS build status is unconfirmed (issue #136 open); Linux AArch64 shipped in 22.01. Any tutorial referencing the Erlang backend is stale.

---

## Executive Index

Mercury sits between Prolog and Haskell: Prolog's syntax and relational/multi-solution search, plus Haskell's static types and purity, plus a mode system neither has. It compiles to native C (also Java, C#) and is fast — the Mercury compiler is itself written in Mercury.

**What "knowing Mercury" means, at four altitudes:**

1. **Surface tier** — Prolog-shaped syntax (`pred`/`func`/`:-`, `head :- body`, DCGs), module files (`.m`) with interface/implementation sections, `:- module name.`, `import_module`.
2. **Type + determinism tier** — Hindley-Milner types (`:- type`, polymorphism, algebraic constructors), and the **determinism lattice**: every predicate mode must declare one of `det`/`semidet`/`multi`/`nondet`/`cc_multi`/`cc_nondet`/`failure`/`erroneous`, and the compiler *proves* the declaration. This is why large Mercury programs refactor safely.
3. **Mode tier (the signature power)** — instantiation states (`free`/`ground`/`bound`/`unique`/`mostly_unique`/`dead`), modes as `(InitialInst >> FinalInst)` pairs per argument. The compiler emits a separate specialized procedure per declared mode and reorders clause bodies to make data flow work.
4. **The killer move** — `unique` modes (`di`/`uo`) enable **in-place destructive update of arrays in pure declarative code**: `array.set(in, in, di, uo) is det` compiles to a single store instruction, no allocation, no trail. Prolog cannot match this; Haskell can only via `ST` or `IO`.

**The mode system is the load-bearing fact.** It is also why newcomers bounce off: even simple programs produce mode errors that require understanding instantiation flow to fix. Plan for it.

**Three things that decide whether Mercury fits a problem:**

- It is **pure and declarative** — no `assert`/`retract`/cut in user code; I/O threads a linear `io.state` token (`main(!IO)`).
- It is **single-implementation and small-ecosystem** — one compiler, maintained by a Melbourne-centered team; no analogue of SWI's RDF/Pengines/http/PlDoc stack; no first-party package manager (third-party: Merchant).
- Its **sweet spot is large symbolic programs** — compilers, formatters, constraint solvers. The marquee production user is **PrinceXML** (YesLogic, Melbourne; HTML/CSS→PDF). Other users: the Bower email client, the Mercury compiler itself.

**#1 footgun for newcomers:** mode errors. **#1 footgun for FFI:** lying about `will_not_call_mercury` (trail/GC corruption, usually silent until the next GC). **#1 production lesson:** tabling is **C-backend only**, and `minimal_model` tabling *changes the declarative semantics* to perfect model.

**Most underrated feature:** the `mdb` debugger — the only tracer that understands modes and determinism, with a declarative-debugging mode (`dd`) that algorithmically isolates the wrong call.

---

## Capability Matrix

| Capability | Status | Notes |
|---|---|---|
| Algebraic types + HM polymorphism | Shipped, mature | Ref Man Ch. 4. Parametric polymorphism like ML/Haskell |
| User-defined modes (`in/out/uo/ui/di/muo/mui/mdi`) | Shipped, mature | Ref Man Ch. 5–6. The defining feature |
| Unique modes (destructive update) | Shipped, mature | Ref Man Ch. 6. `di`/`uo` → in-place array update in pure code |
| Determinism system (8 categories) | Shipped, mature | Ref Man Ch. 7. Compiler proves the declared determinism |
| Purity (pure/semipure/impure + promises) | Shipped, mature | Ref Man Ch. 17. Foundation for reordering/optimization |
| Module system (nested, ADTs, separate compile) | Shipped, mature | Ref Man Ch. 10. Interface/implementation split; `.` separator |
| Higher-order (closures, currying, lambdas) | Shipped, mature | Ref Man Ch. 9 |
| DCG notation | Shipped, mature | Ref Man §3.8. `!IO` state-variable syntax preferred for IO; DCGs for parsing |
| Typeclasses (multi-param, fundeps, superclasses) | Shipped, mature | Ref Man Ch. 11. Differs from Haskell in required method modes/determinism; no overlapping instances |
| Existential types | Shipped | Ref Man Ch. 12 |
| User-defined equality/comparison | Shipped | Ref Man Ch. 8 |
| Exception handling | Shipped | Ref Man Ch. 14 |
| Subtypes + `coerce` | Shipped since 22.01 | NEWS; refinement still landing in NEWS.md head |
| Solver types (`solver type`, `any` inst) | **Experimental** | Ref Man Ch. 18; PADL 2006 paper. Requires trailed grade (`.tr`) |
| Trace goals | Shipped | Ref Man Ch. 19 |
| Foreign function interface (C, C#, Java) | Shipped, mature | Ref Man Ch. 16. Erlang dropped in 22.01 |
| Tabling (`memo` / `minimal_model` / `loop_check`) | Shipped (**C-backend only**) | PADL 2006 paper (Somogyi, Sagonas). `minimal_model` changes semantics to perfect model |
| C backend low-level (`asm_fast`) | Shipped, primary, fastest | GNU C labels-as-values + global registers |
| C backend high-level (`hlc`) | Shipped, mature | CC 2002 paper |
| Java backend | Shipped | PR #139 open for inherited-generic-types |
| C# backend | Shipped | PR #146 open for .NET 10 |
| Erlang backend | **Dropped in 22.01** | Unmaintained |
| Accurate GC (`hlc.agc`) | revival DRAFT | PR #144 |
| Parallelism (`.par`) | Shipped, research-active | Paul Bone PhD 2012; disabled in non-parallel low-level C grades (NEWS head) |
| Debugger `mdb` | Shipped, mature | User's Guide Ch. 9; procedural + declarative debugging; understands modes+determinism |
| Profiler `mprof` (flat/call-graph) | Shipped | User's Guide Ch. 10 |
| Deep profiler `mdprof` | Shipped | Conway/Somogyi 2001 |
| Boehm GC | Vendored | `boehm_gc/` directory |
| Occurs-check | **On by default** | RELEASE_NOTES |
| Clause-body reordering | Automatic | Modes enable it; impure goals are the barrier |
| `mmake` build tool | Shipped | User's Guide Ch. 7 |

---

## Official Documentation Inventory

All under https://mercurylang.org/documentation/documentation.html. Each manual has two editions: `doc-release/` (frozen at 22.01.8) and `doc-latest/` (tracks the current ROTD). Cite `doc-latest/` for current behavior.

| Document | Edition | URL |
|---|---|---|
| **Language Reference Manual** | release 22.01.8 | https://mercurylang.org/information/doc-release/mercury_ref/index.html |
|  | latest (rotd) | https://mercurylang.org/information/doc-latest/mercury_reference_manual/ |
| **User's Guide** | release | https://mercurylang.org/information/doc-release/mercury_user_guide/index.html |
|  | latest | https://mercurylang.org/information/doc-latest/mercury_user_guide/index.html |
| **Library Reference Manual** | release / latest | https://mercurylang.org/information/doc-release/mercury_library/ · https://mercurylang.org/information/doc-latest/mercury_library_manual/ |
| **Prolog → Mercury Transition Guide** | release / latest | /information/doc-{release,latest}/mercury_{trans_guide,transition_guide}/ |
| **FAQ** (release 22.01.8) | release | https://mercurylang.org/information/doc-release/mercury_faq/index.html |
| **Comparing Mercury and Haskell** | single | https://mercurylang.org/about/comparison_with_haskell.html |
| **Papers and Presentations** (~50, 1987–2024) | rolling | https://mercurylang.org/documentation/papers.html |
| **Tutorial (Ralph Becket, "under development")** | — | https://github.com/Mercury-Language/mercury/wiki/Tutorial · https://mercurylang.org/documentation/papers/book.pdf |

**Ref Man chapters (22):** Introduction, Syntax, Clauses (incl. DCGs §3.8), Types, Modes, Unique-modes, Determinism, User-defined equality/comparison, Higher-order, Modules, Type-classes, Existential-types, Type-conversions, Exception-handling, Formal-semantics, Foreign-language-interface, Impurity, Solver-types, Trace-goals, Pragmas, Implementation-dependent-extensions, Bibliography. ToC at https://mercurylang.org/information/doc-latest/mercury_reference_manual/.

**User's Guide chapters (17):** Introduction, Introduction to mmc, **Mercury grades (Ch. 3)**, Running, Compilation, Filenames, Using Mmake, Libraries, Debugging (mdb, Ch. 9), Profiling (mprof/mdprof, Ch. 10), Invocation, Environment, Diagnostic output, C compilers, Foreign language interface, Stand-alone interfaces.

**Doc-tree freshness caveat:** HTML under `doc-release/` is pinned to 22.01.8 (Sept 2023). Anything newer (subtypes refinement, `ops` priority inversion, `u`-suffixed shift operators `<<u`/`>>u`, `uenum` typeclass, `clock_t` becoming abstract, `mmc --make name.cs` semantics, submodule visibility changes) lives only in `doc-latest/` or the in-repo `NEWS.md`.

**Web-title caveat:** the Ref Man uses Title-Case-with-hyphens (`Type-classes.html`, `Solver-types.html`, `Unique-modes.html`); the User's Guide uses `Grades-and-grade-components.html`, `The-Mercury-backends.html`. Several plausible URLs 404 — use the ToC page rather than guessing.
---

## Repository Map and Build

`Mercury-Language/mercury` top-level layout (`gh api .../contents`):

| Path | Purpose |
|---|---|
| `compiler/` | Mercury source of the compiler (hundreds of `.m` files: `add_pred.m`, `typecheck_*.m`, `modecheck_*.m`, `add_pragma_*.m`, `analysis.*.m`, …). The compiler is **written in Mercury**. |
| `library/` | Standard library source (`array.m`, `map.m`, `set.m`, `string.m`, `list.m`, `bag.m`, `bitmap.m`, `bt_array.m`, `cord.m`, `digraph.m`, …). `MODULES_DOC` / `MODULES_UNDOC` enumerate. |
| `runtime/` | C runtime system: `mercury.c`, `mercury.h`, `mercury_accurate_gc.{c,h}`, `mercury_atomic_ops.c`, `mercury_array_macros.h`, … |
| `boehm_gc/` | Vendored, slightly modified Boehm-Demers-Weiser conservative GC |
| `trace/` | Trace events: `mercury_trace.{c,h}`, `mercury_event_parser.y`, `mercury_event_scanner.l` |
| `browser/` | In-debugger term browser (`browse.m`, `browser_info.m`, `debugger_interface.m`) |
| `mdbcomp/` | Mercury debugger compiler components |
| `deep_profiler/`, `profiler/` | `mdprof` deep profiler, `mprof` flat/call-graph profiler |
| `java/` | Java backend runtime support |
| `doc/`, `Documentation/` | Doc sources + per-platform READMEs (`README.Java.md`, `README.CSharp.md`, `README.bootstrap`) |
| `extras/` | Extras not in stdlib proper: XML parsing, POSIX, ODBC, graphics (Tk/OpenGL/GLUT/GLFW/Xlib/Allegro/Cairo), curses, CGI, fixed-point/complex arithmetic, dynamic linking, trailed destructive update |
| `bindist/`, `benchmarks/`, `samples/`, `tests/`, `tools/` | distribution, benchmarks, samples, tests, support tools |
| `grade_lib/` | Grade-naming library (the grade parser lives here) |
| `RELEASE_NOTES`, `RELEASE_NOTES_NEXT`, `NEWS.md`, `VERSION`, `LIMITATIONS.md`, `BUGS` | maintainer/release-facing |

### The compiler: `mmc`

- `mmc` is the Mercury compiler (written in Mercury). `mmake` is a GNU-make front-end that handles Mercury-specific dependencies automatically (User's Guide Ch. 7).
- Bootstrap: historically bootstrapped with NU-Prolog and SICStus Prolog; current tarballs ship generated C so users do not need a pre-existing Mercury to build. Build-from-git needs an existing `mmc` or a ROTD tarball. Typical: `./configure && mmake depend && mmake && mmake install`.
- Supported platforms: Linux (x86_64, arm), macOS (x86_64), Windows 7/10 (x86, x86_64), FreeBSD/OpenBSD x86_64, AIX. 22.01 added Linux AArch64; dropped Alpha, macOS ≤10.8, **Erlang backend**. Apple-Silicon macOS build status unconfirmed (issue #136). Recommended C compiler: gcc ≥3.4; clang; MSVC ≥19.3 (VS 2022).

---

## The Grade System

A **grade** is a compilation-model selector: `mmc --grade GRADE` (or `MERCURY_DEFAULT_GRADE`). It is a dot-separated list whose first element is the **base grade** and any following elements are **grade modifiers**. The same source compiles to many targets with many tradeoffs; the grade names the product. Sources: User's Guide Ch. 3 — https://mercurylang.org/information/doc-release/mercury_user_guide/Grades-and-grade-components.html, Base-grades.html, Grade-modifiers.html.

### Base grades

| Base | Backend | What it generates |
|---|---|---|
| `asm_fast` | C (low-level) | GNU C labels-as-values + global registers; **fastest** C output |
| `hlc` | C (high-level) | "Idiomatic" C, treats generated C as a high-level language |
| `reg` | C | Uses GNU C's global-register-variables extension |
| `none` | C | Plain standard C, most portable (no GNU C extensions) |
| `csharp` | C# | C# source |
| `java` | Java | Java source |

(Erlang base existed historically; **dropped in 22.01**.) Default is system-dependent, chosen at configure/install time; the runtime+stdlib are installed in only a subset of possible grades. List available stdlib grades with `mmc --output-stdlib-grades`. Typically defaults to one of the two fastest: `hlc` or `asm_fast`.

### Grade modifiers (combine in any order)

| Modifier | Effect |
|---|---|
| `.gc` | Boehm-Demers-Weiser conservative GC |
| `.par` | Thread support + parallel conjunction operator `&` |
| `.tr` / `.trseg` | Trailing (for trailed destructive update / constraint solvers) |
| `.stseg` | Compose stacks from memory segments instead of fixed-size |
| `.spf` | Single-precision floats (32-bit C only) |
| `.debug` | Generates executables debuggable with `mdb` |
| `.decldebug` | Declarative-debugging build (larger executables, enables `mdb` declarative debugging) |
| `.prof` | gprof-style time profiling |
| `.profdeep` | Deep profiling (for `mdprof`) |
| `.memprof` | Memory-usage profiling |
| `.profcall` / `.proftime` / `.profmem` | Call-graph / time / memory profiling variants |

Example: `asm_fast.gc.par.debug.trseg`. Most modifiers apply only to the C targets. **Post-22.01 NEWS:** concurrency in non-parallel low-level C grades has been disabled (it "was never useful for anything other than trivial programs").

**Why grades exist:** a single Mercury source can compile to C, Java, or C#, and within C can choose low-level vs high-level output, ship with or without GC, enable parallel/concurrent execution, be debuggable with `mdb` or profiled with `mprof`/`mdprof`, use trailing or not. Each axis is independent; the dot-list names the product. The grade is also a deployment contract — the installed stdlib/runtime must match the grade you compile against.

---

## Backends

| Backend | Grade prefix | Status |
|---|---|---|
| **C low-level (`asm_fast`)** | `asm_fast.*` | Primary, highest-performance, most mature. GNU C labels-as-values + global registers. |
| **C high-level (`hlc`)** | `hlc.*` | Mature. "Compiling Mercury to high-level C code" (Henderson & Somogyi, CC 2002). |
| **Java** | `java` | Shipped. `Documentation/README.Java.md`. PR #139 open for inherited-generic-types. |
| **C#** | `csharp` | Shipped. `Documentation/README.CSharp.md`. PR #146 open for .NET 10. |
| **Erlang** | — | **Dropped in 22.01** (was unmaintained). |
| MSIL/CLR | — | Historical; folded into the C# backend (Dowd, Henderson, Ross, BABEL 2001). |

Active 2026 experiments: PR #144 "Revive the hlc.agc (accurate GC) grade" (sebgod, DRAFT); PR #143 Windows-on-ARM64-MSVC (closed).

---

## Core Language Concepts (the defining features vs Prolog)

Mercury is syntactically Prolog-family but semantically very different: purely declarative, strongly typed, strongly moded, with a determinism system and a module system. (https://mercurylang.org/about.html)

### Types

- **Hindley-Milner / many-sorted logic with parametric polymorphism** — "very similar to the type systems of modern functional languages such as ML and Haskell."
- Declarations: `:- type list(T) ---> [] ; [T | list(T)].` and `:- type maybe(T) ---> yes(T) ; no.`
- Predicate signatures: `:- pred append(list(T), list(T), list(T)).` The compiler infers types of all variables; type errors are compile-time.
- Builtin types: `int`, `uint`, `float`, `string`, `char`, `bool`; stdlib `list/1`, `map/2`, `set/1`, `bag/1`, `array/1`, `assoc_list/2`, `cord/1`, `digraph`, `bt_array`, `bitmap`. 22.01 added sized integers `i8 i16 i32 i64 u8 u16 u32 u64` and **subtypes** with `coerce/1`.
- Algebraic/discriminated-union constructors; abstract types (name exported, definition hidden = ADT); type equivalence.

### Modes

- An **inst** (instantiation state) maps a type's constructor tree to states `free` | `bound(...)` | `ground` | `any`, plus unique variants `unique`/`dead`/`mostly_unique`/`mostly_dead`.
- A **mode** is a pair `(InitialInst >> FinalInst)` for one argument.
- Built-in modes (Ref Man Ch. 5):
  - `in == ground >> ground` · `out == free >> ground`
  - `uo == free >> unique` (unique output) · `ui == unique >> unique` (unique input)
  - `di == unique >> dead` (destructive input)
  - `muo`/`mui`/`mdi` — mostly-unique (backtrackable) variants
  - `ia == in(any)` / `oa == out(any)` — for solver types
- User-defined modes: `:- mode m == inst1 >> inst2.`
- Predicate mode declarations: `:- mode append(in, in, out) is det.` Multiple modes per predicate are normal; each compiles to a separate specialized procedure.

### Determinism — the eight categories

Ref Man Ch. 7 — https://mercurylang.org/information/doc-latest/mercury_reference_manual/Determinism.html

| Determinism | # Solutions | Can fail? | Notes |
|---|---|---|---|
| `det` | exactly 1 | no | deterministic |
| `semidet` | 0 or 1 | yes | semideterministic; like a boolean test |
| `multi` | ≥1 | no | at least one solution, may have more |
| `nondet` | ≥0 | yes | arbitrary number of solutions |
| `failure` | 0 | yes | always fails |
| `erroneous` | 0 | no | never returns (infinite loop / error) |
| `cc_multi` | ≥1 | no | committed-choice multi — commit to first solution |
| `cc_nondet` | ≥0 | yes | committed-choice nondet |

`cc_multi`/`cc_nondet` exist for I/O and committed-choice contexts where you cannot backtrack. The compiler *proves* the declared determinism per mode using conservative rules (the general problem is undecidable). Declaration attaches to the mode: `:- mode p(in, out) is det.` If a predicate has only one mode, the collapsed form is `:- pred factorial(int::in, int::out) is det.`

### Purity

Ref Man Ch. 17 — https://mercurylang.org/information/doc-latest/mercury_reference_manual/Impurity.html

| Level | Meaning |
|---|---|
| **pure** (default) | Solution set depends only on input arguments. No interaction with the real world without an `io.state` argument. |
| **semipure** | Declarative semantics may be *affected by* impure state (reads impure state) but does not itself modify state. |
| **impure** | May perform I/O or modify hidden state. |

Declaration: `:- impure pred P(args).` / `:- semipure pred P(args).` Every call site to an impure/semipure predicate must be flagged `impure`/`semipure` so unmarked calls always mean pure. Promises to break purity propagation: `:- pragma promise_pure(Name/Arity).` / `:- pragma promise_semipure(Name/Arity).` — the compiler cannot verify these; incorrect promises ⇒ undefined behavior.

**Why purity matters:** pure goals can be reordered/parallelized/CSE'd/memoized; impure goals are pinned to program order. This is the foundation for the compiler's aggressive clause-body reordering and code generation.

### Modules

- Modules split into an **interface** section (exports) and an **implementation** section (definitions + locals). The same `.m` file typically contains both.
- **Nested modules** are first-class. 22.01 tightened submodule visibility rules (NEWS head, compatibility-breaking).
- **Abstract data types**: a type name exported without its definition can only be manipulated by predicates in the defining module.
- Module-qualified names use the `.` separator. Separate compilation; automatic dependency recomputation via `mmake`.

### DCG notation + state variables

`Head --> Body.` desugars to a clause with two fresh appended arguments. Body forms: sequencing `,`, braced ordinary goal `{ G }`, input match `[E1, ...]`, disjunction `;`, negation `not`, conditional. **Current guidance** prefers **state-variable syntax `!IO`** for I/O threading, with DCGs reserved for parsing/sequence generation. `main(!IO)` expands to `main(IO0, IO)` and threads `IO0` through every I/O call.

### Unification

- Mercury restricts unification by mode and determinism — not every unification is legal. The compiler picks a left-to-right execution order and rejects programs that do not have one.
- **Occurs-check is on by default.** Modes cannot transform nodes from bound to free (instantiation is monotonic).
---

# The Dark Arts — Mercury's Signature Powers

Mercury uses `:-` for declarations, `pred`/`func`/`mode`/`type`/`typeclass`/`instance` keywords, `::` for mode annotations, and `!IO` DCG-pair shorthand for `io.state` arguments.

---

## 1. The mode system: uniqueness and in-place destructive update

This is Mercury's defining dark art. (Ref Man Ch. 5–6 — https://mercurylang.org/information/doc-latest/mercury_reference_manual/Modes.html, Unique-modes.html.)

### 1.1 What modes are and why they exist

A Mercury *instantiation state* (inst) describes the shape of a variable at a program point: fully bound (`ground`), an unbound variable (`free`), partially bound to a known functor skeleton (`bound`), uniquely referenced (`unique`), or dead. A *mode* is a pair `InstBefore >> InstAfter` that contracts how a predicate transforms the instantiation of each argument across a call.

Prolog's `append(L1, L2, L3)` is one predicate that the runtime supports across all nine in/out combinations at the cost of expensive trailing and no compile-time optimization. Mercury requires each predicate to declare a mode (or several), and the compiler emits a *separate procedure* per declared mode, each specialized for that direction. `append/3` typically declares three modes:

```mercury
:- pred append(list(T), list(T), list(T)).
:- mode append(in,  in,  out).      % forward: build L3 from L1, L2
:- mode append(out, out, in).       % split:   partition L3 into L1, L2
:- mode append(out, in,  in).       % suffix:  derive L1 from L2, L3
```

The compiler performs *mode analysis* (an abstract interpretation over clause bodies) and reorders conjuncts to make the data flow work; if no legal order exists, the predicate is rejected as mode-incorrect. Mode reordering is the bedrock optimization that makes Mercury emit C-speed code from a declarative source.

### 1.2 The standard modes

```mercury
:- mode in  == ground          >> ground.
:- mode out == free            >> ground.
:- mode di  == unique          >> dead.        % destructive input
:- mode ui  == unique          >> unique.      % unique input (preserved)
:- mode uo  == free            >> unique.      % unique output
:- mode mdi == mostly_unique   >> dead.        % backtrackable destructive input
:- mode mui == mostly_unique   >> mostly_unique.
:- mode muo == free            >> mostly_unique.
:- mode ndi == non_null_unique >> dead.
```

`in` and `out` carry no uniqueness information. `ui`/`di`/`uo` and their `mostly_` and `n` variants are the contract that enables in-place update.

### 1.3 `unique` and `mostly_unique`

- **`unique`**: there is provably exactly one reference to the value across the whole computation. The compiler is free to overwrite its storage.
- **`mostly_unique`**: one reference *in the forward direction*. The value may still be reachable through backtracking choice points, so any mutation must be *trailed* (recorded for undo on backtrack). Mostly unique supports `nondet` and `multi` predicates where plain `unique` does not.
- **`dead`**: the variable is no longer live after the call. Storage can be reused without trailing.

A value is *not* considered unique if it might be needed on backtracking. This is why plain `unique` modes only typecheck under `det` or `cc_multi`: every other determinism introduces a backtracking choice point that aliases the value.

### 1.4 The killer feature: in-place destructive update in pure code

`array.set` has the canonical signature:

```mercury
:- pred array.set(int, T, array(T), array(T)).
:- mode array.set(in, in, di, uo) is det.
```

`di` on the input array means "the caller hands over the sole reference; the callee may overwrite the memory." `uo` on the output means "the result is a fresh unique value." The two combine to make `array.set` *compile to a single in-place store instruction* in the C backend, despite Mercury being a pure declarative language with no `assert`/`retract`/cut/side-effects. The corresponding pure-functional version (Haskell's `Data.Array`, a `Map`) must allocate O(n) new nodes per update.

Worked example — increment slot 2 of a four-element unique array:

```mercury
:- module array_demo.
:- interface.
:- import_module io, array.
:- pred main(io::di, io::uo) is det.
:- implementation.

main(!IO) :-
    Arr0 = array.from_list([1, 2, 3, 4]),     % Arr0 : array(int), unique
    Arr1 = array.set(2, 99, Arr0),            % di/uo -> in-place store
    array.to_list(Arr1, List),
    io.print(List, !IO),                      % prints [1, 2, 99, 4]
    io.nl(!IO).
```

`Arr0` is consumed by `array.set`. Any later use of `Arr0` is a compile-time mode error. The physical array object is mutated; `Arr1` is the same memory reissued under a new unique name. This is the property that lets Mercury write imperative-style array code (CRC tables, hash tables, in-place sorts) without breaking the declarative semantics.

### 1.5 Backtrackable destructive update

When the predicate is `nondet` or `multi` and you still want destructive update, use the `mostly_` family. The mutation is *trailed*: each write pushes an undo record onto the trail, and on backtracking the runtime walks the trail to restore the old contents (same mechanism SICStus/Yap use for `mutable`/`array` libraries).

```mercury
:- pred add_if_absent(K, V, map(K, V), map(K, V)).
:- mode add_if_absent(in, in, mdi, muo) is nondet.
```

A map updated this way rolls back if the surrounding conjunction fails.

### 1.6 What counts as unique; the escape hatches

A value is `unique` if the compiler's aliasing analysis can prove no other variable, choice point, or closure captures it. The analysis is *module-aware*: across module boundaries, only the declared mode is visible. When you must give up uniqueness, the escape hatch is `unsafe_promise_unique`:

```mercury
:- func unsafe_promise_unique(T) = T.
% Caller asserts no other reference exists; lies are UB.
```

It is the Mercury equivalent of Haskell's `unsafePerformIO`: exists, sometimes necessary at FFI boundaries, every use deserves a comment.

### 1.7 Gotchas

- A predicate that consumes a `unique` argument must not be reachable in a mode that hands it a non-unique one. The compiler catches this.
- Higher-order terms always lose precise alias information; currying a unique value into a closure typically drops uniqueness unless the closure inst is itself unique and consumed.
- I/O state (`io.state`) is the only value the runtime treats as unique-by-default. Everything else requires explicit `di`/`uo` plumbing.
- The mode-system learning curve is the single most cited reason newcomers bounce off Mercury. Even simple programs produce mode errors that require understanding instantiation flow to fix.

> **Domain expansion: unique modes.** This is the move no other declarative language has clean. Prolog can't (no uniqueness tracking → destructive update breaks the declarative semantics). Haskell can only via `ST`/`IO` (you leave pure code). Mercury's mode system makes `di`/`uo` a *compile-time proof* that the caller holds the sole reference, so overwriting the storage is semantically equivalent to returning a new value — and the C backend exploits that proof to emit one store instruction. You write declarative array code at imperative speed. That is the whole reason Mercury exists.

---

## 2. Determinism in depth

Ref Man Ch. 7. The lattice (from §Core Concepts):

```
              erroneous
              /        \
          failure       det
            \          /   \
           semidet      multi
                \       /
                 nondet
```

### 2.1 How the compiler proves determinism

Determinism inference walks the goal structure:

- **Unification** `X = Y`: `det` if both bound to known functors and they unify, or either is free (assignment); `semidet` if both are bound to possibly-distinct values.
- **Conjunction** `G1, G2`: can fail if either can; multiple solutions if either does. Determinism is the meet in the lattice.
- **Disjunction** `G1 ; G2`: cannot fail if no arm fails; multiple solutions if any arm does. A *switch* is a disjunction where each arm tests the same variable against a distinct function symbol; if it covers all functors of the type it is `det`, otherwise `cc_nondet` or `nondet`.
- **If-then-else** `( Cond -> Then ; Else )`: if `Cond` is `semidet`, the whole construct is `det` (or the determinism of `Then`/`Else`); if `Cond` can produce multiple solutions, only the first is kept — the rest are pruned silently (the most common determinism surprise).
- **Negation** `not G`: `det` if `G` is `semidet`; `semidet` if `G` is `det`.

A predicate's *declared* determinism must be at least as permissive as the *inferred* one. Declaring tighter than the compiler can prove is a compile-time error.

### 2.2 `solutions/2` and `solutions_set/2`

`solutions/2` is Mercury's analogue of Prolog's `bagof/3` and Haskell's list monad. It collects every solution of a nondet goal into a list and yields `det`:

```mercury
:- pred solutions(pred(T), list(T)).
:- mode solutions(pred(out) is nondet, out) is det.
```

The first argument is a higher-order predicate encoding the goal whose solutions you want:

```mercury
solutions((pred(N::out) is nondet :- member(N, [1,2,3,4])), Ns),
% Ns = [1,2,3,4] (order unspecified; use list.sort if you care)
```

`solutions_set/2` returns solutions sorted and deduplicated; `solutions_accumulate/2` streams large answer sets into a user-supplied accumulator. **Ordering note:** `solutions/2` does not preserve goal production order; the implementation uses a difference-list accumulator that reverses at the end.

### 2.3 `cc_multi` and `promise_equivalent_solutions`

`cc_multi` is for predicates that *could* produce multiple answers but whose later answers are equivalent to the first, or whose search you do not want to expose. `promise_equivalent_solutions` is the escape hatch:

```mercury
:- promise_equivalent_solutions [X] ( multi_pred(X) ).
```

After this declaration `multi_pred` can be called from a `det` context. Common uses: iterating over a `map`/`set` in one consumption order; `io.read`-style stream operations that should commit; predicates threading a `unique` argument (which forces commitment because the value cannot be replayed on backtracking).

Every `promise_*` is a critical assertion the compiler cannot check. Lies produce silent miscompilation.

---

## 3. Purity and reordering

Purity propagates upward: a predicate calling an impure predicate is itself impure unless explicitly promised pure. The compiler refuses to call impure predicates from pure contexts.

```mercury
:- impure pred unsafe_perform_io(io.state::di, io.state::uo).
:- semipure func current_time() = time.time.

% call sites must also be marked:
impure unsafe_perform_io(!IO),
SemipureNow = semipure current_time,
```

The redundancy (marking both declaration and call) is deliberate; it stops impurity from sneaking into a pure refactor. In practice, every `pragma foreign_proc` wrapping a genuinely pure C function carries `[promise_pure]`, because the default for foreign code is `impure`.

Mercury exposes a `trace/2` (stdlib `io.trace`) for inserting impure debug output into otherwise pure code — it writes to stderr without threading `io.state`, so you can use it inside a `det` predicate mid-pipeline. Every `trace` call is impure; production code removes them. `mdb` (§Debugging) is the better tool because it requires no source edits.
---

## 4. Higher-order

Mercury's higher-order types spell out argument types, modes, and determinism. A higher-order predicate type is `pred(T1, T2, ...)`; a higher-order function type is `func(T1, T2, ...) = Tresult`. The *inst* of a higher-order value additionally specifies the modes and determinism of each argument:

```mercury
:- inst map_pred  == (pred(in, in, out) is det).
:- inst map_func == (func(in, in) = out is det).
```

A predicate argument can then require that inst:

```mercury
:- pred list.map(pred(T1, T2), list(T1), list(T2)).
:- mode list.map(in(map_pred), in, out) is det.
```

This is the only way the compiler can mode-check a higher-order call: it must know the argument modes and determinism at the type level.

### Lambdas, currying, application

```mercury
Sum    = (pred(List::in, Total::out) is det :- list.foldl(plus, List, 0, Total)),
Square = (func(X::in) = (Y::out) is det :- Y = X * X),

Double  = plus(2),                   % currying; Double : func(int) = int
Sum123  = list.foldl(plus, [1,2,3]), % Sum123 : pred(int,int) is det

call(Sum123, Init, Final),
Result = Double(7),                  % function-style application
```

Builtin predicates (`=`, `\=`, `call`) cannot be curried directly; wrap them in a lambda. `pred` vs `func`: a `func` has exactly one output and `det` determinism by default; a `pred` can have any determinism and any number of outputs. `func` is sugar for `pred` with the result appended as a final `out` argument, plus function-application syntax.

**Gotcha:** a lambda capturing a unique variable drops uniqueness; the closure inst must itself be unique and consumed. The `with_inst` shorthand factors out verbose insts:

```mercury
:- inst map_pred == (pred(in, in, out) is det).
:- mode map(in) `with_inst` map_pred.
```

---

## 5. Typeclasses

Ref Man Ch. 11 — https://mercurylang.org/information/doc-latest/mercury_reference_manual/Type-classes.html. Foundational paper: Jeffery, Henderson, Somogyi, "Type classes in Mercury" (1998).

### Declaration and instance

```mercury
:- typeclass point(T) where [
    pred coords(T, float, float),
    mode coords(in, out, out) is det,
    func translate(T, float, float) = T
].

:- instance point(complex) where [
    ( coords(Z, X, Y) :- complex_parts(Z, X, Y) ),
    translate(Z, DX, DY) = complex_make(Re + DX, Im + DY)
].
```

Methods can be `pred` or `func`; mode and determinism must be explicit, never inferred. Methods may take or return values of the type parameter.

### Multi-parameter, superclasses, functional dependencies, overlap

- **Multi-parameter typeclasses** allowed: `:- typeclass collection(C, T) where [...]`.
- **Superclass constraints**: `:- typeclass ordered(T) <= comparable(T) where [...]`.
- **Functional dependencies**: `(Domain -> Range)` syntax enforces that the domain arguments uniquely determine the range arguments, enabling "improvement" during type inference. *(Stream research initially disagreed on whether Mercury has fundeps; the Language Reference Manual documents the `(Domain -> Range)` syntax, so it does.)*
- **Per-method mode and determinism declarations are required** — the major delta from Haskell.
- **Instance overlap is strictly prohibited** — no `OVERLAPPING` pragma. At most one instance applies to any given type (or sequence of types for multi-parameter classes). Overlap is a compile-time error, not a resolution preference.

| Aspect | Mercury | Haskell |
|---|---|---|
| Method modes | Required | Absent |
| Method determinism | Explicit (`is det` etc.) | N/A |
| Method definition | Inline clauses or named-binding | Type signatures only |
| Instance overlap | Strictly prohibited | Controlled via extensions |
| Multi-parameter | Yes | Yes (extension) |
| Functional dependencies | Yes (`(Domain -> Range)`) | Yes |

22.01 change: the `enum/1` typeclass's `from_int` method changed from a semidet function to a semidet predicate of arity two (breaking); the new `uenum` typeclass was added; `sparse_bitset`/`fat_sparse_bitset`/`tree_bitset` now require `uenum`, not `enum`.

Marker typeclasses (no methods) are allowed: `:- typeclass serializable(T) where [].` — existence of an instance is the proof.

---

## 6. The foreign language interface (`pragma foreign_proc`)

Ref Man Ch. 16 — https://mercurylang.org/information/doc-release/mercury_ref/pragma-foreign_005fproc.html.

```mercury
:- pragma foreign_proc("Lang",
    Pred(Var1::Mode1, Var2::Mode2, ...),
    Attributes, Foreign_Code).

:- pragma foreign_proc("Lang",
    Func(Var1::Mode1, ...) = (Var::Mode),
    Attributes, Foreign_Code).
```

`"Lang"` is `"C"`, `"C#"` (or `"csharp"`), `"Java"`, or historically `"Erlang"` (dropped 22.01).

### Attributes

| Attribute | Meaning |
|---|---|
| `promise_pure` | Foreign code is pure; allows placement in pure contexts |
| `promise_semipure` | Reads but does not write external state |
| `may_call_mercury` | May invoke Mercury recursively |
| `will_not_call_mercury` | **Default.** Will not call back into Mercury. Enables a faster calling convention. Behaviour is undefined if the foreign code *does* call back — trail/GC corruption, usually silent until the next GC. |
| `thread_safe` / `not_thread_safe` | Concurrency contract |
| `wont_leak_memory` | Asserts no allocation escapes; lets the GC skip bookkeeping |
| `terminates` / `does_not_terminate` | Helps the termination analyzer |

`will_not_call_mercury` is the default and the fast path; **lying about it is the corruption footgun** — the GC, the trail, and the signal handler all expect a stable Mercury stack.

### Worked C interop

The canonical sample (https://github.com/Mercury-Language/mercury/blob/master/samples/c_interface/short_example.m):

```mercury
:- module short_example.
:- interface.
:- import_module io.
:- pred main(io::di, io::uo) is det.
:- implementation.

:- pred puts(string::in, io::di, io::uo) is det.

:- pragma foreign_decl("C", "#include <stdio.h>").
:- pragma foreign_proc("C",
    puts(S::in, Old_IO::di, New_IO::uo),
    [promise_pure, will_not_call_mercury],
"
    puts(S);
    New_IO = Old_IO;
").

main(!IO) :-
    puts("Hello, world", !IO).
```

Two details: (1) `pragma foreign_decl("C", ...)` injects a declaration (`#include`) into the generated C file before any `foreign_proc` body; (2) the `Old_IO`/`New_IO` pair threads `io.state` through the foreign call so the impure `puts` lives inside the linear-IO discipline. Assigning `New_IO = Old_IO` reissues the token without compiler complaint.

### Foreign types, import_module, export

```mercury
:- pragma foreign_type("C", fd, "int").            % Mercury type `fd`, C repr `int`
:- pragma foreign_type("Java", socket, "java.net.Socket").
:- pragma foreign_import_module("C", "foo.h").     % header available to subsequent foreign_proc bodies
:- pragma foreign_decl("C", "...").                % top-level declarations/includes
:- pragma foreign_code("C", "...").                % verbatim top-level C definitions
:- pragma foreign_export("C", foo(in, in, out), "FOO").  % generate C function FOO that calls foo
```

`samples/c_interface/` ships `c_calls_mercury`, `mercury_calls_c`, `mercury_calls_cplusplus`, `mercury_calls_fortran`, `cplusplus_calls_mercury`.

### Gotchas

- A `foreign_proc` **cannot** be `multi` or `nondet` — a foreign predicate with multiple logical solutions must be written as Mercury clauses calling deterministic foreign helpers.
- Foreign types are **not** garbage-collected by Mercury; the foreign side owns their lifetime or you register a finalizer.
- The Java and C# backends are noticeably less complete than C; `minimal_model` tabling is C-only.

---

## 7. Tabling

Ref Man — https://mercurylang.org/information/doc-release/mercury_ref/Tabled-evaluation.html. Three pragmas:

```mercury
:- pragma loop_check(Name/Arity).     % detect infinite recursion; no memoization
:- pragma memo(Name/Arity).           % full memoization + loop check
:- pragma minimal_model(Name/Arity).  % SLG-style; perfect-model semantics
```

- **`loop_check`**: the memo table maps inputs to "active"; a repeat hit raises an exception. No memoization of results.
- **`memo`**: maps inputs to computed outputs (or "in progress"); repeat calls return the cached result.
- **`minimal_model`**: apparent infinite recursion is not fatal; the engine explores alternative paths and produces answers consistent with the *perfect model* semantics — any call not true in all models is false. (XSB's SLG-WAM does the same in Prolog land.)

Per-mode versions and attributes:

```mercury
:- pragma memo(path(in, in, out)).
:- pragma memo(path(in, in, in, out), [allow_reset, statistics, fast_loose]).
```

| Attribute | Effect |
|---|---|
| `allow_reset` | Generates `table_reset_for_<name>_<arity>_<mode>` to clear the table |
| `statistics` | Generates `table_statistics_for_<name>_<arity>` for instrumentation |
| `fast_loose` | Looks up arguments by address rather than value (O(args) hash) |
| `specified([A1, ...])` | Per-argument control: `value`, `addr`, `promise_implied`, `output` |

Designed by Somogyi and Sagonas (PADL 2006, "Tabling in Mercury: design and implementation"). `minimal_model` corresponds to SLGd resolution from Sagonas's PhD thesis. The combination with `unique` modes does **not** work: tabled predicates cannot consume `unique` arguments (you cannot memo a value you destroyed).

**Tabling is C-backend only.** Java, C#, (and the dropped Erlang) backends raise a compile-time error.

> **Domain expansion: the mode + determinism system.** Most logic-language tutorials stop at "search works." The two systems that make Mercury production-grade are *not* search itself. The determinism lattice means the compiler refuses to ship a predicate whose determinism it cannot prove, so a 50k-line Mercury program can be refactored without silently introducing a new solution or losing one. The mode system means every predicate declares how it transforms each argument's instantiation, so the compiler specializes a separate procedure per call direction and proves destructive update safe. Together they buy you something neither Prolog nor plain Haskell has: declarative code that the optimizer can treat as imperative, verified at compile time.

---

## 8. Solver types (experimental)

Ref Man Ch. 18 — https://mercurylang.org/information/doc-latest/mercury_reference_manual/Solver-types.html. Foundational paper: Becket et al., "Adding constraint solving to Mercury" (PADL 2006).

A variable of a solver type may be in inst `free`, `ground`, or **`any`** — `any` = "may not be semantically ground." The `any` inst is the foundation: a variable is `ground` if all values it unifies with also unify with each other; otherwise `any`.

```mercury
:- solver type t1.                % abstract
:- solver type t2(T1, T2).        % abstract, polymorphic
```

A full definition specifies: the representation type, the ground/any insts, the constraint store (mutable state, generally foreign/impure, must be trailed for backtracking), and optional equality/comparison predicates. Modes `ia == in(any)` and `oa == out(any)` are the standard modes for solver-typed arguments. **Maturity: experimental**, depends on the trailed grade (`.tr`), used in research; not in the mainstream stdlib path.

---

## 9. The `mdb` debugger

User's Guide Ch. 9 — https://mercurylang.org/information/doc-latest/mercury_user_guide/Debugging.html. `mdb` is a source-level, *declarative-aware* tracer built on top of the **trace grade**. Compile with `mmc --debug hello.m` (or grade `.debug`); `--trace deep` for full events.

`mdb` differs from a Prolog tracer in two ways:
1. It understands **modes** — each event records the instantiation state of every variable, not just its binding.
2. It understands **determinism** — `retry` can replay a call from its entry port because the trace records enough state to reconstruct the entry conditions, including which mode was selected.

### Everyday commands

| Command | Action |
|---|---|
| `forward`, `f` | step to next event (any port) |
| `finish` | run until the current procedure exits |
| `retry` | restart the current call from its entry port |
| `goto N` | jump to event number N |
| `print Var`, `p Var` | print a variable (respecting its current inst) |
| `dump` | dump all live variables and their insts |
| `browse Var` | open the term browser on a variable |
| `stack`, `st` | show the call stack |
| `break Name/Arity` | set a breakpoint |
| `dd` | start the declarative debugger |

### Declarative debugging (`dd`)

Rather than stepping through ports, `dd` asks "is this answer correct?" for selected procedure calls; each answer builds an oracle; the engine algorithmically isolates the earliest call whose answer is wrong (the bug). Search strategies: `top_down`, `divide_and_query` (bisection), `suspicion_divide_and_query`. Trust system: `trust Module` / `trust Name/Arity` marks code as correct; the stdlib is trusted by default. Combined with `retry`: isolate a wrong call declaratively, retry to its entry, step imperatively until you see the wrong branch.

The "Idempotent I/O for safe time travel" use case (Somogyi, AADEBUG 2003): `retry` can transparently replay across I/O because each I/O action is recorded.

---

## 10. Profiling

- **`mprof`** — flat and call-graph time/memory profiler (modelled on Unix `gprof`). Compile with the profiling grade (`--profiling` or `.prof time`/`.prof memory`); run; `mprof` consumes `Prof.*` data.
- **`mdprof`** (the `d` matters) — the **deep profiler**. Associates call site, caller chain, and mode per measurement. Output is a static HTML site, one page per predicate, hyperlinked by call graph. Compile with the deep-profiling grade; runtime writes `*.Deep.data`; `mdprof` renders. Higher overhead than `mprof` (often 2–5x).
- **Coverage** — `--branch-analysis` and `mcov`; per-predicate and per-clause output, suitable for CI gates.

---

## 11. Stdlib tour + the `io.state` discipline

Stdlib reference: https://mercurylang.org/information/doc-release/mercury_lib/. The modules worth knowing cold:

| Module | Purpose |
|---|---|
| `io` | `io.state`, file I/O, stdio — the linear-token model; everything threads `!IO` |
| `list` | singly-linked list; `map`, `filter`, `foldl`, `solutions` |
| `map` | balanced (AVL) search tree; functional, immutable, O(log n) |
| `set` / `intset` / `intmap` | ordered set / integer-keyed variants (faster) |
| `string` | `format`, `append`, `split`, `to_int` |
| `array` | **destructive-update mutable array** — the di/uo structure, O(1) random access |
| `bt_array` | backtracking array — mdi/muo, trailed writes |
| `random` | state-threaded; `random.state::di, random.state::uo` |
| `time` | wall clock, formatting |
| `solutions` | `bagof` equivalent — `solutions/2`, `solutions_set/2` |
| `term` | generic term type, for meta-programming |
| `bitmap`, `queue`, `stack`, `multimap`, `cord` | containers |
| `parser` | combinators (see `samples/calculator.m`) |
| `cps`, `lazy` | continuation utilities, lazy evaluation |

### The `io.state` discipline

Mercury's I/O is the pure-functional discipline carried to its logical end: there is no global stdout, no implicit cursor. Every I/O operation takes an `io.state` in mode `di` and returns one in mode `uo`. The token is the uniqueness witness that proves no other code is reading or writing the same stream concurrently.

`main` is the only predicate the runtime calls; its signature is fixed:

```mercury
:- pred main(io::di, io::uo) is det.

main(!IO) :-
    io.write_string("Hello, world\n", !IO).
```

The `!IO` shorthand expands `main(!IO)` to `main(IO0, IO)` and threads `IO0` into the first I/O call, the result into the next, and so on. Any predicate that performs I/O must thread the same pair; there is no way around the type system. Use `array` when the element count is known up front, the access pattern is random or hot, and you can manage `di`/`uo` plumbing. Use `bt_array` for backtracking-aware mutation; `list`/`queue` for append-friendly sequential access; `map`/`set` for keyed lookup.
---

# Changelog Timeline

Sources: https://mercurylang.org/news.html, repo [RELEASE_NOTES](https://github.com/Mercury-Language/mercury/blob/master/RELEASE_NOTES) + [NEWS.md](https://github.com/Mercury-Language/mercury/blob/master/NEWS.md), tags (`gh api repos/Mercury-Language/mercury/tags`), [dl.mercurylang.org](http://dl.mercurylang.org/index.html). The GitHub repo has **no GitHub Releases** — releases are tag-driven and announced on the website.

Tag scheme (`gh api .../tags`): `version-YY_MM[_patch]` with underscores — `version-22_01_8`, `version-22_01_7`, …, `version-22_01`, `version-20_06_1`, `version-20_06`, `version-20_01`, `version-14_01`, `version-13_05`, `version-11_07`, `version-10_04`, … Calendar-versioned `YY.MM` since Feb 2010.

### Most recent stable releases

| Version | Date | Headline |
|---|---|---|
| **22.01.8** (current stable) | 2023-09-17 | Reverted a change that broke `mmake`; increased C stack size on 64-bit Cygwin. |
| 22.01.7 | 2023-07-30 | GCC 13 compilation fixes; MSVC compat; MSYS2 UCRT64 macro conflicts; mdb doc gen on Windows. |
| 22.01.6 | 2023-05-10 | `digraph` transitive closure repair; `string.format` int8/16/32 sign extension; intermodule-optimization library search. |
| 22.01.5 | 2022-12-31 | MLDS backend crash fixes; termination-analysis compiler abort; fact-table file names; transitive intermodule-optimization interfaces. |
| 22.01.4 / 22.01.3 / 22.01.2 / 22.01.1 | 2022 | Bug-fix releases. 22.01.3 disabled GCC optimizations causing segfaults in `asm_fast` grades; 22.01.2 disabled `asm_fast*` on AArch64/GCC 9+. |
| **22.01** | 2022-03-31 | **Major:** subtypes + `coerce/1`; field names need not be module-unique; `random.system_rng` (cryptographic RNG); sized integers `i8…u64`; lexer/parser modules renamed `mercury_term_lexer`/`mercury_term_parser`; **dropped** Alpha arch, macOS ≤10.8, **Erlang backend**; **ported** to Linux AArch64; `--output-stdlib-grades`, `--warn-potentially-ambiguous-pragma`; better interface-file semantic validation. |
| 20.06 / 20.06.1 | 2020 | Major + patch. |
| 20.01 / 20.01.1 / 20.01.2 | 2020 | Major + patches. |
| 14.01 / 13.05 / 12.08 / 11.07 / 11.01 / 10.04 | 2010-2014 | Prior majors; 10.04 (April 2010) was the first calendar-versioned major. |

### ROTD (Release Of The Day)

Nightly snapshots at http://dl.mercurylang.org/index.html, format `mercury-srcdist-rotd-YYYY-MM-DD.tar.gz` (and `.tar.xz`) plus `.sha512`. Latest verified 2026-07-28: `rotd-2026-07-28` (commit `f8b79a784ea4420e1305d8efbb000ee7af1b209a`). Latest beta: `mercury-srcdist-22.01.9-beta-2026-07-13.tar.gz`.

### Notable post-22.01 in-progress changes (NEWS.md head — will become 22.01.9 / next major)

- **Compatibility-breaking:** submodule visibility rules tightened; `term_io.read_term/*` removed; argument-order swaps in `injection`, `bt_array.resize/shrink`, `ranges.nondet_member`; **operator priorities inverted** (higher number = binds tighter; priorities are no longer plain integers; `op_table` typeclass reworked); `enum/1`'s `from_int` is now a semidet predicate of arity 2; sparse_bitset family requires `uenum`.
- New tokens `<<u` / `>>u` for unsigned shift (existing code with `<<u`/`>>u` adjacent tokens parses differently).
- `io` module reorganization; many predicates marked obsolete, older obsoletes removed. Old random module removed; `mercury_term_parser` expects the new `ops` table; old modules preserved in `extras/old_library_modules/`.
- Cygwin x86 (32-bit) dropped; MSVC <19.3 (pre-VS2022) dropped.
- `mmc --make name.cs` meaning changed (now: build the `.cs` file of one named module; was: build all `.c` files of a program — use `program.all_cs` for the old meaning).
- Concurrency disabled in non-parallel low-level C grades.
- `clock_t` now abstract with `int64` underlying representation.
- Stdlib additions: huge `array` API for unsigned indexing (`uinit`, `ulookup`, `uset`, `umin`, `umax`, `ubounds`, `usize`, `uresize`, `ushrink`, `fill_urange`); `bitmap` byte IO + range IO; `benchmarking.report_stats/N` with full memory stats; `calendar.date_time/0` type rename; `char.to_uint/from_uint`.

---

# Open Issues and PR Discussion Notes

`gh issue list --repo Mercury-Language/mercury --limit 50 --state open` returns only **13 open issues** — the primary tracker is `bugs.mercurylang.org`, not GitHub Issues.

### Open issues (high-signal)

| # | Date | Title | URL |
|---|---|---|---|
| 136 | 2025-05-14 | Does Mercury compiler work on Apple Silicon Macs? | https://github.com/Mercury-Language/mercury/issues/136 |
| 129 | 2024-02-21 | macOS build segfaults on 10.6.8 (only x86_64) | https://github.com/Mercury-Language/mercury/issues/129 |
| 128 | 2024-02-20 | Does it matter if a bootstrap C compiler supports C11? | https://github.com/Mercury-Language/mercury/issues/128 |
| 124 | 2023-07-18 | `__syscall` hlc.par.gc link failure on OpenBSD | https://github.com/Mercury-Language/mercury/issues/124 |
| 110 | 2023-02-13 | `_MR_atomic_sub_int` symbol not found on macOS | https://github.com/Mercury-Language/mercury/issues/110 |
| 97 | 2021-07-14 | gcc labels configure test spins forever on armv7/aarch64 | https://github.com/Mercury-Language/mercury/issues/97 |
| 96 | 2021-07-13 | Tests failing on musl/Alpine Linux | https://github.com/Mercury-Language/mercury/issues/96 |
| 74 | 2019-09-16 | Mode error in semidet list pattern matching without intermediate variable | https://github.com/Mercury-Language/mercury/issues/74 |
| 42 | 2018-09-24 | **It's needed some tutorial** (long-standing) | https://github.com/Mercury-Language/mercury/issues/42 |
| 36 | 2015-10-12 | Eta-equivalence violation in curried argument to `solutions()` | https://github.com/Mercury-Language/mercury/issues/36 |

**Recurring themes:** portability on modern non-x86 hardware (Apple Silicon open; AArch64-Linux shipped in 22.01 but armv7/aarch64 GCC labels and musl remain); macOS runtime symbols; documentation/tutorial gaps (the long-standing #42); minor mode-system corner cases.

### Recent PRs (last ~24 months)

| # | Date | State | Title |
|---|---|---|---|
| 152 | 2026-05-22 | OPEN | Fix bugs in Dockerfile: undefined variables and typo |
| 151/150/149/148 | 2026-05-22 | MERGED | Stale URLs, "OS X"→"macOS", runtime error typos, compiler typos |
| 146 | 2026-05-02 | OPEN | Update C# grade to .NET 10 |
| 145 | 2026-04-27 | CLOSED | Fix `uint64.to_int/2`/`uint32.to_int/2` on LLP64 |
| 144 | 2026-04-27 | DRAFT | **Revive the hlc.agc (accurate GC) grade** |
| 143 | 2026-04-24 | CLOSED | Support targeting Windows on ARM64 with MSVC |
| 141 | 2026-03-13 | MERGED | Fix `integer.mul_by_digit` producing denormalized zeros |
| 140 | 2026-03-11 | MERGED | Fix `strrchr` for C23 |
| 139 | 2025-09-21 | OPEN | Java compiler: output generic types for inherited classes |
| 138 | 2025-07-26 | MERGED | Add `pqueue.map_values` |
| 114 | 2023-02-13 | OPEN | Use C11 stdatomics.h |

**Themes:** the 2026 active lane is portability + low-level runtime hygiene (C23 `strrchr`, ARM64 MSVC, LLP64 int conversions, .NET 10). hlc.agc (accurate GC) is being revived after years dormant (#144). The bigger compiler-internals work happens on the in-house git server and lands via `zsomogyi`/`juliensf`/`wangp` direct pushes, not PRs.
---

# Community and Adoption

### Where Mercury is actually used (verifiable production deployments)

- **PrinceXML / Prince** (https://www.princexml.com/, YesLogic Pty Ltd, Melbourne) — HTML/CSS→PDF formatter. **The single most cited commercial Mercury deployment.** YesLogic engineer confirmed on HN (https://news.ycombinator.com/item?id=18404337): *"We use Mercury at YesLogic to write Prince, our HTML to PDF formatter! We chose it because logic/functional languages are great for tree processing."* Modern Prince uses Rust for the font shaping engine and Mercury for the rest.
- **Bower email client** (https://github.com/wangp/bower) — a curses front-end for Notmuch, written in Mercury by `wangp` (one of the active maintainers). Packaged in Gentoo as `mail-client/bower`. Daily-driver.
- **The Mercury compiler itself** (https://github.com/Mercury-Language/mercury) — bootstrap-written in Mercury. The dogfooding case study.
- **ODASE** (Ontology-Driven Adaptive Software Engineering) — a company whose ontology-centric development platform uses Mercury as the underlying engine (Wikipedia).
- **MCORBA** — a CORBA binding for Mercury (Jeffery, Dowd, Somogyi, PADL'99).

The academic anchor is the University of Melbourne, where the language originated and where Somogyi taught it (course codes 433-247/257/316, late 1990s–2000s). External courses that have used Mercury: Kyle Dewey's COMP 410 at CSUN (https://kyledewey.github.io/comp410-spring18/lecture/week_13/modes_and_mercury_handout.pdf).

### The mailing lists (the primary support venue)

`mercury-users` and `mercury-developers`, archived as hypermail at https://lists.mercurylang.org. Archive URL pattern: `mercury.csse.unimelb.edu.au/mailing-lists/mercury-users/mercury-users.YYMM/NNNN.html`. Traffic is low (a handful of posts per month, bursts on new releases). High-value recurring thread topics:

- *"Performance of Mercury vs. SWI-Prolog"* (recurring) — bignum arithmetic is a known footgun.
- *"Mercury vs Haskell"* — usually conclude Mercury's edge is the mode system + multi-solution search; Haskell wins on libraries/ecosystem.
- *"Mode system confusion"* — the most common beginner complaint; most resolve with "go read the book."
- *"Job / employer"* — rare. Consistent answers: YesLogic, ODASE, Melbourne academic positions.
- Release-announcement threads (every rotd) — best place to track what actually changed.

### Stack Overflow / Reddit / HN / Lobsters

- Stack Overflow `mercury-language` tag: low traffic (a few hundred questions total); not a primary venue. Representative: compile-for-debugging (https://stackoverflow.com/questions/26916819), nondet-in-det / `solutions/2` (https://stackoverflow.com/questions/56230946), Curry/Mercury/λ-Prolog comparison (https://stackoverflow.com/questions/2951407).
- r/mercury: very low traffic, mostly build-error troubleshooting.
- HN threads: https://news.ycombinator.com/item?id=26598959 (2021, the most thorough recent thread, PrinceXML engineers present); https://news.ycombinator.com/item?id=19631919 (2019, syntax similarity to Prolog).
- Lobsters (https://lobste.rs/s/dtyeko/mercury_programming_language): criticizes syntax verbosity vs Haskell.

> **Disambiguation trap:** "Mercury" the fintech company (founded by Immad Akhroudh, uses Haskell) is unrelated to Mercury the language. The Serokell interview "Haskell in Mercury" (https://serokell.io/blog/haskell-mercury-functionalfutures) is about the fintech, not the language. Flag and exclude from any adoption read.

### Why Mercury never went mainstream

- **Steep mode-system learning curve.** Newcomers bounce off mode errors that require understanding instantiation flow to fix. HN consensus calls the official crash course "impenetrable"; the 2024-25 community crash course at https://mercury-in.space/crash.html was written specifically to address this.
- **Single implementation.** One compiler, maintained by a small Melbourne-centered team. No competing implementations, no benchmarking pressure from rivals.
- **Small ecosystem.** No analogue of SWI-Prolog's RDF/Pengines/http/PlDoc stack. No first-party package manager until **Merchant** (https://github.com/stewy33/merchant) appeared as a third-party tool.
- **C-centric implementation.** The Java and C# backends are less complete; tabling is C-only. The "Mercury on the JVM" story is weak.
- **Niche application domain.** Sweet spot is large symbolic programs (compilers, formatters, constraint solvers). Most shops needing that reach for OCaml or Haskell because the libraries are richer.
- **Lack of corporate backing** comparable to Haskell's Facebook/Standard Chartered or Erlang's Ericsson.

What keeps it alive: YesLogic's ongoing commercial use of Prince, the Melbourne research line (parallelism papers into 2012, deep-profiling papers into 2005, the rotd snapshot cadence through 2026), and a small persistent community that values the mode system's guarantees.

---

# Competitive Landscape

### Mercury vs Prolog (SWI, SICStus, Scryer)

| Axis | Mercury | Prolog (SWI) |
|---|---|---|
| Type system | Strongly typed, polymorphic, HM | Untyped (dynamic) |
| Mode system | Required, compile-time | None |
| Determinism | Required, statically checked | None |
| Side effects | None in pure code; I/O via linear `io.state` | `assert`, `retract`, cut, side-effecting builtins |
| Performance | Compiles to C, often 5–20x faster on tight loops | Interpreted/WAM, much slower |
| Destructive update | Yes, via `unique` modes (in pure code) | Limited (mutable records, trailed) |
| Ecosystem | Small (PrinceXML, Bower) | Huge (RDF/SPARQL, Pengines, http, PlDoc, SWISH) |
| Learning curve | Steep (modes, determinism) | Moderate |
| Tabling | Yes (`memo`, `minimal_model`) — C only | Yes (XSB-derived, since 8.x) |

Reach for Mercury when you want logic-programming search with a real type system, native-code performance, and you can tolerate a small library ecosystem. Reach for SWI-Prolog when you want RDF, knowledge-graph work, HTTP servers, or interactive web tools (SWISH), or when you need libraries.

### Mercury vs Haskell ("logic Haskell")

| Axis | Mercury | Haskell |
|---|---|---|
| Paradigm | Logic + functional (relations, multiple solutions) | Purely functional |
| Search | Built-in, first-class (`nondet` predicates) | Not built-in (use list monad, `logicT`) |
| Mode system | Yes (defining feature) | No |
| Destructive update | Pure, via `unique` modes | Via `ST` monad or `IO` |
| Laziness | Strict | Lazy |
| Syntax | Prolog-shaped (`pred`, `:-`) | ML-shaped |
| Tooling | mmc, mdb, mprof | GHC, GHCid, HLS, Hackage, Stackage |
| Industry use | PrinceXML, Bower | Facebook, Standard Chartered, many |

Reach for Mercury when you need backtracking search over typed relations where the mode system can specialize hot paths. Reach for Haskell for everything else, including pure-functional pipelines with no logic component.

### Mercury vs Flix, Curry

- **Flix** (https://flix.dev/, 2016+): modern typed hybrid — first-class Datalog constraints inside a strict ML/Haskell-like functional core, JVM target. Reach for Flix when you want Datalog-as-data and JVM interop. Reach for Mercury when you need destructive update in pure declarative code, or when the JVM is a non-starter.
- **Curry** (https://www.curry-lang.org/): the other typed functional-logic language. Haskell-shaped syntax; modes and determinism inferred (not required). Reach for Curry if you want Haskell-shaped syntax with logic programming and the mode system feels like too much friction.

### When to pick Mercury

Strong case: writing a compiler, formatter, or symbolic reasoner where typed relations are the natural data model; need backtracking search and find Prolog's lack of types painful; need native-code performance past the SWI/WAM ceiling; need destructive update of arrays in code you want to keep pure.

Strong case against: need RDF, SPARQL, Pengines, or SWI's library ecosystem; need a large hiring pool; want a stdlib that ships its own HTTP server, JSON codec, async runtime; the mode system is more ceremony than your project warrants.

---

# Tutorials and Papers Inventory

### Tutorials (freshness marked)

- **The Mercury Tutorial / book** (https://mercurylang.org/documentation/papers/book.pdf) — canonical long-form tutorial by Ralph Becket, labeled "still under development." Slow-paced. Maintained within the rotd cycle.
- **Mercury Crash Course** (https://mercury-in.space/crash.html) — community, dense, example-driven, modern (2024+). **Best entry point** for programmers already fluent in Haskell/OCaml.
- **Learn X in Y Minutes: Mercury** (https://learnxinyminutes.com/mercury/) — one-page syntax tour; useful cheat sheet.
- **Güdemann introduction** (https://guedemann.org/articles/mercury-intro-curry-club.html) — Curry Club intro, intermediate depth, good on modes/uniqueness.
- **Güdemann FFI article** (https://guedemann.org/articles/May-09-2015.html) — the best standalone treatment of `pragma foreign_proc`.
- **Kyle Dewey COMP 410 handout** (https://kyledewey.github.io/comp410-spring18/lecture/week_13/modes_and_mercury_handout.pdf) — university lecture notes on modes/determinism.

### The papers (selected, 1987–2024; all at https://mercurylang.org/documentation/papers.html)

**Foundational**
- Somogyi, Henderson, Conway. *Mercury, an efficient purely declarative logic programming language.* ACSC 1995.
- Somogyi, Henderson, Conway. *The execution algorithm of Mercury.* J. Logic Programming 29(1-3):17-64, 1996. (556+ citations — https://www.sciencedirect.com/science/article/pii/S0743106696000684.)
- Henderson, Somogyi, Conway. *Determinism analysis in the Mercury compiler.* ACSC 1996.
- Henderson, Somogyi. *Compiling Mercury to high-level C code.* CC 2002.

**Modes and types**
- Somogyi. *A system of precise modes for logic programs.* ICLP 1987 (predates Mercury).
- Overton. *Precise and expressive mode systems.* PhD thesis, Melbourne, 2003 (the modern mode system incl. uniqueness).
- Overton, Somogyi, Stuckey. *Constraint-based mode analysis.* PPDP 2002.
- Jeffery, Henderson, Somogyi. *Type classes in Mercury.* Tech Report 98/13.

**Tabling**
- Somogyi, Sagonas. *Tabling in Mercury: design and implementation.* PADL 2006.
- Somogyi, Sagonas. *Minimal model tabling in Mercury.* CICLOPS 2005.

**Debugging**
- MacLarty, Somogyi, Brown. *Divide-and-query and subterm dependency tracking.* AADEBUG 2005.
- Somogyi. *Idempotent I/O for safe time travel.* AADEBUG 2003.

**Memory/compilation/parallelism**
- Mazur. *Compile-time garbage collection for Mercury.* PhD, KU Leuven, 2004.
- Phan. *Region-based memory management for Mercury.* PhD, KU Leuven, 2009.
- Bone. *Automatic parallelisation for Mercury.* PhD, Melbourne, 2012.
- Conway. *Towards parallel Mercury.* PhD, Melbourne, 2002.
- Becket, Somogyi. *DCGs + memoing = packrat parsing; but is it worth it?* PADL 2008.
- Becket et al. *Adding constraint solving to Mercury.* PADL 2006.

**Application**
- Vanden Bossche-Marquette et al. *Ontologies and semantic rules in real life.* RuleML+RR 2024.

### Samples (the most useful concrete reading)

https://github.com/Mercury-Language/mercury/tree/master/samples — `hello.m`, `cat.m`, `sort.m`, `calculator.m` (DCG parser), `interpreter.m`, `expand_terms.m`, `e.m` (lazy), `eliza.m`, `beer.m`, `mcowsay.m`; directories `c_interface/`, `csharp_interface/`, `java_interface/`, `rot13/`, `muz/` (Z spec checker), `solver_types/`, `lazy_list/`, `diff/`, `concurrency/`.

---

# Known Limits and Gaps

### Language/implementation limits (recurring findings)

1. **The mode system has a learning curve.** The single most cited reason newcomers bounce off Mercury. Even simple programs produce mode errors that require understanding instantiation flow.
2. **Tabling is C-backend only.** `minimal_model` *changes the declarative semantics* to perfect model; `memo` is plain memoization; tabling cannot consume `unique` arguments.
3. **Solver types are experimental** — depend on the trailed `.tr` grade, used in research.
4. **Java and C# backends are less complete** than C; tabling and some pragmas are C-only.
5. **Erlang backend dropped in 22.01.** Any older doc referencing it is stale.
6. **Apple-Silicon macOS build status unconfirmed** (issue #136 open, 2025-05-14). Linux AArch64 shipped in 22.01.
7. **Single implementation, small ecosystem.** No first-party package manager (Merchant is third-party). No analogue of SWI's RDF/Pengines/http stack.
8. **Foreign types are not GC'd by Mercury** — the foreign side owns lifetime or you register a finalizer.
9. **`will_not_call_mercury` lies corrupt the trail/GC**, usually silent until the next GC.
10. **Bignum arithmetic is a known footgun** vs Prolog (per mailing-list threads).

### Research gaps (honest)

- **No GitHub Releases** — release artifacts live at dl.mercurylang.org and on tags `version-YY_MM[_patch]`.
- **GitHub issues undercount** — real tracker is bugs.mercurylang.org (only 13 GH issues open).
- **PR traffic under-represents development** — most commits land via direct push by `zsomogyi`/`juliensf`/`wangp`.
- **Two-document split** — `doc-release/` frozen at 22.01.8 (Sept 2023); post-22.01 features only in `doc-latest/` or in-repo `NEWS.md`.
- **Web-title URL capitalization is non-obvious** — Ref Man uses Title-Case-with-hyphens (`Type-classes.html`); User's Guide uses `Grades-and-grade-components.html`. Use the ToC page; many plausible URLs 404.
- **No comprehensive up-to-date tutorial** (issue #42 open since 2018). Best on-ramps: Becket's `book.pdf` (labeled "under development") and the community crash course at mercury-in.space.
- **Could not directly browse the mailing-list archives** — thread titles above are reconstructed from search-result summaries, not direct archive reads.
- **macOS arm64 / Apple Silicon** build status not formally confirmed in release notes.

---

# LLM Usage Notes

Frequent LLM mistakes about Mercury (and the fix to demand):

| Mistake | Fix |
|---|---|
| Confuses Mercury the language with Mercury the fintech (the Serokell "Haskell in Mercury" trap) | Disambiguate: the language is mercurylang.org, Somogyi et al.; the fintech is a Haskell shop, unrelated |
| Attributes "Zobel" as an author | Authors are **Somogyi, Henderson, Conway**. Zobel does not appear on the core Mercury papers |
| Forgets the **mode declaration is required** on every predicate | Prolog is unmoded; Mercury requires `:- mode p(in, out) is det.` per direction |
| Forgets determinism must be declared and the compiler checks it | Declare `is det/semidet/multi/nondet/cc_multi/cc_nondet`; the compiler *proves* it |
| Uses Prolog `is/2` for arithmetic | Mercury uses `=` for function results; arithmetic is via `func`s (e.g. `Y = X + 1` inside a `func` body) |
| Forgets `!IO` shorthand for `io.state` threading | `main(!IO)` expands to `main(IO0, IO)`; every IO predicate threads the pair |
| References the Erlang backend | **Dropped in 22.01.** Use C (primary), Java, or C# |
| Writes Prolog-style `assertz`/`retract`/cut in user code | Mercury is pure; no assert/retract/cut. State threads through arguments; `io.state` for IO |
| Forgets `foreign_proc` determinism can't be `multi`/`nondet` | Wrap multi-solution foreign code in Mercury clauses calling deterministic foreign helpers |
| Lies about `will_not_call_mercury` | Default + fast path; lying corrupts the trail/GC. Use `may_call_mercury` if it does call back |
| Treats `unique` modes as optional sugar | `di`/`uo` is the *only* way to get in-place destructive update; the compiler enforces the uniqueness proof |
| Cites 22.01 as current without the patch level | Current stable is **22.01.8** (2023-09-17); latest ROTD `rotd-2026-07-28`; beta `22.01.9-beta-2026-07-13` |
| Assumes tabling works on all backends | Tabling is **C-backend only** |
| References the grade system as "compilation flags" | Grades are a dot-list naming a product of axes (backend × GC × trace × profile × parallel × trail); `mmc --grade asm_fast.gc.par.debug` |

**Prompting guidance**: when asking an LLM for Mercury code, pre-load — (a) target Mercury 22.01.x; (b) every predicate needs an explicit `:- mode ... is <determinism>.`; (c) thread `!IO` for any I/O; (d) prefer `func` for total functions, `pred` for relations; (e) use `array` + `di`/`uo` for in-place update, `map`/`set` for immutable keyed data; (f) no `assert`/`retract`/cut; (g) `pragma foreign_proc` for C interop with `will_not_call_mercury` unless it genuinely calls back.

---

# High-Value Examples

The "if you remember five things" set.

**1. In-place destructive update in pure code (the signature move).**

```mercury
main(!IO) :-
    Arr0 = array.from_list([1, 2, 3, 4]),
    Arr1 = array.set(2, 99, Arr0),          % di/uo -> single store instruction
    array.to_list(Arr1, List), io.print(List, !IO).   % [1, 2, 99, 4]
```

**2. A predicate with all four declarations (type, mode, determinism, clauses).**

```mercury
:- pred factorial(int::in, int::out) is det.
factorial(0, 1).
factorial(N, F) :- N > 0, N1 = N - 1, factorial(N1, F1), F = N * F1.
```

**3. `solutions/2` — collect nondet into a list, det result.**

```mercury
solutions((pred(N::out) is nondet :- member(N, [1,2,3,4])), Ns).
```

**4. C interop via `pragma foreign_proc`.**

```mercury
:- pragma foreign_proc("C",
    puts(S::in, Old_IO::di, New_IO::uo),
    [promise_pure, will_not_call_mercury],
"   puts(S); New_IO = Old_IO; ").
```

**5. The canonical hello (the `io.state` discipline).**

```mercury
:- module hello.
:- interface.  :- import_module io.  :- pred main(io::di, io::uo) is det.
:- implementation.
main(!IO) :- io.write_string("Hello, world\n", !IO).
```

---

# Source Links (consolidated master list)

**Official Mercury:**
1. Homepage — https://mercurylang.org/index.html
2. About / design — https://mercurylang.org/about.html
3. News (release timeline) — https://mercurylang.org/news.html
4. Download / ROTD — https://mercurylang.org/download.html · http://dl.mercurylang.org/index.html
5. Docs root — https://mercurylang.org/documentation/documentation.html
6. Ref Man ToC — https://mercurylang.org/information/doc-latest/mercury_reference_manual/
7. Ref Man: Determinism — https://mercurylang.org/information/doc-latest/mercury_reference_manual/Determinism.html
8. Ref Man: Modes — https://mercurylang.org/information/doc-latest/mercury_reference_manual/Modes.html
9. Ref Man: Unique-modes — https://mercurylang.org/information/doc-latest/mercury_reference_manual/Unique-modes.html
10. Ref Man: Type-classes — https://mercurylang.org/information/doc-latest/mercury_reference_manual/Type-classes.html
11. Ref Man: Impurity — https://mercurylang.org/information/doc-latest/mercury_reference_manual/Impurity.html
12. Ref Man: Solver-types — https://mercurylang.org/information/doc-latest/mercury_reference_manual/Solver-types.html
13. Ref Man: foreign_proc — https://mercurylang.org/information/doc-release/mercury_ref/pragma-foreign_005fproc.html
14. Ref Man: Tabled evaluation — https://mercurylang.org/information/doc-release/mercury_ref/Tabled-evaluation.html
15. User's Guide: Grades — https://mercurylang.org/information/doc-release/mercury_user_guide/Grades-and-grade-components.html · Base-grades.html · Grade-modifiers.html
16. User's Guide: Backends — https://mercurylang.org/information/doc-release/mercury_user_guide/The-Mercury-backends.html
17. User's Guide: Debugging — https://mercurylang.org/information/doc-latest/mercury_user_guide/Debugging.html · Declarative-debugging-mdb-commands.html
18. User's Guide: Deep profiling — https://www.mercurylang.org/information/doc-latest/mercury_user_guide/Deep-profiling-grade-options.html · https://mercurylang.org/documentation/deep_demo.html
19. Library reference — https://mercurylang.org/information/doc-release/mercury_lib/
20. FAQ (22.01.8) — https://mercurylang.org/information/doc-release/mercury_faq/index.html
21. Comparing Mercury and Haskell — https://mercurylang.org/about/comparison_with_haskell.html
22. Papers index (~50, 1987–2024) — https://mercurylang.org/documentation/papers.html
23. Learning resources — https://mercurylang.org/documentation/learning.html
24. Bug tracker — https://bugs.mercurylang.org/

**GitHub (`gh` receipts inline):**
25. Repo — https://github.com/Mercury-Language/mercury
26. RELEASE_NOTES — https://github.com/Mercury-Language/mercury/blob/master/RELEASE_NOTES
27. NEWS.md (since 22.01) — https://github.com/Mercury-Language/mercury/blob/master/NEWS.md
28. LICENSE — https://github.com/Mercury-Language/mercury/blob/master/LICENSE
29. Samples — https://github.com/Mercury-Language/mercury/tree/master/samples · hello.m · c_interface/short_example.m · c_interface/
30. High-signal issues — #136 Apple Silicon https://github.com/Mercury-Language/mercury/issues/136 · #74 mode error https://github.com/Mercury-Language/mercury/issues/74 · #42 tutorial https://github.com/Mercury-Language/mercury/issues/42 · #36 eta https://github.com/Mercury-Language/mercury/issues/36
31. Recent PRs — #144 hlc.agc revival https://github.com/Mercury-Language/mercury/pull/144 · #146 C#/.NET 10 https://github.com/Mercury-Language/mercury/pull/146

**Tutorials / papers / community:**
32. The Mercury Tutorial (Becket book.pdf) — https://mercurylang.org/documentation/papers/book.pdf
33. Mercury Crash Course (community) — https://mercury-in.space/crash.html
34. Learn X in Y Minutes: Mercury — https://learnxinyminutes.com/mercury/
35. Güdemann intro — https://guedemann.org/articles/mercury-intro-curry-club.html
36. Güdemann FFI article — https://guedemann.org/articles/May-09-2015.html
37. Dewey COMP 410 modes handout — https://kyledewey.github.io/comp410-spring18/lecture/week_13/modes_and_mercury_handout.pdf
38. Execution algorithm paper (JLP 1996) — https://www.sciencedirect.com/science/article/pii/S0743106696000684
39. Wikipedia — https://en.wikipedia.org/wiki/Mercury_(programming_language)
40. PrinceXML — https://www.princexml.com/ · HN confirmation https://news.ycombinator.com/item?id=18404337
41. Bower email client — https://github.com/wangp/bower
42. Merchant (package manager) — https://github.com/stewy33/merchant
43. SO: compile for debugging — https://stackoverflow.com/questions/26916819/how-do-i-compile-for-debugging-in-mercury-programming-language
44. SO: nondet in det (solutions/2) — https://stackoverflow.com/questions/56230946/mercury-nondet-in-det
45. SO: Curry/Mercury/λ-Prolog — https://stackoverflow.com/questions/2951407/what-is-more-interesting-or-powerful-curry-mercury-or-lambda-prolog
46. HN thread (2021, PrinceXML engineers) — https://news.ycombinator.com/item?id=26598959
47. Lobsters discussion — https://lobste.rs/s/dtyeko/mercury_programming_language
48. Flix — https://flix.dev/
49. Curry — https://www.curry-lang.org/
50. Disambiguation: Mercury fintech (NOT the language) — https://serokell.io/blog/haskell-mercury-functionalfutures

---

*End of reference. Refresh by re-running the research pass; the two streams' raw drafts are kept under `commands/.tmp-mercury-research/` until cleared.*





