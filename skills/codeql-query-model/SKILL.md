---
name: codeql-query-model
description: CodeQL query language design -- object-oriented datalog over AST relations, predicates as derived relations, classes as constrained sets, taint tracking as recursive datalog. Design lessons for code analysis query systems.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# CodeQL Query Model

CodeQL (open source, github.com/github/codeql) is an object-oriented datalog over source code. The query language (QL) compiles to relational evaluation. Understanding its design is useful for building any code analysis query system.

## The Core Insight

Source code is already relational. An AST is a set of nodes with typed relationships. CodeQL's extraction step makes this explicit: it parses source code into a relational database (tables of AST nodes, types, control flow edges, data flow edges). Queries are joins over those tables.

## Extraction: Code → Relations

The extractor runs per-language (JavaScript, Python, Java, C++, etc.) and produces a database snapshot. The schema for JavaScript looks roughly like:

```
// Simplified -- actual schema has hundreds of tables
functions(id, name, num_params, body_id)
calls(id, callee_id, num_args)
exprs(id, kind, parent_id, index, type_id)
stmts(id, kind, parent_id, index)
variables(id, name, scope_id)
types(id, name)
locations(id, file, start_line, start_col, end_line, end_col)
```

These are the EDB (extensional database). Every query operates over this fixed schema.

## Basic Query Structure

```ql
from Function f
where f.getName() = "main" and f.getNumberOfParameters() = 0
select f, "Found zero-param main function"
```

Under the hood this is:

```sql
SELECT f.id, f.location
FROM functions f
WHERE f.name = 'main' AND f.num_params = 0;
```

The `from`/`where`/`select` syntax is sugar for a datalog query.

## Predicates = Derived Relations

```ql
predicate isRecursive(Function f) {
    exists(Call c |
        c.getEnclosingFunction() = f and
        c.getTarget() = f
    )
}
```

This is an IDB relation. In datalog:

```datalog
is_recursive(F) :- call(C, F), enclosing_function(C, F).
```

Predicates can be recursive:

```ql
predicate calls(Function a, Function b) {
    exists(Call c |
        c.getEnclosingFunction() = a and
        c.getTarget() = b
    )
}

predicate transitiveCalls(Function a, Function b) {
    calls(a, b)
    or
    exists(Function mid | calls(a, mid) and transitiveCalls(mid, b))
}
```

In datalog:
```datalog
transitive_calls(A, B) :- calls(A, B).
transitive_calls(A, B) :- calls(A, Mid), transitive_calls(Mid, B).
```

## Transitive Closure Operators

QL provides `+` and `*` as shorthand for transitive and reflexive-transitive closure:

```ql
// a calls+ b means "a transitively calls b" (one or more steps)
predicate eventuallyReaches(Function a, Function b) {
    a.calls+(b)
}

// a calls* b means "a transitively calls b, or a = b" (zero or more steps)
predicate reachesOrSelf(Function a, Function b) {
    a.calls*(b)
}
```

These compile to recursive evaluation internally.

## Classes = Constrained Sets

```ql
class PublicFunction extends Function {
    PublicFunction() {
        this.isPublic() and
        this.getNumberOfParameters() > 0
    }

    string describe() {
        result = "public " + this.getName() + "/" + this.getNumberOfParameters().toString()
    }
}
```

A class is NOT an OOP class. It's a **set** of values satisfying the characteristic predicate (the constructor body). `PublicFunction` is the set of all functions that are public and have >0 params.

In datalog terms:

```datalog
public_function(F) :- function(F), is_public(F), num_params(F, N), N > 0.
```

The OO syntax provides:
- Namespacing (methods belong to classes)
- Inheritance (subclass = subset with additional constraints)
- Override (subclass can specialize methods)

But the semantics are purely relational.

## Exists and Forall

```ql
// exists: at least one binding satisfies the body
predicate hasUnusedParam(Function f) {
    exists(Parameter p |
        p.getFunction() = f and
        not exists(Access a | a.getTarget() = p)
    )
}

// forall: every binding satisfies the body
predicate allParamsUsed(Function f) {
    forall(Parameter p |
        p.getFunction() = f
        implies
        exists(Access a | a.getTarget() = p)
    )
}
```

`exists` compiles to a semi-join (or just an additional body literal in datalog).
`forall` compiles to `NOT EXISTS (... AND NOT ...)` -- universal quantification via double negation.

