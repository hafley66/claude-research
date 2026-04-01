---
name: rust-datalog
description: Datalog in Rust -- datafrog (Polonius), crepe (proc-macro), ascent (lattices). In-memory bottom-up evaluation, integration with SQLite, comparison and selection guide.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Datalog in Rust

Three crates implement datalog evaluation in Rust. All are open source, all evaluate bottom-up in memory.

## datafrog

From the Rust compiler's Polonius borrow checker. Minimal, fast, procedural API.

github.com/rust-lang/datafrog

### Core Concepts

- `Relation<Tuple>` -- immutable set of tuples (EDB). Sorted Vec internally.
- `Variable<Tuple>` -- mutable accumulator (IDB). Grows during iteration.
- `Iteration` -- drives the fixpoint loop. Call `.changed()` to test convergence.

### Transitive Closure

```rust
use datafrog::{Iteration, Relation};

fn transitive_closure(edges: &[(u32, u32)]) -> Vec<(u32, u32)> {
    let mut iteration = Iteration::new();

    let edge = Relation::from_iter(edges.iter().cloned());
    let reach: Variable<(u32, u32)> = iteration.variable("reach");

    // Base case: reach includes all edges
    reach.insert(edge.clone());

    // Fixpoint loop
    while iteration.changed() {
        // reach(x, z) :- reach(x, y), edge(y, z).
        reach.from_join(&reach, &edge, |&_y, &x, &z| (x, z));
    }

    reach.complete()
}
```

`from_join(&left, &right, closure)` does a merge-join on the first element of each tuple. The closure receives `(key, left_value, right_value)` and returns the new tuple.

### Anti-Join (Negation)

```rust
// orphan(x) :- export(x), !imported(x).
let orphan: Variable<(u32,)> = iteration.variable("orphan");

while iteration.changed() {
    orphan.from_antijoin(&export, &imported, |&x| (x,));
}
```

`from_antijoin` produces tuples from the left that have no matching key in the right.

### Leapfrog Triejoin

datafrog uses leapfrog triejoin for multi-way joins. Instead of pairwise hash joins, it intersects sorted iterators simultaneously. This is asymptotically optimal for cyclic joins.

The `from_leapjoin` method:

```rust
// three-way join: r(x,y), s(y,z), t(z,x)
reach.from_leapjoin(
    &var1,
    (
        edge.extend_with(|&(x, _y)| x),
        edge.extend_anti(|&(_x, y)| y),  // anti-join variant
    ),
    |&(x, y), &z| (x, z),
);
```

### When to Use

- Raw performance is critical (borrow checking, points-to analysis)
- Comfortable writing procedural join code
- Don't need syntactic sugar
- ~500 lines, zero deps

## crepe

Proc-macro that compiles datalog syntax to Rust at compile time.

github.com/ekzhang/crepe

### Syntax

```rust
use crepe::crepe;

crepe! {
    @input
    struct Edge(u32, u32);

    @output
    struct Reach(u32, u32);

    Reach(x, y) <- Edge(x, y);
    Reach(x, z) <- Reach(x, y), Edge(y, z);
}

fn main() {
    let mut runtime = Crepe::new();
    runtime.extend([Edge(1, 2), Edge(2, 3), Edge(3, 4)]);

    let (reach,) = runtime.run();
    // reach: HashSet<Reach> = {(1,2), (1,3), (1,4), (2,3), (2,4), (3,4)}
}
```

### Relations

`@input` -- EDB, provided by caller.
`@output` -- IDB, returned after evaluation.
No annotation -- intermediate IDB, not returned.

### Negation

```rust
crepe! {
    @input
    struct Export(u32, String);

    @input
    struct Import(u32, String);

    @output
    struct DeadExport(u32, String);

    // Stratified negation with !
    DeadExport(id, name) <- Export(id, name), !Import(_, name);
}
```

crepe handles stratification automatically. Compile error if unstratifiable.

### Aggregation

Not directly supported. Compute aggregates in Rust after `.run()`.

### How It Compiles

The `crepe!` macro expands to:
1. Struct definitions for each relation
2. A `Crepe` struct holding HashSets for each relation
3. A `.run()` method that implements semi-naive evaluation as nested loops
4. Stratification computed at macro expansion time

### When to Use

- Want datalog syntax without runtime overhead
- Relations fit in memory
- Don't need aggregation or lattices
- Fast compilation, zero runtime cost

## ascent

Most feature-rich. Supports lattices and aggregation.

github.com/s-arash/ascent

### Basic Syntax

