---
name: dioxus-dom-patterns
description: Practical DOM patterns in Dioxus translated from React/RxJS/JS -- controlled inputs, lists, modals, portals, refs, focus, scroll, clipboard, drag-drop, debounce, throttle, intersection observer, resize observer, media queries, local storage sync, undo/redo, optimistic UI, infinite scroll, virtual lists. Trigger on dioxus dom, dioxus patterns, dioxus react equivalent, dioxus howto, dioxus controlled input, dioxus modal, dioxus ref, dioxus focus, dioxus scroll, dioxus clipboard, dioxus debounce, dioxus throttle, dioxus infinite scroll, dioxus undo redo.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Practical DOM patterns translated from React/RxJS/JS to Dioxus 0.7. Each section shows the JS pattern, then the Dioxus equivalent. Focuses on the extension/web target but most patterns work cross-platform.

---

## Controlled Inputs

React has controlled vs uncontrolled. Dioxus inputs are uncontrolled by default (the DOM owns the value). To control:

```tsx
// React
const [name, setName] = useState("");
<input value={name} onChange={e => setName(e.target.value)} />
```

```rust
// Dioxus
let mut name = use_signal(String::new);
rsx! {
    input {
        value: "{name}",
        oninput: move |e| name.set(e.value()),
    }
}
```

### Textarea, Select, Checkbox

```rust
let mut text = use_signal(String::new);
let mut selected = use_signal(|| "a".to_string());
let mut checked = use_signal(|| false);

rsx! {
    textarea { value: "{text}", oninput: move |e| text.set(e.value()) }

    select {
        value: "{selected}",
        onchange: move |e| selected.set(e.value()),
        option { value: "a", "Option A" }
        option { value: "b", "Option B" }
    }

    input {
        r#type: "checkbox",
        checked: "{checked}",
        onchange: move |_| checked.toggle(),
    }
}
```

Note: `type` is a Rust keyword, so use `r#type`.

---

## Two-Way Binding Shorthand

Dioxus doesn't have `v-model` or `ngModel`. The `value` + `oninput` pair is the pattern. Extract a helper if it recurs:

```rust
// Not a component -- just a macro or inline pattern you repeat.
// There's no built-in shorthand. The oninput/value pair IS the idiom.
```

---

## Conditional Rendering

```tsx
// React
{isLoading ? <Spinner /> : <Content />}
{error && <Error msg={error} />}
```

```rust
// Dioxus -- if/else directly in rsx
rsx! {
    if is_loading() {
        Spinner {}
    } else {
        Content {}
    }
    if let Some(err) = error() {
        Error { msg: err }
    }
}
```

No ternary gymnastics. `if let` for `Option`/`Result` destructuring inline.

---

## Lists and Keys

```tsx
// React
{items.map(item => <Item key={item.id} data={item} />)}
```

```rust
// Dioxus
rsx! {
    for item in items() {
        Item { key: "{item.id}", data: item }
    }
}
```

Keys are optional in Dioxus (template diffing handles position), but provide them for collections where items reorder or get removed -- same reason as React.

---

## Refs / Direct DOM Access

React's `useRef` for DOM node access maps to `use_signal` holding an `Option<MountedData>`:

```tsx
// React
const inputRef = useRef(null);
useEffect(() => inputRef.current?.focus(), []);
<input ref={inputRef} />
```

```rust
// Dioxus
let mut input_ref = use_signal(|| None::<MountedData>);

use_effect(move || {
    if let Some(el) = input_ref() {
        el.set_focus(true);
    }
});

rsx! {
    input { onmounted: move |e| input_ref.set(Some(e.data())) }
}
```

`onmounted` fires once when the element enters the DOM. `MountedData` gives you:
- `set_focus(bool)` -- focus/blur
- `get_client_rect()` -- bounding box (async, returns `Rect`)
- `scroll_to(behavior)` -- scroll element into view
- `get_raw_element()` -- raw `web_sys::Element` escape hatch (web only)

---

## Focus Management

```rust
let mut input_ref = use_signal(|| None::<MountedData>);

// Focus on mount
use_effect(move || {
    if let Some(el) = input_ref() {
        el.set_focus(true);
    }
});

// Focus on button click
rsx! {
    input { onmounted: move |e| input_ref.set(Some(e.data())) }
    button {
        onclick: move |_| async move {
            if let Some(el) = input_ref() {
                el.set_focus(true);
            }
        },
        "Focus input"
    }
}
```