## Aggregation

```ql
int maxParams() {
    result = max(Function f | | f.getNumberOfParameters())
}

int countFunctions(File file) {
    result = count(Function f | f.getFile() = file)
}

string concatNames(File file) {
    result = concat(Function f | f.getFile() = file | f.getName(), ", ")
}
```

Aggregates are stratified. The `|` syntax separates the range (first part), the filter (middle), and the expression to aggregate (last part).

## Data Flow and Taint Tracking

CodeQL's taint tracking library is a set of recursive datalog rules over the data flow graph.

```ql
class SqlInjection extends TaintTracking::Configuration {
    SqlInjection() { this = "SqlInjection" }

    override predicate isSource(DataFlow::Node source) {
        source instanceof RemoteFlowSource
    }

    override predicate isSink(DataFlow::Node sink) {
        exists(DatabaseQuery q | q.getAnArgument() = sink.asExpr())
    }
}

from SqlInjection config, DataFlow::PathNode source, DataFlow::PathNode sink
where config.hasFlowPath(source, sink)
select sink.getNode(), source, sink, "SQL injection from $@.", source.getNode(), "user input"
```

Under the hood, `hasFlowPath` is a recursive predicate that follows data flow edges:

```datalog
% Simplified
has_flow(src, src) :- is_source(src).
has_flow(src, next) :- has_flow(src, cur), flow_step(cur, next).
flow_path(src, sink) :- has_flow(src, sink), is_sink(sink).
```

The taint tracking configuration (isSource, isSink, isAdditionalStep, isSanitizer) parameterizes which nodes are sources/sinks and which edges to follow. This is a component/template pattern -- same recursive rules, different EDB filters.

## Design Lessons for Building Similar Systems

### 1. The AST is Already Relational

Don't build a query language over tree traversal. Flatten the tree into tables, then query with joins. Trees are a storage format. Relations are a query format.

### 2. Everything is a Relation

Functions, types, expressions, statements, files, locations -- all tables. Even "calls" and "inherits" are relations (edges in a graph = rows in a table). Once everything is a relation, the same join machinery handles all queries.

### 3. OO Sugar Helps Adoption

Developers think "methods on objects," not "joins over relations." CodeQL's class syntax maps naturally to how developers think about code. The implementation is pure relational, but the surface syntax is familiar.

### 4. Recursive Predicates are the Killer Feature

Call graphs, data flow, type hierarchies, transitive imports -- all require recursion. SQL without CTEs can't express these. Datalog can. This is the primary reason to use a logic language over raw SQL for code analysis.

### 5. Stratified Negation Enables Linting

"Find things that DON'T have property X" (unused variables, dead code, missing error handling) requires negation. Stratification makes this safe.

### 6. Separate Extraction from Query

CodeQL extracts code once into a snapshot database, then runs many queries against it. This separation means:
- Extraction is language-specific, queries are language-agnostic patterns
- New queries don't require re-extraction
- The database is portable and cacheable

### 7. Performance Comes from Join Ordering

The CodeQL evaluator uses magic sets and join ordering heuristics. A naive translation of recursive predicates to SQL produces exponential blowup. Good join ordering keeps it polynomial.

## Comparison to Pure Datalog

| Feature | Datalog | QL (CodeQL) |
|---------|---------|-------------|
| Classes | No | Yes (constrained sets) |
| Methods | No | Yes (named predicates on classes) |
| Aggregation | Extension | Built-in |
| Transitive closure | Recursive rules | `+` and `*` operators |
| Modules | No (Souffle has components) | Yes |
| Types | Minimal | Rich, with subtyping |
| Termination | Guaranteed | Guaranteed (same restriction) |
| Function symbols | No | No (same restriction) |
| Evaluation | Bottom-up | Bottom-up with magic sets |

QL is datalog with enough syntactic sugar to be usable by security engineers who don't know logic programming. The evaluation semantics are identical.

## The QL Library Structure

CodeQL ships with per-language libraries that define:
- AST node classes (Function, Call, Expr, etc.)
- Control flow graph construction
- Data flow graph construction
- Taint tracking framework
- Common vulnerability patterns

These libraries are ~100K lines of QL per language. The library IS the analysis -- queries are typically 10-50 lines that configure the framework.

This suggests that for a code analysis query system, the investment is not in the language but in the libraries. The language needs to be expressive enough for library authors, but query authors mostly compose existing predicates.
