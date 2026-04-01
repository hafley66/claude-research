---
name: prolog-cut-negation
description: Prolog cut and negation -- cut (!) operator, green vs red cuts, negation-as-failure (\+), if-then-else (->), commitment, pruning search. Trigger on prolog cut, negation as failure, prolog if then, green cut, red cut, prolog control flow.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Cut, Negation, and Conditional Control in Prolog

## Cut (`!`)

Cut is a goal that always succeeds, exactly once. Its side effect: when reached, it **discards all remaining choice points** for:

1. The parent goal (the predicate clause in which the cut appears)
2. All goals to the **left** of the cut within that clause

The parent goal is the call that unified with the head of the clause containing `!`. After cut, Prolog will not try alternative clauses for that predicate, nor will it backtrack into any goal that preceded the cut in the clause body.

```prolog
foo(X) :- a(X), b(X), !, c(X), d(X).
foo(X) :- e(X).
```

If `a(X)` and `b(X)` succeed and execution reaches `!`:
- Alternative clauses for `foo/1` (the second clause) are pruned.
- Alternative solutions from `a(X)` and `b(X)` are pruned.
- `c(X)` and `d(X)` can still backtrack between each other normally.
- If `c(X)` or `d(X)` ultimately fail, `foo(X)` fails entirely. There is no fallback to the second clause.

### Scope of cut

Cut affects the **immediately enclosing predicate definition**, not any caller. If `bar/1` calls `foo/1` and `foo/1` cuts, `bar/1` retains its own choice points. Cut is lexically scoped to the clause it appears in.

---

## Green Cut vs Red Cut

### Green cut

Removing it does not change the set of answers. It prevents Prolog from exploring branches that a human knows will not yield new solutions.

```prolog
% Green cut: max/3
max(X, Y, X) :- X >= Y, !.
max(_, Y, Y).
```

Without the cut, querying `max(5, 3, M)` still returns `M = 5`. The second clause would be tried but `M = 3` would also unify, producing a spurious duplicate or incorrect answer only if the clauses are read purely declaratively without the guard. In this case, since both clauses lack a complete guard, the cut is actually load-bearing for correctness when the second clause has no `Y >= X` guard.

A truly green version requires explicit guards on both clauses:

```prolog
max(X, Y, X) :- X >= Y.
max(X, Y, Y) :- Y > X.
```

Adding a cut to the first clause here is genuinely green: it saves the redundant `Y > X` check on the second clause when the first already matched.

```prolog
max(X, Y, X) :- X >= Y, !.
max(X, Y, Y) :- Y > X.
```

### Red cut

Removing it **changes the program's answers**. The correctness of the program depends on clause order plus the cut preventing later clauses from firing.

```prolog
classify(X, positive) :- X > 0, !.
classify(X, zero) :- X =:= 0, !.
classify(_, negative).
```

Remove the cuts and `classify(5, negative)` succeeds. The third clause has no guard; the cut in the first clause is what prevents it from matching positive numbers. This is a red cut. The declarative reading ("anything is negative") does not match the intended semantics ("anything not previously matched is negative").

Red cuts make programs **order-dependent** at the semantic level, not just the procedural level. Reordering clauses or adding new ones can silently break correctness.

---

## If-Then-Else (`->` / `;`)

```prolog
( Condition -> Then ; Else )
```

Semantics:
1. Try `Condition`.
2. If `Condition` succeeds, **commit** to that success (cut alternatives of `Condition`), then execute `Then`.
3. If `Condition` fails, execute `Else`.

This is syntactic sugar that contains an implicit cut scoped only to `Condition`'s choice points. It does not cut the enclosing predicate.

```prolog
classify(X, Class) :-
    ( X > 0 -> Class = positive
    ; X =:= 0 -> Class = zero
    ; Class = negative
    ).
```

This achieves the same result as the red-cut `classify/2` above but is more transparent about the conditional structure. The if-then-else nests: the `;` separating else branches can contain further `->` tests, forming a cond-chain.

### If-Then without Else

```prolog
( Condition -> Then )
```

If `Condition` fails, the entire construct fails. There is no implicit `true` else branch. This is rarely what you want.

---

## Negation-as-Failure (`\+`)

```prolog
\+ Goal
```

Succeeds if `Goal` **fails**. Fails if `Goal` succeeds. Defined as:

```prolog
\+(Goal) :- Goal, !, fail.
\+(_).
```

This is **not logical negation**. It implements the **closed-world assumption**: anything not provable from the current database is assumed false. `\+ p(a)` does not mean "p(a) is false in the domain." It means "p(a) cannot be derived from the clauses currently loaded."

### Variable binding trap

`\+` never binds variables in the outer scope. If `Goal` succeeds, `\+` fails (discarding any bindings `Goal` made). If `Goal` fails, `\+` succeeds but `Goal` never bound anything.

```prolog
?- \+ X = 5.
false.
```

`X = 5` succeeds (unification always succeeds with an unbound variable), so `\+ X = 5` fails. This is correct behavior per the definition, but frequently surprises newcomers.

**Rule**: use `\+` only with **ground terms** (fully instantiated arguments). If the arguments contain unbound variables, the negation's behavior becomes unintuitive and logically unsound.

