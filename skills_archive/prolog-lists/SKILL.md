---
name: prolog-lists
description: Prolog list processing -- [H|T] decomposition, append, member, length, maplist, include/exclude, list idioms, difference lists. Trigger on prolog lists, head tail, prolog append, prolog member, maplist, difference lists.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Prolog List Processing

## List Structure

Lists in Prolog are syntactic sugar over the `.` functor (or `[|]` in modern SWI notation). What looks like `[1,2,3]` is actually `'.'(1, '.'(2, '.'(3, [])))`. This is a cons cell / linked list, structurally identical to Lisp `(cons 1 (cons 2 (cons 3 nil)))` or Haskell `1:2:3:[]`.

```prolog
% [H|T] destructures into head (first element) and tail (rest of list)
?- [H|T] = [a, b, c].
% H = a, T = [b, c]

% Multiple heads can be extracted
?- [X, Y | Rest] = [1, 2, 3, 4].
% X = 1, Y = 2, Rest = [3, 4]

% [] is the empty list (nil atom)
?- [H|T] = [].
% false - empty list cannot be decomposed

% Single-element list: tail is []
?- [H|T] = [only].
% H = only, T = []
```

The `|` operator is the list constructor. `[H|T]` builds or destructs. On the left of `=` or `:-` it pattern-matches; on the right it constructs.

## Fundamental List Predicates

These are the building blocks. Understanding their implementations via recursion + unification is the core learning objective.

### member/2

```prolog
% Base case: X is the head of the list
member(X, [X|_]).
% Recursive case: X is somewhere in the tail
member(X, [_|T]) :- member(X, T).
```

```prolog
?- member(b, [a, b, c]).    % true
?- member(X, [a, b, c]).    % X = a ; X = b ; X = c (generates all members)
?- member(a, X).             % X = [a|_] ; X = [_,a|_] ; ... (generates lists containing a)
```

### append/3

```prolog
% Appending [] to L gives L
append([], L, L).
% Appending [H|T1] to L2: H stays in front, recursively append T1 to L2
append([H|T1], L2, [H|T3]) :- append(T1, L2, T3).
```

Trace of `append([1,2], [3], R)`:
```
append([1,2], [3], [1|T3]) :- append([2], [3], T3).
  append([2], [3], [2|T3']) :- append([], [3], T3').
    append([], [3], [3]).   % base case
  T3' = [3], so T3 = [2,3]
T3 = [2,3], so R = [1,2,3]
```

### length/2

```prolog
length([], 0).
length([_|T], N) :- length(T, N1), N is N1 + 1.
```

SWI-Prolog's built-in `length/2` works bidirectionally: `length(X, 3)` generates a list of 3 unbound variables.

### last/2

```prolog
last([X], X).
last([_|T], X) :- last(T, X).
```

### reverse/2

Naive version (O(n^2) because append is O(n) and called n times):

```prolog
reverse([], []).
reverse([H|T], R) :- reverse(T, RT), append(RT, [H], R).
```

Accumulator version (O(n) -- each step is O(1) cons):

```prolog
reverse_acc(L, R) :- reverse_acc(L, [], R).
reverse_acc([], Acc, Acc).
reverse_acc([H|T], Acc, R) :- reverse_acc(T, [H|Acc], R).
```

Trace of `reverse_acc([a,b,c], R)`:
```
reverse_acc([a,b,c], [], R)
reverse_acc([b,c], [a], R)
reverse_acc([c], [b,a], R)
reverse_acc([], [c,b,a], [c,b,a])   % Acc = R
```

The accumulator threads state forward through recursion. Each recursive call prepends the current head onto the accumulator, building the reversed list. This is the same pattern as Rust's `.fold()` or RxJS `scan()`.

## Multi-directional Use (Unification Power)

`append/3` is the canonical example of Prolog's multi-modal execution. The same predicate runs forward, backward, and generatively:

```prolog
% Forward: concatenation
?- append([1,2], [3,4], R).
% R = [1,2,3,4]

% Backward: prefix extraction
?- append(X, [3,4], [1,2,3,4]).
% X = [1,2]

% Backward: suffix extraction
?- append([1,2], Y, [1,2,3,4]).
% Y = [3,4]

% Generative: all possible splits
?- append(X, Y, [1,2,3]).
% X = [],    Y = [1,2,3]
% X = [1],   Y = [2,3]
% X = [1,2], Y = [3]
% X = [1,2,3], Y = []
```

This multi-directionality comes from unification. The two clauses of `append` constrain relationships between three arguments without specifying a direction. In TypeScript or RxJS, a function that concatenates cannot also split -- the directionality is baked into the function signature.

