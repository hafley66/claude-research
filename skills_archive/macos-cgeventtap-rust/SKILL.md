---
name: macos-cgeventtap-rust
description: macOS CGEventTap from Rust -- event tap setup, CFRunLoop integration, Fn callback workarounds, double-click detection, key simulation, teardown, permissions. Trigger on CGEventTap, event tap, CGEventTapCreate, input monitoring macos, keyboard hook macos, mouse hook macos rust.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Setting up macOS CGEventTap from Rust for system-wide keyboard/mouse interception. Covers the three Rust binding tiers, callback mutability constraints, threading model, double-click detection, key simulation (Cmd+C), and proper teardown.

## Crate tiers

| Crate | Approach | Notes |
|---|---|---|
| `core-graphics` (0.25) | Safe wrapper | `CGEventTap` struct, `Fn` callback, `CallbackResult` enum |
| `objc2-core-graphics` | Auto-generated bindings | `CGEvent::tap_create`. Used by rdev 0.5+ |
| Raw `extern "C"` | Direct FFI | Used by tauri-plugin-key-intercept, custom projects |

Higher-level: `rdev` (listen/grab/simulate, cross-platform), `enigo` (simulate only).

## Standard setup pattern

From rdev's internals (the canonical Rust implementation):

```rust
use objc2_core_graphics::*;
use core_foundation::runloop::*;

// 1. Store callback in static (Fn constraint workaround)
static mut GLOBAL_CALLBACK: Option<Box<dyn FnMut(Event)>> = None;

// 2. C callback matching CGEventTapCallBack
unsafe extern "C-unwind" fn raw_callback(
    _proxy: CGEventTapProxy,
    event_type: CGEventType,
    cg_event: NonNull<CGEvent>,
    _user_info: *mut c_void,
) -> *mut CGEvent {
    // Handle timeout re-enable
    if event_type == CGEventType::TapDisabledByTimeout {
        // Must re-enable the tap (see Teardown section)
        return cg_event.as_ptr();
    }
    // Convert event, invoke callback
    cg_event.as_ptr() // pass-through
}

// 3. Create tap
let tap = CGEvent::tap_create(
    CGEventTapLocation::HIDEventTap,        // system-wide
    CGEventTapPlacement::HeadInsertEventTap, // highest priority
    CGEventTapOptions::ListenOnly,           // or ::Default for grab
    mask,
    Some(raw_callback),
    null_mut(), // user_info
).ok_or("permission denied or tap creation failed")?;

// 4. Wire into CFRunLoop
let source = CFMachPort::new_run_loop_source(None, Some(&tap), 0)?;
let current_loop = CFRunLoop::current().unwrap();
current_loop.add_source(Some(&source), kCFRunLoopCommonModes);

// 5. Enable and block
CGEvent::tap_enable(&tap, true);
CFRunLoop::run(); // blocks forever
```

## Callback mutability patterns

The C callback is `extern "C" fn` -- no closure captures. Three approaches for mutable state:

