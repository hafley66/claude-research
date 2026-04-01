---
name: prolog-goals
description: Prolog goals as first-class objects -- goal construction, call/N, conjunction and disjunction as terms, goal reification, forall/2, aggregate_all, engine-based goal evaluation. Trigger on prolog goals, prolog call, prolog goal, first class goals, prolog forall, prolog aggregate, prolog engines.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Prolog Goals as First-Class Objects

In Prolog, a goal is not just something you execute. It's a term—a piece of data—that you can construct, manipulate, pass around, and then decide to execute. This is homoiconicity: code and data have the same representation.

If you're coming from TypeScript/JavaScript, think of it this way. Right now, when you write:

```typescript
myFunc(arg1, arg2)
```

That gets executed immediately. You can't easily capture the "intention to call this function" as an object without wrapping it in a callback or arrow function.

In Prolog, `member(X, [1,2,3])` is simultaneously:
- A function call you can execute
- A plain term/object `member(X, [1,2,3])` you can inspect, manipulate, and pass to other predicates

This shifts what's possible. You can build queries dynamically, compose goals, and implement patterns that would require significant machinery in JS.


## Goals Are Terms

Here's the fundamental idea:

```prolog
% A goal as a term, not yet executed
?- Goal = member(X, [1,2,3]).
Goal = member(X, [1, 2, 3]).
```

The goal exists as data. Nothing has run yet. Now you can do things with it:

```prolog
% Store it, transform it, pass it to other predicates
?- Goal = member(X, [1,2,3]),
   AnotherGoal = (Goal, X > 1),
   write('I built a compound goal: '), write(AnotherGoal), nl.

% Output: I built a compound goal: (member(X,[1,2,3]),>(X,1))
```

Then, when you're ready, you execute it. This is where `call/N` comes in.


## call/N: Executing Goals Stored as Terms

`call/N` is your bridge from the data representation of a goal back to execution. It's Prolog's version of `Function.prototype.apply()` or the spread operator in JavaScript.

The simplest form: execute a goal that's stored in a variable:

```prolog
% Build a goal, then execute it with call/1
?- Goal = member(X, [1,2,3]), call(Goal).
X = 1 ;
X = 2 ;
X = 3.
```

Notice the semicolons. `call(Goal)` succeeds with X=1, and if you ask for more solutions (`;`), it backtracks and finds X=2, then X=3. The execution behavior is exactly the same as writing `member(X, [1,2,3])` directly.

### Partial Application with call/N

`call/N` also lets you add more arguments to a goal term:

```prolog
% Instead of storing (member, X, [1,2,3]) all at once,
% you can partially apply
?- Pred = member, call(Pred, X, [1,2,3]).
X = 1 ;
X = 2 ;
X = 3.
```

This is partial application. You have a predicate name stored in a variable, and you're adding arguments to it. Like calling `fn.apply(context, [...additionalArgs])` in JavaScript.

Another example with a built-in predicate:

```prolog
% succ(X, Y) means Y is the successor of X
?- Pred = succ, call(Pred, 3, Y).
Y = 4.
```

You can mix stored predicates with additional arguments:

```prolog
% Partial application mid-way
?- Goal = member(X, [a,b,c]), call(Goal).
X = a ;
X = b ;
X = c.
```


## Conjunction and Disjunction as Terms

The comma (`,`) and semicolon (`;`) in Prolog create compound goal terms. This is where Prolog's term representation really shines.

A conjunction—a compound goal with AND semantics:

```prolog
% Build a goal that is: member(X, [1,2,3]) AND X > 1
% This creates the term: ','(member(X,[1,2,3]), >(X,1))
?- Goal = (member(X, [1,2,3]), X > 1), call(Goal).
X = 2 ;
X = 3.
```

The comma creates a term with two sub-goals. `call/1` executes both: it finds all solutions to `member(X, [1,2,3])`, then filters to those where `X > 1`.

Similarly, disjunction—OR semantics—with the semicolon:

```prolog
% A goal that is: X is 1 OR X is 2
% This creates the term: ';'(=(X, 1), =(X, 2))
?- Goal = (X = 1 ; X = 2), call(Goal).
X = 1 ;
X = 2.
```

