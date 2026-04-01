---
name: prolog-testing
description: Testing Prolog programs -- plunit framework, test declarations, setup/cleanup, parameterized tests, testing nondeterminism, debugging strategies, test-driven Prolog development. Trigger on prolog testing, plunit, prolog unit test, prolog debug, prolog test driven, prolog tdd.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Testing Prolog Programs: plunit and Beyond

If you know TypeScript and RxJS, you understand reactive systems and testing async streams. Prolog testing is conceptually simpler—no promises, no callbacks—but it's fundamentally different because of nondeterminism. A predicate can have zero, one, or many solutions. Your tests need to handle that.

This guide walks you through **plunit**, SWI-Prolog's built-in testing framework, plus debugging strategies and test-driven development patterns.


## plunit: Prolog's Built-In Test Framework

Think of plunit as Jest for Prolog. You declare test blocks, write individual tests, run them all at once, and get results. Here's the full anatomy:

```prolog
:- use_module(library(plunit)).

:- begin_tests(my_list_utils).

test(member_found) :-
    member(2, [1, 2, 3]).

test(member_not_found, [fail]) :-
    member(4, [1, 2, 3]).

test(append_basic) :-
    append([1, 2], [3, 4], [1, 2, 3, 4]).

:- end_tests(my_list_utils).
```

Here's what happens: You load this file, and plunit registers a test block called `my_list_utils` with three tests. Each test is a goal that should succeed. The `[fail]` option inverts success—the test passes if the goal fails.

Run all tests with `run_tests.` or a specific block with `run_tests(my_list_utils).`


## Understanding Test Options

Tests can do way more than just succeed or fail. You pass options as a second argument to `test/2`:

**`[fail]`** - The test must fail to pass. Use this for negative cases:
```prolog
test(member_not_found, [fail]) :-
    member(4, [1, 2, 3]).
```
This test passes because the goal fails (4 is not in the list). Without `[fail]`, it would be a failing test.

**`[throws(Error)]`** - The test must throw a specific error:
```prolog
test(type_error_on_bad_input, [throws(error(type_error(list, 42), _))]) :-
    append(not_a_list, [2], _).
```
This passes if the exact error is thrown. Useful for testing error handling.

**`[true(Condition)]`** - The test succeeds AND a secondary condition must hold:
```prolog
test(length_correct, [true(L = 3)]) :-
    append([1, 2], [3, 4, 5], Result),
    length(Result, L).
```
The goal succeeds, then `L = 3` is checked. If it fails, the test fails.

**`[all(Template == List)]`** - Collect all solutions and compare:
```prolog
test(append_splits, [all(X-Y == [
    []-[1,2,3],
    [1]-[2,3],
    [1,2]-[3],
    [1,2,3]-[]
])]) :-
    append(X, Y, [1, 2, 3]).
```
This is powerful. `append(X, Y, [1,2,3])` has multiple solutions (X and Y can split the list in different ways). The `[all(...)]` option collects every X-Y pair and verifies the exact set matches. This is like snapshot testing in Jest.

**`[nondet]`** - Acknowledge the test is nondeterministic (suppresses warnings):
```prolog
test(find_any_color, [nondet]) :-
    color(X),
    member(X, [red, green, blue]).
```
Without this, plunit warns "Test has more than one solution" which is often noisy for valid tests.

**`[blocked(Reason)]`** - Skip the test with a reason:
```prolog
test(fancy_feature, [blocked('Waiting for SWI-Prolog 9.0')]) :-
    some_predicate.
```
Shows up in reports as skipped, documents why.

**`[condition(Goal)]`** - Only run if a precondition succeeds:
```prolog
test(modern_feature, [condition(current_prolog_flag(version_data, swi(V)), V >= 90000)]) :-
    use_new_api.
```
Useful for version-dependent tests or platform checks.

**`[setup(Goal)]` and `[cleanup(Goal)]`** - Run before and after this test:
```prolog
test(with_temp_file, [setup(open('temp.txt', write, S)), cleanup(close(S))]) :-
    assertz(temp_open(true)),
    temp_open(true).
```

**`[timeout(Seconds)]`** - Fail if the test exceeds time:
```prolog
test(should_be_fast, [timeout(1.0)]) :-
    expensive_computation(Result),
    Result > 0.
```


## Setting Up and Cleaning Up Test State

Tests often need fresh state. Use block-level setup/cleanup:

```prolog
:- begin_tests(database_tests, [
    setup(assertz(user_db(alice, 30))),
    cleanup(retractall(user_db(_, _)))
]).

test(user_exists) :-
    user_db(alice, Age),
    Age > 25.

test(user_count, [true(N = 1)]) :-
    aggregate_all(count, user_db(_, _), N).

:- end_tests(database_tests).
```

Every test in the block runs with `user_db(alice, 30)` asserted beforehand. After every test (pass or fail), all `user_db` facts are retracted. This prevents test pollution.

For more complex state, factor it:

```prolog
setup_users :-
    assertz(user_db(alice, 30)),
    assertz(user_db(bob, 25)).

cleanup_users :-
    retractall(user_db(_, _)).

:- begin_tests(users, [
    setup(setup_users),
    cleanup(cleanup_users)
]).

test(users_exist) :-
    findall(Name, user_db(Name, _), Names),
    Names = [alice, bob].

:- end_tests(users).
```


## Testing Nondeterministic Predicates

This is where Prolog testing differs sharply from imperative languages. A single predicate call can produce multiple answers:

```prolog
color(red).
color(green).
color(blue).

animal(dog).
animal(cat).
```

Calling `color(X)` three times (or through backtracking) gives you red, then green, then blue. How do you test this?

**Collect all solutions:**
```prolog
test(all_colors, [all(X == [red, green, blue])]) :-
    color(X).
```
This gathers every solution in order and compares. If you define colors differently (or in a different order), the test fails. Snapshot testing.

**Test that at least one solution exists:**
```prolog
test(colors_exist) :-
    color(_).
```
Succeeds if backtracking finds any solution. Fails if there are none.

**Test an aggregation:**
```prolog
test(color_count, [true(Count = 3)]) :-
    aggregate_all(count, color(_), Count).
```
Count solutions without collecting them all (faster for large result sets).

**Test a specific subset:**
```prolog
test(color_includes_red) :-
    color(red).
```
Just check that one answer exists. Simple and direct.


## Debugging Prolog Tests

When a test fails, you need visibility. Prolog has several debugging tools:

**The Tracer (`trace/0`)**

```prolog
?- trace.
?- my_predicate(X).
```

The tracer enters "box model" mode. Every predicate call is a box with four ports:

- **Call**: predicate is entered with arguments
- **Exit**: predicate succeeded and binds variables
- **Fail**: predicate backtracked and failed
- **Redo**: backtracking re-entered the box

You step through ports, watching variable bindings change. Learn the box model once and debugging becomes clear.

**Spy Points (`spy/1`)**

```prolog
?- spy(my_problematic_pred/2).
```

Sets a breakpoint. Execution pauses when entering that predicate. Then you trace step-by-step from there. Use `nospy(my_problematic_pred/2)` to remove.

**GUI Debugger (`gtrace/0`)**

```prolog
?- gtrace.
?- run_tests(my_tests).
```

Opens a graphical tracer. Shows a tree of calls, variable bindings, ports. Far more pleasant than command-line tracing for complex tests.

**Debug Messages (`debug/3`)**

Prolog has a lightweight debug system. Enable a debug channel:

```prolog
:- debug(my_module).

my_predicate(X) :-
    debug(my_module, "Processing item: ~w", [X]),
    process(X).
```

Run with `?- run_tests.` and debug output streams to console. Turn it off with `nodebug(my_module).` Use `debug.` to see all active channels.

**Assertions (`assertion/1`)**

```prolog
test(append_result) :-
    append([1, 2], [3], Result),
    assertion(Result = [1, 2, 3]).
```

Inline checks. If the assertion fails, it halts and reports a violation. More interactive than silent test failure.


## Testing Multi-Modal Predicates

Prolog predicates often work in multiple modes. `append/3` can concatenate OR split:

```prolog
% Mode 1: append given lists to produce result
?- append([1, 2], [3], Result).
Result = [1, 2, 3].

% Mode 2: split a list
?- append(X, Y, [1, 2, 3]).
X = [], Y = [1, 2, 3];
X = [1], Y = [2, 3];
...
```

Test both modes explicitly:

```prolog
:- begin_tests(append_modes).

test(append_concat_mode) :-
    append([1, 2], [3, 4], [1, 2, 3, 4]).

test(append_split_mode, [all(X-Y == [
    []-[1,2,3],
    [1]-[2,3],
    [1,2]-[3],
    [1,2,3]-[]
])]) :-
    append(X, Y, [1, 2, 3]).

test(append_find_list, [all(X == [[1,2,3], [1,2], [1], []])]) :-
    append(X, [3], [1,2,3]).

:- end_tests(append_modes).
```

