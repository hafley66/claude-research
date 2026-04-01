---
name: prolog-booleans-control
description: Prolog boolean logic and control flow -- true/fail/false, success and failure as booleans, if-then-else, disjunction, conjunction, conditional patterns, between/3. Trigger on prolog booleans, prolog true false, prolog if else, prolog control flow, prolog conditions, prolog fail.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---


# Prolog Booleans and Control Flow

If you're coming from TypeScript or JavaScript, you're used to `true` and `false` as actual values. You can assign them, check them, store them. Prolog doesn't work that way at all. This is the biggest mental shift you'll need to make.


## There Are No Booleans

In Prolog, there are no boolean values floating around. Instead, **goals either succeed or they fail**. That's it. That's the entire control mechanism.

When you write code like this in TypeScript:
```typescript
if (x > 5) {
  console.log("x is big");
} else {
  console.log("x is small");
}
```

You're checking whether `x > 5` evaluates to the value `true`. Then you branch on that value.

In Prolog, `X > 5` is not a value. It's a **goal**. When you ask Prolog to evaluate `X > 5`, one of two things happens: the goal **succeeds** or it **fails**. There's no boolean sitting around as a result. The success or failure IS the result, and it directly affects control flow.


### The `true` and `fail` Built-ins

Prolog has two built-in predicates that embody this:

- `true` always succeeds (it's the identity goal)
- `fail` (or `false` in SWI-Prolog) always fails

Here's a trivial example to make it concrete:
```prolog
% This goal will always succeed
?- true.
% true.

% This goal will always fail
?- fail.
% false.
```

You can use these in predicates. For instance:
```prolog
% A rule that always succeeds
always_works :- true.

% A rule that always fails
never_works :- fail.

% A rule that succeeds only if X is even
is_even(X) :- 0 is X mod 2, true.

% Or more simply
is_even(X) :- 0 is X mod 2.
```

When you call `always_works`, Prolog evaluates the body `true`, which succeeds, so the whole rule succeeds. When you call `never_works`, the body fails, so the rule fails.


## Conjunction (AND) - The Comma Operator

To check multiple conditions, use the comma `,`. Both goals must succeed for the conjunction to succeed. This is Prolog's AND operator.

Here's an example showing how multiple conditions can all succeed:
```prolog
rich(alice).
rich(bob).
healthy(alice).
healthy(charlie).

happy(X) :- rich(X), healthy(X).
```

When you query `happy(X)`, Prolog searches for someone who is BOTH rich AND healthy. It has to satisfy both goals.
```
?- happy(X).
% X = alice ;
% false.
```

Only `alice` is both rich and healthy, so only `alice` is happy. `bob` is rich but not healthy. `charlie` is healthy but not rich.

The comma operator also threads variable bindings forward. When the first goal `rich(X)` succeeds with `X = alice`, that binding carries into the second goal `healthy(X)`. It's like piping data through a chain of filters.

In TypeScript terms, think of it like:
```typescript
const people = ["alice", "bob", "charlie"];
const result = people
  .filter(x => isRich(x))    // First condition
  .filter(x => isHealthy(x));  // Second condition
```

Except in Prolog, both conditions are evaluated together, with backtracking available.


## Disjunction (OR) - The Semicolon Operator

To try alternatives, use the semicolon `;`. This is Prolog's OR operator.

Here's an example showing how Prolog tries multiple routes:
```prolog
car(sedan).
car(truck).
bike(mountain).
bus(express).

transport(X) :- car(X) ; bike(X) ; bus(X).
```

When you query `transport(X)`, Prolog will find ALL vehicles. First it tries `car(X)`, which succeeds twice. Then if you ask for more solutions (with `;` in the REPL), it backtracks and tries `bike(X)`, then `bus(X)`.
```
?- transport(X).
% X = sedan ;
% X = truck ;
% X = bike ;
% X = express ;
% false.
```

The key difference from JavaScript's `||` operator: in JS, `a || b` stops at the first truthy value. In Prolog, `;` will explore ALL branches through backtracking. Every alternative can contribute solutions.

**The cleaner way to write disjunction** is using separate clauses. Most Prolog code does this:
```prolog
transport(X) :- car(X).
transport(X) :- bike(X).
transport(X) :- bus(X).
```

This is logically identical to the semicolon version, but more readable. You're saying: "X is a transport if it's a car, OR if it's a bike, OR if it's a bus."


## If-Then-Else: The Arrow Operator

When you need actual branching logic (not just "try everything"), use the if-then-else construct: `( Condition -> Then ; Else )`.

Here's a concrete example of classifying a number:
```prolog
classify(X, Sign) :-
    ( X > 0 -> Sign = positive
    ; X < 0 -> Sign = negative
    ; Sign = zero
    ).
```

This reads: "If X is greater than 0, then Sign is positive. Otherwise, if X is less than 0, then Sign is negative. Otherwise, Sign is zero."

```
?- classify(5, S).
% S = positive.

?- classify(-3, S).
% S = negative.

?- classify(0, S).
% S = zero.
```

The `->` operator (if-then) has special semantics: **once the Condition succeeds, it commits to the Then branch**. It doesn't try other alternatives of Condition through backtracking. This is different from just writing `Condition, Then` without the arrow.

In TypeScript, this is like a ternary:
```typescript
const sign = x > 0 ? "positive" : x < 0 ? "negative" : "zero";
```

You can also nest if-then-else for more complex logic, like the example above shows.


## Negation as Failure

Prolog has `\+ Goal`, which means "it's not provable that Goal is true." This is called **negation as failure** and it's subtly different from boolean NOT.

Here's the crucial gotcha:
```prolog
likes(alice, coffee).
likes(bob, tea).

dislikes(X, Y) :- \+ likes(X, Y).
```

If you query `dislikes(alice, tea)`, Prolog tries to prove `likes(alice, tea)`. That fails (no matching fact). So `\+ likes(alice, tea)` succeeds, and `dislikes(alice, tea)` succeeds.

But here's the problem with unbound variables:
```
?- dislikes(alice, X).
% false.
```

You might expect this to return everything alice doesn't like. But it doesn't. `X` is unbound, so Prolog can't enumerate what alice doesn't like (that's infinite). The negation goal fails because it's trapped trying to work with an unbound variable.

The rule: **use `\+` only when the goal is sufficiently instantiated to evaluate**. In other words, use it with concrete data or after binding your variables through earlier goals.

A working example with proper binding:
```prolog
available_drink(X) :- likes(alice, X), X \= coffee.
```

Or:
```prolog
dislikes_what(alice, X) :-
    drink(X),           % First, find a drink
    \+ likes(alice, X). % Then check alice doesn't like it
```


## between/3: The Range Generator

Prolog has a built-in predicate `between/3` that generates integers in a range. It's like Python's `range()` or JavaScript's `Array.from({length: n}, ...)`, but lazy and through backtracking.

Here's `between/3` generating values on demand:
```prolog
?- between(1, 5, X).
% X = 1 ;
% X = 2 ;
% X = 3 ;
% X = 4 ;
% X = 5 ;
% false.
```

The three arguments are: `between(+Low, +High, ?Value)`. Low and High are the bounds (inclusive). Value gets bound to each integer in the range, one at a time through backtracking.

This is incredibly useful in loops and generation. For example:
```prolog
% Generate all pairs of numbers from 1 to 3
pairs(X, Y) :- between(1, 3, X), between(1, 3, Y).

?- pairs(X, Y).
% X = 1, Y = 1 ;
% X = 1, Y = 2 ;
% X = 1, Y = 3 ;
% X = 2, Y = 1 ;
% ... and so on
```

It's lazy—it doesn't generate all the numbers upfront. It produces them one at a time as you ask for more solutions.


## Conditional Patterns in Real Code

Here are patterns you'll actually see in Prolog codebases:

**Guard clauses** using multiple clause heads. Instead of putting conditions in the body, pattern them in the head:
```prolog
% Only handle positive numbers
process(X, positive) :- X > 0.
process(X, negative) :- X < 0.
process(0, zero).
```

This is cleaner and more Prologian than one big rule with all the conditions in the body.


**once/1** forces Prolog to return only the first solution:
```prolog
?- once(between(1, 5, X)).
% X = 1.
```

Without `once`, you'd get prompted for more solutions. With it, you get exactly one.


**ignore/1** tries a goal but doesn't fail if it fails:
```prolog
cleanup(File) :- ignore(close_file(File)).
```

Even if closing the file fails, `cleanup` still succeeds.


**The soft guard pattern** checks a condition without failing the whole predicate:
```prolog
process(X, Result) :-
    ( X > 100 -> Result = large ; Result = small ).
```

This always succeeds (bound or not, Result gets a value). Compare to a hard guard:
```prolog
process(X, large) :- X > 100.
process(X, small) :- X =< 100.
```

Both work, but the first is sometimes cleaner if you want one rule with multiple outcomes.


## The RxJS Connection

If you know RxJS, the mental model here is familiar. In RxJS, a `filter()` operator either passes an item through or suppresses it. A `map()` transforms items. The stream of solutions either continues or ends.

Prolog goals work the same way. A goal either succeeds (emits a solution) or fails (suppresses). Conjunction chains goals like pipe operators. Disjunction creates alternative branches.

```typescript
// RxJS: filter values, then map them
observable
  .pipe(
    filter(x => x > 5),      // Succeed/fail per item
    map(x => x * 2)          // Transform the stream
  )

% Prolog: the same mental model
process(X, Y) :- X > 5, Y is X * 2.
```

In both cases, data flows through a chain of operations, each one potentially stopping the flow or transforming what passes through.
