---
name: react-to-egui-mapping
description: Comprehensive concept mapping from React/Redux/RxJS/DOM/WebAPI to egui/Rust equivalents. Mental model translation for web developers moving to immediate-mode GUI. Trigger on react to egui, web to egui, react equivalent egui, redux egui, rxjs rust, dom to egui, web developer egui, react rust mapping.
license: MIT
metadata:
  audience: developers
  workflow: egui-development
---

## What this covers

Direct concept mapping from the React/Redux/RxJS/DOM/WebAPI mental model to egui/Rust. Not "how to use egui" but "what replaces what" for someone who thinks in web primitives.

---

## Core rendering model

| Web | egui | Notes |
|---|---|---|
| Virtual DOM diffing | No diffing. Rebuild entire UI every frame (~16ms budget) | egui is immediate mode: `fn update()` runs 60fps, returns shapes to render |
| `ReactDOM.render(tree)` | `App::update(&mut self, ctx, frame)` | Your update fn IS the render |
| JSX elements | `ui.label()`, `ui.button()`, `ui.horizontal()` | Function calls instead of markup. Return values are `Response` (interaction state) |
| Component tree | Nested `ui.horizontal(|ui| { ui.vertical(|ui| { ... }) })` | Closures replace component hierarchy |
| `key` prop | `egui::Id` | Unique identity for animation, state, and focus tracking |
| Reconciliation | Not needed | No previous tree exists to diff against |

### The fundamental shift

React: **declare desired tree** -> framework diffs -> patches DOM -> browser paints
egui: **emit draw commands** -> tessellator triangulates -> GPU renders

There is no intermediate representation. Your code IS the layout pass, the event dispatch, and the draw call list, all in one function.

---

## Component model

| React | egui | Notes |
|---|---|---|
| `function MyComponent(props)` | `fn my_widget(ui: &mut Ui, props: &MyProps)` | Free function. No lifecycle. |
| `class MyComponent` | `struct MyWidget` with `impl MyWidget { fn ui(&mut self, ui: &mut Ui) }` | Method on struct. Self IS the state. |
| Props (immutable input) | Function parameters or `&self` fields | Same concept, less ceremony |
| `props.children` / render props | `fn show(self, ui: &mut Ui, content: impl FnOnce(&mut Ui))` | Wrapper struct calls `content(ui)` inside decoration -- FormField/Card pattern |
| Reusable component (props pattern) | `struct MyWidget { ... }` + `impl egui::Widget for MyWidget` | Builder methods set fields, `ui.add(MyWidget::new(...).loading(true))` is the call site |
| `React.memo()` | Not needed | No previous render to compare against. If you skip the call, it doesn't render. |
| `React.lazy()` | Just don't call the function until needed | No bundle splitting concept |
| HOC / render props | Generic functions, trait objects | `fn wrapper(ui: &mut Ui, content: impl FnOnce(&mut Ui))` |
| Context API | Pass `&mut AppState` down, or store in `ctx.data()` | No provider/consumer ceremony |
| Error boundary | `std::panic::catch_unwind` (rare) | Rust's type system prevents most runtime errors |
| Portal | `egui::Area` or `egui::Window` (floating, positioned anywhere) | Escapes the layout parent |
| Fragment (`<>`) | Just call multiple widgets sequentially | No wrapper needed |

### Custom widget pattern