### Focus trap (modal)

```rust
#[component]
fn Modal(children: Element, onclose: EventHandler) -> Element {
    let mut container = use_signal(|| None::<MountedData>);

    use_effect(move || {
        if let Some(el) = container() {
            el.set_focus(true);
        }
    });

    rsx! {
        div {
            class: "modal-backdrop",
            onclick: move |_| onclose.call(()),
            div {
                class: "modal",
                tabindex: "0",
                onmounted: move |e| container.set(Some(e.data())),
                onclick: move |e| e.stop_propagation(),
                onkeydown: move |e| {
                    if e.key() == Key::Escape { onclose.call(()); }
                },
                {children}
            }
        }
    }
}
```

---

## Scroll

### Scroll to element

```rust
let mut target = use_signal(|| None::<MountedData>);

rsx! {
    button {
        onclick: move |_| async move {
            if let Some(el) = target() {
                el.scroll_to(ScrollBehavior::Smooth).await.ok();
            }
        },
        "Scroll to section"
    }
    div { onmounted: move |e| target.set(Some(e.data())), "Target section" }
}
```

### Scroll position tracking

```rust
let mut scroll_y = use_signal(|| 0.0);

rsx! {
    div {
        class: "scrollable",
        onscroll: move |e| async move {
            let data = e.data();
            // ScrollData doesn't expose position directly in all cases.
            // Escape hatch to web_sys:
        },
    }
}

// Alternative: raw JS interop for scroll position
use_future(move || async move {
    let window = web_sys::window().unwrap();
    // poll or listen via addEventListener
});
```

### Scroll to top on route change

```rust
#[component]
fn ScrollToTop() -> Element {
    let route = use_route::<Route>();

    use_effect(move || {
        let _ = route;  // subscribe
        web_sys::window().unwrap().scroll_to_with_x_and_y(0.0, 0.0);
    });

    rsx! { Outlet::<Route> {} }
}
```

---

## Clipboard

```rust
rsx! {
    button {
        onclick: move |_| async move {
            let window = web_sys::window().unwrap();
            let clipboard = window.navigator().clipboard();
            let _ = wasm_bindgen_futures::JsFuture::from(
                clipboard.write_text("copied text")
            ).await;
        },
        "Copy"
    }
}
```

Or use the `dioxus-clipboard` crate for cross-platform.

---

## Keyboard Shortcuts / Global Key Listener

```rust
// Global keydown listener
use_future(move || async move {
    let (tx, mut rx) = futures::channel::mpsc::unbounded();
    let closure = Closure::wrap(Box::new(move |e: web_sys::KeyboardEvent| {
        tx.unbounded_send(e).ok();
    }) as Box<dyn FnMut(web_sys::KeyboardEvent)>);

    web_sys::window().unwrap()
        .add_event_listener_with_callback("keydown", closure.as_ref().unchecked_ref())
        .unwrap();
    closure.forget();

    while let Some(e) = rx.next().await {
        match e.key().as_str() {
            "k" if e.meta_key() || e.ctrl_key() => {
                // Cmd+K: open command palette
                show_palette.set(true);
            }
            "Escape" => show_palette.set(false),
            _ => {}
        }
    }
});
```

### On a specific element (no web_sys needed)

```rust
rsx! {
    div {
        tabindex: "0",  // make focusable
        onkeydown: move |e| {
            if e.key() == Key::Enter {
                // handle
            }
        },
    }
}
```

---

## Debounce

```tsx
// React + RxJS
const search$ = new Subject<string>();
const results$ = search$.pipe(debounceTime(300), switchMap(q => fetch(q)));
```