Each mode is a different test. This ensures the predicate works as a logic program, not just a function.


## Test-Driven Prolog Development

The workflow mirrors TDD in JavaScript, but think in terms of logic:

**Step 1: Write the test (Red)**

```prolog
:- begin_tests(my_flatten).

test(flatten_nested_lists) :-
    my_flatten([[1, 2], [3, [4, 5]], 6], [1, 2, 3, 4, 5, 6]).

test(flatten_empty) :-
    my_flatten([], []).

test(flatten_single) :-
    my_flatten([1], [1]).

:- end_tests(my_flatten).
```

Run `run_tests(my_flatten).` All fail because `my_flatten` doesn't exist.

**Step 2: Implement (Green)**

```prolog
my_flatten([], []) :- !.
my_flatten([H | T], Flat) :-
    is_list(H),
    !,
    my_flatten(H, FlatH),
    my_flatten(T, FlatT),
    append(FlatH, FlatT, Flat).
my_flatten([H | T], [H | Flat]) :-
    my_flatten(T, Flat).
```

Run tests again. Now they pass.

**Step 3: Add Edge Cases**

```prolog
test(flatten_deeply_nested) :-
    my_flatten([[[[[1]]]]], [1]).

test(flatten_mixed_depth, [all(X == [1,2,3,4,5,6,7,8])]) :-
    my_flatten([[1, [2, 3]], 4, [[5, 6], [7, 8]]], X).
```

Tests fail. Fix the implementation if needed.

**Step 4: Refactor**

Once tests pass, improve clarity without breaking them:

```prolog
my_flatten(Input, Output) :-
    my_flatten_acc(Input, [], Output).

my_flatten_acc([], Acc, Acc) :- !.
my_flatten_acc([H | T], Acc, Flat) :-
    is_list(H),
    !,
    my_flatten_acc(H, Acc, Acc1),
    my_flatten_acc(T, Acc1, Flat).
my_flatten_acc([H | T], Acc, [H | Flat]) :-
    my_flatten_acc(T, Acc, Flat).
```

Tests still pass. The implementation is now accumulator-based, more efficient.


## Running Tests: Full Commands

```prolog
?- run_tests.
```
Runs all registered test blocks. Shows pass/fail counts, timing.

```prolog
?- run_tests(my_list_utils).
```
Runs just the `my_list_utils` block.

```prolog
?- run_tests(my_list_utils:append_basic).
```
Runs a single test.

```prolog
?- run_tests(my_list_utils, [silent(true)]).
```
Suppress output, just return true/false.

```prolog
?- run_tests(my_list_utils, [jobs(4)]).
```
Parallel test execution (if supported).


## Comparing to JavaScript Testing (Jest/Vitest)

| Prolog | JavaScript |
|--------|-----------|
| `begin_tests(name)...end_tests` | `describe('name', () => {})` |
| `test(name) :- goal.` | `it('name', () => { ... })` |
| `[setup(Goal)], [cleanup(Goal)]` | `beforeEach()`, `afterEach()` |
| `[fail]` option | `expect(() => fn()).toThrow()` |
| `[all(X == [...])]` option | `.toMatchInlineSnapshot()` or `.toEqual(expected)` |
| `[nondet]` option | None—JS functions have single return |
| `?- run_tests.` | `npm test` or `vitest` |
| `spy/1`, `gtrace/0` | debugger, breakpoints |
| `debug/3` | `console.log()` |

The big difference: JavaScript tests are imperative sequences; Prolog tests are declarative goals. JavaScript testing concerns itself with execution order and side effects. Prolog testing concerns itself with logical correctness and the completeness of solution sets.


## Quick Checklist for Writing Tests

- Is the predicate deterministic (one answer) or nondeterministic (multiple answers)? Use `[all(...)]` for nondeterministic.
- Does the test depend on global state? Use `[setup]` and `[cleanup]`.
- Should this test fail as a passing case? Use `[fail]`.
- Are all solutions critical, or just one? Use `[all(...)]` or bare goal accordingly.
- Is there a timeout risk? Use `[timeout(...)]`.
- Stuck? Use `gtrace.` and step through the predicate.
- Test multiple modes of multi-modal predicates separately.
- Write tests before implementation (TDD). Logic is easier to test than code.
