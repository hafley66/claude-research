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

## DL7 JITI arena measurements

One controlled DL7-shaped workload used 34,497 keyed reads over origins,
reservations, edges, relations, and strata. Dynamic facts plus JITI preserved
the first-match checksum and completed lookup in 35 ms and 242,371 charged
inferences. The list baseline took 246 ms and 311,365 charged inferences while
examining about 6.3 million list cells. Assoc took 42 ms and 345,862 inferences;
red-black trees took 69 ms and 1,093,827 inferences; recorded storage took
643 ms. Variant tabling changed duplicate-first behavior.

The first integrated slice replaced 18,921 `relation_level/3` list scans with
an evaluation-lifetime `arena_stratum/3` dynamic predicate. It retained source
assertion order, an explicit arena id, nested and concurrent isolation, and
unconditional cleanup. `jiti_list/1` observed a realized hash index with 256
buckets and speedup 200.0. Canonical compiler output remained byte-identical.

That slice changed cold inferences by +343 and established no wall reduction.
Removing a scan is an intermediate measurement. Require a compiler-level wall
or inference reduction before extending an indexed arena to another collection.
Choose the next collection from measured `list cells examined`, key modes, and
lifetime, rather than call count alone.

See Sprefa receipts `v7/receipts/45_swi_indexing_storage_lab.md` and
`v7/receipts/46_jiti_stratum_arena.md`.

## DL7 reservation lookup result

The next integrated slice indexed lexical reservations at the owning
`lower_datalog/5` boundary. Baseline attribution found 2,070 lookups examining
692,571 list cells. One store held two ordered views under one StoreId:

```text
visible  = local declarations before alias promotion + imported declarations
promoted = local declarations after alias promotion
lookup   = promoted first, then visible, then lexical parent
```

This retained the existing product-first and first-match behavior while storing
each input list once. The nearest-shadow fixture performed six store builds,
1,044 visible assertions, 818 promoted-view assertions, 2,070 JITI lookups, zero
list fallbacks inside the boundary, and zero residual facts.

Canonical output stayed at 810 rows with empty diagnostics. Median cold wall
changed from 329.5 ms to 293.5 ms, a 10.9 percent reduction. Charged inferences
changed from 1,909,640 to 1,927,130, a 0.92 percent increase. This is another
case where removing C-level list scans improves wall time while bookkeeping
raises the inference counter.

The reusable shape is an ordered view column rather than rebuilding the store
after a logical transformation. Install the immutable base view once, layer the
changed local view in the same scoped store, and encode precedence in clause
order. See Sprefa receipt `v7/receipts/50_jiti_reservation_arena.md`.

## DL7 shared graph lookup result

Pending-edge lookup was shared by checker name resolution, reverse parent lookup,
and lowerer callable-slot discovery. Their lists had different owning lifetimes,
so one module supplied the same physical relation and query API while each checker
or lowerer invocation opened its own immutable StoreId.

```prolog
arena_pending_edge(StoreId, Owner, Name, Target, Index, Sequence).
arena_module_node(StoreId, Owner).
```

The nearest-shadow fixture measured 7,490 relevant lookups and 3,552,989 list
cells before the change. Afterward all 7,490 lookups used JITI, with ten store
builds, 3,620 pending-edge assertions, 514 module-node assertions, 2.27 ms total
setup cost, and zero residual facts.

Realized indexes matched the modes:

- `(Owner, Name)` for forward lexical resolution;
- `Target` plus deep indexing for reverse parent selection;
- `(Owner, Index)` for callable slots;
- `Owner` for module-node membership.

Canonical output remained 810 rows with empty diagnostics. Median cold wall changed
from 285 ms to 235 ms, a 17.5 percent reduction. Charged inferences changed from
1,927,130 to 1,947,223, a 1.04 percent increase. Warm inferences remained 2,240.

Store identity alone does not determine lifetime. Reuse the module and row shape,
then open a fresh store whenever the logical edge snapshot can change. In DL7 this
means one store per `lower_datalog/5` environment and one per `check_datalog/4`
edge snapshot. See Sprefa receipt `v7/receipts/53_jiti_pending_edge_arena.md`.
