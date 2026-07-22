---
name: windows-input-overlay-rust
description: Windows input interception, text extraction, and overlay rendering from Rust -- SetWindowsHookEx, UI Automation, WinRT OCR, layered windows, wgpu transparency. Trigger on windows input hook, SetWindowsHookEx rust, UI Automation rust, windows overlay, windows transparent window rust, WinRT OCR.
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

rdev uses `SetWindowsHookEx` internally on Windows. This is the simplest path:

```rust
use rdev::{listen, Event, EventType};

// Blocks calling thread. Run on a background thread.
listen(|event: Event| {
    match event.event_type {
        EventType::ButtonPress(btn) => { /* mouse click */ }
        EventType::KeyPress(key) => { /* key down */ }
        _ => {}
    }
}).unwrap();
```

Double-click detection: rdev does not expose click count directly on Windows. Track timestamps between consecutive `ButtonPress` events and compare against `GetDoubleClickTime()` (~500ms default).

### Via raw Win32 (when rdev is insufficient)

```rust
// Using the `windows` crate
use windows::Win32::UI::WindowsAndMessaging::*;

// Low-level mouse hook
unsafe extern "system" fn mouse_proc(
    code: i32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if code >= 0 {
        let info = *(lparam.0 as *const MSLLHOOKSTRUCT);
        match wparam.0 as u32 {
            WM_LBUTTONDOWN => { /* info.pt has POINT { x, y } */ }
            WM_LBUTTONDBLCLK => { /* actual double-click message on Windows */ }
            _ => {}
        }
    }
    CallNextHookEx(None, code, wparam, lparam)
}

let hook = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), None, 0).unwrap();

// Must pump messages on the hook thread
let mut msg = MSG::default();
while GetMessageW(&mut msg, None, 0, 0).as_bool() {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
}
UnhookWindowsHookEx(hook);
```

Windows advantage: `WM_LBUTTONDBLCLK` is a first-class message. No manual timing needed (unlike macOS where you read click count from CGEvent fields).

### Input simulation (Cmd+C equivalent = Ctrl+C)

Via enigo:
```rust
use enigo::{Enigo, Key, Keyboard, Direction, Settings};
let mut enigo = Enigo::new(&Settings::default()).unwrap();
enigo.key(Key::Control, Direction::Press).unwrap();
enigo.key(Key::Unicode('c'), Direction::Click).unwrap();
enigo.key(Key::Control, Direction::Release).unwrap();
```

Via raw `SendInput`:
```rust
use windows::Win32::UI::Input::KeyboardAndMouse::*;

// Virtual keycodes: VK_CONTROL = 0x11, 'C' = 0x43
unsafe {
    let inputs = [
        INPUT { r#type: INPUT_KEYBOARD, Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: VK_CONTROL, ..Default::default() } } },
        INPUT { r#type: INPUT_KEYBOARD, Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: VIRTUAL_KEY(0x43), ..Default::default() } } },
        INPUT { r#type: INPUT_KEYBOARD, Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: VIRTUAL_KEY(0x43), dwFlags: KEYEVENTF_KEYUP, ..Default::default() } } },
        INPUT { r#type: INPUT_KEYBOARD, Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: VK_CONTROL, dwFlags: KEYEVENTF_KEYUP, ..Default::default() } } },
    ];
    SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
}
```

### Permissions

Windows is more permissive than macOS:
- `SetWindowsHookEx` with low-level hooks (`WH_KEYBOARD_LL`, `WH_MOUSE_LL`) works without special permissions from any user-level process
- No equivalent of macOS Accessibility permission gate
- Anti-virus may flag hook-based input monitoring
- UIPI (User Interface Privilege Isolation) blocks hooks from lower-privilege processes targeting higher-privilege windows

## Text extraction

### UI Automation (structured, like macOS AX)

Windows equivalent of the macOS Accessibility tree. `IUIAutomation` COM interface.

```rust
// Using the `windows` crate
use windows::Win32::UI::Accessibility::*;

unsafe {
    // Create automation instance
    let automation: IUIAutomation = CoCreateInstance(
        &CUIAutomation,
        None,
        CLSCTX_INPROC_SERVER,
    ).unwrap();

    // Get element at point
    let element = automation.ElementFromPoint(POINT { x: 100, y: 200 }).unwrap();

    // Get element properties
    let name = element.CurrentName().unwrap(); // text content
    let rect = element.CurrentBoundingRectangle().unwrap(); // RECT { left, top, right, bottom }

    // Walk the tree
    let walker = automation.ControlViewWalker().unwrap();
    let root = automation.GetRootElement().unwrap();
    // walker.GetFirstChildElement(root), walker.GetNextSiblingElement(child), etc.

    // Find all text elements
    let text_condition = automation.CreatePropertyCondition(
        UIA_ControlTypePropertyId,
        &VARIANT::from(UIA_TextControlTypeId as i32),
    ).unwrap();
    let all_text = root.FindAll(TreeScope_Descendants, &text_condition).unwrap();

    // TextPattern for rich text access
    let pattern: IUIAutomationTextPattern = element.GetCurrentPattern(UIA_TextPatternId).unwrap().cast().unwrap();
    let selection = pattern.GetSelection().unwrap();
}
```

Key differences from macOS AX:
- COM-based, not C function-based
- Tree walking via `IUIAutomationTreeWalker` (explicit walker object) vs macOS recursive attribute reads
- `TextPattern` provides rich text access (selected text, ranges, attributes) -- more structured than macOS's parameterized attributes
- `BoundingRectangle` returns screen-space RECT directly (no AXValue unwrapping)
- Generally faster than macOS AX -- COM calls are in-process for same-thread elements

