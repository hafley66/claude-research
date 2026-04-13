---
name: prolog-meta
description: Prolog meta-programming -- call/N, maplist, findall/bagof/setof, assert/retract, clause/2, meta-interpreters, homoiconicity. Trigger on prolog meta, findall, bagof, setof, assert, retract, meta-interpreter, prolog higher order, call.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Prolog Meta-Programming

## Homoiconicity

Prolog code IS data (terms). `member(X, [1,2,3])` is simultaneously a goal to execute AND a compound term you can inspect, construct, and manipulate. A clause `foo(X) :- bar(X), baz(X)` is the term `:-( foo(X), ','(bar(X), baz(X)) )`. The `:-` and `,` are just functors.

This means there is no separate "reflection API" or macro system. The same unification that pattern-matches data also pattern-matches code. `=..` (univ) decomposes any term into functor and args:

```prolog
?- member(X, [1,2,3]) =.. Parts.
% Parts = [member, X, [1,2,3]]

?- Goal =.. [append, [1,2], [3,4], Result].
% Goal = append([1,2], [3,4], Result)
?- call(Goal).
% Result = [1,2,3,4]
```

`functor/3` and `arg/3` provide indexed access without building the list:

```prolog
?- functor(f(a,b,c), Name, Arity).
% Name = f, Arity = 3

?- arg(2, f(a,b,c), Val).
% Val = b
```

## call/N -- Higher-Order Predicates

`call/N` adds arguments to a goal and calls it. `call(foo, A, B)` calls `foo(A, B)`. This gives Prolog higher-order programming without lambda.

```prolog
?- call(member, X, [1,2,3]).  % X = 1 ; X = 2 ; X = 3
?- call(succ, 3, X).          % X = 4

% Partial application via call/N:
:- meta_predicate apply_to_list(2, +, -).
apply_to_list(Goal, List, Results) :-
    maplist(call(Goal), List, Results).

% call/N composes with itself:
?- Doubled = call(succ),
   call(Doubled, 5, X).       % X = 6... but more usefully:

% Passing goals as data through predicates:
transform(Input, Goal, Output) :-
    call(Goal, Input, Output).

?- transform(5, succ, X).     % X = 6
?- transform(hello, atom_length, X). % X = 5
```

The `meta_predicate` directive tells the compiler that argument position 1 expects a goal with 2 additional arguments (the `2`). `+` and `-` indicate regular input/output args. This enables module-correct call resolution.

RxJS analogy: `call/N` is like `.pipe(operator)` -- passing a function-like thing (a goal template) to be applied later.

## Lambda Syntax (SWI-Prolog library(apply))

```prolog
?- maplist([X]>>(Y is X*X, write(Y), nl), [1,2,3]).
% prints 1, 4, 9

?- maplist([X,Y]>>(Y is X+1), [1,2,3], Results).
% Results = [2, 3, 4]

% Nesting lambdas:
?- maplist([Row]>>(
       maplist([Cell]>>(format("~w ", [Cell])), Row),
       nl
   ), [[1,2],[3,4]]).
% prints: 1 2
%         3 4

% Free variables in lambdas capture by unification (not closure):
?- Factor = 3,
   maplist([X,Y]>>(Y is X * Factor), [1,2,3], Scaled).
% Scaled = [3, 6, 9]
```

`[Args]>>Goal` is SWI's lambda notation. Not ISO, but widely used. The `>>` operator wraps Goal with the argument list. Under the hood it compiles to a call/N invocation.

## All-Solutions Predicates

The workhorses of collecting backtracking results into lists.

### findall/3

Collect ALL solutions, including duplicates. Returns `[]` if no solutions (never fails).

```prolog
?- findall(X, member(X, [1,2,1,3]), Xs).
% Xs = [1,2,1,3]

?- findall(X, (member(X, [1,2,3]), X > 5), Xs).
% Xs = []   (no failure, just empty list)

% Template can be any term, not just a variable:
?- findall(X-Y, (member(X, [a,b]), member(Y, [1,2])), Pairs).
% Pairs = [a-1, a-2, b-1, b-2]
```

### bagof/3

Like findall but FAILS if no solutions. Respects `^` for existential quantification.

