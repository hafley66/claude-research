---
name: prolog-core
description: Prolog paradigm fundamentals -- Horn clauses, facts, rules, queries, the closed-world assumption, declarative vs procedural reading. Index to all prolog-* skills. Trigger on prolog basics, prolog intro, logic programming, prolog getting started.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Prolog Core

## What Prolog Is

Prolog programs are collections of logical relationships, not sequences of instructions. The runtime is a theorem prover. A program defines *what is true*; the engine determines *how* to derive answers from those truths.

The theoretical foundation is first-order predicate logic restricted to Horn clauses. A Horn clause is a disjunction of literals with at most one positive literal. This restriction makes automated proof search tractable (resolution-based inference in polynomial space for ground programs, though general Prolog with function symbols is Turing-complete).

Programs live in a *database* of clauses. There is no `main()`. Execution begins when a query is posed against the database.

## Horn Clauses

Three forms exist in Prolog syntax:

**Facts** -- unconditional truths. A clause with no body.

```prolog
parent(tom, bob).
parent(bob, ann).
parent(bob, pat).
```

**Rules** -- conditional truths. Head holds if body holds. The `:-` operator reads as "if".

```prolog
grandparent(X, Z) :- parent(X, Y), parent(Y, Z).
sibling(X, Y) :- parent(P, X), parent(P, Y), X \= Y.
ancestor(X, Y) :- parent(X, Y).
ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).
```

The comma (`,`) is conjunction (AND). Multiple clauses for the same predicate are disjunction (OR). Variables start with uppercase or `_`.

**Queries** -- questions posed to the database.

```prolog
?- grandparent(tom, Who).
   Who = ann ;
   Who = pat.
```

The semicolon prompts the engine for additional solutions. Each solution is a *substitution* -- a mapping from query variables to ground terms that makes the query provable.

## Declarative vs Procedural Reading

Every Prolog clause supports two simultaneous interpretations.

Take `ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).`

| Reading | Interpretation |
|---|---|
| **Declarative** | X is an ancestor of Y if X is a parent of some Z and Z is an ancestor of Y. |
| **Procedural** | To prove `ancestor(X, Y)`, first find a `parent(X, Z)` fact, then recursively prove `ancestor(Z, Y)`. |

The declarative reading is *what* the program means. The procedural reading is *how* the engine executes it. Ideal Prolog code is written so both readings are clean, but in practice the procedural reality constrains clause ordering, termination, and performance. The tension between these two readings is the central challenge of programming in Prolog.

Clause order matters procedurally. For `ancestor`, if the recursive clause comes first, the engine enters infinite recursion on certain queries because it tries the recursive case before the base case. Declaratively, order is irrelevant -- both clauses are logically symmetric. This is the first place the declarative/procedural gap bites.

## Closed-World Assumption (CWA)

Anything not provable from the database is considered false. This is negation-as-failure, not classical negation.

```prolog
?- parent(tom, sue).
   false.
```

There is no `parent(tom, sue)` in the database and no rule can derive it, so it fails. The system does not distinguish "known to be false" from "unknown." This contrasts sharply with SQL's three-valued logic (TRUE/FALSE/NULL). In Prolog, there is no NULL -- there is only provable or not provable.

The CWA is what makes Prolog databases monotonic within a session (adding facts can only make more things true) but non-monotonic in the presence of negation-as-failure (`\+`), since adding facts can flip a negated goal from succeeding to failing.

## Execution Model (High Level)

The engine processes a query through three interlocking mechanisms:

1. **Unification** -- The query term is matched against clause heads in the database. Unification is bidirectional pattern matching with variable binding. `f(X, b)` unifies with `f(a, Y)` producing `{X=a, Y=b}`. See **prolog-unification** for term unification, the occurs check, and the substitution model.

2. **Resolution** -- When a query unifies with a rule head, the rule body becomes the new set of goals to prove. This is SLD-resolution (Selective Linear Definite clause resolution).

3. **Backtracking** -- When a goal fails, the engine undoes variable bindings back to the most recent *choice point* (a point where multiple clauses could match) and tries the next alternative. This is depth-first search of the proof tree. See **prolog-backtracking** for choice points, DFS behavior, and solution enumeration.

The search is depth-first and left-to-right. This is a design choice, not a logical necessity -- it makes the procedural behavior predictable but means clause and goal ordering affect termination and efficiency.

