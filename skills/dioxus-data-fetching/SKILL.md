---
name: dioxus-data-fetching
description: Dioxus data fetching, APIs, WebSockets -- use_resource vs React Query/RTKQ, server functions, use_websocket, coroutines, streaming, polling, state sync, dioxus-query crate. Trigger on dioxus api, dioxus fetch, dioxus websocket, dioxus server function, dioxus data, dioxus http, dioxus query, dioxus streaming, dioxus polling.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Data fetching and real-time communication in Dioxus, mapped to React Query/RTK Query/RxJS patterns for developers coming from that world.

## use_resource -- Core Data Fetching

```rust
let dog = use_resource(move || async move {
    reqwest::get(format!("https://dog.ceo/api/breed/{}/images/random", breed()))
        .await?.json::<DogApi>().await
});

match &*dog.read() {
    Some(Ok(api)) => rsx! { img { src: "{api.message}" } },
    Some(Err(e)) => rsx! { p { "Error: {e}" } },
    None => rsx! { p { "Loading..." } },
}
```

Auto-reruns when any signal read inside the closure changes (reactive dependencies).

### vs React Query / RTK Query

| Concern | React Query / RTKQ | Dioxus `use_resource` |
|---|---|---|
| Caching | Built-in query cache by key | None. Value lives in Resource signal. |
| Staleness/refetch | `staleTime`, `refetchInterval`, `refetchOnWindowFocus` | Manual: `.restart()` or timer |
| Deduplication | Automatic across components | None. Each call independent. |
| Loading/error/success | `{ isLoading, isError, data, error }` | `Option<Result<T, E>>` pattern match |
| Mutations | `useMutation` | Async event handlers |
| Invalidation | `queryClient.invalidateQueries(['key'])` | `.restart()` or change a dependency signal |
| Optimistic updates | `onMutate` callback | Write signal before await, roll back on error |
| Reactive deps | `queryKey` array | Auto-tracked signal reads |

`use_resource` is closer to SolidJS's `createResource` than to React Query. It is a reactive async effect, not a cache manager.

## dioxus-query -- The React Query Gap Filler

github.com/marc2332/dioxus-query -- v0.9.2, supports Dioxus 0.7. Inspired by TanStack Query:

```rust
#[derive(Clone, PartialEq, Hash, Eq)]
struct GetUser(Captured<DbClient>);

impl QueryCapability for GetUser {
    type Ok = User;
    type Err = anyhow::Error;
    type Keys = UserId;

    async fn run(&self, user_id: &Self::Keys) -> Result<Self::Ok, Self::Err> {
        self.0.fetch_user(user_id).await
    }
}

let user = use_query(Query::new(id, GetUser(Captured(db_client))));

// Invalidation
QueriesStorage::<GetUser>::invalidate_matching(user_id).await;
```

Features: in-memory cache, manual invalidation, equality-based invalidation, concurrent queries, background re-execution. No window-focus invalidation yet.

## HTTP Client

Dioxus doesn't ship one. Standard: **reqwest** (auto-switches to WASM-compatible in wasm32):
```toml
reqwest = { version = "0.12", features = ["json"] }
```
Note: WASM mode lacks some features (TLS config, timeouts, blocking, cookie jar).

## Mutations

No built-in mutation hook. Pattern:

```rust
let on_submit = move |_| async move {
    // Optimistic update
    todos.push(optimistic_todo.clone());

    match create_todo(input()).await {
        Ok(real) => { /* replace optimistic */ }
        Err(_) => { todos.write().pop(); /* roll back */ }
    }
};
```

## Server Functions

### Basic
```rust
#[server]
async fn get_todos() -> Result<Vec<Todo>, ServerFnError> {
    let db = get_db_pool();
    sqlx::query_as!(Todo, "SELECT * FROM todos").fetch_all(&db).await?
}
```

### 0.7 HTTP method attributes
```rust
#[get("/api/todos")]
async fn get_todos() -> Result<Vec<Todo>> { /* ... */ }

#[post("/api/todos")]
async fn create_todo(text: String) -> Result<Todo> { /* ... */ }
```

### Extractors
```rust
#[server]
async fn check_auth() -> Result<User, ServerFnError> {
    let headers: http::HeaderMap = extract().await?;
    // access cookies, headers, DB connections via Axum extractors
}
```

### vs tRPC / RTKQ endpoints

| Concern | tRPC / RTKQ | Dioxus Server Functions |
|---|---|---|
| Type safety | TypeScript shared types | Rust types, same crate, compile-time |
| Transport | JSON over HTTP | Serde (PostCard, CBOR, URL encoding) |
| Code generation | Router + client generated | Macro generates Axum handler + client fetch |
| Error type | Typed error objects | `Result<T, ServerFnError>` |

