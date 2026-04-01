---
name: prolog-alt-languages
description: Logic programming beyond Prolog -- Datalog, miniKanren, Answer Set Programming (ASP/Clingo), Constraint Logic Programming, Mercury, Curry, Verse (Epic/Fortnite), modern successors and the evolving landscape. Trigger on datalog, minikanren, answer set programming, clingo, logic programming languages, verse language, curry language, constraint programming.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Logic Programming Beyond Prolog

Prolog was revolutionary in the 1980s, but it has descendants and variants that fix its problems or take its ideas in entirely new directions. This guide surveys the landscape of logic programming languages and systems in 2026, with practical code examples and honest assessments of when to use each one.

The core insight behind all of these languages: rather than writing "how to compute something," you write "what properties the answer must have." The execution engine figures out the actual computation. But different languages make different trade-offs about what you can express, how fast it runs, and how much control you have.


## Datalog: Prolog Without the Dangerous Parts

Datalog is Prolog with its teeth filed down. Specifically:

- **No function symbols** — you can't nest compound terms like `tree(tree(1), 2)`. Everything bottoms out in atoms or constants.
- **No negation** (or only stratified negation) — you can't write `\+ goal` everywhere. Negation must be "stratified" (it only appears in rules that don't depend on negation).
- **Guaranteed termination** — because of the above restrictions, every Datalog program that you write is guaranteed to halt and return an answer set. No infinite loops through unification.

This makes Datalog look less like a programming language and more like SQL's logical cousin. In fact, SQL is doing relational algebra, while Datalog is doing relational logic. Both are querying over relations (tables of facts).

### Why Datalog Matters

Datalog has experienced a renaissance over the past decade:

- **Facebook's Hack type checker** uses Datalog for type analysis.
- **Google's Zanzibar** (their universal access control system, now open as Cedar) uses Datalog-like semantics.
- **Datomic** (a Clojure database) makes Datalog queries first-class.
- **Souffle** is a high-performance C++ implementation used in program analysis at scale.
- **Differential Datalog** (by VMware) adds incremental computation — rules only recompute when their input facts change.

If Prolog is "logic programming as a Turing-complete language," Datalog is "logic programming for querying and reasoning over fixed data."

### Datalog Syntax vs Prolog

Let's define a parent-child relationship and ask about ancestors. Here's Prolog:

```prolog
% In Prolog, you can use compound terms like facts
parent(john, mary).
parent(mary, bob).

% Rules can be recursive and use negation
ancestor(X, Y) :- parent(X, Y).
ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).

% Query: ?- ancestor(john, bob).
```

Here's the same in Datalog:

```datalog
% In Datalog, facts are simple: predicate(atom, atom)
parent(john, mary).
parent(mary, bob).

% Rules are the same (no function symbols to restrict anyway)
ancestor(X, Y) :- parent(X, Y).
ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).

% Query: ancestor(john, bob)?
```

In this example they look identical. The difference appears when you try to use compound terms. In Prolog:

```prolog
% Prolog allows nesting
parent(john, address(main_st, city(nyc))).
tree(left(tree(1), tree(2))).
```

In Datalog, you can't do this. You must flatten it into multiple relations:

```datalog
% Datalog approach: create a separate relation for addresses
address_for(john, main_st_nyc_addr).
address_main_street(main_st_nyc_addr).
address_city(main_st_nyc_addr, nyc).

% Or more realistically, just use attribute columns
person(john).
person_street(john, main_st).
person_city(john, nyc).
```

This looks more like relational database normalization, and that's the point. Datalog is designed around the idea of relations and facts, not the idea of unification with arbitrary nested structures.

### When to Choose Datalog

- You're building a static analyzer or type system and need to reason over program structure.
- You're implementing access control or security policy rules that must be auditable.
- You want to query a graph or relational structure and guarantee termination.
- You want to leverage existing Datalog infrastructure like Souffle or Datomic.


## miniKanren: Logic Programming as a Library

miniKanren is not a language—it's a logic programming system embedded inside another language. It was originally embedded in Scheme, but implementations exist in Python, JavaScript, Clojure, Rust, and more.

The key insight: logic programming doesn't need its own syntax or runtime. It can be a library that you call from your existing language.

### Core Operations

miniKanren is built on just three core concepts:

**`eq` (or `==`)** — unification. `eq(x, 5)` means "unify `x` with 5."

**`fresh`** — introduce a fresh logic variable. In Scheme: `(fresh (x y) ...)` creates two new logic variables `x` and `y` that can be unified later.

**`conde`** — disjunction (logical OR). `conde((goal1, goal2), (goal3, goal4))` succeeds if either `(goal1, goal2)` or `(goal3, goal4)` succeeds.