```rust
// React: function TextBadge({ text, color }) { return <span>...</span> }
// egui: free function form
fn text_badge(ui: &mut Ui, text: &str, color: Color32) -> Response {
    let (rect, response) = ui.allocate_exact_size(Vec2::new(60.0, 20.0), Sense::hover());
    if ui.is_rect_visible(rect) {
        ui.painter().rect_filled(rect, 4.0, color);
        ui.painter().text(rect.center(), Align2::CENTER_CENTER, text, FontId::default(), Color32::WHITE);
    }
    response
}

// React: <PrimaryButton loading={isSaving} disabled={!formValid}>Submit</PrimaryButton>
// egui: Widget trait + builder = reusable component with props
struct PrimaryButton<'a> { label: &'a str, loading: bool, disabled: bool }
impl<'a> PrimaryButton<'a> {
    fn new(label: &'a str) -> Self { Self { label, loading: false, disabled: false } }
    fn loading(mut self, v: bool) -> Self { self.loading = v; self }
    fn disabled(mut self, v: bool) -> Self { self.disabled = v; self }
}
impl egui::Widget for PrimaryButton<'_> {
    fn ui(self, ui: &mut egui::Ui) -> egui::Response {
        let text = if self.loading { "Loading..." } else { self.label };
        ui.add_enabled(!self.disabled && !self.loading, egui::Button::new(text))
    }
}
// Call site reads like JSX props:
ui.add(PrimaryButton::new("Submit").loading(is_saving).disabled(!form_valid));
```

---

## State management

| React/Redux | egui/Rust | Notes |
|---|---|---|
| `useState(initial)` | Field on your `App` struct | `struct App { count: i32 }` -- mutate directly in `update()` |
| `useReducer(reducer, init)` | `match action { ... }` on an enum | No framework needed, just Rust enums |
| Redux store | Your `App` struct IS the store | Single source of truth, no dispatch ceremony |
| `dispatch(action)` | `self.count += 1` | Direct mutation. No indirection. |
| Redux selectors | Just read `self.whatever` | No memoization layer needed |
| Redux middleware | Not a concept | Side effects happen inline or in background threads |
| Immer (immutable updates) | `&mut self` | Rust's ownership gives you safe mutation without immutability theater |
| `useContext` | `ctx.data()` for transient, or pass `&mut State` | `ctx.data_mut(|d| d.insert_temp(id, value))` |
| `useRef` | Field on struct (persists across frames) | Everything on `self` persists |
| `useMemo` | `FrameCache` | `ctx.memory_mut(|m| m.caches.cache::<MyCache>().get(input))` -- evicts unused entries each frame |
| `useCallback` | Not needed | No reference equality problem. Functions don't cause re-renders. |
| Zustand/Jotai (atoms) | Fields on App struct, or `Arc<Mutex<T>>` for cross-thread | No subscription model needed in immediate mode |
| Recoil (derived state) | Compute in `update()` | Derived values are just expressions |

### State persistence

| Web | egui |
|---|---|
| `localStorage` | `eframe::Storage` (auto-serializes `App` via serde) |
| `sessionStorage` | `ctx.data_mut(|d| d.insert_temp(id, val))` |
| IndexedDB | SQLite via `rusqlite`, or filesystem |
| URL params / hash | CLI args, or config file |

---

## Lifecycle and effects

| React | egui | Notes |
|---|---|---|
| `useEffect(() => { ... }, [])` (mount) | Logic in `App::new()` or `CreationContext` callback | Runs once at startup |
| `useEffect(() => { ... }, [dep])` | Check in `update()`: `if self.dep_changed() { do_thing() }` | No hook system. You own the control flow. |
| `useEffect(() => { return cleanup }, [])` (unmount) | `impl Drop for App` | Rust RAII handles cleanup |
| `useLayoutEffect` | Not needed | Layout and render are the same pass |
| `componentDidCatch` | Not a concept | Type system prevents most issues |
| Cleanup / abort | `Drop` trait, or `AbortHandle` for async | Automatic with ownership |
| `requestAnimationFrame` | `ctx.request_repaint()` | Triggers next frame |
| `setTimeout` | `ctx.request_repaint_after(Duration::from_millis(500))` | Schedules future frame |
| `setInterval` | `ctx.request_repaint()` every frame + check elapsed time | Or use a background thread with channel |

### "When did X change" pattern

```rust
// React: useEffect(() => { doThing() }, [value])
// egui: track previous value yourself
struct App {
    value: String,
    prev_value: String,
}

fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
    if self.value != self.prev_value {
        self.do_thing();
        self.prev_value = self.value.clone();
    }
}
```

---

## Event handling

