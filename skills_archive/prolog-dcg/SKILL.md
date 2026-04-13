---
name: prolog-dcg
description: Prolog definite clause grammars -- -->/2 notation, terminal/nonterminal rules, pushback, phrase/2, parsing and generation, DCG as list processing abstraction. Trigger on prolog dcg, definite clause grammar, prolog parsing, prolog grammar, phrase.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Definite Clause Grammars (DCGs)

## What DCGs Are

DCGs are a notation built into ISO Prolog for defining grammars and, more generally, any computation that threads a list through a sequence of transformations. The `-->/2` operator is syntactic sugar: the Prolog compiler transforms DCG rules into ordinary clauses by adding two hidden arguments representing the input list before and after consumption. These hidden arguments form a difference list pair.

A DCG rule does not "return" a parse tree by default. It succeeds or fails based on whether the input conforms to the grammar. Building structure requires explicit extra arguments (covered below).

DCGs sit in the same design space as parser combinators (Haskell's Parsec, Rust's nom), but with two advantages inherited from Prolog: automatic backtracking and bidirectionality (the same grammar can parse and generate).

## The Transformation

What `-->/2` compiles to:

```prolog
% Source DCG rules:
greeting --> [hello], name.
name --> [world].
name --> [prolog].

% After term_expansion, equivalent to:
greeting(S0, S) :-
    S0 = [hello|S1],
    name(S1, S).
name([world|S], S).
name([prolog|S], S).
```

The two hidden arguments are conventionally called `S0` (input list) and `S` (remainder after consuming). Each terminal `[token]` unifies the head of `S0` with `token` and passes the tail forward. Each nonterminal call passes its remainder as input to the next goal. The final remainder of the last goal in the body becomes the remainder of the entire rule.

This is a difference list encoding. The "consumed" portion is the difference between `S0` and `S`. When `S` is `[]`, the entire input was consumed.

## Terminals and Nonterminals

| Construct | DCG syntax | Meaning |
|---|---|---|
| Terminal | `[token]` | Match literal `token` at head of input |
| Multi-terminal | `[a, b, c]` | Match sequence `a`, `b`, `c` |
| Nonterminal | `rule_name` | Invoke another DCG rule |
| Sequence | `a, b` | `a` followed by `b` (difference list threading) |
| Alternatives | `a ; b` | Try `a`, on failure try `b` |
| Alternatives (clausal) | Separate clauses for same functor | Prolog-native alternation via backtracking |
| Epsilon | `[]` as body | Consume nothing, always succeeds |
| Prolog goal | `{ Goal }` | Execute `Goal` without consuming input |

Epsilon production example:

```prolog
% Optional greeting
maybe_greeting --> greeting.
maybe_greeting --> [].
```

## phrase/2 and phrase/3

`phrase/2` and `phrase/3` are the standard interface for invoking DCG rules. Direct calls with explicit list arguments work but `phrase` is idiomatic and enables meta-programming over grammars.

```prolog
% phrase(+RuleName, +InputList)
?- phrase(greeting, [hello, world]).
true.

?- phrase(greeting, [hello, prolog]).
true.

?- phrase(greeting, [goodbye, world]).
false.

% Generation via unbound variables:
?- phrase(greeting, [hello, X]).
X = world ;
X = prolog.

% phrase/3: partial consumption
% phrase(+RuleName, +Input, -Remaining)
?- phrase(name, [world, is, flat], Rest).
Rest = [is, flat].
```

`phrase/3` is essential for embedding DCG parsers in larger processing pipelines where you need the unconsumed tail.

## Building Values During Parsing

DCG rules accept extra arguments beyond the two hidden ones. These carry constructed values upward through the parse:

```prolog
expr(X) --> term(X).
expr(X+Y) --> term(X), [+], expr(Y).

term(X) --> factor(X).
term(X*Y) --> factor(X), [*], term(Y).

factor(X) --> [X], { number(X) }.
factor(X) --> ['('], expr(X), [')'].
```

```prolog
?- phrase(expr(Tree), [3, *, '(', 2, +, 1, ')']).
Tree = 3*(2+1).
```

The `{ number(X) }` goal runs ordinary Prolog inside the DCG rule without consuming any input. The braces are mandatory; without them, `number(X)` would be treated as a nonterminal call.