`member/2` is similarly multi-modal: check membership, generate members, or generate containers.

## Higher-Order List Predicates

ISO Prolog and SWI-Prolog provide higher-order predicates that take a goal (predicate) as an argument.

```prolog
% maplist/2 -- apply Goal to each element (like forEach)
?- maplist(write, [a, b, c]).
% prints: abc

% maplist/3 -- transform each element (like Array.map / rxjs map)
?- maplist([X, Y]>>(Y is X * X), [1,2,3], Squares).
% Squares = [1, 4, 9]

% include/3 -- filter elements where Goal succeeds (like Array.filter / rxjs filter)
?- include([X]>>(X > 2), [1,2,3,4,5], Big).
% Big = [3, 4, 5]

% exclude/3 -- filter elements where Goal fails (like reject)
?- exclude([X]>>(X mod 2 =:= 0), [1,2,3,4,5], Odds).
% Odds = [1, 3, 5]

% foldl/4 -- left fold (like Array.reduce / rxjs reduce/scan)
?- foldl([X, Acc, NewAcc]>>(NewAcc is Acc + X), [1,2,3,4], 0, Sum).
% Sum = 10

% msort/2 -- merge sort (duplicates preserved, unlike sort/2)
?- msort([3,1,2,1], S).
% S = [1, 1, 2, 3]

% sort/2 -- removes duplicates
?- sort([3,1,2,1], S).
% S = [1, 2, 3]
```

### RxJS/JS Mapping Table

| Prolog              | RxJS/JS equivalent          |
|---------------------|-----------------------------|
| `maplist(G, L)`     | `list.forEach(g)`           |
| `maplist(G, L, R)`  | `list.map(g)` / `map(g)`   |
| `include(G, L, R)`  | `list.filter(g)` / `filter(g)` |
| `exclude(G, L, R)`  | `list.filter(x => !g(x))`  |
| `foldl(G, L, V0, V)`| `list.reduce(g, v0)` / `reduce(g, v0)` |
| `msort(L, S)`       | `list.sort()`               |

The `>>` lambda syntax (`[X]>>(Body)`) is SWI-Prolog specific. In ISO Prolog, you define named helper predicates instead.

## Accumulators

The accumulator pattern threads an evolving state variable through recursive calls, avoiding mutation. The reverse_acc example above demonstrates this. General structure:

```prolog
% Public API: initialize accumulator
process(Input, Result) :- process(Input, InitialAcc, Result).

% Base case: accumulator becomes result
process([], Acc, Acc).

% Recursive case: update accumulator, continue
process([H|T], Acc, Result) :-
    update(H, Acc, NewAcc),
    process(T, NewAcc, Result).
```

Example -- summing a list:

```prolog
sum_list(L, Sum) :- sum_list(L, 0, Sum).
sum_list([], Acc, Acc).
sum_list([H|T], Acc, Sum) :-
    NewAcc is Acc + H,
    sum_list(T, NewAcc, Sum).
```

Example -- collecting elements that satisfy a condition:

```prolog
filter_positive(L, Result) :- filter_positive(L, [], Result).
filter_positive([], Acc, R) :- reverse(Acc, R).  % reverse because we built it backward
filter_positive([H|T], Acc, R) :-
    (H > 0
    ->  filter_positive(T, [H|Acc], R)
    ;   filter_positive(T, Acc, R)
    ).
```

Accumulators make recursion tail-recursive in most Prolog implementations (last call optimization). The naive `reverse/2` is not tail-recursive because `append` runs after the recursive `reverse` call returns.

## Difference Lists

A difference list is a list with an unbound variable "hole" at the tail, represented as a pair `List-Hole`. This allows O(1) append by unifying the hole with new content.

```prolog
% A difference list [1,2,3] is represented as [1,2,3|H]-H
% where H is an unbound variable

% Append two difference lists: unify the hole of the first with the list of the second
dl_append(X-Y, Y-Z, X-Z).
```

```prolog
% Building difference lists
?- DL1 = [1,2|H1]-H1,    % represents [1,2]
   DL2 = [3,4|H2]-H2,    % represents [3,4]
   dl_append(DL1, DL2, Result-Hole).
% Result = [1,2,3,4|H2], Hole = H2

% To "close" a difference list into a regular list, unify the hole with []
?- DL = [1,2,3|H]-H, H = [].
% DL = [1,2,3]-[]
```

Why this works: `dl_append(X-Y, Y-Z, X-Z)` says "the hole of the first list (Y) IS the beginning of the second list (also Y)." Unification physically connects them. The result's list is X (which now extends through the second list) and its hole is Z.

