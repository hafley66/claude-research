# SWI-Prolog Capability Reference

> Compiled 2026-07-28 from official docs, the `swipl-devel` repository, the SWI discourse forum, Stack Overflow, Reddit, and third-party tutorials. Three research streams merged; every factual claim carries an inline source link or a `gh` receipt.
>
> Flavor note: per the requester, this reads as "Tank explaining Prolog to Neo at night." The "domain expansion" callouts name the paradigm leverage a technique buys you — hype-free, one paragraph each. Where a slogan oversells (tabling as "unifying solver"), the doc says so.

---

## Research Metadata

| Field | Value | Source |
|---|---|---|
| Target | SWI-Prolog | — |
| Homepage | https://www.swi-prolog.org | repo README |
| Reference manual (HTML) | https://www.swi-prolog.org/pldoc/doc_for?object=manual | repo README |
| Source repo (GitHub mirror) | https://github.com/SWI-Prolog/swipl-devel | `gh repo view` |
| Canonical git server | https://www.swi-prolog.org/git/swipl-devel.git | repo README |
| Default branch | `master` | `gh repo view` |
| Primary language | C (C11) + Prolog | repo README |
| License | Simplified BSD (BSD-2-Clause) | `LICENSE` head |
| Stars / forks | 1,264 / 215 | `gh api repos/SWI-Prolog/swipl-devel` |
| Open issues | 50 | same |
| Commercial support | SWI-Prolog Solutions b.v., https://swi-prolog.com | repo README |
| Forum | https://swi-prolog.discourse.group/ | repo README |
| NPM (WASM) | https://www.npmjs.com/package/swipl-wasm | repo README |
| Online REPLs | sandboxed https://swish.swi-prolog.org · unsandboxed WASM https://wasm.swi-prolog.org/wasm/tinker | repo README |

### Versions verified 2026-07-28

| Channel | Version | Date | Source |
|---|---|---|---|
| **Stable (current)** | **SWI-Prolog 10.0.2** | 10.0.x line opened 2025-12-03 (V10.0.0 tag); 10.0.1 = 2026-02-18; 10.0.2 has no GitHub annotated tag | https://www.swi-prolog.org/download/stable ; `gh api .../git/refs/tags/V10.0.0` tagger 2025-12-03T09:55:22Z |
| **Development (current)** | **SWI-Prolog 10.1.12** | 2026-07-19 | `gh release view V10.1.12 --repo SWI-Prolog/swipl-devel` |
| `VERSION` on `master` | `10.1.12` | read 2026-07-28 | `gh api .../contents/VERSION` |
| Stable downloads | Windows `swipl-10.0.2-1.x64.exe` (36 MB), macOS universal `swipl-10.0.2-1.fat.dmg` (34 MB), source `swipl-10.0.2.tar.gz` (12.8 MB), PDF `SWI-Prolog-10.0.2.pdf` | https://www.swi-prolog.org/download/stable |

> **Version-line correction:** the current major is **10.x**, not 9.x. SWI 9 shipped 2022-11-24; 10.0.0 stable broke 2025-12-03. There is no dedicated "SWI 10 announcement" article in the news archive — the 10.0 feature list comes from the download-page copy. Any tutorial citing a "10.0 announcement" is wrong.

---

## Executive Index

SWI-Prolog is the most widely used open Prolog implementation: a C kernel with a Prolog bootstrap, BSD-2 licensed, batteries-included (RDF/semweb, HTTP server, threads, engines, tabling, CLP(FD)/CLP(B)/CHR, literate docs, unit tests, a profiler, a graphical debugger). It runs at the center of the semantic-web/Prolog niche (ClioPatria, cultural-heritage knowledge graphs), in AI courses, and — since 2024 — as a callable reasoning backend for LLMs (arXiv 2512.07407, "Training Language Models to Use Prolog as a Tool").

**What "knowing SWI" means, at five altitudes:**

