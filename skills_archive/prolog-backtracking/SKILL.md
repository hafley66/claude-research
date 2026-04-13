---
name: prolog-backtracking
description: Prolog backtracking search -- DFS execution, choice points, chronological backtracking, solution enumeration, search tree visualization. Trigger on prolog backtracking, choice points, prolog search, prolog execution model, DFS prolog.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Prolog Backtracking Search

## The Search Strategy

Prolog's execution model is depth-first search (DFS) with chronological backtracking. A query enters the knowledge base top-to-bottom through matching clauses, and left-to-right through goals in a clause body. When a goal fails, execution rewinds to the most recent point where an untried alternative exists, and tries that alternative instead.

The declarative reading of a Prolog program says "what is true." The procedural reading says "how to search for proofs." Backtracking is the procedural engine: it systematically explores the space of possible proofs by trying one path, and when that path dead-ends, unwinding to try another.

```prolog
% Declarative: "mortal(X) is true if human(X) is true"
% Procedural: "to prove mortal(X), first prove human(X)"
human(socrates).
human(hypatia).
mortal(X) :- human(X).
```

Querying `?- mortal(Who).` triggers:
1. Match `mortal(Who)` against `mortal(X)`, unify `Who = X`
2. Prove `human(X)` -- try first clause `human(socrates)`, unify `X = socrates`
3. Succeed with `Who = socrates`
4. On backtrack: undo `X = socrates`, try next clause `human(hypatia)`, succeed with `Who = hypatia`
5. On backtrack: no more `human/1` clauses, fail

## Choice Points

When multiple clauses match a goal, Prolog creates a **choice point** -- a saved execution state containing the current goal, the remaining untried clauses, variable bindings at that moment, and a pointer into the continuation (the remaining goals to prove). A choice point is a stack frame with a "next alternative" bookmark.

```prolog
color(red).
color(green).
color(blue).

?- color(X).
% Call: color(X)
%   Try clause 1: color(red) -- succeeds
% X = red ;
%   Backtrack to choice point, try clause 2: color(green) -- succeeds
% X = green ;
%   Backtrack to choice point, try clause 3: color(blue) -- succeeds
% X = blue ;
%   Backtrack to choice point, no more clauses
% false.
```

The `;` at the interactive prompt means "reject this solution, backtrack." Each press re-enters the search at the most recent choice point. `false` (or `no`) signals exhaustion of alternatives.

Choice points stack. A conjunction of nondeterministic goals creates nested choice points:

```prolog
color(red). color(blue).
size(small). size(large).

?- color(C), size(S).
% C = red, S = small ;
% C = red, S = large ;
% C = blue, S = small ;
% C = blue, S = large ;
% false.
```

This is the cartesian product. For each binding of `C`, all bindings of `S` are explored before backtracking into `color/1` for the next `C`.

## The Search Tree

The search tree for a query has the query as its root. Each node is a goal to prove. Children of a node are the clauses that match that goal. DFS traverses left-to-right (first clause first), depth-first (pursue each clause to completion before trying the next).

Consider:

```prolog
parent(tom, bob).
parent(tom, liz).
parent(bob, ann).
parent(bob, pat).

ancestor(X, Y) :- parent(X, Y).
ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).
```

Query: `?- ancestor(tom, Who).`

```
ancestor(tom, Who)
├── clause 1: parent(tom, Who)
│   ├── parent(tom, bob)  → Who = bob  ✓ solution 1
│   └── parent(tom, liz)  → Who = liz  ✓ solution 2
└── clause 2: parent(tom, Z), ancestor(Z, Who)
    ├── Z = bob: ancestor(bob, Who)
    │   ├── clause 1: parent(bob, Who)
    │   │   ├── parent(bob, ann) → Who = ann  ✓ solution 3
    │   │   └── parent(bob, pat) → Who = pat  ✓ solution 4
    │   └── clause 2: parent(bob, Z2), ancestor(Z2, Who)
    │       ├── Z2 = ann: ancestor(ann, Who)
    │       │   ├── clause 1: parent(ann, Who) → fail (no facts)
    │       │   └── clause 2: parent(ann, Z3), ... → fail
    │       └── Z2 = pat: ancestor(pat, Who) → fail (same)
    └── Z = liz: ancestor(liz, Who) → fail (no children)
```

Solutions emerge in DFS order: `bob`, `liz`, `ann`, `pat`. Backtracking means ascending the tree after a leaf (success or failure) to try the next unexplored sibling branch.

## Chronological Backtracking

Prolog's backtracking is **chronological** -- it always returns to the most recently created choice point (LIFO order on the choice point stack). This is the simplest possible strategy and the one every WAM-based Prolog implements.

The consequence: when a goal fails, Prolog rewinds to the last choice point even if that choice point is completely unrelated to the failure. Consider:

```prolog
big(elephant).
big(whale).
small(mouse).
small(ant).
lives_in_water(whale).
lives_in_water(fish).

?- big(X), small(Y), lives_in_water(X).
```

