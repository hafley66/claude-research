---
name: signals
description: Author and review applications using @hafley66/signals and RxJS, including recursive signal paths, automatic JSX tracking, cold producer connections, and resource lifetimes. Use when building or modifying consumers of this signals library.
---

# Signals application authoring

Apply these conventions to `@hafley66/signals` consumers. Inspect the installed package exports and the application's JSX configuration before changing integration code.

## Group state and use recursive paths

A signal is a recursively projected tree. Create roots around ownership and lifetime. Related controls and runtime fields belong together.

```ts
const values = Signal({ playback: { run: true, speed: 1 }, seed: 7 })

values.playback.run.$()       // read boolean
values.playback.run.$(false)  // write through to values
values.playback.run.$         // observable projection
values.playback.$()           // read the playback group
```

- Use existing nested paths directly. Each path already provides the signal interface, including reads, writes and RxJS operators.
- Do not allocate a new signal per field or wrap a path in another computed signal just to project it.
- Pass a consumer's existing signal or nested signal into a model. Keep that signal as the source of truth; do not copy it into controller-local state and subscribe to synchronize the copies.
- Separate roots when ownership or lifetime differs. Persistent section inputs and ephemeral animation output can have different owners.
- Derive types from the spec or root shape where possible. Avoid repeated interfaces that reproduce the same shape.

## Plain JSX components are the application surface

Enable the library's JSX interceptor in Vite:

```ts
import react from "@vitejs/plugin-react"
import { signalsJsx } from "@hafley66/signals/vite"

plugins: [react(), signalsJsx()]
```

Then read signals directly in ordinary components:

```tsx
function PlaybackStatus() {
  return <span>{values.playback.run.$() ? "playing" : "paused"}</span>
}
```

The interceptor redirects JSX runtime imports to the signals runtime. That runtime caches a `SignalReact` wrapper per function-component type. `SignalReact` is the tracking implementation behind this authoring surface; application components do not need handwritten wrappers or a subscription hook per field.

Verify that both development and production JSX output use the interceptor. Do not assume installation of the signals package enables it. Inspect `vite.config.*` and an actual browser build.

## Reads determine connections

```text
plain JSX reads signal.$()
  -> JSX tracker records the dependency
  -> renderer subscribes after commit
  -> Signal(observable) connects its cold source
  -> final observer leaves
  -> source finalization releases resources
```

- Use `Signal(source$, initialValue)` for observable-backed state. The initial value gives the first render a defined shape.
- React references the resulting signal. The tracker owns initialization and teardown of that observation.
- Do not call `.subscribe()` in application components or model factories to activate work. Do not hide such calls in a helper that components must start and stop.
- Do not use `useEffect` to connect streams, copy signals, register listeners, run animation clocks or synchronize producer output. Express those relationships in the observable graph.
- Keep manual subscription at an actual runtime boundary, such as the renderer's tracking implementation, a non-React program entry point, or a test harness simulating an observer.
- An ordinary `.$()` read outside tracked JSX is a synchronous read; it does not by itself subscribe an observable source. Check source-signal and computed-signal behavior separately.

## Express lifetimes in RxJS

Use cold producers, `defer`, `switchMap`, `scan`, `takeUntil`, `finalize`, and reference-counted sharing where their semantics fit the work.

- Acquire a resource when the source connects. Release it through the observable teardown or `finalize`.
- Express replacement and cancellation with operators. A changed element or request can select a new inner stream through `switchMap`.
- Native APIs without an RxJS producer can be adapted with `new Observable`. Return their teardown from that source constructor.
- Name repository-owned teardown `unsubscribe`; preserve native method names at their direct call sites.
- Use stable ref callbacks to write mounted DOM nodes into a grouped runtime signal. The node's observable projection selects its listeners or animation graph.
- A changing source read must release its previous resources. Unmount and a conditional render that stops reading a signal must both release the final connection.
- Share a producer when several projections observe it. Check actual subscription counts before adding another sharing layer; `Signal(observable)` already shares its source with reference counting.

A complete DOM producer can be written without a component effect:

