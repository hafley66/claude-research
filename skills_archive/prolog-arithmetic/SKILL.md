---
name: prolog-arithmetic
description: Prolog arithmetic -- is/2 evaluation, comparison operators, arithmetic vs unification, CLP(FD) constraint solving, Peano arithmetic. Trigger on prolog arithmetic, prolog is, prolog math, CLP FD, prolog constraints, prolog numbers.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Prolog Arithmetic

## The Arithmetic Problem

Prolog terms are symbolic. `3 + 4` is the compound term `+(3, 4)`, not 7. The `+` functor has no inherent evaluation semantics in the term language. Unification does structural matching, so:

```prolog
?- X = 3 + 4.
% X = 3+4   (X is bound to the structure +(3,4))
```

X now holds the unevaluated term. This is the first shock for imperative programmers: operators in Prolog are syntactic sugar for compound terms, not instructions. `2 * (3 + 4)` is `*(2, +(3, 4))`. The WAM (Warren Abstract Machine) stores these as heap structures, not numeric results.

## is/2 -- The Evaluation Operator

`is/2` bridges the symbolic/numeric gap. It evaluates the right-hand side as an arithmetic expression and unifies the result with the left-hand side.

```prolog
?- X is 3 + 4.      % X = 7
?- X is 2 ** 10.     % X = 1024
?- X is mod(7, 3).   % X = 1
?- X is sqrt(16).    % X = 4.0
?- X is abs(-5).     % X = 5
?- X is max(3, 7).   % X = 7
?- X is msb(255).    % X = 7  (most significant bit, SWI-Prolog)
```

Key constraints:

- The right-hand side must be **fully ground** (all variables bound to numbers). `X is Y + 1` with unbound Y throws `instantiation_error`.
- Evaluation is **one-directional**. `7 is X + 4` does not solve for X. It throws `instantiation_error` because `X + 4` cannot be evaluated.
- `is/2` evaluates exactly once. The result is a number, not a lazy expression. After `X is 3 + 4`, X holds the integer 7, not the term `+(3,4)`.

This breaks Prolog's usual bidirectionality. A relation like `append/3` works in all directions. `is/2` works in exactly one direction: right-to-left evaluation, left-side unification.

### Integer vs Float

SWI-Prolog distinguishes integer and float arithmetic. `3 / 2` yields `1` (integer division). `3.0 / 2` yields `1.5`. Use `//` for explicit integer division, `/` follows the type of the operands.

```prolog
?- X is 7 / 2.    % X = 3   (integer division)
?- X is 7.0 / 2.  % X = 3.5
?- X is 7 // 2.   % X = 3   (explicit integer division)
?- X is 7 mod 2.  % X = 1
?- X is 7 rem 2.  % X = 1   (rem vs mod differs for negatives)
```

## Comparison Operators

Arithmetic comparison operators evaluate both sides, then compare:

```prolog
X =:= Y   % arithmetic equality (evaluates both sides)
X =\= Y   % arithmetic inequality
X < Y      % less than
X > Y      % greater than
X =< Y     % less than or equal (NOT <=)
X >= Y     % greater than or equal
```

The `=<` syntax is deliberate. `<=` was avoided because `<=/2` would conflict with the arrow notation used in some Prolog traditions (DCGs, etc.). Both sides must be ground, same as `is/2`.

```prolog
?- 3 + 4 =:= 7.     % true
?- 3 + 4 =:= 2 + 5. % true (evaluates both sides)
?- 3.0 =:= 3.        % true (numeric equality across types)
?- 3 + 4 < 10.       % true
```

## The Three Equalities

This is the core confusion point. Prolog has three distinct equality-like operations:

```prolog
?- 3 + 4 = 7.       % false  (structural: +(3,4) does not unify with 7)
?- 3 + 4 =:= 7.     % true   (arithmetic: evaluates both, compares numerically)
?- X = 3 + 4.        % X = 3+4 (binds X to the compound term)
?- X is 3 + 4.       % X = 7   (evaluates right side, unifies result with left)
?- 7 == 7.           % true   (structural identity, no binding occurs)
?- X == 7.           % false  (X is unbound variable, not identical to 7)
?- X = 7, X == 7.    % true   (after unification, X is 7, identical to 7)
```

| Operator | What it does | Evaluates? | Binds variables? |
|----------|-------------|------------|-----------------|
| `=`      | Unification | No | Yes |
| `==`     | Structural identity | No | No |
| `=:=`    | Arithmetic equality | Yes, both sides | No |
| `is`     | Arithmetic evaluation | Yes, right side only | Yes (left side) |

`\=` is "does not unify", `\==` is "not structurally identical", `=\=` is "arithmetically not equal". The backslash position matters.

## CLP(FD) -- Constraint Logic Programming over Finite Domains

CLP(FD) restores bidirectionality to arithmetic by replacing evaluation with constraint propagation.

```prolog
:- use_module(library(clpfd)).

?- X #= Y + 1, Y #= 5.
% X = 6, Y = 5

?- X #= Y + 1, X #= 6.
% X = 6, Y = 5  (solved for Y -- bidirectional)

?- X #> 3, X #< 7, X in 1..10, label([X]).
% X = 4 ; X = 5 ; X = 6
```

### How CLP(FD) works

Constraints are posted to a constraint store. Each variable has an associated domain (a set of possible integer values). When a constraint is added, the solver performs **arc consistency** propagation: it removes values from domains that cannot satisfy any constraint. `label/1` triggers **enumeration**, forcing the solver to commit to specific values through search.

