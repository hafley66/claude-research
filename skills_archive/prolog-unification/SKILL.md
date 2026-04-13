---
name: prolog-unification
description: Prolog unification algorithm -- variable binding, substitution, occurs check, unification vs pattern matching, bidirectional matching. Trigger on prolog unification, unify, variable binding, occurs check, pattern matching prolog.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Prolog Unification

## What Unification Is

Unification is the single operation that drives all of Prolog's computation. Given two terms, unification finds a *substitution* -- a set of variable bindings -- that makes the two terms syntactically identical. If no such substitution exists, unification fails.

Every clause selection, every argument pass, every "assignment" in Prolog is unification. There is no other mechanism. When Prolog selects a clause for a goal, it unifies the goal with the clause head. When a "result" comes back, it was unified into a variable. The entire execution model is repeated unification plus backtracking.

## The Algorithm (Martelli-Montanari)

The unification algorithm operates on pairs of terms. Given terms `s` and `t`:

1. **Constant = Constant**: Two atoms/numbers unify iff they are identical.
   - `foo = foo` -- succeeds
   - `foo = bar` -- fails
   - `3 = 3` -- succeeds
   - `3 = 4` -- fails

2. **Variable = Anything**: A variable unifies with any term and becomes bound to it.
   - `X = hello` -- succeeds, binds X to `hello`
   - `X = f(a, b)` -- succeeds, binds X to `f(a, b)`
   - If both sides are unbound variables, they become *aliased* (co-references that will resolve to the same value when either gets bound later).

3. **Compound = Compound**: Two compound terms `f(s1, ..., sn)` and `g(t1, ..., tn)` unify iff:
   - `f` and `g` are the same functor
   - `n` is the same arity
   - Each `si` unifies with `ti` pairwise, composing the substitutions

4. **All other combinations fail.** An atom cannot unify with a compound term of nonzero arity. A number cannot unify with a functor.

### Worked Example

Unify `f(X, g(Y, a))` with `f(h(Z), g(b, Z))`:

```
Step 1: Top-level functors match: f/2 = f/2. Proceed to arguments.

Step 2: Unify arg 1: X = h(Z)
        X is unbound. Bind X -> h(Z).
        Substitution so far: {X = h(Z)}

Step 3: Unify arg 2: g(Y, a) = g(b, Z)
        Functors match: g/2 = g/2. Recurse into arguments.

Step 4: Unify g's arg 1: Y = b
        Y is unbound. Bind Y -> b.
        Substitution so far: {X = h(Z), Y = b}

Step 5: Unify g's arg 2: a = Z
        Z is unbound. Bind Z -> a.
        Substitution so far: {X = h(Z), Y = b, Z = a}

Step 6: Apply substitution transitively: X = h(Z) = h(a).
        Final: {X = h(a), Y = b, Z = a}
```

Verify: substituting back, both sides become `f(h(a), g(b, a))`. Identical. Unification succeeded.

## Unification vs Pattern Matching

Pattern matching (Rust `match`, TS type narrowing, Haskell LHS patterns) is **one-directional**: the pattern is a fixed template, the scrutinee is a value, and variables flow in one direction -- from value into pattern bindings.

Unification is **bidirectional**: both sides can contain unbound variables, and bindings flow in both directions simultaneously.

This distinction has a concrete consequence. Consider `append/3`:

```prolog
append([], L, L).
append([H|T], L, [H|R]) :- append(T, L, R).
```

Call it "forward" -- concatenation:
```prolog
?- append([1,2], [3], Result).
% Result = [1,2,3]
```

Call it "backward" -- list splitting:
```prolog
?- append(X, Y, [1,2,3]).
% X = [], Y = [1,2,3]
% X = [1], Y = [2,3]
% X = [1,2], Y = [3]
% X = [1,2,3], Y = []
```

The same two clauses work in both directions because unification does not distinguish "input" from "output." Each argument position can be ground, partially ground, or completely unbound. Pattern matching cannot do this: a Rust `match` arm destructures a known value; it cannot *generate* the value that would have matched. Unification can.

**Rust analogy**: Imagine `match` could run backwards. You write a destructuring pattern, and instead of checking whether a value fits, the runtime *produces all values that would fit*. That is what unification gives you for free.

**TypeScript analogy**: `T extends Array<infer U>` extracts `U` from a known `T`. Unification would let you also go the other direction -- given `U`, synthesize all `T` that satisfy the constraint. TS's conditional types are one-directional pattern matches over types; Prolog's unification is bidirectional constraint solving over terms.

## Occurs Check

Should `X = f(X)` succeed?

If it does, `X` must equal `f(f(f(f(...))))` -- an infinite (rational) term. The **occurs check** is the step in the unification algorithm that, before binding `X` to a term `t`, verifies that `X` does not appear in `t`. If it does, unification fails.