```tsx
import { Signal } from "@hafley66/signals"
import { distinctUntilChanged, fromEvent, map, of, switchMap } from "rxjs"

function pointerModel() {
  const runtime = Signal({ element: null as HTMLElement | null })
  const pointer = Signal(runtime.element.$.pipe(
    distinctUntilChanged(),
    switchMap(element => element
      ? fromEvent<PointerEvent>(element, "pointermove").pipe(
          map(event => ({ x: event.clientX, y: event.clientY })),
        )
      : of({ x: 0, y: 0 })),
  ), { x: 0, y: 0 })
  return {
    runtime, pointer,
    ref(element: HTMLElement | null) { runtime.element.$(element) },
  }
}

const model = pointerModel() // one owner for this stage
function Stage() {
  return <div ref={model.ref}>{model.pointer.x.$()}, {model.pointer.y.$()}</div>
}
```

Choose instance ownership explicitly. Construct models once per intended owner, outside rendering or with stable instance allocation. Recreating the graph on every render changes its lifetime. React-local allocation does not require effect-based stream wiring.

## Derived values and events

- Use a nested path for a direct projection.
- Use `Signal(() => ...)` for a named, reused derived domain value; synchronous signal reads inside it discover dependencies.
- Use `signalMap` when an observable projection also depends on tracked signal reads.
- Use a bare `Signal<Event>()` for transient events when retained state would change semantics. Keep related retained event metadata in a grouped root.
- Keep frame progression in its producer. Saved position is persistent input; current playback position is ephemeral output. Write saved position on an explicit hold or seek, rather than on every frame.
- Use operators for temporal behavior instead of boolean flags and competing mirrored stores. State local to one subscription may live inside its `defer`/`scan` closure.

## Projection, distinctness and mutation

- Path access is the projection: `cursor.ref`, never `cursor.$.pipe(map(c => c.ref))`.
- Nested paths default to `distinctShallow` (`src/1_SignalCreator.ts:331`); set equality once on the root, children inherit it. Do not add `distinctShallow()` per call.
- Mutation lives on the accessor: `node.$.setImmer(recipe)` (`src/1_SignalCreator.ts:295`, `src/0_types.ts:39`). The node proxy carries only `$` and child paths.
- Event signals (`Signal()`) are edges. After hafley-rxjs PR #12: a memo that reads one is pushed a rerun on each write, sees each write once, and reads `undefined` on later runs; reads within one run agree. Before it: event reads are untracked and keep returning the last event (`src/1_SignalCreator.ts:280-282`). Every tree carries a surrogate `node.$.sid`.
- `distinct` is a `SignalCreatorOptions` field (`src/0_types.ts:297`); `node.$.pipe$(...)` inherits the node's slot. The `Signal(...)` overloads do not take it.
- Backwards exemplars in the source: `signalHistory` (`src/9_history.ts`: `Signal(history$.pipe(switchMap(locationOf)))`, the listener lives in the source), `createQuery` (`src/4_Query.ts:300`: `switchMap` over its input signal; `undefined` input means idle).
- Forward forms still in the source, not patterns to copy: `sync` (`src/8_sync.ts`), `storageSignal` (`src/6_Storage.ts`), `createSlice` epics re-dispatching through `tap` (`src/10_slice.ts:54-66`), `match$`/`switch$` subscribing per handler (`src/12_match.ts`), the module-level `signalDispatch.subscribe` in `src/3_react.ts:20`.

## Inspect and verify

Before implementation, identify the input/output signatures, model owner, observable activation, replacement conditions and final teardown. Identify which values are stored and which are projections.

Test the behavior that establishes the lifetime:

- Initial render connects an observed producer; an unread producer stays cold.
- Multiple readers share the intended resource.
- Dropping a dependency, replacing a node and unmounting release the corresponding resources.
- Grouped nested writes reach the same root and update the intended JSX readers.
- Pause, seek, cancellation and replay have deterministic event sequences.

Use a scheduler or controlled events for deterministic stream tests. Use the real JSX interceptor for renderer tests. Typechecking alone does not establish connection ownership.

The package's implementation references are `src/2_Signal.ts`, `src/1_SignalCreator.ts`, `src/3_react.ts`, `src/4_jsxAuto.ts`, and `src/vite-plugin.ts` in the source repository. Distributed builds expose the matching APIs through the package exports. Treat implementation limits as findings to report or fix in scope; do not substitute an imperative application architecture silently.
