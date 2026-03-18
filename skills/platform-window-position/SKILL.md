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

**Critical**: `CGWindowListCopyWindowInfo()` returns `*const __CFArray` (a raw pointer), NOT `Option<CFArray>`. Must null-check and wrap manually:

```rust
unsafe {
    let ptr = CGWindowListCopyWindowInfo(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID,
    );
    if ptr.is_null() { return None; }
    // ptr is now a valid owned CFArray -- use create_rule
    // But don't use the high-level CFArray .get() -- returns ItemRef that can't cast to CFDictionaryRef
    // Use raw C functions instead:
    let count = CFArrayGetCount(ptr);
    for i in 0..count {
        let dict_ptr = CFArrayGetValueAtIndex(ptr, i) as CFDictionaryRef;
        // ... extract fields via CFDictionaryGetValue
    }
}
```

The high-level `CFArray<T>.get(i)` returns `ItemRef` which cannot be cleanly cast to `CFDictionaryRef`. `CFArrayGetCount` and `CFArrayGetValueAtIndex` return `*const c_void` that cast to `CFDictionaryRef` without issue.

### Getting the terminal PID

**`TERM_PROGRAM` is unreliable inside tmux/screen**: When running inside tmux, `TERM_PROGRAM` is set to `"tmux"`, not the real terminal emulator name. Same for `screen`. Any code that reads `TERM_PROGRAM` to identify the terminal (e.g. to find its PID) must fall through to a process-list scan when the value is `"tmux"` or `"screen"`:

```rust
const KNOWN_TERMINALS: &[&str] = &[
    "iTerm2", "Terminal", "wezterm-gui", "alacritty", "kitty", "WezTerm",
];

if term == "tmux" || term == "screen" {
    return find_terminal_by_scan();
}

fn find_terminal_by_scan() -> Option<i32> {
    let output = Command::new("ps").args(["-eo", "pid,comm"]).output().ok()?;
    let stdout = String::from_utf8(output.stdout).ok()?;
    for line in stdout.lines() {
        let trimmed = line.trim();
        let mut parts = trimmed.splitn(2, char::is_whitespace);
        let pid_str = parts.next()?;
        let comm = parts.next()?.trim();
        let binary = comm.rsplit('/').next().unwrap_or(comm);
        if KNOWN_TERMINALS.iter().any(|t| *t == binary) {
            return pid_str.parse().ok();
        }
    }
    None
}
```

**Do not use `pgrep -x`** -- it matches against the `comm` field which for macOS app bundles contains the full path, so `-x` (exact match) never fires.

Walk the ppid chain instead:

```rust
// Chain inside tmux: our_process → shell → tmux_server → terminal_emulator
// Use: ps -o ppid= -p PID  to get parent
//      ps -o comm= -p PID  to get binary path (needs rsplit('/').next() for name)

fn get_terminal_pid() -> Option<i32> {
    let mut pid = std::process::id() as i32;
    let known = ["iTerm2", "WezTerm", "Alacritty", "Terminal", "kitty", "Hyper"];
    for _ in 0..8 {
        let comm = ps_comm(pid)?;
        let name = comm.rsplit('/').next().unwrap_or(&comm);
        if known.iter().any(|&k| name == k) { return Some(pid); }
        pid = ps_ppid(pid)?;
    }
    None
}

fn ps_ppid(pid: i32) -> Option<i32> {
    let out = std::process::Command::new("ps")
        .args(["-o", "ppid=", "-p", &pid.to_string()])
        .output().ok()?;
    String::from_utf8(out.stdout).ok()?.trim().parse().ok()
}

fn ps_comm(pid: i32) -> Option<String> {
    let out = std::process::Command::new("ps")
        .args(["-o", "comm=", "-p", &pid.to_string()])
        .output().ok()?;
    Some(String::from_utf8(out.stdout).ok()?.trim().to_string())
}
```

`ps -o comm=` returns the full path on macOS; strip to basename with `rsplit('/').next()`.

### Crates for macOS

```toml
[target.'cfg(target_os = "macos")'.dependencies]
core-foundation = "0.10"
core-graphics = "0.25"
```

Note: the `core-graphics` crate's `CGWindowListCopyWindowInfo` binding uses raw `CFDictionaryRef` pointers. Extracting values requires unsafe `CFDictionaryGetValue` + `TCFType::wrap_under_get_rule` casts. The `kCGWindowBounds` value is itself a nested `CFDictionaryRef` with keys "X", "Y", "Width", "Height" as `CFNumber` values.

### Working raw CFDictionary extraction

```rust
use core_foundation::base::TCFType;
use core_foundation::dictionary::{CFDictionaryGetValue, CFDictionaryRef};
use core_foundation::number::{CFNumber, CFNumberRef};
use core_foundation::string::CFString;

fn cf_dict_get_i32(dict: CFDictionaryRef, key: &str) -> Option<i32> {
    unsafe {
        let cf_key = CFString::new(key);
        // as_CFTypeRef() requires TCFType in scope
        let val = CFDictionaryGetValue(dict, cf_key.as_CFTypeRef() as *const _);
        if val.is_null() { return None; }
        // wrap_under_get_rule for borrowed refs (dictionary lookup = no ownership transfer)
        // wrap_under_create_rule for owned refs (from Create functions)
        let cf_num: CFNumber = TCFType::wrap_under_get_rule(val as CFNumberRef);
        cf_num.to_i32()
    }
}
```

`kCGWindowBounds` is a nested `CFDictionaryRef` with keys `"X"`, `"Y"`, `"Width"`, `"Height"` as `CFNumber`. Extract it the same way, cast the `*const c_void` value to `CFDictionaryRef`, then recurse.

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

### Three distinct origin points

When placing overlays against terminal pane coordinates, there are three different x/y origins in play:

1. **Window frame origin** -- what CGWindowListCopyWindowInfo returns (includes title bar vertically)
2. **Content area origin** -- window frame + title bar height; where the terminal emulator draws
3. **Cell grid origin** -- content area + terminal insets (e.g. iTerm2 adds ~4px left, ~2px top margin inside the content area before the character grid starts)

Cell coordinates from `tmux list-panes` are relative to the cell grid origin (#3). To place an overlay at a pane's screen position, add all three offsets. Skipping the inset step causes the overlay to misalign by a few pixels from the visible cell content and to be narrower than the full terminal row (since the right inset is not added to width either).

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
