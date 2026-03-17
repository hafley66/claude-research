---
name: platform-window-position
description: Getting terminal window screen position and dimensions on macOS (CGWindowListCopyWindowInfo, Accessibility API) and Linux (xdotool, XGetWindowAttributes, xwininfo). Trigger on terminal window position, screen coordinates, window geometry, CGWindowList, xdotool getwindowgeometry, window pixel position.
license: MIT
metadata:
  audience: developers
  workflow: tmux-overlay
---

## What this covers

Getting the absolute screen-pixel position and size of the terminal emulator window. Required to convert tmux cell coordinates (relative to the terminal) into absolute screen coordinates (where to place overlay windows).

## Getting frontmost app PID on macOS

Use `CGWindowListCopyWindowInfo` with `kCGWindowListOptionOnScreenOnly`, iterate windows, find the first layer-0 window, read `kCGWindowOwnerPID`. Do not use `lsappinfo` -- it is unreliable. Do not use `AXUIElementCreateSystemWide` from a process that runs a `CGEventTap`: it returns -25204 (timeout) on every call, even from separate threads. Use `AXUIElementCreateApplication(pid)` instead, with the PID obtained from the window list.

## macOS: CGWindowListCopyWindowInfo

The most reliable macOS approach. No accessibility permissions needed.

```rust
use core_foundation::base::TCFType;
use core_foundation::dictionary::CFDictionary;
use core_foundation::number::CFNumber;
use core_foundation::string::CFString;
use core_graphics::display::*;

fn get_terminal_window_rect(terminal_pid: i32) -> Option<(i32, i32, u32, u32)> {
    let windows = CGWindowListCopyWindowInfo(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID,
    )?;

    for i in 0..windows.len() {
        let window: CFDictionary = windows.get(i);

        let pid = window.get("kCGWindowOwnerPID")?.downcast::<CFNumber>()?.to_i32()?;
        if pid != terminal_pid {
            continue;
        }

        // kCGWindowBounds is a CFDictionary with X, Y, Width, Height
        let bounds = window.get("kCGWindowBounds")?;
        let rect = CGRect::from_dict_representation(&bounds)?;

        return Some((
            rect.origin.x as i32,
            rect.origin.y as i32,
            rect.size.width as u32,
            rect.size.height as u32,
        ));
    }
    None
}
```

### Getting the terminal PID

```rust
fn get_terminal_pid() -> Option<i32> {
    // $TMUX contains: /tmp/tmux-501/default,12345,0
    // The middle number is the tmux server PID
    // But we want the terminal emulator PID, not tmux

    // Option 1: Walk up the process tree from our PID
    // our process → shell → tmux client → terminal
    let ppid = std::os::unix::process::parent_id(); // shell
    let shell_ppid = get_ppid(ppid)?;                // tmux client or terminal
    // ... walk up until you hit a known terminal binary

    // Option 2: Use $TERM_PROGRAM or check known terminal bundle IDs
    // "WezTerm", "Alacritty", "iTerm.app", "Apple_Terminal"
    let term = std::env::var("TERM_PROGRAM").ok()?;
    find_pid_by_name(&term)
}
```

### Crates for macOS

```toml
[target.'cfg(target_os = "macos")'.dependencies]
core-foundation = "0.10"
core-graphics = "0.25"
```

Note: the `core-graphics` crate's `CGWindowListCopyWindowInfo` binding uses raw `CFDictionaryRef` pointers. Extracting values requires unsafe `CFDictionaryGetValue` + `TCFType::wrap_under_get_rule` casts. The `kCGWindowBounds` value is itself a nested `CFDictionaryRef` with keys "X", "Y", "Width", "Height" as `CFNumber` values.

### Working raw CFDictionary extraction

The pseudocode above uses a convenience API that doesn't exist on the actual crate. The real pattern:

```rust
use core_foundation::base::TCFType;
use core_foundation::dictionary::{CFDictionaryGetValue, CFDictionaryRef};
use core_foundation::number::{CFNumber, CFNumberRef};
use core_foundation::string::CFString;

unsafe fn dict_get_f64(dict: CFDictionaryRef, key: &str) -> f64 {
    let cf_key = CFString::new(key);
    let val = unsafe { CFDictionaryGetValue(dict, cf_key.as_CFTypeRef() as *const _) };
    if val.is_null() { return 0.0; }
    let cf_num: CFNumber = unsafe { TCFType::wrap_under_get_rule(val as CFNumberRef) };
    cf_num.to_f64().unwrap_or(0.0)
}
```

Rust 2024 edition requires explicit `unsafe {}` blocks inside `unsafe fn`.

### Title bar offset

CGWindowListCopyWindowInfo returns the frame including the title bar. The content area starts below it. Terminal content offset:

```rust
// Typical macOS title bar height: 28px (standard), 22px (compact)
// Can query via NSWindow.contentRect but that requires linking AppKit
const MACOS_TITLEBAR_HEIGHT: i32 = 28;

let content_y = window_y + MACOS_TITLEBAR_HEIGHT;
```

