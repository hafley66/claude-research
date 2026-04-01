---
name: swi-prolog
description: SWI-Prolog development environment -- installation, REPL workflow, debugger, profiler, libraries, packs, IDE support, tabling, multithreading, development best practices. Trigger on swi-prolog, swi prolog, swipl, prolog debugger, prolog IDE, prolog development, prolog tooling.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# SWI-Prolog Development Environment

## What SWI-Prolog Is

The most widely used Prolog implementation. Open source (BSD license), actively maintained by Jan Wielemaker et al. at VU Amsterdam. Massive standard library, used across academia and industry. Version 9.x is current. Dominates the Prolog ecosystem in terms of library breadth, tooling, and community -- analogous to Node.js ecosystem dominance (though not execution speed dominance).

## Installation and REPL

```bash
# macOS
brew install swi-prolog

# Start REPL
swipl

# Load a file directly
swipl my_program.pl
```

From the REPL:

```prolog
?- [my_program].        % consult (load) file
?- consult('file.pl').  % same thing, explicit form
?- make.                % reload all changed files
```

`make/0` is the hot-reload mechanism. Edit a file in your editor, switch to the REPL, type `make.`, and all changed files are reloaded. Much faster iteration than compile-restart cycles. This is the core development loop.

## The Debugger

SWI-Prolog has a full debugger, contrary to common belief that Prolog lacks debugging tools.

### Text-Mode Debugger

```prolog
?- trace.              % enter trace mode (step through everything)
?- my_goal(X).         % now shows step-by-step execution
% Call: (8) my_goal(_1234)
% Exit: (8) my_goal(hello)

?- spy(my_predicate/2). % set a breakpoint on a specific predicate
?- debug.               % debug mode (stops only at spy points)
?- nodebug.             % turn off debug mode
?- notrace.             % turn off trace mode
```

### Debug Ports (The Box Model)

Prolog execution is modeled as goals passing through four ports:

- **Call**: entering a goal
- **Exit**: goal succeeded
- **Fail**: goal failed (no more clauses match)
- **Redo**: backtracking into a goal for another solution

At each port, interactive commands are available:

| Key | Action |
|-----|--------|
| `c` | Creep (step into) |
| `s` | Skip (step over, run to exit/fail of current goal) |
| `l` | Leap (run to next spy point) |
| `f` | Force fail on this goal |
| `a` | Abort execution entirely |
| `r` | Retry (re-enter the current goal from Call port) |

### GUI Debugger

```prolog
?- gtrace.
```

Opens a graphical debugger (requires XPCE graphics library). Displays the proof tree visually, making backtracking behavior much easier to follow than the text tracer. Shows source code, variable bindings, and the call stack simultaneously.

## Profiling

```prolog
?- profile(my_goal(X)).
```

Outputs time spent in each predicate, sorted by cost. Identifies computational hotspots. Also reports number of calls, redos, and failures per predicate.

## Key Libraries (Included with SWI)

```prolog
:- use_module(library(lists)).       % list operations (append, member, nth0, msort, etc.)
:- use_module(library(apply)).       % higher-order: maplist, foldl, include, exclude
:- use_module(library(clpfd)).       % constraint solving over finite domains (integers)
:- use_module(library(dcg/basics)).  % DCG utilities: digits, blanks, string, eos
:- use_module(library(http/http_server)). % HTTP server (surprisingly capable)
:- use_module(library(persistency)). % persistent facts backed by journal file
:- use_module(library(pengines)).    % sandboxed remote Prolog query engines
:- use_module(library(optparse)).    % command-line argument parsing
:- use_module(library(pcre)).        % Perl-compatible regular expressions
:- use_module(library(csv)).         % CSV reading/writing
:- use_module(library(json)).        % JSON parsing and generation
:- use_module(library(aggregate)).   % SQL-like aggregation (aggregate_all, etc.)
```

## Tabling (Memoization)

SWI-Prolog supports XSB-style tabling. Declared per-predicate:

```prolog
:- table fib/2.
fib(0, 0).
fib(1, 1).
fib(N, F) :- N > 1, N1 is N-1, N2 is N-2,
             fib(N1, F1), fib(N2, F2), F is F1 + F2.
```

Without tabling: exponential time. With tabling: linear. Tabling also fixes left-recursion problems that would otherwise cause infinite loops. For any predicate where the same subgoals recur, tabling is the first thing to reach for.

## Multithreading

SWI-Prolog provides true OS-level threads. Each thread has its own stacks but shares the global clause database (with appropriate locking).

```prolog
?- thread_create(my_goal, Id, []).
?- thread_join(Id, Status).

% Message passing between threads
?- thread_send_message(ThreadId, hello).
?- thread_get_message(Message).

% Thread-local dynamic predicates
:- thread_local my_fact/1.
```

Message queues are the primary inter-thread communication mechanism. Each thread has a default message queue, and named queues can be created for more complex architectures.

## IDE Support

- **VSCode**: `vsc-prolog` extension provides syntax highlighting and basic LSP features
- **Emacs**: `prolog-mode` is the traditional choice, well-integrated with the REPL
- **SWISH**: Web-based Prolog notebook at swish.swi-prolog.org (analogous to Jupyter for Prolog)
- **PceEmacs**: Built-in editor launched with `?- emacs.` from the REPL

## Development Workflow

```
1. Write .pl files in editor
2. Load in REPL:  ?- [myfile].
3. Test queries interactively
4. Edit file in editor
5. ?- make.   % hot reload changed files
6. Test again
7. Use trace/spy when something behaves unexpectedly
```

The REPL is not optional tooling in Prolog development. It is the primary interface. Queries typed at the REPL are how predicates get tested, explored, and validated. The feedback loop is: write clause, load, query, observe, refine.

## Prolog Flags and Configuration

```prolog
?- set_prolog_flag(double_quotes, atom).  % "hello" is atom (default: codes in ISO)
?- set_prolog_flag(double_quotes, chars). % "hello" is list of chars
?- set_prolog_flag(occurs_check, true).   % enable occurs check in unification
?- set_prolog_flag(autoload, false).      % require explicit use_module imports
```

The `double_quotes` flag matters significantly. SWI defaults to `string` (its own string type), but many textbooks assume `codes` or `atom`. Set this at the top of files to avoid confusion.

## Unit Testing with plunit

```prolog
:- use_module(library(plunit)).

:- begin_tests(my_tests).

test(member) :-
    member(2, [1,2,3]).

test(append) :-
    append([1], [2], [1,2]).

test(expected_failure, [fail]) :-
    member(4, [1,2,3]).

test(expected_error, [throws(error(type_error(_,_),_))]) :-
    X is foo.

test(nondet, [nondet]) :-
    member(_, [1,2,3]).

:- end_tests(my_tests).

?- run_tests.
```

Test options: `fail` (test should fail), `throws(Pattern)` (test should throw matching error), `nondet` (suppress warning about leaving choice points), `true(Condition)` (check result), `all(Template == Expected)` (collect all solutions).

## Performance Considerations

SWI-Prolog is not the fastest Prolog for raw computation. SICStus Prolog and B-Prolog produce faster executing code. SWI's strengths are ecosystem breadth, library quality, and development experience. For production workloads where Prolog inference speed is the bottleneck, SICStus (commercial license) is the standard alternative. For most applications, SWI's speed is adequate and the tooling advantages outweigh the performance gap.
