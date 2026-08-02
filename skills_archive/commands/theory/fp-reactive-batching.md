---
description: FP/Haskell prior art for reactive batching runtimes — Haxl, FRP, Arrows, Free monads, Differential Dataflow, Build Systems à la Carte, Self-Adjusting Computation, Compiling to Categories. Load when designing the semantics of a pure-op+interpreter runtime.
---

# fp-reactive-batching

## Thesis

A reactive runtime where ops are pure and the interpreter batches structurally is the intersection of seven mature research traditions: Applicative-only batching (Haxl), semantic FRP with GC-friendly representations (Push-Pull, Reflex), Arrow-typed dataflow whose static skeleton is inspectable (Yampa), free/freer ASTs that separate syntax from interpretation (Kiselyov), differential collections that collapse N updates into one delta (Naiad, Differential Dataflow), dirty-set rebuild algebra (Shake, Build Systems à la Carte), and self-adjusting computation with change-propagation proofs (Acar, Incremental). The throughline: give up Monad where possible so the interpreter sees a static plan, then exploit that plan for batching, caching, incremental re-execution, and multiple backends.

## 1. Haxl — Applicative collapses N+1

- **Insight**: dropping `>>=` for `<*>` exposes independence; independent fetches batch.
- **Mechanism**: `Fetch` GADT per data source; `runHaxl` gathers unresolved fetches at each Applicative layer, issues one round per source, memoizes by request key. `ApplicativeDo` in GHC desugars `do` to `<*>` whenever dependency analysis permits.
- **Rust equivalent**: `futures::join!` / `FuturesUnordered` gives the applicative slot; `DashMap` keyed on request gives memoization; `trait DataSource { type Req; fn run_batch(Vec<Req>) -> Vec<Resp>; }` mirrors the GADT.
- [Marlow et al., "There is no Fork", ICFP 2014](https://simonmar.github.io/bib/papers/haxl-icfp14.pdf) — fetched 2026-04-18

## 2. FRP — Behaviors vs Events, Push vs Pull

- **Insight**: `Behavior a = Time -> a`, `Event a = [(Time, a)]`; semantics first, representation second.
- **Mechanism**: Elliott/Hudak 1997 gave denotational FRP. Classical implementations leak because past Behavior values stay reachable through closures. Push-Pull (Elliott 2009) splits continuous pull from discrete push using an `Event` as a future of a residual event so GC can reclaim consumed prefixes. Reactive-banana/Reflex use incremental Behavior representations anchored to an event network with weak references.
- **Rust equivalent**: Push-Pull maps to `Stream` (push) + on-demand sampling closure (pull); space leaks become `Arc` cycles, fixed with `Weak` edges.
- [Elliott & Hudak, Functional Reactive Animation, ICFP 1997](http://conal.net/papers/icfp97/) — fetched 2026-04-18
- [Elliott, Push-Pull FRP, Haskell Symposium 2009](http://conal.net/papers/push-pull-frp/push-pull-frp.pdf) — fetched 2026-04-18

## 3. Arrows — static wiring is the optimization surface

- **Insight**: `Arrow a => a b c` exposes wiring without running it; the plan is a graph, not a closure.
- **Mechanism**: Hughes 2000 replaces `a -> m b` with `arr b c`, requiring `arr`, `>>>`, `first`. Arrow laws let an interpreter rewrite the circuit (fusion, CSE). Yampa's `SF a b` is an arrow; arrow notation (`proc`/`-<`) compiles to point-free combinators. Causal Commutative Arrows (Liu/Cheng/Hudak 2009) prove a normal form that compiles to a fixed state vector.
- **Rust equivalent**: `trait Op { type In; type Out; fn run(In) -> Out; }` with explicit `Seq<A,B>`, `Par<A,B>`, `Fork<A>` constructors preserves the static graph — this is exactly sprefa v2's `Pipeline` enum.
- [Hughes, Generalising Monads to Arrows, SCP 2000](https://www.cse.chalmers.se/~rjmh/Papers/arrows.pdf) — fetched 2026-04-18
- [Liu/Cheng/Hudak, Causal Commutative Arrows, ICFP 2009](https://www.cs.yale.edu/homes/hudak/Papers/cca.pdf) — fetched 2026-04-18

## 4. Free / Freer monads — interpreter plurality

- **Insight**: represent the program as a tree of requests, interpret later; the AST is the optimization surface.
- **Mechanism**: `Free f a` encodes a syntax tree over functor `f`; Kiselyov/Ishii replace `Functor f` with a type-aligned request queue (`FTCQueue`) giving O(1) bind. Multiple handlers reinterpret the same AST: tracing, batching, caching. Haxl's `GenHaxl` is a free applicative with a fetch effect; batching is handler behavior, not program behavior.
- **Rust equivalent**: enum-dispatched `Op` variants + `Vec<Op>` is a first-order free structure; `async fn` with a custom executor that inspects the returned future is the closest higher-order analog.
- [Kiselyov & Ishii, Freer Monads, Haskell Symposium 2015](https://okmij.org/ftp/Haskell/extensible/more.pdf) — fetched 2026-04-18

## 5. Differential / Timely Dataflow — delta in, delta out

- **Insight**: stream computations keyed by `(data, time, diff)` let N updates collapse to one delta; joins, reductions, and iteration all become incremental.
- **Mechanism**: Naiad (SOSP 2013) introduces timely dataflow with logical timestamps and `notify_at` hooks; Differential Dataflow (CIDR 2013) layers multiset differences with partial-order time so iterative fixpoints converge incrementally.
- **Rust equivalent**: `timely` + `differential-dataflow` crates by Frank McSherry are the reference implementation. Pattern: `collection.enter(&scope).concat(&delta)` turns "rescan the repo" into "apply the diff".
- [Murray et al., Naiad, SOSP 2013](https://sigops.org/s/conferences/sosp/2013/papers/p439-murray.pdf) — fetched 2026-04-18
- [McSherry et al., Differential Dataflow, CIDR 2013](https://www.cidrdb.org/cidr2013/Papers/CIDR13_Paper111.pdf) — fetched 2026-04-18
- [differential-dataflow crate](https://github.com/TimelyDataflow/differential-dataflow) — fetched 2026-04-18

## 6. Build systems as reactive batching

- **Insight**: a build system is a fixpoint over a dependency graph where dirty artifacts are the batch.
- **Mechanism**: *Build Systems à la Carte* factors any build into `Tasks` (the pure computation) + `Rebuilder` (when) + `Scheduler` (order). Cross product gives Make, Shake, Bazel, Excel, Nix. Shake's innovation is monadic dependencies — discover inputs during execution. Buck2 (Rust) uses a demand-driven incremental engine (DICE) close to Adapton.
- **Rust equivalent**: `salsa` (rust-analyzer) is the direct analog.
- [Mokhov/Mitchell/Peyton Jones, Build Systems à la Carte, ICFP 2018](https://www.microsoft.com/en-us/research/uploads/prod/2018/03/build-systems.pdf) — fetched 2026-04-18
- [Buck2 DICE](https://github.com/facebook/buck2) — fetched 2026-04-18

## 7. Self-adjusting computation

- **Insight**: record a dynamic dependence graph at first run; on input change, propagate only through the dirty cone.
- **Mechanism**: Acar's thesis defines modifiables (`Mod a`), a change-propagation algorithm, and proves from-scratch equivalence. Adapton adds demand-driven laziness and dirtying via a bipartite graph. Jane Street's `Incremental` (OCaml) is the production descendant — nodes, bind, stabilization, cutoff functions.
- **Rust equivalent**: `salsa` red-green algorithm — on input write, mark dependents red; on query read, recompute red nodes, re-green if output hash matches (early cutoff).
- [Acar, Self-Adjusting Computation, CMU 2005](https://www.cs.cmu.edu/~rwh/students/acar.pdf) — fetched 2026-04-18
- [Hammer et al., Adapton, PLDI 2014](https://www.cs.umd.edu/~hammer/adapton/) — fetched 2026-04-18
- [Salsa book](https://salsa-rs.github.io/salsa/) — fetched 2026-04-18

## 8. Compiling to categories

- **Insight**: a well-typed lambda term, read categorically, is already a circuit; a compiler plugin can extract it.
- **Mechanism**: Elliott's *Compiling to Categories* (ICFP 2017) reinterprets Haskell source through an arbitrary cartesian-closed category: hardware, automatic differentiation, graph extraction. Same lambda yields a runnable function AND an inspectable graph.
- **Rust equivalent**: no plugin analog; write the pipeline as a category-shaped eDSL (constructors for `Seq`, `Par`, `Fork`) so the static graph is the source of truth.
- [Elliott, Compiling to Categories, ICFP 2017](http://conal.net/papers/compiling-to-categories/compiling-to-categories.pdf) — fetched 2026-04-18

## Five principles for the runtime

1. **Applicative-first API.** Reserve `bind` for real data dependency; default composition exposes independence so the scheduler sees siblings (Haxl).
2. **Static plan as first-class value.** The pipeline is a data structure (`Pipeline` enum), not a closure; interpreters for run, trace, explain, and diff all consume the same tree (Free, Arrows, Compiling to Categories).
3. **Delta in, delta out.** Every op's signature is `batch of cursors → batch of cursors`; reparse is a delta against the prior batch, not a restart (Differential Dataflow, SAC).
4. **Caching keyed by request, not call site.** Memoize on `(op_id, input_hash)` so the same scan from two cursors shares one read (Haxl data-source cache, Salsa).
5. **Cutoff on equal output.** Propagation stops when an op emits the same cursor set as last run; this makes 1000 reparses cheap (Incremental, Adapton, Shake early-cutoff).

## Reading list (priority order)

1. [Haxl "There is no Fork"](https://simonmar.github.io/bib/papers/haxl-icfp14.pdf) — closest fit; directly describes batching.
2. [Build Systems à la Carte](https://www.microsoft.com/en-us/research/uploads/prod/2018/03/build-systems.pdf) — factoring (Tasks, Rebuilder, Scheduler) is the runtime blueprint.
3. [Differential Dataflow](https://www.cidrdb.org/cidr2013/Papers/CIDR13_Paper111.pdf) — the reparse-delta story.
4. [Push-Pull FRP](http://conal.net/papers/push-pull-frp/push-pull-frp.pdf) — space-leak avoidance patterns.
5. [Generalising Monads to Arrows](https://www.cse.chalmers.se/~rjmh/Papers/arrows.pdf) — static wiring.
6. [Freer Monads](https://okmij.org/ftp/Haskell/extensible/more.pdf) — interpreter plurality.
7. [Adapton](https://www.cs.umd.edu/~hammer/adapton/) — demand-driven dirtying.
8. [Compiling to Categories](http://conal.net/papers/compiling-to-categories/compiling-to-categories.pdf) — plan extraction.
