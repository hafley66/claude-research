---
name: prolog-demos
description: Notable Prolog projects, demos, and learning resources -- GitHub repos, books, tutorials, SWISH notebooks, real-world applications, community resources. Trigger on prolog examples, prolog projects, prolog github, prolog resources, learn prolog, prolog books, prolog demos, prolog community.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Prolog Demos and Resources

Prolog is a declarative language built on logic programming. Describe the problem constraints, and the execution engine finds solutions. This skill collects the best places to learn, experiment, and see what Prolog does well.


## Notable GitHub Repositories


### Core Implementations

**SWI-Prolog** (github.com/SWI-Prolog/swipl-devel)
The dominant open-source Prolog implementation. Mature, well-maintained, comprehensive standard library. If you read Prolog source code, it's usually here. The standard library implementation is worth studying for both correctness and style.

**Scryer Prolog** (github.com/mthom/scryer-prolog)
Prolog interpreter in Rust, ISO-compliant, runs on WebAssembly. Interesting if you care about correctness proofs and Rust ecosystem integration. Smaller community but active development.

**Trealla** (github.com/trealla/trealla)
Fast Prolog in C, ISO compliant, single-file implementation. Lightweight alternative to SWI for embedded systems or resource-constrained environments.

**ichiban/prolog** (github.com/ichiban/prolog)
Prolog interpreter in Go. Good reference implementation if you want to understand the core VM architecture without the complexity of SWI.


### Extensions and Hybrids

**Logtalk** (github.com/LogtalkDotOrg/logtalk3)
Object-oriented extension for Prolog. Adds classes, inheritance, encapsulation. Used in research and enterprise systems where OOP structure helps large codebases.

**Tau Prolog** (github.com/tau-prolog/tau-prolog)
Prolog interpreter in JavaScript. Runs in the browser. Good for interactive demos, web-based constraint solving, educational tools. Live REPL at tau-prolog.org.

**julianhyde/morel** (github.com/julianhyde/morel)
ML language with Datalog backend. Bridges functional programming and logic programming. Interesting for understanding how to layer languages.


### Production Systems Built on Prolog

**TerminusDB** (github.com/terminusdb/terminusdb)
Graph database built on Prolog. Real production code, handles large datasets, demonstrates Prolog's scalability for certain workloads. Look at query compilation and indexing strategies.

**SWISH** (github.com/SWI-Prolog/swish)
Jupyter-like notebook environment for Prolog. Runs on the web at swish.swi-prolog.org. Great for prototyping, teaching, and sharing reproducible logic programs.

**Pengines** (github.com/SWI-Prolog/pengines)
Sandboxed Prolog execution over HTTP. Runs within SWI. Enables safe remote Prolog evaluation. Powers SWISH.


## Classic Demo Programs

These programs showcase what Prolog excels at: constraint satisfaction, search, and declarative problem-solving in very few lines of code.


### N-Queens (Constraint Logic Programming)

```prolog
n_queens(N, Qs) :-
    length(Qs, N),
    Qs ins 1..N,
    all_different(Qs),
    safe_queens(Qs),
    label(Qs).

safe_queens([]).
safe_queens([Q|Qs]) :-
    safe_queens(Qs, Q, 1),
    safe_queens(Qs).

safe_queens([], _, _).
safe_queens([Q|Qs], Q0, X) :-
    abs(Q - Q0) =\= X,
    X1 is X + 1,
    safe_queens(Qs, Q0, X1).
```

Eight lines. Finds all valid placements for N queens on an N×N board. The `ins`, `all_different`, and `label` predicates are from CLP(FD), SWI's constraint domain.


### Sudoku Solver (Constraint Logic Programming)

