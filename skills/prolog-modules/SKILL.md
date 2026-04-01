---
name: prolog-modules
description: Prolog module systems -- SWI module declarations, import/export, module-transparent predicates, visibility, ISO vs SWI modules, module pitfalls. Trigger on prolog modules, prolog module, use_module, module declaration, prolog namespace.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Prolog Module Systems

## The Module Problem

Traditional Prolog operates in a single global namespace. Every predicate defined anywhere is visible everywhere. Two files both defining `helper/2` collide silently, with the later load overwriting the earlier one. This flat namespace works for small programs and interactive exploration but breaks down in any codebase with multiple contributors or libraries.

Module systems were bolted onto Prolog after the fact, and the implementations diverge significantly across Prolog systems. There is an ISO standard for modules, but major implementations (SWI, SICStus, Ciao) each went their own direction. This is one of Prolog's genuinely weak areas compared to languages that shipped with module systems from day one.

## SWI-Prolog Module Declarations

SWI-Prolog's module system is file-based. One file = one module. The module declaration must be the first term in the file.

```prolog
% File: my_utils.pl
:- module(my_utils, [
    helper/2,
    transform/3
]).

% Exported - visible to importers
helper(X, Y) :-
    internal_helper(X, Mid),
    finalize(Mid, Y).

transform(A, B, C) :-
    step1(A, B),
    step2(B, C).

% Not in the export list - nominally private to this module
internal_helper(X, X).
finalize(X, X).
```

The export list is the second argument to `module/2`. It contains functor/arity pairs. Only these predicates are "officially" part of the module's public interface.

Predicates not in the export list are module-local. They can reference each other freely within the file without qualification.

### Re-export

A module can re-export predicates it imported:

```prolog
:- module(facade, [
    member/2,       % re-exported from lists
    my_pred/1
]).

:- use_module(library(lists), [member/2]).
:- reexport(library(lists), [append/3]).  % also re-exports append/3

my_pred(X) :- member(X, [a, b, c]).
```

`reexport/2` makes the imported predicate available to anyone who imports this module.

## Importing Modules

```prolog
% Import everything exported by the lists library
:- use_module(library(lists)).

% Import a local file as a module
:- use_module(my_utils).

% Selective import - only bring in specific predicates
:- use_module(my_utils, [helper/2]).

% Selective import from a library
:- use_module(library(apply), [maplist/3, include/3]).
```

For TypeScript developers, the mapping is:

| Prolog | TypeScript equivalent |
|--------|---------------------|
| `use_module(library(lists))` | `import * from 'list-utils'` |
| `use_module(my_utils, [helper/2])` | `import { helper } from './my_utils'` |
| `reexport(library(lists))` | `export * from 'list-utils'` |

### File Resolution

`library(X)` looks up X in the library search path. Plain atoms like `my_utils` are resolved relative to the loading file's directory. You can also use absolute or relative file paths:

```prolog
:- use_module('../shared/utils').
:- use_module('/absolute/path/to/module').
```

The `.pl` extension is added automatically if omitted.

### use_module vs ensure_loaded

`use_module/1` imports the module's exported predicates into the current namespace. `ensure_loaded/1` loads the file but does NOT import predicates. The file still gets compiled, side effects still execute, but you must use qualified calls to access its predicates.

```prolog
:- ensure_loaded(my_utils).
% Now must call: my_utils:helper(X, Y)
% Cannot call: helper(X, Y)
```

## Qualified Calls

Any predicate can be called with an explicit module prefix using the `:` operator:

```prolog
?- my_utils:internal_helper(foo).
true.
```

This bypasses export restrictions entirely. SWI-Prolog's module system is advisory, not enforced. The export list declares intent but does not prevent access. Any predicate in any loaded module can be reached via `Module:Predicate`.

This design choice is deliberate. Prolog's interactive development style and meta-programming capabilities make hard enforcement impractical. The export list serves as documentation and prevents accidental name collisions, but it is not a security boundary.

### The `user` Module