```rust
use ascent::ascent;

ascent! {
    relation edge(u32, u32);
    relation reach(u32, u32);

    reach(x, y) <-- edge(x, y);
    reach(x, z) <-- reach(x, y), edge(y, z);
}

fn main() {
    let mut prog = AscentProgram::default();
    prog.edge = vec![(1, 2), (2, 3), (3, 4)];
    prog.run();
    // prog.reach contains transitive closure
}
```

### Lattice Support

ascent can compute over lattice values, not just sets. This enables shortest-path, interval analysis, etc.

```rust
use ascent::ascent;
use ascent::lattice::set::Set;

ascent! {
    lattice shortest_path(u32, u32, Dual<u64>);  // Dual reverses ordering for min
    relation edge(u32, u32, u64);

    shortest_path(x, y, Dual(w)) <-- edge(x, y, w);
    shortest_path(x, z, Dual(w1 + w2)) <--
        shortest_path(x, y, Dual(w1)),
        edge(y, z, w2);
}
```

The lattice join automatically keeps only the minimum (via Dual). No need for explicit min aggregation.

### Aggregation

```rust
ascent! {
    relation edge(u32, u32);
    relation degree(u32, usize);

    degree(x, count) <--
        agg count = count() in edge(x, _);
}
```

### Negation

```rust
ascent! {
    relation export(u32, String);
    relation import(u32, String);
    relation dead(u32, String);

    dead(id, name) <-- export(id, name), !import(_, name);
}
```

### When to Use

- Need aggregation or lattice semantics
- Willing to accept slower compilation (proc-macro is heavier)
- More complex analyses (interval analysis, pointer analysis with field sensitivity)

## Comparison

| | datafrog | crepe | ascent |
|---|---------|-------|--------|
| API style | Procedural | Datalog macro | Datalog macro |
| Negation | Anti-join | Stratified `!` | Stratified `!` |
| Aggregation | Manual | Manual | Built-in `agg` |
| Lattices | No | No | Yes |
| Performance | Fastest (leapfrog) | Fast (hash joins) | Moderate |
| Compilation | Instant | Fast | Slow (heavy macro) |
| Dependencies | 0 | 0 | Several |
| Maintenance | Rust project | Active | Active |
| Lines of code | ~500 | ~1500 | ~5000 |

## Integration with SQLite

All three are in-memory batch evaluators. For persistent storage:

### Loading Facts from SQLite

```rust
// Load EDB from SQLite
let edges: Vec<(u32, u32)> = sqlx::query_as("SELECT src, dst FROM edges")
    .fetch_all(&pool).await?;

let mut runtime = Crepe::new();
runtime.extend(edges.into_iter().map(|(s, d)| Edge(s, d)));
let (reach,) = runtime.run();
```

### Writing Back to SQLite

```rust
// Materialize IDB back to SQLite
for Reach(x, y) in &reach {
    sqlx::query("INSERT OR IGNORE INTO reach(x, y) VALUES (?, ?)")
        .bind(x).bind(y)
        .execute(&pool).await?;
}
```

### Hybrid: SQL for Storage, Rust for Complex Derivation

Pattern: use SQL for simple rules (they compile to efficient queries), use Rust datalog for rules that require multi-way joins or complex fixpoint computation that would be slow as repeated SQL.

```rust
// Simple rule: compile to SQL, run in SQLite
sqlx::query("INSERT OR IGNORE INTO reach SELECT src, dst FROM edge")
    .execute(&pool).await?;

// Complex rule: load into datafrog, compute, write back
let complex_edges = load_from_db(&pool).await?;
let derived = datafrog_compute(&complex_edges);
write_to_db(&pool, &derived).await?;
```

### When to Use In-Memory vs Compile-to-SQL

**In-memory (datafrog/crepe/ascent)**:
- Multi-way joins (3+ relations)
- Complex fixpoint with many iterations
- Data fits in RAM
- Need lattice operations

**Compile-to-SQL**:
- Data is already in SQLite
- Simple 2-way joins
- Want persistence and incrementality (INSERT OR IGNORE)
- Don't want to load/unload data

## Differential Dataflow

Frank McSherry's work (open source, github.com/TimelyDataflow/differential-dataflow). Not a crate you embed -- it's a framework.

Key difference from the three crates above: **incremental**. When input facts change, it recomputes only the affected derived facts. The three crates above recompute everything from scratch.

For sprefa's use case (scan produces new facts, need to update derived links), differential dataflow's incrementality is appealing but the operational complexity is high. The INSERT OR IGNORE + fixpoint loop pattern is simpler and sufficient for the current scale.