```prolog
sudoku(Rows) :-
    length(Rows, 9),
    maplist(length(_,9), Rows),
    append(Rows, Vs),
    Vs ins 1..9,
    maplist(all_different, Rows),
    transpose(Rows, Cols),
    maplist(all_different, Cols),
    Rows = [R1,R2,R3,R4,R5,R6,R7,R8,R9],
    blocks(R1,R2,R3),
    blocks(R4,R5,R6),
    blocks(R7,R8,R9),
    labeling([ff], Vs).

blocks(R1, R2, R3) :-
    maplist(block_constraint, R1, R2, R3).

block_constraint([A,B,C|_], [D,E,F|_], [G,H,I|_]) :-
    all_different([A,B,C,D,E,F,G,H,I]).
```

Twenty lines. Takes a partially-filled 9×9 grid (0 for empty cells) and fills it. The solver knows Sudoku rules: rows, columns, and 3×3 blocks are all different. No search algorithm written; just constraints. CLP(FD) handles the search.


### Natural Language Parser (DCG)

```prolog
sentence --> noun_phrase, verb_phrase.
noun_phrase --> determiner, noun.
verb_phrase --> verb, noun_phrase.
verb_phrase --> verb.

determiner --> [the].
determiner --> [a].
noun --> [cat] ; [dog] ; [mouse].
verb --> [chases] ; [sees].
```

Parse English (toy grammar). Feed text as a list: `phrase(sentence, [the, cat, chases, a, mouse]).` Works backwards too: generate valid sentences.


### Type Inference Engine (Unification)

A type inference system uses unification to propagate type constraints:

```prolog
infer(var(X), Env, Type) :- lookup(X, Env, Type).
infer(app(Fn, Arg), Env, ReturnType) :-
    infer(Fn, Env, arrow(ArgType, ReturnType)),
    infer(Arg, Env, ArgType).
infer(lambda(X, Body), Env, arrow(ArgType, ReturnType)) :-
    infer(Body, [X:ArgType | Env], ReturnType).
```

Unification with occurs-check ensures type variables resolve consistently. This scales to hindley-milner systems.


### Expert System Shell (Meta-Interpreter)

A backward-chaining rule engine written in Prolog:

```prolog
solve(Goal, Trace) :-
    ( Goal = true
    -> Trace = [Goal]
    ; rule(Head, Body),
      Goal = Head,
      solve(Body, BodyTrace),
      Trace = [Goal | BodyTrace]
    ).
```

Define facts and rules as data, query with `solve/2`. This pattern generalizes to Bayesian networks, diagnosis systems, medical rule bases.


## Books

The essential reading list.


### Classic Texts

**The Art of Prolog** (Sterling & Shapiro)
The theoretical deep-dive. Covers semantics, proof procedures, control. Dense but authoritative. Paid.

**Programming in Prolog** (Clocksin & Mellish)
Gentle introduction, widely used in universities. Focuses on practical problem-solving. Paid.

**Clause and Effect** (Clocksin)
Another approach: build intuition through worked examples. Less dense than Art of Prolog. Paid.