| DOM/React | egui | Notes |
|---|---|---|
| `onClick` | `response.clicked()` | `if ui.button("Go").clicked() { ... }` |
| `onDoubleClick` | `response.double_clicked()` | |
| `onMouseEnter/Leave` | `response.hovered()` | True while pointer is over the widget |
| `onMouseMove` | `ctx.input(|i| i.pointer.hover_pos())` | Global pointer position |
| `onKeyDown` | `ctx.input(|i| i.key_pressed(Key::Enter))` | Per-frame key state |
| `onKeyDown` (held) | `ctx.input(|i| i.key_down(Key::Space))` | Continuous while held |
| `onChange` (input) | `ui.text_edit_singleline(&mut self.text)` | Mutates the string directly, returns Response |
| `onScroll` | `ctx.input(|i| i.smooth_scroll_delta)` | Or use `ScrollArea` widget |
| `onDrag` | `response.dragged()`, `response.drag_delta()` | Built-in drag detection |
| `onDrop` | `response.drag_stopped()` + check position | Or use `egui_dnd` crate |
| `onFocus/Blur` | `response.gained_focus()`, `response.lost_focus()` | |
| `onSubmit` (form) | Check `Key::Enter` pressed while text edit has focus | No form abstraction |
| `preventDefault()` | `response.consume()` or return modified event from grab callback | Rare in egui |
| `stopPropagation()` | Not a concept | No event bubbling. Each widget checks its own rect. |
| `addEventListener` (global) | `ctx.input(|i| ...)` | All input is available every frame |
| Touch events | `ctx.input(|i| i.pointer.any_pressed())` | Pointer abstraction covers mouse + touch |
| Clipboard paste | `ctx.input(|i| i.events)` -- look for `Event::Paste(text)` | |

### Event model difference

DOM: events bubble up the tree, handlers attached to nodes, async dispatch
egui: every widget checks the global input state each frame, no bubbling, no dispatch

```rust
// React: <button onClick={() => setCount(c + 1)}>+</button>
// egui:
if ui.button("+").clicked() {
    self.count += 1;
}
```

---

## Layout

| CSS/DOM | egui | Notes |
|---|---|---|
| `display: flex; flex-direction: column` | `ui.vertical(|ui| { ... })` | Default layout direction |
| `display: flex; flex-direction: row` | `ui.horizontal(|ui| { ... })` | |
| `flex-wrap: wrap` | `ui.horizontal_wrapped(|ui| { ... })` | |
| `justify-content` / `align-items` | `ui.with_layout(Layout::left_to_right(Align::Center), |ui| ...)` | Layout struct controls alignment |
| `gap` | `ui.spacing_mut().item_spacing = Vec2::new(8.0, 4.0)` | Global or per-scope |
| `padding` | `egui::Frame::none().inner_margin(8.0).show(ui, |ui| ...)` | Frame wraps content with margins |
| `margin` | `ui.add_space(8.0)` | Manual spacing between widgets |
| `width: 100%` | `ui.available_width()` then `ui.allocate_space()` | Or use `ui.expand_to_include_rect()` |
| `max-width` | `ui.set_max_width(400.0)` | |
| `min-height` | `ui.set_min_height(200.0)` | |
| `position: absolute` | `egui::Area::new(id).fixed_pos(pos).show(ctx, |ui| ...)` | Floating, outside normal flow |
| `position: fixed` | `egui::Window` or `egui::Area` | Always visible, positioned in screen space |
| `overflow: scroll` | `egui::ScrollArea::vertical().show(ui, |ui| ...)` | Horizontal, vertical, or both |
| `overflow: hidden` | `ui.set_clip_rect(rect)` | Clips children to rect |
| `z-index` | `egui::Order` / `LayerId` | `LayerId::new(Order::Foreground, id)` |
| Fixed HUD overlay (above everything) | `ctx.layer_painter(LayerId::new(Order::Foreground, id))` | Draws above all panels/widgets; no `Response`, hit test manually via `ctx.input(|i| i.pointer...)` |
| CSS Grid | `egui::Grid::new(id).show(ui, |ui| { ... ui.end_row(); })` | Simple grid. For CSS Grid semantics: `egui_taffy` |
| Flexbox (full spec) | `egui_flex` crate | grow/shrink/basis/wrap |
| `@media` queries | Check `ctx.screen_rect().width()` | Manual breakpoints |
| `transform: scale()` | `egui::Scene` with TSTransform | Zoom/pan container |
| `opacity` | `Color32::from_rgba_unmultiplied(r, g, b, alpha)` | Per-shape, not per-subtree |
| `visibility: hidden` | Don't call the widget, but `ui.allocate_space(size)` | Reserve space without rendering |
| `display: none` | Don't call the widget | Space not reserved |