```prolog
:- use_module(library(clpfd)).

% Constraint operators (replace is/2 and comparison operators)
X #= Y      % arithmetic equality
X #\= Y     % arithmetic inequality
X #< Y      % less than
X #> Y      % greater than
X #=< Y     % less or equal
X #>= Y     % greater or equal

% Domain specification
X in 1..100           % X is between 1 and 100
X in 1..5 \/ 10..15   % X is in 1-5 or 10-15

% Enumeration
label([X, Y, Z])              % basic labeling
labeling([min(X)], [X, Y])    % minimize X during search
indomain(X)                   % enumerate one variable
```

### CLP(FD) example: SEND + MORE = MONEY

```prolog
:- use_module(library(clpfd)).

sendmore(Digits) :-
    Digits = [S, E, N, D, M, O, R, Y],
    Digits ins 0..9,
    all_different(Digits),
    S #\= 0, M #\= 0,
                 1000*S + 100*E + 10*N + D
    +            1000*M + 100*O + 10*R + E
    #= 10000*M + 1000*O + 100*N + 10*E + Y,
    label(Digits).
```

The solver narrows domains through propagation before any search happens. For well-constrained problems, labeling may have nothing left to search.

### When to use CLP(FD) vs is/2

- Use `is/2` when computing a known value from known inputs (straightforward evaluation).
- Use CLP(FD) when you need bidirectionality, when variables may not be ground yet, or when solving constraint satisfaction problems.
- CLP(FD) only handles integers. For reals, use `library(clpr)` or `library(clpq)` (rationals).

## Peano Arithmetic

The "pure logic" approach. Represent natural numbers as nested successor terms: 0 is `zero`, 1 is `s(zero)`, 2 is `s(s(zero))`, 3 is `s(s(s(zero)))`.

```prolog
nat(zero).
nat(s(X)) :- nat(X).

add(zero, Y, Y).
add(s(X), Y, s(Z)) :- add(X, Y, Z).

mult(zero, _, zero).
mult(s(X), Y, Z) :- mult(X, Y, W), add(W, Y, Z).
```

This is fully bidirectional through unification alone:

```prolog
?- add(s(s(zero)), s(s(s(zero))), R).
% R = s(s(s(s(s(zero)))))   (2 + 3 = 5)

?- add(X, s(s(zero)), s(s(s(zero)))).
% X = s(zero)               (X + 2 = 3, so X = 1)

?- add(X, Y, s(s(zero))).
% X = zero, Y = s(s(zero)) ;
% X = s(zero), Y = s(zero) ;
% X = s(s(zero)), Y = zero  (all pairs summing to 2)
```

Peano arithmetic proves that arithmetic can be expressed in pure logic with no special evaluation machinery. The tradeoff: representing N requires O(N) term structure, making it impractical for anything beyond small numbers. It exists to demonstrate the theoretical point, not for production use. `is/2` exists because pragmatism demands it.

## Common Arithmetic Patterns

### Factorial

```prolog
factorial(0, 1).
factorial(N, F) :-
    N > 0,
    N1 is N - 1,
    factorial(N1, F1),
    F is N * F1.
```

Note the pattern: guard (`N > 0`), compute decremented value (`N1 is N - 1`), recurse, compute result (`F is N * F1`). The `is` calls are interspersed with the recursion because each one needs its inputs ground.

### Tail-recursive Fibonacci with accumulator

```prolog
fib(N, F) :- fib(N, 0, 1, F).
fib(0, A, _, A).
fib(N, A, B, F) :-
    N > 0,
    N1 is N - 1,
    C is A + B,
    fib(N1, B, C, F).
```

Accumulators are the standard technique for turning tree recursion into linear recursion in Prolog. The two accumulators (A, B) hold the running Fibonacci pair, avoiding the exponential blowup of the naive doubly-recursive definition.

### Sum of a list

```prolog
sum_list([], 0).
sum_list([H|T], S) :-
    sum_list(T, S1),
    S is S1 + H.
```

### Length of a list (with accumulator)

```prolog
my_length(List, N) :- my_length(List, 0, N).
my_length([], Acc, Acc).
my_length([_|T], Acc, N) :-
    Acc1 is Acc + 1,
    my_length(T, Acc1, N).
```

### CLP(FD) versions of the same

```prolog
:- use_module(library(clpfd)).

factorial_fd(0, 1).
factorial_fd(N, F) :-
    N #> 0,
    N1 #= N - 1,
    F #= N * F1,
    factorial_fd(N1, F1).

sum_list_fd([], 0).
sum_list_fd([H|T], S) :-
    sum_list_fd(T, S1),
    S #= S1 + H.
```

The CLP(FD) versions can sometimes run in reverse (given the result, find the inputs), though termination depends on the domain bounds and search strategy.

## The Tension

The split between symbolic terms and numeric evaluation reflects a fundamental tension in logic programming. Pure first-order logic has no built-in notion of number. Numbers in logic are either:

1. **Encoded structurally** (Peano) -- pure but impractical
2. **Handled by an external evaluator** (`is/2`) -- efficient but breaks relational semantics
3. **Managed by a constraint solver** (CLP(FD)) -- preserves relational semantics with reasonable efficiency

CLP(FD) is the modern recommended approach for integer arithmetic in Prolog. It subsumes both `is/2` and comparison operators for the integer case while maintaining the declarative, bidirectional character of logic programming. The cost is a more complex implementation (constraint store, propagation, search) and restriction to finite integer domains.
