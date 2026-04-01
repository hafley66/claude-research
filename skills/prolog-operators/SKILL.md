---
name: prolog-operators
description: Prolog operator definitions -- op/3, precedence, associativity (xfx/yfx/xfy), built-in operators, custom DSLs via operators. Trigger on prolog operators, op/3, prolog precedence, operator definition, xfx yfx xfy, prolog DSL.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Prolog Operators

## Operators Are Syntactic Sugar for Terms

Operators in Prolog are not special forms, built-in primitives, or a separate language layer. They are a purely syntactic convenience for writing compound terms in infix, prefix, or postfix notation instead of standard functor notation. The parser rewrites operator expressions into ordinary terms before any evaluation occurs.

```prolog
% These are identical terms:
2 + 3           ≡  +(2, 3)
a :- b, c       ≡  ':-'(a, ','(b, c))
X is Y * 2     ≡  is(X, *(Y, 2))
\+ member(X,L) ≡  \+(member(X, L))
```

Every piece of Prolog source code, including clause heads, bodies, directives, and DCG rules, is a term. The operator table controls how the parser constructs that term from textual input. Nothing more.

Verify this at the REPL:

```prolog
?- display(2 + 3 * 4).
+(2,*(3,4))

?- X = (a :- b, c, d), write_canonical(X).
':-'(a,','(b,','(c,d)))
```

`display/1` and `write_canonical/1` bypass operator formatting and show the underlying functor structure.

## op/3 -- Defining Operators

```prolog
:- op(Priority, Type, Name).
```

- **Priority**: integer 1--1200. Lower numbers bind tighter. `*` at 400 binds tighter than `+` at 500, so `1 + 2 * 3` parses as `+(1, *(2, 3))`.
- **Type**: one of `xfx`, `xfy`, `yfx`, `fx`, `fy`, `xf`, `yf`. Encodes position (infix/prefix/postfix) and associativity.
- **Name**: an atom. Can be symbolic (`<>`, `==>`) or alphabetic (`mod`, `says`).

Priority 0 removes an existing operator definition:

```prolog
:- op(0, yfx, +).   % + is no longer an operator (don't do this)
```

## Operator Type Codes

The type code is a template where `f` marks the operator position and `x`/`y` mark argument positions.

```
Position     Types     Meaning
─────────────────────────────────────────────────
Infix        xfx       non-associative
             xfy       right-associative
             yfx       left-associative
Prefix       fx        non-associative
             fy        right-associative (chainable)
Postfix      xf        non-associative
             yf        left-associative (chainable)
```

### The x vs y distinction

This is the mechanical core of the system.

- `x` means the argument's precedence must be **strictly less than** the operator's precedence.
- `y` means the argument's precedence can be **less than or equal to** the operator's precedence.

An atom or number has precedence 0 (always fits). A compound term's precedence equals the precedence of its principal functor if that functor is an operator, otherwise 0. Parenthesized expressions have precedence 0.

### How associativity falls out of x/y

Consider `+` defined as `op(500, yfx, +)`.

Parsing `1 + 2 + 3`:

1. The left `+` produces the term `+(1, 2)` with precedence 500.
2. The right `+` needs a left argument. Its type is `yfx`, so the left side is `y` (allows precedence <= 500). The term `+(1, 2)` has precedence 500, which satisfies `y`.
3. Result: `+(+(1, 2), 3)` -- left-associative.

Why can't it parse as `+(1, +(2, 3))`? Because the right side is `x` (requires strictly less than 500), and `+(2, 3)` has precedence 500. The `x` rejects it.

Now consider `;` defined as `op(1100, xfy, ;)`.

Parsing `a ; b ; c`:

1. The left `;` tries to claim `b ; c` as its right argument. Its right side is `y` (allows precedence <= 1100). The term `;(b, c)` has precedence 1100. Allowed.
2. Result: `';'(a, ';'(b, c))` -- right-associative.

And `=` defined as `op(700, xfx, =)`:

Parsing `a = b = c`:

1. Both sides are `x` (strictly less than 700). After parsing `a = b`, we'd need `=(a, b)` (precedence 700) to fit in an `x` position of the second `=`. 700 is not strictly less than 700. Syntax error. Non-associative means you cannot chain.

### Prefix example: fy vs fx

`\+` is `op(900, fy, \+)`.

`\+ \+ X` is legal because `fy` allows the argument to have precedence <= 900. The inner `\+(X)` has precedence 900, which satisfies `y`. This chains.

If `\+` were `fx`, then `\+ \+ X` would fail because `fx` requires the argument to have precedence strictly less than 900, and `\+(X)` has precedence 900.

`not` is defined as `op(900, fy, not)` in some systems and `fx` in others. The difference determines whether `not not X` is legal syntax.

## Built-in Operator Table

Standard ISO Prolog operators, in descending precedence (loosest binding first):

```
Prec  Type   Operators                              Role
────────────────────────────────────────────────────────────────
1200  xfx    -->                                    DCG rule neck
1200  xfx    :-                                     clause neck
1200  fx     :-                                     directive
1200  fx     ?-                                     query
1100  xfy    ;                                      disjunction
1050  xfy    ->                                     if-then
1000  xfy    ,                                      conjunction
 900  fy     \+                                     negation-as-failure
 700  xfx    =  \=                                  unification
 700  xfx    ==  \==                                structural equality
 700  xfx    is                                     arithmetic evaluation
 700  xfx    =:=  =\=                               arithmetic equality
 700  xfx    <  >  =<  >=                           arithmetic comparison
 700  xfx    @<  @>  @=<  @>=                       term ordering
 500  yfx    +  -                                   addition/subtraction
 500  fx     -                                      unary minus (some systems: 200 fy)
 400  yfx    *  /  //  mod  rem                     multiplication/division
 400  yfx    rdiv                                   (SWI) rational division
 200  xfx    **                                     exponentiation
 200  fy     -                                      unary minus (ISO)
 200  fy     \                                      bitwise complement
```