### CSS-in-JS equivalent

```rust
// React: <div style={{ background: '#333', borderRadius: 8, padding: 16 }}>
// egui:
egui::Frame::none()
    .fill(Color32::from_gray(51))
    .rounding(8.0)
    .inner_margin(16.0)
    .show(ui, |ui| {
        ui.label("content");
    });
```

---

## Styling and theming

| CSS/React | egui | Notes |
|---|---|---|
| CSS classes | `egui::Style` / `egui::Visuals` | Global style object, no per-element classes |
| CSS variables | `DesignTokens` struct (Rerun pattern) | Your own struct, stored globally |
| `color` | `visuals.text_color()` or per-widget `RichText::new("x").color(c)` | |
| `background-color` | `Frame::none().fill(color)` | Per-container |
| `border` | `Frame::none().stroke(Stroke::new(1.0, color))` | |
| `border-radius` | `Frame::none().rounding(4.0)` or `Rounding { nw, ne, sw, se }` | Per-corner control |
| `font-size` | `RichText::new("text").size(16.0)` or `FontId::proportional(16.0)` | |
| `font-weight: bold` | `RichText::new("text").strong()` | |
| `font-family` | `ctx.set_fonts(FontDefinitions { ... })` | Register fonts at startup |
| Dark/light mode | `ctx.set_visuals(Visuals::dark())` / `Visuals::light()` | Or custom via `catppuccin-egui` |
| Styled-components | Not a pattern | Style is imperative, not declarative |
| Tailwind | Not a pattern | No utility class system |
| CSS transitions | `ctx.animate_bool(id, state)` | See egui-advanced-patterns skill |
| CSS animations | Manual with `ctx.input(|i| i.time)` | No keyframe syntax |
| `::before` / `::after` | Paint with `ui.painter()` before/after widget | Manual drawing |
| `box-shadow` | `Frame::none().shadow(Shadow { ... })` | `Shadow { offset, blur, spread, color }` |
| `:hover` state | `response.hovered()` | `if response.hovered() { /* change style */ }` |
| `:active` state | `response.is_pointer_button_down_on()` | |
| `:focus` state | `response.has_focus()` | |

---

## Async and data fetching

| Web/React | Rust/egui | Notes |
|---|---|---|
| `fetch()` / `axios` | `reqwest` crate (blocking or async) | |
| `async/await` | `tokio::spawn` or `std::thread::spawn` | egui update runs on main thread; async work goes elsewhere |
| `useQuery` (react-query) | Background thread + `Arc<Mutex<Option<Result>>>` | Poll in `update()`, `request_repaint` when done |
| `useSWR` | Same pattern, add TTL logic | |
| `Promise` | `tokio::sync::oneshot` or `std::sync::mpsc` | Channel delivers result to main thread |
| `AbortController` | `tokio::CancellationToken` or `Arc<AtomicBool>` | Signal background work to stop |
| `WebSocket` | `tungstenite` or `tokio-tungstenite` | Background thread reads, sends to main via channel |
| `EventSource` (SSE) | `reqwest` streaming + channel | |
| `Worker` (Web Worker) | `std::thread::spawn` | Real OS threads, not message-passing sandboxes |
| `SharedArrayBuffer` | `Arc<Mutex<Vec<u8>>>` or `Arc<AtomicU64>` | Shared memory is the default, not the exception |

