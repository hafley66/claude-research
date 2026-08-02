---
description: Prior-art survey for strongly-connected-component decomposition and reachable-pair counting implemented in SQL or SQL-plus-driver-loop. Retrieved sources only, with the empty searches recorded.
argument-hint: "[scc | counting | surveys | verdict]"
---

# SCC and reachable-pair counting in SQL: prior art

Research date: 2026-07-19/20. Every claim below has a URL or a quoted listing that was
actually retrieved. Searches that came back empty are recorded in the query table.

## Verdict

| Question | Answer |
| --- | --- |
| SCC in *pure set-oriented SQL* (recursive CTE, no host loop) | **No published implementation found.** Zero hits across Stack Overflow, dba.stackexchange, GitHub repo search, DuckDB/DuckPGQ docs, and the recursive-CTE research literature. |
| SCC in *SQL-hosted procedural code* (PL/pgSQL) | **Yes, one.** A single public gist: Tarjan ported to PL/pgSQL with array-backed explicit stacks. Imperative, single-threaded, array-indexed; no set-oriented SQL in the algorithm body. |
| SCC exposed by an *engine extension* over a relational store | **Yes, two.** `pgr_strongComponents` (pgRouting, Boost C++) and `graphqlite`'s `scc()` (SQLite extension, Tarjan in C over a CSR graph). Both are C/C++ inside the engine, invoked from SQL. |
| SCC in a *datalog engine* as a user-level relation | **No.** Soufflé and RecStep both compute SCC on the *rule/precedence* graph, in the host language, at compile/planning time. Neither exposes SCC over user data. |
| Forward-backward (Fleischer-Hendrickson-Pinar) on a relational engine | **No implementation found.** FW-BW literature is all MPI / shared-memory / GPU. No SQL, no RDBMS paper. |
| Reachable-pair counting without materializing the closure | **Theory yes, SQL no.** Cohen's size-estimation framework (JCSS 1997) and HyperANF (2011) are the canonical estimators; neither has a published SQL implementation, and no SQL engine ships a closure-cardinality operator. |

So: the forward-backward-in-SQL approach is **rare, not well-trodden**. The closest published
things are (a) Tarjan-in-PL/pgSQL, which is a procedural port rather than a relational
decomposition, and (b) *weakly* connected components in SQL, which is everywhere and is a
different problem.

---

## 1. SCC in SQL

### 1.1 Stack Overflow / dba.stackexchange

Searched via the Stack Exchange API (`/2.3/search`, `intitle=`, sorted by votes) because
WebFetch is blocked on `stackoverflow.com`.

`site=stackoverflow`, `intitle=strongly connected`, 20 results by votes: every result is
tagged `algorithm`, `graph-theory`, `c++`, `python`, `scala`, or `tarjans-algorithm`.
**Zero results carry a `sql`, `postgresql`, `sql-server`, `oracle`, or `sqlite` tag.**
Top of that list:

| Score | Q | Tags |
| --- | --- | --- |
| 26 | What are strongly connected components used for? | algorithm, computer-science, graph-theory |
| 21 | How to find Strongly Connected Components in a Graph? (33590974) | algorithm, graph-theory, strongly-connected-graph |
| 19 | Functional implementation of Tarjan's SCC algorithm | scala, clojure, functional-programming |
| 15 | Tarjan's SCC algorithm in python not working | python, algorithm |

`site=dba.stackexchange`, `intitle=strongly connected`: **0 results.**
`site=dba.stackexchange`, `intitle=connected components`: **0 results.**

What *does* exist under `sql` tags is **undirected / weakly** connected components:

- [Group All Related Records in Many to Many Relationship, SQL graph connected components](https://stackoverflow.com/questions/18618999/) (22 votes, `sql-server-2012`). Two competing answers, both quoted below.
- [A number of connected components of a graph in SQL](https://stackoverflow.com/questions/33465859/) (`postgresql`, `recursive-query`).
- [Recursive query used for transitive closure](https://stackoverflow.com/questions/20979831/) (`postgresql`, `transitive-closure-table`): reachability only.

Answer 18663943 (score 13) on 18618999: min-label propagation with a **host-side `while`
loop in T-SQL**, which is structurally the same shape as a driver loop:

```sql
declare @i int

with cte as (
     select
         GroupID,
         row_number() over(order by Company) as rn
     from Table1
)
update cte set GroupID = rn

select @i = @@rowcount

-- while some rows updated
while @i > 0
begin
    update T1 set
        GroupID = T2.GroupID
    from Table1 as T1
        inner join (
            select T2.Company, min(T2.GroupID) as GroupID
            from Table1 as T2
            group by T2.Company
        ) as T2 on T2.Company = T1.Company
    where T1.GroupID > T2.GroupID

    select @i = @@rowcount

    update T1 set
        GroupID = T2.GroupID
    from Table1 as T1
        inner join (
            select T2.Publisher, min(T2.GroupID) as GroupID
            from Table1 as T2
            group by T2.Publisher
        ) as T2 on T2.Publisher = T1.Publisher
    where T1.GroupID > T2.GroupID

    -- will be > 0 if any rows updated
    select @i = @i + @@rowcount
end
```

Answer 18674962 (score 7, Gordon Linoff): single recursive CTE, all-pairs path
materialization plus `min(node2)` as the component label. This is the quadratic-memory
shape:

```sql
with edges as (
      select t1.company as node1, t2.company as node2
      from table1 t1 join
           table1 t2
           on t1.publisher = t2.publisher
     ),
     cte as (
      select e.node1, e.node2,
             cast('|'+e.node1+'|'+e.node2+'|' as varchar(max)) as nodes,
             1 as level
      from edges e
      union all
      select c.node1, e.node2,
             c.nodes+e.node2+'|',
             1+c.level
      from cte c join
           edges e
           on c.node2 = e.node1 and
              c.nodes not like '|%'+e.node2+'%|'
     ),
     nodes as (
       select node1,
              (case when min(node2) < node1 then min(node2) else node1 end
              ) as grp
       from cte
       group by node1
      )
select t.company, t.publisher, grp.GroupId
from table1 t join
     (select n.node1, dense_rank() over (order by grp) as GroupId
      from nodes n
     ) grp
     on t.company = grp.node1
```

Answer 59301499 on 33465859 is a PL/pgSQL min-color propagation loop, with a measured
comparison the sprefa numbers can be read against:

> "tested it on graph with 2.4 mln nodes and 24 mln edges and it takes about 30-60 minutes
> with indices. (In comparison, in C++ takes 2.5 minutes where most of the time it reads
> data from csv / writes data to csv)"

All of the above is **undirected**. None of it is SCC.

### 1.2 The one real SQL-hosted SCC: Tarjan in PL/pgSQL

[gist.github.com/joelonsql/572d7dc5bcded8300453f2d0e5a91c96](https://gist.github.com/joelonsql/572d7dc5bcded8300453f2d0e5a91c96), `tarjan.sql`.
Retrieved in full. It is Tarjan with the recursion manually flattened into an array-backed
`call_stack`, taking CSR-style input (`int4range[]` offsets plus an `int[]` target array):

```sql
CREATE OR REPLACE FUNCTION tarjan(from_nodes int4range[], to_nodes int[])
RETURNS SETOF int[]
LANGUAGE plpgsql
AS
$$
--
-- https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm
--
DECLARE
current_index integer := 0;
index int[];
lowlink int[];
on_stack bool[];
stack int[] := ARRAY[]::int[];
call_stack int[] := ARRAY[]::int[];
edge int;
node int;
next_node int;
next_edge int;
scc int[];
BEGIN
FOR node IN 1..cardinality(from_nodes)
LOOP
  IF index[node] IS NULL THEN
    call_stack := call_stack || node || NULL::int;
    <<recurse>>
    LOOP
      node := call_stack[cardinality(call_stack)-1];
      next_edge := call_stack[cardinality(call_stack)];
      call_stack := call_stack[:cardinality(call_stack)-2];
      IF next_edge IS NULL THEN
        index[node] := current_index;
        lowlink[node] := current_index;
        current_index := current_index + 1;
        stack := stack || node;
        on_stack[node] := TRUE;
      END IF;
      IF NOT from_nodes[node] = 'empty' THEN
        FOR edge IN COALESCE(next_edge,lower(from_nodes[node]))..(upper(from_nodes[node])-1)
        LOOP
          next_node := to_nodes[edge];
          IF index[next_node] IS NULL THEN
            call_stack := call_stack
              || node || (edge+1)
              || next_node || NULL::int;
            CONTINUE recurse;
          ELSIF on_stack[next_node] THEN
            lowlink[node] := LEAST(lowlink[node], index[next_node]);
          END IF;
        END LOOP;
      END IF;
      IF index[node] = lowlink[node] THEN
        scc := ARRAY[]::int[];
        LOOP
          next_node := stack[cardinality(stack)];
          stack := stack[:cardinality(stack)-1];
          on_stack[next_node] := FALSE;
          scc := scc || next_node;
          IF next_node = node THEN
            EXIT;
          END IF;
        END LOOP;
        RETURN NEXT scc;
      END IF;
      IF cardinality(call_stack) = 0 THEN
        EXIT;
      ELSE
        next_node := node;
        node := call_stack[cardinality(call_stack)-1];
        lowlink[node] := LEAST(lowlink[node], lowlink[next_node]);
      END IF;
    END LOOP;
  END IF;
END LOOP;
RETURN;
END
$$;
```

Its own worked example:

```sql
SELECT tarjan(
  from_nodes := '{"[1,1]","[2,3]","[4,4]","[5,6]","[7,7]","[8,8]","[9,9]","[10,11]",empty}'::int4range[],
  to_nodes := '{2,1,5,4,3,5,6,7,8,6,9}'::int[]
);
--  tarjan
-- ---------
--  {9}
--  {8,7,6}
--  {5}
--  {2,1}
--  {4,3}
-- (5 rows)
```

Character: an in-memory pointer-chasing algorithm re-expressed in a procedural language
that happens to live in the database. It reads no tables and issues no queries. It shares
nothing with a set-oriented SQL fixpoint.

### 1.3 Engine extensions that ship SCC (C/C++, callable from SQL)

| Project | Surface | Implementation | Source |
| --- | --- | --- | --- |
| pgRouting | `pgr_strongComponents(edges_sql)` | Boost Graph Library C++ | [docs.pgrouting.org/latest/en/pgr_strongComponents.html](https://docs.pgrouting.org/latest/en/pgr_strongComponents.html) (HTTP 403 to WebFetch; surfaced repeatedly in search) |
| graphqlite (SQLite ext) | `CALL stronglyConnectedComponents() YIELD node, component` / `RETURN scc()` | C, over a cached CSR graph | [github.com/colliery-io/graphqlite](https://github.com/colliery-io/graphqlite) |

graphqlite receipts, retrieved from raw GitHub:

- `src/include/executor/graph_algorithms.h`: `GRAPH_ALGO_SCC,` and
  `graph_algo_result* execute_scc(sqlite3 *db, csr_graph *cached);`
- `docs/src/reference/algorithms.md:330` `## Strongly Connected Components`,
  line 358 `**Complexity**: O(V + E) (Tarjan or Kosaraju)`
- `bindings/rust/src/algorithms/components.rs`: `/// Finds maximal subgraphs where every
  node is reachable from every other node following edge directions. Uses Tarjan's
  algorithm.` with body `self.connection().cypher("RETURN scc()")`

This is the same shape as pgRouting: the SQL layer is a call interface, the algorithm is C.

### 1.4 Datalog engine internals

**Soufflé.** SCC exists and is central, on the *rule precedence graph*, in C++, at compile
time. File header, retrieved verbatim from
[src/ast/analysis/SCCGraph.cpp](https://raw.githubusercontent.com/souffle-lang/souffle/master/src/ast/analysis/SCCGraph.cpp):

```
 * @file SCCGraph.cpp
 *
 * Implements method of precedence graph to build the precedence graph,
 * compute strongly connected components of the precedence graph, and
 * build the strongly connected component graph.
```

The algorithm is Gabow's, with explicit `std::stack` state:

```cpp
    std::stack<const Relation*> S;
    std::stack<const Relation*> P;
    std::map<const Relation*, std::size_t> preOrder;  // Pre-order number of a node (for Gabow's Algo)
```

`SCCGraph.h` declares it as an analysis pass named `"scc-graph"`, plus
`TopologicallySortedSCCGraph.{h,cpp}` for the evaluation order. Nothing here touches user
data, and there is no user-level SCC relation.

**RecStep** (Fan et al., *Scaling-Up In-Memory Datalog Processing*, PVLDB 12(6), 2019,
[vldb.org/pvldb/vol12/p695-fan.pdf](https://www.vldb.org/pvldb/vol12/p695-fan.pdf)).
Text-extracted the full PDF: the string "SCC" appears **0 times**, "Tarjan" **0 times**,
"forward-backward" **0 times**. "strongly connected" appears exactly once, and it is the
rule graph again:

> "A stratification of P is a partition of the rules into strata, where each stratum
> contains the rules that are in the same strongly connected component of G_P. The
> topological ordering of the strongly connected components also defines an ordering in
> the strata."

Its benchmark set is "transitive closure, reachability, connected components" plus
points-to and dataflow analyses. No SCC over user data.

**DDlog / LogicBlox / BigDatalog.** Searched; found no document stating how (or whether)
they compute SCC beyond the standard rule-graph stratification, and found no user-level
SCC relation in any of them. Recorded as a gap in section 5, not as a negative claim.

### 1.5 Recursive-CTE research literature (DuckDB, Umbra, HyPer)

| Source | SCC present? | Evidence |
| --- | --- | --- |
| Bamberg, Hirn, Grust, *How DuckDB is USING KEY to Unlock Recursive Query Performance*, SIGMOD 2025 ([PDF](https://db.cs.uni-tuebingen.de/publications/2025/using-key/how-duckdb-is-using-key-to-unlock-recursive-query-performance.pdf)) | **No.** Full text extracted: "strongly connected" 0, "SCC" 0, "Tarjan" 0, "forward-backward" 0, "connected component" 0. | direct grep of extracted text |
| DuckDB blog, [USING KEY in Recursive CTEs](https://duckdb.org/2025/05/23/using-key) (2025-05-23) | **No.** Worked examples are all-pairs shortest path and distance-vector routing. | fetched page |
| Hirn & Grust, *A Fix for the Fixation on Fixpoints*, CIDR 2023 ([PDF](https://www.cidrdb.org/cidr2023/papers/p14-hirn.pdf)) | **No.** Extracted text: "strongly connected" 0, "SCC" 0, "Tarjan" 0. "transitive closure" 1, in the sentence noting that "only simple applications like the computation of transitive closures or bills of material in hierachical assemblies prevail in practice." | direct grep |
| [DuckDB graph queries guide](https://duckdb.org/docs/lts/guides/sql_features/graph_queries) | **No.** Lists PageRank, Local Clustering Coefficient, Weakly Connected Component. | fetched page |
| [DuckPGQ graph functions](https://duckpgq.org/documentation/graph_functions/) | **No.** "Local Clustering Coefficient, Weakly Connected Component, PageRank" is the complete list. | fetched page |
| DuckPGQ connectivity internals ([DeepWiki](https://deepwiki.com/cwida/duckpgq-extension/5.2-connectivity-analysis)) | **No.** "Weakly Connected Components: Identify maximal sets of vertices connected through undirected paths using Union-Find with path compression", implemented in `src/core/functions/scalar/weakly_connected_component.cpp`. | fetched page |

### 1.6 FW-BW and coloring-based SCC

The FW-BW source paper is real and retrievable, and every implementation of it that
surfaced is parallel/HPC, none relational:

- Fleischer, Hendrickson, Pinar, *On Identifying Strongly Connected Components in
  Parallel*, IPDPS Workshops 2000, LNCS 1800.
  [link.springer.com/chapter/10.1007/3-540-45591-4_68](https://link.springer.com/chapter/10.1007/3-540-45591-4_68),
  PDF at [link.springer.com/content/pdf/10.1007/3-540-45591-4_68.pdf](https://link.springer.com/content/pdf/10.1007/3-540-45591-4_68.pdf).
  Companion tech report: [osti.gov/servlets/purl/889876](https://www.osti.gov/servlets/purl/889876).
- Boost Parallel BGL `strong_components` (MPI):
  [boost.org/doc/libs/latest/libs/graph_parallel/doc/html/strong_components.html](https://www.boost.org/doc/libs/latest/libs/graph_parallel/doc/html/strong_components.html)
- McLendon, Hendrickson, Plimpton, Rauchwerger, *Finding strongly connected components in
  distributed graphs*, JPDC 65(8), 2005:
  [sciencedirect.com/science/article/pii/S0743731505000535](https://www.sciencedirect.com/science/article/pii/S0743731505000535)
- Coloring-based SCC: Orzan & van de Pol, *Detecting strongly connected components in
  large distributed state spaces* (TU/e), and the coloring/BFS hybrid in Slota, Rajamanickam,
  Madduri, *BFS and Coloring-based Parallel Algorithms for Strongly Connected Components*,
  IPDPS 2014: [cs.rpi.edu/~slotag/pub/SCC-IPDPS14.pdf](https://cs.rpi.edu/~slotag/pub/SCC-IPDPS14.pdf)
- GPU: Hong et al., *On Fast Parallel Detection of Strongly Connected Components (SCC) in
  Small-World Graphs*, SC13: [ppl.stanford.edu/papers/sc13-hong.pdf](https://ppl.stanford.edu/papers/sc13-hong.pdf)

Searches pairing FW-BW with SQL/relational terms returned only generic SQL-execution and
generic-SCC pages (see query table). **No relational-engine FW-BW implementation found.**

---

## 2. Reachable-pair counting in SQL

### 2.1 The theory exists and is old

- **Cohen, *Size-Estimation Framework with Applications to Transitive Closure and
  Reachability*, JCSS 55(3):441-453, 1997.** Abstract as surfaced in search:
  "an O(m) time randomized (Monte Carlo) algorithm that estimates, with small relative
  error, the sizes of all reachability sets and the transitive closure", with extension to
  "neighborhood sizes in directed graphs with nonnegative edge lengths".
  Author copy: `http://www.cohenwang.com/edith/Papers/tcest.pdf` (connection refused at
  fetch time, 216.92.197.193:443); mirrors at
  [core.ac.uk/download/pdf/82229441.pdf](https://core.ac.uk/download/pdf/82229441.pdf) and
  ACM DL / ScienceDirect. Earlier conference version: *Estimating the size of the
  transitive closure in linear time*, FOCS 1994,
  [ieeexplore.ieee.org/document/365694](https://ieeexplore.ieee.org/document/365694).
- **Palmer, Gibbons, Faloutsos, ANF**, and **Boldi, Rosa, Vigna, *HyperANF: Approximating
  the Neighbourhood Function of Very Large Graphs on a Budget*, WWW 2011**:
  [arxiv.org/abs/1011.5599](https://arxiv.org/abs/1011.5599), HTML at
  [ar5iv.labs.arxiv.org/html/1011.5599](https://ar5iv.labs.arxiv.org/html/1011.5599).
  Reference implementation is WebGraph (Java). Reimplementations found: GraphFrames
  (`org.graphframes.lib.HyperANF`, Scala/Spark), Ultipa (proprietary graph engine),
  [github.com/dnxjcui/hyperanf](https://github.com/dnxjcui/hyperanf).
  **None in SQL.**
- Master's thesis on the topic, TU Eindhoven: *Size-Estimation of Transitive Closure...*,
  Texeira Militao, [pure.tue.nl PDF](https://pure.tue.nl/ws/portalfiles/portal/197479311/Texeira_Militao_D.pdf)
  (PDF text extraction failed on the retrieved copy; listed for completeness, not cited
  for any claim).

### 2.2 No SQL engine ships a closure-cardinality operator

The closest thing found to a survey statement is a cardinality-estimation research note,
[samyama-ai/dbms_research topic 26](https://github.com/samyama-ai/dbms_research/blob/main/topics/26-cardinality-estimation/recursive-query-estimation.md):

> "Postgres/most SQL engines apply a **fixed magic multiplier** per recursive iteration
> (often assuming a constant fan-out), a notorious source of error."

and it names HyperANF as "the canonical scalable estimator" for neighborhood functions
while classifying general recursive-query cardinality estimation as an open problem.

Approximate distinct counting *is* everywhere in SQL as a primitive (`APPROX_COUNT_DISTINCT`
in SQL Server, `HLL`/`APPROX_COUNT_DISTINCT` in Snowflake, `HLL_COUNT.*` in BigQuery,
`postgresql-hll` / Citus, `hyperloglog` in DuckDB via `approx_count_distinct`). Composing
those primitives into an ANF/HyperANF-style iterated neighborhood counter inside SQL is
what nothing found does. See the query table for the exact phrasings tried.

### 2.3 Exact counting in SQL

The only published SQL patterns for counting reachable pairs materialize the closure first
and then `COUNT(*)`. Representative: [Transitive Closure in SQL](https://dwhoman.com/blog/sql-transitive-closure)
(SQLite, recursive CTE), which gives

```sql
WITH RECURSIVE trans_closure(source_id, dest_id) AS (
    SELECT source_id, dest_id FROM connections
    UNION ALL
    SELECT A.source_id, B.dest_id
    FROM trans_closure AS A JOIN connections AS B
    ON A.dest_id = B.source_id
)
```

and an iteration-bounded variant for cyclic input. Also the Microsoft
[sql-server-samples SQL-CLR TransitiveClosure sample](https://github.com/microsoft/sql-server-samples/blob/master/samples/features/sql-clr/TransitiveClosure/README.md),
which is CLR (C#), not SQL.

---

## 3. General graph-algorithms-in-SQL literature

| Source | What it covers | SCC? |
| --- | --- | --- |
| Jindal, Rawlani, Wu, Madden, Deshpande, Stonebraker, *Graph Analytics using the Vertica Relational Database*, [arXiv:1412.5263](https://arxiv.org/abs/1412.5263) | The canonical "run graph algorithms in SQL on a column store" paper. Implements PageRank, Single-Source Shortest Path, Connected Components (undirected HCC), Triangle Counting, Strong Overlap, Weak Ties. | **No.** SCC appears nowhere in the paper. |
| Joe Celko, *Trees and Hierarchies in SQL for Smarties* (2nd ed., Morgan Kaufmann/Elsevier, ISBN 9780123877338), [ToC](https://learning.oreilly.com/library/view/joe-celkos-trees/9780123877338/toc.xhtml) | Ch.1 "Graphs, Trees, and Hierarchies" (adjacency lists/arrays, "Finding a Path in General Graphs in SQL"), Ch.2 Adjacency List Model, plus Nested Sets, Path Enumeration, Binary Trees, proprietary extensions. | Not in the chapter list; the book is trees/hierarchies and path-finding. |
| SQL/PGQ (SQL:2023) | `GRAPH_TABLE` plus a graph *pattern matching* language. Oracle 23ai, DuckPGQ, Postgres work-in-progress. See [Oracle blog](https://blogs.oracle.com/database/property-graphs-in-oracle-database-23ai-the-sql-pgq-standard), [DuckPGQ SQL/PGQ docs](https://duckpgq.org/documentation/sql_pgq/), [EDB](https://www.enterprisedb.com/blog/representing-graphs-postgresql-sqlpgq). | **No.** The standard specifies pattern matching, not algorithms. No SCC in any SQL/PGQ surface examined. |
| DuckPGQ (Ten Wolde et al., [CIDR 2023](https://www.cidrdb.org/cidr2023/papers/p66-wolde.pdf), [PVLDB 16](https://www.vldb.org/pvldb/vol16/p4034-wolde.pdf)) | SQL/PGQ on DuckDB; algorithm surface is LCC / WCC / PageRank. | **No.** |
| Apache AGE | openCypher over Postgres. Searched the manual and DeepWiki index; the surfaced pages cover Cypher clauses and prepared statements. | **No SCC surfaced.** Recorded as not-found rather than absent. |
| pgRouting | `pgr_strongComponents`, `pgr_connectedComponents`, etc. | **Yes**, via Boost C++. |
| Closure-table pattern | The standard denormalized ancestor/descendant table. Its limit is exactly the one measured in the SO answers above: closure size is quadratic in component size, which is why min-label loops beat all-pairs CTEs on real graphs. | n/a |
| Neo4j GDS (non-SQL contrast) | Ships [Strongly Connected Components](https://www.neo4j.com/docs/graph-data-science/current/algorithms/strongly-connected-components/) as a first-class procedure. The docs cite Tarjan 1972 as history; the page does not name the implementation variant. Java, not SQL. | Yes, non-relational. |

---

## 4. Is the forward-backward-in-SQL approach novel?

**Rare.** Nothing retrieved shows FW-BW, or any set-oriented SCC decomposition, running on
a relational engine with a host driver loop. The three adjacent things that do exist:

1. **Tarjan ported into PL/pgSQL** (section 1.2): procedural, array-based, no relational
   operators in the algorithm. A different design point entirely.
2. **Min-label propagation loops in SQL for *undirected* components** (section 1.1):
   same host-loop-plus-set-update shape, wrong problem, and one datapoint at scale
   (2.4M nodes / 24M edges in 30-60 minutes in PL/pgSQL).
3. **SCC as a C/C++ extension callable from SQL** (pgRouting, graphqlite): the algorithm
   never touches the relational operators.

There is no canonical writeup to compare against. The nearest thing to a benchmark for the
269,457-node / 3.2s measurement is the PL/pgSQL min-color loop quoted above, which is
undirected and roughly three orders of magnitude slower per node.

---

## 5. What I could not find

| Gap | Status |
| --- | --- |
| Any pure recursive-CTE SCC query | Not found anywhere. Not a single Stack Overflow answer, gist, blog post, or paper. |
| FW-BW on any relational engine | Not found. All FW-BW implementations located are MPI, shared-memory, or GPU. |
| Coloring-based (Orzan) SCC in SQL | Not found. Orzan/Slota work is distributed state-space and shared-memory. |
| HyperANF or Cohen size-estimation implemented in SQL | Not found. Implementations are Java (WebGraph), Scala/Spark (GraphFrames), Python, and one proprietary engine. |
| A shipped closure-cardinality operator in any SQL engine | Not found. Engines use fixed fan-out multipliers for recursive-CTE cardinality. |
| How DDlog / LogicBlox / BigDatalog compute SCC internally | Not established. One search run; results were general DDlog docs and unrelated stratification lecture notes. Would need repo-level reading of `differential-datalog` and the BigDatalog Spark source to settle. |
| DuckDB `USING KEY` benchmark algorithm list beyond APSP/DVR | The SIGMOD PDF text extracted cleanly enough to prove SCC absence; the full benchmark table was not transcribed. |
| pgRouting `pgr_strongComponents` doc page body | HTTP 403 to WebFetch. The function's existence and Boost basis are attested by the search result title and by pgRouting's general Boost dependency, not by a fetched page body. Verify before citing details. |
| Oracle-specific SCC writeups (CONNECT BY) | Searched; results were all hierarchical-query documentation and `NOCYCLE` cycle-detection questions. No SCC. |
| Umbra-specific recursive-CTE papers | Only the Tübingen/DuckDB line (Hirn, Grust, Bamberg) was retrieved. Neumann's Umbra papers were not read for SCC content. |
| dba.stackexchange coverage | Confirmed zero questions titled "strongly connected" or "connected components". Full-body search on that site was not run. |

Method caveat: the WebSearch tool budget for the session was exhausted before this task
started (200/200 used). All searching below was done through `lite.duckduckgo.com` GET
pages via WebFetch, the Stack Exchange API, and the GitHub API via curl. `stackoverflow.com`
and `api.stackexchange.com` are blocked to WebFetch; SE content was retrieved with curl
against the API. `curl` against DuckDuckGo hits a CAPTCHA, so search fan-out was limited to
what WebFetch would serve.

---

## 6. Query table

| # | Query | Tool | Result |
| --- | --- | --- | --- |
| 1 | `strongly connected components SQL recursive CTE implementation` | WebSearch | Budget exhausted, not run |
| 2 | `"strongly connected components" "recursive CTE" postgres stackoverflow` | WebSearch | Budget exhausted, not run |
| 3 | `"strongly connected components" SQL recursive CTE` | DDG html | **No results found** (literal DDG zero-result page) |
| 4 | `"strongly connected components" "recursive CTE" SQL` | Bing | Junk: dictionary entries for "strongly" |
| 5 | `strongly connected components in SQL recursive query` | DDG lite | 10 generic recursive-CTE tutorials, no SCC |
| 6 | `"strongly connected components" SQL recursive CTE` | DDG lite | 1 result, SO 33590974, no SQL in it |
| 7 | `strongly connected components stackoverflow SQL query` | DDG lite | SO 40204509, SO 33465859 (both undirected), CAST KB, pgRouting, GeeksforGeeks |
| 8 | `forward backward algorithm strongly connected components Fleischer Hendrickson Pinar` | DDG lite | Hit: Springer LNCS chapter, OSTI report, Boost Parallel BGL, JPDC. All HPC |
| 9 | `Souffle datalog strongly connected component SCC precedence graph compiler` | DDG lite | Soufflé docs/GitHub; led to source read |
| 10 | `Souffle datalog SCC graph stratification RAM C++ implementation precedence graph source code` | DDG lite | Same Soufflé pages |
| 11 | `DuckDB USING KEY recursive CTE graph algorithms strongly connected components` | DDG lite | DuckDB blog, SIGMOD PDF, Max Halford post, DuckDB graph guide. **No SCC in any** |
| 12 | `duckpgq extension strongly connected components algorithm support` | DDG lite | DuckPGQ docs + DeepWiki. WCC only |
| 13 | `Apache AGE strongly connected components cypher postgres` | DDG lite | Generic AGE Cypher docs, **no SCC page** |
| 14 | `SQL/PGQ SQL:2023 property graph query strongly connected components algorithms` | DDG lite | Oracle/PGQL/DuckPGQ pattern-matching docs. No algorithms |
| 15 | `HyperANF neighborhood function HyperLogLog SQL implementation reachable pairs` | DDG lite | HyperANF paper + Java/Scala/Python impls. **No SQL** |
| 16 | `RecStep parallel datalog RDBMS recursive evaluation SCC semi-naive paper` | DDG lite | PVLDB 12 p695 (RecStep); grepped, SCC only on rule graph |
| 17 | `"graph algorithms" in SQL recursive queries paper survey Grust tutorial` | DDG lite | 4 junk results (Rust crate "grust", GeeksforGeeks) |
| 18 | `counting reachable pairs transitive closure size estimation SQL database` | DDG lite | Hit: Cohen tcest.pdf, IEEE FOCS'94, TU/e thesis, dwhoman blog |
| 19 | `HyperLogLog approximate distinct count reachability neighborhood function relational database SQL` | DDG lite | Only vendor `APPROX_COUNT_DISTINCT` docs. No reachability |
| 20 | `Edith Cohen size-estimation framework transitive closure reachability JCSS 1997 abstract` | DDG lite | Paper located, abstract quoted |
| 21 | `Orzan coloring algorithm strongly connected components distributed thesis` | DDG lite | TU/e + VU theses, RPI IPDPS'14. All parallel, none SQL |
| 22 | `Oracle CONNECT BY find cycles strongly connected components SQL blog` | DDG lite | Hierarchical-query docs + NOCYCLE questions. **No SCC** |
| 23 | `"forward-backward" SCC algorithm implemented in SQL database relational` | DDG lite | CAPTCHA on first attempt |
| 24 | `implement forward backward SCC algorithm with SQL queries driver loop` | DDG lite | Generic SCC tutorials + unrelated SQL query-plan pages. **No relational FW-BW** |
| 25 | `Graph analytics using vertica relational database SQL strongly connected components paper` | DDG lite | arXiv:1412.5263 located |
| 26 | `Neo4j GDS gds.scc strongly connected components algorithm implementation language` | DDG lite | GDS SCC docs (non-SQL) |
| 27 | `plpgsql Tarjan strongly connected components postgres function github` | DDG lite | **The single best hit of the whole survey**: joelonsql tarjan.sql gist |
| 28 | `Umbra HyPer recursive CTE evaluation paper graph algorithms worklist Hirn Grust` | DDG lite | CIDR 2023 "A Fix for the Fixation on Fixpoints"; grepped, no SCC |
| 29 | `SQL/PGQ SQL:2023 does not include graph algorithms only pattern matching limitations` | DDG lite | Pattern-matching-only confirmation via Oracle/DuckPGQ docs |
| 30 | `Celko Trees Hierarchies SQL Smarties table of contents graphs chapter` | DDG lite | O'Reilly ToC retrieved |
| 31 | `count number of reachable pairs in graph SQL query without materializing transitive closure` | DDG lite | Generic reachability pages only. **Nothing on non-materializing counting** |
| 32 | `DDlog differential datalog SCC stratification recursive relations implementation` | DDG lite | DDlog repo/tutorial + unrelated stratification notes. **No SCC detail** |
| 33 | SE API `q=strongly connected components SQL`, site=stackoverflow | curl | Irrelevance (Cloud Run, SSIS). Relevance ranking failed |
| 34 | SE API `q=strongly connected components recursive CTE` | curl | **0 results** |
| 35 | SE API `q=transitive closure count SQL` | curl | 2 unrelated hierarchy questions |
| 36 | SE API `intitle=strongly connected`, site=stackoverflow | curl | 20 results, **0 with a SQL-family tag** |
| 37 | SE API `intitle=connected components`, site=stackoverflow | curl | 20 results; 1 SQL-tagged (18618999), undirected |
| 38 | SE API `intitle=transitive closure`, site=stackoverflow | curl | 20 results; SQL-tagged ones are closure tables / reachability |
| 39 | SE API `intitle=strongly connected`, site=dba.stackexchange | curl | **0 results** |
| 40 | SE API `intitle=connected components`, site=dba.stackexchange | curl | **0 results** |
| 41 | SE API `intitle=transitive closure`, site=dba.stackexchange | curl | 1 result, about Oracle predicate transitivity in the optimizer |
| 42 | GitHub repo search `strongly+connected+components+sql` | curl | `total_count: 1`, and that one is an unrelated W3C report dump |
| 43 | GitHub repo search `scc+sql+recursive+cte` | curl | `total_count: 0` |
| 44 | GitHub repo search `graph+algorithms+in+sql` | curl | `total_count: 23`; only graphqlite is relevant (C, in a SQLite extension) |
| 45 | GitHub tree scan `souffle-lang/souffle` for `SCC`/`Topolog` | curl | 4 files: `src/ast/analysis/SCCGraph.{cpp,h}`, `TopologicallySortedSCCGraph.{cpp,h}` |
| 46 | GitHub tree scan `colliery-io/graphqlite` for `scc`/`connected`/`algorithm` | curl | 26 files; SCC confirmed in C + Rust/Python bindings |

---

## 7. Citations

**SCC algorithms**
- Fleischer, Hendrickson, Pinar. *On Identifying Strongly Connected Components in Parallel.* IPDPS Workshops 2000, LNCS 1800, pp. 505-511. https://link.springer.com/chapter/10.1007/3-540-45591-4_68 · PDF https://link.springer.com/content/pdf/10.1007/3-540-45591-4_68.pdf · report https://www.osti.gov/servlets/purl/889876
- McLendon, Hendrickson, Plimpton, Rauchwerger. *Finding strongly connected components in distributed graphs.* JPDC 65(8), 2005. https://www.sciencedirect.com/science/article/pii/S0743731505000535
- Slota, Rajamanickam, Madduri. *BFS and Coloring-based Parallel Algorithms for Strongly Connected Components.* IPDPS 2014. https://cs.rpi.edu/~slotag/pub/SCC-IPDPS14.pdf
- Hong, Rodia, Olukotun. *On Fast Parallel Detection of Strongly Connected Components (SCC) in Small-World Graphs.* SC13. https://ppl.stanford.edu/papers/sc13-hong.pdf
- Boost Parallel BGL `strong_components`. https://www.boost.org/doc/libs/latest/libs/graph_parallel/doc/html/strong_components.html

**SCC in or near SQL**
- joelonsql. *Tarjan's strongly connected components algorithm implemented in PL/pgSQL.* https://gist.github.com/joelonsql/572d7dc5bcded8300453f2d0e5a91c96
- pgRouting `pgr_strongComponents`. https://docs.pgrouting.org/latest/en/pgr_strongComponents.html
- graphqlite (SQLite extension, SCC in C). https://github.com/colliery-io/graphqlite
- Neo4j GDS Strongly Connected Components (non-SQL contrast). https://www.neo4j.com/docs/graph-data-science/current/algorithms/strongly-connected-components/

**Weakly/undirected components in SQL (the thing that is everywhere)**
- SO 18618999. https://stackoverflow.com/questions/18618999/group-all-related-records-in-many-to-many-relationship-sql-graph-connected-comp
- SO 33465859. https://stackoverflow.com/questions/33465859/a-number-of-connected-components-of-a-graph-in-sql
- Max Halford. *Graph components with DuckDB.* https://maxhalford.github.io/blog/graph-components-duckdb/
- DuckDB graph queries guide. https://duckdb.org/docs/lts/guides/sql_features/graph_queries
- DuckPGQ graph functions. https://duckpgq.org/documentation/graph_functions/

**Datalog engine internals**
- Soufflé `SCCGraph.cpp`. https://github.com/souffle-lang/souffle/blob/master/src/ast/analysis/SCCGraph.cpp
- Fan, Wang, Zaniolo et al. *Scaling-Up In-Memory Datalog Processing: Observations and Techniques* (RecStep). PVLDB 12(6), 2019. https://www.vldb.org/pvldb/vol12/p695-fan.pdf

**Recursive CTE evaluation**
- Bamberg, Hirn, Grust. *How DuckDB is USING KEY to Unlock Recursive Query Performance.* SIGMOD 2025. https://db.cs.uni-tuebingen.de/publications/2025/using-key/
- Hirn, Grust. *A Fix for the Fixation on Fixpoints.* CIDR 2023. https://www.cidrdb.org/cidr2023/papers/p14-hirn.pdf
- DuckDB. *USING KEY in Recursive CTEs.* 2025-05-23. https://duckdb.org/2025/05/23/using-key

**Counting / estimation**
- Cohen. *Size-Estimation Framework with Applications to Transitive Closure and Reachability.* JCSS 55(3):441-453, 1997. https://core.ac.uk/download/pdf/82229441.pdf
- Cohen. *Estimating the size of the transitive closure in linear time.* FOCS 1994. https://ieeexplore.ieee.org/document/365694
- Boldi, Rosa, Vigna. *HyperANF: Approximating the Neighbourhood Function of Very Large Graphs on a Budget.* WWW 2011. https://arxiv.org/abs/1011.5599
- Recursive-query cardinality-estimation notes. https://github.com/samyama-ai/dbms_research/blob/main/topics/26-cardinality-estimation/recursive-query-estimation.md

**Graph algorithms in SQL, survey level**
- Jindal et al. *Graph Analytics using the Vertica Relational Database.* arXiv:1412.5263. https://arxiv.org/abs/1412.5263
- Celko. *Trees and Hierarchies in SQL for Smarties*, 2nd ed. ToC: https://learning.oreilly.com/library/view/joe-celkos-trees/9780123877338/toc.xhtml
- Ten Wolde et al. *DuckPGQ: Efficient Property Graph Queries in an analytical RDBMS.* CIDR 2023. https://www.cidrdb.org/cidr2023/papers/p66-wolde.pdf
- Homan. *Transitive Closure in SQL.* https://dwhoman.com/blog/sql-transitive-closure