## Bridges to Familiar Paradigms

**TypeScript conditional types** are a restricted form of the same idea. `T extends U ? X : Y` is pattern matching (unification) plus conditional derivation (rules). Prolog generalizes this: unification is bidirectional and recursive, variables can appear anywhere, and multiple rules for the same "type" provide disjunction. TypeScript's type-level computation is essentially a non-backtracking, non-relational subset of what Prolog does.

**RxJS `expand()`** is conceptually close to Prolog's recursive search. `expand` takes a value, applies a function that returns an Observable, and recursively feeds results back in -- lazy enumeration of a potentially infinite solution space. Prolog's query engine does something similar: it expands a goal into subgoals via rule bodies, yielding solutions one at a time on demand (backtracking is the "next" signal). The difference: Prolog's expansion is guided by unification rather than arbitrary functions.

**Go's `select {}`** inside a `for` loop multiplexes across channels -- multiple possible paths, whichever is ready wins. Prolog's disjunction (`;`, or equivalently multiple clauses) is similar in shape: multiple possible proof paths, explored in order. But Go's `select` is concurrent and nondeterministic, while Prolog's disjunction is sequential and deterministic (always tries top-to-bottom, left-to-right).

**Rust `match`** is one-level, one-directional pattern matching without backtracking. Prolog's unification is `match` generalized: bidirectional (both sides can contain variables), recursive (terms can be arbitrarily nested), and with variable bindings that propagate across the entire proof. A `match` arm either fires or doesn't; a Prolog clause can fire, partially succeed, then backtrack and try another clause.

## Skill Index

| Skill | Scope |
|---|---|
| **prolog-unification** | Variable binding, pattern matching, the occurs check, substitution composition |
| **prolog-backtracking** | DFS search, choice points, chronological backtracking, solution enumeration |
| **prolog-cut-negation** | Cut (`!`), negation-as-failure (`\+`), if-then-else, control flow tradeoffs |
| **prolog-lists** | `[H|T]` decomposition, append/3, member/2, list accumulator idioms |
| **prolog-arithmetic** | `is/2` evaluation, arithmetic comparison, CLP(FD) constraint solving |
| **prolog-terms** | Compound terms, functor/3, `=../2` (univ), term introspection and construction |
| **prolog-dcg** | Definite clause grammars, pushback notation, parsing and generation |
| **prolog-meta** | Higher-order predicates, findall/3, bagof/3, setof/3, meta-interpreters |
| **prolog-modules** | Module systems across SWI, SICStus, YAP; import/export, predicate visibility |
| **prolog-operators** | `op/3` declarations, custom operators, precedence and associativity |
| **swi-prolog** | SWI-Prolog tooling, trace/spy debugger, pack system, IDE, ecosystem |
| **prolog-types** | Mercury's type/mode/determinism system, Ciao assertions, typed logic programming |

## Why Prolog Is Hard

Four sources of difficulty, in rough order of when they hit:

**Declarative thinking against imperative instincts.** The first barrier is learning to describe relationships instead of procedures. "What makes X a grandparent of Z" rather than "step 1: look up X's children, step 2: for each child...". The skill being developed is the ability to specify constraints and let search handle the rest. This is genuinely different from imperative, functional, or reactive programming.

**The search strategy is interleaved with side effects.** Prolog's depth-first search means clause order, goal order, and the presence of cut (`!`) all affect which solutions are found and in what order. I/O side effects (`write/1`, `assert/1`) happen during search and are not undone on backtracking. The declarative reading says order doesn't matter; the procedural reality says it determines whether the program terminates, performs acceptably, or produces garbage output.

**Debugging is watching a tree search.** There is no "step to line 12." The debugger shows port transitions (Call, Exit, Fail, Redo) on a proof tree. Understanding a bug requires understanding the shape of the search tree at the point of failure, which means holding the unification state, the current goal list, and the backtracking history in mind simultaneously.

**The gap between the beautiful and the gritty.** Textbook Prolog is elegant -- `append/3` works in all four modes, `sort/2` is a one-liner, grammars fall out of DCGs. Production Prolog involves wrestling with non-termination, managing the cut to prune unwanted solutions, using `assert`/`retract` for global state, and debugging performance by reasoning about the size of the search tree. The gap between the declarative promise and the procedural reality is where frustration lives.
