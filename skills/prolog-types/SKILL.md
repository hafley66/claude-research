---
name: prolog-types
description: Typed logic programming -- Mercury, Ciao, Logtalk, type annotations for Prolog, static analysis, mode declarations, determinism declarations. Trigger on prolog types, mercury language, ciao prolog, typed prolog, prolog static analysis, logtalk, prolog type checking.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Typed Logic Programming

## The Type Problem in Prolog

Standard Prolog has no type system. Everything is a term. Variables can unify with anything. Errors are caught at runtime (if at all).

Consequences:

- Typos in atom names silently fail instead of raising errors
- Passing wrong argument types only manifests as unexpected failure or wrong results
- Refactoring is terrifying with no compiler to catch breakage
- From a TypeScript or Rust perspective, this is writing JavaScript with `any` everywhere

## Mercury

The most serious typed logic programming language. What you get if you take Prolog seriously as an engineering language.

```mercury
:- module hello.
:- interface.
:- import_module io.
:- pred main(io::di, io::uo) is det.

:- implementation.

:- type tree(T) ---> leaf ; node(tree(T), T, tree(T)).

:- pred member(T::out, tree(T)::in) is nondet.
member(X, node(_, X, _)).
member(X, node(L, _, _)) :- member(X, L).
member(X, node(_, _, R)) :- member(X, R).
```

Key features:

- **Algebraic data types**: `---> ` syntax (like Rust enums / Haskell ADTs)
- **Mode declarations**: `::in`, `::out`, `::di` (destructive input), `::uo` (unique output)
- **Determinism categories**: `is det` (exactly one solution), `is semidet` (zero or one), `is nondet` (any number), `is multi` (one or more), plus `is cc_nondet`, `is cc_multi` (committed choice variants), `is failure` (always fails), `is erroneous` (always throws)
- **Purity enforcement**: I/O must be threaded through `io` state (like Haskell's IO monad)
- **Compiles to C**: Much faster than interpreted Prolog

The type/mode/determinism system catches at compile time what Prolog catches at runtime (or never).

Mercury's mode system is conceptually similar to Rust's ownership: it tracks how data flows through predicates and prevents misuse at compile time.

## Ciao Prolog

A Prolog with assertions and static analysis.

```prolog
:- module(mymod, [append/3]).

:- pred append(X, Y, Z)
   : (list(X), list(Y))
   => list(Z)
   + det.

append([], L, L).
append([H|T], L, [H|R]) :- append(T, L, R).
```

Assertion syntax:

- `:` precondition (types of inputs)
- `=>` postcondition (type of output)
- `+` properties (determinism, no side effects, etc.)

CiaoPP (Ciao Preprocessor) performs static analysis and can verify or infer these assertions. Less strict than Mercury: assertions are checked/inferred but not required.

## Logtalk

Object-oriented layer on top of Prolog.

```logtalk
:- object(stack).
    :- public([push/3, pop/3, empty/1]).

    empty([]).
    push(Stack, Elem, [Elem|Stack]).
    pop([Top|Rest], Top, Rest).
:- end_object.

?- stack::push([], hello, S).  % S = [hello]
```

- Runs on top of SWI, SICStus, YAP, GNU, etc.
- Provides encapsulation, inheritance, protocols (interfaces)
- Not really a type system, but provides structure and access control
- For someone who wants OOP-like organization in Prolog

## SWI-Prolog Type Checking Approaches

### mavis pack (type annotations)

```prolog
:- use_module(library(mavis)).
:- type point ---> point(integer, integer).
:- spec greet(+atom) is det.
greet(Name) :- format("Hello ~w~n", [Name]).
```

### error/must_be (runtime validation)

```prolog
:- use_module(library(error)).
my_pred(X) :-
    must_be(integer, X),
    ...
```

### plspec (contract-style specifications)

Adds pre/postconditions that are checked at runtime.

## Mode Declarations in SWI

While not enforced, documenting modes is idiomatic SWI-Prolog:

```prolog
%% append(+List1:list, +List2:list, -List3:list) is det.
%% append(-List1:list, -List2:list, +List3:list) is multi.
```

The `+` means input (bound), `-` means output (unbound), `?` means either. These are documentation-level in SWI but enforced in Mercury.

## Comparison

```
Feature        | Prolog  | Mercury    | Ciao      | Logtalk
Types          | none    | algebraic  | assertion | protocols
Mode checking  | none    | compile    | analysis  | none
Determinism    | none    | compile    | analysis  | none
Purity         | none    | enforced   | tracked   | none
Speed          | interp  | compiled   | varies    | interp
Ecosystem      | large   | small      | medium    | medium
Learning curve | medium  | steep      | medium    | medium
```

## Scryer Prolog

A newer Prolog implementation written in Rust, aiming for ISO compliance.

- WAM-based (Warren Abstract Machine)
- Focuses on correctness over SWI-compatibility
- Implements ISO modules
- Smaller ecosystem but growing
- Interesting as a "what if Prolog were implemented from scratch today" project

## The Type System Spectrum

Mapped to TypeScript/Rust mental models:

- **Prolog**: Like JavaScript `any` everywhere. Maximum flexibility, minimum safety.
- **Ciao**: Like TypeScript. Optional types that can be gradually added and checked.
- **Mercury**: Like Rust. Strict types, modes (ownership-like), enforced at compile time.

The tradeoff: stricter types reduce the "magic" of Prolog (multi-directional predicates are harder to type), but prevent real bugs.

## What to Choose

- **Learning Prolog?** SWI-Prolog. Largest community, best docs, most libraries.
- **Want types?** Mercury (steep learning curve) or Ciao (gentler).
- **Want OOP structure?** Logtalk on top of SWI.
- **Building production systems?** SICStus (commercial, fast) or Mercury (compiled, typed).
- **Curious about modern implementations?** Scryer Prolog (Rust-based, ISO-focused).