```rust
// Dioxus: coroutine as debounce operator
let mut results = use_signal(Vec::<SearchResult>::new);

let debounced_search = use_coroutine(move |mut rx: UnboundedReceiver<String>| async move {
    while let Some(query) = rx.next().await {
        // drain: keep only the latest value within the debounce window
        let mut latest = query;
        loop {
            match gloo_timers::future::TimeoutFuture::new(300)
                .race(rx.next())  // wait 300ms OR next value
            {
                // Got a newer value before timeout expired
                futures::future::Either::Right((Some(newer), _)) => latest = newer,
                // Timeout expired or channel closed -- fire the search
                _ => break,
            }
        }
        if let Ok(res) = search_api(&latest).await {
            results.set(res);
        }
    }
});

rsx! {
    input {
        oninput: move |e| debounced_search.send(e.value()),
    }
    for r in results() {
        div { "{r.title}" }
    }
}
```

Note: `futures::future::Either` from the `race` isn't exactly this API. The practical pattern uses `tokio::time::timeout` on server or manual timer logic in WASM. Simplified version:

```rust
let debounced_search = use_coroutine(move |mut rx: UnboundedReceiver<String>| async move {
    while let Some(query) = rx.next().await {
        let mut latest = query;
        // Drain all pending values, then wait 300ms for more
        loop {
            let timeout = gloo_timers::future::TimeoutFuture::new(300);
            futures::pin_mut!(timeout);
            match futures::future::select(rx.next(), timeout).await {
                futures::future::Either::Left((Some(newer), _)) => latest = newer,
                _ => break,
            }
        }
        if let Ok(res) = search_api(&latest).await {
            results.set(res);
        }
    }
});
```

---

## Throttle

Same coroutine pattern, different timing logic:

```rust
let throttled = use_coroutine(move |mut rx: UnboundedReceiver<Action>| async move {
    while let Some(action) = rx.next().await {
        handle_action(action).await;
        // ignore all values for 200ms
        gloo_timers::future::TimeoutFuture::new(200).await;
        // drain anything that came in during the wait
        while let Ok(Some(_)) = rx.try_next() {}
    }
});
```

---

## Intersection Observer (Lazy Load / Infinite Scroll)

No Dioxus wrapper. Use web_sys directly:

```rust
fn use_intersection_observer(
    mut visible: Signal<bool>,
) -> Signal<Option<MountedData>> {
    let target = use_signal(|| None::<MountedData>);

    use_effect(move || {
        let Some(mounted) = target() else { return; };
        let el = mounted.get_raw_element()
            .dyn_ref::<web_sys::Element>()
            .unwrap()
            .clone();

        let closure = Closure::wrap(Box::new(move |entries: js_sys::Array, _observer: JsValue| {
            let entry: web_sys::IntersectionObserverEntry = entries.get(0).unchecked_into();
            visible.set(entry.is_intersecting());
        }) as Box<dyn FnMut(js_sys::Array, JsValue)>);

        let observer = web_sys::IntersectionObserver::new(
            closure.as_ref().unchecked_ref()
        ).unwrap();
        observer.observe(&el);
        closure.forget();
    });

    target
}

// Usage
fn LazyImage(src: String) -> Element {
    let visible = use_signal(|| false);
    let target = use_intersection_observer(visible);

    rsx! {
        div {
            onmounted: move |e| target.set(Some(e.data())),
            if visible() {
                img { src: "{src}" }
            } else {
                div { class: "placeholder", "..." }
            }
        }
    }
}
```

### Infinite scroll

```rust
fn InfiniteList() -> Element {
    let mut items = use_signal(Vec::<Item>::new);
    let mut page = use_signal(|| 0);
    let loading = use_signal(|| false);
    let sentinel_visible = use_signal(|| false);
    let sentinel = use_intersection_observer(sentinel_visible);

    // Load next page when sentinel becomes visible
    use_effect(move || {
        if sentinel_visible() && !loading() {
            spawn(async move {
                loading.set(true);
                if let Ok(new_items) = fetch_page(page()).await {
                    items.write().extend(new_items);
                    page += 1;
                }
                loading.set(false);
            });
        }
    });

    rsx! {
        div { class: "list",
            for item in items() {
                ListItem { data: item }
            }
            // Sentinel element at the bottom
            div {
                onmounted: move |e| sentinel.set(Some(e.data())),
                if loading() { "Loading..." }
            }
        }
    }
}
```

---

## Resize Observer