Code loaded without a module declaration goes into the `user` module, which is the default module for the top-level interpreter. Predicates in `user` are visible everywhere without qualification, which is why scripts without module declarations "just work" but also why name collisions happen.

## meta_predicate and Module-Transparent Predicates

Higher-order predicates create a module context problem. When module A defines a mapping predicate and module B passes it a goal, which module's namespace resolves the goal?

```prolog
% Module: my_hof
:- module(my_hof, [my_maplist/3]).

:- meta_predicate my_maplist(2, +, -).

my_maplist(_, [], []).
my_maplist(Goal, [X|Xs], [Y|Ys]) :-
    call(Goal, X, Y),
    my_maplist(Goal, Xs, Ys).
```

The `meta_predicate` declaration tells the system how to handle each argument:

| Marker | Meaning |
|--------|---------|
| `+` | Not a goal, pass as-is |
| `-` | Not a goal, pass as-is |
| `?` | Not a goal, pass as-is |
| `0` | A goal (zero additional args) |
| `1` | A goal called with one additional arg |
| `2` | A goal called with two additional args |
| `N` | A goal called with N additional args |
| `:` | Module-sensitive argument (gets module prefix) |

When the system sees `my_maplist(2, +, -)`, it knows the first argument is a goal that will be called with 2 extra arguments. The runtime automatically qualifies the goal with the *caller's* module, so that predicate names resolve in the right namespace.

Without `meta_predicate`, a higher-order predicate in module A calling `call(Goal, X, Y)` would look up `Goal` in module A's namespace, not in the caller's. This is the single most common source of module-related bugs.

### module_transparent (Legacy)

Older SWI code uses `module_transparent` instead of `meta_predicate`. This makes the entire predicate execute in the caller's module context. It is deprecated in favor of `meta_predicate`, which gives finer-grained control per argument. Existing code using `module_transparent` still works but should be migrated.

## autoload

SWI-Prolog automatically imports commonly used predicates without explicit `use_module` declarations. Predicates like `member/2`, `append/3`, `msort/2`, `succ/2`, and many others are autoloaded on first use.

This is convenient for interactive use and small scripts. The cost is that code may depend on predicates without any visible import, making dependencies opaque. A file might call `member(X, [1,2,3])` with no `use_module(library(lists))` anywhere, and it works because autoload pulled it in silently.

```prolog
% Disable autoload globally
:- set_prolog_flag(autoload, false).

% Check if autoload is active
?- current_prolog_flag(autoload, X).
X = true.
```

For production code, disabling autoload and using explicit imports makes dependency tracking tractable. The `make/0` command will report undefined predicates that were previously autoloaded, which helps find missing imports.

### Listing Autoloaded Predicates

```prolog
?- autoload_path(Dir).   % show autoload directories
?- predicate_property(P, autoload(Module)).  % find autoloaded predicates
```

## ISO Module System vs SWI

The ISO Prolog module standard (ISO/IEC 13211-2) specifies a module system that differs from SWI-Prolog's in several ways:

| Aspect | ISO | SWI-Prolog |
|--------|-----|-----------|
| Module identity | Atom-based names | File-based (one file = one module) |
| Import mechanism | `use_module/1` with module name | `use_module/1` with file spec |
| Qualified calls | `Module:Goal` | `Module:Goal` (same syntax) |
| Export enforcement | Implementation-defined | Advisory (not enforced) |
| Meta-predicates | Less specified | `meta_predicate` directive |

In practice, the ISO module standard has limited adoption. SWI-Prolog's file-based approach is the de facto standard for the largest user base.

## Other Implementations

**SICStus Prolog**: More ISO-compliant. Modules are name-based rather than file-based. Import/export is stricter. Has a separate `block` declaration system for predicates.

**YAP**: Largely SWI-compatible module system. Code written for SWI modules usually works in YAP with minimal changes.

**GNU Prolog**: No module system at all. Everything is global. For small constraint-solving programs this is fine; for larger projects it is a real limitation.

**Ciao**: Uses a package/assertion-based system that is more sophisticated than SWI's but also more complex. Modules can declare types, modes, and assertions alongside exports. Closest to a "proper" module system in the Prolog world.

