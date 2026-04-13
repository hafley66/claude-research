---
name: dioxus-core
description: Dioxus fundamentals -- RSX macro, signals, hooks, component model, props, context, event handling, routing basics, virtual DOM diffing, bump allocator. Trigger on dioxus basics, dioxus components, dioxus signals, dioxus RSX, dioxus state, dioxus hooks, dioxus events, dioxus getting started.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Core Dioxus concepts for building cross-platform Rust GUI apps. Current stable: v0.7.3 (Jan 2026). 35.3k GitHub stars, 403 contributors. Targets web (WASM), desktop (webview or native), mobile (iOS/Android), SSR, and TUI from a single codebase.

## Component Model

Components are plain Rust functions returning `Element`. The `#[component]` macro generates a props struct from function arguments.

```rust
#[component]
fn Counter(initial: i32) -> Element {
    let mut count = use_signal(|| initial);
    rsx! {
        button { onclick: move |_| count += 1, "Count: {count}" }
    }
}
```

### Props

For manual control, derive `Props`:

```rust
#[derive(Props, PartialEq, Clone)]
struct CardProps {
    title: String,
    #[props(default)]
    subtitle: String,           // optional with Default::default()
    body: Option<String>,       // auto-optional (None if omitted)
    #[props(!optional)]
    explicit: Option<String>,   // required, must wrap in Some
    #[props(into)]
    converted: String,          // accepts anything implementing Into<String>
}
```

### Children

Passed as `Element` prop:

```rust
#[component]
fn Card(children: Element) -> Element {
    rsx! { div { class: "card", {children} } }
}
```

### Generic components

```rust
#[derive(PartialEq, Props, Clone)]
struct ListProps<T: Display + PartialEq + Clone + 'static> {
    items: Vec<T>,
}
```

## RSX Macro

Rust's JSX equivalent. Attributes before children. Control flow inline:

```rust
rsx! {
    div { class: "container",
        h1 { "Hello {name}" }
        if show_details {
            p { "Details here" }
        }
        for item in items.iter() {
            li { key: "{item.id}", "{item.name}" }
        }
        ChildComponent { some_prop: value }
    }
}
```

- No closing tags for self-closing elements
- `if` expressions work directly (no ternary needed)
- `for` loops work directly (no `.map()` needed, though it's supported)
- Fragments are implicit (multiple root elements allowed)
- Static template structure extracted at compile time

## Signals (State)

Signals are the core reactive primitive since 0.5. Key properties:

- **Always `Copy`** regardless of inner type (no clone/move friction)
- **Auto-tracked subscriptions**: reading in a component body subscribes it
- **Reading in event handlers or futures does NOT subscribe** the containing component

```rust
let mut count = use_signal(|| 0);
count += 1;                    // operator overloading for write
count.set(5);                  // direct set
count.write().push(x);        // mutate in place for collections
let val = count();             // read shorthand (sugar for .read())
```

### Derived state with use_memo

Re-runs only when tracked dependencies change. Deduplicates via `PartialEq` automatically (built-in `distinctUntilChanged`):

```rust
let doubled = use_memo(move || count() * 2);
```

### Side effects with use_effect

Runs after render. Auto-tracks dependencies. No dependency array needed:

```rust
use_effect(move || {
    log::info!("Count changed to {}", count());
});
```

### Global Signals

App-wide state without context plumbing:

```rust
static THEME: GlobalSignal<String> = Signal::global(|| "dark".to_string());
static DERIVED: GlobalMemo<String> = Memo::global(|| format!("theme: {}", THEME()));
```

## Context System

Scoped shared state (React Context equivalent):

```rust
// Provider (ancestor)
use_context_provider(|| Signal::new(AppState::default()));

// Consumer (any descendant)
let state: Signal<AppState> = use_context();
```

Idiomatic: put a `Signal<T>` into context for read+write access through interior mutability.

## Event Handling

Browser-like semantics with bubbling. Closures must be `'static`:

```rust
rsx! {
    button {
        onclick: move |evt: MouseEvent| {
            evt.stop_propagation();
            evt.prevent_default();
        },
        oninput: move |evt: FormEvent| {
            name.set(evt.value());
        },
    }
}
```

Async event handlers supported: return an async block and Dioxus spawns it.

## Component Lifecycle

Three phases:

1. **Mount**: `use_hook` runs initializer once on first render
2. **Update**: component function re-executes when subscribed signals change
3. **Unmount**: `use_drop(|| { /* cleanup */ })` runs on removal

Re-render triggers:
- A `Signal` read during last render is written to
- Parent re-renders with different props
- A `use_resource` or `use_memo` dependency produces a new value

Reads inside `use_effect`, `use_memo`, event handlers, and async tasks do NOT subscribe the containing component.

## Virtual DOM and Diffing

### Template-based diffing

The `rsx!` macro produces a `Template` struct at compile time describing static tree structure. At runtime, only dynamic slots are diffed. An `rsx!` block with 50 static elements and 2 dynamic values diffs 2 slots, not 50 nodes.

### Bump allocator

All VNode allocations happen in a bump arena, reset wholesale on each diff cycle. Near-zero allocation overhead in steady state.

### Subtree memoization

If a component's props haven't changed and no subscribed signals fired, the entire subtree is skipped during diffing.

### Mutation application

- Web: uses Sledgehammer (fast DOM mutation engine, nearly native JS speed)
- Desktop/liveview: binary protocol (not JSON), ~1/5 serialization time, ~1/2 latency vs JSON

## Routing Basics

Type-safe enum-based routing:

```rust
#[derive(Routable, Clone, PartialEq)]
enum Route {
    #[route("/")]
    Home {},
    #[route("/blog/:id")]
    BlogPost { id: i32 },
    #[route("/:..segments")]
    NotFound { segments: Vec<String> },
}
```

Supports static segments, dynamic params, catch-all, query params (`?:query&:page`), hash fragments (`#:section`). Navigation via `Link` component or `use_navigator()`.

See `dioxus-routing` skill for full routing reference.

## Version History

| Version | Date | Key additions |
|---|---|---|
| 0.5 | March 2024 | Signals, Copy semantics, auto-tracking |
| 0.6 | December 2024 | Blitz rewrite (Stylo), mobile CLI, hot-reload improvements |
| 0.7 | Late 2025 | Hot-patching (Subsecond), Dioxus Native (Blitz), Axum integration, fullstack WebSockets, auto Tailwind, scoped CSS, code splitting, Stores |
| 0.7.3 | Jan 2026 | CSS modules, auxclick/scrollend events, server-only extractors |
| 0.8 | Planned | Native APIs (camera, location, storage, OAuth), cross-platform unification, path toward 1.0 |