```rust
fn use_element_size() -> (Signal<Option<MountedData>>, Signal<(f64, f64)>) {
    let target = use_signal(|| None::<MountedData>);
    let size = use_signal(|| (0.0, 0.0));

    use_effect(move || {
        let Some(mounted) = target() else { return; };
        let el = mounted.get_raw_element()
            .dyn_ref::<web_sys::Element>()
            .unwrap()
            .clone();

        let closure = Closure::wrap(Box::new(move |entries: js_sys::Array, _: JsValue| {
            let entry: web_sys::ResizeObserverEntry = entries.get(0).unchecked_into();
            let rect = entry.content_rect();
            size.set((rect.width(), rect.height()));
        }) as Box<dyn FnMut(js_sys::Array, JsValue)>);

        let observer = web_sys::ResizeObserver::new(
            closure.as_ref().unchecked_ref()
        ).unwrap();
        observer.observe(&el);
        closure.forget();
    });

    (target, size)
}
```

---

## Media Queries

```rust
fn use_media_query(query: &str) -> Signal<bool> {
    let matches = use_signal(|| false);
    let query = query.to_string();

    use_future(move || {
        let query = query.clone();
        async move {
            let mql = web_sys::window().unwrap()
                .match_media(&query).unwrap().unwrap();
            matches.set(mql.matches());

            let (tx, mut rx) = futures::channel::mpsc::unbounded();
            let closure = Closure::wrap(Box::new(move |e: web_sys::MediaQueryListEvent| {
                tx.unbounded_send(e.matches()).ok();
            }) as Box<dyn FnMut(web_sys::MediaQueryListEvent)>);
            mql.add_listener_with_opt_callback(Some(closure.as_ref().unchecked_ref())).unwrap();
            closure.forget();

            while let Some(m) = rx.next().await {
                matches.set(m);
            }
        }
    });

    matches
}

// Usage
fn App() -> Element {
    let is_dark = use_media_query("(prefers-color-scheme: dark)");
    let is_mobile = use_media_query("(max-width: 768px)");

    rsx! {
        div { class: if is_mobile() { "compact" } else { "full" },
            "Dark mode: {is_dark}"
        }
    }
}
```

---

## Local Storage Sync

Signal that persists to localStorage and syncs across tabs:

```rust
fn use_persisted<T>(key: &str, default: T) -> Signal<T>
where T: Serialize + DeserializeOwned + Clone + PartialEq + 'static
{
    let key = key.to_string();
    let initial = gloo_storage::LocalStorage::get(&key).unwrap_or(default);
    let signal = use_signal(move || initial);

    // Write to storage on change
    let key_clone = key.clone();
    use_effect(move || {
        let val = signal();
        gloo_storage::LocalStorage::set(&key_clone, &val).ok();
    });

    // Listen for cross-tab storage events
    use_future(move || {
        let key = key.clone();
        async move {
            let (tx, mut rx) = futures::channel::mpsc::unbounded();
            let k = key.clone();
            let closure = Closure::wrap(Box::new(move |e: web_sys::StorageEvent| {
                if e.key().as_deref() == Some(&k) {
                    if let Some(val) = e.new_value() {
                        tx.unbounded_send(val).ok();
                    }
                }
            }) as Box<dyn FnMut(web_sys::StorageEvent)>);
            web_sys::window().unwrap()
                .add_event_listener_with_callback("storage", closure.as_ref().unchecked_ref())
                .unwrap();
            closure.forget();

            while let Some(raw) = rx.next().await {
                if let Ok(val) = serde_json::from_str::<T>(&raw) {
                    signal.set(val);
                }
            }
        }
    });

    signal
}

// Usage
let mut theme = use_persisted("theme", "dark".to_string());
```

---

## Undo / Redo

