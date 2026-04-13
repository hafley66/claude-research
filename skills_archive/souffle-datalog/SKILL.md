---
name: souffle-datalog
description: Souffle high-performance Datalog -- syntax, compilation to C++, aggregation, negation, components, records, provenance. Open-source engine for program analysis and large-scale reasoning.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Souffle Datalog

Open-source high-performance Datalog engine. Compiles datalog programs to C++ (or interprets). Used in production for program analysis at scale.

github.com/souffle-lang/souffle

## Basic Syntax

```souffle
// Relation declarations
.decl edge(x: number, y: number)
.decl reach(x: number, y: number)

// I/O directives
.input edge      // read from edge.facts (CSV)
.output reach    // write to reach.csv

// Rules
reach(x, y) :- edge(x, y).
reach(x, y) :- reach(x, z), edge(z, y).
```

Key difference from academic datalog: relations must be declared with typed columns before use.

## Type System

```souffle
// Primitive subtypes
.type Node <: symbol
.type Weight <: number

// Use in declarations
.decl weighted_edge(src: Node, dst: Node, w: Weight)

// Union types
.type Term = Variable { name: symbol }
           | Constant { value: number }
           | App { func: symbol, arg: Term }

// Records (product types)
.type Pair = [first: number, second: number]
.decl pairs(p: Pair)
pairs([1, 2]).
pairs([3, 4]).

// Access record fields
.decl first_elements(n: number)
first_elements(n) :- pairs([n, _]).
```

The type system catches arity and type mismatches at compile time. Algebraic data types (ADTs) allow tree-structured data, which standard datalog forbids -- Souffle extends datalog here.

## Negation

Stratified, using `!`:

```souffle
.decl exported(name: symbol)
.decl imported(name: symbol)
.decl dead_export(name: symbol)

dead_export(name) :- exported(name), !imported(name).
```

Souffle computes the stratification automatically and rejects programs with negative cycles through an error message.

## Aggregation

```souffle
.decl edge(x: number, y: number)
.decl degree(x: number, d: number)
.decl max_degree(d: number)

// Count
degree(x, d) :- d = count : { edge(x, _) }.

// Max
max_degree(d) :- d = max x : { degree(_, x) }.

// Min
.decl min_weight(x: number, w: number)
min_weight(x, w) :- w = min y : { weighted_edge(x, _, y) }.

// Sum
.decl total_weight(w: number)
total_weight(w) :- w = sum y : { weighted_edge(_, _, y) }.

// Mean
.decl avg_degree(a: float)
avg_degree(a) :- a = mean x : { degree(_, x) }.
```

Aggregates are stratified -- the aggregated relation must be fully computed before the aggregate runs.

## Components (Modules)

Parameterized, reusable datalog fragments:

```souffle
.comp Graph<N> {
    .decl edge(x: N, y: N)
    .decl reach(x: N, y: N)
    .decl node(x: N)

    node(x) :- edge(x, _).
    node(x) :- edge(_, x).

    reach(x, y) :- edge(x, y).
    reach(x, y) :- reach(x, z), edge(z, y).
}

// Instantiate with concrete type
.init callGraph = Graph<symbol>
callGraph.edge("main", "foo").
callGraph.edge("foo", "bar").

// Query
.output callGraph.reach
```

Components support inheritance:

```souffle
.comp WeightedGraph<N, W> : Graph<N> {
    .decl weight(x: N, y: N, w: W)
    .decl shortest(x: N, y: N, w: W)

    shortest(x, y, w) :- weight(x, y, w).
    shortest(x, z, w1 + w2) :-
        shortest(x, y, w1),
        weight(y, z, w2),
        w1 + w2 < shortest(x, z, _).  // subsumption
}
```

## Subsumption

Souffle can prune dominated tuples. Useful for optimization problems:

```souffle
.decl shortest_path(x: number, y: number, cost: number) btree_delete

// Mark as subsumptive
shortest_path(x, y, c1) <= shortest_path(x, y, c2) :- c1 >= c2.

// Rules
shortest_path(x, y, w) :- edge(x, y, w).
shortest_path(x, z, w1 + w2) :-
    shortest_path(x, y, w1),
    edge(y, z, w2).
```

The `<=` rule says: if there exist two shortest_path tuples with the same (x,y) but different costs, keep only the smaller one. This gives shortest-path semantics without explicit min aggregation.

