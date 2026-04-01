---
name: datalog-core
description: Datalog fundamentals -- Horn clauses, bottom-up evaluation, semi-naive, stratified negation, safety, termination guarantees. The formal foundation for logic programming over finite relations.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Datalog Core

Datalog is a restricted subset of Prolog that trades Turing-completeness for guaranteed termination, decidability, and clean correspondence with relational databases. Everything here is academic/open-source foundations.

## Horn Clauses

A datalog program is a set of Horn clauses. Each clause has a **head** and a **body** separated by `:-`:

```datalog
% Fact (head, no body)
parent(tom, bob).

% Rule (head :- body)
ancestor(X, Y) :- parent(X, Y).
ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).
```

The body is a conjunction (AND) of **literals**. Each literal is an atom `p(t1, ..., tn)` where each `ti` is either a variable (capitalized) or a constant (lowercase/string/number).

No disjunction in bodies. Multiple rules with the same head predicate achieve disjunction:

```datalog
% ancestor if parent OR parent-of-ancestor (two rules = OR)
ancestor(X, Y) :- parent(X, Y).
ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).
```

## EDB vs IDB

**EDB (Extensional Database)** -- base facts. Stored explicitly. Correspond to database tables.

```datalog
% EDB: these are your tables
parent(tom, bob).
parent(bob, ann).
file("src/index.ts", "index", "ts", "src").
```

**IDB (Intensional Database)** -- derived facts. Defined by rules. Correspond to views or materialized queries.

```datalog
% IDB: these are derived from EDB
ancestor(X, Y) :- parent(X, Y).
ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).
```

The split maps directly to databases: EDB = tables, IDB = derived tables populated by INSERT ... SELECT.

## Bottom-Up Evaluation

Prolog evaluates top-down (start from query, work backward). Datalog evaluates bottom-up (start from facts, derive everything).

### Naive Evaluation

```
repeat:
  for each rule R:
    for each way to satisfy R's body using known facts:
      add R's head to the fact set
until no new facts are added
```

For ancestor/parent example:
- Iteration 1: derive ancestor(tom, bob), ancestor(bob, ann) from parent facts
- Iteration 2: derive ancestor(tom, ann) from ancestor(tom, bob) + parent(bob, ann)
- Iteration 3: no new facts. **Fixpoint reached.**

### Semi-Naive Evaluation

Naive re-derives already-known facts every iteration. Semi-naive tracks **delta** -- only facts derived in the previous iteration -- and only uses those to find new derivations.

```
delta_0 = all EDB facts
known = delta_0

repeat:
  delta_new = {}
  for each rule R:
    for each way to satisfy R's body where AT LEAST ONE literal
    uses a fact from delta_previous:
      if head is not in known:
        add head to delta_new
  known = known ∪ delta_new
  delta_previous = delta_new
until delta_new is empty
```

This is the standard evaluation strategy. It's strictly more efficient than naive -- same result, fewer redundant derivations. Maps to SQL as `INSERT ... WHERE NOT EXISTS (SELECT ... FROM known)`.

## Safety Condition

Every variable in the head must appear in a **positive** body literal.

```datalog
% SAFE: X and Y both appear in body
ancestor(X, Y) :- parent(X, Y).

% UNSAFE: Z appears in head but not in body
bad(X, Z) :- parent(X, _).

% UNSAFE: X only appears in negated literal
bad(X) :- \+ parent(X, _).
```

Why: without safety, the result set would be infinite (all possible values of Z). The safety condition ensures every variable is bound by some positive relation, so the result is always finite.

This corresponds to SQL's requirement that every selected column comes from a FROM clause.

## Stratified Negation

Pure datalog is monotonic -- adding facts can only add derived facts, never remove them. Negation (`\+`, negation-as-failure) breaks monotonicity.

Datalog allows negation only if it is **stratified**: you can partition rules into layers (strata) where negated predicates are defined in a strictly lower stratum.

```datalog
% Stratum 0: base facts
parent(tom, bob).
export(foo, bar).

% Stratum 1: derived positively
ancestor(X, Y) :- parent(X, Y).
ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).
imported(X, Y) :- import(X, Y).

% Stratum 2: negation over stratum 1
orphan(X) :- export(X, _), \+ imported(_, X).
```

**Legal**: `orphan` negates `imported`, which is fully computed in stratum 1 before stratum 2 runs.

**Illegal** (unstratifiable):
```datalog
% REJECTED: p depends negatively on itself
p(X) :- q(X), \+ p(X).
```

No valid ordering exists where p is fully computed before p is negated. The stratification algorithm detects this at compile time.

### Stratification Algorithm