**Pattern A: static mut** (rdev's approach)
```rust
static mut GLOBAL_CALLBACK: Option<Box<dyn FnMut(Event)>> = None;
// Simple, single-listener-at-a-time limitation
```

**Pattern B: Arc<Mutex<T>> via user_info** (recommended for multi-tap)
```rust
let state = Arc::new(Mutex::new(MyState::default()));
let user_info = Box::into_raw(Box::new(state.clone())) as *mut c_void;
// In callback: cast user_info back, lock, read/write
```

**Pattern C: Cell<T> for Copy types** (lightest for simple counters/coords)
```rust
// When the callback is wrapped by core-graphics as Fn (not FnMut):
let last_click = Cell::new(0u64);
// Cell gives interior mutability for Copy types without locking
```

**Pattern D: mpsc channel** (best for decoupling)
```rust
let (tx, rx) = std::sync::mpsc::channel();
// In callback: tx.send(event_data).ok();
// In worker thread: for event in rx { ... }
```

## Threading model

- CGEventTap does NOT require the main thread. Run it on a background thread.
- `CFRunLoop::run()` blocks the thread it's called on. Save the loop ref before calling run.
- The main thread stays free for UI (egui, winit, etc.)
- macOS Cocoa UI must run on the main thread. The event tap must NOT.

```rust
std::thread::Builder::new()
    .name("event-tap".into())
    .stack_size(4 * 1024 * 1024) // 4MB, tauri's approach
    .spawn(move || {
        // CGEventTapCreate + CFRunLoop setup
        CFRunLoop::run(); // blocks this thread
    })?;
// Main thread runs egui/UI
```

Communication: `mpsc::channel`, `crossbeam::channel`, or `Arc<Mutex<T>>`.

## Double-click detection

There is no `kCGEventDoubleClick`. macOS embeds click count in the event:

```rust
let click_count = cg_event.get_integer_value_field(CGEventField::MouseEventClickState);
// 1 = single, 2 = double, 3 = triple
if click_count == 2 {
    let location = cg_event.location(); // CGPoint { x, y }
    // Double-click at location
}
```

Event mask for mouse down only:
```rust
let mask = 1u64 << CGEventType::LeftMouseDown as u64;
```

System double-click interval: `NSEvent.doubleClickInterval` (~0.2s). If you need custom thresholds, compare timestamps between consecutive MouseDown events.

## Simulating Cmd+C

```rust
// Virtual keycodes: c=8, v=9, a=0, x=7
let event_down = CGEvent::new_keyboard_event(None, 8, true).unwrap();
event_down.set_flags(CGEventFlags::MaskCommand);
CGEvent::post(CGEventTapLocation::HIDEventTap, Some(&event_down));

let event_up = CGEvent::new_keyboard_event(None, 8, false).unwrap();
event_up.set_flags(CGEventFlags::MaskCommand);
CGEvent::post(CGEventTapLocation::HIDEventTap, Some(&event_up));
```

Or use `enigo` for cross-platform simulation:
```rust
let mut enigo = Enigo::new();
enigo.key(Key::Meta, Press);
enigo.key(Key::Unicode('c'), Click);
enigo.key(Key::Meta, Release);
```

## Event suppression (grab mode)

```rust
// Use CGEventTapOptions::Default (not ListenOnly) for grab
// In callback, to suppress an event:
CGEvent::set_type(Some(cg_event.as_ref()), CGEventType::Null);
// Still return cg_event.as_ptr() -- but it's neutered
```

The `core-graphics` crate's wrapper uses `CallbackResult::Keep` / `CallbackResult::Drop` / `CallbackResult::Replace(CGEvent)`.

## Teardown

Proper cleanup sequence:
1. `CGEventTapEnable(tap, false)` -- disable
2. `CFMachPortInvalidate(mach_port)` -- invalidate
3. `CFRunLoopStop(run_loop)` -- unblock the thread
4. Drop CFMachPort and CFRunLoopSource

To stop from another thread, save the run loop ref before `run()`:
```rust
let loop_ref = CFRunLoop::current().unwrap();
// Store in Arc<Mutex<Option<CFRunLoop>>>
// From shutdown thread:
CFRunLoop::stop(&loop_ref);
```

## Timeout re-enable (critical gotcha)

macOS disables taps whose callbacks take too long. The system sends `CGEventType::TapDisabledByTimeout`. You MUST handle this:

```rust
if event_type == CGEventType::TapDisabledByTimeout {
    CGEvent::tap_enable(&tap_ref, true); // re-enable
    return cg_event.as_ptr();
}
```

This requires the callback to have access to the tap's CFMachPort ref -- another argument for Arc<Mutex> via user_info.

## Permissions

- `CGEventTapCreate` with `DefaultTap` placement: requires **Accessibility** permission
- `CGEventTapCreate` with `ListenOnly`: requires **Input Monitoring** permission
- Returns `None` on permission denial -- silent failure, no error dialog
- Unsigned/ad-hoc signed apps can have taps silently disabled on launch (code signing race)
- Wrap setup in `NSAutoreleasePool::new()` to prevent ObjC object leaks

## Reference projects

| Project | URL | What |
|---|---|---|
| rdev | github.com/Narsil/rdev | Most complete Rust event tap, listen + grab + simulate |
| tauri-plugin-key-intercept | github.com/yigitkonur/tauri-plugin-macos-input-monitor | Background thread tap + Tauri UI |
| enigo | github.com/enigo-rs/enigo | High-level input simulation |
| core-graphics crate | docs.rs/core-graphics/0.25 | Safe CGEventTap wrapper |
| objc2-core-graphics | docs.rs/objc2-core-graphics | Modern auto-gen bindings |
| EventTapper (Swift) | github.com/usagimaru/EventTapper | Clean Swift reference |
| Hammerspoon eventtap | github.com/Hammerspoon/hammerspoon | Production C impl with timeout handling |
| iTerm2 iTermEventTap | github.com/gnachman/iTerm2 | Production ObjC teardown patterns |