Notes on this table:

- `,` at 1000 and `:-` at 1200 means the entire clause body is a single nested term of commas: `','(a, ','(b, c))`.
- `->` at 1050 and `;` at 1100 means `(Cond -> Then ; Else)` parses as `';'('->'(Cond, Then), Else)`. The `->` binds tighter than `;`, which is what makes if-then-else work as a term structure.
- `is` is `xfx` (non-associative). You cannot write `X is Y is Z`. This is intentional since `is` evaluates the right side arithmetically and unifies with the left.
- Unary minus has different precedence in different implementations. ISO says `200 fy`. Some systems use `500 fx`. This affects whether `-2 ** 3` parses as `(-2) ** 3` or `-(2 ** 3)`.

## Custom Operators for DSLs

One of Prolog's distinctive features: the operator table is user-extensible at load time, enabling domain-specific surface syntax that still compiles to ordinary Prolog terms.

```prolog
% Natural-language-style rules
:- op(700, xfx, says).
:- op(600, xfx, to).
:- op(500, yfx, and).

greeting(X, Y) :-
    X says hello to Y and X \= Y.

% The parser produces:
% greeting(X, Y) :- and(says(X, to(hello, Y)), \=(X, Y)).
```

```prolog
% A tiny type system
:- op(700, xfx, ::).     % type annotation
:- op(600, xfy, =>).     % function type (right-associative so a => b => c works)

int :: type.
bool :: type.
arrow(A, B) :: type :- A :: type, B :: type.

% Usage:
?- arrow(int, arrow(bool, int)) :: type.
% true
```

```prolog
% Production rule syntax
:- op(1150, xfx, ==>).
:- op(1100, xfx, <==).

sentence ==> noun_phrase, verb_phrase.
noun_phrase ==> determiner, noun.

% These are just facts with functor ==>
% A meta-interpreter can walk them
```

### Precedence design for custom operators

When assigning precedences to custom operators, the constraints:

- Must be below 1000 if the operator should work inside clause body conjunctions (since `,` is 1000).
- Must be below 700 if the operator should work as an argument to `=` or `is`.
- Right-associative (`xfy`) for operators that should chain: `a => b => c => d`.
- Non-associative (`xfx`) for operators that should not: `X :: T` (one annotation per expression).
- Left-associative (`yfx`) for operators modeling left-to-right application: `a and b and c`.

## current_op/3 -- Querying the Operator Table

```prolog
?- current_op(P, T, +).
% P = 500, T = yfx

?- current_op(700, xfx, Op).
% Op = = ; Op = \= ; Op = == ; Op = \== ; Op = is ; ...
% (enumerates via backtracking)

?- current_op(P, T, mod).
% P = 400, T = yfx

% Find all operators at a given precedence:
?- current_op(1100, T, Op).
% T = xfy, Op = ;
```

## Operators and Term Decomposition

Since operators produce ordinary terms, standard term manipulation predicates (=.., functor/3, arg/3) work on them directly:

```prolog
?- X = (1 + 2 * 3), X =.. [Op | Args].
% X = 1+2*3
% Op = +
% Args = [1, 2*3]
% (2*3 is a subterm of + because * binds tighter)

?- X = (a, b, c), functor(X, F, A).
% F = ','
% A = 2
% (conjunction is binary: ','(a, ','(b, c)))

?- X = (1 + 2 + 3), arg(1, X, Left), arg(2, X, Right).
% Left = 1+2
% Right = 3
% (left-associative: the left branch is the nested subterm)
```

This is the basis for meta-interpreters, code analyzers, and program transformers. A Prolog program can read, inspect, and rewrite other Prolog programs because programs are terms and operators define how text maps to terms.

## Gotchas

**Operator definitions are global.** Loading a module that defines operators pollutes the global operator table in many Prolog systems. The module system (where available) provides `module/2` export lists that can include operator declarations, but the scoping behavior varies across implementations. SWI-Prolog 8+ has improved module-local operators, but older code and other systems (SICStus, GNU Prolog) may not contain operators to modules at all.

**Space sensitivity around minus.** `a-b` is the term `-(a, b)`. But `f(-3)` is `f` applied to negative 3 (prefix `-`). The parser uses whitespace and context to disambiguate:

```prolog
?- X = f(1 -2).    % some parsers: f(-(1,2)) or f(1, -2)?
?- X = f(1 - 2).   % unambiguous: f(-(1, 2))
?- X = f(-2).       % unambiguous: f(-2)
```

Best practice: always use spaces around infix operators.

**Overusing custom operators destroys readability.** An operator only aids comprehension if the reader knows the table. For shared codebases, functor notation (`says(X, hello)`) is often clearer than clever infix (`X says hello`) because it requires zero context about operator declarations. Reserve custom operators for well-documented DSLs where the syntactic benefit is substantial.

**Parentheses reset precedence to 0.** This is how you override associativity: `1 + (2 + 3)` forces right-nesting even though `+` is left-associative. The parenthesized subexpression `(2 + 3)` has precedence 0, which satisfies any `x` or `y` constraint.

**The 1200 ceiling.** No operator can have precedence above 1200. The clause-level operators `:-` and `-->` sit at the maximum. A term at the top level of a clause cannot have precedence exceeding 1200, which is why writing a bare `a ; b` at the top level (precedence 1100) works, but attempting to define an operator above 1200 fails.
