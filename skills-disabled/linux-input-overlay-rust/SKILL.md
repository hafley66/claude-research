---
name: linux-input-overlay-rust
description: Linux input interception, text extraction, and overlay rendering from Rust -- XRecord, evdev, AT-SPI, Tesseract OCR, X11 composite overlays, Wayland limitations. Trigger on linux input hook, XRecord rust, evdev rust, AT-SPI rust, linux overlay, X11 overlay rust, wayland overlay.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
  status: untested-reference
---

## Status

Reference material assembled from research. Not tested on hardware. Treat code patterns as directional, not copy-paste ready.

## Input interception

### Via rdev (recommended starting point)

```rust
use rdev::{listen, grab, Event, EventType};

// Listen: uses XRecord on X11 (Wayland: no support)
std::thread::spawn(|| {
    listen(|event: Event| {
        match event.event_type {
            EventType::ButtonPress(btn) => { /* click */ }
            EventType::KeyPress(key) => { /* key */ }
            _ => {}
        }
    }).unwrap();
});

// Grab: uses evdev on Linux (works on both X11 and Wayland)
grab(|event| -> Option<Event> {
    Some(event) // pass through, or None to suppress
}).unwrap();
```

rdev grab on Linux requires root/input group access (reads `/dev/input/event*` directly).

### X11: XRecord extension

What rdev uses internally for listen mode. Records events from the X server.

```rust
// Raw approach via x11-dl or xcb crate
// 1. Open display connection
// 2. XRecordCreateContext with XRecordAllClients
// 3. XRecordEnableContextAsync with callback
// 4. Callback receives XRecordInterceptData with event data
```

Limitations: X11 only. Does not work on pure Wayland. Does not capture events in other VTs.

### Wayland: the hard problem

Wayland by design does not allow clients to intercept global input. Approaches:

1. **evdev** (what rdev grab uses): Read `/dev/input/event*` directly. Requires root or `input` group. Works regardless of display server. Cannot distinguish which window has focus.

2. **libei** (GNOME 45+, KDE Plasma 6.1+): Emulation/Input protocol. The `input-capture` crate (from lan-mouse) wraps this. Requires compositor support.

3. **wlroots protocols** (Sway, Hyprland): `wlr-virtual-pointer` and `virtual-keyboard` protocols for input simulation. `input-capture` crate supports these.

4. **XWayland**: Run under XWayland compatibility layer. XRecord works but only sees X11 client events.

### Input simulation

Via enigo:
```rust
use enigo::{Enigo, Key, Keyboard, Direction, Settings};
let mut enigo = Enigo::new(&Settings::default()).unwrap();
enigo.key(Key::Control, Direction::Press).unwrap();
enigo.key(Key::Unicode('c'), Direction::Click).unwrap();
enigo.key(Key::Control, Direction::Release).unwrap();
```

Via xdotool (X11, simpler but shells out):
```rust
std::process::Command::new("xdotool")
    .args(["key", "ctrl+c"])
    .status().unwrap();
```

### Double-click detection

Neither X11 nor Wayland provide double-click as a distinct event. Track timestamps between ButtonPress events. Default double-click interval varies by toolkit (GTK: 400ms, Qt: 400ms). Read from gsettings:

```bash
gsettings get org.gnome.desktop.peripherals.mouse double-click
# Returns integer milliseconds
```

## Text extraction

### AT-SPI (structured, like macOS AX / Windows UIA)

Linux accessibility is D-Bus based. The AT-SPI (Assistive Technology Service Provider Interface) protocol.

```rust
// Using atspi crate (or raw zbus D-Bus calls)
// 1. Connect to the AT-SPI bus
// 2. Get the Registry
// 3. Enumerate accessible applications
// 4. Walk each app's accessible tree
// 5. Filter by Role::StaticText, Role::Label, etc.
// 6. Read Name/Description for text content
// 7. Read Component interface for position/size

// Component interface gives:
// GetExtents(coordType) -> (x, y, width, height)
// coordType: Screen (global) or Window (relative)
```

Crates:
- `atspi` -- high-level AT-SPI client
- `zbus` -- D-Bus library (AT-SPI is a D-Bus protocol)
- `accesskit` -- primarily for *exposing* accessibility, not reading other apps

Coverage: GTK apps have good AT-SPI support. Qt apps need `QT_ACCESSIBILITY=1` environment variable. Electron apps expose via AT-SPI when accessibility is enabled. Terminal emulators vary.

### Tesseract OCR (fallback)

```rust
// Via uni-ocr (unified API):
// uni-ocr uses Tesseract on Linux automatically

// Via rusty-tesseract:
use rusty_tesseract::{Args, Image};
let img = Image::from_path("screenshot.png").unwrap();
let args = Args { lang: "eng".into(), ..Default::default() };
let output = rusty_tesseract::image_to_data(&img, &args).unwrap();
// output.data contains word-level bounding boxes
```

Requires `tesseract` and `leptonica` system packages:
```bash
# Debian/Ubuntu
sudo apt install tesseract-ocr libtesseract-dev libleptonica-dev

# Fedora
sudo dnf install tesseract tesseract-devel leptonica-devel
```

