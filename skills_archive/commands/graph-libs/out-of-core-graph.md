---
description: Prior art for running compiled graph algorithms (SCC, toposort, dominators) over a graph that does not fit in RAM. Covers petgraph-over-disk attempts, mmap CSR, embedded graph DBs (Kuzu/LadybugDB, CozoDB, DuckPGQ), the N+1 neighbor-fetch problem, and partitioned SCC.
argument-hint: "[petgraph | mmap | kuzu | cozo | n+1 | partitioned-scc]"
---

# Out-of-core graph algorithms: what actually exists

Research date 2026-07-20. Every claim below carries a URL. Where a source could
not be retrieved, that is stated.

## Verdict

A usable "compiled algorithms over a non-resident graph" option exists, and it is
**Kuzu / LadybugDB's `algo` extension**, not anything in the petgraph ecosystem.

| Question | Answer |
|---|---|
| Has anyone implemented petgraph's visit traits over SQLite/RocksDB/redb/sled/LMDB? | No instance found. See the empty-query table. |
| Is there an embedded engine that runs SCC without materializing the graph in RAM? | Yes. Kuzu 0.10.0+ and its fork LadybugDB. Documented, quoted below. |
| Does CozoDB qualify? | No. Its SCC builds a full in-memory `DirectedCsrGraph` first. |
| Is there a Rust library that gives you compiled SCC over an mmap'd CSR? | Not off the shelf. webgraph-rs gives the mmap'd compressed CSR; `webgraph-algo` ships HyperBall, with no SCC found. |
| Is per-node SQL neighbor fetch a documented, mitigated pattern? | Barely. One crate (`sqlitegraph`, GPL-3.0) ships a bounded LRU adjacency cache in front of SQLite, with published nanosecond numbers. No crossover measurement found anywhere. |

The single strongest quote in the whole search, from the Kuzu 0.10.0 release post:

> "Graph algorithms in Kuzu are disk-based, meaning that they can run on projected
> graphs that are larger than your available memory."
> [kuzudb.github.io/blog/post/kuzu-0.10.0-release](https://kuzudb.github.io/blog/post/kuzu-0.10.0-release/)

> "Kuzu does not materialize projected graphs in memory, and all data is scanned
> from disk on-the-fly." (same post; the docs page repeats it as "the corresponding
> data is scanned from disk on the fly",
> [kuzudb.github.io/docs/extensions/algo](https://kuzudb.github.io/docs/extensions/algo/))

Kuzu was archived October 2025 after an Apple acquisition. LadybugDB is the live
fork carrying the same text.

---

## 1. Direct prior art: petgraph over a disk store

**Nothing found.** No crate, repo, blog post, forum thread, or issue implementing
`IntoNeighbors` / `Visitable` / `NodeIndexable` over SQLite, RocksDB, redb, sled,
LMDB, or an mmap'd file was located.

Nearest misses:

| Project | What it actually is | petgraph relation |
|---|---|---|
| [`sqlitegraph`](https://docs.rs/sqlitegraph/latest/sqlitegraph/) v3.9.0, GPL-3.0-only | Embedded graph DB on SQLite with its own streaming BFS/DFS/toposort/CC iterators and a bounded adjacency cache | Depends on `petgraph ^0.6` as a normal dependency. The repo README and docs show no impl of petgraph's visit traits over the SQLite backend; traversal uses the crate's own iterators. |
| [`graph-api`](https://bryncooke.github.io/graph-api/reference/implementations.html) | Abstraction layer over graph backends | Ships exactly two implementations, `SimpleGraph` and a `PetGraph` adapter. Documentation lists no disk-backed or persistent backend. |
| [`oxgraph`](https://github.com/oxgraph/oxgraph), MIT, 1 star, 90 commits | Self-described "general-purpose, zero-copy graph and hypergraph engine for Rust", runs "in memory, over mmap, embedded, or in Postgres". `oxgraph-algo` ships BFS and PageRank. | No petgraph mention. Pre-1.0, README states "the traits and crates are not stable yet" and the snapshot format is "an internal ABI candidate, not a stable interchange format". No SCC. |
| [`graphqlite`](https://github.com/colliery-io/graphqlite), MIT, 78.5% C | SQLite extension adding Cypher. Ships PageRank, Louvain, Dijkstra, BFS/DFS, connected components. | C extension, not a Rust trait surface. No SCC listed. |

The trait shape itself, retrieved verbatim from
[docs.rs/petgraph/latest/petgraph/visit/trait.IntoNeighbors.html](https://docs.rs/petgraph/latest/petgraph/visit/trait.IntoNeighbors.html):

```rust
pub trait IntoNeighbors: GraphRef {
    type Neighbors: Iterator<Item = Self::NodeId>;

    fn neighbors(self, a: Self::NodeId) -> Self::Neighbors;
}
```

One node in, one iterator out. There is no batch entry point, so any batching has
to live behind the impl.

### What petgraph's own SCC costs you, from source

Retrieved verbatim from
[docs.rs/petgraph/latest/src/petgraph/algo/scc/kosaraju_scc.rs.html](https://docs.rs/petgraph/latest/src/petgraph/algo/scc/kosaraju_scc.rs.html):

```rust
pub fn kosaraju_scc<G>(g: G) -> Vec<Vec<G::NodeId>>
where
    G: IntoNeighborsDirected + Visitable + IntoNodeIdentifiers,
{
    let mut dfs = DfsPostOrder::empty(g);

    // First phase, reverse dfs pass, compute finishing times.
    let mut finish_order = Vec::with_capacity(0);
    for i in g.node_identifiers() {
        if dfs.discovered.is_visited(&i) { continue; }
        dfs.move_to(i);
        while let Some(nx) = dfs.next(Reversed(g)) {
            finish_order.push(nx);
        }
    }

    let mut dfs = Dfs::from_parts(dfs.stack, dfs.discovered);
    dfs.reset(g);
    let mut sccs = Vec::new();

    // Second phase, process in decreasing finishing time order
    for i in finish_order.into_iter().rev() {
        if dfs.discovered.is_visited(&i) { continue; }
        dfs.move_to(i);
        let mut scc = Vec::new();
        while let Some(nx) = dfs.next(g) { scc.push(nx); }
        sccs.push(scc);
    }
    sccs
}
```

Consequences that follow directly from that listing, with no edges resident:

| Allocation | Size |
|---|---|
| `finish_order: Vec<NodeId>` | one entry per node, whole node set |
| `dfs.discovered` (the `Visitable` map) | one bit or slot per node |
| `dfs.stack` | up to O(V) on a deep DFS |
| `sccs` | one entry per node, partitioned |

So petgraph's Kosaraju is **O(V) resident regardless of where the edges live**.
It also calls `IntoNeighborsDirected` in both directions (`Reversed(g)` in phase
one), meaning a disk impl must serve reverse adjacency too, not only forward.

Note also that the trait "is not dyn compatible" (same docs page), so the disk
graph has to be a concrete type threaded generically.

---

## 2. mmap-backed CSR

| Project | Language | Status | Notes |
|---|---|---|---|
| [webgraph-rs](https://github.com/vigna/webgraph-rs) / [docs.rs/webgraph](https://docs.rs/webgraph/latest/webgraph/) | Rust | Maintained, Apache-2.0 + LGPL-2.1 | Rust port of the Java WebGraph compression framework. Docs: "By default you will get big endianness, memory mapping for both the graph and the offsets, and dynamic code dispatch." Loading is configurable through `LoadConfig`, "selecting endianness, type of memory access, and so on". |
| [`webgraph-algo`](https://crates.io/crates/webgraph-algo) | Rust | Companion crate | README highlights HyperBall, "our tool for computing an approximation of the neighbourhood function, reachable nodes and geometric centralities of massive graphs." SCC not listed on the repo landing page. |
| [rkyv](https://rkyv.org) / [cloudflare/mmap-sync](https://github.com/cloudflare/mmap-sync) | Rust | Both maintained | rkyv author: "You can do things like mmap files into memory and use them without deserialization... Total zero-copy deserialization can drastically reduce load times." ([david.kolo.ski/blog/rkyv-architecture](https://david.kolo.ski/blog/rkyv-architecture/)). This is the generic mechanism, with no graph algorithms attached. |
| [oxgraph-mmap](https://lib.rs/crates/oxgraph-mmap) | Rust | Pre-1.0, 1-star parent | "This crate exists so the one unavoidable unsafe call lives in exactly one small, audited place behind a safe API." |
| GraphChi, X-Stream, GridGraph, FlashGraph | C++ | Research artifacts | See below. |

webgraph-rs's traversal surface, retrieved verbatim from
[webgraph/src/traits/graph.rs](https://raw.githubusercontent.com/vigna/webgraph-rs/main/webgraph/src/traits/graph.rs):

```rust
pub trait SequentialGraph: SequentialLabeling<Label = usize> {}

pub trait RandomAccessGraph: RandomAccessLabeling<Label = usize> + SequentialGraph {
    #[inline(always)]
    fn successors(&self, node_id: usize) -> <Self as RandomAccessLabeling>::Labels<'_> {
        <Self as RandomAccessLabeling>::labels(self, node_id)
    }
}
```

That is the same shape as `IntoNeighbors::neighbors`, so a
`RandomAccessGraph` -> `IntoNeighbors` adapter is mechanically straightforward.
No such adapter was found published; a search for one returned only generic
petgraph docs pages.

Retrieval failure to record: the WebGraph-in-Rust paper
[hal.science/hal-04494627v1/document](https://hal.science/hal-04494627v1/document)
returned an Anubis "Access Denied" interstitial, so bits-per-link and timing
numbers from that paper were **not** retrieved. The ACM mirror is
[dl.acm.org/doi/10.1145/3589335.3651581](https://dlnext.acm.org/doi/10.1145/3589335.3651581).

### The research systems

| System | Design | Usable as a library? |
|---|---|---|
| [FlashGraph](https://arxiv.org/abs/1408.0500), FAST '15 | "FlashGraph stores vertex state in memory and edge lists on SSDs". Claims "a multicore server can process graphs with billions of vertices and hundreds of billions of edges" and "performs many algorithms with performance up to 80% of its in-memory implementation", and "significantly outperforms PowerGraph, a popular distributed in-memory graph engine". | C++ research code, [github.com/leochencipher/FlashGraph](https://github.com/leochencipher/FlashGraph). Not a Rust-consumable library. |
| GraphChi | "a disk-based large-scale graph computation system" ([github.com/GraphChi](https://github.com/GraphChi/)); uses "a novel parallel sliding windows method" ([dl.acm.org/doi/10.5555/2387880.2387884](https://dl.acm.org/doi/10.5555/2387880.2387884)) | C++/Java research code, dormant. |
| X-Stream, GridGraph | Edge-streaming and 2D partitioning respectively ([GridGraph ATC'15 PDF](https://pacman.cs.tsinghua.edu.cn/~zxw/data/publications/gridgraph_atc15.pdf)) | Research artifacts. |
| ACGraph (2025) | Survey framing: "single-machine out-of-core GPSs achieve a favorable trade-off between scalability and efficiency" ([arxiv.org/html/2511.07886v1](https://arxiv.org/html/2511.07886v1)) | Paper only. |

The **semi-external** shape (vertex state in RAM, edge lists on disk) is the named,
published pattern that matches petgraph's O(V)-resident Kosaraju exactly. Term to
use when searching further: "semi-external memory graph engine".

---

## 3. Embedded graph databases

### Kuzu, and LadybugDB

| Fact | Value | Source |
|---|---|---|
| License | MIT | [github.com/kuzudb/kuzu](https://github.com/kuzudb/kuzu) |
| Status | Repository archived 2025-10-10, read-only. Last release v0.11.3, same date. | same |
| Reason | Company acquired by Apple. "Kùzu ... was archived in October 2025 after the company was acquired by Apple." | [github.com/jeromeetienne/codespine/issues/232](https://github.com/jeromeetienne/codespine/issues/232), corroborated by [blog.ladybugdb.com](https://blog.ladybugdb.com/post/ladybug-spreading-its-wings/) and [dbdb.io/db/ladybugdb](https://dbdb.io/db/ladybugdb/revisions/3) ("a revival fork of Kuzu after its acquisition and closure by Apple") |
| Fork | LadybugDB, MIT, v0.18.2 released 2026-07-15 | [github.com/LadybugDB/ladybug](https://github.com/LadybugDB/ladybug) |
| Rust crate | `kuzu` 0.11.3 (MIT) and `lbug` 0.18.2 (MIT) | [docs.rs/kuzu](https://docs.rs/kuzu/latest/kuzu/), [docs.rs/lbug](https://docs.rs/lbug/latest/lbug/) |

Algorithms in the `algo` extension, verbatim list from
[kuzudb.github.io/docs/extensions/algo](https://kuzudb.github.io/docs/extensions/algo/)
and [docs.ladybugdb.com/extensions/algo](https://docs.ladybugdb.com/extensions/algo/):

- K-Core Decomposition
- Louvain
- PageRank
- Shortest paths
- Strongly Connected Components
- Weakly Connected Components

SCC surface, verbatim from
[kuzudb.github.io/docs/extensions/algo/scc](https://kuzudb.github.io/docs/extensions/algo/scc/):

```
CALL strongly_connected_components(<GRAPH_NAME>, maxIterations := 100)
RETURN node, group_id
```
```
CALL strongly_connected_components_kosaraju(<GRAPH_NAME>)
RETURN node, group_id
```

Aliases `scc` and `scc_ko`. Two implementations ship: a "Parallel BFS-based
coloring algorithm" and a "DFS-based single-threaded Kosaraju's algorithm", with
the docs recommending Kosaraju "for sparse graphs or those with high diameter".
Caveat from the same page: "group_id is assigned based on Kuzu's internal node
offsets. Currently there is no way to assign group_id based on node properties."

Out-of-core status, the decisive statements:

- "Kuzu does not materialize projected graphs in memory, and the corresponding data is scanned from disk on the fly." (docs, algo index)
- "Graph algorithms in Kuzu are disk-based, meaning that they can run on projected graphs that are larger than your available memory." (0.10.0 release post)
- "A projected graph is evaluated _only_ when an algorithm is executed." (Ladybug docs)
- Parallelization uses "a vertex and edge-centric parallelization abstraction, similar to the Ligra paper" driven by the engine thread pool. (0.10.0 release post)

Published timings from the 0.10.0 post:

| Dataset | Threads | Algorithm | Time |
|---|---|---|---|
| soc-LiveJournal1 (4.8M nodes, 68M edges) | 64 | WCC | 0.3 s |
| soc-LiveJournal1 | 64 | PageRank | 5.1 s |
| soc-LiveJournal1 | 64 | K-Core | 9.2 s |
| soc-LiveJournal1 | 64 | Louvain | 21.2 s |
| datagen-sf10k (100M nodes, 9.4B edges) | 64 | PageRank | 146.5 s |
| datagen-sf10k | 64 | K-Core | 52.7 s |

No SCC timing is published in that table. The 100M-node / 9.4B-edge run is
directly above the stated 150M-node / 130M-edge target, on a very different
edge density.

Rust embedding caveat, verbatim from [docs.rs/kuzu](https://docs.rs/kuzu/latest/kuzu/):
binaries using the crate do not work with extensions by default (except on
Windows/MSVC); you must add `println!("cargo:rustc-link-arg=-rdynamic");` to
`build.rs` "so the binary produced acts like a library that the extension can
link with", otherwise extension loading fails with undefined symbol errors.
Since the `algo` extension is exactly what supplies SCC, this step is mandatory.

### CozoDB

| Fact | Value | Source |
|---|---|---|
| License | MPL-2.0 or later | [github.com/cozodb/cozo](https://github.com/cozodb/cozo) |
| Activity | 4.1k stars, 1,813 commits, last release v0.7.6 dated 2023-12-11 | same |
| Backends | Includes SQLite; "data files for the SQLite backend cannot be queried with SQL in the usual way, and access must be through the decoding process in CozoDB" | same |

Full algorithm list, verbatim from
[docs.cozodb.org/en/latest/algorithms.html](https://docs.cozodb.org/en/latest/algorithms.html):

`ConnectedComponents`, `StronglyConnectedComponent` (alias `SCC`),
`MinimumSpanningForestKruskal`, `MinimumSpanningTreePrim`, `TopSort`,
`ShortestPathBFS`, `ShortestPathDijkstra`, `KShortestPathYen`,
`BreadthFirstSearch` (`BFS`), `DepthFirstSearch` (`DFS`), `ShortestPathAStar`,
`ClusteringCoefficients`, `CommunityDetectionLouvain`, `LabelPropagation`,
`DegreeCentrality`, `PageRank`, `ClosenessCentrality`, `BetweennessCentrality`,
`RandomWalk`.

**Residency: in-memory.** From
[cozo-core/src/fixed_rule/algos/strongly_connected_components.rs](https://raw.githubusercontent.com/cozodb/cozo/main/cozo-core/src/fixed_rule/algos/strongly_connected_components.rs):

```rust
let edges = payload.get_input(0)?;
let (graph, indices, mut inv_indices) = edges.as_directed_graph(!self.strong)?;
```

`as_directed_graph` builds a `DirectedCsrGraph`, a complete in-memory CSR of the
whole input relation, before Tarjan runs. CozoDB is a disk-backed store that
pulls the graph into RAM to run the algorithm. This is precisely the distinction
worth keeping: graph storage on disk, graph computation resident.

Published perf figures on the repo, for scale calibration: PageRank "around 50ms
for a graph with 10K vertices and 120K edges, around 1 second for a graph with
100K vertices and 1.7M edges". Docs also warn "BetweennessCentrality is very
expensive for medium to large graphs".

### DuckDB and DuckPGQ

| Fact | Value | Source |
|---|---|---|
| DuckPGQ algorithms | "Local Clustering Coefficient, Weakly Connected Component, PageRank" | [duckpgq.org/documentation/graph_functions](https://duckpgq.org/documentation/graph_functions/) |
| SCC | Not listed | same |
| `USING KEY` | "Starting with version 1.3, DuckDB features a USING KEY variant of recursive CTEs." | [duckdb.org/2025/05/23/using-key](https://duckdb.org/2025/05/23/using-key) |

`USING KEY` replaces append-only recursive CTE accumulation with key-addressed
overwrite. Published row counts from that post: Graph A 744 rows under `USING KEY`
versus 352,906 for a plain recursive CTE; Graph C (424 nodes, 1,446 edges) 19,213
rows versus 605,859,791. The post notes plain CTEs reach "out-of-memory
conditions" on larger graphs while `USING KEY` "continues to scale smoothly", and
makes **no** claim of larger-than-memory traversal. Academic writeup:
[db.cs.uni-tuebingen.de/publications/2025/using-key](https://db.cs.uni-tuebingen.de/publications/2025/using-key/),
SIGMOD [dl.acm.org/doi/10.1145/3722212.3725107](https://dl.acm.org/doi/10.1145/3722212.3725107).

### Postgres and the rest

| System | SCC | Out-of-core | Note |
|---|---|---|---|
| pgRouting | `pgr_strongComponents` exists as a documented function | Unclear | [docs.pgrouting.org/latest/en/pgr_strongComponents.html](https://docs.pgrouting.org/latest/en/pgr_strongComponents.html) returned HTTP 403 to this session, so the page text was **not** retrieved. Function name confirmed only by URL existence. Not embedded regardless. |
| Apache AGE | Not confirmed | Not confirmed | No retrieved source; not embedded. |
| Oxigraph, TerminusDB, SurrealDB | Nothing found | Nothing found | A combined query for these three plus SCC returned only textbook SCC tutorials and vendor landing pages, with zero algorithm-list hits. Record as no evidence found. |

---

## 4. N+1 mitigations

Documented prior art here is thin.

**Adjacency cache in front of SQLite.** The only implementation found is
[`sqlitegraph::cache`](https://docs.rs/sqlitegraph/latest/sqlitegraph/cache/index.html)
(v3.9.0, GPL-3.0-only). Verbatim from the module docs:

- Purpose: "a bounded, thread-safe cache of adjacency lists used by `SqliteGraph` to avoid re-querying SQLite for neighbor sets that were recently read."
- Storage: values held as `Arc<Vec<i64>>`. "A cache _hit_ hands the caller a cheaply-cloned `Arc` ... it never copies the `Vec<i64>`."
- Eviction: insertion-order FIFO, deliberately. "The hit path uses `peek` (a shared read lock) rather than `get` (an exclusive write lock that would refresh access recency)."
- Honesty note in their own docs: "An earlier revision of this module documented an 'LRU-K (K=2)' policy with 'traversal-score tracking' and 'high-degree pinning'. That policy was never implemented."
- Published numbers, dated 2026-06-19: cache hit at degree 10, ~17.6 ns -> ~15 ns. Cache hit at degree 1000, ~131 ns -> ~13 ns.
- Public items: `AdjacencyCache`, `CacheStats`, `DEFAULT_CACHE_CAPACITY`.

Those numbers measure cache-hit cost only. There is **no** published miss-path or
SQL-query cost, and no comparison against a resident build.

**Batched frontier fetch.** No graph-library implementation found. The pattern is
documented in the ORM world under a different name: "Fixing N+1 Queries Using
Breadth-First Selection", which describes "two passes through the graph: one to
fetch the data (in batches) and another to use [it]"
([medium.com/@harrykao](https://medium.com/@harrykao/fixing-n-1-queries-using-breadth-first-selection-7180a0055098)).
The applicative-batching lineage (Haxl, DataLoader) is the same idea.

**Prefetch by BFS level.** The algorithmic half is standard and well described as
level-synchronous BFS, where "Every node at level k is processed before any node
at level k + 1"
([abstractalgorithms.dev/bfs-breadth-first-search](https://www.abstractalgorithms.dev/bfs-breadth-first-search),
[emergentmind.com/topics/level-synchronous-bfs](https://www.emergentmind.com/topics/level-synchronous-bfs)).
One database-backed instance found: FoundationDB-based "GraphTraverser API for
efficient breadth-first search (BFS) traversal, neighbor queries, and multi-hop
graph exploration using FoundationDB range scans"
([deepwiki.com/1amageek/database-framework](https://deepwiki.com/1amageek/database-framework/9.1-graph-traversal)).

Structural note that follows from the trait listing in section 1: `neighbors()`
takes one `NodeId` and returns one iterator, so level-batched prefetch cannot be
expressed through the trait. It has to be an internal cache that the impl
populates. Petgraph's Kosaraju is DFS-driven in both phases, which defeats
level-batching entirely; the BFS-coloring SCC variant that Kuzu ships is the one
that batches naturally. That is a design reason to prefer BFS-coloring SCC over
Kosaraju when the edges are not resident.

**Crossover measurement.** None found. No source anywhere in this search measured
the point at which per-node SQL beats a full in-memory build, in either direction.

---

## 5. Partition-per-repository, and whether SCC survives it

The literature is unambiguous that SCC is studied as a distributed/partitioned
problem, and equally unambiguous that partitions are not independent.

| Source | Content |
|---|---|
| [scholarsmine.mst.edu/comsci_facwork/1389](https://scholarsmine.mst.edu/comsci_facwork/1389/) (IEEE IPDPS 2023, "A Distributed Algorithm for Identifying Strongly Connected Components on Incremental Graphs") | "Given that many real-world networks are extremely large, it is often necessary to partition the network over many distributed systems and solve a complex graph problem". Two-phase asynchronous algorithm. |
| [cs.uoregon.edu/Reports/DRP-202106-Srinivasan.pdf](https://www.cs.uoregon.edu/Reports/DRP-202106-Srinivasan.pdf) | Same author line, "Identifying Strongly Connected Components on Distributed Networks". PDF text was **not** retrievable by this session (binary PDF, no local renderer). |
| [ieeexplore.ieee.org/abstract/document/10633389](https://ieeexplore.ieee.org/abstract/document/10633389) | "How to Fit the SCC Algorithm Efficiently into Distributed Graph [Systems]": "reviews the sequential, parallel and distributed implementations of strongly connected component algorithms, and analyzes the challenges of each implementation". Abstract only; paywalled. |
| [arxiv.org/abs/1910.05971](https://arxiv.org/abs/1910.05971) (FastSV) | Distributed-memory **connected components** (undirected), simplifying Shiloach-Vishkin. Not SCC. |
| [dl.acm.org/doi/10.1145/3694906.3743350](https://dl.acm.org/doi/10.1145/3694906.3743350) | "A Deterministic Work-Depth Tradeoff for Strongly Connected Components", parallel SCC "beyond the full transitive closure computation". Shared memory. |

The existence of a whole distributed-SCC literature is itself the finding: if
per-partition SCC composed trivially, these papers would not exist. A direct
query phrased as "strongly connected components cannot be computed per partition
cross-partition cycle merge distributed" returned **zero results**, so no source
was found that states the non-decomposability in those words.

Practical shape that the sources do support, for a 500-repository corpus:

1. Cross-repository edges are a small, enumerable set (imports and calls that cross a repo boundary).
2. Run SCC per repository resident (261,704 edges at ~3 MB is trivially resident).
3. Build the quotient graph: one node per per-repo SCC, plus the cross-repo edges lifted onto it.
4. Run SCC on the quotient graph, then merge.

That is a two-level SCC, and it is exactly correct: contracting each per-repo SCC
never changes the global SCC partition, because contraction preserves mutual
reachability. The quotient graph is bounded by (number of per-repo SCCs) +
(cross-repo edge count), both far below 130M. **No published source stating this
recipe for repository-partitioned code graphs was found**; the correctness
argument is standard graph theory, flagged here as reasoning rather than
retrieved prior art, per the brief.

---

## Candidate table

| Name | Language | Embeddable in Rust | License | Ships SCC | Genuinely out-of-core |
|---|---|---|---|---|---|
| LadybugDB (`lbug` 0.18.2) | C++ core, Rust bindings | Yes, `cargo add lbug` | MIT | Yes (`scc`, `scc_ko`) | Yes, documented |
| Kuzu 0.11.3 (`kuzu` crate) | C++ core, Rust bindings | Yes, needs `-rdynamic` | MIT | Yes | Yes, documented. Repo archived 2025-10-10 |
| CozoDB 0.7.6 | Rust | Yes | MPL-2.0+ | Yes (`SCC`) | No, builds full `DirectedCsrGraph` in RAM |
| petgraph | Rust | Yes | MIT/Apache-2.0 | Yes (`kosaraju_scc`, `tarjan_scc`) | No, and O(V) resident even with disk edges |
| webgraph-rs + webgraph-algo | Rust | Yes | Apache-2.0 / LGPL-2.1 | Not found | Yes for storage (mmap'd compressed CSR); algorithms limited |
| sqlitegraph 3.9.0 | Rust | Yes | GPL-3.0-only | Partial, only in a temporal module | Partial, bounded LRU adjacency cache over SQLite |
| oxgraph | Rust | Yes | MIT | No | Claims mmap; pre-1.0, 1 star |
| graphqlite | C (+Rust binding) | Via extension | MIT | No | Unclear |
| DuckPGQ | C++ | Via DuckDB | MIT | No | Unclear |
| pgRouting | C++/SQL | No, Postgres server | GPL-2.0+ | Yes (`pgr_strongComponents`, name only) | Unclear, page 403'd |
| FlashGraph | C++ | No | Apache-2.0 | Not confirmed from abstract | Yes, semi-external (vertex state RAM, edges SSD) |
| GraphChi / X-Stream / GridGraph | C++/Java | No | various | Not confirmed | Yes, research artifacts |
| Oxigraph / TerminusDB / SurrealDB | Rust / Prolog / Rust | Varies | varies | No evidence found | No evidence found |

---

## Search query log

`WebSearch` was unavailable for this session: the first four calls returned
"this session has used its web search budget (200 of 200 WebSearch calls)". All
searching below ran through DuckDuckGo HTML/lite endpoints via WebFetch.

| # | Query (verbatim) | Engine | Produced anything? |
|---|---|---|---|
| 1 | `petgraph implement IntoNeighbors trait SQLite disk-backed graph` | WebSearch | No, budget exhausted |
| 2 | `petgraph visit traits custom graph implementation out-of-core` | WebSearch | No, budget exhausted |
| 3 | `Rust mmap CSR graph memmap2 out-of-core graph algorithms crate` | WebSearch | No, budget exhausted |
| 4 | `kuzudb strongly connected components algorithm list documentation` | WebSearch | No, budget exhausted |
| 5 | `petgraph IntoNeighbors sqlite disk-backed graph` | DDG html | Yes, surfaced graphqlite; no petgraph-over-disk impl |
| 6 | `petgraph traits on disk backed graph rocksdb sled redb` | DDG html | Yes but only generic petgraph/redb/rocksdb landing pages |
| 7 | `rust out-of-core graph mmap webgraph crate` | DDG html | Yes, oxgraph + webgraph-rs + WebGraph paper |
| 8 | `kuzu graph database algo extension strongly connected components rust crate` | DDG html | Yes, kuzudb.github.io docs + kuzu crate |
| 9 | `kuzu archived 2025 successor ladybugdb lbug fork` | DDG html | Yes, LadybugDB fork confirmed |
| 10 | `distributed partitioned strongly connected components external memory algorithm paper` | DDG html | Yes, distributed-SCC literature |
| 11 | `duckpgq duckdb graph extension strongly connected components out of core` | DDG html | Yes, DuckPGQ docs (no SCC) |
| 12 | `"petgraph" lmdb OR sqlite OR rocksdb backed graph traits implementation reddit rust` | DDG html | **Empty. Zero results.** |
| 13 | `users.rust-lang.org graph too large for memory petgraph alternative disk` | DDG html | Yes but no on-point thread; surfaced graph-api |
| 14 | `GraphChi X-Stream FlashGraph out-of-core graph processing SSD library usable` | DDG html | Yes, research systems |
| 15 | `webgraph-rs petgraph trait impl IntoNeighbors RandomAccessGraph` | DDG html | No adapter found; only petgraph doc mirrors |
| 16 | `pgrouting OR "apache age" strongly connected components function postgres` | DDG html | **Blocked by CAPTCHA, no results** |
| 17 | `duckdb 1.5.0 "USING KEY" recursive cte graph larger than memory` | DDG html | **Blocked by CAPTCHA, no results** |
| 18 | `oxigraph surrealdb terminusdb graph algorithms strongly connected components` | DDG lite | Yes but **zero on-point hits**, only SCC tutorials and vendor homepages |
| 19 | `batched neighbor fetch BFS level synchronous prefetch database graph traversal N+1` | DDG lite | Yes, ORM-side N+1 article + level-synchronous BFS |
| 20 | `"semi-external memory" graph algorithm vertex state in RAM edges on disk SCC` | DDG lite | Yes, FlashGraph and the external-memory survey |
| 21 | `duckdb "USING KEY" recursive CTE blog graph` | DDG lite | Yes, DuckDB blog + SIGMOD paper |
| 22 | `kuzu "does not materialize" projected graph memory scanned from disk` | DDG lite | Yes, quote confirmed from 3 sources |
| 23 | `ladybugdb docs algo extension strongly connected components lbug rust crate` | DDG lite | Yes, Ladybug docs + lbug crate |
| 24 | `"strongly connected components" cannot be computed per partition cross-partition cycle merge distributed` | DDG lite | **Empty. Zero results.** |
| 25 | `rust crate sqlite backed graph traversal cache adjacency LRU neighbors batch query` | DDG lite | Yes, sqlitegraph adjacency cache |
| 26 | `sqlitegraph rust petgraph IntoNeighbors impl adjacency cache github oldnordic` | DDG lite | Yes but no petgraph trait impl |
| 27 | `reddit rust "petgraph" graph bigger than RAM disk backed traversal` | DDG lite | **Blocked by CAPTCHA, no results** |
| 28 | `rkyv zero copy graph CSR mmap rust load without deserialization` | DDG lite | Yes, rkyv + cloudflare/mmap-sync |

Pages fetched directly (not via search): petgraph `IntoNeighbors` docs,
petgraph `kosaraju_scc` source, cozo SCC source, kuzu repo + algo docs + scc docs
+ 0.10.0 blog, ladybug repo + algo docs, `kuzu` and `lbug` and `sqlitegraph`
crate docs, webgraph-rs `traits/graph.rs`, DuckDB `USING KEY` post, oxgraph repo,
graphqlite repo, graph-api implementations page, FlashGraph arXiv abstract.

Fetches that failed: `docs.kuzudb.com` and `docs.cozodb.com` (DNS, wrong hostnames;
correct ones are `kuzudb.github.io/docs` and `docs.cozodb.org`),
`kuzudb.github.io/docs/extensions/algo/project-graph/` (404),
`docs.pgrouting.org` (403), `hal.science` WebGraph paper (Anubis block),
`par.nsf.gov` (connection refused), `duckdb.org/docs/.../with` (redirect stub),
FlashGraph FAST'15 USENIX PDF (403), and both retrieved PDFs (no local
`pdftoppm`, so the FlashGraph and Oregon PDFs were not read).

---

## What I could not find

1. **Any** implementation of petgraph's visit traits over a disk store. Not on GitHub, crates.io, r/rust, or users.rust-lang.org, across queries 5, 6, 12, 13, 15, 26, 27.
2. A published `RandomAccessGraph` -> `IntoNeighbors` adapter between webgraph-rs and petgraph, despite the trait shapes matching almost exactly.
3. Any measurement of the crossover point where per-node SQL neighbor fetch beats a full in-memory graph build. Nobody appears to have published this in either direction.
4. Miss-path cost for `sqlitegraph`'s adjacency cache. Only hit-path nanoseconds are published.
5. SCC in `webgraph-algo`. It may exist in the crate; the repo landing page highlights only HyperBall, and the crate's algorithm index was not retrieved.
6. A published SCC timing for Kuzu / LadybugDB. The 0.10.0 benchmark table covers WCC, PageRank, K-Core, and Louvain only.
7. Whether Kuzu's SCC keeps O(V) frontier state resident. The docs say the *graph* is not materialized; they say nothing about per-vertex algorithm state, which for 150M nodes is the number that decides feasibility on a 16 GB machine.
8. Any source describing repository-partitioned SCC with quotient-graph merging for code graphs specifically.
9. Confirmation of SCC support in Apache AGE, Oxigraph, TerminusDB, or SurrealDB, in either direction.
10. pgRouting's `pgr_strongComponents` documentation text. The URL exists; the page returned 403.

## Citations

- petgraph `IntoNeighbors`: https://docs.rs/petgraph/latest/petgraph/visit/trait.IntoNeighbors.html
- petgraph `kosaraju_scc` source: https://docs.rs/petgraph/latest/src/petgraph/algo/scc/kosaraju_scc.rs.html
- Kuzu repo (archived, MIT): https://github.com/kuzudb/kuzu
- Kuzu algo extension docs: https://kuzudb.github.io/docs/extensions/algo/
- Kuzu SCC docs: https://kuzudb.github.io/docs/extensions/algo/scc/
- Kuzu 0.10.0 release post (disk-based algorithms claim + benchmarks): https://kuzudb.github.io/blog/post/kuzu-0.10.0-release/
- Kuzu Rust crate: https://docs.rs/kuzu/latest/kuzu/
- LadybugDB repo: https://github.com/LadybugDB/ladybug
- LadybugDB algo docs: https://docs.ladybugdb.com/extensions/algo/
- LadybugDB SCC docs: https://docs.ladybugdb.com/extensions/algo/scc/
- `lbug` crate: https://docs.rs/lbug/latest/lbug/
- LadybugDB fork announcement: https://blog.ladybugdb.com/post/ladybug-spreading-its-wings/
- Kuzu archival / Apple acquisition: https://github.com/jeromeetienne/codespine/issues/232 and https://dbdb.io/db/ladybugdb/revisions/3
- CozoDB repo: https://github.com/cozodb/cozo
- CozoDB algorithms: https://docs.cozodb.org/en/latest/algorithms.html
- CozoDB SCC source: https://raw.githubusercontent.com/cozodb/cozo/main/cozo-core/src/fixed_rule/algos/strongly_connected_components.rs
- DuckPGQ graph functions: https://duckpgq.org/documentation/graph_functions/
- DuckDB `USING KEY`: https://duckdb.org/2025/05/23/using-key
- `USING KEY` SIGMOD paper: https://dl.acm.org/doi/10.1145/3722212.3725107
- webgraph-rs: https://github.com/vigna/webgraph-rs
- webgraph crate docs: https://docs.rs/webgraph/latest/webgraph/
- webgraph traits source: https://raw.githubusercontent.com/vigna/webgraph-rs/main/webgraph/src/traits/graph.rs
- WebGraph-in-Rust paper (not retrieved, 403): https://hal.science/hal-04494627v1/document
- oxgraph: https://github.com/oxgraph/oxgraph
- oxgraph-mmap: https://lib.rs/crates/oxgraph-mmap
- graphqlite: https://github.com/colliery-io/graphqlite
- graph-api implementations: https://bryncooke.github.io/graph-api/reference/implementations.html
- sqlitegraph crate: https://docs.rs/sqlitegraph/latest/sqlitegraph/
- sqlitegraph adjacency cache: https://docs.rs/sqlitegraph/latest/sqlitegraph/cache/index.html
- sqlitegraph repo: https://github.com/oldnordic/sqlitegraph
- FlashGraph (arXiv abstract): https://arxiv.org/abs/1408.0500
- FlashGraph FAST'15 (403 to this session): https://www.usenix.org/system/files/conference/fast15/fast15-paper-zheng.pdf
- FlashGraph code: https://github.com/leochencipher/FlashGraph
- GraphChi: https://github.com/GraphChi/ and https://dl.acm.org/doi/10.5555/2387880.2387884
- GridGraph ATC'15: https://pacman.cs.tsinghua.edu.cn/~zxw/data/publications/gridgraph_atc15.pdf
- ACGraph survey: https://arxiv.org/html/2511.07886v1
- External-memory graph survey: https://link.springer.com/article/10.1007/s11227-019-03023-0
- Distributed SCC on incremental graphs: https://scholarsmine.mst.edu/comsci_facwork/1389/
- SCC in distributed graph systems review: https://ieeexplore.ieee.org/abstract/document/10633389
- FastSV (connected components, undirected): https://arxiv.org/abs/1910.05971
- Deterministic work-depth SCC: https://dl.acm.org/doi/10.1145/3694906.3743350
- N+1 via breadth-first selection: https://medium.com/@harrykao/fixing-n-1-queries-using-breadth-first-selection-7180a0055098
- Level-synchronous BFS: https://www.emergentmind.com/topics/level-synchronous-bfs
- FoundationDB range-scan BFS traversal: https://deepwiki.com/1amageek/database-framework/9.1-graph-traversal
- rkyv architecture (mmap without deserialization): https://david.kolo.ski/blog/rkyv-architecture/
- cloudflare/mmap-sync: https://github.com/cloudflare/mmap-sync
- pgRouting strongComponents (403 to this session): https://docs.pgrouting.org/latest/en/pgr_strongComponents.html
