---
name: dioxus-routing
description: Dioxus routing deep dive -- Routable derive, nested routes, layouts, navigation, auth guards, redirects, data loading, WASM code splitting, platform differences, route transitions. Trigger on dioxus routing, dioxus router, dioxus routes, dioxus navigation, dioxus nested routes, dioxus layout, dioxus auth guard, dioxus redirect.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Complete Dioxus routing reference. Type-safe enum-based routing with compile-time checked links and navigation. Updated March 2026 for Dioxus 0.7.3 stable.

## Routable Derive Macro

Each enum variant is a route. The macro generates parsing, matching, and rendering:

```rust
#[derive(Clone, Debug, PartialEq, Routable)]
enum Route {
    #[route("/")]
    Home {},
    #[route("/about")]
    About {},
}
```

Convention: variant name maps to a component function of the same name. Override with `#[route("/", MyComponent)]`.

### Available attributes

| Attribute | Purpose |
|---|---|
| `#[route("/path")]` | Matchable route rendering a component |
| `#[nest("/prefix")]` | Path prefix scope for subsequent variants |
| `#[end_nest]` | Closes nest scope |
| `#[layout(LayoutFn)]` | Wraps subsequent variants in layout component |
| `#[end_layout]` | Closes layout scope |
| `#[redirect("/path", \|params\| Route::Target {})]` | Redirect |
| `#[child]` | Nested child router enum (for modular routing with separate Routable enums) |

### Match order

static > dynamic > catch-all (most specific wins)

## Route Types

### Static
```rust
#[route("/about")]
About {},
```

### Dynamic parameters
Field type must implement `FromStr`:
```rust
#[route("/blog/:blog_id")]
BlogPost { blog_id: usize },

#[route("/user/:name")]
UserProfile { name: String },
```

### Catch-all
Captures remaining path into `Vec<String>`:
```rust
#[route("/:..segments")]
NotFound { segments: Vec<String> },
```

### Query parameters
After `?`, prefixed with `:`, separated by `&`:
```rust
#[route("/search?:query&:page")]
Search { query: String, page: i32 },
```
URL: `/search?query=rust&page=2`

Note: Query params are NOT part of the enum matching for route selection; they are accessed at runtime.

### Hash fragments
After `#:`:
```rust
#[route("/docs#:section")]
Docs { section: String },
```
Cannot appear inside `#[nest]` blocks. Managed through `dioxus-history` state.

## Link Component

Type-safe navigation:
```rust
Link { to: Route::Home {}, "Home" }
Link { to: Route::BlogPost { blog_id: 42 }, "Read Post 42" }
Link { to: "https://github.com", "GitHub" }  // external
```

## Nested Routes and Layouts

### Nesting with #[nest]

```rust
#[nest("/settings")]
    #[route("/")]
    SettingsIndex {},         // /settings/
    #[route("/password")]
    SettingsPassword {},      // /settings/password
#[end_nest]
```

Dynamic segments in nests propagate to children:
```rust
#[nest("/user/:user_id")]
    #[route("/posts")]
    UserPosts { user_id: usize },  // component receives user_id
#[end_nest]
```

### Modular routing with #[child]

Compose separate `Routable` enums for large apps:
```rust
#[derive(Routable)]
enum AdminRoute {
    #[route("/dashboard")]
    AdminDashboard {},
    #[route("/users")]
    AdminUsers {},
}

#[derive(Routable)]
enum Route {
    #[route("/")]
    Home {},
    #[child("/admin")]
    Admin { child: AdminRoute },
}
```