```prolog
% Correct usage: X is bound before negation
bachelor(X) :- male(X), \+ married(X).

% Dangerous: X unbound when negation is evaluated
wrong(X) :- \+ married(X), male(X).
```

In `wrong/1`, if any `married/1` fact exists, `\+ married(X)` fails immediately (because `married(X)` succeeds with some binding), so no `X` is ever returned.

---

## `once/1`

```prolog
once(Goal)
```

Equivalent to:

```prolog
once(Goal) :- Goal, !.
```

Or equivalently:

```prolog
once(Goal) :- ( Goal -> true ; fail ).
```

Finds the first solution to `Goal` and commits. No backtracking into `Goal` for further solutions. Preferable to a bare cut when the intent is "I want at most one answer from this subgoal" because it makes the scope of commitment explicit.

```prolog
% Find one path, don't enumerate all
first_path(A, B, Path) :- once(path(A, B, Path)).
```

---

## Why Cut Exists

Pure Prolog provides no mechanism for commitment. Every predicate is potentially nondeterministic, and Prolog will exhaustively search all alternatives on backtracking. This is correct but expensive.

Real programs need to express:
- **Determinism**: "this predicate has exactly one answer for these inputs."
- **Default cases**: "if none of the above matched, do this."
- **Pruning**: "I found what I need, stop searching."

Cut is the primitive that breaks Prolog out of exhaustive search. Everything else (`->`, `\+`, `once/1`) is built on it.

---

## RxJS Analogy

For developers with RxJS background:

| Prolog | RxJS | Shared concept |
|--------|------|----------------|
| `!` (cut) | `take(1)` / `first()` | Commit to first result, unsubscribe from remaining alternatives |
| `\+` (negation) | `isEmpty().pipe(map(b => !b))` inverted, or `count().pipe(map(n => n === 0))` | Check whether the stream produces nothing |
| `->` (if-then) | `switchMap` with a guard | Evaluate condition, then route to one branch, discarding the other |
| `once/1` | `first()` | Take exactly one emission, complete |
| Backtracking | Multiple emissions from an Observable | Lazy enumeration of alternatives |

The analogy is imperfect. Prolog's backtracking is depth-first and synchronous; Observables are push-based and potentially async. But the control flow intuition transfers: cut/once terminate enumeration the way `take(1)` terminates subscription.

---

## The Problem with Cut

Cut breaks the **declarative reading** of Prolog programs.

A pure Prolog program can be read as a set of logical assertions. Clause order is irrelevant to correctness (it affects search efficiency and termination, but not the set of provable goals). With red cuts, clause order becomes **semantically load-bearing**. The program is no longer a set of logical facts; it is an imperative sequence of condition checks with early exits.

Consequences:
- **Reversibility lost**: pure Prolog predicates can often be run "backwards" (supply the output, compute the input). Cut-laden predicates generally cannot.
- **Clause reordering breaks things**: adding a clause above a cut-containing clause can silently change behavior.
- **Harder to verify**: formal verification tools for Prolog assume the declarative semantics. Cut introduces control flow that these tools cannot reason about.

---

## Practical Patterns

### Deterministic lookup with green cut

```prolog
lookup(Key, [Key-Value|_], Value) :- !.
lookup(Key, [_|Rest], Value) :- lookup(Key, Rest, Value).
```

Once the key is found, stop searching. Green: removing the cut produces the same first answer but allows spurious re-derivation if duplicate keys exist.

### Default case with red cut

```prolog
react(alarm, evacuate) :- !.
react(warning, investigate) :- !.
react(_, log).
```

Red cut. Without it, `react(alarm, log)` succeeds. The default clause has no guard.

### Safer default with if-then-else

```prolog
react(Event, Action) :-
    ( Event = alarm -> Action = evacuate
    ; Event = warning -> Action = investigate
    ; Action = log
    ).
```

Equivalent behavior, explicit structure.

### Negation for filtering

```prolog
available(X) :- room(X), \+ booked(X).
```

Ground-safe: `room(X)` binds `X` before `\+ booked(X)` evaluates.

### Guarded accumulator with cut

```prolog
sum_positive([], 0).
sum_positive([H|T], Sum) :-
    H > 0, !,
    sum_positive(T, Rest),
    Sum is H + Rest.
sum_positive([_|T], Sum) :-
    sum_positive(T, Sum).
```

Green cut: the third clause's unguarded head would match positive numbers too, but produce the wrong sum. Actually red, because removing the cut changes answers. Fix: add `H =< 0` guard to the third clause, making the cut green.

---

## When to Use What

| Situation | Recommended construct |
|-----------|----------------------|
| Conditional branching | `( Cond -> Then ; Else )` |
| Exactly one solution needed | `once/1` |
| Performance: skip known-useless clauses | Green cut with guards on all clauses |
| "Not provable" check | `\+` with ground arguments |
| Expressing determinism to the compiler | Cut in the first matching clause, or `det` declarations if the system supports them |
| Default/fallback case | If-then-else chain, not unguarded catch-all + red cut |

Prefer `->` over raw cut. Use `once/1` when the intent is "at most one answer." Use green cuts for performance only when every clause has an independent guard. Avoid red cuts; they make programs harder to reason about and break reversibility. When a red cut seems necessary, it usually indicates the predicate should be restructured as an if-then-else chain or the missing guards should be made explicit.