```rust
fn use_undoable<T: Clone + PartialEq + 'static>(initial: T) -> (Signal<T>, UndoHandle<T>) {
    let current = use_signal(move || initial.clone());
    let history = use_signal(move || vec![initial]);
    let index = use_signal(|| 0usize);

    let handle = UndoHandle { current, history, index };
    (current, handle)
}

#[derive(Clone, Copy)]
struct UndoHandle<T: Clone + 'static> {
    current: Signal<T>,
    history: Signal<Vec<T>>,
    index: Signal<usize>,
}

impl<T: Clone + PartialEq + 'static> UndoHandle<T> {
    fn set(&self, val: T) {
        let mut hist = self.history.write();
        let idx = (self.index)();
        hist.truncate(idx + 1);  // discard redo stack
        hist.push(val.clone());
        self.index.set(hist.len() - 1);
        self.current.set(val);
    }

    fn undo(&self) {
        let idx = (self.index)();
        if idx > 0 {
            self.index.set(idx - 1);
            self.current.set(self.history.read()[idx - 1].clone());
        }
    }

    fn redo(&self) {
        let idx = (self.index)();
        let len = self.history.read().len();
        if idx + 1 < len {
            self.index.set(idx + 1);
            self.current.set(self.history.read()[idx + 1].clone());
        }
    }

    fn can_undo(&self) -> bool { (self.index)() > 0 }
    fn can_redo(&self) -> bool { (self.index)() + 1 < self.history.read().len() }
}
```

---

## Optimistic UI

```rust
fn TodoList() -> Element {
    let mut todos = use_signal(Vec::<Todo>::new);

    let add_todo = move |text: String| async move {
        // Optimistic: add immediately with temp id
        let temp = Todo { id: uuid(), text: text.clone(), pending: true };
        todos.write().push(temp.clone());

        match api::create_todo(&text).await {
            Ok(real) => {
                // Replace temp with server response
                let mut t = todos.write();
                if let Some(pos) = t.iter().position(|t| t.id == temp.id) {
                    t[pos] = real;
                }
            }
            Err(_) => {
                // Rollback
                todos.write().retain(|t| t.id != temp.id);
            }
        }
    };

    rsx! {
        for todo in todos() {
            div {
                class: if todo.pending { "pending" } else { "" },
                "{todo.text}"
            }
        }
    }
}
```

---

## Portals (Render Outside Component Tree)

Dioxus doesn't have React's `createPortal`. For modals/tooltips that need to escape overflow:hidden ancestors, mount into a separate DOM node:

```rust
fn Portal(children: Element) -> Element {
    let mut container = use_signal(|| None::<web_sys::Element>);

    use_effect(move || {
        let doc = gloo_utils::document();
        let el = doc.create_element("div").unwrap();
        el.set_id("portal-root");
        doc.body().unwrap().append_child(&el).unwrap();
        container.set(Some(el));
    });

    // Dioxus 0.7 doesn't have a portal primitive.
    // Workaround: render a hidden marker and use web_sys to
    // manually reparent the DOM node.
    // This is a known gap -- track dioxus#1Portal issues.
    rsx! { {children} }
}
```

In practice for modals: use fixed positioning with high z-index rather than actual DOM reparenting. Works in 99% of cases without portal machinery.

---

## Drag and Drop

### HTML5 drag-drop

```rust
let mut dragging = use_signal(|| None::<usize>);
let mut items = use_signal(|| vec!["A", "B", "C", "D"]);

rsx! {
    for (i, item) in items().iter().enumerate() {
        div {
            draggable: "true",
            ondragstart: move |_| dragging.set(Some(i)),
            ondragover: move |e| e.prevent_default(),  // allow drop
            ondrop: move |_| {
                if let Some(from) = dragging() {
                    let mut list = items.write();
                    let val = list.remove(from);
                    list.insert(i, val);
                }
                dragging.set(None);
            },
            class: if dragging() == Some(i) { "dragging" } else { "" },
            "{item}"
        }
    }
}
```

---

## CSS Classes (Dynamic)

```rust
// Conditional single class
div { class: if active() { "tab active" } else { "tab" } }

// Multiple conditions
div {
    class: format!(
        "card {} {}",
        if selected() { "selected" } else { "" },
        if error() { "error" } else { "" },
    ),
}

// Or build a string
let mut classes = vec!["card"];
if selected() { classes.push("selected"); }
if error() { classes.push("error"); }
div { class: classes.join(" ") }
```

No `classnames` or `clsx` crate needed -- format strings and vecs do the job.

---

## Inline Styles (Dynamic)

```rust
div {
    style: format!(
        "transform: translateX({}px); opacity: {}",
        offset(),
        if visible() { 1.0 } else { 0.0 },
    ),
}
```

---

## Intervals and Timers