Confirmed working by maintainer (issue #5046, Dec 2025) but poorly documented.

### Layouts

Layout components render `Outlet::<Route> {}` where children appear:

```rust
#[layout(AppShell)]
    #[route("/")]
    Home {},

    #[nest("/blog")]
    #[layout(BlogLayout)]
        #[route("/")]
        BlogList {},
        #[route("/:id")]
        BlogPost { id: usize },
    #[end_layout]
    #[end_nest]
#[end_layout]

#[component]
fn AppShell() -> Element {
    rsx! {
        header { "Site Header" }
        nav { Link { to: Route::Home {}, "Home" } }
        main { Outlet::<Route> {} }
        footer { "Footer" }
    }
}

#[component]
fn BlogLayout() -> Element {
    rsx! {
        div { class: "blog-container",
            aside { "Sidebar" }
            div { Outlet::<Route> {} }
        }
    }
}
```

Layouts in nested dynamic segments receive those params:
```rust
#[nest("/org/:org_id")]
#[layout(OrgLayout)]
    #[route("/dashboard")]
    OrgDashboard { org_id: usize },
#[end_layout]
#[end_nest]

#[component]
fn OrgLayout(org_id: usize) -> Element {
    rsx! { h2 { "Org #{org_id}" } Outlet::<Route> {} }
}
```

## Navigation

### Programmatic
```rust
let nav = use_navigator();
nav.push(Route::Dashboard {});    // adds to history (back works)
nav.replace(Route::Login {});     // replaces current entry
nav.go_back();
nav.go_forward();
```

### Built-in components
```rust
GoBackButton { "Back" }
GoForwardButton { "Forward" }
```

### Reading current route
```rust
let current = use_route::<Route>();
```

## Auth Guards

No built-in route guard API (issue #1728, open). Pattern: check auth in a layout component:

```rust
#[component]
fn RequireAuth() -> Element {
    let auth = use_context::<Signal<AuthState>>();
    let nav = use_navigator();

    if !auth.read().is_authenticated {
        nav.replace(Route::Login {});
        return None;
    }

    rsx! { Outlet::<Route> {} }
}

// Wire into routes:
#[layout(RequireAuth)]
    #[route("/dashboard")]
    Dashboard {},
    #[route("/settings")]
    Settings {},
#[end_layout]
```

## Redirects

Declarative:
```rust
#[redirect("/home", || Route::Home {})]
#[redirect("/old-post/:id", |id: usize| Route::BlogPost { id })]
```

### Router-level on_update

Global route change interception:
```rust
Router::<Route> {
    config: move || {
        RouterConfig::default()
            .on_update(move |_state| {
                // Return Some(NavigationTarget) to redirect, None to proceed
                None
            })
    }
}
```

## Data Loading

No equivalent to React Router loaders/actions. Data loading is hook-based and component-scoped, not route-scoped:

### use_loader (new in 0.7, isomorphic)
```rust
#[component]
fn BlogPost(id: usize) -> Element {
    let post = use_loader(move || get_post(id))?;
    // Does not re-suspend on re-run (unlike use_server_future)
    rsx! { h1 { "{post.title}" } }
}
```

### use_server_future (fullstack, SSR-aware)
```rust
#[component]
fn BlogPost(id: usize) -> Element {
    let post = use_server_future(move || get_post(id))?;
    // ? suspends during SSR, streams result to client
    match &*post.read() {
        Some(Ok(post)) => rsx! { h1 { "{post.title}" } },
        Some(Err(e)) => rsx! { p { "Error: {e}" } },
        None => rsx! { p { "Loading..." } },
    }
}
```

### use_resource (client-side)
```rust
let user = use_resource(move || async move {
    reqwest::get(format!("/api/users/{user_id}")).await?.json::<User>().await
});
```

## Route Transitions (dioxus-motion)

Community library `dioxus-motion` v0.3.1:
```rust
#[derive(Routable, MotionTransitions, Clone, PartialEq)]
enum Route {
    #[transition(Fade)]
    #[route("/")]
    Home {},
    #[transition(SlideLeft)]
    #[route("/about")]
    About {},
}

// Use AnimatedOutlet instead of Outlet:
rsx! { AnimatedOutlet::<Route> {} }
```
Built-in: `Fade`, `ZoomIn`, `SlideLeft`, `SlideRight`, `SlideUp`, `SlideDown`.

Requires `transitions` feature on `dioxus-motion`.

## WASM Bundle Splitting (0.7)

Route-based code splitting, unique among Rust WASM frameworks (Leptos/Yew lack equivalent):

```toml
[dependencies]
dioxus-router = { version = "0.7", features = ["wasm-split"] }
```
```bash
dx build --wasm-split
```

Uses a custom `wasm-splitter` tool post-build. Trims module portions, reconnects via export/import maps at `#[wasm_split]` boundaries. Includes data section splitting and shared chunk extraction.

**Known issues:** Issue #4514 (splitter panic) fixed in PR #4584 (Aug 2025) by ensuring LTO and debug info enabled. Still requires explicit opt-in. No published performance benchmarks or real-world production usage reports as of early 2026.

## Hash Router (new in 0.7)

`#`-based URLs for static hosting deployment without server-side URL rewriting. Enabled in `dioxus-web` configuration.

## Error Boundaries

```rust
#[component]
fn AppLayout() -> Element {
    rsx! {
        ErrorBoundary {
            handle_error: |errors: ErrorContext| {
                rsx! { h1 { "Something went wrong" } }
            },
            Outlet::<Route> {}
        }
    }
}
```

In fullstack: `commit_error_status` sets HTTP status code (e.g., 500) while rendering fallback.

## Platform Differences

| Platform | History Backend | URL Bar |
|---|---|---|
| Web | Browser History API (WebHistory) | Yes |
| Desktop | In-memory (MemoryHistory) | No |
| Mobile | In-memory | No |
| SSR | Route from HTTP request URL | N/A |
| Liveview | LiveviewHistory (server+websocket) | Yes |

Same `Route` enum and components work across all platforms. The router abstracts the history provider.

## Known Issues and Community Pain Points

| Issue | Status | Summary |
|---|---|---|
| #5046 Nested Routable Enums | Open | `#[child]` exists but poorly documented |
| #3981 Parallel Routes | Open | Next.js-style parallel route segments |
| #1728 Protected/Conditional Routes | Open | No native route guard; must use layout pattern |
| #3986 Same route, different params | Open | Route doesn't reload when pushed with different parameters |
| #2368 Navigation state | Discussion | No way to know if route was reached via Link vs back button |

## 0.8 Outlook

No routing-specific items on the 0.8 roadmap. Routing is considered stable. 0.8 focuses on native platform APIs, Swift/Kotlin FFI, and DX tooling.
