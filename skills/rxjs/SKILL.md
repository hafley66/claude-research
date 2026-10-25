---
name: rxjs
description: The subscription law for RxJS in this user's repositories. Read before writing any RxJS, any Observable, any signal pipeline, any epic, or any docs example that shows one. Use when writing, reviewing, or explaining reactive code.
---

# The subscription law

`.subscribe()` is `ReactDOM.render`.

It is the one call that turns a description into a running thing. React has exactly one
per application, at the root, in a file nobody edits. RxJS is the same and the ecosystem
forgot, so every library ships its own `.subscribe()` and every app ends up with two
hundred roots it cannot see.

This is not a style preference and it is not negotiable per file.

## 1. The law

| rule | consequence of breaking it |
| --- | --- |
| A library NEVER calls `.subscribe()` | the library owns a lifetime the caller cannot name, cancel, or compose |
| An application calls it ONCE, at its boundary | two calls means two roots and no single place that knows what is running |
| A docs example NEVER shows `.subscribe()` | the example teaches the defect |
| A test may subscribe, because the test IS the boundary | none |

If you are writing `.subscribe()` anywhere else, the pipeline was built forwards from
the input instead of backwards from the output. Stop and rebuild it backwards.

## 2. What replaces it

| you were about to write | write this |
| --- | --- |
| `source.subscribe(x => sideEffect(x))` | a plain React component that reads `source.$()`, tracked by the signals Vite plugin |
| `source.subscribe(x => this.value = x)` | `Signal(source)`, read `.$()` |
| a function taking a callback | a function taking and returning an Observable |
| `subscribe` inside a component | the framework's own boundary: `signalsJsx()`, `runWhenInView(source$)` |
| manual `unsubscribe()` bookkeeping | one `Subscription` at the boundary, or the host's teardown |

A callback parameter is the same defect wearing a different hat. `runWhenInView(source$)`
takes one argument for that reason: the moment it takes a callback, the caller starts
putting effects in the callback instead of in the stream, and the pipeline is forwards
again.

## 3. The effectful thing reads its inputs

Data never pushes an effect onto anything. The thing that has the effect (a DOM node, a table,
the URL, a file) is defined as a reader of its inputs, and listening to it is mounting it.

```tsx
// wrong: the effect is outside the description
rows$.subscribe(rows => table.render(rows))

// still wrong: `tap`, or `switchMap` with an effect inside, is the data stream acting on the table
rows$.pipe(tap(rows => table.render(rows)))

// right: a plain React component reads rows; the signals Vite plugin (`signalsJsx()`)
// tracks and memoizes the read, and React's one root applies it
function Table() { return <table>{rows.$().map(row => <Row row={row} />)}</table> }
```

A render is a projection: signal, `map` to a view, declarative `switchMap` for views that come
and go. The one root applies it. Calling setState in render, or mounting a second root
(`subscribe`, `ReactDOM.render`), is the same defect twice.

A URL-backed value is the URL reading its inputs, not a mirror that copies state into the URL.
Two-way bindings break the echo by tagging each change with its origin inside one fused source,
not with a boolean lock beside two subscriptions.

## 4. Define backwards

Start from the value and list everything that can change it, in its definition. Do not start from
the inputs and route them forward through a central reducer.

| rule | instead of |
| --- | --- |
| one state per independent moment; everything else derived or an event | a signal per field, synchronized |
| values produced by one event stay in one emission | splitting `{path, line}` into separate merges (emits twice, exposes `{new path, old line}`) |
| derived values are computed where they are read | a follower signal that only tracks another (state with no owner) |
| per-field "latest of" is `combineLatest`; name it or avoid it | `mergeByKeyScan` per field presented as something new |
| only APIs that exist; read the source before writing a call | inventing helpers, options or methods in a design sketch |

## 5. Where the boundary actually is

| kind of program | the one subscribe |
| --- | --- |
| browser app with JSX | `signalsJsx()` tracking, plus the root render |
| docs page or demo | `runWhenInView(source$)` |
| CLI | one `firstValueFrom` or one subscribe in `main` |
| test | the test body |
| library | NOWHERE. Return the Observable |

## 6. Reviewing

```bash
grep -rn "\.subscribe(" src/ examples/ docs/ demo/
```

Every hit outside the boundary is a defect with a name. In a library package the
expected count is zero. In `examples/`, `docs/` and `demo/` the expected count is zero.

## 7. Related

`@hafley66/signals` exists so that most pipelines never reach for `.subscribe()` at all:
`Signal(observable)` is a refCount-lazy node you read with `.$()`, and a nested path is
already a signal with the full RxJS surface on it. Reach for the signals skill for the
authoring conventions; this file is the one rule that sits above them.
