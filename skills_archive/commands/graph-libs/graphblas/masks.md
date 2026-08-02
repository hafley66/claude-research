# Masks, the assign trap, and the transpose surprise

Working code for everything below lives in
`~/projects/claude-research/labs/graph-graphblas/src/bin/{h2_bfs,h3_halt,h5_reach,debug_assign}.rs`.
Every number quoted here came from running those binaries with `/usr/bin/time -l`, at 1M and
10M edges only, per the lab's memory budget.

## H2: BFS as a masked matrix-vector multiply

One BFS level in GraphBLAS is `next = vxm(frontier, adjacency, LOR_LAND_BOOL,
mask=complement(visited), replace)`: multiply the current frontier (a sparse boolean row
vector) against the adjacency matrix using OR as the combining operator and AND as the
per-edge operator, restricted to nodes not already visited, clearing the output first. The
result is exactly the set of nodes reachable in one more hop that have not been seen before.
Loop until that result is empty and the walk is done.

Proven correct on a 12-node hand-built graph with a disjoint cycle and a disjoint branch,
exact match against the known answer and against a second, independently-written pure-Rust
BFS run on the identical edge list. At scale: 25.2ms at 1,000,000 edges, 125.1ms at
10,000,000 edges, for one full single-source traversal each time.

## H3: the halt predicate, proven

sprefa needs a walk that reaches a node marked `port_in`, reports it, and does not continue
through it. This is different from filtering a node out of the walk: a filtered node is
invisible, while a halted node is a visible, reported stopping point. The GraphBLAS
expression:

```rust
loop {
    // Complement-mask apply: keep only frontier entries that are NOT marked halt.
    let mut frontier_active = SparseVector::<bool>::new(context.clone(), num_nodes).unwrap();
    let filter_options = OperatorOptions::new(true, false, true); // replace, value-mask, complement
    apply_op.apply_to_vector(&identity, &frontier, &assign_accum, &mut frontier_active,
                              halt, &filter_options).unwrap();

    if frontier_active.number_of_stored_elements().unwrap() == 0 {
        break; // every remaining frontier node is halted: stop expanding
    }

    let mut next = SparseVector::<bool>::new(context.clone(), num_nodes).unwrap();
    let vxm_options = OptionsForOperatorWithMatrixAsSecondArgument::new(true, false, true, false);
    vxm_op.apply(&frontier_active, &semiring, adjacency, &assign_accum, &mut next,
                 &reached, &vxm_options).unwrap();
    if next.number_of_stored_elements().unwrap() == 0 { break; }

    // reached = reached UNION next (LogicalOr monoid -- see the assign trap below
    // for why this is NOT the same as a "merge" via assign/subassign)
    let mut merged = SparseVector::<bool>::new(context.clone(), num_nodes).unwrap();
    union_op.apply(&reached, &or_monoid, &next, &assign_accum, &mut merged,
                   &SelectEntireVector::new(context.clone()),
                   &OptionsForOperatorWithMatrixAsSecondArgument::new_default()).unwrap();
    reached = merged;
    frontier = next;
}
```

The mechanism that matters is the first block. `apply_to_vector` runs the identity operation
over `frontier`, but restricted by a mask (`halt`) with the complement descriptor bit set, so
the output keeps only entries where the mask is FALSE, meaning "not halted." That filtered
copy, not the raw frontier, is what feeds the next `vxm` call. A node marked halted still
gets fully recorded in `reached` the round it is first discovered, because that recording
happens from `next` before the halt filter is ever applied to it. It just never becomes a
source of further expansion in the round after that, because by then it has already been
dropped from `frontier_active`.

Every step above is a single, flat, whole-frontier matrix or vector operation. Nothing here
maintains a call stack, an explicit work queue, or a depth counter tied to a stack frame. The
loop bound is the number of BFS levels the graph actually has, not the number of nodes on
any one path, so a 1,000,000-node path graph and a 1,000,000-node star both terminate after
however many rounds their diameter requires, with memory proportional to one frontier's
width, not to depth.

Proof, on a 4-node chain `0 -> 1 -> 2 -> 3` with node 2 marked halted, seeded at node 1:

```
H3: naive BFS from node 1 (halt-blind)      = [1, 2, 3]
H3: halt-aware walk from node 1 (halt[2]=true) = [1, 2]
H3 PASS: naive BFS reaches {1,2,3}, halt-aware masked-apply walk reaches {1,2} only
H3 PASS: start-node-is-halt case reaches {1} only
```

The naive BFS (H2's unmodified loop, no halt filtering at all) reaches all three downstream
nodes. The halt-aware walk reaches exactly two: node 2 is recorded, exactly as required, and
node 3 is never produced, because nothing ever multiplied outward from node 2 once it was
dropped from the active frontier. Both answers are asserted against known values and against
each other: the two answers are proven to disagree in exactly the one place they are
supposed to disagree.

## The `GrB_Vector_assign` silent-delete trap

This is the single most useful paragraph in this lab for anyone who reuses this crate.

The obvious way to merge a newly-discovered frontier into a running `visited` set is "assign
the new entries into the existing vector, touching nothing else": no mask, every index
(`ElementIndexSelector::All`), and no `REPLACE` descriptor bit, on the theory that without
`REPLACE`, positions absent from the source should be left alone. That theory is wrong for
this crate's `GrB_Vector_assign` (its `insert` module) AND its `GxB_Vector_subassign` (its
`subinsert` module) alike. Both silently delete every destination entry that the source
vector does not also have, regardless of the `REPLACE` flag, the moment the index selector
covers the whole vector with no mask. Isolated proof
(`~/projects/claude-research/labs/graph-graphblas/src/bin/debug_assign.rs`):