**The Craft of Prolog** (O'Keefe)
Advanced techniques, performance optimization, elegant solutions. For people who already code Prolog. Paid.


### Free and Online

**Learn Prolog Now!** (Blackburn, Bos, Striegnitz)
Free online textbook. Best free intro. Covers fundamentals, parsing, lists, search. Start here.

**The Power of Prolog** (Markus Triska)
Modern, CLP-focused, excellent video lectures. Covers constraint programming deeply. Free on YouTube. Accompanying book also available.

**The Reasoned Schemer** (Friedman, Byrd, Karp)
Explores miniKanren, a Prolog-like system in Scheme. Excellent for Lisp/Scheme developers or those interested in logic programming in functional languages.


## Online Resources and Communities


### Interactive Environments

**SWISH** (swish.swi-prolog.org)
Browser-based Prolog notebook. Write, run, visualize. Great for quick experiments and sharing code.

**Tau Prolog** (tau-prolog.org)
Prolog in JavaScript. Interactive REPL, web-based.


### Documentation

**SWI-Prolog Manual** (swi-prolog.org/pldoc)
Official reference. Comprehensive, searchable. Standard library docs included.

**"The Power of Prolog" Channel** (YouTube)
Markus Triska. High-quality video lectures on CLP(FD), DCGs, modules, reasoning. Complementary to the book.


### Communities

**/r/prolog** (reddit.com/r/prolog)
Active subreddit. Questions, project showcases, discussion.

**SWI-Prolog Discourse** (discourse.swi-prolog.org)
Official forum. For detailed questions, feature requests, development discussions.

**Prolog Discord**
Various Prolog communities on Discord. Search for "Prolog" in server lists.

**Stack Overflow [prolog] tag** (stackoverflow.com/questions/tagged/prolog)
Searchable Q&A. Good for debugging specific issues.

**Rosetta Code** (rosettacode.org)
Side-by-side implementations of algorithms in many languages, including Prolog. Good for comparison learning.


## Real-World Applications

Prolog is used in production in several domains.


### Systems and Databases

**TerminusDB**
Graph database with Prolog at its core. Handles schema, queries, updates. Demonstrates scalability.

**Amzi! Prolog**
Commercial Prolog. Embedded in financial software, manufacturing control systems, diagnostics.


### Expert Systems

Medical diagnosis, legal reasoning, financial rule engines. Typically implemented as rule bases + inference engine (sometimes built in Prolog itself). Examples include MYCIN (classic), modern clinical decision support systems.


### Constraint Programming

Airline crew scheduling, shift rostering, vehicle routing. Problems with thousands of constraints and variables. CLP(FD) solves these efficiently.


### Natural Language Processing

Parsing and semantic analysis. DCGs are natural for grammar rules. Used in chatbots, query systems, translation pipelines.


### Reasoning and AI

IBM Watson used Prolog-like reasoning for Jeopardy. Modern applications: ontology reasoning, knowledge graphs, semantic web (RDF/OWL have Prolog-like semantics).


## Exercises and Challenges

Practice playgrounds.


### 99 Prolog Problems

Adapted from 99 Lisp Problems. Lists, arithmetic, logic, recursion, search. Levels beginner to hard. Available at multiple sites (search "99 prolog problems").


### Exercism Prolog Track

(exercism.org/tracks/prolog)
Guided exercises with feedback. Start simple, progress through data structures and algorithms.


### Advent of Code in Prolog

(adventofcode.com)
Annual coding challenge. Solving puzzles in Prolog is idiomatic and often elegant. Good for comparative learning.


### Project Euler

(projecteuler.net)
Mathematical and algorithmic problems. Prolog solutions showcase constraint solving and number theory.


## Getting Help

Where to ask questions and report issues.


### SWI-Prolog Discourse

discourse.swi-prolog.org. Active maintainers and experienced users. Best for detailed questions.


### Stack Overflow

Tag with `[prolog]`. Search before posting; many questions already answered.


### GitHub Issues

SWI-Prolog: github.com/SWI-Prolog/swipl-devel/issues. For bugs and feature requests.


### Academic Resources

**ICLP** (International Conference on Logic Programming)
Premier conference. Papers, proceedings, workshops. Follow for cutting-edge research.

**TPLP** (Theory and Practice of Logic Programming journal)
High-quality peer-reviewed articles on logic programming.


## Starting Points by Goal

**I want to learn Prolog basics.**
Read "Learn Prolog Now!" (free), then solve 99 Prolog Problems.

**I want to see real code in production.**
Study TerminusDB source (query compilation, indexing) or Tau Prolog (JavaScript implementation).

**I want to solve constraint problems.**
Watch "The Power of Prolog" CLP(FD) videos, then code N-Queens and Sudoku.

**I want to understand the theory.**
Read "The Art of Prolog" for semantics, or explore Scryer Prolog for a small, verifiable implementation.

**I want to prototype quickly.**
Use SWISH or Tau Prolog in the browser. Share notebooks.