The compiled form of a rule like `factor(X) --> [X], { number(X) }.` is:

```prolog
factor(X, S0, S) :-
    S0 = [X|S],
    number(X).
```

The extra argument `X` becomes the first argument. The two hidden list arguments remain last.

## Pushback Notation

Pushback allows a rule to place tokens back onto the input stream. The syntax uses a comma-separated list after the `-->`:

```prolog
% ISO standard pushback notation:
rule, [Token] --> body.

% Compiles to:
rule(S0, [Token|S]) :- body(S0, S).
```

The tokens on the left of `-->` after the rule head are unified with the front of the output remainder. This is useful for lookahead grammars where recognizing a construct requires consuming a token that belongs to the next construct.

```prolog
% Peek at next token without consuming
peek(X), [X] --> [X].

% Usage: decide based on lookahead
items([]) --> [].
items([I|Is]) --> peek(X), { X \= end }, item(I), items(Is).
items([]) --> [end].
```

Pushback is rarely needed in practice. Most grammars restructure to avoid it.

## DCGs Beyond Parsing: Bidirectional Grammars

Because Prolog unification works in both directions, a DCG grammar is simultaneously a recognizer, a parser, and a generator:

```prolog
sentence --> noun_phrase, verb_phrase.
noun_phrase --> det, noun.
verb_phrase --> verb, noun_phrase.
det --> [the].
det --> [a].
noun --> [cat].
noun --> [dog].
verb --> [chases].
verb --> [sees].
```

```prolog
% Recognition (ground input):
?- phrase(sentence, [the, cat, chases, a, dog]).
true.

% Generation (unbound input):
?- phrase(sentence, X).
X = [the, cat, chases, the, cat] ;
X = [the, cat, chases, the, dog] ;
X = [the, cat, chases, a, cat] ;
% ... enumerates all grammatical sentences

% Partial specification:
?- phrase(sentence, [the, cat, Verb, a, dog]).
Verb = chases ;
Verb = sees.
```

This bidirectionality falls directly out of Prolog's execution model. No additional code is required. In contrast, parser combinator libraries in other languages are inherently unidirectional and require separate generator implementations.

## DCGs as General List Processing

DCGs are not limited to parsing character or token streams. Any computation that threads a list benefits from the hidden-argument sugar:

```prolog
% Flatten nested lists
flatten_dcg([]) --> [].
flatten_dcg([X|Xs]) --> { is_list(X) }, flatten_dcg(X), flatten_dcg(Xs).
flatten_dcg([X|Xs]) --> { \+ is_list(X) }, [X], flatten_dcg(Xs).

?- phrase(flatten_dcg([1,[2,[3]],4]), Flat).
Flat = [1, 2, 3, 4].
```

```prolog
% State threading: count occurrences
count(_, []) --> [].
count(X, [X|Rest]) --> [X], count(X, Rest).
count(X, [Y|Rest]) --> [Y], { X \= Y }, count(X, Rest).
```

The key insight: DCGs abstract over "process a list element, then process the rest" patterns. Anywhere difference list threading appears in normal Prolog, DCGs can clean it up.

## Connection to Parser Combinators

| Parser combinator concept | DCG equivalent |
|---|---|
| Parser type `String -> (Result, String)` | DCG rule with hidden `(S0, S)` arguments |
| `andThen` / `>>` / `>>=` | `,` (sequence) |
| `choice` / `<\|>` | `;` or separate clauses |
| `pure` / `return` | `{ Goal }` or `[]` (epsilon) |
| `many` / `some` | Recursive DCG rules |
| `satisfy` / `token` | `[X], { condition(X) }` |
| `label` / `<?>` | No direct equivalent (use cuts or error terms) |
| `try` / backtracking | Free by default -- Prolog backtracks automatically |
| `notFollowedBy` | `\+ phrase(rule, Input, _)` or pushback |

The fundamental difference: parser combinator libraries must choose between backtracking parsers (exponential worst case) and committed-choice parsers (linear but less expressive). DCGs backtrack by default. For committed choice, insert cuts:

```prolog
% Committed choice with cut:
command --> [quit], !, { halt }.
command --> [load], [File], { load_file(File) }.
```