```prolog
?- bagof(X, member(X, [1,2,1,3]), Xs).
% Xs = [1,2,1,3]

?- bagof(X, (member(X, [1,2,3]), X > 5), Xs).
% false   (fails, unlike findall)
```

The `^` operator marks existential variables -- "there exists some value":

```prolog
age(peter, 7). age(ann, 11). age(pat, 8).

% WITHOUT ^: bagof groups by unbound variables
?- bagof(Child, age(Child, Age), Children).
% Age = 7,  Children = [peter] ;
% Age = 8,  Children = [pat] ;
% Age = 11, Children = [ann]

% WITH ^: existentially quantify Age away
?- bagof(Child, Age^age(Child, Age), Children).
% Children = [peter, ann, pat]
```

### setof/3

Like bagof but sorted and deduplicated. Also fails on no solutions.

```prolog
?- setof(X, member(X, [3,1,2,1,3]), Xs).
% Xs = [1, 2, 3]
```

Same `^` behavior as bagof for existential variables.

### Comparison table

| Predicate | Duplicates | Sorted | No solutions | Free vars |
|-----------|-----------|--------|-------------|-----------|
| findall   | yes       | no     | `[]`        | ignored   |
| bagof     | yes       | no     | fails       | grouped   |
| setof     | no        | yes    | fails       | grouped   |

RxJS analogy: `findall` = `toArray()`. `setof` = `distinct()` then `toArray()` then `sort()`.

## assert/retract -- Dynamic Database Modification

```prolog
?- assert(likes(bob, pizza)).     % adds fact to database
?- likes(bob, What).              % What = pizza
?- retract(likes(bob, pizza)).    % removes it
?- likes(bob, What).              % false

assertz(Clause)   % add at end of predicate (default for assert)
asserta(Clause)    % add at beginning of predicate
retractall(Head)   % remove all clauses whose head unifies with Head
```

Predicates modified at runtime must be declared dynamic:

```prolog
:- dynamic likes/2.
:- dynamic counter/1.

% Mutable counter pattern:
counter(0).

increment(New) :-
    retract(counter(Old)),
    New is Old + 1,
    assert(counter(New)).
```

This is mutable global state. The closest analogy is a runtime-modifiable lookup table. Use sparingly -- it breaks the pure logic paradigm and makes debugging hard. Legitimate uses: caching (memoization/tabling), configuration, and dynamic knowledge bases.

```prolog
% Memoization with assert:
:- dynamic fib_cache/2.

fib(0, 0) :- !.
fib(1, 1) :- !.
fib(N, F) :-
    (   fib_cache(N, F)
    ->  true
    ;   N1 is N - 1, N2 is N - 2,
        fib(N1, F1), fib(N2, F2),
        F is F1 + F2,
        assert(fib_cache(N, F))
    ).
```

RxJS analogy: assert/retract is like a BehaviorSubject that other predicates query -- mutable shared state that affects future computations.

## clause/2 -- Inspecting the Database

Retrieves the head and body of clauses. The predicate must be dynamic.

```prolog
:- dynamic grandparent/2.
grandparent(X, Z) :- parent(X, Y), parent(Y, Z).

?- clause(grandparent(X, Z), Body).
% Body = (parent(X, Y), parent(Y, Z))

% Facts have body = true:
:- dynamic likes/2.
likes(ann, cats).
?- clause(likes(ann, What), Body).
% What = cats, Body = true
```

`clause/2` combined with `=..` and `call` is the foundation for meta-interpreters.

```prolog
% Enumerate all clauses of a predicate:
list_clauses(Head) :-
    clause(Head, Body),
    format("~w :- ~w~n", [Head, Body]),
    fail ; true.
```

## Meta-Interpreters

The crown jewel of Prolog meta-programming. A Prolog interpreter written in Prolog.

### Vanilla meta-interpreter

The simplest possible interpreter that reproduces Prolog's own behavior:

```prolog
solve(true).
solve((A, B)) :- solve(A), solve(B).
solve(Goal) :-
    Goal \= true,
    Goal \= (_, _),
    clause(Goal, Body),
    solve(Body).
```

This handles conjunction and clause lookup. It can only resolve dynamic predicates (clause/2 restriction).

### Extended: handling builtins and disjunction

