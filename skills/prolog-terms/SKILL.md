---
name: prolog-terms
description: Prolog term structure -- atoms, numbers, variables, compound terms, functor/3, =../2 (univ), copy_term, term ordering, term inspection. Trigger on prolog terms, functor, univ, copy_term, prolog data structures, compound terms.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Prolog Terms

## Everything is a Term

Prolog has exactly one data type: the term. No objects, no structs, no classes. Terms come in four varieties:

**Atoms** -- lowercase identifiers or quoted strings. Constants with identity but no internal structure.
```prolog
hello
'Hello World'
+
[]
```
Closest analogy in TypeScript: string constants, symbols, or enum variants.

**Numbers** -- integers and floats.
```prolog
42
3.14
-7
```

**Variables** -- uppercase or underscore-prefixed identifiers. These are logic variables (placeholders for unification), not storage locations.
```prolog
X
_Temp
_          % anonymous variable, each occurrence is independent
```

**Compound terms** -- a functor (name) applied to arguments. The functor has a name and an arity (argument count). `f/2` means "the functor named `f` with 2 arguments."
```prolog
f(a, b)
parent(tom, bob)
+(1, 2)          % operators are syntactic sugar for compound terms
[H|T]            % list syntax is sugar for '.'(H, T)
```

Atoms are compound terms with arity 0. `hello` is `hello/0`.

## Compound Terms as Data Structures

All data structures are compound terms. There is no other mechanism.

```prolog
% A 2D point
point(3, 4).

% A binary tree
tree(node(1, leaf, node(2, leaf, leaf))).

% A key-value pair (the '-' operator creates -(Name, Value))
Name-Value.

% A person record
person(name("Alice"), age(30), address(city("Portland"), state("OR"))).

% An expression tree
expr(plus(lit(1), times(lit(2), var(x)))).
```

TypeScript analogy: compound terms are tagged tuples. `point(3, 4)` maps to `["point", 3, 4]` where the tag is the functor name.

Nesting is the only composition mechanism. There is no field access syntax. Pattern matching via unification is how you extract components.

```prolog
get_x(point(X, _), X).
get_y(point(_, Y), Y).

?- get_x(point(3, 4), X).
% X = 3
```

## functor/3 and arg/3 -- Term Inspection

`functor/3` relates a term to its functor name and arity. It is bidirectional.

```prolog
% Inspection: term -> name + arity
?- functor(f(a, b, c), Name, Arity).
% Name = f, Arity = 3

?- functor(hello, Name, Arity).
% Name = hello, Arity = 0

?- functor(42, Name, Arity).
% Name = 42, Arity = 0

% Construction: name + arity -> term (with fresh variables as args)
?- functor(T, f, 3).
% T = f(_A, _B, _C)
```

`arg/3` extracts the Nth argument from a compound term. 1-indexed.

```prolog
?- arg(1, f(a, b, c), X).
% X = a

?- arg(2, f(a, b, c), X).
% X = b

?- arg(3, f(a, b, c), X).
% X = c
```

`arg/3` is deterministic and O(1). It does not construct or modify, only reads. Unlike `=..`, it does not allocate a list. Prefer `arg/3` over `=..` when you know the argument position.

## =../2 (Univ) -- Term Deconstruction/Construction

Pronounced "univ." Converts between a term and a list `[Functor | Arguments]`.

```prolog
% Deconstruction
?- f(a, b, c) =.. L.
% L = [f, a, b, c]

?- hello =.. L.
% L = [hello]

?- 3 + 4 =.. L.
% L = [+, 3, 4]

% Construction
?- T =.. [g, 1, 2].
% T = g(1, 2)

% Decompose into functor and args separately
?- foo(bar, baz) =.. [F | Args].
% F = foo, Args = [bar, baz]
```

Primary use case: meta-programming. When you need to build or transform terms dynamically, such as adding arguments to a goal, dispatching on functor name, or serializing term structure.

```prolog
% Add an extra argument to any goal
add_arg(Goal, Arg, NewGoal) :-
    Goal =.. [F | Args],
    append(Args, [Arg], NewArgs),
    NewGoal =.. [F | NewArgs].

?- add_arg(foo(1, 2), 3, G).
% G = foo(1, 2, 3)
```

TypeScript analogy: like `Object.entries()` but for the structure of a function call itself.

Performance note: `=..` allocates a list. For known-position argument access, `arg/3` and `functor/3` avoid this cost.

## copy_term/2

Creates a copy of a term with fresh (unbound) variables. The structural relationships between variables are preserved, but no bindings are shared with the original.

```prolog
?- copy_term(f(X, Y, X), Copy).
% Copy = f(_A, _B, _A)
% Note: _A and _B are new variables, but both X-positions map to the same _A
```