### WinRT OCR (like macOS Vision)

```rust
// Using windows crate with winrt feature
use windows::Graphics::Imaging::*;
use windows::Media::Ocr::*;

// 1. Capture screen (via DXGI output duplication or BitBlt)
// 2. Create SoftwareBitmap from captured data
// 3. Run OCR
let engine = OcrEngine::TryCreateFromUserProfileLanguages().unwrap();
let result = engine.RecognizeAsync(&bitmap).unwrap().get().unwrap();

for line in result.Lines().unwrap() {
    for word in line.Words().unwrap() {
        let text = word.Text().unwrap();
        let rect = word.BoundingRect().unwrap(); // Rect { X, Y, Width, Height }
    }
}
```

Cross-platform crate: `uni-ocr` wraps WinRT OCR on Windows, Vision on macOS, Tesseract on Linux.

### Screen capture

```rust
// Modern: DXGI Desktop Duplication API (Windows 8+)
// Via windows crate: IDXGIOutputDuplication::AcquireNextFrame
// Returns GPU texture, very fast, supports HDR

// Legacy: BitBlt from screen DC
use windows::Win32::Graphics::Gdi::*;
let screen_dc = GetDC(None);
let mem_dc = CreateCompatibleDC(Some(screen_dc));
let bitmap = CreateCompatibleBitmap(screen_dc, width, height);
SelectObject(mem_dc, bitmap);
BitBlt(mem_dc, 0, 0, width, height, screen_dc, 0, 0, SRCCOPY);
```

## Overlay rendering

### Layered window (transparent overlay)

```rust
use windows::Win32::UI::WindowsAndMessaging::*;
use windows::Win32::Graphics::Dwm::*;

// Create window with extended styles
let ex_style = WS_EX_LAYERED      // enables transparency
    | WS_EX_TRANSPARENT    // click-through
    | WS_EX_TOPMOST        // always on top
    | WS_EX_TOOLWINDOW;   // no taskbar entry

let hwnd = CreateWindowExW(
    ex_style,
    w!("OverlayClass"),
    w!(""),
    WS_POPUP | WS_VISIBLE,
    0, 0, screen_width, screen_height,
    None, None, hinstance, None,
);

// Make fully transparent by default, opaque where we draw
SetLayeredWindowAttributes(hwnd, COLORREF(0), 0, LWA_COLORKEY);

// Or for per-pixel alpha:
// Use UpdateLayeredWindow with a 32-bit ARGB bitmap
```

### wgpu overlay on Windows

```rust
// wgpu surface on a transparent HWND
// CompositeAlphaMode options on Windows DX12:
// - Opaque (default)
// - PreMultiplied (supported on DX12)
// - PostMultiplied (supported on DX12)
surface_config.alpha_mode = wgpu::CompositeAlphaMode::PreMultiplied;
// Note: Windows DX12 supports PreMultiplied (unlike macOS Metal which only supports PostMultiplied)
```

### Selective click-through

Unlike macOS where `ignoresMouseEvents` is binary, Windows supports two patterns:

1. **Full click-through**: `WS_EX_TRANSPARENT` style -- all input passes through
2. **Selective (hit-test based)**: Handle `WM_NCHITTEST` and return `HTTRANSPARENT` for areas that should pass through:

```rust
// In window proc
WM_NCHITTEST => {
    // Check if cursor is over a drawn element
    if over_transparent_area(cursor_x, cursor_y) {
        return HTTRANSPARENT; // click passes through
    }
    return HTCLIENT; // we handle this click
}
```

This is more granular than macOS and avoids the per-frame toggle pattern.

### egui_overlay on Windows

egui_overlay works on Windows via `egui_render_three_d` (OpenGL) backend. The GLFW passthrough mechanism maps to the per-frame `WS_EX_TRANSPARENT` toggle.

`screen_overlay` crate (github.com/iwanders/screen_overlay) is Windows + X11 only and may be a better fit if macOS is not needed.

## Platform-specific gotchas

- **DPI awareness**: Windows has per-monitor DPI. Call `SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)` early or coordinates will be wrong on mixed-DPI setups.
- **Message pump required**: `SetWindowsHookEx` low-level hooks require a message loop on the hook thread. Without `GetMessage`/`PeekMessage`, hooks silently stop working.
- **UAC elevation**: Hooks cannot cross privilege boundaries. If the target app is elevated and your tool is not, hooks won't fire for that app.
- **Focus stealing**: `SetForegroundWindow` has restrictions. Windows throttles foreground changes to prevent focus stealing. Use `AttachThreadInput` workaround if needed.
- **Clipboard race**: After simulating Ctrl+C, the clipboard update is async. Sleep ~50-100ms or use `AddClipboardFormatListener` to wait for `WM_CLIPBOARDUPDATE`.

## Crates

| Crate | Purpose |
|---|---|
| `windows` | Official Microsoft Rust bindings for Win32 + WinRT |
| `rdev` | Cross-platform input (SetWindowsHookEx internally) |
| `enigo` | Cross-platform simulation (SendInput internally) |
| `arboard` | Clipboard |
| `uni-ocr` | OCR (WinRT OCR internally on Windows) |
| `screen_overlay` | Windows + X11 overlay with egui |

## Reference projects

| Project | URL | What |
|---|---|---|
| screen_overlay | github.com/iwanders/screen_overlay | Win + X11 overlay, RAII handles |
| screenpipe | github.com/screenpipe/screenpipe | Full pipeline including Windows UI Automation |
| lan-mouse | github.com/feschber/lan-mouse | Cross-platform input capture/emulation |
| microsoft/windows-rs | github.com/microsoft/windows-rs | Official Win32/WinRT Rust bindings |
