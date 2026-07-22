---
name: cross-platform-input-rust
description: Cross-platform input handling in Rust -- rdev, enigo, inputbot, global-hotkey comparison. Listen, simulate, grab on Windows/macOS/Linux. Platform abstraction patterns. Trigger on rdev, enigo, inputbot, cross-platform input, keyboard hook rust, mouse hook rust, global hotkey rust.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Choosing and using cross-platform input crates in Rust for listening to keyboard/mouse events, simulating input, and intercepting (grabbing) events.

## Platform support matrix

| Crate | Win | macOS | X11 | Wayland | Listen | Simulate | Grab |
|---|---|---|---|---|---|---|---|
| **rdev** | Y | Y | Y | N/partial | Y | Y | Y (unstable) |
| **rdevin** (rdev fork) | Y | Y | Y | Partial | Y | Y | Y |
| **enigo** | Y | Y | Y | Experimental | N | Y | N |
| **inputbot** | Y | N | Y | N | Y | Y | Y (hotkeys) |
| **livesplit-hotkey** | Y | Y | Y | Y | Hotkeys | N | N |
| **global-hotkey** (tauri) | Y | Y | Y | N | Hotkeys | N | N |
| **input-capture** (lan-mouse) | Y | Y | Y | Y (native) | Y | Y | N |

## rdev -- the workhorse

Most widely used. Conditional compilation selects platform backend.

```toml
[dependencies]
rdev = "0.5"
```

**Listen** (non-blocking event stream):
```rust
use rdev::{listen, Event, EventType};

fn callback(event: Event) {
    match event.event_type {
        EventType::KeyPress(key) => println!("pressed {:?}", key),
        EventType::ButtonPress(btn) => println!("clicked {:?}", btn),
        EventType::MouseMove { x, y } => {},
        _ => {}
    }
}

// Blocks the calling thread
listen(callback).expect("failed to listen");
```

**Simulate**:
```rust
use rdev::{simulate, EventType, Key};

simulate(&EventType::KeyPress(Key::MetaLeft)).unwrap();
simulate(&EventType::KeyPress(Key::KeyC)).unwrap();
simulate(&EventType::KeyRelease(Key::KeyC)).unwrap();
simulate(&EventType::KeyRelease(Key::MetaLeft)).unwrap();
```

**Grab** (intercept and optionally suppress):
```rust
use rdev::{grab, Event, EventType};

// Return Some(event) to pass through, None to suppress
grab(|event: Event| -> Option<Event> {
    match event.event_type {
        EventType::KeyPress(Key::CapsLock) => None, // eat CapsLock
        _ => Some(event),
    }
}).expect("failed to grab");
```

**Platform internals:**
- macOS: CGEventTap (Accessibility permission)
- Windows: SetWindowsHookEx
- Linux listen: XRecord (X11 only)
- Linux grab: evdev (works on Wayland)

**Known limitations:** Dead keys broken on Linux. No event modification in grab (only pass/suppress). macOS must be primary app before calling listen (no fork before listen).

## enigo -- simulation focused

```toml
[dependencies]
enigo = "0.2"
```

```rust
use enigo::{Enigo, Key, Keyboard, Mouse, Settings};

let mut enigo = Enigo::new(&Settings::default()).unwrap();

// Type text
enigo.text("hello").unwrap();

// Key combo (Cmd+C on macOS)
enigo.key(Key::Meta, enigo::Direction::Press).unwrap();
enigo.key(Key::Unicode('c'), enigo::Direction::Click).unwrap();
enigo.key(Key::Meta, enigo::Direction::Release).unwrap();

// Mouse
enigo.move_mouse(100, 200, enigo::Coordinate::Abs).unwrap();
enigo.button(enigo::Button::Left, enigo::Direction::Click).unwrap();
```

Wayland support via `wayland` and `libei` feature flags but marked experimental.

## global-hotkey -- tauri's solution

For hotkey-only use cases (no mouse, no continuous listening):

```toml
[dependencies]
global-hotkey = "0.6"
```

```rust
use global_hotkey::{GlobalHotKeyManager, hotkey::{HotKey, Modifiers, Code}};

let manager = GlobalHotKeyManager::new().unwrap();
let hotkey = HotKey::new(Some(Modifiers::SUPER), Code::KeyD);
manager.register(hotkey).unwrap();

// In event loop:
if let Ok(event) = GlobalHotKeyEvent::receiver().try_recv() {
    if event.id == hotkey.id() { /* triggered */ }
}
```

Requires a platform event loop on the registration thread.

## Choosing a crate

| Need | Use |
|---|---|
| Listen to all keyboard/mouse events | `rdev` |
| Simulate keyboard/mouse input | `enigo` |
| Global hotkey activation only | `global-hotkey` or `livesplit-hotkey` |
| Intercept and suppress events | `rdev` grab (unstable) |
| Native Wayland input capture | `input-capture` (lan-mouse) |
| WASM + desktop hotkeys | `livesplit-hotkey` |

## Cross-platform overlay input architecture

For a tool that listens for input and renders an overlay:

```
Thread 1 (background): rdev::listen() -> mpsc::Sender<InputEvent>
Thread 2 (background): worker receives InputEvent, does processing
Main thread: egui_overlay render loop, reads Arc<Mutex<State>>
```

macOS constraint: Cocoa UI must be on main thread. Input tap does NOT need main thread. Split accordingly.

## Platform-specific text selection

| Platform | API | Rust Crate |
|---|---|---|
| macOS | AXUIElement (Accessibility) | `accessibility`, `accessibility-sys` |
| Windows | UI Automation (IUIAutomation) | `windows` crate |
| Linux | AT-SPI (D-Bus) | `zbus` |
| All | Simulate Cmd/Ctrl+C | `get-selected-text` (tries AX first, falls back to clipboard) |

## Cross-platform clipboard

```toml
[dependencies]
arboard = "3"
```

```rust
use arboard::Clipboard;

let mut clipboard = Clipboard::new().unwrap();
let text = clipboard.get_text().unwrap();
clipboard.set_text("new content").unwrap();
```

Linux note: the source app must stay alive to answer paste requests (X11/Wayland selection model). Windows/macOS copy data into system storage.

## Cross-platform OCR

| Crate | macOS | Windows | Linux | Notes |
|---|---|---|---|---|
| `uni-ocr` | Vision | WinRT OCR | Tesseract | Best unified API |
| `ocrs` | Y | Y | Y | Pure Rust, ONNX models, no system deps |

## Reference projects

| Project | URL | What |
|---|---|---|
| rdev | github.com/Narsil/rdev | Standard cross-platform input |
| rdevin | github.com/justdeeevin/rdevin | Maintained rdev fork with RustDesk patches |
| enigo | github.com/enigo-rs/enigo | Cross-platform simulation |
| lan-mouse | github.com/feschber/lan-mouse | Software KVM, native Wayland support |
| screenpipe | github.com/screenpipe/screenpipe | Full screen capture + OCR + input pipeline |
| global-hotkey | github.com/tauri-apps/global-hotkey | Tauri's hotkey crate |