### Data fetching pattern

```rust
// React: const { data, loading } = useQuery('key', fetchFn)
// egui:
struct App {
    data: Option<MyData>,
    loading: bool,
    rx: Option<oneshot::Receiver<MyData>>,
}

fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
    // Check for completed fetch
    if let Some(rx) = &mut self.rx {
        if let Ok(data) = rx.try_recv() {
            self.data = Some(data);
            self.loading = false;
            self.rx = None;
        }
    }

    // Trigger fetch
    if ui.button("Load").clicked() {
        self.loading = true;
        let (tx, rx) = oneshot::channel();
        let ctx_clone = ctx.clone();
        std::thread::spawn(move || {
            let data = fetch_data(); // blocking
            tx.send(data).ok();
            ctx_clone.request_repaint(); // wake up the UI
        });
        self.rx = Some(rx);
    }
}
```

---

## RxJS to Rust channels

| RxJS | Rust | Notes |
|---|---|---|
| `Subject` | `mpsc::channel` (multi-producer, single-consumer) | |
| `BehaviorSubject` | `watch::channel` (tokio) or `Arc<Mutex<T>>` | Always has current value |
| `ReplaySubject` | `broadcast::channel` (tokio) with buffer | |
| `Observable.subscribe()` | `rx.recv()` or `rx.try_recv()` in update loop | Pull-based, not push-based |
| `pipe(map(...))` | `.map()` on iterator or channel | |
| `pipe(filter(...))` | `.filter()` on iterator | |
| `pipe(switchMap(...))` | Cancel previous task, spawn new one | `CancellationToken` + new `spawn` |
| `pipe(mergeMap(...))` | Spawn all, collect results | Multiple channels or `JoinSet` |
| `pipe(debounceTime(ms))` | Track `last_change: Instant`, check `elapsed() > threshold` | Manual in `update()` |
| `pipe(throttleTime(ms))` | Track `last_emit: Instant`, skip if too recent | Manual |
| `pipe(distinctUntilChanged())` | `if new_val != self.prev_val` | Manual comparison |
| `pipe(combineLatest(...))` | Multiple `Arc<Mutex<T>>` or struct fields | Just read all current values each frame |
| `pipe(withLatestFrom(...))` | Read the other value when the event fires | `if event { let other = self.other; }` |
| `pipe(takeUntil(stop$))` | `CancellationToken` or `Arc<AtomicBool>` | |
| `pipe(share())` | `broadcast::channel` or `Arc<Mutex<T>>` | Multiple readers |
| `timer(ms)` | `Instant::now()` + comparison each frame | Or `tokio::time::sleep` in background |
| `interval(ms)` | Check elapsed time each frame, or `tokio::time::interval` in background | |
| `fromEvent(element, 'click')` | `response.clicked()` checked each frame | No subscription needed |
| `merge(a$, b$)` | `select!` macro (tokio) or multiple `try_recv()` | |
| `concat(a$, b$)` | Sequential `.await` | |
| `forkJoin(a$, b$)` | `tokio::join!` or `futures::join!` | |

### Key mental model shift

RxJS: push-based streams with subscription lifecycle management
egui: pull-based polling each frame, no subscription concept

```rust
// RxJS: click$.pipe(debounceTime(200), switchMap(fetchData)).subscribe(setData)
// egui: in update()
if self.button_clicked {
    self.button_clicked = false;
    if self.last_click.elapsed() > Duration::from_millis(200) {
        // Cancel previous fetch if running
        if let Some(token) = self.cancel_token.take() { token.cancel(); }
        // Start new fetch
        let token = CancellationToken::new();
        self.cancel_token = Some(token.clone());
        let (tx, rx) = oneshot::channel();
        let ctx = ctx.clone();
        tokio::spawn(async move {
            tokio::select! {
                data = fetch_data() => { tx.send(data).ok(); ctx.request_repaint(); }
                _ = token.cancelled() => {}
            }
        });
        self.pending_rx = Some(rx);
    }
}
```

