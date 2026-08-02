# Traversal semantics: Control::Prune, depth caps, and filter overhead

Back to [index.md](index.md).

This file is the deep version of H5, H7, and H8: the traversal-shaped
questions, as opposed to the stack-safety and memory questions covered in
[stack-safety.md](stack-safety.md) and [memory.md](memory.md).

## H5: Control::Prune proven exact, against sprefa's own halt shape

sprefa's `walk.rs` defines `multi_source_halt_bfs`: from a set of seed
nodes, walk forward, record every node reached, but never expand past a node
marked `halt`. A halted node is still a reported, reachable endpoint; it
just does not propagate further. This is the single operation the
`README.md` for this whole `graph-libs` survey calls out as the one most
graph libraries lack, because it is a different shape than a node filter.
A filtered node is invisible. A halted node is visible and terminal.

petgraph's `visit::Control::Prune`, returned from a `depth_first_search`
callback on `DfsEvent::Discover`, was tested against this exact shape on a
hand-built 12-node graph, seeded at node 0, with nodes 2 and 7 marked as the
halt set:

```
0 -> 1 -> 2(halt) -> 3 -> 4
0 -> 5 -> 6 -> 7(halt) -> 8
             6 -> 9
10 -> 11                      (disconnected, unreachable from 0)
```

The code that drives this, exactly as it appears in the lab crate:

```rust
depth_first_search(graph, Some(seed), |event| -> Control<()> {
    match event {
        DfsEvent::Discover(node, _time) => {
            let index = index_of(node);
            discovered.insert(index);
            discover_order.push(index);
            if port_in.contains(&index) {
                Control::Prune
            } else {
                Control::Continue
            }
        }
        DfsEvent::Finish(node, _time) => {
            finished.insert(index_of(node));
            Control::Continue
        }
        _ => Control::Continue,
    }
});
```

Measured result, matching the expectation exactly:

```
discovered = {0, 1, 2, 5, 6, 7, 9}
finished = {0, 1, 2, 5, 6, 7, 9}
discovered_matches_expected = true
pruned_node_2_is_discovered = true
pruned_node_2_is_finished = true
pruned_node_7_is_discovered = true
pruned_node_7_is_finished = true
node_3_behind_prune_2_NOT_reached = true
node_9_sibling_of_pruned_7_IS_reached = true
disconnected_10_11_NOT_reached = true
```

Three facts fall out of this test, each one required for the semantics to
actually match `multi_source_halt_bfs`:

1. A pruned node is still discovered, and `DfsEvent::Finish` still fires for
   it. `Control::Prune` stops the traversal from walking OUT of the node; it
   does not remove the node itself from the result.
2. Only the pruned node's own outgoing edges are skipped. Node 9, reached
   through 6 -> 9, a sibling edge of the pruned 6 -> 7, is unaffected: the
   prune only cuts the specific edge path leaving the pruned node.
3. Nodes behind a pruned node (3, 4, 8) are never reached at all, matching
   the "does not propagate" half of the halt requirement.

This proof carries no caveat about correctness for a single-source,
single-tag traversal. The caveat that matters is about depth, covered fully
in [stack-safety.md](stack-safety.md): the mechanism proven correct here
recurses, and recursion has a floor that sprefa's real data can exceed.

## H7: depth cap, two implementations, and where each one breaks

### Depth cap and halt together, via Control

The same `depth_first_search` + `Control` mechanism from H5 can express a
depth cap and a halt predicate in the same pass, because
`DfsEvent::TreeEdge(parent, child)` always fires immediately before
`DfsEvent::Discover(child)` in this recursive implementation, which is
enough to track each node's depth without any side channel:

```rust
fn control_capped_halted_reach(
    graph: &DiGraph<(), ()>,
    seed: NodeIndex,
    depth_cap: usize,
    halt: &HashSet<usize>,
) -> BTreeSet<usize> {
    let mut depth_of: HashMap<NodeIndex, usize> = HashMap::new();
    depth_of.insert(seed, 0);
    let mut pending_child_depth: Option<usize> = None;
    let mut reached = BTreeSet::new();

    depth_first_search(graph, Some(seed), |event| -> Control<()> {
        match event {
            DfsEvent::TreeEdge(parent, _child) => {
                pending_child_depth = Some(depth_of[&parent] + 1);
                Control::Continue
            }
            DfsEvent::Discover(node, _time) => {
                let depth = if node == seed { 0 } else { pending_child_depth.take().expect("TreeEdge precedes Discover") };
                depth_of.insert(node, depth);
                reached.insert(node.index());
                if halt.contains(&node.index()) || depth >= depth_cap {
                    Control::Prune
                } else {
                    Control::Continue
                }
            }
            _ => Control::Continue,
        }
    });
    reached
}
```