From these three primitives, you build up relational predicates. Here's a miniKanren-inspired example in JavaScript-like pseudocode:

```javascript
// miniKanren goals always take a "substitution" (variable bindings)
// and return a stream of successful substitutions

// eq: unification goal
function eq(x, y) {
  return (subst) => {
    const unified = unify(x, y, subst);
    return unified ? [unified] : [];
  };
}

// fresh: introduce logic variables
function fresh(vars, goal) {
  // Create new variable names and apply the goal
  const newGoal = goal(...vars);
  return newGoal;
}

// conde: disjunction (OR)
function conde(...goals) {
  return (subst) => {
    let results = [];
    for (const goal of goals) {
      results = results.concat(goal(subst));
    }
    return results;
  };
}

// membero: a relation saying "X is a member of list L"
// Written in miniKanren style
function membero(elem, list) {
  return conde(
    eq(elem, list[0]),
    membero(elem, list.slice(1))
  );
}

// Example: find all pairs of (number, letter) where number is 1-3, letter is a-b
function exampleRun() {
  return fresh(
    [x, y],
    eq([x, y], QUERY), // QUERY is what we're solving for
    membero(x, [1, 2, 3]),
    membero(y, ['a', 'b'])
  );
  // Result: [[1,'a'], [1,'b'], [2,'a'], [2,'b'], [3,'a'], [3,'b']]
}
```

### Key Difference: Interleaving Search

Prolog uses depth-first search (DFS). If you ask Prolog for all solutions to a goal, it commits to the first choice point, explores the entire subtree, then backtracks.

miniKanren uses interleaving search—it explores the search tree in a breadth-first fashion. This is "fairer" because:

- It finds solutions at all depths, not just deep solutions first.
- It's better suited for infinite relations (e.g., generating all natural numbers).
- The order of solutions is less dependent on the order of your clauses.

In practical terms: if you write a buggy Prolog program, you might wait forever for a solution that would appear quickly in miniKanren.

### When to Choose miniKanren

- You want logic programming inside your existing TypeScript, Python, or Rust codebase.
- You need controlled nondeterminism without spinning up a separate Prolog interpreter.
- You're building a DSL that needs relational queries as a sublayer.
- You've read "The Reasoned Schemer" and want to apply it to your stack.


## Answer Set Programming (ASP) with Clingo

Answer Set Programming inverts the Prolog mindset. Instead of writing rules that derive new facts, you write constraints that define valid solutions. Then the solver finds all valid "answer sets."

The execution model is completely different from Prolog:

1. **Grounding** — expand all rules into ground facts (instantiate variables with all possible values).
2. **SAT Solving** — find all assignments of true/false to ground atoms that satisfy the constraints.

This is "logic programming for constraint satisfaction."

### ASP Example: Graph Coloring

Here's a classic problem: color a graph with the minimum number of colors such that no two adjacent nodes have the same color.

```asp
% Define available colors
color(red). color(green). color(blue).

% For each node, assign exactly one color
1 { assign(N, C) : color(C) } 1 :- node(N).

% Constraint: no two adjacent nodes can have the same color
:- edge(N1, N2), assign(N1, C), assign(N2, C).

% Facts
node(1). node(2). node(3).
edge(1, 2). edge(2, 3). edge(1, 3).
```

The syntax is terse but deserves explanation:

- `1 { assign(N, C) : color(C) } 1 :- node(N)` means: for each node N, choose exactly 1 color C. The "1 ... 1" is an aggregate constraint (at least 1, at most 1).
- `:- edge(N1, N2), assign(N1, C), assign(N2, C).` is a "denial" — it rules out any answer set where two adjacent nodes have the same color.

Clingo finds all valid colorings. The output might be:

```
assign(1, red) assign(2, green) assign(3, blue).
assign(1, red) assign(2, blue) assign(3, green).
...
```

### Why ASP is Powerful

ASP shines when you have complex constraints. Prolog programmers often write procedures (imperative algorithms disguised as recursive rules). ASP programmers write constraints and let the solver search.

Real-world uses:

- **Configuration management** — define constraints on valid system states.
- **Planning and scheduling** — describe goals and constraints; the solver produces a plan.
- **Combinatorial optimization** — find the best solution among many valid ones.

Clingo is the reference implementation, developed at the University of Potsdam. It's remarkably fast.

### When to Choose ASP

- You have a constraint satisfaction problem (scheduling, configuration, puzzle solving).
- You can describe the problem declaratively but not easily procedurally.
- You need all valid solutions, not just one.
- You want to avoid writing imperative search code.


## Constraint Logic Programming (CLP)