```rust
// setInterval equivalent
use_future(move || async move {
    loop {
        gloo_timers::future::TimeoutFuture::new(1_000).await;
        count += 1;
    }
});

// setTimeout equivalent
use_future(move || async move {
    gloo_timers::future::TimeoutFuture::new(5_000).await;
    show_toast.set(false);
});

// clearInterval equivalent: cancel the future
let handle = use_future(move || async move {
    loop {
        gloo_timers::future::TimeoutFuture::new(1_000).await;
        tick += 1;
    }
});
// later:
handle.cancel();  // drops the future, stops the loop
```

---

## Event Delegation and Bubbling

Dioxus events bubble like browser events:

```rust
rsx! {
    div {
        // catches clicks from any child
        onclick: move |e| {
            log::info!("clicked");
        },
        button { "A" }
        button { "B" }
        button { "C" }
    }
}
```

Stop propagation:
```rust
button {
    onclick: move |e| {
        e.stop_propagation();
        // parent's onclick won't fire
    },
}
```

---

## Async Event Handlers

Event handlers can be async -- Dioxus spawns them automatically:

```rust
button {
    onclick: move |_| async move {
        loading.set(true);
        let result = fetch_data().await;
        loading.set(false);
        data.set(result.ok());
    },
    if loading() { "Loading..." } else { "Fetch" }
}
```

No `spawn` wrapper needed. The async block is spawned on click.

---

## Pattern Summary: What Maps to What

| JS/React/RxJS | Dioxus |
|---|---|
| `useState` | `use_signal` |
| `useMemo` | `use_memo` |
| `useEffect` | `use_effect` |
| `useRef` (DOM) | `use_signal(None::<MountedData>)` + `onmounted` |
| `useRef` (mutable value) | `use_signal` (it's always mutable) |
| `useCallback` | not needed (signal handles are Copy) |
| `useContext` | `use_context::<Signal<T>>()` |
| `createPortal` | no equivalent, use fixed positioning |
| `forwardRef` | pass `Signal<Option<MountedData>>` as prop |
| `React.memo` | automatic (signal subscriptions) |
| `React.lazy` | `--wasm-split` (route-level) |
| `useReducer` | signal wrapping struct + methods |
| `useTransition` | no equivalent yet |
| `useDeferredValue` | no equivalent yet |
| `className={clsx(...)}` | `format!` or `vec![].join(" ")` |
| `style={{ color: x }}` | `style: format!(...)` |
| `dangerouslySetInnerHTML` | `dangerous_inner_html: "{html}"` |
| `BehaviorSubject` | `Signal<T>` |
| `Subject` | `use_coroutine` channel |
| `combineLatest` | `use_memo` reading multiple signals |
| `switchMap` | `use_resource` (auto-cancels) |
| `debounceTime` | `use_coroutine` with timer drain loop |
| `throttleTime` | `use_coroutine` with cooldown |
| `scan` | `use_signal` + `use_effect` accumulating |
| `tap` | `use_effect` |
| `interval()` | `use_future` with `loop { TimeoutFuture::new(n).await }` |
| `fromEvent` | `use_future` + `Closure::wrap` + `addEventListener` |
| `IntersectionObserver` | `web_sys::IntersectionObserver` in `use_effect` |
| `ResizeObserver` | `web_sys::ResizeObserver` in `use_effect` |
| `matchMedia` | `web_sys` + storage event listener |
| `localStorage` | `gloo_storage::LocalStorage` |
| `fetch` | `reqwest` or `gloo_net` |
| `WebSocket` | `gloo_net::websocket` or `use_websocket` (fullstack) |
| `AbortController` | drop the future |
| `addEventListener` (global) | `use_future` + `Closure::forget` |
| `setTimeout` | `gloo_timers::future::TimeoutFuture` |
| `clearTimeout` | `handle.cancel()` (drops the future) |
| `Promise.all` | `futures::join!` |
| `Promise.race` | `futures::select!` |

---

## The Escape Hatch

When Dioxus doesn't wrap a browser API, the path is always the same:

1. Get the raw element via `mounted.get_raw_element()` or `web_sys::window()`
2. Call the browser API through `web_sys` / `js_sys`
3. If callback-based, wrap in `Closure::wrap`, register, `.forget()`
4. Bridge results into a `Signal` via channel or direct `.set()`
5. Dioxus re-renders from the signal change

Every browser API is reachable. The tax is `Closure::forget` + `unwrap` noise.