```rust
let mut w = SparseVector::<bool>::new(context.clone(), 6).unwrap();
w.set_value(0, true).unwrap();                      // w = {0}
let mut u = SparseVector::<bool>::new(context.clone(), 6).unwrap();
u.set_value(1, true).unwrap();                       // u = {1}
insert_op.apply(&mut w, &ElementIndexSelector::All, &u, &Assignment::<bool>::new(),
                &SelectEntireVector::new(context.clone()), &OperatorOptions::new_default())
    .unwrap();
```

Output:

```
GrB_Vector_assign (insert::InsertVectorIntoVectorOperator), no mask, no replace, w={0} <- u={1}: w = [1]
GxB_Vector_subassign (subinsert::InsertVectorIntoSubVectorOperator), no mask, no replace, w={0} <- u={1}: w = [1]
```

Node 0 is gone from `w` in both cases. The call looked like "add 1 to the set," and it
silently replaced the whole set with `{1}` instead. This broke the first version of `h2_bfs`
outright: a 12-node hand-built BFS returned `[3, 5]`, the LAST round's frontier only, because
every round's "merge the new frontier into visited" call wiped out every prior round's
entries before adding the new one. Nothing crashed, no error was returned, and the answer
looked plausible (a nonempty, sorted set of node ids) right up until it was checked against
the known correct answer.

The fix is to stop reaching for assign/subassign as a merge primitive at all. Element-wise
addition with the `LogicalOr` monoid, `merged = reached eWiseAdd(LogicalOr) next`, computes a
true set union: the result's structure is the union of both operands' structure, by
definition of what `eWiseAdd` means, with no index-selector or mask-mode ambiguity anywhere
in the call. Once `h2_bfs`'s merge step was rewritten this way, the 12-node correctness
assertion passed and stayed passing through H3, H4, and H5. The general lesson: in this
crate, `assign`/`subassign` answer the question "make this range of the destination equal to
this source, dropping what the source lacks," never "add these specific entries and leave
everything else untouched." Reach for `eWiseAdd` with the appropriate monoid whenever the
actual intent is "combine," not "assign."

## H4: multi-source, depth-capped, as one `mxm` per hop

Stack `k` independent seeds as `k` rows of a `k` x `n` frontier matrix instead of one
frontier vector. `mxm(frontier_matrix, adjacency, LOR_LAND_BOOL, mask=complement(reached),
replace)` advances every source's frontier in a single matrix-matrix multiply; depth caps are
just an iteration-count cap on the outer loop, since every source advances one hop per
round in lockstep. Proven correct on two disjoint 4-node chains sharing one matrix (source A
on `0->1->2->3`, source B on `10->11->12->13`): cap=2 stops both one hop short of the far
end, cap=5 and unbounded both reach the full chains, and neither source's rows ever pick up
the other source's nodes. At 10,000,000 edges with 8 independent sources: cap=2 in 310
microseconds, cap=5 in 4.55 milliseconds, unbounded in 1.012 seconds, for all 8 sources
computed together in each call.

## H5: reachability both directions, and the transpose surprise

`mxv(matrix, vector)` computes, for each row `i`, whether row `i` has an edge into some node
already in the frontier; that is backward (predecessor) reachability. Forward reachability
needs the transpose, `mxv(matrix, vector, transpose_first_argument=true)`, which uses `A^T`
without ever building a second matrix, via a descriptor flag. Proven correct on a 4-node
graph where forward-from-0 (`{0,1,2}`) and backward-into-2 (`{0,1,2,3}`) provably differ, and
a materialized `A^T` built with an explicit `GrB_transpose` call gives the identical forward
answer the descriptor gave.

The surprise is in the timing, not the correctness. Running the same 20-repeat backward walk
two ways at 10,000,000 edges:

```
H5 SCALE: nodes=2000000 edges=10000000 repeats=20 descriptor_path_total=2.501598667s materialize_once=56.938791ms + materialized_path_repeats=57.871441541s = 57.928380332s
```

Using the transpose descriptor for all 20 repeats: 2.50 seconds. Materializing the transpose
ONCE (56.9 milliseconds, cheap, as expected) and then running the identical 20 repeats
against that materialized matrix with no descriptor at all: 57.93 seconds total, almost
entirely spent in the repeats themselves, not the one-time transpose. The materialized path
is 23 times slower overall than the descriptor path, at 10,000,000 edges, and 12 times slower
at 1,000,000 edges. This is the opposite of what the "materialize once, amortize the cost"
intuition predicts: the freshly-built matrix should be at least as fast to multiply against
as the original, and instead it is dramatically slower.

Reported honestly: this is a real, reproducible result, not explained. The leading hypothesis
is that a matrix produced by `GrB_transpose` into a bare `SparseMatrix::new` does not go
through whatever internal format optimization pass a matrix built via bulk
`from_element_list` insertion receives, so the transposed matrix stays in a slower internal
representation until something forces it to reorganize. What would need measuring next to
confirm or kill that hypothesis: forcing an explicit `GrB_wait` on the materialized transpose
before timing the repeats, and checking whether SuiteSparse:GraphBLAS exposes any way to
query a matrix's internal storage format (CSR/CSC/hypersparse/bitmap) so the two matrices
could be compared directly rather than inferred from timing alone. Neither was attempted here
given the lab's time budget; the practical takeaway stands regardless of the mechanism: when
a direction is needed repeatedly, reach for the transpose descriptor, not a materialized
second matrix.