## Practical Example: JSON-like Value Parser

```prolog
:- use_module(library(dcg/basics)).  % SWI-Prolog

json_value(null)  --> [null].
json_value(true)  --> [true].
json_value(false) --> [false].
json_value(N)     --> [N], { number(N) }.
json_value(S)     --> [S], { string(S) }.
json_value(List)  --> ['['], json_values(List), [']'].
json_value(Dict)  --> ['{'], json_pairs(Dict), ['}'].

json_values([])     --> [].
json_values([V|Vs]) --> json_value(V), json_values_rest(Vs).

json_values_rest([])     --> [].
json_values_rest([V|Vs]) --> [','], json_value(V), json_values_rest(Vs).

json_pairs([])       --> [].
json_pairs([K-V|Ps]) --> json_pair(K-V), json_pairs_rest(Ps).

json_pairs_rest([])       --> [].
json_pairs_rest([K-V|Ps]) --> [','], json_pair(K-V), json_pairs_rest(Ps).

json_pair(K-V) --> [K], { atom(K) }, [':'], json_value(V).
```

```prolog
?- phrase(json_value(Tree),
    ['{', name, ':', john, ',', age, ':', 30,
     ',', hobbies, ':', '[', chess, ',', code, ']', '}']).
Tree = [name-john, age-30, hobbies-[chess, code]].
```

This operates on a pre-tokenized list. For character-level parsing, SWI-Prolog's `library(dcg/basics)` provides `digits//1`, `blanks//0`, `string_without//2`, etc.

## State Passing with DCGs

DCGs can thread arbitrary state, not just the input list. Wrap state in a term and use semicontext notation or pass state as extra arguments:

```prolog
% Track line numbers during parsing
line(N) --> [newline], { N1 is N + 1 }, lines(N1).
line(N) --> [_], line(N).
line(N) --> [], { write(N), write(' lines'), nl }.
```

For more complex state, SWI-Prolog's `library(dcg/basics)` and `library(dcg/high_order)` provide utility predicates. Common patterns:

```prolog
% Collect results with findall-style accumulation
all_numbers(Nums) -->
    all_numbers_([], Nums).

all_numbers_(Acc, Nums) -->
    [X], { number(X) }, all_numbers_([X|Acc], Nums).
all_numbers_(Acc, Nums) -->
    [X], { \+ number(X) }, all_numbers_(Acc, Nums).
all_numbers_(Acc, Nums) -->
    [], { reverse(Acc, Nums) }.
```

## library(dcg/basics) -- SWI-Prolog

SWI-Prolog bundles commonly needed DCG building blocks:

| Predicate | Purpose |
|---|---|
| `digit//1` | Single digit character |
| `digits//1` | Sequence of digit characters |
| `integer//1` | Parse/generate integer |
| `float//1` | Parse/generate float |
| `number//1` | Integer or float |
| `blanks//0` | Zero or more whitespace |
| `blank//0` | Single whitespace |
| `nonblanks//1` | Non-whitespace sequence |
| `string//1` | Any sequence (greedy) |
| `string_without//2` | Sequence not containing given chars |
| `eos//0` | End of string (input exhausted) |
| `remainder//1` | Unify with remaining input |

These operate on character code lists (or char lists depending on the `double_quotes` flag).

## Common Pitfalls

**Left recursion**: Like all top-down parsers, DCGs loop on left-recursive rules.

```prolog
% INFINITE LOOP:
expr(X+Y) --> expr(X), [+], term(Y).

% Fix: left-factor or use bottom-up accumulation
expr(E) --> term(T), expr_rest(T, E).
expr_rest(T, E) --> [+], term(T2), { T3 = T+T2 }, expr_rest(T3, E).
expr_rest(E, E) --> [].
```

**Forgetting braces around Prolog goals**: `number(X)` without `{}` is treated as a nonterminal call to a DCG rule `number//1`, not the built-in `number/1`.

**Assuming token-level input**: DCGs operate on lists. If the input is a string/atom, it must be tokenized first (or use char-level DCGs with `atom_chars/2`).

**Cut interaction**: Cuts inside DCG rules affect Prolog's choice points normally. A cut in a DCG rule commits to that clause, preventing backtracking to alternative parses. Use with care in grammars intended for generation.
