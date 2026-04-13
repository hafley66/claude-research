---
name: dioxus-vs-react
description: React vs Dioxus in-depth comparison -- component model, state management, effects, performance, ecosystem, SSR, what each does better. Trigger on dioxus react, react dioxus comparison, dioxus vs react, react equivalent dioxus, migrate react dioxus.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Honest, detailed comparison of React and Dioxus. Neither sugarcoated.

## Component Model

### Function components

```tsx
// React
function Counter({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

```rust
// Dioxus
#[component]
fn Counter(initial: i32) -> Element {
    let mut count = use_signal(|| initial);
    rsx! { button { onclick: move |_| count += 1, "{count}" } }
}
```

### Props differences

- React: TypeScript interfaces with `?` for optional
- Dioxus: `#[derive(Props)]` with `#[props(default)]`, auto-optional `Option<T>`, `#[props(!optional)]`, `#[props(into)]`
- Dioxus is more expressive for controlling call-site ergonomics

### Children

- React: `React.ReactNode` (polymorphic mess)
- Dioxus: `Element` prop. No `React.Children.map` or `toArray` needed.

### Conditional rendering

- React: ternaries, `&&`
- Dioxus: `if` expressions directly in `rsx!`. Cleaner.

### List rendering

- React: `.map()` with required `key`
- Dioxus: `for` loops in `rsx!`, keys optional (template diffing handles position). `.map()` also supported.

## State Management

### useState vs use_signal

| Aspect | React `useState` | Dioxus `use_signal` |
|---|---|---|
| Return shape | `[value, setter]` tuple | Copy signal handle |
| Write | `setCount(c => c + 1)` | `count += 1` (operator overloading) |
| Copy semantics | No (must capture in closures) | Yes (always Copy regardless of inner type) |
| Subscription | Component always re-renders on change | Only re-renders if signal was read during render |
| Stale closures | Pervasive footgun | Impossible (Copy handle, always reads current) |
| Batching | Event handler batching (React 18) | Scheduler-level batching |

### The stale closure problem: solved

```tsx
// React BUG: count is always 0 (stale closure)
useEffect(() => {
  const id = setInterval(() => console.log(count), 1000);
  return () => clearInterval(id);
}, []);
```

```rust
// Dioxus: always reads current value
use_future(move || async move {
    loop {
        println!("{}", count());  // Copy handle, current value
        sleep(Duration::from_secs(1)).await;
    }
});
```

### useReducer equivalent

No dedicated hook. Use a signal wrapping a struct with a `reduce` method. `match` gives exhaustive pattern matching on action enum.

### Context: simpler in Dioxus

```rust
// Provider
use_context_provider(|| Signal::new(Theme::Light));
// Consumer
let mut theme: Signal<Theme> = use_context();
```

No `createContext` factory, no `<Provider value={}>` wrapper component. Context values are typically signals, so consumers get fine-grained reactivity without `use-context-selector` hacks.

### Global state

```rust
static COUNT: GlobalSignal<i32> = Signal::global(|| 0);
static DOUBLED: GlobalMemo<i32> = Memo::global(|| COUNT() * 2);
```

No Redux, no providers, no selectors. A static and a memo. Done.

## Effects and Lifecycle

### useEffect vs use_effect

| Aspect | React | Dioxus |
|---|---|---|
| Dependencies | Manual array (error-prone) | Auto-tracked (reads detected at runtime) |
| Lint enforcement | `exhaustive-deps` ESLint rule | Not needed |
| Cleanup | Return cleanup function | `use_drop` or RAII via `Drop` trait |

### No useCallback needed

React: `useCallback` exists solely to maintain referential equality for `React.memo` children. Dioxus: event handlers capture Copy signal handles. Identity stable. `useCallback` has no reason to exist.

### Strict Mode

React: double-invokes renders and effects to surface impure code. Dioxus: Rust's type system catches those bugs at compile time. The compiler is the strict mode.

## Performance Model

### Diffing

- React: full virtual DOM tree diffed node-by-node on every render
- Dioxus: template-based. Static structure at compile time, only dynamic slots diffed. 50 static elements + 2 dynamic values = diff 2 slots, not 50+ nodes.

