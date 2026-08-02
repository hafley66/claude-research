# Memory and construction cost: Csr, Vec<Vec<u32>>, and the reverse-edge tax

Back to [index.md](index.md).

This file is the deep version of H3, H4, and H6. All numbers are peak RSS
from `/usr/bin/time -l` on macOS (the "peak memory footprint" line), cross
checked against each binary's own `getrusage(RUSAGE_SELF, ...)` read; the two
agreed within a few percent on every run reported here. Every build in this
lab was capped at 10,000,000 edges, following a fixed ceiling set after an
earlier, unrelated run at 100,000,000 edges swapped the machine.

## H3: Csr against Vec<Vec<u32>>

Both representations were built from the same random, 1:1 node-to-edge-ratio
synthetic edge lists (matching sprefa's own near-1:1 ratio of 283,127 nodes
to 261,704 edges), at 1M and 10M edges.

| edges | representation | peak RSS | bytes/edge | build time |
|---|---|---|---|---|
| 1,000,000 | `Vec<Vec<u32>>` | 43,599,040 B | 43.6 | 35ms |
| 1,000,000 | `Csr` | 21,382,208 B | 21.4 | 6ms build + 18ms sort/dedup |
| 10,000,000 | `Vec<Vec<u32>>` | 424,776,192 B | 42.5 | 449ms |
| 10,000,000 | `Csr` | 173,688,128 B | 17.4 | 68ms build + 205ms sort/dedup |

`Csr` uses roughly 2.4 times less memory than `Vec<Vec<u32>>` at both scales
measured, and its own build step (after the input is sorted) is an order of
magnitude faster. The `Vec<Vec<u32>>` cost comes from per-node allocation
overhead: every node gets its own heap-allocated `Vec`, each with its own
capacity, pointer, and length bookkeeping, none of which `Csr`'s single flat
array pays for.

### Extrapolation to the real target (not measured)

sprefa's 500-repository target is roughly 150M nodes and 130M edges. Using
the measured 10M-edge bytes/edge figures as a straight line:

- `Csr`: 17.4 bytes/edge times 130,000,000 edges is approximately 2.26GB.
- `Vec<Vec<u32>>`: 42.5 bytes/edge times 130,000,000 edges is approximately
  5.53GB.

This is a straight-line extrapolation from the measured curve, not a
measurement. It was not run, deliberately, per the fixed 10M-edge ceiling.
On a 16GB machine, either figure fits with headroom to spare for the SCC and
traversal working set on top, though `Csr`'s smaller footprint leaves more
of that headroom available.

## H4: Csr::from_sorted_edges against bulk add_edge

`Csr::from_sorted_edges` takes a single pre-sorted, pre-deduplicated slice
of `(u32, u32)` pairs and builds the whole structure in one pass. The
alternative construction path, calling `add_edge` once per edge on a
`Csr::with_nodes(n)`, was measured directly at every point in a doubling
series through 1,000,000 edges:

| edges | elapsed | ratio versus half the size |
|---|---|---|
| 2,000 | 0.34ms | -- |
| 4,000 | 1.34ms | 3.90x |
| 8,000 | 5.58ms | 4.16x |
| 16,000 | 26.81ms | 4.80x |
| 32,000 | 102.06ms | 3.81x |
| 64,000 | 407.67ms | 3.99x |
| 128,000 | 1,649.08ms | 4.05x |
| 256,000 | 6,671.37ms | 4.05x |
| 1,000,000 | 120,430.94ms | 18.05x |

Doubling the edge count roughly quadruples the time from 4,000 edges all the
way through 256,000, the signature of quadratic growth (a linear algorithm
would show a ratio near 2x at every doubling instead). The final row breaks
the doubling pattern (256,000 to 1,000,000 is a 3.9x increase in edge
count), and the 18.05x time increase it produces is consistent with that
same quadratic relationship continuing to hold at that ratio.

The same 1,000,000 edges, built instead via `from_sorted_edges` after a
sort and dedup pass, measured in the H3 table above: 6ms of build time, plus
18ms to sort and deduplicate the input first. Against the 120,430.94ms
`add_edge` figure, that is roughly a 5,000-fold difference in wall clock
time for the identical output.