1. Build a dependency graph: predicate A depends on predicate B if B appears in A's body.
2. Mark edges as positive or negative.
3. Find strongly connected components (SCCs).
4. If any SCC contains a negative edge, the program is unstratifiable. Reject.
5. Topologically sort the SCCs. Each SCC is a stratum.

## Range Restriction

All variables in a rule must be **range-restricted**: they must appear in at least one positive, non-built-in body literal.

```datalog
% Range-restricted: X and Y bound by parent
ancestor(X, Y) :- parent(X, Y).

% NOT range-restricted: N is only in a comparison
big(X) :- value(X, N), N > 100.
% This is actually fine -- N appears in value(X, N)

% NOT range-restricted: Z only in negation
bad(X) :- thing(X), \+ other(X, Z).
% Z is not bound by any positive literal
```

Range restriction prevents infinite intermediate results. It's the datalog equivalent of SQL rejecting `SELECT * FROM t1 WHERE t1.x NOT IN (SELECT z FROM t2)` when z is unbound.

## Termination Guarantee

Datalog always terminates because:

1. **Finite Herbrand base**: no function symbols means the set of all possible ground atoms is finite. With constants {a, b} and predicate p/2, there are exactly 4 possible ground atoms: p(a,a), p(a,b), p(b,a), p(b,b).

2. **Monotonic growth**: each iteration adds facts, never removes them. (Negation is evaluated per-stratum after its dependencies stabilize.)

3. **Finite ceiling**: the fact set can never exceed the size of the Herbrand base.

Therefore bottom-up evaluation reaches a fixpoint in at most |Herbrand base| iterations. No infinite loops, no stack overflows, no non-termination.

This is the fundamental tradeoff vs Prolog: Prolog can express any computation (Turing-complete) but may not terminate. Datalog always terminates but cannot express all computations.

## Aggregation

Standard datalog has no aggregation. Extended datalog systems (Souffle, LogiQL, Flix) add it with stratification requirements:

```datalog
% Souffle syntax
degree(X, D) :- D = count : { edge(X, _) }.
min_weight(X, W) :- W = min Y : { edge(X, _, Y) }.
```

Aggregates must be stratified: the aggregated predicate must be fully computed before the aggregate runs. This prevents situations like "count the facts that depend on the count."

Compilation to SQL: aggregates map to GROUP BY.

```sql
-- degree(X, D) :- D = count : { edge(X, _) }.
SELECT x, COUNT(*) AS d FROM edge GROUP BY x;
```

## Datalog vs SQL

| Feature | Datalog | SQL |
|---------|---------|-----|
| Recursion | Native (rules reference themselves) | WITH RECURSIVE (CTE, added late) |
| Syntax | Declarative rules | Declarative but procedural feel |
| Negation | Stratified \+ | NOT EXISTS, NOT IN, EXCEPT |
| Aggregation | Extension, stratified | Native GROUP BY |
| Updates | No (pure derivation) | INSERT/UPDATE/DELETE |
| Termination | Guaranteed | Not guaranteed (recursive CTEs can loop) |
| Bidirectionality | Same rule, any variable as input | Must write different queries |

Key insight: datalog and relational algebra (SQL's foundation) have the same expressive power for non-recursive queries. Datalog strictly exceeds SQL without CTEs for recursive queries. SQL with recursive CTEs matches datalog.

## Datalog vs Prolog

| | Datalog | Prolog |
|---|---------|--------|
| Function symbols | No | Yes (`f(g(X))`) |
| Evaluation | Bottom-up (all facts) | Top-down (goal-directed) |
| Termination | Guaranteed | Not guaranteed |
| Negation | Stratified only | Negation-as-failure (unsound) |
| Cut | No | Yes (`!`) |
| Assert/retract | No | Yes |
| Turing-complete | No | Yes |
| Use case | Querying, analysis, reasoning | General programming |

## Formal Semantics

Three equivalent characterizations of datalog's meaning:

**Model-theoretic**: the meaning of a program P is the **minimal Herbrand model** -- the smallest set of ground facts that satisfies all rules.

**Fixpoint**: the meaning is the **least fixpoint** of the immediate consequence operator T_P, where T_P(I) applies all rules once to fact set I. By Knaster-Tarski, this fixpoint exists and equals the minimal model.

**Proof-theoretic**: a ground atom A is in the meaning iff there exists a finite proof tree deriving A from the rules.

All three definitions produce the same set of facts. This equivalence is what makes datalog well-behaved.

## Key References

- Ceri, Gottlob, Tanca. "What You Always Wanted to Know About Datalog (And Never Dared to Ask)." IEEE TKDE 1989.
- Alice Book: Abiteboul, Hull, Vianu. "Foundations of Databases." 1995. Free online.
- Souffle: open-source, high-performance. github.com/souffle-lang/souffle
- datafrog: Rust, from Polonius. github.com/rust-lang/datafrog
