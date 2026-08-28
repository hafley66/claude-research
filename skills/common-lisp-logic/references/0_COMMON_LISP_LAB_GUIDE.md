# Common Lisp Logic Lab Guide

Research date: 2026-08-28

## Installed baseline

| Tool | Version or state | Command |
| --- | --- | --- |
| SBCL | 2.6.7, Homebrew arm64 bottle | `sbcl --version` |
| SWI-Prolog | 10.0.2, arm64 Darwin | `swipl --version` |
| ECL | absent from PATH at baseline | `command -v ecl` |
| Racket | absent from PATH at baseline | `command -v racket` |

Primary references:

- [ANSI Common Lisp HyperSpec](https://www.lispworks.com/documentation/HyperSpec/Front/index.htm)
- [SBCL manual](https://www.sbcl.org/manual/)
- [ASDF manual](https://asdf.common-lisp.dev/asdf.html)
- [Quicklisp](https://www.quicklisp.org/beta/)
- [Qlot](https://github.com/fukamachi/qlot)
- [ECL system building](https://ecl.common-lisp.dev/static/manual/System-building.html)
- [ECL embedding](https://ecl.common-lisp.dev/static/manual/Embedding-ECL.html)

## Mental model

The Common Lisp reader turns characters into Lisp objects before evaluation:

```text
characters -> reader -> Lisp objects -> macro expansion -> compilation/evaluation
```

The primary object forms are:

```lisp
42                         ; integer
"name"                     ; string
user                       ; symbol resolved in the current package
:user                      ; self-evaluating keyword symbol
'user                      ; (quote user), return the symbol as data
(edge owner 'name target)  ; list whose first element occupies call position
'(edge owner name target)  ; list retained as data
```

A symbol has a name and usually a home package. `intern` finds or creates the package's canonical symbol with a given string name. See [CLHS `intern`](https://www.lispworks.com/documentation/HyperSpec/Body/f_intern.htm).

```lisp
(multiple-value-bind (symbol status)
    (intern "USER" "DL7")
  (list symbol status))
```

## Small project layout

```text
0_package.lisp
1_terms.lisp
2_engine.lisp
3_probe.lisp
4_main.lisp
lab.asd
run.lisp
build.lisp
REPORT.md
```

`lab.asd`:

```lisp
(asdf:defsystem "dl7-logic-lab"
  :serial t
  :components
  ((:file "0_package")
   (:file "1_terms")
   (:file "2_engine")
   (:file "3_probe")
   (:file "4_main")))
```

`0_package.lisp`:

```lisp
(defpackage #:dl7-logic-lab
  (:use #:cl)
  (:export #:main #:run-probe))

(in-package #:dl7-logic-lab)
```

Every later source file starts with:

```lisp
(in-package #:dl7-logic-lab)
```

## Loading local source with ASDF

`run.lisp`:

```lisp
(require :asdf)
(asdf:load-asd (merge-pathnames "lab.asd" *load-truename*))
(asdf:load-system "dl7-logic-lab")
(dl7-logic-lab:run-probe)
```

Run:

```sh
sbcl --noinform --disable-debugger --script run.lisp
```

For a checked-out dependency with an ASDF file, load its `.asd` before the lab system:

```lisp
(asdf:load-asd #P"vendor/library/library.asd")
(asdf:load-system "library")
```

If the library has transitive Quicklisp dependencies, install Quicklisp under the lab directory and load that exact setup file. Keep the path project-local:

```sh
curl -fL -o quicklisp.lisp https://beta.quicklisp.org/quicklisp.lisp
sbcl --noinform --disable-debugger \
  --load quicklisp.lisp \
  --eval '(quicklisp-quickstart:install :path #P"./.quicklisp/")' \
  --quit
```

Then place this before `asdf:load-system`:

```lisp
(load #P".quicklisp/setup.lisp")
```

Record dependency repository URLs and exact commits in `REPORT.md`. Avoid checking downloaded dependency trees into the repository unless the brief explicitly requests vendoring.

## Core language required by these labs

### Bindings and functions

```lisp
(let* ((x 1)
       (y (+ x 2)))
  y)

(defun edge-target (edge)
  (third edge))

(mapcar #'edge-target edges)
(remove-if-not #'ground-term-p terms)
```

`#'name` means `(function name)`. Anonymous closures use `lambda`:

```lisp
(remove-if (lambda (edge) (eq (second edge) :internal)) edges)
```

### Product and sum representations

Lists provide an ordered product representation:

```lisp
(list :edge owner name target index)
```

Tagged lists provide a sum representation:

```lisp
(list :variable 17)
(list :primitive :int)
(list :application constructor arguments)
```

`defstruct` provides generated constructors and accessors when explicit runtime types help the probe:

```lisp
(defstruct (logic-variable (:constructor make-logic-variable (id)))
  id)
```

### Equality

| Operator | Use |
| --- | --- |
| `eq` | symbol identity and object identity |
| `eql` | symbols, characters, and numbers of the same type |
| `equal` | recursive list and string equality |
| `equalp` | broader case-insensitive and numeric structural comparison |

Use `equal` for structural logic terms unless the library documents another representation.

### Multiple values

Common Lisp can return several host-language values without constructing a list:

```lisp
(values substitution success-p)

(multiple-value-bind (substitution success-p)
    (unify left right empty-substitution)
  ...)
```

This host feature does not define relational output modes. A logic relation still represents answers through substitutions or tuples.

### Conditions

Keep failures distinguishable:

```lisp
(handler-case
    (run-probe)
  (error (condition)
    (format *error-output* "ERROR ~A~%" condition)
    (uiop:quit 1)))
```

## Logic term representation

A minimal first-order representation needs:

```text
variable     unique identity
atom         symbol, string, number, or another ground scalar
compound     constructor plus ordered argument list
substitution variable -> term
goal         substitution -> lazy stream of substitutions
```

One conventional Common Lisp encoding:

```lisp
(defstruct (lvar (:constructor make-lvar (id))) id)

(defun compound (constructor &rest arguments)
  (cons constructor arguments))

(compound 'edge 'a 'b)        ; (EDGE A B)
(make-lvar 0)                 ; distinct variable object
```

Required unification operations:

```text
walk(term, substitution) -> representative term
occurs?(variable, term, substitution) -> boolean
extend(variable, term, substitution) -> substitution or failure
unify(left, right, substitution) -> substitution or failure
```

Required search operations:

```text
succeed(substitution) -> one-answer stream
fail(substitution) -> empty stream
disjunction(goal...) -> fair stream merge
conjunction(goal...) -> fair bind
fresh(body) -> allocate variables and produce a goal
run(limit, variables, goal) -> reified answers
```

Tabling adds a call table, answer table, suspended consumers, strongly connected component completion, and propagation of newly discovered answers.

## Deterministic probe fixture

Every general logic library should attempt the same finite program:

```text
edge(a,b)
edge(b,c)
edge(c,a)
edge(c,d)

path(X,Y) :- edge(X,Y)
path(X,Y) :- edge(X,Z), path(Z,Y)
```

Expected set-valued query from `a`:

```text
{a, b, c, d}
```

The cycle separates engines that terminate by tabling, bottom-up fixpoint, explicit visited-state adapters, or answer limits. Report which mechanism produced termination.

Also probe:

1. Bidirectional `append` or an equivalent relation.
2. Unification of nested compounds.
3. Occurs-check behavior for `X = f(X)`.
4. Duplicate-answer behavior.
5. Retraction or rebuilding after removing `edge(c,d)`.
6. A bounded negative query.

## Building an SBCL executable image

`4_main.lisp`:

```lisp
(in-package #:dl7-logic-lab)

(defun main ()
  (handler-case
      (progn
        (run-probe)
        (uiop:quit 0))
    (error (condition)
      (format *error-output* "ERROR ~A~%" condition)
      (uiop:quit 1))))
```

`build.lisp`:

```lisp
(require :asdf)
(asdf:load-asd (merge-pathnames "lab.asd" *load-truename*))
(asdf:load-system "dl7-logic-lab")
(sb-ext:save-lisp-and-die
 "dl7-logic-lab"
 :executable t
 :toplevel #'dl7-logic-lab:main
 :save-runtime-options t)
```

Build and inspect:

```sh
sbcl --noinform --disable-debugger --load build.lisp
stat -f '%z bytes' dl7-logic-lab
/usr/bin/time -p ./dl7-logic-lab
file dl7-logic-lab
otool -L dl7-logic-lab
```

Measure:

- executable bytes
- dynamic library dependencies from `otool -L`
- wall time for five independent invocations
- peak resident set size from `/usr/bin/time -l`
- whether source loading or compilation remains available in the saved image

SBCL's [`save-lisp-and-die`](https://www.sbcl.org/manual/#Function-sb_002dext_003asave_002dlisp_002dand_002ddie) writes the runtime and Lisp image into an executable. ECL can translate Lisp to C/object files and build static libraries, shared libraries, and executables.

## Common failure table

| Symptom | Mechanical cause | Check |
| --- | --- | --- |
| `Package ... does not exist` | dependency loaded after a file was read | load dependency system before reading dependent source |
| symbol exists but call is undefined | package export or package qualification mismatch | inspect `find-symbol` and use `package:symbol` |
| ASDF cannot find system | source registry lacks the checkout | load the exact `.asd` pathname |
| stack overflow on cyclic path | depth-first recursion lacks tabling or visited-state | classify engine semantics and add a bounded adapter only when the lab permits it |
| duplicate answers | search enumerates proof paths | deduplicate at the adapter boundary and report that cost |
| executable starts in debugger | unhandled condition or missing top-level quit | use `handler-case`, `--disable-debugger`, and `uiop:quit` |
| saved image is unexpectedly large | SBCL preserves the runtime and reachable image | compare stripped and unstripped sizes; record both commands |

## Phase-0 compiler boundary

A Common Lisp front end can expose this interface:

```text
read-source : bytes -> syntax-objects
expand      : syntax-objects -> core-forms
lower       : core-forms -> logic-program
encode      : logic-program -> stable interchange
```

The interchange must preserve:

- source file, line, column, and byte range
- symbol package or lexical scope identity
- logic variable identity
- constructor and argument order
- facts, rules, polarity, and requested outputs
- cyclic term policy

Pass structured terms or a versioned serialized graph across the runtime boundary. Generated Prolog source text adds a second parser and makes variable identity depend on spelling.