Both combinations were tested and pass: a halt set binding before the depth
cap would (reached stops at the halt node, cap set loose enough not to
matter), and a depth cap binding with no halt set at all (reached stops at
the cap). This is 32 lines to express both constraints in one traversal.
The cost of that expressiveness is the recursion underneath it, quantified
in [stack-safety.md](stack-safety.md).

### Depth cap alone, via the Bfs walker

petgraph's `Bfs` walker is iterative (an explicit `VecDeque`, not
recursion), so a pure depth cap, with no halt predicate, can be built by
counting off layers against its own public `stack` and `discovered` fields,
in about 25 lines:

```rust
let mut bfs = Bfs::new(&graph, nodes[0]);
let mut reached = BTreeSet::new();
let depth_cap = 2usize;
let mut depth = 0usize;
let mut layer_remaining = 1usize; // seed is the only node at depth 0
while layer_remaining > 0 && depth <= depth_cap {
    if let Some(node) = bfs.next(&graph) {
        reached.insert(node.index());
    } else {
        break;
    }
    layer_remaining -= 1;
    if layer_remaining == 0 {
        depth += 1;
        layer_remaining = if depth <= depth_cap { bfs.stack.len() } else { 0 };
    }
}
```

This works because a depth cap only ever needs to stop ITERATION early; it
never needs to undo an expansion that already happened. That is precisely
what the next trap shows does not hold for a halt predicate.

### The Bfs naive-halt trap

`Bfs::next()` (`petgraph-0.8.3/src/visit/traversal.rs:294-308`) pops the
front node off its queue and pushes that node's neighbors onto the queue as
a side effect, before it returns the node to the caller. A halt predicate
checked on the value `.next()` hands back therefore always runs one step
too late: the neighbors it was supposed to prevent are already queued by
the time the caller sees the node and can react.

Demonstrated directly on a chain `0 -> 1 -> 2 -> 3`, with the intent to halt
expansion at node 1 (expected reach: `{0, 1}` only):

```rust
let halt: HashSet<usize> = [1].into_iter().collect();
let mut bfs = Bfs::new(&graph, nodes[0]);
let mut reached = BTreeSet::new();
while let Some(node) = bfs.next(&graph) {
    reached.insert(node.index());
    if halt.contains(&node.index()) {
        // Too late: node's neighbors are already in bfs.stack.
        continue;
    }
}
```

Measured result:

```
bfs_naive_halt_is_broken reached={0, 1, 2, 3} naive_intent={0, 1} matches_naive_intent=false
```

Nodes 2 and 3 leak into the result despite the halt check, because they
were already pushed onto `Bfs`'s internal queue during the very call to
`.next()` that returned node 1. The compiler gives no warning here; this is
a silent, wrong answer at runtime, discoverable only by testing the halt
case specifically. The only correct fix abandons `Bfs::next()` entirely and
checks the halt predicate before pushing a node's neighbors, against
`Bfs`'s own public `stack` and `discovered` fields directly, which is
functionally a rewrite of the walker's insides rather than a use of the
walker as published. That rewrite is, in substance, sprefa's own
`multi_source_walk`, already written and already correct.

## H8: NodeFiltered and EdgeFiltered overhead is unmeasurable noise

`NodeFiltered::from_fn` and `EdgeFiltered::from_fn`, both wrapped around an
always-true predicate to isolate the adaptor's own dispatch cost from
whatever an actual filter predicate would add, were timed against a raw
`Csr` doing the same neighbor-sum traversal, at 10,000,000 edges, three
independent runs:

| run | baseline | node-filtered | edge-filtered |
|---|---|---|---|
| 1 | 57ms | 52ms (-8.0%) | 51ms (-9.6%) |
| 2 | 57ms | 54ms (-4.8%) | 50ms (-12.0%) |
| 3 | 55ms | 53ms (-4.4%) | 50ms (-8.3%) |

The filtered variants measured faster than the unfiltered baseline in every
run. That delta is the size of the noise floor at this runtime (50 to 60
milliseconds), small enough that ordering effects, branch prediction
warm-up, and background system load dominate
whatever the adaptor's dispatch actually costs. The honest conclusion is
that the overhead of these two adaptors, for an always-true predicate, is
not distinguishable from zero at this scale.