Constraint Logic Programming extends Prolog with constraint solvers over specific domains. Think of it as "Prolog + specialized solvers."

### The Main Variants

**CLP(FD)** — Finite Domain constraints (integers). Built into SWI-Prolog and XSB.

```prolog
% N-Queens: place N queens on an N×N board
% such that no two queens attack each other

queens(N, Qs) :-
    length(Qs, N),
    Qs ins 1..N,                    % All queens in columns 1..N
    all_different(Qs),              % All in different rows
    safe_queens(Qs),
    label(Qs).                      % Find a solution

safe_queens([]).
safe_queens([Q|Qs]) :-
    safe_queens(Qs),
    maplist(safe, Qs, [Q|Qs]).

safe(Q1, Q2) :-
    Q1 =\= Q2 + Offset,
    Q1 =\= Q2 - Offset.
```

This is compact because `ins`, `all_different`, and `label` handle the search space implicitly. You describe constraints; the solver handles the backtracking.

**CLP(R)** — Real-valued constraints (linear arithmetic).

**CLP(B)** — Boolean constraints (SAT solving).

**CHR** (Constraint Handling Rules) — user-defined constraint solvers written as rewrite rules.

### When to Choose CLP

- You're solving puzzles or combinatorial problems (Sudoku, N-Queens, scheduling).
- You need to reason about numeric constraints.
- You want Prolog's declarative style but with guaranteed termination for finite domains.


## Mercury: Prolog Done Right

Mercury is what Prolog could have been if designed with types and guarantees in mind. It has:

- **Static types** — declare the types of predicates.
- **Modes** — declare which arguments are inputs vs outputs.
- **Determinism checking** — prove at compile-time whether a predicate always succeeds, can fail, etc.
- **Purity** — distinguish pure logical predicates from ones with side effects.

It compiles to C and generates very efficient code.

```mercury
:- pred fib(int, int).
:- mode fib(in, out) is det.

fib(N, F) :-
    ( N < 2 -> F = N
    ; fib(N - 1, F1), fib(N - 2, F2), F = F1 + F2
    ).
```

The `det` (deterministic) assertion tells the compiler: "this predicate has exactly one solution." The compiler proves this or rejects the code.

Mercury is strict—it enforces these constraints—but the payoff is fast, safe code and early error detection.

(For a deeper dive, see the `prolog-types` skill.)

### When to Choose Mercury

- You're building production code that needs performance and safety.
- You value compile-time guarantees over rapid prototyping.
- You want logic programming with a type system as strong as Rust's.


## Curry: Functional-Logic Programming

Curry merges Haskell's functional paradigm with Prolog's logic programming. The syntax is functional (Haskell-like), but underneath it supports:

- Free variables and nondeterminism.
- Unification-driven evaluation via "narrowing."

Here's a classic example—list append—written functionally:

```haskell
-- In Curry, this is both a function and a relation
append :: [a] -> [a] -> [a]
append []     ys = ys
append (x:xs) ys = x : append xs ys

-- In Haskell, you'd call: append [1,2] [3,4] => [1,2,3,4]
-- In Curry, you can also use it backwards:
--   ?- append X [3,4] [1,2,3,4].
--   X = [1,2]
-- Or generate all splits:
--   ?- append X Y [1,2,3].
--   X = [], Y = [1,2,3]
--   X = [1], Y = [2,3]
--   X = [1,2], Y = [3]
--   X = [1,2,3], Y = []
```

The magic is "narrowing"—when you use a variable, the evaluator unifies it with possible values and explores each branch.

### Why Curry Matters

Curry proves that logic programming doesn't need Prolog's syntax or execution model. You can embed nondeterminism into a functional language. This inspired later work like Haskell's `LogicT` monad and Scala's choice operations.

### When to Choose Curry

- You're comfortable with functional programming and want nondeterminism without Prolog.
- You need a language that's both purely functional and relational.
- You want to explore functional-logic hybrids.


## Verse: The Newest Frontier (Epic Games)

Verse is the most ambitious recent entry into logic programming. Developed by Simon Peyton Jones, Tim Sweeney, and Lennart Augustsson, it's designed for game scripting in Unreal Engine and Fortnite.

Verse combines:

- **Functional syntax** — looks like ML or Haskell.
- **Choice and failure** — logic programming's nondeterminism.
- **Lenient evaluation** — lazy, permissive evaluation that delays failure.
- **Transactional rollback** — if a choice fails, undo side effects.
- **Types and effects** — track I/O, mutations, and choice points.

Here's a conceptual example (exact Verse syntax may vary):