Standard unification (Robinson's algorithm, Martelli-Montanari) includes the occurs check. It makes the algorithm O(n) where n is term size, but prevents infinite terms.

**SWI-Prolog's default behavior omits the occurs check** for performance. `X = f(X)` succeeds and creates a cyclic term. This is a deliberate engineering tradeoff: the occurs check is O(n) on every variable binding, and in practice, self-referential unifications are rare. When correctness matters, use `unify_with_occurs_check/2`:

```prolog
?- X = f(X).
% Succeeds in SWI-Prolog. X is now a cyclic term.

?- unify_with_occurs_check(X, f(X)).
% Fails. The occurs check catches the circularity.
```

**TypeScript parallel**: TS has recursion depth limits on type resolution. A type like `type X = { val: X }` is allowed (it is a valid recursive type), but `type X = X` would be meaningless. The occurs check is the term-level analog of detecting when a type variable would need to be infinite to satisfy a constraint.

## Substitution and Binding

A Prolog variable starts life **unbound** -- it is a logic variable, a placeholder for a term to be determined. Unification binds it. The runtime maintains a **substitution environment**: a mapping from variables to terms.

Key properties of this environment:

- **Write-once**: A variable, once bound, cannot be rebound to a different term within the same execution path. `X = 3, X = 4` fails because after the first unification X is bound to 3, and `3 = 4` fails.
- **Transitivity**: If `X = Y` and later `Y = 5`, then `X = 5`. The binding chains are followed (dereferenced) automatically.
- **Undone on backtracking**: Prolog maintains a **trail** -- a log of which variables were bound since the last choice point. When backtracking occurs, the trail is unwound, restoring those variables to unbound. This is a transactional rollback mechanism.

**TypeScript analogy**: During type inference, the TS compiler builds a map from type parameters to their resolved types. When resolving `function identity<T>(x: T): T` called as `identity(42)`, the compiler unifies `T` with `number` and records `T -> number` in its substitution map. Prolog's substitution environment is the same concept, applied at runtime to data terms, with the additional property that bindings get rolled back on backtrack.

**RxJS analogy**: Think of the trail as a stack of undo operations. `scan()` accumulates state; the trail is like a `scan()` that also supports rewinding to any previous accumulator snapshot. Each choice point is a savepoint.

## Unification in Practice

```prolog
?- f(X, b) = f(a, Y).
% X = a, Y = b
% Both arguments unified pairwise.

?- f(X, X) = f(a, b).
% FAILS.
% First argument: X = a. Second argument: X = b.
% But X is already bound to a, and a \= b.

?- [H|T] = [1, 2, 3].
% H = 1, T = [2, 3]
% List syntax [H|T] is sugar for the compound term '.'(H, T).
% Unification decomposes the list.

?- foo(X, bar(Y)) = foo(baz(1), bar(quux)).
% X = baz(1), Y = quux
% Nested compound terms: unification recurses through structure.

?- X = Y, Y = Z, Z = hello.
% X = hello, Y = hello, Z = hello
% Variable aliasing followed by binding. All three co-refer.

?- [1, 2 | T] = [1, 2, 3, 4].
% T = [3, 4]
% Partial list matching. The first two elements unify,
% T captures the rest.
```

## Difference from Assignment

`=` in Prolog is **not assignment**. It is a unification request. The distinction matters:

```prolog
?- X = 3.
% Succeeds. X is now bound to 3.

?- X = 3, X = 3.
% Succeeds. Second unification: 3 = 3, which is trivially true.

?- X = 3, X = 4.
% FAILS. After X = 3, the second goal becomes 3 = 4. Atoms differ.
% There is no overwrite. The binding is permanent (within this branch).
```

In an imperative language, `x = 3; x = 4;` overwrites. In Prolog, the second unification *checks* whether the existing binding is consistent with the new constraint. If not, it fails, which triggers backtracking.

The `\=` operator means "does not unify" -- it succeeds when unification would fail:

```prolog
?- foo \= bar.    % Succeeds. foo and bar cannot unify.
?- X \= 3.        % Fails. X is unbound, so X = 3 would succeed.
?- X = 4, X \= 3. % Succeeds. X is bound to 4, and 4 = 3 would fail.
```

`\=` is not arithmetic inequality (`=\=`). It is the negation of unifiability.

## Connection to Type Systems

The intuition that TypeScript's type resolution feels "unification-like" is structurally correct. Hindley-Milner type inference -- the algorithm underlying ML, Haskell, and (in a limited, approximate form) TypeScript -- literally runs Robinson's unification algorithm over type terms.

When the ML compiler sees:

```ml
let f x = x + 1
```

It generates a fresh type variable `T` for `x`, sees that `+` requires `int * int -> int`, unifies `T` with `int`, and concludes `f : int -> int`. The mechanism is unification of type terms, with an occurs check to prevent infinite types.

When TypeScript resolves:

```typescript
type ExtractInner<T> = T extends Promise<infer U> ? U : never;
type R = ExtractInner<Promise<string>>; // R = string
```

It is performing a one-directional pattern match (not full unification) of the type `Promise<string>` against the pattern `Promise<infer U>`, binding `U = string`. This is the same structural decomposition as Prolog's compound term unification, restricted to one direction.

Prolog's unification is the general form. Type inference unification operates on type terms at compile time. Prolog's unification operates on data terms at runtime. The algorithm is identical; the domain of application differs.

The occurs check in type inference prevents types like `T = List<T>` from being inferred (though explicitly declared recursive types are fine). Prolog's occurs check prevents terms like `X = f(X)` from being constructed. Same mechanism, same purpose: preventing infinite structures that arise from self-referential solutions to equations.