Execution:
1. `big(X)` -- choice point, try `X = elephant`
2. `small(Y)` -- choice point, try `Y = mouse`, succeeds
3. `lives_in_water(elephant)` -- fails
4. Backtrack to most recent choice point: `small(Y)`, try `Y = ant`, succeeds
5. `lives_in_water(elephant)` -- fails again
6. Backtrack: `small(Y)` exhausted, backtrack to `big(X)`, try `X = whale`
7. `small(Y)` -- try `Y = mouse`, succeeds
8. `lives_in_water(whale)` -- succeeds. Solution: `X = whale, Y = mouse`

Steps 4-5 are wasted work. The failure of `lives_in_water(elephant)` has nothing to do with `Y`'s binding, but chronological backtracking tries all `Y` values before reconsidering `X`. This inefficiency is why `!` (cut) exists -- it prunes choice points to prevent this kind of redundant search. Cut is covered in the `prolog-cut-negation` skill.

## RxJS Analogy

For developers fluent in RxJS/TypeScript, Prolog's backtracking maps onto lazy stream semantics with high fidelity.

| Prolog | RxJS/TS |
|---|---|
| A query `?- goal(X).` | An Observable that lazily emits solutions |
| Each solution (substitution) | A `next()` emission |
| Backtracking to find next solution | The Observable's internal pull mechanism |
| `false` / no more solutions | `complete()` |
| `;` at the prompt (give me another) | Calling `.next()` on an iterator / pulling from an async generator |
| `findall(X, goal(X), Xs)` | `toArray()` -- collect all emissions into a list |
| `,` (conjunction) | `concatMap` / `switchMap` -- for each solution of goal A, run goal B |
| `;` (disjunction) | `merge()` -- combine solution streams from alternatives |
| `member(X, [1,2,3])` | `from([1,2,3])` |
| `between(1, 100, X)` | `range(1, 100)` |
| Generate-and-test pattern | `from(candidates).pipe(filter(isValid))` |

The conjunction `,` is particularly precise as `concatMap`:

```typescript
// Prolog: color(C), size(S)
// RxJS equivalent:
from(['red', 'blue']).pipe(
  concatMap(c => from(['small', 'large']).pipe(
    map(s => ({ c, s }))
  ))
)
// {c:'red',s:'small'}, {c:'red',s:'large'}, {c:'blue',s:'small'}, {c:'blue',s:'large'}
```

The whole execution model is a **lazy pull-based stream of substitutions**. Prolog doesn't compute all solutions eagerly. It finds one, pauses, and only resumes (backtracks) when asked. This is identical to how an Observable with a synchronous scheduler works, or how a generator function yields values on demand.

```typescript
// Mental model: a Prolog query as a generator
function* ancestorQuery(db: Fact[]): Generator<Substitution> {
  for (const clause of matchingClauses('ancestor', db)) {
    const subst = unify(query, clause.head);
    if (subst !== null) {
      if (clause.body.length === 0) {
        yield subst;  // fact -- emit solution
      } else {
        yield* solveBody(clause.body, subst, db);  // rule -- recurse
      }
    }
    // implicit: falling through to next clause = backtracking
  }
}
```

## Go Analogy

Go's `select` statement inside a `for` loop is structurally reminiscent of disjunction:

```go
for {
    select {
    case msg := <-ch1:
        handle(msg)
    case msg := <-ch2:
        handle(msg)
    }
}
```

Both `select` and Prolog clause selection pick among alternatives. The differences: `select` picks whichever channel is ready (nondeterministic scheduling), while Prolog tries clauses in source order (deterministic). `select` doesn't backtrack on failure; it blocks or picks a default.

A closer procedural analogue in Go is a retry loop over strategies:

```go
func solve(problem Problem) (Solution, bool) {
    strategies := []func(Problem)(Solution, bool){
        tryStrategyA,
        tryStrategyB,
        tryStrategyC,
    }
    for _, s := range strategies {
        if sol, ok := s(problem); ok {
            return sol, true
        }
        // "backtrack" -- try next strategy
    }
    return Solution{}, false  // all strategies failed
}
```

This captures the sequential, exhaustive nature of Prolog clause selection. Each strategy is a clause. Failure triggers the next one. No undo of state is needed here because Go functions don't share mutable bindings the way Prolog's trail does.

## Variable Unbinding on Backtrack

When Prolog backtracks past a unification, it **undoes the variable binding**. The mechanism is the **trail** -- a stack that records which variables were bound since the last choice point. On backtrack, every variable on the trail is reset to unbound.

This is a transactional model. Each path from the choice point is explored in isolation. Bindings from a failed branch never leak into subsequent branches.

```prolog
foo(X) :- X = hello, fail.  % bind X, then force failure
foo(X) :- X = world.        % X is unbound here, not "hello"

?- foo(X).
% X = world.
```

Trace:
1. Try clause 1: unify `X = hello` (trail records this binding)
2. `fail` forces failure
3. Backtrack: unwind trail, `X` becomes unbound again
4. Try clause 2: unify `X = world`, succeed

The trail is an undo log, functionally identical to a database transaction rollback. In Rust terms, imagine that each variable binding has a `Drop` implementation that fires when backtracking unwinds past it, restoring the variable to its prior state.