```prolog
solve(true) :- !.
solve((A, B)) :- !, solve(A), solve(B).
solve((A ; B)) :- !, (solve(A) ; solve(B)).
solve(\+ A) :- !, \+ solve(A).
solve(Goal) :-
    predicate_property(Goal, built_in),
    !,
    call(Goal).
solve(Goal) :-
    clause(Goal, Body),
    solve(Body).
```

### Tracing meta-interpreter

Add depth tracking to see the execution tree:

```prolog
solve_trace(Goal) :- solve_trace(Goal, 0).

solve_trace(true, _) :- !.
solve_trace((A, B), D) :- !, solve_trace(A, D), solve_trace(B, D).
solve_trace(Goal, Depth) :-
    indent(Depth), format("CALL: ~w~n", [Goal]),
    clause(Goal, Body),
    D1 is Depth + 1,
    solve_trace(Body, D1),
    indent(Depth), format("EXIT: ~w~n", [Goal]).

indent(0) :- !.
indent(N) :- N > 0, write('  '), N1 is N - 1, indent(N1).
```

### Proof-collecting meta-interpreter

Build an explanation tree alongside execution:

```prolog
solve_proof(true, true) :- !.
solve_proof((A, B), (PA, PB)) :- !,
    solve_proof(A, PA),
    solve_proof(B, PB).
solve_proof(Goal, Goal-because-Proof) :-
    clause(Goal, Body),
    solve_proof(Body, Proof).
```

```prolog
?- solve_proof(grandparent(tom, jim), Proof).
% Proof = grandparent(tom,jim)-because-(
%           parent(tom,bob)-because-true,
%           parent(bob,jim)-because-true)
```

### Bounded meta-interpreter

Limit search depth to prevent infinite loops:

```prolog
solve_bounded(_, 0) :- !, fail.
solve_bounded(true, _) :- !.
solve_bounded((A, B), D) :- !, solve_bounded(A, D), solve_bounded(B, D).
solve_bounded(Goal, Depth) :-
    Depth > 0,
    clause(Goal, Body),
    D1 is Depth - 1,
    solve_bounded(Body, D1).
```

This is equivalent to iterative deepening when called with increasing depth limits.

## Practical Meta-Programming Patterns

### Predicate transformation

```prolog
% Apply a transformation to all clauses of a predicate
transform_predicate(Pred/Arity) :-
    functor(Head, Pred, Arity),
    forall(clause(Head, Body),
           (transform(Body, NewBody),
            retract((Head :- Body)),
            assert((Head :- NewBody)))).
```

### Runtime predicate generation

```prolog
% Generate accessor predicates from field descriptors
:- dynamic field/2.
field(name, 1). field(age, 2). field(email, 3).

generate_getters :-
    forall(field(Name, Index),
           (Head =.. [Name, Record, Value],
            Body = arg(Index, Record, Value),
            assert((Head :- Body)))).
```

### Collecting structured results with findall

```prolog
% Build a report from scattered facts
:- dynamic sale/3.  % sale(Item, Qty, Price)

sales_report(Report) :-
    findall(
        item(Item, Total),
        (sale(Item, Qty, Price), Total is Qty * Price),
        Report
    ).

total_revenue(Sum) :-
    sales_report(Report),
    aggregate_all(sum(T), member(item(_, T), Report), Sum).
```

### copy_term/2 for safe meta-programming

When manipulating goals as data, `copy_term/2` creates a fresh copy with renamed variables, preventing accidental unification with the caller's variables:

```prolog
?- copy_term(foo(X, Y), Copy).
% Copy = foo(_A, _B)  -- fresh variables, X and Y untouched

% Safe goal application:
apply_fresh(Goal, Arg) :-
    copy_term(Goal, Fresh),
    call(Fresh, Arg).
```

## Why Meta-Programming Matters

In most languages, meta-programming is a separate facility (macros, reflection, codegen). In Prolog, the same unification and backtracking that processes data also processes code. A meta-interpreter is 3-5 lines. Adding explanation, probability, or custom search to an existing program means wrapping it in a slightly modified interpreter, not rewriting it.

This property is why Prolog remains relevant in AI, knowledge representation, and language processing -- domains where the boundary between "data about rules" and "rules" needs to be fluid.