**Scryer Prolog**: Module system is present and ISO-leaning, but still evolving. Compatibility with SWI module conventions is partial.

**Trealla Prolog**: ISO module support. Relatively new implementation.

## Packs (Package Manager)

SWI-Prolog has a package manager for distributing reusable libraries:

```prolog
% Install a pack
?- pack_install(mavis).

% List installed packs
?- pack_list_installed.

% Use an installed pack
:- use_module(library(mavis)).

% Remove a pack
?- pack_remove(mavis).

% Search available packs
?- pack_search(json).
```

Packs are distributed as git repos or archives. The ecosystem is small compared to npm/cargo/pip. Quality varies. Many packs are single-author unmaintained projects. Check the pack's git activity before depending on it.

Pack metadata lives in `pack.pl` in the repository root:

```prolog
name(my_pack).
title('A useful Prolog library').
version('1.0.0').
author('Name', 'email@example.com').
download('https://github.com/user/my_pack/releases/*.zip').
```

## Common Pitfalls

### 1. Forgetting meta_predicate

The most frequent module bug. A higher-order predicate works fine when tested in the same module but fails when called from another module because goals resolve in the wrong namespace.

```prolog
% BROKEN - no meta_predicate declaration
:- module(broken, [apply_to_list/3]).
apply_to_list(Goal, In, Out) :- maplist(Goal, In, Out).

% Caller in another module:
% ?- apply_to_list(my_transform, [1,2,3], Out).
% ERROR: Unknown procedure: broken:my_transform/1
```

The fix is adding `:- meta_predicate apply_to_list(1, +, -).`

### 2. Module Name vs File Name Mismatch

SWI expects the module name in the declaration to match the file name (without extension). Mismatches cause confusing load errors or silent failures.

```prolog
% File: utilities.pl
:- module(utils, [...]).  % Module name 'utils' doesn't match file 'utilities'
% This loads but causes confusion with use_module(utilities) vs use_module(utils)
```

### 3. Circular Dependencies

Two modules that `use_module` each other. SWI handles this better than some systems (it detects the cycle and loads what it can), but the resulting behavior can be surprising. Predicates from the not-yet-loaded module will be undefined at load time.

### 4. Operator Declarations Leaking

Operator definitions (`op/3`) are global, not module-scoped. A module that defines custom operators affects all subsequently loaded code:

```prolog
:- module(my_dsl, [...]).
:- op(700, xfx, ==>).  % This operator is now global
```

### 5. assert/retract and Modules

Dynamic predicates interact with modules. `assert(foo(1))` adds to the current module. If called from a meta-predicate, "current module" may not be what you expect:

```prolog
:- module(store, [add_fact/1]).
:- dynamic fact/1.

:- meta_predicate add_fact(:).  % Note the ':' - module-sensitive
add_fact(Fact) :- assert(Fact).
```

Without proper meta_predicate handling, `assert` may add facts to the wrong module's database.

### 6. Autoload Masking Local Predicates

If you define a predicate with the same name as an autoloaded one, the behavior depends on load order and whether autoload has already pulled in the library version. Explicitly importing or using `use_module/2` with a selective list avoids ambiguity.

## Module Best Practices

1. **Always use explicit export lists.** Never rely on "everything is visible."
2. **Use `use_module/2` with import lists** rather than bare `use_module/1`. This documents dependencies at the point of use and prevents unexpected name collisions.
3. **Add `meta_predicate` declarations** for any predicate that takes goals or predicates as arguments. Test these from a different module.
4. **Match module names to file names.** `foo.pl` should declare `module(foo, [...])`.
5. **Disable autoload for production code** or at minimum know which predicates you are autoloading.
6. **Avoid circular module dependencies.** Factor shared predicates into a third module.
7. **Keep modules focused.** One conceptual responsibility per module, same as any language.
8. **Use qualified calls sparingly.** If you find yourself writing `mod:pred` everywhere, you probably need to add the predicate to your import list.