Why does this matter? Because you can build these compound goals programmatically:

```prolog
% Build up a goal from parts
build_or_goal(Val1, Val2, Goal) :-
    Goal = (X = Val1 ; X = Val2).

?- build_or_goal(10, 20, G), call(G).
X = 10 ;
X = 20.
```

In JavaScript, if you wanted to conditionally AND or OR multiple async operations based on runtime logic, you'd need to build helper functions. In Prolog, you're building the goal term itself.


## Goal Reification: Converting Success/Failure to Data

Prolog doesn't have booleans. Something either succeeds or fails. But sometimes you need to capture that success/failure as a value you can store, compare, or return.

This is called reification—making success/failure into something concrete:

```prolog
% A simple reification pattern
reify(Goal, true) :- call(Goal), !.
reify(_, false).
```

The `!` (cut) is important: it prevents backtracking. Once you've proven the goal succeeds, you don't look for more solutions.

Using it:

```prolog
?- reify(member(4, [1,2,3]), Result).
Result = false.

?- reify(member(2, [1,2,3]), Result).
Result = true.
```

You now have a boolean-like value you can use in further logic. This is useful when you want to collect results, make decisions, or return a "success flag" from a predicate without relying on Prolog's success/failure semantics.


## forall/2: Universal Quantification

`forall/2` is like `Array.every()` in JavaScript. It succeeds if a test passes for every solution of a generator goal.

The signature: `forall(Generator, Test)`

For all solutions of Generator, Test must succeed.

Example: check that every element in a list is even:

```prolog
% Succeeds: all elements are even
?- forall(member(X, [2,4,6]), (X mod 2 =:= 0)).
true.

% Fails: 3 is not even
?- forall(member(X, [2,3,6]), (X mod 2 =:= 0)).
false.
```

Another example: ensure all people have ages:

```prolog
person(alice, 30).
person(bob, 25).
person(charlie, 28).

?- forall(person(Name, _), person(Name, Age)), Age > 18).
true.
```

The key difference from `Array.every()`: forall doesn't short-circuit as an optimization. It's more about declarative intent: "for all solutions of this goal, this condition holds."

And because it's checking ALL solutions, it naturally handles backtracking:

```prolog
% Even more powerful: ensure all pairs of elements have a property
?- forall((member(X, [1,2,3]), member(Y, [1,2,3])), X + Y > 0).
true.
```


## aggregate_all/3: SQL-Like Aggregation

`aggregate_all/3` lets you compute aggregates over all solutions of a goal. It's like `.reduce()` in JavaScript, but with built-in aggregate functions.

Signature: `aggregate_all(Aggregate, Goal, Result)`

### Counting

Count how many solutions:

```prolog
% Count the elements
?- aggregate_all(count, member(_, [a,b,c]), Count).
Count = 3.
```

### Summing

Sum all values that match a pattern:

```prolog
% Sum of 1 + 2 + 3 + 4 = 10
?- aggregate_all(sum(X), member(X, [1,2,3,4]), Sum).
Sum = 10.
```

### Max and Min

Find the maximum or minimum:

```prolog
?- aggregate_all(max(X), member(X, [3,1,4,1,5,9]), Max).
Max = 9.

?- aggregate_all(min(X), member(X, [3,1,4,1,5,9]), Min).
Min = 1.
```

### Collecting into a List

Collect all solutions:

```prolog
% Gather all X values that satisfy a condition
?- aggregate_all(set(X), (member(X, [1,2,2,3,3,3])), Unique).
Unique = [1,2,3].  % set removes duplicates

% Or keep duplicates with bag
?- aggregate_all(bag(X), member(X, [1,2,2,3]), All).
All = [1,2,2,3].
```

Why is this better than findall/bagof? `aggregate_all/3` is deterministic—it gives you one answer. In contrast, `findall` can interact awkwardly with variables in the goal. `aggregate_all` is usually what you want.


## Engines: Explicit Iteration Control

SWI-Prolog's engines give you explicit, pull-based control over goal evaluation. Think of them as generators or iterators in JavaScript.