## Compilation Model

Souffle operates in two modes:

**Interpreted**: `souffle program.dl` -- parses and evaluates directly. Good for development.

**Compiled**: `souffle -o program program.dl` -- generates C++, compiles to native binary.

The compiled version:
1. Each relation becomes a B-tree (or hash table, configurable)
2. Rules become C++ loops with OpenMP parallelization
3. Semi-naive evaluation with delta tracking
4. NUMA-aware memory allocation on multi-socket machines

Performance: compiled Souffle handles billions of tuples. Orders of magnitude faster than interpreted mode or hand-written Python/Java.

## I/O System

```souffle
// CSV (default)
.input edge(IO=file, filename="edges.csv", delimiter="\t")
.output reach(IO=file, filename="reach.csv")

// SQLite
.input edge(IO=sqlite, dbname="graph.db")
.output reach(IO=sqlite, dbname="results.db")

// stdin/stdout
.input edge(IO=stdin)
.output reach(IO=stdout)
```

The SQLite I/O is bidirectional: Souffle can read EDB from SQLite tables and write IDB back.

## Provenance

Souffle can generate proof trees explaining why a tuple was derived:

```bash
souffle --provenance=explain program.dl
```

Then interactively:
```
>>> explain reach("main", "bar")
reach("main", "bar") :-
  reach("main", "foo") :-
    edge("main", "foo").  [base fact]
  edge("foo", "bar").  [base fact]
```

Critical for debugging complex rule sets. Shows the exact derivation chain.

## Inline and Magic Set Optimization

Souffle applies magic sets transformation automatically. For a query like:

```souffle
.decl query(x: symbol) inline
query("main").

.decl reachable(x: symbol)
reachable(y) :- query(x), reach(x, y).
```

Magic sets transform this from "compute all reach, then filter" to "compute only reach tuples reachable from main." Equivalent to pushing selections through joins in SQL.

## Practical Program Analysis Example

Points-to analysis for a simple language:

```souffle
// EDB: extracted from source code
.decl assign(to: symbol, from: symbol)         // x = y
.decl load(to: symbol, base: symbol)            // x = *y
.decl store(base: symbol, from: symbol)         // *x = y
.decl alloc(var: symbol, heap: symbol)          // x = new T

// IDB: derived
.decl points_to(var: symbol, heap: symbol)
.decl alias(x: symbol, y: symbol)

// Allocation: x = new T => x points to heap_T
points_to(x, h) :- alloc(x, h).

// Assignment: x = y => x points to everything y points to
points_to(x, h) :- assign(x, y), points_to(y, h).

// Load: x = *y => x points to what y's targets point to
points_to(x, h) :- load(x, y), points_to(y, h2), store(h2_var, from),
                    points_to(h2_var, h2), points_to(from, h).

// Alias: two vars alias if they point to the same heap location
alias(x, y) :- points_to(x, h), points_to(y, h), x != y.

.output points_to
.output alias
```

This is Andersen's analysis. Souffle evaluates it in seconds on codebases with millions of allocation sites.

## Limitations

- **No incrementality**: full recomputation on any input change. Adding one edge re-evaluates all rules.
- **Batch-only**: no streaming or online mode.
- **C++ compilation step**: large programs take minutes to compile to C++. Interpreted mode avoids this but is slower at runtime.
- **Memory**: all relations in memory. No disk-backed evaluation.
- **No user-defined functions**: can't call arbitrary C++ from rules (planned feature).

## Comparison to Rust Datalog Crates

| | Souffle | datafrog/crepe/ascent |
|---|---------|---------------------|
| Language | Standalone (.dl files) | Embedded in Rust |
| Compilation | datalog → C++ → binary | Rust proc-macro or library |
| Performance | Fastest (parallel, NUMA) | Fast (single-thread) |
| Provenance | Built-in | Manual |
| Components | Yes (parameterized) | No (use Rust generics) |
| Aggregation | Built-in | ascent only |
| SQLite I/O | Built-in | Manual |
| Incrementality | No | No (except differential dataflow) |
| Integration | Separate binary, IPC | In-process, zero-copy |

**Use Souffle** when: standalone analysis tool, large-scale program analysis, need provenance/debugging, don't need tight Rust integration.

**Use Rust crates** when: embedding in a Rust application, need to mix datalog with imperative code, data is already in Rust structs.