```rust
// Conceptual model only -- not real Prolog implementation
struct TrailedBinding<'a> {
    variable: &'a Cell<Option<Term>>,
    previous_value: Option<Term>,
}

impl Drop for TrailedBinding<'_> {
    fn drop(&mut self) {
        self.variable.set(self.previous_value.take());
    }
}
```

This automatic unbinding is what makes backtracking "clean." Each branch of the search tree sees only its own bindings.

## Determinism

Prolog predicates fall into a determinism taxonomy that matters for performance and correctness:

| Category | Solutions | Example |
|---|---|---|
| **Deterministic** (`det`) | Exactly 1 | `succ(3, X)` -- `X = 4` |
| **Semideterministic** (`semidet`) | 0 or 1 | `member(5, [1,2,3])` -- fails |
| **Nondeterministic** (`nondet`) | 0 or more | `member(X, [1,2,3])` -- three solutions |
| **Multi** (`multi`) | 1 or more | `between(1, 3, X)` -- always at least one |

A deterministic predicate leaves no choice points. A nondeterministic one leaves choice points that can be re-entered. SWI-Prolog's documentation annotates predicates with these categories.

Performance implication: unnecessary choice points consume memory (each is a saved stack frame). If a predicate is logically deterministic but Prolog doesn't know that (because multiple clauses syntactically match), it creates a useless choice point. This is where cut or `->` (if-then) can eliminate waste, and where first-argument indexing (automatic in most Prologs) helps by filtering clauses before creating choice points.

```prolog
% Without indexing awareness, this creates a choice point on every call:
fact(0, 1).
fact(N, F) :- N > 0, N1 is N - 1, fact(N1, F1), F is N * F1.

% With first-argument indexing, calling fact(0, X) only matches clause 1
% and fact(5, X) only matches clause 2 -- no choice point needed.
% SWI-Prolog indexes on the first argument by default.
```

## When DFS Hurts

DFS has a well-known pathology: it can descend infinitely down a single branch and never find solutions that exist in other branches.

**Left recursion diverges:**

```prolog
% WRONG -- infinite loop
ancestor(X, Y) :- ancestor(X, Z), parent(Z, Y).
ancestor(X, Y) :- parent(X, Y).
```

To prove `ancestor(tom, Who)`, Prolog tries clause 1 first, which requires proving `ancestor(tom, Z)`, which tries clause 1 first, which requires proving `ancestor(tom, Z2)`, ad infinitum. The base case in clause 2 is never reached.

**Fix 1: clause ordering.** Put the base case first:

```prolog
% CORRECT -- base case first
ancestor(X, Y) :- parent(X, Y).
ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).
```

Now clause 1 grounds the recursion before clause 2 recurses. The recursive call is in the *body* of clause 2, not at the leftmost position, so a `parent/2` fact must succeed first before recursing.

**Fix 2: tabling (memoization).** SWI-Prolog supports tabled evaluation, which avoids infinite loops on left recursion and memoizes computed answers:

```prolog
:- table ancestor/2.
ancestor(X, Y) :- ancestor(X, Z), parent(Z, Y).
ancestor(X, Y) :- parent(X, Y).
% Now this terminates even with left recursion.
```

Tabling transforms DFS into something closer to BFS for the tabled predicate, suspending recursive calls that would loop and resuming them when new answers arrive.

**Clause ordering also affects solution order and efficiency.** Putting more specific or more frequently successful clauses first reduces wasted search.

## Generating and Testing

A canonical Prolog pattern: use backtracking as a generator, then filter with a test.

```prolog
% Generate candidate colorings, test validity
color_map(Colors) :-
    Colors = [A, B, C, D],
    member(A, [red, green, blue]),
    member(B, [red, green, blue]),
    member(C, [red, green, blue]),
    member(D, [red, green, blue]),
    A \= B,    % adjacent regions differ
    A \= C,
    B \= C,
    B \= D,
    C \= D.
```

Each `member/2` call is a generator that backtracks through options. The `\=` tests prune invalid branches. Backtracking automatically manages the search, trying all combinations until one passes all tests.

The RxJS equivalent:

```typescript
from(colors).pipe(
  concatMap(a => from(colors).pipe(
    concatMap(b => from(colors).pipe(
      concatMap(c => from(colors).pipe(
        map(d => [a, b, c, d])
      ))
    ))
  )),
  filter(([a, b, c, d]) =>
    a !== b && a !== c && b !== c && b !== d && c !== d
  )
)
```

The Prolog version is more concise because backtracking and variable binding are built into the language rather than threaded through combinators.

A more efficient version interleaves generation and testing to fail earlier (constraint propagation):

```prolog
color_map_early_prune(Colors) :-
    Colors = [A, B, C, D],
    member(A, [red, green, blue]),
    member(B, [red, green, blue]), A \= B,
    member(C, [red, green, blue]), A \= C, B \= C,
    member(D, [red, green, blue]), B \= D, C \= D.
```

This tests constraints as soon as the relevant variables are bound, pruning the search tree earlier. In RxJS terms, this is moving the `filter` into each `concatMap` stage rather than applying it at the end.