Normally, Prolog's backtracking is implicit. You ask a question, Prolog finds a solution, and when you ask for more (`;`), it backtracks automatically. With engines, you're explicitly pulling solutions one at a time.

Creating and stepping through an engine:

```prolog
% Create an engine that will generate members of [a,b,c]
?- engine_create(X, member(X, [a,b,c]), E),
   engine_next(E, X1),
   engine_next(E, X2),
   engine_destroy(E).

X = _G1234,
E = <engine>,
X1 = a,
X2 = b.
```

Each call to `engine_next(E, X)` pulls the next solution. When no more solutions exist, the engine fails.

### RxJS Connection

If you know RxJS, engines are similar to observables. Creating an engine is like creating a cold observable. Each `engine_next` is like pulling the next value from a subscription:

```typescript
// Rough RxJS analogy
const observable = new Observable(observer => {
  [a, b, c].forEach(val => observer.next(val));
});

const subscription = observable.subscribe(val => console.log(val));
```

In Prolog, you're doing the same thing, but with explicit control: you decide when to pull the next value.

### Why Use Engines?

Engines are useful when:
- You need interleaved execution of multiple goals
- You want deterministic resource cleanup (engine_destroy)
- You're coordinating backtracking with other control flow
- You're building something that looks like a generator/iterator pattern


## Building Goals Dynamically: =.. and functor/3

You can construct goals from data using the `=..` operator (called "univ") and `functor/3`.

### =.. (Univ): Decomposing and Building Terms

`Term =.. [Functor|Args]` breaks apart a term into its functor and arguments:

```prolog
% Decompose a term
?- likes(bob, pizza) =.. Parts.
Parts = [likes, bob, pizza].

% Build a term from parts
?- Term =.. [likes, bob, pizza].
Term = likes(bob, pizza).
```

This is metaprogramming. You can construct any goal from data:

```prolog
% Build a goal and call it
?- Pred = member, Args = [X, [1,2,3]], Goal =.. [Pred|Args], call(Goal).
X = 1 ;
X = 2 ;
X = 3.
```

### functor/3: Working with Structure

`functor(Term, Functor, Arity)` relates a term to its functor and arity:

```prolog
% Get the functor and arity of a term
?- functor(likes(bob, pizza), F, A).
F = likes,
A = 2.

% Build a term with a given functor and arity
?- functor(Term, likes, 2).
Term = likes(_G1234, _G5678).
```

You can use this to inspect or construct goals based on runtime information.


## Practical Patterns

### Higher-Order Predicates: Passing Goals Around

Store a goal and apply it to different data:

```prolog
apply_to_all(Goal, []).
apply_to_all(Goal, [H|T]) :-
    call(Goal, H),
    apply_to_all(Goal, T).

% Use it
?- apply_to_all(number, [1, 2, 3]).
true.

?- apply_to_all(atom, [a, b, c]).
true.
```

### Goal Transformation: Wrapping Goals

Wrap a goal with logging or timing:

```prolog
with_trace(Goal) :-
    write('Starting: '), write(Goal), nl,
    call(Goal),
    write('Success: '), write(Goal), nl.

?- with_trace(member(X, [1,2])).
Starting: member(_G1234, [1, 2])
Success: member(1, [1, 2])
X = 1 ;
```

### Building Query DSLs

Construct goals from a data structure to create mini-languages:

```prolog
% A simple "where" clause
eval_where(all, _).
eval_where(gt(N), Val) :- Val > N.
eval_where(and(C1, C2), Val) :- eval_where(C1, Val), eval_where(C2, Val).

% Use it
?- findall(X, (member(X, [1,2,3,4,5]), eval_where(and(gt(2), gt(0)), X)), Results).
Results = [3, 4, 5].
```

This is the foundation of query building, constraint satisfaction, and more advanced logic programming patterns.

---

Goals as terms are what make Prolog powerful and distinct. You're not just executing fixed code paths. You're building, transforming, and executing code structures at runtime. Once you internalize this, patterns like higher-order predicates, meta-interpreters, and constraint systems become natural.