### What this means for a database-backed build

Any system that already has its edges sitting in a table, retrievable with
`ORDER BY source, target`, gets the sorted input `from_sorted_edges` wants
for free from the query itself. Building the same graph by iterating a
result set and calling `add_edge` per row is the natural thing to reach for
first, and at the scale sprefa actually deals with (hundreds of thousands
to low millions of edges per repository) the growth curve above shows the
cost of that choice compounding as the graph grows, crossing from "a build
step" into "a build step nobody will wait for" well before reaching the
500-repository target. A database query with an `ORDER BY` feeding
`from_sorted_edges` avoids the compounding entirely.

### Two traps in from_sorted_edges worth a day's warning

**Duplicates are reported as a sortedness violation, not as a distinct
error.** Feeding `from_sorted_edges` the pair `(0, 1)` twice, correctly
sorted otherwise, produces:

```
duplicate_edges -> Err(EdgesNotSorted { first_error: (0, 1) })
```

which is the exact same error shape as feeding it genuinely unsorted input:

```
unsorted_input -> Err(EdgesNotSorted { first_error: (1, 2) })
```

There is no `DuplicateEdge` variant to match against. Code that assumes
"sorted but not deduplicated" input is safe, because it is sorted, will be
surprised: the function requires strictly increasing pairs, and an
equal-adjacent pair fails that check the same way an out-of-order pair
would. Any pipeline feeding this function needs an explicit dedup pass
before the call, not just a sort.

**A trailing node that never appears as an edge endpoint silently
disappears.** Given edges that only ever reference node ids 0 through 5,
`from_sorted_edges` infers `node_count = 6` and stops there:

```
isolated_trailing_node -> node_count=6 (edges only reference ids 0..=5; a hypothetical isolated node 10 is NOT represented)
```

If sprefa (or any caller) has isolated nodes with no edges at all, and those
nodes happen to carry the highest ids in the dense id space (a real
possibility if ids are assigned in some order unrelated to edge
participation), building the graph with `from_sorted_edges` alone will
under-count the node set with no error raised anywhere. The fix is
`Csr::with_nodes(n)` followed by explicit `add_edge` calls when the true
node count needs to be preserved regardless of which nodes have edges,
accepting the slower construction path measured above for that portion of
the build, or padding the edge list with a self-loop or otherwise-excluded
marker edge on the highest node id before calling `from_sorted_edges`, so
the true maximum id is visible to the inference.

## H6: the cost of reverse traversal on a Csr

`Csr` implements only forward neighbor iteration, so `Reversed(&csr)`, the
adaptor that would otherwise give reverse-direction traversal on any graph
type that supports it, does not compile (full quote and explanation in
[index.md](index.md) and [stack-safety.md](stack-safety.md)). Confirmed
working on the two graph types that do support it:

```
DiGraph Reversed DFS from c: [2, 1, 0] (expect [2, 1, 0])
StableDiGraph Reversed DFS from c: [2, 1, 0] (expect [2, 1, 0])
```

The only workaround for a `Csr`-backed graph is building a second, fully
separate `Csr` holding the transposed edge list (every `(source, target)`
pair swapped to `(target, source)`, then sorted and deduplicated again).
Measured directly:

| edges | transposed Csr build time | transposed Csr peak RSS |
|---|---|---|
| 1,000,000 | 33ms | 29,361,120 B |
| 10,000,000 | 282ms | 273,106,496 B |

At 10,000,000 edges, the transposed copy's peak RSS (273MB) is close to the
forward `Csr`'s own footprint at the same scale (174MB, from the H3 table
above), meaning any workload that needs both forward and reverse
reachability on a `Csr`-backed graph should budget for close to double the
edge storage, not the forward figure alone. `reached_by` in sprefa's own
`scc.rs` needs exactly this kind of reverse walk (over the condensed
adjacency, `cadj_rev`), which is one more reason the six-function
replacement table in [index.md](index.md) treats `build_condensed` and
`reaches_from`/`reached_by` as conditioned on giving up `Csr`, not as a
straightforward win.
