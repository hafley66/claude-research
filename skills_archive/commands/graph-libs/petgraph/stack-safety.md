# Stack safety: recursion in petgraph's SCC and DFS code

Back to [index.md](index.md).

This file is the deep version of H1, H2, and H7. It exists because a stack
overflow is the worst kind of defect to discover late: it does not show up
in a small test, it does not show up in a code review, and when it finally
happens it is a hard process abort with no panic to catch, not a value you
can inspect. Everything here is either read directly from the vendored
source at
`~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/petgraph-0.8.3/`, or
measured by actually running the lab crate; nothing is taken from petgraph's
published documentation.

## H1: tarjan_scc is recursive by construction

The recursive call site, quoted exactly, is
`petgraph-0.8.3/src/algo/scc/tarjan_scc.rs:74-96`:

```rust
fn visit<G, F>(&mut self, v: G::NodeId, g: G, f: &mut F)
where
    G: IntoNeighbors<NodeId = N> + NodeIndexable<NodeId = N>,
    F: FnMut(&[N]),
    N: Copy + PartialEq,
{
    // ...
    for w in g.neighbors(v) {
        if node![w].rootindex.is_none() {
            self.visit(w, g, f);
        }
        // ...
    }
    // ...
}
```

`self.visit(w, g, f)` calls back into the same function for every
undiscovered neighbor. On a path graph (a straight chain, no branching),
this means one stack frame per node down the chain before the recursion ever
unwinds. petgraph's own doc comment for `TarjanScc::run` says exactly this:
"This implementation is recursive and does one pass over the nodes." It also
says the algorithm follows David Pierce's memory-efficient variation, which
explains why the per-frame cost is small (about 112 bytes, measured below)
rather than the more bloated frame a naive translation would produce. Small
per-frame cost delays the crash. It does not remove it.

### Exact crash threshold, default stack