For word-level bounding boxes, use `image_to_data` (TSV output with bbox columns) rather than `image_to_string`.

### Screen capture

```rust
// X11: via xcb or x11-dl
// XGetImage or XShmGetImage (shared memory, faster)

// Wayland: via PipeWire + screencast portal
// org.freedesktop.portal.ScreenCast D-Bus interface
// Returns a PipeWire stream that you read frames from

// Cross-platform: screenshots crate
use screenshots::Screen;
let screens = Screen::all().unwrap();
let image = screens[0].capture().unwrap(); // returns RgbaImage
```

The `screenshots` crate uses DXGI on Windows, CoreGraphics on macOS, X11/PipeWire on Linux.

## Overlay rendering

### X11: Composite extension overlay

```rust
// Requires a compositor (picom, compton, KWin, etc.)
// Without compositor: transparent regions are black

// 1. Find a visual with alpha channel (32-bit ARGB)
// 2. Create window with that visual
// 3. Set _NET_WM_WINDOW_TYPE_DOCK or _NET_WM_WINDOW_TYPE_NOTIFICATION
// 4. Set window properties:
//    - _NET_WM_STATE_ABOVE (always on top)
//    - _NET_WM_STATE_STICKY (all desktops)

// Click-through via XShape input shape:
// XShapeCombineRectangles with ShapeInput and ShapeSet
// An empty input shape = full click-through
// Or define specific regions that accept input
```

X11 click-through is more flexible than macOS: you can define arbitrary pixel regions that accept input vs pass-through, using the XShape extension with `ShapeInput` kind.

### Wayland: overlay limitations

Wayland fundamentally prevents clients from:
- Positioning their own windows (compositor decides)
- Creating always-on-top windows (compositor decides)
- Creating fullscreen overlays that other windows render under

Workarounds:
1. **Layer-shell** (wlroots compositors only): `wlr-layer-shell` protocol allows overlay layers. The `smithay-client-toolkit` crate supports this.
2. **Compositor window rules**: Sway/Hyprland IPC can force window position and always-on-top:
   ```bash
   # Sway
   swaymsg 'for_window [app_id="word-linker"] floating enable, sticky enable'
   # Hyprland
   hyprctl keyword windowrulev2 'float,class:word-linker'
   hyprctl keyword windowrulev2 'pin,class:word-linker'
   ```
3. **XWayland**: Run the overlay as an X11 app under XWayland. Compositing and positioning work as on X11, but you lose native Wayland crispness on HiDPI.

### egui_overlay on Linux

egui_overlay uses `egui_render_three_d` (OpenGL) on Linux. Runs on X11 via GLFW. On Wayland, falls back to XWayland.

For native Wayland overlay with egui, no good solution exists yet. The layer-shell approach would require a custom windowing backend.

## Platform-specific gotchas

- **Compositor required for transparency**: Without picom/compton/KWin on X11, transparent windows render with black backgrounds.
- **evdev permissions**: Reading `/dev/input/event*` requires root or `input` group membership. `sudo usermod -aG input $USER` then re-login.
- **AT-SPI activation**: Some desktops don't start the AT-SPI bus by default. Check `ATSPI_BUS_ADDRESS` env var. Install `at-spi2-core` if missing.
- **Qt accessibility**: Set `QT_ACCESSIBILITY=1` environment variable or Qt apps won't expose AT-SPI trees.
- **Wayland clipboard**: On Wayland, clipboard requires the window to have focus to read (security model). `wl-clipboard` tools work around this.
- **Mixed X11/Wayland**: On Wayland sessions, some apps run under XWayland. AT-SPI still works (it's D-Bus), but screen capture and overlay positioning differ.
- **HiDPI**: X11 has no native HiDPI. Apps either use Xft.dpi (integer scaling) or toolkit-level fractional scaling. Wayland handles DPI per-output via buffer scale.

## Crates

| Crate | Purpose |
|---|---|
| `rdev` | Cross-platform input (XRecord listen, evdev grab on Linux) |
| `enigo` | Cross-platform simulation (XTest on X11, experimental Wayland) |
| `input-capture` (lan-mouse) | Native Wayland input via libei/wlroots |
| `atspi` | AT-SPI accessibility client |
| `zbus` | D-Bus (underlies AT-SPI) |
| `smithay-client-toolkit` | Wayland client with layer-shell support |
| `rusty-tesseract` | Tesseract OCR wrapper |
| `uni-ocr` | Unified OCR (Tesseract on Linux) |
| `screenshots` | Cross-platform screen capture |
| `egui_overlay` | Overlay rendering (via XWayland on Wayland) |
| `x11rb` | Modern X11 protocol bindings |

## Reference projects

| Project | URL | What |
|---|---|---|
| screenpipe | github.com/screenpipe/screenpipe | Full pipeline including Linux AT-SPI + OCR |
| lan-mouse | github.com/feschber/lan-mouse | Native Wayland input capture/emulation |
| wayscriber | github.com/devmobasa/wayscriber | Wayland screen annotation (smithay + Cairo) |
| egui_overlay | github.com/coderedart/egui_overlay | X11 overlay via GLFW + OpenGL |
| screen_overlay | github.com/iwanders/screen_overlay | X11 overlay with egui |
