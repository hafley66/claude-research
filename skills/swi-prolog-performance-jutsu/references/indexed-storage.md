# SWI-Prolog indexed relational storage

Use this reference when immutable or compile-lifetime rows are stored in lists
and queried repeatedly by bound keys.

## Start with the relation and its modes

Write the logical row and every required call mode before choosing storage:

```prolog
origin_edge(CompileId, Owner, Name, Index, NodeId).

% Required lookup
origin_edge(+CompileId, +Owner, +Name, +Index, -NodeId) is semidet.
```

Count rows, lookups, duplicate keys, required answer order, construction count,
and lifetime. A per-pass index can cost more than the scans it replaces. Prefer
one build at the invariant owner boundary, reused for the whole phase or compile.

## SWI JITI comes before a hand-built hash index

SWI provides just-in-time clause indexes for static and dynamic predicates.
It can choose indexes over multiple instantiated arguments and recursively
index inside compound arguments. Dynamic indexes are reassessed after the
clause count doubles or falls below one quarter of the indexed size.

Official documentation:

- [Just-in-time clause indexing](https://www.swi-prolog.org/pldoc/man?section=jitindex)
- [`library(prolog_jiti)`](https://www.swi-prolog.org/pldoc/man?section=prologjiti)

For stable row shapes, flatten keys into predicate arguments so the intended
bound columns are visible:

```prolog
:- dynamic arena_origin_edge/6.

arena_origin_edge(ArenaId, Owner, Name, Index, NodeId, Sequence).
```

Prefix every row with an arena or compile identity. Assert rows once in authored
order, retain clause references, and erase exactly those references during
unconditional cleanup. Warm representative bound calls, then inspect the
created index with `jiti_list/1` or `predicate_property/2` where available.

JITI selects candidate clauses. Preserve exact unification in the predicate
head or after lookup. Preserve first-match behavior explicitly when duplicate
keys are legal; indexing does not authorize changing bag, set, or order
semantics.

## Compare mechanisms with the full lifecycle

Benchmark the same dataset and lookup sequence for:

| Mechanism | Include in measurement |
| --- | --- |
| list + `memberchk/2` | C-level elements examined, lookup wall time |
| dynamic facts + JITI | assertion, warmup, index shape, lookup, erase, clause GC |
| `library(assoc)` | pair preparation, tree build, lookup, rebuild count |
| `library(rbtrees)` | tree build, lookup, enumeration order |
| tries | insert, exact lookup, enumeration, destruction, term representation |
| variant tabling | call variants, answers, table space, abolish lifecycle |
| mode-directed tabling | input modes and answer aggregation contract |

Official references:

- [`library(assoc)`](https://www.swi-prolog.org/pldoc/doc_for?object=library(assoc))
- [Tries](https://www.swi-prolog.org/pldoc/man?section=trie)
- [Mode-directed tabling](https://www.swi-prolog.org/pldoc/man?section=tabling-mode-directed)
- [Dynamic predicates and transactions](https://www.swi-prolog.org/pldoc/man?section=dynpreds)

Mode-directed tabling aggregates output answers for a tabled input pattern. It
does not replace an ordinary immutable keyed relation unless answer subsumption
is part of the required semantics.

## Measurements must name different work counters

Report independently:

```text
row count
lookup count and modes
index construction count
charged Prolog inferences
C-level list elements scanned
wall time
memory or table space
cleanup residue
exact result checksum
```

`memberchk/2` performs its traversal in C, so millions of examined list cells
may contribute little to `statistics(inferences, ...)`. An assoc implemented in
Prolog may reduce wall work while increasing charged inferences. Require both
metrics and canonical output parity.

## DL7 measured counterexample

On the nearest-shadow compiler fixture, 94,438 `memberchk/2` calls examined an
estimated 13,545,263 list elements. Checker origin lookups accounted for
5,336 calls and 5,585,212 examined entries. Building an AVL assoc inside each
checker call preserved output but changed cold inferences from 1,899,633 to
1,929,769, a regression of 30,136.

The failed lifetime was:

```text
checker call -> build assoc -> query -> discard
```

The next storage experiment must use:

```text
compile scope -> build relation store once -> all checker/comptime users -> cleanup
```

See Sprefa receipts `v7/receipts/42_prolog_arena_inventory.md` and
`v7/receipts/43_origin_index.md` for the measured attribution.
