# Prolog Skills — Reading Order

A curriculum for learning Prolog from the ground up, organized by dependency.
Read them in order. Each skill builds on the ones before it.

## Part 1: The Paradigm Shift

Start here. These three skills form the execution model that everything else depends on.

1. **[prolog-core](prolog-core/SKILL.md)** — What Prolog is. Horn clauses, facts, rules, queries. The declarative vs procedural reading. Start here even if you think you know what Prolog is.

2. **[prolog-unification](prolog-unification/SKILL.md)** — The single operation that drives everything. Variable binding, bidirectional matching, occurs check. If you only read one skill, read this one. Your TS `infer` intuition maps here.

3. **[prolog-backtracking](prolog-backtracking/SKILL.md)** — How Prolog explores solutions. DFS, choice points, the undo log. This is the runtime beneath the declarative surface. RxJS `expand()` / lazy stream analogy lives here.

## Part 2: Data and Computation

Now that you understand the engine, learn what it operates on.

4. **[prolog-terms](prolog-terms/SKILL.md)** — Everything is a term. Atoms, numbers, variables, compound terms. functor/3, =../2. Prolog's one and only data type.

5. **[prolog-lists](prolog-lists/SKILL.md)** — [H|T] decomposition, append (and its four modes), member, accumulators, difference lists. The bread and butter of daily Prolog.

6. **[prolog-arithmetic](prolog-arithmetic/SKILL.md)** — Why `3 + 4` is not `7`. The `is/2` operator, the three equalities (`=`, `==`, `=:=`), and CLP(FD) constraints. Where Prolog's purity breaks and how to fix it.

7. **[prolog-strings](prolog-strings/SKILL.md)** — Atoms vs strings vs char lists vs code lists. The `double_quotes` flag. format/2. The four representations and when to use each.

## Part 3: Control Flow

Prolog's answer to "but how do I write an if statement?"

8. **[prolog-booleans-control](prolog-booleans-control/SKILL.md)** — There are no booleans. Goals succeed or fail. Conjunction, disjunction, if-then-else, between/3. The mental model shift from values to outcomes.

9. **[prolog-cut-negation](prolog-cut-negation/SKILL.md)** — Cut (!), green vs red cuts, negation-as-failure (\+), once/1. Where the declarative reading starts to lie. Read this after you've felt the pain of unwanted backtracking.

## Part 4: Power Features

These make Prolog genuinely different from other languages.

10. **[prolog-goals](prolog-goals/SKILL.md)** — Goals are terms. call/N, goal reification, forall/2, aggregate_all, engines. Prolog's homoiconicity in practice.

11. **[prolog-dcg](prolog-dcg/SKILL.md)** — Definite clause grammars. Parser combinators that get backtracking for free. One of Prolog's genuine killer features.

12. **[prolog-meta](prolog-meta/SKILL.md)** — call/N, findall/bagof/setof, assert/retract, clause/2, meta-interpreters. Write a Prolog interpreter in 3 lines of Prolog.

13. **[prolog-operators](prolog-operators/SKILL.md)** — op/3, precedence, associativity (xfx/yfx/xfy). How `a :- b, c` is just a term. Build your own DSL syntax.

## Part 5: Engineering

Making real things with Prolog.

14. **[prolog-modules](prolog-modules/SKILL.md)** — Module systems (mostly SWI-Prolog's). import/export, meta_predicate, autoload. Honestly one of Prolog's weaker areas.

15. **[prolog-testing](prolog-testing/SKILL.md)** — plunit framework, testing nondeterministic predicates, debugging with trace/spy/gtrace, TDD workflow.

16. **[swi-prolog](swi-prolog/SKILL.md)** — SWI-Prolog specifically: installation, REPL workflow, debugger, profiler, key libraries, tabling, multithreading, packs.

17. **[prolog-crud-app](prolog-crud-app/SKILL.md)** — Build a TODO app with HTTP server, JSON, SQLite, sessions, file I/O. The "can Prolog actually build real things?" skill. Express.js comparison throughout.

## Part 6: The Wider World

Where Prolog sits in the landscape and where it's going.

18. **[prolog-types](prolog-types/SKILL.md)** — Mercury (the Rust of logic programming), Ciao (the TypeScript of logic programming), Scryer Prolog (written in Rust), Logtalk. What typed Prolog looks like.

19. **[prolog-alt-languages](prolog-alt-languages/SKILL.md)** — Datalog, miniKanren, Answer Set Programming / Clingo, Curry, Verse (Epic/Fortnite). The evolving landscape of logic programming. Decision matrix for when to use what.

20. **[prolog-demos](prolog-demos/SKILL.md)** — Notable GitHub repos, classic demo programs (Sudoku in 20 lines), books, online resources, community.