Regular `append/3` is O(n) because it must traverse the first list to find its end. Difference lists skip that traversal entirely. Conceptually similar to a rope data structure (join without copying) or a builder pattern (defer materialization).

Use cases: building output lists in DCGs (definite clause grammars), efficient list construction in parsers, any situation where lists are constructed left-to-right by repeated appending.

## List Comprehension Patterns

Prolog lacks syntactic list comprehensions. `findall/3` serves the equivalent purpose:

```prolog
% findall(Template, Goal, ResultList)

% Squares of 1..5
?- findall(X*X, between(1, 5, X), Squares).
% Squares = [1, 4, 9, 16, 25]
% (Note: X*X is evaluated as arithmetic if you write S is X*X in a helper)

% Correct arithmetic version:
?- findall(S, (between(1, 5, X), S is X*X), Squares).
% Squares = [1, 4, 9, 16, 25]

% Filter + map: even squares
?- findall(S, (between(1, 10, X), X mod 2 =:= 0, S is X*X), EvenSquares).
% EvenSquares = [4, 16, 36, 64, 100]

% Cartesian product
?- findall(X-Y, (member(X, [a,b]), member(Y, [1,2])), Pairs).
% Pairs = [a-1, a-2, b-1, b-2]
```

`findall/3` collects all solutions. `bagof/3` and `setof/3` are variants that respect variable scoping and (for `setof`) sort + deduplicate results.

Equivalent RxJS: `range(1,5).pipe(map(x => x*x), toArray())` for the basic case. For filtered versions, add `filter()` before `map()`.

## Common Patterns and Idioms

### select/3 -- Pick an element, get the rest

```prolog
select(X, [X|T], T).
select(X, [H|T], [H|R]) :- select(X, T, R).
```

```prolog
?- select(b, [a,b,c], Rest).
% Rest = [a, c]

?- select(X, [a,b,c], Rest).
% X = a, Rest = [b,c] ; X = b, Rest = [a,c] ; X = c, Rest = [a,b]
```

Useful for modeling "pick one from a bag" -- combinatorics, constraint problems, puzzle solving.

### permutation/2

```prolog
permutation([], []).
permutation(List, [H|Perm]) :-
    select(H, List, Rest),
    permutation(Rest, Perm).
```

```prolog
?- permutation([1,2,3], P).
% P = [1,2,3] ; P = [1,3,2] ; P = [2,1,3] ; P = [2,3,1] ; P = [3,1,2] ; P = [3,2,1]
```

### Nth element access

```prolog
% 0-indexed
?- nth0(1, [a,b,c], X).   % X = b

% 1-indexed
?- nth1(2, [a,b,c], X).   % X = b

% Both work multi-directionally
?- nth0(N, [a,b,c], b).   % N = 1
```

### flatten/2

```prolog
?- flatten([1, [2, [3]], 4], F).
% F = [1, 2, 3, 4]
```

Note: `flatten/2` is considered an anti-pattern in well-structured Prolog code. If you need it, the data structure probably needs rethinking. Prefer explicit recursive processing of known nesting levels.

### Pairs and association lists

```prolog
% pairs_keys_values/3 -- zip/unzip key-value pairs
?- pairs_keys_values(Pairs, [a,b,c], [1,2,3]).
% Pairs = [a-1, b-2, c-3]

?- pairs_keys_values([a-1, b-2, c-3], Keys, Values).
% Keys = [a, b, c], Values = [1, 2, 3]

% pairs_keys/2, pairs_values/2 -- project one side
?- pairs_keys([a-1, b-2], K).
% K = [a, b]

% msort + group_pairs_by_key for groupBy behavior
?- pairs = [a-1, b-2, a-3],
   msort(pairs, Sorted),
   group_pairs_by_key(Sorted, Grouped).
% Grouped = [a-[1,3], b-[2]]
```

### subtract, intersection, union (list-as-set operations)

```prolog
?- subtract([1,2,3,4], [2,4], R).     % R = [1,3]
?- intersection([1,2,3], [2,3,4], R). % R = [2,3]
?- union([1,2,3], [2,3,4], R).        % R = [1,2,3,4]
```

These treat lists as sets (using `==/2` for comparison). For proper set semantics, use `sort/2` first or work with `library(ordsets)`.

### numlist/3 and between/3

```prolog
?- numlist(1, 5, L).       % L = [1, 2, 3, 4, 5]
?- between(1, 5, X).       % X = 1 ; X = 2 ; ... ; X = 5 (generates on backtracking)
```

`numlist` builds the full list; `between` generates lazily on backtracking. Use `between` with `findall` for comprehension patterns.