The original variables remain unaffected:
```prolog
?- T = f(X, g(X, Y)),
   copy_term(T, Copy),
   X = hello.
% T = f(hello, g(hello, Y))
% Copy = f(_A, g(_A, _B))   -- Copy is untouched by X = hello
```

Use cases:
- Meta-interpreters that need to reuse clause templates without contaminating bindings
- Generating fresh instances of a term pattern
- Implementing `assert`-like operations that store terms for later independent use

```prolog
% A simple template system
apply_template(Template, Instance) :-
    copy_term(Template, Instance).

?- Template = row(_, _, _),
   apply_template(Template, R1),
   apply_template(Template, R2),
   R1 = row(1, 2, 3).
% R1 = row(1, 2, 3)
% R2 = row(_A, _B, _C)   -- independent copy
% Template = row(_, _, _) -- original untouched
```

## Term Ordering

Prolog defines a standard order over all terms:

```
Variables @< Numbers @< Atoms @< Compound Terms
```

Within each category:
- **Numbers**: by numeric value
- **Atoms**: alphabetically
- **Compound terms**: first by arity, then by functor name alphabetically, then by arguments left to right recursively

```prolog
?- compare(Order, 2, a).
% Order = (<)    % numbers precede atoms

?- compare(Order, a, f(1)).
% Order = (<)    % atoms precede compound terms

?- compare(Order, f(1), g(1)).
% Order = (<)    % same arity, f < g alphabetically

?- compare(Order, f(1, 2), g(1)).
% Order = (>)    % arity 2 > arity 1
```

Comparison operators for standard order (distinct from arithmetic `<`, `>`):
```prolog
@<    % less than in standard order
@>    % greater than
@=<   % less than or equal
@>=   % greater than or equal
```

This ordering is structural, not semantic. `2 @< a` holds because numbers precede atoms in the standard order, regardless of any meaning. The ordering exists so that terms can be keys in ordered data structures (`library(assoc)`, `library(rbtrees)`).

`msort/2` and `sort/2` use standard order:
```prolog
?- msort([f(2), a, 3, X, f(1), b], Sorted).
% Sorted = [X, 3, a, b, f(1), f(2)]
```

## Type Checking Predicates

Runtime type checks on terms. The closest Prolog has to a type system.

```prolog
atom(hello)       % true
atom(42)          % false
atom('Hi')        % true -- quoted atoms are still atoms

number(42)        % true
integer(42)       % true
float(3.14)       % true

compound(f(x))    % true
compound(hello)   % false -- atoms are not compound
compound([1,2])   % true -- lists are compound terms

var(X)            % true if X is unbound
nonvar(X)         % true if X is bound to something

ground(f(1, 2))   % true -- no unbound variables anywhere in the term
ground(f(X, 2))   % false if X is unbound

callable(hello)   % true -- atoms can be called as goals
callable(f(x))    % true -- compound terms can be called as goals
callable(42)      % false

is_list([1,2,3])  % true -- proper list (ends in [])
is_list([1|2])    % false -- improper list
```

Common pattern for conditional dispatch:
```prolog
process(X) :- atom(X),     !, format("Atom: ~w~n", [X]).
process(X) :- number(X),   !, format("Number: ~w~n", [X]).
process(X) :- compound(X), !, format("Compound: ~w~n", [X]).
process(X) :- var(X),      !, format("Unbound variable~n").
```

`var/X` and `nonvar/X` are sensitive to the moment of evaluation. A variable that is unbound when `var` is called may be bound later by unification. These checks are inherently non-monotonic.

## Terms as Code (Homoiconicity)

Prolog code IS terms. A clause `head :- body` is the term `':-'(head, body)`. A query `?- goal` is the term `'?-'(goal)`. This makes code-as-data manipulation seamless, without any quoting or special syntax.

```prolog
% Store a goal in a variable and call it
?- Goal = member(X, [1,2,3]), call(Goal).
% X = 1 ; X = 2 ; X = 3

% Build a goal dynamically and call it
?- Pred = append,
   Goal =.. [Pred, [1,2], [3,4], Result],
   call(Goal).
% Result = [1, 2, 3, 4]

% Inspect a clause as a term
?- clause(append([], L, L), Body).
% Body = true   (it's a fact, so body is 'true')
```

Conjunction `(A, B)` is the compound term `','(A, B)`. Disjunction `(A ; B)` is `';'(A, B)`. Every piece of Prolog syntax desugars into compound terms.

```prolog
% A minimal meta-interpreter
solve(true).
solve((A, B)) :- solve(A), solve(B).
solve(Goal)   :- clause(Goal, Body), solve(Body).
```

This meta-interpreter works because `clause/2` returns the body of a matching clause as a term, and that term can be recursively interpreted. No parsing step, no eval function, no AST construction. The code is already the AST.