```ml
% Generate all valid game loadouts
choose_loadout : () -> <transact> loadout =
    Weapon <- choice([Rifle, Pistol, Sniper]),
    Armor <- choice([Light, Medium, Heavy]),
    if valid_combo(Weapon, Armor)
    then (Weapon, Armor)
    else fail

% The evaluator explores all choices, rolling back if validation fails
% If a branch fails, it backtracks and tries the next choice
```

### Why Verse Signals a Shift

Verse proves that logic programming ideas are entering mainstream language design. Tim Sweeney (creator of Unreal Engine) saw value in nondeterminism and choice for game scripting. This isn't an academic exercise—it's being used in production.

The key insight: logic programming's value isn't tied to Prolog's syntax or semantics. You can bake nondeterminism into a modern, typed, functional language and make it practical.

### When to Choose Verse

- You have access to it (currently limited to Epic/game dev community).
- You're scripting a game and need to express choice and backtracking naturally.
- You want to see what contemporary logic programming looks like.


## Logic Programming Embedded in Rust

If you're learning Rust and want to experiment with logic programming without leaving the ecosystem, several libraries exist:

**`kanren` crate** — a Rust port of miniKanren.

**`logos` crate** — logic programming framework for Rust.

The challenge in Rust: miniKanren relies on representing variables and substitutions dynamically (as heap-allocated values). Rust's ownership system makes this harder. The Rust implementations typically use reference counting (`Rc<RefCell<...>>`) to manage logic variables.

```rust
// Sketch of kanren-like logic in Rust
use std::rc::Rc;

fn unify(x: &Value, y: &Value, subst: &Substitution) -> Option<Substitution> {
    // Unify two values, producing a new substitution or failure
}

fn conde(goals: Vec<Goal>) -> Goal {
    // Try each goal, collecting all successful substitutions
}
```

It works, but feels heavier than miniKanren in a dynamic language because of Rust's stricter type system.

### When to Use Rust Logic Libraries

- You're building Rust code and want relational queries as a component.
- You need logic programming without spinning up a subprocess.
- You've already chosen Rust and can't afford the GC overhead of a Scheme interpreter.


## The Landscape Today: Trends and Directions

### Datalog Renaissance

The past decade has seen Datalog's resurgence:

- Program analysis at Facebook, Google, Microsoft now routinely uses Datalog.
- Incremental Datalog (Differential Datalog, Materialize) enables real-time analytics.
- Datalog is simpler to reason about than Prolog (guaranteed termination, no function symbols) while still being powerful.

### Logic Programming as Embedded DSLs

Rather than learn a new language, the trend is to embed logic programming as a library (miniKanren style) into your existing language. This reduces the cognitive load and allows you to use logic programming selectively.

### Constraint Solving Going Mainstream

SAT solvers and SMT solvers (like Z3) have become industry-standard tools. They're not logic programming in the classic sense, but they solve similar problems (satisfiability, optimization). Clingo and CLP(FD) are accessible interfaces to this technology.

### Functional-Logic Hybrids

Curry, Verse, and extensions to Haskell (like `LogicT`) show that functional and logic programming aren't opposed. You can merge them elegantly.

### Probabilistic Logic Programming

New variants like ProbLog and DeepProbLog combine logic programming with probability and machine learning. This is where logic programming meets statistical AI.


## Decision Matrix: Which Tool to Use?

Use this table to navigate the landscape:

| Goal | Tool | Why |
|------|------|-----|
| Learn logic programming | SWI-Prolog | Best documentation, most forgiving, REPL-friendly |
| Embed logic in existing code | miniKanren | Library, not a language; works in any language |
| Query relational data | Datalog | Like SQL for logic; guaranteed to terminate |
| Constraint satisfaction (puzzles, scheduling) | Clingo (ASP) or CLP(FD) | Declarative constraints; solver handles search |
| Static analysis or program reasoning | Datalog + Souffle | Proven at scale (Facebook, Google) |
| Performance-critical logic code | Mercury | Types, modes, determinism; compiles to C |
| Functional + logic hybrid | Curry or Haskell + LogicT | Functional syntax with relational features |
| Modern, typed, practical | Verse (if available) | Contemporary design; production-ready |
| Game scripting with choice/backtracking | Verse | Built for this use case |

If you're just starting out and want to understand the concepts, begin with SWI-Prolog and "The Reasoned Schemer" (miniKanren). If you have a specific problem (constraint satisfaction, data analysis), jump to the column that matches your need.

Logic programming is not a dead field. It's evolved, specializing into subproblems it solves well: querying (Datalog), constraint solving (Clingo, CLP), embedding in other languages (miniKanren), and modern language design (Verse). Understanding the landscape lets you pick the right tool.