### Memoization

- React: requires `React.memo` + `useMemo` + `useCallback` to prevent unnecessary re-renders
- Dioxus: automatic via signal subscriptions. Components only re-render when signals they read change. No ceremony.

### Concurrent features

React 18 is ahead: `startTransition`, `useDeferredValue`, streaming Suspense. Dioxus has `Suspense` + `use_resource` but nothing equivalent to transition prioritization.

## Ecosystem and DX

| | React | Dioxus |
|---|---|---|
| Component libraries | Thousands (MUI, Radix, shadcn) | Handful (early stage) |
| Build tooling | Vite (subsecond HMR) | `dx` CLI (improving, still slower) |
| Hot reload | Instant (JS) | RSX: instant. Logic: recompile (improved with Subsecond, still slower) |
| DevTools | Excellent Chrome extension | Minimal |
| Testing | React Testing Library + Jest (mature) | Basic Rust testing (no equivalent to getByRole, userEvent) |
| Type system | TypeScript (structural, optional) | Rust (nominal, mandatory) |
| Documentation | Extensive, years of content | Sparse, sometimes outdated between versions |
| Community | Millions of developers | Thousands |

### TypeScript vs Rust for UI

Rust wins:
- Exhaustive `match` on enums (action types, routes)
- No null/undefined confusion (`Option<T>` explicit)
- No `any` escape hatch
- Generic components with trait bounds more principled

TypeScript wins:
- Structural typing = less boilerplate for props
- Template literal types, mapped types enable expressive UI patterns (Tailwind type completion)
- Faster iteration (type errors don't stop execution)

## SSR and Fullstack

| | React (Next.js) | Dioxus Fullstack |
|---|---|---|
| SSR | Mature, streaming, ISR | Functional (Axum-based) |
| Server Components | RSC (novel, reduces client JS) | No equivalent (server functions are RPC) |
| Code splitting | Mature (`React.lazy`, dynamic `import()`) | WASM splitting evolving, less mature |
| Hydration | Mature | Supported with suspense |

## What Dioxus Does Better

1. **Signals eliminate stale closures.** Entire debugging category gone.
2. **Auto-tracked dependencies.** No dependency arrays, no exhaustive-deps lint.
3. **Copy signals solve identity vs value.** No useCallback.
4. **Fine-grained reactivity without React.memo.** Less ceremony, better defaults.
5. **Template-based diffing.** Less runtime work.
6. **Exhaustive pattern matching.** Enums with `match` > TypeScript discriminated unions.
7. **No null/undefined split.** `Option<T>` is one concept.
8. **Multi-platform unified.** Web, desktop, mobile from same component model.
9. **Global signals are trivial.** No Redux/Zustand/provider ceremony.
10. **Compiler catches more bugs.** Ownership, lifetimes, type safety.

## What React Does Better

1. **Ecosystem size.** Not close. Need a date picker? React has 50 options. Dioxus has 0-1.
2. **Documentation.** Years of official docs, courses, Stack Overflow answers.
3. **Community size.** Millions vs thousands. Finding help, teammates, answers.
4. **DevTools.** Polished Chrome extension vs nothing.
5. **Iteration speed.** JS hot reloads logic instantly. Rust requires compilation.
6. **Concurrent rendering.** `startTransition`, `useDeferredValue` more mature.
7. **Code splitting.** JavaScript's dynamic `import()` far ahead of WASM.
8. **Server Components.** RSC is genuinely novel.
9. **CSS/styling ecosystem.** Vast vs limited.
10. **Testing.** React Testing Library is battle-tested and ergonomic.
11. **Learning curve.** Learn React in a week. Dioxus requires learning Rust first (months).
12. **API stability.** React stable for years. Dioxus pre-1.0, frequent breaking changes.

## Summary

Dioxus's reactive model is genuinely superior to React's hooks model in correctness and ergonomics. Signals + auto-tracking eliminates real bug categories. But React's ecosystem, community, tooling, and documentation advantage is enormous. The choice depends on whether framework engineering properties outweigh surrounding infrastructure for a given project.