## WebSockets

### 0.7: First-class use_websocket

Typed, fullstack WebSocket support:

```rust
// Shared types
#[derive(Serialize, Deserialize, Clone)]
enum ClientEvent { TextInput(String), Ping }

#[derive(Serialize, Deserialize, Clone, Debug)]
enum ServerEvent { Uppercase(String), Pong }

// Server handler
#[get("/api/ws?name&age")]
async fn ws_handler(
    name: String, age: i32, options: WebSocketOptions,
) -> Result<Websocket<ClientEvent, ServerEvent, CborEncoding>> {
    Ok(options.on_upgrade(move |mut socket| async move {
        while let Ok(ClientEvent::TextInput(text)) = socket.recv().await {
            socket.send(ServerEvent::Uppercase(text.to_uppercase())).await.ok();
        }
    }))
}

// Client
fn App() -> Element {
    let mut messages = use_signal(Vec::<ServerEvent>::new);
    let mut socket = use_websocket(|| ws_handler("User".into(), 25, WebSocketOptions::new()));

    use_future(move || async move {
        while let Ok(msg) = socket.recv().await {
            messages.push(msg);
        }
    });

    rsx! {
        p { "Status: {socket.status():?}" }
        input { oninput: move |e| async move {
            socket.send(ClientEvent::TextInput(e.value())).await.ok();
        }}
    }
}
```

Features: typed send/recv, pluggable encodings (CBOR, JSON, PostCard), connection status tracking.

### vs RxJS webSocket / socket.io

| Concern | RxJS / socket.io | Dioxus 0.7 |
|---|---|---|
| Send | `subject.next(msg)` | `socket.send(ClientEvent::...).await` |
| Receive | `subject.subscribe(msg => ...)` | `socket.recv().await` in `use_future` loop |
| Typed messages | Manual TS types | Compile-time via `Websocket<C, S, E>` |
| Reconnection | RxJS `retry()` / socket.io built-in | Not built-in. Manual loop with backoff. |
| Multiplexing | socket.io namespaces/rooms | Not built-in |

### Pre-0.7 coroutine approach

```rust
let ws = use_coroutine(move |mut rx: UnboundedReceiver<WsAction>| async move {
    let (mut write, mut read) = connect_ws("ws://...").await.split();
    // spawn reader, process outbound from channel
});
```

### Reconnection pattern
```rust
use_future(move || async move {
    loop {
        let mut socket = connect_ws().await;
        while let Ok(msg) = socket.recv().await { messages.push(msg); }
        tokio::time::sleep(Duration::from_secs(2)).await;  // backoff
    }
});
```

## Streaming (SSE-style)

Server-to-client unidirectional streams:
```rust
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
Also: `ByteStream`, `Streaming<T>`, `JsonStream`.

## Polling

```rust
use_future(move || async move {
    loop {
        match fetch_data().await {
            Ok(data) => signal.set(Some(data)),
            Err(e) => log::warn!("Poll failed: {e}"),
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
});
```

## State Sync / Invalidation

No built-in `invalidateQueries`. Patterns:

### Signal dependency
Change a signal the resource reads:
```rust
let mut revision = use_signal(|| 0u32);
let data = use_resource(move || async move {
    let _rev = revision();  // subscribe
    fetch_todos().await
});

// After mutation:
revision += 1;  // triggers re-run
```

### Manual restart
```rust
data.restart();
```

### dioxus-query
```rust
QueriesStorage::<GetUser>::invalidate_matching(user_id).await;
```

## JS Ecosystem Mapping Summary

| JS Concept | Dioxus Equivalent |
|---|---|
| `useQuery` / `createApi` | `use_resource` (basic) or `dioxus-query` (cached) |
| `useMutation` | Async event handlers + server functions |
| `invalidateQueries` | `resource.restart()`, signal bump, or `QueriesStorage::invalidate_matching` |
| `staleTime` / `refetchInterval` | `use_future` with `sleep` loop |
| tRPC procedures | `#[server]` / `#[get]` / `#[post]` functions |
| RxJS `webSocket()` | `use_websocket` (0.7) or `use_coroutine` + channel |
| socket.io reconnect | Manual loop with backoff in `use_future` |
| Redux/MobX stores | `use_signal` + `#[derive(Store)]` |
| React Query DevTools | Nothing equivalent yet |
| SSE | `TextStream` / `Streaming<T>` from server functions |