Measured with `h1_tarjan_stack`, which builds a `DiGraph` path graph
`0 -> 1 -> ... -> N` and calls `tarjan_scc` on it, on the process's default
main thread (macOS default `ulimit -s` is 8176KB, confirmed at test time).
Binary search on the process exit code (0 = completed; 134 = SIGABRT after
Rust's own stack-overflow guard-page trap) lands on an exact single-node
bracket:

```
N=74528  -> OK, scc_count=74528, elapsed_ms=0
N=74529  -> thread 'main' (...) has overflowed its stack
            fatal runtime error: stack overflow, aborting
```

8176KB divided by 74,528 nodes gives roughly 112.34 bytes of stack consumed
per additional node of chain depth.

### Confirming the ~108MB figure at N=1,000,000

Run on a `std::thread::Builder::new().stack_size(...)` worker thread instead
of the default stack, to test specific stack sizes directly:

```
N=1,000,000, 100MB stack -> thread '<unknown>' (...) has overflowed its stack
                             fatal runtime error: stack overflow, aborting
N=1,000,000, 115MB stack -> OK, scc_count=1000000, elapsed_ms=34
```

This confirms a prior estimate from an earlier run of this lab (roughly
108MB needed at N=1,000,000) by bracketing it directly: the true requirement
sits somewhere in the 100 to 115MB band, consistent with 112.3 bytes/node
times 1,000,000 nodes (about 107MB).

## H2: kosaraju_scc is iterative, and its ordering matches tarjan_scc's

`kosaraju_scc` (`petgraph-0.8.3/src/algo/scc/kosaraju_scc.rs`) contains no
self-recursive call anywhere in its own body. It drives two walker types,
`DfsPostOrder` and `Dfs`, both of which are implemented with an explicit
`Vec`-backed stack and a `while let Some(...) = stack.pop()` loop
(`petgraph-0.8.3/src/visit/traversal.rs:108-115` and `:202-216`). The
recursion is gone because the call stack was replaced by a heap-allocated
`Vec`, which can grow to whatever size the heap allows rather than whatever
size the OS gave the thread at spawn time.

Measured on the same path-graph shape as H1, on the default stack, no
dedicated thread needed at all:

```
N=74,529  (tarjan_scc's own crash point): 1ms, peak RSS 6.3 to 7.2MB
N=1,000,000:                              22ms, peak RSS 61.6 to 74.6MB
```

Both survive cleanly. The two peak-RSS figures come from `/usr/bin/time -l`
and the binary's own `getrusage` read respectively; they agree closely.

### Ordering match

`kosaraju_scc` and `tarjan_scc` both document their output order as
reverse-topological (postorder) across components, with an unspecified order
of nodes within a single component. Tested on a 5,000-node graph built as a
path with a back-edge every 50 nodes (folding each run of 50 into one
nontrivial SCC, so the comparison exercises real multi-node components, not
just singletons): both algorithms report exactly 100 SCCs, and the
sequence of components, compared as sorted-member-id vectors, matches
exactly (`same_order=true`).

### The caveat that matters more than the confirmation

`kosaraju_scc` requires `IntoNeighborsDirected` (needed for its reversed
first pass), and `Csr` never implements that trait. Confirmed directly:

```
error[E0277]: the trait bound `Csr: IntoNeighborsDirected` is not satisfied
  --> kosaraju_csr_fail.rs:6:30
   |
 6 |     let sccs = kosaraju_scc(&csr);
   |                ------------  ^^^ the trait `IntoNeighborsDirected` is not implemented for `Csr`
note: required by a bound in `kosaraju_scc`
  --> .../petgraph-0.8.3/src/algo/scc/kosaraju_scc.rs:98:8
   |
98 |     G: IntoNeighborsDirected + Visitable + IntoNodeIdentifiers,
```

`tarjan_scc`'s bound (`IntoNodeIdentifiers + IntoNeighbors + NodeIndexable`)
has no directed-neighbor requirement, so it compiles against `Csr` cleanly,
confirmed by running it and getting the correct answer on a 3-cycle:

```
scc_count=1 sccs=[[2, 1, 0]]
```

So the safety property (iterative, no crash at any depth) and the
representation property (compiles against `Csr`) sit on opposite sides of
this trait boundary, and no algorithm in petgraph 0.8.3 has both at once.
See [index.md](index.md)'s "Csr trap" section for what this means in
practice.

## H7: depth_first_search's recursion is heavier and crashes sooner

`depth_first_search`, the function backing `visit::Control`-based
traversals such as the one that correctly implements sprefa's halt-and-prune
semantics (see [traversal.md](traversal.md) for that proof), is driven by a
private helper, `dfs_visitor`
(`petgraph-0.8.3/src/visit/dfsvisit.rs:261-301`), which recurses into itself
for every tree edge, the same shape of self-call as `tarjan_scc`'s `visit`.

Measured on the identical path-graph shape as H1, same default stack:

```
N=43,418 -> OK, reached_count=43418
N=43,563 -> thread 'main' (...) has overflowed its stack
            fatal runtime error: stack overflow, aborting
```

That crash bracket sits at roughly 58 percent of `tarjan_scc`'s own
threshold (74,528). Working out bytes per node from the lower bound of this
bracket (8176KB divided by 43,418) gives roughly 192.6 bytes/node, against
`tarjan_scc`'s 112.3, about 1.7 times heavier. The extra weight is not
mysterious: the closure driving `depth_first_search` in this traversal
carries a `HashMap<NodeIndex, usize>` for per-node depth and an
`Option<usize>` for the pending child depth, both captured into the closure
and therefore present in every recursive frame, on top of the same
recursive machinery `depth_first_search` already needs internally.

At sprefa's assumed worst-case depth of 1,000,000, the required stack sits
between 180MB (confirmed crash) and 220MB (confirmed survives), more than
double `tarjan_scc`'s own 100 to 115MB bracket at the same depth.

### Why this specific finding is dangerous rather than merely inconvenient

The mechanism is semantically correct. H5 proves this with an exact-set
assertion on a hand-built graph, and that proof does not change no matter
how deep the graph gets: `Control::Prune` still records a node and stops
expansion past it, at any scale. A developer who tests this against a
dozen-node fixture, or even a few thousand nodes drawn from a small test
repository, will see it behave exactly as intended. The failure only
appears once the input graph has a dependency chain deep enough to matter.
For sprefa that depth lives in production code, a real repository's call
graph or module graph, well past anything a feature's own test suite is
likely to cover.

GitHub issue [#727](https://github.com/petgraph/petgraph/issues/727),
"Non-recursive DFS," opened 2025-02-03 against this exact crate and still
open as of this writing, documents a maintainer making precisely this
mistake in real time, confirming that this blind spot reaches people with
direct access to the source, not only downstream callers. The reporter's
opening line: "The DFS search currently is recursive and will cause a stack
overflow with deep enough graphs." A maintainer's first reply disputes it,
quoting the `Dfs` struct's own doc comment directly from `traversal.rs`:
"`Dfs` is not recursive." That doc comment is accurate for the `Dfs`
struct specifically: `Dfs`/`DfsPostOrder` (the walker family behind
`kosaraju_scc`, confirmed iterative above) is genuinely iterative. It
answers the wrong question, because the reporter meant a different,
similarly-named function. Only after the reporter names the exact line,
`dfsvisit.rs:241`, does the maintainer recognize that a second,
differently-named, recursive depth-first traversal exists in the same
crate: "Wow, I was not aware that there is an alternative DFS." The thread
ends without a resolution; no PR was filed as of this writing.

If someone with source-level access to the crate can lose track of which of
two similarly-purposed traversal functions is recursive, a downstream user
relying on the published API surface, without reading `dfsvisit.rs` line by
line the way this lab did, has essentially no chance of catching this before
it ships. That is the entire reason this finding belongs in a decision
document rather than only a numbers table: it is exactly the kind of gap
that a correctness review would not catch, because the code IS correct,
right up until the stack runs out.

## Putting both thresholds against the real workload

From the live sprefa database, one repository, measured 2026-07-19:
283,127 dataflow nodes, 261,704 edges, across 506 files. sprefa's own
assumption for worst-case path depth is 1,000,000.

- `tarjan_scc` crashes past roughly 74,500 nodes of chain depth on a default
  stack. That is about 26 percent of a single repository's node count.
- `depth_first_search` via `Control` crashes past roughly 43,500. That is
  about 15 percent of a single repository's node count.
- Against the assumed worst case of 1,000,000, `tarjan_scc`'s threshold is
  reached at 7.5 percent of the way in; the `Control`-driven traversal's
  threshold is reached at 4.3 percent of the way in.

Neither algorithm survives being handed sprefa's real data on a default
thread stack. Both would need to run on a dedicated worker thread with a
stack sized in the hundreds of megabytes, chosen before the call graph's
actual depth is known, because there is no way to catch the failure and
retry with a bigger stack after the fact; a stack overflow in Rust is a
process abort, not a panic. sprefa's existing iterative `tarjan` in
`scc.rs` and its existing hand-rolled BFS in `walk.rs` never face this
choice, at any depth, on any stack, because neither one recurses. That
guarantee is the value actually at stake if either petgraph algorithm
replaced the code that is already there.