For borderless/fullscreen terminals, offset is 0.

## macOS: Accessibility API (alternative)

More precise (gives content rect directly) but requires user-granted accessibility permission.

```rust
use accessibility::AXUIElement;

fn get_window_position_a11y(pid: i32) -> Option<(i32, i32, u32, u32)> {
    let app = AXUIElement::application(pid);
    let windows = app.attribute("AXWindows")?;
    let window = windows.get(0)?;

    let position = window.attribute("AXPosition")?; // CGPoint
    let size = window.attribute("AXSize")?;          // CGSize

    Some((position.x as i32, position.y as i32, size.w as u32, size.h as u32))
}
```

**Tradeoff**: More accurate but users must grant permission in System Settings > Privacy > Accessibility. CGWindowList needs no permissions.

**AX call safety**: `AXUIElementCopyAttributeValue` and related calls can throw NSExceptions that Rust cannot catch (fatal: "Rust cannot catch foreign exceptions"). Wrap every AX call in an ObjC `@try/@catch` trampoline (`ax_safe.m`, compiled via the `cc` crate in `build.rs`). Also wrap CFArray iteration on AX results -- stale AX refs in arrays also throw. Set `AXUIElementSetMessagingTimeout` to 0.25-0.5s to get error codes instead of 6-second hangs.

## Linux X11: xdotool

Simple, works everywhere X11 is running.

```rust
fn get_terminal_window_rect_x11() -> Option<(i32, i32, u32, u32)> {
    // Get the focused window (assumes terminal is focused during init)
    let output = std::process::Command::new("xdotool")
        .args(["getactivewindow", "getwindowgeometry", "--shell"])
        .output().ok()?;

    let stdout = String::from_utf8(output.stdout).ok()?;
    // Output:
    // WINDOW=12345678
    // X=100
    // Y=200
    // WIDTH=800
    // HEIGHT=600
    parse_xdotool_geometry(&stdout)
}
```

### Without xdotool: xwininfo

```bash
xwininfo -id $(xdotool getactivewindow)
# Returns absolute upper-left X/Y and width/height
```

### Without any external tools: X11 API directly

```rust
// Using x11rb crate
use x11rb::connection::Connection;
use x11rb::protocol::xproto::*;

fn get_window_geometry(window_id: u32) -> Option<(i32, i32, u32, u32)> {
    let (conn, _) = x11rb::connect(None).ok()?;
    let geom = conn.get_geometry(window_id).ok()?.reply().ok()?;

    // get_geometry returns position relative to parent
    // translate to root coordinates
    let translated = conn.translate_coordinates(
        window_id,
        conn.setup().roots[0].root,
        0, 0
    ).ok()?.reply().ok()?;

    Some((
        translated.dst_x as i32,
        translated.dst_y as i32,
        geom.width as u32,
        geom.height as u32,
    ))
}
```

```toml
[target.'cfg(target_os = "linux")'.dependencies]
x11rb = "0.13"
```

## Linux Wayland

Wayland does not expose window positions to clients. By design, clients don't know where they are on screen.

**Workarounds by compositor**:

- **Sway**: `swaymsg -t get_tree` returns window positions in JSON
- **Hyprland**: `hyprctl clients -j` returns window positions in JSON
- **GNOME/Mutter**: No IPC for window positions. Effectively unsupported.

```rust
fn get_window_rect_sway(app_id: &str) -> Option<(i32, i32, u32, u32)> {
    let output = Command::new("swaymsg")
        .args(["-t", "get_tree", "-r"])
        .output().ok()?;
    let tree: serde_json::Value = serde_json::from_slice(&output.stdout).ok()?;
    // Walk the tree looking for node with app_id matching terminal
    find_node_by_app_id(&tree, app_id)
        .map(|node| (node.rect.x, node.rect.y, node.rect.width, node.rect.height))
}
```

## Polling strategy

Terminal window position changes when the user drags the window. There's no reliable cross-platform event for this.

```rust
// Poll at 10fps - fast enough for smooth overlay tracking during drag
// Emit only when position actually changes
loop {
    let rect = get_terminal_window_rect(pid)?;
    if rect != last_rect {
        tx.send(rect)?;
        last_rect = rect;
    }
    std::thread::sleep(Duration::from_millis(100));
}
```

On macOS, `CGEvent` tap can detect window move events system-wide but requires accessibility permissions. Polling is simpler and sufficient.

## Testing

- Unit test the parsing functions (xdotool output, CGWindowList dictionaries)
- Integration tests with real windows require a display (xvfb on Linux, real display on macOS CI)
- Mock the platform API behind a trait for the pipeline layer:

```rust
trait WindowPositionSource: Send + 'static {
    fn get_position(&self) -> Option<(i32, i32, u32, u32)>;
}

struct RealSource { pid: i32 }
struct MockSource { position: Arc<Mutex<(i32, i32, u32, u32)>> }
```