---

## DOM APIs

| DOM/WebAPI | egui/Rust | Notes |
|---|---|---|
| `document.getElementById` | `ui.id()`, `Id::new("name")` | For state lookup, not element access |
| `element.getBoundingClientRect()` | `response.rect` | Returns `Rect { min, max }` in screen coords |
| `element.style.x = y` | Modify `Style`/`Visuals` before widget call | Immediate mode: style before render |
| `element.classList.add()` | Not a concept | Style is inline/structural |
| `element.setAttribute()` | Not a concept | Widgets are function calls, not persistent nodes |
| `element.innerHTML` | Not a concept | No DOM to mutate |
| `document.createElement` | `ui.allocate_rect(rect, sense)` | Reserve screen space |
| `element.appendChild` | Call widget inside a layout closure | `ui.vertical(|ui| { ui.label("child"); })` |
| `element.remove()` | Don't call the widget | It simply doesn't exist next frame |
| `MutationObserver` | Compare state between frames | `if self.x != self.prev_x { ... }` |
| `IntersectionObserver` | `ui.is_rect_visible(rect)` | Visibility check |
| `ResizeObserver` | `ui.available_size()` changes each frame | Check in update |
| `window.innerWidth/Height` | `ctx.screen_rect()` | |
| `window.scrollTo` | `ScrollArea` with `scroll_to_cursor()` or `scroll_to_rect()` | |
| `window.requestAnimationFrame` | `ctx.request_repaint()` | |
| `navigator.clipboard` | `arboard` crate, or `ctx.output_mut(|o| o.copied_text = "x".into())` | |
| `console.log` | `println!()`, `dbg!()`, or `tracing` crate | |
| Canvas 2D API | `egui::Painter` | circle, rect, line, path, bezier, text |
| `ctx.fillRect()` | `painter.rect_filled(rect, rounding, color)` | |
| `ctx.arc()` | `painter.circle_filled(center, radius, color)` | |
| `ctx.bezierCurveTo()` | `painter.add(Shape::CubicBezier(...))` | |
| `ctx.fillText()` | `painter.text(pos, anchor, text, font_id, color)` | |
| `ctx.drawImage()` | `ui.image(texture_id, size)` | Register texture first |
| WebGL / WebGPU | wgpu via `PaintCallback` | See egui-advanced-patterns skill |

---

## Router / Navigation

| React Router | egui | Notes |
|---|---|---|
| `<Route path="/foo">` | `match self.current_page { Page::Foo => foo_ui(ui), ... }` | Enum dispatch |
| `useNavigate()` | `self.current_page = Page::Bar` | Direct state mutation |
| `useParams()` | Fields on the enum variant: `Page::Detail { id: u64 }` | |
| `<Link to="/foo">` | `if ui.link("Foo").clicked() { self.current_page = Page::Foo; }` | |
| `useLocation()` | `self.current_page` | Your enum IS the location |
| Route guards | `if !self.authenticated { return login_ui(ui); }` | |
| Nested routes | Nested match or delegate to sub-widget | |
| `egui_router` crate | SPA-style routing with transitions | If you want the full abstraction |

---

## Testing

| React Testing Library | Rust/egui |
|---|---|
| `render(<Component />)` | Create `App`, call `update()` with test `Context` |
| `screen.getByText("Hello")` | Assert on state, not on rendered output |
| `fireEvent.click(button)` | Set `self.button_state` directly, call update |
| `waitFor(() => ...)` | Not needed in sync tests. For async: `tokio::test` |
| Snapshot testing | `insta` crate for state snapshots |
| Visual regression | `wgpu-headless-testing` skill: render to texture, compare with `insta` |
| E2E (Cypress/Playwright) | Not standard. Test the data layer, not the UI frames. |

The general principle: test your state transitions and business logic. The UI is a pure function of state, so if the state is correct, the UI is correct. Don't screenshot-test unless you're testing the rendering pipeline itself.
