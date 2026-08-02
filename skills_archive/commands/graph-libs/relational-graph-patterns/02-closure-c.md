---
description: ext/misc/closure.c read from source -- experimental, off by default, AVL-tree BFS with real depth pruning
argument-hint: [section]
---

# `ext/misc/closure.c`, read from source

Source: `https://raw.githubusercontent.com/sqlite/sqlite/master/ext/misc/closure.c`,
984 lines, fetched and read in full (not the header, the implementation).
Every claim below is SOURCE evidence with a line reference into that fetch.

## It does not ship active

The file's own top comment states this plainly, before a single line of
code:

> "WARNING: Experimental and obsolete. Demonstration and testing only."
>
> "This virtual table was created prior to the addition of support for
> common table expressions in SQLite. Common table expressions are a
> better and more portable solution to any problem that this virtual table
> solves."
>
> "Given its experimental and testing-only status, the code here is
> deactivated unless compiled with -DSQLITE_TEST=1."

And the registration function confirms the gate is enforced at compile time,
not just documented:

```c
int sqlite3_closure_init(sqlite3 *db, char **pzErrMsg,
                          const sqlite3_api_routines *pApi){
  int rc = SQLITE_OK;
  SQLITE_EXTENSION_INIT2(pApi);
  (void)pzErrMsg;
#if defined(SQLITE_TEST) && !defined(SQLITE_OMIT_VIRTUALTABLE)
  rc = sqlite3_create_module(db, "transitive_closure", &closureModule, 0);
#endif
  return rc;
}
```

`sqlite3_create_module` (the call that would make `transitive_closure`
queryable) is compiled out entirely unless `SQLITE_TEST` is defined. A
normal SQLite build, including the `sqlite3` package this survey's probes
ran against (3.53.2), does not register this virtual table at all. SQLite's
own maintainers point users at recursive CTEs instead, in the same comment
that ships the code.

## Depth: pushed into the traversal loop, not a post-filter

The BFS is a plain queue-and-visited-set walk (`closureFilter`,
line 675-755). The depth bound (`mxGen`, read from a `depth < N` /
`depth <= N` constraint the query planner recognized in `closureBestIndex`)
is checked at the point a node is pulled off the queue, before its children
are fetched:

```c
while( (pAvl = queuePull(&sQueue))!=0 ){
  if( pAvl->iGeneration>=mxGen ) continue;      /* line 737 */
  sqlite3_bind_int64(pStmt, 1, pAvl->id);
  while( rc==SQLITE_OK && sqlite3_step(pStmt)==SQLITE_ROW ){
    ...
    if( closureAvlSearch(pCur->pClosure, iNew)==0 ){
      rc = closureInsertNode(&sQueue, pCur, iNew, pAvl->iGeneration+1);
    }
  }
  sqlite3_reset(pStmt);
}
```

A node at generation `mxGen - 1` still gets expanded (its check passes),
so its children at generation `mxGen` are inserted and will appear in the
result; those children are then never expanded themselves, because the
`continue` fires on their turn. This is the same "recorded but not expanded
past the cap" shape as `multi_source_walk`'s `depth_cap` argument, and the
check genuinely prunes traversal work rather than filtering a finished set:
a node past the depth bound is never queried against the underlying table
at all.

One caveat this survey flags rather than smooths over: the entire pruned
closure is still computed to completion inside `closureFilter` before any
row is handed back to the caller (`pCur->pCurrent = closureAvlFirst(...)`
runs only after the `while (queuePull...)` loop exits). Depth pruning
reduces how much gets computed; it does not make the result stream
incrementally. The whole bounded closure sits in memory as an AVL tree
before the first row is returned.

## Cycles: a visited-set check, same shape as sprefa's

```c
if( closureAvlSearch(pCur->pClosure, iNew)==0 ){
  rc = closureInsertNode(&sQueue, pCur, iNew, pAvl->iGeneration+1);
}
```

A candidate node is inserted into the queue only if it is not already in
the AVL tree. This is the identical mechanism to `walk.rs`'s
`seen[node] != gen` check, substituting a balanced tree for a generation-
stamped array. Cycles terminate because a node already visited is simply
never re-inserted or re-queued, not because of the depth bound (the depth
bound defaults to `999999999` when no `depth` constraint appears in the
query, so cycle termination cannot be relying on it in the common case).

## Memory: an AVL node per visited node in the closure, not per edge

```c
struct closure_avl {
  sqlite3_int64 id;       /* 8 bytes */
  int iGeneration;        /* 4 bytes (+ padding) */
  closure_avl *pList;     /* 8 bytes: queue-list pointer */
  closure_avl *pBefore;   /* 8 bytes: AVL left child */
  closure_avl *pAfter;    /* 8 bytes: AVL right child */
  closure_avl *pUp;       /* 8 bytes: AVL parent */
  short int height;       /* 2 bytes */
  short int imbalance;    /* 2 bytes */
};
```

On a 64-bit build this lays out to roughly 8 (id) + 4 (generation, padded to
8 for pointer alignment) + 32 (four pointers) + 4 (height/imbalance, padded)
= approximately 48-56 bytes of struct payload per visited node, allocated
one at a time via `sqlite3_malloc64` (line 654), which adds its own small
per-allocation header on top. That is per node reachable within the depth
bound, held for the query's duration as one AVL tree plus one linked queue
list threaded through the same nodes (`pList`, reused as both the AVL
pointer set and the BFS queue's link field). Nothing here is columnar or
compressed; it is a pointer-chasing tree of individually malloc'd nodes,
the same memory shape as `Vec<Vec<u32>>` adjacency lists the petgraph lab
measured at 42.5 bytes/edge, except this structure is sized by nodes in the
closure rather than edges in the graph.

## Edge filtering and halt predicates: a modest patch, not structurally absent

The traversal query is built fresh per call in `closureFilter`:

```c
zSql = sqlite3_mprintf(
     "SELECT \"%w\".\"%w\" FROM \"%w\" WHERE \"%w\".\"%w\"=?1",
     zTableName, zIdColumn, zTableName, zTableName, zParentColumn);
```

`tablename`, `idcolumn`, and `parentcolumn` are already late-bound: they can
be overridden per query via hidden columns recognized in `closureBestIndex`
(`CLOSURE_COL_TABLENAME`, `CLOSURE_COL_IDCOLUMN`, `CLOSURE_COL_PARENTCOLUMN`,
lines 874-898). Adding a fourth hidden column, say `haltcolumn`, and
appending a term to `zSql` that also selects a halt flag, is mechanically
the same change already made three times over for the existing columns.
The halt check itself would go at the single call site that decides whether
to enqueue a freshly-found node
(`closureInsertNode(&sQueue, pCur, iNew, pAvl->iGeneration+1)`, line 743):
insert the node into the AVL tree so it is reported, but only call
`queuePush` (the function `closureInsertNode` already wraps) when the halt
flag is false. That is a few dozen lines inside one file the module already
isolates well (`closureInsertNode` and `queuePush` are already separate
functions with a clean seam between them). Edge-kind filtering is the same
shape: one more hidden column, one more `AND` term in `zSql`.

None of this changes the verdict that the file is dead code in a normal
build. The patch is modest to describe; it would still be a patch to
"Experimental and obsolete... Demonstration and testing only" code that
SQLite's own maintainers recommend replacing with recursive CTEs, not a
foundation to build on.