1. **Syntax tier** — terms, atoms, numbers, the SWI7 string/atom split, operators, DCGs (`-->`, `phrase/3`). The #1 newcomer pain lives here: `"abc"` is a `string` since 7.0, not a code list; `set_prolog_flag(double_quotes, chars)` is the migration shim.
2. **Logical tier** — unification, backtracking, `(is)/2` arithmetic. The discipline: replace `(is)/2` and `(>)/2` over integers with CLP(FD) `(#=)/2`, `(#>)/2` (Triska's crusade) so your code runs in every direction.
3. **Termination tier** — `:- table pred/N.` buys you memoization, left-recursion termination, cyclic-graph reachability, and sound negation (`tnot/1`) in one directive. The "unifying solver" for the **stratified-Datalog fragment only** (see the honest correction in §Tabling).
4. **Meta/coroutining tier** — `term_expansion/2` + `goal_expansion/2` (Lisp-tier macros over the compiler's own AST), attributed variables and `attr_unify_hook/2` (every constraint solver is built on this), engines (reified, resumable VMs as first-class values).
5. **Introspection tier** — `vm_list/1` (read compiled VM code), `jiti_list` (just-in-time indexes), `prolog_trace_interception/4` (drive the tracer programmatically), `gtrace/0` (graphical debugger). The compiler hands you its own internals as ordinary terms.

**Three things that decide whether SWI fits a problem:**

- **It is a logic language, not a numerics language.** Fast for logic work (native threads, lock-free atom GC, an 80x speedup on 128 cores per https://www.swi-prolog.org/features.html), slow for raw number-crunching.
- **It is untyped.** `check/0` finds undefined predicates and singletons at CI time; real static analysis lives in **Ciao/CiaoPP** (assertion-based abstract interpretation) or **Mercury** (mandatory strong typing). SWI itself ships the experimental `perfunctory_types` pack and is the target of HHU's optional-typing research.
- **Bus factor is explicit community knowledge.** Jan Wielemaker is the main maintainer and answers a large share of forum threads himself; a small set of co-contributors own packages (semweb, Pengines, http). See discourse thread "What happens if Dr. Wielemaker is hit by a van?" (§Community).

**The single most underrated feature:** engines (§Engines). Tabling and CLP(FD) get the press; engines — a coroutine-as-value that costs almost nothing, exists in the millions, and hands answers back one at a time over a typed channel — dissolve whole producer/consumer designs into three predicate calls.

**The #1 footgun:** the SWI7 string/atom split. Tutorial code predating 2015 (Learn Prolog Now!, Adventure in Prolog, Bratko) reads `"abc"` as a code list; modern SWI reads it as a `string`. Every such tutorial is flagged in §Stale-tutorial warnings.

---

## Capability Matrix

| Capability area | Maturity | Status | Package / module | Note |
|---|---|---|---|---|
| Core logic (unification, backtracking, VM, JIT indexing) | Very high | shipped/stable | core (`src/`) | Multi-arg deep JIT indexing (§2.17, §2.17.1); VM not strictly WAM-derived |
| Arbitrary precision ints/rationals | Very high | shipped/stable | core `libbf/` | LibBF replaced GMP in SWI9 for permissive license |
| Floats (IEEE-754) | Very high | shipped/stable; improving | core | INRIA crmath optional for correct rounding (10.1.12) |
| Dicts | High | shipped/stable (SWI7+) | core `boot/dicts.pl` | `tag{k:v}`, dot access, `:>/2` |
| Strings (vs atoms) | High | shipped/stable (SWI7+) | core | `"..."`=string, `` `...` ``=codes; flags `double_quotes`/`back_quotes` |
| Modules | Very high | shipped/stable | core `boot/`, `library(module)` | `:- module/2`, meta-predicates |
| Operators | Very high | shipped/stable | core | `op/3` + ISO + extensions (`:=`, `:>/2`, `rdiv/2`) |
| DCGs | Very high | shipped/stable | `boot/dcg.pl`, `library(dcg/basics)`, `library(dcg/high_order)` | `phrase/2,3`, `-->` |
| CLP(FD) | Very high | shipped/stable | `library(clpfd)` (core lib) | full finite-domain propagation |
| CLP(Q,R) | High | shipped/stable | `packages/clpqr` | rational + float constraints |
| INCLPR | Moderate | shipped | `packages/inclpr` | nonlinear polynomial over reals |
| CHR | High | shipped/stable | `packages/chr` | Leuven CHR |
| Tabling (SLG, WFS, incremental, monotonic, shared, subsumptive, mode-directed) | Very high | shipped/stable (matured in 9.x) | `boot/tabling.pl`, `library(tabling)` | `table/1,2`, `tnot/1`, `wrap_incremental/1` |
| Transactions / snapshots | High | shipped/stable (SWI9) | core | `transaction/1`, `snapshot/1` |
| Single-sided unification | High | shipped/stable (SWI9) | core | zero-cost runtime determinism |
| Threads | Very high | shipped/stable | core `boot/threads.pl` | OS threads, shared heap, message queues, mutexes |
| Engines (coroutining) | High | shipped/stable | core `boot/engines.pl` | `engine_create/3`; PR #1491 fixed self-deadlock in `engine_destroy/1` (2026-05-18) |
| HTTP server & client | Very high | shipped/stable | `packages/http` | SSE, websockets, dyn workers (8.0+), hookable JSON errors |
| Pengines (Prolog engines over WS, remote) | High | shipped/stable | `packages/pengines` | networked engine protocol; sandbox-gated |
| RDF / SemWeb / SPARQL | Very high | shipped/stable | `packages/semweb`, `packages/RDF` | `library(semweb/rdf11)`, in-memory + persistent store, SPARQL 1.1 |
| SGML/XML/HTML parser | High | shipped/stable | `packages/sgml` | |
| JSON / YAML | High / Moderate | shipped/stable | `packages/json`, `packages/yaml` | YAML since 8.0 |
| SSL/TLS / Crypto | High | shipped/stable | `packages/ssl`, `packages/clib` | OpenSSL; Ed25519/X25519 in 10.1.12 |
| ODBC / CQL / BDB | High / Moderate | shipped | `packages/odbc`, `cql`, `bdb` | |
| Redis / STOMP / Paxos | High / Moderate | shipped (9.0+) | `packages/redis`, `stomp`, `paxos` | |
| Foreign C interface | Very high | shipped/stable | core `SWI-Prolog.h` | `PL_*` API, term refs |
| Foreign C++ interface | High | shipped/stable (9.0 rewrite) | `packages/cpp` | full API coverage, type-safe |
| JPL (Java bridge) / Python (swipy) | High / Moderate | shipped | `packages/jpl`, `packages/swipy` | |
| MQI (Machine Query Interface) | High | shipped | `packages/mqi` | non-Prolog hosts via TCP/stdin |
| WASM / browser / Node | High | shipped/stable (9.0+) | core build, `swipl-wasm` NPM | bidirectional JS↔Prolog; Emscripten 6.0.0 (PR #1499) |
| Unit testing (plunit) / PlDoc | Very high | shipped/stable | `packages/plunit`, `packages/pldoc` | structured comments, web server |
| GUI debugger / IDE (XPCE) | High | shipped/stable | `packages/xpce` | PceEmacs, source debugger, profiler |
| Pack system / Sandbox | High | shipped/stable | core `boot/packs.pl`, `library(sandbox)` | `pack_install/1`, `safe_goal/1` |
| Sweep (Emacs module) | High | shipped (9.0+) | `packages/sweep` | semantic highlighting, embeds Prolog |
| TIPC / Protobuf / Archive / PCRE | Low–Very high | shipped | `contrib-*`, `packages/{archive,pcre}` | PCRE very high |

---

## Official Docs Inventory

Root: https://www.swi-prolog.org/pldoc/doc_for?object=manual (Reference Manual). The manual is one large PlDoc-sourced document split into chapters.

| Section | URL | Contents |
|---|---|---|
| Ch.1 Introduction | https://www.swi-prolog.org/pldoc/man?section=swiprolog | Positioning, "Should I be using SWI-Prolog?", sponsorship, impl history |
| Ch.2 Overview | https://www.swi-prolog.org/pldoc/man?section=overview | Feature summary: tabling, engines, CLP, CHR, threads, foreign, modules, JIT indexing §2.17, deep indexing §2.17.1, Unicode source §2.18, rational syntax §2.15.1.6 |
| Ch.3 Built-in Predicates | https://www.swi-prolog.org/pldoc/man?section=builtin | Core predicate reference (term/atom/number/list/dict/string/stream I/O, DB, flags, files) |
| Ch.4 SWI-Prolog extensions | https://www.swi-prolog.org/pldoc/man?section=extensions | DCGs, dicts, tabling extensions, delimited continuations |
| Ch.5 Modules | https://www.swi-prolog.org/pldoc/man?section=modules | `:- module/2`, export/import, meta-predicates |
| Ch.6 Tabled execution (SLG) | https://www.swi-prolog.org/pldoc/man?section=tabling | `table/1,2`, `untable/1`, `tnot/1`, incremental, monotonic, shared, subsumptive, mode-directed |
| Ch.7 Constraint Logic Programming | https://www.swi-prolog.org/pldoc/man?section=clp | `library(clpfd)`, CLP(Q,R), INCLPR |
| CHR: Constraint Handling Rules | https://www.swi-prolog.org/pldoc/man?section=chr | Leuven CHR |
| Ch.8 Multithreaded applications | https://www.swi-prolog.org/pldoc/man?section=threads | `thread_create/3`, message queues, mutexes, `interactor/3-4` |
| Ch.9 Coroutining using Prolog engines | https://www.swi-prolog.org/pldoc/man?section=engines | `engine_create/3`, `engine_next/2`, `engine_yield/1`, `engine_post/2`, `engine_fetch/1`, `engine_self/1`, `engine_destroy/1` |
| Ch.10 Foreign Language Interface | https://www.swi-prolog.org/pldoc/man?section=foreign | `SWI-Prolog.h`, `PL_*` C API, term refs, foreign predicates |
| Using SWI-Prolog in your browser (WASM) | https://www.swi-prolog.org/pldoc/man?section=wasm-version | Emscripten build, JS↔Prolog bridge |
| Deploying applications | https://www.swi-prolog.org/pldoc/man?section=runtime | Saved states (`qcompile`, qlf format), `-c`, runtime |
| Packs: community add-ons | https://www.swi-prolog.org/pldoc/man?section=packs | `pack_install/1`, pack registry |
| The SWI-Prolog library | https://www.swi-prolog.org/pldoc/man?section=libpl | `library(...)` inventory (lists, ordsets, rbtrees, assoc, heaps, option, aggregate) |
| Hackers corner | https://www.swi-prolog.org/pldoc/man?section=hack | VM internals, traps |
| Compatibility with other dialects | https://www.swi-prolog.org/pldoc/man?section=dialect | `expects_dialect/1`, SICStus/GNU/Quintus emulation |
| Glossary / Summary / Bibliography | https://www.swi-prolog.org/pldoc/man?section=summary | flat predicate table; terminology; papers |

### Standalone guides (off the manual spine)

| Guide | URL | Contents |
|---|---|---|
| Getting Started | https://www.swi-prolog.org/pldoc/man?section=quickstart | install, first session |
| Command line | https://www.swi-prolog.org/pldoc/man?section=cmdline | `swipl` flags, toplevel options |
| Prolog syntax | https://www.swi-prolog.org/pldoc/man?section=syntax | operators, quoting, numbers, rational syntax, the SWI7 atom/string history |
| Packages index | https://www.swi-prolog.org/pldoc/doc_for?object=packages | per-package docs (http, semweb, pldoc, clp, chr) |
| PlDoc | https://www.swi-prolog.org/pldoc/package/pldoc.html | `:- use_module(library(pldoc))`, pldoc server, structured comments |
| Securing the server | https://www.swi-prolog.org/pldoc/man?section=security | sandbox, `library(sandbox)` |
| Build from source | https://www.swi-prolog.org/build/ + repo `CMAKE.md` | CMake instructions |

Doc formats: HTML online + HTML shipped in `<install>/doc/Manual`, PDF per release (`SWI-Prolog-<ver>.pdf`). In-system: `?- apropos("query").` and `?- help(append/3).`.

---

## Repository Map

`SWI-Prolog/swipl-devel` layout (`master`, via `gh api .../contents`):

| Path | Contents |
|---|---|
| `src/` | C kernel: VM, compiler, GC, atoms, terms, arithmetic (`libbf/`, `libtai/`, `minizip/`, `Unicode/`, `os/`, `compat/`), `SWI-Prolog.h`, `mkvmi.c` |
| `boot/` | Prolog bootstrap compiled into the saved state: `init.pl`, `topvars.pl`, `toplevel.pl`, `autoload.pl`, `syspred.pl`, `dcg.pl`, `dicts.pl`, `threads.pl`, `engines.pl`, `tabling.pl`, `attvar.pl`, `bags.pl`, `qlf.pl`, `packs.pl`, `messages.pl`, `history.pl`, `license.pl`, `expand.pl`, `predopts.pl`, `dwim.pl`, `gc.pl`, `iri.pl`, `rc.pl`, `apply.pl`, `load.pl` |
| `library/` | the standard `library(...)` collection (shipped with core, distinct from packages/) |
| `packages/` | add-on bundles (most are git submodules; see below) |
| `man/` | manual sources (`.plx` Prolog-embedded LaTeX); generator pipeline (`pldoc2tex.pl`, `doc2tex.pl`, `gen/`) |
| `doc/` | `README.md`, `Release.md`, `Testing.md`, `WindowsInstaller.md`, `MacOSXInstaller.md` |
| `cmake/`, `customize/`, `demo/`, `desktop/`, `app/`, `scripts/`, `tests/` | build helpers, samples, desktop integration, app wrappers, tests |
| `bench`, `debian` | submodules (`../bench.git`, `../distro-debian.git`) |
| top-level files | `CMakeLists.txt`, `CMAKE.md`, `INSTALL.md`, `LICENSE`, `VERSION`, `README.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `PRIVACY.md`, `CODE_SIGNING.md` |

### `packages/` (path → upstream repo)

| Path | Upstream | Description |
|---|---|---|
| `packages/chr` | SWI-Prolog/packages-chr | Leuven Constraint Handling Rules |
| `packages/clpqr` | SWI-Prolog/packages-clpqr | CLP(Q,R): rational + float constraints |
| `packages/inclpr` | SWI-Prolog/packages-inclpr | INCLPR: nonlinear polynomial over reals |
| `packages/jpl` | SWI-Prolog/packages-jpl | Prolog↔Java bridge |
| `packages/http` | SWI-Prolog/packages-http | HTTP server + client |
| `packages/pengines` | SWI-Prolog/packages-pengines | Prolog engines over websockets |
| `packages/plunit` | SWI-Prolog/packages-plunit | Unit testing |
| `packages/pldoc` | SWI-Prolog/packages-pldoc | Inline docs + web server |
| `packages/semweb` | SWI-Prolog/packages-semweb | RDF store + SPARQL (`rdf11`, `sparql_client`) |
| `packages/sgml` | SWI-Prolog/packages-sgml | SGML/XML/HTML parser |
| `packages/ssl` | SWI-Prolog/packages-ssl | SSL/TLS (OpenSSL); Ed25519/X25519 in 10.1.12 |
| `packages/cpp` | SWI-Prolog/packages-cpp | C++ foreign interface (SWI9 rewrite, type-safe) |
| `packages/odbc`, `cql`, `bdb` | SWI-Prolog/packages-{odbc,cql,bdb} | DB interfaces |
| `packages/redis`, `stomp`, `paxos` | SWI-Prolog/packages-{redis,stomp,paxos} | Redis client (9.0+), STOMP, replicated KV |
| `packages/mqi`, `swipy` | SWI-Prolog/packages-{mqi,swipy} | Machine Query Interface, Python |
| `packages/sweep` | SWI-Prolog/packages-sweep | GNU-Emacs module (SWI9) |
| `packages/xpce` | SWI-Prolog/packages-xpce | native GUI toolkit, PceEmacs, debugger (pushed 2026-07-28) |
| `packages/{archive,pcre,yaml,zlib,json,nlp,table,protobufs,utf8proc}` | various | bindings + format support |
| `packages/R` | SWI-Prolog/packages-R | **retired** — last push 2015-02-20; R now via `pack` |

---

# Libraries to Consult — stdlib modules & community packs

The shipped packages (`packages/` submodules) are already in the matrix above. This section covers (A) the autoloaded `library(...)` stdlib modules worth knowing by name and (B) the community **pack registry** at https://www.swi-prolog.org/pack/list (417 packs at crawl time, 2026-07).

Confusion boundary: a **shipped package** is built by `packages/<name>/` and linked into the `swipl` binary at install; a **library module** is a `.pl` file in `library/` autoloaded by core; a **pack** is third-party, fetched on demand into `~/.local/share/swi-prolog/pack/`. Overlaps are flagged.

## A. Core `library(...)` modules worth knowing by name

Full index: https://www.swi-prolog.org/pldoc/man?section=libpl. SWI's autoloading means most of these are pulled on first call; `use_module(library(...))` is only required when you want eager load, when autoload is disabled, or for operator/expansion hooks. Legend: **A** = autoloaded by default; **U** = `use_module` required.

### Data structures

| Module | Purpose | Key predicates | Load |
|---|---|---|---|
| `library(lists)` | List manipulation; the workhorse | `member/2`, `append/3`, `select/3`, `nth1/3`, `sum_list/2`, `msort/2`, `numlist/3` | A |
| `library(apply)` | Map/filter/partition over lists; re-exports `maplist/N` | `maplist/2,3,...`, `include/3`, `exclude/3`, `partition/5`, `foldl/4,5,...`, `convlist/3` | A |
| `library(apply_macros)` | Compile-time specialization of `maplist`/`foldl` into inline loops | (macro only) | A |
| `library(aggregate)` | Backtrackable aggregation (`count`/`sum`/`max`/`min`/`set`/`bag`) | `aggregate_all/3`, `aggregate/3`, `foreach/2,4` | A |
| `library(ordsets)` | Sets as sorted lists (preferred over `setof`-built lists) | `ord_memberchk/2`, `ord_union/3`, `ord_intersection/3`, `ord_subtract/3` | A |
| `library(rbtrees)` | Red-black trees; fastest persistent ordered map in stdlib | `rb_new/1`, `rb_lookup/3`, `rb_insert/4`, `rb_delete/3`, `rb_visit/2` | A |
| `library(assoc)` | AVL association lists; same shape as rbtrees, more idiomatic in tutorials | `empty_assoc/1`, `get_assoc/3`, `put_assoc/4`, `assoc_to_keys/2` | A |
| `library(pairs)` | Key-value list ops; glue between `findall` and aggregation | `pairs_keys_values/3`, `group_pairs_by_key/2`, `transpose_pairs/2` | A |
| `library(heaps)` | Binary heaps / priority queues | `add_to_heap/3`, `get_from_heap/3`, `merge_heaps/3` | U |
| `library(nb_set)` | Non-backtrackable set (mutated in place); visited-set traversal | `empty_nb_set/1`, `add_nb_set/3`, `nb_set_to_list/2` | A |
| `library(record)` | Generate accessors/updaters for a named-field record via `record/1` directive | `record/1` (directive), generated `<name>_field/3` | U |
| `library(varnumbers)` | `$VAR(N)` term handling; copy_term numbering ↔ readable names | `varnumbers/2`, `varnumbers_names/3` | A |

### Control, options, scripting

| Module | Purpose | Key predicates | Load |
|---|---|---|---|
| `library(option)` | `Option=Value` list processing; the canonical option idiom | `option/2,3`, `select_option/3,4`, `merge_options/3`, `dict_options/2` | A |
| `library(optparse)` | `getopt_long`-style CLI parser; generates `--help` | `opt_arguments/3`, `opt_parse/4`, `opt_help/2` | U |
| `library(main)` | `main/1` entry point for scripts; `initialization(main, main)` idiom | `main/1`, `argv_options/3` | U |
| `library(yall)` | Lambdas `[X,Y]>>Goal`, `\X^Goal`; modern replacement for the `lambda` pack | `(>>)/2,3`, `(^)/2,3` | A |
| `library(solution_sequences)` | SQL-shaped solution combinators | `limit/2`, `distinct/1,2`, `order_by/2`, `offset/2`, `group_by/4` | A |
| `library(intercept)` | Delimited-continuation-style signal/recv; escape hatches without threads | `intercept/3`, `intercept_all/4`, `send_signal/1` | A |
| `library(broadcast)` | Pub/sub over a topic term; underpins HTTP service composition | `broadcast_request/1`, `listen/2,3`, `unlisten/1,2` | A |
| `library(time)` | Call with wall/CPU limits; timeouts | `call_with_time_limit/2`, `call_with_inference_limit/3` | A |

### DCGs, parsing, formats

| Module | Purpose | Key predicates | Load |
|---|---|---|---|
| `library(dcg/basics)` | General DCG primitives | `integer//1`, `string//1`, `string_without//2`, `blanks//0`, `eos//0` | A |
| `library(dcg/high_order)` | DCG combinators | `sequence//2,3`, `list//2`, `optional//3`, `switch//2` | A |
| `library(pio)` | Pure I/O: DCGs as file parsers without side effects | `phrase_from_file/2,3` | A |
| `library(csv)` | CSV read/write with options | `csv_read_file/2,3`, `csv_write_file/2` | A |
| `library(readutil)` | Fast line/file reads without parsing | `read_line_to_string/2`, `read_file_to_string/3` | A |
| `library(charsio)` | I/O on char-code lists | `read_from_chars/2`, `write_to_chars/2,3` | A |
| `library(fastrw)` | Fast binary read/write of terms; non-portable but very fast | `fast_read/1,2`, `fast_write/1,2` | A |

### Debug, inspection, build

| Module | Purpose | Key predicates | Load |
|---|---|---|---|
| `library(debug)` | Topic-gated `debug/3` printing; runtime-toggleable | `debug/3`, `debugging/1` | A |
| `library(check)` | Program consistency: undefined preds, trivial fails, singletons | `check/0`, `list_undefined/0`, `list_trivial_fails/0` | A |
| `library(make)` | `make/0` — reload all changed files; the standard refresh | `make/0` | A |
| `library(prolog_xref)` | Cross-referencer data; underpins `check/0`, IDE, LSP | `xref_source/1,2`, `xref_called/3`, `xref_defined/3` | A |
| `library(prolog_source)` | Read source with locations | `read_term_at_location/3` | A |
| `library(prolog_coverage)` | Line/clause coverage reports for `library(plunit)` | `show_coverage/1,2` | U |
| `library(settings)` | App-wide key/value settings with local overrides | `setting/2,3,4`, `set_setting/2` | A |

### Testing, types, errors

| Module | Purpose | Key predicates | Load |
|---|---|---|---|
| `library(plunit)` | The unit-test framework (historically a package, now autoloaded core) | `begin_tests/1,2`, `test/2,3`, `run_tests/0,1` | U |
| `library(error)` | Canonical error helpers; `must_be/2` is the idiom | `must_be/2`, `is_of_type/2`, `domain_error/3`, `type_error/3` | A |
| `library(dicts)` | Dict utilities (the `{tag:key:value}` first-class value) | `dict_pairs/3`, `get_dict/3`, `:>/2`, `put_dict/3,4` | A |
| `library(arithmetic)` | Custom arithmetic-function expansion hooks | `arithmetic_function/1` (directive) | U |

### Tabling, semantics, constraints

| Module | Purpose | Key predicates | Load |
|---|---|---|---|
| `library(tabling)` | SLG tabling support (the `:- table` directive itself is a builtin) | `current_table/2`, `abolish_table_subgoals/1` | A |
| `library(tables)` | XSB-compatible table-inspection API | `get_calls/2`, `get_returns/2` | A |
| `library(increval)` | Incremental dynamic-predicate invalidation for incremental tabling | (mostly transparent) | A |
| `library(wfs)` | Well-Founded Semantics support (3-valued) | `call_delays/2`, `undefined/0` | A |
| `library(clpfd)` | CLP over Finite Domains (ships with core, NOT the `clpqr` package) | `(#=)/2`, `all_different/1`, `labeling/2` | A |
| `library(clpb)` | CLP over Booleans (ships with core) | `sat/1`, `taut/2`, `labeling/1` | A |
| `library(simplex)` | Linear programming (pure-Prolog simplex) | `constraint/3`, `maximize/2`, `minimize/2` | U |

### Graphs & threading & persistence

| Module | Purpose | Key predicates | Load |
|---|---|---|---|
| `library(ugraphs)` | Directed graphs as adjacency lists; **the stdlib graph lib** — Warshall, topological sort, SCC | `vertices_edges_to_ugraph/3`, `transitive_closure/2`, `top_sort/2`, `neighbors/3` | U |
| `library(random)` | Random numbers, shuffling | `random/1,3`, `random_between/3`, `random_permutation/2` | A |
| `library(thread)` | High-level thread primitives: queues, signals, `concurrent/3` | `thread_create/3`, `thread_get_message/1,2`, `concurrent/3,4` | A |
| `library(thread_pool)` | Bounded worker pools; HTTP-server integration | `thread_create_in_pool/4`, `thread_pool_create/2` | U |
| `library(persistency)` | Persistent dynamic predicates (level-triggered journaling to a file) | `(persistent)/1` directive, `assert_<name>`, `retract_<name>` | U |

### Macros & metaprogramming

| Module | Purpose | Key predicates | Load |
|---|---|---|---|
| `library(macros)` | Function-argument macro expansion (`M()` style); lighter than `goal_expansion` | `macro/1` (directive) | U |
| `library(quasi_quotations)` | Define `{|qq(X)|...|}` syntax for embedding foreign syntax | `quasi_quotation_syntax/1` (directive) | A |
| `library(predicate_options)` | Declare & check option lists of a predicate | `predicate_options/3` (directive) | A |
| `library(prolog_jiti)` | Just-In-Time Indexing inspection | `jiti_list/0,1,2` | A |

### Don't confuse with shipped packages

- `library(crypto)` — **ships with core**, not the `ssl` package (primitives: `crypto_data_hash/3`, `crypto_password_hash/2`, `crypto_data_encrypt/6`); `ssl` provides TLS sockets. https://www.swi-prolog.org/pldoc/doc_for?object=section(%27sec%3Acrypto%27)
- `library(http/json)`, `library(http/http_open)`, `library(http/http_server)` — part of the **http** package but mostly autoloaded.
- `library(semweb/rdf11)`, `library(semweb/turtle)` — **semweb** package.
- `library(odbc)`, `library(ssl)`, `library(pengines)`, `library(jpl)`, `library(chr)`, `library(redis)`, `library(mqi)`, `library(sweep)` — their respective shipped packages.
- `library(clpr)`, `library(clpq)` — **clpqr** package. **Note: `library(clpfd)` and `library(clpb)` are NOT in clpqr — they ship with core.**

## B. Community pack registry — categorized survey

Index: https://www.swi-prolog.org/pack/list. Install: `?- pack_install(name).` or `swipl -g "pack_install(name,[interactive(false)])" -g halt`. From git: `?- pack_install('https://github.com/Owner/repo').` Packs land in `~/.local/share/swi-prolog/pack/`; dependencies in `pack.pl` resolve recursively. Upgrade: `?- pack_upgrade(name).` Search: `?- pack_list(query).`

Download counts below are cumulative from the 2026-07-28 crawl; a rough proxy only.

### B.1 Popular / must-know

| Pack | Purpose | Repo / page | Fresh? | DL |
|---|---|---|---|---|
| **rocksdb** | Embedded persistent KV. The community answer to "`library(persistency)` doesn't scale." Random lookup ~10–30 µs; WordNet 3.0 (821k clauses, 99MB) loads ~12s; RDF Geonames 123M triples in 5.2GB. Jan Wielemaker prototype; single-process, no retract yet. | https://github.com/JanWielemaker/rocks-predicates · https://www.swi-prolog.org/pack/list?p=rocksdb | Active (experimental) | 135 |
| **regex** | PCRE-style regex with `=~`/`\~`, `re_match`/`re_replace`/`re_split`. (Core ships `library(pcre)` `re_match/3` since 8.x — check if you need the pack.) | https://github.com/mndrix/regex · https://www.swi-prolog.org/pack/list?p=regex | Maintained | 2,392 |
| **scasp** | s(CASP): constraint ASP with goal-directed, proof-explaining solver. Best-in-class for legal/rule reasoning with justifications; deployed in SWISH. | https://github.com/SWI-Prolog/packages-scasp · https://www.swi-prolog.org/pack/list?p=scasp | Active | 1,294 |
| **lsp_server** | Language Server Protocol impl (James Cash); the server behind SWI-LSP VS Code + `lsp-mode`. Windows needs socket mode (stdio broken). | https://github.com/jamesnvc/lsp_server · https://www.swi-prolog.org/pack/list?p=lsp_server | Active | 5,507 |
| **tap** | Test Anything Protocol producer from `library(plunit)`; CI integration. | https://www.swi-prolog.org/pack/list?p=tap | Active | 7,539 |
| **smtp** | SMTP client (`smtp_send_mail`); highest-download pack on the registry. | https://www.swi-prolog.org/pack/list?p=smtp | Maintained | 44,089 |
| **terminus_store_prolog** | Bindings to Rust `terminus-store` (RDF HDT-like store); for very large RDF. | https://www.swi-prolog.org/pack/list?p=terminus_store_prolog | Active | 4,531 |
| **clpBNR** | CLP over Reals via interval arithmetic; the verified-numerics alternative to `library(clpr)`. | https://www.swi-prolog.org/pack/list?p=clpBNR | Maintained | 4,357 |
| **list_util** | Extended list predicates filling gaps in `library(lists)`. | https://github.com/mndrix/list_util · https://www.swi-prolog.org/pack/list?p=list_util | Maintained | 4,175 |
| **date_time** | Logical arithmetic on dates/times — the missing piece vs `library(time)` (which is timeouts, not date math). | https://www.swi-prolog.org/pack/list?p=date_time | Maintained | 8,925 |
| **reif** | Reified `if/3` (Scryer-style clean conditional). | https://www.swi-prolog.org/pack/list?p=reif | Maintained | 2,274 |
| **db_facts** | Common SQL-as-facts layer over `library(odbc)` and `prosqlite`. | https://www.swi-prolog.org/pack/list?p=db_facts | Maintained | 35,524 |
| **callgraph** | Static predicate call-graph extraction/visualization. High DL but version-stale; rebuild via `library(prolog_xref)` if you hit bugs. | https://www.swi-prolog.org/pack/list?p=callgraph | Stale-ish | 40,126 |
| **chat80** | The classic 1980 NL database front-end, packaged; teaching/eval corpus. | https://www.swi-prolog.org/pack/list?p=chat80 | Maintained | 16,214 |

### B.2 Web & server

| Pack | Purpose | Fresh? | DL |
|---|---|---|---|
| **simple_web** | Sinatra-style microframework on the shipped `http` package | Active | 452 |
| **arouter** | Alternative HTTP path router; cleaner DSL than `library(http/http_dispatch)` | Active | 2,456 |
| **openapi** | OpenAPI/Swagger interface for serving/consuming REST specs | Maintained | 325 |
| **jwt_io** | JWT encode/decode/verify; fills the auth gap | Light | 106 |
| **http2_client** | HTTP/2 client (the shipped `library(http/http_open)` is HTTP/1.1) | Maintained | 837 |
| **graphql** | GraphQL server library | Young | 47 |
| **pl_mustache** / **simple_template** | Logic-free Mustache templating | Maintained | 25 / 468 |
| **blog_core** / **plog** | Blog/CMS frameworks on the http server | Maintained | 1,277 |

The shipped **http** package already provides routing, dispatch, sessions, file serving, WebSockets, SSE, content negotiation, logging, HTTPS. Most "web framework" packs are thin sugar on top.

### B.3 Data & databases

| Pack | Purpose | Fresh? | DL |
|---|---|---|---|
| **prosqlite** | Native SQLite binding (Nicos Angelopoulos), modeled after `library(odbc)` — established | Maintained | 1,859 |
| **swiplite** | Newer alternative SQLite binding; simpler ergonomics | Active | 441 |
| **rocksdb** | Persistent KV at scale (see B.1) — the load-bearing store | Active | 135 |
| **terminus_store_prolog** | Rust-backed RDF/graph store; scales past memory (see B.1) | Active | 4,531 |
| **hdt** | Access RDF HDT compressed files; complements `library(semweb)` | Maintained | 825 |
| **sql_compiler** / **pro2sql** | Prolog → SQL `SELECT` translators (research-era) | Stale | 292 / 31 |

**No pure-Prolog Postgres/MySQL driver exists.** Use shipped `library(odbc)` or `library(redis)`. Native SQLite: `prosqlite` or `swiplite`.

### B.4 Parsing & serialization

| Pack | Purpose | Fresh? | DL |
|---|---|---|---|
| **yaml** | YAML parser | Maintained | 228 |
| **djson** | Declarative JSON (DCG-based, reversible) | Maintained | 153 |
| **msgpack** / **msgpackc** | MessagePack (pure-Prolog / C-based) | Maintained / Light | 332 / 114 |
| **markdown** | Markdown parser (CommonMark-ish) | Maintained | 303 |
| **pPEG** | pPEG generic parser-generator grammars | Active | 216 |
| **s_expression** | S-expr / KIF / GDL / PDDL / CLIF | Maintained | 433 |
| **bibtex** / **vcard** / **ical** / **atom_feed** | Format-specific parsers | Mixed | 352 / 131 / 101 / 1,038 |

**No TOML pack** on the registry as of crawl — flagged as a gap.

### B.5 Testing, dev tooling, IDE

| Pack | Purpose | Fresh? | DL |
|---|---|---|---|
| **tap** / **quickcheck** | TAP producer / QuickCheck-style property testing | Active / Maintained | 7,539 / 231 |
| **doctest** | Doctests via PlDoc + PlUnit | Maintained | 405 |
| **lsp_server** | Language Server (see B.1) | Active | 5,507 |
| **debug_adapter** | Debug Adapter Protocol — step-debug in DAP editors | Young | 154 |
| **diagnostics** | Source diagnostics beyond `check/0` | Maintained | 998 |
| **log4p** | Logging framework | Maintained | 1,315 |

Standard stack is shipped `library(plunit)` + `library(prolog_coverage)`; the packs layer on top.

### B.6 ML / math / stats

| Pack | Purpose | Fresh? | DL |
|---|---|---|---|
| **cplint** | Probabilistic logic programs | Maintained | 1,695 |
| **aleph** | Aleph Inductive Logic Programming | Maintained | 934 |
| **liftcover** / **phil** / **ccprism** | Probabilistic ILP / hierarchical PLP / prism-via-delimited-continuations | Active | 180 / 185 / 724 |
| **matrix** | Pure-Prolog matrix ops | Maintained | 1,781 |
| **real** / **rolog** | Bindings/embed to R (the most-used R bridges) | Mixed | 615 / 2,186 |
| **lbfgs** / **linprog** | L-BFGS optimizer / LP via GLPK | Light | 250 / 261 |
| **modeling** | MiniZinc-inspired constraint modeling | Active | 805 |
| **llmpl** | Prolog ↔ LLM bridge (one of the few modern entries) | Young | 119 |

### B.7 Language bridges (beyond shipped jpl/cpp/mqi/sweep)

| Pack | Purpose | Fresh? | DL |
|---|---|---|---|
| **ffi** | Dynamic C calls via `dlopen`/`dlsym`; base for other foreign packs | Maintained | 204 |
| **plgi** | GLib/GObject/GIO/GTK+ bindings — full GNOME stack | Maintained | 263 |
| **plcairo** / **plOpenGL** | Cairo / OpenGL bindings | Maintained / Stale | 124 / 145 |
| **pljulia** | Embedded Julia | Stale | 751 |

**No first-class Node/Ruby/Go/Rust/Python bridge pack.** Python interop is via the shipped **`janus`** system; for everything else, FFI + sockets.

### B.8 Esoteric / powerful

The packs that unlock things the core doesn't:

| Pack | What it unlocks | Fresh? |
|---|---|---|
| **lambda** | Pure-Prolog lambda; predates `library(yall)` — use `yall` for new code | (classic) |
| **edcg** | Extended DCGs — multiple accumulated state threads (Wadler-style); powerful for stateful parsers | Maintained, niche |
| **pfc** | Pfc — forward chaining (production rules); the cleanest "rules engine" answer | Maintained |
| **condition** | Common Lisp-style condition/restart system | Maintained |
| **delay** | Defer built-in calls until instantiated; avoids instantiation errors | Maintained |
| **memo** | Persistent memoization of deterministic predicates | Maintained |
| **union_find** / **unionfind** | Union-find (the latter in CHR) for graph components | Light |
| **egraph** | E-graphs and equality saturation — cutting-edge | Young (v0.1.0) |
| **smtlib** | SMT-LIB parser; bridge to Z3/CVC5 | Light |
| **func** / **fnotation** | Function application & composition (`$>` operator) | Maintained |
| **logicmoo_*** | Large suite (base/cg/ec/nars/nlu/planners/webui/workspace) — LogicMOO environment; opinionated, sprawling | Active but unusual |
| **wam_common_lisp** | ANSI Common Lisp in Prolog | Stale, curiosity |

### B.9 Packs the community treats as load-bearing

The small set that recurs in production discussion on the Discourse forum:

1. **rocksdb** — the scale story for persistent facts. Jan Wielemaker's prototype; the answer whenever `library(persistency)` is too slow. Threads on WordNet, SemMedDB, Geonames all converge here. https://swi-prolog.discourse.group/t/persistent-predicates-based-on-rocksdb/5501
2. **lsp_server** — the editor integration. Referenced in the official SWI-Prolog reference manual.
3. **scasp** — when strict ASP semantics + justifications are needed. Deployed in SWISH.
4. **regex** — common convenience.
5. **tap** — bridges `library(plunit)` to TAP-speaking CI.
6. **prosqlite** / **swiplite** — SQLite without ODBC config. https://swi-prolog.discourse.group/t/yet-another-sqlite-binding-for-swi-prolog/8644
7. **db_facts** — common layer if you target both SQLite and ODBC from one codebase.
8. **date_time** — date arithmetic (a real gap in the stdlib).
9. **clpBNR** — interval-arithmetic reasoning; the verified-numerics alternative to `library(clpr)`.
10. **terminus_store_prolog** — Rust-backed RDF store for very large RDF beyond HDT.

The long tail (417 packs total) is dominated by single-author experiments, vendor-API thin wrappers, and research artifacts. The forum treats "use the stdlib first" as the default; packs get pulled in for a specific gap (scale, format, protocol). DB-tutorial thread: https://swi-prolog.discourse.group/t/tutorial-on-accessing-external-databases/2288.

### B.10 How to find and evaluate a pack

- **Browse** https://www.swi-prolog.org/pack/list — name, title, downloads, rating.
- **Search REPL**: `?- pack_list(rocks).` matches name + title.
- **Install**: `?- pack_install(Name).` (interactive) or `pack_install(Name, [interactive(false)])` (scriptable).
- **Install path**: `~/.local/share/swi-prolog/pack/` (per-user), or a project `pack/` dir (auto-loaded).
- **Metadata**: each pack ships `pack.pl` (name, version, author, install type, `requires/1` deps). `pack_install` resolves recursively.
- **Quality signals**: (1) author — core team (Jan Wielemaker, Paulo Moura, Nicos Angelopoulos, Michael Hendricks, James Cash, Wouter Beek) → high trust; (2) linked repo last-commit; (3) downloads/rating — `tap` 7.5k, `date_time` 8.9k, `smtp` 44k, `regex` 2.4k are real usage; sub-50 is yellow; (4) `pack.pl` SWI-version requirement (pre-7.x = pre-2013); (5) forum mentions.
- **Stale flags**: `callgraph`, `swicli`, `pljulia`, `plml`, `plfann`, `prolog_lsp` (superseded by `lsp_server`), `docstore`, `wsdl`, `googleclient`, `recaptcha`, `pro2sql`, `sql_compiler`, `ddebug`, `wam_common_lisp`, `transpiler`, `hilog`, `flux` — and many toys (`wumpus`, `hello_world`, etc.).
- Per the standing build-vs-buy law: try the pack first for common shapes (queues, parsers, DB drivers, caches). `rocksdb`, `prosqlite`, `lsp_server`, `tap`, `regex`, `scasp`, `terminus_store_prolog`, `clpBNR` are widely-used enough to treat as production-grade.

---

## Core Concepts

| Concept | What it is | Predicate / module home |
|---|---|---|
| Term | The universal data: atom, number, variable, string, compound, dict | `=../2` (univ), `functor/3`, `arg/3`, `copy_term/2` |
| Atom | Interned immutable symbol; interning table in `pl-atom.c` | `atom/1`, `atom_string/2`, `atom_length/2` |
| Number | Integer (arbitrary precision via **LibBF** since SWI9), rational (`1r3`), float (IEEE-754; **INRIA crmath** optional, 10.1.12) | `is/2`, `rational/1`, `rationalize/1` |
| Compound | `functor(arg1, ...)` canonical form | `compound/1`, `=../2`, `functor/3` |
| Variable | Logical unknown | `var/1`, `nonvar/1`, `unify_with_occurs_check/2` |
| Dict | SWI7: `tag{k1:v1}`, O(1) field access via `Dict.k1` | `dict_create/3`, `get_dict/3`, `:>/2` |
| String | SWI7: `"..."` is a `string` (not an atom, not a list); `` `...` `` is codes | `string/1`, `string_codes/2`, `atom_string/2` |
| Unification | `=/2`; occurs-check `unify_with_occurs_check/2`; single-sided unification (SWI9) | `=/2`, `\=/2`, `unifiable/3` |
| Backtracking | Depth-first search over choice points | `!/0`, `->/2`, `;/2`, `repeat/0`, `call_nth/2` |
| VM | SWI has its own VM (not strictly WAM); C kernel in `pl-comp.c`, `pl-wam.c` | `vm_list/1`, flag `agc_margin` |
| JIT clause indexing | Multi-arg deep indexes built lazily on demand (§2.17, §2.17.1) | automatic; flag `indexing`; `jiti_list` |
| Modules | First-class; `:- module(name, exports).`; meta-predicate aware | `module/1,2`, `use_module/1,2`, `export/1`, `strip_module/3` |
| Operators | `op/3` precedence+associativity; ISO + extensions (`:=`, `<:`, `:>/2`, `rdiv/2`) | `op/3`, `current_op/3` |
| DCGs | `-->` notation, `{Goal}` escapes, `phrase/3` | `phrase/2,3`, `expand_term/2`, `library(dcg/basics)` |
| Coroutining / engines | Engines = reified Prolog VMs with own stacks, not bound to an OS thread | `engine_create/3`, `engine_next/2`, `engine_yield/1`, `engine_post/2`, `engine_fetch/1` |
| Threads | OS threads, shared heap, per-thread stacks | `thread_create/3`, `thread_signal/2`, `with_mutex/2` |
| Tabling (SLG) | `table/1` switches to tabled evaluation; WFS, incremental, monotonic, shared, subsumptive, mode-directed | `table/1,2`, `tnot/1`, `wrap_incremental/1` |
| Transactions | ACID over the dynamic DB (SWI9) | `transaction/1`, `snapshot/1` |

---

# The Dark Arts — Advanced Techniques

SWI runs version 10.x as of mid-2026. Version notes where they matter: engines shipped 7.x; the string type shipped 7.0; tabling shipped 6.5/7.0 and was heavily extended through 8.1 (WFS, incremental, monotonic); single-sided unification + transactions + C++ foreign rewrite + LibBF in 9.x.

---

## 1. Meta-programming and term expansion

Prolog clauses are first-class terms. `f(X) :- g(X)` *is* the term `:-(f(_), g(_))`. The whole compilation pipeline is a series of rewrites you can hook — Lisp-macro-tier metaprogramming, and the rule expansions (DCGs, `library(apply_macros)`, the CLP(FD) goal rewriter) are themselves implemented through these hooks.

Key predicates:

- `term_expansion(TermIn, TermOut)` — multifile, dynamic. Invoked once per term read during consult/load. On success `TermOut` replaces `TermIn`; it may be a single term, a directive (`:- Goal`), or a list of terms. `begin_of_file`/`end_of_file` let you run setup/teardown at file boundaries. Manual: https://www.swi-prolog.org/pldoc/doc_for?object=term_expansion/2
- `expand_term(TermIn, TermOut)` — the driver; calls `term_expansion/2` in **local module, then `user`, then `system`**, threading output of each as input to the next (a pipeline).
- `goal_expansion(GoalIn, GoalOut)` — like `term_expansion` but applied to each goal in a clause body, recursively. Used for inlining and compile-time specialization. https://www.swi-prolog.org/pldoc/doc_for?object=goal_expansion/2
- `clause(Head, Body)` — reads a clause from the dynamic DB; only works on `dynamic`/`public` predicates.
- `assertz/1`, `asserta/1`, `retract/1` — mutate the dynamic DB. The head must be declared `:- dynamic foo/1.` (since 8.1.1, asserting to a non-dynamic already-defined predicate raises a permission error).

Pipeline order: reader produces term → `expand_term/2` runs the `term_expansion/2` chain → each clause body passes through `expand_goal/2` → compiler stores the final clause.

A scoped inlining macro (only fires when the defining module is actually imported):

```prolog
:- module(m1, [double/2]).
double(X, D) :- D is X*2.

user:goal_expansion(double(X,D), D is X*2) :-
    prolog_load_context(module, M),
    predicate_property(M:double(_,_), imported_from(m1)).
```

A term-expansion macro that generates a family of clauses from one declaration:

```prolog
user:term_expansion(log_decl(Name, _),
        [ (:- dynamic(Name/1)),
          assert_pred(Name)
        ]).
```

Gotchas:
- `term_expansion/2` clauses defined in the file being loaded are only visible after they have been read; ordering matters — most macros live in `user` or a separate module.
- The expansion may itself be expanded; infinite loops are possible if a rule rewrites to a term that re-triggers it.
- `clause/2` on a non-dynamic predicate raises `permission_error(access, private_static_predicate, ...)`. Declare `:- dynamic` or `:- public` first.

Sources: https://www.swi-prolog.org/pldoc/doc_for?object=term_expansion/2 · https://www.metalevel.at/prolog/macros

> **Domain expansion: term expansion.** Once you internalize that compilation is a Prolog term rewriter you call from Prolog, the line between "library" and "language feature" dissolves. DCGs, CLP(FD), lambda, the apply_macros inliner, and your custom DSL all become the same move: "when you see this shape, replace it with that shape." The compiler hands you its own AST as ordinary terms.

---

## 2. Attributed variables and coroutining

The signature Prolog dark art. An attributed variable carries a suspended attribute (a domain, a frozen goal, a constraint store) consulted whenever the variable is unified. **You hook unification itself.** Manual: https://www.swi-prolog.org/pldoc/man?section=attvar

- `attvar(Term)` — true when `Term` is an attributed variable.
- `put_attr(Var, Module, Value)` / `get_attr/3` / `del_attr/2` — per-module attribute slot; `put_attr` is backtrackable.
- `get_attrs/2` / `put_attrs/2` / `del_attrs/1` — whole attribute list.
- `attr_unify_hook(AttValue, VarValue)` — multifile, called in `Module` after a variable carrying `Module:AttValue` is unified. If it fails, unification fails. **This is where constraint propagation lives.**
- `attribute_goals(Var)//` — DCG that projects an attribute back to a readable goal (`copy_term/3`, `frozen/2`, and the top-level all use it).
- `copy_term(Term, Copy, Goals)` — copy `Term`; residual attributes are emitted as `Goals` that re-establish the constraints. The bridge for serialization.
- `call_residue_vars(Goal, Vars)` — run `Goal`, return the attributed variables it left behind.
- `freeze(Var, Goal)` — `Goal` runs when `Var` is bound. Implemented as an attribute on module `freeze`.
- `frozen(Var, Goal)` — read back the frozen goal.
- `when(Condition, Goal)` — generalize `freeze`: `Condition` is `nonvar(X)`, `ground(X)`, `(C1,C2)`, `(C1;C2)`.

A minimal finite-domain attribute (the skeleton CLP(FD) uses):

```prolog
:- module(domain, []).
:- use_module(library(ordsets)).

put_domain(X, List) :- put_attr(X, domain, List).

attr_unify_hook(Domain, Y) :-
    (   get_attr(Y, domain, Dom2)
    ->  ord_intersection(Domain, Dom2, New),
        (   New == [] -> fail
        ;   New = [V] -> Y = V
        ;   put_attr(Y, domain, New)
        )
    ;   var(Y) -> put_attr(Y, domain, Domain)
    ;   ord_memberchk(Y, Domain)
    ).

attribute_goals(X) --> { get_attr(X, domain, L) }, [domain(X, L)].
```

Now `X` carries a set of allowed values; unification intersects the sets, fails on the empty intersection, binds on the singleton. `freeze` as a pure defer:

```prolog
?- freeze(X, write(got(X))), X = 7.
got(7)
X = 7.
```

Why this is the core dark art: every constraint solver (CLP(FD), CLP(Q), CLP(R), `dif/2`, CHR) is built on attributed variables, and so is the "left it unsolved, come back when more is known" control flow that classical Prolog lacks. `freeze` is the gateway drug; `attr_unify_hook` is the real spell.

Gotchas:
- `attr_unify_hook` is called in the attribute's module, not the caller's. Declare it there, multifile.
- Attributes survive `copy_term/2` but are dropped by `duplicate_term/2`; use `copy_term_nat/2` if you want them gone deliberately.
- A frozen goal that never triggers leaves a residual variable in the answer; `call_residue_vars/2` is how you find it.
- Mixing `freeze` with cuts inside the frozen goal breaks confluence; keep frozen goals pure.

Sources: https://www.swi-prolog.org/pldoc/man?section=attvar · https://www.swi-prolog.org/pldoc/doc_for?object=freeze/2 · https://www.swi-prolog.org/pldoc/doc_for?object=attr_unify_hook/2 · https://www.metalevel.at/prolog/coroutining

> **Domain expansion: attributed variables.** Before this, Prolog's only execution model is "pick a goal, expand it." With attributes, a variable becomes a little suspended process that wakes on unification. You stop writing search by hand; you post constraints and let the variables drive. CLP(FD) for scheduling, `dif/2` for pure disequality, CHR for rule systems, and a custom domain intersection all share this one mechanism, and once you can write `attr_unify_hook/2` you have built your own constraint solver.

---

## 3. Constraints (CLP)

CLP(FD), `library(clpfd)` (author: Markus Triska). Manual: https://www.swi-prolog.org/pldoc/man?section=clpfd. The paradigm shift: replace `(is)/2`, `(=:=)/2`, `(>)/2` over integers with relational constraints `(#=)/2`, `(#\=)/2`, `(#>)/2` that work in all directions.

```prolog
?- 3 #= Y + 2.        % solving backward; is/2 cannot do this
Y = 1.
```

Core API:

- Domain setup: `X in 1..10`, `Vs ins 0..3`, `X in 1..5 \/ 10..20`.
- Arithmetic: `#=`, `#\=`, `#>`, `#<`, `#>=`, `#=<`; reified `#<==>` (equivalence), `#==>` (implication); Boolean `#\/`, `#/\`, `#\`.
- Reified constraints: `X #= 4 #<==> B` binds `B` to 1/0 reflecting truth of `X #= 4`.
- `all_different(Vs)` (forward-checking, cheaper) vs `all_distinct(Vs)` (bound-consistency, stronger).
- Globals: `global_cardinality/2`, `cumulative/1,2`, `circuit/1`, `disjoint2/1`, `element/3`, `sum/3`, `lex_chain/1`, `nvalue/2`.
- Search: `label(Vs)`, `labeling(Options, Vs)`. Options: var selection `leftmost`, `ff` (first-fail), `ffc`, `min(Expr)`, `max(Expr)`; value order `up`/`down`; branching `step`/`enum`/`bisect`; optimization `min(Expr)`/`max(Expr)`.
- Reflection: `fd_dom(X, Dom)`, `fd_inf/2`, `fd_sup/2`, `fd_size/2`.

Sudoku (the canonical demo):

```prolog
:- use_module(library(clpfd)).
sudoku(Rows) :-
    length(Rows, 9), maplist(same_length(Rows), Rows),
    append(Rows, Vs), Vs ins 1..9,
    maplist(all_distinct, Rows),
    transpose(Rows, Cols), maplist(all_distinct, Cols),
    Rows = [R1,R2,R3,R4,R5,R6,R7,R8,R9],
    blocks(R1,R2,R3), blocks(R4,R5,R6), blocks(R7,R8,R9),
    maplist(label, Rows).
```

A reified factorial that works in any direction:

```prolog
n_factorial(0, 1).
n_factorial(N, F) :-
    N #> 0, N1 #= N - 1,
    F #= N * F1,
    n_factorial(N1, F1).
```

Other solvers:
- `library(clpb)` — Boolean constraints; `sat(+Expr)`, `taut(+Expr, -T)`, `labeling/2`. Decision problems, model counting.
- `library(clpq)` — rationals; linear equations/inequalities over Q.
- `library(clpr)` — reals; linear arithmetic, Fourier-Motzkin elimination.
- `library(clpt)` — term constraints (newer).

When to use which: CLP(FD) for discrete search/scheduling; CLP(Q) for exact linear reasoning over rationals; CLP(B) for combinatorial/SAT-style Boolean models; CLP(R) when you can tolerate floats.

Gotchas:
- `(is)/2` raises `arguments_not_sufficiently_instantiated` if the RHS has unbound vars; `(#=)/2` just posts a constraint. Reach for `#=` first for integers.
- `all_different/1` does forward-checking only; `all_distinct/1` does bound-consistency and detects inconsistency eagerly. Pay the cost only when needed.
- `labeling/2` without a variable-selection option defaults to `leftmost`; for hard problems `ff` is dramatically better.
- Floating point never enters CLP(FD); it is integers only, GMP/LibBF-backed.
- Per the manual, Triska flagged that clpfd development has shifted toward SICStus and CLP(Z); the SWI library remains the practical tool.

Sources: https://www.swi-prolog.org/pldoc/man?section=clpfd · https://www.metalevel.at/prolog/clpfd · https://www.metalevel.at/prolog/sudoku · https://github.com/triska/clpfd

> **Domain expansion: CLP(FD).** Before constraints, integer code in Prolog is a mode dance: you compute in one direction, crash in the others, and write a search procedure per problem. With `(#=)/2` you state the relation; the solver prunes domains for you, and the same code solves forward, backward, and sideways. A 200-line scheduler replaces a 2000-line one, and "find any solution", "find all solutions", and "find the optimum" become three option arguments to the same `labeling/2` call. This is the single biggest productivity jump in the language.

---

## 4. Tabling

Tabling (SLG resolution) memoizes calls and answers. Manual: https://www.swi-prolog.org/pldoc/man?section=tabling. Shipped in SWI 6.5/7.0; WFS, incremental, and monotonic tabling landed across 8.1.x and are stable in 9.x.

```prolog
:- table edge/2, path/2.
```

Transitive closure with left recursion, which loops forever without tabling:

```prolog
:- table path/2.
path(X, Y) :- edge(X, Y).
path(X, Y) :- edge(X, Z), path(Z, Y).
```

The first call to `path/2` creates a table; recursive calls suspend and resume with tabled answers instead of re-diverging.

**Mode-directed tabling (answer subsumption)** keeps the "best" answer per call. Modes: `+` input, `-` output, `max`, `min`, `lattice`, `po` (partial order), `first` (default):

```prolog
:- table shortest(_, _, min).
shortest(X, Y, 1) :- edge(X, Y).
shortest(X, Y, N + 1) :- edge(X, Z), shortest(X, Z, N).
```

Tabling options via `as/2`:

```prolog
:- table p/1 as incremental.          % recompute on dynamic change
:- table (q/1, r/2) as subsumptive.   % answer-call subsumption
:- table s/1 as shared.               % share table across threads
:- table t/1 as private.              % thread-local (default)
:- table u/1 as monotonic.            % incremental add only
```

**Incremental tabling** maintains an Incremental Dependency Graph between tabled predicates and incremental dynamic predicates; when a dynamic fact changes, dependent tables invalidate and re-evaluate bottom-up. https://www.swi-prolog.org/pldoc/man?section=tabling-incremental

**Monotonic tabling** is the add-only variant: new facts only ever extend the table, so the engine appends answers without full re-derivation. Useful for streaming/incremental ingestion where nothing is ever deleted. https://www.swi-prolog.org/pldoc/man?section=tabling-monotonic

**Well-Founded Semantics (WFS)**: three-valued logic (true, false, undefined). `tnot/1` is sound negation over tabled predicates. https://www.swi-prolog.org/pldoc/man?section=WFS

```prolog
:- table p/0, q/0.
p :- tnot(q).
q :- tnot(p).

?- p.
% residual: p :- tnot(q).  q :- tnot(p).
undefined.
```

`tnot/1` is logically sound negation as long as its argument is tabled. Plain `\+/1` over a non-terminating predicate is useless; `\+/1` inside a tabled predicate with a cut silently produces wrong answers. `tnot/1` with WFS is the fix.

> **Honest correction — "is tabling a unifying solver?"** Half yes. For the **stratified-Datalog fragment** (bounded term depth, stratified negation), one `:- table` directive gives you a fixpoint + termination + sound negation in a single move — genuinely unifying, and it's exactly the fragment most "I need a datalog engine" projects reduce to. Outside that fragment:
> 1. **Function symbols / unbounded term depth** → tabling does *not* guarantee termination. Datalog terminates; full Prolog does not in general, tabling or not. SWI's escapes are `mince`/abstraction or an explicit depth cap.
> 2. **Three-valued, not model-complete.** WFS returns `undefined` for cycles-through-negation. If you want a *crisp* model you need stable-model / answer-set semantics = ASP, which SWI does not do natively (you encode it). Tabling's negation is sound but not total.
> 3. **Constraints don't fold in.** CLP(FD)/attributed variables are a separate propagation engine that *composes* with tabling but isn't absorbed by it.
>
> So: a unifying solver for the stratified-Datalog fragment (termination + sound negation + fixpoint in one directive), and a "termination + sound-negation wherever it can" tool past it. Not the universal solver.

Gotchas:
- A tabled predicate may reorder solutions relative to the non-tabled version; do not depend on order.
- `tnot/1` over a non-tabled predicate raises an error; tabling is mandatory for sound negation.
- Incremental tabling requires both the tabled predicate *and* the dynamic predicates it depends on to carry `incremental`. Half-declaring it raises an error.
- Shared tabling has rwlock cost; private is faster per-thread but each thread pays the full first evaluation.
- Tables consume memory; `abolish_all_tables/0` or `abolish_table_subgoals/1` clears them.

Sources: https://www.swi-prolog.org/pldoc/man?section=tabling · https://www.swi-prolog.org/pldoc/man?section=WFS · https://www.swi-prolog.org/pldoc/man?section=tabling-incremental · https://www.swi-prolog.org/pldoc/man?section=tabling-monotonic

> **Domain expansion: tabling + WFS.** Plain Prolog's two great limits are left recursion and sound negation. Tabling erases both. A graph reachability rule becomes two clauses that terminate on a 1M-node cycle. `tnot/1` gives you real logical negation that composes with recursion. Add incremental and monotonic modes and the table tracks a changing world without re-deriving from scratch. Most "I need a datalog engine" projects in Prolog reduce to one `:- table.` directive — within the fragment the correction above nails down.

---

## 5. DCGs deep cut

Definite Clause Grammars. Manual: https://www.swi-prolog.org/pldoc/man?section=DCG. DCG rules use `-->/2` instead of `:-/2`. `expand_term/2` rewrites `head --> body` into `head(S0, S)` with a difference-list pair of hidden arguments.

```prolog
integer(I) -->
    digit(D0),
    digits(D),
    { number_codes(I, [D0|D]) }.
```

Invocation: only ever through `phrase/2` or `phrase/3`:

- `phrase(Body, List)` — `List` parses fully (Rest = `[]`).
- `phrase(Body, List, Rest)` — partial parse; `List` minus `Rest` is what was consumed.

```prolog
?- atom_codes('42 times', Codes), phrase(integer(X), Codes, Rest).
X = 42, Rest = [32,116,105,109,101,115].
```

Body forms inside a DCG:
- A callable term references another nonterminal (it gets the two hidden args threaded).
- `{Goal}` runs `Goal` as an ordinary Prolog goal, no hidden args. This is how you do semantic actions.
- A list literal `[a,b]` matches those tokens literally.
- `,`/`;`/`->`/`\+`/`!` work as in ordinary Prolog.

`library(dcg/basics)` ships the standard set: `integer//1`, `number//1`, `string//1`, `alpha//1`, `digits//1`, `eos//0`, `seq//1`, `seqq//1`, `blank//0`, `blanks//0`, `nonblank//1`. https://www.swi-prolog.org/pldoc/man?section=lib-dcg-basics

The **state-threading trick**: because a DCG is just two extra difference arguments, you can thread any state, not just a list. Use `call_dcg(Body, S0, S)` to invoke without the list-type check that `phrase/3` performs.

```prolog
% Count matches using state threading, not parsing.
counter(N), [N1] --> [N], { N1 is N+1 }.

?- call_dcg((counter(0), counter(_), counter(_)), S0, S).
S0 = 0, S = 3.
```

This is how you write a state machine, a lexer, or an accumulator-passer without ever naming the accumulator in the body. Many of SWI's own parsers (PlDoc lexer, HTTP URI parsing) are DCGs.

Gotchas:
- DCG literals `"abc"` are code lists (Unicode code points) under the default `double_quotes` flag in SWI7, not char atoms. `['a','b','c']` is chars.
- `phrase/3` type-checks that List and Rest are lists; for state threading use `call_dcg/3`.
- A cut inside a DCG body cuts the surrounding predicate; be careful in green/red-cut situations.
- Never call the expanded nonterminal directly as `foo(S0,S)`; the implementation is allowed to change. Always go through `phrase/[2,3]`.

Sources: https://www.swi-prolog.org/pldoc/man?section=DCG · https://www.swi-prolog.org/pldoc/man?section=lib-dcg-basics · https://github.com/Anniepoo/swipldcgtut/blob/master/dcgcourse.adoc

---

## 6. Exceptions and restart

- `catch(Goal, Ball, Recover)` — run `Goal`; if `throw(Ball)` is executed anywhere in `Goal`, unification with `Ball` selects the handler, and `Recover` runs in the catcher's context.
- `throw(Ball)` — raise. Standard error shape is `error(Formal, ImplDef)`, where `Formal` is `type_error(Valid, Culprit)`, `existence_error(Object, Culprit)`, `permission_error(Op, Type, Culprit)`, `resource_error(Resource)`, `syntax_error(Culprit)`, etc.
- `catch_with_backtrace(Goal, Ball)` — like `catch/3` but the ball carries a backtrace.
- `library(prolog_stack)`: `backtrace(Frames)`, `get_prolog_backtrace/2`.
- `current_prolog_flag(backtrace, N)` sets frame depth; `current_prolog_flag(backtrace_goal_depth, N)` per-frame print depth.

Custom error + recovery:

```prolog
parse_file(File, Term) :-
    catch(read_term(File, Term, []), E, recover(E, File)).

recover(error(existence_error(source_sink, _), _), File) :-
    format("missing: ~w~n", [File]), fail.
recover(error(syntax_error(Culprit), _), _) :-
    format("syntax: ~w~n", [Culprit]), fail.
```

Gotchas:
- `catch(Goal, _, fail)` silently swallows everything including stack overflow and type errors; it makes debugging miserable. Use a typed ball instead.
- The ball is unified against the catcher's `Ball` argument; side effects in the unification are observable. Use a fresh variable or a literal shape.
- An exception inside a `setup_call_cleanup/3` cleanup is suppressed; the original exception wins.

Sources: https://www.swi-prolog.org/pldoc/doc_for?object=catch/3 · https://www.swi-prolog.org/pldoc/man?section=exceptions

---

## 7. Destructive and non-logical ops (the forbidden jutsu)

Backtrackable and non-backtrackable destructive update. These break the logical semantics. Use them only when you have measured the cost of the pure alternative.

Backtrackable globals:
- `b_setval(Name, Value)` — set, restored on backtracking.
- `nb_setval(Name, Value)` — set, survives backtracking. Stores a `duplicate_term/2` copy.
- `nb_getval/2`, `nb_current/2`, `nb_delete/1`.

Destructive term mutation (the real forbidden jutsu):
- `setarg(Arg, Term, Value)` — **backtrackable** destructive assignment of the `Arg`-th argument of a compound `Term`. Undone on backtracking.
- `nb_setarg(Arg, Term, Value)` — non-backtrackable; survives backtracking, invisible to the trail.
- `nb_linkarg(Arg, Term, Value)` — like `nb_setarg` but shares the cell (no copy); can create cycles.

`create_prolog_flag(Name, Value, Options)` declares a new flag (vs `set_prolog_flag/2` which sets an existing one). Options: `access(read_write)`, `keep(true)`, `type(oneof(List))`.

Legitimate uses:
- Memoization across backtracking: `nb_setval` a cache key.
- In-place accumulator in a deterministic loop where you cannot afford to rebuild a large term: `nb_setarg` on a list cell.
- Graph node marking without copy: `setarg` on a visited flag.

The hazard, plainly: `setarg/3` and `nb_setarg/3` mutate a term in place. If that term is shared (referenced from another data structure), every reader sees the change, and the trail cannot undo a non-backtrackable update. The classic bug is mutating a list that is still being iterated elsewhere. The deeper bug is a result that depends on execution order, which breaks Prolog's "two ways to ask the same question, same answer" contract.

Use `setarg/3` (backtrackable) over `nb_setarg/3` whenever you can; reach for non-backtrackable only when the trail cost is measurable or the term is private to this branch.

Gotchas:
- `nb_setval` stores a `duplicate_term/2` copy; unbound vars inside come out as fresh vars. Do not expect object identity across the boundary.
- `setarg/3` on a cyclic term or on the spine of a list being walked produces infinite loops and incorrect results.
- Mixing `setarg/3` with tabling produces undefined behavior; tables cache answers without re-running the side effect.
- `nb_linkarg/3` can create cycles; printing/traversing without a cycle guard will not terminate.

Sources: https://www.swi-prolog.org/pldoc/doc_for?object=nb_setval/2 · https://www.swi-prolog.org/pldoc/doc_for?object=setarg/3 · https://www.swi-prolog.org/pldoc/doc_for?object=nb_setarg/3

---

## 8. Sandbox

`library(sandbox)`. Source: https://www.swi-prolog.org/pldoc/doc/_SWI_/library/sandbox.pl. The sandbox whitelists which goals may run. It is what makes Pengines safe: code sent from a browser runs in `pengine_sandbox`, and every goal is checked by `safe_goal/1` before execution.

- `sandbox:safe_goal(Goal)` — succeed if `Goal` is safe to call; throw otherwise. Performs `expand_goal/2` first, then walks the goal tree.
- `sandbox:safe_call(Goal)` — call after a `safe_goal/1` check.
- `sandbox:safe_primitive(Goal)` — multifile, dynamic. Declares a goal (a predicate head) as a safe primitive. The predicate must be defined and must not be a meta-predicate.
- `sandbox:safe_meta_predicate(Head)` — declares a meta-predicate as safe given its arguments are safe.
- `sandbox:safe_meta(Callable, SafeArgs)` — multifile. Declares how to project a meta-predicate's arguments to safe-goals.

Pattern for declaring your own predicate safe:

```prolog
:- module(my_app, [lookup/2]).
:- use_module(library(sandbox)).

lookup(Key, Value) :- ... .

:- multifile sandbox:safe_primitive/1.
sandbox:safe_primitive(my_app:lookup(_,_)).
```

Rule: everything is unsafe until declared safe. The whitelist is conservative. `rdf_sandbox.pl` is the canonical worked example, declaring the whole RDF API safe. https://www.swi-prolog.org/pldoc/doc/_SWI_/library/ext/semweb/semweb/rdf_sandbox.pl

The `not_sandboxed/2` hook lets a pengine application bypass the sandbox entirely. Use only for fully-trusted code.

Gotchas:
- Declaring a predicate safe that is itself a meta-predicate with `safe_primitive/1` raises an error; use `safe_meta_predicate/1`.
- Declaring a predicate safe that is not yet defined raises an error at the declaration site. Define first.
- A goal that calls an unsafe predicate transitively is rejected, even if your clause happens not to take that branch this run; the check is static over the whole goal tree.
- `call/1`, `findall/3`, `bagof/3`, `aggregate_all/3` over arbitrary goals are unsafe by default; they must be declared `safe_meta` with a projection.

Sources: https://www.swi-prolog.org/pldoc/doc/_SWI_/library/sandbox.pl · https://swi-prolog.discourse.group/t/no-permission-to-declare-safe-goal/721

---

## 9. Modules

Module system derived from Quintus. Manual: https://www.swi-prolog.org/pldoc/man?section=modules. A file begins with `:- module(Name, Exports).` and exports the listed predicates.

- `:- module(Name, Exports)` — declare the module.
- `:- use_module(library(lists))` — import all exports.
- `:- use_module(library(lists), [member/2, append/3])` — import selected.
- `:- import(foo:bar/1)` — import a single predicate by indicator.
- `:- export(foo/1)` — add to the public interface after the header.
- `module:goal` — qualified call: `lists:member(X, L)`.
- `module_transparent(Head)` — resolve a predicate's meta-arguments in the caller's module.
- `meta_predicate(Name(ArgSpec, ...))` — declare argument modes: `0` goal (caller-resolved), `:` module-qualified, `?` ordinary, `^` existential (bagof/setof), `+` input, `-` output, `*` plain. The `:` and `0` specs cause the compiler to add `Module:` qualifiers to the argument before the call.
- `strip_module(Term, Module, Plain)` — peel the `Module:` prefix off a term.
- `current_module(M)` — enumerate modules. The implicit `user` module is where unqualified top-level goals live.

Meta-predicate example (the canonical reason `meta_predicate` exists):

```prolog
:- meta_predicate maplist_(2, ?, ?).   % first arg is a 2-arg goal
maplist_(_, [], []).
maplist_(G, [X|Xs], [Y|Ys]) :-
    call(G, X, Y),
    maplist_(G, Xs, Ys).
```

Without the `2` indicator, the caller's module would not be attached to `G`, and `call(G, X, Y)` would resolve `G` in `maplist_`'s module instead of the caller's. This is the classic module bug.

`library(xref)` does offline cross-referencing of source without loading it; it is how `library(make)` and IDE tooling find undefined predicates.

Gotchas:
- A file without a `:- module/2` header goes into `user`, so two such files share their private predicates. Always declare modules in library code.
- `use_module/1` is transactional per file; circular imports raise an error.
- `module_transparent/1` is mostly legacy; modern code uses `meta_predicate/1` instead. The two together produce surprising resolution.
- `strip_module/3` is the safe way to handle a caller-supplied `Module:Goal` term before you call it.

Sources: https://www.swi-prolog.org/pldoc/man?section=modules · https://www.swi-prolog.org/pldoc/man?section=metapred

---

## 10. Engines and threads

### Threads

- `thread_create(Goal, Id, Options)` — spawn a Prolog thread. Options: `alias(Name)`, `detached(true)`, `at_exit(Goal)`, `stack_limit(Bytes)`.
- `thread_join(Id, Status)` — wait; get `true`, `exception(Ball)`, or `exited(Term)`.
- `thread_signal(Id, Goal)` — run `Goal` in the target thread at the next safe point.
- Message queues: `thread_send_message(Queue, Term)` (default queue is the thread's), `thread_get_message(Term)` (blocks), `thread_get_message(Queue, Term, Options)` (with `timeout`), `thread_peek_message/2`.
- `with_mutex(Name, Goal)` — mutual exclusion by named mutex.

### Engines

Engines are the signature advanced feature. Manual: https://www.swi-prolog.org/pldoc/man?section=engines. Shipped 7.x. An engine is a Prolog VM with its own stacks, suspended between answers. You ask for the next answer with `engine_next/2`; it runs until `engine_yield/1` or until the next answer is produced.

- `engine_create(Template, Goal, Engine)` — like the `Template`/`Goal` pair in `findall/3`. When `Goal` produces a binding for `Template`, the engine yields that binding through `engine_next/2`.
- `engine_next(Engine, Answer)` — resume; the engine runs and either yields `Answer` or finishes (then `engine_next/2` fails).
- `engine_yield(Term)` — from inside the engine, hand `Term` to the caller and suspend. Distinct from the `Template` answer path; this is the explicit "send one value and wait" primitive.
- `engine_post(Engine, Term)` / `engine_post(Engine, Term, Timeout)` — push a value into the engine; inside, `engine_fetch(X)` receives it.
- `engine_fetch(Term)` — from inside, block until the caller posts.
- `engine_self(Engine)` — from inside, return this engine's handle.
- `engine_destroy(Engine)`.

Mental model: an engine is a generator you can resume, and the `Template`/`Goal` path is the answer stream while `engine_yield`/`engine_post`/`engine_fetch` is a bidirectional channel.

A generator (the answer-stream flavor):

```prolog
gen(N, X) :- between(1, N, X).

?- engine_create(X, gen(5, X), E),
   engine_next(E, A1), engine_next(E, A2).
A1 = 1, A2 = 2.
```

A bidirectional one (the "interactor" flavor):

```prolog
server :-
    repeat,
    engine_fetch(Req),
    (   Req == stop -> !
    ;   engine_yield(processed(Req)),
        fail
    ).
```

Where engines beat threads: engines are cheap (stacks allocated lazily, they do not own an OS thread), many can exist at once, and they cooperatively yield instead of racing on shared memory. A million engines is feasible; a million threads is not. For producer-consumer pipelines, iterative deepening, and any "I want a coroutine that produces answers one at a time" pattern, engines are the right tool.

Gotchas:
- An engine that has finished fails on `engine_next/2`; you cannot restart it. Make a new one.
- `engine_yield/1` outside an engine raises an error.
- An engine has no thread of its own; it runs on the thread that calls `engine_next/2`. Blocking inside the engine blocks the caller.
- The `Template`/`Goal` path and the `engine_yield` path are distinct; do not mix them in one engine unless you know why.
- Engines do not share dynamic predicates per-engine; the dynamic DB is per-process.

Sources: https://www.swi-prolog.org/pldoc/man?section=engines · https://www.swi-prolog.org/pldoc/man?section=engine-examples · https://www.swi-prolog.org/pldoc/man?section=engine-aggregation · https://swi-prolog.discourse.group/t/confusing-results-from-engine-next/6749

> **Domain expansion: engines.** Threads let you run things at the same time. Engines let you suspend one train of thought and resume it later, as a value. A parser that needs more input, a solver that produces answers one at a time, a producer that feeds a consumer through a typed channel: all become first-class objects you can hold in a variable and step through. You stop building state machines out of mutable globals; you build them out of suspended continuations.

---

## 11. HTTP, Pengines, websockets

### HTTP server

`library(http/http_http)`, `library(http/http_server)`. The server is a Prolog program.

- `http_handler(Path, Goal, Options)` — register a handler. `Path` is an atom or `root(products)`; `Goal` is called with the request.
- `http_reply(Reply, Request, ExtraHeaders)` — produce a reply.
- `http_reply_from_files(Dir, Options, Request)` — serve static files.
- `http_unix_daemon` — run as a Unix daemon (the production deployment story).
- `library(http/http_open)` — client: `http_open(URL, Stream, Options)`.
- `library(http/http_client)` — higher-level: `http_post/4`, `http_get/3`.
- `library(http/http_json)` — `reply_json(Term)` and `http_read_json(Request, Term)`.
- `library(http/websocket)` — `ws_receive/3`, `ws_send/2`, `http_upgrade_to_websocket/3`.
- `library(http/http_cors)` — `cors_enable/0,1,2`. **CORS is opt-in**: `:- set_setting(http:cors, [*]).` plus `cors_enable` in the handler. https://www.swi-prolog.org/pldoc/man?section=httpcors

Minimum server:

```prolog
:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_unix_daemon)).

:- http_handler(root(hello), say_hello, []).

say_hello(_Request) :-
    format("Content-type: text/plain~n~n"),
    format("hello~n").

:- initialization(http_unix_daemon, main).
```

Run with `swipl server.pl --port=8080`. The `http_unix_daemon` initializer gives you `--user`, `--group`, `--pidfile`, `--fork`.

### Pengines

Pengines run Prolog from a browser. Manual: https://www.swi-prolog.org/pldoc/man?section=pengines. Architecture: a Pengine server holds Prolog engines; the browser (via `pengines.js`) creates them, posts queries, and receives answers over HTTP/SSE.

- `pengine_create(Options)` — `id(-ID)`, `alias(+Name)`, `server(+URL)`, `src_text(+Atom)`, `application(+App)`.
- `pengine_ask(ID, Query, Options)` — `template(+Template)`, `chunk(+N)`.
- `pengine_next(ID, Options)` — pull the next chunk.
- `pengine_output(Term)` — server-to-client output (from inside the pengine).
- `pengine_input(Term)` — block waiting for client input.
- `pengine_rpc(URL, Query)` — run a query on a remote pengine server.

Server-sent events are the wire format pengines uses for streaming answers (`chunk(N)` controls how many answers arrive per SSE message).

**Security**: code a browser posts runs in `pengine_sandbox`. Every goal is checked with `safe_goal/1` before execution. The `not_sandboxed/2` hook bypasses this for trusted applications only. **A non-sandboxed public Pengine endpoint is an RCE** — see Kim Hammar's writeup https://kim-hammar.com/pengine-rce-exploit. Never run a public Pengine endpoint without the sandbox unless you control every client.

Gotchas:
- A pengine runs on the server, not the browser. The network is a round-trip per chunk.
- A long-running query blocks its pengine; chunk size sets how often the browser gets a tick.
- Pengines over `https` requires the server to serve TLS; mixed-content browsers block it.
- `http_handler/3` paths are scoped; `root(foo)` mounts at `/foo`, an atom `/foo` is absolute.

Sources: https://www.swi-prolog.org/pldoc/man?section=pengines · https://www.swi-prolog.org/pldoc/man?section=http · https://www.swi-prolog.org/pengines/AppLogic.md

---

## 12. RDF and the semantic web

SWI is the de-facto RDF/Prolog platform. Two generations:

- `library(semweb/rdf_db)` — legacy. `rdf/3`, `rdf_assert/3`, `rdf_load/1`, `rdf_save/1`. Atom triples.
- `library(semweb/rdf11)` — modern. Prefix-aware `rdf/3` over `rdf(S,P,O)` with literal handling per RDF 1.1, plus `rdf_has/3`, `rdf_load/2`, `rdf_unload_graph/1`, transactions.

Core API (rdf11):

- `rdf(Subject, Predicate, Object)` — read a triple; `/4` qualifies by graph.
- `rdf_has(Subject, Predicate, Object)` — follows `owl`/`rdfs` entailment per the active mode.
- `rdf_load(File)` / `rdf_load(File, Options)` — load Turtle, N-Triples, RDF/XML, JSON-LD. Format auto-detected from mime-type or extension.
- `rdf_unload_graph(Graph)`, `rdf_default_graph(Graph)`.
- Prefixes: `rdf_register_prefix(prefix, 'http://...')`, then `prefix:local` reads as the full IRI.

Load and query:

```prolog
:- use_module(library(semweb/rdf11)).
:- rdf_load('ontology.ttl').

?- rdf(S, foaf:knows, O).
```

SPARQL: `library(semweb/sparql_client)` provides `sparql_query(Query, Result, Options)` against a remote endpoint.

```prolog
:- use_module(library(semweb/sparql_client)).
?- sparql_query('SELECT ?s WHERE { ?s a <http://example.org/Foo> }', Row,
                [ endpoint('http://dbpedia.org/sparql') ]).
```

**ClioPatria** is SWI's RDF application server (a SWI-Prolog-based triple store with an HTTP front end and SWISH-style query UI). https://cliopatria.swi-prolog.org/

Why SWI dominates RDF-Prolog: the triple store is in-process (no foreign DB), Turtle/SPARQL parsers are first-party, `library(semweb)` ships with the distribution, and ClioPatria + Pengines make "Prolog over your RDF" natural.

Gotchas:
- The legacy `rdf_db` and modern `rdf11` share the same backing store but expose different literal handling. Mixing them on the same data produces subtle bugs; pick one per project.
- Loading a large graph is slow on first load; SWI persists the triple store to disk (`rdf_save_db`) for fast subsequent boots.
- `rdf_load/1` on an `http://` URL needs `library(http/http_open)` and the rdf_http_plugin.
- `rdf(S,P,O)` is the read form; `rdf_assert/3,4` is the write form; `rdf_retractall/3,4` removes.

Sources: https://www.swi-prolog.org/pldoc/man?section=semweb · https://www.swi-prolog.org/pldoc/man?section=rdf11 · https://www.swi-prolog.org/pldoc/man?section=sparql_client · https://cliopatria.swi-prolog.org/ · RDF API overview https://www.swi-prolog.org/pldoc/man?section=semweb-rdfapi · "Issues with rdf_db" https://www.swi-prolog.org/pldoc/man?section=rdfissues

---

## 13. PlDoc and plunit

### PlDoc

Structured comments rendered as HTML/reStructuredText. `/%%` opens a structured comment documenting the predicate immediately following.

```prolog
%%  length_(+List, -Length) is det.
%
%   True when Length unifies with the number of elements in List.
%   @arg List is a proper Prolog list.
%   @arg Length is a non-negative integer.

length_([], 0).
length_([_|T], N) :- length_(T, N0), N is N0+1.
```

`:- doc_collect, true/false.` toggles whether structured comments are gathered during load (default true in development). Run `doc_server(Port)` to browse at `http://localhost:Port/pldoc`. PlDoc integrates with the source viewer; clicking a predicate shows its docs and callers.

### plunit

`library(plunit)`. Manual: https://www.swi-prolog.org/pldoc/man?section=plunit.

```prolog
:- use_module(library(plunit)).
:- begin_tests(lists).

test(reverse_twice) :-
    L = [a,b,c],
    reverse(L, R), reverse(R, L).

test(member, true(X == b)) :-
    member(X, [a,b,c]).

test(head, fail) :-
    member(x, []).

test(type, error(type_error(list, _))) :-
    length(foo, _).

test(all_solutions, all(Out == [1,2,3])) :-
    between(1, 3, Out).

test(is_det, deterministic) :-
    reverse([a,b], [b,a]).

:- end_tests(lists).
```

Test options:
- Body shape: default (succeeds), `fail`, `true(Goal)`, `all(Var == List)` (all solutions match), `set(Var == Set)` (set semantics).
- `setup(Goal)`, `cleanup(Goal)` — run before/after each test in the unit.
- `condition(Goal)` — skip unless condition holds.
- `error(Error)` — expect the body to throw an error unifying with `Error`.
- `blocked(Reason)` — skip with a reason.
- `deterministic` — the body must succeed exactly once.

Run with `run_tests.` or `run_tests(+Unit)`. `make` recompiles and re-runs tests by default in dev. CI typically runs `swipl -g run_tests -g halt your_test_file.pl`.

Gotchas:
- `test/1` clauses are not exported; they are discovered by the `:- begin_tests.` block.
- `error(Error)` runs the body in `catch/3`; an unexpected error fails the test, it does not error.
- `all(Var == List)` checks the bag of `Var` over all solutions; the body must be resatisfiable.

Sources: https://www.swi-prolog.org/pldoc/man?section=plunit · https://www.swi-prolog.org/pldoc/man?section=pldoc

---

## 14. Pack system and FFI

### Packs

Community extensions. Manual: https://www.swi-prolog.org/pldoc/man?section=packs.

- `pack_install(Pack)` — download and install. `Pack` is an atom name or a URL/git ref.
- `pack_list(Query)` — list packs from the registered index. Index: https://www.swi-prolog.org/pack/list
- `pack_property(Pack, Property)`.
- Packs live under the `pack` search path: user app-data, then system app-data. Override with `SWIPL_PACK_PATH` or `-p pack=/path`.
- A pack may define an `app`: `swipl app args` runs it as a CLI tool.
- Packs may contain foreign modules (compiled shared objects).

### Foreign interface (C)

Manual: https://www.swi-prolog.org/pldoc/man?section=foreigninclude. The C API is the low-level extension mechanism. Every argument to a foreign predicate is a `term_t` handle; the only operation you perform on it is unification.

- `PL_register_foreign(Name, Arity, Function, Flags)` — register `Function` as `Name/Arity`. Flags: `PL_FA_NONDETERMINISTIC`, `PL_FA_NOTRACE`, `PL_FA_TRANSPARENT`, `PL_FA_VARARGS`.
- `PL_open_foreign_frame()` / `PL_close_foreign_frame(mark)` / `PL_discard_foreign_frame(mark)` — mark/sweep the term heap. Open a frame before creating temporaries, discard when done to avoid leaks.
- `PL_unify(term, term)` and family: `PL_unify_atom`, `PL_unify_integer`, `PL_unify_float`, `PL_unify_string_chars`, `PL_unify_list`, `PL_unify_nil`, `PL_unify_functor`.
- `PL_get_*` extract: `PL_get_integer(term, &i)`, `PL_get_atom_chars(term, &s)`, `PL_get_list_ex(list, head, tail)`, `PL_get_nil_ex(list)`.
- `PL_new_term_ref()`, `PL_copy_term_ref(term)`, `PL_put_*` write into a handle.
- Returns `foreign_t`: `TRUE` (success), `FALSE` (failure), or `PL_RETRY_*` for nondet control.
- `install_t install(void)` is the entry point; `use_foreign_library/1` calls it.

A complete example:

```c
#include <SWI-Prolog.h>
#include <unistd.h>

/* hostname(-Name) */
foreign_t
pl_hostname(term_t name)
{ char buf[256];
  if ( gethostname(buf, sizeof buf) == 0 )
    return PL_unify_atom_chars(name, buf);
  return FALSE;
}

install_t
install(void)
{ PL_register_foreign("hostname", 1, pl_hostname, 0);
}
```

Load from Prolog:

```prolog
:- use_foreign_library(foreign(hostname)).   % finds hostname.so / hostname.dylib
```

Build via the pack's `Makefile` or CMake; `swipl-ld` is the SWI linker driver that knows where the headers and libs are.

### C++ foreign interface

The SWI9 rewrite (`packages/cpp`, https://github.com/SWI-Prolog/packages-cpp) gives full API coverage with type safety (RAII term handles, constructors per type, exception translation). Prefer it for new foreign code.

### QuickCheck for Prolog

`library(quickcheck)` (a pack, not core). Rapidcheck-style property testing: pass a predicate over generators, get random inputs shrunk on failure. `pack_install(quickcheck)` — **verify the live pack name with `pack_list(quickcheck)` before relying on it**.

Gotchas:
- Every `term_t` you create must be inside a foreign frame or it leaks; pair `PL_open_foreign_frame`/`PL_discard_foreign_frame`.
- `PL_get_*_ex` raise a Prolog error on type mismatch; the plain variants silently fail. Use `_ex` for argument validation.
- A nondeterministic foreign predicate uses `PL_FA_NONDETERMINISTIC` and a `frg_t` control argument (`PL_FIRST_CALL`, `PL_REDO`, `PL_CUTTED`); you must track your own continuation state.
- Foreign code is unsafe; a segfault brings down the whole process. The sandbox cannot validate it.

Sources: https://www.swi-prolog.org/pldoc/man?section=packs · https://www.swi-prolog.org/pldoc/man?section=foreigninclude · https://www.swi-prolog.org/pldoc/man?section=foreign-unify · https://swi-prolog.discourse.group/t/registering-a-foreign-predicate/3729

---

## 15. Debugging and introspection dark arts

- `trace/0` — textual tracer. `notrace/0`, `tracing/0`.
- `gtrace/0` — graphical (XPCE/Gtk) debugger. `guitracer/0` makes `trace/0` open it automatically. **`gtrace` is GUI-only and unusable over a plain SSH session without X11/Xvfb** — fall back to `trace/0` on headless boxes.
- `spy(Head)` — set a spy point; `nospy/1` removes. `leashing/1` sets which ports pause (`call`, `exit`, `fail`, `redo`, `unify`; `all`/`full`/`half`/`loose`/`tight`/`none`).
- `visible/1` — set which ports show even when not leashed.
- `debug(Channel, Format, Args)` and `assertion(Goal)` from `library(debug)`. `debugging(Channel)` toggles a channel at runtime; `debug/3` no-ops when the channel is off. This is the production-safe logging mechanism.
- `prolog_trace_interception(Port, Frame, Choice, Action)` — multifile hook; lets you drive the tracer programmatically. `Action` is `continue`, `fail`, `redo`, `retry`, `nodebug`, `abort`, `halt`. https://www.swi-prolog.org/pldoc/doc_for?object=prolog_trace_interception/4
- `vm_list(Head)` — list the compiled VM instructions for a predicate. **This is the assembly dump.**
- **JITI** (just-in-time indexing): SWI builds indexes lazily on first call per argument. `jiti_list` lists them. `:- set_prolog_flag(jiti, false)` disables. Default indexes are on the first argument; multi-argument indexes are created when a query is selective on them.
- `library(statistics)` and the profiler: `profile(Goal)`, `show_profile(N)` show the top-N predicates by wall time and choice points. Requires the profiler build flag.
- `backtrace/1` and `guilty/1` from `library(prolog_stack)` for postmortem.
- `library(check)` runs `check/0` for undefined predicates, stray dynamic decls, etc. (CI-usable.)

The introspection idiom for "what does this predicate look like":

```prolog
?- vm_list(member(_, _)).
?- predicate_property(member(_, _), P).   % dynamic, foreign, interpreted, indexed, etc.
?- current_predicate(Name/user:Arity).    % enumerate
?- clause(Head, Body).                     % read clauses (dynamic/public only)
```

Gotchas:
- `trace/0` in a multithreaded program only traces the calling thread; use `thread_signal/2` to start tracing in another.
- JITI on a predicate that is later abolished and redefined can produce stale indexes; `jiti_list` shows the current set.
- The profiler slows execution by an order of magnitude; do not cite profiler times as production times.
- `debug/3` checks its channel at runtime, but the format string and args are still built; for hot paths use `if_debug(Channel, Goal)` to skip argument construction.

Sources: https://www.swi-prolog.org/pldoc/man?section=debugger · https://www.swi-prolog.org/pldoc/doc_for?object=gtrace/0 · https://www.swi-prolog.org/pldoc/man?section=profile

> **Domain expansion: term expansion, goal expansion, and `vm_list` together.** Most Prolog tutorials stop at `trace/0`. Once you can read the VM (`vm_list/1`), inspect indexes (`jiti_list`), and rewrite code at load time (`goal_expansion/2`), you have a self-modifying compiler you can steer. You build a hot-path inliner in five lines, you see exactly why a predicate is slow (no index, no determinism), and you fix it by adding an index hint rather than rewriting. The debugger stops being a tracer and starts being a profiler, an assembler, and a macro expander at once.

---

## 16. Strings vs atoms vs chars (the SWI7 break)

Manual: https://www.swi-prolog.org/pldoc/man?section=string. Pre-SWI7: `"abc"` read as a list of character codes `[97,98,99]`. SWI7: `"abc"` reads as a `string`, a distinct first-class type, not a list and not an atom.

The four text representations:

- **Atom** — `'abc'` or `abc`. Interned, immutable, GC'd. Identity is by content. Used for symbolic identifiers.
- **String** — `"abc"`. SWI7 default. Mutable bytes, cheap to build, distinct from atoms. Used for text payloads.
- **Codes** — `[97,98,99]`. List of integer code points. Classic DCG output.
- **Chars** — `[a,b,c]`. List of one-char atoms. Readable.

The `double_quotes` flag controls how `"..."` is read. It is per-module. Values: `string` (default in SWI7), `chars`, `codes`, `atom`.

```prolog
:- set_prolog_flag(double_quotes, chars).   % "abc" reads as [a,b,c]
:- set_prolog_flag(double_quotes, codes).   % [97,98,99]
:- set_prolog_flag(double_quotes, atom).    % the atom 'abc'
:- set_prolog_flag(double_quotes, string).  % SWI7 default
```

Conversion predicates: `atom_string/2`, `atom_codes/2`, `atom_chars/2`, `string_codes/2`, `string_chars/2`, `number_string/2`, `number_codes/2`, `term_string/2`.

`string_concat/3`, `string_length/2`, `split_string/4`, `string_upper/2`, `string_lower/2`. `format/2,3` accept strings as the format and write strings as arguments.

`code_type(Code, Property)` — classify a code point: `code_type(65, alpha)`, `code_type(65, digit(W))`, `code_type(0'a, to_upper(U))`. The property set is large (`alpha`, `digit`, `alnum`, `white`, `punct`, `upper`, `lower`, `csym`, etc.).

The classic migration break:

```prolog
% Code written under classic codes convention:
greet(Name) :- atom_codes(Name, Codes), append("Hello, ", Codes, _), ...

% Under SWI7 default, "Hello, " is a string, not a code list.
% append/3 fails. Fix:
greet(Name) :- atom_string(Name, S), string_concat("Hello, ", S, _), ...
```

The disciplined fix is `:- set_prolog_flag(double_quotes, chars).` (or `codes`) at the top of a legacy file, restoring the classic convention. Per-module flags make this safe for a single legacy file inside a modern project.

`back_quotes` (`` `abc` ``) are separate and read as code lists by default in SWI7; this gives a syntax for code lists even when double quotes are strings.

> The community/stale-tutorial angle on this split is its own subsection (§Community → Stale-tutorial warnings). Short version: every popular textbook predating 2015 (Learn Prolog Now!, Adventure in Prolog, Bratko) teaches the classic code-list reading; beginners who copy examples verbatim get `[104,101,108,108,111]` where they expect `"hello"`.

Gotchas:
- `format/2` with `"~s"` expects a code list; `"~a"` expects an atom. For strings use the string-aware form after `string_codes`.
- DCGs that consume `"abc"` literals behave differently under each `double_quotes` setting; the safe form is an explicit list `[0'a,0'b,0'c]` or `abc` as a nonterminal.
- The flag is per-module. Setting it globally in your init file affects code that did not expect it.

Sources: https://www.swi-prolog.org/pldoc/man?section=string · https://www.swi-prolog.org/pldoc/man?section=text-representation · https://github.com/dtonhofer/prolog_notes/blob/master/swipl_notes/various/swipl_string_modes.md · https://stackoverflow.com/questions/8264699/what-is-the-difference-between-and-in-prolog

---

## 17. Operators and arithmetic

- `op(Precedence, Type, Name)` — declare an operator. Precedence 0 removes it; max is 1200. Type: `xf`/`yf`/`fx`/`fy` (pre/postfix), `xfx`/`xfy`/`yfx` (infix). `x` forbids same-precedence chaining; `y` allows it. `Name` may be a list to declare several at once.
- `current_op(Precedence, Type, Name)` — enumerate.
- Operators are module-local. `system` holds the predefined operators and is read-only there.
- `is/2` at precedence 700 evaluates its RHS as an arithmetic expression and unifies with the LHS.
- `=:=/2`, `=\=/2`, `</2`, `>/2`, `=</2`, `>=/2` evaluate both sides and compare. Mode: both sides fully bound, else error.
- Evaluable functions in `is/2`: `+`, `-`, `*`, `/`, `//` (integer div), `mod`, `rem`, `abs`, `min`, `max`, `gcd`, `sign`, `sqrt`, `sin`, `cos`, `tan`, `log`, `exp`, `**`, `>>`, `<<`, `\/`, `/\`, `\`, `random`, etc.
- Rationals: `rdiv/2` (precedence 400). `N rdiv M` constructs an exact rational. `1 rdiv 3 + 1 rdiv 3 = 2 rdiv 3` exactly. `current_prolog_flag(rational, on)` is default.
- Big integers: LibBF-backed (SWI9+), arbitrary precision, transparent. `2^1000` works.
- `number_codes/2`, `number_chars/2`, `number_string/2` — convert between numbers and their textual forms.

Declaring an infix operator:

```prolog
:- op(700, xfx, =>).     % A => B   non-associative at 700
:- op(500, yfx, plus).   % A plus B plus C = (A plus B) plus C
:- op(200, fy,  neg).    % unary, can stack: neg neg X
```

**`is/2` vs CLP(FD) `(#=)/2`**: `is/2` is moded (RHS must be ground), `#/2` is relational (posts a constraint). Prefer `#/2` for integer code; reserve `is/2` for floats, rationals, and the rare case where you have a fully-ground RHS.

Rational + big-int arithmetic:

```prolog
?- X is 1 rdiv 3 + 1 rdiv 2.
X = 5 rdiv 6.

?- X is 2^100.
X = 1267650600228229401496703205376.
```

Gotchas:
- Redeclaring an operator inside a module does not affect other modules; redefining `system` operators raises a permission error.
- `is/2` with a float RHS that cannot be represented exactly (`0.1 + 0.2`) gives the IEEE-754 float, not a rational; use rationals if you need exactness.
- `op/3` at load time affects how subsequent terms in the same file are read; declare operators before any use.
- `|` is restricted: as an infix it must have priority at least 1001 so it cannot appear unparenthesized inside a list (`[a|b]` uses it as the cons bar).

Sources: https://www.swi-prolog.org/pldoc/man?section=operators · https://www.swi-prolog.org/pldoc/man?section=arithpreds · https://www.swi-prolog.org/pldoc/man?section=rational

---

# Changelog Timeline

Sources: https://www.swi-prolog.org/ChangeLog (live, JS-rendered; only the head version's body was directly retrievable), `gh release list/view --repo SWI-Prolog/swipl-devel`, `gh api .../git/refs/tags/*`, and the news archive https://www.swi-prolog.org/news/archive.

## Major-version eras

| Era | Headline theme | Defining changes | Source |
|---|---|---|---|
| **7.x** (7.0 stable 2015-05-20; 7.1/7.3/7.5/7.7 dev lines through ~2018) | The SWI7 break + dicts | New `dict` type & syntax `tag{k:v}`; `"..."` = strings (not atoms); `` `...` `` = code lists; `[]` no longer an atom; first-class rational numbers; tabling groundwork; first "lightweight engines" + delimited continuations (7.4.0-rc1, 2017-01-23); mode-directed tabling (7.6.0-rc1, 2017-09-13); WASM first experiment (2018-06-21) | https://www.swi-prolog.org/news/28588c6c-fee2-11e4-8db3-00163e357fe2 |
| **8.x** (8.0.0 stable 2019-01-14; 8.1/8.3/8.5 dev lines through 2022) | Internal stability + tabling maturation | Dedicated GC thread (better real-time behavior); mode-directed tabling carried forward; **CMake** build replacing autoconf; saved states switch to **ZIP/qlf**; `library(http/http_dyn_workers)` dynamic worker pool; REST path support; hookable HTTP error pages w/ JSON; two big rewrites of `library(socket)`; YAML library; license clarified BSD-2 | https://www.swi-prolog.org/news/68a9fdaa-17f7-11e9-9f79-00163e986a2a |
| **9.x** (9.0.0 stable 2022-11-24; ~3.5-year dev cycle; 9.1/9.2/9.3 dev lines through 2025) | Tabling maturity, transactions, C++ API, WASM | "Mature and feature-rich tabling" (well-founded semantics, incremental, monotonic, shared); **single-sided unification** w/ zero-cost determinism; DB **transactions** (`transaction/1`, `snapshot/1`); new **C++ foreign API** (full coverage, type-safe); **tcmalloc** default on Linux; **Redis** + **STOMP** clients; **WASM port** w/ bidirectional JS interface; **sweep** Emacs module; **LibBF** replacing GMP (permissive license) | https://www.swi-prolog.org/news/7344a70e-6c14-11ed-8489-00163e8f424e |
| **10.x** (10.0.0 stable **2025-12-03**; 10.1 dev line opened after) | Stable release line + WASM/GUI polish | 10.0 announcement not surfaced in the news archive (gap, §Known limits); download page names "native GUI tools across platforms, performance improvements, and enhanced WASM support" as the 10.0 headline. Dev line 10.1.1 → 10.1.12 ran 2026-Q1/Q2/Q3 | https://www.swi-prolog.org/download/stable ; `gh api .../git/refs/tags/V10.0.0` tagger 2025-12-03 ; V10.0.1 = 2026-02-18 |

## Most recent development releases (detail)

Per-version entries come from `gh release view` + the live ChangeLog. Note: SWI-Prolog does not cut GitHub Releases for every dev version; only V10.1.10 / V10.1.11 / V10.1.12 exist as GitHub Releases. Older 10.1.x tags exist as git refs but with no release body.

| Version | Date | Headline changes |
|---|---|---|
| **10.1.12** (current dev) | 2026-07-19 | (1) Windows file names normalized to **on-disk case** (not lowercased); drive letters upper-cased. (2) `-D` flag early processing before boot. (3) **INRIA crmath** library support for correctly-rounded floats. (4) **Crypto**: Ed25519 signatures + X25519 key exchange (PKCS#8 v2). (5) **SSL**: Ed25519/X25519 key loading. (6) C11 `bool` in C API: `PL_get_stdcbool()`, `PL_get_stdcbool_ex()`. (7) `dif/2` canonical propagation via `unifiable/3`, fix infinite loops on cyclic terms, iterative compilation on segstacks. (8) `push_prolog_flag/pop_prolog_flag` thread-local. (9) New libs: `library(random_terms)`, `library(graphviz_term)`, `library(xdot)`. (10) Archive: list-shaped filter/format options; ODBC option handling enhanced. (11) Cleanup: `memberchk/2`→`option/2` across packages, `PL_scan_options()` migration. (12) Fixed: debugger "depth" crash, Windows bigint normalization, `absolute_file_name/3` enumeration during file load. Sources: `gh release view V10.1.12`, https://www.swi-prolog.org/ChangeLog |
| **10.1.11** | 2026-07-05 | Build: detect Intel-Mac Homebrew at `/usr/local` for dependency paths (PR #1502, @IanUtley). `gh release view V10.1.11` |
| **10.1.10** | 2026-06-25 | Portability: include `<poll.h>` based on `HAVE_POLL` not `HAVE_POLL_H` (PR #1501, @pkubaj). `gh release view V10.1.10` |
| 10.1.9 – 10.1.1 | (tagged refs only) | tags exist as git refs (`V10.1.9` `6be143d...` down to `V10.1.1` `e584f67...`); bodies only on the live ChangeLog (not GitHub-released). |
| **10.0.2** (current stable) | after 2026-02-18 | Current stable tarball. Detailed changelog accessible only via the live page's version selector (gap). https://www.swi-prolog.org/download/stable |
| 10.0.1 | 2026-02-18 | stable point release; tag `694abe2b...`. |
| 10.0.0 | 2025-12-03 | 10.x stable line opened. |

## Recently merged PRs (last ~12 months, `gh search prs --merged`)

Highlights (number, merge date, title, url):

- #1509 2026-07-15 "DOC: remove unused code that's the same as the documentation" https://github.com/SWI-Prolog/swipl-devel/pull/1509
- #1504 2026-07-08 "FIx typo in pldoc for require_prolog_versoin/2" https://github.com/SWI-Prolog/swipl-devel/pull/1504
- #1502 2026-06-27 "BUILD: detect Intel-Mac Homebrew at /usr/local for dependency paths" https://github.com/SWI-Prolog/swipl-devel/pull/1502
- #1501 2026-06-17 "FIXED: Include <poll.h> based on HAVE_POLL instead of HAVE_POLL_H" https://github.com/SWI-Prolog/swipl-devel/pull/1501
- #1499 2026-06-05 "wasm: support Emscripten 6.0.0 rename of arguments_ to programArgs" https://github.com/SWI-Prolog/swipl-devel/pull/1499
- #1491 2026-05-18 "Avoid self-deadlock in engine_destroy/1" https://github.com/SWI-Prolog/swipl-devel/pull/1491
- #1490 2026-05-10 "add ord_range" https://github.com/SWI-Prolog/swipl-devel/pull/1490
- #1489 2026-05-10 "add rb_visit_range/4 to rbtrees" https://github.com/SWI-Prolog/swipl-devel/pull/1489
- #1476 2026-02-22 "Exclude jvm.dll from CPack dependencies" https://github.com/SWI-Prolog/swipl-devel/pull/1476

Observation: most PRs are build/portability/doc/tooling fixes; the bulk of substantive engine/feature work lands as direct commits by maintainers (Jan Wielemaker et al.) without PRs, which is why the per-version release bodies on GitHub look thin.

---

# Open Issues and PR Discussion Notes

`gh issue list --repo SWI-Prolog/swipl-devel --limit 50 --state open` returns 50 open issues. Label clusters across those 50:

| Label | Count |
|---|---|
| `bug` | 5 |
| `enhancement` | 3 |
| `Documentation` | 3 |
| `Platform: Windows` | 2 |
| `outside-help-needed` / `Package infra` / `Feature discussion` / `Core` / `API` | 1 each |
| (unlabeled) | ~33 — the majority carry no label |

### High-signal recent issues (2024+)

| # | Date | Title | One-liner | URL |
|---|---|---|---|---|
| 1513 | 2026-07-27 | Problems with graphics tools | XPCE/Graphics tools issues (active, updated today) | https://github.com/SWI-Prolog/swipl-devel/issues/1513 |
| 1369 | 2025-05-21 | Standalone Wasm build | request/caveats for a freestanding WASM build | https://github.com/SWI-Prolog/swipl-devel/issues/1369 |
| 1349 | 2025-02-26 | Build configuration option to ignore a package | CMake `-DIGNORE_<pkg>` style request | https://github.com/SWI-Prolog/swipl-devel/issues/1349 |
| 1342 | 2025-01-16 | Protocols (like COM interfaces) for `PL_blob_t` | FFI feature: interface-style dispatch to blob types | https://github.com/SWI-Prolog/swipl-devel/issues/1342 |
| 1359 | 2025-03-27 | Blackboard and attributes on a naked variable | bug: attribute/blackboard interaction on unbound var | https://github.com/SWI-Prolog/swipl-devel/issues/1359 |
| 1227 | 2024-01-31 | pack_install/1 error with HTTPS URL | pack installer HTTPS failure | https://github.com/SWI-Prolog/swipl-devel/issues/1227 |
| 1222 | 2024-01-16 | SIGSEGV with mode directed tabling | crash in mode-directed tabling | https://github.com/SWI-Prolog/swipl-devel/issues/1222 |
| 1312 | 2024-08-30 | pack_install - requires(prolog:c_cxx) in pack.pl causes crash | pack dependency crash | https://github.com/SWI-Prolog/swipl-devel/issues/1312 |
| 1267 | 2024-04-16 | ieee/rational test failures on OpenBSD | platform-specific numeric test failures | https://github.com/SWI-Prolog/swipl-devel/issues/1267 |

### Long-standing open issues (pre-2022)

- **#389** "Language Server Protocol for Prolog" (2018-12-20, still open) https://github.com/SWI-Prolog/swipl-devel/issues/389
- **#280** "Thread/Engine scalability" (2017-11-10, `enhancement`) https://github.com/SWI-Prolog/swipl-devel/issues/280
- **#142** "Unify documentation system: LaTeX to plDoc" (2016-05-06, `Documentation`) https://github.com/SWI-Prolog/swipl-devel/issues/142
- **#343** "REPL - Syntax highlight in `swipl`" (2018-09-29) https://github.com/SWI-Prolog/swipl-devel/issues/343

### Recurring themes from the open set

(a) **pack_install** fragility (#1312, #1305, #1251, #1227, #393); (b) **`absolute_file_name/3`** semantics (#870, #205, #212, #265); (c) **Windows** platform issues (#450 PATH, #190 foreign DLL, #211 dde, #228 GUI blank, #626 indent); (d) **graphics/XPCE** (#1513, #705 debugger hang, #228); (e) **documentation** rendering (#1112, #117, #142, #642 tabref).

---

# Community Signals

## Tutorials, blogs, courses, papers — inventory

### "The Power of Prolog" — Markus Triska (metalevel.at) — the canonical modern resource

URL https://www.metalevel.at/prolog · Videos https://www.youtube.com/@ThePowerOfProlog · DCG primer https://www.metalevel.at/prolog/dcg · CLP(Z) https://www.metalevel.at/prolog/clpz · FAQ https://www.metalevel.at/prolog/faq/

Author is the maintainer of SWI-Prolog's CLP(B), CLP(FD), and `library(lists)`, plus the boolean- and finite-domain solver papers. Class Central rates it the best free up-to-date Prolog course (https://www.classcentral.com/report/best-free-prolog-courses/). Self-described "always work in progress."

Major sections (0-33): Introduction → Logical Foundations → Basic Concepts → Data Structures → Reading/Writing Prolog → Termination/Nontermination → Integer Arithmetic → Higher-order → Logical Purity → Declarative Testing/Debugging → DCGs → Sorting/Search → Global Variables → Thinking in States → Meta-interpreters → Macros → Combinatorial Optimization → Expert Systems → Web Applications → Cryptography → Business Cases → Theorem Proving → Logic Puzzles → Efficiency → Memoization → AI → Horror Stories → Fun Facts → Engineering Aspects → The Future.

Stance, declared throughout and reinforced in the FAQ: **purity-first and declarative**. Programs should be read in multiple directions; `(is)/2` is replaced by CLP(FD) `(#=)/2` for integers; `!/0` is an "engineering aspect" (ch. 32), not a primary tool. "Failure-slices" (inserting `false/0` to reason about nontermination) is Triska's diagnostic technique. GitHub https://github.com/triska/clpfd.

### "Learn Prolog Now!" (LPN) — classic, with a documented staleness caveat

URL https://lpn.swi-prolog.org/ (SWI-Prolog now hosts the canonical copy). Originally ~2006; SWI explicitly maintains it and inserts compatibility notes ("Learn Prolog Now! needs some updating to be more compatible with SWI"). Predates SWI7 strings (same staleness warning as below). HN discussion (https://news.ycombinator.com/item?id=45900978, 2025, 326 points): "It has two or three different ways of thinking about strings, and it has atoms."

### "Adventure in Prolog" — Dennis Merritt (Amzi!)

Amzi! https://www.amzi.com/ · PDF https://theswissbay.ch/pdf/Gentoomen%20Library/Programming/Prolog/Adventure%20in%20Prolog%20-%20Amzi.pdf. Teaches Prolog by building a text-adventure game then an expert system. Predates SWI7; targets Amzi!'s dialect, not SWI's.

### "Simply Logical — Intelligent Reasoning by Example" — Peter Flach

Live interactive edition https://book.simply-logical.space/ · Source https://github.com/simply-logical/simply-logical · arXiv https://arxiv.org/abs/2208.06823. Originally Wiley 1994; the 2022 interactive edition (Flach with Kacper Sokol) rebuilds every code cell as a runnable SWI-Prolog notebook. Jan Wielemaker is a credited co-author on the 2023 retrospective chapter in *Prolog: The Next 50 Years* (Springer). **One of the few modern, non-stale Prolog textbooks.** Covers Prolog for AI: search, meta-interpreters, expert systems, ML-by-example.

### Jan Wielemaker papers/talks — the implementation author's own writing

Publications index https://www.swi-prolog.org/Publications.html · PhD thesis https://www.swi-prolog.org/download/publications/jan-phd.pdf. Key papers (titles verified against the index):

- **"Pengines: Web Logic Programming Made Easy"** (Lager & Wielemaker, TPLP 14(4-5):539-552, 2014) — DOI https://doi.org/10.1017/S1471068414000192. Defines the Pengine abstraction.
- **"SWISH: SWI-Prolog for Sharing"** (Wielemaker, Lager, Riguzzi, 2015) — arXiv https://arxiv.org/abs/1511.00915.
- **"ClioPatria: A Logical Programming Infrastructure for the Semantic Web"** — https://www.semantic-web-journal.net/system/files/swj988.pdf (revised https://www.semantic-web-journal.net/system/files/swj1074.pdf).
- **"Prolog-based Infrastructure for RDF: Scalability and Performance"** (ISWC 2003) — https://www.swi-prolog.org/download/publications/iswc-03.pdf.
- **"SWI-Prolog version 7 extensions"** (2014) — the string/dict/rationals paper, defines the SWI7 split.
- **"The Boolean Constraint Solver of SWI-Prolog"** (Triska, 2018) https://www.metalevel.at/swiclpb.pdf and **"The Finite Domain Constraint Solver of SWI-Prolog"** (Triska, 2012).
- **"Native Preemptive Threads in SWI-Prolog"** (2003), **"Precise Garbage Collection in Prolog"** (Wielemaker & Neumerkel, 2008), **"Lock-free atom garbage collection for multithreaded Prolog"** (Wielemaker & Harris, 2016).
- **"PlDoc: Wiki style Literate Programming for Prolog"** (2007), **"Coding Guidelines for Prolog"** (Covington et al.).
- Invited: **"A second life for Prolog"** (LTC 2017), **"25 years of SWI-Prolog"** (ICLP 2012).

> **Gap note:** no paper of the exact title "Trawling the Semantic Web" by Wielemaker was found across the publications index, Google Scholar, or DBLP. Likely a misremembered title; the closest actual works are the ClioPatria and ISWC-03 papers above.

### "Prolog Programming for Artificial Intelligence" — Ivan Bratko

Amazon 3rd ed. https://www.amazon.com/Prolog-Programming-Artificial-Intelligence-Bratko/dp/0201403757 · Goodreads https://www.goodreads.com/en/book/show/2054765.PROLOG. Editions: 1st 1986, 2nd ~1990, 3rd 2000/2001, 4th 2012. The canonical academic AI-with-Prolog textbook. Forum thread https://swi-prolog.discourse.group/t/i-look-for-the-source-code-of-the-examples-of-bratkos-book-prolog-programming-for-artificial-intelligence-4th-ed/6185 documents that 4th-ed example source circulates informally; not reworked for SWI7.

### YouTube courses of note

- The Power of Prolog channel https://www.youtube.com/@ThePowerOfProlog (the video companion to the metalevel.at site).
- "Prolog: Tabling" — Prof. Deepak Khemani (IIT Madras) https://youtu.be/S3m2jX-qQjA.
- "Distributed SWI-Prolog Development" — Anne Ogborn https://www.youtube.com/watch?v=JmOHV5IlPyU (Pengines as a service).
- "Debugging a Prolog Query Using Trace in SWI-Prolog" https://www.youtube.com/watch?v=360AHAy8U-E.

---

## Stack Overflow insights (canonical themes)

### Strings vs atoms — the #1 SWI7 confusion

Canonical thread: **"What is the difference between ' and \" in Prolog?"** https://stackoverflow.com/questions/8264699/what-is-the-difference-between-and-in-prolog. Official backdrop: https://www.swi-prolog.org/pldoc/man?section=string, https://www.swi-prolog.org/pldoc/man?section=text-representation. Community guide: dtonhofer/prolog_notes "swipl_string_modes.md" https://github.com/dtonhofer/prolog_notes/blob/master/swipl_notes/various/swipl_string_modes.md. **Technique taught**: `set_prolog_flag(double_quotes, codes|chars|string|atom)` switches interpretation; per-module; default `string` since SWI7.

### `(is)/2` vs CLP(FD) `(#=)/2` — Triska's crusade

SO https://stackoverflow.com/questions/4089885/swi-prolog-and-constraints-library-clpfd. Official: https://www.swi-prolog.org/man/clpfd.html — "when reasoning over integers, simply replace low-level arithmetic predicates like `(is)/2` and `(>)/2` by the corresponding CLP(FD) constraints like `(#=)/2` and `(#>)/2`." Triska's repo https://github.com/triska/clpfd — `?- 3 #= 1+Y. → Y = 2.` works in all directions, while `?- 3 is 1+Y.` errors with `arguments_not_sufficiently_instantiated`. **Technique**: `(#=)/2` is relational and bidirectional; `(is)/2` is functional and requires the RHS fully ground.

### "Why is my query looping forever" — left recursion; tabling as the fix

SO https://stackoverflow.com/questions/79193538/prolog-dcg-in-infinite-loop-without-a-direct-left-recursion. Official https://www.swi-prolog.org/pldoc/man?section=tabling-non-termination. DS Warren book draft https://www.swi-prolog.org/download/publications/tabling-book.pdf. **Technique**: wrap the predicate as `:- table(pred/N).` — variant-based tabling breaks left-recursion. Alternatively rewrite to right-recursion.

### Singleton variable warnings

Official FAQ https://www.swi-prolog.org/FAQ/SingletonVar.md. SO https://stackoverflow.com/questions/30802587/prolog-singleton-variable-in-branch-warning. **Technique**: the warning catches typos (`realted_to` vs `related_to`) and forgot-to-bind. Prefix intentional singletons with `_` to silence.

### `assertz` / dynamic-state pitfalls

SO https://stackoverflow.com/questions/16003575/some-problems-asserting-a-new-rule-in-swi-prolog. Official https://www.swi-prolog.org/pldoc/man?predicate=assertz/1 — since 8.1.1 asserting to a non-dynamic already-defined predicate raises a permission error; `:- dynamic(foo/N).` is required. **Technique**: prefer threading state through arguments (pure style); when `assertz` is unavoidable, declare `dynamic`, avoid asserting recursive rules — use it for simple facts.

### DCG confusion: `phrase/2,3` vs `call/N`

Primer https://www.metalevel.at/prolog/dcg — "a DCG describes a sequence and can be used to parse, generate, complete, and check sequences." Official https://www.swi-prolog.org/pldoc/man?predicate=phrase/3. **Technique**: DCG rules have two hidden args (the difference list / state pair); invoke with `phrase/2` or `phrase/3`, never plain `call/1`. Inside a DCG body, `{Goal}` escapes to plain Prolog. `call//1` is the in-DCG higher-order call.

### `freeze/2` / `when/2` "why didn't my constraint fire"

SO https://stackoverflow.com/questions/13759971/guard-clauses-in-prolog — "the coroutining predicates of SWI-Prolog (`freeze`, `when`, `dif`, etc.) have the functionality of guards." Official https://www.swi-prolog.org/pldoc/man?section=coroutining. **Technique**: constraints fire when the frozen variable is *bound*; if you `freeze(X, G)` and then unify `X = Y` (with `Y` still a variable), `G` does not fire. `dif/2`, `when/2`, and CLP(FD) residuals all live on the same attributed-variable machinery; inspect with `call_residue_vars/2`.

### Pengines / CORS

Reddit https://www.reddit.com/r/prolog/comments/1diirz6/problem_with_cors/. SO https://stackoverflow.com/questions/40071513/cors-in-prolog-not-work ("CORS is disabled by default and is enabled through the `http:cors` setting"). Official lib https://www.swi-prolog.org/pldoc/man?section=httpcors. **Technique**: `:- set_setting(http:cors, [*])` plus `cors_enable` in the handler; Pengines add a wrinkle because the preflight + WS upgrade path needs the CORS headers attached to both the HTTP and the WS handshake.

---

## Reddit signals (r/prolog, r/swipl)

- **"Prolog in 2024"** https://www.reddit.com/r/prolog/comments/1gev7tg/prolog_in_2024/ — the central adoption thread. Top-line community quote: "mainstream adoption of Prolog is a *theoretical* inevitability." Niche-but-alive: RDF/SEMWEB, NL-parsing, expert systems, university teaching.
- **"What is the role of Prolog in AI in 2024?"** https://www.reddit.com/r/prolog/comments/1fdcjkd/ — ontology development and rule-layer reasoning over LLM-extracted facts are the recurring use case.
- **"Best Intro to Prolog in 2025 (for newbies)?"** https://www.reddit.com/r/prolog/comments/1ms39g0/ — confirms continued beginner inflow; respondents steer to Triska's site and LPN (with the strings caveat).
- **"Is Prolog still used today and is it still worth learning?"** https://www.reddit.com/r/prolog/comments/952d5v/ — the frequently-linked "is Prolog dead" thread; rebuttals list active implementations (SWI, SICStus, GNU, Tau/Scryer, Trealla, XSB, Ciao).
- **"Is it worth getting a SICStus personal license?"** https://www.reddit.com/r/prolog/comments/yujsa9/ — the recurring SWI-vs-SICStus debate. Common verdict: only if you need SICStus-specific features (Jasper Java/Eclipse, exact ISO mode, licensed runtime distribution); otherwise SWI is free and more batteries-included.
- **"Prolog vs minikanren"** https://www.reddit.com/r/prolog/comments/78l31c/ — the cross-language comparison thread (see Adoption §Competitive landscape).

Languages Redditors reach for in comparison: **miniKanren / clojure core.logic** (embedded, pure-relational), **datalog / Soufflé** (deductive database), **microKanren**, less often **Mercury** (typed) and **Rust+egg** (modern e-graphs).

The "is Prolog dead" framing recurs in every ~6-month cycle. Rebuttals converge on: RDF/SemWeb niche (ClioPatria, Wikidata, cultural-heritage KGs), NL parsing (DCGs), expert systems, education (AI course requirement), and the 2024-25 LLM-reasoning angle.

> **Fetch caveat:** Reddit fetch was blocked at the HTTP layer in this research; Reddit signals above are reconstructed from search-engine snippets that quote the threads, not from full thread reads. Specific quotes are attributed to the search-result text, not verified in-thread.

---

## Discourse forum signals (swi-prolog.discourse.group)

The forum is the primary community venue; the old Google Groups list (https://groups.google.com/g/swi-prolog) is deprecated and read-only. **Jan Wielemaker himself answers a large share of threads** — unusual for a language of this scale and the forum's defining feature.

### "What happens if Dr. Wielemaker is hit by a van?" — bus factor

https://swi-prolog.discourse.group/t/what-happens-if-dr-wielemaker-is-hit-by-a-van/3734. Notable (paraphrased, on tabling): "If you don't use the new features (like tabling) the probability of you hitting a bug is rather low." The community's own acknowledgment of dependency risk; mitigation is the multi-contributor model at https://www.swi-prolog.org/Contributors.html.

### "Scaling to billions of facts?" — the canonical scale thread

https://swi-prolog.discourse.group/t/scaling-to-billions-of-facts/380 (Mar 2019 → Feb 2026). Wielemaker's answer (2019): for facts that don't fit in RAM, use a key-value store with QLF representations as values, clause numbers as keys, a shadow cache, JIT indexing on instantiation patterns; or memory-map a clever file format for static data; or distribute clauses across Prolog instances (loses ordering and cuts). **Dec 2024 update**: **RocksDB is production quality**; the `rocksdb` pack is the recommended embed. EricGT demonstrated **671 million facts in 60.01 GB** with the rocksdb pack. Companion doc https://www.swi-prolog.org/pldoc/man?section=semweb-scalability.

### "Starting a HTTP server and suspending the toplevel" — production server deploy

https://swi-prolog.discourse.group/t/starting-a-http-server-and-suspending-the-toplevel/7677. The recurring "how do I deploy SWI as a service" thread. Pattern: detach the HTTP server from the interactive toplevel so it survives logout. SO systemd companion https://stackoverflow.com/questions/59531698/. Official https://www.swi-prolog.org/pldoc/man?section=http-running-server. Official Docker https://www.swi-prolog.org/Docker.html, images https://hub.docker.com/u/swipl/, CI https://github.com/SWI-Prolog/docker-swipl-linux-ci.

### "SWI-Prolog and Erlang — tightly integrated?" — engines/threads model

https://swi-prolog.discourse.group/t/swi-prolog-and-erlang-tightly-integrated/4615. Explains engines-vs-threads: SWI has preemptive threads (~32k create/join/s, C-based) and engines (private stacks + message queues). Pengines = engines reachable over HTTP. Companion https://www.swi-prolog.org/pldoc/man?section=foreign-yield (thread-per-connection + yielding from foreign code).

### Sandbox / Pengine security

https://swi-prolog.discourse.group/t/marking-crypto-library-as-safe-in-sandbox-for-pengines/4675. Official https://www.swi-prolog.org/pengines/AppLogic.md, https://www.swi-prolog.org/pldoc/man?section=pengine-overview. **Real RCE exploit against non-sandboxed Pengine servers** (Kim Hammar): https://kim-hammar.com/pengine-rce-exploit. Lesson repeatedly enforced: never run a public Pengine endpoint without the sandbox unless you control every client.

### Other high-value recurring threads

- https://swi-prolog.discourse.group/t/help-with-tabling-to-avoid-infinite-left-recursion/1630 — tabling edge cases.
- https://swi-prolog.discourse.group/t/i-dont-understand-why-this-query-do-not-terminate/5186 — nontermination diagnosis with coroutining.
- https://swi-prolog.discourse.group/t/battling-with-cors-enable/2078 — CORS in practice.
- https://swi-prolog.discourse.group/t/calling-call-1-makes-dcg-nonfunctional-difference-list-in-dcgs-vs-difference-list-for-appending/2616 — DCG mechanics.
- https://swi-prolog.discourse.group/t/prolog-and-llms-genai/8699 — the LLM+Prolog thread; community notes LLMs are inadequate for production Prolog beyond basic examples.
- https://swi-prolog.discourse.group/t/rdf-basics/4105 — RDF getting-started pointer to the two-API split.
- https://swi-prolog.discourse.group/t/redistributing-swi-prolog-runtime/7057 — redistributing a portable runtime subset.

---

# Adoption and Competitive Landscape

## Where SWI-Prolog is actually used in production

- **Semantic Web / RDF / knowledge graphs**: the ClioPatria stack (https://www.semantic-web-journal.net/system/files/swj988.pdf) is a SWI-Prolog application server and triple store. Cultural-heritage KGs (CLARIAH, Dutch national infrastructure), Wikidata-adjacent tooling, humanities research platforms (UvA, VU Amsterdam) run on it. `library(semweb/*)` is the foundation.
- **Natural-language parsing**: DCGs remain a Prolog signature; SWI's `library(http)` + DCGs back NL-question-answering systems over RDF KGs (PENG, ACE/Attempto-adjacent toolchains).
- **Configuration / business rules**: legacy and niche; the PROSYN porting/refactoring case study (Mera & Wielemaker 2023) documents a real business-rules modernization.
- **Education**: AI-course requirement in many universities; SWI is the de facto teaching implementation (free, cross-platform). SWISH https://swish.swi-prolog.org/, https://github.com/SWI-Prolog/swish is the notebook frontend.
- **Theorem proving / constraint problems**: CLP(FD), CLP(B), CHR — combinatorial optimization, scheduling, cryptography.
- **HTTP APIs**: `library(http/http_open)`, `library(http/http_server)`, `library(http/http_dispatch)` power real APIs; the threading model measured an 80x speedup on a 128-core system (https://www.swi-prolog.org/features.html).
- **LLM tool-augmented reasoning** (2024-25 surge): SWI-Prolog as the callable reasoning engine behind LLM-generated Prolog. HN threads https://news.ycombinator.com/item?id=41831735, https://news.ycombinator.com/item?id=44853589, https://news.ycombinator.com/item?id=45712554; the arXiv paper "Training Language Models to Use Prolog as a Tool" (https://arxiv.org/html/2512.07407) uses SWI as the interactive callable engine; the Discourse forum has a dedicated thread https://swi-prolog.discourse.group/t/prolog-and-llms-genai/8699. Community verdict: bullish on the symbolic-reasoning gap Prolog fills, with the caveat that LLMs still produce buggy Prolog beyond toy examples. This is a genuine second-life driver that was not on the radar two years ago.

Commercial-deployment posture: https://www.swi-prolog.org/commercial/ (reliable hot-swap of code on active multi-threaded servers is a named feature).

## Competitive landscape

Wikipedia comparison: https://en.wikipedia.org/wiki/Comparison_of_Prolog_implementations. Bench suite (van Roy) ported to 8 systems: https://github.com/SWI-Prolog/bench — runs on SWI, SICStus, YAP, Ciao, Scryer, GNU-Prolog, XSB, Trealla. Forum discussion https://swi-prolog.discourse.group/t/porting-the-swi-prolog-benchmark-suite-comparing-8-prolog-systems/6997.

- **SWI-Prolog** — free, BSD-2, batteries-included. The default pick for non-commercial work and most teaching.
- **SICStus Prolog** — commercial, SICS, https://sicstus.sics.se/order4.html. Commercial license ~€10,400, academic ~€2,800, personal/non-commercial ~€1,980. Chosen for ISO strictness, the Jasper Java interface, and licensed runtime distribution. "SICStus Prolog — the first 25 years" https://www.researchgate.net/publication/47822182.
- **GNU Prolog** — free, lightweight, compiles to native code. Picked when you want a small, native-code Prolog.
- **Scryer Prolog** — modern ISO-conformant, Rust implementation. HN https://news.ycombinator.com/item?id=40994897 flags its space-efficiency for char lists (~24× more compact). The "modern ISO" pick.
- **Trealla Prolog** — compact, modern, WASM-friendly; increasingly relevant for browser/embedded targets.
- **XSB Prolog** — tabling heritage; where well-founded semantics, answer-subsumption, and TMS were pioneered. SWI's tabling is partly XSB-derived.
- **Ciao Prolog** — https://ciao-lang.org/. Unique for its assertion language and the CiaoPP abstract-interpretation static analyzer (infers types+modes+non-failure). Picked when you want static type/mode analysis. Paper https://www.sciencedirect.com/science/article/pii/S0167642305000468.
- **Visual Prolog** — typed, mode-constrained, object-oriented; its own dialect, not ISO.
- **Mercury** — https://mercurylang.org/about.html. Strongly-typed logic language (Haskell-like type/mode/determinism system); picked when static typing is non-negotiable.
- **miniKanren / core.logic** — not Prolog, but the closest relational-programming cousin. Official comparison https://minikanren.org/minikanren-and-prolog.html. Differences: miniKanren is pure (no `!/assert/retract`), uses complete interleaving search instead of DFS (avoids some infinite loops at a memory cost), uses occur-check unification, is thread-safe/trivially parallelizable, has symbolic constraints (`symbolo`, `numbero`, `absento`, `dif`) instead of extra-logical predicates, and respects lexical scope.

## Why people pick SWI specifically

- Free (BSD-2), cross-platform, single-binary install including Windows.
- Batteries-included: RDF/semweb, HTTP server+client, threads, engines, tabling, CLP(FD)/CLP(B)/CHR, PlDoc literate docs, PlUnit tests, a profiler, a graphical debugger (gtrace), and SWISH notebooks all ship in the base.
- Pengines (web logic programming over HTTP) is unique.
- Active maintenance with a fast release cadence (10.x as of 2026) and the maintainer answering forum threads directly.
- The semantics of SWI7 (strings, dicts) are arguably more humane than classic code-lists, even though they cost the LPN-porting pain.

---

# Friction and Pain Points

- **Learning curve**: the declarative reading is taught badly. HN (https://news.ycombinator.com/item?id=45900978): "the vast majority of courses treat Prolog as any other programming language and jump straight to the peculiarities of the syntax" without explaining resolution theorem proving. Recommended entry: Kowalski 1974 as the "Rosetta stone of logic languages."
- **IDE/debugging story**: `gtrace` is XPCE/GUI-only and unusable over a plain SSH session without X11 forwarding or Xvfb. Official https://www.swi-prolog.org/gtrace.md, https://www.swi-prolog.org/pldoc/man?section=guitracer. Text-based `trace/0` (https://www.swi-prolog.org/pldoc/man?section=debugoverview) is the headless fallback. Forum https://swi-prolog.discourse.group/t/how-do-we-run-the-graphical-debugger/6812 collects workarounds (VS Code terminal, X11, Xvfb). SO https://stackoverflow.com/questions/42865128/how-to-use-an-effective-debugger-trace-for-prolog.
- **Performance misconceptions**: SWI is fast for a logic language (native threads, 80x on 128 cores per https://www.swi-prolog.org/features.html; lock-free atom GC) but not for raw number crunching; users repeatedly land in CLP(FD) for scheduling and are surprised when they should have used a vectorizable inner loop in C/Rust. Swapping to SICStus for a 2-3x speedup on specific workloads is a recurring claim.
- **Deployment packaging**: `swipl --stand_alone=true` (https://www.swi-prolog.org/pldoc/man?section=flags), QLF compilation (https://www.swi-prolog.org/pldoc/man?section=qlf), `swipl-ld` for embedded executables. Windows standalone requires bundling `libgcc_s_seh-1.dll`, `libgmp-10.dll`, etc. (SO https://stackoverflow.com/questions/71097035/swi-prolog-stand-alone-executable). Runtime size is non-trivial (tens of MB), which surprises people coming from scripting languages.
- **Module system**: the learning curve for `:- module/2`, imports/exports, `use_module/1,2`, meta-predicate declarations, and the dynamic/global nature of predicates is a documented stumbling block. PlDoc and `check/0` help.
- **No type system**: the untyped base is the loudest friction point for users coming from typed FP. SWI ships `check/0` (CI-usable; finds undefined preds/singletons), the `perfunctory_types` pack (syntactic typechecker https://www.swi-prolog.org/pack/list?p=perfunctory_types), and is the target of HHU's "optional static type system for Prolog" research (https://stups.hhu-hosting.de/downloads/pdf/plstatic-pre.pdf). The real escape is **Ciao/CiaoPP** (assertion-based abstract interpretation, infers types+modes+non-failure) or **Mercury** (mandatory strong typing) or **Visual Prolog** (declared domains/types/modes).
- **Mutable-state trap**: `assertz`/`retract` and dynamic predicates feel imperative to newcomers and break declarative debugging (HN https://news.ycombinator.com/item?id=26522746).
- **Pengine sandbox**: getting safe-declarations right for `library(crypto)` and similar is fiddly; non-sandboxed pengines are an RCE (https://kim-hammar.com/pengine-rce-exploit).
- **Bus factor**: see above. The project is healthier than "one person" but the dependency on Wielemaker is explicit community knowledge.

---

# Stale-Tutorial Warnings

The **SWI7 string split** is the single biggest source of stale-tutorial confusion. Verified inventory:

- **"Learn Prolog Now!"** (https://lpn.swi-prolog.org/) — predates SWI7. Double-quoted text is taught as a list of character codes; modern SWI reads it as `string`. The migration shim, for any classic-Prolog code: `:- set_prolog_flag(double_quotes, codes).` (or `chars` for the char-list reading). SWI's hosted copy now inserts notes. Migration guide https://www.swi-prolog.org/pldoc/man?section=ext-dquotes-port, helpers https://www.swi-prolog.org/pldoc/man?section=ext-dquotes-port-predicates.
- **"Adventure in Prolog"** (Merritt/Amzi!) — same pre-SWI7 era; same strings-as-codes assumption. Code also targets Amzi!'s dialect.
- **Bratko** — 4th ed. 2012, just after SWI7 (2013); text uses classic strings throughout. 4th-ed example sources circulate informally and have not been reworked for SWI7 strings.
- **"Simply Logical"** — the 2022 interactive edition (https://book.simply-logical.space/) is the rare non-stale textbook; cells run modern SWI. The 1994 Wiley PDF does NOT.
- **"The Power of Prolog"** — current, non-stale, the recommended modern reference.

**CLP(FD) staleness**: pre-2012 examples that load `:- use_module(library(clpfd)).` may not need the explicit import in modern SWI (autoloading). The bigger staleness is examples still teaching `(is)/2` for integer arithmetic when `(#=)/2` is the correct modern form (Triska's position). Old tutorial code using `(>=)/2`, `(=:=)/2` is still fine but one-directional. The solver papers (https://www.metalevel.at/swiclpb.pdf, 2012 FD solver paper) are current as references.

**RDF/semweb API migration**: `library(semweb/rdf_db)` is the legacy low-level API; `library(semweb/rdf11)` is the RDF-1.1-aligned replacement. Overview https://www.swi-prolog.org/pldoc/man?section=semweb-rdfapi, new API https://www.swi-prolog.org/pldoc/man?section=semweb-rdf11, explicit "Issues with rdf_db" https://www.swi-prolog.org/pldoc/man?section=rdfissues. Old tutorials and SO answers (e.g. https://stackoverflow.com/questions/2860566/) target `rdf_db`; modern code should target `rdf11`.

**Library moves**: across the 8.x/9.x line several libraries moved packages (semweb, http, pengines, clib). Older tutorials that hard-code `use_module(library(...))` paths occasionally miss the rename; consult the current manual rather than a 2015-era blog.

---

# Known Limits and Gaps (research-level)

Gaps the research could not close, flagged for honesty:

1. **10.0.x point-release dates**: V10.0.0 (2025-12-03) and V10.0.1 (2026-02-18) tagger dates are pinned via `gh api`. **10.0.2** is the current stable but has no annotated GitHub tag and no GitHub release; its specific release date is only on the live per-version ChangeLog, which is JS-rendered and not directly fetchable.
2. **Per-version ChangeLog bodies for 10.0.x and 10.1.0–10.1.9**: the live ChangeLog only renders the head version's body for a non-interactive fetch; the per-version selector is JS-driven. `git log vA..vB --oneline` against `master` is the alternative path.
3. **No "SWI-Prolog 10 announcement" article** in the news archive (articles exist for 7/8/9 only). Any tutorial citing a "10.0 announcement" is wrong.
4. **Reddit fetch was blocked** at the HTTP layer; Reddit signals are reconstructed from search-engine snippets, not full thread reads.
5. **Pengines wire format** (exact JSON/SSE envelope shapes) summarized, not shown line by line. The Pengines paper (https://doi.org/10.1017/S1471068414000192) and `pengines.js` source hold authoritative envelopes.
6. **ClioPatria** deployment specifics are one-line; the full app-server story deserves its own pass.
7. **`library(quickcheck)`** referenced as a pack without verifying the live pack name/API; run `pack_list(quickcheck)` before relying on it.
8. **CHR (Constraint Handling Rules)** is off the topic list here; it is itself a dark art built on attributed variables and warrants its own subsection for the complete constraint tier. Manual https://www.swi-prolog.org/pldoc/man?section=chr, package https://github.com/SWI-Prolog/packages-chr.
9. **Exact version-introduction minor numbers** for engines (7.x), WFS (8.1.x), monotonic tabling (8.1.x) are given as "stable in 9.x" rather than precise minors.

Language/implementation limits (recurring community findings):

10. **Tabling is not a universal solver** (see §Tabling honest correction): terminates only for bounded term depth; WFS is three-valued; constraints are a separate engine. Not the one ring past the stratified-Datalog fragment.
11. **Tabling + mode-directed SIGSEGV** has been filed (#1222, 2024-01-16). Tabling has sharp edges in production.
12. **No native LSP server** (#389 open since 2018). The `sweep` Emacs module is the closest thing to language tooling.
13. **No native answer-set / stable-model semantics** — that's ASP, a different paradigm; you can encode it but SWI doesn't ship it.
14. **Foreign code is unsafe**; a segfault brings down the process and the sandbox cannot validate it.

---

# LLM Usage Notes

How to use this reference with an LLM, and the common mistakes to correct for.

**Frequent LLM mistakes about SWI-Prolog** (and the fix to demand):

| Mistake | Fix |
|---|---|
| Uses `(is)/2`, `(=:=)/2`, `(>)` for integer arithmetic | Replace with `(#=)/2`, `(=\=)/2`, `(#>)` from `library(clpfd)` so the code is relational and bidirectional |
| Writes a left-recursive predicate that loops forever | Add `:- table pred/N.` or rewrite to right-recursion |
| Emits `"abc"` in example code without naming the `double_quotes` flag | State which mode: default `string`; `chars`/`codes` for DCGs and classic-style |
| Forgets `:- dynamic foo/N.` before `assertz` | Always declare dynamic first (8.1.1+ raises a permission error otherwise) |
| Writes a meta-predicate without `:- meta_predicate` | Declare it, or the caller's module won't attach to meta-arguments (the classic module bug) |
| Calls a DCG nonterminal as `foo(S0,S)` directly | Always invoke via `phrase/2,3` (or `call_dcg/3` for state threading) |
| Recommends running a public Pengine without the sandbox | Never. Non-sandboxed pengines are RCE (https://kim-hammar.com/pengine-rce-exploit). Gate with `safe_goal/1` / `safe_primitive/1` |
| Cites 9.x as current | Current major is **10.x** (stable 10.0.2, dev 10.1.12, 2026-07-19) |
| Treats `tnot/1` as if it gives a two-valued answer | WFS is three-valued; `tnot/1` over cyclic negation yields `undefined`, not false |
| Recommends a "tabling solves everything" framing | It terminates only for bounded term depth; not a universal solver (see §Tabling correction) |
| Forgets `PL_open_foreign_frame`/`PL_discard_foreign_frame` in C FFI | Pair them always, or term handles leak |

**Prompting guidance**: when asking an LLM for SWI-Prolog code, pre-load these constraints — (a) target SWI 10.x, (b) use CLP(FD) `(#=)/2` for integers, (c) state the `double_quotes` mode in any file using `"..."`, (d) declare `dynamic` and `meta_predicate` where needed, (e) prefer `:- table` over hand-rolled memoization for reachability/closure, (f) for any HTTP/Pengine code, demand the sandbox path. This reference is the source of truth to cite back when the LLM drifts.

**When to reach for SWI in the first place**: RDF/knowledge-graph work (first-class), relational/constraint search (CLP(FD)), parsing (DCGs), rule-layer reasoning over an LLM-extracted fact base, teaching logic. *Not* raw numerics, *not* when you need a static type system (use Mercury/Ciao), *not* when you need answer-set semantics (use an ASP solver).

---

# High-Value Examples

The "if you remember five things" set — runnable, canonical, each illustrating one leverage move.

**1. CLP(FD) bidirectionality — factorial works in any direction.**

```prolog
:- use_module(library(clpfd)).
n_factorial(0, 1).
n_factorial(N, F) :- N #> 0, N1 #= N-1, F #= N*F1, n_factorial(N1, F1).

?- n_factorial(5, F).    % forward  -> F = 120
?- n_factorial(N, 120).  % backward -> N = 5
```

**2. Tabling terminates left-recursion + cyclic graphs.**

```prolog
:- table path/2.
path(X, Y) :- edge(X, Y).
path(X, Y) :- edge(X, Z), path(Z, Y).
```

The two-clause transitive closure that loops forever without tabling; with `:- table path/2.` it terminates on a million-node cycle.

**3. Sound negation via `tnot/1` (well-founded semantics).**

```prolog
:- table p/0, q/0.
p :- tnot(q).   % p is true iff q cannot be proven
```

Plain `\+/1` over a non-terminating predicate is useless; `tnot/1` requires tabling and gives real logical negation that composes with recursion (three-valued: `undefined` for cycles).

**4. An engine as a resumable generator.**

```prolog
?- engine_create(X, between(1, 5, X), E),
   engine_next(E, A1), engine_next(E, A2).
A1 = 1, A2 = 2.
```

**5. A term-expansion macro that generates clauses at load time.**

```prolog
user:term_expansion(log_decl(Name, _), [(:- dynamic(Name/1)), assert_pred(Name)]).
```

The compiler hands you its own AST as ordinary terms; DCGs, CLP(FD), and your DSL are all the same move.

---

# Source Links (consolidated master list)

**Official SWI-Prolog:**
1. Homepage — https://www.swi-prolog.org/
2. Reference Manual root — https://www.swi-prolog.org/pldoc/doc_for?object=manual
3. Overview (features) — https://www.swi-prolog.org/pldoc/man?section=overview
4. Tabling — https://www.swi-prolog.org/pldoc/man?section=tabling
5. Engines — https://www.swi-prolog.org/pldoc/man?section=engines
6. CLP(FD) — https://www.swi-prolog.org/pldoc/man?section=clpfd
7. Attributed variables — https://www.swi-prolog.org/pldoc/man?section=attvar
8. Term/goal expansion — https://www.swi-prolog.org/pldoc/doc_for?object=term_expansion/2 · https://www.swi-prolog.org/pldoc/doc_for?object=goal_expansion/2
9. Modules / meta-predicates — https://www.swi-prolog.org/pldoc/man?section=modules · https://www.swi-prolog.org/pldoc/man?section=metapred
10. Sandbox — https://www.swi-prolog.org/pldoc/doc/_SWI_/library/sandbox.pl
11. Pengines — https://www.swi-prolog.org/pldoc/man?section=pengines · https://www.swi-prolog.org/pengines/AppLogic.md
12. HTTP — https://www.swi-prolog.org/pldoc/man?section=http · https://www.swi-prolog.org/pldoc/man?section=httpcors
13. Semweb / RDF11 / SPARQL — https://www.swi-prolog.org/pldoc/man?section=semweb · https://www.swi-prolog.org/pldoc/man?section=rdf11 · https://www.swi-prolog.org/pldoc/man?section=sparql_client · https://www.swi-prolog.org/pldoc/man?section=semweb-rdfapi · https://www.swi-prolog.org/pldoc/man?section=rdfissues
14. Foreign interface — https://www.swi-prolog.org/pldoc/man?section=foreigninclude · https://www.swi-prolog.org/pldoc/man?section=foreign-unify
15. DCGs — https://www.swi-prolog.org/pldoc/man?section=DCG · https://www.swi-prolog.org/pldoc/man?section=lib-dcg-basics
16. Strings / text representation — https://www.swi-prolog.org/pldoc/man?section=string · https://www.swi-prolog.org/pldoc/man?section=text-representation · https://www.swi-prolog.org/pldoc/man?section=ext-dquotes-port
17. plunit / PlDoc — https://www.swi-prolog.org/pldoc/man?section=plunit · https://www.swi-prolog.org/pldoc/man?section=pldoc
18. Packs — https://www.swi-prolog.org/pldoc/man?section=packs · https://www.swi-prolog.org/pack/list
19. Debugger / profiler — https://www.swi-prolog.org/pldoc/man?section=debugger · https://www.swi-prolog.org/pldoc/man?section=profile · https://www.swi-prolog.org/pldoc/doc_for?object=prolog_trace_interception/4
20. Operators / arithmetic / rationals — https://www.swi-prolog.org/pldoc/man?section=operators · https://www.swi-prolog.org/pldoc/man?section=arithpreds · https://www.swi-prolog.org/pldoc/man?section=rational
21. ChangeLog — https://www.swi-prolog.org/ChangeLog
22. Downloads (stable) — https://www.swi-prolog.org/download/stable
23. News archive — https://www.swi-prolog.org/news/archive (SWI7 https://www.swi-prolog.org/news/28588c6c-fee2-11e4-8db3-00163e357fe2 · SWI8 https://www.swi-prolog.org/news/68a9fdaa-17f7-11e9-9f79-00163e986a2a · SWI9 https://www.swi-prolog.org/news/7344a70e-6c14-11ed-8489-00163e8f424e)
24. Publications — https://www.swi-prolog.org/Publications.html
25. Features / Commercial — https://www.swi-prolog.org/features.html · https://www.swi-prolog.org/commercial/
26. Docker — https://www.swi-prolog.org/Docker.html · https://hub.docker.com/u/swipl/ · https://github.com/SWI-Prolog/docker-swipl-linux-ci
27. ClioPatria — https://cliopatria.swi-prolog.org/
28. SWISH — https://swish.swi-prolog.org/ · https://github.com/SWI-Prolog/swish
29. Contributors — https://www.swi-prolog.org/Contributors.html
30. WASM NPM — https://www.npmjs.com/package/swipl-wasm

**GitHub (`gh` receipts inline throughout):**
31. swipl-devel repo — https://github.com/SWI-Prolog/swipl-devel
32. Releases — https://github.com/SWI-Prolog/swipl-devel/releases
33. High-signal issues — #1513 https://github.com/SWI-Prolog/swipl-devel/issues/1513 · #1369 https://github.com/SWI-Prolog/swipl-devel/issues/1369 · #1342 https://github.com/SWI-Prolog/swipl-devel/issues/1342 · #1222 https://github.com/SWI-Prolog/swipl-devel/issues/1222 · #389 (LSP, open since 2018) https://github.com/SWI-Prolog/swipl-devel/issues/389 · #280 https://github.com/SWI-Prolog/swipl-devel/issues/280
34. Packages — chr https://github.com/SWI-Prolog/packages-chr · cpp https://github.com/SWI-Prolog/packages-cpp · semweb https://github.com/SWI-Prolog/packages-semweb · http https://github.com/SWI-Prolog/packages-http · pengines https://github.com/SWI-Prolog/packages-pengines · plunit https://github.com/SWI-Prolog/packages-plunit · bench https://github.com/SWI-Prolog/bench

**Tutorials / papers:**
35. The Power of Prolog (Triska) — https://www.metalevel.at/prolog · DCG https://www.metalevel.at/prolog/dcg · CLP(Z) https://www.metalevel.at/prolog/clpz · FAQ https://www.metalevel.at/prolog/faq/ · channel https://www.youtube.com/@ThePowerOfProlog · clpfd repo https://github.com/triska/clpfd · CLP(B) solver paper https://www.metalevel.at/swiclpb.pdf
36. Learn Prolog Now! — https://lpn.swi-prolog.org/
37. Simply Logical (Flach) — https://book.simply-logical.space/ · https://arxiv.org/abs/2208.06823
38. Wielemaker papers — PhD https://www.swi-prolog.org/download/publications/jan-phd.pdf · Pengines DOI https://doi.org/10.1017/S1471068414000192 · SWISH https://arxiv.org/abs/1511.00915 · ClioPatria https://www.semantic-web-journal.net/system/files/swj988.pdf · ISWC-03 RDF https://www.swi-prolog.org/download/publications/iswc-03.pdf · tabling book draft https://www.swi-prolog.org/download/publications/tabling-book.pdf
39. Bratko — https://www.amazon.com/Prolog-Programming-Artificial-Intelligence-Bratko/dp/0201403757
40. DCG course (Anniepoo) — https://github.com/Anniepoo/swipldcgtut/blob/master/dcgcourse.adoc
41. String modes (dtonhofer) — https://github.com/dtonhofer/prolog_notes/blob/master/swipl_notes/various/swipl_string_modes.md
42. Ciao / CiaoPP — https://ciao-lang.org/ · https://www.sciencedirect.com/science/article/pii/S0167642305000468
43. Mercury — https://mercurylang.org/about.html
44. miniKanren comparison — https://minikanren.org/minikanren-and-prolog.html
45. Prolog comparison (Wikipedia) — https://en.wikipedia.org/wiki/Comparison_of_Prolog_implementations
46. LLM-as-a-tool paper — https://arxiv.org/html/2512.07407
47. Pengine RCE exploit (Hammar) — https://kim-hammar.com/pengine-rce-exploit
48. HHU optional static types for Prolog — https://stups.hhu-hosting.de/downloads/pdf/plstatic-pre.pdf
49. Prolog: The Next 50 Years (Springer) — https://www.springerprofessional.de/en/prolog-the-next-50-years/25504708

**Community threads:**
50. "Prolog in 2024" — https://www.reddit.com/r/prolog/comments/1gev7tg/prolog_in_2024/
51. "Prolog in AI in 2024" — https://www.reddit.com/r/prolog/comments/1fdcjkd/
52. "Best Intro 2025" — https://www.reddit.com/r/prolog/comments/1ms39g0/
53. "SICStus license worth it?" — https://www.reddit.com/r/prolog/comments/yujsa9/
54. "Prolog vs minikanren" — https://www.reddit.com/r/prolog/comments/78l31c/
55. Bus factor — https://swi-prolog.discourse.group/t/what-happens-if-dr-wielemaker-is-hit-by-a-van/3734
56. Scaling to billions — https://swi-prolog.discourse.group/t/scaling-to-billions-of-facts/380
57. HTTP server deploy — https://swi-prolog.discourse.group/t/starting-a-http-server-and-suspending-the-toplevel/7677
58. Erlang integration — https://swi-prolog.discourse.group/t/swi-prolog-and-erlang-tightly-integrated/4615
59. Sandbox+crypto — https://swi-prolog.discourse.group/t/marking-crypto-library-as-safe-in-sandbox-for-pengines/4675
60. LLMs+Prolog — https://swi-prolog.discourse.group/t/prolog-and-llms-genai/8699
61. Stack Overflow: ' vs " — https://stackoverflow.com/questions/8264699/what-is-the-difference-between-and-in-prolog
62. SO: CLP(FD) — https://stackoverflow.com/questions/4089885/swi-prolog-and-constraints-library-clpfd
63. SO: left recursion — https://stackoverflow.com/questions/79193538/prolog-dcg-in-infinite-loop-without-a-direct-left-recursion
64. SO: assertz — https://stackoverflow.com/questions/16003575/some-problems-asserting-a-new-rule-in-swi-prolog
65. SO: freeze/when — https://stackoverflow.com/questions/13759971/guard-clauses-in-prolog
66. SO: CORS — https://stackoverflow.com/questions/40071513/cors-in-prolog-not-work
67. SO: standalone exe — https://stackoverflow.com/questions/71097035/swi-prolog-stand-alone-executable
68. HN: LPN strings — https://news.ycombinator.com/item?id=45900978
69. HN: Scryer — https://news.ycombinator.com/item?id=40994897
70. HN: LLM+Prolog — https://news.ycombinator.com/item?id=41831735 · https://news.ycombinator.com/item?id=44853589 · https://news.ycombinator.com/item?id=45712554

---

*End of reference. Refresh by re-running the deep-capability-research command; the three streams' raw drafts are kept under `commands/.tmp-swipl-research/` until cleared.*

