---
name: dioxus-advanced
description: Advanced Dioxus patterns -- async tasks, coroutines, server functions, Stores, custom hooks, custom renderers, performance characteristics, fullstack architecture. Trigger on dioxus async, dioxus coroutine, dioxus server function, dioxus stores, dioxus custom hook, dioxus renderer, dioxus performance, dioxus fullstack.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Advanced Dioxus patterns beyond basic components and signals: async primitives, server functions, Stores (0.7), custom hooks, custom renderers, and the performance model.

## Async Primitives

### use_resource

Spawns an async task tied to reactive dependencies. Reruns when tracked signals change. Cancels the previous future on re-run (switchMap semantics):

```rust
let user = use_resource(move || async move {
    fetch_user(user_id()).await
});
// user() -> Option<Result<User, Error>>
```

Resource handle methods:

| Method | Purpose |
|---|---|
| `.read()` | `Option<Result<T, E>>` -- `None` while pending |
| `.restart()` | Force-rerun the async closure |
| `.cancel()` | Cancel a running task |
| `.pause()` / `.resume()` | Pause/resume |
| `.clear()` | Clear value without stopping tasks |

### use_coroutine

Long-lived future with a channel for receiving messages. Survives re-renders. Cancelled on component unmount:

```rust
let chat = use_coroutine(|mut rx: UnboundedReceiver<ChatMsg>| async move {
    while let Some(msg) = rx.next().await {
        match msg {
            ChatMsg::Send(text) => { /* process */ }
        }
    }
});
chat.send(ChatMsg::Send("hello".into()));
```

Closest Dioxus primitive to an RxJS "effect service" / ngrx epic / redux-observable pattern. Processes messages sequentially by default. For cancellation of in-flight work, use `tokio::select!` or `AbortHandle`.

### spawn / spawn_forever

```rust
spawn(async { /* one-shot, cancelled on component unmount */ });
spawn_forever(async { /* survives unmount */ });
```

Both return a `Task` handle with `.cancel()`.

### use_future

Long-lived async task without a message channel:

```rust
use_future(move || async move {
    loop {
        // poll or stream processing
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
});
```

## Server Functions

The `#[server]` attribute creates type-safe RPC endpoints callable from client code. Arguments and return type must be `Serialize + Deserialize`:

```rust
#[server]
async fn get_posts() -> Result<Vec<Post>, ServerFnError> {
    let posts = db::get_all_posts().await?;
    Ok(posts)
}

// Client-side: just call it
let posts = get_posts().await?;
```

### 0.7 HTTP method attributes (Rocket-inspired)

```rust
#[get("/api/todos")]
async fn get_todos() -> Result<Vec<Todo>> { /* server only */ }

#[post("/api/todos")]
async fn create_todo(text: String) -> Result<Todo> { /* server only */ }
```

### Axum integration

Server functions run inside Axum. Extract headers, cookies, state:

```rust
#[server]
async fn check_auth() -> Result<User, ServerFnError> {
    let headers: http::HeaderMap = extract().await?;
    let token = headers.get("Authorization")
        .ok_or(ServerFnError::ServerError("No auth".into()))?;
    validate_token(token).await
}
```

### Middleware

```rust
#[middleware(auth_middleware)]
#[get("/api/protected")]
async fn protected_endpoint() -> Result<Data> { /* ... */ }
```

### Streaming responses

```rust
use server_fn::streaming::TextStream;

#[get("/api/stream")]
async fn stream_data() -> Result<TextStream> {
    Ok(TextStream::new(async_stream::stream! {
        for i in 0..10 {
            tokio::time::sleep(Duration::from_millis(500)).await;
            yield Ok(format!("chunk {i}\n"));
        }
    }))
}
```

Also supports `ByteStream`, `Streaming<T>`, and `JsonStream`.

## Stores (0.7)

New primitive for nested reactive state. Individual fields are independently reactive:

```rust
#[derive(Store)]
struct AppState {
    todos: Vec<Todo>,
    filter: Filter,
    user: Option<User>,
}

let store = use_store(|| AppState { /* ... */ });
let mut todos = store.todos();   // Store<Vec<Todo>>
let filter = store.filter();     // Store<Filter>

// Modifying todos doesn't re-render components that only read filter
todos.push(new_todo);
```

Stores are for client-side state shape management, not data fetching. Analogous to MobX observable objects or Svelte's `$state` runes.

## Custom Hooks

Compose by combining primitives:

```rust
fn use_debounced_signal<T: Clone + 'static>(
    initial: T,
    delay_ms: u64,
) -> (Signal<T>, Signal<T>) {
    let raw = use_signal(|| initial.clone());
    let debounced = use_signal(|| initial);

    use_effect(move || {
        let val = raw();
        spawn(async move {
            tokio::time::sleep(Duration::from_millis(delay_ms)).await;
            debounced.set(val);
        });
    });

    (raw, debounced)
}
```

## Custom Renderers

The VirtualDom is renderer-agnostic. To build a custom renderer:

1. Implement `WriteMutations` trait -- receives DOM mutations (create element, set attribute, append child, remove, etc.)
2. Implement `HtmlEventConverter` -- translates platform events into Dioxus's unified event types

`dioxus-core` has zero web assumptions. Renderers exist for TUI, game engines (Bevy), and custom GPU pipelines.

## Performance Characteristics

### Template-based diffing

`rsx!` compiles templates at build time. Only dynamic slots are diffed. Static subtrees are never compared or re-allocated.

### Bump allocator

Inspired by Dodrio research. All VNode allocations in a bump arena, reset per diff cycle. Zero heap allocation in steady state.

### Subtree memoization

If props unchanged and no signals fired, entire subtree skipped. "Orders of magnitude" reduction for large trees.

### Signal batching

Multiple signal writes in the same synchronous block produce a single re-render.

### No stale closure problem

Signals are Copy handles. Reading always returns current value. No dependency arrays needed. No `useCallback` equivalent needed. The closure capture problem from React does not exist.

## Fullstack Architecture

### use_server_future (SSR-aware)

```rust
let post = use_server_future(move || get_post(id))?;
```

The `?` suspends rendering during SSR until resolved, then streams HTML to client.

### Suspense boundaries

```rust
SuspenseBoundary {
    fallback: |_| rsx! { p { "Loading..." } },
    ChildThatSuspends {}
}
```

### DioxusRouterExt

Mount Dioxus into an existing Axum router:

```rust
let app = Router::new()
    .serve_dioxus_application(ServeConfig::new(), App)
    .await;
```

### Launch configuration

```rust
LaunchBuilder::new()
    .with_cfg(server_only! {
        ServeConfig::builder()
            .router(|router| {
                router
                    .layer(AuthLayer::new(AuthConfig::default()))
                    .layer(SessionLayer::new(session_store))
            })
    })
    .launch(App);
```
